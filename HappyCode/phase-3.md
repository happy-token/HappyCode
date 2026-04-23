# Phase 3：完整覆盖 + 企业合规（Week 15-24）

**前提**：Phase 2 全部完成。

**目标**：完整 CLI 能力覆盖，企业安全合规基础，达到可商业化标准。

完成每项任务后打 `[x]`，不要跳任务。

---

## T3.1 Checkpoint 时间线 [ ]

**背景**：Claude Code 在每次 user prompt 前自动用 git 创建文件快照（需要 `CLAUDE_CODE_ENABLE_SDK_FILE_CHECKPOINTING=1`）。这是 opcode 停更前最受欢迎的功能，目前所有活跃 GUI 都没实现，是真实市场空白。

**第一步**：在 `AgentManager.startSession()` 里启用 checkpointing：

```typescript
// electron/main/agent-manager.ts
// startSession 里的 query() options 新增
options: {
  // ... 现有配置
  env: {
    CLAUDE_CODE_ENABLE_SDK_FILE_CHECKPOINTING: '1',
  },
}
```

**第二步**：在 `config-manager.ts` 实现 checkpoint 读取：

```typescript
// electron/main/config-manager.ts（新增部分）
export interface Checkpoint {
  id: string;           // git commit hash
  sessionId: string;
  promptPreview: string;
  timestamp: number;
  parentId?: string;    // 用于构建分叉树
}

export function listCheckpoints(sessionId: string, cwd: string): Checkpoint[] {
  const encodedCwd = cwd.replace(/[^a-zA-Z0-9]/g, '-');
  const checkpointsDir = path.join(
    os.homedir(), '.claude', 'projects', encodedCwd, 'checkpoints'
  );

  if (!fs.existsSync(checkpointsDir)) return [];

  // checkpoints 目录下每个 json 文件是一个 checkpoint
  return fs.readdirSync(checkpointsDir)
    .filter((f) => f.endsWith('.json'))
    .flatMap((f) => {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(checkpointsDir, f), 'utf-8'));
        return [data as Checkpoint];
      } catch { return []; }
    })
    .sort((a, b) => b.timestamp - a.timestamp);
}

// 还原到指定 checkpoint（调用 CLI 内置还原命令）
export async function restoreCheckpoint(
  checkpointId: string,
  mode: 'full' | 'files-only' | 'conversation-only',
  cwd: string,
): Promise<void> {
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const execFileAsync = promisify(execFile);

  // 使用 CLI 的 --replay-user-messages 还原
  await execFileAsync('claude', [
    '--replay-user-messages', checkpointId,
    '--restore-mode', mode,
  ], { cwd });
}
```

**第三步**：创建 `src/components/chat/CheckpointTimeline.tsx`：

```typescript
// src/components/chat/CheckpointTimeline.tsx
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Clock, RotateCcw, ChevronDown } from 'lucide-react';
import type { Checkpoint } from '../../../electron/main/config-manager';

interface CheckpointTimelineProps {
  sessionId: string;
  cwd: string;
}

type RestoreMode = 'full' | 'files-only' | 'conversation-only';

export function CheckpointTimeline({ sessionId, cwd }: CheckpointTimelineProps) {
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [restoring, setRestoring] = useState<string | null>(null);

  useEffect(() => {
    window.electron.listCheckpoints(sessionId, cwd).then(setCheckpoints);
  }, [sessionId, cwd]);

  const restore = async (checkpointId: string, mode: RestoreMode) => {
    setRestoring(checkpointId);
    try {
      await window.electron.restoreCheckpoint(checkpointId, mode, cwd);
      // 还原成功后刷新页面
      window.location.reload();
    } catch (err) {
      console.error('Restore failed:', err);
    } finally {
      setRestoring(null);
    }
  };

  if (checkpoints.length === 0) {
    return (
      <div className="text-xs text-muted-foreground text-center py-4">
        暂无 Checkpoint。需要启用文件检查点功能。
      </div>
    );
  }

  return (
    <div className="space-y-1 p-2">
      <p className="text-xs text-muted-foreground px-1 mb-2">
        共 {checkpoints.length} 个还原点
      </p>
      {checkpoints.map((cp) => (
        <div
          key={cp.id}
          className="flex items-center gap-2 p-2 rounded hover:bg-muted group"
        >
          <Clock className="w-3 h-3 text-muted-foreground flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs truncate">{cp.promptPreview}</p>
            <p className="text-xs text-muted-foreground">
              {new Date(cp.timestamp).toLocaleString()}
            </p>
          </div>

          {/* 还原按钮（hover 时显示） */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost" size="sm"
                className="h-7 opacity-0 group-hover:opacity-100 transition-opacity"
                disabled={restoring === cp.id}
              >
                <RotateCcw className="w-3 h-3 mr-1" />
                还原
                <ChevronDown className="w-3 h-3 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => restore(cp.id, 'full')}>
                还原代码 + 对话
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => restore(cp.id, 'files-only')}>
                只还原代码文件
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => restore(cp.id, 'conversation-only')}>
                只还原对话历史
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ))}
    </div>
  );
}
```

在 preload 里新增：
```typescript
listCheckpoints: (sessionId: string, cwd: string) =>
  ipcRenderer.invoke('checkpoint:list', { sessionId, cwd }),
restoreCheckpoint: (checkpointId: string, mode: string, cwd: string) =>
  ipcRenderer.invoke('checkpoint:restore', { checkpointId, mode, cwd }),
```

**验收**：执行几轮对话后，侧边栏 Checkpoint 面板显示历史还原点，点击还原后文件和对话恢复到对应状态。

---

## T3.2 Scheduled Tasks（定时任务） [ ]

安装：`npm install node-cron @types/node-cron`

在 `electron/main` 新建 `scheduler.ts`：

```typescript
// electron/main/scheduler.ts
import cron from 'node-cron';
import type { BrowserWindow } from 'electron';
import type { SessionStore } from './session-store';
import type { AgentManager } from './agent-manager';

export interface ScheduledTask {
  id: string;
  name: string;
  cwd: string;
  prompt: string;
  cronExpr: string;
  permissionMode: 'default' | 'acceptEdits' | 'bypassPermissions';
  enabled: boolean;
  lastRunAt?: number;
  createdAt: number;
}

export interface TaskRun {
  id: string;
  taskId: string;
  startedAt: number;
  finishedAt?: number;
  status: 'running' | 'done' | 'error';
  sessionId: string;
  error?: string;
}

export class Scheduler {
  private jobs = new Map<string, cron.ScheduledTask>();

  constructor(
    private win: BrowserWindow,
    private store: SessionStore,
    private agentManager: AgentManager,
  ) {}

  // 应用启动时从 SQLite 恢复所有启用的任务
  restoreFromDB(): void {
    const tasks = this.store.listScheduledTasks();
    tasks.filter((t) => t.enabled).forEach((t) => this.schedule(t));
  }

  schedule(task: ScheduledTask): void {
    // 先取消旧的
    this.cancel(task.id);

    if (!task.enabled) return;
    if (!cron.validate(task.cronExpr)) {
      console.warn(`[Scheduler] Invalid cron expression: ${task.cronExpr}`);
      return;
    }

    const job = cron.schedule(task.cronExpr, () => this.run(task));
    this.jobs.set(task.id, job);
    console.log(`[Scheduler] Scheduled task "${task.name}" (${task.cronExpr})`);
  }

  cancel(taskId: string): void {
    this.jobs.get(taskId)?.stop();
    this.jobs.delete(taskId);
  }

  private async run(task: ScheduledTask): Promise<void> {
    const sessionId = crypto.randomUUID();
    const run: TaskRun = {
      id: crypto.randomUUID(),
      taskId: task.id,
      startedAt: Date.now(),
      status: 'running',
      sessionId,
    };

    this.store.insertTaskRun(run);
    this.store.updateScheduledTask(task.id, { lastRunAt: Date.now() });
    this.win.webContents.send('scheduler:task-started', run);

    try {
      // 用 AgentManager 启动 session
      await new Promise<void>((resolve, reject) => {
        this.agentManager.startSession({
          sessionId,
          prompt: task.prompt,
          cwd: task.cwd,
          permissionMode: task.permissionMode,
        });

        // 监听完成事件
        const cleanup = () => {
          this.win.webContents.removeListener('agent:done' as any, onDone);
          this.win.webContents.removeListener('agent:error' as any, onError);
        };
        const onDone = (sid: string) => { if (sid === sessionId) { cleanup(); resolve(); } };
        const onError = (sid: string, err: string) => { if (sid === sessionId) { cleanup(); reject(new Error(err)); } };

        // 监听主进程自己发出的事件
        // 注意：这里需要在 AgentManager 里提供一个 Promise 接口或 EventEmitter
        // 简化实现：用超时兜底
        setTimeout(() => { cleanup(); resolve(); }, 30 * 60 * 1000); // 最长 30 分钟
      });

      this.store.updateTaskRun(run.id, { status: 'done', finishedAt: Date.now() });
      this.win.webContents.send('scheduler:task-done', { ...run, status: 'done' });
    } catch (err: unknown) {
      const error = err instanceof Error ? err.message : String(err);
      this.store.updateTaskRun(run.id, { status: 'error', finishedAt: Date.now(), error });
      this.win.webContents.send('scheduler:task-error', { ...run, status: 'error', error });
    }
  }
}
```

在 `session-store.ts` 新增定时任务相关方法（使用 ARCHITECTURE.md 里的 `scheduled_tasks` 表）：

```typescript
// session-store.ts 新增
insertScheduledTask(task: ScheduledTask): void { /* INSERT */ }
updateScheduledTask(id: string, updates: Partial<ScheduledTask>): void { /* UPDATE */ }
deleteScheduledTask(id: string): void { /* DELETE */ }
listScheduledTasks(): ScheduledTask[] { /* SELECT */ }
insertTaskRun(run: TaskRun): void { /* INSERT */ }
updateTaskRun(id: string, updates: Partial<TaskRun>): void { /* UPDATE */ }
listTaskRuns(taskId: string, limit?: number): TaskRun[] { /* SELECT */ }
```

创建 `src/components/config/ScheduledTasks.tsx`：

```typescript
// UI 结构：
// - 任务列表（名称、cron 表达式、上次执行时间、启用开关）
// - 新建按钮
// - 每个任务可展开查看执行历史（时间、状态、session_id）

// cron 表达式输入用简单的 5 段输入（分/时/日/月/周）
// 旁边显示下次执行时间
```

**验收**：创建一个每分钟执行的测试任务，等待后看到执行记录，session 出现在会话历史里。

---

## T3.3 审计日志 [ ]

在 `session-store.ts` 新增 `audit_log` 表（见 ARCHITECTURE.md）并实现方法：

```typescript
// session-store.ts 新增
insertAuditLog(entry: {
  id: string;
  timestamp: number;
  sessionId: string;
  eventType: 'tool_use' | 'permission_granted' | 'permission_denied';
  toolName: string;
  toolInput: string;   // JSON string
  cwd: string;
}): void {
  this.db.prepare(`
    INSERT INTO audit_log (id, timestamp, session_id, event_type, tool_name, tool_input, cwd)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(entry.id, entry.timestamp, entry.sessionId, entry.eventType, entry.toolName, entry.toolInput, entry.cwd);
}

listAuditLog(opts: {
  cwd?: string;
  sessionId?: string;
  eventType?: string;
  fromTs?: number;
  toTs?: number;
  limit?: number;
  offset?: number;
}): AuditLogEntry[] {
  // 根据 opts 动态构建 WHERE 子句
  // 返回按 timestamp DESC 排序的结果
}

exportAuditLog(opts: { format: 'json' | 'csv'; outputPath: string; }): void {
  const entries = this.listAuditLog({ limit: 100_000 });
  if (opts.format === 'json') {
    fs.writeFileSync(opts.outputPath, JSON.stringify(entries, null, 2));
  } else {
    const header = 'id,timestamp,session_id,event_type,tool_name,cwd\n';
    const rows = entries.map((e) =>
      [e.id, e.timestamp, e.sessionId, e.eventType, e.toolName, e.cwd].join(',')
    ).join('\n');
    fs.writeFileSync(opts.outputPath, header + rows);
  }
}
```

在 `AgentManager.canUseTool` 里**每次权限决定后**写入审计日志：

```typescript
canUseTool: async (toolName, toolInput) => {
  // ... 现有权限逻辑 ...
  const allowed = await /* 等待用户决定 */;

  // 写审计日志
  store.insertAuditLog({
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    sessionId: params.sessionId,
    eventType: allowed ? 'permission_granted' : 'permission_denied',
    toolName,
    toolInput: JSON.stringify(toolInput),
    cwd: params.cwd,
  });

  return allowed;
}
```

创建 `src/components/config/AuditLog.tsx`：

```typescript
// UI 结构：
// - 顶部筛选栏：时间范围、事件类型、项目路径
// - 表格：时间、操作类型（颜色 badge）、工具名、项目、会话 ID
// - 分页（每页 50 条）
// - 导出按钮（JSON / CSV）
// - 无删除按钮（审计日志不可删除）
```

**验收**：执行包含文件修改的任务，审计日志里有对应记录，导出 JSON 格式正确。

---

## T3.4 Auto Mode 五档切换 [ ]

在顶部工具栏的模式选择器里显示五档：

```typescript
// src/components/chat/ModeSelector.tsx
const PERMISSION_MODES = [
  {
    value: 'default',
    label: '默认',
    description: '逐个审批工具调用',
    icon: '🔒',
  },
  {
    value: 'acceptEdits',
    label: '接受编辑',
    description: '自动接受文件修改，Bash 命令仍需审批',
    icon: '📝',
  },
  {
    value: 'plan',
    label: '计划模式',
    description: 'Claude 只规划不执行',
    icon: '📋',
  },
  {
    value: 'auto',
    label: 'Auto',
    description: 'AI 分类器自动审批（需要 Max 订阅）',
    icon: '🤖',
  },
  {
    value: 'bypassPermissions',
    label: '绕过权限',
    description: '跳过所有权限检查（仅可信环境）',
    icon: '⚡',
    dangerous: true,
  },
] as const;
```

Auto Mode 时，在权限日志里额外显示"分类器决定"的原因（从 canUseTool 的返回值里提取）。

**验收**：切换不同模式，行为符合预期（acceptEdits 下文件自动接受，plan 下不执行操作）。

---

## T3.5 Git Worktree 集成 [ ]

创建 `src/components/config/WorktreeManager.tsx`。

在 `config-manager.ts` 实现 worktree 操作：

```typescript
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const execFileAsync = promisify(execFile);

export interface Worktree {
  path: string;
  branch: string;
  isMain: boolean;
  hasActiveSession: boolean;
}

export async function listWorktrees(cwd: string): Promise<Worktree[]> {
  try {
    const { stdout } = await execFileAsync('git', ['worktree', 'list', '--porcelain'], { cwd });
    // 解析 porcelain 格式输出
    return parseWorktreeList(stdout);
  } catch { return []; }
}

export async function addWorktree(cwd: string, branchName: string): Promise<string> {
  const worktreePath = path.join(os.tmpdir(), `claude-worktree-${branchName}`);
  await execFileAsync('git', ['worktree', 'add', '-b', branchName, worktreePath], { cwd });
  return worktreePath;
}

export async function removeWorktree(cwd: string, worktreePath: string): Promise<void> {
  await execFileAsync('git', ['worktree', 'remove', '--force', worktreePath], { cwd });
}
```

UI 功能：
1. 列出当前 git repo 的所有 worktree
2. "新建 Worktree 任务"：输入 branch 名称 → 调用 `addWorktree` → 在新路径启动 Claude 会话
3. 任务完成后：显示 PR 创建提示（`gh pr create` 或 GitHub URL 跳转）
4. 删除 worktree（需确认）

**验收**：在 worktree 里启动的 Claude 任务不影响主 worktree 的文件，两个 worktree 可以并行运行。

---

## T3.6 Token/成本仪表盘 [ ]

安装：`npm install recharts`

创建 `src/components/config/CostDashboard.tsx`：

```typescript
// src/components/config/CostDashboard.tsx
import { useEffect, useState } from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

// 从 SQLite 聚合数据的接口
interface DailyUsage {
  date: string;           // 'YYYY-MM-DD'
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  sessionCount: number;
}

interface ProjectUsage {
  cwd: string;
  totalCostUsd: number;
  percentage: number;
}

export function CostDashboard() {
  const [dailyData, setDailyData] = useState<DailyUsage[]>([]);
  const [projectData, setProjectData] = useState<ProjectUsage[]>([]);
  const [totalThisMonth, setTotalThisMonth] = useState(0);
  const [range, setRange] = useState<'7d' | '30d' | '90d'>('30d');

  useEffect(() => {
    window.electron.getUsageStats(range).then((stats) => {
      setDailyData(stats.daily);
      setProjectData(stats.byProject);
      setTotalThisMonth(stats.totalThisMonth);
    });
  }, [range]);

  const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6'];

  return (
    <div className="p-6 space-y-6">
      {/* 汇总卡片 */}
      <div className="grid grid-cols-3 gap-4">
        <SummaryCard label="本月总费用" value={`$${totalThisMonth.toFixed(4)}`} />
        <SummaryCard label="本月总会话" value={`${dailyData.reduce((s, d) => s + d.sessionCount, 0)}`} />
        <SummaryCard
          label="平均每会话成本"
          value={`$${(totalThisMonth / Math.max(1, dailyData.reduce((s, d) => s + d.sessionCount, 0))).toFixed(4)}`}
        />
      </div>

      {/* 时间范围切换 */}
      <div className="flex gap-2">
        {(['7d', '30d', '90d'] as const).map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`px-3 py-1 text-sm rounded ${range === r ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
          >
            {r}
          </button>
        ))}
      </div>

      {/* 每日 token 折线图 */}
      <div>
        <h3 className="text-sm font-medium mb-3">每日消耗</h3>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={dailyData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="inputTokens" name="输入 tokens" stroke="#3b82f6" dot={false} />
            <Line type="monotone" dataKey="outputTokens" name="输出 tokens" stroke="#22c55e" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* 每日费用柱状图 */}
      <div>
        <h3 className="text-sm font-medium mb-3">每日费用 (USD)</h3>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={dailyData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: number) => `$${v.toFixed(4)}`} />
            <Bar dataKey="costUsd" name="费用" fill="#3b82f6" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 项目占比饼图 */}
      {projectData.length > 0 && (
        <div>
          <h3 className="text-sm font-medium mb-3">各项目消耗占比</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={projectData}
                dataKey="totalCostUsd"
                nameKey="cwd"
                cx="50%"
                cy="50%"
                outerRadius={80}
                label={({ cwd, percentage }) =>
                  `${path.basename(cwd)} ${percentage.toFixed(0)}%`
                }
              >
                {projectData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => `$${v.toFixed(4)}`} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="border rounded-lg p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}
```

在 `session-store.ts` 实现 `getUsageStats(range)`：

```typescript
getUsageStats(range: '7d' | '30d' | '90d'): UsageStats {
  const days = { '7d': 7, '30d': 30, '90d': 90 }[range];
  const fromTs = Date.now() - days * 24 * 60 * 60 * 1000;

  const daily = this.db.prepare(`
    SELECT
      date(last_used_at / 1000, 'unixepoch') as date,
      SUM(input_tokens) as inputTokens,
      SUM(output_tokens) as outputTokens,
      SUM(cost_usd) as costUsd,
      COUNT(*) as sessionCount
    FROM sessions
    WHERE last_used_at >= ?
    GROUP BY date(last_used_at / 1000, 'unixepoch')
    ORDER BY date ASC
  `).all(fromTs) as DailyUsage[];

  const byProject = this.db.prepare(`
    SELECT cwd, SUM(cost_usd) as totalCostUsd
    FROM sessions
    WHERE last_used_at >= ?
    GROUP BY cwd
    ORDER BY totalCostUsd DESC
    LIMIT 10
  `).all(fromTs) as { cwd: string; totalCostUsd: number }[];

  const total = byProject.reduce((s, p) => s + p.totalCostUsd, 0);
  const thisMonthStart = new Date(); thisMonthStart.setDate(1); thisMonthStart.setHours(0, 0, 0, 0);

  return {
    daily,
    byProject: byProject.map((p) => ({
      ...p,
      percentage: total > 0 ? (p.totalCostUsd / total) * 100 : 0,
    })),
    totalThisMonth: (this.db.prepare(`
      SELECT COALESCE(SUM(cost_usd), 0) as total FROM sessions WHERE last_used_at >= ?
    `).get(thisMonthStart.getTime()) as { total: number }).total,
  };
}
```

**验收**：仪表盘显示真实历史数据，折线图、柱状图、饼图正常渲染。

---

## T3.7 图片输入（Multimodal） [ ]

在输入区支持图片：

**第一步**：`AgentManager.startSession` 支持 `content` 参数（替代 `prompt`）：

```typescript
// electron/shared/types.ts 更新
export interface AgentStartParams {
  sessionId: string;
  cwd: string;
  resumeId?: string;
  permissionMode?: PermissionMode;

  // 二选一：纯文字 or 带图片的内容块
  prompt?: string;
  content?: Array<
    | { type: 'text'; text: string }
    | { type: 'image'; mediaType: 'image/png' | 'image/jpeg' | 'image/webp'; data: string } // base64
  >;
}

// AgentManager 里
const prompt = params.prompt ?? '';
const contentBlocks = params.content;

for await (const msg of query({
  prompt: contentBlocks ? undefined : prompt,
  content: contentBlocks,   // SDK 支持 content blocks
  options: { ... }
})) { ... }
```

**第二步**：输入区支持粘贴和拖拽图片：

```typescript
// src/components/chat/InputArea.tsx 新增
// 粘贴处理
const handlePaste = (e: React.ClipboardEvent) => {
  const items = Array.from(e.clipboardData.items);
  const imageItem = items.find((item) => item.type.startsWith('image/'));
  if (imageItem) {
    e.preventDefault();
    const blob = imageItem.getAsFile();
    if (!blob) return;
    const reader = new FileReader();
    reader.onload = () => {
      const data = (reader.result as string).split(',')[1]; // base64 部分
      const mediaType = blob.type as 'image/png' | 'image/jpeg';
      setAttachedImages((prev) => [...prev, { mediaType, data, preview: reader.result as string }]);
    };
    reader.readAsDataURL(blob);
  }
};

// 发送时，把图片和文字合并成 content blocks
const handleSend = () => {
  const content = [
    ...attachedImages.map((img) => ({
      type: 'image' as const,
      mediaType: img.mediaType,
      data: img.data,
    })),
    { type: 'text' as const, text: inputText },
  ];
  window.electron.startSession({ sessionId, cwd, content });
  setAttachedImages([]);
  setInputText('');
};
```

**验收**：粘贴截图到输入框，发送后 Claude 能描述图片内容。

---

## T3.8 /btw 旁路问答 [ ]

在输入区底部增加小型旁路输入框（对话进行中显示）：

```typescript
// src/components/chat/BtwInput.tsx
interface BtwInputProps {
  sessionId: string;
  isVisible: boolean;   // 只在 isRunning 时显示
}

export function BtwInput({ sessionId, isVisible }: BtwInputProps) {
  const [value, setValue] = useState('');

  const send = () => {
    if (!value.trim()) return;
    // /btw 命令发给主进程，通过 AgentManager 注入到正在运行的会话
    window.electron.sendBtwMessage({ sessionId, text: value });
    setValue('');
  };

  if (!isVisible) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 border-t text-xs">
      <span className="text-muted-foreground font-mono">/btw</span>
      <input
        className="flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
        placeholder="提问不打断当前任务..."
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && send()}
      />
    </div>
  );
}
```

在 `AgentManager` 里新增 `sendBtwMessage`，向正在运行的 session 的 stdin 注入 `/btw <text>`。

旁路消息在消息列表里用特殊样式显示（左侧 `/btw` 标签，淡色背景）。

**验收**：Claude 执行长任务时，通过 /btw 提问，Claude 在合适时机回答，不中断主任务。

---

## T3.9 Windows 完整支持验证 [ ]

确保以下在 Windows 上全部正常：

```typescript
// electron/main/config-manager.ts 里所有路径操作
// 1. path.join 而不是字符串拼接（已应该如此）
// 2. 可执行文件查找：先查 .cmd 再查 .exe
export function findClaudeBinary(): string {
  if (process.platform === 'win32') {
    // Windows: 优先 .cmd（npm 安装方式）
    const candidates = [
      path.join(os.homedir(), 'AppData', 'Roaming', 'npm', 'claude.cmd'),
      'claude.cmd',  // PATH 里
      'claude.exe',
    ];
    for (const c of candidates) {
      try { execFileSync(c, ['--version'], { stdio: 'ignore' }); return c; }
      catch { /* continue */ }
    }
  }
  return 'claude'; // Unix
}

// 3. bridge hook Windows 版（见 T2.2）：用 .ps1 替代 .sh
// 4. HookServer：express 监听 127.0.0.1 而不是 localhost（Windows 有差异）
// 5. git worktree 路径：使用 path.win32 处理
```

CI `build.yml` 加 Windows e2e 测试（至少验证启动和基础对话）：

```yaml
- name: Windows smoke test
  if: matrix.os == 'windows-latest'
  run: |
    npm run build:win
    # 验证安装包生成
    ls dist/*.exe
```

**验收**：Windows 上可以正常启动、发消息、接受权限审批、查看会话历史。

---

## T3.10 发布前检查清单 [ ]

```
代码质量
  [ ] npx tsc --noEmit 零错误
  [ ] npm run lint 零 error（warning 可接受）
  [ ] 删除所有 console.log（或改为 electron-log）

安全
  [ ] 确认 nodeIntegration: false
  [ ] 确认 contextIsolation: true
  [ ] 审计日志表无删除接口
  [ ] 敏感路径（API key 等）不写入 SQLite 明文

打包
  [ ] macOS: 代码签名 + 公证（notarization）
  [ ] Windows: NSIS 安装包测试（currentUser 模式）
  [ ] Linux: AppImage 测试
  [ ] 三平台 CI 全部通过

商业化
  [ ] 联系 Anthropic 确认 Agent SDK 商业授权（proprietary license）
  [ ] README.md 清楚说明 Agent SDK 依赖和许可

文档
  [ ] README.md 包含安装、配置、使用说明
  [ ] CHANGELOG.md 第一个版本记录
  [ ] 截图（对话、Hooks 面板、Subagent 树）
```

---

## Phase 3 完成标准

- [ ] Checkpoint 时间线显示，三种还原模式均可用
- [ ] 定时任务可创建，按 cron 执行，执行历史可查
- [ ] 审计日志记录所有 tool_use，可导出 JSON/CSV
- [ ] 五档权限模式切换正常
- [ ] Git Worktree 创建和并行运行
- [ ] 成本仪表盘显示真实历史数据（折线图、柱状图、饼图）
- [ ] 图片输入：粘贴截图后 Claude 能识别
- [ ] /btw 旁路问答不中断主任务
- [ ] Windows 完整功能验证通过
- [ ] 发布前检查清单全部打 ✓

**Phase 3 完成 = 可商业化发布**
