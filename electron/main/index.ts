import { app, BrowserWindow, nativeImage, shell, Tray } from 'electron'

process.on('unhandledRejection', (reason) => {
  console.error('[main] UnhandledRejection:', reason)
})
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { SessionStore } from './session-store'
import { AgentManager } from './agent-manager'
import { HookServer } from './hook-server'
import { registerIpcHandlers } from './ipc-handlers'
import { injectBridgeHook } from './bridge-injector'

let tray: Tray | null = null

function resourcesDir(): string {
  return is.dev ? join(app.getAppPath(), 'resources') : process.resourcesPath
}

function appIcon(): Electron.NativeImage {
  const iconPath = join(resourcesDir(), 'icon.png')
  return nativeImage.createFromPath(iconPath)
}

function trayIcon(): Electron.NativeImage {
  const img = nativeImage.createFromPath(join(resourcesDir(), 'trayTemplate.png'))
  img.setTemplateImage(true)
  return img
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 12, y: 12 },
    icon: appIcon(),
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

export function createPreviewWindow(filePath: string, theme = 'dark'): BrowserWindow {
  const win = new BrowserWindow({
    width: 900,
    height: 700,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 12, y: 12 },
    backgroundColor: theme === 'dark' ? '#1a1a1f' : '#ffffff',
    title: filePath.split('/').pop() ?? filePath,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  win.on('ready-to-show', () => win.show())

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}?window=preview&theme=${theme}`)
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'), { query: { window: 'preview', theme } })
  }

  return win
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.happycode')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  if (process.platform === 'darwin') {
    app.dock?.setIcon(appIcon())
  }

  tray = new Tray(trayIcon())
  tray.setToolTip('HappyCode')
  tray.on('click', () => {
    const win = BrowserWindow.getAllWindows()[0]
    if (win) win.isVisible() ? win.focus() : win.show()
  })

  const store = new SessionStore()
  const win = createWindow()
  const agentManager = new AgentManager(win)
  const hookServer = new HookServer(store, win)
  hookServer.start()
  try {
    injectBridgeHook()
  } catch (err) {
    console.warn('[Main] Bridge hook injection failed (non-fatal):', err)
  }
  registerIpcHandlers(store, agentManager, createPreviewWindow)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
