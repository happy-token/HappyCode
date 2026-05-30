import { ipcMain } from 'electron'
import type { McpServerRecord, McpServerConfig, AgentSource } from '../../shared/types'
import { readAllMcpServers, saveMcpServersToUserConfig, deleteMcpServerFromUserConfig } from '../mcp-config'
import { listAgents, getAgentDetail } from '../agent-service'

export function registerMcpHandlers(): void {
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
    if (server.scope !== 'user') return
    const config: Record<string, McpServerConfig> = { [server.name]: server.config }
    saveMcpServersToUserConfig(config)
  })

  ipcMain.handle('mcp:delete', (_event, { name, scope }: { name: string; scope: 'user' | 'project' | 'local' | 'plugin' }) => {
    if (scope === 'user') deleteMcpServerFromUserConfig(name)
  })

  ipcMain.handle('mcp:toggle', (_event, _params: { name: string; scope: 'user' | 'project' | 'local' | 'plugin'; enabled: boolean }) => {
    // Toggle is a no-op for file-based configs
  })

  // Agent management
  ipcMain.handle('agents:list', async (_event, { cwd }: { cwd?: string }) => {
    return listAgents(cwd)
  })

  ipcMain.handle('agents:detail', async (_event, { agentType, source, cwd }: { agentType: string; source: AgentSource; cwd?: string }) => {
    return getAgentDetail(agentType, source, cwd)
  })
}
