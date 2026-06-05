# Sticky Notes — Design Spec

**Date:** 2026-06-06
**Status:** Approved

A lightweight, high-performance, modern minimalist sticky notes desktop application.

---

## 1. Tech Stack

| Layer | Choice | Rationale |
|---|---|---|
| **Desktop shell** | Tauri 2.x | Lightweight (~5MB), low memory, Rust backend |
| **Frontend framework** | SolidJS | ~7KB runtime, no virtual DOM, fine-grained reactivity |
| **Rich text editor** | TipTap (ProseMirror) | Industry standard, extensible, handles images/attachments |
| **Styling** | Tailwind CSS | Utility-first, minimal CSS output |
| **Font** | Segoe UI | Windows native, zero bundle cost |
| **Language** | TypeScript (frontend), Rust (backend) | Type safety at both layers |

## 2. Architecture

```
┌──────────────────────────────────────────────┐
│                  Tauri Shell                  │
│  ┌──────────────────┐  ┌──────────────────┐  │
│  │    Rust Core      │  │   SolidJS App     │  │
│  │  - File I/O       │  │  - Main window    │  │
│  │  - Window manager  │  │  - Floating notes  │  │
│  │  - System tray    │  │  - TipTap editor  │  │
│  │  - File watcher    │  │  - Tag system     │  │
│  └──────────────────┘  └──────────────────┘  │
└──────────────────────────────────────────────┘
```

- **Rust Core** handles filesystem operations (read/write note files), multi-window lifecycle (spawn/destroy floating windows), and system tray icon with context menu.
- **SolidJS App** renders in the main window and N floating windows. Each floating window loads its note by ID.
- **Two frontend routes:** `/` (management view) and `/note/:id` (floating window view).
- **Communication:** Tauri `invoke` for Rust commands; Tauri events for cross-window sync (e.g., note updated in floating window → refresh management view).

## 3. Data Model

### Storage layout

```
~/.sticky-notes/
├── notes/
│   ├── <uuid>.json
│   └── ...
├── attachments/
│   └── <uuid>/
│       ├── image1.png
│       └── ...
└── settings.json
```

### Note JSON schema

```json
{
  "id": "uuid",
  "title": "",
  "content": "<p>rich text HTML</p>",
  "color": "paper",
  "tags": ["work", "urgent"],
  "position": { "x": 300, "y": 200, "width": 280, "height": 220 },
  "pinned": false,
  "createdAt": "2026-06-06T00:00:00Z",
  "updatedAt": "2026-06-06T00:00:00Z"
}
```

### Settings JSON schema

```json
{
  "defaultColor": "paper",
  "autoSaveIntervalMs": 2000,
  "launchOnStartup": false,
  "trayOnClose": true
}
```

### Color palette

| Key | Hex | Name |
|---|---|---|
| `paper` | `#fff9c4` | Yellow paper |
| `blush` | `#f8bbd0` | Pink |
| `sky` | `#b3e5fc` | Light blue |
| `sage` | `#c8e6c9` | Green |
| `apricot` | `#ffe0b2` | Orange |
| `lavender` | `#d1c4e9` | Purple |

All colors are pastel, low-saturation, Japanese stationery aesthetic.

## 4. Views & Components

### Main Window — Management View (`/`)

**Layout:** Masonry waterfall grid with a left sidebar for filters.

```
┌─────────────┬──────────────────────────────────┐
│ Search       │ ┌─────┐ ┌─────┐ ┌───┐ ┌─────┐  │
│ ─────────── │ │note │ │note │ │   │ │note │  │
│ Tags         │ └─────┘ └─────┘ │   │ └─────┘  │
│ • work (3)   │ ┌───┐ ┌────────┐ ┌───┐        │
│ • personal   │ │   │ │ note   │ │   │        │
│ • ideas (1)  │ │   │ │        │ │   │        │
│ • urgent (2) │ │   │ │ long   │ │   │        │
│              │ └───┘ └────────┘ └───┘        │
│ All (8)      │ ┌─────────────┐ ┌─────┐       │
│ Pinned (2)   │ │    note     │ │note │       │
│              │ │   medium    │ └─────┘       │
│ [+ New Note] │ └─────────────┘              │
└─────────────┴──────────────────────────────────┘
```

**Note card (management view):**
- Shows: title, truncated content (first 2 lines), tags as small pills
- Background tinted with note's color
- Double-click → pop out to floating window
- Right-click → context menu (pop out, edit color, edit tags, delete)

**Sidebar:**
- Search bar (full-text filter across title + content)
- Tag list with counts (click to filter, click again to clear)
- "All" / "Pinned" quick filters
- "+ New Note" button

**Card interactions:**
- Click → select, preview in split panel or inline
- Double-click → pop out as floating window
- Right-click → context menu

### Floating Window — Note View (`/note/:id`)

**Style:** Borderless, no title bar, shadow-only window. White card with colored left border accent.

```
┌──────────────────────────────────────┐
│ ○ ●                                   │  ← drag handle (hover to reveal)
│                                       │
│  买牛奶                               │  ← title (editable)
│  ─────────────────────────────────    │
│                                       │
│  下班路过超市买脱脂牛奶，              │  ← TipTap rich text editor
│  顺便带一盒鸡蛋。记得看保质期。        │
│                                       │
│  [work] [urgent]  [+ add tag]        │  ← tags
│                                       │
└──────────────────────────────────────┘
  ▌  ← colored left border (4px, note's color)
```

**Window behavior:**
- Draggable from any blank area (no title bar)
- Right-click header area → pin/unpin, change color, delete
- Close button (●) → note returns to management view (NOT deleted)
- Pin button (○) → toggle always-on-top
- Window position and size persisted to `note.position`
- Content auto-saves on every change (debounced 2s)

**Editor features (TipTap):**
- Bold, italic, strikethrough, underline
- Bullet and ordered lists
- Links
- Image paste / drag-drop (saved to `attachments/<uuid>/`)
- Undo/redo

**Tag input:**
- Inline tag pills below content
- Type to add → autocomplete from existing tags
- Click × on pill to remove
- Tags are case-insensitive deduplicated

## 5. Key Interactions

### Pop-out flow
1. User double-clicks a note card in management view (or right-click → "Pop out")
2. Rust creates a new borderless Tauri window at the note's saved position
3. Window loads `/note/:id` with the note's ID
4. Frontend fetches note data and renders the TipTap editor
5. Any edits sync back to the file and broadcast to management view via Tauri events

### Close floating window
1. User clicks close button (●) on floating window
2. Window is destroyed by Rust
3. Note data is NOT deleted — it returns to management view
4. If there were unsaved edits, they are saved before closing

### System tray
- App starts with main window visible + tray icon
- Closing main window → hides to tray, all floating windows remain open
- Tray icon context menu: "Show main window", "New note", "Quit"
- Double-click tray icon → show main window
- "Quit" closes all windows and exits the process

### Note creation
- "+ New Note" button in main window → creates a new note file, opens it as floating window immediately
- Also from tray → "New note" → spawns a floating window directly

### Note deletion
- Right-click card → "Delete" with confirmation dialog
- Also from floating window right-click menu → "Delete"
- Deletion is permanent with a confirmation dialog. No trash/recycle bin for v1.

## 6. File I/O (Rust commands)

| Command | Description |
|---|---|
| `list_notes()` | Scan `notes/` directory, return all JSON as array |
| `read_note(id)` | Read single note JSON |
| `write_note(id, data)` | Write note JSON to file |
| `delete_note(id)` | Delete note JSON file |
| `save_attachment(id, bytes, filename)` | Save attachment file, return path |
| `read_settings()` | Read settings.json |
| `write_settings(data)` | Write settings.json |
| `create_window(label, url, x, y, w, h)` | Create borderless floating window |
| `destroy_window(label)` | Destroy a floating window |

## 7. Cross-window sync

When a note is edited in a floating window:
1. Frontend calls `write_note()` via Tauri invoke
2. Rust emits a Tauri event `note-updated` with the note data
3. Management view listens for `note-updated` and refreshes its grid

When a note is deleted from management view:
1. If the note's floating window is open, close it first
2. Delete the file
3. Emit `note-deleted` event

## 8. Performance & Constraints

- **First launch:** List all notes < 100ms (JSON file scan)
- **Note open:** Read and render < 50ms
- **Auto-save:** Debounced 2s, non-blocking
- **Memory:** Target < 50MB idle, < 100MB with 10 floating windows open
- **Bundle size:** < 5MB installer (Tauri default)
- **Editor:** TipTap extensions loaded on demand (only bold/italic/list/link/image)

## 9. Future Considerations (out of scope for v1)

- Cloud sync (WebDAV, S3, custom backend)
- Reminders / due dates
- Markdown export
- Themes (dark mode)
- Multi-language support
- macOS / Linux builds
- Note pinning to specific virtual desktops
