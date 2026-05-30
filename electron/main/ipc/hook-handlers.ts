import { ipcMain } from 'electron'
import type { SessionStore } from '../session-store'
import type { HookTestResult } from '../../shared/types'
import { injectBridgeHook, getBridgeStatus } from '../bridge-injector'

export function registerHookHandlers(store: SessionStore): void {
  ipcMain.handle('hook:list', (_event, { limit }: { limit?: number } = {}) => {
    return { events: store.listHookEvents(limit) }
  })

  ipcMain.handle('hook:clear-events', () => {
    store.clearHookEvents()
  })

  ipcMain.handle('hook:bridge-status', () => {
    return getBridgeStatus()
  })

  ipcMain.handle('hook:inject-bridge', () => {
    return injectBridgeHook()
  })

  ipcMain.handle('hook:test-rule', async (_event, {
    command,
    eventName,
    payload,
  }: {
    command: string
    eventName: string
    payload: unknown
  }): Promise<HookTestResult> => {
    const { execFile } = await import('node:child_process')
    const start = Date.now()

    return new Promise((resolve) => {
      const isWin = process.platform === 'win32'
      const proc = execFile(
        isWin ? 'powershell' : 'bash',
        isWin ? ['-NonInteractive', '-Command', command] : ['-c', command],
        {
          timeout: 10_000,
          env: { ...process.env, HOOK_EVENT_NAME: eventName },
        }
      )

      let stdout = ''
      let stderr = ''

      proc.stdin?.write(JSON.stringify(payload))
      proc.stdin?.end()
      proc.stdout?.on('data', (d: Buffer) => { stdout += d.toString() })
      proc.stderr?.on('data', (d: Buffer) => { stderr += d.toString() })

      proc.on('close', (exitCode) => {
        resolve({ stdout, stderr, exitCode, durationMs: Date.now() - start })
      })

      proc.on('error', (err) => {
        resolve({ stdout: '', stderr: err.message, exitCode: -1, durationMs: Date.now() - start })
      })
    })
  })
}
