use std::fs;
use std::path::PathBuf;
use tauri::AppHandle;
use tauri::Manager;

const MAX_ATTACHMENT_BYTES: usize = 25 * 1024 * 1024; // 25 MB

fn attachments_dir(app: &AppHandle, note_id: &str) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|p| p.join("attachments").join(note_id))
        .map_err(|e| format!("failed to resolve app data dir: {}", e))
}

/// Returns Some(safe_name) when the input is acceptable, None otherwise.
/// Rejects empty names, names containing path separators, and any name that
/// contains a `..` segment after normalization. This keeps `dir.join(name)`
/// from escaping the attachments directory.
fn safe_filename(name: &str) -> Option<String> {
    if name.is_empty() {
        return None;
    }
    if name.contains('/') || name.contains('\\') {
        return None;
    }
    if name == "." || name == ".." {
        return None;
    }
    if name.contains("..") {
        return None;
    }
    Some(name.to_string())
}

#[tauri::command]
pub fn save_attachment(app: AppHandle, note_id: String, file_name: String, data: Vec<u8>) -> Result<String, String> {
    if data.len() > MAX_ATTACHMENT_BYTES {
        return Err(format!("attachment too large: {} bytes", data.len()));
    }
    let name = safe_filename(&file_name)
        .ok_or_else(|| format!("invalid attachment name: {}", file_name))?;
    let dir = attachments_dir(&app, &note_id)?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = dir.join(&name);
    fs::write(&path, &data).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn delete_attachment(app: AppHandle, note_id: String, file_name: String) -> Result<(), String> {
    let name = safe_filename(&file_name)
        .ok_or_else(|| format!("invalid attachment name: {}", file_name))?;
    let path = attachments_dir(&app, &note_id)?.join(&name);
    if path.exists() {
        fs::remove_file(&path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn safe_filename_accepts_normal_names() {
        assert_eq!(safe_filename("image.png"), Some("image.png".into()));
        assert_eq!(safe_filename("my-file-2026.jpg"), Some("my-file-2026.jpg".into()));
        assert_eq!(safe_filename("a"), Some("a".into()));
    }

    #[test]
    fn safe_filename_rejects_traversal() {
        assert_eq!(safe_filename(".."), None);
        assert_eq!(safe_filename("../"), None);
        assert_eq!(safe_filename("../etc/passwd"), None);
        assert_eq!(safe_filename("..\\..\\windows"), None);
        assert_eq!(safe_filename("a..b"), None); // contains ".." even if not a segment
        assert_eq!(safe_filename("foo/..bar"), None); // contains ".." and "/"
    }

    #[test]
    fn safe_filename_rejects_separators() {
        assert_eq!(safe_filename("a/b"), None);
        assert_eq!(safe_filename("a\\b"), None);
        assert_eq!(safe_filename("/etc/passwd"), None);
    }

    #[test]
    fn safe_filename_rejects_empty_and_dot() {
        assert_eq!(safe_filename(""), None);
        assert_eq!(safe_filename("."), None);
    }
}
