import { ipcMain, dialog, app, BrowserWindow } from 'electron'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { spawn } from 'child_process'
import type { SessionStore } from './session-store'
import type { AgentManager } from './agent-manager'
import { buildCsvContent, applyRedaction, computeChainHashes, buildVerifierScript } from './export-utils'
import type { ExportSettings, ClaudeLoginResult } from '../shared/types'
import { loadApiConfig, saveApiConfig, loadAgentSettings, saveAgentSettings } from './api-config-store'
import { getClaudeSettings, saveClaudeSettings } from './claude-settings'
import {
  listSkills,
  installSkillFromGit,
  deleteSkill,
  toggleSkill,
  getSkillContent,
  listPlugins,
  installPlugin,
  removePlugin,
} from './skills-manager'
import type { AgentStartParams, PermissionResponse, ApiConfig, AgentSettings, ClaudeSettings, CustomCommand, ListCustomCommandsResult, HookTestResult } from '../shared/types'
import { injectBridgeHook, getBridgeStatus } from './bridge-injector'

function listCustomCommandsFromDir(dir: string, source: 'personal' | 'project'): CustomCommand[] {
  if (!fs.existsSync(dir)) return []
  const commands: CustomCommand[] = []
  try {
    const entries = fs.readdirSync(dir)
    for (const entry of entries) {
      if (!entry.endsWith('.md')) continue
      const filePath = path.join(dir, entry)
      const name = entry.slice(0, -3) // strip .md
      let description = ''
      try {
        const content = fs.readFileSync(filePath, 'utf-8')
        const lines = content.split('\n')
        for (const line of lines) {
          const trimmed = line.trim()
          if (trimmed && !trimmed.startsWith('#')) {
            description = trimmed.slice(0, 120)
            break
          }
          if (trimmed.startsWith('# ')) {
            description = trimmed.slice(2).slice(0, 120)
            break
          }
        }
      } catch { /* skip unreadable files */ }
      commands.push({ name, description, source, filePath })
    }
  } catch { /* skip unreadable dirs */ }
  return commands.sort((a, b) => a.name.localeCompare(b.name))
}

// Reads ~/.claude/.credentials.json and returns the claudeAiOauth access token if present
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

// Spawns `claude login` (which opens the browser for OAuth) and resolves when done
function runClaudeLogin(): Promise<ClaudeLoginResult> {
  return new Promise((resolve) => {
    // First check if already logged in
    const existing = readClaudeOAuthToken()
    if (existing) {
      resolve({ success: true, authToken: existing })
      return
    }

    // Find claude CLI path
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
      stdio: 'inherit',        // let CLI control the terminal and open browser
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

export function registerIpcHandlers(store: SessionStore, agentManager: AgentManager): void {
  // Phase 2 — hooks
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
  ipcMain.handle('session:list', (_event, { cwd }: { cwd: string }) => {
    return store.listByCwd(cwd)
  })

  ipcMain.handle(
    'session:history',
    (_event, { sessionId, cwd }: { sessionId: string; cwd: string }) => {
      return store.readHistory(sessionId, cwd)
    }
  )

  ipcMain.handle(
    'export:csv',
    (_event, { sessionId, cwd, settings }: { sessionId: string; cwd: string; settings: ExportSettings }) => {
      const result = store.readHistory(sessionId, cwd)
      if (result.skipped) {
        return { csv: '', error: result.reason }
      }
      const redacted = applyRedaction(result.entries, settings)
      const hashed = computeChainHashes(sessionId, redacted)
      return {
        csv: buildCsvContent(sessionId, hashed),
        verifierScript: buildVerifierScript(sessionId),
      }
    }
  )

  // Auth
  ipcMain.handle('auth:claude-login', () => runClaudeLogin())

  // Phase 1 — agent
  ipcMain.handle('agent:start', (_event, params: AgentStartParams) => {
    const sessionId = agentManager.startSession(params)
    return { sessionId }
  })

  ipcMain.handle('agent:abort', (_event, { sessionId }: { sessionId: string }) => {
    agentManager.abortSession(sessionId)
  })

  ipcMain.handle('agent:permission-response', (_event, response: PermissionResponse) => {
    agentManager.respondPermission(response)
  })

  ipcMain.handle('agent:tool-result', (_event, { sessionId, toolUseId, content }: { sessionId: string; toolUseId: string; content: string }) => {
    agentManager.sendToolResult(sessionId, toolUseId, content)
  })

  ipcMain.handle('dialog:select-folder', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle('config:get-api', () => loadApiConfig())
  ipcMain.handle('config:set-api', (_event, config: ApiConfig) => saveApiConfig(config))
  ipcMain.handle('config:get-agent-settings', () => loadAgentSettings())
  ipcMain.handle('config:set-agent-settings', (_event, settings: AgentSettings) => saveAgentSettings(settings))

  ipcMain.handle('settings:get-claude', () => getClaudeSettings())
  ipcMain.handle('settings:save-claude', (_event, settings: ClaudeSettings) => saveClaudeSettings(settings))

  ipcMain.handle('app:dock-bounce', () => {
    app.dock?.bounce('informational')
  })

  // Skills
  ipcMain.handle('skills:list', () => listSkills())
  ipcMain.handle('skills:install-from-git', (_event, { url, name }: { url: string; name?: string }) =>
    installSkillFromGit(url, name)
  )
  ipcMain.handle('skills:delete', (_event, { skillId }: { skillId: string }) => deleteSkill(skillId))
  ipcMain.handle('skills:toggle', (_event, { skillId, enabled }: { skillId: string; enabled: boolean }) =>
    toggleSkill(skillId, enabled)
  )
  ipcMain.handle('skills:get-content', (_event, { skillId }: { skillId: string }) =>
    getSkillContent(skillId)
  )
  ipcMain.handle('plugins:list', () => listPlugins())
  ipcMain.handle('plugins:install', (_event, { name }: { name: string }) => installPlugin(name))
  ipcMain.handle('plugins:remove', (_event, { name }: { name: string }) => removePlugin(name))

  // History
  ipcMain.handle('history:list-all', () => store.listAllHistory())
  ipcMain.handle('history:load-session-messages', (_event, { encodedPath, sessionId }: { encodedPath: string; sessionId: string }) =>
    store.loadSessionMessages(encodedPath, sessionId)
  )
  ipcMain.handle('history:delete-session', (_event, { encodedPath, sessionId }: { encodedPath: string; sessionId: string }) =>
    store.deleteSession(encodedPath, sessionId)
  )
  ipcMain.handle('history:delete-project', (_event, { encodedPath }: { encodedPath: string }) =>
    store.deleteProject(encodedPath)
  )

  // Export conversation as PDF (via hidden BrowserWindow + printToPDF)
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

  // Custom commands
  ipcMain.handle('commands:list-custom', (_event, { cwd }: { cwd: string }): ListCustomCommandsResult => {
    const personalDir = path.join(os.homedir(), '.claude', 'commands')
    const projectDir = cwd ? path.join(cwd, '.claude', 'commands') : ''
    const personal = listCustomCommandsFromDir(personalDir, 'personal')
    const project = projectDir ? listCustomCommandsFromDir(projectDir, 'project') : []
    return { commands: [...personal, ...project] }
  })
}
