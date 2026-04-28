import { contextBridge, ipcRenderer } from 'electron'
import type { ElectronAPI, SDKMessage, PermissionRequest, HookEvent, SubagentEvent, ApiConfig, AgentSettings, ClaudeSettings, SkillsResult, PluginsResult, InstallSkillResult, PluginReadmeResult, PluginOperationResult, AllHistoryResult, SessionMessage, ListCustomCommandsResult, ExportSettings, ClaudeLoginResult, HookBridgeStatus, HookTestResult, GitStatusResult, FileTreeNode, FilePreviewResult, FileOperationResult, GitLogEntry, GitBranch, GitCommitDetail, GitWorktree, GitOperationResult, McpServerRecord, AgentSource, ProviderConfig, ProviderTestResult, ProviderPreset, ApiFormat, ComputerUseConfig, InstalledApp, DiagResult, ClaudeCliStatus } from '../shared/types'

const api: ElectronAPI = {
  // Auth
  claudeLogin: (): Promise<ClaudeLoginResult> => ipcRenderer.invoke('auth:claude-login'),

  // Phase 0
  listSessions: (cwd) => ipcRenderer.invoke('session:list', { cwd }),
  readSessionHistory: (sessionId, cwd) =>
    ipcRenderer.invoke('session:history', { sessionId, cwd }),
  exportCsv: (sessionId: string, cwd: string, settings: ExportSettings) => ipcRenderer.invoke('export:csv', { sessionId, cwd, settings }),

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

  clearHookEvents: (): Promise<void> => ipcRenderer.invoke('hook:clear-events'),
  getBridgeStatus: (): Promise<HookBridgeStatus> => ipcRenderer.invoke('hook:bridge-status'),
  injectBridge: (): Promise<HookBridgeStatus> => ipcRenderer.invoke('hook:inject-bridge'),
  testHookRule: (p: { command: string; eventName: string; payload: unknown }): Promise<HookTestResult> =>
    ipcRenderer.invoke('hook:test-rule', p),

  onSubagentEvent: (cb) => {
    const handler = (_: Electron.IpcRendererEvent, event: SubagentEvent) => cb(event)
    ipcRenderer.on('agent:subagent-event', handler)
    return () => ipcRenderer.removeListener('agent:subagent-event', handler)
  },

  getClaudeSettings: () => ipcRenderer.invoke('settings:get-claude'),
  saveClaudeSettings: (settings: ClaudeSettings) => ipcRenderer.invoke('settings:save-claude', settings),
  getClaudeCliStatus: (): Promise<ClaudeCliStatus> => ipcRenderer.invoke('settings:claude-cli-status'),

  dockBounce: () => ipcRenderer.invoke('app:dock-bounce'),

  // Skills
  listSkills: (): Promise<SkillsResult> => ipcRenderer.invoke('skills:list'),
  installSkillFromGit: (url: string, name?: string): Promise<InstallSkillResult> =>
    ipcRenderer.invoke('skills:install-from-git', { url, name }),
  deleteSkill: (skillId: string): Promise<void> => ipcRenderer.invoke('skills:delete', { skillId }),
  toggleSkill: (skillId: string, enabled: boolean): Promise<void> =>
    ipcRenderer.invoke('skills:toggle', { skillId, enabled }),
  getSkillContent: (skillPath: string): Promise<{ content: string }> =>
    ipcRenderer.invoke('skills:get-content', { skillPath }),
  listPlugins: (): Promise<PluginsResult> => ipcRenderer.invoke('plugins:list'),
  installPlugin: (name: string): Promise<InstallSkillResult> =>
    ipcRenderer.invoke('plugins:install', { name }),
  uninstallPlugin: (name: string): Promise<PluginOperationResult> =>
    ipcRenderer.invoke('plugins:uninstall', { name }),
  enablePlugin: (pluginId: string): Promise<PluginOperationResult> =>
    ipcRenderer.invoke('plugins:enable', { pluginId }),
  disablePlugin: (pluginId: string): Promise<PluginOperationResult> =>
    ipcRenderer.invoke('plugins:disable', { pluginId }),
  updatePlugin: (pluginId: string): Promise<PluginOperationResult> =>
    ipcRenderer.invoke('plugins:update', { pluginId }),
  getPluginReadme: (pluginId: string): Promise<PluginReadmeResult> =>
    ipcRenderer.invoke('plugins:readme', { pluginId }),

  // Export
  exportMarkdown: (content: string, defaultName: string) =>
    ipcRenderer.invoke('export:markdown', { content, defaultName }),
  exportPdf: (html: string, defaultName: string) =>
    ipcRenderer.invoke('export:pdf', { html, defaultName }),

  // CLAUDE.md
  readClaudeMd: (cwd: string) => ipcRenderer.invoke('file:read-claude-md', { cwd }),
  writeClaudeMd: (cwd: string, content: string) => ipcRenderer.invoke('file:write-claude-md', { cwd, content }),

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

  // File system / git
  listDir: (params: { dirPath: string; depth?: number; cwd: string }): Promise<FileTreeNode[]> =>
    ipcRenderer.invoke('fs:list-dir', params),
  readFile: (params: { path: string; maxLines?: number; cwd: string }): Promise<FilePreviewResult> =>
    ipcRenderer.invoke('fs:read-file', params),
  searchFiles: (params: { dirPath: string; query: string; cwd: string }): Promise<string[]> =>
    ipcRenderer.invoke('fs:search-files', params),
  createFile: (params: { path: string; isDir?: boolean; cwd: string }): Promise<FileOperationResult> =>
    ipcRenderer.invoke('fs:create-file', params),
  deleteFile: (params: { path: string; cwd: string }): Promise<FileOperationResult> =>
    ipcRenderer.invoke('fs:delete-file', params),
  renameFile: (params: { oldPath: string; newPath: string; cwd: string }): Promise<FileOperationResult> =>
    ipcRenderer.invoke('fs:rename-file', params),
  openInSystem: (params: { path: string }): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('fs:open-in-system', params),
  gitStatus: (cwd: string): Promise<GitStatusResult> =>
    ipcRenderer.invoke('fs:git-status', { cwd }),
  gitCommit: (params: { cwd: string; message: string }): Promise<GitOperationResult> =>
    ipcRenderer.invoke('git:commit', params),
  gitPush: (params: { cwd: string }): Promise<GitOperationResult> =>
    ipcRenderer.invoke('git:push', params),
  gitLog: (params: { cwd: string; limit?: number }): Promise<GitLogEntry[]> =>
    ipcRenderer.invoke('git:log', params),
  gitBranches: (params: { cwd: string }): Promise<GitBranch[]> =>
    ipcRenderer.invoke('git:branches', params),
  gitCheckout: (params: { cwd: string; branch: string }): Promise<GitOperationResult> =>
    ipcRenderer.invoke('git:checkout', params),
  gitDiff: (params: { cwd: string; file?: string }): Promise<string> =>
    ipcRenderer.invoke('git:diff', params),
  gitCommitDetail: (params: { cwd: string; sha: string }): Promise<GitCommitDetail> =>
    ipcRenderer.invoke('git:commit-detail', params),
  gitWorktrees: (params: { cwd: string }): Promise<GitWorktree[]> =>
    ipcRenderer.invoke('git:worktrees', params),
  gitDeriveWorktree: (params: { cwd: string; branch: string; path: string }): Promise<GitOperationResult> =>
    ipcRenderer.invoke('git:derive-worktree', params),
  gitCreateBranch: (params: { cwd: string; branch: string; startPoint?: string }): Promise<GitOperationResult> =>
    ipcRenderer.invoke('git:create-branch', params),
  onGitError: (cb: (data: { message: string }) => void): (() => void) => {
    const handler = (_e: Electron.IpcRendererEvent, data: { message: string }) => cb(data)
    ipcRenderer.on('git:error', handler)
    return () => ipcRenderer.removeListener('git:error', handler)
  },

  // Provider management
  listProviders: (): Promise<{ providers: ProviderConfig[]; activeId: string | null }> =>
    ipcRenderer.invoke('providers:list'),
  createProvider: (provider: Omit<ProviderConfig, 'id'>): Promise<{ id: string }> =>
    ipcRenderer.invoke('providers:create', provider),
  updateProvider: (id: string, updates: Partial<ProviderConfig>): Promise<void> =>
    ipcRenderer.invoke('providers:update', { id, updates }),
  deleteProvider: (id: string): Promise<void> =>
    ipcRenderer.invoke('providers:delete', { id }),
  activateProvider: (id: string): Promise<void> =>
    ipcRenderer.invoke('providers:activate', { id }),
  activateOfficial: (): Promise<void> =>
    ipcRenderer.invoke('providers:activate-official'),
  testProvider: (id: string, config?: { baseUrl: string; modelId: string; apiFormat: ApiFormat }): Promise<ProviderTestResult> =>
    ipcRenderer.invoke('providers:test', { id, config }),
  testProviderConfig: (config: { baseUrl: string; apiKey: string; modelId: string; apiFormat: ApiFormat }): Promise<ProviderTestResult> =>
    ipcRenderer.invoke('providers:test-config', config),
  listProviderPresets: (): Promise<{ presets: ProviderPreset[] }> =>
    ipcRenderer.invoke('providers:presets'),
  getProviderSettings: (): Promise<Record<string, unknown>> =>
    ipcRenderer.invoke('providers:get-settings'),
  updateProviderSettings: (settings: Record<string, unknown>): Promise<void> =>
    ipcRenderer.invoke('providers:update-settings', settings),
  diagnoseProvider: (id: string): Promise<DiagResult> =>
    ipcRenderer.invoke('providers:diagnose', { id }),

  // Agent management
  listAgents: (cwd?: string) =>
    ipcRenderer.invoke('agents:list', { cwd }),
  getAgentDetail: (agentType: string, source: AgentSource, cwd?: string) =>
    ipcRenderer.invoke('agents:detail', { agentType, source, cwd }),

  // MCP servers
  listMcpServers: (cwd: string): Promise<{ servers: McpServerRecord[] }> =>
    ipcRenderer.invoke('mcp:list', { cwd }),
  saveMcpServer: (server: McpServerRecord): Promise<void> =>
    ipcRenderer.invoke('mcp:save', server),
  deleteMcpServer: (name: string, scope: 'user' | 'project' | 'local' | 'plugin'): Promise<void> =>
    ipcRenderer.invoke('mcp:delete', { name, scope }),
  toggleMcpServer: (name: string, scope: 'user' | 'project' | 'local' | 'plugin', enabled: boolean): Promise<void> =>
    ipcRenderer.invoke('mcp:toggle', { name, scope, enabled }),

  // Computer Use
  getComputerUseConfig: (): Promise<ComputerUseConfig> =>
    ipcRenderer.invoke('computer-use:get'),
  setComputerUseConfig: (config: ComputerUseConfig): Promise<void> =>
    ipcRenderer.invoke('computer-use:set', config),
  listInstalledApps: (): Promise<{ apps: InstalledApp[] }> =>
    ipcRenderer.invoke('apps:list-installed'),
  getMacOsPermissions: (): Promise<import('../shared/types').ComputerUseTccState> =>
    ipcRenderer.invoke('system:get-macos-permissions'),
  openUrl: (url: string): Promise<void> =>
    ipcRenderer.invoke('system:open-url', url),

  // File preview window
  openFilePreview: (params: { filePath: string; cwd: string; theme?: string }): Promise<void> =>
    ipcRenderer.invoke('preview:open', params),
  onPreviewData: (cb: (data: import('../shared/types').FilePreviewResult & { filePath: string; theme?: string }) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, data: import('../shared/types').FilePreviewResult & { filePath: string; theme?: string }) => cb(data)
    ipcRenderer.on('preview:data', handler)
    return () => ipcRenderer.removeListener('preview:data', handler)
  },
}

contextBridge.exposeInMainWorld('electron', api)
