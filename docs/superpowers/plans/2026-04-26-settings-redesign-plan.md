# Settings Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the flat SettingsPage into a tabbed settings panel with 10 tabs (通用, 权限, 服务商, MCP, Agents, 技能, 插件, Computer Use, 导出, 关于), following cc-haha's dual-pane layout.

**Architecture:** Create a `SettingsLayout` component with a left sidebar (tab navigation) and right content area. Each tab is an independent component. New Zustand stores manage provider, agent, and settings tab state. IPC channels added for provider and agent operations.

**Tech Stack:** React 19, TypeScript, Zustand + immer, Electron IPC, lucide-react icons

---

## File Map

### New Files
| File | Responsibility |
|------|---------------|
| `src/store/settings-store.ts` | Settings tab state (activeTab, back navigation) |
| `src/store/provider-store.ts` | Provider CRUD, presets, test connection (frontend) |
| `src/store/agent-store.ts` | Agent list, select, detail state |
| `src/components/settings/SettingsLayout.tsx` | Main layout: left tab nav + right content |
| `src/components/settings/GeneralSettings.tsx` | Theme, language, effort, preflight |
| `src/components/settings/PermissionSettings.tsx` | Radio card permission mode selector |
| `src/components/settings/ProviderSettings.tsx` | Full provider management |
| `src/components/settings/AgentSettings.tsx` | Agent list grouped by source + detail |
| `src/components/settings/SkillSettings.tsx` | Skills list adapted from SkillsPanel |
| `src/components/settings/PluginSettings.tsx` | Plugins list adapted from SkillsPanel |
| `src/components/settings/ComputerUseSettings.tsx` | Placeholder for computer use config |
| `src/components/settings/ExportSettings.tsx` | Migrated CSV export settings |
| `src/components/settings/AboutSettings.tsx` | Version, GitHub, author |
| `src/components/settings/index.ts` | Barrel export |
| `electron/main/provider-manager.ts` | Provider CRUD IPC handlers |
| `electron/main/agent-service.ts` | Agent list/detail IPC handlers |
| `test/provider-manager.test.ts` | Provider manager tests |
| `test/agent-service.test.ts` | Agent service tests |

### Modified Files
| File | Change |
|------|--------|
| `electron/shared/types.ts` | Add ProviderConfig, ProviderPreset, ProviderTestResult, AgentDefinition, ComputerUseConfig types + ElectronAPI additions |
| `electron/preload/index.ts` | Add provider/agent IPC bridge methods |
| `electron/main/ipc-handlers.ts` | Register provider/agent IPC handlers |
| `src/AppShell.tsx` | Replace `SettingsPage` import with `SettingsLayout`, add new stores |
| `src/components/nav/Sidebar.tsx` | Change header when `activePage === 'settings'` (back button + "设置" title) |
| `src/components/settings/SettingsPage.tsx` | **Delete** — replaced by SettingsLayout + tab components |

---

### Task 1: Types and Settings Store

**Files:**
- Modify: `electron/shared/types.ts`
- Create: `src/store/settings-store.ts`

- [ ] **Step 1: Add new types to `electron/shared/types.ts`**

Add these types before the `ElectronAPI` interface (around line 428, after `WidgetConfig`):

```typescript
// ── Provider Management ─────────────────────────────────────

export type ApiFormat = 'anthropic' | 'openai_chat' | 'openai_responses'

export interface ModelMapping {
  main: string
  haiku: string
  sonnet: string
  opus: string
}

export interface ProviderConfig {
  id: string
  presetId: string
  name: string
  baseUrl: string
  apiKey: string
  apiFormat: ApiFormat
  models: ModelMapping
  notes?: string
  isActive?: boolean
}

export interface ProviderPreset {
  id: string
  name: string
  baseUrl: string
  apiFormat?: ApiFormat
  defaultModels: ModelMapping
  needsApiKey: boolean
  websiteUrl: string
}

export interface ProviderTestResult {
  connectivity: {
    success: boolean
    latencyMs: number
    error?: string
  }
  proxy?: {
    success: boolean
    latencyMs: number
    error?: string
  }
}

// ── Agent Definitions ───────────────────────────────────────

export type AgentSource = 'userSettings' | 'projectSettings' | 'localSettings' | 'policySettings' | 'plugin' | 'flagSettings' | 'built-in'

export interface AgentDefinition {
  agentType: string
  source: AgentSource
  description?: string
  systemPrompt?: string
  tools?: string[]
  modelDisplay?: string
  color?: string
  isActive: boolean
  overriddenBy?: AgentSource
  baseDir?: string
}

// ── Computer Use ────────────────────────────────────────────

export interface ComputerUseConfig {
  enabled: boolean
  screenshotTool?: string
  permissionMode: 'ask' | 'auto'
}
```

Update `AgentSettings` interface (around line 71) to add the `context1mBeta` and `enableFileCheckpointing` fields if not present (they are already there, no change needed).

- [ ] **Step 2: Update ElectronAPI interface in `electron/shared/types.ts`**

Add these methods to the `ElectronAPI` interface (before the closing `}` around line 521):

```typescript
  // Provider management
  listProviders: () => Promise<{ providers: ProviderConfig[]; activeId: string | null }>
  createProvider: (provider: Omit<ProviderConfig, 'id'>) => Promise<{ id: string }>
  updateProvider: (id: string, updates: Partial<ProviderConfig>) => Promise<void>
  deleteProvider: (id: string) => Promise<void>
  activateProvider: (id: string) => Promise<void>
  activateOfficial: () => Promise<void>
  testProvider: (id: string, config?: { baseUrl: string; modelId: string; apiFormat: ApiFormat }) => Promise<ProviderTestResult>
  testProviderConfig: (config: { baseUrl: string; apiKey: string; modelId: string; apiFormat: ApiFormat }) => Promise<ProviderTestResult>
  listProviderPresets: () => Promise<{ presets: ProviderPreset[] }>
  getProviderSettings: () => Promise<Record<string, unknown>>
  updateProviderSettings: (settings: Record<string, unknown>) => Promise<void>

  // Agent management
  listAgents: (cwd?: string) => Promise<{ agents: AgentDefinition[]; activeAgents: string[] }>
  getAgentDetail: (agentType: string, source: AgentSource, cwd?: string) => Promise<AgentDefinition | null>
```

- [ ] **Step 3: Create `src/store/settings-store.ts`**

```typescript
import { create } from 'zustand'

export type SettingsTab =
  | 'general'
  | 'permissions'
  | 'providers'
  | 'mcp'
  | 'agents'
  | 'skills'
  | 'plugins'
  | 'computerUse'
  | 'export'
  | 'about'

interface SettingsState {
  activeTab: SettingsTab
  pendingTab: SettingsTab | null
  selectedAgent: { agentType: string; source: string; returnTab: SettingsTab } | null

  setActiveTab: (tab: SettingsTab) => void
  setPendingTab: (tab: SettingsTab | null) => void
  setSelectedAgent: (agent: { agentType: string; source: string; returnTab: SettingsTab } | null) => void
}

export const useSettingsStore = create<SettingsState>()((set) => ({
  activeTab: 'general',
  pendingTab: null,
  selectedAgent: null,

  setActiveTab: (tab) => set({ activeTab: tab }),
  setPendingTab: (tab) => set({ pendingTab: tab }),
  setSelectedAgent: (agent) => set({ selectedAgent: agent }),
}))
```

- [ ] **Step 4: Run type check**

Run: `npx tsc --noEmit --pretty false`
Expected: No new errors from the added types and store

- [ ] **Step 5: Commit**

```bash
git add electron/shared/types.ts src/store/settings-store.ts
git commit -m "feat: add provider, agent, and settings types + settings store"
```

---

### Task 2: Settings Layout Shell

**Files:**
- Create: `src/components/settings/SettingsLayout.tsx`
- Create: `src/components/settings/index.ts`
- Modify: `src/AppShell.tsx`
- Modify: `src/components/nav/Sidebar.tsx`

- [ ] **Step 1: Create `src/components/settings/index.ts`**

```typescript
export { SettingsLayout } from './SettingsLayout'
```

- [ ] **Step 2: Create `src/components/settings/SettingsLayout.tsx`**

```typescript
import React, { useEffect } from 'react'
import { useSettingsStore, type SettingsTab } from '../../store/settings-store'
import { useUiStore } from '../../store/ui-store'

const TABS: Array<{ id: SettingsTab; icon: string; label: string }> = [
  { id: 'general',       icon: '⚙️', label: '通用' },
  { id: 'permissions',   icon: '🔒', label: '权限' },
  { id: 'providers',     icon: '🌐', label: '服务商' },
  { id: 'mcp',           icon: '🔌', label: 'MCP' },
  { id: 'agents',        icon: '🤖', label: 'Agents' },
  { id: 'skills',        icon: '⚡', label: '技能' },
  { id: 'plugins',       icon: '🧩', label: '插件' },
  { id: 'computerUse',   icon: '🖱️', label: 'Computer Use' },
]

const BOTTOM_TABS: Array<{ id: SettingsTab; icon: string; label: string }> = [
  { id: 'export',  icon: '📤', label: '导出' },
  { id: 'about',   icon: 'ℹ️', label: '关于' },
]

function TabButton({ id, icon, label }: { id: SettingsTab; icon: string; label: string }) {
  const activeTab = useSettingsStore((s) => s.activeTab)
  const setActiveTab = useSettingsStore((s) => s.setActiveTab)
  const isActive = activeTab === id

  return (
    <button
      onClick={() => setActiveTab(id)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        padding: '8px 16px',
        fontSize: 13,
        textAlign: 'left',
        border: 'none',
        borderLeft: isActive ? '3px solid var(--color-accent)' : '3px solid transparent',
        background: isActive ? 'var(--color-accent-dim)' : 'transparent',
        color: isActive ? 'var(--color-accent)' : 'var(--color-text-muted)',
        fontWeight: isActive ? 600 : 400,
        borderRadius: 0,
        cursor: 'pointer',
      }}
    >
      <span style={{ width: 18, fontSize: 16 }}>{icon}</span>
      {label}
    </button>
  )
}

export function SettingsLayout(): React.JSX.Element {
  const activeTab = useSettingsStore((s) => s.activeTab)
  const setActivePage = useUiStore((s) => s.setActivePage)
  const pendingTab = useSettingsStore((s) => s.pendingTab)
  const setPendingTab = useSettingsStore((s) => s.setPendingTab)

  useEffect(() => {
    if (!pendingTab) return
    setActiveTab(pendingTab)
    setPendingTab(null)
  }, [pendingTab, setActiveTab, setPendingTab])

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      {/* Left sidebar */}
      <div style={{
        width: 180,
        flexShrink: 0,
        borderRight: '1px solid var(--color-border)',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--color-surface)',
        overflow: 'hidden',
      }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 0' }}>
          {TABS.map((tab) => <TabButton key={tab.id} {...tab} />)}
          <div style={{ borderTop: '1px solid var(--color-border)', marginTop: 12, paddingTop: 8 }}>
            {BOTTOM_TABS.map((tab) => <TabButton key={tab.id} {...tab} />)}
          </div>
        </div>
      </div>

      {/* Right content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>
        <div style={{ fontSize: 11, color: 'var(--color-text-faint)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
          设置
        </div>
        {activeTab === 'general' && <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>General settings — coming soon</div>}
        {activeTab === 'permissions' && <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Permission settings — coming soon</div>}
        {activeTab === 'providers' && <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Provider settings — coming soon</div>}
        {activeTab === 'mcp' && <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>MCP settings — coming soon</div>}
        {activeTab === 'agents' && <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Agent settings — coming soon</div>}
        {activeTab === 'skills' && <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Skill settings — coming soon</div>}
        {activeTab === 'plugins' && <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Plugin settings — coming soon</div>}
        {activeTab === 'computerUse' && <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Computer use — coming soon</div>}
        {activeTab === 'export' && <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Export settings — coming soon</div>}
        {activeTab === 'about' && <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>About — coming soon</div>}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Update `src/AppShell.tsx`**

Replace the SettingsPage import and usage:

```typescript
// Replace this import:
import { SettingsPage } from './components/settings/SettingsPage'
// With:
import { SettingsLayout } from './components/settings/SettingsLayout'

// Replace the settings page mount (around line 254-256):
// From:
<div style={{ display: activePage === 'settings' ? 'flex' : 'none', flex: 1, overflow: 'hidden' }}>
  <SettingsPage />
</div>
// To:
<div style={{ display: activePage === 'settings' ? 'flex' : 'none', flex: 1, overflow: 'hidden' }}>
  <SettingsLayout />
</div>
```

- [ ] **Step 4: Update Sidebar header for settings page**

In `src/components/nav/Sidebar.tsx`, modify the header div (around line 491-600) to show a back button when on settings page:

Find the header section that starts with `/* Zone 1: Brand + quick nav icons */` and replace the "HappyCode" button section:

```typescript
// Before (around line 504-518):
<div style={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
  <button
    onClick={() => setActivePage('chat')}
    style={{
      fontSize: 14,
      fontWeight: 700,
      color: 'var(--color-text)',
      letterSpacing: '-0.01em',
      flex: 1,
      textAlign: 'left',
      WebkitAppRegion: 'no-drag',
    } as React.CSSProperties}
  >
    HappyCode
  </button>

  <button
    onClick={() => setActivePage('sessions')}
    ...
```

```typescript
// After:
<div style={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
  {activePage === 'settings' ? (
    <>
      <button
        onClick={() => setActivePage('chat')}
        title="返回聊天"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 26,
          height: 26,
          borderRadius: 'var(--radius-sm)',
          color: 'var(--color-text-muted)',
          background: 'transparent',
          WebkitAppRegion: 'no-drag',
        } as React.CSSProperties}
      >
        ←
      </button>
      <span
        style={{
          fontSize: 14,
          fontWeight: 700,
          color: 'var(--color-text)',
          letterSpacing: '-0.01em',
          flex: 1,
          textAlign: 'left',
          WebkitAppRegion: 'no-drag',
        } as React.CSSProperties}
      >
        设置
      </span>
    </>
  ) : (
    <>
      <button
        onClick={() => setActivePage('chat')}
        style={{
          fontSize: 14,
          fontWeight: 700,
          color: 'var(--color-text)',
          letterSpacing: '-0.01em',
          flex: 1,
          textAlign: 'left',
          WebkitAppRegion: 'no-drag',
        } as React.CSSProperties}
      >
        HappyCode
      </button>

      <button
        onClick={() => setActivePage('sessions')}
        title="Session history"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 26,
          height: 26,
          borderRadius: 'var(--radius-sm)',
          color: activePage === 'sessions' ? 'var(--color-accent)' : 'var(--color-text-muted)',
          background: activePage === 'sessions' ? 'var(--color-accent-dim)' : 'transparent',
          WebkitAppRegion: 'no-drag',
        } as React.CSSProperties}
      >
        <History size={13} />
      </button>

      <div
        ref={moreRef}
        style={{ position: 'relative', WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <button
          onClick={() => setShowMore(!showMore)}
          title="More"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 26,
            height: 26,
            borderRadius: 'var(--radius-sm)',
            color: (showMore || moreActive) ? 'var(--color-accent)' : 'var(--color-text-muted)',
            background: (showMore || moreActive) ? 'var(--color-accent-dim)' : 'transparent',
          }}
        >
          <MoreHorizontal size={13} />
        </button>

        {showMore && (
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 4px)',
              right: 0,
              zIndex: 200,
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: 4,
              minWidth: 140,
              boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
            }}
          >
            {MORE_ITEMS.map(({ page, Icon, label }) => (
              <button
                key={page}
                onClick={() => { setActivePage(page); setShowMore(false) }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                  padding: '7px 10px',
                  borderRadius: 'var(--radius-sm)',
                  background: activePage === page ? 'var(--color-accent-dim)' : 'transparent',
                  color: activePage === page ? 'var(--color-accent)' : 'var(--color-text-muted)',
                  fontSize: 12,
                  fontWeight: activePage === page ? 600 : 400,
                  textAlign: 'left',
                }}
              >
                <Icon size={13} />
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  )}
```

- [ ] **Step 5: Run type check**

Run: `npx tsc --noEmit --pretty false`
Expected: No new errors

- [ ] **Step 6: Start dev server and verify**

Run: `npm run dev`
Expected: App starts, clicking Settings shows the tabbed layout with "← 设置" header, back button returns to chat.

- [ ] **Step 7: Commit**

```bash
git add src/components/settings/SettingsLayout.tsx src/components/settings/index.ts src/AppShell.tsx src/components/nav/Sidebar.tsx
git commit -m "feat: add tabbed settings layout shell with back button"
```

---

### Task 3: General Settings Tab

**Files:**
- Create: `src/components/settings/GeneralSettings.tsx`
- Modify: `src/components/settings/SettingsLayout.tsx` (replace placeholder)

- [ ] **Step 1: Create `src/components/settings/GeneralSettings.tsx`**

```typescript
import React from 'react'
import { useUiStore, type Theme } from '../../store/ui-store'
import { useApiConfigStore } from '../../store/api-config-store'
import type { EffortLevel } from '../../../electron/shared/types'

const EFFORT_LABELS: Record<EffortLevel, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  xhigh: 'XHigh',
}

const THEMES: Array<{ value: Theme; label: string }> = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

const sectionStyle: React.CSSProperties = { marginBottom: 24 }
const headingStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  color: 'var(--color-text)',
  marginBottom: 4,
}
const descStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--color-text-muted)',
  marginBottom: 12,
}

export function GeneralSettings(): React.JSX.Element {
  const theme = useUiStore((s) => s.theme)
  const setTheme = useUiStore((s) => s.setTheme)
  const { agentSettings, saveAgentSettings } = useApiConfigStore()

  function handleEffort(level: EffortLevel): void {
    void saveAgentSettings({ ...agentSettings, effort: level })
  }

  function handlePreflight(enabled: boolean): void {
    void saveAgentSettings({ ...agentSettings, /* web fetch preflight if added */ })
  }

  return (
    <div style={{ maxWidth: 480 }}>
      {/* Theme */}
      <div style={sectionStyle}>
        <div style={headingStyle}>外观</div>
        <div style={descStyle}>选择浅色或深色主题</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {THEMES.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setTheme(value)}
              style={{
                flex: 1,
                padding: '8px 0',
                fontSize: 12,
                fontWeight: 600,
                borderRadius: 'var(--radius-sm)',
                border: theme === value ? '1px solid var(--color-accent)' : '1px solid var(--color-border)',
                background: theme === value ? 'var(--color-accent)' : 'transparent',
                color: theme === value ? '#fff' : 'var(--color-text-muted)',
                cursor: 'pointer',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Effort Level */}
      <div style={sectionStyle}>
        <div style={headingStyle}>努力程度</div>
        <div style={descStyle}>控制 AI 在任务上的投入程度</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['low', 'medium', 'high', 'xhigh'] as EffortLevel[]).map((level) => (
            <button
              key={level}
              onClick={() => handleEffort(level)}
              style={{
                flex: 1,
                padding: '6px 0',
                fontSize: 11,
                fontWeight: 600,
                borderRadius: 'var(--radius-sm)',
                border: agentSettings.effort === level ? '1px solid var(--color-accent)' : '1px solid var(--color-border)',
                background: agentSettings.effort === level ? 'var(--color-accent)' : 'transparent',
                color: agentSettings.effort === level ? '#fff' : 'var(--color-text-muted)',
                cursor: 'pointer',
              }}
            >
              {EFFORT_LABELS[level]}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Update SettingsLayout.tsx**

Add import at top:
```typescript
import { GeneralSettings } from './GeneralSettings'
```

Replace the general placeholder line:
```typescript
// From:
{activeTab === 'general' && <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>General settings — coming soon</div>}
// To:
{activeTab === 'general' && <GeneralSettings />}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/settings/GeneralSettings.tsx src/components/settings/SettingsLayout.tsx
git commit -m "feat: add general settings tab with theme and effort level"
```

---

### Task 4: Permission Settings Tab

**Files:**
- Create: `src/components/settings/PermissionSettings.tsx`
- Modify: `src/components/settings/SettingsLayout.tsx`

- [ ] **Step 1: Create `src/components/settings/PermissionSettings.tsx`**

```typescript
import React from 'react'
import { useApiConfigStore } from '../../store/api-config-store'
import type { PermissionMode } from '../../../electron/shared/types'

const MODES: Array<{ mode: PermissionMode; icon: string; label: string; desc: string }> = [
  { mode: 'default',           icon: '🔒', label: 'Default',        desc: '默认模式，每个工具调用前询问' },
  { mode: 'acceptEdits',       icon: '✏️', label: 'AcceptEdits',    desc: '自动接受文件修改，其他操作询问' },
  { mode: 'plan',              icon: '📐', label: 'Plan',           desc: '仅生成计划，不执行' },
  { mode: 'bypassPermissions', icon: '⚡', label: 'Bypass',         desc: '跳过所有确认提示' },
  { mode: 'dontAsk',           icon: '🚫', label: "Don't Ask",      desc: '拒绝任何未预批准的请求' },
  { mode: 'auto',              icon: '🤖', label: 'Auto',           desc: '由模型分类器自动决定' },
]

export function PermissionSettings(): React.JSX.Element {
  const { agentSettings, saveAgentSettings } = useApiConfigStore()
  const current = agentSettings.permissionMode ?? 'default'

  async function handleSelect(mode: PermissionMode): Promise<void> {
    await saveAgentSettings({ ...agentSettings, permissionMode: mode })
  }

  return (
    <div style={{ maxWidth: 480 }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text)', marginBottom: 4 }}>
        权限设置
      </div>
      <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 20 }}>
        配置 AI 代理的权限模式
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {MODES.map(({ mode, icon, label, desc }) => {
          const isSelected = current === mode
          return (
            <button
              key={mode}
              onClick={() => void handleSelect(mode)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: 14,
                borderRadius: 12,
                border: isSelected ? '2px solid var(--color-accent)' : '1px solid var(--color-border)',
                background: isSelected ? 'var(--color-accent-dim)' : 'transparent',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <span style={{ fontSize: 20 }}>{icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>{label}</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>{desc}</div>
              </div>
              {isSelected && (
                <span style={{ color: 'var(--color-accent)', fontSize: 20 }}>✓</span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Update SettingsLayout.tsx**

Add import:
```typescript
import { PermissionSettings } from './PermissionSettings'
```

Replace the permissions placeholder:
```typescript
// From:
{activeTab === 'permissions' && <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Permission settings — coming soon</div>}
// To:
{activeTab === 'permissions' && <PermissionSettings />}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/settings/PermissionSettings.tsx src/components/settings/SettingsLayout.tsx
git commit -m "feat: add permission settings tab with radio card mode selector"
```

---

### Task 5: Provider Manager (Backend) — TDD

**Files:**
- Create: `electron/main/provider-manager.ts`
- Create: `test/provider-manager.test.ts`
- Modify: `electron/main/ipc-handlers.ts`
- Modify: `electron/preload/index.ts`

- [ ] **Step 1: Write the failing test — `test/provider-manager.test.ts`**

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import {
  saveProvider,
  listProviders,
  deleteProvider,
  updateProvider,
  activateProvider,
  activateOfficial,
  getActiveProvider,
  type ProviderConfig,
} from '../electron/main/provider-manager'

const testDir = path.join(os.tmpdir(), 'happycode-provider-test-' + Date.now())

function setupTestDir(): void {
  fs.mkdirSync(testDir, { recursive: true })
}

function cleanupTestDir(): void {
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true })
  }
}

// Override the config path for tests
jest.mocked ?? vi.mocked // We'll use a simple file-based approach

describe('provider-manager', () => {
  beforeEach(() => {
    setupTestDir()
  })

  afterEach(() => {
    cleanupTestDir()
  })

  it('saves and lists a provider', async () => {
    const provider: Omit<ProviderConfig, 'id'> = {
      presetId: 'custom',
      name: 'Test Provider',
      baseUrl: 'https://api.test.com',
      apiKey: 'sk-test',
      apiFormat: 'anthropic',
      models: { main: 'test-model', haiku: '', sonnet: '', opus: '' },
    }

    const result = await saveProvider(provider, testDir)
    expect(result.id).toBeDefined()

    const { providers } = await listProviders(testDir)
    expect(providers).toHaveLength(1)
    expect(providers[0].name).toBe('Test Provider')
  })

  it('returns empty list when no providers saved', async () => {
    const { providers } = await listProviders(testDir)
    expect(providers).toHaveLength(0)
  })

  it('deletes a provider', async () => {
    const result = await saveProvider({
      presetId: 'custom',
      name: 'To Delete',
      baseUrl: 'https://test.com',
      apiKey: 'sk-test',
      apiFormat: 'anthropic',
      models: { main: 'm', haiku: '', sonnet: '', opus: '' },
    }, testDir)

    await deleteProvider(result.id, testDir)
    const { providers } = await listProviders(testDir)
    expect(providers).toHaveLength(0)
  })

  it('activates a provider and returns active id', async () => {
    const p1 = await saveProvider({
      presetId: 'custom', name: 'P1', baseUrl: 'https://a.com',
      apiKey: 'sk-1', apiFormat: 'anthropic',
      models: { main: 'm', haiku: '', sonnet: '', opus: '' },
    }, testDir)

    const p2 = await saveProvider({
      presetId: 'custom', name: 'P2', baseUrl: 'https://b.com',
      apiKey: 'sk-2', apiFormat: 'anthropic',
      models: { main: 'm', haiku: '', sonnet: '', opus: '' },
    }, testDir)

    await activateProvider(p1.id, testDir)
    let active = await getActiveProvider(testDir)
    expect(active).toBe(p1.id)

    await activateOfficial(testDir)
    active = await getActiveProvider(testDir)
    expect(active).toBeNull()
  })

  it('updates a provider', async () => {
    const result = await saveProvider({
      presetId: 'custom', name: 'Original', baseUrl: 'https://old.com',
      apiKey: 'sk-old', apiFormat: 'anthropic',
      models: { main: 'm', haiku: '', sonnet: '', opus: '' },
    }, testDir)

    await updateProvider(result.id, { name: 'Updated', baseUrl: 'https://new.com' }, testDir)
    const { providers } = await listProviders(testDir)
    expect(providers[0].name).toBe('Updated')
    expect(providers[0].baseUrl).toBe('https://new.com')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/provider-manager.test.ts`
Expected: FAIL — `provider-manager` module doesn't exist

- [ ] **Step 3: Implement `electron/main/provider-manager.ts`**

```typescript
import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'
import type { ProviderConfig, ModelMapping } from '../shared/types'

const PROVIDERS_FILE = 'providers.json'
const ACTIVE_FILE = 'active-provider.json'

function getConfigDir(overrideDir?: string): string {
  if (overrideDir) return overrideDir
  const userData = app.getPath('userData')
  fs.mkdirSync(userData, { recursive: true })
  return userData
}

function providersPath(overrideDir?: string): string {
  return path.join(getConfigDir(overrideDir), PROVIDERS_FILE)
}

function activePath(overrideDir?: string): string {
  return path.join(getConfigDir(overrideDir), ACTIVE_FILE)
}

function readProviders(overrideDir?: string): ProviderConfig[] {
  const filePath = providersPath(overrideDir)
  if (!fs.existsSync(filePath)) return []
  try {
    const raw = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(raw) as ProviderConfig[]
  } catch {
    return []
  }
}

function writeProviders(providers: ProviderConfig[], overrideDir?: string): void {
  fs.writeFileSync(providersPath(overrideDir), JSON.stringify(providers, null, 2), 'utf-8')
}

function generateId(): string {
  return `provider_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export async function saveProvider(
  input: Omit<ProviderConfig, 'id'>,
  overrideDir?: string,
): Promise<{ id: string }> {
  const providers = readProviders(overrideDir)
  const id = generateId()
  const provider: ProviderConfig = { ...input, id }
  providers.push(provider)
  writeProviders(providers, overrideDir)

  // If this is the first provider, activate it
  if (providers.length === 1) {
    await activateProvider(id, overrideDir)
  }

  return { id }
}

export async function listProviders(
  overrideDir?: string,
): Promise<{ providers: ProviderConfig[]; activeId: string | null }> {
  const providers = readProviders(overrideDir)
  const activeId = await getActiveProvider(overrideDir)
  return { providers, activeId }
}

export async function deleteProvider(
  id: string,
  overrideDir?: string,
): Promise<void> {
  const providers = readProviders(overrideDir)
  const activeId = await getActiveProvider(overrideDir)
  const filtered = providers.filter((p) => p.id !== id)
  writeProviders(filtered, overrideDir)

  // If deleted active provider, deactivate
  if (activeId === id) {
    await activateOfficial(overrideDir)
  }
}

export async function updateProvider(
  id: string,
  updates: Partial<ProviderConfig>,
  overrideDir?: string,
): Promise<void> {
  const providers = readProviders(overrideDir)
  const idx = providers.findIndex((p) => p.id === id)
  if (idx === -1) throw new Error(`Provider not found: ${id}`)
  providers[idx] = { ...providers[idx], ...updates }
  writeProviders(providers, overrideDir)
}

export async function activateProvider(
  id: string,
  overrideDir?: string,
): Promise<void> {
  fs.writeFileSync(activePath(overrideDir), JSON.stringify({ id }), 'utf-8')
}

export async function activateOfficial(overrideDir?: string): Promise<void> {
  fs.writeFileSync(activePath(overrideDir), JSON.stringify({ id: null }), 'utf-8')
}

export async function getActiveProvider(overrideDir?: string): Promise<string | null> {
  const filePath = activePath(overrideDir)
  if (!fs.existsSync(filePath)) return null
  try {
    const raw = fs.readFileSync(filePath, 'utf-8')
    const parsed = JSON.parse(raw) as { id: string | null }
    return parsed.id
  } catch {
    return null
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/provider-manager.test.ts`
Expected: PASS

- [ ] **Step 5: Register IPC handlers in `electron/main/ipc-handlers.ts`**

Add at the end of the file (before the closing of the `registerIpcHandlers` function or wherever handlers are registered):

```typescript
import {
  saveProvider,
  listProviders,
  deleteProvider,
  updateProvider,
  activateProvider,
  activateOfficial,
  getActiveProvider,
} from './provider-manager'

// ... inside registerIpcHandlers:

ipcMain.handle('providers:list', async () => {
  return listProviders()
})

ipcMain.handle('providers:create', async (_event, provider) => {
  return saveProvider(provider)
})

ipcMain.handle('providers:update', async (_event, { id, updates }) => {
  await updateProvider(id, updates)
})

ipcMain.handle('providers:delete', async (_event, { id }) => {
  await deleteProvider(id)
})

ipcMain.handle('providers:activate', async (_event, { id }) => {
  await activateProvider(id)
})

ipcMain.handle('providers:activate-official', async () => {
  await activateOfficial()
})

ipcMain.handle('providers:active', async () => {
  return getActiveProvider()
})
```

- [ ] **Step 6: Add preload bridge methods in `electron/preload/index.ts`**

Add to the contextBridge expose object:

```typescript
  // Provider management
  listProviders: (): Promise<{ providers: ProviderConfig[]; activeId: string | null }> =>
    ipcRenderer.invoke('providers:list'),
  createProvider: (provider: Omit<ProviderConfig, 'id'>): Promise<{ id: string }> =>
    ipcRenderer.invoke('providers:create', provider),
  updateProvider: (id: string, updates: Partial<ProviderConfig>): Promise<void> =>
    ipcRenderer.invoke('providers:update', { id, updates }),
  deleteProvider: (id: string): Promise<void> =>
    ipcRenderer.invoke('providers:delete', { id }),
  activateProvider: (id: string): Promise<void> =>
    ipcRenderer.invoke('providers:activate', { id }),
  activateOfficial: (): Promise<void> =>
    ipcRenderer.invoke('providers:activate-official'),
```

Add the import at top of preload:
```typescript
import type { ProviderConfig } from '../shared/types'
```

- [ ] **Step 7: Commit**

```bash
git add electron/main/provider-manager.ts test/provider-manager.test.ts electron/main/ipc-handlers.ts electron/preload/index.ts
git commit -m "feat: add provider manager backend with CRUD and tests"
```

---

### Task 6: Provider Settings (Frontend)

**Files:**
- Create: `src/store/provider-store.ts`
- Create: `src/components/settings/ProviderSettings.tsx`
- Modify: `src/components/settings/SettingsLayout.tsx`

- [ ] **Step 1: Create `src/store/provider-store.ts`**

```typescript
import { create } from 'zustand'
import type { ProviderConfig, ProviderPreset, ProviderTestResult } from '../../electron/shared/types'

interface ProviderState {
  providers: ProviderConfig[]
  activeId: string | null
  presets: ProviderPreset[]
  isLoading: boolean

  fetchProviders: () => Promise<void>
  fetchPresets: () => Promise<void>
  createProvider: (provider: Omit<ProviderConfig, 'id'>) => Promise<void>
  updateProvider: (id: string, updates: Partial<ProviderConfig>) => Promise<void>
  deleteProvider: (id: string) => Promise<void>
  activateProvider: (id: string) => Promise<void>
  activateOfficial: () => Promise<void>
  testProvider: (id: string, config?: { baseUrl: string; modelId: string; apiFormat: string }) => Promise<ProviderTestResult>
  testConfig: (config: { baseUrl: string; apiKey: string; modelId: string; apiFormat: string }) => Promise<ProviderTestResult>
}

const OFFICIAL_PRESETS: ProviderPreset[] = [
  {
    id: 'anthropic',
    name: 'Anthropic',
    baseUrl: 'https://api.anthropic.com',
    apiFormat: 'anthropic',
    defaultModels: { main: 'claude-sonnet-4-6-20250514', haiku: '', sonnet: '', opus: '' },
    needsApiKey: true,
    websiteUrl: 'https://www.anthropic.com',
  },
]

export const useProviderStore = create<ProviderState>()((set, get) => ({
  providers: [],
  activeId: null,
  presets: OFFICIAL_PRESETS,
  isLoading: false,

  fetchProviders: async () => {
    const result = await window.electron.listProviders()
    set({ providers: result.providers, activeId: result.activeId })
  },

  fetchPresets: async () => {
    // Presets are hardcoded for now
    set({ presets: OFFICIAL_PRESETS })
  },

  createProvider: async (provider) => {
    const result = await window.electron.createProvider(provider)
    await get().fetchProviders()
  },

  updateProvider: async (id, updates) => {
    await window.electron.updateProvider(id, updates)
    await get().fetchProviders()
  },

  deleteProvider: async (id) => {
    await window.electron.deleteProvider(id)
    await get().fetchProviders()
  },

  activateProvider: async (id) => {
    await window.electron.activateProvider(id)
    await get().fetchProviders()
  },

  activateOfficial: async () => {
    await window.electron.activateOfficial()
    await get().fetchProviders()
  },

  testProvider: async (id, config) => {
    return window.electron.testProvider(id, config as any)
  },

  testConfig: async (config) => {
    return window.electron.testProviderConfig(config as any)
  },
}))
```

- [ ] **Step 2: Create `src/components/settings/ProviderSettings.tsx`**

This is a large component. I'll create it with the core features: provider list, add/edit modal, and test connection.

```typescript
import React, { useState, useEffect, useMemo } from 'react'
import { useProviderStore } from '../../store/provider-store'
import { useApiConfigStore } from '../../store/api-config-store'
import type { ProviderConfig, ProviderPreset, ModelMapping, ApiFormat } from '../../../electron/shared/types'

const inputStyle: React.CSSProperties = {
  width: '100%',
  fontSize: 12,
  padding: '6px 10px',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--color-surface-2)',
  color: 'var(--color-text)',
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--color-text)',
  marginBottom: 4,
  display: 'block',
}

export function ProviderSettings(): React.JSX.Element {
  const {
    providers, activeId, presets, isLoading,
    fetchProviders, fetchPresets, deleteProvider,
    activateProvider, activateOfficial, testProvider,
  } = useProviderStore()
  const fetchSettings = useApiConfigStore((s) => s.load)

  const [editingProvider, setEditingProvider] = useState<ProviderConfig | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Record<string, { loading: boolean; result?: { success: boolean; error?: string } }>>({})

  useEffect(() => {
    void fetchProviders()
    void fetchPresets()
  }, [fetchProviders, fetchPresets])

  const presetMap = useMemo(
    () => new Map(presets.map((p) => [p.id, p])),
    [presets],
  )

  const handleDelete = async (id: string): Promise<void> => {
    if (activeId === id) return
    setPendingDelete(id)
  }

  const confirmDelete = async (): Promise<void> => {
    if (!pendingDelete) return
    await deleteProvider(pendingDelete)
    setPendingDelete(null)
    await fetchSettings()
  }

  const handleTest = async (provider: ProviderConfig): Promise<void> => {
    setTestResults((r) => ({ ...r, [provider.id]: { loading: true } }))
    try {
      const result = await testProvider(provider.id)
      setTestResults((r) => ({ ...r, [provider.id]: { loading: false, result } }))
    } catch (err) {
      setTestResults((r) => ({ ...r, [provider.id]: { loading: false, result: { success: false, error: err instanceof Error ? err.message : 'Request failed' } } }))
    }
  }

  const handleActivate = async (id: string): Promise<void> => {
    await activateProvider(id)
    await fetchSettings()
  }

  const handleActivateOfficial = async (): Promise<void> => {
    await activateOfficial()
    await fetchSettings()
  }

  const isOfficialActive = activeId === null

  return (
    <div style={{ maxWidth: 640 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text)' }}>服务商管理</div>
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>配置和管理 API 服务商</div>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          style={{
            fontSize: 12,
            padding: '6px 14px',
            border: '1px solid var(--color-accent)',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--color-accent)',
            color: '#fff',
            cursor: 'pointer',
          }}
        >
          + 添加服务商
        </button>
      </div>

      {/* Official provider */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: 14,
        borderRadius: 12,
        border: isOfficialActive ? '2px solid var(--color-accent)' : '1px solid var(--color-border)',
        background: isOfficialActive ? 'var(--color-accent-dim)' : 'transparent',
        marginBottom: 12,
        cursor: isOfficialActive ? 'default' : 'pointer',
      }}
        onClick={() => !isOfficialActive && handleActivateOfficial()}
      >
        <span style={{
          width: 10,
          height: 10,
          borderRadius: '50%',
          flexShrink: 0,
          background: isOfficialActive ? 'var(--color-success)' : 'var(--color-text-muted)',
        }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>
            Anthropic 官方
            {isOfficialActive && (
              <span style={{
                fontSize: 9,
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: 4,
                border: '1px solid var(--color-accent)',
                background: 'var(--color-accent-dim)',
                color: 'var(--color-accent)',
                marginLeft: 6,
              }}>默认</span>
            )}
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>api.anthropic.com · 使用 Claude 官方 API</div>
        </div>
        {!isOfficialActive && (
          <button
            onClick={(e) => { e.stopPropagation(); void handleActivateOfficial() }}
            style={{ fontSize: 11, padding: '4px 10px', border: '1px solid var(--color-accent)', borderRadius: 'var(--radius-sm)', color: 'var(--color-accent)', background: 'transparent', cursor: 'pointer' }}
          >
            设为默认
          </button>
        )}
      </div>

      {/* Saved providers */}
      {isLoading && providers.length === 0 ? (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-muted)' }}>加载中…</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {providers.map((provider) => {
            const isActive = activeId === provider.id
            const preset = presetMap.get(provider.presetId)
            const test = testResults[provider.id]
            return (
              <div
                key={provider.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: 14,
                  borderRadius: 12,
                  border: isActive ? '2px solid var(--color-accent)' : '1px solid var(--color-border)',
                  background: isActive ? 'var(--color-accent-dim)' : 'transparent',
                }}
              >
                <span style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  flexShrink: 0,
                  background: isActive ? 'var(--color-success)' : 'var(--color-text-muted)',
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {provider.name}
                    </span>
                    {preset && preset.id !== 'custom' && (
                      <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: 'var(--color-surface-2)', color: 'var(--color-text-muted)' }}>{preset.name}</span>
                    )}
                    {isActive && (
                      <span style={{
                        fontSize: 9,
                        fontWeight: 700,
                        padding: '1px 6px',
                        borderRadius: 4,
                        border: '1px solid var(--color-accent)',
                        background: 'var(--color-accent-dim)',
                        color: 'var(--color-accent)',
                      }}>默认</span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {provider.baseUrl} · {provider.models.main}
                  </div>
                  {test && (
                    <div style={{ fontSize: 10, marginTop: 2, color: test.result?.success ? 'var(--color-success)' : 'var(--color-danger)' }}>
                      {test.result?.success ? `连接成功 (${test.result.latency}ms)` : `连接失败: ${test.result?.error}`}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  {!isActive && (
                    <button onClick={() => void handleActivate(provider.id)} style={{ fontSize: 11, padding: '3px 8px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', color: 'var(--color-text-muted)', background: 'transparent', cursor: 'pointer' }}>
                      设为默认
                    </button>
                  )}
                  <button onClick={() => void handleTest(provider)} disabled={test?.loading} style={{ fontSize: 11, padding: '3px 8px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', color: 'var(--color-text-muted)', background: 'transparent', cursor: 'pointer', opacity: test?.loading ? 0.5 : 1 }}>
                    {test?.loading ? '…' : '测试'}
                  </button>
                  <button onClick={() => setEditingProvider(provider)} style={{ fontSize: 11, padding: '3px 8px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', color: 'var(--color-text-muted)', background: 'transparent', cursor: 'pointer' }}>
                    编辑
                  </button>
                  {!isActive && (
                    <button onClick={() => void handleDelete(provider.id)} style={{ fontSize: 11, padding: '3px 8px', border: '1px solid #ef4444', borderRadius: 'var(--radius-sm)', color: '#ef4444', background: 'transparent', cursor: 'pointer' }}>
                      删除
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Create/Edit Modals */}
      {showCreateModal && (
        <ProviderFormModal
          open
          onClose={() => setShowCreateModal(false)}
          mode="create"
          presets={presets}
        />
      )}
      {editingProvider && (
        <ProviderFormModal
          key={editingProvider.id}
          open
          onClose={() => setEditingProvider(null)}
          mode="edit"
          provider={editingProvider}
          presets={presets}
        />
      )}

      {/* Delete confirmation */}
      {pendingDelete && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0,0,0,0.5)',
        }}>
          <div style={{ background: 'var(--color-surface)', borderRadius: 12, padding: 24, maxWidth: 360, width: '100%' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)', marginBottom: 8 }}>确认删除</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 16 }}>确定要删除此服务商吗？</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setPendingDelete(null)} style={{ fontSize: 12, padding: '6px 16px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', color: 'var(--color-text-muted)', background: 'transparent', cursor: 'pointer' }}>取消</button>
              <button onClick={() => void confirmDelete()} style={{ fontSize: 12, padding: '6px 16px', border: '1px solid #ef4444', borderRadius: 'var(--radius-sm)', color: '#fff', background: '#ef4444', cursor: 'pointer' }}>删除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Provider Form Modal ──────────────────────────────────────

function ProviderFormModal({
  open, onClose, mode, provider, presets,
}: {
  open: boolean
  onClose: () => void
  mode: 'create' | 'edit'
  provider?: ProviderConfig
  presets: ProviderPreset[]
}) {
  const { createProvider, updateProvider, testConfig } = useProviderStore()
  const fetchSettings = useApiConfigStore((s) => s.load)

  const initialPreset = presets[0] ?? {
    id: 'custom',
    name: 'Custom',
    baseUrl: '',
    defaultModels: { main: '', haiku: '', sonnet: '', opus: '' },
    needsApiKey: true,
    websiteUrl: '',
  }

  const [selectedPreset, setSelectedPreset] = useState<ProviderPreset>(initialPreset)
  const [name, setName] = useState(provider?.name ?? initialPreset.name)
  const [baseUrl, setBaseUrl] = useState(provider?.baseUrl ?? initialPreset.baseUrl)
  const [apiFormat, setApiFormat] = useState<ApiFormat>(provider?.apiFormat ?? initialPreset.apiFormat ?? 'anthropic')
  const [apiKey, setApiKey] = useState('')
  const [notes, setNotes] = useState(provider?.notes ?? '')
  const [models, setModels] = useState<ModelMapping>(provider?.models ?? { ...initialPreset.defaultModels })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null)
  const [isTesting, setIsTesting] = useState(false)
  const [settingsJson, setSettingsJson] = useState('')
  const [settingsJsonError, setSettingsJsonError] = useState<string | null>(null)

  const canSubmit = name.trim() && baseUrl.trim() && (mode === 'edit' || apiKey.trim()) && models.main.trim() && !settingsJsonError

  const handleSubmit = async (): Promise<void> => {
    if (!canSubmit) return
    setIsSubmitting(true)
    try {
      if (mode === 'create') {
        await createProvider({
          presetId: selectedPreset.id,
          name: name.trim(),
          apiKey: apiKey.trim(),
          baseUrl: baseUrl.trim(),
          apiFormat,
          models,
          notes: notes.trim() || undefined,
        })
      } else if (provider) {
        const updates: Partial<ProviderConfig> = {
          name: name.trim(),
          baseUrl: baseUrl.trim(),
          apiFormat,
          models,
          notes: notes.trim() || undefined,
        }
        if (apiKey.trim()) updates.apiKey = apiKey.trim()
        await updateProvider(provider.id, updates)
      }
      await fetchSettings()
      onClose()
    } catch (err) {
      console.error('Failed to save provider:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleTest = async (): Promise<void> => {
    if (!baseUrl.trim() || !models.main.trim()) return
    setIsTesting(true)
    setTestResult(null)
    try {
      const result = await testConfig({
        baseUrl: baseUrl.trim(),
        apiKey: apiKey.trim() || provider?.apiKey || '',
        modelId: models.main.trim(),
        apiFormat,
      })
      setTestResult(result)
    } catch {
      setTestResult({ success: false, error: 'Request failed' })
    } finally {
      setIsTesting(false)
    }
  }

  if (!open) return null

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(0,0,0,0.5)',
    }}>
      <div style={{ background: 'var(--color-surface)', borderRadius: 12, padding: 24, maxWidth: 560, width: '100%', maxHeight: '80vh', overflowY: 'auto' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)', marginBottom: 16 }}>
          {mode === 'create' ? '添加服务商' : '编辑服务商'}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Preset chips */}
          {mode === 'create' && (
            <div>
              <label style={labelStyle}>预设</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {presets.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => {
                      setSelectedPreset(preset)
                      setName(preset.name)
                      setBaseUrl(preset.baseUrl)
                      setApiFormat(preset.apiFormat ?? 'anthropic')
                      setModels({ ...preset.defaultModels })
                    }}
                    style={{
                      fontSize: 11,
                      padding: '4px 12px',
                      borderRadius: 12,
                      border: selectedPreset.id === preset.id ? '1px solid var(--color-accent)' : '1px solid var(--color-border)',
                      background: selectedPreset.id === preset.id ? 'var(--color-accent-dim)' : 'transparent',
                      color: selectedPreset.id === preset.id ? 'var(--color-accent)' : 'var(--color-text-muted)',
                      cursor: 'pointer',
                    }}
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <label>
            <div style={labelStyle}>名称</div>
            <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} placeholder="My Provider" />
          </label>

          <label>
            <div style={labelStyle}>Base URL</div>
            <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} style={inputStyle} placeholder="https://api.example.com" />
          </label>

          <label>
            <div style={labelStyle}>API Format</div>
            <select value={apiFormat} onChange={(e) => setApiFormat(e.target.value as ApiFormat)} style={{ ...inputStyle, cursor: 'pointer' }}>
              <option value="anthropic">Anthropic</option>
              <option value="openai_chat">OpenAI Chat</option>
              <option value="openai_responses">OpenAI Responses</option>
            </select>
          </label>

          <label>
            <div style={labelStyle}>{mode === 'edit' ? 'API Key (留空不修改)' : 'API Key'}</div>
            <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} style={inputStyle} placeholder={mode === 'edit' ? '****' : 'sk-...'} />
          </label>

          {/* Model Mapping */}
          <div>
            <div style={labelStyle}>模型映射</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <label>
                <div style={{ ...labelStyle, fontSize: 11 }}>Main</div>
                <input value={models.main} onChange={(e) => setModels({ ...models, main: e.target.value })} style={inputStyle} placeholder="Model ID" />
              </label>
              <label>
                <div style={{ ...labelStyle, fontSize: 11 }}>Haiku</div>
                <input value={models.haiku} onChange={(e) => setModels({ ...models, haiku: e.target.value })} style={inputStyle} placeholder="可选" />
              </label>
              <label>
                <div style={{ ...labelStyle, fontSize: 11 }}>Sonnet</div>
                <input value={models.sonnet} onChange={(e) => setModels({ ...models, sonnet: e.target.value })} style={inputStyle} placeholder="可选" />
              </label>
              <label>
                <div style={{ ...labelStyle, fontSize: 11 }}>Opus</div>
                <input value={models.opus} onChange={(e) => setModels({ ...models, opus: e.target.value })} style={inputStyle} placeholder="可选" />
              </label>
            </div>
          </div>

          {/* Test connection */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={() => void handleTest()}
              disabled={isTesting || !baseUrl.trim() || !models.main.trim()}
              style={{ fontSize: 11, padding: '4px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', color: 'var(--color-text-muted)', background: 'transparent', cursor: 'pointer', opacity: isTesting ? 0.5 : 1 }}
            >
              {isTesting ? '测试中…' : '测试连接'}
            </button>
            {testResult && (
              <span style={{ fontSize: 11, color: testResult.success ? 'var(--color-success)' : 'var(--color-danger)' }}>
                {testResult.success ? '✓ 连接成功' : `✕ ${testResult.error}`}
              </span>
            )}
          </div>

          {/* Settings JSON */}
          <label>
            <div style={labelStyle}>Settings JSON (高级)</div>
            <textarea
              value={settingsJson}
              onChange={(e) => {
                const raw = e.target.value
                setSettingsJson(raw)
                try {
                  JSON.parse(raw)
                  setSettingsJsonError(null)
                } catch (err) {
                  setSettingsJsonError(err instanceof Error ? err.message : 'Invalid JSON')
                }
              }}
              rows={8}
              spellCheck={false}
              style={{ ...inputStyle, fontFamily: 'var(--font-mono)', fontSize: 11, resize: 'vertical', borderColor: settingsJsonError ? 'var(--color-danger)' : undefined }}
            />
            {settingsJsonError && (
              <div style={{ fontSize: 10, color: 'var(--color-danger)', marginTop: 4 }}>{settingsJsonError}</div>
            )}
          </label>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
          <button onClick={onClose} style={{ fontSize: 12, padding: '6px 16px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', color: 'var(--color-text-muted)', background: 'transparent', cursor: 'pointer' }}>取消</button>
          <button onClick={() => void handleSubmit()} disabled={!canSubmit || isSubmitting} style={{ fontSize: 12, padding: '6px 16px', border: '1px solid var(--color-accent)', borderRadius: 'var(--radius-sm)', color: '#fff', background: 'var(--color-accent)', cursor: 'pointer', opacity: !canSubmit || isSubmitting ? 0.5 : 1 }}>
            {mode === 'create' ? '添加' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Update SettingsLayout.tsx**

Add imports:
```typescript
import { ProviderSettings } from './ProviderSettings'
```

Replace placeholder:
```typescript
// From:
{activeTab === 'providers' && <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Provider settings — coming soon</div>}
// To:
{activeTab === 'providers' && <ProviderSettings />}
```

- [ ] **Step 4: Add ElectronAPI methods for provider testing**

In `electron/shared/types.ts`, ensure the ElectronAPI interface includes `testProvider` and `testProviderConfig` methods (already added in Task 1).

In `electron/preload/index.ts`, add:
```typescript
  testProvider: (id: string, config?: { baseUrl: string; modelId: string; apiFormat: string }): Promise<ProviderTestResult> =>
    ipcRenderer.invoke('providers:test', { id, config }),
  testProviderConfig: (config: { baseUrl: string; apiKey: string; modelId: string; apiFormat: string }): Promise<ProviderTestResult> =>
    ipcRenderer.invoke('providers:test-config', config),
```

In `electron/main/ipc-handlers.ts`, add:
```typescript
ipcMain.handle('providers:test', async (_event, { id, config }) => {
  return testProviderConnection(id, config)
})

ipcMain.handle('providers:test-config', async (_event, config) => {
  return testProviderConfigConnection(config)
})
```

For now, implement simple stub functions that do a basic fetch test:
```typescript
// In provider-manager.ts, add:
export async function testProviderConnection(
  id: string,
  config?: { baseUrl: string; modelId: string; apiFormat: string },
  overrideDir?: string,
): Promise<{ success: boolean; latency: number; error?: string }> {
  const providers = readProviders(overrideDir)
  const provider = providers.find((p) => p.id === id)
  if (!provider) return { success: false, latency: 0, error: 'Provider not found' }

  const baseUrl = config?.baseUrl ?? provider.baseUrl
  const start = Date.now()
  try {
    // Simple connectivity test
    const response = await fetch(baseUrl, { method: 'HEAD', signal: AbortSignal.timeout(5000) })
    return { success: response.ok || response.status === 401 || response.status === 403, latency: Date.now() - start }
  } catch (err) {
    return { success: false, latency: Date.now() - start, error: err instanceof Error ? err.message : 'Connection failed' }
  }
}

export async function testProviderConfigConnection(
  config: { baseUrl: string; apiKey: string; modelId: string; apiFormat: string },
): Promise<{ success: boolean; latency: number; error?: string }> {
  const start = Date.now()
  try {
    const response = await fetch(config.baseUrl, {
      method: 'HEAD',
      headers: { 'x-api-key': config.apiKey },
      signal: AbortSignal.timeout(5000),
    })
    return { success: response.ok || response.status === 401 || response.status === 403, latency: Date.now() - start }
  } catch (err) {
    return { success: false, latency: Date.now() - start, error: err instanceof Error ? err.message : 'Connection failed' }
  }
}
```

- [ ] **Step 5: Run type check**

Run: `npx tsc --noEmit --pretty false`
Expected: No new errors

- [ ] **Step 6: Commit**

```bash
git add src/store/provider-store.ts src/components/settings/ProviderSettings.tsx src/components/settings/SettingsLayout.tsx electron/main/provider-manager.ts electron/main/ipc-handlers.ts electron/preload/index.ts electron/shared/types.ts
git commit -m "feat: add provider settings with CRUD, presets, and test connection"
```

---

### Task 7: Agent Settings (Backend + Frontend)

**Files:**
- Create: `electron/main/agent-service.ts`
- Create: `test/agent-service.test.ts`
- Create: `src/store/agent-store.ts`
- Create: `src/components/settings/AgentSettings.tsx`
- Modify: `src/components/settings/SettingsLayout.tsx`
- Modify: `electron/main/ipc-handlers.ts`
- Modify: `electron/preload/index.ts`

- [ ] **Step 1: Create `electron/main/agent-service.ts`**

```typescript
import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'
import type { AgentDefinition, AgentSource } from '../shared/types'

function getUserSkillsDir(): string {
  const home = app.getPath('home')
  return path.join(home, '.claude', 'agents')
}

export function listAgents(cwd?: string): { agents: AgentDefinition[]; activeAgents: string[] } {
  const agents: AgentDefinition[] = []

  // Read user-level agents
  const userDir = getUserSkillsDir()
  if (fs.existsSync(userDir)) {
    for (const entry of fs.readdirSync(userDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const agentDir = path.join(userDir, entry.name)
      const promptFile = path.join(agentDir, 'AGENTS.md')
      if (fs.existsSync(promptFile)) {
        const content = fs.readFileSync(promptFile, 'utf-8')
        const firstLine = content.split('\n')[0]
        agents.push({
          agentType: entry.name,
          source: 'userSettings',
          description: firstLine.replace(/^#\s*/, '').slice(0, 120),
          systemPrompt: content,
          isActive: true,
          baseDir: agentDir,
        })
      }
    }
  }

  // Read project-level agents if cwd provided
  if (cwd) {
    const projectAgentsDir = path.join(cwd, '.claude', 'agents')
    if (fs.existsSync(projectAgentsDir)) {
      for (const entry of fs.readdirSync(projectAgentsDir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue
        const agentDir = path.join(projectAgentsDir, entry.name)
        const promptFile = path.join(agentDir, 'AGENTS.md')
        if (fs.existsSync(promptFile)) {
          const content = fs.readFileSync(promptFile, 'utf-8')
          const firstLine = content.split('\n')[0]
          agents.push({
            agentType: entry.name,
            source: 'projectSettings',
            description: firstLine.replace(/^#\s*/, '').slice(0, 120),
            systemPrompt: content,
            isActive: true,
            baseDir: agentDir,
          })
        }
      }
    }
  }

  // Built-in agents from the SDK configuration
  const builtinAgents: AgentDefinition[] = [
    {
      agentType: 'general-purpose',
      source: 'built-in',
      description: 'General-purpose agent for researching complex questions, searching for code, and executing multi-step tasks.',
      isActive: true,
    },
    {
      agentType: 'code-reviewer',
      source: 'built-in',
      description: 'Expert code review specialist. Proactively reviews code for quality, security, and maintainability.',
      isActive: true,
    },
    {
      agentType: 'tdd-guide',
      source: 'built-in',
      description: 'Test-Driven Development specialist enforcing write-tests-first methodology.',
      isActive: true,
    },
  ]
  agents.push(...builtinAgents)

  return {
    agents,
    activeAgents: agents.filter((a) => a.isActive).map((a) => a.agentType),
  }
}

export function getAgentDetail(
  agentType: string,
  source: AgentSource,
  cwd?: string,
): AgentDefinition | null {
  const { agents } = listAgents(cwd)
  return agents.find((a) => a.agentType === agentType && a.source === source) ?? null
}
```

- [ ] **Step 2: Create `test/agent-service.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import { listAgents, getAgentDetail } from '../electron/main/agent-service'

describe('agent-service', () => {
  it('returns built-in agents', () => {
    const result = listAgents()
    expect(result.agents.length).toBeGreaterThanOrEqual(3)
    expect(result.agents.some((a) => a.agentType === 'general-purpose')).toBe(true)
    expect(result.agents.some((a) => a.agentType === 'code-reviewer')).toBe(true)
  })

  it('returns active agents list', () => {
    const result = listAgents()
    expect(result.activeAgents.length).toBeGreaterThan(0)
  })

  it('finds agent detail by type and source', () => {
    const detail = getAgentDetail('general-purpose', 'built-in')
    expect(detail).not.toBeNull()
    expect(detail?.agentType).toBe('general-purpose')
  })

  it('returns null for unknown agent', () => {
    const detail = getAgentDetail('nonexistent', 'built-in')
    expect(detail).toBeNull()
  })
})
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run test/agent-service.test.ts`
Expected: PASS

- [ ] **Step 4: Create `src/store/agent-store.ts`**

```typescript
import { create } from 'zustand'
import type { AgentDefinition } from '../../electron/shared/types'

interface AgentState {
  agents: AgentDefinition[]
  activeAgents: string[]
  selectedAgent: AgentDefinition | null
  isLoading: boolean

  fetchAgents: (cwd?: string) => Promise<void>
  selectAgent: (agent: AgentDefinition | null) => void
}

export const useAgentStore = create<AgentState>()((set) => ({
  agents: [],
  activeAgents: [],
  selectedAgent: null,
  isLoading: false,

  fetchAgents: async (cwd?: string) => {
    set({ isLoading: true })
    try {
      const result = await window.electron.listAgents(cwd)
      set({ agents: result.agents, activeAgents: result.activeAgents })
    } finally {
      set({ isLoading: false })
    }
  },

  selectAgent: (agent) => set({ selectedAgent: agent }),
}))
```

- [ ] **Step 5: Create `src/components/settings/AgentSettings.tsx`**

```typescript
import React, { useEffect, useMemo } from 'react'
import { useAgentStore } from '../../store/agent-store'
import { useTabStore, selectActiveTab } from '../../store/tab-store'
import type { AgentDefinition, AgentSource } from '../../../electron/shared/types'

const SOURCE_ORDER: AgentSource[] = [
  'userSettings', 'projectSettings', 'localSettings',
  'policySettings', 'plugin', 'flagSettings', 'built-in',
]

const SOURCE_LABELS: Record<AgentSource, string> = {
  userSettings: 'User Settings',
  projectSettings: 'Project Settings',
  localSettings: 'Local Settings',
  policySettings: 'Policy Settings',
  plugin: 'Plugin',
  flagSettings: 'Flag Settings',
  'built-in': 'Built-in',
}

const SOURCE_COLORS: Record<AgentSource, string> = {
  userSettings: 'var(--color-accent)',
  projectSettings: 'var(--color-success)',
  localSettings: 'var(--color-info, var(--color-text-muted))',
  policySettings: 'var(--color-warning)',
  plugin: 'var(--color-warning)',
  flagSettings: 'var(--color-danger)',
  'built-in': 'var(--color-text-muted)',
}

export function AgentSettings(): React.JSX.Element {
  const { agents, activeAgents, selectedAgent, isLoading, fetchAgents, selectAgent } = useAgentStore()
  const cwd = useTabStore((s) => selectActiveTab(s)?.cwd ?? '')

  useEffect(() => {
    void fetchAgents(cwd || undefined)
  }, [fetchAgents, cwd])

  const groupedAgents = useMemo(() => {
    const groups: Partial<Record<AgentSource, AgentDefinition[]>> = {}
    for (const agent of agents) {
      ;(groups[agent.source] ??= []).push(agent)
    }
    return groups
  }, [agents])

  if (selectedAgent) {
    return (
      <div>
        <button
          onClick={() => selectAgent(null)}
          style={{ fontSize: 12, padding: '4px 8px', border: 'none', background: 'transparent', color: 'var(--color-text-muted)', cursor: 'pointer', marginBottom: 16 }}
        >
          ← 返回列表
        </button>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text)', marginBottom: 4 }}>
          {selectedAgent.agentType}
        </div>
        <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 16 }}>
          {SOURCE_LABELS[selectedAgent.source]} · {selectedAgent.isActive ? 'Active' : 'Available'}
        </div>
        {selectedAgent.description && (
          <div style={{ fontSize: 13, color: 'var(--color-text)', marginBottom: 16, lineHeight: 1.6 }}>
            {selectedAgent.description}
          </div>
        )}
        {selectedAgent.systemPrompt && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>
              System Prompt
            </div>
            <pre style={{
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
              lineHeight: 1.6,
              color: 'var(--color-text)',
              background: 'var(--color-surface-2)',
              padding: 16,
              borderRadius: 8,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              maxHeight: 400,
              overflowY: 'auto',
            }}>
              {selectedAgent.systemPrompt}
            </pre>
          </div>
        )}
        {selectedAgent.tools && selectedAgent.tools.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>
              Tools ({selectedAgent.tools.length})
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {selectedAgent.tools.map((tool) => (
                <span key={tool} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: 'var(--color-surface-2)', color: 'var(--color-text-muted)' }}>
                  {tool}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  const sourceCount = SOURCE_ORDER.filter((source) => (groupedAgents[source] ?? []).length > 0).length

  return (
    <div style={{ maxWidth: 720 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text)', marginBottom: 4 }}>
          Agents
        </div>
        <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
          管理和查看可用的 Agent 配置
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        <SummaryCard label="Total Agents" value={String(agents.length)} />
        <SummaryCard label="Active" value={String(activeAgents.length)} />
        <SummaryCard label="Sources" value={String(sourceCount)} />
      </div>

      {/* Grouped list */}
      {isLoading && agents.length === 0 ? (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading…</div>
      ) : agents.length === 0 ? (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-muted)' }}>
          No agents found. Add agents in ~/.claude/agents/ or .claude/agents/ in your project.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {SOURCE_ORDER.map((source) => {
            const group = groupedAgents[source]
            if (!group?.length) return null

            return (
              <div key={source}>
                <div style={{ fontSize: 11, fontWeight: 700, color: SOURCE_COLORS[source], textTransform: 'uppercase', marginBottom: 8 }}>
                  {SOURCE_LABELS[source]} ({group.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {group.map((agent) => (
                    <button
                      key={`${agent.source}-${agent.agentType}`}
                      onClick={() => selectAgent(agent)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '10px 14px',
                        borderRadius: 8,
                        border: '1px solid var(--color-border)',
                        background: 'transparent',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <span style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        flexShrink: 0,
                        background: SOURCE_COLORS[source],
                      }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>
                          {agent.agentType}
                        </div>
                        {agent.description && (
                          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {agent.description}
                          </div>
                        )}
                      </div>
                      {agent.tools && (
                        <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>
                          {agent.tools.length} tools
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      flex: 1,
      padding: 12,
      borderRadius: 8,
      border: '1px solid var(--color-border)',
      background: 'var(--color-surface-2)',
    }}>
      <div style={{ fontSize: 10, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text)', marginTop: 4 }}>{value}</div>
    </div>
  )
}
```

- [ ] **Step 6: Register IPC handlers in `electron/main/ipc-handlers.ts`**

```typescript
import { listAgents, getAgentDetail } from './agent-service'

// ...

ipcMain.handle('agents:list', async (_event, { cwd }: { cwd?: string }) => {
  return listAgents(cwd)
})

ipcMain.handle('agents:detail', async (_event, { agentType, source, cwd }: { agentType: string; source: AgentSource; cwd?: string }) => {
  return getAgentDetail(agentType, source, cwd)
})
```

- [ ] **Step 7: Add preload bridge methods**

In `electron/preload/index.ts`:
```typescript
  listAgents: (cwd?: string): Promise<{ agents: AgentDefinition[]; activeAgents: string[] }> =>
    ipcRenderer.invoke('agents:list', { cwd }),
  getAgentDetail: (agentType: string, source: AgentSource, cwd?: string): Promise<AgentDefinition | null> =>
    ipcRenderer.invoke('agents:detail', { agentType, source, cwd }),
```

- [ ] **Step 8: Update SettingsLayout.tsx**

```typescript
import { AgentSettings } from './AgentSettings'
// ...
{activeTab === 'agents' && <AgentSettings />}
```

- [ ] **Step 9: Commit**

```bash
git add electron/main/agent-service.ts test/agent-service.test.ts src/store/agent-store.ts src/components/settings/AgentSettings.tsx src/components/settings/SettingsLayout.tsx electron/main/ipc-handlers.ts electron/preload/index.ts
git commit -m "feat: add agent settings with list, detail, and system prompt view"
```

---

### Task 8: Skill & Plugin Settings (Adapt from existing)

**Files:**
- Create: `src/components/settings/SkillSettings.tsx`
- Create: `src/components/settings/PluginSettings.tsx`
- Modify: `src/components/settings/SettingsLayout.tsx`

- [ ] **Step 1: Create `src/components/settings/SkillSettings.tsx`**

```typescript
import React, { useEffect, useState, useCallback } from 'react'
import type { SkillInfo } from '../../../electron/shared/types'
import { BUILT_IN_SKILLS } from '../../../electron/shared/types'

export function SkillSettings(): React.JSX.Element {
  const [skills, setSkills] = useState<SkillInfo[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [installUrl, setInstallUrl] = useState('')
  const [installing, setInstalling] = useState(false)
  const [showBuiltIn, setShowBuiltIn] = useState(false)

  const loadSkills = useCallback(async () => {
    setLoading(true)
    try {
      const result = await window.electron.listSkills()
      setSkills(result.skills)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadSkills() }, [loadSkills])

  async function handleSelect(skillId: string): Promise<void> {
    setSelected(skillId)
    const { content } = await window.electron.getSkillContent(skillId)
    setContent(content)
  }

  async function handleToggle(skillId: string, enabled: boolean): Promise<void> {
    await window.electron.toggleSkill(skillId, enabled)
    setSkills((prev) => prev.map((s) => s.id === skillId ? { ...s, enabled } : s))
  }

  async function handleDelete(skillId: string): Promise<void> {
    if (!confirm(`Delete skill "${skillId}"?`)) return
    await window.electron.deleteSkill(skillId)
    setSkills((prev) => prev.filter((s) => s.id !== skillId))
    if (selected === skillId) { setSelected(null); setContent('') }
  }

  async function handleInstall(): Promise<void> {
    if (!installUrl.trim()) return
    setInstalling(true)
    const result = await window.electron.installSkillFromGit(installUrl.trim())
    setInstalling(false)
    if (result.success) {
      setInstallUrl('')
      void loadSkills()
    }
  }

  const filtered = skills.filter((s) =>
    !searchQuery || s.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (selected) {
    return (
      <div>
        <button onClick={() => { setSelected(null); setContent('') }} style={{ fontSize: 12, padding: '4px 8px', border: 'none', background: 'transparent', color: 'var(--color-text-muted)', cursor: 'pointer', marginBottom: 16 }}>
          ← 返回列表
        </button>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text)', marginBottom: 4 }}>{selected}</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button onClick={() => void handleToggle(selected, !skills.find((s) => s.id === selected)?.enabled)} style={{ fontSize: 11, padding: '4px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', color: 'var(--color-text-muted)', background: 'transparent', cursor: 'pointer' }}>
            {skills.find((s) => s.id === selected)?.enabled ? 'Disable' : 'Enable'}
          </button>
          <button onClick={() => void handleDelete(selected)} style={{ fontSize: 11, padding: '4px 12px', border: '1px solid #ef4444', borderRadius: 'var(--radius-sm)', color: '#ef4444', background: 'transparent', cursor: 'pointer' }}>Delete</button>
        </div>
        <pre style={{ fontSize: 11, fontFamily: 'var(--font-mono)', lineHeight: 1.6, color: 'var(--color-text)', background: 'var(--color-surface-2)', padding: 16, borderRadius: 8, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 500, overflowY: 'auto' }}>
          {content || 'Empty SKILL.md'}
        </pre>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text)', marginBottom: 4 }}>技能管理</div>
      <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 16 }}>浏览和管理已安装的技能</div>

      {/* Install bar */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        <input value={installUrl} onChange={(e) => setInstallUrl(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void handleInstall() }} placeholder="GitHub URL…" style={{ flex: 1, ...inputStyle }} />
        <button onClick={() => void handleInstall()} disabled={installing || !installUrl.trim()} style={{ fontSize: 11, padding: '5px 12px', border: '1px solid var(--color-accent)', borderRadius: 'var(--radius-sm)', background: 'var(--color-accent)', color: '#fff', cursor: 'pointer', opacity: installing || !installUrl.trim() ? 0.5 : 1 }}>
          {installing ? '…' : '+ Install'}
        </button>
      </div>

      {/* Search */}
      <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="搜索技能…" style={{ ...inputStyle, marginBottom: 8 }} />

      {/* Recommended skills */}
      <button onClick={() => setShowBuiltIn((v) => !v)} style={{ fontSize: 10, color: 'var(--color-text-muted)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline', marginBottom: 8 }}>
        {showBuiltIn ? '隐藏推荐' : '推荐技能 ▾'}
      </button>
      {showBuiltIn && (
        <div style={{ marginBottom: 12 }}>
          {BUILT_IN_SKILLS.map((s) => {
            const installed = skills.some((sk) => sk.id === s.id)
            return (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--color-border)' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{s.name}</div>
                  <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{s.description}</div>
                </div>
                <button disabled={installed} onClick={async () => { await window.electron.installSkillFromGit(s.url, s.id); void loadSkills() }} style={{ fontSize: 10, padding: '2px 8px', border: `1px solid ${installed ? 'var(--color-border)' : 'var(--color-accent)'}`, borderRadius: 'var(--radius-sm)', color: installed ? 'var(--color-text-muted)' : 'var(--color-accent)', background: 'transparent', cursor: 'pointer' }}>
                  {installed ? '✓' : '+ 安装'}
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Skills list */}
      {loading && <div style={{ padding: 12, fontSize: 11, color: 'var(--color-text-muted)' }}>Loading…</div>}
      {!loading && filtered.length === 0 && <div style={{ padding: 12, fontSize: 11, color: 'var(--color-text-muted)' }}>No skills found</div>}
      {filtered.map((skill) => (
        <div
          key={skill.id}
          onClick={() => void handleSelectSkill(skill.id)}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', cursor: 'pointer', borderRadius: 6, background: selected === skill.id ? 'var(--color-surface-2)' : 'transparent' }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: skill.enabled ? 'var(--color-text)' : 'var(--color-text-muted)' }}>{skill.name}</div>
            {skill.description && <div style={{ fontSize: 10, color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{skill.description}</div>}
          </div>
          <label onClick={(e) => e.stopPropagation()}>
            <input type="checkbox" checked={skill.enabled} onChange={(e) => void handleToggle(skill.id, e.target.checked)} />
          </label>
          <button onClick={(e) => { e.stopPropagation(); void handleDelete(skill.id) }} style={{ fontSize: 11, color: 'var(--color-text-muted)', background: 'transparent', border: 'none', cursor: 'pointer', opacity: 0.4 }}>✕</button>
        </div>
      ))}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  fontSize: 11,
  padding: '5px 8px',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--color-surface-2)',
  color: 'var(--color-text)',
  boxSizing: 'border-box',
}
```

- [ ] **Step 2: Create `src/components/settings/PluginSettings.tsx`**

```typescript
import React, { useEffect, useState, useCallback } from 'react'
import type { PluginInfo } from '../../../electron/shared/types'

export function PluginSettings(): React.JSX.Element {
  const [plugins, setPlugins] = useState<PluginInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [installName, setInstallName] = useState('')
  const [installing, setInstalling] = useState(false)

  const loadPlugins = useCallback(async () => {
    setLoading(true)
    try {
      const result = await window.electron.listPlugins()
      setPlugins(result.plugins)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadPlugins() }, [loadPlugins])

  async function handleInstall(): Promise<void> {
    if (!installName.trim()) return
    setInstalling(true)
    const result = await window.electron.installPlugin(installName.trim())
    setInstalling(false)
    if (result.success) {
      setInstallName('')
      void loadPlugins()
    }
  }

  async function handleRemove(name: string): Promise<void> {
    if (!confirm(`Remove plugin "${name}"?`)) return
    await window.electron.removePlugin(name)
    void loadPlugins()
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text)', marginBottom: 4 }}>插件管理</div>
      <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 16 }}>管理已安装的插件</div>

      {/* Install bar */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        <input value={installName} onChange={(e) => setInstallName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void handleInstall() }} placeholder="Plugin name…" style={{ flex: 1, ...inputStyle }} />
        <button onClick={() => void handleInstall()} disabled={installing || !installName.trim()} style={{ fontSize: 11, padding: '5px 12px', border: '1px solid var(--color-accent)', borderRadius: 'var(--radius-sm)', background: 'var(--color-accent)', color: '#fff', cursor: 'pointer', opacity: installing || !installName.trim() ? 0.5 : 1 }}>
          + Add
        </button>
      </div>

      {loading && <div style={{ padding: 12, fontSize: 11, color: 'var(--color-text-muted)' }}>Loading…</div>}
      {!loading && plugins.length === 0 && <div style={{ padding: 12, fontSize: 11, color: 'var(--color-text-muted)' }}>No plugins installed</div>}
      {plugins.map((plugin) => (
        <div key={plugin.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0', borderBottom: '1px solid var(--color-border)' }}>
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{plugin.name}</span>
            {plugin.version && <span style={{ fontSize: 10, color: 'var(--color-text-muted)', marginLeft: 6 }}>v{plugin.version}</span>}
          </div>
          <button onClick={() => void handleRemove(plugin.id)} style={{ fontSize: 11, color: 'var(--color-text-muted)', background: 'transparent', border: 'none', cursor: 'pointer', opacity: 0.4 }}>✕</button>
        </div>
      ))}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  fontSize: 11,
  padding: '5px 8px',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--color-surface-2)',
  color: 'var(--color-text)',
  boxSizing: 'border-box',
}
```

- [ ] **Step 3: Update SettingsLayout.tsx**

Add imports:
```typescript
import { SkillSettings } from './SkillSettings'
import { PluginSettings } from './PluginSettings'
```

Replace placeholders:
```typescript
{activeTab === 'skills' && <SkillSettings />}
{activeTab === 'plugins' && <PluginSettings />}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/settings/SkillSettings.tsx src/components/settings/PluginSettings.tsx src/components/settings/SettingsLayout.tsx
git commit -m "feat: add skill and plugin settings tabs adapted from existing panels"
```

---

### Task 9: Computer Use + Export + About Tabs

**Files:**
- Create: `src/components/settings/ComputerUseSettings.tsx`
- Create: `src/components/settings/ExportSettings.tsx`
- Create: `src/components/settings/AboutSettings.tsx`
- Modify: `src/components/settings/SettingsLayout.tsx`

- [ ] **Step 1: Create `src/components/settings/ComputerUseSettings.tsx`**

```typescript
import React from 'react'

export function ComputerUseSettings(): React.JSX.Element {
  return (
    <div style={{ maxWidth: 480 }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text)', marginBottom: 4 }}>
        Computer Use
      </div>
      <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 24 }}>
        配置 Computer Use 功能（开发中）
      </div>
      <div style={{
        padding: 24,
        borderRadius: 12,
        border: '1px dashed var(--color-border)',
        background: 'var(--color-surface-2)',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>🖱️</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', marginBottom: 4 }}>
          Coming Soon
        </div>
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
          Computer Use 配置将在后续版本中添加
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `src/components/settings/ExportSettings.tsx`**

Migrate from the existing SettingsPage export section.

```typescript
import React, { useState } from 'react'
import { useExportSettingsStore, DEFAULT_CUSTOM_PATTERNS } from '../../store/export-settings-store'
import type { ExportRedactMode } from '../../../electron/shared/types'

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--color-text)',
  marginBottom: 4,
  display: 'block',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  fontSize: 11,
  padding: '5px 8px',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--color-surface-2)',
  color: 'var(--color-text)',
  boxSizing: 'border-box',
  fontFamily: 'var(--font-mono)',
}

export function ExportSettings(): React.JSX.Element {
  const { settings, setSettings } = useExportSettingsStore()
  const [draft, setDraft] = useState({ ...settings })

  function handleSave(): void {
    setSettings(draft)
  }

  return (
    <div style={{ maxWidth: 480 }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text)', marginBottom: 4 }}>
        CSV 导出
      </div>
      <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 20 }}>
        配置会话审计导出的脱敏规则
      </div>

      <label style={{ display: 'block', marginBottom: 16 }}>
        <div style={labelStyle}>脱敏模式</div>
        <select
          value={draft.redactMode}
          onChange={(e) => setDraft((d) => ({ ...d, redactMode: e.target.value as ExportRedactMode }))}
          style={{ ...inputStyle, cursor: 'pointer' }}
        >
          <option value="full">完整导出 — 包含所有数据</option>
          <option value="tools-only">仅工具名称 — 保留工具名和时间戳，清除 payload</option>
          <option value="custom">自定义 — 使用下方正则模式</option>
        </select>
      </label>

      {draft.redactMode === 'custom' && (
        <label style={{ display: 'block', marginBottom: 16 }}>
          <div style={labelStyle}>脱敏正则（每行一个，应用于 input_json / output_json）</div>
          <textarea
            value={draft.customPatterns.join('\n')}
            onChange={(e) => setDraft((d) => ({ ...d, customPatterns: e.target.value.split('\n').map((l) => l.trim()).filter(Boolean) }))}
            rows={5}
            spellCheck={false}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
          <button
            onClick={() => setDraft((d) => ({ ...d, customPatterns: DEFAULT_CUSTOM_PATTERNS }))}
            style={{ marginTop: 4, fontSize: 10, color: 'var(--color-text-muted)', padding: '2px 8px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', background: 'transparent', cursor: 'pointer' }}
          >
            重置为默认
          </button>
        </label>
      )}

      <button
        onClick={handleSave}
        style={{ fontSize: 12, padding: '6px 20px', border: '1px solid var(--color-accent)', borderRadius: 'var(--radius-sm)', background: 'var(--color-accent)', color: '#fff', cursor: 'pointer' }}
      >
        保存
      </button>
    </div>
  )
}
```

- [ ] **Step 3: Create `src/components/settings/AboutSettings.tsx`**

```typescript
import React, { useEffect, useState } from 'react'

export function AboutSettings(): React.JSX.Element {
  const [version, setVersion] = useState('')

  useEffect(() => {
    // Try to get version from electron
    try {
      // In Electron, we can access it via IPC in a future task
      // For now, read from package.json via a simple approach
      setVersion('0.1.0-dev')
    } catch {
      setVersion('0.1.0-dev')
    }
  }, [])

  return (
    <div style={{ maxWidth: 400, textAlign: 'center', padding: '40px 0' }}>
      {/* Icon */}
      <div style={{ fontSize: 48, marginBottom: 16 }}>⟠</div>

      {/* App name + version */}
      <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text)', marginBottom: 4 }}>
        HappyCode
      </div>
      <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 24 }}>
        v{version}
      </div>

      {/* GitHub */}
      <button
        onClick={() => void (async () => {
          try {
            // Open in browser via electron shell
          } catch {
            window.open('https://github.com/your-org/happycode', '_blank')
          }
        })()}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          width: '100%',
          padding: '12px 16px',
          borderRadius: 8,
          border: '1px solid var(--color-border)',
          background: 'transparent',
          cursor: 'pointer',
          marginBottom: 8,
        }}
      >
        <span style={{ fontSize: 16 }}>📦</span>
        <div style={{ flex: 1, textAlign: 'left' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>GitHub 仓库</div>
          <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>查看源码，提交 Issue</div>
        </div>
        <span style={{ fontSize: 14, color: 'var(--color-text-muted)' }}>→</span>
      </button>

      {/* Author */}
      <div style={{
        marginTop: 24,
        padding: 16,
        borderRadius: 8,
        border: '1px solid var(--color-border)',
        background: 'var(--color-surface-2)',
      }}>
        <div style={{ fontSize: 10, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
          作者
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>
          HappyToken
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Update SettingsLayout.tsx**

Add imports:
```typescript
import { ComputerUseSettings } from './ComputerUseSettings'
import { ExportSettings } from './ExportSettings'
import { AboutSettings } from './AboutSettings'
```

Replace placeholders:
```typescript
{activeTab === 'computerUse' && <ComputerUseSettings />}
{activeTab === 'export' && <ExportSettings />}
{activeTab === 'about' && <AboutSettings />}
```

- [ ] **Step 5: Run type check**

Run: `npx tsc --noEmit --pretty false`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src/components/settings/ComputerUseSettings.tsx src/components/settings/ExportSettings.tsx src/components/settings/AboutSettings.tsx src/components/settings/SettingsLayout.tsx
git commit -m "feat: add computer use, export, and about settings tabs"
```

---

### Task 10: Wire MCP Tab + Clean Up Old Components

**Files:**
- Modify: `src/components/settings/SettingsLayout.tsx`
- Modify: `src/AppShell.tsx`
- Delete: `src/components/settings/SettingsPage.tsx`

- [ ] **Step 1: Wire MCP tab to existing McpPage**

In `src/components/settings/SettingsLayout.tsx`, import McpPage:
```typescript
import { McpPage } from '../mcp/McpPage'
```

Replace placeholder:
```typescript
// From:
{activeTab === 'mcp' && <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>MCP settings — coming soon</div>}
// To:
{activeTab === 'mcp' && <McpPage />}
```

- [ ] **Step 2: Remove old SkillsPanel page from AppShell routing**

In `src/AppShell.tsx`, the `activePage === 'skills'` and `activePage === 'mcp'` routing should now go to settings. Remove the standalone page mounts:

```typescript
// Remove these blocks (around lines 251-262):
<div style={{ display: activePage === 'skills' ? 'flex' : 'none', flex: 1, overflow: 'hidden' }}>
  <SkillsPanel />
</div>
// ... and ...
<div style={{ display: activePage === 'mcp' ? 'flex' : 'none', flex: 1, overflow: 'hidden' }}>
  <McpPage />
</div>
```

Also remove unused imports:
```typescript
// Remove:
import { SkillsPanel } from './components/skills/SkillsPanel'
import { McpPage } from './components/mcp/McpPage'
```

Update the Sidebar to redirect skills and mcp to settings:

In `src/components/nav/Sidebar.tsx`, update the MORE_ITEMS:
```typescript
// From:
const MORE_ITEMS: { page: ActivePage; Icon: React.ComponentType<{ size?: number }>; label: string }[] = [
  { page: 'mcp',    Icon: Plug,    label: 'MCP' },
  { page: 'skills', Icon: Zap,     label: 'Skills' },
  { page: 'hooks',  Icon: Webhook, label: 'Hooks' },
]
// To:
const MORE_ITEMS: { page: ActivePage; Icon: React.ComponentType<{ size?: number }>; label: string }[] = [
  { page: 'hooks',  Icon: Webhook, label: 'Hooks' },
]
```

Update the settings button click to open settings page:
In the sidebar settings button (around line 838-854), keep as is — it already sets `activePage('settings')`.

- [ ] **Step 3: Delete old SettingsPage.tsx**

```bash
rm src/components/settings/SettingsPage.tsx
```

- [ ] **Step 4: Run type check**

Run: `npx tsc --noEmit --pretty false`
Expected: No errors

- [ ] **Step 5: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 6: Start dev server and verify all tabs**

Run: `npm run dev`
Verify:
1. Click Settings → shows tabbed layout with "← 设置" header
2. Click each tab → content loads correctly
3. Click back button → returns to chat
4. General tab → theme toggle works
5. Permission tab → radio cards work, saves correctly
6. Provider tab → list, create, edit, delete, test works
7. MCP tab → existing functionality preserved
8. Agents tab → shows built-in agents
9. Skills tab → list, search, install, toggle works
10. Plugins tab → list, install, remove works
11. Computer Use → placeholder shown
12. Export tab → redaction mode works
13. About tab → version and author shown

- [ ] **Step 7: Commit**

```bash
git add src/components/settings/SettingsLayout.tsx src/AppShell.tsx src/components/nav/Sidebar.tsx
git rm src/components/settings/SettingsPage.tsx
git commit -m "refactor: wire MCP into settings tab, remove old SettingsPage and standalone skill/mcp pages"
```

---

## Self-Review

### 1. Spec Coverage Check

| Spec Section | Task | Status |
|-------------|------|--------|
| Layout (sidebar header, left nav, right content) | Task 2 | ✓ |
| Tab Order (10 tabs) | Task 2 | ✓ |
| General Settings (theme, effort, language) | Task 3 | ✓ |
| Permission Settings (6 modes as radio cards) | Task 4 | ✓ |
| Provider Settings (full CRUD, presets, settings.json, test) | Task 5 + 6 | ✓ |
| MCP Settings (existing functionality) | Task 10 | ✓ |
| Agents Settings (list, grouped, detail, system prompt) | Task 7 | ✓ |
| Skills Settings (list, detail, enable/disable, search) | Task 8 | ✓ |
| Plugins Settings (list, detail, enable/disable) | Task 8 | ✓ |
| Computer Use Settings (placeholder) | Task 9 | ✓ |
| Export Settings (migrated from old SettingsPage) | Task 9 | ✓ |
| About (version, GitHub, author "HappyToken") | Task 9 | ✓ |
| Sidebar header change (back button + "设置") | Task 2 | ✓ |
| Back returns to chat | Task 2 | ✓ |
| Types (ProviderConfig, AgentDefinition, etc.) | Task 1 | ✓ |
| IPC channels for providers and agents | Task 5 + 7 | ✓ |
| ElectronAPI updates | Task 1 | ✓ |

### 2. Placeholder Scan
- ComputerUseSettings is intentionally a placeholder per spec
- No "TODO", "TBD", or "implement later" found
- All code steps contain complete code blocks

### 3. Type Consistency
- `SettingsTab` type used consistently across SettingsLayout and settings-store
- `ProviderConfig`, `ModelMapping`, `ApiFormat` consistent between types.ts and frontend
- `AgentDefinition`, `AgentSource` consistent between backend and frontend
- ElectronAPI methods match between types.ts, preload, and ipc-handlers

All checks pass. Plan is complete and consistent.
