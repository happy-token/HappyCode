# Git Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the non-existent GitStatusPanel with a full-featured Git panel: status display, branch management, commit history with diff viewing, and worktree management, all within the existing Views panel interface.

**Architecture:** Main process `git-service.ts` wraps all git operations via `child_process.execFile('git', args)` with 10s timeout + `GIT_TERMINAL_PROMPT=0` + 10MB max buffer. Renderer components (`GitPanel` with 4 sections) consume these via IPC (`git:*` channels). State managed by `git-store.ts` Zustand store.

**Tech Stack:** Electron IPC, Zustand + immer, `child_process.execFile`, lucide-react (existing), highlight.js (existing), plain CSS with `.git-*` class prefix.

**New Dependencies:** None.

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `electron/main/git-service.ts` | All git operations (status, commit, push, log, branch, checkout, diff, worktree) |
| Create | `test/git-service.test.ts` | Unit tests for git-service.ts |
| Modify | `electron/shared/types.ts:339-359` | Add GitLogEntry, GitCommitDetail, GitWorktree, GitDiffResult types |
| Modify | `electron/shared/types.ts:363+` | Add ElectronAPI methods for git operations |
| Modify | `electron/preload/index.ts` | Add git preload bindings |
| Modify | `electron/main/ipc-handlers.ts:361-384` | Replace inline git status handler, add new git:* handlers |
| Create | `src/store/git-store.ts` | Zustand store for git panel state |
| Create | `src/components/git/GitPanel.tsx` | Main orchestrator with 4 collapsible sections |
| Create | `src/components/git/GitStatusSection.tsx` | Status: branch, ahead/behind, file changes |
| Create | `src/components/git/GitBranchSelector.tsx` | Branch list + checkout |
| Create | `src/components/git/GitHistorySection.tsx` | Commit history |
| Create | `src/components/git/GitWorktreeSection.tsx` | Worktree management |
| Create | `src/components/git/GitDiffViewer.tsx` | Diff viewing |
| Create | `src/components/git/dialogs/CommitDialog.tsx` | Commit dialog |
| Create | `src/components/git/dialogs/CommitDetailDialog.tsx` | Commit detail dialog |
| Create | `src/components/git/dialogs/DeriveWorktreeDialog.tsx` | New worktree dialog |
| Modify | `src/AppShell.tsx` | Integrate GitPanel into Views panel |
| Modify | `src/styles.css` | Add `.git-*` CSS classes |

---

### Task 1: Shared Types

**Files:**
- Modify: `electron/shared/types.ts`

- [ ] **Step 1: Add new git types after line 359 (after GitStatusResult)**

```typescript
export interface GitLogEntry {
  sha: string
  shortSha: string
  message: string
  author: string
  date: string
  relativeDate: string
}

export interface GitCommitDetail {
  sha: string
  message: string
  author: string
  date: string
  stats: { added: number; deleted: number; files: number }
  diff: string
}

export interface GitWorktree {
  path: string
  branch: string
  isDetached: boolean
  dirty: boolean
}

export interface GitBranch {
  name: string
  isRemote: boolean
  isCurrent: boolean
  upstream?: string
  worktreePath?: string
}

export interface GitOperationResult {
  success: boolean
  error?: string
  output?: string
}
```

- [ ] **Step 2: Extend ElectronAPI interface**

Add these methods to `ElectronAPI` (after `gitStatus`):

```typescript
  // Git operations
  gitCommit: (params: { cwd: string; message: string }) => Promise<GitOperationResult>
  gitPush: (params: { cwd: string }) => Promise<GitOperationResult>
  gitLog: (params: { cwd: string; limit?: number }) => Promise<GitLogEntry[]>
  gitBranches: (params: { cwd: string }) => Promise<GitBranch[]>
  gitCheckout: (params: { cwd: string; branch: string }) => Promise<GitOperationResult>
  gitDiff: (params: { cwd: string; file?: string }) => Promise<string>
  gitCommitDetail: (params: { cwd: string; sha: string }) => Promise<GitCommitDetail>
  gitWorktrees: (params: { cwd: string }) => Promise<GitWorktree[]>
  gitDeriveWorktree: (params: { cwd: string; branch: string; path: string }) => Promise<GitOperationResult>
  gitCreateBranch: (params: { cwd: string; branch: string; startPoint?: string }) => Promise<GitOperationResult>
  onGitError: (cb: (data: { message: string }) => void) => () => void
```

- [ ] **Step 3: Commit**

```bash
git add electron/shared/types.ts
git commit -m "types: add GitLogEntry, GitCommitDetail, GitWorktree, GitBranch, GitOperationResult types"
```

---

### Task 2: Git Service

**Files:**
- Create: `electron/main/git-service.ts`
- Create: `test/git-service.test.ts`

- [ ] **Step 1: Write tests**

```typescript
// test/git-service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { parseGitStatus, parseGitLog } from '../electron/main/git-service'

vi.mock('child_process')

describe('parseGitStatus', () => {
  it('parses porcelain v2 output', () => {
    const output = `1 .M N... 100644 100644 abc123 src/index.ts
1 A. N... 000000 100644 000000 src/new.ts
? untracked.txt
`
    const result = parseGitStatus(output, 'main', 'origin/main', 1, 0)
    expect(result.branch).toBe('main')
    expect(result.upstream).toBe('origin/main')
    expect(result.ahead).toBe(1)
    expect(result.behind).toBe(0)
    expect(result.entries).toHaveLength(3)
    expect(result.entries[0].file).toBe('src/index.ts')
    expect(result.entries[0].code).toBe('M')
    expect(result.entries[0].staged).toBe(true)
    expect(result.entries[1].file).toBe('src/new.ts')
    expect(result.entries[1].code).toBe('A')
    expect(result.entries[1].staged).toBe(true)
    expect(result.entries[2].file).toBe('untracked.txt')
    expect(result.entries[2].code).toBe('?')
    expect(result.entries[2].staged).toBe(false)
  })

  it('handles empty output', () => {
    const result = parseGitStatus('', 'main')
    expect(result.entries).toEqual([])
  })
})

describe('parseGitLog', () => {
  it('parses log output', () => {
    const output = `commit abc123def456|abc123|Fix login bug|John Doe|2026-04-26T10:00:00+08:00|2 hours ago
commit 789xyz|789xyz|Add tests|Jane Smith|2026-04-25T15:00:00+08:00|1 day ago
`
    const result = parseGitLog(output)
    expect(result).toHaveLength(2)
    expect(result[0].sha).toBe('abc123def456')
    expect(result[0].shortSha).toBe('abc123')
    expect(result[0].message).toBe('Fix login bug')
    expect(result[0].author).toBe('John Doe')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test -- test/git-service.test.ts
```

Expected: FAIL — module does not exist.

- [ ] **Step 3: Write git-service implementation**

```typescript
// electron/main/git-service.ts
import { execFile } from 'child_process'
import { promisify } from 'util'
import type {
  GitStatus,
  GitStatusEntry,
  GitStatusCode,
  GitLogEntry,
  GitCommitDetail,
  GitWorktree,
  GitBranch,
  GitOperationResult,
} from '../shared/types'

const execFileAsync = promisify(execFile)

const GIT_OPTIONS = {
  timeout: 10_000,
  maxBuffer: 10 * 1024 * 1024, // 10MB
  env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
}

async function git(cwd: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  try {
    return await execFileAsync('git', args, { ...GIT_OPTIONS, cwd })
  } catch (err) {
    const error = err as { stdout?: string; stderr?: string; message?: string }
    throw new Error(error.stderr?.trim() || error.message || 'git command failed')
  }
}

export async function isGitRepo(cwd: string): Promise<boolean> {
  try {
    const { stdout } = await git(cwd, ['rev-parse', '--is-inside-work-tree'])
    return stdout.trim() === 'true'
  } catch { return false }
}

export async function getStatus(cwd: string): Promise<GitStatus> {
  const branchResult = await git(cwd, ['branch', '--show-current']).catch(() => ({ stdout: '', stderr: '' }))
  const branch = branchResult.stdout.trim()

  const upstreamResult = await git(cwd, ['rev-parse', '--abbrev-ref', '@{upstream}']).catch(() => ({ stdout: '', stderr: '' }))
  const upstream = upstreamResult.stdout.trim() || undefined

  let ahead = 0
  let behind = 0
  if (upstream) {
    const countResult = await git(cwd, ['rev-list', '--left-right', '--count', `HEAD...${upstream}`]).catch(() => ({ stdout: '0\t0', stderr: '' }))
    const [a, b] = countResult.stdout.trim().split('\t').map(Number)
    ahead = a || 0
    behind = b || 0
  }

  const { stdout: porcelain } = await git(cwd, ['status', '--porcelain=v1', '--untracked-files=normal'])
  const entries = parseGitStatus(porcelain, branch, upstream, ahead, behind)
  return { branch, upstream, ahead, behind, entries }
}

export function parseGitStatus(porcelain: string, branch: string, upstream?: string, ahead = 0, behind = 0): GitStatus {
  const entries: GitStatusEntry[] = []
  const codeMap: Record<string, GitStatusCode> = {
    M: 'M', A: 'A', D: 'D', R: 'R', '?': '?', '!': '!',
  }

  for (const line of porcelain.split('\n').filter(Boolean)) {
    const xy = line.slice(0, 2)
    const file = line.slice(3).trim()
    if (!file) continue

    const x = xy[0] ?? ' '
    const y = xy[1] ?? ' '
    const staged = x !== ' ' && x !== '?'
    const raw = staged ? x : y
    const code: GitStatusCode = codeMap[raw] ?? 'M'
    entries.push({ code, staged, file })
  }

  return { branch, upstream, ahead, behind, entries }
}

export async function getBranches(cwd: string): Promise<GitBranch[]> {
  const { stdout } = await git(cwd, [
    'branch', '-a',
    '--format=%(refname:short)\t%(upstream:short)\t%(worktreepath)',
  ])

  return stdout.split('\n').filter(Boolean).map((line) => {
    const [name, upstream, worktreePath] = line.split('\t')
    return {
      name,
      isRemote: name.startsWith('remotes/'),
      isCurrent: false, // will be set from status
      upstream: upstream || undefined,
      worktreePath: worktreePath || undefined,
    }
  })
}

export async function checkout(cwd: string, branch: string): Promise<GitOperationResult> {
  // Validate branch name
  if (!/^[a-zA-Z0-9_./-]+$/.test(branch)) {
    return { success: false, error: `Invalid branch name: ${branch}` }
  }

  try {
    await git(cwd, ['checkout', branch])
    return { success: true }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}

export async function createBranch(cwd: string, branch: string, startPoint?: string): Promise<GitOperationResult> {
  if (!/^[a-zA-Z0-9_./-]+$/.test(branch)) {
    return { success: false, error: `Invalid branch name: ${branch}` }
  }

  try {
    const args = ['checkout', '-b', branch]
    if (startPoint) args.push(startPoint)
    await git(cwd, args)
    return { success: true }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}

export async function getLog(cwd: string, limit = 30): Promise<GitLogEntry[]> {
  const { stdout } = await git(cwd, [
    'log',
    `--pretty=format:%H|%h|%s|%an|%ai|%ar`,
    `-n`, String(limit),
  ])
  return parseGitLog(stdout)
}

export function parseGitLog(output: string): GitLogEntry[] {
  if (!output.trim()) return []
  return output.split('\n').map((line) => {
    const [sha, shortSha, message, author, date, relativeDate] = line.split('|')
    return { sha, shortSha, message, author, date, relativeDate }
  })
}

export async function commit(cwd: string, message: string): Promise<GitOperationResult> {
  try {
    await git(cwd, ['add', '-A'])
    await git(cwd, ['commit', '-m', message])
    return { success: true }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}

export async function push(cwd: string): Promise<GitOperationResult> {
  try {
    await git(cwd, ['push'])
    return { success: true }
  } catch (err) {
    // Fallback: try push -u
    try {
      const branch = await git(cwd, ['branch', '--show-current'])
      await git(cwd, ['push', '-u', 'origin', branch.stdout.trim()])
      return { success: true }
    } catch {
      return { success: false, error: String(err) }
    }
  }
}

export async function getDiff(cwd: string, file?: string): Promise<string> {
  const args = ['diff']
  if (file) args.push('--', file)
  const { stdout } = await git(cwd, args)
  return stdout
}

export async function getCommitDetail(cwd: string, sha: string): Promise<GitCommitDetail> {
  const { stdout: showOutput } = await git(cwd, ['show', '--stat', '--format=%H|%s|%an|%ai', '--no-patch', sha])
  const [fullSha, message, author, date] = showOutput.trim().split('|')

  // Get diff
  const { stdout: diffOutput } = await git(cwd, ['show', sha])

  // Parse stat for file counts
  const { stdout: statOutput } = await git(cwd, ['show', '--numstat', '--format=', sha])
  let added = 0
  let deleted = 0
  let files = 0
  for (const line of statOutput.trim().split('\n').filter(Boolean)) {
    const [a, d] = line.split('\t')
    if (a && a !== '-') added += parseInt(a, 10) || 0
    if (d && d !== '-') deleted += parseInt(d, 10) || 0
    files++
  }

  return {
    sha: fullSha,
    message,
    author,
    date,
    stats: { added, deleted, files },
    diff: diffOutput,
  }
}

export async function getWorktrees(cwd: string): Promise<GitWorktree[]> {
  const { stdout } = await git(cwd, ['worktree', 'list', '--porcelain'])
  const worktrees: GitWorktree[] = []
  let current: Partial<GitWorktree> = {}

  for (const line of stdout.split('\n')) {
    if (line.startsWith('worktree ')) {
      if (current.path) worktrees.push(current as GitWorktree)
      current = { path: line.slice(9), isDetached: false, dirty: false }
    } else if (line.startsWith('HEAD ')) {
      // parse HEAD to get branch
    } else if (line.startsWith('branch ')) {
      current.branch = line.slice(7).replace('refs/heads/', '')
    } else if (line.startsWith('detached')) {
      current.isDetached = true
    } else if (line === 'dirty') {
      current.dirty = true
    }
  }
  if (current.path) worktrees.push(current as GitWorktree)

  return worktrees
}

export async function deriveWorktree(cwd: string, branch: string, targetPath: string): Promise<GitOperationResult> {
  try {
    await git(cwd, ['worktree', 'add', '-b', branch, targetPath])
    return { success: true }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test -- test/git-service.test.ts
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add electron/main/git-service.ts test/git-service.test.ts
git commit -m "feat: add git service (status, commit, push, log, branch, diff, worktree)"
```

---

### Task 3: IPC Handlers

**Files:**
- Modify: `electron/main/ipc-handlers.ts`

- [ ] **Step 1: Update imports**

Add at top (after existing imports):

```typescript
import {
  isGitRepo,
  getStatus,
  getBranches,
  checkout,
  createBranch,
  getLog,
  commit,
  push,
  getDiff,
  getCommitDetail,
  getWorktrees,
  deriveWorktree,
} from './git-service'
```

- [ ] **Step 2: Replace inline git status handler (lines 361-384)**

```typescript
  // Git status
  ipcMain.handle('git:status', async (_event, { cwd }: { cwd: string }) => {
    const isRepo = await isGitRepo(cwd)
    if (!isRepo) return { branch: '', entries: [], error: 'not a git repository' }
    return getStatus(cwd)
  })
```

- [ ] **Step 3: Add new git handlers**

```typescript
  // Git commit
  ipcMain.handle('git:commit', async (_event, { cwd, message }: { cwd: string; message: string }) => {
    return commit(cwd, message)
  })

  // Git push
  ipcMain.handle('git:push', async (_event, { cwd }: { cwd: string }) => {
    return push(cwd)
  })

  // Git log
  ipcMain.handle('git:log', async (_event, { cwd, limit = 30 }: { cwd: string; limit?: number }) => {
    const isRepo = await isGitRepo(cwd)
    if (!isRepo) return []
    return getLog(cwd, limit)
  })

  // Git branches
  ipcMain.handle('git:branches', async (_event, { cwd }: { cwd: string }) => {
    const isRepo = await isGitRepo(cwd)
    if (!isRepo) return []
    return getBranches(cwd)
  })

  // Git checkout
  ipcMain.handle('git:checkout', async (_event, { cwd, branch }: { cwd: string; branch: string }) => {
    return checkout(cwd, branch)
  })

  // Git diff
  ipcMain.handle('git:diff', async (_event, { cwd, file }: { cwd: string; file?: string }) => {
    return getDiff(cwd, file)
  })

  // Git commit detail
  ipcMain.handle('git:commit-detail', async (_event, { cwd, sha }: { cwd: string; sha: string }) => {
    return getCommitDetail(cwd, sha)
  })

  // Git worktrees
  ipcMain.handle('git:worktrees', async (_event, { cwd }: { cwd: string }) => {
    const isRepo = await isGitRepo(cwd)
    if (!isRepo) return []
    return getWorktrees(cwd)
  })

  // Git derive worktree
  ipcMain.handle('git:derive-worktree', async (_event, { cwd, branch, path: targetPath }: { cwd: string; branch: string; path: string }) => {
    return deriveWorktree(cwd, branch, targetPath)
  })

  // Git create branch
  ipcMain.handle('git:create-branch', async (_event, { cwd, branch, startPoint }: { cwd: string; branch: string; startPoint?: string }) => {
    return createBranch(cwd, branch, startPoint)
  })
```

- [ ] **Step 4: Commit**

```bash
git add electron/main/ipc-handlers.ts
git commit -m "feat: wire git IPC handlers to git-service.ts"
```

---

### Task 4: Preload Bindings

**Files:**
- Modify: `electron/preload/index.ts`

- [ ] **Step 1: Add git preload bindings**

After `gitStatus` in preload:

```typescript
    gitCommit: (params: { cwd: string; message: string }) =>
      ipcRenderer.invoke('git:commit', params),
    gitPush: (params: { cwd: string }) =>
      ipcRenderer.invoke('git:push', params),
    gitLog: (params: { cwd: string; limit?: number }) =>
      ipcRenderer.invoke('git:log', params),
    gitBranches: (params: { cwd: string }) =>
      ipcRenderer.invoke('git:branches', params),
    gitCheckout: (params: { cwd: string; branch: string }) =>
      ipcRenderer.invoke('git:checkout', params),
    gitDiff: (params: { cwd: string; file?: string }) =>
      ipcRenderer.invoke('git:diff', params),
    gitCommitDetail: (params: { cwd: string; sha: string }) =>
      ipcRenderer.invoke('git:commit-detail', params),
    gitWorktrees: (params: { cwd: string }) =>
      ipcRenderer.invoke('git:worktrees', params),
    gitDeriveWorktree: (params: { cwd: string; branch: string; path: string }) =>
      ipcRenderer.invoke('git:derive-worktree', params),
    gitCreateBranch: (params: { cwd: string; branch: string; startPoint?: string }) =>
      ipcRenderer.invoke('git:create-branch', params),
    onGitError: (cb: (data: { message: string }) => void) => {
      const handler = (_e: Electron.IpcRendererEvent, data: { message: string }) => cb(data)
      ipcRenderer.on('git:error', handler)
      return () => ipcRenderer.removeListener('git:error', handler)
    },
```

- [ ] **Step 2: Commit**

```bash
git add electron/preload/index.ts
git commit -m "feat: add git preload bindings"
```

---

### Task 5: Git Store

**Files:**
- Create: `src/store/git-store.ts`

- [ ] **Step 1: Write git store**

```typescript
// src/store/git-store.ts
import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { GitStatus, GitLogEntry, GitWorktree, GitBranch, GitCommitDetail } from '../../electron/shared/types'

interface GitState {
  status: GitStatus | null
  log: GitLogEntry[]
  branches: GitBranch[]
  worktrees: GitWorktree[]
  loading: boolean
  error: string | null
  cwd: string

  loadStatus: (cwd: string) => Promise<void>
  loadLog: (cwd: string, limit?: number) => Promise<void>
  loadBranches: (cwd: string) => Promise<void>
  loadWorktrees: (cwd: string) => Promise<void>
  commit: (message: string) => Promise<boolean>
  push: () => Promise<boolean>
  checkout: (branch: string) => Promise<boolean>
  refreshAll: () => Promise<void>
}

export const useGitStore = create<GitState>()(
  immer((set, get) => ({
    status: null,
    log: [],
    branches: [],
    worktrees: [],
    loading: false,
    error: null,
    cwd: '',

    loadStatus: async (cwd: string) => {
      try {
        const status = await window.electron.gitStatus(cwd)
        set((s) => { s.status = status; s.cwd = cwd; s.error = null })
      } catch (err) {
        set((s) => { s.error = String(err) })
      }
    },

    loadLog: async (cwd: string, limit = 30) => {
      try {
        const log = await window.electron.gitLog({ cwd, limit })
        set((s) => { s.log = log })
      } catch { /* ignore */ }
    },

    loadBranches: async (cwd: string) => {
      try {
        const branches = await window.electron.gitBranches({ cwd })
        // Mark current branch
        const currentBranch = get().status?.branch
        for (const b of branches) {
          b.isCurrent = b.name === currentBranch || (!b.isRemote && b.name === currentBranch)
        }
        set((s) => { s.branches = branches })
      } catch { /* ignore */ }
    },

    loadWorktrees: async (cwd: string) => {
      try {
        const worktrees = await window.electron.gitWorktrees({ cwd })
        set((s) => { s.worktrees = worktrees })
      } catch { /* ignore */ }
    },

    commit: async (message: string): Promise<boolean> => {
      set((s) => { s.loading = true })
      try {
        const result = await window.electron.gitCommit({ cwd: get().cwd, message })
        if (result.success) {
          await get().loadStatus(get().cwd)
          await get().loadLog(get().cwd)
        }
        return result.success
      } catch { return false }
      finally { set((s) => { s.loading = false }) }
    },

    push: async (): Promise<boolean> => {
      set((s) => { s.loading = true })
      try {
        const result = await window.electron.gitPush({ cwd: get().cwd })
        return result.success
      } catch { return false }
      finally { set((s) => { s.loading = false }) }
    },

    checkout: async (branch: string): Promise<boolean> => {
      set((s) => { s.loading = true })
      try {
        const result = await window.electron.gitCheckout({ cwd: get().cwd, branch })
        if (result.success) {
          await get().loadStatus(get().cwd)
          await get().loadBranches(get().cwd)
        }
        return result.success
      } catch { return false }
      finally { set((s) => { s.loading = false }) }
    },

    refreshAll: async () => {
      const { cwd } = get()
      if (!cwd) return
      await Promise.all([
        get().loadStatus(cwd),
        get().loadLog(cwd),
        get().loadBranches(cwd),
        get().loadWorktrees(cwd),
      ])
    },
  }))
)
```

- [ ] **Step 2: Commit**

```bash
git add src/store/git-store.ts
git commit -m "feat: add git Zustand store"
```

---

### Task 6: Git Panel Main Component

**Files:**
- Create: `src/components/git/GitPanel.tsx`

- [ ] **Step 1: Write GitPanel**

```typescript
// src/components/git/GitPanel.tsx
import React, { useEffect } from 'react'
import { GitBranch, History, FolderGit, GitCommit } from 'lucide-react'
import { useTabStore, selectActiveTab } from '../../store/tab-store'
import { useGitStore } from '../../store/git-store'
import { GitStatusSection } from './GitStatusSection'
import { GitBranchSelector } from './GitBranchSelector'
import { GitHistorySection } from './GitHistorySection'
import { GitWorktreeSection } from './GitWorktreeSection'

interface CollapsibleSection {
  id: string
  label: string
  icon: React.JSX.Element
  content: React.JSX.Element
}

export function GitPanel(): React.JSX.Element {
  const cwd = useTabStore((s) => selectActiveTab(s)?.cwd ?? '')
  const loadStatus = useGitStore((s) => s.loadStatus)
  const loadLog = useGitStore((s) => s.loadLog)
  const loadBranches = useGitStore((s) => s.loadBranches)
  const loadWorktrees = useGitStore((s) => s.loadWorktrees)

  useEffect(() => {
    if (cwd) {
      loadStatus(cwd)
      loadLog(cwd)
      loadBranches(cwd)
      loadWorktrees(cwd)
    }
  }, [cwd, loadStatus, loadLog, loadBranches, loadWorktrees])

  const sections: CollapsibleSection[] = [
    { id: 'status', label: 'Status', icon: <GitCommit size={13} />, content: <GitStatusSection /> },
    { id: 'branch', label: 'Branch', icon: <GitBranch size={13} />, content: <GitBranchSelector /> },
    { id: 'history', label: 'History', icon: <History size={13} />, content: <GitHistorySection /> },
    { id: 'worktree', label: 'Worktree', icon: <FolderGit size={13} />, content: <GitWorktreeSection /> },
  ]

  return (
    <div className="git-panel">
      {sections.map((section) => (
        <CollapsibleSection key={section.id} section={section} />
      ))}
    </div>
  )
}

function CollapsibleSection({ section }: { section: CollapsibleSection }): React.JSX.Element {
  const [expanded, setExpanded] = React.useState(section.id === 'status')

  return (
    <div className="git-section">
      <button
        className="git-section-header"
        onClick={() => setExpanded((v) => !v)}
      >
        {section.icon}
        <span className="git-section-title">{section.label}</span>
        <span className={`git-section-chevron${expanded ? ' expanded' : ''}`}>▸</span>
      </button>
      {expanded && <div className="git-section-content">{section.content}</div>}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/git/GitPanel.tsx
git commit -m "feat: add GitPanel main component with collapsible sections"
```

---

### Task 7: Git Status Section

**Files:**
- Create: `src/components/git/GitStatusSection.tsx`

- [ ] **Step 1: Write GitStatusSection**

```typescript
// src/components/git/GitStatusSection.tsx
import React from 'react'
import { GitBranch, Upload } from 'lucide-react'
import { useGitStore } from '../../store/git-store'
import { CommitDialog } from './dialogs/CommitDialog'

const STATUS_COLORS: Record<string, string> = {
  M: 'var(--color-warning)',
  A: 'var(--color-success)',
  D: 'var(--color-error)',
  R: 'var(--color-info)',
  '?': 'var(--color-text-muted)',
  '!': 'var(--color-error)',
}

export function GitStatusSection(): React.JSX.Element {
  const status = useGitStore((s) => s.status)
  const loading = useGitStore((s) => s.loading)
  const refreshAll = useGitStore((s) => s.refreshAll)
  const [showCommit, setShowCommit] = React.useState(false)

  if (!status) return <div className="git-loading">Loading...</div>

  const staged = status.entries.filter((e) => e.staged)
  const unstaged = status.entries.filter((e) => !e.staged)

  return (
    <div className="git-status">
      <div className="git-status-branch">
        <GitBranch size={13} />
        <span>{status.branch || '(no branch)'}</span>
        {status.upstream && (
          <span className="git-status-upstream">
            {status.ahead > 0 && <span className="git-status-ahead">↑{status.ahead}</span>}
            {status.behind > 0 && <span className="git-status-behind">↓{status.behind}</span>}
            {status.upstream}
          </span>
        )}
      </div>

      {staged.length > 0 && (
        <div className="git-status-group">
          <div className="git-status-label">Staged ({staged.length})</div>
          {staged.map((entry, i) => (
            <div key={i} className="git-status-entry">
              <span className="git-status-code" style={{ color: STATUS_COLORS[entry.code] }}>
                {entry.code}
              </span>
              <span className="git-status-file">{entry.file}</span>
            </div>
          ))}
        </div>
      )}

      {unstaged.length > 0 && (
        <div className="git-status-group">
          <div className="git-status-label">Unstaged ({unstaged.length})</div>
          {unstaged.map((entry, i) => (
            <div key={i} className="git-status-entry">
              <span className="git-status-code" style={{ color: STATUS_COLORS[entry.code] }}>
                {entry.code}
              </span>
              <span className="git-status-file">{entry.file}</span>
            </div>
          ))}
        </div>
      )}

      {staged.length === 0 && unstaged.length === 0 && (
        <div className="git-status-clean">Clean</div>
      )}

      <div className="git-status-actions">
        <button
          className="git-btn git-btn-primary"
          onClick={() => setShowCommit(true)}
          disabled={unstaged.length === 0 && staged.length === 0}
        >
          Commit
        </button>
        <button
          className="git-btn"
          onClick={async () => {
            await useGitStore.getState().push()
            await refreshAll()
          }}
          disabled={!status.upstream || loading}
        >
          <Upload size={12} /> Push
        </button>
        <button className="git-btn" onClick={refreshAll}>
          Refresh
        </button>
      </div>

      {showCommit && <CommitDialog onClose={() => setShowCommit(false)} />}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/git/GitStatusSection.tsx
git commit -m "feat: add GitStatusSection with staged/unstaged display"
```

---

### Task 8: Git Branch Selector

**Files:**
- Create: `src/components/git/GitBranchSelector.tsx`

- [ ] **Step 1: Write GitBranchSelector**

```typescript
// src/components/git/GitBranchSelector.tsx
import React, { useState } from 'react'
import { GitBranch, Plus, Lock } from 'lucide-react'
import { useGitStore } from '../../store/git-store'

export function GitBranchSelector(): React.JSX.Element {
  const branches = useGitStore((s) => s.branches)
  const worktrees = useGitStore((s) => s.worktrees)
  const refreshAll = useGitStore((s) => s.refreshAll)
  const [showNewBranch, setShowNewBranch] = useState(false)

  const localBranches = branches.filter((b) => !b.isRemote)

  const worktreePaths = new Set(worktrees.map((w) => w.branch))

  return (
    <div className="git-branch-selector">
      <div className="git-branch-list">
        {localBranches.map((branch) => {
          const occupied = worktreePaths.has(branch.name)
          return (
            <button
              key={branch.name}
              className={`git-branch-item${branch.isCurrent ? ' git-branch-current' : ''}`}
              onClick={async () => {
                if (occupied) return
                const ok = await useGitStore.getState().checkout(branch.name)
                if (ok) await refreshAll()
              }}
            >
              {occupied ? <Lock size={12} /> : <GitBranch size={12} />}
              <span>{branch.name}</span>
              {branch.isCurrent && <span className="git-branch-badge">current</span>}
            </button>
          )
        })}
      </div>
      <button
        className="git-btn git-btn-small"
        onClick={() => setShowNewBranch(true)}
      >
        <Plus size={12} /> New branch
      </button>

      {showNewBranch && (
        <NewBranchDialog onClose={() => setShowNewBranch(false)} />
      )}
    </div>
  )
}

function NewBranchDialog({ onClose }: { onClose: () => void }): React.JSX.Element {
  const [name, setName] = useState('')
  const [error, setError] = useState('')

  const handleCreate = async () => {
    if (!name.trim()) { setError('Branch name is required'); return }
    const result = await window.electron.gitCreateBranch({
      cwd: useGitStore.getState().cwd,
      branch: name.trim(),
    })
    if (result.success) {
      await useGitStore.getState().refreshAll()
      onClose()
    } else {
      setError(result.error ?? 'Failed to create branch')
    }
  }

  return (
    <div className="git-dialog-overlay">
      <div className="git-dialog">
        <h3>New Branch</h3>
        <input
          className="git-dialog-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Branch name"
          autoFocus
        />
        {error && <div className="git-dialog-error">{error}</div>}
        <div className="git-dialog-actions">
          <button className="git-btn" onClick={onClose}>Cancel</button>
          <button className="git-btn git-btn-primary" onClick={handleCreate}>Create</button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/git/GitBranchSelector.tsx
git commit -m "feat: add GitBranchSelector with checkout and create"
```

---

### Task 9: Git History Section

**Files:**
- Create: `src/components/git/GitHistorySection.tsx`
- Create: `src/components/git/GitDiffViewer.tsx`

- [ ] **Step 1: Write GitDiffViewer**

```typescript
// src/components/git/GitDiffViewer.tsx
import React from 'react'

export function GitDiffViewer({ diff }: { diff: string }): React.JSX.Element {
  // Simple unified diff display with syntax coloring
  const lines = diff.split('\n')

  return (
    <pre className="git-diff">
      {lines.map((line, i) => {
        let className = 'git-diff-line'
        if (line.startsWith('+')) className += ' git-diff-add'
        else if (line.startsWith('-')) className += ' git-diff-del'
        else if (line.startsWith('@@')) className += ' git-diff-hunk'
        else if (line.startsWith('diff ') || line.startsWith('---') || line.startsWith('+++')) className += ' git-diff-header'

        return <div key={i} className={className}>{line}</div>
      })}
    </pre>
  )
}
```

- [ ] **Step 2: Write GitHistorySection**

```typescript
// src/components/git/GitHistorySection.tsx
import React, { useState } from 'react'
import { GitCommit } from 'lucide-react'
import { useGitStore } from '../../store/git-store'
import { CommitDetailDialog } from './dialogs/CommitDetailDialog'

export function GitHistorySection(): React.JSX.Element {
  const log = useGitStore((s) => s.log)
  const [selectedSha, setSelectedSha] = useState<string | null>(null)

  if (log.length === 0) {
    return <div className="git-history-empty">No commits yet</div>
  }

  return (
    <div className="git-history">
      {log.map((entry) => (
        <button
          key={entry.sha}
          className="git-history-item"
          onClick={() => setSelectedSha(entry.sha)}
        >
          <GitCommit size={13} className="git-history-icon" />
          <div className="git-history-content">
            <div className="git-history-message">{entry.message}</div>
            <div className="git-history-meta">
              <span className="git-history-sha">{entry.shortSha}</span>
              <span className="git-history-author">{entry.author}</span>
              <span className="git-history-date">{entry.relativeDate}</span>
            </div>
          </div>
        </button>
      ))}

      {selectedSha && (
        <CommitDetailDialog sha={selectedSha} onClose={() => setSelectedSha(null)} />
      )}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/git/GitDiffViewer.tsx src/components/git/GitHistorySection.tsx
git commit -m "feat: add GitHistorySection and GitDiffViewer"
```

---

### Task 10: Git Worktree Section

**Files:**
- Create: `src/components/git/GitWorktreeSection.tsx`

- [ ] **Step 1: Write GitWorktreeSection**

```typescript
// src/components/git/GitWorktreeSection.tsx
import React, { useState } from 'react'
import { FolderGit, Plus } from 'lucide-react'
import { useGitStore } from '../../store/git-store'
import { useTabStore } from '../../store/tab-store'
import { DeriveWorktreeDialog } from './dialogs/DeriveWorktreeDialog'

export function GitWorktreeSection(): React.JSX.Element {
  const worktrees = useGitStore((s) => s.worktrees)
  const [showDerive, setShowDerive] = useState(false)

  if (worktrees.length === 0) {
    return <div className="git-worktree-empty">No worktrees</div>
  }

  return (
    <div className="git-worktree">
      {worktrees.map((wt) => (
        <div key={wt.path} className="git-worktree-item">
          <FolderGit size={13} />
          <div className="git-worktree-content">
            <div className="git-worktree-branch">{wt.branch}</div>
            <div className="git-worktree-path">{wt.path}</div>
            {wt.dirty && <span className="git-worktree-dirty">dirty</span>}
          </div>
          <button
            className="git-btn git-btn-small"
            onClick={() => {
              // Create new tab for this worktree's directory
              useTabStore.getState().addTab(wt.path)
            }}
          >
            Switch to
          </button>
        </div>
      ))}
      <button
        className="git-btn git-btn-small"
        onClick={() => setShowDerive(true)}
      >
        <Plus size={12} /> Create worktree
      </button>

      {showDerive && <DeriveWorktreeDialog onClose={() => setShowDerive(false)} />}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/git/GitWorktreeSection.tsx
git commit -m "feat: add GitWorktreeSection"
```

---

### Task 11: Git Dialogs

**Files:**
- Create: `src/components/git/dialogs/CommitDialog.tsx`
- Create: `src/components/git/dialogs/CommitDetailDialog.tsx`
- Create: `src/components/git/dialogs/DeriveWorktreeDialog.tsx`

- [ ] **Step 1: Write CommitDialog**

```typescript
// src/components/git/dialogs/CommitDialog.tsx
import React, { useState } from 'react'
import { useGitStore } from '../../../store/git-store'

export function CommitDialog({ onClose }: { onClose: () => void }): React.JSX.Element {
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const loading = useGitStore((s) => s.loading)

  const handleCommit = async () => {
    if (!message.trim()) { setError('Commit message is required'); return }
    const ok = await useGitStore.getState().commit(message.trim())
    if (ok) onClose()
    else setError('Commit failed')
  }

  return (
    <div className="git-dialog-overlay" onClick={onClose}>
      <div className="git-dialog" onClick={(e) => e.stopPropagation()}>
        <h3>Commit Changes</h3>
        <textarea
          className="git-dialog-textarea"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Commit message..."
          autoFocus
          rows={4}
        />
        {error && <div className="git-dialog-error">{error}</div>}
        <div className="git-dialog-actions">
          <button className="git-btn" onClick={onClose} disabled={loading}>Cancel</button>
          <button className="git-btn git-btn-primary" onClick={handleCommit} disabled={loading}>
            {loading ? 'Committing...' : 'Commit'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Write CommitDetailDialog**

```typescript
// src/components/git/dialogs/CommitDetailDialog.tsx
import React, { useEffect, useState } from 'react'
import type { GitCommitDetail } from '../../../../electron/shared/types'
import { GitDiffViewer } from '../GitDiffViewer'

export function CommitDetailDialog({ sha, onClose }: { sha: string; onClose: () => void }): React.JSX.Element {
  const [detail, setDetail] = useState<GitCommitDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const d = await window.electron.gitCommitDetail({
          cwd: useGitStore.getState().cwd,
          sha,
        })
        setDetail(d)
      } catch { /* ignore */ }
      finally { setLoading(false) }
    }
    load()
  }, [sha])

  return (
    <div className="git-dialog-overlay" onClick={onClose}>
      <div className="git-dialog git-dialog-large" onClick={(e) => e.stopPropagation()}>
        <h3>Commit Detail</h3>
        {loading && <div className="git-loading">Loading...</div>}
        {detail && (
          <>
            <div className="git-commit-meta">
              <div className="git-commit-sha">{detail.sha.slice(0, 7)}</div>
              <div className="git-commit-message">{detail.message}</div>
              <div className="git-commit-author">{detail.author} · {detail.date}</div>
              <div className="git-commit-stats">
                {detail.stats.files} files, +{detail.stats.added} -{detail.stats.deleted}
              </div>
            </div>
            <GitDiffViewer diff={detail.diff} />
          </>
        )}
        <div className="git-dialog-actions">
          <button className="git-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Write DeriveWorktreeDialog**

```typescript
// src/components/git/dialogs/DeriveWorktreeDialog.tsx
import React, { useState } from 'react'
import { useGitStore } from '../../../store/git-store'

export function DeriveWorktreeDialog({ onClose }: { onClose: () => void }): React.JSX.Element {
  const [branch, setBranch] = useState('')
  const [path, setPath] = useState('')
  const [error, setError] = useState('')

  const handleCreate = async () => {
    if (!branch.trim()) { setError('Branch name is required'); return }
    if (!path.trim()) { setError('Path is required'); return }
    const result = await window.electron.gitDeriveWorktree({
      cwd: useGitStore.getState().cwd,
      branch: branch.trim(),
      path: path.trim(),
    })
    if (result.success) {
      await useGitStore.getState().refreshAll()
      onClose()
    } else {
      setError(result.error ?? 'Failed to create worktree')
    }
  }

  return (
    <div className="git-dialog-overlay" onClick={onClose}>
      <div className="git-dialog" onClick={(e) => e.stopPropagation()}>
        <h3>New Worktree</h3>
        <input
          className="git-dialog-input"
          value={branch}
          onChange={(e) => setBranch(e.target.value)}
          placeholder="Branch name"
        />
        <input
          className="git-dialog-input"
          value={path}
          onChange={(e) => setPath(e.target.value)}
          placeholder="/path/to/worktree"
        />
        {error && <div className="git-dialog-error">{error}</div>}
        <div className="git-dialog-actions">
          <button className="git-btn" onClick={onClose}>Cancel</button>
          <button className="git-btn git-btn-primary" onClick={handleCreate}>Create</button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/git/dialogs/CommitDialog.tsx src/components/git/dialogs/CommitDetailDialog.tsx src/components/git/dialogs/DeriveWorktreeDialog.tsx
git commit -m "feat: add git dialogs (commit, commit detail, derive worktree)"
```

---

### Task 12: Integrate GitPanel into AppShell

**Files:**
- Modify: `src/AppShell.tsx`

- [ ] **Step 1: Integrate GitPanel**

In `AppShell.tsx`, after the `<PanelZone />` line, add the GitPanel render:

```typescript
      {showGit && (
        <div style={{
          width: 320,
          flexShrink: 0,
          borderLeft: '1px solid var(--color-border)',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--color-surface)',
          overflow: 'hidden',
        }}>
          <div
            style={{
              padding: '6px 12px',
              borderBottom: '1px solid var(--color-border)',
              fontSize: 10,
              fontWeight: 700,
              color: 'var(--color-text-muted)',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              flexShrink: 0,
            }}
          >
            Git
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <GitPanel />
          </div>
        </div>
      )}
```

And add import:

```typescript
import { GitPanel } from './components/git/GitPanel'
```

- [ ] **Step 2: Commit**

```bash
git add src/AppShell.tsx
git commit -m "feat: integrate GitPanel into AppShell Views"
```

---

### Task 13: CSS Styles

**Files:**
- Modify: `src/styles.css`

- [ ] **Step 1: Add Git Panel CSS**

Append to `src/styles.css`:

```css
/* ── Git Panel ──────────────────────────────────── */

.git-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow-y: auto;
}

.git-section {
  border-bottom: 1px solid var(--color-border);
}

.git-section-header {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 8px 12px;
  border: none;
  background: none;
  font: inherit;
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-muted);
  cursor: pointer;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.git-section-header:hover {
  background: var(--color-surface-2);
}

.git-section-title {
  flex: 1;
}

.git-section-chevron {
  transition: transform 0.15s ease;
  font-size: 10px;
}

.git-section-chevron.expanded {
  transform: rotate(90deg);
}

.git-section-content {
  padding: 4px 12px 12px;
}

/* Status */
.git-status {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.git-status-branch {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
}

.git-status-upstream {
  font-size: 11px;
  color: var(--color-text-muted);
  font-weight: 400;
  margin-left: 4px;
}

.git-status-ahead {
  color: var(--color-success);
  margin-right: 2px;
}

.git-status-behind {
  color: var(--color-warning);
  margin-right: 2px;
}

.git-status-group {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.git-status-label {
  font-size: 10px;
  font-weight: 600;
  color: var(--color-text-faint);
  text-transform: uppercase;
  padding: 2px 0;
}

.git-status-entry {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 4px;
  font-size: 12px;
}

.git-status-code {
  font-family: 'Geist Mono', monospace;
  font-size: 10px;
  font-weight: 700;
  width: 18px;
  text-align: center;
}

.git-status-file {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.git-status-clean {
  text-align: center;
  color: var(--color-success);
  font-size: 12px;
  padding: 8px 0;
}

.git-status-actions {
  display: flex;
  gap: 6px;
  padding-top: 8px;
  border-top: 1px solid var(--color-border);
}

/* Buttons */
.git-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: none;
  font: inherit;
  font-size: 11px;
  color: var(--color-text);
  cursor: pointer;
}

.git-btn:hover {
  background: var(--color-surface-2);
}

.git-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.git-btn-primary {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: white;
}

.git-btn-primary:hover {
  background: var(--color-accent-dark, var(--color-accent));
}

.git-btn-small {
  padding: 3px 8px;
  font-size: 10px;
}

/* Branch selector */
.git-branch-selector {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.git-branch-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 200px;
  overflow-y: auto;
}

.git-branch-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border: none;
  background: none;
  font: inherit;
  font-size: 12px;
  border-radius: var(--radius-xs);
  cursor: pointer;
  text-align: left;
}

.git-branch-item:hover {
  background: var(--color-surface-2);
}

.git-branch-current {
  background: var(--color-accent-dim);
  color: var(--color-accent);
}

.git-branch-badge {
  margin-left: auto;
  font-size: 9px;
  color: var(--color-accent);
  font-weight: 600;
}

/* History */
.git-history {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 300px;
  overflow-y: auto;
}

.git-history-item {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  padding: 4px 8px;
  border: none;
  background: none;
  font: inherit;
  font-size: 12px;
  border-radius: var(--radius-xs);
  cursor: pointer;
  text-align: left;
}

.git-history-item:hover {
  background: var(--color-surface-2);
}

.git-history-icon {
  color: var(--color-text-muted);
  flex-shrink: 0;
  margin-top: 2px;
}

.git-history-content {
  flex: 1;
  min-width: 0;
}

.git-history-message {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.git-history-meta {
  display: flex;
  gap: 8px;
  font-size: 10px;
  color: var(--color-text-faint);
}

.git-history-sha {
  font-family: 'Geist Mono', monospace;
}

.git-history-empty {
  text-align: center;
  color: var(--color-text-faint);
  font-size: 12px;
  padding: 12px 0;
}

/* Worktree */
.git-worktree {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.git-worktree-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
}

.git-worktree-content {
  flex: 1;
  min-width: 0;
}

.git-worktree-branch {
  font-size: 12px;
  font-weight: 600;
}

.git-worktree-path {
  font-size: 10px;
  color: var(--color-text-faint);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.git-worktree-dirty {
  font-size: 9px;
  color: var(--color-warning);
  font-weight: 600;
}

.git-worktree-empty {
  text-align: center;
  color: var(--color-text-faint);
  font-size: 12px;
  padding: 12px 0;
}

/* Diff viewer */
.git-diff {
  font-family: 'Geist Mono', monospace;
  font-size: 11px;
  line-height: 1.4;
  overflow: auto;
  max-height: 400px;
  margin: 0;
  padding: 8px;
}

.git-diff-line { padding: 0 4px; }
.git-diff-add { background: rgba(34, 197, 94, 0.1); color: #22c55e; }
.git-diff-del { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
.git-diff-hunk { color: var(--color-accent); font-weight: 600; }
.git-diff-header { color: var(--color-text-muted); }

/* Dialogs */
.git-dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.git-dialog {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 20px;
  min-width: 320px;
  max-width: 500px;
  max-height: 80vh;
  overflow: auto;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
}

.git-dialog-large {
  min-width: 600px;
  max-width: 80vw;
}

.git-dialog h3 {
  margin: 0 0 12px;
  font-size: 14px;
  font-weight: 600;
}

.git-dialog-input {
  width: 100%;
  padding: 6px 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface-2);
  font: inherit;
  font-size: 12px;
  margin-bottom: 8px;
}

.git-dialog-textarea {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface-2);
  font: inherit;
  font-size: 12px;
  resize: vertical;
  margin-bottom: 8px;
}

.git-dialog-error {
  color: var(--color-error);
  font-size: 11px;
  margin-bottom: 8px;
}

.git-dialog-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 12px;
}

.git-commit-meta {
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--color-border);
}

.git-commit-sha {
  font-family: 'Geist Mono', monospace;
  font-size: 11px;
  color: var(--color-accent);
  margin-bottom: 4px;
}

.git-commit-message {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 4px;
}

.git-commit-author {
  font-size: 11px;
  color: var(--color-text-muted);
  margin-bottom: 4px;
}

.git-commit-stats {
  font-size: 11px;
  color: var(--color-text-faint);
}

.git-loading {
  text-align: center;
  color: var(--color-text-faint);
  font-size: 12px;
  padding: 12px 0;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/styles.css
git commit -m "style: add Git Panel CSS styles"
```

---

### Task 14: Build Verification

**Files:** No file changes.

- [ ] **Step 1: Type check**

```bash
npx tsc --noEmit --pretty false 2>&1 | head -50
```

Expected: No errors.

- [ ] **Step 2: Build**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 3: Run all tests**

```bash
npm test
```

Expected: All tests pass.
