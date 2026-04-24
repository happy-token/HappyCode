import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { RefreshCw, History } from 'lucide-react'
import { useHistoryStore, buildSessionTitle } from '../../store/history-store'
import { useTabStore, selectActiveTab } from '../../store/tab-store'
import { useUiStore } from '../../store/ui-store'
import type { ProjectHistory, SessionSummary } from '../../../electron/shared/types'

interface TooltipState {
  session: SessionSummary
  x: number
  y: number
}

interface ConfirmDelete {
  type: 'session' | 'project'
  encodedPath: string
  sessionId?: string
}

type DatePreset = 'all' | 'today' | 'week' | 'month'

function datePresetStart(preset: DatePreset): number {
  const now = Date.now()
  if (preset === 'today') {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d.getTime()
  }
  if (preset === 'week') return now - 7 * 24 * 60 * 60 * 1000
  if (preset === 'month') return now - 30 * 24 * 60 * 60 * 1000
  return 0
}

export function SessionsPage(): React.JSX.Element {
  const { projects, loading, load, deleteSession, deleteProject } = useHistoryStore()
  const loadAndResumeSession = useTabStore((s) => s.loadAndResumeSession)
  const cwd = useTabStore((s) => selectActiveTab(s)?.cwd ?? '')
  const setActivePage = useUiStore((s) => s.setActivePage)

  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [datePreset, setDatePreset] = useState<DatePreset>('all')
  const [confirmDelete, setConfirmDelete] = useState<ConfirmDelete | null>(null)
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)
  const tooltipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    void load()
  }, [load])

  function toggleCollapse(encodedPath: string): void {
    setExpanded((s) => {
      const next = new Set(s)
      if (next.has(encodedPath)) next.delete(encodedPath)
      else next.add(encodedPath)
      return next
    })
  }

  async function handleSelectSession(project: ProjectHistory, session: SessionSummary): Promise<void> {
    await loadAndResumeSession(project.encodedPath, session.sessionId, project.cwd)
    setActivePage('chat')
  }

  async function handleDeleteSession(encodedPath: string, sessionId: string): Promise<void> {
    await deleteSession(encodedPath, sessionId)
    setConfirmDelete(null)
  }

  async function handleDeleteProject(encodedPath: string): Promise<void> {
    await deleteProject(encodedPath)
    setConfirmDelete(null)
  }

  function sessionMatchesSearch(session: SessionSummary, q: string): boolean {
    const lower = q.toLowerCase()
    return (
      (session.firstUserText?.toLowerCase().includes(lower) ?? false) ||
      (session.lastUserText?.toLowerCase().includes(lower) ?? false) ||
      session.sessionId.toLowerCase().includes(lower)
    )
  }

  // Sort: current project first, then by lastUsed
  const sorted = [...projects].sort((a, b) => {
    const aIsCurrent = a.cwd === cwd ? 1 : 0
    const bIsCurrent = b.cwd === cwd ? 1 : 0
    if (aIsCurrent !== bIsCurrent) return bIsCurrent - aIsCurrent
    return b.lastUsed - a.lastUsed
  })

  const cutoff = datePresetStart(datePreset)

  const filtered = sorted
    .map((p) => ({
      ...p,
      sessions: p.sessions.filter((s) => {
        if (cutoff > 0 && s.lastUsed < cutoff) return false
        if (searchQuery) return sessionMatchesSearch(s, searchQuery)
        return true
      }),
    }))
    .filter((p) =>
      p.sessions.length > 0 ||
      (cutoff === 0 && !searchQuery) ||
      p.projectName.toLowerCase().includes(searchQuery.toLowerCase())
    )

  const totalSessions = projects.reduce((n, p) => n + p.sessions.length, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '0 16px',
          height: 44,
          borderBottom: '1px solid var(--color-border)',
          background: 'var(--color-surface)',
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>Sessions</span>
        <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
          {projects.length} projects · {totalSessions} sessions
        </span>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => void load()}
          title="Refresh"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 11,
            color: 'var(--color-text-muted)',
            padding: '3px 8px',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
          }}
        >
          <RefreshCw size={12} />
          Refresh
        </button>
      </div>

      {/* Search + Filter */}
      <div
        style={{
          padding: '8px 16px 0',
          borderBottom: '1px solid var(--color-border)',
          background: 'var(--color-surface)',
          flexShrink: 0,
        }}
      >
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search sessions…"
          style={{
            width: '100%',
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            padding: '5px 10px',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--color-surface-2)',
            color: 'var(--color-text)',
          }}
        />
        {/* Date filter presets */}
        <div style={{ display: 'flex', gap: 4, marginTop: 8, marginBottom: 8 }}>
          {(['all', 'today', 'week', 'month'] as DatePreset[]).map((p) => {
            const active = datePreset === p
            const labels: Record<DatePreset, string> = { all: 'All time', today: 'Today', week: 'This week', month: 'This month' }
            return (
              <button
                key={p}
                onClick={() => setDatePreset(p)}
                style={{
                  fontSize: 11,
                  padding: '3px 10px',
                  border: `1px solid ${active ? 'var(--color-accent)' : 'var(--color-border)'}`,
                  borderRadius: 'var(--radius-sm)',
                  background: active ? 'var(--color-accent-dim)' : 'transparent',
                  color: active ? 'var(--color-accent)' : 'var(--color-text-muted)',
                  cursor: 'pointer',
                }}
              >
                {labels[p]}
              </button>
            )
          })}
        </div>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading && (
          <div style={{ padding: 24, fontSize: 12, color: 'var(--color-text-muted)', textAlign: 'center' }}>
            Loading…
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              padding: 48,
              color: 'var(--color-text-muted)',
            }}
          >
            <History size={28} />
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>
              {searchQuery ? 'No sessions match' : 'No sessions yet'}
            </div>
            <div style={{ fontSize: 12 }}>
              {searchQuery ? `Try a different search term` : 'Start a conversation in Chat to see it here'}
            </div>
          </div>
        )}

        {filtered.map((project) => {
          const isCurrent = project.cwd === cwd
          const isExpanded = searchQuery ? true : expanded.has(project.encodedPath)

          const visibleSessions = searchQuery
            ? project.sessions.filter((s) => sessionMatchesSearch(s, searchQuery))
            : project.sessions

          return (
            <div key={project.encodedPath}>
              {/* Project row */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '7px 16px',
                  background: isCurrent ? 'var(--color-accent-dim)' : 'transparent',
                  borderLeft: `2px solid ${isCurrent ? 'var(--color-accent)' : 'transparent'}`,
                  cursor: 'pointer',
                  userSelect: 'none',
                  borderBottom: '1px solid var(--color-border)',
                }}
                onClick={() => toggleCollapse(project.encodedPath)}
                onMouseEnter={(e) => {
                  if (!isCurrent) (e.currentTarget as HTMLDivElement).style.background = 'var(--color-surface-2)'
                }}
                onMouseLeave={(e) => {
                  if (!isCurrent) (e.currentTarget as HTMLDivElement).style.background = 'transparent'
                }}
              >
                <span style={{ fontSize: 9, color: 'var(--color-text-muted)', width: 10, flexShrink: 0 }}>
                  {isExpanded ? '▼' : '▶'}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: isCurrent ? 'var(--color-accent)' : 'var(--color-text)',
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={project.cwd}
                >
                  {project.projectName}
                </span>
                <span style={{ fontSize: 10, color: 'var(--color-text-faint)', flexShrink: 0, fontFamily: 'var(--font-mono)' }}>
                  {project.sessions.length}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setConfirmDelete({ type: 'project', encodedPath: project.encodedPath })
                  }}
                  title="Delete project history"
                  style={{
                    fontSize: 11,
                    color: 'var(--color-text-faint)',
                    padding: '2px 4px',
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    flexShrink: 0,
                    lineHeight: 1,
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-danger)'
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-faint)'
                  }}
                >
                  ✕
                </button>
              </div>

              {/* Session rows */}
              {isExpanded && visibleSessions.map((session) => {
                const title = buildSessionTitle(session)
                const relDate = formatRelDate(session.lastUsed)
                return (
                  <div
                    key={session.sessionId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '6px 16px 6px 32px',
                      cursor: 'pointer',
                      borderBottom: '1px solid var(--color-border)',
                    }}
                    onClick={() => void handleSelectSession(project, session)}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLDivElement).style.background = 'var(--color-surface-2)'
                      const del = (e.currentTarget as HTMLDivElement).querySelector<HTMLButtonElement>('.del-btn')
                      if (del) del.style.opacity = '1'
                      const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
                      if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current)
                      tooltipTimerRef.current = setTimeout(() => {
                        setTooltip({ session, x: rect.right + 6, y: rect.top })
                      }, 400)
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLDivElement).style.background = 'transparent'
                      const del = (e.currentTarget as HTMLDivElement).querySelector<HTMLButtonElement>('.del-btn')
                      if (del) del.style.opacity = '0'
                      if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current)
                      setTooltip(null)
                    }}
                  >
                    <span
                      style={{
                        fontSize: 12,
                        color: 'var(--color-text)',
                        flex: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {title}
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--color-text-faint)', flexShrink: 0, fontFamily: 'var(--font-mono)' }}>
                      {relDate}
                    </span>
                    <button
                      className="del-btn"
                      onClick={(e) => {
                        e.stopPropagation()
                        setConfirmDelete({ type: 'session', encodedPath: project.encodedPath, sessionId: session.sessionId })
                      }}
                      title="Delete session"
                      style={{
                        fontSize: 11,
                        color: 'var(--color-danger)',
                        padding: '2px 4px',
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        flexShrink: 0,
                        opacity: 0,
                        lineHeight: 1,
                        transition: 'opacity 0.1s',
                      }}
                    >
                      ✕
                    </button>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      {/* Tooltip */}
      {tooltip && createPortal(
        <div
          style={{
            position: 'fixed',
            left: tooltip.x,
            top: Math.max(8, tooltip.y),
            width: 300,
            zIndex: 9999,
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
            padding: '10px 12px',
            pointerEvents: 'none',
          }}
        >
          {tooltip.session.firstUserText && (
            <div style={{ marginBottom: tooltip.session.lastUserText && tooltip.session.lastUserText !== tooltip.session.firstUserText ? 8 : 0 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>
                First message
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-text)', lineHeight: 1.5, wordBreak: 'break-word' }}>
                {tooltip.session.firstUserText}
              </div>
            </div>
          )}
          {tooltip.session.lastUserText && tooltip.session.lastUserText !== tooltip.session.firstUserText && (
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>
                Last message
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-text)', lineHeight: 1.5, wordBreak: 'break-word' }}>
                {tooltip.session.lastUserText}
              </div>
            </div>
          )}
          <div
            style={{
              marginTop: 8,
              paddingTop: 6,
              borderTop: '1px solid var(--color-border)',
              fontSize: 9,
              color: 'var(--color-text-muted)',
              fontFamily: 'var(--font-mono)',
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <span>{new Date(tooltip.session.lastUsed).toLocaleString()}</span>
            <span>{tooltip.session.sessionId.slice(0, 8)}</span>
          </div>
        </div>,
        document.body
      )}

      {/* Confirm delete dialog */}
      {confirmDelete && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 200,
          }}
          onClick={() => setConfirmDelete(null)}
        >
          <div
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: 20,
              width: 240,
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
              {confirmDelete.type === 'project' ? 'Delete project history?' : 'Delete session?'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 16, lineHeight: 1.5 }}>
              {confirmDelete.type === 'project'
                ? 'All sessions for this project will be permanently deleted.'
                : 'This session will be permanently deleted.'}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setConfirmDelete(null)}
                style={{
                  fontSize: 12,
                  padding: '5px 14px',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  color: 'var(--color-text-muted)',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (confirmDelete.type === 'session' && confirmDelete.sessionId) {
                    void handleDeleteSession(confirmDelete.encodedPath, confirmDelete.sessionId)
                  } else {
                    void handleDeleteProject(confirmDelete.encodedPath)
                  }
                }}
                style={{
                  fontSize: 12,
                  padding: '5px 14px',
                  border: '1px solid var(--color-danger)',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--color-danger)',
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function formatRelDate(ts: number): string {
  const diff = Date.now() - ts
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  return new Date(ts).toLocaleDateString()
}
