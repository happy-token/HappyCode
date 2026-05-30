import { ipcMain, dialog } from 'electron'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { spawn } from 'child_process'
import type { ClaudeLoginResult } from '../../shared/types'

function readClaudeOAuthToken(): string | null {
  const credPath = path.join(os.homedir(), '.claude', '.credentials.json')
  if (!fs.existsSync(credPath)) return null
  try {
    const raw = fs.readFileSync(credPath, 'utf-8')
    const data: unknown = JSON.parse(raw)
    if (
      data !== null &&
      typeof data === 'object' &&
      'claudeAiOauth' in data &&
      data.claudeAiOauth !== null &&
      typeof data.claudeAiOauth === 'object' &&
      'accessToken' in data.claudeAiOauth &&
      typeof data.claudeAiOauth.accessToken === 'string' &&
      data.claudeAiOauth.accessToken.length > 0
    ) {
      return data.claudeAiOauth.accessToken
    }
  } catch { /* ignore parse errors */ }
  return null
}

function runClaudeLogin(): Promise<ClaudeLoginResult> {
  return new Promise((resolve) => {
    const existing = readClaudeOAuthToken()
    if (existing) {
      resolve({ success: true, authToken: existing })
      return
    }

    const claudePath = process.env.PATH
      ? (() => {
          for (const dir of process.env.PATH.split(':')) {
            const candidate = path.join(dir, 'claude')
            if (fs.existsSync(candidate)) return candidate
          }
          return 'claude'
        })()
      : 'claude'

    const child = spawn(claudePath, ['login'], {
      stdio: 'inherit',
      detached: false,
      env: { ...process.env },
    })

    child.on('error', (err) => {
      resolve({ success: false, error: `Failed to launch claude login: ${err.message}` })
    })

    child.on('close', (code) => {
      if (code !== 0) {
        resolve({ success: false, error: `claude login exited with code ${code}` })
        return
      }
      const token = readClaudeOAuthToken()
      if (token) {
        resolve({ success: true, authToken: token })
      } else {
        resolve({ success: false, error: 'Login completed but no credentials file found at ~/.claude/.credentials.json' })
      }
    })
  })
}

export function registerAuthHandlers(): void {
  ipcMain.handle('auth:claude-login', () => runClaudeLogin())

  ipcMain.handle('dialog:select-folder', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
    return result.canceled ? null : result.filePaths[0]
  })
}
