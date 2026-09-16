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


---

# Sticky Notes — Implementation Status (addendum, 2026-07-14)

> Appended to the original design spec above on 2026-07-14. The original spec describes v1 design intent; this addendum records what was actually built in v0.1.0, the deltas from spec, and what is still pending.

## Shipped as v0.1.0 on 2026-06-06

All 18 tasks in the [implementation plan](../plans/2026-06-06-sticky-notes.md) are committed. The verification checklist there has been marked up against actual code.

## Spec sections that match the implementation

- §1 Tech Stack — Tauri 2.x + SolidJS 1.x + TipTap 2.x + Tailwind CSS 4 + TS/Rust
- §2 Architecture — two-layer (Rust core + SolidJS app) + two routes (main + note)
- §3 Data Model — schema matches; JSON camelCase on the wire; `NotePosition` defaults to `{ x: 100, y: 100, width: 300, height: 240 }`
- §4 Main Window layout — masonry grid + left sidebar
- §4 Floating window — borderless, draggable, pin button, color change from window, TipTap editor, tags
- §5 Pop-out / close / tray / create / delete — all match spec
- §6 File I/O commands — all commands listed in the spec are implemented
- §7 Cross-window sync — matches (note-updated / note-deleted events)
- §8 Performance & Constraints — not benchmarked in v0.1.0

## Spec deltas (built slightly differently)

### Note-ID delivery: initialization_script instead of URL path

The spec said the floating window loads /note/:id. In practice Tauri WebView + the build setup made URL-path routing unreliable; the build was switched to:

- src-tauri/src/windows.rs injects window.__NOTE_ID__ via Tauri initialization_script
- src/index.tsx reads __NOTE_ID__ first; falls back to ?noteId= for Vite dev only
- URL stays index.html regardless of note

Same UX (each note gets its own webview), different mechanism for handing the ID to the frontend.

### Card click interaction

The spec described click → select with an inline preview panel. The implementation does not have a select state or preview — double-click pops out, right-click shows the context menu, single-click does nothing. The preview panel was scoped out to keep v0.1.0 focused.

### Color picker

src/components/ColorPicker.tsx was created per the plan but is not imported anywhere. The floating window inlines its own color row using the COLORS constant from lib/types.ts. The component is kept as dead code for future use; either delete it or wire it up in v0.2.

### Image paste/drag-drop

The TipTap Image extension is configured (Image.configure({ inline: true })), but there is no toolbar button or paste handler in v0.1.0. The save_attachment / delete_attachment Rust commands are implemented and ready; only the UI hook is missing.

### Routing layer

src/App.tsx is a return null placeholder. Routing lives directly in src/index.tsx as a manual Switch/Match (no @solidjs/router — that dependency was dropped because it did not behave correctly in Tauri WebView).

### Settings store

stores/settingsStore.ts was planned but never created. readSettings() / writeSettings() are reachable via invoke.ts but no UI consumes them. The Settings model exists on both Rust and TS sides; only the frontend store wiring is missing.

### Tauri command naming

§6 lists create_window / destroy_window. The actual API is open_note_window / close_note_window / set_note_window_pinned — the spec wording was loose; the implementation has one extra command (set_note_window_pinned).

## Spec sections still aspirational (no code yet)

- §9 Future Considerations — all of these (cloud sync, reminders, markdown export, themes, i18n, macOS/Linux, virtual-desktop pinning) are out of scope and have no code yet.

## Where the implementation lives in the repo

- Rust: src-tauri/src/{lib.rs, models.rs, commands/, windows.rs, tray.rs}
- Frontend: src/{index.tsx, routes/, components/, stores/, lib/, utils/}
- Tests: cargo test covers models.rs defaults + serialization + color lookup + sort order
- No frontend tests in v0.1.0

## Pointers for future readers

- AGENTS.md — coding-agent conventions
- CHANGELOG.md — what was built and what is missing
- README.md — onboarding


