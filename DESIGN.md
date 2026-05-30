# DESIGN.md

HappyCode 设计系统文档。所有组件开发前先查此文件。

> 由 `plan-design-review 2026-04-23` 建立。

---

## 设计定位

**产品类型：** APP UI（工作区驱动，数据密集，任务导向）— 适用 App UI Rules，不适用 Landing Page Rules。

**风格方向：** 深色开发者工具（Developer Tool Dark）。对标 VS Code 侧边栏 + Claude Code CLI 审美。
密度适中，易读，chrome 极简，没有装饰性渐变或卡片阴影。

> 2026-05-22 更新：主色调从 Indigo (#818cf8) 切换为 Amber Gold (#f0b429 dark / #c27a0e light)。

---

## Color Tokens

### 深色主题（默认）

```css
:root[data-theme="dark"], :root {
  /* 背景层次 */
  --color-bg:        #0f0f11;   /* 最底层背景 */
  --color-surface:   #1a1a1f;   /* 主要面板/标题栏 */
  --color-surface-2: #242429;   /* 输入框/下拉 */
  --color-surface-3: #2e2e35;   /* hover 状态 */

  /* 边框 */
  --color-border:    #2e2e35;
  --color-border-focus: #f0b429;

  /* 文字 */
  --color-text:      #e8e8ec;
  --color-text-muted: #8b8b9e;  /* ↑ 从 #7a7a8a 提亮，修复对比度 */
  --color-text-faint: #5a5a6e;

  /* Accent — Indigo 400（替代原始通用紫 #7c6af7）*/
  --color-accent:     #f0b429;
  --color-accent-dim:   rgba(240, 180, 41, 0.12);
  --color-accent-hover: #d99e22;

  /* 状态 */
  --color-success:   #3dd68c;
  --color-warning:   #f59e0b;
  --color-danger:    #f87171;
  --color-info:      #60a5fa;
}
```

### 浅色主题（待实现）

```css
:root[data-theme="light"] {
  --color-bg:        #fafafa;
  --color-surface:   #ffffff;
  --color-surface-2: #f4f4f6;
  --color-surface-3: #e8e8ec;
  --color-border:    #e2e2e8;
  --color-border-focus: #c27a0e;
  --color-text:      #0f0f11;
  --color-text-muted: #5a5a6e;
  --color-text-faint: #9a9aaa;
  --color-accent:    #c27a0e;
  --color-accent-dim: rgba(194, 122, 14, 0.10);
  --color-accent-hover: #a3680b;
  --color-success:   #16a34a;
  --color-warning:   #d97706;
  --color-danger:    #dc2626;
  --color-info:      #2563eb;
}
```

---

## 字体

```css
/* 安装: npm install @fontsource/geist @fontsource/geist-mono */
:root {
  --font-sans: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-mono: 'Geist Mono', 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
}
```

**字号规范：**
- `10px` — 工具提示、徽章
- `11px` — 小标签、时间戳、元数据
- `12px` — 表单标签、代码（密集视图）
- `13px` — 默认正文（`body`）
- `14px` — 主要 UI 文字
- `16px` — 页面标题
- `20px+` — 大标题（谨慎使用）

---

## 间距 Scale

```
4px   — 元素内部细间隙（图标与文字）
8px   — 紧密组件间距（列表项 padding）
12px  — 标准内边距（按钮、输入框）
16px  — 面板内边距
24px  — 区段间距
32px  — 大区块间距
48px  — NavRail 宽度（固定）
```

---

## 组件规范

### 按钮

```
sm:  height 24px, padding 0 8px,  font 11px
md:  height 28px, padding 0 12px, font 12px（默认）
lg:  height 32px, padding 0 16px, font 13px
```

最小可点击区域：32×32px（Electron 桌面 App 标准）。

**变体：**
- `primary` — accent 填充色
- `ghost` — 透明背景，hover 时 `surface-3`
- `danger` — danger 边框，hover 时 danger 填充

### NavRail

```
宽度: 48px（固定）
图标: 20×20px Lucide Icons（推荐）
活跃态: accent 颜色图标 + 左侧 2px 竖线指示器
非活跃: text-muted，hover 时 surface-3 背景 + text
底部固定: Settings 图标
```

### 输入框 / 选择框

```
height: 28px（单行）
padding: 4px 10px
border: 1px solid var(--color-border)
border-radius: var(--radius-sm)
focus: border-color: var(--color-border-focus), outline: none
```

---

## 圆角 Scale

```css
:root {
  --radius-xs: 2px;
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 10px;
  --radius-xl: 16px;
}
```

**规则：** 密集 UI（列表项、工具栏按钮）用 `sm`；卡片/面板用 `md`；弹窗/模态用 `lg`。
禁止全局统一大圆角（AI slop 警示）。

---

## 图标系统

使用 **Lucide React**（`npm install lucide-react`）——与 shadcn/ui 配套，轻量，风格一致。

NavRail 推荐图标：
- Chat: `MessageSquare`
- Sessions: `History`
- MCP: `Plug`
- Skills: `Zap`
- Hooks: `Webhook`
- Settings: `Settings`

---

## 布局架构（AppShell）

```
┌────┬─────────────────────────────────┬───────────┐
│    │  TopBar                          │           │
│ 48 ├─────────────────────────────────┤  Panel    │
│ px │                                 │  Zone     │
│    │  主内容区                         │  (可折叠) │
│ N  │  根据 NavRail 选中项渲染           │           │
│ a  │  Chat / Sessions / MCP /        │           │
│ v  │  Skills / Hooks                 │           │
│ R  │                                 │           │
│ a  ├─────────────────────────────────┤           │
│ i  │  PromptInput（仅 Chat 页显示）    │           │
│ l  │                                 │           │
└────┴─────────────────────────────────┴───────────┘
```

**TopBar 内容：**
项目路径 · Model selector · Mode pills（Code/Plan） · 成本/Token 显示 · 主题切换

**PanelZone 触发：**
- Agent Tree（当会话有 Subagents 时）
- 文件树（Phase 2）
- 默认折叠（`collapsed` 状态占 0px）

---

## 空态设计原则

每个功能区必须有独立空态：
1. **图标/插画**（24px Lucide icon，text-muted 色）
2. **标题**（告诉用户这个区域是什么）
3. **说明**（1-2 句话，告诉用户下一步）
4. **Primary CTA**（明确的操作按钮，accent 样式）

禁止用纯文字 "No items found." 作为唯一空态。

---

## 交互状态矩阵

每个功能区必须定义 5 种状态：Loading · Empty · Error · Success · Partial

优先通过骨架屏（`Skeleton` 组件）而非 spinner 表达 Loading 状态。

---

*最后更新：2026-05-22*
