import { ipcMain, dialog, BrowserWindow } from 'electron'
import fs from 'fs'
import path from 'path'
import { previewFile } from '../files'
import { isPathSafe } from '../files-utils'

export function registerExportHandlers(_store: unknown, createPreviewWindow: (filePath: string) => BrowserWindow): void {
  // Export conversation as PDF
  ipcMain.handle('export:pdf', async (_event, { html, defaultName }: { html: string; defaultName: string }) => {
    const result = await dialog.showSaveDialog({
      defaultPath: defaultName,
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    })
    if (result.canceled || !result.filePath) return { saved: false }

    const win = new BrowserWindow({
      show: false,
      width: 900,
      height: 1200,
      webPreferences: { nodeIntegration: false, contextIsolation: true },
    })

    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
    await new Promise<void>((resolve) => {
      win.webContents.once('did-finish-load', () => resolve())
    })

    const pdfBuffer = await win.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
      margins: { top: 0.75, bottom: 0.75, left: 0.75, right: 0.75 },
    })

    win.destroy()
    fs.writeFileSync(result.filePath, pdfBuffer)
    return { saved: true, filePath: result.filePath }
  })

  // Export conversation as Markdown
  ipcMain.handle('export:markdown', async (_event, { content, defaultName }: { content: string; defaultName: string }) => {
    const result = await dialog.showSaveDialog({
      defaultPath: defaultName,
      filters: [{ name: 'Markdown', extensions: ['md'] }],
    })
    if (result.canceled || !result.filePath) return { saved: false }
    fs.writeFileSync(result.filePath, content, 'utf-8')
    return { saved: true, filePath: result.filePath }
  })

  // File preview in new window
  ipcMain.handle('preview:open', async (_event, { filePath, cwd, theme }: { filePath: string; cwd: string; theme?: string }) => {
    if (!filePath || !cwd) return
    const resolved = path.resolve(cwd, filePath)
    if (!isPathSafe(resolved, cwd)) return
    const data = await previewFile(resolved, cwd)
    const win = createPreviewWindow(resolved, theme ?? 'dark')
    win.webContents.once('did-finish-load', () => {
      win.webContents.send('preview:data', { filePath: resolved, cwd, theme, ...data })
    })
  })
}
