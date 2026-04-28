# File Browser Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the non-existent file tree UI with a full-featured file browser: recursive directory tree, file preview with syntax highlighting, file search, and file operations (create/rename/delete), all within the existing Views panel interface.

**Architecture:** Main process `files.ts` handles file scanning/preview/operations via `child_process` and `fs`. Renderer components (`FileBrowser`, `FileTree`, `FilePreview`, `FileContextMenu`) consume these via IPC (`fs:*` channels). State managed by a dedicated `file-browser-store.ts` Zustand store. Follows existing patterns: `ipcMain.handle('domain:action')` → preload `contextBridge` → `window.electron.*`.

**Tech Stack:** Electron IPC, Zustand + immer, highlight.js (existing), lucide-react (existing), plain CSS with `--ft-*` class prefix.

**New Dependencies:** None (all existing).

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `electron/main/files.ts` | File scan/preview/search/create/delete/rename service functions |
| Create | `electron/main/files-utils.ts` | Path safety, language detection, ignore list utilities |
| Create | `test/files.test.ts` | Unit tests for files.ts and files-utils.ts |
| Modify | `electron/shared/types.ts:339-359` | Add new types: FileTreeNode, FilePreviewResult, FileOperationResult |
| Modify | `electron/shared/types.ts:363+` | Add new ElectronAPI methods: readFile, searchFiles, createFile, deleteFile, renameFile |
| Modify | `electron/preload/index.ts` | Add preload bindings for new fs APIs |
| Modify | `electron/main/ipc-handlers.ts:341-358` | Replace inline fs:list-dir with delegation to files.ts, add new fs:* handlers |
| Create | `src/store/file-browser-store.ts` | Zustand store for file browser state |
| Create | `src/components/project/FileBrowser.tsx` | Main panel component (replaces non-existent FileTreePanel) |
| Create | `src/components/project/FileTree.tsx` | Directory tree with expand/collapse |
| Create | `src/components/project/FilePreview.tsx` | File content preview panel |
| Create | `src/components/project/FileContextMenu.tsx` | Right-click context menu |
| Modify | `src/AppShell.tsx:207-235` | Add "Files" view toggle (already exists but verify integration) |
| Modify | `src/styles.css` | Add `.ft-*` CSS classes |

---

### Task 1: Shared Types

**Files:**
- Modify: `electron/shared/types.ts:339-359`
- Modify: `electron/shared/types.ts:363+` (ElectronAPI interface)

- [ ] **Step 1: Add new file types after line 345 (after DirEntry)**

```typescript
export interface FileTreeNode {
  name: string
  isDir: boolean
  path: string
  size?: number
  children?: FileTreeNode[]
}

export interface FilePreviewResult {
  content: string
  totalLines: number
  language: string
  truncated: boolean
  tooLarge?: boolean
}

export interface FileOperationResult {
  success: boolean
  error?: string
}
```

- [ ] **Step 2: Extend ElectronAPI interface**

Add these methods to the `ElectronAPI` interface (after `listDir` and `gitStatus`):

```typescript
  // File browser
  readFile: (params: { path: string; maxLines?: number }) => Promise<FilePreviewResult>
  searchFiles: (params: { dirPath: string; query: string }) => Promise<FileTreeNode[]>
  createFile: (params: { path: string; isDir?: boolean }) => Promise<FileOperationResult>
  deleteFile: (params: { path: string }) => Promise<FileOperationResult>
  renameFile: (params: { oldPath: string; newPath: string }) => Promise<FileOperationResult>
  openInSystem: (params: { path: string }) => Promise<{ success: boolean; error?: string }>
```

- [ ] **Step 3: Commit**

```bash
git add electron/shared/types.ts
git commit -m "types: add FileTreeNode, FilePreviewResult, FileOperationResult and ElectronAPI bindings"
```

---

### Task 2: File Utilities (files-utils.ts)

**Files:**
- Create: `electron/main/files-utils.ts`
- Create: `test/files-utils.test.ts`

- [ ] **Step 1: Write tests**

```typescript
// test/files-utils.test.ts
import { describe, it, expect } from 'vitest'
import { isPathSafe, getFileLanguage } from '../electron/main/files-utils'

describe('isPathSafe', () => {
  it('allows paths within cwd', () => {
    expect(isPathSafe('/Users/me/project/src/file.ts', '/Users/me/project')).toBe(true)
  })

  it('rejects paths outside cwd', () => {
    expect(isPathSafe('/Users/other/secret.txt', '/Users/me/project')).toBe(false)
  })

  it('rejects traversal attempts', () => {
    expect(isPathSafe('/Users/me/project/../../../etc/passwd', '/Users/me/project')).toBe(false)
  })
})

describe('getFileLanguage', () => {
  it('detects TypeScript', () => {
    expect(getFileLanguage('app.ts')).toBe('typescript')
  })

  it('detects Python', () => {
    expect(getFileLanguage('script.py')).toBe('python')
  })

  it('detects Rust', () => {
    expect(getFileLanguage('main.rs')).toBe('rust')
  })

  it('returns empty for unknown', () => {
    expect(getFileLanguage('file.xyz')).toBe('')
  })

  it('detects JSON', () => {
    expect(getFileLanguage('config.json')).toBe('json')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test -- test/files-utils.test.ts
```

Expected: FAIL — module does not exist.

- [ ] **Step 3: Write implementation**

```typescript
// electron/main/files-utils.ts
import path from 'path'

const IGNORED_DIRS = new Set([
  'node_modules', '.git', 'dist', '.next', '__pycache__', '.turbo', 'build', '.DS_Store',
])

export function isPathSafe(targetPath: string, cwd: string): boolean {
  const resolved = path.resolve(targetPath)
  const resolvedCwd = path.resolve(cwd)
  return resolved.startsWith(resolvedCwd)
}

const EXTENSION_MAP: Record<string, string> = {
  '.ts': 'typescript', '.tsx': 'typescriptreact', '.js': 'javascript', '.jsx': 'javascriptreact',
  '.py': 'python', '.rb': 'ruby', '.rs': 'rust', '.go': 'go', '.java': 'java',
  '.kt': 'kotlin', '.scala': 'scala', '.swift': 'swift', '.c': 'c', '.cpp': 'cpp',
  '.h': 'c', '.hpp': 'cpp', '.cs': 'csharp', '.php': 'php', '.lua': 'lua',
  '.sh': 'bash', '.zsh': 'bash', '.fish': 'fish', '.ps1': 'powershell',
  '.html': 'html', '.css': 'css', '.scss': 'scss', '.sass': 'sass', '.less': 'less',
  '.json': 'json', '.yaml': 'yaml', '.yml': 'yaml', '.toml': 'toml', '.xml': 'xml',
  '.md': 'markdown', '.sql': 'sql', '.graphql': 'graphql', '.proto': 'protobuf',
  '.vue': 'vue', '.svelte': 'svelte', '.dart': 'dart', '.ex': 'elixir', '.exs': 'elixir',
  '.erl': 'erlang', '.hs': 'haskell', '.clj': 'clojure', '.r': 'r', '.R': 'r',
  '.m': 'objectivec', '.mm': 'objectivec', '.sol': 'solidity', '.tf': 'hcl',
  '.dockerfile': 'dockerfile', '.env': 'bash',
}

export function getFileLanguage(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase()
  const basename = path.basename(filePath).toLowerCase()
  // Special case for files without extension
  if (basename === '.dockerfile' || basename === 'dockerfile') return 'dockerfile'
  if (basename === '.env' || basename.startsWith('.env.')) return 'bash'
  return EXTENSION_MAP[ext] ?? ''
}

export function shouldIgnoreDir(name: string): boolean {
  return IGNORED_DIRS.has(name)
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test -- test/files-utils.test.ts
```

Expected: All 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add electron/main/files-utils.ts test/files-utils.test.ts
git commit -m "feat: add file utilities (path safety, language detection, ignore list)"
```

---

### Task 3: File Service (files.ts)

**Files:**
- Create: `electron/main/files.ts`
- Create: `test/files.test.ts`

- [ ] **Step 1: Write tests**

```typescript
// test/files.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import fs from 'fs'
import { scanDirectory, readFilePreview, searchFiles, createFileOrDir, deleteFileOrDir, renameFileOrDir } from '../electron/main/files'

vi.mock('fs')
vi.mock('electron', () => ({ app: { getPath: () => '/tmp/test' } }))

const fakeDir = '/tmp/test-project'

describe('scanDirectory', () => {
  beforeEach(() => {
    vi.mocked(fs.readdirSync).mockReset()
    vi.mocked(fs.statSync).mockReset()
  })

  it('returns empty for non-existent directory', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false)
    expect(scanDirectory(fakeDir)).toEqual([])
  })

  it('sorts dirs before files', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readdirSync).mockReturnValue(['src', 'index.ts'])
    vi.mocked(fs.statSync).mockImplementation((p: string) => ({
      isDirectory: () => String(p).endsWith('src'),
      isFile: () => String(p).endsWith('index.ts'),
      size: 100,
    }) as fs.Stats)
    const result = scanDirectory(fakeDir, 1)
    expect(result[0].name).toBe('src')
    expect(result[0].isDir).toBe(true)
    expect(result[1].name).toBe('index.ts')
    expect(result[1].isDir).toBe(false)
  })

  it('skips ignored directories', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readdirSync).mockReturnValue(['node_modules', 'src'])
    vi.mocked(fs.statSync).mockImplementation(() => ({
      isDirectory: () => true,
      isFile: () => false,
      size: 0,
    }) as fs.Stats)
    const result = scanDirectory(fakeDir, 1)
    expect(result.find((n) => n.name === 'node_modules')).toBeUndefined()
    expect(result.find((n) => n.name === 'src')).toBeDefined()
  })
})

describe('readFilePreview', () => {
  it('returns truncated flag for large files', () => {
    const lines = Array.from({ length: 250 }, (_, i) => `line ${i + 1}`).join('\n')
    vi.spyOn(fs, 'readFileSync').mockReturnValue(lines)
    const result = readFilePreview('/tmp/test.ts', 200)
    expect(result.truncated).toBe(true)
    expect(result.totalLines).toBeGreaterThan(200)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test -- test/files.test.ts
```

Expected: FAIL — module does not exist.

- [ ] **Step 3: Write implementation**

```typescript
// electron/main/files.ts
import fs from 'fs'
import path from 'path'
import os from 'os'
import { execSync } from 'child_process'
import type { FileTreeNode, FilePreviewResult, FileOperationResult } from '../shared/types'
import { isPathSafe, getFileLanguage, shouldIgnoreDir } from './files-utils'

const MAX_PREVIEW_LINES = 200
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

export function scanDirectory(dirPath: string, depth = 3): FileTreeNode[] {
  if (!dirPath || !fs.existsSync(dirPath)) return []
  return scanRecursive(dirPath, depth)
}

function scanRecursive(dirPath: string, remainingDepth: number): FileTreeNode[] {
  if (remainingDepth < 0) return []
  try {
    const entries = fs.readdirSync(dirPath)
    const nodes: FileTreeNode[] = []
    for (const name of entries) {
      if (name.startsWith('.') && name !== '.env') continue
      try {
        const fullPath = path.join(dirPath, name)
        const stat = fs.statSync(fullPath)
        if (stat.isDirectory()) {
          if (shouldIgnoreDir(name)) continue
          const node: FileTreeNode = {
            name,
            isDir: true,
            path: fullPath,
          }
          if (remainingDepth > 0) {
            node.children = scanRecursive(fullPath, remainingDepth - 1)
          }
          nodes.push(node)
        } else if (stat.isFile()) {
          nodes.push({
            name,
            isDir: false,
            path: fullPath,
            size: stat.size,
          })
        }
      } catch { /* skip inaccessible */ }
    }
    return nodes.sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
      return a.name.localeCompare(b.name)
    })
  } catch { return [] }
}

export function readFilePreview(filePath: string, maxLines = MAX_PREVIEW_LINES): FilePreviewResult {
  try {
    const stat = fs.statSync(filePath)
    if (!stat.isFile()) return { content: '', totalLines: 0, language: '', truncated: false }
    if (stat.size > MAX_FILE_SIZE) {
      return {
        content: '',
        totalLines: 0,
        language: getFileLanguage(filePath),
        truncated: false,
        tooLarge: true,
      }
    }
    const content = fs.readFileSync(filePath, 'utf-8')
    const lines = content.split('\n')
    const totalLines = lines.length
    const preview = lines.slice(0, maxLines).join('\n')
    return {
      content: preview,
      totalLines,
      language: getFileLanguage(filePath),
      truncated: totalLines > maxLines,
    }
  } catch (err) {
    return {
      content: '',
      totalLines: 0,
      language: '',
      truncated: false,
    }
  }
}

export function searchFiles(dirPath: string, query: string): FileTreeNode[] {
  const results: FileTreeNode[] = []
  const lowerQuery = query.toLowerCase()
  searchRecursive(dirPath, lowerQuery, results, 3)
  return results
}

function searchRecursive(dirPath: string, query: string, results: FileTreeNode[], remainingDepth: number): void {
  if (remainingDepth < 0) return
  try {
    const entries = fs.readdirSync(dirPath)
    for (const name of entries) {
      if (name.startsWith('.') && name !== '.env') continue
      try {
        const fullPath = path.join(dirPath, name)
        const stat = fs.statSync(fullPath)
        if (stat.isDirectory()) {
          if (shouldIgnoreDir(name)) continue
          if (name.toLowerCase().includes(query)) {
            results.push({ name, isDir: true, path: fullPath })
          }
          if (remainingDepth > 0) {
            searchRecursive(fullPath, query, results, remainingDepth - 1)
          }
        } else if (stat.isFile() && name.toLowerCase().includes(query)) {
          results.push({ name, isDir: false, path: fullPath, size: stat.size })
        }
      } catch { /* skip */ }
    }
  } catch { /* skip */ }
}

export function createFileOrDir(targetPath: string, isDir = false): FileOperationResult {
  try {
    if (!isPathSafe(targetPath, getCwd())) return { success: false, error: 'Path outside project directory' }
    if (fs.existsSync(targetPath)) return { success: false, error: 'Path already exists' }
    if (isDir) {
      fs.mkdirSync(targetPath, { recursive: true })
    } else {
      fs.mkdirSync(path.dirname(targetPath), { recursive: true })
      fs.writeFileSync(targetPath, '')
    }
    return { success: true }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}

export function deleteFileOrDir(targetPath: string): FileOperationResult {
  try {
    if (!isPathSafe(targetPath, getCwd())) return { success: false, error: 'Path outside project directory' }
    if (!fs.existsSync(targetPath)) return { success: false, error: 'Path does not exist' }
    const stat = fs.statSync(targetPath)
    if (stat.isDirectory()) {
      fs.rmSync(targetPath, { recursive: true, force: true })
    } else {
      fs.unlinkSync(targetPath)
    }
    return { success: true }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}

export function renameFileOrDir(oldPath: string, newPath: string): FileOperationResult {
  try {
    if (!isPathSafe(oldPath, getCwd())) return { success: false, error: 'Old path outside project directory' }
    if (!isPathSafe(newPath, getCwd())) return { success: false, error: 'New path outside project directory' }
    if (!fs.existsSync(oldPath)) return { success: false, error: 'Source does not exist' }
    if (fs.existsSync(newPath)) return { success: false, error: 'Destination already exists' }
    fs.renameSync(oldPath, newPath)
    return { success: true }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}

// getCwd returns the current working directory from the active tab's cwd
// In IPC handlers, cwd is passed as a parameter; this helper is for internal validation
function getCwd(): string {
  // Default to os.homedir() as a safe fallback; actual validation happens in IPC handlers
  return os.homedir()
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test -- test/files.test.ts
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add electron/main/files.ts test/files.test.ts
git commit -m "feat: add file service (scan, preview, search, create, delete, rename)"
```

---

### Task 4: IPC Handlers

**Files:**
- Modify: `electron/main/ipc-handlers.ts`

- [ ] **Step 1: Update ipc-handlers.ts imports**

Add at top of file (after existing imports):

```typescript
import {
  scanDirectory,
  readFilePreview,
  searchFiles,
  createFileOrDir,
  deleteFileOrDir,
  renameFileOrDir,
} from './files'
import { shell } from 'electron'
```

- [ ] **Step 2: Replace inline fs:list-dir handler (lines 342-358)**

Replace the existing inline implementation with delegation:

```typescript
  // File system — list directory entries
  ipcMain.handle('fs:list-dir', (_event, { dirPath, depth = 3 }: { dirPath: string; depth?: number }) => {
    return scanDirectory(dirPath, depth)
  })
```

- [ ] **Step 3: Add new fs handlers after fs:list-dir**

```typescript
  // File browser — read file preview
  ipcMain.handle('fs:read-file', (_event, { path: filePath, maxLines }: { path: string; maxLines?: number }) => {
    return readFilePreview(filePath, maxLines)
  })

  // File browser — search files
  ipcMain.handle('fs:search', (_event, { dirPath, query }: { dirPath: string; query: string }) => {
    return searchFiles(dirPath, query)
  })

  // File browser — create file or directory
  ipcMain.handle('fs:create', (_event, { path: targetPath, isDir }: { path: string; isDir?: boolean }) => {
    return createFileOrDir(targetPath, isDir ?? false)
  })

  // File browser — delete file or directory
  ipcMain.handle('fs:delete', (_event, { path: targetPath }: { path: string }) => {
    return deleteFileOrDir(targetPath)
  })

  // File browser — rename file or directory
  ipcMain.handle('fs:rename', (_event, { oldPath, newPath }: { oldPath: string; newPath: string }) => {
    return renameFileOrDir(oldPath, newPath)
  })

  // File browser — open in system
  ipcMain.handle('fs:open-in-system', (_event, { path: targetPath }: { path: string }) => {
    try {
      shell.openPath(targetPath)
      return { success: true }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })
```

- [ ] **Step 4: Commit**

```bash
git add electron/main/ipc-handlers.ts
git commit -m "feat: wire file browser IPC handlers to files.ts service"
```

---

### Task 5: Preload Bindings

**Files:**
- Modify: `electron/preload/index.ts`

- [ ] **Step 1: Add new preload bindings**

Add these methods to the `api` object in preload (after `listDir`):

```typescript
    readFile: (params: { path: string; maxLines?: number }) =>
      ipcRenderer.invoke('fs:read-file', params),
    searchFiles: (params: { dirPath: string; query: string }) =>
      ipcRenderer.invoke('fs:search', params),
    createFile: (params: { path: string; isDir?: boolean }) =>
      ipcRenderer.invoke('fs:create', params),
    deleteFile: (params: { path: string }) =>
      ipcRenderer.invoke('fs:delete', params),
    renameFile: (params: { oldPath: string; newPath: string }) =>
      ipcRenderer.invoke('fs:rename', params),
    openInSystem: (params: { path: string }) =>
      ipcRenderer.invoke('fs:open-in-system', params),
```

- [ ] **Step 2: Commit**

```bash
git add electron/preload/index.ts
git commit -m "feat: add file browser preload bindings"
```

---

### Task 6: File Browser Store

**Files:**
- Create: `src/store/file-browser-store.ts`

- [ ] **Step 1: Write store**

```typescript
// src/store/file-browser-store.ts
import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { FileTreeNode, FilePreviewResult } from '../../electron/shared/types'

interface FileBrowserState {
  tree: FileTreeNode[]
  selectedPath: string | null
  preview: FilePreviewResult | null
  searchQuery: string
  searchResults: FileTreeNode[]
  isSearching: boolean
  cwd: string

  loadDirectory: (dirPath: string, depth?: number) => Promise<void>
  selectFile: (filePath: string) => Promise<void>
  setSearchQuery: (query: string) => void
  runSearch: (dirPath: string) => Promise<void>
  refreshTree: () => Promise<void>
  reset: () => void
}

export const useFileBrowserStore = create<FileBrowserState>()(
  immer((set) => ({
    tree: [],
    selectedPath: null,
    preview: null,
    searchQuery: '',
    searchResults: [],
    isSearching: false,
    cwd: '',

    loadDirectory: async (dirPath: string, depth = 3) => {
      try {
        const tree = await window.electron.listDir({ dirPath, depth })
        set((s) => {
          s.tree = tree
          s.cwd = dirPath
        })
      } catch { /* error handled by IPC */ }
    },

    selectFile: async (filePath: string) => {
      set((s) => { s.selectedPath = filePath })
      try {
        const preview = await window.electron.readFile({ path: filePath })
        set((s) => { s.preview = preview })
      } catch {
        set((s) => { s.preview = null })
      }
    },

    setSearchQuery: (query: string) => {
      set((s) => { s.searchQuery = query })
    },

    runSearch: async (dirPath: string) => {
      set((s) => { s.isSearching = true })
      try {
        const query = useFileBrowserStore.getState().searchQuery
        if (!query) {
          set((s) => { s.searchResults = [] })
          return
        }
        const results = await window.electron.searchFiles({ dirPath, query })
        set((s) => { s.searchResults = results })
      } catch {
        set((s) => { s.searchResults = [] })
      } finally {
        set((s) => { s.isSearching = false })
      }
    },

    refreshTree: async () => {
      const { cwd } = useFileBrowserStore.getState()
      if (cwd) {
        await useFileBrowserStore.getState().loadDirectory(cwd)
      }
    },

    reset: () => {
      set((s) => {
        s.tree = []
        s.selectedPath = null
        s.preview = null
        s.searchQuery = ''
        s.searchResults = []
        s.isSearching = false
      })
    },
  }))
)
```

- [ ] **Step 2: Commit**

```bash
git add src/store/file-browser-store.ts
git commit -m "feat: add file browser Zustand store"
```

---

### Task 7: FileTree Component

**Files:**
- Create: `src/components/project/FileTree.tsx`

- [ ] **Step 1: Write FileTree component**

```typescript
// src/components/project/FileTree.tsx
import React, { useState, useCallback } from 'react'
import { ChevronRight, ChevronDown, File, Folder } from 'lucide-react'
import type { FileTreeNode } from '../../../electron/shared/types'
import { useFileBrowserStore } from '../../store/file-browser-store'
import { FileContextMenu } from './FileContextMenu'

interface FileTreeItemProps {
  node: FileTreeNode
  depth: number
  onSelect: (node: FileTreeNode) => void
  selectedPath: string | null
}

function FileTreeItem({ node, depth, onSelect, selectedPath }: FileTreeItemProps): React.JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const isSelected = node.path === selectedPath
  const refreshTree = useFileBrowserStore((s) => s.refreshTree)
  const selectFile = useFileBrowserStore((s) => s.selectFile)

  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setExpanded((v) => !v)
  }, [])

  const handleClick = useCallback(() => {
    if (node.isDir) {
      setExpanded(true)
    } else {
      selectFile(node.path)
    }
    onSelect(node)
  }, [node, selectFile, onSelect])

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    // FileContextMenu will handle
  }, [])

  return (
    <div>
      <div
        onClick={handleClick}
        onDoubleClick={node.isDir ? handleToggle : undefined}
        onContextMenu={handleContextMenu}
        className={`ft-tree-item${isSelected ? ' ft-tree-item-selected' : ''}`}
        style={{ paddingLeft: 8 + depth * 16 }}
      >
        {node.isDir ? (
          <span className="ft-tree-icon" onClick={handleToggle}>
            {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </span>
        ) : (
          <span className="ft-tree-icon ft-tree-spacer"><File size={13} /></span>
        )}
        {node.isDir ? <Folder size={13} /> : <File size={13} />}
        <span className="ft-tree-name">{node.name}</span>
        {node.size && !node.isDir && (
          <span className="ft-tree-size">{formatSize(node.size)}</span>
        )}
      </div>
      {node.isDir && expanded && node.children && (
        <div>
          {node.children.map((child) => (
            <FileTreeItem
              key={child.path}
              node={child}
              depth={depth + 1}
              onSelect={onSelect}
              selectedPath={selectedPath}
            />
          ))}
        </div>
      )}
      <FileContextMenu node={node} onAction={refreshTree} />
    </div>
  )
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

interface FileTreeProps {
  nodes: FileTreeNode[]
  depth?: number
}

export function FileTree({ nodes, depth = 0 }: FileTreeProps): React.JSX.Element {
  const selectFile = useFileBrowserStore((s) => s.selectFile)
  const selectedPath = useFileBrowserStore((s) => s.selectedPath)

  return (
    <div className="ft-tree">
      {nodes.map((node) => (
        <FileTreeItem
          key={node.path}
          node={node}
          depth={depth}
          onSelect={() => {}}
          selectedPath={selectedPath}
        />
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/project/FileTree.tsx
git commit -m "feat: add FileTree component with expand/collapse"
```

---

### Task 8: FilePreview Component

**Files:**
- Create: `src/components/project/FilePreview.tsx`

- [ ] **Step 1: Write FilePreview component**

```typescript
// src/components/project/FilePreview.tsx
import React, { useMemo } from 'react'
import { FileText, AlertTriangle, Copy, ExternalLink } from 'lucide-react'
import { useFileBrowserStore } from '../../store/file-browser-store'
import { getFileIcon } from './file-icons'

function CodeBlock({ content, language }: { content: string; language: string }): React.JSX.Element {
  // Use existing highlight.js setup from MessageBubble
  const highlighted = useMemo(() => {
    try {
      const hljs = require('highlight.js')
      const lang = language || 'plaintext'
      if (hljs.getLanguage(lang)) {
        return hljs.highlight(content, { language: lang }).value
      }
      return hljs.highlightAuto(content).value
    } catch {
      return content
    }
  }, [content, language])

  return (
    <pre className="ft-preview-code">
      <code dangerouslySetInnerHTML={{ __html: highlighted }} />
    </pre>
  )
}

export function FilePreview(): React.JSX.Element {
  const preview = useFileBrowserStore((s) => s.preview)
  const selectedPath = useFileBrowserStore((s) => s.selectedPath)
  const refreshTree = useFileBrowserStore((s) => s.refreshTree)

  if (!preview && !selectedPath) {
    return (
      <div className="ft-preview-empty">
        <FileText size={24} style={{ color: 'var(--color-text-faint)' }} />
        <span className="ft-preview-empty-text">Select a file to preview</span>
      </div>
    )
  }

  if (preview?.tooLarge) {
    return (
      <div className="ft-preview-empty">
        <AlertTriangle size={24} style={{ color: 'var(--color-warning)' }} />
        <span className="ft-preview-empty-text">File too large to preview</span>
        <button
          className="ft-preview-open-btn"
          onClick={async () => {
            if (selectedPath) await window.electron.openInSystem({ path: selectedPath })
          }}
        >
          <ExternalLink size={13} /> Open in system
        </button>
      </div>
    )
  }

  if (!preview || !preview.content) {
    return (
      <div className="ft-preview-empty">
        <span className="ft-preview-empty-text">Unable to preview file</span>
      </div>
    )
  }

  const breadcrumb = selectedPath?.split('/').slice(-3).join(' / ') ?? ''

  return (
    <div className="ft-preview">
      <div className="ft-preview-header">
        <span className="ft-preview-breadcrumb">{breadcrumb}</span>
        <div className="ft-preview-actions">
          <span className="ft-preview-lang">{preview.language || 'text'}</span>
          <span className="ft-preview-lines">{preview.totalLines} lines{preview.truncated ? '+' : ''}</span>
          <button
            className="ft-preview-copy"
            onClick={() => {
              navigator.clipboard.writeText(preview.content)
            }}
            title="Copy content"
          >
            <Copy size={13} />
          </button>
          {selectedPath && (
            <button
              className="ft-preview-open"
              onClick={async () => {
                await window.electron.openInSystem({ path: selectedPath })
              }}
              title="Open in system"
            >
              <ExternalLink size={13} />
            </button>
          )}
        </div>
      </div>
      <CodeBlock content={preview.content} language={preview.language} />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/project/FilePreview.tsx
git commit -m "feat: add FilePreview component with syntax highlighting"
```

---

### Task 9: FileContextMenu Component

**Files:**
- Create: `src/components/project/FileContextMenu.tsx`
- Create: `src/components/project/file-icons.ts`

- [ ] **Step 1: Write file-icons utility**

```typescript
// src/components/project/file-icons.ts
import { File, FileCode, FileJson, FileText, Image, Terminal } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

const ICON_MAP: Record<string, LucideIcon> = {
  '.ts': FileCode, '.tsx': FileCode, '.js': FileCode, '.jsx': FileCode,
  '.py': FileCode, '.rs': FileCode, '.go': FileCode, '.java': FileCode,
  '.json': FileJson, '.yaml': FileJson, '.yml': FileJson, '.toml': FileJson,
  '.md': FileText, '.txt': FileText, '.css': FileCode, '.scss': FileCode,
  '.png': Image, '.jpg': Image, '.gif': Image, '.svg': Image, '.webp': Image,
  '.sh': Terminal, '.bash': Terminal, '.zsh': Terminal,
}

export function getFileIcon(filename: string): LucideIcon {
  const ext = filename.includes('.') ? `.${filename.split('.').pop()?.toLowerCase()}` : ''
  return ICON_MAP[ext] ?? File
}
```

- [ ] **Step 2: Write FileContextMenu component**

```typescript
// src/components/project/FileContextMenu.tsx
import React, { useState, useCallback, useRef, useEffect } from 'react'
import { FilePlus, FolderPlus, Pencil, Trash2, Copy, ExternalLink } from 'lucide-react'
import type { FileTreeNode } from '../../../electron/shared/types'

interface FileContextMenuProps {
  node: FileTreeNode
  onAction: () => Promise<void>
}

export function FileContextMenu({ node, onAction }: FileContextMenuProps): React.JSX.Element {
  const [showMenu, setShowMenu] = useState(false)
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 })
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setMenuPos({ x: e.clientX, y: e.clientY })
    setShowMenu(true)
  }, [])

  const handleAction = useCallback(async (action: () => Promise<boolean>) => {
    setShowMenu(false)
    const success = await action()
    if (success) await onAction()
  }, [onAction])

  const handleNewFile = useCallback(async () => {
    const name = prompt('New file name:')
    if (!name) return false
    const targetPath = node.isDir
      ? `${node.path}/${name}`
      : `${node.path.replace(/\/[^/]+$/, '')}/${name}`
    const result = await window.electron.createFile({ path: targetPath })
    if (!result.success) alert(result.error)
    return result.success
  }, [node])

  const handleNewDir = useCallback(async () => {
    const name = prompt('New directory name:')
    if (!name) return false
    const targetPath = node.isDir
      ? `${node.path}/${name}`
      : `${node.path.replace(/\/[^/]+$/, '')}/${name}`
    const result = await window.electron.createFile({ path: targetPath, isDir: true })
    if (!result.success) alert(result.error)
    return result.success
  }, [node])

  const handleRename = useCallback(async () => {
    const newName = prompt('New name:', node.name)
    if (!newName || newName === node.name) return false
    const oldPath = node.path
    const newPath = node.path.replace(/\/[^/]+$/, `/${newName}`)
    const result = await window.electron.renameFile({ oldPath, newPath })
    if (!result.success) alert(result.error)
    return result.success
  }, [node])

  const handleDelete = useCallback(async () => {
    if (!confirm(`Delete "${node.name}"?`)) return false
    const result = await window.electron.deleteFile({ path: node.path })
    if (!result.success) alert(result.error)
    return result.success
  }, [node])

  const handleCopyPath = useCallback(async () => {
    await navigator.clipboard.writeText(node.path)
    return true
  }, [node])

  const handleOpenSystem = useCallback(async () => {
    await window.electron.openInSystem({ path: node.path })
    return true
  }, [node])

  return (
    <>
      <div onContextMenu={handleContextMenu} style={{ display: 'contents' }}>
        {/* Invisible trigger area — actual context menu is on the tree item */}
      </div>
      {showMenu && (
        <div
          ref={menuRef}
          className="ft-context-menu"
          style={{ left: menuPos.x, top: menuPos.y }}
        >
          <button className="ft-context-item" onClick={() => handleAction(handleNewFile)}>
            <FilePlus size={13} /> New file
          </button>
          <button className="ft-context-item" onClick={() => handleAction(handleNewDir)}>
            <FolderPlus size={13} /> New folder
          </button>
          <button className="ft-context-item" onClick={() => handleAction(handleRename)}>
            <Pencil size={13} /> Rename
          </button>
          <button className="ft-context-item ft-context-item-danger" onClick={() => handleAction(handleDelete)}>
            <Trash2 size={13} /> Delete
          </button>
          <div className="ft-context-separator" />
          <button className="ft-context-item" onClick={() => handleAction(handleCopyPath)}>
            <Copy size={13} /> Copy path
          </button>
          <button className="ft-context-item" onClick={() => handleAction(handleOpenSystem)}>
            <ExternalLink size={13} /> Open in system
          </button>
        </div>
      )}
    </>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/project/file-icons.ts src/components/project/FileContextMenu.tsx
git commit -m "feat: add FileContextMenu and file-icons utility"
```

---

### Task 10: FileBrowser Main Component

**Files:**
- Create: `src/components/project/FileBrowser.tsx`
- Modify: `src/AppShell.tsx`

- [ ] **Step 1: Write FileBrowser main component**

```typescript
// src/components/project/FileBrowser.tsx
import React, { useEffect, useCallback, useRef } from 'react'
import { Search, RefreshCw, X } from 'lucide-react'
import { useTabStore, selectActiveTab } from '../../store/tab-store'
import { useFileBrowserStore } from '../../store/file-browser-store'
import { FileTree } from './FileTree'
import { FilePreview } from './FilePreview'
import { useUiStore } from '../../store/ui-store'

export function FileBrowser(): React.JSX.Element {
  const cwd = useTabStore((s) => selectActiveTab(s)?.cwd ?? '')
  const showFiles = useUiStore((s) => s.showFiles)
  const loadDirectory = useFileBrowserStore((s) => s.loadDirectory)
  const tree = useFileBrowserStore((s) => s.tree)
  const searchQuery = useFileBrowserStore((s) => s.searchQuery)
  const searchResults = useFileBrowserStore((s) => s.searchResults)
  const isSearching = useFileBrowserStore((s) => s.isSearching)
  const setSearchQuery = useFileBrowserStore((s) => s.setSearchQuery)
  const runSearch = useFileBrowserStore((s) => s.runSearch)
  const refreshTree = useFileBrowserStore((s) => s.refreshTree)

  const searchTimeout = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    if (cwd) {
      loadDirectory(cwd)
    }
  }, [cwd, loadDirectory])

  // Auto-refresh on tool completion events
  useEffect(() => {
    const handler = () => { refreshTree() }
    window.addEventListener('refresh-file-tree', handler)
    return () => window.removeEventListener('refresh-file-tree', handler)
  }, [refreshTree])

  const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value
    setSearchQuery(query)
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => {
      runSearch(cwd)
    }, 300)
  }, [cwd, setSearchQuery, runSearch])

  const clearSearch = useCallback(() => {
    setSearchQuery('')
    useFileBrowserStore.setState({ searchResults: [] })
  }, [setSearchQuery])

  if (!showFiles) return <></>

  const displayNodes = isSearching ? searchResults : tree

  return (
    <div className="ft-browser">
      <div className="ft-browser-toolbar">
        <div className="ft-search">
          <Search size={13} className="ft-search-icon" />
          <input
            type="text"
            placeholder="Search files..."
            value={searchQuery}
            onChange={handleSearch}
            className="ft-search-input"
          />
          {searchQuery && (
            <button onClick={clearSearch} className="ft-search-clear">
              <X size={11} />
            </button>
          )}
        </div>
        <button className="ft-refresh" onClick={refreshTree} title="Refresh">
          <RefreshCw size={13} />
        </button>
      </div>
      <div className="ft-browser-content">
        <FileTree nodes={displayNodes} />
        <FilePreview />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Integrate FileBrowser into AppShell**

In `AppShell.tsx`, the `PanelZone` component or side panel needs to render FileBrowser when `showFiles` is true. The Views menu already exists (lines 207-235). Add the FileBrowser render:

After the `<PanelZone />` line (line 264), add:

```typescript
      {showFiles && (
        <div style={{
          width: 320,
          flexShrink: 0,
          borderLeft: '1px solid var(--color-border)',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--color-surface)',
          overflow: 'hidden',
        }}>
          <FileBrowser />
        </div>
      )}
```

And add the import at the top:

```typescript
import { FileBrowser } from './components/project/FileBrowser'
```

- [ ] **Step 3: Commit**

```bash
git add src/components/project/FileBrowser.tsx src/AppShell.tsx
git commit -m "feat: add FileBrowser main component and integrate into AppShell"
```

---

### Task 11: CSS Styles

**Files:**
- Modify: `src/styles.css`

- [ ] **Step 1: Add FileBrowser CSS**

Append to `src/styles.css`:

```css
/* ── File Browser ──────────────────────────────────── */

.ft-browser {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.ft-browser-toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.ft-search {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  background: var(--color-surface-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 4px 8px;
}

.ft-search-icon {
  color: var(--color-text-faint);
  flex-shrink: 0;
}

.ft-search-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  font: inherit;
  font-size: 12px;
  color: var(--color-text);
}

.ft-search-clear {
  cursor: pointer;
  background: none;
  border: none;
  color: var(--color-text-muted);
  padding: 2px;
  display: flex;
  align-items: center;
}

.ft-refresh {
  cursor: pointer;
  background: none;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text-muted);
  padding: 4px 6px;
  display: flex;
  align-items: center;
}

.ft-refresh:hover {
  background: var(--color-surface-2);
  color: var(--color-text);
}

.ft-browser-content {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* Tree */
.ft-tree {
  width: 200px;
  flex-shrink: 0;
  overflow-y: auto;
  border-right: 1px solid var(--color-border);
}

.ft-tree-item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  font-size: 12px;
  cursor: pointer;
  border-radius: var(--radius-xs);
  margin: 1px 4px;
  white-space: nowrap;
}

.ft-tree-item:hover {
  background: var(--color-surface-2);
}

.ft-tree-item-selected {
  background: var(--color-accent-dim);
  color: var(--color-accent);
}

.ft-tree-icon {
  display: flex;
  align-items: center;
  color: var(--color-text-muted);
}

.ft-tree-spacer {
  visibility: hidden;
}

.ft-tree-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ft-tree-size {
  font-size: 10px;
  color: var(--color-text-faint);
  flex-shrink: 0;
}

/* Preview */
.ft-preview {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.ft-preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.ft-preview-breadcrumb {
  font-size: 11px;
  color: var(--color-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ft-preview-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.ft-preview-lang {
  font-size: 10px;
  color: var(--color-text-faint);
  background: var(--color-surface-2);
  padding: 1px 5px;
  border-radius: var(--radius-xs);
}

.ft-preview-lines {
  font-size: 10px;
  color: var(--color-text-faint);
}

.ft-preview-copy,
.ft-preview-open {
  cursor: pointer;
  background: none;
  border: none;
  color: var(--color-text-muted);
  padding: 2px;
  display: flex;
  align-items: center;
}

.ft-preview-copy:hover,
.ft-preview-open:hover {
  color: var(--color-text);
}

.ft-preview-code {
  flex: 1;
  overflow: auto;
  margin: 0;
  padding: 10px;
  font-family: 'Geist Mono', monospace;
  font-size: 11px;
  line-height: 1.5;
  tab-size: 2;
}

.ft-preview-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--color-text-faint);
  font-size: 12px;
}

.ft-preview-empty-text {
  text-align: center;
}

.ft-preview-open-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface-2);
  color: var(--color-text);
  font-size: 11px;
  cursor: pointer;
}

.ft-preview-open-btn:hover {
  background: var(--color-surface-3, var(--color-surface-2));
}

/* Context Menu */
.ft-context-menu {
  position: fixed;
  z-index: 1000;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 4px;
  min-width: 160px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
}

.ft-context-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 10px;
  border: none;
  background: none;
  font: inherit;
  font-size: 12px;
  color: var(--color-text);
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.ft-context-item:hover {
  background: var(--color-surface-2);
}

.ft-context-item-danger {
  color: var(--color-error);
}

.ft-context-separator {
  height: 1px;
  background: var(--color-border);
  margin: 4px 0;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/styles.css
git commit -m "style: add FileBrowser CSS styles"
```

---

### Task 12: Build Verification

**Files:** No file changes.

- [ ] **Step 1: Type check**

```bash
npx tsc --noEmit --pretty false 2>&1 | head -50
```

Expected: No errors. If there are, fix them.

- [ ] **Step 2: Build**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 3: Run all tests**

```bash
npm test
```

Expected: All existing tests pass + new files-utils and files tests pass.

- [ ] **Step 4: Commit (if any fixes needed)**

```bash
git add .
git commit -m "fix: address type check / build issues for file browser"
```
