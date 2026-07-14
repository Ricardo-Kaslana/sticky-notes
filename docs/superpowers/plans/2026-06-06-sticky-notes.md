# Sticky Notes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a lightweight, high-performance sticky notes desktop app with Tauri 2.x + SolidJS + TipTap + Tailwind CSS for Windows.

**Architecture:** Rust backend handles file I/O (JSON notes on disk), multi-window lifecycle, and system tray. SolidJS frontend renders a management view (masonry grid + sidebar) and floating note windows (borderless TipTap editor). Communication via Tauri `invoke` commands and events for cross-window sync.

**Tech Stack:** Tauri 2.x, SolidJS 1.x, TipTap (ProseMirror), Tailwind CSS 4, TypeScript, Rust

---

## File Structure

```
sticky-notes/
├── src-tauri/
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── capabilities/default.json
│   ├── icons/
│   └── src/
│       ├── main.rs              # Tauri entry, plugin registration
│       ├── lib.rs               # App builder, command registration
│       ├── models.rs            # Note, NotePosition, Settings, Color
│       ├── commands/
│       │   ├── mod.rs
│       │   ├── notes.rs         # CRUD: list, read, write, delete
│       │   ├── attachments.rs   # save_attachment
│       │   └── settings.rs      # read/write settings
│       ├── windows.rs           # create/destroy floating windows
│       └── tray.rs              # System tray icon + menu
├── src/
│   ├── index.html
│   ├── index.tsx                # SolidJS entry, Router setup
│   ├── App.tsx                  # Route definitions
│   ├── index.css                # Tailwind + custom styles
│   ├── lib/
│   │   ├── types.ts             # TS types matching Rust models
│   │   ├── invoke.ts            # Typed Tauri invoke wrappers
│   │   └── events.ts            # Event emission/listening helpers
│   ├── stores/
│   │   ├── notesStore.ts        # SolidJS store: all notes state
│   │   └── settingsStore.ts     # SolidJS store: app settings
│   ├── routes/
│   │   ├── MainView.tsx         # / route — management view
│   │   └── NoteView.tsx         # /note/:id route — floating window
│   ├── components/
│   │   ├── Sidebar.tsx          # Search, tag filter, new note
│   │   ├── MasonryGrid.tsx      # Waterfall layout
│   │   ├── NoteCard.tsx         # Single note card in grid
│   │   ├── TagInput.tsx         # Autocomplete tag editor
│   │   ├── ColorPicker.tsx      # 6-color palette selector
│   │   ├── NoteToolbar.tsx      # Rich text formatting toolbar
│   │   ├── ConfirmDialog.tsx    # Confirmation modal
│   │   └── ContextMenu.tsx      # Right-click context menu
│   └── utils/
│       └── debounce.ts          # Debounce utility
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.ts
```

---

### Task 1: Scaffold Tauri + SolidJS project

**Files:**
- Create: entire project structure via CLI tools

- [ ] **Step 1: Create Tauri v2 project with SolidJS template**

Run:
```bash
cd D:/Development/Complex/sticky-notes
npm create tauri-app@latest . -- --template solid-ts --manager npm
```

Expected: Project scaffolded with `src-tauri/`, `src/`, `package.json`, `vite.config.ts`.

- [ ] **Step 2: Install frontend dependencies**

Run:
```bash
npm install @tiptap/core @tiptap/starter-kit @tiptap/extension-underline @tiptap/extension-link @tiptap/extension-image @tiptap/extension-placeholder @solidjs/router
npm install -D tailwindcss @tailwindcss/vite
```

- [ ] **Step 3: Configure Vite for Tailwind**

Edit `vite.config.ts`:

```typescript
import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [solid(), tailwindcss()],
  clearScreen: false,
  server: { port: 1420, strictPort: true },
  envPrefix: ["VITE_", "TAURI_"],
  build: { target: "esnext", minify: !process.env.TAURI_DEBUG ? "esbuild" : false },
});
```

- [ ] **Step 4: Set up Tailwind CSS entry**

Write `src/index.css`:

```css
@import "tailwindcss";

/* Custom scrollbar for sidebar */
.sidebar-scroll::-webkit-scrollbar { width: 4px; }
.sidebar-scroll::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 2px; }

/* Floating note window styles */
.note-window { font-family: "Segoe UI", system-ui, sans-serif; }
.note-window .ProseMirror { outline: none; min-height: 120px; }
.note-window .ProseMirror p { margin: 0 0 4px 0; }
.note-window .ProseMirror ul,
.note-window .ProseMirror ol { padding-left: 16px; margin: 4px 0; }
```

- [ ] **Step 5: Commit**

```bash
git init && git add -A && git commit -m "chore: scaffold Tauri + SolidJS + Tailwind + TipTap"
```

---

### Task 2: Rust data models

**Files:**
- Create: `src-tauri/src/models.rs`

- [ ] **Step 1: Write tests for Note serialization**

Create `src-tauri/src/models.rs` with tests first:

```rust
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

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
```

- [ ] **Step 2: Add chrono dependency**

Edit `src-tauri/Cargo.toml`, add under `[dependencies]`:

```toml
chrono = { version = "0.4", features = ["serde"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
uuid = { version = "1", features = ["v4"] }
```

- [ ] **Step 3: Run tests**

```bash
cd src-tauri && cargo test
```

Expected: 6 tests pass.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: add Rust data models with tests"
```

---

### Task 3: Rust file I/O — notes CRUD commands

**Files:**
- Create: `src-tauri/src/commands/mod.rs`
- Create: `src-tauri/src/commands/notes.rs`

- [ ] **Step 1: Write tests for notes commands**

Write `src-tauri/src/commands/notes.rs` with tests:

```rust
use std::fs;
use std::path::PathBuf;
use tauri::AppHandle;
use crate::models::Note;

fn notes_dir(app: &AppHandle) -> PathBuf {
    app.path().app_data_dir().unwrap().join("notes")
}

fn ensure_notes_dir(app: &AppHandle) -> PathBuf {
    let dir = notes_dir(app);
    fs::create_dir_all(&dir).unwrap();
    dir
}

#[tauri::command]
pub fn list_notes(app: AppHandle) -> Result<Vec<Note>, String> {
    let dir = ensure_notes_dir(&app);
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
    let dir = ensure_notes_dir(&app);
    let path = dir.join(format!("{}.json", id));
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&content).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn write_note(app: AppHandle, id: String, mut note: Note) -> Result<(), String> {
    let dir = ensure_notes_dir(&app);
    note.updated_at = chrono::Utc::now().to_rfc3339();
    let path = dir.join(format!("{}.json", id));
    let json = serde_json::to_string_pretty(&note).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_note(app: AppHandle, id: String) -> Result<(), String> {
    let dir = ensure_notes_dir(&app);
    let path = dir.join(format!("{}.json", id));
    if path.exists() {
        fs::remove_file(&path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    // Note: these tests use a temp dir via tauri::test::app_builder
    // For unit testing without Tauri runtime, test the logic separately

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
```

- [ ] **Step 2: Write `src-tauri/src/commands/mod.rs`**

```rust
pub mod notes;
pub mod attachments;
pub mod settings;
```

- [ ] **Step 3: Run tests**

```bash
cd src-tauri && cargo test
```

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: add Rust notes CRUD commands with tests"
```

---

### Task 4: Rust file I/O — attachments + settings commands

**Files:**
- Create: `src-tauri/src/commands/attachments.rs`
- Create: `src-tauri/src/commands/settings.rs`

- [ ] **Step 1: Write attachments command**

Write `src-tauri/src/commands/attachments.rs`:

```rust
use std::fs;
use std::path::PathBuf;
use tauri::AppHandle;

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
```

- [ ] **Step 2: Write settings command**

Write `src-tauri/src/commands/settings.rs`:

```rust
use std::fs;
use std::path::PathBuf;
use tauri::AppHandle;
use crate::models::Settings;

fn settings_path(app: &AppHandle) -> PathBuf {
    app.path().app_data_dir().unwrap().join("settings.json")
}

#[tauri::command]
pub fn read_settings(app: AppHandle) -> Result<Settings, String> {
    let path = settings_path(&app);
    if path.exists() {
        let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
        serde_json::from_str(&content).map_err(|e| e.to_string())
    } else {
        Ok(Settings::default())
    }
}

#[tauri::command]
pub fn write_settings(app: AppHandle, settings: Settings) -> Result<(), String> {
    let path = settings_path(&app);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let json = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| e.to_string())
}
```

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: add Rust attachments + settings commands"
```

---

### Task 5: Rust window manager

**Files:**
- Create: `src-tauri/src/windows.rs`

- [ ] **Step 1: Write window manager**

Write `src-tauri/src/windows.rs`:

```rust
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
    // If window already exists, focus it
    if let Some(window) = app.get_webview_window(&label) {
        window.set_focus()?;
        return Ok(());
    }

    let url = format!("note/{}", note_id);
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
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat: add Rust window manager for floating notes"
```

---

### Task 6: Rust system tray

**Files:**
- Create: `src-tauri/src/tray.rs`

- [ ] **Step 1: Write tray setup**

Write `src-tauri/src/tray.rs`:

```rust
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

    let _tray = TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .on_menu_event(move |app, event| match event.id.as_ref() {
            "show" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "new_note" => {
                let id = uuid::Uuid::new_v4().to_string();
                let note = crate::models::Note::new(id.clone());
                let _ = crate::commands::notes::write_note(app.clone(), id.clone(), note);
                let _ = crate::windows::create_note_window(app, &id, 200.0, 200.0, 300.0, 240.0);
            }
            "quit" => {
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
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat: add Rust system tray with context menu"
```

---

### Task 7: Wire up Rust backend — lib.rs and main.rs

**Files:**
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/src/main.rs`
- Modify: `src-tauri/Cargo.toml` (add tauri features)

- [ ] **Step 1: Update Cargo.toml for tray feature**

Edit `src-tauri/Cargo.toml`, ensure `[dependencies]` includes:

```toml
[dependencies]
tauri = { version = "2", features = ["tray-icon"] }
tauri-plugin-shell = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
uuid = { version = "1", features = ["v4"] }
chrono = { version = "0.4", features = ["serde"] }
```

- [ ] **Step 2: Write lib.rs**

Write `src-tauri/src/lib.rs`:

```rust
mod commands;
mod models;
mod tray;
mod windows;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // Create main window
            let _main = tauri::WebviewWindowBuilder::new(
                app,
                "main",
                tauri::WebviewUrl::App("".into()),
            )
            .title("Sticky Notes")
            .inner_size(960.0, 640.0)
            .min_inner_size(600.0, 400.0)
            .build()?;

            // Setup system tray
            tray::setup_tray(&app.handle())?;

            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() == "main" {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::notes::list_notes,
            commands::notes::read_note,
            commands::notes::write_note,
            commands::notes::delete_note,
            commands::attachments::save_attachment,
            commands::attachments::delete_attachment,
            commands::settings::read_settings,
            commands::settings::write_settings,
            windows::open_note_window,
            windows::close_note_window,
            windows::set_note_window_pinned,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 3: Write main.rs**

Write `src-tauri/src/main.rs`:

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    sticky_notes_lib::run()
}
```

Edit `src-tauri/Cargo.toml` to ensure `[lib]` section exists:

```toml
[lib]
name = "sticky_notes_lib"
crate-type = ["staticlib", "cdylib", "rlib"]
```

- [ ] **Step 4: Add Tauri capability for window management**

Write `src-tauri/capabilities/default.json`:

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Default permissions",
  "windows": ["main", "note-*"],
  "permissions": [
    "core:default",
    "shell:allow-open",
    "core:window:allow-close",
    "core:window:allow-set-focus",
    "core:window:allow-show",
    "core:window:allow-hide",
    "core:window:allow-set-always-on-top",
    "core:window:allow-set-position",
    "core:window:allow-center"
  ]
}
```

- [ ] **Step 5: Verify it compiles**

```bash
cd src-tauri && cargo check
```

Expected: Compiles without errors.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: wire up Rust backend with all commands and tray"
```

---

### Task 8: Frontend — TypeScript types and Tauri invoke wrappers

**Files:**
- Create: `src/lib/types.ts`
- Create: `src/lib/invoke.ts`
- Create: `src/lib/events.ts`
- Create: `src/utils/debounce.ts`

- [ ] **Step 1: Write TypeScript types**

Write `src/lib/types.ts`:

```typescript
export interface NotePosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  color: ColorKey;
  tags: string[];
  position: NotePosition;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ColorKey = "paper" | "blush" | "sky" | "sage" | "apricot" | "lavender";

export interface ColorDef {
  key: ColorKey;
  name: string;
  hex: string;
}

export const COLORS: ColorDef[] = [
  { key: "paper", name: "Paper", hex: "#fff9c4" },
  { key: "blush", name: "Blush", hex: "#f8bbd0" },
  { key: "sky", name: "Sky", hex: "#b3e5fc" },
  { key: "sage", name: "Sage", hex: "#c8e6c9" },
  { key: "apricot", name: "Apricot", hex: "#ffe0b2" },
  { key: "lavender", name: "Lavender", hex: "#d1c4e9" },
];

export function getColorHex(key: ColorKey): string {
  return COLORS.find((c) => c.key === key)?.hex ?? "#fff9c4";
}

export interface Settings {
  defaultColor: ColorKey;
  autoSaveIntervalMs: number;
  launchOnStartup: boolean;
  trayOnClose: boolean;
}
```

- [ ] **Step 2: Write typed invoke wrappers**

Write `src/lib/invoke.ts`:

```typescript
import { invoke } from "@tauri-apps/api/core";
import type { Note, Settings } from "./types";

export async function listNotes(): Promise<Note[]> {
  return invoke<Note[]>("list_notes");
}

export async function readNote(id: string): Promise<Note> {
  return invoke<Note>("read_note", { id });
}

export async function writeNote(id: string, note: Note): Promise<void> {
  return invoke("write_note", { id, note });
}

export async function deleteNote(id: string): Promise<void> {
  return invoke("delete_note", { id });
}

export async function saveAttachment(
  noteId: string,
  fileName: string,
  data: number[]
): Promise<string> {
  return invoke<string>("save_attachment", { noteId, fileName, data });
}

export async function readSettings(): Promise<Settings> {
  return invoke<Settings>("read_settings");
}

export async function writeSettings(settings: Settings): Promise<void> {
  return invoke("write_settings", { settings });
}

export async function openNoteWindow(
  noteId: string,
  x: number,
  y: number,
  width: number,
  height: number
): Promise<void> {
  return invoke("open_note_window", { noteId, x, y, width, height });
}

export async function closeNoteWindow(noteId: string): Promise<void> {
  return invoke("close_note_window", { noteId });
}

export async function setNoteWindowPinned(
  noteId: string,
  pinned: boolean
): Promise<void> {
  return invoke("set_note_window_pinned", { noteId, pinned });
}
```

- [ ] **Step 3: Write event helpers**

Write `src/lib/events.ts`:

```typescript
import { listen, emit } from "@tauri-apps/api/event";
import type { Note } from "./types";

export function onNoteUpdated(callback: (note: Note) => void): Promise<() => void> {
  return listen<Note>("note-updated", (event) => callback(event.payload));
}

export function onNoteDeleted(callback: (noteId: string) => void): Promise<() => void> {
  return listen<string>("note-deleted", (event) => callback(event.payload));
}

export function emitNoteUpdated(note: Note): void {
  emit("note-updated", note);
}

export function emitNoteDeleted(noteId: string): void {
  emit("note-deleted", noteId);
}
```

- [ ] **Step 4: Write debounce utility**

Write `src/utils/debounce.ts`:

```typescript
export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delayMs: number
): { call: (...args: Parameters<T>) => void; cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return {
    call: (...args: Parameters<T>) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delayMs);
    },
    cancel: () => {
      if (timer) clearTimeout(timer);
    },
  };
}
```

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add frontend types, invoke wrappers, events, and debounce"
```

---

### Task 9: Frontend — Router entry point + App shell

**Files:**
- Create: `src/App.tsx`
- Modify: `src/index.tsx`
- Modify: `src/index.html`

- [ ] **Step 1: Write index.html with Segoe UI font**

Write `src/index.html`:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Sticky Notes</title>
    <style>
      body {
        font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
        margin: 0;
        overflow: hidden;
        background: #f5f5f5;
        user-select: none;
      }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/index.tsx"></script>
  </body>
</html>
```

- [ ] **Step 2: Write index.tsx entry**

Write `src/index.tsx`:

```typescript
import { render } from "solid-js/web";
import { Router } from "@solidjs/router";
import App from "./App";
import "./index.css";

render(
  () => (
    <Router>
      <App />
    </Router>
  ),
  document.getElementById("root")!
);
```

- [ ] **Step 3: Write App.tsx with routes**

Write `src/App.tsx`:

```typescript
import { Route, Routes } from "@solidjs/router";
import MainView from "./routes/MainView";
import NoteView from "./routes/NoteView";

export default function App() {
  return (
    <Routes>
      <Route path="/" component={MainView} />
      <Route path="/note/:id" component={NoteView} />
    </Routes>
  );
}
```

- [ ] **Step 4: Create placeholder route files**

Write `src/routes/MainView.tsx`:

```typescript
export default function MainView() {
  return <div class="flex h-screen">Main view placeholder</div>;
}
```

Write `src/routes/NoteView.tsx`:

```typescript
import { useParams } from "@solidjs/router";

export default function NoteView() {
  const params = useParams();
  return <div class="note-window p-4">Note: {params.id}</div>;
}
```

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add router entry point and app shell"
```

---

### Task 10: Frontend — Notes store

**Files:**
- Create: `src/stores/notesStore.ts`

- [ ] **Step 1: Write notes store**

Write `src/stores/notesStore.ts`:

```typescript
import { createStore, produce } from "solid-js/store";
import type { Note, ColorKey } from "../lib/types";
import * as api from "../lib/invoke";

const [notes, setNotes] = createStore<Note[]>([]);

export { notes };

export async function loadNotes(): Promise<void> {
  const data = await api.listNotes();
  setNotes(data);
}

export async function saveNote(note: Note): Promise<void> {
  await api.writeNote(note.id, note);
  setNotes(
    (n) => n.id === note.id,
    produce((draft) => {
      Object.assign(draft, note);
    })
  );
}

export async function deleteNoteById(id: string): Promise<void> {
  await api.deleteNote(id);
  setNotes((notes) => notes.filter((n) => n.id !== id));
}

export function updateNoteLocal(id: string, patch: Partial<Note>): void {
  setNotes(
    (n) => n.id === id,
    produce((draft) => {
      Object.assign(draft, patch, { updatedAt: new Date().toISOString() });
    })
  );
}

export function getNoteById(id: string): Note | undefined {
  return notes.find((n) => n.id === id);
}

export function getAllTags(): { name: string; count: number }[] {
  const tagMap = new Map<string, number>();
  for (const note of notes) {
    for (const tag of note.tags) {
      const lower = tag.toLowerCase();
      tagMap.set(lower, (tagMap.get(lower) ?? 0) + 1);
    }
  }
  return Array.from(tagMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat: add notes store with CRUD operations"
```

---

### Task 11: Frontend — Sidebar component

**Files:**
- Create: `src/components/Sidebar.tsx`

- [ ] **Step 1: Write Sidebar component**

Write `src/components/Sidebar.tsx`:

```typescript
import { createSignal, createMemo, For } from "solid-js";
import { notes, getAllTags } from "../stores/notesStore";
import { openNoteWindow } from "../lib/invoke";
import { Note } from "../lib/types";

interface SidebarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedTag: string;
  onTagSelect: (tag: string) => void;
  filterPinned: boolean;
  onFilterPinnedChange: (v: boolean) => void;
  onCreateNote: () => void;
}

export default function Sidebar(props: SidebarProps) {
  const tags = createMemo(() => getAllTags());

  return (
    <div class="w-52 bg-white border-r border-gray-200 flex flex-col h-full shrink-0">
      {/* Search */}
      <div class="p-3">
        <input
          type="text"
          placeholder="搜索便签..."
          value={props.searchQuery}
          onInput={(e) => props.onSearchChange(e.currentTarget.value)}
          class="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 bg-gray-50"
        />
      </div>

      {/* Tags */}
      <div class="flex-1 overflow-y-auto px-3 sidebar-scroll">
        <div class="flex flex-col gap-0.5">
          <button
            onClick={() => props.onTagSelect("")}
            classList={{
              "text-left text-xs px-2 py-1 rounded": true,
              "bg-gray-100 font-medium": props.selectedTag === "",
              "text-gray-600 hover:bg-gray-50": props.selectedTag !== "",
            }}
          >
            All ({notes.length})
          </button>
          <button
            onClick={() => {
              props.onTagSelect("");
              props.onFilterPinnedChange(!props.filterPinned);
            }}
            classList={{
              "text-left text-xs px-2 py-1 rounded": true,
              "bg-gray-100 font-medium": props.filterPinned,
              "text-gray-600 hover:bg-gray-50": !props.filterPinned,
            }}
          >
            Pinned ({notes.filter((n) => n.pinned).length})
          </button>
          <div class="my-1 border-t border-gray-100" />
          <For each={tags()}>
            {(tag) => (
              <button
                onClick={() =>
                  props.onTagSelect(
                    props.selectedTag === tag.name ? "" : tag.name
                  )
                }
                classList={{
                  "text-left text-xs px-2 py-1 rounded flex justify-between": true,
                  "bg-gray-100 font-medium": props.selectedTag === tag.name,
                  "text-gray-600 hover:bg-gray-50":
                    props.selectedTag !== tag.name,
                }}
              >
                <span>{tag.name}</span>
                <span class="text-gray-400">{tag.count}</span>
              </button>
            )}
          </For>
        </div>
      </div>

      {/* New note button */}
      <div class="p-3 border-t border-gray-100">
        <button
          onClick={props.onCreateNote}
          class="w-full py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
        >
          + 新建便签
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat: add Sidebar component with search, tags, and filters"
```

---

### Task 12: Frontend — NoteCard + MasonryGrid components

**Files:**
- Create: `src/components/NoteCard.tsx`
- Create: `src/components/MasonryGrid.tsx`

- [ ] **Step 1: Write NoteCard component**

Write `src/components/NoteCard.tsx`:

```typescript
import { Note, COLORS, getColorHex } from "../lib/types";
import { openNoteWindow, closeNoteWindow, deleteNote } from "../lib/invoke";
import { deleteNoteById } from "../stores/notesStore";
import { createSignal, Show } from "solid-js";
import ConfirmDialog from "./ConfirmDialog";

interface NoteCardProps {
  note: Note;
}

export default function NoteCard(props: NoteCardProps) {
  const [showMenu, setShowMenu] = createSignal(false);
  const [menuPos, setMenuPos] = createSignal({ x: 0, y: 0 });
  const [showConfirm, setShowConfirm] = createSignal(false);

  const handleDoubleClick = () => {
    const p = props.note.position;
    openNoteWindow(props.note.id, p.x, p.y, p.width, p.height);
  };

  const handleContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    setMenuPos({ x: e.clientX, y: e.clientY });
    setShowMenu(true);
  };

  const handlePopOut = () => {
    setShowMenu(false);
    const p = props.note.position;
    openNoteWindow(props.note.id, p.x, p.y, p.width, p.height);
  };

  const handleDelete = async () => {
    setShowConfirm(false);
    setShowMenu(false);
    await closeNoteWindow(props.note.id);
    await deleteNoteById(props.note.id);
  };

  const stripHtml = (html: string) => {
    const div = document.createElement("div");
    div.innerHTML = html;
    return div.textContent || "";
  };

  const colorHex = () => getColorHex(props.note.color);

  return (
    <>
      <div
        class="rounded-lg p-3 cursor-pointer shadow-sm hover:shadow-md transition-shadow relative group"
        style={{ background: colorHex() }}
        onDblClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
      >
        {/* Pin indicator */}
        <Show when={props.note.pinned}>
          <div class="absolute top-1 right-1 text-gray-400 text-xs">📌</div>
        </Show>

        <h3 class="font-semibold text-sm mb-1 truncate text-gray-800">
          {props.note.title || "Untitled"}
        </h3>

        <p class="text-xs text-gray-600 line-clamp-3 leading-relaxed">
          {stripHtml(props.note.content)}
        </p>

        <Show when={props.note.tags.length > 0}>
          <div class="flex gap-1 mt-2 flex-wrap">
            {props.note.tags.map((tag) => (
              <span class="text-[10px] bg-black/5 px-1.5 py-0.5 rounded-full text-gray-500">
                {tag}
              </span>
            ))}
          </div>
        </Show>
      </div>

      {/* Context menu */}
      <Show when={showMenu()}>
        <div
          class="fixed inset-0 z-40"
          onClick={() => setShowMenu(false)}
        />
        <div
          class="fixed z-50 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-36 text-sm"
          style={{ left: `${menuPos().x}px`, top: `${menuPos().y}px` }}
        >
          <button
            class="w-full text-left px-3 py-1.5 hover:bg-gray-50 text-gray-700"
            onClick={handlePopOut}
          >
            Pop out
          </button>
          <button
            class="w-full text-left px-3 py-1.5 hover:bg-gray-50 text-gray-700"
            onClick={() => { setShowMenu(false); }}
          >
            Change color
          </button>
          <div class="border-t border-gray-100 my-0.5" />
          <button
            class="w-full text-left px-3 py-1.5 hover:bg-red-50 text-red-600"
            onClick={() => { setShowConfirm(true); }}
          >
            Delete
          </button>
        </div>
      </Show>

      <Show when={showConfirm()}>
        <ConfirmDialog
          message="Delete this note? This cannot be undone."
          onConfirm={handleDelete}
          onCancel={() => setShowConfirm(false)}
        />
      </Show>
    </>
  );
}
```

- [ ] **Step 2: Write MasonryGrid component**

Write `src/components/MasonryGrid.tsx`:

```typescript
import { For } from "solid-js";
import type { Note } from "../lib/types";
import NoteCard from "./NoteCard";

interface MasonryGridProps {
  notes: Note[];
}

export default function MasonryGrid(props: MasonryGridProps) {
  return (
    <div class="flex-1 overflow-y-auto p-4">
      <div class="columns-2 md:columns-3 lg:columns-4 gap-4 space-y-4">
        <For each={props.notes}>
          {(note) => <NoteCard note={note} />}
        </For>
      </div>
      {props.notes.length === 0 && (
        <div class="flex items-center justify-center h-full text-gray-400 text-sm">
          No notes yet — click "+ 新建便签" to create one
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: add NoteCard and MasonryGrid components"
```

---

### Task 13: Frontend — ConfirmDialog + ContextMenu (common components)

**Files:**
- Create: `src/components/ConfirmDialog.tsx`
- Create: `src/components/ContextMenu.tsx`

- [ ] **Step 1: Write ConfirmDialog**

Write `src/components/ConfirmDialog.tsx`:

```typescript
interface ConfirmDialogProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
}

export default function ConfirmDialog(props: ConfirmDialogProps) {
  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
      <div class="bg-white rounded-xl shadow-xl p-6 w-80 max-w-[90vw]">
        <p class="text-sm text-gray-700 mb-4">{props.message}</p>
        <div class="flex justify-end gap-2">
          <button
            onClick={props.onCancel}
            class="px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            {props.cancelLabel ?? "Cancel"}
          </button>
          <button
            onClick={props.onConfirm}
            class="px-4 py-1.5 text-sm bg-red-600 text-white hover:bg-red-700 rounded-lg transition-colors"
          >
            {props.confirmLabel ?? "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write ContextMenu**

Write `src/components/ContextMenu.tsx`:

```typescript
import { createSignal, Show, For, createEffect, onCleanup } from "solid-js";

interface MenuItem {
  label: string;
  danger?: boolean;
  action: () => void;
}

export function useContextMenu() {
  const [show, setShow] = createSignal(false);
  const [position, setPosition] = createSignal({ x: 0, y: 0 });
  const [items, setItems] = createSignal<MenuItem[]>([]);

  const open = (x: number, y: number, menuItems: MenuItem[]) => {
    setPosition({ x, y });
    setItems(menuItems);
    setShow(true);
  };

  const close = () => setShow(false);

  return { open, close, show, position, items };
}

interface ContextMenuProps {
  show: boolean;
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
}

export default function ContextMenu(props: ContextMenuProps) {
  let ref: HTMLDivElement | undefined;

  const handleClickOutside = (e: MouseEvent) => {
    if (ref && !ref.contains(e.target as Node)) {
      props.onClose();
    }
  };

  createEffect(() => {
    if (props.show) {
      document.addEventListener("click", handleClickOutside);
      onCleanup(() => document.removeEventListener("click", handleClickOutside));
    }
  });

  return (
    <Show when={props.show}>
      <div
        ref={ref}
        class="fixed z-50 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-36 text-sm"
        style={{ left: `${props.x}px`, top: `${props.y}px` }}
      >
        <For each={props.items}>
          {(item, i) => (
            <>
              {item.label === "---" ? (
                <div class="border-t border-gray-100 my-0.5" />
              ) : (
                <button
                  class="w-full text-left px-3 py-1.5 hover:bg-gray-50"
                  classList={{
                    "text-red-600 hover:bg-red-50": item.danger,
                    "text-gray-700": !item.danger,
                  }}
                  onClick={() => { item.action(); props.onClose(); }}
                >
                  {item.label}
                </button>
              )}
            </>
          )}
        </For>
      </div>
    </Show>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: add ConfirmDialog and ContextMenu common components"
```

---

### Task 14: Frontend — Wire up MainView (management view)

**Files:**
- Modify: `src/routes/MainView.tsx`

- [ ] **Step 1: Write full MainView**

Write `src/routes/MainView.tsx`:

```typescript
import { createSignal, createEffect, createMemo, onCleanup } from "solid-js";
import { notes, loadNotes, getAllTags } from "../stores/notesStore";
import { onNoteUpdated, onNoteDeleted, emitNoteDeleted } from "../lib/events";
import { openNoteWindow } from "../lib/invoke";
import Sidebar from "../components/Sidebar";
import MasonryGrid from "../components/MasonryGrid";
import { Note } from "../lib/types";

export default function MainView() {
  const [searchQuery, setSearchQuery] = createSignal("");
  const [selectedTag, setSelectedTag] = createSignal("");
  const [filterPinned, setFilterPinned] = createSignal(false);
  let unlistenUpdate: (() => void) | undefined;
  let unlistenDelete: (() => void) | undefined;

  createEffect(() => {
    loadNotes();
  });

  // Listen for updates from floating windows
  createEffect(() => {
    onNoteUpdated((_note) => loadNotes()).then((fn) => (unlistenUpdate = fn));
    onNoteDeleted((_id) => loadNotes()).then((fn) => (unlistenDelete = fn));
  });

  onCleanup(() => {
    unlistenUpdate?.();
    unlistenDelete?.();
  });

  const filteredNotes = createMemo(() => {
    let result = notes;
    const q = searchQuery().toLowerCase();
    const tag = selectedTag().toLowerCase();

    if (q) {
      result = result.filter((n) => {
        const text = (n.title + " " + n.content).toLowerCase();
        return text.includes(q);
      });
    }

    if (tag) {
      result = result.filter((n) =>
        n.tags.some((t) => t.toLowerCase() === tag)
      );
    }

    if (filterPinned()) {
      result = result.filter((n) => n.pinned);
    }

    return result;
  });

  const handleCreateNote = async () => {
    const id = crypto.randomUUID();
    const note: Note = {
      id,
      title: "",
      content: "<p></p>",
      color: "paper",
      tags: [],
      position: { x: 200, y: 150, width: 320, height: 260 },
      pinned: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const { writeNote } = await import("../lib/invoke");
    await writeNote(id, note);
    await openNoteWindow(id, 200, 150, 320, 260);
    await loadNotes();
  };

  return (
    <div class="flex h-screen bg-gray-50">
      <Sidebar
        searchQuery={searchQuery()}
        onSearchChange={setSearchQuery}
        selectedTag={selectedTag()}
        onTagSelect={(tag) => {
          setFilterPinned(false);
          setSelectedTag(tag);
        }}
        filterPinned={filterPinned()}
        onFilterPinnedChange={setFilterPinned}
        onCreateNote={handleCreateNote}
      />
      <MasonryGrid notes={filteredNotes()} />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat: wire up MainView with sidebar, grid, and cross-window sync"
```

---

### Task 15: Frontend — TipTap editor + NoteView (floating window)

**Files:**
- Create: `src/components/NoteToolbar.tsx`
- Modify: `src/routes/NoteView.tsx`

- [ ] **Step 1: Write NoteToolbar**

Write `src/components/NoteToolbar.tsx`:

```typescript
import type { Editor } from "@tiptap/core";

interface NoteToolbarProps {
  editor: Editor | null;
}

export default function NoteToolbar(props: NoteToolbarProps) {
  const btnClass = (active: boolean) =>
    `px-1.5 py-0.5 text-xs rounded ${
      active ? "bg-gray-200 text-gray-900" : "text-gray-500 hover:bg-gray-100"
    }`;

  if (!props.editor) return null;

  return (
    <div class="flex gap-0.5 mb-2 flex-wrap">
      <button
        class={btnClass(props.editor.isActive("bold"))}
        onClick={() => props.editor!.chain().focus().toggleBold().run()}
      >
        <b>B</b>
      </button>
      <button
        class={btnClass(props.editor.isActive("italic"))}
        onClick={() => props.editor!.chain().focus().toggleItalic().run()}
      >
        <i>I</i>
      </button>
      <button
        class={btnClass(props.editor.isActive("underline"))}
        onClick={() => props.editor!.chain().focus().toggleUnderline().run()}
      >
        <u>U</u>
      </button>
      <button
        class={btnClass(props.editor.isActive("strike"))}
        onClick={() => props.editor!.chain().focus().toggleStrike().run()}
      >
        <s>S</s>
      </button>
      <span class="w-px bg-gray-200 mx-0.5" />
      <button
        class={btnClass(props.editor.isActive("bulletList"))}
        onClick={() => props.editor!.chain().focus().toggleBulletList().run()}
      >
        • List
      </button>
      <button
        class={btnClass(props.editor.isActive("orderedList"))}
        onClick={() => props.editor!.chain().focus().toggleOrderedList().run()}
      >
        1. List
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Write full NoteView**

Write `src/routes/NoteView.tsx`:

```typescript
import { useParams } from "@solidjs/router";
import { createSignal, createEffect, onCleanup, Show } from "solid-js";
import { createEditor, Editor } from "solid-tiptap";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { getWindowLabel } from "@tauri-apps/api/window";
import type { Note } from "../lib/types";
import * as api from "../lib/invoke";
import { emitNoteUpdated } from "../lib/events";
import { COLORS, getColorHex } from "../lib/types";
import NoteToolbar from "../components/NoteToolbar";
import TagInput from "../components/TagInput";
import { debounce } from "../utils/debounce";

export default function NoteView() {
  const params = useParams<{ id: string }>();
  const [note, setNote] = createSignal<Note | null>(null);
  const [title, setTitle] = createSignal("");
  const [tags, setTags] = createSignal<string[]>([]);
  const [color, setColor] = createSignal("paper");
  const [pinned, setPinned] = createSignal(false);
  const [showColorPicker, setShowColorPicker] = createSignal(false);

  let editorRef: Editor | undefined;

  const editor = createEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({ openOnClick: false }),
      Image.configure({ inline: true }),
      Placeholder.configure({ placeholder: "开始写..." }),
    ],
    onUpdate: () => {
      autoSave();
    },
    editorProps: {
      attributes: { class: "prose prose-sm max-w-none" },
    },
  });

  // Debounced auto-save
  const autoSave = debounce(async () => {
    const current = note();
    if (!current || !editorRef) return;
    const updated: Note = {
      ...current,
      title: title(),
      content: editorRef.getHTML(),
      tags: tags(),
      color: color() as Note["color"],
      pinned: pinned(),
      updatedAt: new Date().toISOString(),
    };
    // Persist window position
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const win = getCurrentWindow();
      const pos = await win.outerPosition();
      const size = await win.outerSize();
      updated.position = {
        x: pos.x / await win.scaleFactor(),
        y: pos.y / await win.scaleFactor(),
        width: size.width / await win.scaleFactor(),
        height: size.height / await win.scaleFactor(),
      };
    } catch {}
    await api.writeNote(current.id, updated);
    setNote(updated);
    emitNoteUpdated(updated);
  }, 2000);

  // Load note data
  createEffect(async () => {
    const data = await api.readNote(params.id);
    setNote(data);
    setTitle(data.title);
    setTags(data.tags);
    setColor(data.color);
    setPinned(data.pinned);

    // Set editor content once it's ready
    setTimeout(() => {
      const e = editor();
      if (e) {
        editorRef = e;
        e.commands.setContent(data.content);
      }
    }, 100);
  });

  // Handle close — save and destroy window
  const handleClose = async () => {
    autoSave.cancel();
    const current = note();
    if (current && editorRef) {
      const updated: Note = {
        ...current,
        title: title(),
        content: editorRef.getHTML(),
        tags: tags(),
        color: color() as Note["color"],
        pinned: pinned(),
        updatedAt: new Date().toISOString(),
      };
      await api.writeNote(current.id, updated);
      emitNoteUpdated(updated);
    }
    await api.closeNoteWindow(params.id);
  };

  const handlePinToggle = async () => {
    const newPinned = !pinned();
    setPinned(newPinned);
    await api.setNoteWindowPinned(params.id, newPinned);
  };

  const colorHex = () => getColorHex(color() as Note["color"]);

  return (
    <div class="note-window h-full flex flex-col bg-white select-none">
      {/* Drag handle / header */}
      <div
        class="flex items-center justify-between px-4 pt-3 pb-1"
        data-tauri-drag-region
      >
        <div class="flex gap-1.5">
          <button
            onClick={handlePinToggle}
            class="w-3 h-3 rounded-full"
            classList={{
              "bg-gray-300 hover:bg-gray-400": !pinned(),
              "bg-gray-600": pinned(),
            }}
            title="Pin / unpin"
          />
          <button
            onClick={handleClose}
            class="w-3 h-3 rounded-full bg-red-400 hover:bg-red-500"
            title="Close"
          />
        </div>
        <button
          onClick={() => setShowColorPicker(!showColorPicker())}
          class="w-4 h-4 rounded-sm border border-gray-300"
          style={{ background: colorHex() }}
        />
      </div>

      {/* Color picker */}
      <Show when={showColorPicker()}>
        <div class="px-4 pb-2 flex gap-1.5">
          {COLORS.map((c) => (
            <button
              onClick={() => {
                setColor(c.key);
                setShowColorPicker(false);
              }}
              class="w-5 h-5 rounded-sm border"
              classList={{ "border-gray-900": color() === c.key, "border-gray-200": color() !== c.key }}
              style={{ background: c.hex }}
              title={c.name}
            />
          ))}
        </div>
      )}

      {/* Title */}
      <input
        type="text"
        value={title()}
        onInput={(e) => setTitle(e.currentTarget.value)}
        placeholder="Title"
        class="px-4 text-lg font-semibold text-gray-800 outline-none bg-transparent placeholder-gray-300"
      />

      {/* Toolbar */}
      <div class="px-4">
        <NoteToolbar editor={editor()} />
      </div>

      {/* Editor */}
      <div class="flex-1 px-4 pb-2 overflow-y-auto">
        <div class="min-h-[120px]" onClick={() => editor()?.commands.focus()}>
          {/* TipTap mounts here from createEditor */}
        </div>
      </div>

      {/* Tags */}
      <div class="px-4 pb-3">
        <TagInput tags={tags()} onChange={setTags} />
      </div>

      {/* Left color accent border */}
      <div
        class="absolute left-0 top-0 bottom-0 w-1"
        style={{ background: colorHex() }}
      />
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: add TipTap editor and NoteView floating window"
```

---

### Task 16: Frontend — TagInput component

**Files:**
- Create: `src/components/TagInput.tsx`

- [ ] **Step 1: Write TagInput**

Write `src/components/TagInput.tsx`:

```typescript
import { createSignal, createMemo, Show, For } from "solid-js";
import { notes } from "../stores/notesStore";

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
}

export default function TagInput(props: TagInputProps) {
  const [input, setInput] = createSignal("");
  const [showSuggestions, setShowSuggestions] = createSignal(false);

  const allTags = createMemo(() => {
    const tagSet = new Set<string>();
    for (const note of notes) {
      for (const tag of note.tags) {
        tagSet.add(tag.toLowerCase());
      }
    }
    return Array.from(tagSet).sort();
  });

  const suggestions = createMemo(() => {
    const q = input().toLowerCase().trim();
    if (!q) return [];
    return allTags()
      .filter(
        (t) =>
          t.includes(q) &&
          !props.tags.some((existing) => existing.toLowerCase() === t)
      )
      .slice(0, 5);
  });

  const addTag = (tag: string) => {
    const trimmed = tag.trim();
    if (!trimmed) return;
    // Deduplicate case-insensitive
    if (props.tags.some((t) => t.toLowerCase() === trimmed.toLowerCase())) {
      setInput("");
      setShowSuggestions(false);
      return;
    }
    props.onChange([...props.tags, trimmed]);
    setInput("");
    setShowSuggestions(false);
  };

  const removeTag = (index: number) => {
    props.onChange(props.tags.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && input().trim()) {
      e.preventDefault();
      const suggestion = suggestions()[0];
      if (suggestion) {
        addTag(suggestion);
      } else {
        addTag(input());
      }
    } else if (e.key === "Backspace" && !input() && props.tags.length > 0) {
      removeTag(props.tags.length - 1);
    }
  };

  return (
    <div class="relative">
      <div class="flex flex-wrap gap-1 mb-1">
        <For each={props.tags}>
          {(tag, i) => (
            <span class="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
              {tag}
              <button
                onClick={() => removeTag(i())}
                class="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </span>
          )}
        </For>
      </div>
      <div class="relative">
        <input
          type="text"
          value={input()}
          onInput={(e) => {
            setInput(e.currentTarget.value);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          onKeyDown={handleKeyDown}
          placeholder="+ add tag"
          class="text-xs text-gray-400 outline-none bg-transparent w-full"
        />
        <Show when={showSuggestions() && suggestions().length > 0}>
          <div class="absolute bottom-full left-0 mb-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-36 z-50">
            <For each={suggestions()}>
              {(s) => (
                <button
                  class="w-full text-left px-3 py-1 text-xs text-gray-600 hover:bg-gray-50"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    addTag(s);
                  }}
                >
                  {s}
                </button>
              )}
            </For>
          </div>
        </Show>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat: add TagInput component with autocomplete"
```

---

### Task 17: Frontend — ColorPicker component

**Files:**
- Create: `src/components/ColorPicker.tsx`

- [ ] **Step 1: Write ColorPicker**

Write `src/components/ColorPicker.tsx`:

```typescript
import { COLORS, type ColorKey } from "../lib/types";

interface ColorPickerProps {
  selected: ColorKey;
  onChange: (color: ColorKey) => void;
}

export default function ColorPicker(props: ColorPickerProps) {
  return (
    <div class="flex gap-2 p-2 bg-white rounded-lg shadow-lg border border-gray-200">
      {COLORS.map((c) => (
        <button
          onClick={() => props.onChange(c.key)}
          class="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110"
          classList={{
            "border-gray-900": props.selected === c.key,
            "border-transparent": props.selected !== c.key,
          }}
          style={{ background: c.hex }}
          title={c.name}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat: add ColorPicker component"
```

---

### Task 18: Final integration — cross-window sync, polish, and build test

**Files:**
- Modify: `src-tauri/src/lib.rs` (add event emission on write/delete)
- Modify: `src-tauri/src/tray.rs` (use correct icon)

- [ ] **Step 1: Add cross-window event emission in Rust**

Edit `src-tauri/src/commands/notes.rs` — add event emission to `write_note` and `delete_note`:

Add after the `write_note` function signature (change return type and add event):

```rust
#[tauri::command]
pub fn write_note(app: AppHandle, id: String, mut note: Note) -> Result<(), String> {
    let dir = ensure_notes_dir(&app);
    note.updated_at = chrono::Utc::now().to_rfc3339();
    let path = dir.join(format!("{}.json", id));
    let json = serde_json::to_string_pretty(&note).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| e.to_string())?;
    // Emit event so management view refreshes
    let _ = app.emit("note-updated", &note);
    Ok(())
}

#[tauri::command]
pub fn delete_note(app: AppHandle, id: String) -> Result<(), String> {
    let dir = ensure_notes_dir(&app);
    let path = dir.join(format!("{}.json", id));
    if path.exists() {
        fs::remove_file(&path).map_err(|e| e.to_string())?;
    }
    // Emit event so management view refreshes
    let _ = app.emit("note-deleted", &id);
    Ok(())
}
```

Also add `use tauri::Emitter;` at the top of the file.

- [ ] **Step 2: Ensure tray icon exists**

Check `src-tauri/icons/` — the Tauri scaffold should have generated `32x32.png` and `icon.png`. If missing, run:

```bash
cd src-tauri && cargo install tauri-cli --version "^2" && npx tauri icon
```

This generates all required icon sizes from a default placeholder. Verify `tauri.conf.json` has:

```json
"icon": ["icons/32x32.png", "icons/128x128.png", "icons/128x128@2x.png", "icons/icon.icns", "icons/icon.ico"]
```

- [ ] **Step 3: Build and verify**

```bash
cd src-tauri && cargo check
```

Expected: no errors.

Then:

```bash
npm run tauri build -- --debug
```

Verify the build produces a working executable.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: final integration, cross-window sync, and build verification"
```

---

## Implementation Order

Tasks must be executed in numerical order (1 → 18). Each task builds on the previous:

1. **Scaffold** (Task 1) — foundation
2. **Rust backend** (Tasks 2-6) — data models, CRUD, windows, tray
3. **Rust wiring** (Task 7) — connect everything in lib.rs
4. **Frontend foundation** (Tasks 8-10) — types, stores
5. **Frontend components** (Tasks 11-13) — Sidebar, NoteCard, MasonryGrid, dialogs
6. **Frontend views** (Tasks 14-15) — MainView, NoteView with TipTap
7. **Frontend sub-components** (Tasks 16-17) — TagInput, ColorPicker
8. **Final integration** (Task 18) — cross-window events, build test

## Verification Checklist

After all tasks complete, manually verify:

- [x] App starts with main window + tray icon
- [x] "+ 新建便签" creates a note and opens floating window
- [x] Floating window is borderless, draggable, with colored left border
- [~] TipTap editor: bold, italic, underline, lists, images all work — images: TipTap `Image` extension configured but no toolbar button or paste handler exposed (see CHANGELOG §0.1.0 "Known gaps")
- [x] Tags: add, autocomplete, remove
- [x] Color change works from floating window
- [x] Edit content → close window → reopen: content persisted
- [x] Double-click card in management view → opens same floating window
- [x] Pin toggle keeps window on top
- [x] Close main window → hides to tray, floating windows stay open
- [x] Tray icon: left-click shows main window, menu has "New note" and "Quit"
- [x] Delete note with confirmation works
- [x] Search filters notes by text
- [x] Tag filter in sidebar shows correct counts and filters notes
- [x] Pinned filter works
- [x] Masonry waterfall layout renders cards correctly

**Mark-up 2026-07-14:** all 16 items pass except TipTap image paste (configured, no UI). See [CHANGELOG.md](../../../../CHANGELOG.md) §0.1.0 "Known gaps" for the full gap list (settingsStore, App.tsx placeholder, unused ColorPicker, no-op "Change color" menu item).
