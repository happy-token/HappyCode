# Phase 0：地基（Week 1-2）

**目标**：Electron 窗口里发一条消息，看到 Claude 流式回复。

完成每项任务后打 `[x]`，不要跳任务。

---

## T0.1 项目初始化 [ ]

```bash
npm create @quick-start/electron@latest my-claude-gui -- --template react-ts
cd my-claude-gui

npm install @anthropic-ai/claude-agent-sdk
npm install better-sqlite3 @types/better-sqlite3
npm install express @types/express
npm install zustand immer

npm install -D electron-rebuild
```

`package.json` 的 `scripts` 加：
```json
"postinstall": "electron-rebuild -f -w better-sqlite3"
```

**验收**：`npm run dev` 打开 Electron 窗口，显示默认页面，无报错。

---

## T0.2 目录结构 [ ]

创建以下空文件（内容在后续任务填充）：

```bash
mkdir -p electron/main electron/preload electron/shared
mkdir -p src/store src/lib src/components/chat src/components/session src/components/config

touch electron/main/agent-manager.ts
touch electron/main/session-store.ts
touch electron/main/config-manager.ts
touch electron/main/ipc-handlers.ts
touch electron/shared/types.ts
touch src/store/session-store.ts
touch src/lib/session-reader.ts
```

**验收**：目录结构符合 CLAUDE.md 要求。

---

## T0.3 共享类型 [ ]

将 ARCHITECTURE.md **第 5 节「共享类型」** 的完整代码写入 `electron/shared/types.ts`。

不要修改内容，直接复制。

**验收**：`npx tsc --noEmit` 无报错。

---

## T0.4 Preload 桥接层 [ ]

将 ARCHITECTURE.md **第 4 节「Preload 完整骨架」** 的代码写入 `electron/preload/index.ts`。

然后在 `electron/main/index.ts` 的 `BrowserWindow` 构造参数里确认：
```typescript
webPreferences: {
  preload: join(__dirname, '../preload/index.js'),
  nodeIntegration: false,   // 必须 false
  contextIsolation: true,   // 必须 true
},
```

**验收**：渲染进程的 `window.electron` 可访问（在 DevTools console 输入 `window.electron` 看到对象）。

---

## T0.5 AgentManager [ ]

将 ARCHITECTURE.md **第 3 节「AgentManager 完整骨架」** 的代码写入 `electron/main/agent-manager.ts`。

**验收**：TypeScript 编译无错误。`AgentManager` 可以实例化。

---

## T0.6 SessionStore [ ]

将 ARCHITECTURE.md **第 7 节「SessionStore 骨架」** 的代码写入 `electron/main/session-store.ts`。

**验收**：TypeScript 编译无错误。SQLite 文件在 `app.getPath('userData')` 下被创建。

---

## T0.7 IPC Handlers [ ]

创建 `electron/main/ipc-handlers.ts`：

```typescript
// electron/main/ipc-handlers.ts
import { ipcMain, BrowserWindow } from 'electron';
import { AgentManager } from './agent-manager';
import { SessionStore } from './session-store';
import type {
  AgentStartParams,
  PermissionResponse,
} from '../shared/types';

export function registerHandlers(
  win: BrowserWindow,
  agentManager: AgentManager,
  sessionStore: SessionStore,
) {
  ipcMain.handle('agent:start', (_, params: AgentStartParams) => {
    agentManager.startSession(params);
    // 注意：不 return Promise，startSession 是同步的（内部异步）
  });

  ipcMain.handle('agent:abort', (_, { sessionId }: { sessionId: string }) => {
    agentManager.abortSession(sessionId);
  });

  ipcMain.handle('agent:permission-response', (_, response: PermissionResponse) => {
    agentManager.respondPermission(response);
  });

  ipcMain.handle('session:list', (_, { cwd }: { cwd: string }) => {
    return sessionStore.listByCwd(cwd);
  });

  ipcMain.handle('session:history', (_, { sessionId, cwd }: { sessionId: string; cwd: string }) => {
    return sessionStore.readHistory(sessionId, cwd);
  });

  // TODO Phase 1: config:read-claude-md, config:write-claude-md
}
```

在 `electron/main/index.ts` 的 `app.whenReady()` 里：

```typescript
const win = new BrowserWindow({ ... });
const agentManager = new AgentManager(win);
const sessionStore = new SessionStore();
registerHandlers(win, agentManager, sessionStore);
```

**验收**：所有 IPC channel 注册完成，无"channel already registered"错误。

---

## T0.8 Zustand Store [ ]

将 ARCHITECTURE.md **第 6 节「Zustand Store 骨架」** 的代码写入 `src/store/session-store.ts`。

**注意**：从 `'../../electron/shared/types'` 导入类型时，
electron-vite 的路径别名可能需要调整，改用相对路径或在 `tsconfig.json` 里配置路径映射。

**验收**：TypeScript 编译无错误，`useSessionStore` 可以在组件里 import。

---

## T0.9 最简 UI（跑通数据流） [ ]

替换 `src/App.tsx`，实现最简对话界面。

**此阶段不做任何样式，只验证数据流通。**

骨架：

```typescript
// src/App.tsx
import { useState, useEffect, useRef } from 'react';
import { useSessionStore } from './store/session-store';

const HARDCODED_CWD = '/tmp/claude-test'; // 先硬编码，T1 阶段改成可选择

export default function App() {
  const [input, setInput] = useState('');
  const sessionIdRef = useRef<string>(crypto.randomUUID());

  const {
    messages, todos, pendingPermission,
    isRunning, usage,
    handleAgentEvent, setRunning, setPendingPermission, resetSession,
  } = useSessionStore();

  // 监听主进程推送的事件
  useEffect(() => {
    const cleanups = [
      window.electron.onAgentEvent(({ sessionId, msg }) => {
        handleAgentEvent(sessionId, msg as any); // 此处暂时用 any，T0.3 类型完善后去掉
      }),
      window.electron.onPermissionRequest((req) => {
        setPendingPermission(req);
      }),
      window.electron.onAgentDone(() => {
        setRunning(false);
      }),
      window.electron.onAgentError(({ error }) => {
        setRunning(false);
        console.error('Agent error:', error);
      }),
    ];
    return () => cleanups.forEach((fn) => fn());
  }, []);

  const handleSend = () => {
    if (!input.trim() || isRunning) return;
    resetSession();
    setRunning(true);
    window.electron.startSession({
      sessionId: sessionIdRef.current,
      prompt: input,
      cwd: HARDCODED_CWD,
    });
    setInput('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', padding: 16 }}>
      {/* 消息列表 */}
      <div style={{ flex: 1, overflowY: 'auto', marginBottom: 8 }}>
        {messages.map((msg) => (
          <div key={msg.id} style={{ marginBottom: 8 }}>
            {msg.type === 'text' && <p>{msg.text}</p>}
            {msg.type === 'thinking' && <details><summary>Thinking</summary><p>{msg.text}</p></details>}
            {msg.type === 'diff' && (
              <div style={{ background: '#f0f0f0', padding: 8 }}>
                <strong>File: {msg.filePath}</strong>
                <pre>{msg.newString}</pre>
                {/* Phase 1 替换成真正的 Monaco diff */}
              </div>
            )}
            {msg.type === 'error' && <p style={{ color: 'red' }}>{msg.text}</p>}
          </div>
        ))}
      </div>

      {/* Todo 列表（临时） */}
      {todos.length > 0 && (
        <div style={{ marginBottom: 8, border: '1px solid #ccc', padding: 8 }}>
          {todos.map((todo, i) => (
            <div key={i}>[{todo.status}] {todo.content}</div>
          ))}
        </div>
      )}

      {/* 权限审批弹窗（临时，Phase 1 用 shadcn Dialog 替换） */}
      {pendingPermission && (
        <div style={{ background: 'yellow', padding: 8, marginBottom: 8 }}>
          <p>Allow {pendingPermission.toolName}?</p>
          <button onClick={() => {
            window.electron.respondPermission({
              sessionId: pendingPermission.sessionId,
              reqId: pendingPermission.reqId,
              allowed: true,
            });
            setPendingPermission(null);
          }}>Allow</button>
          <button onClick={() => {
            window.electron.respondPermission({
              sessionId: pendingPermission.sessionId,
              reqId: pendingPermission.reqId,
              allowed: false,
            });
            setPendingPermission(null);
          }}>Deny</button>
        </div>
      )}

      {/* 输入区 */}
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          style={{ flex: 1, padding: 8 }}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
          placeholder="发消息给 Claude..."
          disabled={isRunning}
        />
        <button onClick={handleSend} disabled={isRunning || !input.trim()}>
          {isRunning ? '思考中...' : '发送'}
        </button>
        {isRunning && (
          <button onClick={() => window.electron.abortSession(sessionIdRef.current)}>
            停止
          </button>
        )}
      </div>

      {/* token 状态（临时） */}
      <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
        ↑{usage.inputTokens} ↓{usage.outputTokens} ${usage.costUsd.toFixed(4)}
      </div>
    </div>
  );
}
```

**验收清单**：
- [ ] 发一条消息，Claude 流式文字回复显示
- [ ] Claude 请求权限时出现 Allow/Deny 按钮
- [ ] Allow 后 Claude 继续执行，Deny 后 Claude 停止
- [ ] 停止按钮有效，Claude 立即停止生成
- [ ] token 计数在回复结束后更新

---

## T0.10 CI 三平台构建 [ ]

创建 `.github/workflows/build.yml`：

```yaml
name: Build
on: [push, pull_request]

jobs:
  build:
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: Install dependencies
        run: npm install
      - name: Build
        run: npm run build
```

**验收**：三平台构建均通过（允许 warning，不允许 error）。

---

## Phase 0 完成标准

以下全部满足：

- [ ] `npm run dev` 打开窗口无报错
- [ ] 流式对话完整跑通（文字显示、权限审批、停止按钮）
- [ ] TypeScript strict 模式，`npx tsc --noEmit` 无报错
- [ ] Mac + Linux + Windows CI 构建通过
- [ ] `better-sqlite3` 三平台 rebuild 正常

**完成后执行 `tasks/phase-1.md`**
