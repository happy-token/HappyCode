# ARCHITECTURE.md

实现任何模块前先读本文档对应章节。

---

## 0. Phase 0 审计查看器规范

> **[plan-eng-review 2026-04-21 批准]** Phase 0 是只读审计查看器，不是 Chat UI。
> 旧 `phase-0.md`（chat loop）已作废。本节是 Phase 0 唯一规范来源。

### JSONL 路径

```
~/.claude/projects/<encoded-cwd>/<session-id>.jsonl
```

**CWD 编码规则：** 只替换 `/` 为 `-`，其他字符（`_`、`.`、空格等）保持不变。

```typescript
// 正确
const encodedCwd = cwd.replace(/\//g, '-');
// 错误（不能用）：cwd.replace(/[^a-zA-Z0-9]/g, '-')
```

### JSONL 解析规则

**保留条目（type 字段）：**
- `type == "assistant"` 且有 `message.usage` → 工具调用及响应
- `type == "user"` → 用户消息及工具结果

**跳过条目：**
- `type == "file-history-snapshot"` → 跳过
- `type == "system"` subtype `"init"` → 跳过

**UUID 去重（重要）：**
- Claude Code 对同一条消息写入多次快照，每次覆盖相同 `uuid` 字段
- 解析时保留每个 `uuid` 的**最后一次**出现，去掉之前的重复行
- 只在同一文件内去重，不跨文件

```typescript
// 去重算法骨架
const seen = new Map<string, unknown>();
for (const entry of rawEntries) {
  if (entry.uuid) seen.set(entry.uuid, entry);
  else seen.set(crypto.randomUUID(), entry); // 无 uuid 的行（罕见）不去重
}
const deduplicated = Array.from(seen.values());
```

**Timestamp 字段：** 使用条目顶层 `timestamp` 字段（Unix 秒浮点数）。
如果该字段缺失，回退到文件 `mtime`（session 级别精度，标注 `[estimated]`）。

**Live-write 安全：** Claude Code 可能正在写入 JSONL 文件（最后一行可能不完整）。
解析时每行独立 try/catch，malformed 行静默跳过，UI 显示跳过计数。

**文件大小限制：** `MAX_JSONL_SIZE = 10 * 1024 * 1024`（10MB）。
超过时不解析，返回空数组并通过 IPC 返回 `{ skipped: true, reason: 'file_too_large' }`，
UI 显示警告而不是崩溃。

**Token 计数：** 对去重后的 assistant 条目，累加 `message.usage.input_tokens` 和 `message.usage.output_tokens`，得到会话总 token 和估算成本。

**错误计数：** malformed 行数通过 IPC 随数据一起返回，UI 在底部显示 "N 行解析跳过"。

### Phase 0 CSV 导出 Schema

```
session_id, timestamp, tool_name, input_json, output_json, model, cost_usd
```

注意：
- **没有 `approved` 字段**（审批状态在 JSONL 中不持久化，Phase 2 通过 Hook Server 实现）
- `input_json` / `output_json` 导出原始 JSON 字符串（未脱敏）
- CSV 字段用标准 RFC 4180 格式转义（双引号包裹，内部双引号用 `""` 转义）

### Phase 0 测试要求（vitest）

以下算法必须在实现前写单元测试（TDD）：

| 测试目标 | 文件路径 |
|---|---|
| CWD 编码函数 | `test/session-store.test.ts` |
| UUID 去重算法 | `test/session-store.test.ts` |
| JSONL 逐行解析（含 malformed、partial） | `test/session-store.test.ts` |
| MAX_JSONL_SIZE 检查 | `test/session-store.test.ts` |
| CSV 行构建（字段映射、RFC 4180 转义） | `test/export.test.ts` |
| Timestamp 字段提取 | `test/session-store.test.ts` |

---

## 1. 进程模型

```
┌─────────────────── Electron ──────────────────────────┐
│                                                        │
│  Main Process (Node.js 全权限)                          │
│  ┌─────────────────────────────────────────────────┐  │
│  │  AgentManager  │  SessionStore  │  ConfigManager │  │
│  │  Agent SDK     │  SQLite+JSONL  │  ~/.claude/    │  │
│  └────────────────────────┬────────────────────────┘  │
│                           │ ipcMain / webContents.send │
│  Preload (隔离桥接)        │                            │
│  contextBridge → window.electron.*                     │
│                           │                            │
│  Renderer Process (浏览器沙箱)                          │
│  ┌────────────────────────▼────────────────────────┐  │
│  │  React + Zustand                                │  │
│  │  window.electron.xxx() 调用主进程               │  │
│  └─────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
              │ child_process.spawn (SDK 内部，Phase 1+)
              ▼
        Claude Code CLI
  ~/.claude/projects/<encoded-cwd>/<session-id>.jsonl
```

---

## 2. IPC Channel 完整列表

### Phase 0 通道（审计查看器）

```typescript
'session:list'             // { cwd } → { sessions: SessionInfo[], warnings: string[] }
'session:history'          // { sessionId, cwd } → { entries: AuditEntry[], skippedLines: number, skipped?: boolean, reason?: string }
'export:csv'               // { sessionId, cwd } → { csv: string }
```

### Phase 1+ 通道（Chat UI，未实现）

```typescript
'agent:start'              // { sessionId, prompt, cwd, resumeId? }
'agent:abort'              // { sessionId }
'agent:permission-response'// { sessionId, reqId, allowed: boolean }
'agent:tool-result'        // { sessionId, toolUseId, content }  ← AskUserQuestion 用
'session:delete'           // { sessionId, cwd }
'config:read-claude-md'    // { scope: 'user'|'project'|'local', cwd? } → string
'config:write-claude-md'   // { scope, content, cwd? }  ← Phase 1，Preload 暂不注册
```

### 主进程 → 渲染进程（send，单向推送，Phase 1+）

```typescript
'agent:event'              // { sessionId, msg }  ← SDK 每条消息
'agent:permission-request' // { sessionId, reqId, toolName, toolInput }
'agent:done'               // { sessionId }
'agent:error'              // { sessionId, error: string }
```

---

## 3. AgentManager 完整骨架（Phase 1+，Phase 0 不使用）

```typescript
// electron/main/agent-manager.ts
import { query } from '@anthropic-ai/claude-agent-sdk';
import { ipcMain, BrowserWindow } from 'electron';
import type { AgentStartParams, PermissionResponse } from '../shared/types';

interface ActiveSession {
  permissionCallbacks: Map<string, (allowed: boolean) => void>;
  toolResultCallbacks: Map<string, (content: string) => void>;
  abort: AbortController;
}

export class AgentManager {
  private sessions = new Map<string, ActiveSession>();

  constructor(private win: BrowserWindow) {}

  // 注意：同步方法，内部启动异步任务（不 await）
  startSession(params: AgentStartParams): void {
    const { sessionId, prompt, cwd, resumeId } = params;

    const abort = new AbortController();
    const permissionCallbacks = new Map<string, (allowed: boolean) => void>();
    const toolResultCallbacks = new Map<string, (content: string) => void>();

    this.sessions.set(sessionId, { permissionCallbacks, toolResultCallbacks, abort });

    // 异步执行，通过事件推给渲染进程
    (async () => {
      try {
        for await (const msg of query({
          prompt,
          options: {
            cwd,
            resume: resumeId,
            abortSignal: abort.signal,

            canUseTool: async (toolName: string, toolInput: unknown) => {
              // 1. 把权限请求推给渲染进程显示弹窗
              const reqId = crypto.randomUUID();
              this.win.webContents.send('agent:permission-request', {
                sessionId, reqId, toolName, toolInput,
              });

              // 2. 等待用户点击 Allow / Deny
              return new Promise<boolean>((resolve) => {
                permissionCallbacks.set(reqId, resolve);
              });
            },
          },
        })) {
          // 推给渲染进程
          this.win.webContents.send('agent:event', { sessionId, msg });
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return;
        this.win.webContents.send('agent:error', {
          sessionId,
          error: err instanceof Error ? err.message : String(err),
        });
      } finally {
        this.sessions.delete(sessionId);
        this.win.webContents.send('agent:done', { sessionId });
      }
    })();
  }

  respondPermission(response: PermissionResponse): void {
    const session = this.sessions.get(response.sessionId);
    const resolve = session?.permissionCallbacks.get(response.reqId);
    if (resolve) {
      resolve(response.allowed);
      session?.permissionCallbacks.delete(response.reqId);
    }
  }

  abortSession(sessionId: string): void {
    this.sessions.get(sessionId)?.abort.abort();
  }
}
```

---

## 4. Preload 骨架

### Phase 0 Preload（只暴露审计通道）

```typescript
// electron/preload/index.ts  —— Phase 0 版本
import { contextBridge, ipcRenderer } from 'electron';
import type { SessionInfo, AuditEntry } from '../shared/types';

contextBridge.exposeInMainWorld('electron', {
  listSessions: (cwd: string) =>
    ipcRenderer.invoke('session:list', { cwd }),
  readSessionHistory: (sessionId: string, cwd: string) =>
    ipcRenderer.invoke('session:history', { sessionId, cwd }),
  exportCsv: (sessionId: string, cwd: string) =>
    ipcRenderer.invoke('export:csv', { sessionId, cwd }),
});

// 注意：writeClaudeMd / startSession / 权限相关 API 不在 Phase 0，不注册
```

### Phase 1+ 完整 Preload（仅供参考，Phase 0 不实现）

```typescript
// electron/preload/index.ts — Phase 1+ 版本
import { contextBridge, ipcRenderer } from 'electron';
import type {
  AgentStartParams, PermissionResponse,
  AgentEvent, PermissionRequest, SessionInfo,
} from '../shared/types';

// 注册 on 监听时，返回 cleanup 函数防内存泄漏
function makeListener<T>(channel: string) {
  return (callback: (data: T) => void): (() => void) => {
    const handler = (_: unknown, data: T) => callback(data);
    ipcRenderer.on(channel, handler);
    return () => ipcRenderer.off(channel, handler);
  };
}

contextBridge.exposeInMainWorld('electron', {
  startSession:          (p: AgentStartParams)     => ipcRenderer.invoke('agent:start', p),
  abortSession:          (sessionId: string)        => ipcRenderer.invoke('agent:abort', { sessionId }),
  respondPermission:     (r: PermissionResponse)    => ipcRenderer.invoke('agent:permission-response', r),
  sendToolResult:        (p: { sessionId: string; toolUseId: string; content: string }) =>
                                                        ipcRenderer.invoke('agent:tool-result', p),
  listSessions:          (cwd: string)              => ipcRenderer.invoke('session:list', { cwd }),
  readSessionHistory:    (sessionId: string, cwd: string) =>
                                                        ipcRenderer.invoke('session:history', { sessionId, cwd }),
  exportCsv:             (sessionId: string, cwd: string) =>
                                                        ipcRenderer.invoke('export:csv', { sessionId, cwd }),
  readClaudeMd:          (scope: string, cwd?: string) =>
                                                        ipcRenderer.invoke('config:read-claude-md', { scope, cwd }),
  writeClaudeMd:         (scope: string, content: string, cwd?: string) =>
                                                        ipcRenderer.invoke('config:write-claude-md', { scope, content, cwd }),

  onAgentEvent:          makeListener<AgentEvent>('agent:event'),
  onPermissionRequest:   makeListener<PermissionRequest>('agent:permission-request'),
  onAgentDone:           makeListener<{ sessionId: string }>('agent:done'),
  onAgentError:          makeListener<{ sessionId: string; error: string }>('agent:error'),
});
```

---

## 5. 共享类型

```typescript
// electron/shared/types.ts

export interface AgentStartParams {
  sessionId: string;
  prompt: string;
  cwd: string;
  resumeId?: string;
}

export interface PermissionResponse {
  sessionId: string;
  reqId: string;
  allowed: boolean;
}

export interface PermissionRequest {
  sessionId: string;
  reqId: string;
  toolName: string;
  toolInput: unknown;
}

export interface AgentEvent {
  sessionId: string;
  msg: SDKMessage;
}

// SDK 消息类型（按需扩展）
export type SDKMessage =
  | { type: 'system'; subtype: 'init'; session_id: string; model: string }
  | { type: 'system'; subtype: 'compact_boundary' }
  | { type: 'system'; subtype: 'agent_start'; subagent_id: string; parent_session_id: string; agent_type: string; description: string }
  | { type: 'system'; subtype: 'agent_stop'; subagent_id: string; status: string; usage: TokenUsage }
  | { type: 'assistant'; message: AssistantMessage }
  | { type: 'result'; subtype: 'success'; cost_usd: number; usage: TokenUsage }
  | { type: 'result'; subtype: 'error_during_execution'; error: string };

export interface AssistantMessage {
  content: ContentBlock[];
}

export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'thinking'; thinking: string }
  | { type: 'tool_use'; id: string; name: string; input: unknown };

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
}

export interface SessionInfo {
  session_id: string;
  cwd: string;
  title?: string;
  last_used: number;
  message_count?: number;
  total_cost_usd?: number;
}

// Phase 0 审计条目
export interface AuditEntry {
  uuid: string;
  timestamp: number;
  timestampEstimated?: boolean;
  type: string;
  toolName?: string;
  inputJson?: string;
  outputJson?: string;
  model?: string;
  costUsd?: number;
}

// Phase 0 导出 CSV 行
export interface CsvRow {
  session_id: string;
  timestamp: string;
  tool_name: string;
  input_json: string;
  output_json: string;
  model: string;
  cost_usd: string;
}

// 渲染进程 window.electron 的类型（Phase 0）
export interface ElectronAPI {
  listSessions: (cwd: string) => Promise<{ sessions: SessionInfo[]; warnings: string[] }>;
  readSessionHistory: (sessionId: string, cwd: string) => Promise<{
    entries: AuditEntry[];
    skippedLines: number;
    skipped?: boolean;
    reason?: string;
  }>;
  exportCsv: (sessionId: string, cwd: string) => Promise<{ csv: string }>;
}

// 扩展 window 类型
declare global {
  interface Window {
    electron: ElectronAPI;
  }
}
```

---

## 6. Zustand Store 骨架（Phase 1+）

```typescript
// src/store/session-store.ts
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { SDKMessage, PermissionRequest, SessionInfo } from '../../electron/shared/types';

// ── 消息类型（渲染层） ──────────────────────────────────────
export type UIMessage =
  | { id: string; type: 'text'; text: string; streaming?: boolean }
  | { id: string; type: 'thinking'; text: string }
  | { id: string; type: 'diff'; toolUseId: string; filePath: string; oldString: string; newString: string; toolName: 'Edit' | 'Write' | 'MultiEdit' }
  | { id: string; type: 'ask'; toolUseId: string; questions: AskQuestion[] }
  | { id: string; type: 'plan'; toolUseId: string; plan: string }
  | { id: string; type: 'error'; text: string }
  | { id: string; type: 'compact_boundary' };

export interface AskQuestion {
  question: string;
  header?: string;
  multiSelect: boolean;
  options: Array<{ label: string; description?: string }>;
}

export interface Todo {
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
  activeForm: string;
}

// ── Store ──────────────────────────────────────────────────
interface SessionState {
  sessionId: string | null;
  cwd: string;
  messages: UIMessage[];
  todos: Todo[];
  pendingPermission: PermissionRequest | null;
  isRunning: boolean;
  usage: { inputTokens: number; outputTokens: number; costUsd: number };
  sessionList: SessionInfo[];

  setCwd: (cwd: string) => void;
  setSessionId: (id: string | null) => void;
  setRunning: (running: boolean) => void;
  setPendingPermission: (req: PermissionRequest | null) => void;
  setSessionList: (list: SessionInfo[]) => void;
  resetSession: () => void;
  handleAgentEvent: (sessionId: string, msg: SDKMessage) => void;
}

export const useSessionStore = create<SessionState>()(
  immer((set) => ({
    sessionId: null,
    cwd: '',
    messages: [],
    todos: [],
    pendingPermission: null,
    isRunning: false,
    usage: { inputTokens: 0, outputTokens: 0, costUsd: 0 },
    sessionList: [],

    setCwd: (cwd) => set((s) => { s.cwd = cwd; }),
    setSessionId: (id) => set((s) => { s.sessionId = id; }),
    setRunning: (running) => set((s) => { s.isRunning = running; }),
    setPendingPermission: (req) => set((s) => { s.pendingPermission = req; }),
    setSessionList: (list) => set((s) => { s.sessionList = list; }),

    resetSession: () => set((s) => {
      s.messages = [];
      s.todos = [];
      s.pendingPermission = null;
      s.isRunning = false;
      s.usage = { inputTokens: 0, outputTokens: 0, costUsd: 0 };
    }),

    handleAgentEvent: (sessionId, msg) => set((s) => {
      if (s.sessionId !== sessionId) return;

      if (msg.type === 'system') {
        if (msg.subtype === 'init') {
          s.sessionId = msg.session_id;
        } else if (msg.subtype === 'compact_boundary') {
          s.messages.push({ id: crypto.randomUUID(), type: 'compact_boundary' });
        }
        return;
      }

      if (msg.type === 'result') {
        if (msg.subtype === 'success') {
          s.usage = {
            inputTokens: msg.usage.input_tokens,
            outputTokens: msg.usage.output_tokens,
            costUsd: msg.cost_usd,
          };
        } else {
          s.messages.push({ id: crypto.randomUUID(), type: 'error', text: msg.error });
        }
        return;
      }

      if (msg.type === 'assistant') {
        for (const block of msg.message.content) {
          if (block.type === 'text') {
            const lastMsg = s.messages.at(-1);
            if (lastMsg?.type === 'text' && lastMsg.streaming) {
              lastMsg.text += block.text;
            } else {
              s.messages.push({ id: crypto.randomUUID(), type: 'text', text: block.text, streaming: true });
            }
          } else if (block.type === 'thinking') {
            s.messages.push({ id: crypto.randomUUID(), type: 'thinking', text: block.thinking });
          } else if (block.type === 'tool_use') {
            const input = block.input as Record<string, unknown>;

            if (block.name === 'TodoWrite') {
              s.todos = input.todos as Todo[];
            } else if (block.name === 'AskUserQuestion') {
              s.messages.push({
                id: crypto.randomUUID(), type: 'ask',
                toolUseId: block.id,
                questions: input.questions as AskQuestion[],
              });
            } else if (['Edit', 'Write', 'MultiEdit'].includes(block.name)) {
              s.messages.push({
                id: crypto.randomUUID(), type: 'diff',
                toolUseId: block.id,
                toolName: block.name as 'Edit' | 'Write' | 'MultiEdit',
                filePath: (input.file_path ?? input.path ?? '') as string,
                oldString: (input.old_string ?? '') as string,
                newString: (input.new_string ?? input.content ?? '') as string,
              });
            } else if (block.name === 'ExitPlanMode') {
              s.messages.push({
                id: crypto.randomUUID(), type: 'plan',
                toolUseId: block.id,
                plan: input.plan as string,
              });
            }
          }
        }

        const lastText = [...s.messages].reverse().find(m => m.type === 'text');
        if (lastText && 'streaming' in lastText) {
          lastText.streaming = false;
        }
      }
    }),
  }))
);
```

---

## 7. SessionStore（SQLite + JSONL）骨架

```typescript
// electron/main/session-store.ts
import Database from 'better-sqlite3';
import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import type { SessionInfo, AuditEntry } from '../shared/types';

const MAX_JSONL_SIZE = 10 * 1024 * 1024; // 10MB

export class SessionStore {
  private db: Database.Database;

  constructor() {
    const dbPath = path.join(app.getPath('userData'), 'db.sqlite3');
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.init();
  }

  private init() {
    // Phase 0: sessions 表只。hook_events / scheduled_tasks 在 Phase 2 添加。
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        cwd TEXT NOT NULL,
        started_at INTEGER NOT NULL,
        last_message_at INTEGER NOT NULL,
        message_count INTEGER DEFAULT 0,
        total_cost_usd REAL DEFAULT 0
      );
    `);
  }

  upsertSession(session: Omit<SessionInfo, 'title'> & { title?: string }): void {
    this.db.prepare(`
      INSERT INTO sessions (id, cwd, started_at, last_message_at)
      VALUES (@id, @cwd, @started_at, @last_message_at)
      ON CONFLICT(id) DO UPDATE SET
        last_message_at = excluded.last_message_at
    `).run({
      id: session.session_id,
      cwd: session.cwd,
      started_at: session.last_used,
      last_message_at: session.last_used,
    });
  }

  listByCwd(cwd: string): { sessions: SessionInfo[]; warnings: string[] } {
    const rows = this.db.prepare(`
      SELECT id as session_id, cwd, last_message_at as last_used, message_count, total_cost_usd
      FROM sessions WHERE cwd = ?
      ORDER BY last_message_at DESC
    `).all(cwd) as SessionInfo[];

    if (rows.length === 0) {
      return this.scanFromFS(cwd);
    }
    return { sessions: rows, warnings: [] };
  }

  // 直接扫描 ~/.claude/projects/ 目录
  scanFromFS(cwd: string): { sessions: SessionInfo[]; warnings: string[] } {
    // 只替换 / 为 -，其他字符保持不变
    const encodedCwd = cwd.replace(/\//g, '-');
    const dir = path.join(os.homedir(), '.claude', 'projects', encodedCwd);
    const warnings: string[] = [];

    if (!fs.existsSync(dir)) return { sessions: [], warnings };

    // 优先读 sessions-index.json
    const indexFile = path.join(dir, 'sessions-index.json');
    if (fs.existsSync(indexFile)) {
      try {
        const index = JSON.parse(fs.readFileSync(indexFile, 'utf-8'));
        return {
          sessions: (Array.isArray(index) ? index : []).map((s: Record<string, unknown>) => ({
            session_id: (s['session_id'] ?? s['id']) as string,
            cwd,
            title: s['title'] as string | undefined,
            last_used: (s['last_used'] as number) ?? Date.now(),
          })),
          warnings,
        };
      } catch { /* fallthrough to .jsonl scan */ }
    }

    // 扫描 .jsonl 文件
    const sessions = fs.readdirSync(dir)
      .filter((f) => f.endsWith('.jsonl') && !f.startsWith('.'))
      .map((f) => ({
        session_id: f.replace('.jsonl', ''),
        cwd,
        last_used: fs.statSync(path.join(dir, f)).mtimeMs,
      }))
      .sort((a, b) => b.last_used - a.last_used);

    return { sessions, warnings };
  }

  // 读取并解析 JSONL，返回审计条目
  readHistory(sessionId: string, cwd: string): {
    entries: AuditEntry[];
    skippedLines: number;
    skipped?: boolean;
    reason?: string;
  } {
    const encodedCwd = cwd.replace(/\//g, '-');
    const filePath = path.join(
      os.homedir(), '.claude', 'projects', encodedCwd, `${sessionId}.jsonl`
    );

    if (!fs.existsSync(filePath)) {
      return { entries: [], skippedLines: 0 };
    }

    // 大文件保护
    const stat = fs.statSync(filePath);
    if (stat.size > MAX_JSONL_SIZE) {
      return { entries: [], skippedLines: 0, skipped: true, reason: 'file_too_large' };
    }

    const raw = fs.readFileSync(filePath, 'utf-8');
    const lines = raw.split('\n');

    // 逐行解析，live-write 安全（最后一行可能不完整）
    const rawEntries: Array<Record<string, unknown>> = [];
    let skippedLines = 0;
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        rawEntries.push(JSON.parse(line) as Record<string, unknown>);
      } catch {
        skippedLines++;
      }
    }

    // UUID 去重：保留每个 uuid 的最后一次出现
    const seen = new Map<string, Record<string, unknown>>();
    for (const entry of rawEntries) {
      const uuid = entry['uuid'] as string | undefined;
      const key = uuid ?? crypto.randomUUID();
      seen.set(key, entry);
    }

    const fileMtime = stat.mtimeMs / 1000;

    // 过滤并转换为 AuditEntry
    const entries: AuditEntry[] = [];
    for (const entry of seen.values()) {
      const type = entry['type'] as string;

      // 跳过 snapshot 和 init
      if (type === 'file-history-snapshot') continue;
      if (type === 'system' && (entry['subtype'] as string) === 'init') continue;

      const ts = entry['timestamp'] as number | undefined;
      const timestamp = ts ?? fileMtime;
      const timestampEstimated = !ts;

      entries.push({
        uuid: (entry['uuid'] as string) ?? '',
        timestamp,
        timestampEstimated,
        type,
        toolName: (entry['toolName'] ?? entry['tool_name']) as string | undefined,
        inputJson: entry['input'] !== undefined ? JSON.stringify(entry['input']) : undefined,
        outputJson: entry['output'] !== undefined ? JSON.stringify(entry['output']) : undefined,
        model: entry['model'] as string | undefined,
        costUsd: entry['cost_usd'] as number | undefined,
      });
    }

    return { entries, skippedLines };
  }
}
```

---

## 8. SDK 事件 → UI 映射速查（Phase 1+）

| SDK msg | 触发条件 | store 操作 |
|---|---|---|
| `system/init` | 会话开始 | 更新 `sessionId` |
| `system/compact_boundary` | /compact 触发 | 插入分割线消息 |
| `assistant` + text block | Claude 文字回复 | 流式追加到最后一条 text 消息 |
| `assistant` + thinking block | 扩展推理 | 插入 thinking 消息 |
| `assistant` + tool_use `TodoWrite` | 任务更新 | 整体替换 `todos` |
| `assistant` + tool_use `AskUserQuestion` | Claude 提问 | 插入 ask 消息（含 toolUseId） |
| `assistant` + tool_use `Edit`/`Write` | 文件修改 | 插入 diff 消息（含 toolUseId） |
| `assistant` + tool_use `ExitPlanMode` | Plan Mode 完成 | 插入 plan 消息 |
| `canUseTool` 回调 | 权限请求 | IPC 推 → `setPendingPermission` |
| `result/success` | 会话结束 | 更新 `usage` |
| `result/error` | 执行错误 | 插入 error 消息 |
