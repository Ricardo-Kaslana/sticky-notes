mod commands;
mod models;
mod tray;
mod windows;

use std::sync::Mutex;
use tauri::Manager;

/// App-wide state shared with every window/event handler.
#[derive(Default)]
struct AppState {
    /// True once the user explicitly chose Quit from the tray menu.
    /// While this is set, the main window's CloseRequested handler must NOT
    /// `prevent_close`, otherwise the app can never actually terminate.
    is_exiting: Mutex<bool>,
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
        .plugin(tauri_plugin_shell::init())
        .manage(AppState::default())
        .setup(|app| {
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
            tray::setup_tray(&app.handle())?;

            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() == "main" {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    // Honor tray "Quit" by letting the window actually close.
                    // Without this branch, `app.exit(0)` triggers
                    // CloseRequested on every window and the main window's
                    // prevent_close() blocks termination indefinitely.
                    let is_exiting = *window
                        .state::<AppState>()
                        .is_exiting
                        .lock()
                        .unwrap();
                    if is_exiting {
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
                        // quits the whole app instead of leaving a headless
                        // process behind.
                        *window.state::<AppState>().is_exiting.lock().unwrap() = true;
                        window.app_handle().exit(0);
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
