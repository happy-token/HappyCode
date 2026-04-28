import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronRight, ChevronDown, X } from 'lucide-react'
import { useHistoryStore, buildSessionTitle } from '../../store/history-store'
import type { ProjectHistory, SessionSummary } from '../../../electron/shared/types'
import { cn } from '@renderer/lib/utils'

interface Props {
  currentCwd: string
  onSelectSession: (cwd: string, sessionId: string, encodedPath: string) => void
}

interface TooltipState {
  session: SessionSummary
  x: number
  y: number
}

export function HistorySidebar({ currentCwd, onSelectSession }: Props): React.JSX.Element {
  const { projects, loading, load, deleteSession, deleteProject } = useHistoryStore()
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'session' | 'project'; encodedPath: string; sessionId?: string } | null>(null)
  const [hoveredSessionId, setHoveredSessionId] = useState<string | null>(null)
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

  function handleSelectSession(project: ProjectHistory, session: SessionSummary): void {
    onSelectSession(project.cwd, session.sessionId, project.encodedPath)
  }

  async function handleDeleteSession(encodedPath: string, sessionId: string): Promise<void> {
    await deleteSession(encodedPath, sessionId)
    setConfirmDelete(null)
  }

  async function handleDeleteProject(encodedPath: string): Promise<void> {
    await deleteProject(encodedPath)
    setConfirmDelete(null)
  }

  // Sort: current project first, then by lastUsed
  const sorted = [...projects].sort((a, b) => {
    const aIsCurrent = a.cwd === currentCwd ? 1 : 0
    const bIsCurrent = b.cwd === currentCwd ? 1 : 0
    if (aIsCurrent !== bIsCurrent) return bIsCurrent - aIsCurrent
    return b.lastUsed - a.lastUsed
  })

  return (
    <div className="w-[220px] flex-shrink-0 flex flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-[var(--color-border)] flex-shrink-0">
        <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-[0.06em]">
          History
        </span>
        <button
          onClick={() => void load()}
          title="Refresh"
          className="text-[11px] text-[var(--color-text-muted)] px-1 py-px border-none bg-transparent cursor-pointer"
        >
          ↻
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="p-3 text-[11px] text-[var(--color-text-muted)]">Loading…</div>
        )}
        {!loading && sorted.length === 0 && (
          <div className="p-3 text-[11px] text-[var(--color-text-muted)]">No history found</div>
        )}
        {sorted.map((project) => {
          const isCurrent = project.cwd === currentCwd
          const isCollapsed = !expanded.has(project.encodedPath)
          return (
            <div key={project.encodedPath}>
              {/* Project header row */}
              <div
                className={cn(
                  'flex items-center gap-1 py-[5px] pr-2 pl-2.5 border-l-2 cursor-pointer select-none transition-colors',
                  isCurrent
                    ? 'bg-[var(--color-accent-dim)] border-l-[var(--color-accent)]'
                    : 'bg-transparent border-l-transparent hover:bg-[var(--color-surface-2)]',
                )}
                onClick={() => toggleCollapse(project.encodedPath)}
              >
                {isCollapsed
                  ? <ChevronRight size={10} className="w-[10px] flex-shrink-0 text-[var(--color-text-muted)]" />
                  : <ChevronDown size={10} className="w-[10px] flex-shrink-0 text-[var(--color-text-muted)]" />
                }
                <span
                  className={cn(
                    'text-[11px] font-semibold flex-1 overflow-hidden text-ellipsis whitespace-nowrap',
                    isCurrent ? 'text-[var(--color-accent)]' : 'text-[var(--color-text)]',
                  )}
                  title={project.cwd}
                >
                  {project.projectName}
                </span>
                <span className="text-[9px] text-[var(--color-text-muted)] flex-shrink-0">
                  {project.sessions.length}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setConfirmDelete({ type: 'project', encodedPath: project.encodedPath })
                  }}
                  title="Delete project history"
                  className="flex flex-shrink-0 cursor-pointer items-center border-none bg-transparent px-[3px] py-px text-[var(--color-text-muted)] opacity-50 transition-all hover:opacity-100 hover:text-[var(--color-danger)]"
                >
                  <X size={10} />
                </button>
              </div>

              {/* Sessions */}
              {!isCollapsed && project.sessions.map((session) => {
                const title = buildSessionTitle(session)
                const isHovered = hoveredSessionId === session.sessionId
                return (
                  <div
                    key={session.sessionId}
                    className={cn(
                      'flex items-center gap-1 py-1 px-2 pl-[22px] cursor-pointer transition-colors',
                      isHovered ? 'bg-[var(--color-surface-2)]' : 'bg-transparent hover:bg-[var(--color-surface-2)]',
                    )}
                    onClick={() => handleSelectSession(project, session)}
                    onMouseEnter={(e) => {
                      setHoveredSessionId(session.sessionId)
                      const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
                      if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current)
                      tooltipTimerRef.current = setTimeout(() => {
                        setTooltip({ session, x: rect.right + 6, y: rect.top })
                      }, 400)
                    }}
                    onMouseLeave={() => {
                      setHoveredSessionId(null)
                      if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current)
                      setTooltip(null)
                    }}
                  >
                    <span className="text-[11px] text-[var(--color-text-muted)] flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                      {title}
                    </span>
                    {isHovered && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setConfirmDelete({ type: 'session', encodedPath: project.encodedPath, sessionId: session.sessionId })
                        }}
                        title="Delete session"
                        className="flex flex-shrink-0 cursor-pointer items-center border-none bg-transparent px-[3px] py-px text-[var(--color-danger)] transition-opacity hover:opacity-80"
                      >
                        <X size={10} />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      {/* Custom hover tooltip — rendered via portal to escape overflow:hidden */}
      {tooltip && createPortal(
        <div
          className="fixed w-[280px] z-[9999] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] shadow-[0_4px_20px_rgba(0,0,0,0.35)] px-3 py-2.5 pointer-events-none"
          style={{ left: tooltip.x, top: Math.max(8, tooltip.y) }}
        >
          {tooltip.session.firstUserText ? (
            <div className={cn(tooltip.session.lastUserText && tooltip.session.lastUserText !== tooltip.session.firstUserText ? 'mb-2' : '')}>
              <div className="text-[9px] font-bold text-[var(--color-text-muted)] uppercase tracking-[0.05em] mb-[3px]">First message</div>
              <div className="text-[11px] text-[var(--color-text)] leading-[1.5] break-words">
                {tooltip.session.firstUserText}
              </div>
            </div>
          ) : null}
          {tooltip.session.lastUserText && tooltip.session.lastUserText !== tooltip.session.firstUserText ? (
            <div>
              <div className="text-[9px] font-bold text-[var(--color-text-muted)] uppercase tracking-[0.05em] mb-[3px]">Last message</div>
              <div className="text-[11px] text-[var(--color-text)] leading-[1.5] break-words">
                {tooltip.session.lastUserText}
              </div>
            </div>
          ) : null}
          <div className="mt-2 pt-1.5 border-t border-[var(--color-border)] text-[9px] text-[var(--color-text-muted)] font-mono flex justify-between">
            <span>{new Date(tooltip.session.lastUsed).toLocaleString()}</span>
            <span>{tooltip.session.sessionId.slice(0, 8)}</span>
          </div>
        </div>,
        document.body
      )}

      {/* Confirm delete dialog */}
      {confirmDelete && (
        <div
          className="absolute inset-0 bg-[rgba(0,0,0,0.5)] flex items-center justify-center z-[200]"
          onClick={() => setConfirmDelete(null)}
        >
          <div
            className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-4 w-[200px] shadow-[0_8px_24px_rgba(0,0,0,0.4)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-[12px] font-semibold mb-2">
              {confirmDelete.type === 'project' ? 'Delete project history?' : 'Delete session?'}
            </div>
            <div className="text-[11px] text-[var(--color-text-muted)] mb-3">
              {confirmDelete.type === 'project'
                ? 'All sessions for this project will be deleted.'
                : 'This session will be permanently deleted.'}
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmDelete(null)}
                className="text-[11px] px-2.5 py-[3px] border border-[var(--color-border)] rounded-[var(--radius-sm)] cursor-pointer"
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
                className="cursor-pointer rounded-[var(--radius-sm)] border border-[var(--color-danger)] bg-[var(--color-danger)] px-2.5 py-[3px] text-[11px] text-white"
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
