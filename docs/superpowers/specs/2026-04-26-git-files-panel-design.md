# Git Panel + Files Panel 设计文档

**日期**: 2026-04-26
**状态**: Draft
**范围**: Phase 1 - Chat UI 增强

---

## 1. 概述

为 HappyCode 添加 Git Panel 和 Files Panel，复刻 CodePilot 的核心功能，适配 Electron 架构。

### 1.1 功能范围

**Git Panel:**
- Status: 变更文件列表 + Commit
- Branch: 分支选择/创建/切换
- History: 提交历史查看
- Worktree: Worktree 管理

**Files Panel:**
- 文件树浏览（可折叠、搜索过滤）
- 右键菜单（新建/重命名/删除文件和文件夹）
- 文件预览（代码高亮、Markdown 渲染、图片查看）

---

## 2. 架构

### 2.1 整体布局

```
┌─────────────────────────────────────────────────────────────┐
│                        AppShell                              │
├──────────┬──────────────────────────────┬──────────────────┤
│ Sidebar  │      Main Content            │    PanelZone     │
│          │                              │                  │
│ - 项目   │  ┌────────────────────────┐  │  ┌────────────┐  │
│ - 会话   │  │      ChatPanel         │  │  │ GitPanel   │  │
│ - 搜索   │  │                        │  │  │ (可选)     │  │
│          │  └────────────────────────┘  │  ├────────────┤  │
│          │                              │  │ FilesPanel │  │
│          │                              │  │ (可选)     │  │
│          │                              │  ├────────────┤  │
│          │                              │  │ Preview    │  │
│          │                              │  │ (文件预览) │  │
└──────────┴──────────────────────────────┴──┴────────────┴──┘
```

### 2.2 文件结构

```
src/
├── components/
│   ├── git/
│   │   ├── GitPanel.tsx          # Git 主面板
│   │   ├── GitStatusSection.tsx  # 变更文件列表
│   │   ├── GitBranchSection.tsx  # 分支选择/创建
│   │   ├── GitHistorySection.tsx # 提交历史
│   │   ├── GitWorktreeSection.tsx # Worktree 管理
│   │   ├── CommitDialog.tsx      # Commit 弹窗
│   │   └── CollapsibleSection.tsx # 可折叠 Section 组件
│   ├── files/
│   │   ├── FilesPanel.tsx        # 文件面板
│   │   ├── FileTree.tsx          # 文件树组件
│   │   ├── FileContextMenu.tsx   # 右键菜单
│   │   └── PreviewPanel.tsx      # 预览面板
│   └── nav/
│       └── PanelZone.tsx         # 修改：添加 Git/Files 面板渲染
├── hooks/
│   ├── useGitStatus.ts           # Git 状态 hook
│   ├── useGitBranches.ts         # 分支列表 hook
│   ├── useGitLog.ts              # 提交历史 hook
│   ├── useGitWorktrees.ts        # Worktree hook
│   └── useFileTree.ts            # 文件树 hook
├── store/
│   └── ui-store.ts               # 修改：添加预览状态

electron/
├── main/
│   ├── git-manager.ts            # Git 操作封装
│   ├── file-manager.ts           # 文件操作封装
│   └── ipc-handlers.ts           # 修改：添加 IPC handlers
├── preload/
│   └── index.ts                  # 修改：暴露新 API
└── shared/
    └── types.ts                  # 修改：添加类型定义
```

---

## 3. 数据类型

### 3.1 Git 类型

```typescript
// electron/shared/types.ts

export interface GitStatus {
  isRepo: boolean
  branch: string
  ahead: number
  behind: number
  changedFiles: GitChangedFile[]
  untrackedFiles: string[]
  dirty: boolean
}

export interface GitChangedFile {
  path: string
  status: 'modified' | 'added' | 'deleted' | 'renamed'
  oldPath?: string  // for renamed files
}

export interface GitBranch {
  name: string
  isCurrent: boolean
  isRemote: boolean
  upstream?: string
  ahead: number
  behind: number
}

export interface GitCommit {
  sha: string
  shortSha: string
  message: string
  author: string
  date: string
  relativeDate: string
}

export interface GitWorktree {
  path: string
  branch: string
  isCurrent: boolean
  isMain: boolean
}
```

### 3.2 Files 类型

```typescript
// electron/shared/types.ts

export interface FileTreeNode {
  name: string
  path: string           // 绝对路径
  type: 'file' | 'directory'
  extension?: string     // 文件扩展名
  children?: FileTreeNode[]
  size?: number          // 文件大小 (bytes)
  modifiedAt?: number    // 修改时间戳
}

export interface FileTreeOptions {
  depth?: number         // 递归深度，默认 4
  ignore?: string[]      // 忽略模式，如 ['node_modules', '.git']
  includeHidden?: boolean // 是否包含隐藏文件
}

export interface FileOperationResult {
  success: boolean
  error?: string
  newPath?: string       // 重命名后的新路径
}
```

---

## 4. Git Panel 设计

### 4.1 组件结构

```tsx
<GitPanel>
  <CollapsibleSection title="STATUS">
    <GitStatusSection />
  </CollapsibleSection>

  <CollapsibleSection title="BRANCH">
    <GitBranchSection />
  </CollapsibleSection>

  <CollapsibleSection title="HISTORY">
    <GitHistorySection />
  </CollapsibleSection>

  <CollapsibleSection title="WORKTREE">
    <GitWorktreeSection />
  </CollapsibleSection>

  {/* 弹窗 */}
  <CommitDialog />
  <CreateBranchDialog />
  <CreateWorktreeDialog />
</GitPanel>
```

### 4.2 GitStatusSection

```
┌─────────────────────────────┐
│ STATUS                 [↻]  │
├─────────────────────────────┤
│ Changed (3)                 │
│  M  src/App.tsx            │
│  M  src/store/ui-store.ts   │
│  A  src/components/New.tsx  │
│                             │
│ Untracked (2)               │
│  ?  temp.txt               │
│  ?  notes.md               │
├─────────────────────────────┤
│         [Commit Changes]    │
└─────────────────────────────┘
```

- 点击文件 → 打开预览面板
- `[↻]` 刷新状态
- `[Commit Changes]` 打开 Commit 弹窗

### 4.3 GitBranchSection

```
┌─────────────────────────────┐
│ BRANCH                      │
├─────────────────────────────┤
│ [main ▼]          [+ New]  │
│                             │
│ Local branches:             │
│   ● main (current)          │
│   ○ feature/auth            │
│   ○ fix/login               │
│                             │
│ Remote branches:            │
│   origin/main               │
│   origin/develop            │
└─────────────────────────────┘
```

- 下拉选择切换分支
- `[+ New]` 创建新分支

### 4.4 GitHistorySection

```
┌─────────────────────────────┐
│ HISTORY                     │
├─────────────────────────────┤
│ □ abc1234 fix: login bug    │
│    2 hours ago              │
│                             │
│ □ def5678 feat: add auth    │
│    yesterday                │
│                             │
│ □ ghi9012 refactor: clean   │
│    3 days ago               │
│                             │
│         [Load More]         │
└─────────────────────────────┘
```

- 点击 commit → 查看详情（弹窗或展开）
- `[Load More]` 加载更多历史

### 4.5 GitWorktreeSection

```
┌─────────────────────────────┐
│ WORKTREE                    │
├─────────────────────────────┤
│ main                        │
│   ~/projects/app-main       │
│   [Open] [Delete]           │
│                             │
│ feature/auth                │
│   ~/projects/app-auth       │
│   [Open] [Delete]           │
│                             │
│       [+ New Worktree]      │
└─────────────────────────────┘
```

- `[Open]` 在新窗口打开 worktree
- `[Delete]` 删除 worktree
- `[+ New Worktree]` 创建新 worktree

---

## 5. Files Panel 设计

### 5.1 组件结构

```tsx
<FilesPanel>
  <div className="search-bar">
    <input placeholder="Filter files..." />
    <button onClick={refresh}>↻</button>
  </div>

  <FileTree
    nodes={tree}
    onSelect={handleFileSelect}
    onContextMenu={handleContextMenu}
  />

  {contextMenu && (
    <FileContextMenu
      x={contextMenu.x}
      y={contextMenu.y}
      path={contextMenu.path}
      type={contextMenu.type}
      onClose={closeContextMenu}
    />
  )}
</FilesPanel>
```

### 5.2 文件树展示

```
┌─────────────────────────────┐
│ FILES            [↻] [⋮]   │
├─────────────────────────────┤
│ 🔍 Filter files...          │
├─────────────────────────────┤
│ ▼ 📁 src                    │
│   ▼ 📁 components           │
│     ▶ 📁 git               │
│     ▶ 📁 files             │
│       📄 GitPanel.tsx      │
│       📄 FilesPanel.tsx    │
│   ▼ 📁 store               │
│     📄 ui-store.ts         │
│   📄 App.tsx               │
│ ▶ 📁 electron              │
│ 📄 package.json            │
└─────────────────────────────┘
```

- 单击文件 → 打开预览
- 右键 → 显示上下文菜单
- 搜索 → 过滤文件树

### 5.3 右键菜单

**文件右键菜单：**
```
┌─────────────────────┐
│ Open in Preview     │
│─────────────────────│
│ Rename              │
│ Delete              │
│─────────────────────│
│ Copy Path           │
│ Copy Relative Path  │
└─────────────────────┘
```

**文件夹右键菜单：**
```
┌─────────────────────┐
│ New File            │
│ New Folder          │
│─────────────────────│
│ Rename              │
│ Delete              │
│─────────────────────│
│ Copy Path           │
│ Copy Relative Path  │
└─────────────────────┘
```

**空白区域右键：**
```
┌─────────────────────┐
│ New File            │
│ New Folder          │
│─────────────────────│
│ Refresh             │
└─────────────────────┘
```

### 5.4 Preview Panel

```
┌─────────────────────────────────────┐
│ src/components/git/GitPanel.tsx  ✕ │
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │  1 │ "use client";              │ │
│ │  2 │                            │ │
│ │  3 │ import { useState } ...    │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ├─────────────────────────────────┤ │
│ │ [Source] [Rendered]             │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

**预览类型支持：**

| 文件类型 | 预览方式 |
|---------|---------|
| `.ts/.tsx/.js/.jsx/.py/.go/.rs` 等 | Monaco Editor (语法高亮) |
| `.md/.mdx` | Source / Rendered 切换 |
| `.json/.yaml/.toml` | Monaco Editor |
| `.css/.scss/.less` | Monaco Editor |
| `.png/.jpg/.gif/.svg` | 图片查看器 |

---

## 6. IPC 设计

### 6.1 IPC Channels

| Channel | 描述 | 参数 |
|---------|------|------|
| `git:status` | 获取 git status | `cwd: string` |
| `git:branches` | 分支列表 | `cwd: string` |
| `git:checkout` | 切换分支 | `cwd: string, branch: string` |
| `git:createBranch` | 创建分支 | `cwd: string, name: string, base?: string` |
| `git:commit` | 提交 | `cwd: string, message: string, files?: string[]` |
| `git:log` | 提交历史 | `cwd: string, limit: number, skip: number` |
| `git:worktrees` | worktree 列表 | `cwd: string` |
| `git:addWorktree` | 创建 worktree | `cwd: string, branch: string, path: string` |
| `git:removeWorktree` | 删除 worktree | `cwd: string, path: string` |
| `files:tree` | 获取文件树 | `cwd: string, options?: FileTreeOptions` |
| `files:read` | 读取文件内容 | `path: string` |
| `files:create` | 创建文件 | `path: string, content?: string` |
| `files:createFolder` | 创建文件夹 | `path: string` |
| `files:delete` | 删除文件/文件夹 | `path: string` |
| `files:rename` | 重命名 | `oldPath: string, newName: string` |

### 6.2 主进程模块

**git-manager.ts:**
```typescript
import simpleGit from 'simple-git'

export const gitManager = {
  async getStatus(cwd: string): Promise<GitStatus>
  async getBranches(cwd: string): Promise<GitBranch[]>
  async checkout(cwd: string, branch: string): Promise<void>
  async createBranch(cwd: string, name: string, base?: string): Promise<void>
  async commit(cwd: string, message: string, files?: string[]): Promise<string>
  async getLog(cwd: string, limit: number, skip: number): Promise<GitCommit[]>
  async getWorktrees(cwd: string): Promise<GitWorktree[]>
  async addWorktree(cwd: string, branch: string, path: string): Promise<void>
  async removeWorktree(cwd: string, path: string): Promise<void>
}
```

**file-manager.ts:**
```typescript
import fs from 'fs/promises'
import path from 'path'

export const fileManager = {
  async getTree(cwd: string, options: FileTreeOptions): Promise<FileTreeNode[]>
  async readFile(path: string): Promise<string>
  async writeFile(path: string, content: string): Promise<void>
  async createFile(path: string, content?: string): Promise<void>
  async createFolder(path: string): Promise<void>
  async delete(path: string): Promise<void>
  async rename(oldPath: string, newName: string): Promise<string>
  async exists(path: string): Promise<boolean>
  async getStats(path: string): Promise<{ size: number; modifiedAt: number }>
}
```

### 6.3 Preload API

```typescript
contextBridge.exposeInMainWorld('electron', {
  // ... 现有 API ...

  // Git
  gitStatus: (cwd: string) => ipcRenderer.invoke('git:status', cwd),
  gitBranches: (cwd: string) => ipcRenderer.invoke('git:branches', cwd),
  gitCheckout: (cwd: string, branch: string) =>
    ipcRenderer.invoke('git:checkout', cwd, branch),
  gitCreateBranch: (cwd: string, name: string, base?: string) =>
    ipcRenderer.invoke('git:createBranch', cwd, name, base),
  gitCommit: (cwd: string, message: string, files?: string[]) =>
    ipcRenderer.invoke('git:commit', cwd, message, files),
  gitLog: (cwd: string, limit: number, skip: number) =>
    ipcRenderer.invoke('git:log', cwd, limit, skip),
  gitWorktrees: (cwd: string) => ipcRenderer.invoke('git:worktrees', cwd),
  gitAddWorktree: (cwd: string, branch: string, path: string) =>
    ipcRenderer.invoke('git:addWorktree', cwd, branch, path),
  gitRemoveWorktree: (cwd: string, path: string) =>
    ipcRenderer.invoke('git:removeWorktree', cwd, path),

  // Files
  fileTree: (cwd: string, options?: FileTreeOptions) =>
    ipcRenderer.invoke('files:tree', cwd, options),
  fileRead: (path: string) => ipcRenderer.invoke('files:read', path),
  fileCreate: (path: string, content?: string) =>
    ipcRenderer.invoke('files:create', path, content),
  folderCreate: (path: string) => ipcRenderer.invoke('files:createFolder', path),
  fileDelete: (path: string) => ipcRenderer.invoke('files:delete', path),
  fileRename: (oldPath: string, newName: string) =>
    ipcRenderer.invoke('files:rename', oldPath, newName),
})
```

---

## 7. Hooks API

### 7.1 Git Hooks

```typescript
// useGitStatus.ts
function useGitStatus(cwd: string | null): {
  status: GitStatus | null
  loading: boolean
  error: string | null
  refresh: () => void
}

// useGitBranches.ts
function useGitBranches(cwd: string | null): {
  branches: GitBranch[]
  loading: boolean
  checkout: (branch: string) => Promise<void>
  createBranch: (name: string, base?: string) => Promise<void>
}

// useGitLog.ts
function useGitLog(cwd: string | null, limit?: number): {
  commits: GitCommit[]
  loading: boolean
  loadMore: () => void
}

// useGitWorktrees.ts
function useGitWorktrees(cwd: string | null): {
  worktrees: GitWorktree[]
  loading: boolean
  create: (branch: string, path: string) => Promise<void>
  remove: (path: string) => Promise<void>
}
```

### 7.2 Files Hooks

```typescript
// useFileTree.ts
function useFileTree(cwd: string | null, options?: FileTreeOptions): {
  tree: FileTreeNode[]
  loading: boolean
  error: string | null
  refresh: () => void
}

// useFileOperations.ts
function useFileOperations(): {
  createFile: (path: string, content?: string) => Promise<FileOperationResult>
  createFolder: (path: string) => Promise<FileOperationResult>
  deleteFile: (path: string) => Promise<FileOperationResult>
  deleteFolder: (path: string) => Promise<FileOperationResult>
  rename: (oldPath: string, newName: string) => Promise<FileOperationResult>
  readFile: (path: string) => Promise<string>
}
```

---

## 8. Store 扩展

```typescript
// src/store/ui-store.ts

interface UiState {
  // ... 现有状态 ...

  // 预览面板
  previewFile: string | null
  previewMode: 'source' | 'rendered'

  // Actions
  setPreviewFile: (path: string | null) => void
  setPreviewMode: (mode: 'source' | 'rendered') => void
}
```

---

## 9. 依赖

```json
{
  "dependencies": {
    "simple-git": "^3.x",
    "marked": "^12.x"
  }
}
```

---

## 10. 实现顺序

1. **Phase 1: 基础设施**
   - 添加依赖 (simple-git, marked)
   - 定义类型 (electron/shared/types.ts)
   - 实现 git-manager.ts
   - 实现 file-manager.ts
   - 注册 IPC handlers
   - 扩展 preload API

2. **Phase 2: Files Panel**
   - 实现 useFileTree hook
   - 实现 FilesPanel 组件
   - 实现 FileTree 组件
   - 实现 FileContextMenu 组件
   - 实现 PreviewPanel 组件
   - 修改 PanelZone 渲染逻辑

3. **Phase 3: Git Panel**
   - 实现 Git hooks
   - 实现 GitPanel 组件
   - 实现 GitStatusSection
   - 实现 GitBranchSection
   - 实现 GitHistorySection
   - 实现 GitWorktreeSection
   - 实现各 Dialog 组件

4. **Phase 4: 集成与测试**
   - 修改 PanelZone 整合所有面板
   - 添加键盘快捷键
   - E2E 测试

---

## 11. 注意事项

1. **性能**: 文件树使用 `depth=4` 限制递归深度，大目录按需加载
2. **错误处理**: 所有 IPC 调用需 try-catch，显示友好错误提示
3. **状态同步**: Git 状态在会话切换时自动刷新
4. **安全性**: 文件操作限制在 cwd 范围内，防止路径遍历攻击
