import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useHistoryStore, buildSessionTitle } from '../../store/history-store'
import type { ProjectHistory, SessionSummary } from '../../../electron/shared/types'

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
    <div
      style={{
        width: 220,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid var(--color-border)',
        background: 'var(--color-surface)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 10px',
          borderBottom: '1px solid var(--color-border)',
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          History
        </span>
        <button
          onClick={() => void load()}
          title="Refresh"
          style={{ fontSize: 11, color: 'var(--color-text-muted)', padding: '1px 4px', border: 'none', background: 'transparent', cursor: 'pointer' }}
        >
          ↻
        </button>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading && (
          <div style={{ padding: 12, fontSize: 11, color: 'var(--color-text-muted)' }}>Loading…</div>
        )}
        {!loading && sorted.length === 0 && (
          <div style={{ padding: 12, fontSize: 11, color: 'var(--color-text-muted)' }}>No history found</div>
        )}
        {sorted.map((project) => {
          const isCurrent = project.cwd === currentCwd
          const isCollapsed = !expanded.has(project.encodedPath)
          return (
            <div key={project.encodedPath}>
              {/* Project header row */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '5px 8px 5px 10px',
                  background: isCurrent ? 'var(--color-accent-dim)' : 'transparent',
                  borderLeft: isCurrent ? '2px solid var(--color-accent)' : '2px solid transparent',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
                onClick={() => toggleCollapse(project.encodedPath)}
                onMouseEnter={(e) => { if (!isCurrent) (e.currentTarget as HTMLDivElement).style.background = 'var(--color-surface-2)' }}
                onMouseLeave={(e) => { if (!isCurrent) (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
              >
                <span style={{ fontSize: 9, color: 'var(--color-text-muted)', width: 10 }}>
                  {isCollapsed ? '▶' : '▼'}
                </span>
                <span
                  style={{
                    fontSize: 11,
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
                <span style={{ fontSize: 9, color: 'var(--color-text-muted)', flexShrink: 0 }}>
                  {project.sessions.length}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setConfirmDelete({ type: 'project', encodedPath: project.encodedPath })
                  }}
                  title="Delete project history"
                  style={{
                    fontSize: 10,
                    color: 'var(--color-text-muted)',
                    padding: '1px 3px',
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    opacity: 0.5,
                    flexShrink: 0,
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; (e.currentTarget as HTMLButtonElement).style.color = '#ef4444' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.5'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-muted)' }}
                >
                  ✕
                </button>
              </div>

              {/* Sessions */}
              {!isCollapsed && project.sessions.map((session) => {
                const title = buildSessionTitle(session)
                const isHovered = hoveredSessionId === session.sessionId
                return (
                  <div
                    key={session.sessionId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '4px 8px 4px 22px',
                      cursor: 'pointer',
                      background: isHovered ? 'var(--color-surface-2)' : 'transparent',
                    }}
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
                    <span
                      style={{
                        fontSize: 11,
                        color: 'var(--color-text-muted)',
                        flex: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {title}
                    </span>
                    {isHovered && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setConfirmDelete({ type: 'session', encodedPath: project.encodedPath, sessionId: session.sessionId })
                        }}
                        title="Delete session"
                        style={{
                          fontSize: 10,
                          color: '#ef4444',
                          padding: '1px 3px',
                          border: 'none',
                          background: 'transparent',
                          cursor: 'pointer',
                          flexShrink: 0,
                        }}
                      >
                        ✕
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
          style={{
            position: 'fixed',
            left: tooltip.x,
            top: Math.max(8, tooltip.y),
            width: 280,
            zIndex: 9999,
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.35)',
            padding: '10px 12px',
            pointerEvents: 'none',
          }}
        >
          {tooltip.session.firstUserText ? (
            <div style={{ marginBottom: tooltip.session.lastUserText && tooltip.session.lastUserText !== tooltip.session.firstUserText ? 8 : 0 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>First message</div>
              <div style={{ fontSize: 11, color: 'var(--color-text)', lineHeight: 1.5, wordBreak: 'break-word' }}>
                {tooltip.session.firstUserText}
              </div>
            </div>
          ) : null}
          {tooltip.session.lastUserText && tooltip.session.lastUserText !== tooltip.session.firstUserText ? (
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>Last message</div>
              <div style={{ fontSize: 11, color: 'var(--color-text)', lineHeight: 1.5, wordBreak: 'break-word' }}>
                {tooltip.session.lastUserText}
              </div>
            </div>
          ) : null}
          <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px solid var(--color-border)', fontSize: 9, color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)', display: 'flex', justifyContent: 'space-between' }}>
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
              padding: 16,
              width: 200,
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
              {confirmDelete.type === 'project' ? 'Delete project history?' : 'Delete session?'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 12 }}>
              {confirmDelete.type === 'project'
                ? 'All sessions for this project will be deleted.'
                : 'This session will be permanently deleted.'}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setConfirmDelete(null)}
                style={{ fontSize: 11, padding: '3px 10px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}
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
                style={{ fontSize: 11, padding: '3px 10px', border: '1px solid #ef4444', borderRadius: 'var(--radius-sm)', background: '#ef4444', color: '#fff', cursor: 'pointer' }}
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
