# Sticky Notes

A lightweight, high-performance, modern minimalist sticky-notes desktop app for Windows. Built with Tauri 2 + SolidJS + TipTap.

![status](https://img.shields.io/badge/status-v0.1.0-blue)
![platform](https://img.shields.io/badge/platform-Windows-lightgrey)

---

## Features

- **Masonry grid management view** — sidebar search, tag filter (with live counts), pinned-only filter
- **Borderless floating note windows** — drag from anywhere, TipTap rich text, color & tag editing, pin-on-top
- **System tray** — left-click reveals main window; menu has Show / New note / Quit
- **Auto-save** — 2-second debounced save on every keystroke; close the window, reopen, content is there
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
├── docs/
│   ├── superpowers/            Design spec + implementation plan
│   └── agents/                 Upstream skill-pack conventions (reference only)
│
├── AGENTS.md                   AI agent conventions (Codex, Claude Code, ...)
├── CLAUDE.md                   Claude Code pointer — see AGENTS.md
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
Each floating note is its own Tauri webview window. The note ID is injected via Tauri `initialization_script` — `windows.rs` sets `window.__NOTE_ID__` on the new webview before any frontend code runs. The frontend reads it (`src/index.tsx`) and falls back to a `?noteId=` query param only for Vite dev. The URL itself stays clean (`index.html`).

### Cross-window sync
- An edit in the floating window calls `write_note` (Tauri `invoke`).
- The Rust handler writes the JSON file **and** emits a `note-updated` event.
- The management view's listener (`src/lib/events.ts` → `onNoteUpdated`) re-fetches the note list.
- A delete follows the same pattern with the `note-deleted` event.

### Window state persistence
On every auto-save, the floating window reads `getCurrentWindow().outerPosition()` and `.outerSize()`, divides both by `scaleFactor()`, and stores the result in `note.position`. On reopen, those values are passed to `open_note_window` so the window appears exactly where the user left it.

### Main window → tray
Closing the main window calls `prevent_close()` + `hide()` in `lib.rs`. The app stays alive in the tray with floating note windows intact. Only the tray's **Quit** menu item calls `app.exit(0)`.

---

## Documentation

- **[Design spec](docs/superpowers/specs/2026-06-06-sticky-notes-design.md)** — v1 design (approved 2026-06-06)
- **[Implementation plan](docs/superpowers/plans/2026-06-06-sticky-notes.md)** — 18-task build plan + verification checklist
- **[CHANGELOG.md](CHANGELOG.md)** — release notes, known gaps, integration fixes
- **[AGENTS.md](AGENTS.md)** — conventions for AI coding agents
- **[CLAUDE.md](CLAUDE.md)** — Claude Code entry point (points to AGENTS.md)

---

## License

TBD.
