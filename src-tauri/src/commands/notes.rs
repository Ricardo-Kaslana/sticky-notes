use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter, Manager};
use crate::models::Note;
use super::{atomic_write, validate_id};

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
pub async fn list_notes(app: AppHandle) -> Result<Vec<Note>, String> {
    let dir = ensure_notes_dir(&app)?;
    let mut notes = Vec::new();
    let entries = fs::read_dir(&dir).map_err(|e| e.to_string())?;
    for entry in entries {
        let entry = match entry {
            Ok(e) => e,
            Err(e) => {
                log::warn!("[notes] skipping unreadable dir entry: {}", e);
                continue;
            }
        };
        let path = entry.path();
        if !path.extension().map(|e| e == "json").unwrap_or(false) {
            continue;
        }
        let content = match fs::read_to_string(&path) {
            Ok(c) => c,
            Err(e) => {
                log::warn!("[notes] cannot read {}: {}", path.display(), e);
                continue;
            }
        };
        let note: Note = match serde_json::from_str(&content) {
            Ok(n) => n,
            Err(e) => {
                log::warn!(
                    "[notes] cannot parse {}: {} — file left on disk for recovery",
                    path.display(),
                    e
                );
                continue;
            }
        };
        notes.push(note);
    }
    // No sort here: the frontend (filterNotes / MainView memo) already sorts
    // by updatedAt desc, and MainView's reconcile diff is order-sensitive —
    // a backend sort would only add a redundant O(N log N) pass.
    Ok(notes)
}

#[tauri::command]
pub async fn read_note(app: AppHandle, id: String) -> Result<Note, String> {
    validate_id(&id)?;
    let dir = ensure_notes_dir(&app)?;
    let path = dir.join(format!("{}.json", id));
    let content = fs::read_to_string(&path)
        .map_err(|e| format!("failed to read note {}: {}", id, e))?;
    serde_json::from_str(&content).map_err(|e| format!("failed to parse note {}: {}", id, e))
}

/// Persist a note and broadcast note-updated. `source` identifies the
/// origin window label ("tray" for tray-created notes) so windows can
/// ignore echoes of their own saves.
pub(crate) fn persist_note(
    app: &AppHandle,
    id: &str,
    mut note: Note,
    source: &str,
) -> Result<(), String> {
    validate_id(id)?;
    if note.id != id {
        return Err(format!("note id mismatch: {} != {}", note.id, id));
    }
    let dir = ensure_notes_dir(app)?;
    note.updated_at = chrono::Utc::now().to_rfc3339();
    let path = dir.join(format!("{}.json", id));
    let json = serde_json::to_string_pretty(&note).map_err(|e| e.to_string())?;
    atomic_write(&path, json.as_bytes())?;
    let _ = app.emit(
        "note-updated",
        serde_json::json!({ "note": note, "source": source }),
    );
    Ok(())
}

#[tauri::command]
pub async fn write_note(
    app: AppHandle,
    window: tauri::Window,
    id: String,
    note: Note,
) -> Result<(), String> {
    persist_note(&app, &id, note, window.label())
}

#[tauri::command]
pub async fn delete_note(app: AppHandle, id: String) -> Result<(), String> {
    validate_id(&id)?;
    let dir = ensure_notes_dir(&app)?;
    let path = dir.join(format!("{}.json", id));
    if let Err(e) = fs::remove_file(&path) {
        if e.kind() != std::io::ErrorKind::NotFound {
            return Err(format!("failed to delete note {}: {}", id, e));
        }
    }
    if let Ok(base) = app.path().app_data_dir() {
        let attachments = base.join("attachments").join(&id);
        if attachments.exists() {
            if let Err(e) = fs::remove_dir_all(&attachments) {
                log::warn!("[notes] failed to remove attachments for {}: {}", id, e);
            }
        }
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
