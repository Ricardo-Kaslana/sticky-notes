# AGENTS.md

Project conventions for AI coding agents (Codex, Claude Code, etc.) working on **Sticky Notes**.

For Claude Code sessions, see [CLAUDE.md](./CLAUDE.md) — it points back here.

---

## What this project is

A lightweight desktop sticky-notes app for Windows.

- **Shell**: Tauri 2.x (Rust + system webview)
- **Frontend**: SolidJS 1.x, TipTap 2.x, Tailwind CSS 4, TypeScript
- **Persistence**: one JSON file per note in the OS app-data dir
- **Distribution target**: Windows desktop (macOS/Linux not yet tested)

Read [README.md](./README.md) for the onboarding tour and [docs/superpowers/specs/2026-06-06-sticky-notes-design.md](./docs/superpowers/specs/2026-06-06-sticky-notes-design.md) for the v1 design.

---

## Quick commands

| Goal | Command |
|---|---|
| Dev (Tauri shell + hot reload) | `npm run tauri dev` |
| Frontend only (Vite on :1420) | `npm run dev` |
| Type check | `npx tsc --noEmit` |
| Rust check | `cd src-tauri && cargo check` |
| Rust tests | `cd src-tauri && cargo test` |
| Release build | `npm run tauri build` |

---

## Where things live

### Backend (Rust — `src-tauri/src/`)
| File | Responsibility |
|---|---|
| `lib.rs` | Tauri builder, command registration, main window + tray setup |
| `models.rs` | `Note`, `NotePosition`, `Settings`, color palette (serde + camelCase) |
| `commands/notes.rs` | `list_notes` / `read_note` / `write_note` / `delete_note`; emits `note-updated` / `note-deleted` |
| `commands/attachments.rs` | `save_attachment` / `delete_attachment` |
| `commands/settings.rs` | `read_settings` / `write_settings` |
| `windows.rs` | Floating window spawn (`open_note_window`, `close_note_window`, `set_note_window_pinned`) |
| `tray.rs` | System tray menu + click handlers |

### Frontend (SolidJS — `src/`)
| File | Responsibility |
|---|---|
| `index.tsx` | App entry + manual `Switch/Match` routing (no `@solidjs/router`) |
| `App.tsx` | **Placeholder (`return null`)** — routing is in `index.tsx` instead |
| `routes/MainView.tsx` | `/` route — sidebar + masonry grid |
| `routes/NoteView.tsx` | `/note/:id` route — TipTap editor in floating window |
| `stores/notesStore.ts` | Single source of truth for the note list |
| `lib/types.ts` | TS mirrors of Rust models — **must stay in sync with `models.rs`** |
| `lib/invoke.ts` | Typed Tauri `invoke()` wrappers — **all invoke calls go through here** |
| `lib/events.ts` | `onNoteUpdated` / `onNoteDeleted` / `emitNoteUpdated` / `emitNoteDeleted` — **all event calls go through here** |
| `components/` | Sidebar, NoteCard, MasonryGrid, TagInput, ColorPicker, NoteToolbar, ConfirmDialog, ContextMenu |

---

## Hard rules (violating any of these breaks the build or the UX)

1. **No `@solidjs/router`.** Routing is a manual `Switch/Match` in `src/index.tsx`. Do not add router dependencies — they do not play well with Tauri WebView (see commit `c70a459`).
2. **Note ID delivery uses `initialization_script`, not URL query params.** `src-tauri/src/windows.rs` injects `window.__NOTE_ID__`; `src/index.tsx` reads it first and falls back to `?noteId=` only for Vite dev. Do **not** revert to query-param routing — the Tauri WebView URL handling was unreliable.
3. **All Tauri invoke calls go through `src/lib/invoke.ts`.** Components must not import `@tauri-apps/api/core` directly.
4. **All cross-window event calls go through `src/lib/events.ts`.** No raw `listen` / `emit`.
5. **Notes persist as one JSON file per note** in `app_data_dir()/notes/<uuid>.json`. Do not introduce a database, SQLite, or a single notes file.
6. **Window position capture** (`NoteView.tsx`) uses `outerPosition` / `outerSize` divided by `scaleFactor()`. Cache the scale factor once per save — do not `await win.scaleFactor()` four times.
7. **Tailwind v4 only**, via `@tailwindcss/vite`. No `tailwind.config.ts`, no PostCSS config, no other CSS frameworks.
8. **Camel-case JSON on the wire.** Rust models use `#[serde(rename_all = "camelCase")]`; TS types in `lib/types.ts` mirror the camelCase shape. If you rename a Rust field, update both.

---

## Gotchas that bit us already

- **`src/index.tsx` must set `window.__APP_MOUNTED__ = true` after mount.** `index.html` runs a 20-second timeout that warns the user if the bundle never mounts. Keep both sides.
- **`index.html` keeps an aggressive runtime-error display** (`window.onerror`, `unhandledrejection`, resource-load failures, 20-second mount timeout). This is the only safety net for a broken bundle in production — **do not remove**.
- **SolidJS `<For>` is the right iteration primitive** for the note grid; using `notes.map(...)` in JSX will not re-render on store updates.
- **`createEffect` runs once on mount and re-runs on every signal read inside it.** Do not put `loadNotes()` calls inside a `createEffect` that also subscribes to events unless you want an infinite refresh loop — `MainView` already gets this right.

---

## Known gaps (do not silently "fix")

These are tracked in [CHANGELOG.md](./CHANGELOG.md) — the entries marked *(v0.1.2)* are resolved, the rest remain open:

- `stores/settingsStore.ts` is **planned but never created**. `readSettings()` / `writeSettings()` work via `invoke.ts` but no UI consumes them.
- `src/App.tsx` is **deleted** (v0.1.2). Routing lives in `src/index.tsx`. No consolidation planned for v0.2.
- `src/components/ColorPicker.tsx` is **wired up** in `NoteCard` right-click "Change color" menu (v0.1.2).
- `NoteCard.tsx` right-click "Change color" **works** (v0.1.2). The floating window still has its own color row.
- `tailwind.config.ts` is referenced in the original plan but **does not exist** — Tailwind v4 with `@tailwindcss/vite` doesn't need one.
- Image paste/drag-drop is configured in TipTap (`Image.configure({ inline: true })`) but has **no UI button or paste handler** exposed.

If you change any of these, update both code and CHANGELOG.md.

---

## Documentation pointers

| Doc | Purpose | Status |
|---|---|---|
| [README.md](./README.md) | Onboarding, quick start, project layout | Current |
| [CHANGELOG.md](./CHANGELOG.md) | Release notes, gaps, fixes per version | Current |
| [docs/superpowers/specs/2026-06-06-sticky-notes-design.md](./docs/superpowers/specs/2026-06-06-sticky-notes-design.md) | v1 design spec (approved 2026-06-06) | Approved; see "Implementation Status" addendum at the bottom |
| [docs/superpowers/plans/2026-06-06-sticky-notes.md](./docs/superpowers/plans/2026-06-06-sticky-notes.md) | 18-task implementation plan + verification checklist | Tasks 1–18 committed; checklist marked-up reflects actual state |
| [docs/agents/issue-tracker.md](./docs/agents/issue-tracker.md) | `.scratch/<feature>/PRD.md` convention | **Not currently used by this project** — kept for reference |
| [docs/agents/triage-labels.md](./docs/agents/triage-labels.md) | Five triage roles for the issue tracker | **Not currently used by this project** — kept for reference |
| [docs/agents/domain.md](./docs/agents/domain.md) | `CONTEXT.md` + `docs/adr/` convention | **Not currently used by this project** — kept for reference |

---

## What does NOT belong in this file

- **Change history** ("on 2026-06-07 we did X") — that goes in CHANGELOG.md or git log.
- **Detailed mechanical patterns** that the code makes obvious in one read.
- **One-off debugging wisdom** — the commit message is a better home.

If a future AI session is about to make the same mistake twice, write it here. Otherwise, don't.

