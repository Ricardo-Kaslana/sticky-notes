# Changelog

All notable changes to this project. Dates in YYYY-MM-DD format.

The format is loosely based on [Keep a Changelog](https://keepachangelog.com/), adapted for an unreleased desktop app.

---

## [0.1.0] — 2026-06-06

First working desktop build. All 18 implementation tasks committed; core flow (create → edit → save → close → reopen) verified manually on Windows.

### Added

#### Backend (Rust + Tauri 2)
- `Note`, `NotePosition`, `Settings` models in `src-tauri/src/models.rs`, serialized as camelCase JSON
- Six-color pastel palette (`paper` / `blush` / `sky` / `sage` / `apricot` / `lavender`)
- Tauri commands:
  - `list_notes`, `read_note`, `write_note`, `delete_note`
  - `save_attachment`, `delete_attachment`
  - `read_settings`, `write_settings`
  - `open_note_window`, `close_note_window`, `set_note_window_pinned`
- Floating window manager — borderless Tauri windows positioned per-note, with `initialization_script`-based note ID injection (`window.__NOTE_ID__`)
- System tray — left-click reveals main window; menu has **Show** / **New note** / **Quit**
- Main window Close → `prevent_close()` + `hide()` (app stays alive in tray)

#### Frontend (SolidJS + TipTap)
- Manual `Switch/Match` routing in `src/index.tsx` (no `@solidjs/router`)
- `MainView` (`/`) — sidebar with search / tag filter (live counts) / pinned filter + masonry grid
- `NoteView` (`/note/:id`) — TipTap editor in floating window
- TipTap extensions: StarterKit, Underline, Link, Image, Placeholder
- Toolbar: bold / italic / underline / strike / bullet list / ordered list
- Tag autocomplete from existing tags; case-insensitive dedup; backspace removes the last tag
- Six-color row inside the floating window; colored left border on both card and window
- Pin toggle (dot button) — calls `set_note_window_pinned`
- Right-click context menu on cards (Pop out / Change color [no-op] / Delete)
- ConfirmDialog for destructive actions
- Cross-window sync via Tauri events (`note-updated`, `note-deleted`)

#### Persistence & runtime
- One JSON file per note in the OS app-data dir
- 2-second debounced auto-save on every keystroke
- Window position + size captured at save time (`outerPosition` / `outerSize` ÷ `scaleFactor`)
- `index.html` runtime safety net: `window.onerror`, resource-load errors, `unhandledrejection`, 20-second mount timeout. Broken bundle shows an in-DOM error panel instead of a blank window.

### Known gaps (intentional)

- **`stores/settingsStore.ts` is planned but never created.** `readSettings()` / `writeSettings()` work via `invoke.ts` but no UI consumes them.
- **`src/App.tsx` is a `return null` placeholder.** Routing lives in `src/index.tsx` instead.
- **`src/components/ColorPicker.tsx` exists but is not imported anywhere** — the floating window inlines its own color row.
- **`NoteCard.tsx` right-click → "Change color" is a no-op.** Color must be changed in the floating window.
- **Image paste/drag-drop is configured in TipTap but has no UI button or paste handler exposed.**
- **`tailwind.config.ts` is referenced in the original plan but does not exist** — Tailwind v4 with `@tailwindcss/vite` does not need one.

### Fixed during integration (post-Task-18)

| Commit | Fix |
|---|---|
| `768699a` | Replace `@solidjs/router` with manual `Switch/Match` routing — router API mismatched SolidJS 1.9 + Tauri WebView |
| `e14bef7` | Replace `solid-tiptap` with direct `@tiptap/core` `Editor` creation in `onMount` |
| `4c6c278` | Add console logs, in-DOM error display, catch-all route, inline routes in `index.tsx` for debugging |
| `c70a459` | Replace `@solidjs/router` with manual pathname-based routing (Tauri WebView compat) |
| `50af25e` | Use `?noteId=` query parameter instead of path routing |
| `80ede17` | Add runtime error display in `index.html` + full-height CSS chain |
| `59143df` | Switch note-ID delivery to Tauri `initialization_script`; tidy `NoteView` (extract `buildNoteUpdate`, restore StarterKit defaults, drop debug logs) |

### Verification

The implementation plan's verification checklist has been marked up — see [docs/superpowers/plans/2026-06-06-sticky-notes.md](./docs/superpowers/plans/2026-06-06-sticky-notes.md). All 16 items pass except where noted in "Known gaps" above.
