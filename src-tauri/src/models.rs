use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct NotePosition {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

impl Default for NotePosition {
    fn default() -> Self {
        Self { x: 100.0, y: 100.0, width: 300.0, height: 240.0 }
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

pub const COLORS: &[(&str, &str)] = &[
    ("paper", "#fff9c4"),
    ("blush", "#f8bbd0"),
    ("sky", "#b3e5fc"),
    ("sage", "#c8e6c9"),
    ("apricot", "#ffe0b2"),
    ("lavender", "#d1c4e9"),
];

pub fn get_color_hex(key: &str) -> &str {
    COLORS.iter().find(|(k, _)| *k == key).map(|(_, v)| *v).unwrap_or("#fff9c4")
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub default_color: String,
    pub auto_save_interval_ms: u64,
    pub launch_on_startup: bool,
    pub tray_on_close: bool,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            default_color: String::from("paper"),
            auto_save_interval_ms: 2000,
            launch_on_startup: false,
            tray_on_close: true,
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
        assert_eq!(note.pinned, false);
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
    fn test_get_color_hex_known() {
        assert_eq!(get_color_hex("paper"), "#fff9c4");
        assert_eq!(get_color_hex("lavender"), "#d1c4e9");
    }

    #[test]
    fn test_get_color_hex_unknown_defaults_to_paper() {
        assert_eq!(get_color_hex("nonexistent"), "#fff9c4");
    }

    #[test]
    fn test_settings_default() {
        let s = Settings::default();
        assert_eq!(s.default_color, "paper");
        assert_eq!(s.auto_save_interval_ms, 2000);
        assert!(s.tray_on_close);
    }
}
