# Claude Desktop 风格重设计 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 HappyCode UI 改造成 Claude Desktop 风格——暖米色配色、220px 宽侧边栏（导航+会话列表）、Chat 区居中布局、去掉 TabBar。

**Architecture:** 三层独立可发布：Layer 1 只改 CSS token；Layer 2 新建 Sidebar 组件替换 NavRail；Layer 3 精简 AppShell TopBar + 去掉 TabBar + ChatPanel 消息居中 + MessageBubble 样式更新。

**Tech Stack:** React 19, TypeScript strict, Electron 35, Zustand, electron-vite, vitest

---

## File Map

| 文件 | 操作 | Layer |
|------|------|-------|
| `src/styles.css` | 修改 CSS token | 1 |
| `src/components/nav/Sidebar.tsx` | 新建（替代 NavRail） | 2 |
| `src/components/nav/NavRail.tsx` | 保留不删（防回归），AppShell 停用即可 | 2 |
| `src/AppShell.tsx` | 替换 NavRail→Sidebar；移除 CwdPicker/Init/TabBar；精简 header | 2+3 |
| `src/components/chat/ChatPanel.tsx` | 移除 cwd 显示；消息列表加 max-width 居中容器 | 3 |
| `src/components/chat/MessageBubble.tsx` | 更新气泡 border-radius + 颜色 | 3 |

---

## Task 1: Layer 1 — CSS token 替换

**Files:**
- Modify: `src/styles.css`

- [ ] **Step 1: 替换 `:root`（深色主题）token**

打开 `src/styles.css`，将 `:root` 块整体替换为：

```css
:root {
  /* Background layers */
  --color-bg:        #0f0f11;
  --color-surface:   #1a1a1f;
  --color-surface-2: #242429;
  --color-surface-3: #2e2e35;

  /* Borders — 略加暖调 */
  --color-border:       #2e2a26;
  --color-border-focus: #a0866a;

  /* Text */
  --color-text:       #e8e8ec;
  --color-text-muted: #8b8b9e;
  --color-text-faint: #5a5a6e;

  /* Accent — 暖棕金（替换 Indigo） */
  --color-accent:       #c9a882;
  --color-accent-dim:   rgba(201, 168, 130, 0.12);
  --color-accent-hover: #b8946e;

  /* Status */
  --color-success: #3dd68c;
  --color-warning: #f59e0b;
  --color-danger:  #f87171;
  --color-info:    #60a5fa;

  /* Radius */
  --radius-xs: 2px;
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 10px;
  --radius-xl: 16px;

  /* Typography */
  --font-sans: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-mono: 'Geist Mono', 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
}
```

- [ ] **Step 2: 替换 `[data-theme="light"]`（浅色主题）token**

将 `[data-theme="light"]` 块替换为：

```css
[data-theme="light"] {
  --color-bg:        #faf8f4;
  --color-surface:   #f5f1eb;
  --color-surface-2: #ede8df;
  --color-surface-3: #e6e0d6;

  --color-border:       #e2ddd5;
  --color-border-focus: #a0866a;

  --color-text:       #1c1612;
  --color-text-muted: #6b5e52;
  --color-text-faint: #a8998a;

  --color-accent:       #a0866a;
  --color-accent-dim:   rgba(160, 134, 106, 0.12);
  --color-accent-hover: #8c7055;

  --color-success: #16a34a;
  --color-warning: #d97706;
  --color-danger:  #dc2626;
  --color-info:    #2563eb;
}
```

- [ ] **Step 3: TypeScript 检查**

```bash
npm run typecheck
```

Expected: 0 errors（CSS 改动不影响 TS）

- [ ] **Step 4: Commit**

```bash
git add src/styles.css
git commit -m "feat: Layer 1 — 暖米色 CSS token 替换 Indigo"
```

---

## Task 2: Layer 2 — 新建 Sidebar 组件

**Files:**
- Create: `src/components/nav/Sidebar.tsx`

- [ ] **Step 1: 新建文件 `src/components/nav/Sidebar.tsx`**

```tsx
import React, { useEffect, useState, useCallback } from 'react'
import { MessageSquare, History, Plug, Zap, Webhook, Settings, Plus } from 'lucide-react'
import { useUiStore, type ActivePage } from '../../store/ui-store'
import { useTabStore, selectActiveTab } from '../../store/tab-store'
import { CwdPicker } from './CwdPicker'
import type { SessionInfo } from '../../../electron/shared/types'

interface NavItem {
  page: ActivePage
  Icon: React.ComponentType<{ size?: number }>
  label: string
}

const NAV_ITEMS: NavItem[] = [
  { page: 'chat',     Icon: MessageSquare, label: 'Chat' },
  { page: 'sessions', Icon: History,       label: 'Sessions' },
  { page: 'mcp',      Icon: Plug,          label: 'MCP' },
  { page: 'skills',   Icon: Zap,           label: 'Skills' },
  { page: 'hooks',    Icon: Webhook,       label: 'Hooks' },
]

function formatRelativeTime(ts: number): string {
  const diffMs = Date.now() - ts
  const m = Math.floor(diffMs / 60_000)
  if (m < 1) return '刚刚'
  if (m < 60) return `${m}分钟前`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}小时前`
  return `${Math.floor(h / 24)}天前`
}

export function Sidebar(): React.JSX.Element {
  const activePage = useUiStore((s) => s.activePage)
  const setActivePage = useUiStore((s) => s.setActivePage)

  const cwd = useTabStore((s) => selectActiveTab(s)?.cwd ?? '')
  const setCwd = useTabStore((s) => s.setCwd)
  const activeSessionId = useTabStore((s) => selectActiveTab(s)?.sessionId ?? null)
  const addTab = useTabStore((s) => s.addTab)
  const setSessionForResume = useTabStore((s) => s.setSessionForResume)
  const tabStatuses = useTabStore((s) => s.tabs.map((t) => ({ sessionId: t.sessionId, status: t.status })))

  const [sessions, setSessions] = useState<SessionInfo[]>([])

  const loadSessions = useCallback(async () => {
    if (!cwd) {
      setSessions([])
      return
    }
    try {
      const result = await window.electron.listSessions(cwd)
      setSessions(result.sessions.slice(0, 15))
    } catch {
      setSessions([])
    }
  }, [cwd])

  useEffect(() => { void loadSessions() }, [loadSessions])

  function handleSessionClick(session: SessionInfo): void {
    setActivePage('chat')
    setSessionForResume(session.session_id)
  }

  function handleNewChat(): void {
    addTab(cwd)
    setActivePage('chat')
  }

  return (
    <nav
      style={{
        width: 220,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--color-surface)',
        borderRight: '1px solid var(--color-border)',
        WebkitAppRegion: 'no-drag',
        overflow: 'hidden',
      } as React.CSSProperties}
    >
      {/* Zone 1: App header */}
      <div
        style={{
          padding: '14px 14px 10px',
          borderBottom: '1px solid var(--color-border)',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: 'var(--color-text)',
            letterSpacing: '-0.01em',
          }}
        >
          HappyCode
        </span>
      </div>

      {/* Zone 2: Navigation */}
      <div
        style={{
          padding: '6px 8px',
          borderBottom: '1px solid var(--color-border)',
          flexShrink: 0,
        }}
      >
        {NAV_ITEMS.map(({ page, Icon, label }) => {
          const active = activePage === page
          return (
            <button
              key={page}
              onClick={() => setActivePage(page)}
              title={label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                padding: '6px 10px',
                borderRadius: 'var(--radius-md)',
                marginBottom: 2,
                background: active ? 'var(--color-surface-3)' : 'transparent',
                color: active ? 'var(--color-text)' : 'var(--color-text-muted)',
                fontWeight: active ? 600 : 400,
                fontSize: 12,
                textAlign: 'left',
                borderLeft: active ? '2px solid var(--color-accent)' : '2px solid transparent',
                cursor: 'pointer',
                transition: 'background 0.1s, color 0.1s',
              }}
            >
              <Icon size={14} />
              {label}
            </button>
          )
        })}
      </div>

      {/* Zone 3: Project + Recent sessions */}
      <div
        style={{
          flex: 1,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          padding: '8px 8px 0',
        }}
      >
        <div style={{ marginBottom: 10 }}>
          <CwdPicker cwd={cwd} onChange={setCwd} />
        </div>

        {sessions.length > 0 && (
          <>
            <div
              style={{
                fontSize: 10,
                color: 'var(--color-text-faint)',
                letterSpacing: '0.07em',
                textTransform: 'uppercase',
                padding: '0 4px',
                marginBottom: 4,
                flexShrink: 0,
              }}
            >
              Recent
            </div>
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 1,
              }}
            >
              {sessions.map((s) => {
                const isActive = s.session_id === activeSessionId
                const isRunning = tabStatuses.some(
                  (t) => t.sessionId === s.session_id && t.status === 'running'
                )
                const label =
                  s.title ?? (s.cwd.split('/').pop() ?? s.session_id.slice(0, 8))
                return (
                  <button
                    key={s.session_id}
                    onClick={() => handleSessionClick(s)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      padding: '6px 8px',
                      borderRadius: 'var(--radius-md)',
                      background: isActive ? 'var(--color-surface-3)' : 'transparent',
                      color: 'var(--color-text)',
                      fontSize: 11,
                      textAlign: 'left',
                      width: '100%',
                      gap: 2,
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, width: '100%' }}>
                      {isRunning && (
                        <span
                          style={{
                            width: 5,
                            height: 5,
                            borderRadius: '50%',
                            background: 'var(--color-success)',
                            flexShrink: 0,
                            animation: 'blink 1.2s ease-in-out infinite',
                          }}
                        />
                      )}
                      <span
                        style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          flex: 1,
                          fontWeight: isActive ? 500 : 400,
                        }}
                      >
                        {label}
                      </span>
                    </div>
                    <span style={{ fontSize: 10, color: 'var(--color-text-faint)' }}>
                      {formatRelativeTime(s.last_used)}
                    </span>
                  </button>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* Zone 4: Bottom bar */}
      <div
        style={{
          borderTop: '1px solid var(--color-border)',
          padding: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          flexShrink: 0,
        }}
      >
        <button
          onClick={handleNewChat}
          style={{
            flex: 1,
            padding: '6px 10px',
            background: 'var(--color-surface-2)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-text-muted)',
            fontSize: 12,
            textAlign: 'left',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Plus size={12} />
          新对话
        </button>
        <button
          onClick={() => setActivePage('settings')}
          title="Settings"
          style={{
            width: 30,
            height: 30,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--color-surface-2)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-text-muted)',
            cursor: 'pointer',
          }}
        >
          <Settings size={14} />
        </button>
      </div>
    </nav>
  )
}
```

- [ ] **Step 2: TypeScript 检查**

```bash
npm run typecheck
```

Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/components/nav/Sidebar.tsx
git commit -m "feat: Layer 2 — 新建 Sidebar 组件（220px 宽，导航+会话列表）"
```

---

## Task 3: Layer 2 — AppShell 切换到 Sidebar，移除 CwdPicker/Init

**Files:**
- Modify: `src/AppShell.tsx`

- [ ] **Step 1: 替换 NavRail 为 Sidebar，更新 header**

打开 `src/AppShell.tsx`。做以下改动：

**1. 修改 import 行**，将 `NavRail` 替换为 `Sidebar`：

```tsx
// 删除：
import { NavRail } from './components/nav/NavRail'
// 添加：
import { Sidebar } from './components/nav/Sidebar'
```

同时删除 `CwdPicker` 的 import（它已移入 Sidebar 内部使用）：

```tsx
// 删除这行：
import { CwdPicker } from './components/nav/CwdPicker'
```

**2. 在组件顶部，删除不再需要的变量**（cwd/setCwd/chatStatus/startChatSession 在 AppShell 中只用于 TopBar，稍后 Layer 3 再处理。暂时保留，Layer 3 统一清理）。

**3. 将 JSX 中的 `<NavRail />` 替换为 `<Sidebar />`**：

```tsx
// 改前：
<NavRail />

// 改后：
<Sidebar />
```

**4. 从 header 中移除 CwdPicker 和 Init 按钮**，保留 App 标题、主题切换、版本号：

```tsx
<header
  style={{
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '0 16px',
    height: 44,
    borderBottom: '1px solid var(--color-border)',
    background: 'var(--color-surface)',
    flexShrink: 0,
    WebkitAppRegion: 'drag',
  } as React.CSSProperties}
>
  <span
    style={{
      fontWeight: 700,
      fontSize: 14,
      letterSpacing: '-0.01em',
      color: 'var(--color-text)',
      WebkitAppRegion: 'no-drag',
    } as React.CSSProperties}
  >
    HappyCode
  </span>

  <div style={{ flex: 1 }} />
  <button
    onClick={toggleTheme}
    title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 28,
      height: 28,
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-sm)',
      background: 'transparent',
      color: 'var(--color-text-muted)',
      cursor: 'pointer',
      WebkitAppRegion: 'no-drag',
    } as React.CSSProperties}
  >
    {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
  </button>
  <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>v0.1</span>
</header>
```

- [ ] **Step 2: TypeScript 检查**

```bash
npm run typecheck
```

如有 "Property 'cwd' is declared but its value is never read" 警告，暂时忽略（Layer 3 清理）。Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/AppShell.tsx
git commit -m "feat: Layer 2 — AppShell 切换 Sidebar，移除 TopBar 中的 CwdPicker"
```

---

## Task 4: Layer 3 — AppShell 精简 TopBar → SessionBar，移除 TabBar

**Files:**
- Modify: `src/AppShell.tsx`

- [ ] **Step 1: 在 AppShell 中新增 cost/token 计算**

在 `AppShell` 函数组件内，`theme` / `toggleTheme` 之后，添加：

```tsx
const runningCostUsd = useTabStore((s) =>
  (selectActiveTab(s)?.messages ?? []).reduce(
    (sum, m) => (m.type === 'done' ? sum + m.costUsd : sum),
    0
  )
)
const totalTokens = useTabStore((s) =>
  (selectActiveTab(s)?.messages ?? []).reduce(
    (sum, m) => (m.type === 'done' ? sum + m.inputTokens + m.outputTokens : sum),
    0
  )
)
```

注意：`selectActiveTab` 已在文件顶部 import 进来了。

- [ ] **Step 2: 将 header 替换为 SessionBar（高度 38px，显示会话名+费用）**

```tsx
<header
  style={{
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '0 16px',
    height: 38,
    borderBottom: '1px solid var(--color-border)',
    background: 'var(--color-surface)',
    flexShrink: 0,
    WebkitAppRegion: 'drag',
  } as React.CSSProperties}
>
  <span
    style={{
      fontSize: 12,
      fontWeight: 600,
      color: 'var(--color-text)',
      WebkitAppRegion: 'no-drag',
    } as React.CSSProperties}
  >
    {cwd ? (cwd.split('/').pop() ?? 'HappyCode') : 'HappyCode'}
  </span>

  <div style={{ flex: 1 }} />

  {(runningCostUsd > 0 || totalTokens > 0) && (
    <span
      style={{
        fontSize: 10,
        color: 'var(--color-text-faint)',
        fontFamily: 'var(--font-mono)',
        WebkitAppRegion: 'no-drag',
      } as React.CSSProperties}
    >
      {runningCostUsd > 0
        ? `$${runningCostUsd.toFixed(4)}`
        : `${totalTokens.toLocaleString()} tok`}
    </span>
  )}

  <button
    onClick={toggleTheme}
    title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 26,
      height: 26,
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-sm)',
      background: 'transparent',
      color: 'var(--color-text-muted)',
      cursor: 'pointer',
      WebkitAppRegion: 'no-drag',
    } as React.CSSProperties}
  >
    {theme === 'dark' ? <Sun size={12} /> : <Moon size={12} />}
  </button>
</header>
```

- [ ] **Step 3: 移除 TabBar 渲染**

找到并删除：

```tsx
{/* Tab bar — only shown on chat page */}
{activePage === 'chat' && <TabBar />}
```

同时删除顶部的 import：

```tsx
// 删除：
import { TabBar } from './components/nav/TabBar'
```

- [ ] **Step 4: 清理不再使用的变量**

删除以下已无用的变量声明（它们的功能已移入 Sidebar）：

```tsx
// 删除这几行：
const cwd = useTabStore((s) => selectActiveTab(s)?.cwd ?? '')
const setCwd = useTabStore((s) => s.setCwd)
const chatStatus = useTabStore((s) => selectActiveTab(s)?.status ?? 'idle')
const startChatSession = useTabStore((s) => s.startSession)
```

保留 `cwd` 的读取用于 SessionBar 标题——**只保留读取，不保留 setter**：

```tsx
const cwd = useTabStore((s) => selectActiveTab(s)?.cwd ?? '')
```

- [ ] **Step 5: TypeScript 检查**

```bash
npm run typecheck
```

Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
git add src/AppShell.tsx
git commit -m "feat: Layer 3 — SessionBar 替换 TopBar，移除 TabBar"
```

---

## Task 5: Layer 3 — ChatPanel 消息区居中，精简工具栏

**Files:**
- Modify: `src/components/chat/ChatPanel.tsx`

- [ ] **Step 1: 移除工具栏中的 cwd 显示**

在 `ChatPanel.tsx` 中，找到 Toolbar 区域内显示 cwd 的 `<span>`：

```tsx
// 找到并删除：
<span style={{ fontSize: 11, color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
  {cwd || 'No project path set'}
</span>
```

工具栏中 `<div style={{ flex: 1 }} />` 替代撑开空间，使模型选择器和导出按钮靠右。

- [ ] **Step 2: 为消息列表添加居中容器**

找到消息列表渲染区（含 `filteredMessages.map(...)` 的 `<div>`），在其外层包一层居中容器：

```tsx
{/* 消息区居中容器 */}
<div
  style={{
    flex: 1,
    overflowY: 'auto',
    padding: '16px 24px',
  }}
  ref={/* 如果之前有 ref 就保持不变 */}
>
  <div
    style={{
      maxWidth: 680,
      margin: '0 auto',
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
    }}
  >
    {filteredMessages.map((msg) => (
      <MessageBubble key={msg.id} msg={msg} />
    ))}
    <div ref={bottomRef} />
  </div>
</div>
```

注意：`bottomRef` 必须保留在最内层，否则自动滚动失效。

- [ ] **Step 3: PromptInput 区域也居中**

找到 `<PromptInput ... />` 的外层容器，添加居中样式：

```tsx
<div
  style={{
    padding: '8px 24px 12px',
    borderTop: '1px solid var(--color-border)',
    background: 'var(--color-surface)',
    flexShrink: 0,
  }}
>
  <div style={{ maxWidth: 680, margin: '0 auto', width: '100%' }}>
    <PromptInput
      onSend={handleSend}
      onStop={abortSession}
      disabled={!cwd}
      running={running}
    />
  </div>
</div>
```

- [ ] **Step 4: TypeScript 检查**

```bash
npm run typecheck
```

Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add src/components/chat/ChatPanel.tsx
git commit -m "feat: Layer 3 — ChatPanel 消息区居中（max-width 680px）"
```

---

## Task 6: Layer 3 — MessageBubble 暖色气泡样式

**Files:**
- Modify: `src/components/chat/MessageBubble.tsx`

- [ ] **Step 1: 定位用户消息气泡的样式**

在 `MessageBubble.tsx` 中，找到渲染 `msg.type === 'user'` 的气泡 div（background、borderRadius）。将其更新为：

```tsx
// 用户消息气泡外层容器（靠右对齐）
<div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
  <div
    style={{
      background: 'var(--color-surface-3)',
      borderRadius: '16px 16px 3px 16px',
      padding: '9px 14px',
      maxWidth: '78%',
      color: 'var(--color-text)',
      fontSize: 13,
      lineHeight: 1.55,
    }}
  >
    {msg.text}
  </div>
</div>
```

- [ ] **Step 2: 更新 Claude 文本消息气泡**

找到渲染 `msg.type === 'text'`（Claude 回复）的容器，更新为：

```tsx
<div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'flex-start' }}>
  {/* Claude avatar */}
  <div
    style={{
      width: 22,
      height: 22,
      borderRadius: '50%',
      background: 'var(--color-accent)',
      flexShrink: 0,
      marginTop: 2,
    }}
  />
  <div
    style={{
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: '3px 16px 16px 16px',
      padding: '9px 14px',
      maxWidth: '82%',
      color: 'var(--color-text)',
      fontSize: 13,
      lineHeight: 1.55,
      boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    }}
  >
    {/* ReactMarkdown 渲染，保持原有实现 */}
    <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text}</ReactMarkdown>
  </div>
</div>
```

- [ ] **Step 3: 更新 tool_call 气泡**

找到 `msg.type === 'tool_call'` 的渲染，更新外层容器样式（保持内容不变）：

```tsx
<div
  style={{
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 10px',
    background: 'var(--color-surface-2)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    marginBottom: 4,
    marginLeft: 30, // 与 Claude 头像对齐
    fontSize: 11,
    color: 'var(--color-text-muted)',
  }}
>
  {/* 保持原有的工具图标和文字 */}
</div>
```

- [ ] **Step 4: TypeScript 检查**

```bash
npm run typecheck
```

Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add src/components/chat/MessageBubble.tsx
git commit -m "feat: Layer 3 — MessageBubble 暖色圆角气泡样式"
```

---

## Task 7: 全量验收

- [ ] **Step 1: 运行全部测试**

```bash
npm test
```

Expected: all tests pass（包括 `test/export.test.ts`，它只测试数据逻辑，不涉及 UI）

- [ ] **Step 2: 完整 TypeScript 检查**

```bash
npm run typecheck && npm run typecheck:node && npm run typecheck:web
```

Expected: 0 errors

- [ ] **Step 3: 启动开发模式手动验收**

```bash
npm run dev
```

逐项检查：
- [ ] 浅色主题：背景为暖米色，Accent 为棕金色，无 Indigo 残留
- [ ] 深色主题：背景保持黑色，Accent 改为暖金，视觉无退步
- [ ] Sidebar 宽度 220px，显示 HappyCode 标题、5个导航项、项目路径选择器
- [ ] 选一个有历史的 cwd，Sidebar 底部 Recent 列表显示会话
- [ ] 点击 Recent 会话，恢复到对应 Chat
- [ ] "＋ 新对话" 按钮可创建新 tab
- [ ] SessionBar 显示 cwd 最后一段路径名；有费用时显示费用
- [ ] TabBar 已消失
- [ ] Chat 消息区在宽屏下居中，两侧有留白
- [ ] 用户气泡：右对齐，`border-radius: 16px 16px 3px 16px`
- [ ] Claude 气泡：左对齐，有头像，`border-radius: 3px 16px 16px 16px`

- [ ] **Step 4: 最终 commit**

```bash
git add -p  # 如有漏提交的文件
git commit -m "chore: Layer 3 验收通过"
```
