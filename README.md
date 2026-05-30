# HappyCode

A desktop GUI for Claude Code built with Electron + React + TypeScript.

Wraps the `@anthropic-ai/claude-agent-sdk` to give Claude Code a graphical interface — session audit viewer, chat UI, hooks panel, and more — targeting enterprise security and compliance use cases.

> **Why HappyCode?** Codex Desktop 是闭源的。HappyCode 是目前唯一能看到源码的 AI Coding 桌面 GUI。详见 [Codex 对比分析](./docs/CODEX_COMPARISON.md)。

## Features

### Phase 0 — Session Audit Viewer (available now)

- Browse all Claude Code sessions for any project directory
- Inspect tool calls, inputs, outputs, cost, and token usage per session
- Export session history to CSV for offline review or compliance records

### Phase 1 — Chat UI (available now)

- Full chat interface backed by the Claude Agent SDK
- Syntax-highlighted code blocks with one-click copy
- Real-time cost display per conversation
- Permission dialogs for tool calls that require approval
- Model picker with between-turn model switching
- Context compact button (`/compact`) to reduce context size
- Subagent tree visualization for multi-agent sessions
- Image attachments support

### Phase 2+ (planned)

- Hooks configuration UI
- CLAUDE.md editor
- Multi-session tabs
- PDF export
- Team audit (server-based)

For the full roadmap including IM remote support (WeChat, Feishu, Telegram), menu bar tray actions, session notifications, and TokenUsage integration, see [ROADMAP.md](./ROADMAP.md).

## Getting Started

**Prerequisites**: Node.js 22+, pnpm 10+

```bash
pnpm install
pnpm dev
```

Set your Anthropic API key in **Settings** before starting a session, or configure a proxy base URL.

## Build & Package

### Quick build (compile only)

```bash
pnpm build          # electron-vite → out/
```

Output: `out/main/` (main process), `out/preload/` (preload), `out/renderer/` (renderer).

### Package for distribution

```bash
pnpm package        # build + electron-builder → dist/
```

Outputs platform-specific installer to `dist/`:

| Platform | Output | Notes |
|----------|--------|-------|
| **macOS** | `HappyCode-{version}-{arch}.dmg` | x64 + arm64 universal. Requires signing cert + notarization (see below) |
| **Windows** | `HappyCode-{version}-setup.exe` | NSIS installer, x64 |
| **Linux** | `HappyCode-{version}.AppImage` | x64 |

### macOS signing & notarization

macOS 打包需要 Apple Developer 证书和公证，否则 Gatekeeper 会阻止运行。

环境变量（本地构建时设置）：

```bash
export CSC_LINK=/path/to/certificate.p12      # 或 base64 编码的证书
export CSC_KEY_PASSWORD=your-key-password
export APPLE_ID=your-apple-id@example.com
export APPLE_APP_SPECIFIC_PASSWORD=xxxx-xxxx-xxxx-xxxx
export APPLE_TEAM_ID=YOUR_TEAM_ID
export CSC_NAME="Developer ID Application: Your Name (XXXXXXXXXX)"
```

> 无证书时：设置 `CSC_IDENTITY_AUTO_DISCOVERY=false` 跳过签名，但打包出的 dmg 无法在 macOS 上直接打开。

### Windows code signing (optional)

```bash
export CSC_LINK=/path/to/certificate.pfx      # 或 base64 编码
export CSC_KEY_PASSWORD=your-key-password
```

### Linux 额外依赖

Ubuntu/Debian 下打包 AppImage 需要：

```bash
sudo apt install libfuse2
```

### 仅打包当前平台

默认 `electron-builder` 只打包当前平台。跨平台打包需要通过 CI（见下方 Release 流程）。

### CI Release (GitHub Actions)

1. 确保 GitHub Secrets 中配置了签名相关变量（`CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_ID` 等）
2. 运行发布脚本，自动 bump 版本 + 打 tag + 推送：

```bash
bash scripts/release.sh
```

3. 推送 `v*` tag 后自动触发 `.github/workflows/release.yml`，并行构建 macOS / Windows / Linux 并创建 GitHub Release。

单独打 tag 发布：

```bash
git tag v0.3.0
git push origin v0.3.0
```

## Known Limitations (v0.1)

1. **Local JSONL is not tamper-proof.** Audit logs are plain files on the local filesystem and can be modified by any process with file access. Suitable for internal audit workflows; not suitable for compliance scenarios that require tamper-evident logs.

2. **CSV exports contain raw tool call data.** Exported files include the full `input_json` and `output_json` for every tool call, which may contain file paths, code content, and other sensitive information. Review the contents before sharing with others or uploading to external systems.

3. **JSONL format is Claude Code internal.** The `.jsonl` session format is not publicly documented and may change across Claude Code versions. If you encounter parse errors, upgrade HappyCode to the latest version.

4. **Local-only (v0.1).** There is no server component and no team sharing in v0.1. All data stays on the local machine.

## Tech Stack

| Layer | Choice |
|-------|--------|
| Desktop | Electron 31+ |
| Build | electron-vite |
| Frontend | React 19 + TypeScript strict |
| State | Zustand + immer |
| UI | shadcn/ui |
| CLI bridge | @anthropic-ai/claude-agent-sdk |

## License

MIT
