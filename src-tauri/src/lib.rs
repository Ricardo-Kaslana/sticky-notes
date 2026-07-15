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
        .plugin(tauri_plugin_shell::init())
        .manage(AppState::default())
        .setup(|app| {
            // Create main window
            let _main = tauri::WebviewWindowBuilder::new(
                app,
                "main",
                tauri::WebviewUrl::App("index.html".into()),
            )
            .title("Sticky Notes")
            .inner_size(960.0, 640.0)
            .min_inner_size(600.0, 400.0)
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
                    api.prevent_close();
                    let _ = window.hide();
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