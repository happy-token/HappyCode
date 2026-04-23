import { ipcMain, dialog, app } from 'electron'
import fs from 'fs'
import path from 'path'
import os from 'os'
import type { SessionStore } from './session-store'
import type { AgentManager } from './agent-manager'
import { buildCsvContent } from './export-utils'
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
import type { AgentStartParams, PermissionResponse, ApiConfig, AgentSettings, ClaudeSettings, CustomCommand, ListCustomCommandsResult } from '../shared/types'

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

export function registerIpcHandlers(store: SessionStore, agentManager: AgentManager): void {
  // Phase 2 — hooks
  ipcMain.handle('hook:list', (_event, { limit }: { limit?: number } = {}) => {
    return { events: store.listHookEvents(limit) }
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
    (_event, { sessionId, cwd }: { sessionId: string; cwd: string }) => {
      const result = store.readHistory(sessionId, cwd)
      if (result.skipped) {
        return { csv: '', error: result.reason }
      }
      return { csv: buildCsvContent(sessionId, result.entries) }
    }
  )

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

  // Custom commands
  ipcMain.handle('commands:list-custom', (_event, { cwd }: { cwd: string }): ListCustomCommandsResult => {
    const personalDir = path.join(os.homedir(), '.claude', 'commands')
    const projectDir = cwd ? path.join(cwd, '.claude', 'commands') : ''
    const personal = listCustomCommandsFromDir(personalDir, 'personal')
    const project = projectDir ? listCustomCommandsFromDir(projectDir, 'project') : []
    return { commands: [...personal, ...project] }
  })
}
