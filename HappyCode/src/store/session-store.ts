import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type {
  UIMessage,
  SDKMessage,
  ContentBlock,
  AskQuestion,
  Todo,
  PermissionRequest,
  Attachment,
} from '../../electron/shared/types'
import { useApiConfigStore } from './api-config-store'
import { useUiStore } from './ui-store'

interface ChatState {
  // Active session
  sessionId: string | null
  lastSessionId: string | null
  status: 'idle' | 'running' | 'done' | 'error'
  messages: UIMessage[]
  todos: Todo[]
  pendingPermission: PermissionRequest | null
  model: string

  // Actions
  setModel: (model: string) => void
  setSessionForResume: (sessionId: string) => void
  loadAndResumeSession: (encodedPath: string, sessionId: string, cwd: string) => Promise<void>
  startSession: (prompt: string, resumeId?: string, attachments?: Attachment[]) => Promise<void>
  triggerCompact: () => Promise<void>
  addLocalMessage: (text: string) => void
  abortSession: () => void
  respondPermission: (allowed: boolean) => void
  sendToolResult: (toolUseId: string, content: string) => void
  handleAgentEvent: (sessionId: string, msg: SDKMessage) => void
  handleAgentDone: (sessionId: string) => void
  handleAgentError: (sessionId: string, error: string) => void
  handlePermissionRequest: (req: PermissionRequest) => void
  resetSession: () => void
}

function makeId(): string {
  return crypto.randomUUID()
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function isRealSessionId(id: string | null | undefined): id is string {
  return !!id && UUID_RE.test(id)
}

function summarizeInput(input: unknown): string {
  if (!input || typeof input !== 'object') return ''
  const obj = input as Record<string, unknown>
  const parts: string[] = []
  for (const [k, v] of Object.entries(obj)) {
    const val = typeof v === 'string' ? v.slice(0, 80) : JSON.stringify(v).slice(0, 80)
    parts.push(`${k}: ${val}`)
    if (parts.length >= 3) break
  }
  return parts.join(', ')
}

function parseTodos(input: unknown): Todo[] {
  if (!input || typeof input !== 'object') return []
  const obj = input as Record<string, unknown>
  const todos = obj['todos']
  if (!Array.isArray(todos)) return []
  return todos.map((t) => {
    const todo = t as Record<string, unknown>
    return {
      content: String(todo['content'] ?? ''),
      status: (todo['status'] as Todo['status']) ?? 'pending',
      activeForm: todo['activeForm'] as string | undefined,
    }
  })
}

function parseAskQuestions(input: unknown): AskQuestion[] {
  if (!input || typeof input !== 'object') return []
  const obj = input as Record<string, unknown>
  const questions = Array.isArray(obj['questions']) ? obj['questions'] : []
  return (questions as Record<string, unknown>[]).map((q) => ({
    question: String(q['question'] ?? ''),
    header: q['header'] as string | undefined,
    multiSelect: Boolean(q['multiSelect'] ?? false),
    options: Array.isArray(q['options'])
      ? (q['options'] as Record<string, unknown>[]).map((o) => ({
          label: String(o['label'] ?? ''),
          description: o['description'] as string | undefined,
          preview: o['preview'] as string | undefined,
        }))
      : [],
  }))
}

function processContentBlock(
  block: ContentBlock,
  messages: UIMessage[],
  todos: Todo[]
): { messages: UIMessage[]; todos: Todo[] } {
  const msgs = [...messages]

  if (block.type === 'text') {
    const text = (block as { type: 'text'; text: string }).text
    const last = msgs[msgs.length - 1]
    if (last && last.type === 'text' && last.streaming) {
      msgs[msgs.length - 1] = { ...last, text: last.text + text }
    } else {
      msgs.push({ id: makeId(), type: 'text', text, streaming: false })
    }
    return { messages: msgs, todos }
  }

  if (block.type === 'thinking') {
    const thinking = (block as { type: 'thinking'; thinking: string }).thinking
    msgs.push({ id: makeId(), type: 'thinking', text: thinking })
    return { messages: msgs, todos }
  }

  if (block.type === 'tool_use') {
    const { id: toolUseId, name, input } = block as {
      id: string
      name: string
      input: unknown
    }

    if (name === 'AskUserQuestion') {
      const questions = parseAskQuestions(input)
      msgs.push({ id: makeId(), type: 'ask', toolUseId, questions })
      return { messages: msgs, todos }
    }

    if (name === 'TodoWrite') {
      const newTodos = parseTodos(input)
      const planText = newTodos
        .map((t) => `[${t.status === 'completed' ? 'x' : t.status === 'in_progress' ? '~' : ' '}] ${t.content}`)
        .join('\n')
      msgs.push({ id: makeId(), type: 'plan', toolUseId, plan: planText })
      return { messages: msgs, todos: newTodos }
    }

    if (name === 'Edit' && input && typeof input === 'object') {
      const obj = input as Record<string, unknown>
      msgs.push({
        id: makeId(),
        type: 'diff',
        toolUseId,
        filePath: String(obj['file_path'] ?? ''),
        oldString: String(obj['old_string'] ?? ''),
        newString: String(obj['new_string'] ?? ''),
        toolName: 'Edit',
      })
      return { messages: msgs, todos }
    }

    if (name === 'Write' && input && typeof input === 'object') {
      const obj = input as Record<string, unknown>
      msgs.push({
        id: makeId(),
        type: 'diff',
        toolUseId,
        filePath: String(obj['file_path'] ?? ''),
        oldString: '',
        newString: String(obj['content'] ?? ''),
        toolName: 'Write',
      })
      return { messages: msgs, todos }
    }

    if (name === 'MultiEdit' && input && typeof input === 'object') {
      const obj = input as Record<string, unknown>
      const edits = Array.isArray(obj['edits']) ? (obj['edits'] as Record<string, unknown>[]) : []
      const oldStr = edits.map((e) => String(e['old_string'] ?? '')).join('\n---\n')
      const newStr = edits.map((e) => String(e['new_string'] ?? '')).join('\n---\n')
      msgs.push({
        id: makeId(),
        type: 'diff',
        toolUseId,
        filePath: String(obj['file_path'] ?? ''),
        oldString: oldStr,
        newString: newStr,
        toolName: 'MultiEdit',
      })
      return { messages: msgs, todos }
    }

    msgs.push({
      id: makeId(),
      type: 'tool_call',
      toolUseId,
      toolName: name,
      inputSummary: summarizeInput(input),
    })
    return { messages: msgs, todos }
  }

  return { messages: msgs, todos }
}

export const useChatStore = create<ChatState>()(
  immer((set, get) => ({
    sessionId: null,
    lastSessionId: null,
    status: 'idle',
    messages: [],
    todos: [],
    pendingPermission: null,
    model: '',

    setModel: (model) =>
      set((s) => {
        s.model = model
      }),

    resetSession: () =>
      set((s) => {
        s.sessionId = null
        s.status = 'idle'
        s.messages = []
        s.todos = []
        s.pendingPermission = null
      }),

    setSessionForResume: (sessionId) =>
      set((s) => {
        s.sessionId = sessionId
        s.status = 'done'
        s.messages = []
        s.todos = []
        s.pendingPermission = null
      }),

    loadAndResumeSession: async (encodedPath, sessionId, cwd) => {
      useUiStore.getState().setCwd(cwd)
      set((s) => {
        s.sessionId = sessionId
        s.status = 'done'
        s.messages = []
        s.todos = []
        s.pendingPermission = null
      })
      try {
        const { messages: rawMessages } = await window.electron.loadSessionMessages(encodedPath, sessionId)
        const uiMessages: UIMessage[] = []
        for (const m of rawMessages) {
          if (m.role === 'user') {
            uiMessages.push({ id: makeId(), type: 'user', text: m.text })
          } else if (m.isToolCall) {
            uiMessages.push({
              id: makeId(),
              type: 'tool_call',
              toolUseId: makeId(),
              toolName: m.toolName ?? 'Tool',
              inputSummary: m.text,
            })
          } else {
            uiMessages.push({ id: makeId(), type: 'text', text: m.text })
          }
        }
        // Add a done marker so the session shows as completed and ready for follow-up
        uiMessages.push({ id: makeId(), type: 'done', costUsd: 0, inputTokens: 0, outputTokens: 0 })
        set((s) => {
          s.messages = uiMessages
        })
      } catch {
        // If loading fails, keep session ready for follow-up without history
      }
    },

    startSession: async (prompt, resumeId, attachments) => {
      const existingSessionId = get().sessionId
      // Only resume if we have a real UUID — never pass a temp "pending-xxx" ID to the CLI
      const isFollowUp = isRealSessionId(existingSessionId) && get().status === 'done'

      const attachmentPreviews = attachments?.map((a) => ({
        name: a.name,
        dataUrl: `data:${a.mimeType};base64,${a.data}`,
      }))

      set((s) => {
        s.status = 'running'
        s.pendingPermission = null
        const userMsg = { id: makeId(), type: 'user' as const, text: prompt, attachments: attachmentPreviews }
        if (isFollowUp) {
          s.messages.push(userMsg)
        } else {
          s.messages = [userMsg]
          s.todos = []
        }
      })
      try {
        const { config: apiConfig, agentSettings } = useApiConfigStore.getState()
        const { sessionId: tempId } = await window.electron.startSession({
          prompt,
          cwd: useUiStore.getState().cwd,
          model: get().model || undefined,
          apiConfig: apiConfig.baseUrl ? apiConfig : undefined,
          agentSettings: Object.keys(agentSettings).length > 0 ? agentSettings : undefined,
          resumeId: resumeId ?? (isFollowUp ? existingSessionId : undefined),
          attachments: attachments?.length ? attachments : undefined,
        })
        set((s) => {
          // Don't overwrite a real UUID that handleAgentEvent may have already set
          if (!isRealSessionId(s.sessionId)) {
            s.sessionId = tempId
          }
        })
      } catch (err: unknown) {
        set((s) => {
          s.status = 'error'
          s.messages.push({
            id: makeId(),
            type: 'error',
            text: err instanceof Error ? err.message : String(err),
          })
        })
      }
    },

    triggerCompact: async () => {
      const { sessionId, model } = get()
      if (!isRealSessionId(sessionId)) return
      const { config: apiConfig, agentSettings } = useApiConfigStore.getState()
      set((s) => { s.status = 'running' })
      try {
        await window.electron.startSession({
          prompt: '/compact',
          cwd: useUiStore.getState().cwd,
          model: model || undefined,
          apiConfig: apiConfig.baseUrl ? apiConfig : undefined,
          agentSettings: Object.keys(agentSettings).length > 0 ? agentSettings : undefined,
          resumeId: sessionId,
        })
      } catch (err: unknown) {
        set((s) => {
          s.status = 'error'
          s.messages.push({
            id: makeId(),
            type: 'error',
            text: err instanceof Error ? err.message : String(err),
          })
        })
      }
    },

    addLocalMessage: (text) =>
      set((s) => {
        s.messages.push({ id: makeId(), type: 'text', text })
      }),

    sendToolResult: (toolUseId, content) => {
      const { sessionId } = get()
      if (!sessionId) return
      void window.electron.sendToolResult({ sessionId, toolUseId, content })
      set((s) => {
        const msg = s.messages.find((m) => m.type === 'ask' && m.toolUseId === toolUseId)
        if (msg && msg.type === 'ask') msg.answered = true
      })
    },

    abortSession: () => {
      const { sessionId } = get()
      if (sessionId) {
        void window.electron.abortSession(sessionId)
      }
      set((s) => {
        s.status = 'idle'
      })
    },

    respondPermission: (allowed) => {
      const { sessionId, pendingPermission } = get()
      if (!sessionId || !pendingPermission) return
      void window.electron.respondPermission({
        sessionId,
        reqId: pendingPermission.reqId,
        allowed,
      })
      set((s) => {
        s.pendingPermission = null
      })
    },

    handlePermissionRequest: (req) =>
      set((s) => {
        s.pendingPermission = req
      }),

    handleAgentEvent: (sessionId, msg) => {
      set((s) => {
        // Update sessionId if it differs (temp → real)
        if (s.sessionId !== sessionId) s.sessionId = sessionId

        if (msg.type === 'system' && (msg as { subtype: string }).subtype === 'compact_boundary') {
          s.messages.push({ id: makeId(), type: 'compact_boundary' })
          return
        }

        if (msg.type === 'assistant') {
          const assistantMsg = msg as { type: 'assistant'; message: { content: ContentBlock[] } }
          let msgs = [...s.messages]
          let todos = [...s.todos]
          for (const block of assistantMsg.message.content) {
            const result = processContentBlock(block, msgs, todos)
            msgs = result.messages
            todos = result.todos
          }
          s.messages = msgs
          s.todos = todos
          return
        }

        if (msg.type === 'result') {
          const resultMsg = msg as { type: 'result'; subtype: string }
          if (resultMsg.subtype === 'success') {
            const ok = msg as { type: 'result'; subtype: 'success'; cost_usd: number; usage: { input_tokens: number; output_tokens: number } }
            s.messages.push({
              id: makeId(),
              type: 'done',
              costUsd: ok.cost_usd ?? 0,
              inputTokens: ok.usage?.input_tokens ?? 0,
              outputTokens: ok.usage?.output_tokens ?? 0,
            })
          } else {
            const err = msg as { type: 'result'; subtype: 'error_during_execution'; error: string }
            s.messages.push({ id: makeId(), type: 'error', text: err.error ?? 'Unknown error' })
          }
        }
      })
    },

    handleAgentDone: (_sessionId) =>
      set((s) => {
        s.status = 'done'
        if (isRealSessionId(s.sessionId)) {
          s.lastSessionId = s.sessionId
        }
      }),

    handleAgentError: (_sessionId, error) =>
      set((s) => {
        s.status = 'error'
        s.messages.push({ id: makeId(), type: 'error', text: error })
      }),
  }))
)
