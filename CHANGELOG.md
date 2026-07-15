# Changelog

All notable changes to this project. Dates in YYYY-MM-DD format.

The format is loosely based on [Keep a Changelog](https://keepachangelog.com/), adapted for an unreleased desktop app.

---

## [0.1.1] — 2026-07-15

### Fixed

- **窗口路由错误（主窗口变成便签视图）**：`initialization_script` 在 Tauri 2 二级窗口中静默失败。改用 `on_page_load` + `eval()` 注入 `__NOTE_ID__`，并以 `get_note_id` IPC 命令（读取 `window.label()`）作为前端唯一路由机制。移除了会导致主窗口路被错误覆盖的 `"note-id"` 事件回退监听器。
- **便签窗口无法拖拽**：两个原因 —
  1. `capabilities/default.json` 缺少 `core:window:allow-start-dragging` 权限，`data-tauri-drag-region` 底层调用被拒绝；
  2. 调试用的 canary `<div>`（`position:fixed; z-index:99999`）覆盖了窗口顶部拖拽区域，拦截了所有鼠标事件。
- **托盘 Quit 被阻止**：添加 `AppState.is_exiting` 标志，托盘 Quit 时先设置该标志，`on_window_event` 检测到后不再 `prevent_close()`，允许应用正常退出。
- **托盘创建便签时主线程死锁**：`new_note` 菜单事件改为通过 `tauri::async_runtime::spawn` 异步执行，避免在 tao 主线程同步调用 `WebviewWindowBuilder::build()` 导致的死锁。

### Changed

- **移除调试条**：删除 `index.html` 中的 canary `<div>` 及 `index.tsx`、`NoteView.tsx` 中所有 `canary()` 调用。
- **拖拽区域**：`data-tauri-drag-region` 从外层 `<div>` 移回头部 `<div>`，利用 `justify-between` 在按钮之间留出的空白区域作为拖拽手柄。
- **MainView 新增错误提示**：创建便签失败时在顶部显示红色错误横幅。

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

### Fixed during build verification (post-release-build, 2026-07-14)

- Removed dead-code Rust palette (`pub const COLORS` and `pub fn get_color_hex` in `src-tauri/src/models.rs`). The Rust palette was unused (no `commands/*.rs` referenced it) and was incomplete relative to the frontend (missing the `name` field that the UI needs). `src/lib/types.ts` `COLORS` + `getColorHex` is now the single source of truth. Two tests that only exercised the dead function were removed; the four remaining tests cover `Note` defaults / serialization / camelCase and `Settings` defaults. Build now finishes with zero warnings.

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
| (uncommitted) | Fix tray "Quit" being blocked by `prevent_close` on main window — added `AppState.is_exiting` flag, flipped by tray before `app.exit(0)` so the main window actually closes when the user picks Quit. Close button on the main window still hides to tray as before. |
| (uncommitted) | Fix main-thread deadlock when creating a sticky-note window AND fix "two stacked windows" symptom when opening a note. Tray menu `new_note` and the frontend's `open_note_window` command now dispatch window creation through `tauri::async_runtime::spawn` instead of running it on the tao main thread synchronously — `WebviewWindowBuilder::build()` no longer deadlocks against itself, so tray "Quit" stays responsive and the IPC bus stays free. `create_note_window` defers `eval` / `show` / `set_focus` to the builder's `on_page_load` callback (Tauri's own webview-ready signal) instead of a 150ms blind sleep, and the previous intermediate fix that left `WebviewWindowBuilder::build()` called twice in a row — which is what produced the "two stacked windows" the user reported — has been collapsed back to a single call. The `open_note_window` command also short-circuits at entry if a window with the same label already exists. |

### Verification

The implementation plan's verification checklist has been marked up — see [docs/superpowers/plans/2026-06-06-sticky-notes.md](./docs/superpowers/plans/2026-06-06-sticky-notes.md). All 16 items pass except where noted in "Known gaps" above.
