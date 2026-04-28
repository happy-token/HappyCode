import React, { useEffect, useRef, useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { RefreshCw, History, X, ChevronRight } from 'lucide-react'
import { Meteors } from '@renderer/components/ui/meteors'
import { MagicCard } from '@renderer/components/ui/magic-card'
import { useHistoryStore, buildSessionTitle } from '../../store/history-store'
import { useTabStore, selectActiveTab } from '../../store/tab-store'
import { useUiStore } from '../../store/ui-store'
import type { ProjectHistory, SessionSummary } from '../../../electron/shared/types'

interface ContextMenu {
  x: number
  y: number
  project: ProjectHistory
  session: SessionSummary
}

interface ConfirmDelete {
  type: 'session' | 'project'
  encodedPath: string
  sessionId?: string
}

interface TooltipState {
  session: SessionSummary
  x: number
  y: number
}

type DatePreset = 'all' | 'today' | 'week' | 'month'

const DATE_PRESET_LABELS: Record<DatePreset, string> = {
  all: 'All time',
  today: 'Today',
  week: 'This week',
  month: 'This month',
}

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

export function SessionsPage(): React.JSX.Element {
  const { projects, loading, load, deleteSession, deleteProject } = useHistoryStore()
  const loadAndResumeSession = useTabStore((s) => s.loadAndResumeSession)
  const cwd = useTabStore((s) => selectActiveTab(s)?.cwd ?? '')
  const setActivePage = useUiStore((s) => s.setActivePage)

  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [datePreset, setDatePreset] = useState<DatePreset>('all')
  const [confirmDelete, setConfirmDelete] = useState<ConfirmDelete | null>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null)
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)
  const tooltipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { void load() }, [load])

  // Auto-expand current project
  useEffect(() => {
    if (!cwd || projects.length === 0) return
    const cur = projects.find((p) => p.cwd === cwd)
    if (cur) setExpanded((prev) => new Set([...prev, cur.encodedPath]))
  }, [projects, cwd])

  // ⌘K focuses search; Escape closes menus
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
      if (e.key === 'Escape') {
        setContextMenu(null)
        setTooltip(null)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return
    const close = () => setContextMenu(null)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [contextMenu])

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

  const sorted = useMemo(
    () =>
      [...projects].sort((a, b) => {
        const aC = a.cwd === cwd ? 1 : 0
        const bC = b.cwd === cwd ? 1 : 0
        if (aC !== bC) return bC - aC
        return b.lastUsed - a.lastUsed
      }),
    [projects, cwd]
  )

  const cutoff = datePresetStart(datePreset)

  const filtered = useMemo(
    () =>
      sorted
        .map((p) => ({
          ...p,
          sessions: p.sessions.filter((s) => {
            if (cutoff > 0 && s.lastUsed < cutoff) return false
            if (searchQuery) return sessionMatchesSearch(s, searchQuery)
            return true
          }),
        }))
        .filter(
          (p) =>
            p.sessions.length > 0 ||
            (cutoff === 0 && !searchQuery) ||
            p.projectName.toLowerCase().includes(searchQuery.toLowerCase())
        ),
    [sorted, cutoff, searchQuery]
  )

  const totalSessions = projects.reduce((n, p) => n + p.sessions.length, 0)

  return (
    <div className="sp-wrap">
      {/* Header */}
      <div className="sp-header">
        <span className="sp-header-title">Sessions</span>
        <span className="sp-header-count">
          {projects.length} projects · {totalSessions} sessions
        </span>
        <div className="flex-1" />
        <button className="sp-refresh-btn" onClick={() => void load()} title="Refresh">
          <RefreshCw size={12} />
          Refresh
        </button>
      </div>

      {/* Search + date filters */}
      <div className="sp-filter-zone">
        <div className="sp-search">
          <input
            ref={searchInputRef}
            className="sp-search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search sessions…  ⌘K"
          />
          {searchQuery && (
            <button className="sp-search-clear" onClick={() => setSearchQuery('')} aria-label="Clear">
              <X size={10} />
            </button>
          )}
        </div>
        <div className="sp-date-row">
          {(['all', 'today', 'week', 'month'] as DatePreset[]).map((p) => (
            <button
              key={p}
              onClick={() => setDatePreset(p)}
              className={`sp-date-btn${datePreset === p ? ' active' : ''}`}
            >
              {DATE_PRESET_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="sp-list">
        {loading && <div className="sp-loading">Loading…</div>}

        {!loading && filtered.length === 0 && (
          <div className="sp-empty relative overflow-hidden">
            <Meteors number={10} />
            <History size={28} className="relative z-10" />
            <div className="sp-empty-title relative z-10">
              {searchQuery ? 'No sessions match' : 'No sessions yet'}
            </div>
            <div className="sp-empty-sub relative z-10">
              {searchQuery
                ? 'Try a different search term'
                : 'Start a conversation in Chat to see it here'}
            </div>
          </div>
        )}

        {filtered.map((project) => {
          const isCurrent = project.cwd === cwd
          const isOpen = searchQuery ? true : expanded.has(project.encodedPath)
          const visibleSessions = searchQuery
            ? project.sessions.filter((s) => sessionMatchesSearch(s, searchQuery))
            : project.sessions

          return (
            <MagicCard
              key={project.encodedPath}
              className="rounded-[var(--radius-md)]"
              gradientSize={160}
              gradientOpacity={0.15}
            >
              <details
                className="sp-project"
                open={isOpen}
                onToggle={(e) => {
                  if (searchQuery) return
                  const open = (e.currentTarget as HTMLDetailsElement).open
                  setExpanded((prev) => {
                    const next = new Set(prev)
                    if (open) next.add(project.encodedPath)
                    else next.delete(project.encodedPath)
                    return next
                  })
                }}
              >
              <summary
                className={`sp-project-summary${isCurrent ? ' sp-project-current' : ''}`}
                onClick={(e) => {
                  if (searchQuery) e.preventDefault()
                }}
              >
                <ChevronRight size={10} className="sp-project-chevron" />
                <span className="sp-project-name" title={project.cwd}>
                  {project.projectName}
                </span>
                <span className="sp-project-count">{project.sessions.length}</span>
                <button
                  className="sp-project-del"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setConfirmDelete({ type: 'project', encodedPath: project.encodedPath })
                  }}
                  title="Delete project history"
                >
                  <X size={10} />
                </button>
              </summary>

              <div>
                {visibleSessions.map((session) => {
                  const title = buildSessionTitle(session)
                  return (
                    <div
                      key={session.sessionId}
                      className="sp-session"
                      onClick={() => void handleSelectSession(project, session)}
                      onContextMenu={(e) => {
                        e.preventDefault()
                        setContextMenu({ x: e.clientX, y: e.clientY, project, session })
                      }}
                      onMouseEnter={(e) => {
                        const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
                        if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current)
                        tooltipTimerRef.current = setTimeout(() => {
                          setTooltip({ session, x: rect.right + 6, y: rect.top })
                        }, 400)
                      }}
                      onMouseLeave={() => {
                        if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current)
                        setTooltip(null)
                      }}
                    >
                      <span className="sp-session-title">{title}</span>
                      <span className="sp-session-time">{formatRelDate(session.lastUsed)}</span>
                      <button
                        className="sp-session-del"
                        onClick={(e) => {
                          e.stopPropagation()
                          setConfirmDelete({
                            type: 'session',
                            encodedPath: project.encodedPath,
                            sessionId: session.sessionId,
                          })
                        }}
                        title="Delete session"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  )
                })}
              </div>
              </details>
            </MagicCard>
          )
        })}
      </div>

      {/* Context menu */}
      {contextMenu &&
        createPortal(
          <div
            className="sp-ctx-menu"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="sp-ctx-item sp-ctx-danger"
              onClick={() => {
                setConfirmDelete({
                  type: 'session',
                  encodedPath: contextMenu.project.encodedPath,
                  sessionId: contextMenu.session.sessionId,
                })
                setContextMenu(null)
              }}
            >
              Delete session
            </button>
          </div>,
          document.body
        )}

      {/* Hover tooltip */}
      {tooltip &&
        createPortal(
          <div
            className="sp-tooltip"
            style={{ left: tooltip.x, top: Math.max(8, tooltip.y) }}
          >
            {tooltip.session.firstUserText && (
              <div className="sp-tooltip-section">
                <div className="sp-tooltip-label">First message</div>
                <div className="sp-tooltip-text">{tooltip.session.firstUserText}</div>
              </div>
            )}
            {tooltip.session.lastUserText &&
              tooltip.session.lastUserText !== tooltip.session.firstUserText && (
                <div className="sp-tooltip-section">
                  <div className="sp-tooltip-label">Last message</div>
                  <div className="sp-tooltip-text">{tooltip.session.lastUserText}</div>
                </div>
              )}
            <div className="sp-tooltip-footer">
              <span>{new Date(tooltip.session.lastUsed).toLocaleString()}</span>
              <span>{tooltip.session.sessionId.slice(0, 8)}</span>
            </div>
          </div>,
          document.body
        )}

      {/* Confirm delete */}
      {confirmDelete && (
        <div className="sp-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="sp-confirm" onClick={(e) => e.stopPropagation()}>
            <div className="sp-confirm-title">
              {confirmDelete.type === 'project' ? 'Delete project history?' : 'Delete session?'}
            </div>
            <div className="sp-confirm-desc">
              {confirmDelete.type === 'project'
                ? 'All sessions for this project will be permanently deleted.'
                : 'This session will be permanently deleted.'}
            </div>
            <div className="sp-confirm-actions">
              <button className="sp-confirm-cancel" onClick={() => setConfirmDelete(null)}>
                Cancel
              </button>
              <button
                className="sp-confirm-delete"
                onClick={() => {
                  if (confirmDelete.type === 'session' && confirmDelete.sessionId) {
                    void handleDeleteSession(confirmDelete.encodedPath, confirmDelete.sessionId)
                  } else {
                    void handleDeleteProject(confirmDelete.encodedPath)
                  }
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
