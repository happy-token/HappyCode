import { contextBridge, ipcRenderer } from 'electron'
import type { ElectronAPI, SDKMessage, PermissionRequest, HookEvent, SubagentEvent, ApiConfig, AgentSettings, ClaudeSettings, SkillsResult, PluginsResult, InstallSkillResult, AllHistoryResult, SessionMessage, ListCustomCommandsResult } from '../shared/types'

const api: ElectronAPI = {
  // Phase 0
  listSessions: (cwd) => ipcRenderer.invoke('session:list', { cwd }),
  readSessionHistory: (sessionId, cwd) =>
    ipcRenderer.invoke('session:history', { sessionId, cwd }),
  exportCsv: (sessionId, cwd) => ipcRenderer.invoke('export:csv', { sessionId, cwd }),

  // Phase 1
  startSession: (params) => ipcRenderer.invoke('agent:start', params),
  abortSession: (sessionId) => ipcRenderer.invoke('agent:abort', { sessionId }),
  respondPermission: (response) => ipcRenderer.invoke('agent:permission-response', response),
  sendToolResult: (params) => ipcRenderer.invoke('agent:tool-result', params),
  selectFolder: () => ipcRenderer.invoke('dialog:select-folder'),
  getApiConfig: () => ipcRenderer.invoke('config:get-api'),
  setApiConfig: (config: ApiConfig) => ipcRenderer.invoke('config:set-api', config),
  getAgentSettings: () => ipcRenderer.invoke('config:get-agent-settings'),
  setAgentSettings: (settings: AgentSettings) => ipcRenderer.invoke('config:set-agent-settings', settings),

  onAgentEvent: (cb) => {
    const handler = (_: Electron.IpcRendererEvent, data: { sessionId: string; msg: SDKMessage }) =>
      cb(data)
    ipcRenderer.on('agent:event', handler)
    return () => ipcRenderer.removeListener('agent:event', handler)
  },

  onPermissionRequest: (cb) => {
    const handler = (_: Electron.IpcRendererEvent, data: PermissionRequest) => cb(data)
    ipcRenderer.on('agent:permission-request', handler)
    return () => ipcRenderer.removeListener('agent:permission-request', handler)
  },

  onAgentDone: (cb) => {
    const handler = (_: Electron.IpcRendererEvent, data: { sessionId: string }) => cb(data)
    ipcRenderer.on('agent:done', handler)
    return () => ipcRenderer.removeListener('agent:done', handler)
  },

  onAgentError: (cb) => {
    const handler = (_: Electron.IpcRendererEvent, data: { sessionId: string; error: string }) =>
      cb(data)
    ipcRenderer.on('agent:error', handler)
    return () => ipcRenderer.removeListener('agent:error', handler)
  },

  // Phase 2 — hooks
  listHookEvents: (limit) => ipcRenderer.invoke('hook:list', { limit }),

  onHookEvent: (cb) => {
    const handler = (_: Electron.IpcRendererEvent, event: HookEvent) => cb(event)
    ipcRenderer.on('hook:event', handler)
    return () => ipcRenderer.removeListener('hook:event', handler)
  },

  onSubagentEvent: (cb) => {
    const handler = (_: Electron.IpcRendererEvent, event: SubagentEvent) => cb(event)
    ipcRenderer.on('agent:subagent-event', handler)
    return () => ipcRenderer.removeListener('agent:subagent-event', handler)
  },

  getClaudeSettings: () => ipcRenderer.invoke('settings:get-claude'),
  saveClaudeSettings: (settings: ClaudeSettings) => ipcRenderer.invoke('settings:save-claude', settings),

  dockBounce: () => ipcRenderer.invoke('app:dock-bounce'),

  // Skills
  listSkills: (): Promise<SkillsResult> => ipcRenderer.invoke('skills:list'),
  installSkillFromGit: (url: string, name?: string): Promise<InstallSkillResult> =>
    ipcRenderer.invoke('skills:install-from-git', { url, name }),
  deleteSkill: (skillId: string): Promise<void> => ipcRenderer.invoke('skills:delete', { skillId }),
  toggleSkill: (skillId: string, enabled: boolean): Promise<void> =>
    ipcRenderer.invoke('skills:toggle', { skillId, enabled }),
  getSkillContent: (skillId: string): Promise<{ content: string }> =>
    ipcRenderer.invoke('skills:get-content', { skillId }),
  listPlugins: (): Promise<PluginsResult> => ipcRenderer.invoke('plugins:list'),
  installPlugin: (name: string): Promise<InstallSkillResult> =>
    ipcRenderer.invoke('plugins:install', { name }),
  removePlugin: (name: string): Promise<InstallSkillResult> =>
    ipcRenderer.invoke('plugins:remove', { name }),

  // Custom commands
  listCustomCommands: (cwd: string): Promise<ListCustomCommandsResult> =>
    ipcRenderer.invoke('commands:list-custom', { cwd }),

  // History
  listAllHistory: (): Promise<AllHistoryResult> => ipcRenderer.invoke('history:list-all'),
  loadSessionMessages: (encodedPath: string, sessionId: string): Promise<{ messages: SessionMessage[] }> =>
    ipcRenderer.invoke('history:load-session-messages', { encodedPath, sessionId }),
  deleteSession: (encodedPath: string, sessionId: string): Promise<void> =>
    ipcRenderer.invoke('history:delete-session', { encodedPath, sessionId }),
  deleteProject: (encodedPath: string): Promise<void> =>
    ipcRenderer.invoke('history:delete-project', { encodedPath }),
}

contextBridge.exposeInMainWorld('electron', api)
