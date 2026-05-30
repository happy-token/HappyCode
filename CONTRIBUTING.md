# Contributing to HappyCode

## Prerequisites

| Platform | Requirements |
|---|---|
| macOS | Xcode Command Line Tools |
| Windows | Python 3.x + Visual Studio Build Tools (for `better-sqlite3` native compilation) |
| Linux | `build-essential` + `python3` |

**Node.js:** >= 20.x  
**Package Manager:** pnpm (recommended) or npm

## Getting Started

```bash
# Clone
git clone <repo-url> && cd HappyCode

# Install dependencies
pnpm install

# Start dev mode (Electron + Vite HMR)
pnpm dev

# Build for production
pnpm build
```

## Troubleshooting

### `better-sqlite3` fails to compile

```bash
# macOS
xcode-select --install

# Windows (管理员 PowerShell)
npm install --global windows-build-tools

# Linux
sudo apt install build-essential python3
```

### Electron fails to start

Ensure no other Electron instance is running. Check `~/.happycode/logs/` for crash reports.

## Project Structure

See [CLAUDE.md](./CLAUDE.md) for full directory layout and conventions.

## Development Workflow

1. Pick an issue or create one
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Write tests first (TDD — 80% coverage target)
4. Implement the feature
5. Run `pnpm typecheck && pnpm test`
6. Open a PR

## Code Conventions

- **TypeScript strict** — no `any`, use `unknown` + type guard
- **IPC channels** — `namespace:action` naming (e.g., `session:list`)
- **Process isolation** — all Node.js/FS ops in main process only
- **State management** — Zustand + immer, keep stores focused
- **CSS** — Use `var(--color-*)` custom properties, not hardcoded colors

See [CLAUDE.md](./CLAUDE.md) and [DESIGN.md](./DESIGN.md) for full standards.

## Testing

```bash
# Run all tests
pnpm test

# Run with coverage
pnpm test -- --coverage

# Run specific test file
pnpm test -- path/to/test.test.ts
```

Test files live in `test/` and use vitest.

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):
```
feat: add IM integration for WeChat
fix: resolve JSONL parsing race condition
refactor: extract IPC handlers into domain modules
```
