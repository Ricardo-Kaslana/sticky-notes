mod commands;
mod models;
mod tray;
mod windows;

use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use tauri::Manager;

/// App-wide state shared with every window/event handler.
#[derive(Default)]
pub(crate) struct AppState {
    /// True once the user explicitly chose to quit (tray Quit, or closing the
    /// main window with tray-on-close disabled). While set, the main window's
    /// CloseRequested handler must NOT `prevent_close`, otherwise the app can
    /// never actually terminate.
    pub(crate) is_exiting: AtomicBool,
    /// Parsed settings.json, cached after the first disk read.
    pub(crate) settings: Mutex<Option<models::Settings>>,
}

/// Mirror of JS `encodeURIComponent`: everything but alphanumerics and
/// `-_.!~*'()` is percent-encoded. Needed to rewrite `asset.localhost` image
/// URLs, which the frontend builds with encodeURIComponent.
fn encode_uri_component(s: &str) -> String {
    use percent_encoding::{utf8_percent_encode, AsciiSet, NON_ALPHANUMERIC};
    const KEEP: &AsciiSet = &NON_ALPHANUMERIC
        .remove(b'-')
        .remove(b'_')
        .remove(b'.')
        .remove(b'!')
        .remove(b'~')
        .remove(b'*')
        .remove(b'\'')
        .remove(b'(')
        .remove(b')');
    utf8_percent_encode(s, KEEP).to_string()
}

/// Note HTML embeds absolute attachment paths (as
/// `http://asset.localhost/<encodeURIComponent(path)>`), so after moving the
/// app-data dir every note JSON must have the old dir prefix rewritten.
fn rewrite_attachment_paths(old_dir: &Path, new_dir: &Path) {
    let old_s = old_dir.to_string_lossy().to_string();
    let new_s = new_dir.to_string_lossy().to_string();
    // Two forms can appear inside a note JSON file: the URL-encoded form
    // (inside asset.localhost URLs) and the raw path JSON-escaped (`\` -> `\\`).
    let pairs = [
        (encode_uri_component(&old_s), encode_uri_component(&new_s)),
        (old_s.replace('\\', "\\\\"), new_s.replace('\\', "\\\\")),
    ];
    let notes_dir = new_dir.join("notes");
    let Ok(entries) = std::fs::read_dir(&notes_dir) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().map_or(true, |e| e != "json") {
            continue;
        }
        let Ok(content) = std::fs::read_to_string(&path) else {
            continue;
        };
        let mut updated = content.clone();
        for (from, to) in &pairs {
            updated = updated.replace(from.as_str(), to);
        }
        if updated != content {
            if let Err(e) = commands::atomic_write(&path, updated.as_bytes()) {
                log::warn!("[migrate] failed to rewrite {:?}: {}", path, e);
            }
        }
    }
}

/// One-time migration from the pre-v0.1.6 app-data dir (`sticky-notes`, from
/// the old bare identifier) to the current reverse-domain identifier dir.
/// Runs before any window exists so nothing races the file moves.
fn migrate_legacy_app_data(app: &tauri::AppHandle) {
    let Ok(new_dir) = app.path().app_data_dir() else {
        return;
    };
    let Some(parent) = new_dir.parent() else {
        return;
    };
    let old_dir = parent.join("sticky-notes");
    // Only migrate when the old data exists and the new dir hasn't been
    // populated yet (a fresh install or an already-migrated install skips).
    if !old_dir.join("notes").is_dir() || new_dir.join("notes").exists() {
        return;
    }
    log::info!("[migrate] moving app data {:?} -> {:?}", old_dir, new_dir);
    if let Err(e) = std::fs::create_dir_all(&new_dir) {
        log::warn!("[migrate] cannot create {:?}: {}; keeping old data", new_dir, e);
        return;
    }
    for name in ["notes", "attachments", "settings.json"] {
        let from = old_dir.join(name);
        if !from.exists() {
            continue;
        }
        if let Err(e) = std::fs::rename(&from, new_dir.join(name)) {
            log::warn!("[migrate] failed to move {}: {}", name, e);
        }
    }
    rewrite_attachment_paths(&old_dir, &new_dir);
}

/// Graceful shutdown: ask every note window to close (their JS
/// CloseRequested handlers flush pending saves first), wait for them to go
/// away, then exit. Runs on a helper thread so the main thread stays free to
/// process the close events.
pub(crate) fn close_notes_and_exit(app: &tauri::AppHandle) {
    let app = app.clone();
    std::thread::spawn(move || {
        for (label, win) in app.webview_windows() {
            if label.starts_with("note-") {
                let _ = win.close();
            }
        }
        // Poll up to 5s; a note window stuck on a failing save keeps its
        // window open via preventDefault, and we exit anyway after the
        // timeout rather than leaving a headless process behind.
        for _ in 0..50 {
            if !app
                .webview_windows()
                .keys()
                .any(|l| l.starts_with("note-"))
            {
                break;
            }
            std::thread::sleep(std::time::Duration::from_millis(100));
        }
        app.exit(0);
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Must be the first plugin so a second launch is intercepted before
        // any other setup runs; it just surfaces the existing main window.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.show();
                let _ = win.set_focus();
            }
        }))
        .plugin(
            tauri_plugin_log::Builder::new()
                .targets([
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Stdout),
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::LogDir {
                        file_name: None,
                    }),
                ])
                .level(log::LevelFilter::Info)
                .build(),
        )
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .manage(AppState::default())
        .setup(|app| {
            let handle = app.handle().clone();

            // Before any window: move data from the old identifier's dir.
            migrate_legacy_app_data(&handle);

            // Create main window. The init script lets the frontend route to
            // MainView synchronously instead of waiting for a get_note_id IPC
            // round trip to fail. (initialization_script is reliable on the
            // first window; it's only secondary windows where it silently
            // fails — those use on_page_load + eval, see windows.rs.)
            let _main = tauri::WebviewWindowBuilder::new(
                app,
                "main",
                tauri::WebviewUrl::App("index.html".into()),
            )
            .title("Sticky Notes")
            .inner_size(960.0, 640.0)
            .min_inner_size(600.0, 400.0)
            .initialization_script("window.__MAIN_WINDOW__ = true;")
            // --no-proxy-server: with a system proxy enabled (common in dev),
            // WebView2 proxy resolution can stall localhost loads for seconds.
            // MUST stay identical across all window builders — see
            // windows::BROWSER_ARGS.
            .additional_browser_args(windows::BROWSER_ARGS)
            .build()?;

            // Setup system tray
            tray::setup_tray(&handle)?;

            // Reconcile the OS autostart entry with the persisted setting.
            match commands::settings::load_settings(&handle) {
                Ok(s) => commands::settings::apply_autostart(&handle, s.launch_on_startup),
                Err(e) => log::warn!("[setup] failed to load settings: {}", e),
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() == "main" {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    let state = window.state::<AppState>();
                    // Honor tray "Quit" by letting the window actually close.
                    if state.is_exiting.load(Ordering::SeqCst) {
                        return;
                    }
                    let tray_on_close = commands::settings::load_settings(window.app_handle())
                        .map(|s| s.tray_on_close)
                        .unwrap_or(true);
                    if tray_on_close {
                        api.prevent_close();
                        let _ = window.hide();
                    } else {
                        // No tray-lingering wanted: closing the main window
                        // quits the whole app — but only after floating note
                        // windows had a chance to flush their pending saves.
                        state.is_exiting.store(true, Ordering::SeqCst);
                        close_notes_and_exit(window.app_handle());
                    }
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::notes::list_notes,
            commands::notes::read_note,
            commands::notes::write_note,
            commands::notes::delete_note,
            commands::attachments::save_attachment,
            commands::attachments::delete_attachment,
            commands::settings::read_settings,
            commands::settings::write_settings,
            windows::open_note_window,
            windows::close_note_window,
            windows::set_note_window_pinned,
            windows::get_note_id,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
