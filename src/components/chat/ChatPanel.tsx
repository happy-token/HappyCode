import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { UIMessage, Attachment } from '../../../electron/shared/types'
import { useTabStore, selectActiveTab } from '../../store/tab-store'
import type { PermissionMode } from '../../store/tab-store'
import { useSubagentStore } from '../../store/subagent-store'
import { useUiStore } from '../../store/ui-store'
import { useProviderStore } from '../../store/provider-store'
import { MessageBubble } from './MessageBubble'
import { PromptInput } from './PromptInput'
import { PermissionDialog } from './PermissionDialog'
import { PermissionSelector } from './PermissionSelector'
import { HelpPanel } from './HelpPanel'
import { ChatEmptyState } from './ChatEmptyState'
import { ClaudemdPanel } from './ClaudemdPanel'
import { X, Database, ArrowUp, ArrowDown, Brain } from 'lucide-react'
import { cn } from '@renderer/lib/utils'

export function ChatPanel(): React.JSX.Element {
  const { t } = useTranslation()
  const messages = useTabStore((s) => selectActiveTab(s)?.messages ?? [])
  const status = useTabStore((s) => selectActiveTab(s)?.status ?? 'idle')
  const sessionId = useTabStore((s) => selectActiveTab(s)?.sessionId ?? null)
  const pendingPermission = useTabStore((s) => selectActiveTab(s)?.pendingPermission ?? null)
  const model = useTabStore((s) => selectActiveTab(s)?.model ?? '')
  const permissionMode = useTabStore((s) => selectActiveTab(s)?.permissionMode ?? 'ask')
  const lastSessionId = useTabStore((s) => selectActiveTab(s)?.lastSessionId ?? null)
  const cwd = useTabStore((s) => selectActiveTab(s)?.cwd ?? '')

  const setModel = useTabStore((s) => s.setModel)
  const setPermissionMode = useTabStore((s) => s.setPermissionMode)
  const startSession = useTabStore((s) => s.startSession)
  const abortSession = useTabStore((s) => s.abortSession)
  const respondPermission = useTabStore((s) => s.respondPermission)
  const resetSession = useTabStore((s) => s.resetSession)
  const setSessionForResume = useTabStore((s) => s.setSessionForResume)
  const setCwd = useTabStore((s) => s.setCwd)

  const runningCostUsd = useTabStore((s) =>
    (selectActiveTab(s)?.messages ?? []).reduce((sum, m) => (m.type === 'done' ? sum + m.costUsd : sum), 0)
  )
  const totalInputTokens = useTabStore((s) =>
    (selectActiveTab(s)?.messages ?? []).reduce((sum, m) => (m.type === 'done' ? sum + m.inputTokens : sum), 0)
  )
  const totalOutputTokens = useTabStore((s) =>
    (selectActiveTab(s)?.messages ?? []).reduce((sum, m) => (m.type === 'done' ? sum + m.outputTokens : sum), 0)
  )
  const totalCacheReadTokens = useTabStore((s) =>
    (selectActiveTab(s)?.messages ?? []).reduce((sum, m) => (m.type === 'done' ? sum + (m.cacheReadTokens ?? 0) : sum), 0)
  )
  const totalCacheCreationTokens = useTabStore((s) =>
    (selectActiveTab(s)?.messages ?? []).reduce((sum, m) => (m.type === 'done' ? sum + (m.cacheCreationTokens ?? 0) : sum), 0)
  )

  // Dynamic model options from configured providers
  const { providers, activeId, fetchProviders } = useProviderStore()
  useEffect(() => { void fetchProviders() }, [fetchProviders])

  const modelOptions = useMemo(() => {
    const opts: Array<{ label: string; value: string }> = []
    const activeProvider = providers.find((p) => p.id === activeId)

    if (activeProvider) {
      const m = activeProvider.models
      if (m.main) opts.push({ label: m.main, value: m.main })
      if (m.haiku && m.haiku !== m.main) opts.push({ label: m.haiku, value: m.haiku })
      if (m.sonnet && m.sonnet !== m.main) opts.push({ label: m.sonnet, value: m.sonnet })
      if (m.opus && m.opus !== m.main) opts.push({ label: m.opus, value: m.opus })
    } else {
      // Official Anthropic defaults
      opts.push({ label: 'Claude Opus 4.7', value: 'claude-opus-4-7' })
      opts.push({ label: 'Claude Sonnet 4.6', value: 'claude-sonnet-4-6' })
      opts.push({ label: 'Claude Haiku 4.5', value: 'claude-haiku-4-5-20251001' })
    }
    return opts
  }, [providers, activeId])

  const CONTEXT_WINDOW = 200_000
  const contextPct = useTabStore((s) => {
    const msgs = selectActiveTab(s)?.messages ?? []
    let totalInput = 0
    for (const m of msgs) {
      if (m.type === 'done') {
        totalInput += m.inputTokens + (m.cacheReadTokens ?? 0) + (m.cacheCreationTokens ?? 0)
      }
    }
    return totalInput > 0 ? Math.round((totalInput / CONTEXT_WINDOW) * 100) : 0
  })

  const subagentNodes = useSubagentStore((s) => s.nodes)
  const initSubagentRoot = useSubagentStore((s) => s.initRoot)

  const showPanel = useUiStore((s) => s.showPanel)
  const togglePanel = useUiStore((s) => s.togglePanel)
  const showSearch = useUiStore((s) => s.showSearch)
  const showClaudeMd = useUiStore((s) => s.showClaudeMd)
  const setShowSearch = useUiStore((s) => s.setShowSearch)
  const setShowClaudeMd = useUiStore((s) => s.setShowClaudeMd)
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed)

  const bottomRef = useRef<HTMLDivElement>(null)
  const prevStatusRef = useRef(status)
  const lastAskIdRef = useRef<string | null>(null)
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

  useEffect(() => {
    const prev = prevStatusRef.current
    prevStatusRef.current = status
    if (prev !== 'running') return
    const totalTokens = totalInputTokens + totalOutputTokens
    if (status === 'done') {
      const body = runningCostUsd > 0
        ? `${t('chat.taskComplete')} · $${runningCostUsd.toFixed(4)}`
        : totalTokens > 0
          ? `${t('chat.taskComplete')} · ${totalTokens.toLocaleString()} tok`
          : t('chat.taskComplete')
      notify(projectName, body)
    } else if (status === 'error') {
      notify(projectName, t('chat.taskError'))
    }
  }, [status, notify, projectName, runningCostUsd, totalInputTokens, totalOutputTokens])

  useEffect(() => {
    if (!pendingPermission) return
    notify(t('chat.needsPermission'), `${t('chat.tool')}: ${pendingPermission.toolName}`)
  }, [pendingPermission, notify])

  useEffect(() => {
    const lastAsk = [...messages].reverse().find((m) => m.type === 'ask' && !m.answered)
    if (!lastAsk || lastAsk.id === lastAskIdRef.current) return
    lastAskIdRef.current = lastAsk.id
    notify(projectName, t('chat.needsDecision'))
  }, [messages, notify, projectName])

  useEffect(() => {
    if (sessionId && /^[0-9a-f-]{36}$/.test(sessionId)) {
      initSubagentRoot(sessionId, cwd ? cwd.split('/').pop() ?? 'root' : 'root')
    }
  }, [sessionId, cwd, initSubagentRoot])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

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
    if (cmd === '/clear') { resetSession(); return }
    if (cmd === '/help') { setShowHelp(true); return }
    void startSession(prompt, undefined, attachments)
  }

  const fmtTok = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Search strip */}
      {showSearch && (
        <div className="flex flex-shrink-0 items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-[6px]">
          <input
            autoFocus
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { setShowSearch(false); setSearchQuery('') }
            }}
            placeholder={t('chat.searchMessages')}
            className="flex-1 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-[10px] py-1 font-mono text-[12px] text-[var(--color-text)] outline-none"
          />
          {searchQuery && (
            <span className="flex-shrink-0 text-[11px] text-[var(--color-text-muted)]">
              {filteredMessages.length} / {messages.length}
            </span>
          )}
          <button
            onClick={() => { setShowSearch(false); setSearchQuery('') }}
            className="flex items-center justify-center rounded-[var(--radius-sm)] border border-[var(--color-border)] px-[6px] py-[2px] text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-danger)] hover:text-[var(--color-danger)]"
          ><X size={11} /></button>
        </div>
      )}

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Message list + input column */}
        <div className={cn('flex flex-1 flex-col overflow-hidden transition-[padding-right] duration-150', sidebarCollapsed ? 'pr-28' : 'pr-0')}>
          <div className="relative flex-1 overflow-y-auto py-6">
            {messages.length === 0 ? (
              <ChatEmptyState
                cwd={cwd}
                sessionId={sessionId ?? ''}
                lastSessionId={lastSessionId}
                onResumeLastSession={() => lastSessionId && setSessionForResume(lastSessionId)}
                onPickFolder={() => void window.electron.selectFolder().then((p) => { if (p) setCwd(p) })}
                onSendPrompt={(prompt) => handleSend(prompt)}
              />
            ) : (
              <div className="flex flex-col gap-1" style={{ width: '100%', maxWidth: 720, marginLeft: 'auto', marginRight: 'auto', paddingLeft: 32, paddingRight: 32 }}>
                {filteredMessages.map((msg, idx) => {
                let doneInfo: { inputTokens: number; outputTokens: number; costUsd: number; cacheReadTokens?: number } | undefined
                if (msg.type === 'text') {
                  for (let i = idx + 1; i < filteredMessages.length; i++) {
                    if (filteredMessages[i].type === 'done') {
                      const doneMsg = filteredMessages[i] as Extract<UIMessage, { type: 'done' }>
                      doneInfo = {
                        inputTokens: doneMsg.inputTokens,
                        outputTokens: doneMsg.outputTokens,
                        costUsd: doneMsg.costUsd,
                        cacheReadTokens: doneMsg.cacheReadTokens,
                      }
                      break
                    }
                    if (filteredMessages[i].type === 'text' || filteredMessages[i].type === 'user') break
                  }
                }
                return (
                  <div key={msg.id} className={msg.type === 'user' ? 'text-right' : ''}>
                    <MessageBubble msg={msg} doneInfo={doneInfo} />
                  </div>
                )
              })}
              <div ref={bottomRef} />
            </div>
            )}
          </div>

          {/* Input + session stats bar */}
          <div className="flex-shrink-0 bg-transparent px-4 pb-4 pt-2">
            <div style={{ width: '100%', maxWidth: 720, marginLeft: 'auto', marginRight: 'auto', paddingLeft: 32, paddingRight: 32, paddingTop: 10 }}>
              <PromptInput
                onSend={handleSend}
                onStop={abortSession}
                disabled={!cwd || running}
                running={running}
              />
            </div>

            {/* Bottom action bar + token stats */}
            <div className="flex items-center gap-2" style={{ width: '100%', maxWidth: 720, marginLeft: 'auto', marginRight: 'auto', paddingLeft: 32, paddingRight: 32, paddingTop: 2 }}>
              {/* Left actions */}
              <div className="flex items-center gap-2">
                <PermissionSelector
                  value={permissionMode}
                  onChange={(mode: PermissionMode) => setPermissionMode(mode)}
                />
                {hasSubagents && (
                  <button
                    onClick={togglePanel}
                    className={cn(
                      'cursor-pointer whitespace-nowrap rounded-[var(--radius-sm)] border-0 px-2 py-[3px] text-[11px] transition-[background,color] duration-100 hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]',
                      showPanel
                        ? 'bg-[var(--color-accent-dim)] text-[var(--color-accent)]'
                        : 'bg-transparent text-[var(--color-text-muted)]'
                    )}
                  >
                    ⬡ {subagentNodes.size}
                  </button>
                )}
              </div>

              {/* Right spacer + stats */}
              <div className="ml-auto flex items-center gap-2">
                {messages.length > 0 && (totalInputTokens > 0 || totalOutputTokens > 0) && (
                  <>
                    {/* Input */}
                    <div className="flex items-center gap-1">
                      <ArrowUp size={11} className="text-[var(--color-accent)]" />
                      <span className="font-mono text-[11px] font-semibold text-[var(--color-text)]">{fmtTok(totalInputTokens)}</span>
                    </div>
                    {/* Output */}
                    <div className="flex items-center gap-1">
                      <ArrowDown size={11} className="text-[var(--color-info)]" />
                      <span className="font-mono text-[11px] font-semibold text-[var(--color-text)]">{fmtTok(totalOutputTokens)}</span>
                    </div>
                    {/* Cache hit */}
                    {(totalCacheReadTokens ?? 0) > 0 && (
                      <div className="flex items-center gap-1">
                        <Database size={11} className="text-[var(--color-success)]" />
                        <span className="font-mono text-[11px] font-semibold text-[var(--color-success)]">
                          {(() => {
                            const totalInput = totalInputTokens + (totalCacheReadTokens ?? 0) + (totalCacheCreationTokens ?? 0)
                            return totalInput > 0 ? `${Math.round((totalCacheReadTokens ?? 0) / totalInput * 100)}%` : '—'
                          })()}
                        </span>
                      </div>
                    )}
                    {/* Context bar */}
                    <div className="flex items-center gap-1.5">
                      <Brain size={11} className="text-[var(--color-warning)]" />
                      <div className="h-1.5 w-16 bg-[var(--color-surface-3)] rounded-[2px] overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-[2px] transition-[width]',
                            contextPct >= 90 ? 'bg-[var(--color-danger)]' : contextPct >= 70 ? 'bg-[var(--color-warning)]' : 'bg-[var(--color-success)]'
                          )}
                          style={{ width: `${Math.min(contextPct, 100)}%` }}
                        />
                      </div>
                      <span className={cn(
                        'font-mono text-[11px] font-bold min-w-[24px] text-right',
                        contextPct >= 90 ? 'text-[var(--color-danger)]' : contextPct >= 70 ? 'text-[var(--color-warning)]' : 'text-[var(--color-text)]'
                      )}>
                        {contextPct}%
                      </span>
                    </div>
                  </>
                )}

                {/* Model selector */}
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  disabled={running}
                  title="Model"
                  className={cn(
                    'border-0 bg-transparent p-0 py-[2px] text-[11px] text-[var(--color-text-muted)] outline-none',
                    running ? 'cursor-default' : 'cursor-pointer'
                  )}
                >
                  {modelOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Help panel */}
      {showHelp && <HelpPanel onClose={() => setShowHelp(false)} cwd={cwd} />}

      {/* CLAUDE.md editor */}
      {showClaudeMd && cwd && <ClaudemdPanel cwd={cwd} onClose={() => setShowClaudeMd(false)} />}

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
