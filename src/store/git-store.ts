// src/store/git-store.ts
import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { GitStatusResult, GitLogEntry, GitWorktree, GitBranch } from '../../electron/shared/types'

interface GitState {
  status: GitStatusResult | null
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
      } catch (err) {
        set((s) => { s.error = String(err) })
      }
    },

    loadBranches: async (cwd: string) => {
      try {
        const branches = await window.electron.gitBranches({ cwd })
        set((s) => { s.branches = branches })
      } catch (err) {
        set((s) => { s.error = String(err) })
      }
    },

    loadWorktrees: async (cwd: string) => {
      try {
        const worktrees = await window.electron.gitWorktrees({ cwd })
        set((s) => { s.worktrees = worktrees })
      } catch (err) {
        set((s) => { s.error = String(err) })
      }
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
      set((s) => { s.loading = true })
      try {
        await Promise.all([
          get().loadStatus(cwd),
          get().loadLog(cwd),
          get().loadBranches(cwd),
          get().loadWorktrees(cwd),
        ])
      } finally {
        set((s) => { s.loading = false })
      }
    },
  }))
)
