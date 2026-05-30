# CLAUDE.md

## 项目简介

**HappyCode — AI 编程桌面伴侣。**
用 Electron + React + TypeScript 封装 `@anthropic-ai/claude-agent-sdk`，
为 Claude Code 提供比 CLI 更好用的图形界面。
定位：个人开发者工具，最好用的 Claude Code GUI。

> 2026-05-22 战略聚焦：**B 方向 — AI 编程桌面伴侣**，停止企业合规方向探索。
> 企业审计功能（Phase 0 CSV 导出、JSONL 解析）作为辅助功能保留，不再作为主推卖点。

---

## 执行顺序

当前已实现 Phase 0（审计查看器）+ Phase 1（Chat UI）+ Phase 2（Hooks/Subagent 树）。
按顺序执行，每个任务完成后打 `[x]`：

| Phase | 内容 | 周期 | 目标 |
|---|---|---|---|
| ~~0~~ | ~~会话审计查看器~~ ✅ 已完成 | Week 1-2 | 合规审计（辅助功能） |
| ~~1~~ | ~~Chat UI + 会话管理~~ ✅ 已完成 | Week 3-6 | 核心体验 |
| ~~2~~ | ~~Hooks 可视化 + Subagent 树~~ ✅ 已完成 | Week 7-14 | 高级工具 |
| 3 | **体验打磨**：IM 集成（微信/飞书）、性能优化、测试补全 | Week 15-20 | 留存增长 |
| 4 | 社区增长：插件市场、开源社区运营、文档完善 | Week 21+ | 用户规模 |

**当前应该执行：Phase 3 — 体验打磨**

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
    agent-manager.ts    # Agent SDK 核心封装
    session-store.ts    # SQLite + JSONL 读取
    hook-server.ts      # Express localhost:37421
    ipc-handlers.ts     # IPC 协调入口（委托到 ipc/）
    ipc/                # IPC 领域模块
      hook-handlers.ts      # hook:*
      session-handlers.ts   # session:*, export:csv
      agent-handlers.ts     # agent:*
      config-handlers.ts    # config:*, settings:*
      skills-handlers.ts    # skills:*, plugins:*
      history-handlers.ts   # history:*
      file-handlers.ts      # file:*, fs:*
      misc-handlers.ts      # commands:*, system:open-url
      system-handlers.ts    # app:*, computer-use:*, apps:*
      git-handlers.ts       # git:*, fs:git-status
      provider-handlers.ts  # providers:*
      mcp-handlers.ts       # mcp:*, agents:*
      auth-handlers.ts      # auth:*, dialog:*
      export-handlers.ts    # export:pdf, export:markdown, preview:*
    bridge-injector.ts  # Hook 桥接注入
    skills-manager.ts   # Skills 管理
    mcp-config.ts       # MCP 配置读写
    git-service.ts      # Git 操作
    provider-manager.ts # API Provider 管理
    config-schemas.ts   # Zod 运行时校验 Schemas
    logger.ts           # 结构化日志（stderr）
  preload/
    index.ts            # contextBridge 安全桥接层
  shared/
    types.ts            # 主进程 + 渲染进程共享类型

src/
  components/
    chat/               # 对话相关组件
    sessions/           # 会话列表、历史
    file-browser/       # 文件浏览
    git/                # Git 面板
    nav/                # NavRail, Sidebar, TabBar
    widgets/            # Widget 渲染系统
    skills/             # Skills 面板
    settings/           # 设置面板
    agent-tree/         # Subagent 树
    hooks/              # Hooks 面板
    ui/                 # UI 原语（shadcn + 自定义）
  store/                # Zustand stores
  lib/
    event-bus.ts        # 类型安全事件总线（跨 store 通信）
    utils.ts            # 共享工具函数
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
