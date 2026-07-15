use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter, Manager};
use crate::models::Note;

fn notes_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|p| p.join("notes"))
        .map_err(|e| format!("failed to resolve app data dir: {}", e))
}

fn ensure_notes_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = notes_dir(app)?;
    fs::create_dir_all(&dir).map_err(|e| format!("failed to create notes dir: {}", e))?;
    Ok(dir)
}

#[tauri::command]
pub fn list_notes(app: AppHandle) -> Result<Vec<Note>, String> {
    let dir = ensure_notes_dir(&app)?;
    let mut notes = Vec::new();
    let entries = fs::read_dir(&dir).map_err(|e| e.to_string())?;
    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if path.extension().map(|e| e == "json").unwrap_or(false) {
            let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
            let note: Note = serde_json::from_str(&content).map_err(|e| e.to_string())?;
            notes.push(note);
        }
    }
    notes.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    Ok(notes)
}

#[tauri::command]
pub fn read_note(app: AppHandle, id: String) -> Result<Note, String> {
    let dir = ensure_notes_dir(&app)?;
    let path = dir.join(format!("{}.json", id));
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&content).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn write_note(app: AppHandle, id: String, mut note: Note) -> Result<(), String> {
    let dir = ensure_notes_dir(&app)?;
    note.updated_at = chrono::Utc::now().to_rfc3339();
    let path = dir.join(format!("{}.json", id));
    let json = serde_json::to_string_pretty(&note).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| e.to_string())?;
    let _ = app.emit("note-updated", &note);
    Ok(())
}

#[tauri::command]
pub fn delete_note(app: AppHandle, id: String) -> Result<(), String> {
    let dir = ensure_notes_dir(&app)?;
    let path = dir.join(format!("{}.json", id));
    if path.exists() {
        fs::remove_file(&path).map_err(|e| e.to_string())?;
    }
    let _ = app.emit("note-deleted", &id);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_note_sort_order() {
        let older = Note {
            updated_at: "2026-01-01T00:00:00Z".into(),
            ..Note::new("older".into())
        };
        let newer = Note {
            updated_at: "2026-06-06T00:00:00Z".into(),
            ..Note::new("newer".into())
        };
        let mut notes = vec![older.clone(), newer.clone()];
        notes.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
        assert_eq!(notes[0].id, "newer");
        assert_eq!(notes[1].id, "older");
    }
}
