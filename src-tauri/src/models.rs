use serde::{Deserialize, Serialize};

/// Mirror of the `COLORS` keys in src/lib/types.ts — keep in sync manually.
pub const COLOR_KEYS: [&str; 6] = ["paper", "blush", "sky", "sage", "apricot", "lavender"];

/// Mirror of `SORT_BY_VALUES` in src/lib/types.ts — keep in sync manually.
/// There is deliberately no "last accessed" key: this app tracks only
/// creation and modification time.
pub const SORT_BY_KEYS: [&str; 3] = ["updatedAt", "createdAt", "title"];

/// Mirror of `SORT_DIR_VALUES` in src/lib/types.ts — keep in sync manually.
pub const SORT_DIR_KEYS: [&str; 2] = ["asc", "desc"];

/// Mirror of NOTE_ZOOM_MIN / NOTE_ZOOM_MAX in src/lib/zoom.ts.
pub const NOTE_ZOOM_MIN: f64 = 0.75;
pub const NOTE_ZOOM_MAX: f64 = 2.0;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct NotePosition {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

impl Default for NotePosition {
    fn default() -> Self {
        // Mirrors DEFAULT_NOTE_POSITION in src/lib/types.ts — keep in sync.
        Self {
            x: 100.0,
            y: 100.0,
            width: 340.0,
            height: 320.0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Note {
    pub id: String,
    pub title: String,
    pub content: String,
    pub color: String,
    pub tags: Vec<String>,
    pub position: NotePosition,
    pub pinned: bool,
    pub created_at: String,
    pub updated_at: String,
}

impl Note {
    pub fn new(id: String) -> Self {
        let now = chrono::Utc::now().to_rfc3339();
        Self {
            id,
            title: String::new(),
            content: String::from("<p></p>"),
            color: String::from("paper"),
            tags: Vec::new(),
            position: NotePosition::default(),
            pinned: false,
            created_at: now.clone(),
            updated_at: now,
        }
    }
}

fn default_sort_by() -> String {
    "updatedAt".to_string()
}

fn default_sort_dir() -> String {
    "desc".to_string()
}

fn default_note_zoom() -> f64 {
    1.0
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub default_color: String,
    pub auto_save_interval_ms: u64,
    pub launch_on_startup: bool,
    pub tray_on_close: bool,
    /// The three fields below arrived after settings.json already existed on
    /// users' disks. `serde(default)` is load-bearing: `load_settings` treats
    /// a parse failure as corruption, quarantines the file to `.json.bak` and
    /// silently reverts to defaults — so a missing key must never be fatal.
    #[serde(default = "default_sort_by")]
    pub sort_by: String,
    #[serde(default = "default_sort_dir")]
    pub sort_dir: String,
    #[serde(default = "default_note_zoom")]
    pub note_zoom: f64,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            default_color: String::from("paper"),
            auto_save_interval_ms: 2000,
            launch_on_startup: false,
            tray_on_close: true,
            sort_by: default_sort_by(),
            sort_dir: default_sort_dir(),
            note_zoom: default_note_zoom(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_note_new_has_correct_defaults() {
        let note = Note::new("test-id".into());
        assert_eq!(note.id, "test-id");
        assert_eq!(note.color, "paper");
        assert_eq!(note.title, "");
        assert_eq!(note.content, "<p></p>");
        assert_eq!(note.tags.len(), 0);
        assert!(!note.pinned);
    }

    #[test]
    fn test_note_serialization_roundtrip() {
        let note = Note::new("abc-123".into());
        let json = serde_json::to_string(&note).unwrap();
        let parsed: Note = serde_json::from_str(&json).unwrap();
        assert_eq!(note, parsed);
    }

    #[test]
    fn test_note_json_uses_camel_case() {
        let note = Note::new("abc".into());
        let json = serde_json::to_string(&note).unwrap();
        assert!(json.contains("createdAt"));
        assert!(json.contains("updatedAt"));
        assert!(!json.contains("created_at"));
    }

    #[test]
    fn test_settings_default() {
        let s = Settings::default();
        assert_eq!(s.default_color, "paper");
        assert_eq!(s.auto_save_interval_ms, 2000);
        assert!(s.tray_on_close);
    }

    #[test]
    fn test_settings_default_carries_sort_and_zoom() {
        let s = Settings::default();
        assert_eq!(s.sort_by, "updatedAt");
        assert_eq!(s.sort_dir, "desc");
        assert_eq!(s.note_zoom, 1.0);
    }

    /// A settings.json written before sort/zoom existed must still parse —
    /// otherwise `load_settings` quarantines it and the user silently loses
    /// every preference they had set.
    #[test]
    fn test_settings_parses_legacy_json_without_sort_fields() {
        let legacy = r#"{
            "defaultColor": "sky",
            "autoSaveIntervalMs": 5000,
            "launchOnStartup": true,
            "trayOnClose": false
        }"#;
        let s: Settings = serde_json::from_str(legacy).unwrap();
        assert_eq!(s.default_color, "sky");
        assert_eq!(s.auto_save_interval_ms, 5000);
        assert!(s.launch_on_startup);
        assert!(!s.tray_on_close);
        assert_eq!(s.sort_by, "updatedAt");
        assert_eq!(s.sort_dir, "desc");
        assert_eq!(s.note_zoom, 1.0);
    }

    #[test]
    fn test_settings_json_uses_camel_case() {
        let json = serde_json::to_string(&Settings::default()).unwrap();
        assert!(json.contains("sortBy"));
        assert!(json.contains("sortDir"));
        assert!(json.contains("noteZoom"));
        assert!(!json.contains("sort_by"));
    }

    #[test]
    fn test_note_position_default_matches_frontend() {
        let p = NotePosition::default();
        assert_eq!(p.x, 100.0);
        assert_eq!(p.y, 100.0);
        assert_eq!(p.width, 340.0);
        assert_eq!(p.height, 320.0);
    }
}
