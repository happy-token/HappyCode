# Tasks: File Browser + Git Panel + Generative UI

## File Browser (plan: 2026-04-26-file-browser-plan.md)

- [x] Task 1: Shared Types — Add FileTreeNode, FilePreviewResult, FileOperationResult to types.ts
- [x] Task 2: File Utilities — files-utils.ts (path safety, language detection, ignore list) + tests
- [x] Task 3: File Service — files.ts (scan, preview, search, create, delete, rename) + tests
- [x] Task 4: IPC Handlers — Wire fs:* handlers to files.ts
- [x] Task 5: Preload Bindings — Add fs preload methods
- [x] Task 6: File Browser Store — Zustand store
- [x] Task 7: FileTree Component — Directory tree with expand/collapse
- [x] Task 8: FilePreview Component — Syntax highlighted preview
- [x] Task 9: FileContextMenu + file-icons — Context menu and icon mapping
- [x] Task 10: FileBrowser Main + AppShell integration
- [x] Task 11: CSS Styles
- [x] Task 12: Build Verification

## Git Panel (plan: 2026-04-26-git-panel-plan.md)

- [ ] Task 1: Shared Types — GitLogEntry, GitCommitDetail, GitWorktree, GitBranch, GitOperationResult
- [ ] Task 2: Git Service — git-service.ts (status, commit, push, log, branch, diff, worktree) + tests
- [ ] Task 3: IPC Handlers — Wire git:* handlers
- [ ] Task 4: Preload Bindings — Add git preload methods
- [ ] Task 5: Git Store — Zustand store
- [ ] Task 6: GitPanel Main — 4 collapsible sections
- [ ] Task 7: GitStatusSection — Branch, ahead/behind, staged/unstaged
- [ ] Task 8: GitBranchSelector — Branch list, checkout, create
- [ ] Task 9: GitHistorySection + GitDiffViewer
- [ ] Task 10: GitWorktreeSection
- [ ] Task 11: Dialogs — Commit, CommitDetail, DeriveWorktree
- [ ] Task 12: AppShell integration
- [ ] Task 13: CSS Styles
- [ ] Task 14: Build Verification

## Generative UI (plan: 2026-04-26-generative-ui-plan.md)

- [ ] Task 1: Dependencies — dompurify + zod
- [ ] Task 2: Shared Types — WidgetConfig, WidgetType
- [ ] Task 3: Widget Schema — Zod validation + tests
- [ ] Task 4: Widget Parser — show-widget code block parsing + tests
- [ ] Task 5: Widget Registry + Renderer
- [ ] Task 6: SvgWidget
- [ ] Task 7: ChartWidget
- [ ] Task 8: TableWidget
- [ ] Task 9: CalculatorWidget
- [ ] Task 10: FormWidget
- [ ] Task 11: MessageBubble integration
- [ ] Task 12: System Prompt + MCP
- [ ] Task 13: Widget Store
- [ ] Task 14: CSS Styles
- [ ] Task 15: Build Verification
