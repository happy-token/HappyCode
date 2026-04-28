import { ipcMain, dialog, app, BrowserWindow, shell } from 'electron'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { spawn, execSync } from 'child_process'
import type { SessionStore } from './session-store'
import type { AgentManager } from './agent-manager'
import { buildCsvContent, applyRedaction, computeChainHashes, buildVerifierScript } from './export-utils'
import type { ExportSettings, ClaudeLoginResult } from '../shared/types'
import { loadApiConfig, saveApiConfig, loadAgentSettings, saveAgentSettings } from './api-config-store'
import { getClaudeSettings, saveClaudeSettings } from './claude-settings'
import { getClaudeCliStatus } from './claude-cli-status'
import {
  listSkills,
  installSkillFromGit,
  deleteSkill,
  toggleSkill,
  getSkillContent,
  listPlugins,
  installPlugin,
  uninstallPlugin,
  enablePlugin,
  disablePlugin,
  updatePlugin,
  getPluginReadme,
} from './skills-manager'
import type { AgentStartParams, PermissionResponse, ApiConfig, AgentSettings, ClaudeSettings, CustomCommand, ListCustomCommandsResult, HookTestResult, GitStatusResult, GitStatusCode, ProviderConfig, AgentSource, McpServerRecord, McpServerConfig, ComputerUseConfig, ComputerUseTccState } from '../shared/types'
import { injectBridgeHook, getBridgeStatus } from './bridge-injector'
import { scanDir, previewFile, searchFiles, createFile, deleteFile, renameFile } from './files'
import { isPathSafe } from './files-utils'
import {
  saveProvider,
  listProviders,
  deleteProvider,
  updateProvider,
  activateProvider,
  activateOfficial,
  getActiveProvider,
  testProviderById,
  testProviderConfigFn,
  PROVIDER_PRESETS,
} from './provider-manager'
import { diagnoseProvider } from './provider-doctor'
import { listAgents, getAgentDetail } from './agent-service'
import {
  isGitRepo,
  getStatus,
  getBranches,
  checkout,
  createBranch,
  getLog,
  commit,
  push,
  getDiff,
  getCommitDetail,
  getWorktrees,
  deriveWorktree,
} from './git-service'
import {
  readAllMcpServers,
  saveMcpServersToUserConfig,
  deleteMcpServerFromUserConfig,
} from './mcp-config'
import {
  getComputerUseConfig,
  saveComputerUseConfig,
} from './computer-use-settings'
import { listInstalledApps } from './installed-apps'

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

export function registerIpcHandlers(store: SessionStore, agentManager: AgentManager, createPreviewWindow: (filePath: string) => BrowserWindow): void {
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
  ipcMain.handle('settings:claude-cli-status', () => {
    try {
      return getClaudeCliStatus()
    } catch (err) {
      console.error('[claude-cli-status] error:', err)
      throw err
    }
  })

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
  ipcMain.handle('skills:get-content', (_event, { skillPath }: { skillPath: string }) =>
    getSkillContent(skillPath)
  )
  ipcMain.handle('plugins:list', () => listPlugins())
  ipcMain.handle('plugins:install', (_event, { name }: { name: string }) => installPlugin(name))
  ipcMain.handle('plugins:uninstall', (_event, { name }: { name: string }) => uninstallPlugin(name))
  ipcMain.handle('plugins:enable', (_event, { pluginId }: { pluginId: string }) => enablePlugin(pluginId))
  ipcMain.handle('plugins:disable', (_event, { pluginId }: { pluginId: string }) => disablePlugin(pluginId))
  ipcMain.handle('plugins:update', (_event, { pluginId }: { pluginId: string }) => updatePlugin(pluginId))
  ipcMain.handle('plugins:readme', (_event, { pluginId }: { pluginId: string }) => getPluginReadme(pluginId))

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

  // File system — list directory tree
  ipcMain.handle('fs:list-dir', async (_event, { dirPath, depth = 0, cwd }: { dirPath: string; depth?: number; cwd: string }): Promise<import('../shared/types').FileTreeNode[]> => {
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

  // File preview in new window
  ipcMain.handle('preview:open', async (_event, { filePath, cwd, theme }: { filePath: string; cwd: string; theme?: string }) => {
    if (!filePath || !cwd) return
    const resolved = path.resolve(cwd, filePath)
    if (!isPathSafe(resolved, cwd)) return
    const result = await previewFile(resolved, cwd)
    const win = createPreviewWindow(resolved, theme ?? 'dark')
    win.webContents.once('did-finish-load', () => {
      win.webContents.send('preview:data', { filePath: resolved, theme, ...result })
    })
  })

  // Git status for a directory (legacy fs:git-status)
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

  // Git panel handlers
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

  // Provider management
  ipcMain.handle('providers:list', async () => {
    return listProviders()
  })

  ipcMain.handle('providers:create', async (_event, provider) => {
    return saveProvider(provider)
  })

  ipcMain.handle('providers:update', async (_event, { id, updates }: { id: string; updates: Partial<ProviderConfig> }) => {
    await updateProvider(id, updates)
  })

  ipcMain.handle('providers:delete', async (_event, { id }: { id: string }) => {
    await deleteProvider(id)
  })

  ipcMain.handle('providers:activate', async (_event, { id }: { id: string }) => {
    await activateProvider(id)
  })

  ipcMain.handle('providers:activate-official', async () => {
    await activateOfficial()
  })

  ipcMain.handle('providers:active', async () => {
    return getActiveProvider()
  })

  ipcMain.handle('providers:test', async (_event, { id }: { id: string }) => {
    return testProviderById(id)
  })

  ipcMain.handle('providers:test-config', async (_event, config: { baseUrl: string; apiKey: string; modelId: string; apiFormat: import('../shared/types').ApiFormat }) => {
    return testProviderConfigFn(config)
  })

  ipcMain.handle('providers:presets', async () => {
    return { presets: PROVIDER_PRESETS }
  })

  ipcMain.handle('providers:diagnose', async (_event, { id }: { id: string }) => {
    return diagnoseProvider(id)
  })

  // Agent management
  ipcMain.handle('agents:list', async (_event, { cwd }: { cwd?: string }) => {
    return listAgents(cwd)
  })

  ipcMain.handle('agents:detail', async (_event, { agentType, source, cwd }: { agentType: string; source: AgentSource; cwd?: string }) => {
    return getAgentDetail(agentType, source, cwd)
  })

  // MCP servers
  ipcMain.handle('mcp:list', async (_event, { cwd }: { cwd: string }) => {
    const servers = readAllMcpServers(cwd)
    const enriched = servers.map((s) => {
      const summary = s.config.type === 'stdio'
        ? `${s.config.command}${s.config.args?.length ? ' ' + s.config.args.join(' ') : ''}`
        : (s.config.url ?? '')
      return {
        ...s,
        status: 'checking' as const,
        statusLabel: '检查中...',
        summary,
        canToggle: s.scope === 'user',
        canEdit: s.scope === 'user',
        canRemove: s.scope === 'user',
        canReconnect: true,
      }
    })
    return { servers: enriched }
  })

  ipcMain.handle('mcp:save', (_event, server: McpServerRecord) => {
    // Only user-scope servers can be saved through the main process
    if (server.scope !== 'user') return
    const config: Record<string, McpServerConfig> = { [server.name]: server.config }
    saveMcpServersToUserConfig(config)
  })

  ipcMain.handle('mcp:delete', (_event, { name, scope }: { name: string; scope: 'user' | 'project' | 'local' | 'plugin' }) => {
    // Only user-scope servers can be deleted through the main process
    if (scope === 'user') deleteMcpServerFromUserConfig(name)
  })

  ipcMain.handle('mcp:toggle', (_event, _params: { name: string; scope: 'user' | 'project' | 'local' | 'plugin'; enabled: boolean }) => {
    // Toggle is a no-op for file-based configs (they're always enabled)
    // Future: track disabled state in a local store
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

    // Check Accessibility via osascript
    let accessibility = false
    try {
      const result = execSync(
        `osascript -e 'tell application "System Events" to return UI elements enabled' 2>/dev/null`,
        { encoding: 'utf-8', timeout: 3000 },
      )
      accessibility = result.trim() === 'true'
    } catch {
      // Fallback: check defaults
      try {
        const appId = execSync(`osascript -e 'id of app "Electron"' 2>/dev/null`, { encoding: 'utf-8', timeout: 2000 }).trim()
        const val = execSync(
          `defaults read com.apple.universalaccessAuthWarning "${appId}" 2>/dev/null`,
          { encoding: 'utf-8', timeout: 2000 },
        )
        accessibility = val.trim() === '1'
      } catch {
        // Unknown -> non-blocking
        accessibility = true
      }
    }

    // Check Screen Recording via screencapture -x (exit 0 means granted)
    let screenRecording = true
    try {
      execSync('screencapture -x -t png /dev/null 2>/dev/null', { encoding: 'utf-8', timeout: 3000 })
      screenRecording = true
    } catch {
      // If screencapture fails, try CGPreflight via python3
      try {
        const py = 'import ctypes; cg=ctypes.CDLL("/System/Library/Frameworks/CoreGraphics.framework/CoreGraphics"); cg.CGPreflightScreenCaptureAccess.restype=ctypes.c_bool; print(cg.CGPreflightScreenCaptureAccess())'
        const result = execSync(`python3 -c '${py}'`, { encoding: 'utf-8', timeout: 3000 })
        screenRecording = result.trim() === 'True'
      } catch {
        // Unknown -> non-blocking per cc-haha logic
        screenRecording = true
      }
    }

    return { accessibility, screenRecording }
  })

  ipcMain.handle('system:open-url', (_event, url: string) => {
    shell.openExternal(url)
  })

  // Installed apps
  ipcMain.handle('apps:list-installed', () => {
    return { apps: listInstalledApps() }
  })
}
