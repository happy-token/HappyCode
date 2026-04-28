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

export type PermissionMode = 'ask' | 'auto' | 'plan' | 'bypass'

export interface TabState {
  tabId: string
  cwd: string
  sessionId: string | null
  lastSessionId: string | null
  loadedFromSessionId: string | null  // session ID whose JSONL history was loaded into this tab
  status: 'idle' | 'running' | 'done' | 'error'
  messages: UIMessage[]
  todos: Todo[]
  pendingPermission: PermissionRequest | null
  model: string
  permissionMode: PermissionMode
  showDoneIndicator: boolean  // show ✓ in sidebar until user clicks to view
}

// Derived status for sidebar display
export type DisplayStatus = 'running' | 'exec' | 'done' | 'error'

export function getDisplayStatus(tab: TabState): DisplayStatus {
  if (tab.status === 'running') {
    // Check if waiting for user action (permission or AskUserQuestion)
    if (tab.pendingPermission) return 'exec'
    const unansweredAsk = tab.messages.find((m) => m.type === 'ask' && !m.answered)
    if (unansweredAsk) return 'exec'
    return 'running'
  }
  if (tab.status === 'error') return 'error'
  if (tab.status === 'done') return 'done'
  return 'done' // idle treated as done
}

export interface TabStoreState {
  tabs: TabState[]
  activeTabId: string

  addTab: (cwd?: string) => void
  closeTab: (tabId: string) => void
  setActiveTab: (tabId: string) => void
  clearDoneIndicator: (tabId: string) => void

  setModel: (model: string) => void
  setPermissionMode: (mode: PermissionMode) => void
  setCwd: (cwd: string) => void
  resetSession: () => void
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
}

// ── Selectors ─────────────────────────────────────────────────
export function selectActiveTab(s: TabStoreState): TabState | undefined {
  return s.tabs.find((t) => t.tabId === s.activeTabId)
}

// ── Helpers ───────────────────────────────────────────────────
function makeId(): string {
  return crypto.randomUUID()
}

function makeTab(cwd = ''): TabState {
  return {
    tabId: crypto.randomUUID(),
    cwd,
    sessionId: null,
    lastSessionId: null,
    loadedFromSessionId: null,
    status: 'idle',
    messages: [],
    todos: [],
    pendingPermission: null,
    model: '',
    permissionMode: 'ask',
    showDoneIndicator: false,
  }
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

function processBlock(
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
    const { id: toolUseId, name, input } = block as { id: string; name: string; input: unknown }

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
        id: makeId(), type: 'diff', toolUseId,
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
        id: makeId(), type: 'diff', toolUseId,
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
      msgs.push({
        id: makeId(), type: 'diff', toolUseId,
        filePath: String(obj['file_path'] ?? ''),
        oldString: edits.map((e) => String(e['old_string'] ?? '')).join('\n---\n'),
        newString: edits.map((e) => String(e['new_string'] ?? '')).join('\n---\n'),
        toolName: 'MultiEdit',
      })
      return { messages: msgs, todos }
    }

    msgs.push({ id: makeId(), type: 'tool_call', toolUseId, toolName: name, inputSummary: summarizeInput(input), fullInput: JSON.stringify(input, null, 2) })
    return { messages: msgs, todos }
  }

  return { messages: msgs, todos }
}

// ── Store ──────────────────────────────────────────────────────
const initialTab = makeTab()

export const useTabStore = create<TabStoreState>()(
  immer((set, get) => ({
    tabs: [initialTab],
    activeTabId: initialTab.tabId,

    addTab: (cwd = '') => {
      const tab = makeTab(cwd)
      set((s) => {
        s.tabs.push(tab)
        s.activeTabId = tab.tabId
      })
    },

    closeTab: (tabId) => {
      const tabToClose = get().tabs.find((t) => t.tabId === tabId)
      if (tabToClose?.status === 'running' && tabToClose.sessionId) {
        void window.electron.abortSession(tabToClose.sessionId)
      }
      set((s) => {
        const idx = s.tabs.findIndex((t) => t.tabId === tabId)
        if (idx === -1) return
        if (s.tabs.length === 1) {
          const fresh = makeTab()
          s.tabs = [fresh]
          s.activeTabId = fresh.tabId
          return
        }
        if (s.activeTabId === tabId) {
          const next = idx > 0 ? s.tabs[idx - 1] : s.tabs[idx + 1]
          s.activeTabId = next!.tabId
        }
        s.tabs.splice(idx, 1)
      })
    },

    setActiveTab: (tabId) => {
      set((s) => {
        if (s.tabs.some((t) => t.tabId === tabId)) s.activeTabId = tabId
      })
    },

    clearDoneIndicator: (tabId) => {
      set((s) => {
        const tab = s.tabs.find((t) => t.tabId === tabId)
        if (tab) tab.showDoneIndicator = false
      })
    },

    setModel: (model) => {
      set((s) => {
        const tab = s.tabs.find((t) => t.tabId === s.activeTabId)
        if (tab) tab.model = model
      })
    },

    setPermissionMode: (mode) => {
      set((s) => {
        const tab = s.tabs.find((t) => t.tabId === s.activeTabId)
        if (tab) tab.permissionMode = mode
      })
    },

    setCwd: (cwd) => {
      set((s) => {
        const tab = s.tabs.find((t) => t.tabId === s.activeTabId)
        if (tab) tab.cwd = cwd
      })
    },

    resetSession: () => {
      set((s) => {
        const tab = s.tabs.find((t) => t.tabId === s.activeTabId)
        if (!tab) return
        tab.sessionId = null
        tab.loadedFromSessionId = null
        tab.status = 'idle'
        tab.messages = []
        tab.todos = []
        tab.pendingPermission = null
      })
    },

    setSessionForResume: (sessionId) => {
      set((s) => {
        const tab = s.tabs.find((t) => t.tabId === s.activeTabId)
        if (!tab) return
        tab.sessionId = sessionId
        tab.status = 'done'
        tab.messages = []
        tab.todos = []
        tab.pendingPermission = null
      })
    },

    loadAndResumeSession: async (encodedPath, sessionId, cwd) => {
      let tabId = get().activeTabId
      let existing = get().tabs.find((t) => t.tabId === tabId)

      // If the current tab is running, create a new tab instead of overwriting
      if (existing && existing.status === 'running') {
        const newTab = makeTab(cwd)
        set((s) => {
          s.tabs.push(newTab)
          s.activeTabId = newTab.tabId
        })
        tabId = newTab.tabId
        existing = newTab
      }

      if (existing && existing.status !== 'idle') {
        // Never reload the session whose history is already loaded while a follow-up is
        // active — reloading the origin session would change tab.sessionId and break
        // in-flight event routing for the running follow-up.
        if (existing.loadedFromSessionId === sessionId) return
      }
      if (existing && existing.status === 'done') {
        // When a follow-up has completed, protect it from reloading too.  Its JSONL only
        // contains the follow-up exchange; reloading it would silently drop the loaded
        // history that's still in memory.  We only block this for 'done' (not 'running')
        // so the user can still click a stuck-running session in Sessions to reset it.
        if (existing.sessionId === sessionId && existing.messages.length > 0) return
      }

      set((s) => {
        const tab = s.tabs.find((t) => t.tabId === tabId)
        if (!tab) return
        tab.cwd = cwd
        tab.sessionId = sessionId
        tab.loadedFromSessionId = sessionId
        tab.status = 'done'
        tab.messages = []
        tab.todos = []
        tab.pendingPermission = null
      })
      try {
        const { messages: rawMessages, usage } = await window.electron.loadSessionMessages(encodedPath, sessionId)
        const uiMessages: UIMessage[] = []
        for (const m of rawMessages) {
          if (m.role === 'user') {
            uiMessages.push({ id: makeId(), type: 'user', text: m.text })
          } else if (m.isToolCall) {
            uiMessages.push({
              id: makeId(), type: 'tool_call', toolUseId: makeId(),
              toolName: m.toolName ?? 'Tool', inputSummary: m.text,
              fullInput: m.fullInput,
            })
          } else {
            uiMessages.push({ id: makeId(), type: 'text', text: m.text })
          }
        }
        uiMessages.push({
          id: makeId(), type: 'done',
          costUsd: usage.costUsd,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          cacheReadTokens: usage.cacheReadTokens,
          cacheCreationTokens: usage.cacheCreationTokens,
        })
        set((s) => {
          const tab = s.tabs.find((t) => t.tabId === tabId)
          if (tab) tab.messages = uiMessages
        })
      } catch {
        // keep session ready without history
      }
    },

    startSession: async (prompt, resumeId, attachments) => {
      const tabId = get().activeTabId
      const tab = selectActiveTab(get())
      if (!tab) return

      const existingSessionId = tab.sessionId
      const isFollowUp = isRealSessionId(existingSessionId) && tab.status === 'done'
      const attachmentPreviews = attachments?.map((a) => ({
        name: a.name,
        dataUrl: `data:${a.mimeType};base64,${a.data}`,
      }))

      set((s) => {
        const t = s.tabs.find((t) => t.tabId === tabId)
        if (!t) return
        t.status = 'running'
        t.pendingPermission = null
        t.showDoneIndicator = false
        const userMsg = { id: makeId(), type: 'user' as const, text: prompt, attachments: attachmentPreviews }
        if (isFollowUp) {
          t.messages.push(userMsg)
        } else {
          t.messages = [userMsg]
          t.todos = []
        }
      })

      try {
        const { config: apiConfig, agentSettings } = useApiConfigStore.getState()
        const currentCwd = get().tabs.find((t) => t.tabId === tabId)?.cwd ?? ''
        const { sessionId: tempId } = await window.electron.startSession({
          prompt,
          cwd: currentCwd,
          model: tab.model || undefined,
          apiConfig: apiConfig.baseUrl ? apiConfig : undefined,
          agentSettings: Object.keys(agentSettings).length > 0 ? agentSettings : undefined,
          resumeId: resumeId ?? (isFollowUp ? existingSessionId : undefined),
          attachments: attachments?.length ? attachments : undefined,
        })
        set((s) => {
          const t = s.tabs.find((t) => t.tabId === tabId)
          // For new sessions: store the real session ID (tab had null/temp ID).
          // For follow-ups: the old history session ID is stale; replace it with
          // the new active session ID so incoming events can find this tab.
          if (t && (!isRealSessionId(t.sessionId) || isFollowUp)) t.sessionId = tempId
        })
      } catch (err: unknown) {
        set((s) => {
          const t = s.tabs.find((t) => t.tabId === tabId)
          if (!t) return
          t.status = 'error'
          t.messages.push({ id: makeId(), type: 'error', text: err instanceof Error ? err.message : String(err) })
        })
      }
    },

    triggerCompact: async () => {
      const tab = selectActiveTab(get())
      if (!tab || !isRealSessionId(tab.sessionId)) return
      const tabId = tab.tabId
      const { config: apiConfig, agentSettings } = useApiConfigStore.getState()
      set((s) => {
        const t = s.tabs.find((t) => t.tabId === tabId)
        if (t) {
          t.status = 'running'
          t.showDoneIndicator = false
        }
      })
      try {
        await window.electron.startSession({
          prompt: '/compact',
          cwd: tab.cwd,
          model: tab.model || undefined,
          apiConfig: apiConfig.baseUrl ? apiConfig : undefined,
          agentSettings: Object.keys(agentSettings).length > 0 ? agentSettings : undefined,
          resumeId: tab.sessionId,
        })
      } catch (err: unknown) {
        set((s) => {
          const t = s.tabs.find((t) => t.tabId === tabId)
          if (!t) return
          t.status = 'error'
          t.messages.push({ id: makeId(), type: 'error', text: err instanceof Error ? err.message : String(err) })
        })
      }
    },

    addLocalMessage: (text) => {
      set((s) => {
        const tab = s.tabs.find((t) => t.tabId === s.activeTabId)
        if (tab) tab.messages.push({ id: makeId(), type: 'text', text })
      })
    },

    sendToolResult: (toolUseId, content) => {
      const tab = selectActiveTab(get())
      if (!tab?.sessionId) return
      void window.electron.sendToolResult({ sessionId: tab.sessionId, toolUseId, content })
      set((s) => {
        const t = s.tabs.find((t) => t.tabId === s.activeTabId)
        if (!t) return
        const msg = t.messages.find((m) => m.type === 'ask' && m.toolUseId === toolUseId)
        if (msg && msg.type === 'ask') msg.answered = true
      })
    },

    abortSession: () => {
      const tab = selectActiveTab(get())
      if (tab?.sessionId) void window.electron.abortSession(tab.sessionId)
      set((s) => {
        const t = s.tabs.find((t) => t.tabId === s.activeTabId)
        if (t) t.status = 'idle'
      })
    },

    respondPermission: (allowed) => {
      const tab = selectActiveTab(get())
      if (!tab?.sessionId || !tab.pendingPermission) return
      void window.electron.respondPermission({ sessionId: tab.sessionId, reqId: tab.pendingPermission.reqId, allowed })
      set((s) => {
        const t = s.tabs.find((t) => t.tabId === s.activeTabId)
        if (t) t.pendingPermission = null
      })
    },

    handlePermissionRequest: (req) => {
      set((s) => {
        const tab = s.tabs.find((t) => t.sessionId === req.sessionId)
        if (tab) tab.pendingPermission = req
      })
    },

    handleAgentEvent: (sessionId, msg) => {
      set((s) => {
        // Find tab by sessionId; if not found, assign to the first running tab with no real sessionId
        let tab = s.tabs.find((t) => t.sessionId === sessionId)
        if (!tab) {
          tab = s.tabs.find((t) => t.status === 'running' && !isRealSessionId(t.sessionId))
          if (tab) tab.sessionId = sessionId
        }
        if (!tab) return

        if (msg.type === 'system' && (msg as { subtype: string }).subtype === 'compact_boundary') {
          tab.messages.push({ id: makeId(), type: 'compact_boundary' })
          return
        }

        if (msg.type === 'assistant') {
          const assistantMsg = msg as { type: 'assistant'; message: { content: ContentBlock[] } }
          let msgs = [...tab.messages]
          let todos = [...tab.todos]
          for (const block of assistantMsg.message.content) {
            const result = processBlock(block, msgs, todos)
            msgs = result.messages
            todos = result.todos
          }
          tab.messages = msgs
          tab.todos = todos
          return
        }

        if (msg.type === 'result') {
          const resultMsg = msg as { type: 'result'; subtype: string }
          if (resultMsg.subtype === 'success') {
            const ok = msg as { type: 'result'; subtype: 'success'; cost_usd: number; usage: { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number } }
            tab.messages.push({
              id: makeId(), type: 'done',
              costUsd: ok.cost_usd ?? 0,
              inputTokens: ok.usage?.input_tokens ?? 0,
              outputTokens: ok.usage?.output_tokens ?? 0,
              cacheReadTokens: ok.usage?.cache_read_input_tokens ?? 0,
              cacheCreationTokens: ok.usage?.cache_creation_input_tokens ?? 0,
            })
          } else {
            const err = msg as { type: 'result'; subtype: 'error_during_execution'; error: string }
            tab.messages.push({ id: makeId(), type: 'error', text: err.error ?? 'Unknown error' })
          }
        }
      })
    },

    handleAgentDone: (sessionId) => {
      set((s) => {
        const tab = s.tabs.find((t) => t.sessionId === sessionId)
        if (!tab) return
        tab.status = 'done'
        tab.showDoneIndicator = true
        if (isRealSessionId(tab.sessionId)) tab.lastSessionId = tab.sessionId
      })
    },

    handleAgentError: (sessionId, error) => {
      set((s) => {
        const tab = s.tabs.find((t) => t.sessionId === sessionId)
        if (!tab) return
        tab.status = 'error'
        tab.showDoneIndicator = true
        tab.messages.push({ id: makeId(), type: 'error', text: error })
      })
    },
  }))
)
