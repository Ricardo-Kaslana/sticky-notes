# Sticky Notes

A lightweight, high-performance, modern minimalist sticky-notes desktop app for Windows. Built with Tauri 2 + SolidJS + TipTap.

![status](https://img.shields.io/badge/status-v0.1.5-blue)
![platform](https://img.shields.io/badge/platform-Windows-lightgrey)

---

## Features

- **Masonry grid management view** — sidebar search, tag filter (with live counts), pinned-only filter
- **Borderless floating note windows** — drag from anywhere, TipTap rich text, color & tag editing, pin-on-top
- **System tray** — left-click reveals main window; menu has Show / New note / Quit
- **Auto-save** — debounced save on every keystroke (interval configurable in Settings); close the window, reopen, content is there
- **Settings** — default note color, auto-save interval, close-to-tray behavior (sidebar → 设置)
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
│   │   ├── MainView.tsx        / — sidebar + masonry grid
│   │   └── NoteView.tsx        /note/:id — TipTap editor in floating window
│   ├── components/             Sidebar, NoteCard, MasonryGrid, TagInput, ...
│   ├── stores/notesStore.ts    SolidJS store — single source of truth
│   ├── lib/                    types, invoke, events
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
Notes are stored as one JSON file per note in the OS app-data dir:

| OS | Path |
|---|---|
| Windows | `%APPDATA%/sticky-notes/notes/<uuid>.json` |
| macOS | `~/Library/Application Support/sticky-notes/notes/<uuid>.json` |
| Linux | `~/.local/share/sticky-notes/notes/<uuid>.json` |

Settings live next to them as `settings.json`. Attachments are stored under `attachments/<note-uuid>/`.

### Floating window note-ID delivery
Each floating note is its own Tauri webview window. The note ID reaches the frontend through three layered mechanisms (`windows.rs` → `src/index.tsx`): an optimistic `initialization_script` setting `window.__NOTE_ID__`, an `on_page_load` `eval()` of the same, and a `get_note_id` IPC command (reads `window.label()`) as the reliable fallback. The URL itself stays clean (`index.html`).

### Cross-window sync
- An edit in the floating window calls `write_note` (Tauri `invoke`).
- The Rust handler writes the JSON file **and** emits a `note-updated` event.
- The management view's listener (`src/lib/events.ts` → `onNoteUpdated`) re-fetches the note list.
- A delete follows the same pattern with the `note-deleted` event.

### Window state persistence
On every auto-save, the floating window reads `getCurrentWindow().outerPosition()` and `.outerSize()`, divides both by `scaleFactor()`, and stores the result in `note.position`. On reopen, those values are passed to `open_note_window` so the window appears exactly where the user left it.

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
