import React, { useEffect, useRef, useState, useCallback } from 'react'
import type { UIMessage, Attachment } from '../../../electron/shared/types'
import { useTabStore, selectActiveTab } from '../../store/tab-store'
import { useExportSettingsStore } from '../../store/export-settings-store'
import { useSubagentStore } from '../../store/subagent-store'
import { useUiStore } from '../../store/ui-store'
import { MessageBubble } from './MessageBubble'
import { PromptInput } from './PromptInput'
import { PermissionDialog } from './PermissionDialog'
import { HelpPanel } from './HelpPanel'
import { ChatEmptyState } from './ChatEmptyState'
import { ClaudemdPanel } from './ClaudemdPanel'

export function ChatPanel(): React.JSX.Element {
  const messages = useTabStore((s) => selectActiveTab(s)?.messages ?? [])
  const status = useTabStore((s) => selectActiveTab(s)?.status ?? 'idle')
  const sessionId = useTabStore((s) => selectActiveTab(s)?.sessionId ?? null)
  const pendingPermission = useTabStore((s) => selectActiveTab(s)?.pendingPermission ?? null)
  const model = useTabStore((s) => selectActiveTab(s)?.model ?? '')
  const lastSessionId = useTabStore((s) => selectActiveTab(s)?.lastSessionId ?? null)
  const cwd = useTabStore((s) => selectActiveTab(s)?.cwd ?? '')

  const setModel = useTabStore((s) => s.setModel)
  const startSession = useTabStore((s) => s.startSession)
  const triggerCompact = useTabStore((s) => s.triggerCompact)
  const abortSession = useTabStore((s) => s.abortSession)
  const respondPermission = useTabStore((s) => s.respondPermission)
  const resetSession = useTabStore((s) => s.resetSession)
  const setSessionForResume = useTabStore((s) => s.setSessionForResume)
  const setCwd = useTabStore((s) => s.setCwd)

  const runningCostUsd = useTabStore((s) =>
    (selectActiveTab(s)?.messages ?? []).reduce((sum, m) => (m.type === 'done' ? sum + m.costUsd : sum), 0)
  )
  const totalTokens = useTabStore((s) =>
    (selectActiveTab(s)?.messages ?? []).reduce((sum, m) => (m.type === 'done' ? sum + m.inputTokens + m.outputTokens : sum), 0)
  )

  const subagentNodes = useSubagentStore((s) => s.nodes)
  const initSubagentRoot = useSubagentStore((s) => s.initRoot)

  const showPanel = useUiStore((s) => s.showPanel)
  const togglePanel = useUiStore((s) => s.togglePanel)

  const bottomRef = useRef<HTMLDivElement>(null)
  const prevStatusRef = useRef(status)
  const lastAskIdRef = useRef<string | null>(null)
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showHelp, setShowHelp] = useState(false)
  const [showClaudeMd, setShowClaudeMd] = useState(false)

  const projectName = cwd ? (cwd.split('/').pop() ?? 'Task') : 'Task'
  const exportSettings = useExportSettingsStore((s) => s.settings)

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

  function messagesToMarkdown(msgs: typeof messages): string {
    const lines: string[] = []
    for (const msg of msgs) {
      if (msg.type === 'user') {
        lines.push(`## User\n\n${msg.text}\n`)
      } else if (msg.type === 'text') {
        lines.push(`## Assistant\n\n${msg.text}\n`)
      } else if (msg.type === 'thinking') {
        lines.push(`<details><summary>Thinking…</summary>\n\n${msg.text}\n\n</details>\n`)
      } else if (msg.type === 'tool_call') {
        lines.push(`**Tool:** \`${msg.toolName}\`\n\n\`\`\`json\n${msg.inputSummary}\n\`\`\`\n`)
      } else if (msg.type === 'diff') {
        lines.push(`**Edit:** \`${msg.filePath}\`\n`)
      } else if (msg.type === 'error') {
        lines.push(`> **Error:** ${msg.text}\n`)
      } else if (msg.type === 'done') {
        const cost = msg.costUsd > 0 ? ` · $${msg.costUsd.toFixed(4)}` : ''
        lines.push(`---\n*Session complete${cost}*\n`)
      }
    }
    return lines.join('\n')
  }

  async function handleExportCsv(): Promise<void> {
    if (!sessionId || !cwd) return
    const { csv, verifierScript, error } = await window.electron.exportCsv(sessionId, cwd, exportSettings)
    if (error || !csv) return
    const date = new Date().toISOString().slice(0, 10)
    const baseName = `${projectName}-${date}`

    const csvBlob = new Blob([csv], { type: 'text/csv' })
    const csvUrl = URL.createObjectURL(csvBlob)
    const a = document.createElement('a')
    a.href = csvUrl
    a.download = `${baseName}.csv`
    a.click()
    URL.revokeObjectURL(csvUrl)

    if (verifierScript) {
      const jsBlob = new Blob([verifierScript], { type: 'text/javascript' })
      const jsUrl = URL.createObjectURL(jsBlob)
      const b = document.createElement('a')
      b.href = jsUrl
      b.download = `${baseName}-verify-chain.js`
      b.click()
      URL.revokeObjectURL(jsUrl)
    }
  }

  async function handleExportMd(): Promise<void> {
    const content = messagesToMarkdown(messages)
    const date = new Date().toISOString().slice(0, 10)
    const name = `${projectName}-${date}.md`
    await window.electron.exportMarkdown(content, name)
  }

  function messagesToHtml(msgs: typeof messages): string {
    const rows = msgs.map((msg) => {
      if (msg.type === 'user') {
        return `<div class="msg user"><div class="label">User</div><div class="body">${esc(msg.text)}</div></div>`
      }
      if (msg.type === 'text') {
        return `<div class="msg assistant"><div class="label">Assistant</div><div class="body">${esc(msg.text).replace(/\n/g, '<br>')}</div></div>`
      }
      if (msg.type === 'thinking') {
        return `<details class="msg thinking"><summary>Thinking…</summary><div class="body">${esc(msg.text).replace(/\n/g, '<br>')}</div></details>`
      }
      if (msg.type === 'tool_call') {
        return `<div class="msg tool"><span class="tool-name">${esc(msg.toolName)}</span><pre>${esc(msg.inputSummary)}</pre></div>`
      }
      if (msg.type === 'diff') {
        return `<div class="msg tool"><span class="tool-name">Edit</span> <code>${esc(msg.filePath)}</code></div>`
      }
      if (msg.type === 'error') {
        return `<div class="msg error">${esc(msg.text)}</div>`
      }
      if (msg.type === 'done') {
        const cost = msg.costUsd > 0 ? ` · $${msg.costUsd.toFixed(4)}` : ''
        return `<hr><p class="done">Session complete${esc(cost)}</p>`
      }
      return ''
    }).join('\n')

    const date = new Date().toLocaleDateString()
    return `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>${esc(projectName)} — ${date}</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;line-height:1.6;max-width:780px;margin:32px auto;padding:0 24px;color:#18181b;background:#fff}
  h1{font-size:18px;font-weight:700;margin-bottom:4px}
  .meta{font-size:11px;color:#71717a;margin-bottom:32px}
  .msg{margin-bottom:16px;padding:10px 14px;border-radius:6px}
  .msg .label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px}
  .user{background:#f4f4f5}.user .label{color:#52525b}
  .assistant{background:#eff6ff}.assistant .label{color:#2563eb}
  .tool{background:#fafafa;border:1px solid #e4e4e7;font-size:12px}
  .tool-name{font-weight:700;color:#4f46e5;margin-right:8px}
  pre{margin:4px 0 0;white-space:pre-wrap;font-size:11px;font-family:'SF Mono',monospace;color:#3f3f46}
  .thinking{color:#71717a;font-size:12px}
  .error{background:#fef2f2;color:#dc2626;border:1px solid #fca5a5}
  hr{border:none;border-top:1px solid #e4e4e7;margin:24px 0}
  .done{font-size:11px;color:#71717a;text-align:center}
</style></head><body>
<h1>${esc(projectName)}</h1>
<div class="meta">${esc(cwd)} · ${date}</div>
${rows}
</body></html>`
  }

  function esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  }

  async function handleExportPdf(): Promise<void> {
    const html = messagesToHtml(messages)
    const date = new Date().toISOString().slice(0, 10)
    const name = `${projectName}-${date}.pdf`
    await window.electron.exportPdf(html, name)
  }

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
        <div style={{ flex: 1 }} />
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
          <>
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
            <button
              onClick={() => void handleExportMd()}
              style={{
                fontSize: 11,
                color: 'var(--color-text-muted)',
                padding: '3px 10px',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
              }}
              title="Export conversation as Markdown"
            >
              Export MD
            </button>
            <button
              onClick={() => void handleExportPdf()}
              style={{
                fontSize: 11,
                color: 'var(--color-text-muted)',
                padding: '3px 10px',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
              }}
              title="Export conversation as PDF"
            >
              Export PDF
            </button>
            <button
              onClick={() => void handleExportCsv()}
              style={{
                fontSize: 11,
                color: 'var(--color-text-muted)',
                padding: '3px 10px',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
              }}
              title={`Export audit CSV (redaction: ${exportSettings.redactMode})`}
            >
              Export CSV
            </button>
          </>
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
        {cwd && (
          <button
            onClick={() => setShowClaudeMd((v) => !v)}
            style={{
              fontSize: 11,
              color: showClaudeMd ? 'var(--color-accent)' : 'var(--color-text-muted)',
              padding: '3px 10px',
              border: `1px solid ${showClaudeMd ? 'var(--color-accent)' : 'var(--color-border)'}`,
              borderRadius: 'var(--radius-sm)',
              background: showClaudeMd ? 'var(--color-accent-dim)' : 'transparent',
            }}
            title="View / edit CLAUDE.md"
          >
            CLAUDE.md
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
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
        <div style={{ maxWidth: 680, margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {messages.length === 0 && (
            <ChatEmptyState
              cwd={cwd}
              sessionId={sessionId ?? ''}
              lastSessionId={lastSessionId}
              onResumeLastSession={() => lastSessionId && setSessionForResume(lastSessionId)}
              onPickFolder={() => void window.electron.selectFolder().then((p) => { if (p) setCwd(p) })}
              onSendPrompt={(prompt) => handleSend(prompt)}
            />
          )}
          {filteredMessages.map((msg) => (
            <MessageBubble key={msg.id} msg={msg} />
          ))}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div style={{ padding: '8px 24px 12px', borderTop: '1px solid var(--color-border)', background: 'var(--color-surface)', flexShrink: 0 }}>
        <div style={{ maxWidth: 680, margin: '0 auto', width: '100%' }}>
          <PromptInput
            onSend={handleSend}
            onStop={abortSession}
            disabled={!cwd || running}
            running={running}
          />
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
