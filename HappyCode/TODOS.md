# TODOS

本文件追踪已识别但延期的功能和文档工作。由 `plan-eng-review 2026-04-21` 审查生成。

---

## v0.1 发布前必须完成

- [x] **README 安全限制说明**
  - `README.md § Known Limitations (v0.1)` — 4 条限制已写入

- [x] **CSV 导出 README 标注**
  - README.md Features 章节已标注 CSV 包含原始工具调用数据，分发前需人工审查

---

## v0.2 功能

- [x] PDF 导出（`webContents.printToPDF()`，不需要 puppeteer）
  - ChatPanel 工具栏 "Export PDF" 按钮（与 Export MD 并列，`status === 'done'` 时显示）
  - `messagesToHtml()` 生成带内联样式的 HTML；主进程建隐藏 BrowserWindow 加载 HTML，调用 `printToPDF()`，保存到用户指定路径
  - IPC: `export:pdf(html, defaultName)`

- [x] 过滤栏（按工具名、日期范围）
  - SessionsPage 搜索栏下方新增日期快捷筛选：All time / Today / This week / This month
  - 与文本搜索联动，同时过滤

---

## Phase 1+ 功能

- [x] **CSV 脱敏 / Redaction**
  - `ExportSettings`（`ExportRedactMode`）类型 + `applyRedaction()` 纯函数
  - 三种模式：`full`（默认）/ `tools-only`（清空 payload）/ `custom`（用户自定义正则）
  - SettingsPage 新增 "CSV Export" 节（模式选择 + 正则 textarea + Reset defaults）
  - ChatPanel 工具栏新增 "Export CSV" 按钮（tooltip 显示当前 redact 模式）
  - `applyRedaction` 9 个测试：full 不复制对象、tools-only 清空、custom 多 pattern、无效 regex 跳过等

- [x] **防篡改哈希链**（Phase 3 企业功能）
  - `computeChainHashes(sessionId, entries)` — 纯函数，payload = `prevHash|sessionId|timestamp|toolName|inputJson|outputJson|model|costUsd`，SHA-256 链式哈希
  - CSV 新增 `chain_hash` 第 8 列
  - `buildVerifierScript(sessionId)` — 自包含 Node.js 脚本，`node verify-chain.js <csv>` 验证哈希链完整性
  - 导出时同步下载 `<name>-verify-chain.js`（与 CSV 并排）
  - IPC `export:csv` 返回 `{ csv, verifierScript }`
  - 7 个新测试：全部通过（74 个测试）

---

## CLI 功能对齐

### P1 — 高频用户立即感知

- [x] **代码块复制按钮**
  - MessageBubble 中对代码块添加了 Copy 按钮（CodeBlock 组件）
  - 点击后 1.5s 内显示 "Copied!" 反馈
  - 修复：无语言标签的 fenced block 也触发 CodeBlock（通过检测 `\n` 判断是否为块级代码）

- [x] **代码块语法高亮**
  - 使用 `highlight.js` 渲染助手回复中的 fenced 代码块
  - 支持全部 180+ 语言，主题 github-dark
  - 无语言标签的块也正确渲染（language='' 时用 `hljs.highlightAuto` 自动检测）

- [x] **工具栏实时成本显示**
  - ChatPanel 工具栏累计所有 `done` 消息的 `costUsd`，实时显示
  - 有成本时显示 `$0.0042`；代理不返回成本时回退显示 `1,234 tok`（token 数）
  - 触发条件改为 `totalTokens > 0`，不再依赖 cost_usd > 0

- [x] **两轮之间切换 model**
  - model picker 加了 "Model" 标签，`disabled={running}`，`status === 'done'` 时可切换
  - 下一轮 `startSession` 自动读取新 model

- [x] **手动触发 compact（`/compact`）**
  - 工具栏 Compact 按钮（`status === 'done' && messages.length > 0` 时显示）
  - 调用 `triggerCompact()`，以 `/compact` + `resumeId` 恢复会话触发 SDK compact

### P2 — 进阶用户缺失

- [x] **"继续上次会话"快捷入口**
  - session-store 新增 `lastSessionId`，`handleAgentDone` 时记录
  - ChatPanel 空白态（无 sessionId）显示 "↩ Resume last session" 按钮

- [x] **多 session / 项目 tab**
  - `tab-store.ts`：`tabs[]` 数组，每 tab 独立 `sessionId`、`cwd`、`messages`、`status`、`model`
  - `TabBar.tsx`：顶部 32px tab 条（仅 Chat 页显示），支持 + 新建 / × 关闭 / 运行中绿点指示
  - IPC 事件路由：监听器移至 `AppShell.tsx`，按 `sessionId` 路由到对应 tab
  - `cwd` 从 `ui-store` 移入各 tab 状态；支持同时运行多个并行 session

- [x] **会话内搜索**
  - ChatPanel 工具栏 Search 按钮（messages > 0 时显示）
  - 搜索条展开后实时过滤消息列表，显示 "X / Y" 计数，Esc 关闭

- [x] **`/init` 初始化项目**
  - App.tsx 标题栏 CwdPicker 旁添加 "Init" 按钮
  - cwd 非空且非运行中时显示；点击切换到 Chat 并调用 `startSession('/init')`

- [x] **Hook 配置 UI**
  - HooksPanel 新增 Config 标签页
  - 读取 `~/.claude/settings.json` hooks 段（兼容 flat 和嵌套两种格式）
  - 按 hook 类型展示规则；支持添加/删除规则；Save 写回 settings.json
  - IPC: `settings:get-claude` / `settings:save-claude`

### P3 — 低优先级

- [x] CLAUDE.md 查看 / 编辑（内嵌编辑器，读写项目根目录 CLAUDE.md）
  - ChatPanel 工具栏 "CLAUDE.md" 按钮（`cwd` 非空时显示）
  - `ClaudemdPanel.tsx` 全屏 overlay，`textarea` 编辑 + Save 按钮（⌘S），Esc 关闭
  - IPC: `file:read-claude-md` / `file:write-claude-md`；文件不存在时提示"save to create"
- [x] 原生 Anthropic OAuth 登录（`claude login`）
  - `auth:claude-login` IPC handler：先查 `~/.claude/.credentials.json`（`claudeAiOauth.accessToken`），未登录则 spawn `claude login`（开浏览器 OAuth），完成后读取 token
  - SettingsPage 新增 "⬇ Import from claude login" 按钮（三态：idle / loading / success）
  - 成功后自动填入 Auth Token 字段，用户点 Save 即生效
- [x] 长任务完成桌面通知（`Notification` API 或 Electron `app.dock.bounce()`）
  - `notify()` + `window.electron.dockBounce()`，已实现于 `ChatPanel.tsx`

---

## 技术债

- [x] `@anthropic-ai/claude-agent-sdk` SDK 集成测试
  - `test/agent-manager.test.ts` — 18 个测试，覆盖：session 生命周期、sessionId 解析（tempId→realId）、内部工具自动授权、外部工具权限回调、AskUserQuestion 处理、Abort 不触发 error、subagent 事件路由、并发 session 隔离

---

## Phase 1 — UI 重构（对标 CodePilot/Claude Code 官方桌面）

> 由 `plan-design-review 2026-04-23` 审查生成。当前设计完整度 2/10 → 目标 8/10。

### 🔴 P0 — 架构基础（其他功能全部依赖此项）

- [x] **AppShell + NavRail + PanelZone 三层布局重构**
  - **WHAT:** 新建 `AppShell.tsx` + `NavRail.tsx`（48px 左侧图标导航） + `PanelZone.tsx`（右侧可折叠面板），替换当前 App.tsx 标题栏 Tab 结构
  - **WHY:** 当前 3 个平铺 Tab 无法支撑 MCP/Sessions/Bridge/Settings 等新功能；每增加一个功能就要挤一个 Tab
  - **NavRail 导航项（从上到下）:** 💬 Chat · 📋 Sessions · 🔌 MCP · ⚡ Skills · 🪝 Hooks · （底部）⚙ Settings
  - **PanelZone 可包含:** 文件树（后续）、Agent Tree（已有）、Stats
  - **PROS:** 对标 CodePilot/Claude Code 官方布局，无限扩展性
  - **CONS:** 最大单次重构，需回归测试所有子屏幕
  - **DEPENDS ON:** 无 · **BLOCKS:** Sessions 页面、MCP 页面、Settings 页面

- [x] **DESIGN.md 设计系统文档**
  - **WHAT:** 创建 `DESIGN.md` 定义完整设计系统
  - **WHY:** 无设计文档导致每次建新组件颜色/间距/字体自由发挥，风格散漫
  - **CONTENT:**
    - Color tokens（深色 + 浅色两套）
    - Accent 颜色更新：`#7c6af7` → `#818cf8`（Indigo 400，深色下更轻盈）
    - 字体规范：主体 `Geist`，代码 `Geist Mono / SF Mono`
    - 间距 scale：4 / 8 / 12 / 16 / 24 / 32px
    - 按钮大小规范（sm/md/lg + 最小触摸目标 32px）
    - NavRail 图标规范（推荐 Lucide Icons，与 shadcn/ui 配套）
  - **PROS:** 设计决策一次性确定，后续开发直接调用 token，不重复决策
  - **CONS:** 需要提前评审所有设计决策，避免后期返工

### 🟡 P1 — 核心体验

- [x] **Onboarding Flow（首次启动引导）**
  - **WHAT:** 3 步 Wizard — ① 欢迎页（介绍 HappyCode）② 选项目路径 ③ 配置 Provider/API Key → 进入主界面
  - **WHY:** 当前新用户打开 App 看到空白聊天框，不知道下一步是设 CWD 还是 API Key，首次体验完全靠猜
  - **DETECTION:** `localStorage['happycode:onboarding_done']` 不存在时触发
  - **FILE:** `src/components/onboarding/OnboardingWizard.tsx`

- [x] **Sessions 顶级页面**
  - **WHAT:** 将 `HistorySidebar`（当前嵌套在 ChatPanel 内的浮层）升级为 NavRail 里的独立页面
  - **WHY:** 会话历史是高频操作，藏在浮层里很难发现；项目切换/多会话管理需要独立视图
  - **FEATURES:** 会话列表（按项目分组）、搜索、删除、恢复、导入 CLI .jsonl
  - **DEPENDS ON:** AppShell 重构

- [x] **MCP 管理页面**
  - **WHAT:** 独立 MCP NavRail 页面，服务器卡片（stdio/sse 类型标签），添加/删除表单，raw JSON 编辑 modal
  - **FILE:** `src/components/mcp/McpPage.tsx`
  - **STORAGE:** `agentSettings.mcpServersJson`（与 SettingsPage 共用同一数据源）

### 🟢 P2 — 视觉打磨

- [x] **引入 Geist 字体**
  - **WHAT:** `npm install @fontsource/geist @fontsource/geist-mono`，在 `main.tsx` import，`styles.css` 中已配置为首选字体
  - **FILES:** `src/main.tsx`

- [x] **深色 + 浅色主题双套**
  - **WHAT:** `[data-theme="light"]` token 集 + `data-theme` 属性切换 + TopBar Sun/Moon 按钮
  - **FILES:** `styles.css`（light tokens）、`ui-store.ts`（`theme`/`toggleTheme`）、`main.tsx`（无闪烁初始化）、`AppShell.tsx`（按钮）
  - **PERSISTENCE:** `localStorage['happycode:theme']`

- [x] **引入 Geist 字体**（已在上方 P1 条目标注）

- [x] **Chat Empty State 重设计**
  - **WHAT:** 独立 `ChatEmptyState.tsx` 组件，有 Sparkles 图标、欢迎语、CTA 按钮组、快捷命令网格（/init /review /compact /help）
  - **FILE:** `src/components/chat/ChatEmptyState.tsx`

---

## Phase 1 — AppShell 架构评审补充项（plan-eng-review 2026-04-23）

### P0 实现约束（与 AppShell + NavRail 任务绑定）

- [x] **cwd 从 session-store 中移除**
  - **WHAT:** `session-store.ts` 有独立的 `cwd` 字段，`startSession`/`triggerCompact`/`loadAndResumeSession` 通过 `get().cwd` 读取。当 `cwd` 迁移到 `ui-store` 时，必须同步从 `session-store` 删除 `cwd`，并将上述 3 处改为 `useUiStore.getState().cwd`
  - **WHY:** 不同步删除会产生两个权威数据源，HistorySidebar 的 `loadAndResumeSession` 调用路径尤其危险（会同时写入两个 store）
  - **DEPENDS ON:** AppShell + NavRail + ui-store.ts

- [x] **HistorySidebar 从 ChatPanel 中移除**
  - **WHAT:** ChatPanel 内嵌的 `HistorySidebar`（~212px 浮层）在 P0 中删除
  - **WHY:** NavRail（48px）+ HistorySidebar（212px）+ PanelZone（280px）= 在 1280px 窗口只剩 740px 内容区。Sessions 页面（P1）将复用 `history-store` 的数据，是 HistorySidebar 的正式替代
  - **DEPENDS ON:** AppShell + NavRail

### P1 功能

- [x] **Sessions 顶级页面（含 HistorySidebar 迁移）**
  - **WHAT:** 将 HistorySidebar 功能升级为独立的 Sessions NavRail 页面，复用已有的 `history-store.ts`（sessions/projects 数据已完整实现）
  - **WHY:** HistorySidebar 在 P0 中被删除，Sessions NavRail slot 暂时显示"Coming soon"。P1 需要补全
  - **FEATURES:** 会话列表（按项目分组）、搜索、删除、恢复
  - **EXISTING DATA:** `history-store.ts` 已实现 `load()`/`deleteSession()`/`deleteProject()`，直接复用
  - **DEPENDS ON:** AppShell + NavRail

### 技术债 — 凭证清理

- [x] **删除源码中硬编码的 API Token**
  - **WHAT:** 两处需清理：① `App.tsx:11-15` 的 `PRESETS` 数组（4 个真实 bearer token）→ 已计划在 SettingsPage 提取时删除；② `api-config-store.ts:13-16` 的 `BELLA_SONNET_DEFAULT`（hardcoded authToken）→ 改为空默认值 `{ baseUrl: '', authToken: '' }`
  - **WHY:** 这是 open-source 的前置条件；token 一旦进入 git history 即使删除也需要 history rewrite
  - **PRIORITY:** 开源发布前必须完成

---

*最后更新：2026-04-25（OAuth 登录完成，全部 TODOS 项目已完成）*
