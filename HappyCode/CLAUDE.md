# CLAUDE.md

## 项目简介

Claude Code GUI 桌面应用。
用 Electron + React + TypeScript 封装 `@anthropic-ai/claude-agent-sdk`，
提供比 CLI 更好用的图形界面，完整复现所有 CLI 能力，目标商业化到企业安全合规场景。

---

## 执行顺序

按顺序执行，每个任务完成后打 `[x]`，**不跳任务，不超出当前 phase 范围**：

| Phase | 内容 | 周期 | 目标 |
|---|---|---|---|
| 0 | 会话审计查看器（JSONL 解析 → CSV 导出） | Week 1-2 | 合规角度切入，先于所有竞品 |
| 1 | Chat UI + 会话管理（原 Phase 0-1） | Week 3-6 | 开发者体验，社区增长 |
| 2 | Hooks 可视化 + Subagent 树 | Week 7-14 | 高级开发者工具 |
| 3 | 企业：SSO、集中配置、团队审计、自部署 | Week 15-24 | 商业化 |

**当前应该执行：Phase 0 — 会话审计查看器**

> Phase 0 规范见 `ARCHITECTURE.md § 0`。旧 `phase-0.md`（chat loop）已作废，不执行。
>
> Phase 0 范围：解析 `~/.claude/projects/<encoded-cwd>/<session>.jsonl`，
> 展示工具调用列表，导出 CSV。**不包含** Chat UI、Agent SDK 运行时、Hook Server。

---

## 技术栈（固定，不讨论）

| 层 | 选型 |
|---|---|
| 桌面框架 | Electron 31+ |
| 构建 | electron-vite (react-ts 模板) |
| 前端 | React 19 + TypeScript strict |
| CLI 连接 | @anthropic-ai/claude-agent-sdk（V1 query() 接口） |
| 状态管理 | Zustand + immer |
| 本地 DB | better-sqlite3 |
| UI 组件 | shadcn/ui |
| 代码编辑器 | @monaco-editor/react |
| 可视化 | ReactFlow（Subagent 树，Phase 2） |
| 图表 | Recharts（成本仪表盘，Phase 3） |
| Hooks 服务 | Express（主进程内嵌，端口 37421，Phase 2） |

---

## 目录结构

```
electron/
  main/
    index.ts            # 主进程入口
    agent-manager.ts    # Agent SDK 核心封装 ← 最重要
    agent-dag.ts        # Subagent DAG（Phase 2）
    session-store.ts    # SQLite + JSONL 读取
    hook-server.ts      # Express localhost:37421（Phase 2）
    config-manager.ts   # 读写 ~/.claude/ 配置文件
    ipc-handlers.ts     # 所有 ipcMain.handle 注册
  preload/
    index.ts            # contextBridge 安全桥接层
  shared/
    types.ts            # 主进程 + 渲染进程共享类型

src/
  components/
    chat/               # 对话相关组件
    session/            # 会话列表、历史
    agent-tree/         # Subagent 树（Phase 2）
    hooks-panel/        # Hooks 可视化（Phase 2）
    config/             # 配置编辑器
  store/
    session-store.ts    # Zustand store
  lib/
    session-reader.ts   # JSONL 历史解析
  App.tsx
```

---

## 编码规范

**TypeScript**
- strict 模式，不用 `any`（用 `unknown` + type guard）
- IPC channel 命名：`模块:动作`，例如 `agent:start`、`session:list`
- 主进程 / 渲染进程共享类型放 `electron/shared/types.ts`

**React**
- 只用函数组件
- 状态管理用 Zustand，不用 prop drilling
- UI 组件用 shadcn/ui，不自己写基础组件

**Electron 进程隔离**（必须遵守）
- 所有 Node.js / 文件系统操作在主进程
- 渲染进程只能调用 `window.electron.*`（preload 暴露的 API）
- preload 必须用 `contextBridge`，禁止 `nodeIntegration: true`
- 主进程 → 渲染进程推送：`webContents.send()`
- 渲染进程 → 主进程调用：`ipcRenderer.invoke()`（有返回值）

**Agent SDK**
- 用 V1 `query()` 函数，不用 `unstable_v2_*`
- `canUseTool` 回调必须是 async，通过 Promise + Map 跨 IPC 等待
- session_id 从第一条 `system/init` 消息获取
- 历史消息展示直接解析 `~/.claude/projects/<encoded-cwd>/<session>.jsonl`

---

## 禁止项

- ❌ `nodeIntegration: true`
- ❌ 渲染进程里 `require('fs')` 或任何 Node 模块
- ❌ `any` 类型
- ❌ `unstable_v2_*` Agent SDK 接口
- ❌ 自己解析 stream-json / NDJSON（SDK 已处理）
- ❌ 硬编码路径（用 `app.getPath('home')` 等）
- ❌ 超出当前 phase 范围开发功能
