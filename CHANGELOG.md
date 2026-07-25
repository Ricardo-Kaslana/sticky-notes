# Changelog

All notable changes to this project. Dates in YYYY-MM-DD format.

The format is loosely based on [Keep a Changelog](https://keepachangelog.com/), adapted for an unreleased desktop app.

---


## [0.1.6] — 2026-07-25

全量优化 sweep：按 2026-07-25 复查报告修复全部 High / Medium / Low 项。

### Fixed

- **双重 `note-updated` 事件**：后端成为唯一广播源，payload 变为 `{ note, source }`（source = 发起窗口 label 或 `"tray"`），各窗口据此过滤自身回声。前端 `emitNoteUpdated` / `emitNoteDeleted` 删除；浮窗改色不再被主窗口的回声事件回滚。
- **NoteView 保存生命周期重构**：`pendingSave` promise 链串行化所有保存（并发保存不再交叉写盘）；`onCloseRequested` 里 `cancel()` 防抖后 `await saveNow()`，保存失败首次 `preventDefault()` 并提示，再次关闭放弃更改（`saveFailedOnce` 逃生口）；删除流程置 `deleted` 标志阻断后续自动保存。
- **`atomic_write` 唯一临时文件名**（`.{pid}.{seq}.tmp`，AtomicU64 计数）：主窗口与浮窗并发写同一便签不再共享 tmp 文件导致 rename 交叉。
- **`save_attachment` 防覆盖 + 原子写**：同名文件自动追加 `-1`、`-2`… 后缀（`unique_path`）；两个附件命令改 `#[tauri::command(async)]`，25MB 写盘不再阻塞主线程。
- **托盘退出丢失未保存编辑**：托盘 Quit 与「关闭即退出」路径改走 `close_notes_and_exit` —— 先 `close()` 所有便签窗口（触发各自 JS 保存），轮询等待（上限 5s）后再退出。
- **settings.json 损坏永久卡死设置对话框**：解析失败时改名 `.json.bak` 并回退默认值；设置增加缓存（`AppState.settings`），主窗口每次关闭不再重复读盘。
- **`write_settings` 入参校验**：颜色必须在调色板内（`models::COLOR_KEYS`），自动保存间隔 clamp 到 500ms–1h。
- **搜索重复剥 HTML**：`filterNotes` 增加 `updatedAt` 键控的纯文本缓存，每次击键不再对全部便签重复 DOMParser。
- **NoteCard 右键菜单溢出屏幕**：菜单坐标按视口 clamp。
- **Sidebar 防抖搜索卸载后触发**：`onCleanup` 中 `cancel()`。

### Added

- **identifier 改为 `com.dawnwang.stickynotes`**（原裸 `sticky-notes`），并带一次性数据迁移：启动时（建窗前）把旧 app-data 目录的 `notes/` / `attachments/` / `settings.json` 移到新目录，同时重写便签 JSON 里指向旧目录的 `asset.localhost` 图片 URL（URL-encoded 与 JSON-escaped 两种形态）。
- **`launchOnStartup` 真正生效**：接入 `tauri-plugin-autostart`，设置对话框新增「开机自动启动」勾选；启动时与 `write_settings` 时均同步 OS 自启动项。
- **文件日志**：接入 `tauri-plugin-log`（Stdout + LogDir 双目标，Info 级），全部 `eprintln!` 换成 `log::warn!` / `log::error!`。
- **`settings-changed` 事件**：`write_settings` 广播新设置，已打开的浮窗即时应用新的自动保存间隔（`debounce` 支持延迟取值函数）。
- **托盘 New note 尊重默认颜色**，坐标复用 `NotePosition::default()`（删除 tray.rs 手工镜像常量）。
- **图片插入失败提示**：粘贴/拖拽/工具栏三条路径失败时浮窗顶部显示琥珀色横幅（5s 自动消失），不再静默丢弃。

### Changed

- **capabilities 收敛**：删除未用的 `tauri-plugin-shell`（Cargo.toml、lib.rs、package.json、capabilities 全链路移除），新增 `core:window:allow-destroy`（JS 侧 `onCloseRequested` 流程需要）。
- **MainView 增量更新**：`note-updated` / `note-deleted` 直接用事件 payload 打补丁（`reconcile` keyed diff），不再整表 `loadNotes()`；新建便签同样不再全量刷新。
- **`TAURI_DEBUG` → `TAURI_ENV_DEBUG`**（Tauri 2 改名后 vite.config.ts 的判定一直落空）。
- **杂项清理**：`index.html` 错误覆盖层挂载后只写 console；`vite-env.d.ts` 补 `__NOTE_ID__` / `__MAIN_WINDOW__` / `__APP_MOUNTED__` 类型（去掉 `as any`）；`get_note_id` 改 `strip_prefix` 并删调试日志；托盘分隔符改 `PredefinedMenuItem::separator`；`AppState.is_exiting` 改 `AtomicBool`；`NoteCard` 标签渲染改 `<For>`；Sidebar 置顶计数 memo 化；删除 `notesStore.saveNote` 死代码；chrono 关默认特性只留 `clock`。

### Tests

- Rust 12/12；前端 32/32；`tsc --noEmit`、`cargo check` 干净。

## [0.1.5] — 2026-07-25

全面加固与体验升级 sweep（六个批次：安全 → 数据丢失 → 稳定性 → 性能 → 设置 UI → UX）。

### Security

- **便签 ID 校验**：新增共享 `validate_id()`（≤64 字符，仅字母数字与 `-`），`read_note` / `write_note` / `delete_note` / 附件目录解析 / `open_note_window` 全部套用。堵住路径穿越与 `eval` 脚本注入两条攻击面。
- **`write_note` ID 一致性检查**：请求参数 `id` 与 body 中 `note.id` 不一致时拒绝写入。
- **`safe_filename` 强化**：额外拒绝 `:`、控制字符、结尾点/空格、超 128 字符及 Windows 保留设备名（CON/PRN/AUX/NUL/COM1-9/LPT1-9）。
- **CSP 收紧**：`tauri.conf.json` 由 `null` 改为显式白名单（`script-src 'self'`、`img-src` 仅 asset 协议/blob/data、`connect-src` 仅 IPC）。
- **移除未使用的 `shell:allow-open` 能力**。
- **`stripHtml` 改用 `DOMParser`** 替代 innerHTML 赋值，杜绝解析期资源加载。

### Fixed

- **原子写盘**：`write_note` / `write_settings` 先写 `.tmp` 再 `rename`，崩溃不再产生半截 JSON。
- **删除便签时清理附件目录**（`attachments/<id>` best-effort 删除）。
- **NoteToolbar 永不渲染 bug**：Solid 组件只执行一次，原先 `if (!editor) return null` 是永久性的。改为 `<Show when={props.editor}>` + TipTap `transaction` 事件桥接的 version 信号，工具栏激活态现在实时刷新。
- **标题 / 标签 / 颜色 / 置顶修改不触发自动保存** —— 全部接入 debounce autoSave；关窗前 `cancel()` + `saveNow()` 确保零丢失。
- **NoteCard 改色覆盖浮窗最新内容**：先 `readNote` 取新鲜快照再写回，失败时回滚本地乐观更新。
- **MainView 事件监听同步注册**：`onCleanup` 在 `await` 前登记，卸载不再泄漏监听器。
- **托盘写便签调用漏 `.await`**（命令异步化后的编译错误）。
- **主视图卡片被多列布局切断**：CSS `columns` 布局下卡片未禁止跨列断开，内容稍长即被切成多段。NoteCard 根元素加 `break-inside-avoid`，间距由 `space-y-4` 改为卡片自带 `mb-4`（`space-y` 在多列下会造成首列间距错乱）。
- **便签窗口拖动区太小**：原先只有头部中间一条细 spacer 可拖动。整个头部横条改为 `data-tauri-drag-region` 并加 `min-h-9`；按钮不受影响（Tauri 仅在 mousedown 目标自身带该属性时启动拖动）。

### Added

- **单实例插件**（`tauri-plugin-single-instance`）：二次启动唤起已有主窗口。
- **设置 UI**：新建 `stores/settingsStore.ts` + `SettingsDialog.tsx`（默认颜色 / 自动保存间隔 / 关闭行为），侧栏「设置」入口。主窗口关闭行为与新便签默认颜色、自动保存间隔均实际生效。
- **`delete_attachment` 重新注册**到 invoke_handler，前端 `invoke.ts` 提供包装。
- **浮窗删除入口**：便签窗口头部新增删除按钮 + ConfirmDialog。
- **新便签级联偏移**：连续新建的便签窗口按 28px 阶梯错开，不再完全重叠。
- **搜索匹配纯文本**：`filterNotes` 先剥 HTML 标签再匹配，`<p>`、`b>` 等标记不再误命中；结果按 `updatedAt` 倒序。
- **颜色选择器点击外部关闭**（NoteCard 内联 picker 增加遮罩层）。

### Changed

- **附件上传走 raw-body IPC**：`save_attachment` 改用 `tauri::ipc::Request` 原始字节 + percent-encoded 头部传参，替代 JSON `number[]`（25MB 图片不再序列化为数组）。
- **`notesStore.loadNotes` 使用 `reconcile(data, { key: "id" })`**，刷新列表按 id diff，不再整表重建 DOM。
- **`debounce` 泛型化 + `flush()` 异步等待**底层函数完成。
- **侧栏搜索输入 200ms 防抖**。
- **启动提速**：`NoteView`（TipTap 编辑器）改为 `lazy()` 按需加载，主窗口首包从 387KB 降到 48KB；主窗口经 `initialization_script` 注入 `__MAIN_WINDOW__` 同步路由，不再等待 `get_note_id` IPC 失败后才渲染。
- **便签窗口打开提速**：非主窗口立即并行预载编辑器 chunk（不再等路由 IPC 返回后才下载）；便签窗口乐观注入 `initialization_script`（`__NOTE_ID__`，eval + IPC 兜底保留）；`readNote` 与 TipTap 初始化并行发起；`lucide-solid` 改为按图标深导入（桶导入在 Vite dev 下会逐个请求约 3500 个图标模块，是 dev 模式内容加载慢的主因）。
- **dev 启动提速**：WebView2 追加 `--no-proxy-server`（系统代理开启时 localhost 加载会被代理解析拖慢数秒）；Vite `server.warmup` 预转换两个窗口的模块图，首次请求命中缓存。所有窗口统一使用 `windows::BROWSER_ARGS` —— WebView2 要求同进程内所有 webview 的浏览器参数一致，参数不一致会导致第二个窗口静默创建失败。
- **Rust release profile**：LTO + `opt-level="s"` + strip，减小产物体积。
- **全部 UI 文案统一中文**（卡片菜单、确认对话框、空状态、侧栏、浮窗工具栏）。

### Tests

- Rust 12/12（新增 `validate_id` / `safe_filename` 强化用例）；前端 32/32（新增 debounce 5 例、filterNotes 剥标签/排序用例）；`tsc --noEmit` 干净。

## [0.1.4] — 2026-07-15

### Added

- **Image paste / drop / insert via toolbar** — three entry points (Ctrl+V, file drag, toolbar button) all funnel through `insertImageFromBlob`. The blob is uploaded via the existing `save_attachment` Rust command and inserted as an inline `<img>` using `convertFileSrc` to map the local path into an `asset://` URL the Tauri webview can load.
- **`pastedFilename(mime, now?)`** — pure helper for collision-resistant image filenames (`pasted-<ISO timestamp>.<ext>`). Extracted so the timestamp logic is unit-testable.
- **`lucide-solid`** dependency for the toolbar image button icon.
- **Tauri `assetProtocol`** enabled, scoped to `$APPDATA/attachments/**` so the webview can only load files written by `save_attachment`, not arbitrary disk paths.

### Tests

- 7 new unit tests for `pastedFilename` (png/jpeg/webp/svg/unknown mime + injected Date + colon replacement).
- 26 frontend tests total, all passing.

## [0.1.3] — 2026-07-15

### Added

- **Vitest harness** for the frontend: `npm test` runs `vitest run --passWithNoTests`, `npm run test:watch` runs in watch mode. Node environment, no DOM, no component testing this round.
- **`filterNotes(notes, opts)`** extracted from `MainView`'s inline `createMemo` into a pure function in `src/lib/filterNotes.ts`. The inline memo now delegates to it.
- **`getAllTags(notes)` signature change**: takes the notes array explicitly instead of reading from the module-level store. Sole caller `Sidebar` passes `notes`.

### Tests

- 11 unit tests for `filterNotes` (empty opts, query title/content/case/HTML-raw matching, tag case-insensitivity + empty tag, pinnedOnly on/off, combined filters, empty result).
- 8 unit tests for `getAllTags` (empty notes, no-tag notes, single tag aggregation, case-insensitive grouping, most-common-casing displayName, tie-breaking by first-encountered, sort order, multi-tag counts).
- 19 tests total, all passing. `tsc --noEmit` clean.

---

## [0.1.2] — 2026-07-15

Cleanup + bugfix sweep driven by the 2026-07-15 codebase review. No new
features; no spec changes. Every fix lands as its own commit and is
independently revertable.

### Fixed

- **退出路径丢失未防抖的编辑**：`debounce()` 新增 `flush()`，`NoteView.onCleanup` 在 webview 销毁前同步 flush 待保存的快照。覆盖托盘 Quit、OS 关闭、关窗后 2 秒内输入丢失这三种场景。
- **`save_attachment` 路径穿越**：`safe_filename()` 拒绝空名、`..`、含路径分隔符的输入，同时给 `delete_attachment` 加同一守卫。25 MB 大小上限防止巨型粘贴占满磁盘。
- **`list_notes` 单文件失败拖垮整个列表**：坏 JSON 现在写入 stderr 警告并跳过，文件留在磁盘上待手动恢复，其它便签正常显示。
- **`scaleFactor()` 返回 0 防御**：`NoteView` 仅当 `sf > 0` 时才写入 `note.position`，避免 NaN/Infinity 污染持久化数据。
- **`MainView` 监听器异步注册泄漏**：把 `onNoteUpdated/onNoteDeleted` 的 `listen()` 包装进 `async onMount`，`unlisten` 句柄先于 `onCleanup` 拿到，监听不再泄漏。

### Changed

- **接上 `ColorPicker`**：`NoteCard` 右键菜单的 "Change color" 不再是 no-op —— 选用现有组件实现乐观更新 + `writeNote` 持久化。
- **`NoteView` 的 `color` 信号收紧为 `<ColorKey>`**，去掉两处 `as Note["color"]` 断言。
- **`NoteToolbar` 按钮运行期 guard**：每个 onClick 通过 `run()` 助手守卫 `editor`，处理 editor 被销毁后的残留点击事件。
- **`getAllTags()` 显示最常见的大小写**：`Sidebar` 现在显示 `{ name, displayName, count }` 中的 `displayName`（出现频次最高的写法），存储仍保留原始大小写，去重仍大小写不敏感。
- **新建便签位置统一**：前端 `DEFAULT_NOTE_POSITION`（100, 100, 300, 240）来自 `lib/types.ts`，`MainView` 与 `tray.rs`（以常量镜像）共用同一组坐标，替代原本三处不一致的硬编码。
- **空状态文案区分**：`MasonryGrid` 通过 `hasAnyNotes` prop 区分"无便签"与"当前过滤无匹配"，搜索/过滤时不再误导用户去新建便签。

### Removed

- `src/App.tsx`（`return null` 占位）
- `src/components/ContextMenu.tsx` 与 `useContextMenu` hook
- `notesStore.getNoteById`（无调用方）
- `windows.rs` 的 `log_path` 调试写入（`fs::write` 覆盖式，每次只留最后一行；`on_page_load` 错误路径的 `eprintln!` 保留为 stderr breadcrumb）
- `lib.rs` 中 `delete_attachment` 的 `invoke_handler!` 注册（前端尚无入口；Rust 函数保留 + `#[allow(dead_code)]`，供即将到来的图片粘贴 UI 使用）

### Tests

- `safe_filename` 4 个新单元测试（正常名、穿越、路径分隔符、空/点）
- 全部 Rust 测试 9/9 通过；`tsc --noEmit` 干净；`cargo check` 无 warning

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

### Known gaps (intentional, as of v0.1.0)

- **`stores/settingsStore.ts` is planned but never created.** `readSettings()` / `writeSettings()` work via `invoke.ts` but no UI consumes them.
- **`src/App.tsx` is a `return null` placeholder.** Routing lives in `src/index.tsx` instead. *Resolved in v0.1.2.*
- **`src/components/ColorPicker.tsx` exists but is not imported anywhere** — the floating window inlines its own color row. *Resolved in v0.1.2.*
- **`NoteCard.tsx` right-click → "Change color" is a no-op.** Color must be changed in the floating window. *Resolved in v0.1.2.*
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

