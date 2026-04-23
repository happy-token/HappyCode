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

- [ ] PDF 导出（`webContents.printToPDF()`，不需要 puppeteer）
  - 布局：项目路径 + 日期范围，模型名称，总成本，工具调用表格

- [ ] 过滤栏（按工具名、日期范围）

---

## Phase 1+ 功能

- [ ] **CSV 脱敏 / Redaction**
  - 在导出前对 `input_json` / `output_json` 中的路径、文件内容进行可配置脱敏
  - 可选模式：完整导出（默认）/ 仅工具名 + 时间戳 / 自定义正则遮蔽
  - 参考：[OWASP Data Classification](https://owasp.org/www-community/data_classification)

- [ ] **防篡改哈希链**（Phase 3 企业功能）
  - 每条审计条目计算 SHA-256 链式哈希
  - 导出时附带验证脚本，供安全审计人员核对

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

- [ ] **多 session / 项目 tab**
  - CLI 可多终端窗口并行；GUI 同时只能有一个 active session
  - Phase 2+ 实现多 tab，每 tab 独立 sessionId + cwd

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

- [ ] CLAUDE.md 查看 / 编辑（内嵌编辑器，读写项目根目录 CLAUDE.md）
- [ ] 原生 Anthropic OAuth 登录（`claude login`）；目前只支持 API Key
- [ ] 长任务完成桌面通知（`Notification` API 或 Electron `app.dock.bounce()`）

---

## 技术债

- [ ] `@anthropic-ai/claude-agent-sdk` 目前已作为 Phase 0 依赖安装（用户决策保留）。
  Phase 0 代码不调用任何 SDK 接口。Phase 1 开始使用时补充集成测试。

---

## Phase 1 — UI 重构（对标 CodePilot/Claude Code 官方桌面）

> 由 `plan-design-review 2026-04-23` 审查生成。当前设计完整度 2/10 → 目标 8/10。

### 🔴 P0 — 架构基础（其他功能全部依赖此项）

- [ ] **AppShell + NavRail + PanelZone 三层布局重构**
  - **WHAT:** 新建 `AppShell.tsx` + `NavRail.tsx`（48px 左侧图标导航） + `PanelZone.tsx`（右侧可折叠面板），替换当前 App.tsx 标题栏 Tab 结构
  - **WHY:** 当前 3 个平铺 Tab 无法支撑 MCP/Sessions/Bridge/Settings 等新功能；每增加一个功能就要挤一个 Tab
  - **NavRail 导航项（从上到下）:** 💬 Chat · 📋 Sessions · 🔌 MCP · ⚡ Skills · 🪝 Hooks · （底部）⚙ Settings
  - **PanelZone 可包含:** 文件树（后续）、Agent Tree（已有）、Stats
  - **PROS:** 对标 CodePilot/Claude Code 官方布局，无限扩展性
  - **CONS:** 最大单次重构，需回归测试所有子屏幕
  - **DEPENDS ON:** 无 · **BLOCKS:** Sessions 页面、MCP 页面、Settings 页面

- [ ] **DESIGN.md 设计系统文档**
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

- [ ] **Onboarding Flow（首次启动引导）**
  - **WHAT:** 2 步 Wizard — ① 欢迎页（介绍 HappyCode）② 选项目路径 ③ 配置 Provider/API Key → 进入主界面
  - **WHY:** 当前新用户打开 App 看到空白聊天框，不知道下一步是设 CWD 还是 API Key，首次体验完全靠猜
  - **DETECTION:** `localStorage['happycode:onboarding_done']` 不存在时触发
  - **PROS:** 显著降低因配置困难放弃的比例
  - **CONS:** 需要区分已配置用户，避免每次重新引导
  - **REF:** CodePilot `InstallWizard.tsx`

- [ ] **Sessions 顶级页面**
  - **WHAT:** 将 `HistorySidebar`（当前嵌套在 ChatPanel 内的浮层）升级为 NavRail 里的独立页面
  - **WHY:** 会话历史是高频操作，藏在浮层里很难发现；项目切换/多会话管理需要独立视图
  - **FEATURES:** 会话列表（按项目分组）、搜索、删除、恢复、导入 CLI .jsonl
  - **DEPENDS ON:** AppShell 重构

- [ ] **MCP 管理页面**
  - **WHAT:** 将 Settings 中的 MCP JSON 文本框升级为独立 MCP 页面
  - **WHY:** MCP 是高级功能，需要可视化的服务器状态（连接/断开/错误），JSON 文本框完全不够用
  - **FEATURES:** 服务器列表、连接状态指示器、添加/删除服务器、对话中使用的 MCP 工具高亮
  - **REF:** CodePilot `src/app/mcp/`
  - **DEPENDS ON:** AppShell 重构

### 🟢 P2 — 视觉打磨

- [ ] **深色 + 浅色主题双套**
  - **WHAT:** 建立完整的 light theme token 集，对应 dark theme 的所有 CSS 变量
  - **WHY:** 用户选择决策：已确认需要双主题（`plan-design-review 2026-04-23`）
  - **IMPLEMENTATION:** `data-theme="dark/light"` 属性切换，所有颜色通过 CSS 变量

- [ ] **引入 Geist 字体**
  - **WHAT:** 从 `@fontsource/geist` 安装字体，替换 `--font-sans: -apple-system`
  - **WHY:** 系统字体在跨平台表现不一致（Mac = SF Pro，Win = Segoe UI）；Geist 一致且有开发者工具调性
  - **IMPLEMENTATION:** `npm install @fontsource/geist @fontsource/geist-mono`，更新 `styles.css`

- [ ] **Chat Empty State 重设计**
  - **WHAT:** 独立 `ChatEmptyState.tsx` 组件，有 Logo/图标、欢迎语、CTA 按钮组、快捷命令提示
  - **WHY:** 当前空态是 `◈ Start a conversation`，毫无温度和引导性
  - **DEPENDS ON:** DESIGN.md（使用新设计 token）

---

## Phase 1 — AppShell 架构评审补充项（plan-eng-review 2026-04-23）

### P0 实现约束（与 AppShell + NavRail 任务绑定）

- [ ] **cwd 从 session-store 中移除**
  - **WHAT:** `session-store.ts` 有独立的 `cwd` 字段，`startSession`/`triggerCompact`/`loadAndResumeSession` 通过 `get().cwd` 读取。当 `cwd` 迁移到 `ui-store` 时，必须同步从 `session-store` 删除 `cwd`，并将上述 3 处改为 `useUiStore.getState().cwd`
  - **WHY:** 不同步删除会产生两个权威数据源，HistorySidebar 的 `loadAndResumeSession` 调用路径尤其危险（会同时写入两个 store）
  - **DEPENDS ON:** AppShell + NavRail + ui-store.ts

- [ ] **HistorySidebar 从 ChatPanel 中移除**
  - **WHAT:** ChatPanel 内嵌的 `HistorySidebar`（~212px 浮层）在 P0 中删除
  - **WHY:** NavRail（48px）+ HistorySidebar（212px）+ PanelZone（280px）= 在 1280px 窗口只剩 740px 内容区。Sessions 页面（P1）将复用 `history-store` 的数据，是 HistorySidebar 的正式替代
  - **DEPENDS ON:** AppShell + NavRail

### P1 功能

- [ ] **Sessions 顶级页面（含 HistorySidebar 迁移）**
  - **WHAT:** 将 HistorySidebar 功能升级为独立的 Sessions NavRail 页面，复用已有的 `history-store.ts`（sessions/projects 数据已完整实现）
  - **WHY:** HistorySidebar 在 P0 中被删除，Sessions NavRail slot 暂时显示"Coming soon"。P1 需要补全
  - **FEATURES:** 会话列表（按项目分组）、搜索、删除、恢复
  - **EXISTING DATA:** `history-store.ts` 已实现 `load()`/`deleteSession()`/`deleteProject()`，直接复用
  - **DEPENDS ON:** AppShell + NavRail

### 技术债 — 凭证清理

- [ ] **删除源码中硬编码的 API Token**
  - **WHAT:** 两处需清理：① `App.tsx:11-15` 的 `PRESETS` 数组（4 个真实 bearer token）→ 已计划在 SettingsPage 提取时删除；② `api-config-store.ts:13-16` 的 `BELLA_SONNET_DEFAULT`（hardcoded authToken）→ 改为空默认值 `{ baseUrl: '', authToken: '' }`
  - **WHY:** 这是 open-source 的前置条件；token 一旦进入 git history 即使删除也需要 history rewrite
  - **PRIORITY:** 开源发布前必须完成

---

*最后更新：2026-04-23（plan-eng-review 架构评审 — AppShell 实现约束补充）*
