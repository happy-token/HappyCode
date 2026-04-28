# Changelog

All notable changes to this project will be documented in this file.

## [0.2.0] - 2026-04-24

### Added

- **Bridge auto-injection** (`electron/main/bridge-injector.ts`): on startup, writes `~/.claude/hooks/gui-bridge.sh` (or `.ps1` on Windows) and injects it into all 11 hook event types in `~/.claude/settings.json`. Idempotent — runs twice without duplicating entries.
- **HookRuleWizard** (`src/components/hooks/HookRuleWizard.tsx`): 3-step wizard UI for creating hook rules. Step 1 selects from 11 event types with descriptions; Stop hook shows an inline warning + confirmation checkbox before proceeding. Step 2 sets an optional tool-name matcher. Step 3 enters the shell command.
- **HookTestSandbox** (`src/components/hooks/HookTestSandbox.tsx`): inline command sandbox embedded in wizard Step 3. Provides editable mock payloads for all 11 event types; executes the command via `hook:test-rule` IPC and shows stdout / stderr / exit code / duration.
- **HooksPanel: bridge status indicator** (`src/components/hooks/HooksPanel.tsx`): Events tab header now shows a green dot ("Bridge 已连接") or a gray dot + "启用" button that calls `hook:inject-bridge`. Clear button deletes all stored hook events.
- **New IPC channels** (`electron/main/ipc-handlers.ts`):
  - `hook:clear-events` — deletes all rows from `hook_events` table
  - `hook:bridge-status` — returns `HookBridgeStatus`
  - `hook:inject-bridge` — writes script + injects settings, returns `HookBridgeStatus`
  - `hook:test-rule` — executes a shell command with a mock payload, returns `HookTestResult`
- **Extended HookType** (`electron/shared/types.ts`): 4 → 11 event types (added `PostToolUseFailure`, `UserPromptSubmit`, `SubagentStart`, `SubagentStop`, `SessionStart`, `SessionEnd`, `Notification`, `PreCompact`).

### Fixed

- **Sidebar tab status snapshot** (`src/components/nav/Sidebar.tsx`): `useSyncExternalStore` snapshot was re-creating arrays on every render under Zustand v5, causing infinite update loops. Wrapped in `useMemo` to stabilize the snapshot reference.

### Tests

- `test/bridge-injector.test.ts` (7 tests): `readSettings` missing-file and invalid-JSON branches; `getBridgeStatus` all 3 state branches; `injectBridgeHook` idempotency (11 hook types, no duplication on second call).
- `test/session-store.test.ts` (+2 tests): `clearHookEvents` DELETE statement via mocked `better-sqlite3`; safe on empty table.

---

## [0.1.0] - 2026-04-21

Initial release.

- Phase 0: session audit viewer — JSONL parsing, CSV export, hash-chain verifier script
- Phase 1: Chat UI, multi-tab sessions, NavRail + AppShell 3-column layout
- Onboarding wizard, dark/light themes, Geist font, Claude Desktop-style redesign
- Agent SDK integration (18 tests), export tests (28 tests), session-store utils (28 tests)
