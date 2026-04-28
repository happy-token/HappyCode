import React, { useEffect, useCallback, useMemo, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  Settings, Plus, X, Folder, Check, AlertCircle, ChevronLeft, ChevronRight,
  PanelLeftClose, PanelLeftOpen, Sun, Moon, Pin, GripVertical,
} from 'lucide-react'
import { useUiStore } from '../../store/ui-store'
import { useTabStore, selectActiveTab, getDisplayStatus } from '../../store/tab-store'
import { useHistoryStore, buildSessionTitle } from '../../store/history-store'
import { SettingsTabButton, SETTINGS_TABS, SETTINGS_BOTTOM_TABS } from '../settings/SettingsTabs'
import type { ProjectHistory, SessionSummary } from '../../../electron/shared/types'
import { cn } from '@renderer/lib/utils'

function formatRelTime(ts: number): string {
  const m = Math.floor((Date.now() - ts) / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

function getParentDir(cwd: string): string {
  const parts = cwd.split('/').filter(Boolean)
  return parts.length >= 2 ? parts[parts.length - 2] : ''
}

function reorderArray(arr: string[], dragId: string, targetId: string, pos: 'before' | 'after'): string[] {
  const without = arr.filter((id) => id !== dragId)
  const idx = without.indexOf(targetId)
  if (idx === -1) return [...without, dragId]
  const at = pos === 'before' ? idx : idx + 1
  return [...without.slice(0, at), dragId, ...without.slice(at)]
}

export function Sidebar(): React.JSX.Element {
  const activePage = useUiStore((s) => s.activePage)
  const setActivePage = useUiStore((s) => s.setActivePage)
  const theme = useUiStore((s) => s.theme)
  const toggleTheme = useUiStore((s) => s.toggleTheme)
  const pinnedProjects = useUiStore((s) => s.pinnedProjects)
  const projectOrder = useUiStore((s) => s.projectOrder)
  const togglePin = useUiStore((s) => s.togglePin)
  const setPinnedOrder = useUiStore((s) => s.setPinnedOrder)
  const setProjectOrder = useUiStore((s) => s.setProjectOrder)
  const collapsed = useUiStore((s) => s.sidebarCollapsed)
  const setSidebarCollapsed = useUiStore((s) => s.setSidebarCollapsed)

  const cwd = useTabStore((s) => selectActiveTab(s)?.cwd ?? '')
  const activeSessionId = useTabStore((s) => selectActiveTab(s)?.sessionId ?? null)
  const addTab = useTabStore((s) => s.addTab)
  const loadAndResumeSession = useTabStore((s) => s.loadAndResumeSession)
  const clearDoneIndicator = useTabStore((s) => s.clearDoneIndicator)
  const tabs = useTabStore((s) => s.tabs)

  const { projects, load, deleteSession, deleteProject } = useHistoryStore()

  const [searchQuery, setSearchQuery] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [recentExpanded, setRecentExpanded] = useState(true)
  const [hoveredSessionId, setHoveredSessionId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<{
    type: 'session' | 'project'; encodedPath: string; sessionId?: string
  } | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('happycode:sidebarWidth')
    return saved ? Math.max(160, Math.min(400, parseInt(saved, 10))) : 220
  })
  const [isResizing, setIsResizing] = useState(false)

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startW = sidebarWidth
    setIsResizing(true)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const onMove = (ev: MouseEvent) => {
      const w = Math.max(160, Math.min(400, startW + ev.clientX - startX))
      setSidebarWidth(w)
      localStorage.setItem('happycode:sidebarWidth', String(w))
    }
    const onUp = () => {
      setIsResizing(false)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [sidebarWidth])

  const [showDialog, setShowDialog] = useState(false)
  const [dialogDir, setDialogDir] = useState('')
  const dirInputRef = useRef<HTMLInputElement>(null)

  // Drag state
  const dragState = useRef<{ id: string; section: 'pinned' | 'unpinned' } | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [dragOverPos, setDragOverPos] = useState<'before' | 'after'>('before')
  const [draggingId, setDraggingId] = useState<string | null>(null)

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    if (!cwd || projects.length === 0) return
    const cur = projects.find((p) => p.cwd === cwd)
    if (cur) setExpanded((prev) => new Set([...prev, cur.encodedPath]))
  }, [projects, cwd])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])


  const openDialog = useCallback(() => {
    setDialogDir(cwd)
    setShowDialog(true)
    setTimeout(() => dirInputRef.current?.select(), 50)
  }, [cwd])

  const closeDialog = useCallback(() => setShowDialog(false), [])

  const handlePickFolder = useCallback(async () => {
    const selected = await window.electron.selectFolder()
    if (selected) setDialogDir(selected)
  }, [])

  const handleConfirm = useCallback(() => {
    const dir = dialogDir.trim()
    if (!dir) return
    addTab(dir)
    setActivePage('chat')
    closeDialog()
  }, [dialogDir, addTab, setActivePage, closeDialog])

  const handleDialogKey = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleConfirm()
    if (e.key === 'Escape') closeDialog()
  }, [handleConfirm, closeDialog])

  const handleDeleteSession = useCallback(
    async (encodedPath: string, sessionId: string): Promise<void> => {
      await deleteSession(encodedPath, sessionId)
      setConfirmDelete(null)
    },
    [deleteSession]
  )

  const handleDeleteProject = useCallback(
    async (encodedPath: string): Promise<void> => {
      await deleteProject(encodedPath)
      setConfirmDelete(null)
    },
    [deleteProject]
  )

  const handleSelectSession = useCallback(
    async (project: ProjectHistory, session: SessionSummary): Promise<void> => {
      const existingTab = tabs.find((t) => t.sessionId === session.sessionId)
      if (existingTab) {
        useTabStore.getState().setActiveTab(existingTab.tabId)
        setActivePage('chat')
        return
      }
      await loadAndResumeSession(project.encodedPath, session.sessionId, project.cwd)
      setActivePage('chat')
    },
    [tabs, loadAndResumeSession, setActivePage]
  )

  // ── Sorted + filtered projects ─────────────────────────────────
  const sortedProjects = useMemo(
    () =>
      [...projects].sort((a, b) => {
        const aC = a.cwd === cwd ? 1 : 0
        const bC = b.cwd === cwd ? 1 : 0
        if (aC !== bC) return bC - aC
        return b.lastUsed - a.lastUsed
      }),
    [projects, cwd]
  )

  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return sortedProjects
    const q = searchQuery.toLowerCase()
    return sortedProjects
      .map((p) => ({
        ...p,
        sessions: p.sessions.filter((s) => {
          const title = buildSessionTitle(s).toLowerCase()
          return (
            title.includes(q) ||
            p.projectName.toLowerCase().includes(q) ||
            (s.firstUserText?.toLowerCase().includes(q) ?? false) ||
            (s.lastUserText?.toLowerCase().includes(q) ?? false)
          )
        }),
      }))
      .filter((p) => p.sessions.length > 0 || p.projectName.toLowerCase().includes(q))
  }, [sortedProjects, searchQuery])

  // ── Pin + order logic ──────────────────────────────────────────
  const pinnedSet = useMemo(() => new Set(pinnedProjects), [pinnedProjects])

  const orderedPinnedProjects = useMemo(
    () =>
      pinnedProjects
        .filter((id) => filteredProjects.some((p) => p.encodedPath === id))
        .map((id) => filteredProjects.find((p) => p.encodedPath === id)!)
        .filter(Boolean),
    [pinnedProjects, filteredProjects]
  )

  const orderedUnpinnedProjects = useMemo(() => {
    const unpinned = filteredProjects.filter((p) => !pinnedSet.has(p.encodedPath))
    return [
      ...projectOrder
        .filter((id) => unpinned.some((p) => p.encodedPath === id))
        .map((id) => unpinned.find((p) => p.encodedPath === id)!),
      ...unpinned.filter((p) => !projectOrder.includes(p.encodedPath)),
    ].filter(Boolean) as ProjectHistory[]
  }, [filteredProjects, pinnedSet, projectOrder])

  // ── Drag helpers ───────────────────────────────────────────────
  function handleDrop(targetId: string, targetSection: 'pinned' | 'unpinned', pos: 'before' | 'after') {
    const src = dragState.current
    if (!src || src.id === targetId) return
    const unpinnedIds = orderedUnpinnedProjects.map((p) => p.encodedPath)

    if (src.section === 'pinned' && targetSection === 'pinned') {
      setPinnedOrder(reorderArray(pinnedProjects, src.id, targetId, pos))
    } else if (src.section === 'unpinned' && targetSection === 'unpinned') {
      setProjectOrder(reorderArray(unpinnedIds, src.id, targetId, pos))
    } else if (src.section === 'unpinned' && targetSection === 'pinned') {
      setPinnedOrder(reorderArray([...pinnedProjects, src.id], src.id, targetId, pos))
      setProjectOrder(projectOrder.filter((id) => id !== src.id))
    } else {
      setPinnedOrder(pinnedProjects.filter((id) => id !== src.id))
      setProjectOrder(reorderArray([...unpinnedIds, src.id], src.id, targetId, pos))
    }
  }

  // ── Project row renderer ───────────────────────────────────────
  function renderProject(project: ProjectHistory, section: 'pinned' | 'unpinned') {
    const isCurrent = project.cwd === cwd
    const isPinned = pinnedSet.has(project.encodedPath)
    const isOpen = searchQuery ? true : expanded.has(project.encodedPath)
    const isDragTarget = dragOverId === project.encodedPath
    const sortedSessions = [...project.sessions].sort((a, b) => b.lastUsed - a.lastUsed)
    const hasActiveSession = sortedSessions.some((s) =>
      tabs.some((t) => {
        if (t.sessionId !== s.sessionId) return false
        const display = getDisplayStatus(t)
        return display === 'running' || display === 'exec'
      })
    )

    return (
      <div
        key={project.encodedPath}
        draggable={!searchQuery}
        onDragStart={(e) => {
          dragState.current = { id: project.encodedPath, section }
          setDraggingId(project.encodedPath)
          e.dataTransfer.effectAllowed = 'move'
          const ghost = document.createElement('div')
          ghost.style.cssText = 'position:fixed;top:-1000px;left:-1000px'
          document.body.appendChild(ghost)
          e.dataTransfer.setDragImage(ghost, 0, 0)
          requestAnimationFrame(() => document.body.removeChild(ghost))
        }}
        onDragEnd={() => {
          setDraggingId(null)
          setDragOverId(null)
          dragState.current = null
        }}
        onDragOver={(e) => {
          e.preventDefault()
          e.dataTransfer.dropEffect = 'move'
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
          setDragOverId(project.encodedPath)
          setDragOverPos(e.clientY < rect.top + rect.height / 2 ? 'before' : 'after')
        }}
        onDragLeave={(e) => {
          if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
            setDragOverId(null)
          }
        }}
        onDrop={(e) => {
          e.preventDefault()
          const pos = dragOverPos
          handleDrop(project.encodedPath, section, pos)
          setDragOverId(null)
          setDraggingId(null)
          dragState.current = null
        }}
        className={cn(
          'transition-opacity duration-150 border-t-2 border-b-2',
          draggingId === project.encodedPath ? 'opacity-40' : 'opacity-100',
          isDragTarget && dragOverPos === 'before' ? 'border-t-[var(--color-accent)]' : 'border-t-transparent',
          isDragTarget && dragOverPos === 'after' ? 'border-b-[var(--color-accent)]' : 'border-b-transparent',
        )}
      >
        <details
          className="sbl-project"
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
          <summary className={`sbl-project-summary${isCurrent ? ' current' : ''}`}>
            {!searchQuery && (
              <span
                className="sbl-drag-handle"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <GripVertical size={10} />
              </span>
            )}
            <span className="sbl-chevron"><ChevronRight size={10} /></span>
            <span className="flex min-w-0 flex-1 items-baseline gap-1 overflow-hidden">
              <span className="sbl-project-name" title={project.cwd}>
                {project.projectName}
              </span>
              {getParentDir(project.cwd) && (
                <span className="min-w-0 flex-shrink overflow-hidden text-ellipsis whitespace-nowrap text-[10px] text-[var(--color-text-faint)]">
                  {getParentDir(project.cwd)}
                </span>
              )}
            </span>
            {hasActiveSession && <span className="sbl-running-dot" />}
            <span className="sbl-project-count">{project.sessions.length}</span>
            <button
              className={`sbl-project-pin${isPinned ? ' pinned' : ''}`}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                togglePin(project.encodedPath)
              }}
              title={isPinned ? 'Unpin project' : 'Pin project'}
            >
              <Pin size={10} />
            </button>
            <button
              className="sbl-project-del"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setConfirmDelete({ type: 'project', encodedPath: project.encodedPath })
              }}
              title="删除项目历史"
            >
              <X size={10} />
            </button>
          </summary>

          <div>
            {sortedSessions.map((session) => {
              const isActive = session.sessionId === activeSessionId
              const matchingTab = tabs.find((t) => t.sessionId === session.sessionId)
              const displayStatus = matchingTab ? getDisplayStatus(matchingTab) : null
              const isHovered = hoveredSessionId === session.sessionId
              const title = buildSessionTitle(session)
              return (
                <div
                  key={session.sessionId}
                  className={`sbl-session${isActive ? ' active' : ''}`}
                  onClick={() => void handleSelectSession(project, session)}
                  onMouseEnter={() => setHoveredSessionId(session.sessionId)}
                  onMouseLeave={() => setHoveredSessionId(null)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') void handleSelectSession(project, session)
                  }}
                  title={title}
                >
                  {displayStatus === 'running' && <span className="sbl-running-dot" />}
                  {displayStatus === 'exec' && (
                    <span className="h-[5px] w-[5px] flex-shrink-0 rounded-full bg-[var(--color-warning)]" />
                  )}
                  {displayStatus === 'error' && (
                    <span className="h-[5px] w-[5px] flex-shrink-0 rounded-full bg-[var(--color-danger)]" />
                  )}
                  <span className="sbl-session-info">
                    <span className="sbl-session-title">{title}</span>
                    <span className="sbl-session-time">{formatRelTime(session.lastUsed)}</span>
                  </span>
                  <button
                    className={cn(
                      'sbl-session-del transition-opacity duration-100',
                      isHovered ? 'opacity-100' : 'opacity-0 pointer-events-none'
                    )}
                    onClick={(e) => {
                      e.stopPropagation()
                      setConfirmDelete({
                        type: 'session',
                        encodedPath: project.encodedPath,
                        sessionId: session.sessionId,
                      })
                    }}
                    title="删除会话"
                  >
                    <X size={10} />
                  </button>
                </div>
              )
            })}
          </div>
        </details>
      </div>
    )
  }

  const isSearching = searchQuery.trim().length > 0

  return (
    <>
      <nav
        className={cn(
          'relative flex flex-shrink-0 flex-col overflow-hidden bg-[var(--color-surface)]',
          !collapsed && 'border-r border-[var(--color-border)]'
        )}
        style={{
          width: collapsed ? 112 : sidebarWidth,
          WebkitAppRegion: 'no-drag',
          transition: isResizing ? 'none' : 'width 0.15s ease',
        } as React.CSSProperties}
      >
        {/* Zone 1: Brand + quick nav icons — always visible */}
        <div
          className={cn(
            'flex h-[38px] flex-shrink-0 items-center gap-[2px] pr-2',
            !collapsed && 'border-b border-[var(--color-border)]'
          )}
          style={{ WebkitAppRegion: 'drag', paddingLeft: 72 } as React.CSSProperties}
        >
          {collapsed ? (
            <button
              onClick={() => setSidebarCollapsed(false)}
              title="Expand sidebar"
              className="flex h-[26px] w-[26px] items-center justify-center rounded-[var(--radius-sm)] bg-transparent text-[var(--color-text-muted)]"
              style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            >
              <PanelLeftOpen size={13} />
            </button>
          ) : (
            <div className="flex w-full items-center gap-[2px]">
              {activePage === 'settings' ? (
                <>
                  <button
                    onClick={() => setActivePage('chat')}
                    title="返回聊天"
                    className="flex h-[26px] w-[26px] items-center justify-center rounded-[var(--radius-sm)] bg-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                    style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span
                    className="flex-1 text-left text-[14px] font-bold leading-none tracking-[-0.01em] text-[var(--color-text)]"
                    style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                  >
                    设置
                  </span>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setActivePage('chat')}
                    className="flex-1 text-left text-[14px] font-bold leading-none tracking-[-0.01em] text-[var(--color-text)]"
                    style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                  >
                    HappyCode
                  </button>
                  <button
                    onClick={() => setSidebarCollapsed(true)}
                    title="Collapse sidebar"
                    className="flex h-[26px] w-[26px] items-center justify-center rounded-[var(--radius-sm)] bg-transparent text-[var(--color-text-muted)]"
                    style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                  >
                    <PanelLeftClose size={13} />
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {!collapsed && (
        <>
        <div className="flex flex-1 flex-col overflow-hidden px-2 pt-2">
          {activePage === 'settings' ? (
            <>
              <div className="flex-1 overflow-y-auto py-1">
                {SETTINGS_TABS.map((tab) => <SettingsTabButton key={tab.id} {...tab} />)}
                <div className="mt-3 border-t border-[var(--color-border)] pt-2">
                  {SETTINGS_BOTTOM_TABS.map((tab) => <SettingsTabButton key={tab.id} {...tab} />)}
                </div>
              </div>
            </>
          ) : (
            <>
              <button className="sbl-new-chat-btn" onClick={openDialog}>
                <Plus size={13} />
                新对话
              </button>

              <div className="sbl-search">
                <input
                  ref={searchInputRef}
                  className="sbl-search-input"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="搜索会话…  ⌘K"
                />
                {searchQuery && (
                  <button className="sbl-search-clear" onClick={() => setSearchQuery('')} aria-label="Clear">
                    <X size={11} />
                  </button>
                )}
              </div>

              <div className="sbl-sessions">
            {/* Recent sessions - collapsible, default expanded */}
            {!isSearching && (
              <div className="mb-1">
                <button
                  onClick={() => setRecentExpanded((v) => !v)}
                  className="mb-[2px] flex w-full items-center gap-1 py-[2px]"
                >
                  <span
                    className={cn('text-[var(--color-text-muted)] transition-all duration-200', recentExpanded ? 'rotate-90' : 'rotate-0')}
                  ><ChevronRight size={9} /></span>
                  <span className="text-[9px] font-bold uppercase tracking-[0.08em] text-[var(--color-text-faint)]">Recent</span>
                </button>
                {recentExpanded && (() => {
                  const allSessions = projects
                    .flatMap((p) =>
                      p.sessions.map((s) => ({
                        session: s,
                        project: p,
                      }))
                    )
                    .sort((a, b) => b.session.lastUsed - a.session.lastUsed)
                    .slice(0, 5)

                  if (allSessions.length === 0) return null

                  return allSessions.map(({ session, project }) => {
                    const matchingTab = tabs.find((t) => t.sessionId === session.sessionId)
                    const displayStatus = matchingTab ? getDisplayStatus(matchingTab) : null
                    const title = buildSessionTitle(session)

                    const renderIndicator = () => {
                      if (displayStatus === 'running') {
                        return <span className="sbl-running-dot" />
                      }
                      if (displayStatus === 'exec') {
                        return <span className="h-[5px] w-[5px] flex-shrink-0 rounded-full bg-[var(--color-warning)]" />
                      }
                      if (displayStatus === 'error') {
                        return <span className="h-[5px] w-[5px] flex-shrink-0 rounded-full bg-[var(--color-danger)]" />
                      }
                      if (displayStatus === 'done' && matchingTab?.showDoneIndicator) {
                        return <span className="h-[5px] w-[5px] flex-shrink-0 rounded-full bg-[var(--color-success)]" />
                      }
                      return null
                    }

                    return (
                      <button
                        key={session.sessionId}
                        onClick={() => {
                          if (matchingTab) {
                            useTabStore.getState().setActiveTab(matchingTab.tabId)
                            if (displayStatus === 'done' || displayStatus === 'error') {
                              clearDoneIndicator(matchingTab.tabId)
                            }
                          } else {
                            void handleSelectSession(project, session)
                          }
                          setActivePage('chat')
                        }}
                        className="sbl-recent-item"
                        style={session.sessionId === activeSessionId ? { background: 'var(--color-accent-dim)' } : undefined}
                      >
                        {renderIndicator()}
                        <span className="min-w-0 flex-1">
                          <span
                            className="sbl-recent-project"
                            style={session.sessionId === activeSessionId ? { color: 'var(--color-accent)' } : undefined}
                          >
                            {project.projectName}
                          </span>
                          <span className="sbl-recent-title">
                            {title}
                          </span>
                        </span>
                        {displayStatus === 'done' && matchingTab?.showDoneIndicator && (
                          <Check size={10} className="flex-shrink-0 text-[var(--color-success)]" />
                        )}
                        {displayStatus === 'exec' && (
                          <span className="flex-shrink-0 text-[10px] font-semibold text-[var(--color-warning)]">!</span>
                        )}
                        {displayStatus === 'error' && (
                          <AlertCircle size={10} className="flex-shrink-0 text-[var(--color-danger)]" />
                        )}
                      </button>
                    )
                  })
                })()}
              </div>
            )}

            {isSearching ? (
              filteredProjects.map((p) =>
                renderProject(p, pinnedSet.has(p.encodedPath) ? 'pinned' : 'unpinned')
              )
            ) : (
              <>
                {orderedPinnedProjects.length > 0 && (
                  <div className="sbl-section-label">Pinned</div>
                )}
                {orderedPinnedProjects.map((p) => renderProject(p, 'pinned'))}

                {orderedPinnedProjects.length > 0 && orderedUnpinnedProjects.length > 0 && (
                  <div className="sbl-section-divider" />
                )}

                {orderedUnpinnedProjects.length > 0 && (
                  <div className="sbl-section-label">Projects</div>
                )}
                {orderedUnpinnedProjects.map((p) => renderProject(p, 'unpinned'))}
              </>
            )}
          </div>
            </>
          )}
        </div>

        {/* Resize handle */}
        <div
          className={`sbl-resize-handle${isResizing ? ' resizing' : ''}`}
          onMouseDown={handleResizeStart}
        />

        {/* Zone 3: Settings + Theme toggle */}
        <div className="flex-shrink-0 border-t border-[var(--color-border)]">
          <div className="flex items-center gap-1 px-[10px] py-2">
            <button
              onClick={() => setActivePage('settings')}
              title="Settings"
              className={cn(
                'flex items-center gap-[6px] rounded-[var(--radius-sm)] px-2 py-[5px] text-[11px]',
                activePage === 'settings'
                  ? 'bg-[var(--color-surface-2)] text-[var(--color-text)]'
                  : 'bg-transparent text-[var(--color-text-muted)]'
              )}
            >
              <Settings size={13} />
              Settings
            </button>
            <div className="flex-1" />
            <button
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              className="flex h-[26px] w-[26px] items-center justify-center rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-transparent text-[var(--color-text-muted)]"
            >
              {theme === 'dark' ? <Sun size={12} /> : <Moon size={12} />}
            </button>
          </div>
        </div>
        </>
        )}
      </nav>

      {/* Confirm Delete Dialog */}
      {confirmDelete && createPortal(
        <div className="ncd-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="ncd-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="ncd-header">
              <span className="ncd-title">
                {confirmDelete.type === 'project' ? '删除项目历史？' : '删除会话？'}
              </span>
              <button className="ncd-close" onClick={() => setConfirmDelete(null)}><X size={13} /></button>
            </div>
            <div className="ncd-body text-[12px] leading-[1.5] text-[var(--color-text-muted)]">
              {confirmDelete.type === 'project'
                ? '该项目的所有会话将被永久删除。'
                : '该会话将被永久删除。'}
            </div>
            <div className="ncd-footer">
              <button className="ncd-cancel" onClick={() => setConfirmDelete(null)}>取消</button>
              <button
                className="ncd-confirm danger"
                onClick={() => {
                  if (confirmDelete.type === 'session' && confirmDelete.sessionId) {
                    void handleDeleteSession(confirmDelete.encodedPath, confirmDelete.sessionId)
                  } else {
                    void handleDeleteProject(confirmDelete.encodedPath)
                  }
                }}
              >
                删除
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* New Chat Dialog */}
      {showDialog && createPortal(
        <div className="ncd-overlay" onClick={closeDialog}>
          <div className="ncd-dialog" onClick={(e) => e.stopPropagation()} onKeyDown={handleDialogKey}>
            <div className="ncd-header">
              <span className="ncd-title">新建对话</span>
              <button className="ncd-close" onClick={closeDialog}><X size={13} /></button>
            </div>
            <div className="ncd-body">
              <label className="ncd-label">项目目录</label>
              <div className="ncd-dir-row">
                <input
                  ref={dirInputRef}
                  className="ncd-dir-input"
                  value={dialogDir}
                  onChange={(e) => setDialogDir(e.target.value)}
                  placeholder="/path/to/project"
                  spellCheck={false}
                />
                <button className="ncd-pick-btn" onClick={handlePickFolder} title="选择目录">
                  <Folder size={14} />
                </button>
              </div>
            </div>
            <div className="ncd-footer">
              <button className="ncd-cancel" onClick={closeDialog}>取消</button>
              <button className="ncd-confirm" onClick={handleConfirm} disabled={!dialogDir.trim()}>
                创建
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
