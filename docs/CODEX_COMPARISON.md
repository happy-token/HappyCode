# Codex vs HappyCode 对比分析

> 基于 Codex 源码 (`github.com/openai/codex`, 2026-05) 的深度分析。
> 分析日期: 2026-05-20

---

## 1. Codex 开源范围

Codex 的 GitHub repo **不是完全开源的**。关键事实：

### 开源部分 (Apache 2.0)

| 组件 | 路径 | 代码量 |
|------|------|--------|
| TUI (终端界面) | `codex-rs/tui/` | ratatui 全屏终端 |
| Headless Exec | `codex-rs/exec/` | `codex exec` 非交互模式 |
| Agent Core | `codex-rs/core/` | agent 循环/工具编排/上下文管理 |
| App Server | `codex-rs/app-server/` | JSON-RPC 服务，IDE 插件接入 |
| MCP 全栈 | `codex-rs/codex-mcp/` / `mcp-server/` | MCP Client + Server |
| 沙箱系统 | `codex-rs/sandboxing/` / `linux-sandbox/` | 跨平台 OS 级沙箱 |
| CLI 入口 | `codex-rs/cli/` | `codex` 命令 + 子命令 |
| TypeScript SDK | `sdk/typescript/` | 编程式调用 |
| Python SDK | `sdk/python/` | 编程式调用 |

总计: ~100+ crate, ~89万行 Rust, ~328 测试文件。

### 闭源部分

| 组件 | 获取方式 | 说明 |
|------|----------|------|
| **Codex Desktop App** | 非开源 DMG 下载 | `codex app` 命令从 `persistent.oaistatic.com/codex-app-prod/Codex.dmg` 下载 |
| **ChatGPT Web Agent** | `chatgpt.com/codex` | Web 端完全闭源 |

**证据** (`codex-rs/cli/src/desktop_app/mac.rs`):

```rust
const CODEX_DMG_URL_ARM64: &str =
    "https://persistent.oaistatic.com/codex-app-prod/Codex.dmg";

// `codex app` 命令逻辑:
// 1. 检查 /Applications/Codex.app 是否存在
// 2. 不存在 → curl 下载闭源 DMG
// 3. hdiutil mount → ditto 拷贝 .app → 启动
// 4. open -a Codex.app <workspace>
```

**结论: `codex app` 只是一个下载器/启动器，Desktop App 代码不在 repo 中。**

---

## 2. 功能对比矩阵

### 核心 Agent 能力

| 功能 | Codex | HappyCode |
|------|-------|-----------|
| Agent 引擎 | 自研 Rust agent loop | 依赖 claude-agent-sdk |
| 多模型支持 | OpenAI / Ollama / LM Studio | Anthropic API |
| 上下文压缩 | 内置 /compact | 透传 SDK compact |
| 多 Agent 编排 | 自研 multi-agent | 通过 SDK subagent |
| 沙箱安全 | 三层跨平台沙箱 | ❌ 无 |
| Exec Policy | Starlark 规则引擎 | ❌ 无 |
| 非交互模式 | `codex exec` headless | ❌ 仅 GUI |
| Feature Flag | 功能开关 + 滚动发布 | ❌ 无 |

### 用户体验

| 功能 | Codex | HappyCode |
|------|-------|-----------|
| 终端界面 (TUI) | ✅ ratatui 全功能 | ❌ |
| 桌面 GUI | ✅ 闭源 Desktop App | ✅ **开源** Electron |
| 多标签会话 | ❌ TUI 单会话 | ✅ 多 Tab |
| 审计查看器 | ❌ | ✅ Session Audit Viewer |
| 文件浏览器 | ❌ (agent 间接操作) | ✅ 树状浏览 + Monaco 预览 |
| Git 面板 | ❌ | ✅ 可视化 Git 管理 |
| MCP 可视化管理 | ❌ | ✅ GUI 配置 |
| Provider 诊断 | ❌ | ✅ 可视化测试 |
| 深色/浅色主题 | ❌ | ✅ 双主题 |
| 国际化 | ❌ | ✅ 9 种语言 |

### 生态与集成

| 功能 | Codex | HappyCode |
|------|-------|-----------|
| SDK | ✅ Python + TypeScript | ❌ |
| App Server | ✅ JSON-RPC (开源) | Hook Server (Express) |
| IDE 集成 | ✅ VS Code / Cursor / Windsurf | ❌ |
| MCP Server | ✅ 被其他 agent 调用 | ❌ |
| Plugin Marketplace | ✅ 远程 marketplace | ❌ |
| Skills 系统 | ✅ 12 内置 skill | ❌ |
| IM 远程控制 | ❌ | ✅ 规划中 (微信/飞书/Telegram) |
| 导出格式 | ❌ | ✅ CSV / PDF / Markdown |

### 代码质量

| 指标 | Codex | HappyCode |
|------|-------|-----------|
| 主语言 | Rust (2024 edition) | TypeScript (strict) |
| 代码量 | ~89万行 | ~21.5K行 (前端16K + Electron 5K) |
| 测试覆盖 | 328测试文件, snapshot 覆盖 TUI | ~1.7K行 (约 8%) |
| Lint 规则 | clippy strict (unwrap_used deny) | tsc strict |
| 构建系统 | Cargo + Bazel + Nix | electron-vite |
| 包管理 | pnpm workspace | pnpm |
| 进程隔离 | N/A (原生二进制) | ✅ contextBridge 无 nodeIntegration |
| 评分 | 9/10 | 6/10 |

---

## 3. HappyCode 与 Codex 的定位差异

### Codex 的目标

```
CLI (TUI) ─── 终端开发者
App Server ── IDE 插件 (VS Code / Cursor / Windsurf)
Desktop App ─ 普通开发者 (闭源 DMG)
Web Agent ─── 云端体验 (chatgpt.com/codex)
```

Codex 是一个**垂直整合的编程 Agent 平台**，从 agent 引擎到 UI 层全部自研。桌面端只是四个产品形态之一。

### HappyCode 的定位

```
Electron Desktop ─── Claude Code 用户
                    ├─ 审计查看 (Phase 0)
                    ├─ 可视化 Chat (Phase 1)
                    ├─ Hooks 管理 (Phase 2)
                    └─ 团队协作 (Phase 3)
```

HappyCode 是 **Claude Code CLI 的桌面伴侣**——不做 agent 引擎，不做沙箱，而是在 CLI 之上提供可视化、审计、治理层。

### 关键差异化

HappyCode 能做而 Codex 做不到的：

1. **开源桌面 GUI** — Codex Desktop 闭源，HappyCode 是唯一能看到源码的 AI Coding 桌面端
2. **企业审计** — Session Audit Viewer + CSV/PDF 导出 + hash-chain 验证
3. **多会话并行** — 多 Tab 同时管理，Codex TUI 是单会话模式
4. **IM 远程** — 微信/飞书/Telegram 远程触发 agent (规划中)
5. **团队治理** — 服务端审计中台 (规划中)

---

## 4. 竞争格局

```
                    AI Coding 工具市场地图

    代码生成层 (闭源为主)
    ──────────────────────────────────────
    │  Cursor (闭源)  │  Copilot (闭源)  │
    │  Codex Desktop (闭源!)             │
    │  Codex CLI (开源)                  │
    │  Claude Code (闭源)                │
    ──────────────────────────────────────
        ↑ HappyCode 不竞争这一层

    治理与协作层 (无人占位)
    ──────────────────────────────────────
    │  审计追踪     │  权限管理     │  用量核算  │
    │  合规报告     │  团队协作     │  IM 远程   │
    ──────────────────────────────────────
        ↑ HappyCode 的目标市场

    开源桌面 GUI (唯一)
    ──────────────────────────────────────
    │  HappyCode (MIT 开源)              │
    ──────────────────────────────────────
```

---

## 5. 产品方向建议

### 第一优先: 审计做到企业级

Codex 完全没有 Session 审计 UI。企业使用 AI Coding 的最大痛点:

- Agent 做了什么操作？
- 谁批准的权限？
- 花了多少 token / 成本？
- 如何证明工具调用合规？

当前 HappyCode Phase 0 的 JSONL 文件扫描只是原型，需要:

- SQLite 建立审计索引 (10MB 文件限制太粗暴)
- 按日/周/月的消耗趋势仪表板
- 项目热点 / 高风险工具调用排行
- SOC 2 / ISO 27001 合规报告片段
- 审批链路完整记录

### 第二优先: 补基础

- **测试覆盖率**: 8% → 50%+ (核心模块 80%+)
- **性能**: Electron + Monaco + ReactFlow 内存优化
- **错误边界**: 全局错误 recovery 机制

### 第三优先: 团队协作 (差异化高地)

- 团队审计中台 (Server 组件)
- IM 远程控制 (微信/飞书/Telegram)
- Session 分享 + 代码变更 review
- TokenUsage 集成 + 跨 team 用量聚合

---

## 6. 一句话总结

> **不要在 Rust Agent 引擎上跟 Codex 竞争。**
> HappyCode 的价值在于 **开源可审计的桌面伴侣 + 企业治理层**——
> 这是 Codex、Cursor、Copilot 全都忽略的空白市场。
> 尤其是 Codex Desktop 闭源这个事实，让 HappyCode 成为
> **唯一能看到源码的 AI Coding 桌面 GUI**。
