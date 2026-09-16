# Sticky Notes

A lightweight, high-performance, modern minimalist sticky-notes desktop app for Windows. Built with Tauri 2 + SolidJS + TipTap.

![status](https://img.shields.io/badge/status-v0.1.7-blue)
![platform](https://img.shields.io/badge/platform-Windows-lightgrey)

---

## Features

- **Masonry grid management view** — sidebar search, tag filter (with live counts), pinned-only filter
- **Sorting** — by modified time, created time, or title, ascending or descending; the choice is remembered across restarts
- **Timestamps on every note** — creation and modification time, shown on both the grid card and the floating window. There is no "last accessed" notion anywhere in the app
- **Borderless floating note windows** — drag from anywhere, TipTap rich text, color & tag editing, pin-on-top
- **Zoom and resize** — `− 100% +` in the title bar, `Ctrl` `+` / `-` / `0`, or `Ctrl`+scroll scales the content; drag any edge or corner to resize the window
- **Layered editor** — the floating window separates toolbar, body text, and tags into three labelled panels
- **System tray** — left-click reveals main window; menu has Show / New note / Quit
- **Auto-save** — debounced save on every keystroke (interval configurable in Settings); close the window, reopen, content is there
- **Settings** — default note color, auto-save interval, close-to-tray behavior (sidebar → 设置); sort order and zoom persist in the same file
- **Cross-window sync** — edits in a floating window refresh the management view instantly
- **Six pastel colors** — `paper` / `blush` / `sky` / `sage` / `apricot` / `lavender`, set per-note
- **Image paste / drop / insert via toolbar** — Ctrl+V, drag a file, or use the toolbar image button. Saved to `attachments/<uuid>/` and rendered as an inline `<img>` via `asset://`.
- **Plain-JSON persistence** — one file per note in the OS app-data dir, easy to back up, sync, or version

---

## Tech stack

| Layer | Choice |
|---|---|
| Desktop shell | Tauri 2.x |
| Frontend framework | SolidJS 1.x |
| Rich text editor | TipTap 2.x (ProseMirror) |
| Styling | Tailwind CSS 4 |
| Language | TypeScript (frontend) + Rust (backend) |

---

## Prerequisites

- **Node.js** ≥ 18
- **Rust** stable toolchain (install via [rustup.rs](https://rustup.rs))
- **Windows 10 / 11** — Tauri 2 platform requirement. macOS and Linux are untested.

---

## Quick start

```sh
npm install
npm run tauri dev          # full app with Tauri shell + hot reload
```

The Vite dev server runs on `http://localhost:1420`. Frontend edits hot-reload instantly; Rust edits trigger a rebuild.

To work on the frontend without the Tauri shell:

```sh
npm run dev                # Vite only — note CRUD will fail (no Rust backend)
```

---

## Build a release binary

```sh
npm run tauri build
```

The installer / standalone `.exe` lands in `src-tauri/target/release/bundle/`.

---

## Project layout

```
sticky-notes/
├── src-tauri/                  Rust backend
│   ├── src/
│   │   ├── lib.rs              Tauri builder, command registry, main window + tray
│   │   ├── models.rs           Note, NotePosition, Settings, color palette
│   │   ├── commands/
│   │   │   ├── notes.rs        list / read / write / delete
│   │   │   ├── attachments.rs  save / delete attachments
│   │   │   └── settings.rs     read / write settings.json
│   │   ├── windows.rs          Floating window spawn
│   │   └── tray.rs             System tray menu + click handlers
│   └── tauri.conf.json         Tauri config (window, bundle, identifier)
│
├── src/                        SolidJS frontend
│   ├── index.tsx               Entry + manual Switch/Match routing
│   ├── routes/
│   │   ├── MainView.tsx        / — sidebar + sort bar + masonry grid
│   │   └── NoteView.tsx        /note/:id — TipTap editor in floating window
│   ├── components/             Sidebar, SortBar, NoteCard, MasonryGrid, TagInput, ...
│   ├── stores/notesStore.ts    SolidJS store — single source of truth
│   ├── stores/settingsStore.ts Settings signal + normalisation of disk values
│   ├── lib/                    types, invoke, events, filterNotes, sortNotes, formatTime, zoom
│   └── utils/debounce.ts
│
├── docs/archive/               Historical design specs + plans (reference only)
│   ├── superpowers/specs/      Approved design specs
│   ├── superpowers/plans/      Task-by-task implementation plans
│   └── agents/                 Upstream skill-pack conventions
│
├── AGENTS.md                   AI agent conventions (Codex, Claude Code, ...)
├── README.md                   This file
└── CHANGELOG.md                Release notes, gaps, fixes
```

---

## How it works

### Persistence
Notes are stored as one JSON file per note in the OS app-data dir, under the app identifier `com.dawnwang.stickynotes`:

| OS | Path |
|---|---|
| Windows | `%APPDATA%\com.dawnwang.stickynotes\notes\<uuid>.json` |
| macOS | `~/Library/Application Support/com.dawnwang.stickynotes/notes/<uuid>.json` |
| Linux | `~/.local/share/com.dawnwang.stickynotes/notes/<uuid>.json` |

Settings live next to them as `settings.json`. Attachments are stored under `attachments/<note-uuid>/`.

Only the Windows path is actually exercised — the other two follow from Tauri's app-data convention on platforms this project has never run on.

Notes written before v0.1.6 sit in a sibling `sticky-notes` directory (the old bare identifier). `lib.rs::migrate_legacy_app_data` moves them — and rewrites the absolute attachment URLs embedded in each note JSON — on the first launch after the identifier change.

### Floating window note-ID delivery
Each floating note is its own Tauri webview window. The note ID reaches the frontend through three layered mechanisms (`windows.rs` → `src/index.tsx`): an optimistic `initialization_script` setting `window.__NOTE_ID__`, an `on_page_load` `eval()` of the same, and a `get_note_id` IPC command (reads `window.label()`) as the reliable fallback. The URL itself stays clean (`index.html`).

### Cross-window sync
- An edit in the floating window calls `write_note` (Tauri `invoke`).
- The Rust handler writes the JSON file **and** emits a `note-updated` event.
- The management view's listener (`src/lib/events.ts` → `onNoteUpdated`) re-fetches the note list.
- A delete follows the same pattern with the `note-deleted` event.

### Window state persistence
On every auto-save, the floating window reads `getCurrentWindow().outerPosition()` and `.outerSize()`, divides both by `scaleFactor()`, and stores the result in `note.position`. On reopen, those values are passed to `open_note_window` so the window appears exactly where the user left it.

### Sorting and timestamps
Ordering is decided in exactly one place — `src/lib/sortNotes.ts` — and applied after filtering. Notes carry only `createdAt` and `updatedAt`: there is no access-time field and no sort key that depends on opening a note, so the grid never reorders itself as a side effect of reading. The sort key and direction are stored in `settings.json` alongside the other preferences. Title sorting uses a `zh-Hans-CN` collator (pinyin order, natural number order, case-insensitive) and always sinks untitled notes to the bottom.

### Note zoom
Zoom scales the document root font size instead of applying a CSS transform, so every rem-based Tailwind utility — text, padding, icons — grows together and layout still reflows normally. That is why sizes inside the note window are written in rem, including icon sizes: lucide's `size` prop emits px `width`/`height` attributes and would silently ignore the zoom. Window resizing is a separate gesture — `ResizeHandles` hands the drag to the OS via `startResizeDragging`, which is what keeps native snapping on a borderless window.

### Main window → tray
By default, closing the main window calls `prevent_close()` + `hide()` in `lib.rs` — the app stays alive in the tray with floating note windows intact, and only the tray's **Quit** menu item calls `app.exit(0)`. Turning off "close to tray" in Settings makes the close button quit the app instead.

---

## Documentation

- **[CHANGELOG.md](CHANGELOG.md)** — release notes, known gaps, integration fixes
- **[AGENTS.md](AGENTS.md)** — conventions for AI coding agents
- **[docs/archive/](docs/archive/README.md)** — archived design specs and implementation plans, indexed by date and scope. Historical reference only; the code and CHANGELOG.md are authoritative.

---

## License

TBD.
