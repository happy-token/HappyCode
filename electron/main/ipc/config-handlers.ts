import { ipcMain } from 'electron'
import type { ApiConfig, AgentSettings, ClaudeSettings } from '../../shared/types'
import { loadApiConfig, saveApiConfig, loadAgentSettings, saveAgentSettings } from '../api-config-store'
import { getClaudeSettings, saveClaudeSettings } from '../claude-settings'
import { getClaudeCliStatus } from '../claude-cli-status'

export function registerConfigHandlers(): void {
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
}
