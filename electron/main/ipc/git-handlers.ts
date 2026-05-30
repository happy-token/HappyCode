import { ipcMain } from 'electron'
import { execSync } from 'child_process'
import type { GitStatusResult, GitStatusCode } from '../../shared/types'
import {
  isGitRepo, getStatus, getBranches, checkout, createBranch,
  getLog, commit, push, getDiff, getCommitDetail, getWorktrees, deriveWorktree,
} from '../git-service'

export function registerGitHandlers(): void {
  // Legacy git status
  ipcMain.handle('fs:git-status', (_event, { cwd }: { cwd: string }): GitStatusResult => {
    if (!cwd) return { branch: '', entries: [], error: 'no cwd' }
    try {
      const branch = execSync('git branch --show-current', { cwd, encoding: 'utf-8' }).trim()
      const porcelain = execSync('git status --porcelain=v1', { cwd, encoding: 'utf-8' })
      const entries = porcelain.split('\n').filter(Boolean).map((line) => {
        const xy = line.slice(0, 2)
        const file = line.slice(3)
        const x = xy[0] ?? ' '
        const y = xy[1] ?? ' '
        const staged = x !== ' ' && x !== '?'
        const raw = staged ? x : y
        const codeMap: Record<string, GitStatusCode> = {
          M: 'M', A: 'A', D: 'D', R: 'R', '?': '?', '!': '!'
        }
        const code: GitStatusCode = codeMap[raw] ?? 'M'
        return { code, staged, file }
      })
      return { branch, entries }
    } catch (err) {
      return { branch: '', entries: [], error: String(err) }
    }
  })

  ipcMain.handle('git:status', async (_event, { cwd }: { cwd: string }) => {
    const isRepo = await isGitRepo(cwd)
    if (!isRepo) return { branch: '', entries: [], error: 'not a git repository' }
    return getStatus(cwd)
  })

  ipcMain.handle('git:commit', async (_event, { cwd, message }: { cwd: string; message: string }) => {
    return commit(cwd, message)
  })

  ipcMain.handle('git:push', async (_event, { cwd }: { cwd: string }) => {
    return push(cwd)
  })

  ipcMain.handle('git:log', async (_event, { cwd, limit = 30 }: { cwd: string; limit?: number }) => {
    const isRepo = await isGitRepo(cwd)
    if (!isRepo) return []
    return getLog(cwd, limit)
  })

  ipcMain.handle('git:branches', async (_event, { cwd }: { cwd: string }) => {
    const isRepo = await isGitRepo(cwd)
    if (!isRepo) return []
    return getBranches(cwd)
  })

  ipcMain.handle('git:checkout', async (_event, { cwd, branch }: { cwd: string; branch: string }) => {
    return checkout(cwd, branch)
  })

  ipcMain.handle('git:diff', async (_event, { cwd, file }: { cwd: string; file?: string }) => {
    return getDiff(cwd, file)
  })

  ipcMain.handle('git:commit-detail', async (_event, { cwd, sha }: { cwd: string; sha: string }) => {
    return getCommitDetail(cwd, sha)
  })

  ipcMain.handle('git:worktrees', async (_event, { cwd }: { cwd: string }) => {
    const isRepo = await isGitRepo(cwd)
    if (!isRepo) return []
    return getWorktrees(cwd)
  })

  ipcMain.handle('git:derive-worktree', async (_event, { cwd, branch, path: targetPath }: { cwd: string; branch: string; path: string }) => {
    return deriveWorktree(cwd, branch, targetPath)
  })

  ipcMain.handle('git:create-branch', async (_event, { cwd, branch, startPoint }: { cwd: string; branch: string; startPoint?: string }) => {
    return createBranch(cwd, branch, startPoint)
  })
}
