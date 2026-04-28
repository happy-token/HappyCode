# Hooks 可视化 Phase 2 Implementation Plan

**Goal:** 让 HappyCode 的 Hooks 面板"开箱即用"并支持向导式规则编辑 + 命令测试沙箱。完成后 HooksPanel 不需要用户手动配置即可接收 Claude Code 的所有 hook 事件。

**Branch:** `feat/hooks-visualization`

**Tech Stack:** React 19, TypeScript strict, Electron 35, Zustand, electron-vite, vitest

---

## Current State (已实现)

| 文件 | 状态 |
|------|------|
| `electron/main/hook-server.ts` | ✅ HookServer 类，POST /hook 端点，port 37421 |
| `electron/main/ipc-handlers.ts` | ✅ `hook:list` 已注册 |
| `electron/preload/index.ts` | ✅ `listHookEvents`, `onHookEvent` 已暴露 |
| `src/components/hooks/HooksPanel.tsx` | ✅ Events tab + Config tab（基础表单） |
| `electron/shared/types.ts` | ⚠️ HookType 只有 4 种（需扩展到 12 种） |

**缺失（需实现）：**
- Bridge 自动注入（`~/.claude/hooks/gui-bridge.sh` + settings.json 写入）
- `hook:clear-events`, `hook:bridge-status`, `hook:inject-bridge`, `hook:test-rule` IPC
- 向导式规则编辑器（替换平铺表单）
- Hook 命令测试沙箱（run command → stdout/stderr/exitCode/duration）

---

## File Map

| 文件 | 操作 |
|------|------|
| `electron/shared/types.ts` | 扩展 HookType（4→12），新增 HookBridgeStatus、HookTestResult 类型 |
| `electron/main/bridge-injector.ts` | 新建：写 gui-bridge.sh + 注入 ~/.claude/settings.json |
| `electron/main/ipc-handlers.ts` | 新增：hook:clear-events, hook:bridge-status, hook:inject-bridge, hook:test-rule |
| `electron/main/index.ts` | 调用 injectBridgeHook()（HookServer 启动后） |
| `electron/preload/index.ts` | 暴露：clearHookEvents, getBridgeStatus, injectBridge, testHookRule |
| `src/components/hooks/HookRuleWizard.tsx` | 新建：3步向导（事件选择→matcher→command），Stop hook 警告 |
| `src/components/hooks/HookTestSandbox.tsx` | 新建：run command + mock payload → 结果展示 |
| `src/components/hooks/HooksPanel.tsx` | 修改：Config tab 换向导编辑器；Events tab 加 Clear + bridge 状态 |

---

## Task 1: 扩展类型 + Bridge 注入后端

**Files:**
- Modify: `electron/shared/types.ts`
- Create: `electron/main/bridge-injector.ts`
- Modify: `electron/main/ipc-handlers.ts`
- Modify: `electron/main/index.ts`
- Modify: `electron/preload/index.ts`

### Step 1: 扩展 `electron/shared/types.ts`

**1a. 扩展 HookType（4 → 12 种）：**

```ts
export type HookType =
  | 'PreToolUse'
  | 'PostToolUse'
  | 'PostToolUseFailure'
  | 'UserPromptSubmit'
  | 'Stop'
  | 'SubagentStart'
  | 'SubagentStop'
  | 'SessionStart'
  | 'SessionEnd'
  | 'Notification'
  | 'PreCompact'
```

同时把 `HookEvent.hook_type` 的字符串字面量类型也更新为对应的 12 种（保留 `| string` 兜底）。

**1b. 新增 HookBridgeStatus 类型：**

```ts
export interface HookBridgeStatus {
  injected: boolean          // ~/.claude/settings.json 里是否有 bridge hook
  scriptExists: boolean      // gui-bridge.sh 是否存在
  scriptPath: string         // 完整路径（用于 UI 展示）
}
```

**1c. 新增 HookTestResult 类型：**

```ts
export interface HookTestResult {
  stdout: string
  stderr: string
  exitCode: number | null
  durationMs: number
}
```

**1d. 在 ElectronAPI interface 新增方法签名：**

```ts
clearHookEvents: () => Promise<void>
getBridgeStatus: () => Promise<HookBridgeStatus>
injectBridge: () => Promise<HookBridgeStatus>
testHookRule: (p: { command: string; eventName: string; payload: unknown }) => Promise<HookTestResult>
```

---

### Step 2: 新建 `electron/main/bridge-injector.ts`

```ts
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import type { HookBridgeStatus } from '../shared/types'

const PORT = 37421
const BRIDGE_MARKER = 'happycode-gui-bridge'

const ALL_HOOK_TYPES = [
  'PreToolUse', 'PostToolUse', 'PostToolUseFailure',
  'UserPromptSubmit', 'Stop',
  'SubagentStart', 'SubagentStop',
  'SessionStart', 'SessionEnd',
  'Notification', 'PreCompact',
] as const

function hooksDir(): string {
  return path.join(os.homedir(), '.claude', 'hooks')
}

function scriptPath(): string {
  const isWin = process.platform === 'win32'
  return path.join(hooksDir(), isWin ? 'gui-bridge.ps1' : 'gui-bridge.sh')
}

function settingsPath(): string {
  return path.join(os.homedir(), '.claude', 'settings.json')
}

function writeScript(): string {
  const sp = scriptPath()
  fs.mkdirSync(hooksDir(), { recursive: true })

  if (process.platform === 'win32') {
    fs.writeFileSync(sp, [
      `# ${BRIDGE_MARKER}`,
      `$payload = $input | Out-String`,
      `try {`,
      `  Invoke-RestMethod -Uri "http://127.0.0.1:${PORT}/hook" \\`,
      `    -Method Post -ContentType "application/json" \\`,
      `    -Headers @{"X-Hook-Event" = $env:HOOK_EVENT_NAME} \\`,
      `    -Body $payload -TimeoutSec 2 | Out-Null`,
      `} catch {}`,
      `exit 0`,
    ].join('\n'))
  } else {
    fs.writeFileSync(sp, [
      `#!/bin/bash`,
      `# ${BRIDGE_MARKER}`,
      `payload=$(cat)`,
      `curl -s --max-time 2 -X POST http://127.0.0.1:${PORT}/hook \\`,
      `  -H "Content-Type: application/json" \\`,
      `  -H "X-Hook-Event: \${HOOK_EVENT_NAME}" \\`,
      `  -d "$payload" &`,
      `exit 0`,
    ].join('\n'))
    fs.chmodSync(sp, '755')
  }

  return sp
}

function readSettings(): Record<string, unknown> {
  const sp = settingsPath()
  if (!fs.existsSync(sp)) return {}
  try {
    return JSON.parse(fs.readFileSync(sp, 'utf-8')) as Record<string, unknown>
  } catch {
    return {}
  }
}

function writeSettings(settings: Record<string, unknown>): void {
  const sp = settingsPath()
  fs.mkdirSync(path.dirname(sp), { recursive: true })
  fs.writeFileSync(sp, JSON.stringify(settings, null, 2))
}

export function injectBridgeHook(): HookBridgeStatus {
  const sp = writeScript()
  const isWin = process.platform === 'win32'
  const command = isWin ? `powershell -NonInteractive -File "${sp}"` : sp

  const settings = readSettings()
  const hooks = (settings['hooks'] ?? {}) as Record<string, unknown[]>

  for (const event of ALL_HOOK_TYPES) {
    const existing = (hooks[event] ?? []) as Array<Record<string, unknown>>
    const alreadyInjected = existing.some((h) =>
      String(h['command'] ?? '').includes(BRIDGE_MARKER) ||
      String(h['command'] ?? '').includes('gui-bridge')
    )
    if (!alreadyInjected) {
      hooks[event] = [...existing, { type: 'command', command }]
    }
  }

  settings['hooks'] = hooks
  writeSettings(settings)

  console.log('[BridgeInjector] Bridge hook injected')
  return getBridgeStatus()
}

export function getBridgeStatus(): HookBridgeStatus {
  const sp = scriptPath()
  const scriptExists = fs.existsSync(sp)

  if (!scriptExists) {
    return { injected: false, scriptExists: false, scriptPath: sp }
  }

  const settings = readSettings()
  const hooks = (settings['hooks'] ?? {}) as Record<string, unknown[]>
  const preToolUseHooks = (hooks['PreToolUse'] ?? []) as Array<Record<string, unknown>>
  const injected = preToolUseHooks.some((h) =>
    String(h['command'] ?? '').includes('gui-bridge')
  )

  return { injected, scriptExists, scriptPath: sp }
}
```

---

### Step 3: 修改 `electron/main/ipc-handlers.ts`

在文件末尾（所有已有 handle 之后）新增：

```ts
// Hook 扩展 IPC
ipcMain.handle('hook:clear-events', () => {
  store.clearHookEvents()
})

ipcMain.handle('hook:bridge-status', () => {
  return getBridgeStatus()
})

ipcMain.handle('hook:inject-bridge', () => {
  return injectBridgeHook()
})

ipcMain.handle('hook:test-rule', async (_event, {
  command,
  eventName,
  payload,
}: {
  command: string
  eventName: string
  payload: unknown
}): Promise<HookTestResult> => {
  const { execFile } = await import('node:child_process')
  const start = Date.now()

  return new Promise((resolve) => {
    const isWin = process.platform === 'win32'
    const proc = execFile(
      isWin ? 'powershell' : 'bash',
      isWin ? ['-NonInteractive', '-Command', command] : ['-c', command],
      {
        timeout: 10_000,
        env: { ...process.env, HOOK_EVENT_NAME: eventName },
      }
    )

    let stdout = ''
    let stderr = ''

    proc.stdin?.write(JSON.stringify(payload))
    proc.stdin?.end()
    proc.stdout?.on('data', (d: Buffer) => { stdout += d.toString() })
    proc.stderr?.on('data', (d: Buffer) => { stderr += d.toString() })

    proc.on('close', (exitCode) => {
      resolve({ stdout, stderr, exitCode, durationMs: Date.now() - start })
    })

    proc.on('error', (err) => {
      resolve({ stdout: '', stderr: err.message, exitCode: -1, durationMs: Date.now() - start })
    })
  })
})
```

在文件顶部 import 区域新增：

```ts
import { injectBridgeHook, getBridgeStatus } from './bridge-injector'
import type { HookTestResult } from '../shared/types'
```

Also add `clearHookEvents()` to the session store — check if it already exists. If not, add it to `session-store.ts` (just `db.prepare('DELETE FROM hook_events').run()`).

---

### Step 4: 修改 `electron/main/index.ts`

在 HookServer 启动后（`hookServer.start()` 之后）调用：

```ts
import { injectBridgeHook } from './bridge-injector'
// ...
hookServer.start()
// Auto-inject bridge hook so Claude Code events flow to GUI automatically
try {
  injectBridgeHook()
} catch (err) {
  console.warn('[Main] Bridge hook injection failed (non-fatal):', err)
}
```

---

### Step 5: 修改 `electron/preload/index.ts`

在 `contextBridge.exposeInMainWorld('electron', { ... })` 中新增：

```ts
clearHookEvents: () => ipcRenderer.invoke('hook:clear-events'),
getBridgeStatus: () => ipcRenderer.invoke('hook:bridge-status'),
injectBridge: () => ipcRenderer.invoke('hook:inject-bridge'),
testHookRule: (p: { command: string; eventName: string; payload: unknown }) =>
  ipcRenderer.invoke('hook:test-rule', p),
```

### Step 6: TypeScript 检查

```bash
npm run typecheck
```

Expected: 0 errors

### Step 7: Commit

```bash
git add electron/shared/types.ts electron/main/bridge-injector.ts electron/main/ipc-handlers.ts electron/main/index.ts electron/preload/index.ts
git commit -m "feat: T2.2 Bridge Hook 自动注入 + 扩展 HookType + 测试沙箱 IPC"
```

---

## Task 2: HookRuleWizard 向导式规则编辑器

**Files:**
- Create: `src/components/hooks/HookRuleWizard.tsx`
- Create: `src/components/hooks/HookTestSandbox.tsx`
- Modify: `src/components/hooks/HooksPanel.tsx`

### Step 1: 新建 `src/components/hooks/HookTestSandbox.tsx`

向导第三步内嵌，也可独立使用。展示一个 mock payload 编辑器 + "Run Test" 按钮 + 结果区：

```tsx
import React, { useState } from 'react'
import { Play, CheckCircle, XCircle } from 'lucide-react'
import type { HookTestResult } from '../../../electron/shared/types'

const MOCK_PAYLOADS: Record<string, unknown> = {
  PreToolUse: { session_id: 'mock-123', tool_name: 'Bash', tool_input: { command: 'ls -la' } },
  PostToolUse: { session_id: 'mock-123', tool_name: 'Bash', tool_input: { command: 'ls -la' }, tool_response: { output: 'file.txt' } },
  PostToolUseFailure: { session_id: 'mock-123', tool_name: 'Bash', error: 'command not found' },
  UserPromptSubmit: { session_id: 'mock-123', prompt: 'Hello Claude' },
  Stop: { session_id: 'mock-123', stop_reason: 'end_turn', CLAUDE_STOP_HOOK_ACTIVE: '0' },
  SubagentStart: { session_id: 'mock-123', parent_session_id: 'parent-456' },
  SubagentStop: { session_id: 'mock-123', parent_session_id: 'parent-456' },
  SessionStart: { session_id: 'mock-123', cwd: '/home/user/project' },
  SessionEnd: { session_id: 'mock-123', cwd: '/home/user/project' },
  Notification: { session_id: 'mock-123', message: 'Task completed' },
  PreCompact: { session_id: 'mock-123', summary: 'Compacting context...' },
}

interface HookTestSandboxProps {
  command: string
  eventName: string
}

export function HookTestSandbox({ command, eventName }: HookTestSandboxProps): React.JSX.Element {
  const defaultPayload = MOCK_PAYLOADS[eventName] ?? { session_id: 'mock-123' }
  const [payloadText, setPayloadText] = useState(JSON.stringify(defaultPayload, null, 2))
  const [result, setResult] = useState<HookTestResult | null>(null)
  const [running, setRunning] = useState(false)

  async function runTest(): Promise<void> {
    setRunning(true)
    setResult(null)
    try {
      let payload: unknown
      try { payload = JSON.parse(payloadText) } catch { payload = defaultPayload }
      const res = await window.electron.testHookRule({ command, eventName, payload })
      setResult(res)
    } catch (err) {
      console.error('[HookTestSandbox] Test failed:', err)
    } finally {
      setRunning(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div>
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 4 }}>Mock Payload（可编辑）</div>
        <textarea
          value={payloadText}
          onChange={(e) => setPayloadText(e.target.value)}
          style={{
            width: '100%',
            height: 120,
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            padding: '6px 8px',
            background: 'var(--color-surface-2)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-text)',
            resize: 'vertical',
            boxSizing: 'border-box',
          }}
        />
      </div>

      <button
        onClick={() => void runTest()}
        disabled={running || !command.trim()}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          padding: '7px 14px',
          background: running ? 'var(--color-surface-3)' : 'var(--color-accent)',
          color: running ? 'var(--color-text-muted)' : '#fff',
          border: 'none',
          borderRadius: 'var(--radius-md)',
          fontSize: 12,
          fontWeight: 600,
          cursor: running || !command.trim() ? 'not-allowed' : 'pointer',
        }}
      >
        <Play size={12} />
        {running ? '运行中…' : '运行测试'}
      </button>

      {result !== null && (
        <div
          style={{
            background: 'var(--color-surface-2)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            padding: '8px 10px',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          {/* Status row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {result.exitCode === 0
              ? <CheckCircle size={14} color="var(--color-success)" />
              : <XCircle size={14} color="var(--color-danger)" />
            }
            <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: result.exitCode === 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
              exit {result.exitCode ?? 'null'}
            </span>
            <span style={{ fontSize: 11, color: 'var(--color-text-faint)' }}>{result.durationMs}ms</span>
          </div>

          {/* stdout */}
          {result.stdout.length > 0 && (
            <div>
              <div style={{ fontSize: 10, color: 'var(--color-text-faint)', marginBottom: 2 }}>stdout</div>
              <pre style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-text)', background: 'var(--color-surface)', padding: '4px 8px', borderRadius: 'var(--radius-sm)', overflow: 'auto', maxHeight: 100, margin: 0 }}>
                {result.stdout}
              </pre>
            </div>
          )}

          {/* stderr */}
          {result.stderr.length > 0 && (
            <div>
              <div style={{ fontSize: 10, color: 'var(--color-danger)', marginBottom: 2 }}>stderr</div>
              <pre style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-danger)', background: 'var(--color-surface)', padding: '4px 8px', borderRadius: 'var(--radius-sm)', overflow: 'auto', maxHeight: 100, margin: 0 }}>
                {result.stderr}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

---

### Step 2: 新建 `src/components/hooks/HookRuleWizard.tsx`

3步向导，内嵌 HookTestSandbox：

```tsx
import React, { useState } from 'react'
import { AlertTriangle, ChevronRight } from 'lucide-react'
import type { HookType, ClaudeHookRule } from '../../../electron/shared/types'
import { HookTestSandbox } from './HookTestSandbox'

const ALL_HOOK_TYPES: HookType[] = [
  'PreToolUse', 'PostToolUse', 'PostToolUseFailure',
  'UserPromptSubmit', 'Stop',
  'SubagentStart', 'SubagentStop',
  'SessionStart', 'SessionEnd',
  'Notification', 'PreCompact',
]

const HOOK_DESCRIPTIONS: Record<HookType, string> = {
  PreToolUse:         '工具执行前。exit 2 可阻止执行并向 Claude 注入反馈',
  PostToolUse:        '工具成功执行后',
  PostToolUseFailure: '工具执行失败后',
  UserPromptSubmit:   '用户发送消息后、Claude 处理前',
  Stop:               'Claude 准备停止时。exit 2 重新激活（⚠ 可能死循环）',
  SubagentStart:      'Subagent 启动时',
  SubagentStop:       'Subagent 结束时',
  SessionStart:       '会话开始时',
  SessionEnd:         '会话结束时',
  Notification:       'Claude 发出通知时',
  PreCompact:         '上下文压缩前',
}

interface HookRuleWizardProps {
  onSave: (hookType: HookType, rule: ClaudeHookRule) => void
  onCancel: () => void
}

export function HookRuleWizard({ onSave, onCancel }: HookRuleWizardProps): React.JSX.Element {
  const [step, setStep] = useState<0 | 1 | 2>(0)
  const [selectedType, setSelectedType] = useState<HookType | null>(null)
  const [matcher, setMatcher] = useState('')
  const [command, setCommand] = useState('')
  const [stopConfirmed, setStopConfirmed] = useState(false)

  function canProceedStep0(): boolean {
    if (!selectedType) return false
    if (selectedType === 'Stop' && !stopConfirmed) return false
    return true
  }

  function handleSave(): void {
    if (!selectedType || !command.trim()) return
    const rule: ClaudeHookRule = { command: command.trim() }
    if (matcher.trim()) rule.matcher = matcher.trim()
    onSave(selectedType, rule)
  }

  const stepTitles = ['选择触发事件', '设置匹配条件', '配置命令']

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Step indicator */}
      <div style={{ display: 'flex', gap: 0, alignItems: 'center', marginBottom: 4 }}>
        {stepTitles.map((title, i) => (
          <React.Fragment key={i}>
            <div style={{
              fontSize: 11,
              color: i === step ? 'var(--color-accent)' : i < step ? 'var(--color-text-muted)' : 'var(--color-text-faint)',
              fontWeight: i === step ? 600 : 400,
            }}>
              {i + 1}. {title}
            </div>
            {i < stepTitles.length - 1 && (
              <ChevronRight size={10} style={{ margin: '0 4px', color: 'var(--color-text-faint)', flexShrink: 0 }} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Step 0: Event type selection */}
      {step === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {ALL_HOOK_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => { setSelectedType(type); setStopConfirmed(false) }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                padding: '7px 10px',
                borderRadius: 'var(--radius-md)',
                background: selectedType === type ? 'var(--color-accent-dim)' : 'var(--color-surface-2)',
                border: selectedType === type ? '1px solid var(--color-accent)' : '1px solid var(--color-border)',
                cursor: 'pointer',
                gap: 2,
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text)' }}>{type}</span>
              <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{HOOK_DESCRIPTIONS[type]}</span>
            </button>
          ))}

          {/* Stop hook warning */}
          {selectedType === 'Stop' && (
            <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid var(--color-warning)', borderRadius: 'var(--radius-md)', padding: '8px 10px', marginTop: 4 }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                <AlertTriangle size={13} color="var(--color-warning)" style={{ flexShrink: 0, marginTop: 1 }} />
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-warning)' }}>Stop Hook 警告</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
                    exit 2 会让 Claude 继续运行，可能导致无限循环。确保命令有明确的终止条件。
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={stopConfirmed}
                      onChange={(e) => setStopConfirmed(e.target.checked)}
                    />
                    <span style={{ fontSize: 11, color: 'var(--color-text)' }}>我已了解风险</span>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 1: Tool matcher */}
      {step === 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
            设置工具名匹配模式（留空 = 匹配所有工具）
          </div>
          <input
            value={matcher}
            onChange={(e) => setMatcher(e.target.value)}
            placeholder="例：Bash  /  Edit  /  * (留空表示全部)"
            style={{
              padding: '7px 10px',
              background: 'var(--color-surface-2)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--color-text)',
              fontSize: 12,
              fontFamily: 'var(--font-mono)',
            }}
          />
        </div>
      )}

      {/* Step 2: Command + test sandbox */}
      {step === 2 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 4 }}>Shell 命令</div>
            <input
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="例：/home/user/.claude/hooks/my-hook.sh"
              style={{
                width: '100%',
                padding: '7px 10px',
                background: 'var(--color-surface-2)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--color-text)',
                fontSize: 12,
                fontFamily: 'var(--font-mono)',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {selectedType && command.trim() && (
            <HookTestSandbox command={command} eventName={selectedType} />
          )}
        </div>
      )}

      {/* Navigation buttons */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
        <button
          onClick={onCancel}
          style={{
            padding: '6px 14px',
            background: 'var(--color-surface-2)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-text-muted)',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          取消
        </button>

        {step > 0 && (
          <button
            onClick={() => setStep((s) => (s - 1) as 0 | 1 | 2)}
            style={{
              padding: '6px 14px',
              background: 'var(--color-surface-2)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--color-text)',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            上一步
          </button>
        )}

        {step < 2 ? (
          <button
            onClick={() => setStep((s) => (s + 1) as 0 | 1 | 2)}
            disabled={step === 0 && !canProceedStep0()}
            style={{
              padding: '6px 14px',
              background: (step === 0 && !canProceedStep0()) ? 'var(--color-surface-3)' : 'var(--color-accent)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              color: (step === 0 && !canProceedStep0()) ? 'var(--color-text-faint)' : '#fff',
              fontSize: 12,
              fontWeight: 600,
              cursor: (step === 0 && !canProceedStep0()) ? 'not-allowed' : 'pointer',
            }}
          >
            下一步
          </button>
        ) : (
          <button
            onClick={handleSave}
            disabled={!command.trim()}
            style={{
              padding: '6px 14px',
              background: !command.trim() ? 'var(--color-surface-3)' : 'var(--color-accent)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              color: !command.trim() ? 'var(--color-text-faint)' : '#fff',
              fontSize: 12,
              fontWeight: 600,
              cursor: !command.trim() ? 'not-allowed' : 'pointer',
            }}
          >
            保存规则
          </button>
        )}
      </div>
    </div>
  )
}
```

---

### Step 3: 修改 `src/components/hooks/HooksPanel.tsx`

**3a. Events tab 改动：**

在 Events tab 头部 badge 旁边新增：
1. **Clear 按钮**（调用 `window.electron.clearHookEvents()`）
2. **Bridge 状态指示器**（小圆点 + 文字：Connected / Not connected + "Enable" 按钮）

Bridge 状态加载逻辑：

```tsx
const [bridgeStatus, setBridgeStatus] = useState<HookBridgeStatus | null>(null)

useEffect(() => {
  void window.electron.getBridgeStatus().then(setBridgeStatus)
}, [])

async function handleEnableBridge(): Promise<void> {
  const status = await window.electron.injectBridge()
  setBridgeStatus(status)
}

async function handleClear(): Promise<void> {
  await window.electron.clearHookEvents()
  setEvents([])
}
```

Bridge 状态 UI（在 Events 标签页头部）：

```tsx
{bridgeStatus !== null && (
  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
    <span style={{
      width: 6, height: 6,
      borderRadius: '50%',
      background: bridgeStatus.injected ? 'var(--color-success)' : 'var(--color-text-faint)',
      flexShrink: 0,
    }} />
    <span style={{ fontSize: 10, color: bridgeStatus.injected ? 'var(--color-success)' : 'var(--color-text-faint)' }}>
      {bridgeStatus.injected ? 'Bridge 已连接' : '未连接'}
    </span>
    {!bridgeStatus.injected && (
      <button
        onClick={() => void handleEnableBridge()}
        style={{
          fontSize: 10,
          color: 'var(--color-accent)',
          background: 'none',
          border: '1px solid var(--color-accent)',
          borderRadius: 'var(--radius-sm)',
          padding: '2px 6px',
          cursor: 'pointer',
        }}
      >
        启用
      </button>
    )}
  </div>
)}
```

**3b. Config tab 改动：**

在 Config tab 内，把原有的"添加规则"平铺表单替换为 `HookRuleWizard` 组件。引入逻辑：

```tsx
import { HookRuleWizard } from './HookRuleWizard'
import type { HookBridgeStatus } from '../../../electron/shared/types'

const [showWizard, setShowWizard] = useState(false)
```

当用户点击"添加规则"按钮，显示 wizard。`onSave` 回调调用现有的 `addRule` + `save` 逻辑。

### Step 4: TypeScript 检查

```bash
npm run typecheck
```

Expected: 0 errors

### Step 5: Commit

```bash
git add src/components/hooks/
git commit -m "feat: T2.4 + T2.5 — HookRuleWizard 向导式编辑器 + HookTestSandbox 命令测试"
```

---

## Task 3: 全量验收

### Step 1: 运行所有测试

```bash
npm test
```

Expected: 74+ tests passing

### Step 2: 完整 TypeScript 检查

```bash
npm run typecheck && npm run typecheck:node && npm run typecheck:web
```

Expected: 0 errors

### Step 3: 验收清单（手动/自动化）

- [ ] `electron/main/bridge-injector.ts` 存在，`injectBridgeHook()` 写入 `~/.claude/hooks/gui-bridge.sh`
- [ ] `~/.claude/settings.json` 的 `hooks.PreToolUse` 包含 gui-bridge 条目（首次启动后）
- [ ] HooksPanel Events tab 显示 Bridge 状态（Connected 绿点 或 未连接+启用按钮）
- [ ] 点击"启用"按钮后状态变为 Connected
- [ ] Events tab 清空按钮可用
- [ ] Config tab "添加规则" 打开 3 步向导
- [ ] 向导第 1 步可选 11 种事件类型；选 Stop 出现警告
- [ ] 向导第 2 步可填 matcher（可选）
- [ ] 向导第 3 步可填命令，点"运行测试"看到 stdout/stderr/exitCode/duration
- [ ] 保存规则后 Config tab 列表更新

### Step 4: Final Commit

```bash
git add -p
git commit -m "chore: Hooks 可视化验收通过"
```
