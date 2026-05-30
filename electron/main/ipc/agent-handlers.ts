import { ipcMain } from 'electron'
import type { AgentManager } from '../agent-manager'
import type { AgentStartParams, PermissionResponse } from '../../shared/types'

export function registerAgentHandlers(agentManager: AgentManager): void {
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
}
