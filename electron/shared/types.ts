// 主进程 + 渲染进程共享类型

// ── Phase 0 ───────────────────────────────────────────────────

export interface SessionInfo {
  session_id: string
  cwd: string
  title?: string
  last_used: number
  message_count?: number
  total_cost_usd?: number
}

export interface AuditEntry {
  uuid: string
  timestamp: number
  timestampEstimated?: boolean
  type: string
  toolName?: string
  inputJson?: string
  outputJson?: string
  model?: string
  costUsd?: number
  chainHash?: string
}

export interface ListSessionsResult {
  sessions: SessionInfo[]
  warnings: string[]
}

export interface ReadHistoryResult {
  entries: AuditEntry[]
  skippedLines: number
  skipped?: boolean
  reason?: string
}

export interface ExportCsvResult {
  csv: string
  verifierScript?: string
  error?: string
}

export interface ClaudeLoginResult {
  success: boolean
  authToken?: string  // OAuth access token, ready to use as Bearer token
  error?: string
}

export type ExportRedactMode = 'full' | 'tools-only' | 'custom'

export interface ExportSettings {
  redactMode: ExportRedactMode
  customPatterns: string[]
}

// ── Phase 1 ───────────────────────────────────────────────────

export interface ApiConfig {
  baseUrl: string
  authToken: string
}

export type PermissionMode = 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan' | 'dontAsk' | 'auto'

export type ThinkingMode = 'adaptive' | 'enabled' | 'disabled'

export type EffortLevel = 'low' | 'medium' | 'high' | 'xhigh'

export interface AgentSettings {
  permissionMode?: PermissionMode
  maxTurns?: number
  allowedTools?: string
  disallowedTools?: string
  systemPrompt?: string
  appendSystemPrompt?: string
  additionalDirectories?: string
  thinking?: ThinkingMode
  maxThinkingTokens?: number
  effort?: EffortLevel
  maxBudgetUsd?: number
  fallbackModel?: string
  context1mBeta?: boolean
  enableFileCheckpointing?: boolean
  mcpServersJson?: string
}

export interface Attachment {
  name: string
  mimeType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
  data: string // base64 encoded, no data URL prefix
}

export interface AgentStartParams {
  prompt: string
  cwd: string
  resumeId?: string
  model?: string
  apiConfig?: ApiConfig
  agentSettings?: AgentSettings
  attachments?: Attachment[]
}

export interface PermissionResponse {
  sessionId: string
  reqId: string
  allowed: boolean
}

export interface PermissionRequest {
  sessionId: string
  reqId: string
  toolName: string
  toolInput: unknown
}

// ── Phase 2 ───────────────────────────────────────────────────

export interface HookEvent {
  id?: number
  ts: number
  hook_type: HookType | string
  tool_name?: string
  cwd?: string
  session_id?: string
  input_json?: string
  output_json?: string
  exit_code?: number
}

export interface ListHookEventsResult {
  events: HookEvent[]
}

export interface HookBridgeStatus {
  injected: boolean
  scriptExists: boolean
  scriptPath: string
}

export interface HookTestResult {
  stdout: string
  stderr: string
  exitCode: number | null
  durationMs: number
}

// ── Claude Settings (hooks config) ────────────────────────────

export type HookType =
  | 'PreToolUse'
  | 'PostToolUse'
  | 'PostToolUseFailure'
  | 'UserPromptSubmit'
  | 'Stop'
  | 'SubagentStart'
  | 'SubagentStop'
  | 'SessionStart'
  | 'SessionEnd'
  | 'Notification'
  | 'PreCompact'

export interface ClaudeHookRule {
  matcher?: string
  command: string
  description?: string
}

export interface ClaudeSettings {
  hooks?: Partial<Record<HookType, ClaudeHookRule[]>>
  [key: string]: unknown
}

export interface TokenUsage {
  input_tokens: number
  output_tokens: number
  cache_read_input_tokens?: number
  cache_creation_input_tokens?: number
}

// SDK yields these message types
export type SDKMessage =
  | { type: 'system'; subtype: 'init'; session_id: string; model?: string }
  | { type: 'system'; subtype: 'compact_boundary' }
  | { type: 'system'; subtype: 'task_started'; task_id: string; tool_use_id?: string; description: string; task_type?: string }
  | { type: 'system'; subtype: 'task_updated'; task_id: string; [key: string]: unknown }
  | { type: 'system'; subtype: 'task_notification'; task_id: string; tool_use_id?: string; status: 'completed' | 'failed' | 'stopped'; summary: string; usage?: TokenUsage }
  | { type: 'system'; subtype: string; [key: string]: unknown }
  | { type: 'assistant'; message: { content: ContentBlock[]; model?: string } }
  | { type: 'result'; subtype: 'success'; cost_usd: number; usage: TokenUsage }
  | { type: 'result'; subtype: 'error_during_execution'; error: string }
  | { type: string; [key: string]: unknown }

export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'thinking'; thinking: string }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: string; [key: string]: unknown }

// ── UI Message types (renderer) ───────────────────────────────

export interface AskQuestion {
  question: string
  header?: string
  multiSelect: boolean
  options: Array<{ label: string; description?: string; preview?: string }>
}

export interface Todo {
  content: string
  status: 'pending' | 'in_progress' | 'completed'
  activeForm?: string
}

export type UIMessage =
  | { id: string; type: 'user'; text: string; attachments?: Array<{ name: string; dataUrl: string }> }
  | { id: string; type: 'text'; text: string; streaming?: boolean }
  | { id: string; type: 'thinking'; text: string }
  | { id: string; type: 'tool_call'; toolUseId: string; toolName: string; inputSummary: string; fullInput?: string }
  | { id: string; type: 'diff'; toolUseId: string; filePath: string; oldString: string; newString: string; toolName: 'Edit' | 'Write' | 'MultiEdit' }
  | { id: string; type: 'ask'; toolUseId: string; questions: AskQuestion[]; answered?: boolean }
  | { id: string; type: 'plan'; toolUseId: string; plan: string }
  | { id: string; type: 'error'; text: string }
  | { id: string; type: 'compact_boundary' }
  | { id: string; type: 'done'; costUsd: number; inputTokens: number; outputTokens: number; cacheReadTokens?: number; cacheCreationTokens?: number }

export interface SubagentNodeInfo {
  id: string
  parentId: string | null
  agentType: string
  description: string
  status: 'running' | 'done' | 'error'
  usage?: TokenUsage
  startedAt: number
  stoppedAt?: number
}

export interface SubagentEvent {
  rootSessionId: string
  node: SubagentNodeInfo
}

// ── Skills ────────────────────────────────────────────────────

export type SkillSource = 'userSettings' | 'plugin'

export interface SkillInfo {
  id: string
  name: string
  path: string
  enabled: boolean
  description?: string
  lastModified: number
  source: SkillSource
  plugin?: string
}

export interface SkillsResult {
  skills: SkillInfo[]
}

export type PluginScope = 'user' | 'project' | 'local' | 'managed' | 'builtin'

export interface PluginInfo {
  id: string
  name: string
  version?: string
  enabled: boolean
  scope?: PluginScope
  installPath?: string
  skillCount?: number
  agentCount?: number
}

export interface PluginOperationResult {
  success: boolean
  message?: string
}

export interface PluginsResult {
  plugins: PluginInfo[]
}

export interface PluginReadmeResult {
  content: string
  skills: string[]
  agents: string[]
}

export interface InstallSkillResult {
  success: boolean
  error?: string
}

// ── Custom Commands ───────────────────────────────────────────

export interface CustomCommand {
  name: string        // slash command name, e.g. "deploy"
  description: string // first non-empty line from the .md file
  source: 'personal' | 'project'
  filePath: string
}

export interface ListCustomCommandsResult {
  commands: CustomCommand[]
}

// ── History ───────────────────────────────────────────────────

export interface SessionSummary {
  sessionId: string
  cwd: string
  lastUsed: number
  firstUserPrefix?: string   // first 5 chars — used in title
  lastUserSuffix?: string    // last 5 chars of last msg — used in title
  firstUserText?: string     // first ~80 chars — used in tooltip
  lastUserText?: string      // first ~80 chars of last msg — used in tooltip
  messageCount?: number
}

export interface ProjectHistory {
  cwd: string
  projectName: string
  encodedPath: string
  sessions: SessionSummary[]
  lastUsed: number
}

export interface AllHistoryResult {
  projects: ProjectHistory[]
}

export interface SessionMessage {
  role: 'user' | 'assistant'
  text: string
  isToolCall?: boolean
  toolName?: string
  fullInput?: string  // complete JSON input for tool calls
}

// ── Built-in skill registry (shared, no Node.js deps) ─────────

export interface BuiltInSkill {
  id: string
  name: string
  description: string
  url: string
}

export const BUILT_IN_SKILLS: BuiltInSkill[] = [
  {
    id: 'gstack',
    name: 'gstack',
    description: 'Garry Tan 风格产品决策框架：office-hours, ship, investigate, qa 等 20+ skills',
    url: 'https://github.com/ErikBjare/gstack',
  },
]

// ── File system / git types ───────────────────────────────────

export interface DirEntry {
  name: string
  isDir: boolean
  size?: number
}

export interface FileTreeNode {
  name: string
  isDir: boolean
  path: string
  size?: number
  children?: FileTreeNode[]
}

export interface FilePreviewResult {
  content: string
  totalLines: number
  language: string
  truncated: boolean
  tooLarge?: boolean
  isImage?: boolean
  mimeType?: string
}

export interface FileOperationResult {
  success: boolean
  error?: string
}

export type GitStatusCode = 'M' | 'A' | 'D' | 'R' | '?' | '!'

export interface GitStatusEntry {
  code: GitStatusCode
  staged: boolean
  file: string
}

export interface GitStatusResult {
  branch: string
  entries: GitStatusEntry[]
  error?: string
}

export interface GitStatus {
  branch: string
  upstream?: string
  ahead: number
  behind: number
  entries: GitStatusEntry[]
}

export interface GitLogEntry {
  sha: string
  shortSha: string
  message: string
  author: string
  date: string
  relativeDate: string
}

export interface GitCommitDetail {
  sha: string
  message: string
  author: string
  date: string
  stats: { added: number; deleted: number; files: number }
  diff: string
}

export interface GitWorktree {
  path: string
  branch: string
  isDetached: boolean
  dirty: boolean
}

export interface GitBranch {
  name: string
  isRemote: boolean
  isCurrent: boolean
  upstream?: string
  worktreePath?: string
}

export interface GitOperationResult {
  success: boolean
  error?: string
  output?: string
}

// ── ElectronAPI (window.electron) ────────────────────────────

export interface ElectronAPI {
  // Phase 0 — audit
  listSessions: (cwd: string) => Promise<ListSessionsResult>
  readSessionHistory: (sessionId: string, cwd: string) => Promise<ReadHistoryResult>
  exportCsv: (sessionId: string, cwd: string, settings: ExportSettings) => Promise<ExportCsvResult>

  // Auth
  claudeLogin: () => Promise<ClaudeLoginResult>

  // Phase 1 — chat
  startSession: (params: AgentStartParams) => Promise<{ sessionId: string }>
  abortSession: (sessionId: string) => Promise<void>
  respondPermission: (response: PermissionResponse) => Promise<void>
  sendToolResult: (params: { sessionId: string; toolUseId: string; content: string }) => Promise<void>
  selectFolder: () => Promise<string | null>
  getApiConfig: () => Promise<ApiConfig>
  setApiConfig: (config: ApiConfig) => Promise<void>
  getAgentSettings: () => Promise<AgentSettings>
  setAgentSettings: (settings: AgentSettings) => Promise<void>

  onAgentEvent: (cb: (data: { sessionId: string; msg: SDKMessage }) => void) => () => void
  onPermissionRequest: (cb: (data: PermissionRequest) => void) => () => void
  onAgentDone: (cb: (data: { sessionId: string }) => void) => () => void
  onAgentError: (cb: (data: { sessionId: string; error: string }) => void) => () => void

  // Phase 2 — hooks
  listHookEvents: (limit?: number) => Promise<ListHookEventsResult>
  onHookEvent: (cb: (event: HookEvent) => void) => () => void
  clearHookEvents: () => Promise<void>
  getBridgeStatus: () => Promise<HookBridgeStatus>
  injectBridge: () => Promise<HookBridgeStatus>
  testHookRule: (p: { command: string; eventName: string; payload: unknown }) => Promise<HookTestResult>

  // Phase 2 — subagent tree
  onSubagentEvent: (cb: (event: SubagentEvent) => void) => () => void

  // Phase 2 — claude settings
  getClaudeSettings: () => Promise<ClaudeSettings>
  saveClaudeSettings: (settings: ClaudeSettings) => Promise<void>
  getClaudeCliStatus: () => Promise<ClaudeCliStatus>

  // Notifications
  dockBounce: () => Promise<void>

  // Skills
  listSkills: () => Promise<SkillsResult>
  installSkillFromGit: (url: string, name?: string) => Promise<InstallSkillResult>
  deleteSkill: (skillId: string) => Promise<void>
  toggleSkill: (skillId: string, enabled: boolean) => Promise<void>
  getSkillContent: (skillPath: string) => Promise<{ content: string }>
  listPlugins: () => Promise<PluginsResult>
  installPlugin: (name: string) => Promise<InstallSkillResult>
  uninstallPlugin: (name: string) => Promise<PluginOperationResult>
  enablePlugin: (pluginId: string) => Promise<PluginOperationResult>
  disablePlugin: (pluginId: string) => Promise<PluginOperationResult>
  updatePlugin: (pluginId: string) => Promise<PluginOperationResult>
  getPluginReadme: (pluginId: string) => Promise<PluginReadmeResult>

  // Custom commands
  listCustomCommands: (cwd: string) => Promise<ListCustomCommandsResult>

  // Export
  exportMarkdown: (content: string, defaultName: string) => Promise<{ saved: boolean; filePath?: string }>
  exportPdf: (html: string, defaultName: string) => Promise<{ saved: boolean; filePath?: string }>

  // CLAUDE.md
  readClaudeMd: (cwd: string) => Promise<{ content: string; exists: boolean }>
  writeClaudeMd: (cwd: string, content: string) => Promise<void>

  // History
  listAllHistory: () => Promise<AllHistoryResult>
  loadSessionMessages: (encodedPath: string, sessionId: string) => Promise<{ messages: SessionMessage[] }>
  deleteSession: (encodedPath: string, sessionId: string) => Promise<void>
  deleteProject: (encodedPath: string) => Promise<void>

  // File system / git
  listDir: (params: { dirPath: string; depth?: number; cwd: string }) => Promise<FileTreeNode[]>
  readFile: (params: { path: string; maxLines?: number; cwd: string }) => Promise<FilePreviewResult>
  searchFiles: (params: { dirPath: string; query: string; cwd: string }) => Promise<string[]>
  createFile: (params: { path: string; isDir?: boolean; cwd: string }) => Promise<FileOperationResult>
  deleteFile: (params: { path: string; cwd: string }) => Promise<FileOperationResult>
  renameFile: (params: { oldPath: string; newPath: string; cwd: string }) => Promise<FileOperationResult>
  openInSystem: (params: { path: string }) => Promise<{ success: boolean; error?: string }>
  gitStatus: (cwd: string) => Promise<GitStatusResult>
  gitCommit: (params: { cwd: string; message: string }) => Promise<GitOperationResult>
  gitPush: (params: { cwd: string }) => Promise<GitOperationResult>
  gitLog: (params: { cwd: string; limit?: number }) => Promise<GitLogEntry[]>
  gitBranches: (params: { cwd: string }) => Promise<GitBranch[]>
  gitCheckout: (params: { cwd: string; branch: string }) => Promise<GitOperationResult>
  gitDiff: (params: { cwd: string; file?: string }) => Promise<string>
  gitCommitDetail: (params: { cwd: string; sha: string }) => Promise<GitCommitDetail>
  gitWorktrees: (params: { cwd: string }) => Promise<GitWorktree[]>
  gitDeriveWorktree: (params: { cwd: string; branch: string; path: string }) => Promise<GitOperationResult>
  gitCreateBranch: (params: { cwd: string; branch: string; startPoint?: string }) => Promise<GitOperationResult>
  onGitError: (cb: (data: { message: string }) => void) => () => void

  // Provider management
  listProviders: () => Promise<{ providers: ProviderConfig[]; activeId: string | null }>
  createProvider: (provider: Omit<ProviderConfig, 'id'>) => Promise<{ id: string }>
  updateProvider: (id: string, updates: Partial<ProviderConfig>) => Promise<void>
  deleteProvider: (id: string) => Promise<void>
  activateProvider: (id: string) => Promise<void>
  activateOfficial: () => Promise<void>
  testProvider: (id: string, config?: { baseUrl: string; modelId: string; apiFormat: ApiFormat }) => Promise<ProviderTestResult>
  testProviderConfig: (config: { baseUrl: string; apiKey: string; modelId: string; apiFormat: ApiFormat }) => Promise<ProviderTestResult>
  listProviderPresets: () => Promise<{ presets: ProviderPreset[] }>
  getProviderSettings: () => Promise<Record<string, unknown>>
  updateProviderSettings: (settings: Record<string, unknown>) => Promise<void>
  diagnoseProvider: (id: string) => Promise<DiagResult>

  // Agent management
  listAgents: (cwd?: string) => Promise<{ agents: AgentDefinition[]; activeAgents: string[] }>
  getAgentDetail: (agentType: string, source: AgentSource, cwd?: string) => Promise<AgentDefinition | null>

  // MCP servers
  listMcpServers: (cwd: string) => Promise<{ servers: McpServerRecord[] }>
  saveMcpServer: (server: McpServerRecord) => Promise<void>
  deleteMcpServer: (name: string, scope: 'user' | 'project' | 'local') => Promise<void>
  toggleMcpServer: (name: string, scope: 'user' | 'project' | 'local', enabled: boolean) => Promise<void>

  // Computer Use
  getComputerUseConfig: () => Promise<ComputerUseConfig>
  setComputerUseConfig: (config: ComputerUseConfig) => Promise<void>
  getMacOsPermissions: () => Promise<ComputerUseTccState>
  openUrl: (url: string) => Promise<void>
  listInstalledApps: () => Promise<{ apps: InstalledApp[] }>
  openFilePreview: (params: { filePath: string; cwd: string; theme?: string }) => Promise<void>
  onPreviewData: (cb: (data: FilePreviewResult & { filePath: string; theme?: string }) => void) => (() => void)
}

declare global {
  interface Window {
    electron: ElectronAPI
  }
}

// ── Generative UI Widgets ─────────────────────────────────────

export type WidgetType = 'svg' | 'chart' | 'table' | 'calculator' | 'form'

export interface WidgetConfig {
  type: WidgetType
  title: string
  data: Record<string, unknown>
  config?: Record<string, unknown>
}

// ── Provider Management ─────────────────────────────────────

export type ApiFormat = 'anthropic' | 'openai_chat' | 'openai_responses'

export interface ModelMapping {
  main: string
  haiku: string
  sonnet: string
  opus: string
}

export interface ProviderConfig {
  id: string
  presetId: string
  name: string
  baseUrl: string
  apiKey: string
  apiFormat: ApiFormat
  models: ModelMapping
  notes?: string
  isActive?: boolean
}

export interface ProviderPreset {
  id: string
  name: string
  baseUrl: string
  apiFormat?: ApiFormat
  defaultModels: ModelMapping
  needsApiKey: boolean
  websiteUrl: string
}

export interface ProviderTestResult {
  connectivity: {
    success: boolean
    latencyMs: number
    error?: string
  }
  proxy?: {
    success: boolean
    latencyMs: number
    error?: string
  }
}

export type DiagSeverity = 'pass' | 'warn' | 'error'

export interface DiagFinding {
  severity: DiagSeverity
  message: string
  detail?: string
}

export interface DiagProbe {
  name: string
  status: DiagSeverity
  findings: DiagFinding[]
  durationMs: number
}

export interface DiagResult {
  overall: DiagSeverity
  probes: DiagProbe[]
  timestamp: string
  durationMs: number
}

// ── Claude CLI Status ────────────────────────────────────────

export interface ClaudeCliStatus {
  found: boolean
  binaryPath?: string
  version?: string
  auth: {
    oauthToken: boolean
    apiKeyEnv: boolean
    apiKeyFile: boolean
    credentialsPath?: string
  }
  configDir: string
  settingsPath: string
  settingsExists: boolean
}

// ── Agent Definitions ───────────────────────────────────────

export type AgentSource = 'userSettings' | 'projectSettings' | 'localSettings' | 'policySettings' | 'plugin' | 'flagSettings' | 'built-in'

export interface AgentDefinition {
  agentType: string
  source: AgentSource
  plugin?: string
  description?: string
  systemPrompt?: string
  tools?: string[]
  modelDisplay?: string
  color?: string
  isActive: boolean
  overriddenBy?: AgentSource
  baseDir?: string
}

// ── Computer Use ────────────────────────────────────────────

export type ComputerUsePermissionMode =
  | 'default'
  | 'plan'
  | 'acceptEdits'
  | 'bypassPermissions'
  | 'dontAsk'
  | 'auto'

export interface ComputerUseGrantFlags {
  clipboardRead: boolean
  clipboardWrite: boolean
  systemKeyCombos: boolean
}

export type ComputerUseAppPermissionTier = 'read' | 'click' | 'full'

export interface InstalledApp {
  bundleId: string
  displayName: string
  path: string
}

export interface ComputerUseAuthorizedApp {
  bundleId: string
  displayName: string
  tier: ComputerUseAppPermissionTier
}

export interface ComputerUseTccState {
  accessibility: boolean
  screenRecording: boolean
}

export interface ComputerUseConfig {
  enabled: boolean
  permissionMode: ComputerUsePermissionMode
  screenshotTool?: string
  authorizedApps: ComputerUseAuthorizedApp[]
  grantFlags: ComputerUseGrantFlags
}

// ── MCP Servers ─────────────────────────────────────────────

export type McpScope = 'user' | 'project' | 'local' | 'plugin'

export interface McpServerConfig {
  type: 'stdio' | 'http' | 'sse'
  command?: string
  args?: string[]
  env?: Record<string, string>
  url?: string
  headers?: Record<string, string>
  headersHelper?: string
  oauth?: {
    clientId?: string
    callbackPort?: number
  }
}

export interface McpServerRecord {
  name: string
  config: McpServerConfig
  transport: 'stdio' | 'http' | 'sse'
  scope: 'user' | 'project' | 'local' | 'plugin'
  enabled: boolean
  status: 'connected' | 'checking' | 'needs-auth' | 'failed' | 'disabled'
  statusLabel: string
  statusDetail?: string
  summary: string
  canToggle: boolean
  canEdit: boolean
  canRemove: boolean
  canReconnect: boolean
  configLocation: string
}
