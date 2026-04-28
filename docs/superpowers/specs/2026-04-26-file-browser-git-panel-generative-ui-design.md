# Feature Design: File Browser + Git Panel + Generative UI

**Date:** 2026-04-26
**Status:** Draft
**Author:** Claude Code

---

## Overview

Enhance HappyCode (Electron + React + TypeScript Claude Code desktop app) with three feature areas, re-architecting existing basic components (FileTreePanel, GitStatusPanel) into full-featured tools. All implementations follow HappyCode's existing architecture (IPC + Zustand + IPC handlers), referencing CodePilot's approach but not directly porting its code.

### Key Design Decisions

- **Reference CodePilot, re-implement for HappyCode** — Same capabilities, adapted to HappyCode's Electron + Zustand + IPC architecture
- **File Browser** — Replace existing FileTreePanel in-place, add preview/search/operations
- **Git Panel** — Replace existing GitStatusPanel in-place, add commit/diff/log/branch/worktree
- **Generative UI** — React component rendering (no iframe), model outputs widget JSON, mapped to built-in components

---

## Architecture

### Directory Structure

```
electron/main/
  files.ts              # File scan/preview/operations (NEW)
  git-service.ts        # Git operation wrapper (NEW)
  widget-mcp.ts         # Widget MCP server (NEW)

src/components/project/
  FileBrowser.tsx       # Main panel (tree + search + actions) (NEW)
  FileTree.tsx          # Directory tree component (NEW, replaces FileTreePanel)
  FilePreview.tsx       # File content preview panel (NEW)
  FileContextMenu.tsx   # Right-click context menu (NEW)
  FileBreadcrumb.tsx    # Breadcrumb navigation (NEW)

src/components/git/
  GitPanel.tsx              # Main panel (4 collapsible sections) (NEW, replaces GitStatusPanel)
  GitStatusSection.tsx      # Status: branch, ahead/behind, file changes (NEW)
  GitBranchSelector.tsx     # Branch list + checkout (NEW)
  GitHistorySection.tsx     # Recent 30 commits + detail view (NEW)
  GitWorktreeSection.tsx    # Worktree list + switch/create (NEW)
  GitDiffViewer.tsx         # Diff viewing component (NEW)
  dialogs/
    CommitDialog.tsx        # Commit dialog (NEW)
    CommitDetailDialog.tsx  # Commit detail (stat + full diff) (NEW)
    DeriveWorktreeDialog.tsx # New worktree dialog (NEW)

src/components/widgets/
  WidgetRenderer.tsx    # Core: JSON → React component mapping (NEW)
  widgets/
    SvgWidget.tsx       # Custom SVG rendering (NEW)
    ChartWidget.tsx     # Data charts (line/bar/pie) (NEW)
    TableWidget.tsx     # Data tables (NEW)
    CalculatorWidget.tsx # Calculator/tool widget (NEW)
    FormWidget.tsx      # Interactive forms (NEW)
  widget-registry.ts    # Widget type registry (NEW)

src/store/
  git-store.ts          # Git panel state (NEW)
  file-browser-store.ts # File browser state (NEW)
  widget-store.ts       # Widget state (NEW)

electron/shared/types.ts # Extended with new types (UPDATE)
electron/preload/index.ts # Extended with new APIs (UPDATE)
electron/main/ipc-handlers.ts # Extended with new handlers (UPDATE)
```

### IPC Channels

#### File System (NEW)
| Channel | Direction | Payload | Description |
|---------|-----------|---------|-------------|
| `fs:list-dir` | Renderer → Main | `{ dirPath, depth }` | List directory tree (already exists) |
| `fs:read-file` | Renderer → Main | `{ path, maxLines? }` | Read file preview (first N lines) |
| `fs:search` | Renderer → Main | `{ dirPath, query }` | Search files by name |
| `fs:create` | Renderer → Main | `{ path, isDir? }` | Create file or directory |
| `fs:delete` | Renderer → Main | `{ path }` | Delete file or directory |
| `fs:rename` | Renderer → Main | `{ oldPath, newPath }` | Rename file or directory |

#### Git (NEW)
| Channel | Direction | Payload | Description |
|---------|-----------|---------|-------------|
| `git:status` | Renderer → Main | `{ cwd }` | Get git status (already exists) |
| `git:commit` | Renderer → Main | `{ cwd, message }` | Commit all changes |
| `git:push` | Renderer → Main | `{ cwd }` | Push to upstream |
| `git:log` | Renderer → Main | `{ cwd, limit? }` | Get commit history |
| `git:branches` | Renderer → Main | `{ cwd }` | List branches |
| `git:checkout` | Renderer → Main | `{ cwd, branch }` | Checkout branch |
| `git:diff` | Renderer → Main | `{ cwd, file? }` | Get diff (all or specific file) |
| `git:commit-detail` | Renderer → Main | `{ cwd, sha }` | Get commit detail (stat + diff) |
| `git:worktrees` | Renderer → Main | `{ cwd }` | List worktrees |
| `git:derive-worktree` | Renderer → Main | `{ cwd, branch, path }` | Create new worktree |
| `git:error` | Main → Renderer | `{ message }` | Push git error to renderer |

---

## Part 1: File Browser

### 1.1 File Operations (Main Process)

**`files.ts`** — File scanning and operations library.

```typescript
interface FileTreeNode {
  name: string;
  isDir: boolean;
  path: string;
  size?: number;
  children?: FileTreeNode[];
}

interface FilePreviewResult {
  content: string;
  totalLines: number;
  language: string;
  truncated: boolean;
}
```

**`scanDirectory(dirPath: string, depth?: number)`** — Recursively build file tree up to specified depth (default 3). Skip hidden files (except `.env`), ignore directories: `node_modules`, `.git`, `dist`, `.next`, `__pycache__`, `.turbo`, `build`. Sort directories first, then files alphabetically.

**`readFilePreview(filePath: string, maxLines?: number)`** — Stream only first N lines (default 200) using `createReadStream` + readline interface. Never load full file. Detect language from extension (65+ mappings). Return `FilePreviewResult`.

**`searchFiles(dirPath: string, query: string)`** — Recursive scan matching filenames against query (case-insensitive). Return matching `FileTreeNode[]`. Timeout after 3 seconds.

**`isPathSafe(path: string, cwd: string)`** — Validate path doesn't escape cwd. Prevent path traversal attacks.

### 1.2 UI Components

**`FileBrowser.tsx`** — Main panel replacing FileTreePanel. Contains:
- Search input at top (with filter icon)
- File tree below
- Action bar (refresh, create file/dir)
- When file selected, show FilePreview inline or in adjacent panel

**`FileTree.tsx`** — Directory tree with:
- Expandable/collapsible directories
- File icons by extension (use lucide-react icons)
- Search/filter highlighting
- Hover "Add to chat" button (like CodePilot)
- Right-click context menu
- Auto-refresh on `refresh-file-tree` window events (triggered after tool completions)

**`FilePreview.tsx`** — File content preview:
- Syntax highlighting (use existing highlight.js setup)
- Breadcrumb navigation (last 3 path segments)
- Language badge + line count
- Copy path button
- "Open in system" button (`shell.openPath()`)
- Show "File too large" for files >5MB

**`FileContextMenu.tsx`** — Right-click menu:
- New file
- New directory
- Rename
- Delete (with confirmation)
- Copy path
- Open in system

### 1.3 Data Flow

```
User expands directory → FileTree calls window.electron.fs.listDir(path, depth)
                        → Main process scanDirectory() → returns FileTreeNode[]
                        → Frontend renders expandable tree

User clicks file → FilePreview calls window.electron.fs.readFile(path, maxLines=200)
                  → Main process readFilePreview() (createReadStream)
                  → FilePreview shows syntax-highlighted content

User searches → Input onChange → window.electron.fs.search(dir, query)
              → Main process recursive scan + filename match
              → FileTree highlights filtered results

User creates file → Context menu "New File" → Input dialog
                  → window.electron.fs.create({ path })
                  → Refresh tree on success
```

### 1.4 Security

- `isPathSafe()` validates all paths before operations
- File size threshold: >5MB not previewed, show warning
- Delete requires confirmation dialog
- Ignore directories: `node_modules`, `.git`, `dist`, `.next`, `__pycache__`, `.turbo`, `build`

---

## Part 2: Git Panel

### 2.1 Git Service (Main Process)

**`git-service.ts`** — All git operations via `child_process.execFile('git', args)`.

**Shared options for all commands:**
- 10s default timeout
- `GIT_TERMINAL_PROMPT=0` env var (prevent hanging on auth prompts)
- 10MB max buffer

```typescript
interface GitStatusEntry {
  file: string;
  code: string;
  staged: boolean;
}

interface GitStatus {
  branch: string;
  upstream?: string;
  ahead: number;
  behind: number;
  entries: GitStatusEntry[];
}

interface GitLogEntry {
  sha: string;
  shortSha: string;
  message: string;
  author: string;
  date: string;
  relativeDate: string;
}

interface GitCommitDetail {
  sha: string;
  message: string;
  author: string;
  date: string;
  stats: { added: number; deleted: number; files: number };
  diff: string;
}

interface GitWorktree {
  path: string;
  branch: string;
  isDetached: boolean;
  dirty: boolean;
}
```

**Functions:**
- `isGitRepo(cwd)` — `git rev-parse --is-inside-work-tree`
- `getStatus(cwd)` — `git status --porcelain=v2 --untracked-files=normal` → parse to `GitStatus`
- `getBranches(cwd)` — `git branch -a --format=%(refname:short)\t%(upstream:short)\t%(worktreepath)` → distinguish local vs remote
- `checkout(cwd, branch)` — Validate branch name regex, reject if dirty working tree, `git checkout <branch>`
- `getLog(cwd, limit?)` — `git log --pretty=format:...` with custom separator → `GitLogEntry[]` (default limit 30)
- `commit(cwd, message)` — `git add -A` then `git commit -m <message>`
- `push(cwd)` — `git push`, fallback to `git push -u origin <branch>` if no upstream
- `getDiff(cwd, file?)` — `git diff` (staged or unstaged), optional file filter
- `getCommitDetail(cwd, sha)` — `git show <sha>` with stat and full diff, fetched separately
- `getWorktrees(cwd)` — `git worktree list --porcelain` → `GitWorktree[]` with dirty check
- `deriveWorktree(cwd, branch, path)` — `git worktree add -b <branch> <path>`

### 2.2 UI Components

**`GitPanel.tsx`** — Main orchestrator with four collapsible sections (default: Status expanded):
1. Status (GitStatusSection)
2. Branch (GitBranchSelector)
3. History (GitHistorySection)
4. Worktree (GitWorktreeSection)

**`GitStatusSection.tsx`** — Status display:
- Branch name + upstream + ahead/behind counts
- Staged changes section (grouped by status)
- Unstaged changes section (grouped by status)
- File entries color-coded: M=yellow, A=green, D=red, R=blue, ?=gray
- Commit button (opens CommitDialog) + Push button (enabled when upstream exists)
- Refresh button

**`GitBranchSelector.tsx`** — Branch management:
- Local branch dropdown list
- Lock icon for worktree-occupied branches
- Click branch → confirm → checkout
- New branch button → create and checkout

**`GitHistorySection.tsx`** — Commit history:
- Last 30 commits (SHA, message, author, relative time)
- Click commit → open CommitDetailDialog
- Lazy load / scroll to load more
- Search/filter by message

**`GitWorktreeSection.tsx`** — Worktree management:
- List all worktrees (branch, path, dirty flag)
- "Switch to" → create new session/tab for that worktree directory in HappyCode
- "Create" → open DeriveWorktreeDialog

**`GitDiffViewer.tsx`** — Diff viewing:
- Side-by-side or unified diff display
- Syntax-highlighted file content
- Collapsible file blocks
- Line-level highlighting

**Dialogs:**
- `CommitDialog.tsx` — File selection list + message input + commit button
- `CommitDetailDialog.tsx` — Commit stats (added/deleted/files) + full diff
- `DeriveWorktreeDialog.tsx` — Branch selector + path input + create button

### 2.3 Data Flow

```
GitPanel mounts → calls window.electron.git.status(cwd)
                  → Main process getStatus() → returns GitStatus
                  → GitStore updates state → UI renders sections

User clicks Commit → opens CommitDialog → selects files + writes message
                   → calls window.electron.git.commit({ cwd, message })
                   → Main process: git add -A → git commit -m
                   → On success: refresh status, close dialog

User clicks Commit in History → opens CommitDetailDialog
                              → calls window.electron.git.commitDetail({ cwd, sha })
                              → Main process: git show <sha>
                              → Shows stats + diff in dialog

User clicks "Switch to" worktree → creates new tab/session for worktree cwd
```

### 2.4 Security

- All git commands via `child_process.execFile('git', args)` — never `exec()` with shell
- Branch name validated with regex before checkout
- Checkout rejected if working tree is dirty
- `GIT_TERMINAL_PROMPT=0` prevents hanging on auth prompts

---

## Part 3: Generative UI

### 3.1 Widget Types

```typescript
type WidgetType = 'svg' | 'chart' | 'table' | 'calculator' | 'form';

interface WidgetConfig {
  type: WidgetType;
  title: string;
  data: Record<string, unknown>;
  config?: Record<string, unknown>;
}
```

**Five built-in widget types:**

1. **SvgWidget** — Custom SVG rendering (flowchart, timeline, hierarchy)
   - Input: `{ widget_code: "<svg>...</svg>" }`
   - Render: DOMPurify-sanitized HTML via `dangerouslySetInnerHTML`

2. **ChartWidget** — Data charts (line/bar/pie)
   - Input: `{ chartType: 'line' | 'bar' | 'pie', data: { labels, datasets } }`
   - Render: Recharts (existing dependency) with tooltip, legend, animation

3. **TableWidget** — Data tables
   - Input: `{ columns: [...], rows: [...] }`
   - Render: Sortable, searchable, paginated table using existing UI style

4. **CalculatorWidget** — Calculator/tool with live updates
   - Input: `{ formula: string, variables: { name, value, min, max }[] }`
   - Render: Sliders/inputs with real-time calculation

5. **FormWidget** — Interactive forms
   - Input: `{ fields: [{ type, label, options, validation }] }`
   - Render: Form with validation + submit callback

### 3.2 Widget Registry

**`widget-registry.ts`** — Type-safe registry of widget components.

```typescript
const widgetRegistry = new Map<WidgetType, React.FC<{ data: any; config?: any }>>();

function registerWidget(type: WidgetType, component: React.FC<{ data: any; config?: any }>) {
  widgetRegistry.set(type, component);
}

function getWidget(type: WidgetType) {
  return widgetRegistry.get(type);
}
```

Components register themselves at module load time. New widget types can be added by creating a new component and calling `registerWidget()`.

### 3.3 Trigger Mechanism (Three Layers, Reference CodePilot)

**Layer 1 — System Prompt**
Inject `WIDGET_SYSTEM_PROMPT` (~150 tokens) in `agent-manager.ts`, describing JSON schema, available widget types, and output rules.

**Layer 2 — On-demand MCP Server**
In `claude-client.ts` (or `widget-mcp.ts`), detect widget-related keywords (Chinese + English): `diagram`, `flowchart`, `chart`, `图表`, `流程图`, `可视化`. If detected, or conversation history contains `show-widget` output, dynamically register `codepilot-widget` MCP server with full design guidelines. Not registered during plain text conversations to reduce SDK overhead.

**Layer 3 — Markdown Code Fence Parsing**
````
```show-widget
{"type":"chart","title":"monthly_cost","data":{"chartType":"bar","labels":["Jan","Feb","Mar"],"datasets":[{"label":"Cost","data":[100,200,150]}]}}
```
````

Parsed in `MessageBubble.tsx` via `parseAllShowWidgets()` function. Extract JSON, validate schema, map to React component.

### 3.4 Rendering Pipeline

```
MessageBubble / StreamingMessage
  └── Detect ```show-widget code block via regex
      └── parseWidgetJson(partialJson) → WidgetConfig (manual character-by-character parsing for incomplete JSON)
          └── validateWidgetConfig(config) → validated WidgetConfig
              └── getWidget(config.type) → React Component
                  └── <WidgetRenderer config={config} />
                      └── Render corresponding React component
```

**Streaming handling:**
- Incomplete JSON: manual character-by-character parsing (not `JSON.parse`)
- If `<script>` tag not closed: truncate content before script to prevent JS appearing as text
- Schema validation before rendering; invalid schemas displayed as raw JSON with warning

### 3.5 Security

- All widget `data` and `config` validated against Zod schemas
- SVG content filtered through DOMPurify before rendering
- Widgets cannot access `window.parent`, `document.cookie`, or `fetch` external URLs
- No same-origin access, no top-navigation, no popups

### 3.6 State Management

**`widget-store.ts`** — Zustand store for widget state:
- Track active widgets per session
- Handle widget interactions (form submissions, calculator updates)
- Persist widget state across HMR

---

## Error Handling

### File Browser Errors
- File read failure (permission/missing) → toast error + "Retry" button
- File >5MB → "File too large to preview" + system open button
- Search timeout (>3s) → "Search timeout, try narrowing scope"
- Operation failure (rename conflict/delete failure) → specific error message

### Git Panel Errors
- Command timeout (10s) → "Operation timed out. Check if git is blocked."
- Dirty tree on checkout → "Cannot checkout: working tree has uncommitted changes. Stash or commit first."
- Push without upstream → Prompt "No upstream branch. Push with `-u`?"
- Commit conflicts → Show conflicting files, prompt manual resolution
- All errors pushed to renderer via `webContents.send('git:error', message)`

### Generative UI Errors
- JSON parse failure → Show raw code block + "Failed to parse widget"
- Schema validation failure → Degrade to text display, don't crash
- React render error → Error Boundary catches, show "Widget render error"
- Streaming interrupted → Partial render existing content, mark "Widget incomplete"

---

## Testing Strategy

### Unit Tests (vitest, main process)
- `files.ts` — scanDirectory filtering, readFilePreview line limit, isPathSafe boundary checks
- `git-service.ts` — getStatus porcelain parsing, getLog formatting, checkout dirty tree rejection
- `widget-mcp.ts` — keyword detection accuracy, MCP server register/unregister

### Integration Tests (renderer process)
- FileBrowser — expand directory → show children → click file → preview appears
- GitPanel — mock git:status IPC → show file list → click Commit → dialog opens
- WidgetRenderer — various type JSON → corresponding component renders → invalid schema degrades

### E2E Tests
- File create → tree refresh → preview verify
- Git commit → status update → history shows new record
- Send widget-related prompt → widget component appears in chat

---

## Dependencies

### New Dependencies
- `dompurify` + `@types/dompurify` — SVG sanitization
- `zod` — Widget schema validation

### Existing Dependencies (Already Available)
- `highlight.js` — Syntax highlighting
- `lucide-react` — Icons
- `@xyflow/react` — Subagent DAG (not used for widgets)
- `recharts` — Data charts (for ChartWidget)
- `react-markdown` + `remark-gfm` — Markdown rendering
- `better-sqlite3` — Local storage
- `express` — Hook server

---

## Success Criteria

1. **File Browser**: User can navigate directory tree, preview file content, search files, create/rename/delete files, all within the existing Views panel interface.
2. **Git Panel**: User can view status, commit changes, push to remote, browse commit history, view diffs, manage branches, and manage worktrees, all within the existing Views panel interface.
3. **Generative UI**: User can prompt for a visualization (diagram, chart, table, calculator, form), model outputs widget JSON, and HappyCode renders the corresponding interactive React component in the chat stream.
