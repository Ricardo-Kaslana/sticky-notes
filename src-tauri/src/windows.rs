use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

pub fn create_note_window(
    app: &AppHandle,
    note_id: &str,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<(), Box<dyn std::error::Error>> {
    let label = format!("note-{}", note_id);
    if let Some(window) = app.get_webview_window(&label) {
        window.set_focus()?;
        return Ok(());
    }

    let url = format!("?noteId={}", note_id);
    WebviewWindowBuilder::new(app, &label, WebviewUrl::App(url.into()))
        .title("")
        .inner_size(width, height)
        .position(x, y)
        .decorations(false)
        .resizable(true)
        .skip_taskbar(true)
        .visible(true)
        .build()?;

    Ok(())
}

#[tauri::command]
pub fn open_note_window(
    app: AppHandle,
    note_id: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<(), String> {
    create_note_window(&app, &note_id, x, y, width, height).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn close_note_window(app: AppHandle, note_id: String) -> Result<(), String> {
    let label = format!("note-{}", note_id);
    if let Some(window) = app.get_webview_window(&label) {
        window.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn set_note_window_pinned(app: AppHandle, note_id: String, pinned: bool) -> Result<(), String> {
    let label = format!("note-{}", note_id);
    if let Some(window) = app.get_webview_window(&label) {
        window.set_always_on_top(pinned).map_err(|e| e.to_string())?;
    }
    Ok(())
}
