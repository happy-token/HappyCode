# 功能调研记录

> 2026-04-29 — 基于竞品调研（ccboard、Cursor Enterprise、Cline、ccusage、Claude Code 社区 GitHub Issues）的功能建议。

---

## 调研来源

| 来源 | 关键发现 |
|---|---|
| ccboard（Rust TUI + web） | 最近的竞品，有 session 审计、hooks、MCP 管理 |
| Cursor Enterprise | Team Rules、SSO/SCIM、内联 diff 是核心壁垒 |
| Cline | per-step tool approval、human-in-the-loop |
| ccusage | 离线 token/cost 分析，用户大量自建 |
| Claude Code #150 | 会话分支是社区最高票需求 |
| Claude Code #6907 | `/compact` 时自动生成会话摘要 |
| Claude Code #10998、#12925 | GitHub Issues / Linear 集成 |
| Cursor 1.7 | Team Rules 推送、共享 prompt |
| Anthropic Compliance API | 官方合规接口，GUI 前端是空白 |
| Augment Code 研究 | 67% 合规环境无法使用云原生 AI 工具 |

---

## 建议功能（按优先级排序）

### 高价值 · 差异化强

#### 1. 会话分支（Session Branching）

从任意一条消息 fork 出新分支，尝试不同方向而不丢失原始对话。

**需求来源：** Claude Code GitHub issues #150、#12629、#32631（社区票数最高需求）
**现状：** 无任何 GUI 工具实现，Claude Code CLI 也不支持
**架构思路：**
- JSONL 文件按 branch 后缀分片（`<session-id>.branch-N.jsonl`）
- fork 点之前的消息共享原始内容，不复制
- UI 用树形结构展示分支关系，支持切换分支
- 通过 `resumeId` + fork point index 实现 Agent SDK 恢复

**IPC 通道（预留）：**
```typescript
'session:fork'           // { sessionId, messageIndex } → { newSessionId, branchId }
'session:branches'       // { sessionId } → { branches: BranchInfo[] }
'session:switch-branch'  // { branchId } → session state
```

---

#### 2. Inline Diff 逐 hunk 接受/拒绝

Claude 修改文件时，逐块展示 before/after，用户 accept/reject 每一段。

**需求来源：** Cursor 核心体验、Cline 的 per-step approval
**现状：** HappyCode 有 File Preview 和 GitDiffViewer，但没有交互式的逐 hunk 接受/拒绝
**架构思路：**
- 在权限对话框中集成 diff 视图，而不是简单的 approve/deny
- 每段 diff 可以单独 accept/deny/skip
- 使用 diff-match-patch 或 diff3 算法生成 patch
- 拒绝的部分不写入磁盘，保留原始内容
- 支持 side-by-side 和 unified 两种视图模式

---

#### 3. 实时 Token/Cost 压力条

Chat header 里显示当前 context 使用量（已用 / 总量），以及本次 session 累计费用。

**需求来源：** ccusage 做离线统计，社区大量用户自建 dashboard
**现状：** HappyCode 有 JSONL token 计数（Phase 0），但没有实时 UI 显示
**架构思路：**
- Agent SDK `message.usage` 包含 `input_tokens`、`output_tokens`、`cache_creation_input_tokens`、`cache_read_input_tokens`
- 每收到一条消息更新 Zustand store 中的累计计数
- 按模型价格表计算成本（价格表存 config-manager）
- Context 窗口大小通过 `/model/info` 获取
- UI：header 顶部进度条 + hover 显示 breakdown

---

#### 4. 会话搜索 + 标签

跨所有项目的全文搜索（消息内容、工具调用、文件名），加上手动/自动标签。

**需求来源：** ccboard 和 claude-history 都在做 CLI/TUI 版本
**现状：** HappyCode 有 SessionsPage，但没有搜索能力
**架构思路：**
- 主进程内嵌 Fuse.js（模糊搜索）或 SQLite FTS5（全文搜索）
- 搜索范围：用户消息、工具调用参数、文件名、session 标题
- 标签系统：手动标签（用户添加）+ 自动标签（按项目、日期、模型、token 用量区间）
- 搜索索引在 session 完成后异步构建
- UI：全局搜索框（Cmd/Ctrl+K），结果分组展示

---

### 中价值 · 填补空白

#### 5. 文件触碰地图（File Touch Map）

每个 session 结束后，展示哪些文件被读取/写入/删除。

**需求来源：** 合规审计关键需求，ccboard 有 "files touched" 列表
**现状：** HappyCode 的 JSONL 解析已包含文件操作信息，只需聚合展示
**架构思路：**
- 解析 JSONL 中 `Read`、`Write`、`Edit`、`Exec`（含文件路径）等工具调用
- 按操作类型聚合：read / write / delete
- 显示路径树，带操作计数
- 与 GitDiffViewer 联动，一键查看 diff

---

#### 6. 任务管理集成（GitHub Issues / Linear / Jira）

从 Issue 直接发起 session，session 完成后自动关联。

**需求来源：** Claude Code #10998（GitHub Issues）、#12925（Linear/Jira）
**现状：** 无
**架构思路：**
- 主进程新增 `task-source.ts`，实现 `TaskSource` 接口
- GitHub API → `gh api repos/{owner}/{repo}/issues`
- Linear API → GraphQL
- Jira API → REST
- 认证：OAuth 或 Personal Access Token（存 Electron safeStorage）
- session 完成后可选择关闭/更新 Issue 状态
- UI：侧边栏新增「任务」Tab，列出关联的 issues

---

#### 7. 预算告警

设置每日/每月 token 或美元上限，超过阈值时通知。

**需求来源：** 企业场景必需，结合 ROADMAP 通知功能
**现状：** 无
**架构思路：**
- SQLite 新增 `budget_rules` 表（period、limit_usd、limit_tokens、action: notify|block）
- 每 session 结束时更新累计用量
- 超过软限额：推送通知；超过硬限额：自动阻止新 session
- 支持按 project、按 model 设置不同预算

---

#### 8. 任务执行计划预览（Plan-then-Execute）

类似 Windsurf Cascade：Claude 先展示"我打算做这些步骤"，用户确认后再执行。

**需求来源：** Windsurf Cascade、Cursor plan-then-execute
**现状：** 无，HappyCode 目前直接执行
**架构思路：**
- 利用 Agent SDK 的 `canUseTool` 拦截机制
- 在 Claude 生成 plan 但未调用工具时暂停
- UI 展示计划步骤，用户 approve / modify / deny
- 确认后继续执行

---

### 企业向 · Phase 3 补充

#### 9. 集中式 CLAUDE.md 推送

管理员在一个地方编辑团队规则，自动同步到所有开发者的项目目录。

**需求来源：** Cursor 1.7 Team Rules
**现状：** HappyCode 已有 `config-manager.ts`（读写 `~/.claude/` 配置），可扩展
**架构思路：**
- 服务器端规则中心（Phase 3 自部署组件）
- 本地 agent 定期拉取最新规则
- 冲突处理：本地 > 项目 > 团队 > 组织
- UI：设置中显示规则来源和优先级

---

#### 10. Anthropic Compliance API 对接

官方合规接口，提供不可篡改的审计日志。HappyCode 做 GUI 前端。

**需求来源：** Anthropic Compliance API（claude.com/blog/claude-platform-compliance-api）
**现状：** 无，但 HappyCode 的审计查看器可复用 UI 模式
**架构思路：**
- 主进程调用 Anthropic Compliance API（REST）
- 拉取组织级审计日志，存入本地 SQLite
- 复用 Phase 0 的审计查看器 UI
- 与本地 JSONL 数据交叉验证

---

#### 11. 本地模型 / 私有 API 端点

对接 Ollama、LM Studio 或企业私有 Claude 部署。

**需求来源：** 67% 合规环境无法使用云原生 AI 工具（Augment Code 研究）
**现状：** HappyCode 已有 ProviderSettings 框架，ProviderManager 支持多 provider
**扩展：**
- 添加 `ollama`、`lm-studio`、`openai-compatible` provider
- base URL 可配置（已有）
- 模型列表自动发现

---

### 体验优化 · 低成本高回报

#### 12. 会话自动摘要

`/compact` 时自动生成一句话摘要存入历史，而不是只显示时间戳。

**需求来源：** Claude Code #6907
**现状：** 无
**架构思路：**
- 在 AgentManager 的 `canUseTool` 中检测 `/compact`
- 用当前对话内容调用一次轻量模型生成摘要
- 摘要存入 history-store，作为 session 标题的一部分

---

#### 13. 提示词库（Prompt Library）

保存常用 prompt，支持变量占位符，团队可共享。

**需求来源：** Cursor prompts、Cline custom modes
**现状：** 无
**架构思路：**
- 本地 JSON 文件存储 prompts（`~/.claude/prompts.json`）
- 支持变量：`{file}`, `{error}`, `{description}`
- 在 PromptInput 中通过 `/` 触发选择器
- 团队共享：通过 Git 同步或服务器拉取

---

#### 14. 键盘快捷键系统

全局快捷键（新建 session、切换 tab、发送消息），可自定义。

**需求来源：** 开发者重度用户核心需求
**现状：** 无
**架构思路：**
- 主进程注册 Electron `globalShortcut`
- 渲染进程用 `Mousetrap` 或自定义 hook 处理页面快捷键
- 配置文件：`~/.claude/keybindings.json`
- 设置中展示可自定义快捷键列表

---

## 与现有 ROADMAP 的关系

ROADMAP 已有 4 个方向：

| ROADMAP 方向 | 关联的新功能建议 |
|---|---|
| IM 远程支持 | 预算告警通知可推送到 IM |
| Tray 操作 | 结合会话自动摘要，Tray 显示摘要 |
| Session 通知 | 预算告警、任务状态变更通知 |
| TokenUsage 集成 | 实时 Token 压力条、30 天成本预测 |

建议优先级：
```
Inline Diff > Session Branching > Token 压力条 > File Touch Map
> 会话搜索 > 预算告警 > 任务集成 > Plan-then-Execute
```
