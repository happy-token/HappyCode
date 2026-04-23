import React, { useEffect, useRef, useState, useCallback } from 'react'
import type { UIMessage, Attachment } from '../../../electron/shared/types'
import { useChatStore } from '../../store/session-store'
import { useSubagentStore } from '../../store/subagent-store'
import { useUiStore } from '../../store/ui-store'
import { MessageBubble } from './MessageBubble'
import { PromptInput } from './PromptInput'
import { PermissionDialog } from './PermissionDialog'
import { HelpPanel } from './HelpPanel'

export function ChatPanel(): React.JSX.Element {
  const messages = useChatStore((s) => s.messages)
  const status = useChatStore((s) => s.status)
  const sessionId = useChatStore((s) => s.sessionId)
  const pendingPermission = useChatStore((s) => s.pendingPermission)

  const model = useChatStore((s) => s.model)
  const setModel = useChatStore((s) => s.setModel)
  const startSession = useChatStore((s) => s.startSession)
  const triggerCompact = useChatStore((s) => s.triggerCompact)
  const abortSession = useChatStore((s) => s.abortSession)
  const respondPermission = useChatStore((s) => s.respondPermission)
  const handleAgentEvent = useChatStore((s) => s.handleAgentEvent)
  const handleAgentDone = useChatStore((s) => s.handleAgentDone)
  const handleAgentError = useChatStore((s) => s.handleAgentError)
  const handlePermissionRequest = useChatStore((s) => s.handlePermissionRequest)
  const resetSession = useChatStore((s) => s.resetSession)
  const lastSessionId = useChatStore((s) => s.lastSessionId)
  const setSessionForResume = useChatStore((s) => s.setSessionForResume)

  const runningCostUsd = useChatStore((s) =>
    s.messages.reduce((sum, m) => (m.type === 'done' ? sum + m.costUsd : sum), 0)
  )
  const totalTokens = useChatStore((s) =>
    s.messages.reduce((sum, m) => (m.type === 'done' ? sum + m.inputTokens + m.outputTokens : sum), 0)
  )

  const subagentNodes = useSubagentStore((s) => s.nodes)
  const applySubagentEvent = useSubagentStore((s) => s.applyEvent)
  const initSubagentRoot = useSubagentStore((s) => s.initRoot)

  const cwd = useUiStore((s) => s.cwd)
  const showPanel = useUiStore((s) => s.showPanel)
  const togglePanel = useUiStore((s) => s.togglePanel)

  const bottomRef = useRef<HTMLDivElement>(null)
  const prevStatusRef = useRef(status)
  const lastAskIdRef = useRef<string | null>(null)
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showHelp, setShowHelp] = useState(false)

  const projectName = cwd ? (cwd.split('/').pop() ?? 'Task') : 'Task'

  const notify = useCallback((title: string, body: string) => {
    const fire = () => {
      new Notification(title, { body })
      void window.electron.dockBounce()
    }
    if (Notification.permission === 'granted') {
      fire()
    } else if (Notification.permission !== 'denied') {
      void Notification.requestPermission().then((perm) => {
        if (perm === 'granted') fire()
      })
    }
  }, [])

  // running → done / error
  useEffect(() => {
    const prev = prevStatusRef.current
    prevStatusRef.current = status
    if (prev !== 'running') return
    if (status === 'done') {
      const body = runningCostUsd > 0
        ? `完成 · $${runningCostUsd.toFixed(4)}`
        : totalTokens > 0
          ? `完成 · ${totalTokens.toLocaleString()} tok`
          : '任务完成'
      notify(projectName, body)
    } else if (status === 'error') {
      notify(projectName, '任务出错')
    }
  }, [status, notify, projectName, runningCostUsd, totalTokens])

  // Permission request
  useEffect(() => {
    if (!pendingPermission) return
    notify('需要权限审批', `工具：${pendingPermission.toolName}`)
  }, [pendingPermission, notify])

  // AskUserQuestion — only fire once per new unanswered ask
  useEffect(() => {
    const lastAsk = [...messages].reverse().find((m) => m.type === 'ask' && !m.answered)
    if (!lastAsk || lastAsk.id === lastAskIdRef.current) return
    lastAskIdRef.current = lastAsk.id
    notify(projectName, '需要你做决策')
  }, [messages, notify, projectName])

  // Initialize root subagent node when real session ID is known
  useEffect(() => {
    if (sessionId && /^[0-9a-f-]{36}$/.test(sessionId)) {
      initSubagentRoot(sessionId, cwd ? cwd.split('/').pop() ?? 'root' : 'root')
    }
  }, [sessionId, cwd, initSubagentRoot])

  // Register IPC listeners once
  useEffect(() => {
    const unsubEvent = window.electron.onAgentEvent(({ sessionId, msg }) => {
      handleAgentEvent(sessionId, msg)
    })
    const unsubDone = window.electron.onAgentDone(({ sessionId }) => {
      handleAgentDone(sessionId)
    })
    const unsubError = window.electron.onAgentError(({ sessionId, error }) => {
      handleAgentError(sessionId, error)
    })
    const unsubPerm = window.electron.onPermissionRequest((req) => {
      handlePermissionRequest(req)
    })
    const unsubSubagent = window.electron.onSubagentEvent(({ rootSessionId, node }) => {
      applySubagentEvent(rootSessionId, node)
    })

    return () => {
      unsubEvent()
      unsubDone()
      unsubError()
      unsubPerm()
      unsubSubagent()
    }
  }, [handleAgentEvent, handleAgentDone, handleAgentError, handlePermissionRequest, applySubagentEvent])

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  // Close help panel on Escape
  useEffect(() => {
    if (!showHelp) return
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setShowHelp(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [showHelp])

  const running = status === 'running'
  const hasSubagents = subagentNodes.size > 1

  function messageMatchesSearch(msg: UIMessage, q: string): boolean {
    const lower = q.toLowerCase()
    if (msg.type === 'user') return msg.text.toLowerCase().includes(lower)
    if (msg.type === 'text') return msg.text.toLowerCase().includes(lower)
    if (msg.type === 'thinking') return msg.text.toLowerCase().includes(lower)
    if (msg.type === 'error') return msg.text.toLowerCase().includes(lower)
    if (msg.type === 'tool_call') {
      return msg.toolName.toLowerCase().includes(lower) || msg.inputSummary.toLowerCase().includes(lower)
    }
    if (msg.type === 'diff') return msg.filePath.toLowerCase().includes(lower)
    if (msg.type === 'plan') return msg.plan.toLowerCase().includes(lower)
    return false
  }

  const filteredMessages = searchQuery
    ? messages.filter((msg) => messageMatchesSearch(msg, searchQuery))
    : messages

  function handleSend(prompt: string, attachments?: Attachment[]): void {
    const cmd = prompt.trim().split(/\s+/)[0]?.toLowerCase()
    if (cmd === '/clear') {
      resetSession()
      return
    }
    if (cmd === '/compact') {
      void triggerCompact()
      return
    }
    if (cmd === '/help') {
      setShowHelp(true)
      return
    }
    void startSession(prompt, undefined, attachments)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '8px 16px',
          borderBottom: '1px solid var(--color-border)',
          background: 'var(--color-surface)',
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 11, color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {cwd || 'No project path set'}
        </span>
        <span style={{ fontSize: 11, color: 'var(--color-text-muted)', flexShrink: 0 }}>Model</span>
        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          disabled={running}
          style={{
            fontSize: 11,
            color: 'var(--color-text-muted)',
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            padding: '2px 6px',
            cursor: running ? 'default' : 'pointer',
          }}
        >
          <option value="">Default (from config)</option>
          <optgroup label="Anthropic">
            <option value="claude-opus-4-7">Opus 4.7</option>
            <option value="claude-sonnet-4-6">Sonnet 4.6</option>
            <option value="claude-haiku-4-5-20251001">Haiku 4.5</option>
          </optgroup>
          <optgroup label="Bella proxy">
            <option value="claude-4.6-sonnet">claude-4.6-sonnet</option>
            <option value="claude-4.6-opus">claude-4.6-opus</option>
            <option value="qwen3.6-plus">qwen3.6-plus</option>
            <option value="glm-5.1">glm-5.1</option>
          </optgroup>
        </select>
        {totalTokens > 0 && (
          <span
            style={{
              fontSize: 11,
              color: 'var(--color-accent)',
              fontFamily: 'var(--font-mono)',
              padding: '2px 6px',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            {runningCostUsd > 0 ? `$${runningCostUsd.toFixed(4)}` : `${totalTokens.toLocaleString()} tok`}
          </span>
        )}
        {status === 'done' && messages.length > 0 && (
          <button
            onClick={() => void triggerCompact()}
            style={{
              fontSize: 11,
              color: 'var(--color-text-muted)',
              padding: '3px 10px',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
            }}
            title="Compact context (/compact)"
          >
            Compact
          </button>
        )}
        {(status === 'done' || status === 'error') && (
          <button
            onClick={resetSession}
            style={{
              fontSize: 11,
              color: 'var(--color-text-muted)',
              padding: '3px 10px',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            New chat
          </button>
        )}
        {messages.length > 0 && (
          <button
            onClick={() => setShowSearch((v) => !v)}
            style={{
              fontSize: 11,
              color: showSearch ? 'var(--color-accent)' : 'var(--color-text-muted)',
              padding: '3px 10px',
              border: `1px solid ${showSearch ? 'var(--color-accent)' : 'var(--color-border)'}`,
              borderRadius: 'var(--radius-sm)',
              background: showSearch ? 'var(--color-accent-dim)' : 'transparent',
            }}
          >
            Search
          </button>
        )}
        {hasSubagents && (
          <button
            onClick={togglePanel}
            style={{
              fontSize: 11,
              color: showPanel ? 'var(--color-accent)' : 'var(--color-text-muted)',
              padding: '3px 10px',
              border: `1px solid ${showPanel ? 'var(--color-accent)' : 'var(--color-border)'}`,
              borderRadius: 'var(--radius-sm)',
              background: showPanel ? 'var(--color-accent-dim)' : 'transparent',
            }}
          >
            ⬡ Agents {subagentNodes.size}
          </button>
        )}
        {running && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: 'var(--color-success)',
                display: 'inline-block',
                animation: 'blink 1.2s ease-in-out infinite',
              }}
            />
            <span style={{ fontSize: 11, color: 'var(--color-success)' }}>Running</span>
          </div>
        )}
      </div>

      {/* Search strip */}
      {showSearch && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 16px',
            borderBottom: '1px solid var(--color-border)',
            background: 'var(--color-surface)',
            flexShrink: 0,
          }}
        >
          <input
            autoFocus
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { setShowSearch(false); setSearchQuery('') }
            }}
            placeholder="Search messages…"
            style={{
              flex: 1,
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              padding: '4px 10px',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--color-surface-2)',
              color: 'var(--color-text)',
            }}
          />
          {searchQuery && (
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)', flexShrink: 0 }}>
              {filteredMessages.length} / {messages.length}
            </span>
          )}
          <button
            onClick={() => { setShowSearch(false); setSearchQuery('') }}
            style={{
              fontSize: 12,
              color: 'var(--color-text-muted)',
              padding: '2px 6px',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Message list */}
      <div style={{ flex: 1, overflowY: 'auto', paddingTop: 12, paddingBottom: 8 }}>
        {messages.length === 0 && (
          <div
            style={{
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              gap: 10,
              color: 'var(--color-text-muted)',
            }}
          >
            <div style={{ fontSize: 28 }}>{sessionId ? '↩' : '◈'}</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>
              {sessionId ? 'Session loaded' : 'Start a conversation'}
            </div>
            <div style={{ fontSize: 12 }}>
              {sessionId
                ? 'Type a message to continue this session'
                : cwd ? `Working in ${cwd}` : 'Set a project path to begin'}
            </div>
            {sessionId && (
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)', opacity: 0.6 }}>
                {sessionId}
              </div>
            )}
            {!sessionId && lastSessionId && (
              <button
                onClick={() => setSessionForResume(lastSessionId)}
                style={{
                  marginTop: 8,
                  fontSize: 12,
                  padding: '6px 18px',
                  border: '1px solid var(--color-accent)',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--color-accent-dim)',
                  color: 'var(--color-accent)',
                  cursor: 'pointer',
                }}
              >
                ↩ Resume last session
              </button>
            )}
          </div>
        )}
        {filteredMessages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <PromptInput
        onSend={handleSend}
        onStop={abortSession}
        disabled={!cwd || running}
        running={running}
      />

      {/* Help panel */}
      {showHelp && <HelpPanel onClose={() => setShowHelp(false)} cwd={cwd} />}

      {/* Permission overlay */}
      {pendingPermission && (
        <PermissionDialog
          request={pendingPermission}
          onAllow={() => respondPermission(true)}
          onDeny={() => respondPermission(false)}
        />
      )}
    </div>
  )
}
