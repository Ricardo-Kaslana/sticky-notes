# UI 美化设计规格(简洁现代风)

- 日期:2026-07-26
- 状态:已批准(分节确认通过)
- 范围:纯前端视觉改造;不改 Rust 后端、窗口创建逻辑、路由、数据结构

## 目标

对主窗口、便签浮窗、所有弹窗/菜单做一次系统性的视觉统一与现代化,风格中性克制(类 Notion/Apple):中性灰白基底 + 柔和阴影 + 统一圆角,便签色彩本身作为视觉主角,不引入品牌主题色。本次只做浅色主题,但全部颜色走 CSS 变量/设计 token,为未来深色模式预留基础。

## 已确认的决策

| 决策点 | 结论 |
|---|---|
| 范围 | 全面美化(主窗口 + 浮窗 + 弹窗) |
| 深色模式 | 暂不实现,用 token 预留基础 |
| 浮窗配色 | 整体着色(窗口背景 = 便签色浅色调),移除左侧 1px 色条 |
| 视觉基调 | 中性克制风,无品牌主题色 |
| 方案 | A:Token 驱动的系统性美化(不做透明/圆角窗体) |

## 第 1 节:设计 token 与全局样式(`src/index.css`)

用 Tailwind v4 `@theme` + CSS 变量建立 token 层。

**色彩 token**(基于 Tailwind neutral 色阶):
- `--color-surface`:主背景 `#fafafa`
- `--color-panel`:侧栏/弹窗白
- `--color-ink`:主文字(neutral-800)
- `--color-ink-muted`:次要文字(neutral-500)
- `--color-line`:边框(neutral-200)
- 便签 6 色(paper/blush/sky/sage/apricot/lavender,hex 值不变)各配一对变量:背景色 + 加深色(用于浮窗内 hover 等)。未来深色模式只需换变量值。

**统一层级**:
- 圆角三档:`radius-sm 6px`(按钮/输入)、`radius-md 10px`(卡片/菜单)、`radius-lg 14px`(弹窗)
- 阴影三档:`shadow-card`(卡片)、`shadow-pop`(菜单/popover)、`shadow-modal`(弹窗),色调统一带一点暖灰
- 字体:主窗口和浮窗统一 `"Segoe UI Variable", "Segoe UI", system-ui`

**全局补齐**:
- 统一 4px 细滚动条(所有滚动区,颜色走变量;替换现有 `.sidebar-scroll` 硬编码 `#d1d5db`)
- `focus-visible` 统一焦点环样式
- 补 TipTap placeholder 的 `.is-empty::before` CSS(修复占位符从不显示的问题)
- 两个 keyframe:`fade-in`(菜单/popover,120ms)、`scale-in`(弹窗,150ms)

## 第 2 节:主窗口

**Sidebar**(`w-56`,panel 白底 + 右侧细分线):
- 搜索框:圆角 sm、内嵌 lucide `Search` 图标、聚焦时焦点环
- 标签列表:每项左侧 lucide `Hash` 小图标;选中态 `bg-neutral-100` + 左侧 2px ink 色指示条;hover 过渡
- 「新建便签」按钮:ink 深底白字 + lucide `Plus` 图标 + `active:scale-[0.98]` 按压反馈
- 设置入口:lucide `Settings` 图标按钮

**NoteCard**:
- 满色背景保留,圆角 md、`shadow-card`;hover 时 `shadow-pop` + `-translate-y-[1px]`(120ms 过渡)
- 📌 emoji → lucide `Pin` 图标(12px,右上角,半透明 ink 色)
- 标签 pill:`bg-black/8`、圆角 full
- 右键菜单:圆角 md、`shadow-pop`、`fade-in` 动画;菜单项加 lucide 图标(`Palette`/`Pin`/`Trash2`),删除项红色

**MasonryGrid**:
- 列距/内边距微调(`gap-4 p-5`)
- 空状态:居中 lucide `StickyNote` 大图标(浅灰)+ 一句引导文字 + 「新建便签」快捷按钮

## 第 3 节:便签浮窗

**整体着色**:窗口背景 = 便签色浅色调(原 6 色直接做背景),移除左侧 1px 色条。标题栏、工具栏与背景同色系,无生硬分界;编辑区文字用 ink 色保证对比度。

**自定义标题栏**:
- macOS 式圆点保留:pin 圆点选中时 ink 深色 + 白色小 `Pin` 图标居中;close 保持红色;hover 时圆点内浮现图标(仿 macOS)
- 右侧:`Trash2` 与色板按钮统一为 14px lucide 图标按钮,hover 背景 `black/5` 圆角 sm

**色板行**(与 ColorPicker 统一为一种样式):`w-5 h-5 rounded-full`,选中态 2px ink 描边 + 内部白色间隙(ring 效果),`hover:scale-110`

**NoteToolbar**:文字按钮全部换 lucide 图标(`Bold`/`Italic`/`Underline`/`Strikethrough`/`List`/`ListOrdered`/`Image`),16px;active 态 `bg-black/10` 圆角 sm;分隔线半透明

**TagInput**:pill 改 `bg-black/8` + `X` 图标;建议下拉 `shadow-pop` + `fade-in`

**状态横幅**(保存中/错误):浮窗顶部内嵌细横条,配色柔和化(跟随 token)

## 第 4 节:弹窗与收尾

**ConfirmDialog / SettingsDialog**(统一模式):
- 遮罩 `bg-black/25`;面板圆角 lg + `shadow-modal` + `scale-in` 动画,均带 1px `line` 色描边
- SettingsDialog:原生 checkbox → 自绘 toggle 开关(纯 CSS,ink 色选中态);`<select>` 统一边框/圆角/自定义下拉箭头;默认颜色选择复用统一圆形色板样式
- ConfirmDialog:删除按钮保持红色 + `Trash2` 图标;NoteCard 与 NoteView 两处重复的删除确认文案提取为共享常量

**MainView 错误横幅**:柔和化为 token 配色细横条 + `AlertCircle` 图标

## 出界(明确不做)

- 不动 Rust 后端、窗口创建逻辑、路由、数据结构
- 不做透明/圆角窗体(方案 C 内容,未来单独立项)
- 便签 6 色 hex 值不变(仅接入变量层)
- 不实现深色模式(仅 token 预留)

## 验证

- `npx tsc --noEmit` 与 `npm test` 通过
- `npm run tauri dev` 实际走查:主窗口、浮窗各色便签、右键菜单、设置、删除确认、深浅便签色下文字对比度

## 涉及文件(预计)

`src/index.css`、`src/routes/MainView.tsx`、`src/routes/NoteView.tsx`、`src/components/Sidebar.tsx`、`NoteCard.tsx`、`MasonryGrid.tsx`、`NoteToolbar.tsx`、`TagInput.tsx`、`ColorPicker.tsx`、`ConfirmDialog.tsx`、`SettingsDialog.tsx`、`src/lib/types.ts`(如需导出色彩变量映射/共享文案常量)
