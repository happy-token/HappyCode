# Phase 2：核心差异化（Week 7-14）

**前提**：Phase 1 全部完成。

**目标**：Hooks 可视化 + Subagent 调用树。这是现有所有 Claude GUI 都没有的能力，发布后即是市场唯一。

完成每项任务后打 `[x]`，不要跳任务。

---

## T2.1 HookServer 启动 [ ]

创建 `electron/main/hook-server.ts`：

```typescript
// electron/main/hook-server.ts
import express from 'express';
import type { BrowserWindow } from 'electron';
import type { SessionStore } from './session-store';

export interface HookEvent {
  id: string;
  timestamp: number;
  eventName: string;
  sessionId?: string;
  toolName?: string;
  payload: unknown;
  exitCode: number;
}

export function startHookServer(win: BrowserWindow, store: SessionStore): void {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.post('/hook-event', (req, res) => {
    const event: HookEvent = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      eventName: (req.headers['x-hook-event'] as string) ?? 'unknown',
      sessionId: req.body?.session_id,
      toolName: req.body?.tool_name,
      payload: req.body,
      exitCode: 0,
    };

    // 1. 存 SQLite
    store.insertHookEvent(event);

    // 2. 实时推渲染进程
    win.webContents.send('hook:event', event);

    res.json({ ok: true });
  });

  app.listen(37421, '127.0.0.1', () => {
    console.log('[HookServer] listening on localhost:37421');
  });
}
```

在 `electron/main/index.ts` 的 `app.whenReady()` 里，在 `registerHandlers` 之后调用：

```typescript
import { startHookServer } from './hook-server';
// ...
startHookServer(win, sessionStore);
```

在 `ipc-handlers.ts` 注册 hook 相关 channel：

```typescript
ipcMain.handle('hook:list-events', (_, { limit = 100 }: { limit?: number }) => {
  return store.listHookEvents(limit);
});
ipcMain.handle('hook:clear-events', () => {
  store.clearHookEvents();
});
```

在 preload 里新增：

```typescript
// 监听 hook 事件推送
onHookEvent: makeListener<HookEvent>('hook:event'),
// 查询历史
listHookEvents: (limit?: number) => ipcRenderer.invoke('hook:list-events', { limit }),
clearHookEvents: () => ipcRenderer.invoke('hook:clear-events'),
```

**验收**：

```bash
curl -s -X POST http://localhost:37421/hook-event \
  -H "Content-Type: application/json" \
  -H "X-Hook-Event: PreToolUse" \
  -d '{"tool_name":"Bash","tool_input":{"command":"ls"}}'
# 返回 {"ok":true}
```

---

## T2.2 Bridge Hook 注入 [ ]

在 `electron/main/config-manager.ts` 新增 `injectBridgeHook()` 函数：

```typescript
// electron/main/config-manager.ts（新增部分）
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// 12 种 hook 事件
const HOOK_EVENTS = [
  'PreToolUse', 'PostToolUse', 'PostToolUseFailure',
  'UserPromptSubmit', 'Stop',
  'SubagentStart', 'SubagentStop',
  'SessionStart', 'SessionEnd',
  'Notification', 'PreCompact',
] as const;

export function injectBridgeHook(): void {
  const hooksDir = path.join(os.homedir(), '.claude', 'hooks');
  fs.mkdirSync(hooksDir, { recursive: true });

  // 根据平台写不同的 bridge 脚本
  const isWindows = process.platform === 'win32';

  if (isWindows) {
    const scriptPath = path.join(hooksDir, 'gui-bridge.ps1');
    fs.writeFileSync(scriptPath, `
$payload = $input | ConvertFrom-Json | ConvertTo-Json -Compress -Depth 10
try {
  Invoke-RestMethod -Uri "http://localhost:37421/hook-event" \`
    -Method Post \`
    -ContentType "application/json" \`
    -Headers @{"X-Hook-Event" = $env:HOOK_EVENT_NAME} \`
    -Body $payload -TimeoutSec 2 | Out-Null
} catch {}
exit 0
`.trim());
  } else {
    const scriptPath = path.join(hooksDir, 'gui-bridge.sh');
    fs.writeFileSync(scriptPath, `#!/bin/bash
payload=$(cat)
curl -s --max-time 2 -X POST http://localhost:37421/hook-event \\
  -H "Content-Type: application/json" \\
  -H "X-Hook-Event: \${HOOK_EVENT_NAME}" \\
  -d "$payload" &
exit 0
`);
    fs.chmodSync(scriptPath, '755');
  }

  // 读取现有 settings.json
  const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');
  let settings: Record<string, unknown> = {};
  if (fs.existsSync(settingsPath)) {
    try { settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8')); }
    catch { /* ignore parse error */ }
  }

  // 注入 hook 规则（避免重复）
  const hooks = (settings.hooks ?? {}) as Record<string, unknown[]>;
  const scriptPath = isWindows
    ? path.join(hooksDir, 'gui-bridge.ps1')
    : path.join(hooksDir, 'gui-bridge.sh');
  const command = isWindows
    ? `powershell -NonInteractive -File "${scriptPath}"`
    : scriptPath;

  for (const event of HOOK_EVENTS) {
    const existing = (hooks[event] ?? []) as Array<Record<string, unknown>>;
    // 检查是否已存在 bridge hook
    const alreadyInjected = existing.some((h) => String(h.command ?? '').includes('gui-bridge'));
    if (!alreadyInjected) {
      hooks[event] = [...existing, { type: 'command', command }];
    }
  }

  settings.hooks = hooks;
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  console.log('[ConfigManager] Bridge hook injected');
}
```

在 `electron/main/index.ts` 的 `app.whenReady()` 里，**HookServer 启动之后**调用：

```typescript
import { injectBridgeHook } from './config-manager';
// HookServer 先启动，再注入 hook（顺序重要）
startHookServer(win, sessionStore);
injectBridgeHook();
```

**验收**：打开 GUI 后，`~/.claude/settings.json` 里有 `hooks.PreToolUse` 等规则，手动执行一次 Claude Code 操作后，SQLite 的 `hook_events` 表里有记录。

---

## T2.3 Hooks 实时日志面板 [ ]

创建 `src/components/hooks-panel/HooksPanel.tsx`：

```typescript
// src/components/hooks-panel/HooksPanel.tsx
import { useEffect, useState, useRef } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronDown, ChevronRight, Trash2 } from 'lucide-react';
import type { HookEvent } from '../../../electron/main/hook-server';

// 事件类型颜色映射
const EVENT_COLORS: Record<string, string> = {
  PreToolUse:           'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  PostToolUse:          'bg-green-500/10 text-green-600 border-green-500/20',
  PostToolUseFailure:   'bg-red-500/10 text-red-600 border-red-500/20',
  UserPromptSubmit:     'bg-blue-500/10 text-blue-600 border-blue-500/20',
  Stop:                 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  SubagentStart:        'bg-indigo-500/10 text-indigo-600 border-indigo-500/20',
  SubagentStop:         'bg-indigo-500/10 text-indigo-600 border-indigo-500/20',
  SessionStart:         'bg-cyan-500/10 text-cyan-600 border-cyan-500/20',
  SessionEnd:           'bg-cyan-500/10 text-cyan-600 border-cyan-500/20',
  Notification:         'bg-orange-500/10 text-orange-600 border-orange-500/20',
  PreCompact:           'bg-gray-500/10 text-gray-600 border-gray-500/20',
};

export function HooksPanel() {
  const [events, setEvents] = useState<HookEvent[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);

  // 加载历史事件
  useEffect(() => {
    window.electron.listHookEvents(100).then(setEvents);
  }, []);

  // 监听实时事件
  useEffect(() => {
    const cleanup = window.electron.onHookEvent((event) => {
      setEvents((prev) => {
        const next = [event, ...prev].slice(0, 100); // 最多 100 条
        return next;
      });
    });
    return cleanup;
  }, []);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const clearEvents = async () => {
    await window.electron.clearHookEvents();
    setEvents([]);
  };

  return (
    <div className="flex flex-col h-full border-l">
      {/* 头部 */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/50">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Hooks 日志</span>
          <Badge variant="secondary">{events.length}</Badge>
        </div>
        <Button variant="ghost" size="icon" onClick={clearEvents}>
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      {/* 事件列表 */}
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="p-2 space-y-1">
          {events.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-8">
              暂无 hook 事件。执行 Claude Code 操作后这里会实时显示。
            </p>
          )}
          {events.map((event) => (
            <HookEventRow
              key={event.id}
              event={event}
              isExpanded={expanded.has(event.id)}
              onToggle={() => toggleExpand(event.id)}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

function HookEventRow({
  event, isExpanded, onToggle,
}: {
  event: HookEvent;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const colorClass = EVENT_COLORS[event.eventName] ?? 'bg-gray-500/10 text-gray-600 border-gray-500/20';
  const time = new Date(event.timestamp).toLocaleTimeString();

  return (
    <div className="rounded border border-border/50 overflow-hidden">
      {/* 行头 */}
      <button
        className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-muted/50 text-left"
        onClick={onToggle}
      >
        {isExpanded
          ? <ChevronDown className="w-3 h-3 text-muted-foreground flex-shrink-0" />
          : <ChevronRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
        }
        <Badge className={`text-xs border ${colorClass} flex-shrink-0`}>
          {event.eventName}
        </Badge>
        {event.toolName && (
          <span className="text-xs font-mono text-muted-foreground truncate">
            {event.toolName}
          </span>
        )}
        <span className="text-xs text-muted-foreground ml-auto flex-shrink-0">{time}</span>
      </button>

      {/* 展开的 payload */}
      {isExpanded && (
        <div className="px-3 pb-2 border-t border-border/50 bg-muted/30">
          <pre className="text-xs font-mono overflow-auto max-h-64 pt-2 whitespace-pre-wrap break-all">
            {JSON.stringify(event.payload, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
```

在主布局里添加 HooksPanel 的开关按钮和面板（右侧抽屉或底部面板，可收起）。

**验收**：Claude Code 执行 Bash、Edit 等操作时，面板实时显示对应 hook 事件，点击可展开查看完整 payload。

---

## T2.4 Hooks 规则编辑器（向导式） [ ]

创建 `src/components/hooks-panel/HookRuleEditor.tsx`。

**不是 JSON 编辑器，是向导式表单。** 底层读写 `~/.claude/settings.json`。

```typescript
// src/components/hooks-panel/HookRuleEditor.tsx
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { AlertTriangle } from 'lucide-react';

const HOOK_EVENT_DESCRIPTIONS: Record<string, { label: string; desc: string }> = {
  PreToolUse:         { label: 'PreToolUse',         desc: '工具执行前。exit 2 可阻止执行并向 Claude 注入反馈' },
  PostToolUse:        { label: 'PostToolUse',        desc: '工具成功执行后' },
  PostToolUseFailure: { label: 'PostToolUseFailure', desc: '工具执行失败后' },
  UserPromptSubmit:   { label: 'UserPromptSubmit',   desc: '用户发送消息后，Claude 处理前' },
  Stop:               { label: 'Stop',               desc: 'Claude 准备停止时。exit 2 重新激活（⚠️ 可能死循环）' },
  SubagentStart:      { label: 'SubagentStart',      desc: 'Subagent 启动时' },
  SubagentStop:       { label: 'SubagentStop',       desc: 'Subagent 结束时' },
  SessionStart:       { label: 'SessionStart',       desc: '会话开始时' },
  SessionEnd:         { label: 'SessionEnd',         desc: '会话结束时' },
  Notification:       { label: 'Notification',       desc: 'Claude 发出通知时' },
  PreCompact:         { label: 'PreCompact',         desc: '上下文压缩前' },
};

interface HookRule {
  eventName: string;
  matcher?: string;       // glob 模式匹配工具名
  command: string;
  timeout?: number;
}

interface HookRuleEditorProps {
  onSave: (rule: HookRule) => void;
  onCancel: () => void;
  initialRule?: Partial<HookRule>;
}

export function HookRuleEditor({ onSave, onCancel, initialRule }: HookRuleEditorProps) {
  const [step, setStep] = useState(0);
  const [rule, setRule] = useState<Partial<HookRule>>(initialRule ?? {});
  const [stopHookConfirmed, setStopHookConfirmed] = useState(false);

  const steps = [
    { title: '选择触发事件', key: 'event' },
    { title: '设置匹配条件', key: 'matcher' },
    { title: '配置处理命令', key: 'command' },
    { title: '高级设置',     key: 'advanced' },
    { title: '确认并保存',   key: 'confirm' },
  ];

  const isStopHook = rule.eventName === 'Stop';
  const canProceed = () => {
    if (step === 0) return !!rule.eventName;
    if (step === 2) return !!rule.command?.trim();
    if (step === 4 && isStopHook) return stopHookConfirmed;
    return true;
  };

  return (
    <div className="space-y-6">
      {/* 步骤指示器 */}
      <div className="flex gap-2">
        {steps.map((s, i) => (
          <div key={s.key} className="flex items-center gap-1">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs
              ${i === step ? 'bg-primary text-primary-foreground'
                : i < step ? 'bg-primary/30 text-primary'
                : 'bg-muted text-muted-foreground'}`}>
              {i + 1}
            </div>
            {i < steps.length - 1 && <div className="w-4 h-px bg-border" />}
          </div>
        ))}
      </div>

      <h3 className="font-medium">{steps[step].title}</h3>

      {/* 步骤 0：选择事件 */}
      {step === 0 && (
        <div className="space-y-2">
          {Object.entries(HOOK_EVENT_DESCRIPTIONS).map(([key, { label, desc }]) => (
            <button
              key={key}
              onClick={() => setRule((r) => ({ ...r, eventName: key }))}
              className={`w-full text-left p-3 rounded border text-sm transition-colors
                ${rule.eventName === key
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:bg-muted'}`}
            >
              <div className="font-medium font-mono">{label}</div>
              <div className="text-muted-foreground text-xs mt-0.5">{desc}</div>
            </button>
          ))}
        </div>
      )}

      {/* 步骤 1：匹配条件 */}
      {step === 1 && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            可选。留空表示匹配所有工具。填写 glob 模式只匹配特定工具（如 <code>Bash</code> 或 <code>Edit,Write</code>）。
          </p>
          <Input
            placeholder="例如：Bash（留空匹配所有）"
            value={rule.matcher ?? ''}
            onChange={(e) => setRule((r) => ({ ...r, matcher: e.target.value }))}
          />
          {rule.matcher && (
            <p className="text-xs text-muted-foreground">
              将匹配工具：<code>{rule.matcher}</code>
            </p>
          )}
        </div>
      )}

      {/* 步骤 2：配置命令 */}
      {step === 2 && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Shell 命令。从 stdin 读取 JSON payload，通过 exit code 控制行为：
          </p>
          <div className="text-xs space-y-1 bg-muted p-3 rounded">
            <div><Badge variant="outline" className="mr-2">exit 0</Badge>成功，继续执行</div>
            <div><Badge variant="outline" className="mr-2">exit 1</Badge>失败，记录错误</div>
            {rule.eventName === 'PreToolUse' && (
              <div><Badge variant="destructive" className="mr-2">exit 2</Badge>阻止工具执行，stdout 内容作为反馈注入 Claude</div>
            )}
            {rule.eventName === 'Stop' && (
              <div><Badge variant="destructive" className="mr-2">exit 2</Badge>⚠️ 重新激活 Claude（小心死循环）</div>
            )}
          </div>
          <textarea
            className="w-full font-mono text-sm p-3 border rounded bg-background resize-none h-24"
            placeholder={`#!/bin/bash\npayload=$(cat)\necho "Tool: $(echo $payload | jq -r .tool_name)"`}
            value={rule.command ?? ''}
            onChange={(e) => setRule((r) => ({ ...r, command: e.target.value }))}
          />
        </div>
      )}

      {/* 步骤 3：高级设置 */}
      {step === 3 && (
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">超时时间（秒）</label>
            <Input
              type="number"
              className="mt-1 w-32"
              placeholder="60"
              value={rule.timeout ?? ''}
              onChange={(e) => setRule((r) => ({ ...r, timeout: Number(e.target.value) || undefined }))}
            />
            <p className="text-xs text-muted-foreground mt-1">超时后 hook 被强制终止，视为 exit 1</p>
          </div>
        </div>
      )}

      {/* 步骤 4：确认 */}
      {step === 4 && (
        <div className="space-y-4">
          <div className="bg-muted p-3 rounded text-sm space-y-1">
            <div><span className="text-muted-foreground">事件：</span><Badge>{rule.eventName}</Badge></div>
            {rule.matcher && <div><span className="text-muted-foreground">匹配：</span><code>{rule.matcher}</code></div>}
            <div><span className="text-muted-foreground">命令：</span><pre className="inline">{rule.command}</pre></div>
          </div>

          {/* Stop hook 特别警告 */}
          {isStopHook && (
            <div className="border border-destructive/50 bg-destructive/5 rounded p-4 space-y-3">
              <div className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="w-4 h-4" />
                <span className="font-medium text-sm">Stop Hook 死循环警告</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Stop hook 中 exit 2 会重新激活 Claude，如果脚本每次都 exit 2，将造成无限循环消耗大量 token。
              </p>
              <p className="text-sm font-medium">必须使用 <code>CLAUDE_STOP_HOOK_ACTIVE</code> 变量防止死循环：</p>
              <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">{`#!/bin/bash
# 防死循环检查
if [ "$CLAUDE_STOP_HOOK_ACTIVE" = "1" ]; then
  exit 0  # 已经在 hook 触发中，直接放行
fi

# 你的逻辑
if [ some_condition ]; then
  exit 2  # 重新激活 Claude
fi

exit 0`}</pre>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={stopHookConfirmed}
                  onChange={(e) => setStopHookConfirmed(e.target.checked)}
                />
                我已理解死循环风险并在脚本中做了防护
              </label>
            </div>
          )}
        </div>
      )}

      {/* 底部按钮 */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={step === 0 ? onCancel : () => setStep((s) => s - 1)}>
          {step === 0 ? '取消' : '上一步'}
        </Button>
        {step < steps.length - 1 ? (
          <Button onClick={() => setStep((s) => s + 1)} disabled={!canProceed()}>
            下一步
          </Button>
        ) : (
          <Button
            onClick={() => onSave(rule as HookRule)}
            disabled={!canProceed()}
          >
            保存规则
          </Button>
        )}
      </div>
    </div>
  );
}
```

在主进程 `config-manager.ts` 新增读写 hook 规则的函数：

```typescript
export function listHookRules(): HookRule[] {
  const settings = readSettings('user');
  return Object.entries((settings.hooks ?? {}) as Record<string, unknown[]>)
    .flatMap(([eventName, rules]) =>
      rules.map((r) => ({ eventName, ...(r as object) }))
    );
}

export function saveHookRule(rule: HookRule): void {
  const settings = readSettings('user');
  const hooks = (settings.hooks ?? {}) as Record<string, unknown[]>;
  hooks[rule.eventName] = [...(hooks[rule.eventName] ?? []), {
    type: 'command',
    command: rule.command,
    ...(rule.matcher ? { matcher: rule.matcher } : {}),
    ...(rule.timeout ? { timeout: rule.timeout } : {}),
  }];
  settings.hooks = hooks;
  writeSettings('user', settings);
}

export function deleteHookRule(eventName: string, index: number): void {
  const settings = readSettings('user');
  const hooks = (settings.hooks ?? {}) as Record<string, unknown[]>;
  if (hooks[eventName]) {
    hooks[eventName] = hooks[eventName].filter((_, i) => i !== index);
  }
  settings.hooks = hooks;
  writeSettings('user', settings);
}
```

在 `ipc-handlers.ts` 注册：
```typescript
ipcMain.handle('hook:list-rules', () => configManager.listHookRules());
ipcMain.handle('hook:save-rule', (_, rule) => configManager.saveHookRule(rule));
ipcMain.handle('hook:delete-rule', (_, { eventName, index }) => configManager.deleteHookRule(eventName, index));
```

**验收**：通过向导创建 PreToolUse 规则，Claude Code 执行 Bash 时触发，日志面板里可以看到。Stop hook 编辑时出现死循环警告和确认 checkbox。

---

## T2.5 Hook 测试沙箱 [ ]

创建 `src/components/hooks-panel/HookTestSandbox.tsx`：

```typescript
// src/components/hooks-panel/HookTestSandbox.tsx
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Play, CheckCircle2, XCircle } from 'lucide-react';

// 各事件类型的 mock payload 模板
const MOCK_PAYLOADS: Record<string, unknown> = {
  PreToolUse: {
    session_id: 'mock-session-123',
    tool_name: 'Bash',
    tool_input: { command: 'ls -la', description: 'List files' },
  },
  PostToolUse: {
    session_id: 'mock-session-123',
    tool_name: 'Bash',
    tool_input: { command: 'ls -la' },
    tool_response: { output: 'total 0\ndrwxr-xr-x  2 user user  40 Jan 1 00:00 .' },
  },
  Stop: {
    session_id: 'mock-session-123',
    stop_reason: 'end_turn',
    CLAUDE_STOP_HOOK_ACTIVE: '0',
  },
  UserPromptSubmit: {
    session_id: 'mock-session-123',
    prompt: 'Hello Claude',
  },
};

interface TestResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  durationMs: number;
}

interface HookTestSandboxProps {
  command: string;
  eventName: string;
}

export function HookTestSandbox({ command, eventName }: HookTestSandboxProps) {
  const defaultPayload = MOCK_PAYLOADS[eventName] ?? { session_id: 'mock-session-123' };
  const [payloadText, setPayloadText] = useState(JSON.stringify(defaultPayload, null, 2));
  const [result, setResult] = useState<TestResult | null>(null);
  const [running, setRunning] = useState(false);

  const runTest = async () => {
    setRunning(true);
    setResult(null);
    try {
      let payload: unknown;
      try { payload = JSON.parse(payloadText); }
      catch { payload = defaultPayload; }

      const res = await window.electron.testHookRule({ command, eventName, payload });
      setResult(res);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium">Mock Payload（可编辑）</label>
        <textarea
          className="w-full font-mono text-xs p-3 border rounded bg-muted mt-1 h-40 resize-none"
          value={payloadText}
          onChange={(e) => setPayloadText(e.target.value)}
        />
      </div>

      <Button onClick={runTest} disabled={running} className="w-full">
        <Play className="w-4 h-4 mr-2" />
        {running ? '运行中...' : '运行测试'}
      </Button>

      {result && (
        <div className="space-y-2">
          {/* 状态行 */}
          <div className="flex items-center gap-2">
            {result.exitCode === 0
              ? <CheckCircle2 className="w-4 h-4 text-green-500" />
              : <XCircle className="w-4 h-4 text-red-500" />
            }
            <Badge variant={result.exitCode === 0 ? 'default' : 'destructive'}>
              exit {result.exitCode ?? 'null'}
            </Badge>
            <span className="text-xs text-muted-foreground">{result.durationMs}ms</span>
          </div>

          {/* stdout */}
          {result.stdout && (
            <div>
              <p className="text-xs font-medium mb-1">stdout</p>
              <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-32">{result.stdout}</pre>
            </div>
          )}

          {/* stderr */}
          {result.stderr && (
            <div>
              <p className="text-xs font-medium mb-1 text-destructive">stderr</p>
              <pre className="text-xs bg-destructive/10 p-2 rounded overflow-auto max-h-32">{result.stderr}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

在主进程 `ipc-handlers.ts` 注册 `hook:test-rule`：

```typescript
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

ipcMain.handle('hook:test-rule', async (_, { command, eventName, payload }: {
  command: string; eventName: string; payload: unknown;
}) => {
  const startTime = Date.now();
  return new Promise((resolve) => {
    const proc = execFile(
      process.platform === 'win32' ? 'powershell' : 'bash',
      process.platform === 'win32' ? ['-NonInteractive', '-Command', command] : ['-c', command],
      {
        timeout: 10_000,
        env: { ...process.env, HOOK_EVENT_NAME: eventName },
      }
    );

    let stdout = '';
    let stderr = '';

    proc.stdin?.write(JSON.stringify(payload));
    proc.stdin?.end();
    proc.stdout?.on('data', (d: Buffer) => { stdout += d.toString(); });
    proc.stderr?.on('data', (d: Buffer) => { stderr += d.toString(); });

    proc.on('close', (exitCode) => {
      resolve({ stdout, stderr, exitCode, durationMs: Date.now() - startTime });
    });

    proc.on('error', (err) => {
      resolve({ stdout: '', stderr: err.message, exitCode: -1, durationMs: Date.now() - startTime });
    });
  });
});
```

在 preload 里新增：
```typescript
testHookRule: (p: { command: string; eventName: string; payload: unknown }) =>
  ipcRenderer.invoke('hook:test-rule', p),
```

**验收**：在沙箱里运行一个简单的 echo 脚本，看到 stdout 正确输出，exit code 正确显示。

---

## T2.6 AgentDAG 数据结构 [ ]

创建 `electron/main/agent-dag.ts`：

```typescript
// electron/main/agent-dag.ts
export interface AgentNode {
  id: string;                           // subagent_id（或根节点的 session_id）
  parentId: string | null;
  agentType: string;                    // 'root' | 'task' | 'explore' | 'plan' 等
  description: string;
  status: 'running' | 'done' | 'error';
  startedAt: number;
  finishedAt?: number;
  usage: { inputTokens: number; outputTokens: number };
  children: string[];                   // 子节点 id 列表
}

// ReactFlow 节点/边格式
export interface RFNode {
  id: string;
  type: 'agentNode';
  position: { x: number; y: number };
  data: AgentNode;
}
export interface RFEdge {
  id: string;
  source: string;
  target: string;
  animated: boolean;
}

export class AgentDAG {
  private nodes = new Map<string, AgentNode>();
  private rootId: string | null = null;

  // 初始化根节点（会话开始时）
  initRoot(sessionId: string): void {
    this.nodes.clear();
    this.rootId = sessionId;
    this.nodes.set(sessionId, {
      id: sessionId,
      parentId: null,
      agentType: 'root',
      description: '主 Agent',
      status: 'running',
      startedAt: Date.now(),
      usage: { inputTokens: 0, outputTokens: 0 },
      children: [],
    });
  }

  onAgentStart(event: {
    subagent_id: string;
    parent_session_id: string;
    agent_type: string;
    description?: string;
  }): void {
    const parentId = event.parent_session_id;
    this.nodes.set(event.subagent_id, {
      id: event.subagent_id,
      parentId,
      agentType: event.agent_type,
      description: event.description ?? event.agent_type,
      status: 'running',
      startedAt: Date.now(),
      usage: { inputTokens: 0, outputTokens: 0 },
      children: [],
    });

    // 把自己加入父节点的 children
    const parent = this.nodes.get(parentId);
    if (parent) {
      parent.children.push(event.subagent_id);
    }
  }

  onAgentStop(event: {
    subagent_id: string;
    status?: string;
    usage?: { input_tokens?: number; output_tokens?: number };
  }): void {
    const node = this.nodes.get(event.subagent_id);
    if (node) {
      node.status = event.status === 'error' ? 'error' : 'done';
      node.finishedAt = Date.now();
      node.usage = {
        inputTokens: event.usage?.input_tokens ?? 0,
        outputTokens: event.usage?.output_tokens ?? 0,
      };
    }
  }

  // 会话结束，标记根节点完成
  onSessionDone(): void {
    if (this.rootId) {
      const root = this.nodes.get(this.rootId);
      if (root) {
        root.status = 'done';
        root.finishedAt = Date.now();
      }
    }
  }

  // 转换成 ReactFlow 需要的格式（简单层级布局）
  toReactFlowFormat(): { nodes: RFNode[]; edges: RFEdge[] } {
    const rfNodes: RFNode[] = [];
    const rfEdges: RFEdge[] = [];

    // 简单的层级布局算法
    const levelMap = new Map<string, number>(); // id → level
    const positionMap = new Map<string, { x: number; y: number }>();
    const levelCounters = new Map<number, number>(); // level → 该层节点数

    const assignLevel = (id: string, level: number) => {
      levelMap.set(id, level);
      const count = levelCounters.get(level) ?? 0;
      levelCounters.set(level, count + 1);
      positionMap.set(id, { x: count * 220, y: level * 120 });
      const node = this.nodes.get(id);
      node?.children.forEach((childId) => assignLevel(childId, level + 1));
    };

    if (this.rootId) assignLevel(this.rootId, 0);

    for (const [id, node] of this.nodes) {
      rfNodes.push({
        id,
        type: 'agentNode',
        position: positionMap.get(id) ?? { x: 0, y: 0 },
        data: node,
      });

      if (node.parentId) {
        rfEdges.push({
          id: `${node.parentId}-${id}`,
          source: node.parentId,
          target: id,
          animated: node.status === 'running',
        });
      }
    }

    return { nodes: rfNodes, edges: rfEdges };
  }

  isEmpty(): boolean {
    return this.nodes.size <= 1; // 只有根节点视为空
  }
}
```

在 `AgentManager` 里集成 `AgentDAG`：

```typescript
// agent-manager.ts 里新增
import { AgentDAG } from './agent-dag';

// startSession 里
const dag = new AgentDAG();
dag.initRoot(params.sessionId);

// 在事件处理循环里
if (msg.type === 'system') {
  if (msg.subtype === 'agent_start') {
    dag.onAgentStart(msg as any);
    if (!dag.isEmpty()) {
      win.webContents.send('agent:dag-update', {
        sessionId: params.sessionId,
        dag: dag.toReactFlowFormat(),
      });
    }
  } else if (msg.subtype === 'agent_stop') {
    dag.onAgentStop(msg as any);
    win.webContents.send('agent:dag-update', {
      sessionId: params.sessionId,
      dag: dag.toReactFlowFormat(),
    });
  }
}

// finally 里
dag.onSessionDone();
```

在 preload 里新增：
```typescript
onAgentDagUpdate: makeListener<{ sessionId: string; dag: { nodes: unknown[]; edges: unknown[] } }>('agent:dag-update'),
```

**验收**：执行有 subagent 的任务时，`agent:dag-update` 事件被推送，数据结构正确。

---

## T2.7 Subagent 调用树 UI [ ]

安装：`npm install reactflow`

创建 `src/components/agent-tree/AgentTree.tsx`：

```typescript
// src/components/agent-tree/AgentTree.tsx
import { useCallback, useEffect, useState } from 'react';
import ReactFlow, {
  Background, Controls, MiniMap,
  useNodesState, useEdgesState,
  type NodeTypes,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { AgentNodeCard } from './AgentNodeCard';
import { useSessionStore } from '@/store/session-store';

const nodeTypes: NodeTypes = { agentNode: AgentNodeCard };

export function AgentTree() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const { sessionId } = useSessionStore();

  useEffect(() => {
    const cleanup = window.electron.onAgentDagUpdate(({ sessionId: sid, dag }) => {
      if (sid !== sessionId) return;
      setNodes(dag.nodes as any);
      setEdges(dag.edges as any);
    });
    return cleanup;
  }, [sessionId]);

  if (nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        当前任务没有 Subagent。执行复杂任务时这里会显示调用树。
      </div>
    );
  }

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        attributionPosition="bottom-right"
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}
```

创建 `src/components/agent-tree/AgentNodeCard.tsx`：

```typescript
// src/components/agent-tree/AgentNodeCard.tsx
import { memo, useState, useEffect } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react';
import type { AgentNode } from '../../../electron/main/agent-dag';

export const AgentNodeCard = memo(({ data }: NodeProps<AgentNode>) => {
  // 运行中节点显示实时计时器
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (data.status !== 'running') return;
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - data.startedAt) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [data.status, data.startedAt]);

  const statusIcon = {
    running: <Loader2 className="w-3 h-3 animate-spin text-blue-500" />,
    done:    <CheckCircle2 className="w-3 h-3 text-green-500" />,
    error:   <XCircle className="w-3 h-3 text-red-500" />,
  }[data.status];

  const borderColor = {
    running: 'border-blue-500/50 shadow-blue-500/20',
    done:    'border-green-500/30',
    error:   'border-red-500/50',
  }[data.status];

  const duration = data.finishedAt
    ? `${((data.finishedAt - data.startedAt) / 1000).toFixed(1)}s`
    : `${elapsed}s`;

  return (
    <>
      <Handle type="target" position={Position.Top} className="!bg-border" />

      <div className={`bg-card border-2 ${borderColor} rounded-lg p-3 min-w-48 max-w-64 shadow-sm`}>
        {/* 头部：类型 + 状态 */}
        <div className="flex items-center gap-2 mb-2">
          {statusIcon}
          <Badge variant="outline" className="text-xs">{data.agentType}</Badge>
          <span className="text-xs text-muted-foreground ml-auto flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {duration}
          </span>
        </div>

        {/* 描述 */}
        <p className="text-sm leading-tight line-clamp-2">{data.description}</p>

        {/* token 用量 */}
        {(data.usage.inputTokens > 0 || data.usage.outputTokens > 0) && (
          <div className="mt-2 text-xs text-muted-foreground flex gap-2">
            <span>↑{data.usage.inputTokens.toLocaleString()}</span>
            <span>↓{data.usage.outputTokens.toLocaleString()}</span>
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-border" />
    </>
  );
});
AgentNodeCard.displayName = 'AgentNodeCard';
```

**验收**：执行一个使用 subagent 的任务（如让 Claude 同时搜索和写代码），树图实时渲染，运行中节点有动画，完成后变绿色。

---

## T2.8 MCP 服务器管理 [ ]

创建 `src/components/config/McpManager.tsx`。

MCP 配置结构（读写 `~/.claude/.mcp.json` 用户级和 `<cwd>/.mcp.json` 项目级）：

```typescript
interface McpServer {
  type: 'stdio' | 'sse' | 'http';
  // stdio 类型
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  // sse / http 类型
  url?: string;
  headers?: Record<string, string>;
}

interface McpConfig {
  mcpServers: Record<string, McpServer>;
}
```

在 `config-manager.ts` 实现读写：

```typescript
export function readMcpConfig(scope: 'user' | 'project', cwd?: string): McpConfig {
  const filePath = scope === 'user'
    ? path.join(os.homedir(), '.claude', '.mcp.json')
    : path.join(cwd!, '.mcp.json');
  if (!fs.existsSync(filePath)) return { mcpServers: {} };
  try { return JSON.parse(fs.readFileSync(filePath, 'utf-8')); }
  catch { return { mcpServers: {} }; }
}

export function writeMcpConfig(scope: 'user' | 'project', config: McpConfig, cwd?: string): void {
  const filePath = scope === 'user'
    ? path.join(os.homedir(), '.claude', '.mcp.json')
    : path.join(cwd!, '.mcp.json');
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(config, null, 2));
}
```

UI 功能：
1. 两个 Tab：用户级 / 项目级
2. 服务器列表（名称、类型、命令/URL）
3. 新增按钮（表单：名称、类型、填对应字段）
4. 删除按钮（确认）
5. 连接测试（对 stdio 类型：spawn 进程发 `{"jsonrpc":"2.0","method":"initialize","id":1}` 测能否响应）

**验收**：可以添加删除 MCP 服务器，修改后写入 .mcp.json，下次启动 Claude Code 生效。

---

## T2.9 Skills 管理编辑器 [ ]

创建 `src/components/config/SkillsEditor.tsx`。

Skills 文件格式（`.claude/skills/*.md`）：

```markdown
---
name: skill-name
description: 技能描述
user-invocable: true
---
技能内容，$ARGUMENTS 占位符表示用户传入的参数
```

在 `config-manager.ts` 实现：

```typescript
interface Skill {
  filename: string;
  name: string;
  description: string;
  userInvocable: boolean;
  content: string;   // frontmatter 以外的 body
  fullText: string;  // 完整文件文本
}

export function listSkills(cwd: string): Skill[] {
  const skillsDir = path.join(cwd, '.claude', 'skills');
  if (!fs.existsSync(skillsDir)) return [];
  return fs.readdirSync(skillsDir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => parseSkillFile(path.join(skillsDir, f)));
}

function parseSkillFile(filePath: string): Skill {
  const text = fs.readFileSync(filePath, 'utf-8');
  // 解析 YAML frontmatter（--- ... --- 之间的内容）
  const match = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { filename: path.basename(filePath), name: '', description: '', userInvocable: true, content: text, fullText: text };
  // 简单 key: value 解析，不引入 js-yaml 依赖
  const frontmatter = Object.fromEntries(
    match[1].split('\n').map((line) => line.split(': ').map((s) => s.trim()))
  );
  return {
    filename: path.basename(filePath),
    name: frontmatter['name'] ?? '',
    description: frontmatter['description'] ?? '',
    userInvocable: frontmatter['user-invocable'] !== 'false',
    content: match[2].trim(),
    fullText: text,
  };
}

export function saveSkill(cwd: string, skill: Skill): void {
  const skillsDir = path.join(cwd, '.claude', 'skills');
  fs.mkdirSync(skillsDir, { recursive: true });
  const text = `---
name: ${skill.name}
description: ${skill.description}
user-invocable: ${skill.userInvocable}
---
${skill.content}`;
  fs.writeFileSync(path.join(skillsDir, skill.filename), text);
}

export function deleteSkill(cwd: string, filename: string): void {
  fs.unlinkSync(path.join(cwd, '.claude', 'skills', filename));
}
```

UI 功能：
1. 技能列表（名称、描述、是否用户可调用）
2. 点击编辑：frontmatter 表单 + Monaco Editor 编辑 body
3. 新建技能
4. 删除技能（确认弹窗）

**验收**：可以创建和编辑 Skills，创建后在 Claude Code 里可以通过 `/skill-name` 调用。

---

## Phase 2 完成标准

- [ ] HookServer 在 localhost:37421 正常接收 POST
- [ ] Bridge hook 自动注入 settings.json（12 种事件）
- [ ] Hooks 日志面板实时显示，颜色区分，可展开 payload
- [ ] Hook 规则向导式创建（非 JSON 编辑器）
- [ ] Stop hook 死循环警告 + 防护代码示例
- [ ] Hook 测试沙箱可独立运行脚本
- [ ] AgentDAG 正确构建树结构
- [ ] Subagent 树图实时渲染（有 subagent 任务中验证）
- [ ] MCP 服务器可添加/删除
- [ ] Skills 可创建/编辑/删除

**完成后执行 `tasks/phase-3.md`**
