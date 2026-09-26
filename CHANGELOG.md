# Changelog

本项目所有值得记录的变更。

日期格式 `YYYY-MM-DD`。分类沿用 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)：**新增** / **变更** / **修复** / **移除** / **安全** / **性能** / **测试**。同一版本内按此顺序排列，没有内容的分类省略。

版本号声明在 `package.json`、`src-tauri/Cargo.toml`、`src-tauri/tauri.conf.json` 三处，需手动同步（连带 `package-lock.json` 与 `src-tauri/Cargo.lock` 里的同名条目）。版本里程碑用 `vX.Y.Z` 注释 tag 标记（首个是 `v0.1.7`）；仓库没有远端，因此不提供版本间 diff 链接。

---

## [未发布] — 2026-09-17

排序、时间显示、便签缩放，以及编辑界面的分区重构。版本号尚未提升（仍在 0.1.7 之后）。

### 新增

- **便签排序**（`components/SortBar.tsx` + `lib/sortNotes.ts`）—— 主视图网格上方新增排序栏：
  - 排序键三选一：**修改时间 / 创建时间 / 标题**；方向按钮在**升序 / 降序**之间切换（升序 A→Z / 旧→新）。
  - 排序偏好写入 `settings.json`（`sortBy` / `sortDir`），重启后保持。
  - 标题排序使用 `Intl.Collator("zh-Hans-CN", { numeric: true, sensitivity: "base" })`：中文按拼音（北京 → 广州 → 上海）、`便签 2` 排在 `便签 10` 前、大小写与变音不敏感。CLDR 的 zh 排序把汉字整体排在拉丁字母之前，这是有意保留的行为。
  - **空标题恒定沉底**，与升/降序无关 —— 否则升序会以一片「无标题」开头，把真正的标题埋掉。
  - 同键用 `id` 做稳定 tiebreak，输出与输入数组顺序无关（`list_notes` 返回的是 OS 目录序，本身没有意义）。
  - 排序栏同时显示「共 N 条便签 · 显示 M 条」，筛选生效时能看出被过滤掉多少。
- **便签显示创建时间与修改时间**（`lib/formatTime.ts`）—— `NoteCard` 底部时间行（`创建 2026-09-17 00:34` / `修改 2026-09-17 00:41`），便签浮窗标题下方一行同款信息。时间用本地时区 `YYYY-MM-DD HH:mm`；无法解析的值渲染为空而不是 `Invalid Date`。
- **便签浮窗缩放**（`lib/zoom.ts` + `components/ZoomControl.tsx`）—— 标题栏右侧 `− 100% +` 控件、`Ctrl+=` / `Ctrl+-` / `Ctrl+0` 快捷键、`Ctrl+滚轮` 连续缩放，范围 75%–200%（离散档位 75/85/100/115/130/150/175/200）。
  - 实现方式是改 `document.documentElement.style.fontSize`，所有 rem 系的 Tailwind 工具类随之等比缩放 —— 文字、内边距、图标一起变大，而不是文字撑破固定尺寸的盒子。
  - 配套把便签浮窗内所有 px 尺寸改成 rem：lucide 图标从 `size={N}`（会输出 px 的 `width`/`height` 属性，不随缩放变化）改成 rem class（`w-4 h-4`、`w-[0.5625rem]`），`index.css` 里 `.note-window` 的 `min-height` / `padding-left` / `margin` 由 px 改 rem。主窗口不做缩放，保持 `size={N}` 不变。
  - 比例存 `settings.noteZoom`，经 `settings-changed` 广播，所有便签浮窗同步；落盘做 400ms 防抖，避免滚轮手势触发几十次写盘 + 广播。
- **便签浮窗八向拖拽缩放**（`components/ResizeHandles.tsx`）—— 窗口是 `decorations(false)`，Windows 的原生缩放边框是看不见的几个像素，用户找不到。现在四边 + 四角都有热区（右下角带可见的斜纹抓手），通过 `startResizeDragging` 把拖拽交给系统，保留贴边吸附等原生行为。新增权限 `core:window:allow-start-resize-dragging`。
- `Settings` 新增三个字段：`sortBy` / `sortDir` / `noteZoom`。

### 变更

- **便签浮窗编辑界面重构为三块独立面板**（`routes/NoteView.tsx`）—— 工具栏、正文、标签各自成块，每块带浅色底 + 1px 描边 + 圆角：
  - 工具栏从「贴在正文上方的一排按钮」变成明确的 chrome 面板；正文区改为纸白色（`bg-white/65`）内嵌面板，是唯一会伸缩的区域，也是唯一明显「可以在这里打字」的区域；标签区再次独立成块，标签不会再被误读成正文。
  - 面板不带文字标题条 —— 早期实现每块顶部有「格式 / 内容 / 标签」小标题，但浮窗纵向空间紧张，三条标题吃掉约 60px 可书写高度，已移除。
  - 标题与时间行独立于三块面板之外，层级清晰。
  - 所有区块统一 12px 边距（原来标题区 16px、面板 12px 混用）。
- **`filterNotes` 不再自己排序**，委托给 `sortNotes`。`FilterOpts` 的 `sortBy` / `sortDir` 可选，缺省 `updatedAt` / `desc` —— 不传时的结果与改动前一致。
- **新建便签默认窗口尺寸 300×240 → 340×320** —— 新增的分区面板与标题条吃掉了纵向空间，240px 高的窗口里正文只剩几十像素。`lib/types.ts` 的 `DEFAULT_NOTE_POSITION` 与 `models.rs` 的 `NotePosition::default()` 两处同步（Rust 侧新增用例锁住数值）。
- **`settingsStore` 增加 `normalizeSettings` / `applySettings` / `patchSettingsLocal`** —— 排序切换和缩放必须同帧反馈，`saveSettings` 改为先更新内存信号再落盘；`normalizeSettings` 把磁盘上的缺字段 / 脏数据收敛成可用值，保证不会出现「无法排序」或「0% 缩放」。
- **`MainView` 现在也监听 `settings-changed`** —— 浮窗写缩放后会广播，主窗口若仍持陈旧快照，下次切换排序就会把 `noteZoom` 回写旧值。`NoteView` 的同一个监听也从「只读 `autoSaveIntervalMs`」改为 `applySettings`，理由相同。
- **`Settings` 的三个新字段都带 `#[serde(default = "...")]`** —— `load_settings` 把解析失败当损坏处理（改名 `.json.bak` + 回落默认值），旧版 `settings.json` 缺这三个键必须仍能解析，否则用户会静默丢掉全部设置。

### 修复

- **重开已钉住的便签浮窗不恢复置顶** —— `create_note_window` 建窗时不读便签数据，`set_always_on_top` 只在用户点击钉住按钮时调用；钉住 → 关窗 → 重开后 UI 显示已钉住但窗口实际不置顶。现在 `NoteView` 加载便签后，若 `pinned` 为 true 会补调一次 `set_note_window_pinned`。

### 移除

- **明确不做「访问时间」相关的任何功能** —— 不新增 `accessedAt` / `lastOpenedAt` / 访问计数，不提供按访问时间排序，也不显示访问时间。便签只有创建时间与修改时间两个时间戳；按访问时间排序会让网格仅仅因为「被打开看过」就自己重排。已在 `AGENTS.md` 硬规则第 9 条写死。

### 测试

- 前端 67/67（8 个文件）：新增 `sortNotes` 13 例（三种键 × 两个方向、跨 Rust/JS 两种 RFC3339 写法、拼音排序、空标题沉底、id tiebreak、不改动入参、非法时间戳、空数组）、`zoom` 11 例、`formatTime` 5 例；`filterNotes` 新增 4 例排序用例，并把 fixture 的 `updatedAt` 改成互不相同 —— 原来四条数据时间戳全部并列，那几条断言实际只在测输入数组顺序，不是排序。
- Rust 16/16：新增 `Settings` 默认值、旧版 `settings.json` 兼容解析、camelCase 键名、`NotePosition` 默认尺寸 4 例。
- `tsc --noEmit` 干净。

---

## [0.1.7] — 2026-09-17

UI 美化 sweep（依据 2026-07-26 设计规格）与随后的性能微调，是 0.1.6 之后积累的全部改动。

### 新增

- **设计 token 层**（`src/index.css`）—— 用 Tailwind v4 `@theme` 建立五组 token：
  - 色彩基于 neutral 色阶：`surface` / `panel` / `ink` / `ink-muted` / `line`；便签 6 色各配一对变量（背景色 + 加深色）。
  - 圆角三档：`radius-sm` 6px（按钮 / 输入）、`radius-md` 10px（卡片 / 菜单）、`radius-lg` 14px（弹窗）。
  - 阴影三档：`shadow-card` / `shadow-pop` / `shadow-modal`。
  - 本次只做浅色主题，深色模式仅靠 token 预留基础。
- **`ColorSwatchRow` 共享组件** —— 把 NoteView 色板行、`ColorPicker`、`SettingsDialog` 三处各写一遍的色板统一为同一种样式：`w-5 h-5 rounded-full`，选中态 2px ink 描边 + 内部白色间隙（ring 效果），`hover:scale-110`。
- **`src/lib/uiText.ts`** —— NoteCard 与 NoteView 两处重复的删除确认文案提取为共享常量。
- **便签 6 色新增 `deepHex` 深色变体**（`src/lib/types.ts`）—— 供浮窗 hover 等场景使用。TS 仍是色彩的唯一定义来源，组件经 inline style 消费。
- **两个 keyframe** —— `fade-in`（菜单 / popover，120ms）、`scale-in`（弹窗，150ms）。
- 新增依赖 `lucide-solid`。

### 变更

- **主窗口**
  - Sidebar：搜索框内嵌 lucide `Search` 图标；标签项加 `Hash` 图标与选中态左侧指示条；「新建便签」按钮改 ink 深底白字 + `Plus` 图标 + 按压反馈。
  - NoteCard：满色背景保留，加圆角 md + `shadow-card`，hover 时 `shadow-pop` + 轻微上移；右上角 `📌` emoji 换成 lucide `Pin` 图标；标签 pill 改 `bg-black/8`；右键菜单项加 `Palette` / `Pin` / `Trash2` 图标（删除项红色）与 `fade-in`。
  - MasonryGrid：空状态改为居中 `StickyNote` 大图标 + 引导文字 + 快捷新建按钮。
- **便签浮窗改为整体着色** —— 窗口背景即便签色浅色调，**移除原来的左侧 1px 色条**；标题栏、工具栏与背景同色系，编辑区文字用 ink 色保证对比度。自定义标题栏的 pin 圆点选中时改为 ink 深色 + 居中白色 `Pin` 图标；右侧 `Trash2` 与色板按钮统一为 14px 图标按钮。
- **`NoteToolbar` 全面换图标** —— 文字按钮替换为 lucide `Bold` / `Italic` / `Underline` / `Strikethrough` / `List` / `ListOrdered` / `Image`，16px，active 态 `bg-black/10`。
- **`TagInput`** —— pill 改 `bg-black/8` + `X` 图标；建议下拉加 `shadow-pop` + `fade-in`。
- **弹窗统一** —— 遮罩 `bg-black/25`；面板圆角 lg + `shadow-modal` + `scale-in` + 1px `line` 描边。`SettingsDialog` 的原生 checkbox 换成自绘 CSS toggle，`<select>` 统一边框 / 圆角 / 自定义下拉箭头，默认颜色选择复用统一色板。
- **全局样式补齐** —— 统一 4px 细滚动条（替换 `.sidebar-scroll` 里硬编码的 `#d1d5db`）；统一 `focus-visible` 焦点环；补 TipTap placeholder 的 `.is-empty::before` 样式（修复占位符从不显示）；MainView 错误横幅改为 token 配色 + `AlertCircle` 图标。

### 性能

- **`list_notes` 去掉冗余排序** —— 后端不再对返回列表按 `updatedAt` 排序。前端 `filterNotes` 已对结果做同样的排序，后端那次 O(N log N) 是纯重复功。`test_note_sort_order` 仍覆盖排序逻辑本身。
- **`NoteCard` 预览剥离改用正则** —— 每张卡渲染时不再 `new DOMParser().parseFromString(...)` 构造完整 DOM 树，改用 `html.replace(/<[^>]*>/g, " ").trim()`。N=500 张卡时省掉 500 次 DOMParser 实例化与 N 个临时 DOM 文档，主视图首屏快数十毫秒；与 `filterNotes.ts` 的剥离策略保持一致。

### 测试

- 前端 34/34（5 个文件）。新增 `types.test.ts` 2 例覆盖 `deepHex`。
- Rust 12 个用例未受本次改动影响 —— 唯一动过的 Rust 代码是 `list_notes` 移除排序，而 `test_note_sort_order` 是自包含用例（自己排序本地 vec，不调用 `list_notes`）。
- `tsc --noEmit` 干净。

### 本次明确不做

- 不动 Rust 后端、窗口创建逻辑、路由、数据结构。
- 不做透明 / 圆角窗体。
- 便签 6 色 hex 值不变，只是接入变量层。
- 不实现深色模式。

---

## [0.1.6] — 2026-07-25

全量优化 sweep：按 2026-07-25 复查报告修掉全部 High / Medium / Low 项。主题是「消除重复与残留」—— 后端成为唯一广播源，前端不再有回声事件。

### 修复

- **双重 `note-updated` 事件** —— 后端成为唯一广播源，payload 变为 `{ note, source }`（`source` 是发起窗口的 label 或 `"tray"`），各窗口据此过滤自身回声。前端 `emitNoteUpdated` / `emitNoteDeleted` 删除。修掉了浮窗改色被主窗口回声事件回滚的 bug。
- **NoteView 保存生命周期重构** —— `pendingSave` promise 链串行化所有保存（并发保存不再交叉写盘）；`onCloseRequested` 先 `cancel()` 防抖再 `await saveNow()`，保存失败首次 `preventDefault()` 并提示，再次关闭则放弃更改（`saveFailedOnce` 逃生口）；删除流程置 `deleted` 标志阻断后续自动保存。
- **`atomic_write` 使用唯一临时文件名** —— `.{pid}.{seq}.tmp`（`AtomicU64` 计数）。主窗口与浮窗并发写同一便签时不再共享 tmp 文件导致 rename 交叉。
- **`save_attachment` 防覆盖 + 原子写** —— 同名文件自动追加 `-1` / `-2`… 后缀（`unique_path`）；两个附件命令改 `#[tauri::command(async)]`，25MB 写盘不再阻塞主线程。
- **托盘退出丢失未保存编辑** —— 托盘 Quit 与「关闭即退出」路径改走 `close_notes_and_exit`：先 `close()` 所有便签窗口（触发各自 JS 保存），轮询等待（上限 5s）后再退出。
- **settings.json 损坏会永久卡死设置对话框** —— 解析失败时改名为 `.json.bak` 并回退默认值；设置增加缓存（`AppState.settings`），主窗口每次关闭不再重复读盘。
- **`write_settings` 补入参校验** —— 颜色必须在调色板内（`models::COLOR_KEYS`），自动保存间隔 clamp 到 500ms–1h。
- **搜索重复剥 HTML** —— `filterNotes` 增加以 `updatedAt` 为键的纯文本缓存，每次击键不再对全部便签重复剥标签。
- **NoteCard 右键菜单溢出屏幕** —— 菜单坐标按视口 clamp。
- **Sidebar 防抖搜索在组件卸载后仍触发** —— `onCleanup` 中 `cancel()`。

### 新增

- **identifier 改为 `com.dawnwang.stickynotes`**（原为裸 `sticky-notes`），并带一次性数据迁移：启动时（建窗前）把旧 app-data 目录的 `notes/` / `attachments/` / `settings.json` 移到新目录，同时重写便签 JSON 里指向旧目录的 `asset.localhost` 图片 URL（URL-encoded 与 JSON-escaped 两种形态）。
- **`launchOnStartup` 真正生效** —— 接入 `tauri-plugin-autostart`，设置对话框新增「开机自动启动」勾选；启动时与 `write_settings` 时均同步 OS 自启动项。
- **文件日志** —— 接入 `tauri-plugin-log`（Stdout + LogDir 双目标，Info 级），全部 `eprintln!` 换成 `log::warn!` / `log::error!`。
- **`settings-changed` 事件** —— `write_settings` 广播新设置，已打开的浮窗即时应用新的自动保存间隔（`debounce` 支持延迟取值函数）。
- **托盘 New note 尊重默认颜色** —— 坐标复用 `NotePosition::default()`，删掉 `tray.rs` 里手工镜像的常量。
- **图片插入失败提示** —— 粘贴 / 拖拽 / 工具栏三条路径失败时，浮窗顶部显示琥珀色横幅（5s 自动消失），不再静默丢弃。

### 变更

- **capabilities 收敛** —— 删除未用的 `tauri-plugin-shell`（`Cargo.toml`、`lib.rs`、`package.json`、capabilities 全链路移除）；新增 `core:window:allow-destroy`（JS 侧 `onCloseRequested` 流程需要）。
- **MainView 改增量更新** —— `note-updated` / `note-deleted` 直接用事件 payload 打补丁（`reconcile` keyed diff），不再整表 `loadNotes()`；新建便签同样不再全量刷新。
- **`TAURI_DEBUG` → `TAURI_ENV_DEBUG`** —— Tauri 2 改名后 `vite.config.ts` 的判定一直落空。
- **杂项清理** —— `index.html` 错误覆盖层在挂载后只写 console；`vite-env.d.ts` 补 `__NOTE_ID__` / `__MAIN_WINDOW__` / `__APP_MOUNTED__` 类型（去掉 `as any`）；`get_note_id` 改 `strip_prefix` 并删调试日志；托盘分隔符改 `PredefinedMenuItem::separator`；`AppState.is_exiting` 改 `AtomicBool`；`NoteCard` 标签渲染改 `<For>`；Sidebar 置顶计数 memo 化；删除 `notesStore.saveNote` 死代码；chrono 关默认特性只留 `clock`。

### 测试

- Rust 12/12；前端 32/32；`tsc --noEmit`、`cargo check` 干净。

---

## [0.1.5] — 2026-07-25

全面加固与体验升级 sweep，分六个批次推进：安全 → 数据丢失 → 稳定性 → 性能 → 设置 UI → UX。

### 安全

- **便签 ID 校验** —— 新增共享 `validate_id()`（≤64 字符，仅字母数字与 `-`），`read_note` / `write_note` / `delete_note` / 附件目录解析 / `open_note_window` 全部套用。堵住路径穿越与 `eval` 脚本注入两条攻击面。
- **`write_note` ID 一致性检查** —— 请求参数 `id` 与 body 中 `note.id` 不一致时拒绝写入。
- **`safe_filename` 强化** —— 额外拒绝 `:`、控制字符、结尾点 / 空格、超 128 字符，以及 Windows 保留设备名（CON / PRN / AUX / NUL / COM1-9 / LPT1-9）。
- **CSP 收紧** —— `tauri.conf.json` 由 `null` 改为显式白名单：`script-src 'self'`，`img-src` 仅 asset 协议 / blob / data，`connect-src` 仅 IPC。
- **移除未使用的 `shell:allow-open` 能力**。
- **`stripHtml` 改用 `DOMParser`** 替代 innerHTML 赋值，杜绝解析期资源加载。

### 修复

- **原子写盘** —— `write_note` / `write_settings` 先写 `.tmp` 再 `rename`，崩溃不再产生半截 JSON。
- **删除便签时清理附件目录**（`attachments/<id>`，best-effort）。
- **NoteToolbar 永不渲染** —— Solid 组件只执行一次，原先的 `if (!editor) return null` 是永久性的。改为 `<Show when={props.editor}>` + TipTap `transaction` 事件桥接的 version 信号，工具栏激活态现在实时刷新。
- **标题 / 标签 / 颜色 / 置顶修改不触发自动保存** —— 全部接入 debounce autoSave；关窗前 `cancel()` + `saveNow()` 确保零丢失。
- **NoteCard 改色覆盖浮窗最新内容** —— 先 `readNote` 取新鲜快照再写回，失败时回滚本地乐观更新。
- **MainView 事件监听泄漏** —— `onCleanup` 在 `await` 之前登记，卸载不再泄漏监听器。
- **托盘写便签调用漏 `.await`** —— 命令异步化后的编译错误。
- **主视图卡片被多列布局切断** —— CSS `columns` 布局下卡片未禁止跨列断开，内容稍长即被切成多段。NoteCard 根元素加 `break-inside-avoid`；间距由 `space-y-4` 改为卡片自带 `mb-4`（`space-y` 在多列下会造成首列间距错乱）。
- **便签窗口拖动区太小** —— 原先只有头部中间一条细 spacer 可拖动。整个头部横条改为 `data-tauri-drag-region` 并加 `min-h-9`；按钮不受影响（Tauri 仅在 mousedown 目标自身带该属性时启动拖动）。

### 新增

- **单实例插件**（`tauri-plugin-single-instance`）—— 二次启动唤起已有主窗口。
- **设置 UI** —— 新建 `stores/settingsStore.ts` + `SettingsDialog.tsx`（默认颜色 / 自动保存间隔 / 关闭行为），侧栏加「设置」入口。三项设置均实际生效。
- **`delete_attachment` 重新注册**到 `invoke_handler`，前端 `invoke.ts` 提供包装。
- **浮窗删除入口** —— 便签窗口头部新增删除按钮 + ConfirmDialog。
- **新便签级联偏移** —— 连续新建的便签窗口按 28px 阶梯错开，不再完全重叠。
- **搜索匹配纯文本** —— `filterNotes` 先剥 HTML 标签再匹配，`<p>`、`b>` 等标记不再误命中；结果按 `updatedAt` 倒序。
- **颜色选择器点击外部关闭**（NoteCard 内联 picker 增加遮罩层）。

### 变更

- **附件上传改走 raw-body IPC** —— `save_attachment` 改用 `tauri::ipc::Request` 原始字节 + percent-encoded 头部传参，替代 JSON `number[]`（25MB 图片不再序列化为数组）。
- **`notesStore.loadNotes` 使用 `reconcile(data, { key: "id" })`** —— 刷新列表按 id diff，不再整表重建 DOM。
- **`debounce` 泛型化 + `flush()` 异步等待**底层函数完成。
- **侧栏搜索输入 200ms 防抖**。
- **启动提速** —— `NoteView`（TipTap 编辑器）改 `lazy()` 按需加载，主窗口首包从 387KB 降到 48KB；主窗口经 `initialization_script` 注入 `__MAIN_WINDOW__` 同步路由，不再等 `get_note_id` IPC 失败后才渲染。
- **便签窗口打开提速** —— 非主窗口立即并行预载编辑器 chunk；便签窗口乐观注入 `initialization_script`（`__NOTE_ID__`，eval + IPC 兜底保留）；`readNote` 与 TipTap 初始化并行发起；`lucide-solid` 改为按图标深导入（桶导入在 Vite dev 下会逐个请求约 3500 个图标模块，是 dev 模式内容加载慢的主因）。
- **dev 启动提速** —— WebView2 追加 `--no-proxy-server`（系统代理开启时 localhost 加载会被代理解析拖慢数秒）；Vite `server.warmup` 预转换两个窗口的模块图。所有窗口统一使用 `windows::BROWSER_ARGS` —— WebView2 要求同进程内所有 webview 的浏览器参数一致，参数不一致会导致第二个窗口静默创建失败。
- **Rust release profile** —— LTO + `opt-level="s"` + strip，减小产物体积。
- **全部 UI 文案统一中文**（卡片菜单、确认对话框、空状态、侧栏、浮窗工具栏）。

### 测试

- Rust 12/12（新增 `validate_id` / `safe_filename` 强化用例）；前端 32/32（新增 debounce 5 例、filterNotes 剥标签 / 排序用例）；`tsc --noEmit` 干净。

---

## [0.1.4] — 2026-07-15

图片粘贴 UI。数据层（TipTap `Image` 扩展、Rust `save_attachment`、`invoke.ts` 包装）早在 v0.1.0 就已就位，但一直没有入口 —— 这个版本把三条 UI 路径接了上去。

### 新增

- **图片粘贴 / 拖拽 / 工具栏插入** —— 三条入口（Ctrl+V、文件拖入、工具栏按钮）全部收敛到 `insertImageFromBlob`。blob 经已有的 `save_attachment` 命令上传，再用 `convertFileSrc` 把本地路径映射成 `asset://` URL 插入为行内 `<img>`。
- **`pastedFilename(mime, now?)`** —— 生成防碰撞图片文件名的纯函数（`pasted-<ISO 时间戳>.<ext>`）。抽出来是为了让时间戳逻辑可单测。
- **`lucide-solid`** 依赖，用于工具栏图片按钮图标。
- **Tauri `assetProtocol` 开启**，作用域限定 `$APPDATA/attachments/**` —— webview 只能加载 `save_attachment` 写出的文件，不能读任意磁盘路径。

### 测试

- `pastedFilename` 新增 7 例（png / jpeg / webp / svg / 未知 mime + 注入 Date + 冒号替换）。
- 前端测试累计 26 例，全部通过。

---

## [0.1.3] — 2026-07-15

前端测试基建。目标是把两处已经在 v0.1.0 → v0.1.2 期间反复回归的「准纯函数」逻辑锁住，同时不引入 DOM 与组件测试。

### 新增

- **Vitest 骨架** —— `npm test` 跑 `vitest run --passWithNoTests`，`npm run test:watch` 进 watch 模式。node 环境，本轮不涉及 DOM 与组件测试。
- **`filterNotes(notes, opts)`** —— 从 `MainView` 的内联 `createMemo` 抽成 `src/lib/filterNotes.ts` 里的纯函数，内联 memo 改为委托调用。
- **`getAllTags(notes)` 改签名** —— 显式接收便签数组，不再从模块级 store 读取。唯一调用方 `Sidebar` 改为传入 `notes`。

### 测试

- `filterNotes` 11 例（空 opts、按标题 / 正文 / 大小写 / 原始 HTML 匹配、标签大小写不敏感 + 空标签、pinnedOnly 开关、组合过滤、空结果）。
- `getAllTags` 8 例（空便签、无标签、单标签聚合、大小写不敏感分组、以最高频写法作 displayName、并列时取先出现者、排序、多标签计数）。
- 合计 19 例，全部通过；`tsc --noEmit` 干净。

---

## [0.1.2] — 2026-07-15

由 2026-07-15 代码复查驱动的清理与修 bug sweep。不新增功能，不改设计。每个修复单独一个 commit，可独立回滚。

### 修复

- **退出路径丢失未防抖的编辑** —— `debounce()` 新增 `flush()`，`NoteView.onCleanup` 在 webview 销毁前同步 flush 待保存的快照。覆盖托盘 Quit、OS 关闭、关窗后 2 秒内继续输入这三种场景。
- **`save_attachment` 路径穿越** —— `safe_filename()` 拒绝空名、`..`、含路径分隔符的输入，`delete_attachment` 加同一守卫；另加 25MB 大小上限，防止巨型粘贴占满磁盘。
- **`list_notes` 单文件失败拖垮整个列表** —— 坏 JSON 现在写入 stderr 警告并跳过，文件留在磁盘上待手动恢复，其它便签正常显示。
- **`scaleFactor()` 返回 0 未防御** —— `NoteView` 仅当 `sf > 0` 时才写入 `note.position`，避免 NaN / Infinity 污染持久化数据。
- **`MainView` 监听器异步注册泄漏** —— 把 `onNoteUpdated` / `onNoteDeleted` 的 `listen()` 包装进 `async onMount`，`unlisten` 句柄先于 `onCleanup` 拿到。

### 变更

- **接上 `ColorPicker`** —— `NoteCard` 右键菜单的 "Change color" 不再是 no-op，用现有组件实现乐观更新 + `writeNote` 持久化。
- **`NoteView` 的 `color` 信号收紧为 `<ColorKey>`** —— 去掉两处 `as Note["color"]` 断言。
- **`NoteToolbar` 加运行期 guard** —— 每个 onClick 通过 `run()` 助手守卫 `editor`，处理 editor 被销毁后的残留点击。
- **`getAllTags()` 显示最常见的大小写** —— `Sidebar` 显示 `{ name, displayName, count }` 中的 `displayName`（出现频次最高的写法）；存储保留原始大小写，去重仍大小写不敏感。
- **新建便签位置统一** —— 前端 `DEFAULT_NOTE_POSITION`（100, 100, 300, 240）定义在 `lib/types.ts`，`MainView` 与 `tray.rs`（常量镜像）共用同一组坐标，替代原先三处不一致的硬编码。
- **空状态文案区分** —— `MasonryGrid` 通过 `hasAnyNotes` prop 区分「无便签」与「当前过滤无匹配」，搜索 / 过滤时不再误导用户去新建。

### 移除

- `src/App.tsx`（`return null` 占位）
- `src/components/ContextMenu.tsx` 与 `useContextMenu` hook
- `notesStore.getNoteById`（无调用方）
- `windows.rs` 里的 `log_path` 调试写入（`fs::write` 覆盖式，每次只留最后一行；`on_page_load` 错误路径的 `eprintln!` 保留为 stderr breadcrumb）
- `lib.rs` 中 `delete_attachment` 的 `invoke_handler!` 注册（前端尚无入口；Rust 函数保留 + `#[allow(dead_code)]`，供即将到来的图片粘贴 UI 使用）

### 测试

- `safe_filename` 新增 4 例（正常名、穿越、路径分隔符、空 / 点）。
- Rust 9/9 通过；`tsc --noEmit` 干净；`cargo check` 无 warning。

---

## [0.1.1] — 2026-07-15

窗口身份与拖拽修复。v0.1.0 在真实桌面环境下暴露出的三类问题：路由错乱、窗口拖不动、退不掉。

### 修复

- **窗口路由错误（主窗口变成便签视图）** —— `initialization_script` 在 Tauri 2 二级窗口中静默失败。改用 `on_page_load` + `eval()` 注入 `__NOTE_ID__`，并以 `get_note_id` IPC 命令（读取 `window.label()`）作为前端唯一路由机制。移除了会导致主窗口路由被错误覆盖的 `"note-id"` 事件回退监听器。
- **便签窗口无法拖拽** —— 两个原因：`capabilities/default.json` 缺少 `core:window:allow-start-dragging` 权限，`data-tauri-drag-region` 底层调用被拒绝；调试用的 canary `<div>`（`position:fixed; z-index:99999`）覆盖了窗口顶部拖拽区，拦截了所有鼠标事件。
- **托盘 Quit 被阻止** —— 添加 `AppState.is_exiting` 标志，托盘 Quit 时先置位，`on_window_event` 检测到后不再 `prevent_close()`，允许应用正常退出。
- **托盘创建便签时主线程死锁** —— `new_note` 菜单事件改为经 `tauri::async_runtime::spawn` 异步执行，避免在 tao 主线程同步调用 `WebviewWindowBuilder::build()` 导致死锁。

### 变更

- **移除调试条** —— 删除 `index.html` 中的 canary `<div>` 及 `index.tsx`、`NoteView.tsx` 中所有 `canary()` 调用。
- **拖拽区域调整** —— `data-tauri-drag-region` 从外层 `<div>` 移回头部 `<div>`，利用 `justify-between` 在按钮之间留出的空白作为拖拽手柄。
- **MainView 新增错误提示** —— 创建便签失败时在顶部显示红色错误横幅。

---

## [0.1.0] — 2026-06-06

第一个可运行的桌面版本。18 个实现任务全部提交，核心链路（新建 → 编辑 → 保存 → 关闭 → 重开）在 Windows 上手工验证通过。

### 新增

**后端（Rust + Tauri 2）**

- `src-tauri/src/models.rs` 里的 `Note` / `NotePosition` / `Settings` 模型，序列化为 camelCase JSON
- 六色柔和调色板（`paper` / `blush` / `sky` / `sage` / `apricot` / `lavender`）
- Tauri 命令：`list_notes` / `read_note` / `write_note` / `delete_note`；`save_attachment` / `delete_attachment`；`read_settings` / `write_settings`；`open_note_window` / `close_note_window` / `set_note_window_pinned`
- 浮窗管理器 —— 按便签位置创建无边框 Tauri 窗口，通过 `initialization_script` 注入便签 ID（`window.__NOTE_ID__`）
- 系统托盘 —— 左键唤起主窗口；菜单含 **显示** / **新建便签** / **退出**
- 主窗口关闭走 `prevent_close()` + `hide()`（应用留在托盘）

**前端（SolidJS + TipTap）**

- `src/index.tsx` 里的手写 `Switch/Match` 路由（不用 `@solidjs/router`）
- `MainView`（`/`）—— 侧栏搜索 / 标签过滤（实时计数）/ 置顶过滤 + 瀑布流网格
- `NoteView`（`/note/:id`）—— 浮窗内的 TipTap 编辑器
- TipTap 扩展：StarterKit、Underline、Link、Image、Placeholder
- 工具栏：粗体 / 斜体 / 下划线 / 删除线 / 无序列表 / 有序列表
- 标签自动补全（来自已有标签）；大小写不敏感去重；退格删除最后一个标签
- 浮窗内六色色板行；卡片与窗口都带左侧色条
- 置顶开关（圆点按钮）—— 调用 `set_note_window_pinned`
- 卡片右键菜单（弹出浮窗 / 改颜色 [当时是 no-op] / 删除）
- 破坏性操作前弹 ConfirmDialog
- 经 Tauri 事件（`note-updated`、`note-deleted`）做跨窗口同步

**持久化与运行时**

- 便签在 OS app-data 目录下按「一便签一 JSON 文件」存储
- 每次击键 2 秒防抖自动保存
- 保存时记录窗口位置与尺寸（`outerPosition` / `outerSize` ÷ `scaleFactor`）
- `index.html` 运行时安全网：`window.onerror`、资源加载失败、`unhandledrejection`、20 秒挂载超时。bundle 坏掉时在 DOM 内显示错误面板，而不是白屏。

### 修复（构建验证与集成阶段，2026-06-06 → 07-14）

- **移除 Rust 侧死代码调色板**（`models.rs` 的 `pub const COLORS` 与 `pub fn get_color_hex`）—— Rust 调色板无人引用，且相对前端不完整（缺 UI 需要的 `name` 字段）。`src/lib/types.ts` 的 `COLORS` + `getColorHex` 成为唯一定义来源。只测那个死函数的两个用例一并删除，剩余 4 个用例覆盖 `Note` 默认值 / 序列化 / camelCase 与 `Settings` 默认值。构建零 warning。
- **图标** —— 换成自定义设计，`icon.ico` 从 `icon.png` 重新生成全部标准尺寸（含小尺寸像素填充优化）。
- **`unwrap()` panic 改为 `Result` 处理**，并加 loading 兜底。
- **关闭按钮可见性**与拖拽区隔离调整。

### 集成期的架构反复

v0.1.0 的核心链路能跑通，但「窗口身份如何传给前端」这件事在集成阶段反复推翻了七次。这些尝试的最终结论固化在 v0.1.1：

| commit | 尝试 |
|---|---|
| `768699a` | 去掉 `@solidjs/router`，改手写 `Switch/Match` —— router API 与 SolidJS 1.9 + Tauri WebView 不匹配 |
| `e14bef7` | 用 `@tiptap/core` 直接建 `Editor` 替换 `solid-tiptap` |
| `4c6c278` | 加 console 日志、DOM 内错误显示、catch-all 路由、`index.tsx` 内联路由（调试用） |
| `c70a459` | 改用基于 pathname 的手写路由（Tauri WebView 兼容性） |
| `50af25e` | 改用 `?noteId=` 查询参数替代路径路由 |
| `80ede17` | `index.html` 加运行时错误显示 + 全高 CSS 链 |
| `59143df` | 便签 ID 传递改走 Tauri `initialization_script`，顺带整理 `NoteView` |

这七次尝试都集中在 `src/index.tsx` 的路由与 `windows.rs` 的 ID 注入上。**最终方案是 v0.1.1 定下的「`on_page_load` eval + `get_note_id` IPC 兜底」**，不要回退到查询参数路由 —— Tauri WebView 对 URL 的处理不可靠。

### 验证

实现计划的验证清单已逐项标注 —— 见[归档的实现计划](docs/archive/superpowers/plans/2026-06-06-sticky-notes.md)。16 项除「当前已知缺口」中列出的以外全部通过。

---

## 当前已知缺口

这份列表与 [AGENTS.md](./AGENTS.md) 的 "Known gaps" 对应，改动时两边一起更新。

- **平台覆盖** —— 只在 Windows 10 / 11 上验证过。macOS 与 Linux 未测试；Tauri 2 理论上支持，但窗口创建、托盘、自启动三条路径都有平台分支。
- **深色模式** —— 未实现。UI 美化引入的设计 token 层已为其预留基础，理论上只需换变量值。
- **无发布产物** —— 没有 git tag、没有远端、没有 CI。`npm run tauri build` 能产出安装包，但从未正式发布过。
- **`docs/archive/` 下的文档不描述当前行为** —— 归档于 2026-09-16，只作历史参考。设计理由可查，但以代码和本文件为准。
- **`tailwind.config.ts` 不存在，这是对的** —— 原实现计划提到过它，但 Tailwind v4 + `@tailwindcss/vite` 不需要配置文件。
- **License 未定** —— `README.md` 中标为 TBD。
