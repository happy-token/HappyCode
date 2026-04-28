import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type {
  FileTreeNode,
  FilePreviewResult,
} from '../../electron/shared/types'

export interface FileBrowserStoreState {
  // State
  cwd: string | null
  tree: FileTreeNode[]
  selectedPath: string | null
  preview: FilePreviewResult | null
  searchQuery: string
  searchResults: string[]
  isLoading: boolean
  error: string | null

  // Navigation
  setCwd: (cwd: string) => Promise<void>
  expandNode: (path: string) => Promise<void>
  selectNode: (path: string) => Promise<void>
  refresh: () => Promise<void>

  // Search
  search: (query: string) => Promise<void>
  clearSearch: () => void

  // File operations
  createFile: (name: string) => Promise<void>
  deleteFile: (path: string) => Promise<void>
  renameFile: (oldPath: string, newPath: string) => Promise<void>

  // Error handling
  setError: (error: string | null) => void
}

// Helper: expand a node in the tree by path (immer mutable update)
function findAndExpandNode(
  nodes: FileTreeNode[],
  targetPath: string,
  children: FileTreeNode[]
): boolean {
  for (const node of nodes) {
    if (node.path === targetPath) {
      node.children = children
      return true
    }
    if (node.isDir && node.children) {
      if (findAndExpandNode(node.children, targetPath, children)) return true
    }
  }
  return false
}

// Helper: remove a node from the tree by path
function findAndRemoveNode(nodes: FileTreeNode[], targetPath: string): boolean {
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i]!.path === targetPath) {
      nodes.splice(i, 1)
      return true
    }
    if (nodes[i]!.isDir && nodes[i]!.children) {
      if (findAndRemoveNode(nodes[i]!.children!, targetPath)) return true
    }
  }
  return false
}

// Helper: rename a node in the tree
function findAndRenameNode(
  nodes: FileTreeNode[],
  oldPath: string,
  newName: string
): boolean {
  for (const node of nodes) {
    if (node.path === oldPath) {
      node.name = newName
      node.path = node.path.replace(/[^/]+$/, newName)
      // Update descendant paths when renaming a directory
      if (node.isDir && node.children) {
        for (const child of node.children) {
          child.path = child.path.replace(oldPath + '/', node.path + '/')
          if (child.isDir && child.children) updateDescendantPaths(child, oldPath, node.path)
        }
      }
      return true
    }
    if (node.isDir && node.children) {
      if (findAndRenameNode(node.children, oldPath, newName)) return true
    }
  }
  return false
}

// Helper: recursively update descendant paths after directory rename
function updateDescendantPaths(node: FileTreeNode, oldPrefix: string, newPrefix: string): void {
  for (const child of node.children ?? []) {
    child.path = child.path.replace(oldPrefix + '/', newPrefix + '/')
    if (child.isDir && child.children) updateDescendantPaths(child, oldPrefix, newPrefix)
  }
}

// Helper: build absolute path from cwd + name
function joinPath(cwd: string, name: string): string {
  return cwd.endsWith('/') ? `${cwd}${name}` : `${cwd}/${name}`
}

export const useFileBrowserStore = create<FileBrowserStoreState>()(
  immer((set, get) => ({
    cwd: null,
    tree: [],
    selectedPath: null,
    preview: null,
    searchQuery: '',
    searchResults: [],
    isLoading: false,
    error: null,

    setCwd: async (cwd: string) => {
      set((s) => {
        s.cwd = cwd
        s.tree = []
        s.selectedPath = null
        s.preview = null
        s.searchQuery = ''
        s.searchResults = []
        s.isLoading = true
        s.error = null
      })
      try {
        const tree = await window.electron.listDir({ dirPath: cwd, cwd })
        set((s) => {
          s.tree = tree
          s.isLoading = false
        })
      } catch (err: unknown) {
        set((s) => {
          s.isLoading = false
          s.error = err instanceof Error ? err.message : String(err)
        })
      }
    },

    expandNode: async (path: string) => {
      // If already expanded, collapse it
      const existing = get().tree
      const node = findNodeByPath(existing, path)
      if (node?.children) {
        set((s) => { void findAndExpandNode(s.tree, path, []) })
        return
      }

      set((s) => { s.isLoading = true })
      try {
        const children = await window.electron.listDir({ dirPath: path, cwd: get().cwd ?? '' })
        set((s) => {
          findAndExpandNode(s.tree, path, children)
          s.isLoading = false
        })
      } catch (err: unknown) {
        set((s) => {
          s.isLoading = false
          s.error = err instanceof Error ? err.message : String(err)
        })
      }
    },

    selectNode: async (path: string) => {
      set((s) => {
        s.selectedPath = path
        s.preview = null
      })

      // If it's a file, trigger preview
      const node = findNodeByPath(get().tree, path)
      if (node && !node.isDir) {
        try {
          const preview = await window.electron.readFile({ path, cwd: get().cwd ?? '' })
          set((s) => { s.preview = preview })
        } catch (err: unknown) {
          set((s) => {
            s.preview = null
            s.error = err instanceof Error ? err.message : String(err)
          })
        }
      }
    },

    refresh: async () => {
      const { cwd } = get()
      if (!cwd) return
      set((s) => { s.isLoading = true })
      try {
        const tree = await window.electron.listDir({ dirPath: cwd, cwd })
        set((s) => {
          s.tree = tree
          s.isLoading = false
        })
      } catch (err: unknown) {
        set((s) => {
          s.isLoading = false
          s.error = err instanceof Error ? err.message : String(err)
        })
      }
    },

    search: async (query: string) => {
      const { cwd } = get()
      if (!cwd || !query.trim()) {
        set((s) => { s.searchQuery = query; s.searchResults = [] })
        return
      }
      set((s) => {
        s.searchQuery = query
        s.isLoading = true
        s.error = null
      })
      try {
        const results = await window.electron.searchFiles({ dirPath: cwd, query, cwd })
        set((s) => {
          s.searchResults = results
          s.isLoading = false
        })
      } catch (err: unknown) {
        set((s) => {
          s.isLoading = false
          s.error = err instanceof Error ? err.message : String(err)
        })
      }
    },

    clearSearch: () =>
      set((s) => {
        s.searchQuery = ''
        s.searchResults = []
      }),

    createFile: async (name: string) => {
      const { cwd } = get()
      if (!cwd) return
      const filePath = joinPath(cwd, name)
      try {
        const result = await window.electron.createFile({ path: filePath, cwd })
        if (result.success) {
          void get().refresh()
        } else {
          set((s) => { s.error = result.error ?? 'Failed to create file' })
        }
      } catch (err: unknown) {
        set((s) => {
          s.error = err instanceof Error ? err.message : String(err)
        })
      }
    },

    deleteFile: async (path: string) => {
      const { cwd } = get()
      if (!cwd) return
      try {
        const result = await window.electron.deleteFile({ path, cwd })
        if (result.success) {
          set((s) => {
            findAndRemoveNode(s.tree, path)
            if (s.selectedPath === path) {
              s.selectedPath = null
              s.preview = null
            }
          })
        } else {
          set((s) => { s.error = result.error ?? 'Failed to delete file' })
        }
      } catch (err: unknown) {
        set((s) => {
          s.error = err instanceof Error ? err.message : String(err)
        })
      }
    },

    renameFile: async (oldPath: string, newPath: string) => {
      const { cwd } = get()
      if (!cwd) return
      try {
        const result = await window.electron.renameFile({ oldPath, newPath, cwd })
        if (result.success) {
          const newName = newPath.split('/').pop() ?? newPath
          set((s) => {
            findAndRenameNode(s.tree, oldPath, newName)
            if (s.selectedPath === oldPath) {
              s.selectedPath = newPath
            }
          })
        } else {
          set((s) => { s.error = result.error ?? 'Failed to rename file' })
        }
      } catch (err: unknown) {
        set((s) => {
          s.error = err instanceof Error ? err.message : String(err)
        })
      }
    },

    setError: (error: string | null) =>
      set((s) => { s.error = error }),
  }))
)

// ── Pure helper (not inside immer) ────────────────────────────

function findNodeByPath(
  nodes: FileTreeNode[],
  targetPath: string
): FileTreeNode | null {
  for (const node of nodes) {
    if (node.path === targetPath) return node
    if (node.isDir && node.children) {
      const found = findNodeByPath(node.children, targetPath)
      if (found) return found
    }
  }
  return null
}
