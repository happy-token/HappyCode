import { app, BrowserWindow, shell } from 'electron'

process.on('unhandledRejection', (reason) => {
  console.error('[main] UnhandledRejection:', reason)
})
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { SessionStore } from './session-store'
import { AgentManager } from './agent-manager'
import { HookServer } from './hook-server'
import { registerIpcHandlers } from './ipc-handlers'

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  win.on('ready-to-show', () => win.show())

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.happycode')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  const store = new SessionStore()
  const win = createWindow()
  const agentManager = new AgentManager(win)
  const hookServer = new HookServer(store, win)
  hookServer.start()
  registerIpcHandlers(store, agentManager)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
