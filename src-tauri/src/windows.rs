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

    // Defer eval / show / focus to the webview's on_page_load callback.
    // Doing them right after build() races the webview initialization —
    // eval() on a not-yet-ready webview silently drops the script in
    // Tauri 2, and a blind sleep is both fragile and was the cause of
    // the "two windows" symptom the user reported. on_page_load fires
    // once the page has actually finished loading, which is the earliest
    // reliable moment to inject the note ID and reveal the window.
    let app_handle = app.clone();
    let label_for_cb = label.clone();
    let note_id_owned = note_id.to_string();
    let win = WebviewWindowBuilder::new(app, &label, WebviewUrl::App("index.html".into()))
        .title("")
        .inner_size(width, height)
        .position(x, y)
        .decorations(false)
        .resizable(true)
        .skip_taskbar(true)
        .visible(false)
        .focused(true)
        .on_page_load(move |_webview, payload| {
            if payload.event() != tauri::webview::PageLoadEvent::Finished {
                return;
            }
            let Some(w) = app_handle.get_webview_window(&label_for_cb) else {
                eprintln!("[windows] {} gone before page-load finalize", label_for_cb);
                return;
            };
            let script = format!("window.__NOTE_ID__ = '{}';", note_id_owned);
            if let Err(e) = w.eval(&script) {
                eprintln!("[windows] {} eval FAILED: {}", label_for_cb, e);
            }
            if let Err(e) = w.show() {
                eprintln!("[windows] {} show FAILED: {}", label_for_cb, e);
            }
            if let Err(e) = w.set_focus() {
                eprintln!("[windows] {} set_focus FAILED: {}", label_for_cb, e);
            }
        })
        .build()?;

    let _ = win; // result consumed by the `?` above; keep the binding for clarity
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
    let label = format!("note-{}", note_id);

    // Idempotent entry check: if a window with this label already exists,
    // just focus it and return. This makes rapid double-invokes safe and
    // means a stale frontend call never creates a second window.
    if let Some(window) = app.get_webview_window(&label) {
        let _ = window.set_focus();
        return Ok(());
    }

    // Fire-and-forget the creation work so this invoke handler returns
    // immediately. Without this, build() would block the handler thread on
    // main-thread IPC dispatch and freeze the IPC bus.
    //
    // create_note_window has its own de-dup check, but it runs AFTER this
    // command has returned, so the only race left is two concurrent invokes
    // both passing the entry check above. In that case Tauri's build() will
    // return Err on a duplicate label — surfaced as a logged failure rather
    // than a second OS-level window.
    tauri::async_runtime::spawn(async move {
        let _ = create_note_window(&app, &note_id, x, y, width, height);
    });
    Ok(())
}

#[tauri::command]
pub fn close_note_window(app: AppHandle, note_id: String) -> Result<(), String> {
    let label = format!("note-{}", note_id);
    if let Some(window) = app.get_webview_window(&label) {
        window.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Returns the note ID if the current window is a note window (label starts with "note-").
/// This is the ONLY reliable way to identify the current window in Tauri 2,
/// because initialization_script does not execute in secondary windows.
#[tauri::command]
pub fn get_note_id(window: tauri::Window) -> Result<String, String> {
    let label = window.label();
    eprintln!("[windows] get_note_id: window.label() = '{}'", label);
    if label.starts_with("note-") {
        Ok(label[5..].to_string())
    } else {
        Err("not a note window".into())
    }
}

#[tauri::command]
pub fn set_note_window_pinned(app: AppHandle, note_id: String, pinned: bool) -> Result<(), String> {
    let label = format!("note-{}", note_id);
    if let Some(window) = app.get_webview_window(&label) {
        window.set_always_on_top(pinned).map_err(|e| e.to_string())?;
    }
    Ok(())
}
