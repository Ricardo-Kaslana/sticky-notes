use std::fs;
use std::path::PathBuf;
use tauri::AppHandle;
use tauri::Manager;

fn attachments_dir(app: &AppHandle, note_id: &str) -> PathBuf {
    app.path().app_data_dir().unwrap().join("attachments").join(note_id)
}

#[tauri::command]
pub fn save_attachment(app: AppHandle, note_id: String, file_name: String, data: Vec<u8>) -> Result<String, String> {
    let dir = attachments_dir(&app, &note_id);
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = dir.join(&file_name);
    fs::write(&path, &data).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn delete_attachment(app: AppHandle, note_id: String, file_name: String) -> Result<(), String> {
    let path = attachments_dir(&app, &note_id).join(&file_name);
    if path.exists() {
        fs::remove_file(&path).map_err(|e| e.to_string())?;
    }
    Ok(())
}
