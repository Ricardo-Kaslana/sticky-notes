use super::{atomic_write, validate_id};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::AppHandle;
use tauri::Manager;

const MAX_ATTACHMENT_BYTES: usize = 25 * 1024 * 1024; // 25 MB

fn attachments_dir(app: &AppHandle, note_id: &str) -> Result<PathBuf, String> {
    validate_id(note_id)?;
    app.path()
        .app_data_dir()
        .map(|p| p.join("attachments").join(note_id))
        .map_err(|e| format!("failed to resolve app data dir: {}", e))
}

/// Returns Some(safe_name) when the input is acceptable, None otherwise.
/// Rejects empty/oversized names, path separators, `..`, control chars,
/// Windows drive/ADS colons, reserved device names (CON, NUL, ...), and
/// trailing dots/spaces. This keeps `dir.join(name)` from escaping the
/// attachments directory on any platform.
fn safe_filename(name: &str) -> Option<String> {
    if name.is_empty() || name.len() > 128 {
        return None;
    }
    if name.contains(['/', '\\', ':']) {
        return None;
    }
    if name == "." || name.contains("..") {
        return None;
    }
    if name.chars().any(|c| c.is_control()) {
        return None;
    }
    if name.ends_with('.') || name.ends_with(' ') {
        return None;
    }
    const RESERVED: [&str; 22] = [
        "CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8",
        "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
    ];
    let stem = name.split('.').next().unwrap_or("");
    if RESERVED.iter().any(|r| stem.eq_ignore_ascii_case(r)) {
        return None;
    }
    Some(name.to_string())
}

/// Pick a non-existing path in `dir` for `name`, appending `-1`, `-2`, …
/// before the extension on collision. Two pastes named "image.png" must
/// not silently overwrite each other.
fn unique_path(dir: &Path, name: &str) -> PathBuf {
    let candidate = dir.join(name);
    if !candidate.exists() {
        return candidate;
    }
    let (stem, ext) = match name.rsplit_once('.') {
        Some((s, e)) if !s.is_empty() => (s, Some(e)),
        _ => (name, None),
    };
    for i in 1..10_000u32 {
        let n = match ext {
            Some(e) => format!("{}-{}.{}", stem, i, e),
            None => format!("{}-{}", stem, i),
        };
        let p = dir.join(n);
        if !p.exists() {
            return p;
        }
    }
    candidate
}

// `(async)`: run on the async runtime's thread pool instead of the main
// thread (a 25 MB fs::write would freeze every window), while the fn stays
// sync so it can keep the borrowed Request.
#[tauri::command(async)]
pub fn save_attachment(app: AppHandle, request: tauri::ipc::Request<'_>) -> Result<String, String> {
    let tauri::ipc::InvokeBody::Raw(data) = request.body() else {
        return Err("expected raw request body".into());
    };
    if data.len() > MAX_ATTACHMENT_BYTES {
        return Err(format!("attachment too large: {} bytes", data.len()));
    }
    let header = |key: &str| -> Result<String, String> {
        let v = request
            .headers()
            .get(key)
            .ok_or_else(|| format!("missing header: {}", key))?
            .to_str()
            .map_err(|e| e.to_string())?;
        percent_encoding::percent_decode_str(v)
            .decode_utf8()
            .map(|s| s.to_string())
            .map_err(|e| e.to_string())
    };
    let note_id = header("x-note-id")?;
    let file_name = header("x-file-name")?;
    let name = safe_filename(&file_name)
        .ok_or_else(|| format!("invalid attachment name: {}", file_name))?;
    let dir = attachments_dir(&app, &note_id)?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = unique_path(&dir, &name);
    atomic_write(&path, data)?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command(async)]
pub fn delete_attachment(app: AppHandle, note_id: String, file_name: String) -> Result<(), String> {
    let name = safe_filename(&file_name)
        .ok_or_else(|| format!("invalid attachment name: {}", file_name))?;
    let path = attachments_dir(&app, &note_id)?.join(&name);
    if let Err(e) = fs::remove_file(&path) {
        if e.kind() != std::io::ErrorKind::NotFound {
            return Err(e.to_string());
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn safe_filename_accepts_normal_names() {
        assert_eq!(safe_filename("image.png"), Some("image.png".into()));
        assert_eq!(
            safe_filename("my-file-2026.jpg"),
            Some("my-file-2026.jpg".into())
        );
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

    #[test]
    fn safe_filename_rejects_windows_specific_tricks() {
        assert_eq!(safe_filename("C:evil.txt"), None); // drive-relative path
        assert_eq!(safe_filename("file.txt:stream"), None); // NTFS ADS
        assert_eq!(safe_filename("CON"), None);
        assert_eq!(safe_filename("con.png"), None);
        assert_eq!(safe_filename("LPT1.jpg"), None);
        assert_eq!(safe_filename("trailing."), None);
        assert_eq!(safe_filename("trailing "), None);
        assert_eq!(safe_filename("a\u{0}b"), None);
        assert_eq!(safe_filename(&"a".repeat(129)), None);
    }
}
