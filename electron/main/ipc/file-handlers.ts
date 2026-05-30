import { ipcMain, shell } from 'electron'
import fs from 'fs'
import path from 'path'
import type { SessionStore } from '../session-store'
import { scanDir, previewFile, searchFiles, createFile, deleteFile, renameFile } from '../files'
import { isPathSafe } from '../files-utils'

export function registerFileHandlers(store: SessionStore): void {
  // CLAUDE.md read/write
  ipcMain.handle('file:read-claude-md', (_event, { cwd }: { cwd: string }) => {
    if (!cwd) return { content: '', exists: false }
    const filePath = path.join(cwd, 'CLAUDE.md')
    if (!fs.existsSync(filePath)) return { content: '', exists: false }
    return { content: fs.readFileSync(filePath, 'utf-8'), exists: true }
  })

  ipcMain.handle('file:write-claude-md', (_event, { cwd, content }: { cwd: string; content: string }) => {
    if (!cwd) return
    const filePath = path.join(cwd, 'CLAUDE.md')
    fs.writeFileSync(filePath, content, 'utf-8')
  })

  // File system — list directory tree
  ipcMain.handle('fs:list-dir', async (_event, { dirPath, depth = 0, cwd }: { dirPath: string; depth?: number; cwd: string }): Promise<import('../../shared/types').FileTreeNode[]> => {
    if (!cwd || !dirPath) return []
    return scanDir(dirPath, cwd, depth ?? 0)
  })

  // File system — read file preview
  ipcMain.handle('fs:read-file', async (_event, { path: filePath, maxLines, cwd }: { path: string; maxLines?: number; cwd: string }) => {
    if (!cwd || !filePath) return { content: '', totalLines: 0, language: '', truncated: false }
    return previewFile(filePath, cwd, maxLines)
  })

  // File system — search files by name
  ipcMain.handle('fs:search-files', async (_event, { dirPath, query, cwd }: { dirPath: string; query: string; cwd: string }) => {
    if (!cwd || !dirPath || !query) return []
    return searchFiles(dirPath, cwd, query)
  })

  // File system — create file or directory
  ipcMain.handle('fs:create-file', async (_event, { path: filePath, isDir, cwd }: { path: string; isDir?: boolean; cwd: string }) => {
    if (!cwd || !filePath) return { success: false, error: 'Missing path or cwd' }
    if (isDir) {
      const resolved = path.resolve(cwd, filePath)
      try {
        fs.mkdirSync(resolved, { recursive: true })
        return { success: true }
      } catch (err: unknown) {
        return { success: false, error: err instanceof Error ? err.message : String(err) }
      }
    }
    return createFile(filePath, cwd)
  })

  // File system — delete file
  ipcMain.handle('fs:delete-file', async (_event, { path: filePath, cwd }: { path: string; cwd: string }) => {
    if (!cwd || !filePath) return { success: false, error: 'Missing path or cwd' }
    return deleteFile(filePath, cwd)
  })

  // File system — rename file
  ipcMain.handle('fs:rename-file', async (_event, { oldPath, newPath, cwd }: { oldPath: string; newPath: string; cwd: string }) => {
    if (!cwd || !oldPath || !newPath) return { success: false, error: 'Missing path or cwd' }
    return renameFile(oldPath, newPath, cwd)
  })

  // File system — open file in system default app
  ipcMain.handle('fs:open-in-system', async (_event, { path: filePath, cwd }: { path: string; cwd: string }) => {
    if (!filePath || !cwd) return { success: false, error: 'Missing path or cwd' }
    const resolved = path.resolve(cwd, filePath)
    if (!isPathSafe(resolved, cwd)) return { success: false, error: 'Path is outside the working directory' }
    try {
      const result = await shell.openPath(resolved)
      if (result) {
        return { success: false, error: result }
      }
      return { success: true }
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  // File system — write file content
  ipcMain.handle('fs:write-file', async (_event, { path: filePath, content, cwd }: { path: string; content: string; cwd: string }) => {
    if (!filePath || !cwd) return { success: false, error: 'Missing path or cwd' }
    const resolved = path.resolve(cwd, filePath)
    if (!isPathSafe(resolved, cwd)) return { success: false, error: 'Path is outside the working directory' }
    try {
      fs.writeFileSync(resolved, content, 'utf-8')
      return { success: true }
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })
}
