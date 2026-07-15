use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager,
};

pub fn setup_tray(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let show = MenuItem::with_id(app, "show", "Show main window", true, None::<&str>)?;
    let new_note = MenuItem::with_id(app, "new_note", "New note", true, None::<&str>)?;
    let separator = MenuItem::with_id(app, "sep", "", false, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

    let menu = Menu::with_items(app, &[&show, &new_note, &separator, &quit])?;

    let tray_icon = app
        .default_window_icon()
        .ok_or("no default window icon found — check bundle.icon in tauri.conf.json")?
        .clone();
    let _tray = TrayIconBuilder::new()
        .icon(tray_icon)
        .menu(&menu)
        .on_menu_event(move |app, event| match event.id.as_ref() {
            "show" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "new_note" => {
                // IMPORTANT: do NOT call create_note_window synchronously here.
                // muda's on_menu_event runs on the tao main thread, and
                // WebviewWindowBuilder::build() needs that same thread to
                // dispatch window creation — synchronously calling it deadlocks
                // the main thread and freezes every subsequent tray menu event
                // (including "Quit") and every IPC invoke.
                //
                // Hand the work to the async runtime so this callback returns
                // immediately and the main thread stays free.
                let app_handle = app.clone();
                tauri::async_runtime::spawn(async move {
                    let id = uuid::Uuid::new_v4().to_string();
                    let note = crate::models::Note::new(id.clone());
                    if let Err(e) = crate::commands::notes::write_note(
                        app_handle.clone(),
                        id.clone(),
                        note,
                    ) {
                        eprintln!("[tray] failed to write new note {}: {}", id, e);
                    }
                    if let Err(e) = crate::windows::create_note_window(
                        &app_handle,
                        &id,
                        200.0,
                        200.0,
                        300.0,
                        240.0,
                    ) {
                        eprintln!("[tray] failed to create note window for {}: {}", id, e);
                    }
                });
            }
            "quit" => {
                // Flip the exit flag BEFORE app.exit so lib.rs's on_window_event
                // does not prevent_close() the main window — otherwise the
                // process keeps running even after the tray Quit click.
                *app.state::<crate::AppState>().is_exiting.lock().unwrap() = true;
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        })
        .build(app)?;

    Ok(())
}