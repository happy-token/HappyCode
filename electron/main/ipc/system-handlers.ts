import { ipcMain, app } from 'electron'
import { execSync } from 'child_process'
import type { ComputerUseConfig, ComputerUseTccState } from '../../shared/types'
import { getComputerUseConfig, saveComputerUseConfig } from '../computer-use-settings'
import { listInstalledApps } from '../installed-apps'

export function registerSystemHandlers(): void {
  ipcMain.handle('app:dock-bounce', () => {
    app.dock?.bounce('informational')
  })

  // Computer Use
  ipcMain.handle('computer-use:get', (): ComputerUseConfig => {
    return getComputerUseConfig()
  })

  ipcMain.handle('computer-use:set', (_event, config: ComputerUseConfig) => {
    saveComputerUseConfig(config)
  })

  ipcMain.handle('system:get-macos-permissions', (): ComputerUseTccState => {
    if (process.platform !== 'darwin') {
      return { accessibility: true, screenRecording: true }
    }

    let accessibility = false
    try {
      const result = execSync(
        `osascript -e 'tell application "System Events" to return UI elements enabled' 2>/dev/null`,
        { encoding: 'utf-8', timeout: 3000 },
      )
      accessibility = result.trim() === 'true'
    } catch {
      try {
        const appId = execSync(`osascript -e 'id of app "Electron"' 2>/dev/null`, { encoding: 'utf-8', timeout: 2000 }).trim()
        const val = execSync(
          `defaults read com.apple.universalaccessAuthWarning "${appId}" 2>/dev/null`,
          { encoding: 'utf-8', timeout: 2000 },
        )
        accessibility = val.trim() === '1'
      } catch {
        accessibility = true
      }
    }

    let screenRecording = true
    try {
      execSync('screencapture -x -t png /dev/null 2>/dev/null', { encoding: 'utf-8', timeout: 3000 })
      screenRecording = true
    } catch {
      try {
        const py = 'import ctypes; cg=ctypes.CDLL("/System/Library/Frameworks/CoreGraphics.framework/CoreGraphics"); cg.CGPreflightScreenCaptureAccess.restype=ctypes.c_bool; print(cg.CGPreflightScreenCaptureAccess())'
        const result = execSync(`python3 -c '${py}'`, { encoding: 'utf-8', timeout: 3000 })
        screenRecording = result.trim() === 'True'
      } catch {
        screenRecording = true
      }
    }

    return { accessibility, screenRecording }
  })

  // Installed apps
  ipcMain.handle('apps:list-installed', () => {
    return { apps: listInstalledApps() }
  })
}
