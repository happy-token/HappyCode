import { query } from '@anthropic-ai/claude-agent-sdk'
import type { PermissionResult, Query, SDKUserMessage } from '@anthropic-ai/claude-agent-sdk'
import type { ContentBlockParam } from '@anthropic-ai/sdk/resources'
import type { BrowserWindow } from 'electron'
import type { AgentStartParams, Attachment, SDKMessage, PermissionResponse, SubagentNodeInfo, SubagentEvent } from '../shared/types'

async function* attachmentPromptStream(
  prompt: string,
  attachments: Attachment[],
): AsyncGenerator<SDKUserMessage, void, undefined> {
  const content: ContentBlockParam[] = attachments.map((att) => ({
    type: 'image' as const,
    source: {
      type: 'base64' as const,
      media_type: att.mimeType,
      data: att.data,
    },
  }))
  if (prompt.trim()) content.push({ type: 'text' as const, text: prompt })
  yield {
    type: 'user',
    message: { role: 'user', content },
    parent_tool_use_id: null,
  }
}

interface ActiveSession {
  sessionId: string
  permissionCallbacks: Map<string, (allowed: boolean) => void>
  askQuestionResolvers: Array<(result: PermissionResult) => void>
  abort: AbortController
  query: Query
}

export class AgentManager {
  private sessions = new Map<string, ActiveSession>()

  constructor(private win: BrowserWindow) {
    win.on('closed', () => this.abortAll())
  }

  private send(channel: string, payload: unknown): void {
    if (!this.win.isDestroyed()) {
      this.win.webContents.send(channel, payload)
    }
  }

  abortAll(): void {
    for (const session of this.sessions.values()) {
      session.abort.abort()
    }
  }

  // Returns the new sessionId immediately; streams events via webContents.send
  startSession(params: AgentStartParams): string {
    const { prompt, cwd, resumeId, model, apiConfig, agentSettings, attachments } = params

    // Generate a temporary ID; real session_id comes from system/init event
    const tempId = `pending-${Date.now()}`
    const abort = new AbortController()
    const permissionCallbacks = new Map<string, (allowed: boolean) => void>()
    const askQuestionResolvers: Array<(result: PermissionResult) => void> = []

    // Placeholder; real Query object assigned below before session is used
    const session: ActiveSession = { sessionId: tempId, permissionCallbacks, askQuestionResolvers, abort, query: null! }
    this.sessions.set(tempId, session)

    ;(async () => {
      let resolvedSessionId = tempId
      const subagentNodes = new Map<string, SubagentNodeInfo>()

      try {
        const sdkEnv: Record<string, string> = {}
        if (apiConfig?.baseUrl) sdkEnv['ANTHROPIC_BASE_URL'] = apiConfig.baseUrl
        if (apiConfig?.authToken) sdkEnv['ANTHROPIC_AUTH_TOKEN'] = apiConfig.authToken

        const permMode = agentSettings?.permissionMode ?? 'default'
        const allowedList = agentSettings?.allowedTools
          ? agentSettings.allowedTools.split(',').map((s) => s.trim()).filter(Boolean)
          : undefined
        const disallowedList = agentSettings?.disallowedTools
          ? agentSettings.disallowedTools.split(',').map((s) => s.trim()).filter(Boolean)
          : undefined
        const addDirs = agentSettings?.additionalDirectories
          ? agentSettings.additionalDirectories.split(',').map((s) => s.trim()).filter(Boolean)
          : undefined

        type SdkThinkingConfig = import('@anthropic-ai/claude-agent-sdk').ThinkingConfig
        const thinkingConfig: SdkThinkingConfig | undefined = (() => {
          const mode = agentSettings?.thinking
          if (!mode || mode === 'adaptive') return { type: 'adaptive' as const }
          if (mode === 'disabled') return { type: 'disabled' as const }
          // enabled: use budgetTokens if provided
          return { type: 'enabled' as const, budgetTokens: agentSettings.maxThinkingTokens || undefined }
        })()

        const promptArg = attachments?.length
          ? attachmentPromptStream(prompt, attachments)
          : prompt

        const q = query({
          prompt: promptArg,
          options: {
            cwd,
            resume: resumeId,
            model: model || undefined,
            env: Object.keys(sdkEnv).length > 0 ? sdkEnv : undefined,
            abortController: abort,
            permissionMode: permMode as import('@anthropic-ai/claude-agent-sdk').PermissionMode,
            allowDangerouslySkipPermissions: permMode === 'bypassPermissions' ? true : undefined,
            maxTurns: agentSettings?.maxTurns || undefined,
            allowedTools: allowedList,
            disallowedTools: disallowedList,
            systemPrompt: agentSettings?.systemPrompt || undefined,
            additionalDirectories: addDirs,
            thinking: thinkingConfig,
            effort: agentSettings?.effort || undefined,
            maxBudgetUsd: agentSettings?.maxBudgetUsd || undefined,
            fallbackModel: agentSettings?.fallbackModel || undefined,
            betas: agentSettings?.context1mBeta ? ['context-1m-2025-08-07' as import('@anthropic-ai/claude-agent-sdk').SdkBeta] : undefined,
            enableFileCheckpointing: agentSettings?.enableFileCheckpointing || undefined,
            mcpServers: (() => {
              if (!agentSettings?.mcpServersJson?.trim()) return undefined
              try { return JSON.parse(agentSettings.mcpServersJson) as Record<string, import('@anthropic-ai/claude-agent-sdk').McpServerConfig> }
              catch { return undefined }
            })(),
            canUseTool: async (toolName: string, toolInput: Record<string, unknown>): Promise<PermissionResult> => {
              // AskUserQuestion: hold until user answers; the answer is piped via sendToolResult
              if (toolName === 'AskUserQuestion') {
                return new Promise<PermissionResult>((resolve) => {
                  session.askQuestionResolvers.push(resolve)
                })
              }

              // Other Claude-internal tools never need user permission — auto-allow them
              const INTERNAL_TOOLS = new Set([
                'ExitPlanMode', 'EnterPlanMode',
                'TodoWrite', 'TaskCreate', 'TaskUpdate', 'TaskList', 'TaskGet',
                'PushNotification', 'ScheduleWakeup', 'CronCreate', 'CronDelete', 'CronList',
              ])
              if (INTERNAL_TOOLS.has(toolName)) return { behavior: 'allow' }

              const reqId = crypto.randomUUID()
              this.send('agent:permission-request', {
                sessionId: resolvedSessionId,
                reqId,
                toolName,
                toolInput,
              })
              return new Promise<PermissionResult>((resolve) => {
                permissionCallbacks.set(reqId, (allowed: boolean) => {
                  resolve(
                    allowed
                      ? { behavior: 'allow' }
                      : { behavior: 'deny', message: 'User denied' }
                  )
                })
              })
            },
          },
        })
        session.query = q

        for await (const msg of q) {
          const sdkMsg = msg as SDKMessage

          if (sdkMsg.type === 'system') {
            const sub = (sdkMsg as { subtype: string }).subtype

            if (sub === 'init') {
              const initMsg = sdkMsg as { type: 'system'; subtype: 'init'; session_id: string }
              if (initMsg.session_id && initMsg.session_id !== tempId) {
                resolvedSessionId = initMsg.session_id
                this.sessions.delete(tempId)
                session.sessionId = resolvedSessionId
                this.sessions.set(resolvedSessionId, session)
              }
            } else if (sub === 'task_started') {
              const ev = sdkMsg as { type: 'system'; subtype: 'task_started'; task_id: string; description: string; task_type?: string }
              const node: SubagentNodeInfo = {
                id: ev.task_id,
                parentId: resolvedSessionId,
                agentType: ev.task_type ?? 'agent',
                description: ev.description,
                status: 'running',
                startedAt: Date.now(),
              }
              subagentNodes.set(node.id, node)
              const event: SubagentEvent = { rootSessionId: resolvedSessionId, node: { ...node } }
              this.send('agent:subagent-event', event)
            } else if (sub === 'task_notification') {
              const ev = sdkMsg as { type: 'system'; subtype: 'task_notification'; task_id: string; status: 'completed' | 'failed' | 'stopped'; usage?: { input_tokens: number; output_tokens: number } }
              const existing = subagentNodes.get(ev.task_id)
              if (existing) {
                existing.status = ev.status === 'completed' ? 'done' : 'error'
                existing.usage = ev.usage
                existing.stoppedAt = Date.now()
                const event: SubagentEvent = { rootSessionId: resolvedSessionId, node: { ...existing } }
                this.send('agent:subagent-event', event)
              }
            }
          }

          this.send('agent:event', {
            sessionId: resolvedSessionId,
            msg: sdkMsg,
          })
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return
        this.send('agent:error', {
          sessionId: resolvedSessionId,
          error: err instanceof Error ? err.message : String(err),
        })
      } finally {
        this.sessions.delete(resolvedSessionId)
        this.send('agent:done', { sessionId: resolvedSessionId })
      }
    })().catch((err: unknown) => {
      console.error('[AgentManager] session', tempId, 'unhandled error:', err)
    })

    return tempId
  }

  sendToolResult(sessionId: string, _toolUseId: string, content: string): void {
    const session = this.sessions.get(sessionId)
    if (!session) return
    // Resolve canUseTool with deny to prevent headless AskUserQuestion execution.
    // The subprocess creates a single tool_result containing the user's answer.
    const askResolve = session.askQuestionResolvers.shift()
    if (askResolve) askResolve({ behavior: 'deny', message: content })
  }

  respondPermission(response: PermissionResponse): void {
    const session = this.sessions.get(response.sessionId)
    const resolve = session?.permissionCallbacks.get(response.reqId)
    if (resolve) {
      resolve(response.allowed)
      session?.permissionCallbacks.delete(response.reqId)
    }
  }

  abortSession(sessionId: string): void {
    this.sessions.get(sessionId)?.abort.abort()
  }
}
