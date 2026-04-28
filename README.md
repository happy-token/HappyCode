# HappyCode

A desktop GUI for Claude Code built with Electron + React + TypeScript.

Wraps the `@anthropic-ai/claude-agent-sdk` to give Claude Code a graphical interface — session audit viewer, chat UI, hooks panel, and more — targeting enterprise security and compliance use cases.

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

## Getting Started

```bash
npm install
npm run dev
```

Set your Anthropic API key in **Settings** before starting a session, or configure a proxy base URL.

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
