# Phase 1：MVP 核心功能（Week 3-6）

**前提**：Phase 0 全部完成。

**目标**：完整走通一个真实编码任务，达到可以内测发布的质量。

---

## T1.1 shadcn/ui 接入 [ ]

```bash
npx shadcn@latest init
# 选择：TypeScript, 默认风格, 默认颜色

# 按需添加（不要一次全加）
npx shadcn@latest add dialog button badge collapsible tabs input textarea scroll-area separator
```

**验收**：`import { Button } from '@/components/ui/button'` 可用，无报错。

---

## T1.2 消息列表完整化 [ ]

用真正的组件替换 T0.9 里的临时消息显示。

安装：`npm install react-markdown rehype-highlight highlight.js`

创建 `src/components/chat/MessageList.tsx`：

```typescript
// src/components/chat/MessageList.tsx
import { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github-dark.css';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { useSessionStore, UIMessage } from '@/store/session-store';

export function MessageList() {
  const messages = useSessionStore((s) => s.messages);
  const bottomRef = useRef<HTMLDivElement>(null);

  // 新消息自动滚动到底部
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-3">
      {messages.map((msg) => <MessageItem key={msg.id} msg={msg} />)}
      <div ref={bottomRef} />
    </div>
  );
}

function MessageItem({ msg }: { msg: UIMessage }) {
  switch (msg.type) {
    case 'text':
      return (
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <ReactMarkdown rehypePlugins={[rehypeHighlight]}>
            {msg.text}
          </ReactMarkdown>
          {msg.streaming && <span className="animate-pulse">▋</span>}
        </div>
      );

    case 'thinking':
      return (
        <Collapsible>
          <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <Badge variant="outline">思考过程</Badge>
            <span>点击展开</span>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-2 p-3 bg-muted rounded text-sm font-mono whitespace-pre-wrap">
              {msg.thinking ?? msg.text}
            </div>
          </CollapsibleContent>
        </Collapsible>
      );

    case 'compact_boundary':
      return (
        <div className="flex items-center gap-2 py-1">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground">上下文已压缩</span>
          <div className="flex-1 h-px bg-border" />
        </div>
      );

    case 'error':
      return (
        <div className="p-3 bg-destructive/10 text-destructive rounded text-sm">
          错误：{msg.text}
        </div>
      );

    // diff / ask / plan 由各自专属组件处理，此处不渲染
    default:
      return null;
  }
}
```

**验收**：Markdown 正确渲染，代码块有语法高亮，thinking 可折叠。

---

## T1.3 权限审批弹窗（正式版） [ ]

用 shadcn Dialog 替换 T0.9 的临时黄色弹窗。

创建 `src/components/chat/PermissionDialog.tsx`：

```typescript
// src/components/chat/PermissionDialog.tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSessionStore } from '@/store/session-store';

export function PermissionDialog() {
  const { pendingPermission, setPendingPermission } = useSessionStore();
  if (!pendingPermission) return null;

  const respond = (allowed: boolean) => {
    window.electron.respondPermission({
      sessionId: pendingPermission.sessionId,
      reqId: pendingPermission.reqId,
      allowed,
    });
    setPendingPermission(null);
  };

  return (
    <Dialog open>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>权限请求</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">工具：</span>
            <Badge>{pendingPermission.toolName}</Badge>
          </div>
          <div className="p-3 bg-muted rounded">
            <pre className="text-xs overflow-auto whitespace-pre-wrap">
              {JSON.stringify(pendingPermission.toolInput, null, 2)}
            </pre>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => respond(false)}>拒绝</Button>
          <Button onClick={() => respond(true)}>允许</Button>
          {/* TODO Phase 1: "始终允许" 按钮，写入 settings.json 的 permissions.allow */}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

**验收**：权限弹窗有工具名和参数预览，Allow/Deny 均正常工作。

---

## T1.4 TodoWrite 侧边栏 [ ]

创建 `src/components/chat/TodoPanel.tsx`：

```typescript
// src/components/chat/TodoPanel.tsx
import { CheckCircle2, Circle, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useSessionStore, Todo } from '@/store/session-store';

export function TodoPanel() {
  const todos = useSessionStore((s) => s.todos);
  if (todos.length === 0) return null;

  const completed = todos.filter((t) => t.status === 'completed').length;

  return (
    <div className="w-64 border-l p-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">任务进度</span>
        <Badge variant="secondary">{completed}/{todos.length}</Badge>
      </div>
      <div className="space-y-1.5">
        {todos.map((todo, i) => <TodoItem key={i} todo={todo} />)}
      </div>
    </div>
  );
}

function TodoItem({ todo }: { todo: Todo }) {
  const icons = {
    pending: <Circle className="w-4 h-4 text-muted-foreground" />,
    in_progress: <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />,
    completed: <CheckCircle2 className="w-4 h-4 text-green-500" />,
  };

  return (
    <div className="flex items-start gap-2">
      {icons[todo.status]}
      <div>
        <span className={`text-sm ${todo.status === 'completed' ? 'line-through text-muted-foreground' : ''}`}>
          {todo.content}
        </span>
        {todo.activeForm && todo.status === 'in_progress' && (
          <p className="text-xs text-muted-foreground mt-0.5">{todo.activeForm}</p>
        )}
      </div>
    </div>
  );
}
```

安装 `lucide-react`：`npm install lucide-react`

**验收**：执行多步任务时，侧边栏实时三态更新，完成的任务划线。

---

## T1.5 AskUserQuestion 弹窗 [ ]

创建 `src/components/chat/AskUserDialog.tsx`：

```typescript
// src/components/chat/AskUserDialog.tsx
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSessionStore, AskQuestion } from '@/store/session-store';

export function AskUserDialog() {
  const { messages, sessionId } = useSessionStore();

  // 找到最后一条未回答的 ask 消息
  const pendingAsk = [...messages].reverse().find((m) => m.type === 'ask') as
    | { id: string; type: 'ask'; toolUseId: string; questions: AskQuestion[] }
    | undefined;

  if (!pendingAsk || !sessionId) return null;

  return (
    <Dialog open>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Claude 需要你的输入</DialogTitle>
        </DialogHeader>
        {pendingAsk.questions.map((q, i) => (
          <QuestionBlock
            key={i}
            question={q}
            sessionId={sessionId}
            toolUseId={pendingAsk.toolUseId}
          />
        ))}
      </DialogContent>
    </Dialog>
  );
}

function QuestionBlock({
  question, sessionId, toolUseId,
}: {
  question: AskQuestion;
  sessionId: string;
  toolUseId: string;
}) {
  const [selected, setSelected] = useState<number[]>([]);
  const { messages, setMessages } = useSessionStore(); // 需要在 store 里加 setMessages

  const submit = () => {
    const answers = selected.map((i) => question.options[i].label);
    const content = question.multiSelect ? answers.join(', ') : answers[0];

    // 发送 tool_result 给 Claude
    window.electron.sendToolResult({ sessionId, toolUseId, content });

    // 从消息列表移除这条 ask 消息（标记为已回答）
    // 此处需要在 store 里加一个 removeMessage(id) 方法
  };

  return (
    <div className="space-y-3">
      {question.header && <p className="font-medium">{question.header}</p>}
      <p className="text-sm">{question.question}</p>
      <div className="space-y-2">
        {question.options.map((opt, i) => (
          <button
            key={i}
            onClick={() => {
              if (question.multiSelect) {
                setSelected((prev) =>
                  prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]
                );
              } else {
                setSelected([i]);
              }
            }}
            className={`w-full text-left p-3 rounded border text-sm transition-colors
              ${selected.includes(i) ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted'}`}
          >
            <div className="font-medium">{opt.label}</div>
            {opt.description && <div className="text-muted-foreground text-xs mt-1">{opt.description}</div>}
          </button>
        ))}
      </div>
      <DialogFooter>
        <Button onClick={submit} disabled={selected.length === 0}>确认</Button>
      </DialogFooter>
    </div>
  );
}
```

**注意**：`AskUserQuestion` 不走 `canUseTool` 回调，需要在 `AgentManager` 里单独处理，
发送 `tool_result` 给 CLI。在 `AgentManager` 里加 `sendToolResult()` 方法：

```typescript
// 在 AgentManager 里新增（需要持有 query 的输入 generator 引用）
// V1 的 query() 不支持中途发送 tool_result，需要查阅最新 SDK 文档
// 备选方案：重新发一条 user 消息包含选择结果
```

**先用备选方案（重发 user 消息），后续版本改成正式实现。**

**验收**：Claude 提问时显示选项，用户选择后 Claude 继续执行。

---

## T1.6 File Diff Accept/Reject [ ]

安装：`npm install @monaco-editor/react`

创建 `src/components/chat/DiffCard.tsx`：

```typescript
// src/components/chat/DiffCard.tsx
import { DiffEditor } from '@monaco-editor/react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Check, X } from 'lucide-react';

interface DiffCardProps {
  filePath: string;
  oldString: string;
  newString: string;
  toolName: string;
  onAccept: () => void;
  onReject: () => void;
}

export function DiffCard({ filePath, oldString, newString, toolName, onAccept, onReject }: DiffCardProps) {
  return (
    <div className="border rounded-lg overflow-hidden">
      {/* 头部 */}
      <div className="flex items-center justify-between px-4 py-2 bg-muted border-b">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4" />
          <span className="text-sm font-mono">{filePath}</span>
          <Badge variant="outline">{toolName}</Badge>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={onReject}>
            <X className="w-3 h-3 mr-1" /> 拒绝
          </Button>
          <Button size="sm" onClick={onAccept}>
            <Check className="w-3 h-3 mr-1" /> 接受
          </Button>
        </div>
      </div>

      {/* Diff 视图 */}
      <DiffEditor
        height="300px"
        original={oldString}
        modified={newString}
        language={getLanguage(filePath)}
        theme="vs-dark"
        options={{
          readOnly: true,
          renderSideBySide: true,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
        }}
      />
    </div>
  );
}

function getLanguage(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript',
    js: 'javascript', jsx: 'javascript',
    py: 'python', rs: 'rust', go: 'go',
    md: 'markdown', json: 'json', yaml: 'yaml',
    css: 'css', html: 'html',
  };
  return map[ext ?? ''] ?? 'plaintext';
}
```

**关键**：`Edit`/`Write` 工具必须在 `canUseTool` 里拦截：

```typescript
// AgentManager.canUseTool 里新增分支
if (['Edit', 'Write', 'MultiEdit'].includes(toolName)) {
  // 推给渲染进程显示 diff，等待用户 Accept/Reject
  // 这和权限审批用同一套 Promise + Map 机制
  // 区别：channel 名用 'agent:diff-request'，和权限弹窗分开
}
```

在 `MessageList` 里渲染 `DiffCard`，onAccept/onReject 回调通过 IPC 告知主进程。

**验收**：Claude 修改文件时显示 Monaco diff，Accept 后文件实际修改，Reject 后跳过。

---

## T1.7 Plan Mode [ ]

在 `src/App.tsx` 顶部加模式切换（影响 `AgentStartParams` 的 `permissionMode`）：

```typescript
// AgentStartParams 里加字段
permissionMode?: 'default' | 'plan' | 'acceptEdits';

// AgentManager.startSession 里传给 SDK
options: {
  permissionMode: params.permissionMode ?? 'default',
  ...
}
```

创建 `src/components/chat/PlanCard.tsx`：

```typescript
// 简单实现：显示计划内容 + 三个按钮
// ExitPlanMode tool_use 触发时，store 里插入 type: 'plan' 消息
// PlanCard 渲染这条消息
```

**验收**：Plan Mode 下 Claude 不修改文件，展示计划后用户可点击"执行"切回 default 模式。

---

## T1.8 会话管理 [ ]

创建 `src/components/session/SessionList.tsx`：

```typescript
// src/components/session/SessionList.tsx
import { useEffect } from 'react';
import { useSessionStore } from '@/store/session-store';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';

// 安装：npm install date-fns

export function SessionList({ cwd }: { cwd: string }) {
  const { sessionList, setSessionList, sessionId, setCwd, resetSession, setSessionId } = useSessionStore();

  useEffect(() => {
    window.electron.listSessions(cwd).then(setSessionList);
  }, [cwd]);

  const selectSession = async (session: typeof sessionList[0]) => {
    resetSession();
    // 加载历史消息（只展示，不重新执行）
    const history = await window.electron.readSessionHistory(session.session_id, cwd);
    // 把历史 SDK 消息回放到 store（用 handleAgentEvent 逐条处理）
    history.forEach((msg) => {
      handleAgentEvent(session.session_id, msg as any);
    });
    setSessionId(session.session_id);
  };

  return (
    <div className="w-56 border-r h-full overflow-y-auto">
      <div className="p-3 border-b">
        <button
          className="w-full text-sm text-primary"
          onClick={() => { resetSession(); setSessionId(null); }}
        >
          + 新建会话
        </button>
      </div>
      {sessionList.map((s) => (
        <button
          key={s.session_id}
          onClick={() => selectSession(s)}
          className={`w-full text-left p-3 border-b hover:bg-muted text-sm
            ${s.session_id === sessionId ? 'bg-muted' : ''}`}
        >
          <div className="truncate">{s.title ?? s.session_id.slice(0, 8)}</div>
          <div className="text-xs text-muted-foreground">
            {formatDistanceToNow(s.last_used, { locale: zhCN, addSuffix: true })}
          </div>
        </button>
      ))}
    </div>
  );
}
```

**resume 功能**：下次发消息时，把当前 `sessionId` 作为 `resumeId` 传给 `startSession`。

**验收**：
- 能看到 CLI 创建的历史会话（不只是 GUI 创建的）
- 点击历史会话能看到历史消息
- 选择历史会话后继续发消息能正常 resume

---

## T1.9 项目目录选择 [ ]

在 `electron/main/index.ts` 加：

```typescript
ipcMain.handle('dialog:open-folder', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
  return result.canceled ? null : result.filePaths[0];
});
```

preload 里加：
```typescript
openFolder: () => ipcRenderer.invoke('dialog:open-folder'),
```

在 `src/App.tsx` 添加项目切换 UI（顶部工具栏），切换后重置会话、更新 `cwd`、刷新会话列表。

**验收**：可以切换不同项目目录，会话列表对应更新。

---

## T1.10 CLAUDE.md 编辑器 [ ]

创建 `src/components/config/ClaudeMdEditor.tsx`：

```typescript
// 三个 Tab：用户级 / 项目级 / 本地级
// 每个 Tab 用 Monaco Editor（markdown 模式）
// 保存时通过 IPC 写入对应文件
```

在 `electron/main/config-manager.ts` 实现：

```typescript
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export function readClaudeMd(scope: 'user' | 'project' | 'local', cwd?: string): string {
  const filePath = getClaudeMdPath(scope, cwd);
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : '';
}

export function writeClaudeMd(scope: 'user' | 'project' | 'local', content: string, cwd?: string): void {
  const filePath = getClaudeMdPath(scope, cwd);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf-8');

  // local 文件自动加入 .gitignore
  if (scope === 'local' && cwd) {
    ensureGitignore(cwd, 'CLAUDE.local.md');
  }
}

function getClaudeMdPath(scope: 'user' | 'project' | 'local', cwd?: string): string {
  switch (scope) {
    case 'user':    return path.join(os.homedir(), '.claude', 'CLAUDE.md');
    case 'project': return path.join(cwd!, 'CLAUDE.md');
    case 'local':   return path.join(cwd!, 'CLAUDE.local.md');
  }
}
```

在 `ipc-handlers.ts` 注册 `config:read-claude-md` 和 `config:write-claude-md`。

**验收**：可以编辑三个层级的 CLAUDE.md，保存后 Claude CLI 下次会话生效。

---

## T1.11 Token 状态栏（正式版） [ ]

在窗口底部固定显示（替换 T0.9 的临时状态）：

```
Claude Sonnet 4.6  |  ↑ 4,821  ↓ 312  |  $0.014
```

从 `useSessionStore` 的 `usage` 读取，`result` 消息触发更新。

**验收**：每次对话后数字更新，新建会话后重置。

---

## Phase 1 完成标准

- [ ] 流式文字 + Markdown + 代码高亮
- [ ] Thinking 可折叠
- [ ] 权限审批弹窗（正式 shadcn 版本）
- [ ] TodoWrite 侧边栏三态更新
- [ ] AskUserQuestion 选项弹窗
- [ ] File Diff Accept/Reject（Monaco diff 视图）
- [ ] Plan Mode 正常工作
- [ ] 历史会话列表 + Resume
- [ ] 项目目录切换
- [ ] CLAUDE.md 三级编辑器
- [ ] Token/成本状态栏

**MVP 完成 → 可以发布内测版本收集用户反馈**

后续扩展见（按优先级）：
- `tasks/phase-2.md`：Hooks 可视化 + Subagent 树（差异化功能）
- `tasks/phase-3.md`：企业合规功能
