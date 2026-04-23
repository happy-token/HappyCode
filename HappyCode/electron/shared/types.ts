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
  hook_type: 'PreToolUse' | 'PostToolUse' | 'Stop' | 'Notification' | string
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

// ── Claude Settings (hooks config) ────────────────────────────

export type HookType = 'PreToolUse' | 'PostToolUse' | 'Stop' | 'Notification'

export interface ClaudeHookRule {
  matcher: string
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
  | { id: string; type: 'tool_call'; toolUseId: string; toolName: string; inputSummary: string }
  | { id: string; type: 'diff'; toolUseId: string; filePath: string; oldString: string; newString: string; toolName: 'Edit' | 'Write' | 'MultiEdit' }
  | { id: string; type: 'ask'; toolUseId: string; questions: AskQuestion[]; answered?: boolean }
  | { id: string; type: 'plan'; toolUseId: string; plan: string }
  | { id: string; type: 'error'; text: string }
  | { id: string; type: 'compact_boundary' }
  | { id: string; type: 'done'; costUsd: number; inputTokens: number; outputTokens: number }

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

export interface SkillInfo {
  id: string
  name: string
  path: string
  enabled: boolean
  description?: string
  lastModified: number
}

export interface SkillsResult {
  skills: SkillInfo[]
}

export interface PluginInfo {
  id: string
  name: string
  version?: string
  enabled: boolean
}

export interface PluginsResult {
  plugins: PluginInfo[]
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

// ── ElectronAPI (window.electron) ────────────────────────────

export interface ElectronAPI {
  // Phase 0 — audit
  listSessions: (cwd: string) => Promise<ListSessionsResult>
  readSessionHistory: (sessionId: string, cwd: string) => Promise<ReadHistoryResult>
  exportCsv: (sessionId: string, cwd: string) => Promise<ExportCsvResult>

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

  // Phase 2 — subagent tree
  onSubagentEvent: (cb: (event: SubagentEvent) => void) => () => void

  // Phase 2 — claude settings
  getClaudeSettings: () => Promise<ClaudeSettings>
  saveClaudeSettings: (settings: ClaudeSettings) => Promise<void>

  // Notifications
  dockBounce: () => Promise<void>

  // Skills
  listSkills: () => Promise<SkillsResult>
  installSkillFromGit: (url: string, name?: string) => Promise<InstallSkillResult>
  deleteSkill: (skillId: string) => Promise<void>
  toggleSkill: (skillId: string, enabled: boolean) => Promise<void>
  getSkillContent: (skillId: string) => Promise<{ content: string }>
  listPlugins: () => Promise<PluginsResult>
  installPlugin: (name: string) => Promise<InstallSkillResult>
  removePlugin: (name: string) => Promise<InstallSkillResult>

  // Custom commands
  listCustomCommands: (cwd: string) => Promise<ListCustomCommandsResult>

  // History
  listAllHistory: () => Promise<AllHistoryResult>
  loadSessionMessages: (encodedPath: string, sessionId: string) => Promise<{ messages: SessionMessage[] }>
  deleteSession: (encodedPath: string, sessionId: string) => Promise<void>
  deleteProject: (encodedPath: string) => Promise<void>
}

declare global {
  interface Window {
    electron: ElectronAPI
  }
}
