# HappyCode — Claude Desktop 风格重设计

**日期：** 2026-04-24  
**状态：** 已批准，待实施  
**方案：** 分层推进（Layer 1 → 2 → 3，每层独立可发布）

---

## 背景

当前 UI 是功能性的 devtool 风格——NavRail 图标栏 + 冷色 Indigo 主题。目标是向 Claude Desktop 风格靠拢：温暖、对话优先、有呼吸感，同时保留开发者工具的信息密度。

---

## 设计决策

| 维度 | 当前 | 目标 |
|------|------|------|
| 主题色调 | 冷灰蓝 / Indigo | 暖米色 / 棕金（浅色主题） |
| 侧边栏 | 48px 图标 NavRail | 220px 宽 Sidebar，导航 + 会话列表 |
| Chat 布局 | 全宽消息 + TabBar | 居中消息（max-width 600px），去 TabBar |
| TopBar | App 标题 + CwdPicker + Init + 主题切换 | 精简为会话信息栏（标题 + 费用 + token） |
| 多 session | TabBar 管理 | 侧边栏 "＋ 新对话" + Recent 列表 |

---

## Layer 1 — 色彩系统（`styles.css`）

**改动文件：** `src/styles.css`  
**预计耗时：** 30 分钟  
**风险：** 极低（纯 CSS token 替换）

### 浅色主题 token 映射

```css
[data-theme="light"] {
  /* 背景层：冷灰 → 暖米 */
  --color-bg:        #faf8f4;   /* 原 #f5f5f7 */
  --color-surface:   #f5f1eb;   /* 原 #ffffff */
  --color-surface-2: #ede8df;   /* 原 #f0f0f5 */
  --color-surface-3: #e6e0d6;   /* 原 #e8e8ef */

  /* 边框 */
  --color-border:       #e2ddd5;   /* 原 #d8d8e0 */
  --color-border-focus: #a0866a;   /* 原 #6366f1 */

  /* 文字：冷黑 → 暖棕黑 */
  --color-text:       #1c1612;   /* 原 #18181b */
  --color-text-muted: #6b5e52;   /* 原 #52525b */
  --color-text-faint: #a8998a;   /* 原 #a1a1aa */

  /* Accent：Indigo → 暖棕赭石 */
  --color-accent:       #a0866a;                    /* 原 #6366f1 */
  --color-accent-dim:   rgba(160, 134, 106, 0.12);  /* 原 rgba(99,102,241,0.1) */
  --color-accent-hover: #8c7055;                    /* 原 #4f46e5 */
}
```

### 深色主题 token 映射

深色主题保留现有黑色基调，仅替换 Accent 和边框微调：

```css
:root {
  /* 背景层：保持冷黑不变 */
  --color-bg:        #0f0f11;
  --color-surface:   #1a1a1f;
  --color-surface-2: #242429;
  --color-surface-3: #2e2e35;

  /* 边框加一点暖调 */
  --color-border:       #2e2a26;   /* 原 #2e2e35，略暖 */
  --color-border-focus: #a0866a;   /* 原 #818cf8 */

  /* 文字保持不变 */
  --color-text:       #e8e8ec;
  --color-text-muted: #8b8b9e;
  --color-text-faint: #5a5a6e;

  /* Accent：Indigo → 暖棕 */
  --color-accent:       #c9a882;                    /* 原 #818cf8，深色下用更亮的暖金 */
  --color-accent-dim:   rgba(201, 168, 130, 0.12);  /* 原 rgba(129,140,248,0.12) */
  --color-accent-hover: #b8946e;                    /* 原 #6366f1 */
}
```

---

## Layer 2 — 侧边栏重构（`NavRail.tsx` → `Sidebar.tsx`）

**改动文件：**
- `src/components/nav/NavRail.tsx` → 重命名 + 重写为 `Sidebar.tsx`
- `src/components/nav/CwdPicker.tsx` — 从 AppShell TopBar 移入 Sidebar
- `src/AppShell.tsx` — 更新引用，从 TopBar 移除 CwdPicker

**预计耗时：** 2–3 小时  
**风险：** 中（涉及组件拆解，但逻辑不变）

### 结构（四个区域）

```
Sidebar (220px, fixed)
├── Zone 1 — App Header
│     "HappyCode" 标题（14px, font-weight 700）
│
├── Zone 2 — Navigation（带图标+文字标签）
│     Chat | Sessions | MCP | Skills | Hooks
│     Active 状态：左边框 2px accent + surface-3 背景
│
├── Zone 3 — Project + Recent Sessions（flex-grow: 1）
│     CwdPicker：显示当前项目路径，可点击更换
│     "RECENT" 标签
│     会话列表：标题 + 项目名 + 相对时间
│       - 运行中：绿色状态点
│       - 当前激活：surface-3 背景高亮
│
└── Zone 4 — Bottom Bar
      [＋ 新对话] 按钮（flex-grow: 1）
      [⚙ Settings] 图标按钮
      [Init] 图标按钮（仅 cwd 已选且未运行时显示）
```

### 会话列表数据来源

读取现有 `session-store`（IPC `session:list`），展示最近 15 条，按 `updatedAt` 降序排列。点击会话触发 `tab-store.setSessionForResume(sessionId)`。

---

## Layer 3 — Chat 区布局（`AppShell.tsx` + `ChatPanel.tsx`）

**改动文件：**
- `src/AppShell.tsx` — 移除 TabBar，精简 TopBar → SessionBar
- `src/components/chat/ChatPanel.tsx` — 消息容器加 max-width 居中
- `src/components/chat/PromptInput.tsx` — input 居中对齐

**预计耗时：** 1–2 小时  
**风险：** 低（布局 CSS 为主）

### TopBar → SessionBar

```
SessionBar (height: 38px)
├── 左：当前会话名称（12px, font-weight 600, color-text）
├── 中：flex spacer
└── 右：费用（$0.0042）· token 数（1.2k tok）· 主题切换图标
```

`WebkitAppRegion: drag` 保留在 SessionBar 背景区域，交互元素设 `no-drag`。

### 消息区居中

```css
.chat-messages-container {
  max-width: 600px;
  margin: 0 auto;
  width: 100%;
  padding: 16px 0;
}
```

消息气泡样式：
- 用户消息：`border-radius: 16px 16px 3px 16px`，`background: --color-surface-3`
- Claude 消息：`border-radius: 3px 16px 16px 16px`，`background: #fff`（浅色）/ `--color-surface-2`（深色），`box-shadow: 0 1px 4px rgba(0,0,0,0.06)`
- Tool call 气泡：`background: --color-surface-2`，带文件/工具图标前缀

### Input 居中

```css
.prompt-input-wrapper {
  max-width: 600px;
  margin: 0 auto;
  width: 100%;
}
.prompt-input {
  border-radius: 14px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.04);
}
```

### 多 session 处理

TabBar 移除后，多 session 能力通过：
1. 侧边栏 "＋ 新对话" 按钮创建新 tab（调用现有 `tab-store.addTab`）
2. 运行中的 session 在 Recent 列表以 `●` 绿色状态点标识
3. 同一 `cwd` 下有多个运行 session 时，Recent 列表各自独立显示

---

## 文件改动总览

| 文件 | 改动类型 | Layer |
|------|---------|-------|
| `src/styles.css` | token 替换 | 1 |
| `src/components/nav/NavRail.tsx` | 重命名 + 重写为 `Sidebar.tsx` | 2 |
| `src/components/nav/CwdPicker.tsx` | 移入 Sidebar（逻辑不变） | 2 |
| `src/AppShell.tsx` | 更新引用；移除 TabBar；精简 TopBar | 2 + 3 |
| `src/components/chat/ChatPanel.tsx` | 消息容器居中 | 3 |
| `src/components/chat/PromptInput.tsx` | input 居中 | 3 |
| `src/components/chat/MessageBubble.tsx` | 更新气泡样式 | 3 |

`TabBar.tsx` 在 Layer 3 完成后可删除（或保留但不挂载）。

---

## 不在本次范围内

- 深色主题完整暖色改造（仅改 Accent，背景保持冷黑）
- 字体变更（保留现有 Geist）
- Settings / MCP / Hooks / Skills 等页面的视觉升级
- 动画 / 过渡效果优化
- 消息搜索功能

---

## 验收标准

- [ ] Layer 1：浅色主题下，Accent 和所有背景呈暖米色调，无遗漏的 Indigo 残留
- [ ] Layer 1：深色主题视觉无明显退步（Accent 改为暖棕，其余不变）
- [ ] Layer 2：Sidebar 正确展示导航 + 近期会话；点击会话可恢复聊天
- [ ] Layer 2：CwdPicker 在 Sidebar 内可正常选择项目路径
- [ ] Layer 3：消息区在常见宽度（1280px+）下居中显示，两侧留白
- [ ] Layer 3：去掉 TabBar 后，多 session 仍可通过 "＋ 新对话" 并行运行
- [ ] Layer 3：SessionBar 正确显示会话名、费用、token 数
