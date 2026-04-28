import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { FolderOpen, GitBranch, Files, Search, Plus } from 'lucide-react'
import { Sidebar } from './components/nav/Sidebar'
import { PanelZone } from './components/nav/PanelZone'
import { ChatPanel } from './components/chat/ChatPanel'
import { HooksPanel } from './components/hooks/HooksPanel'
import { SkillsPanel } from './components/skills/SkillsPanel'
import { SettingsLayout } from './components/settings/SettingsLayout'
import { SessionsPage } from './components/sessions/SessionsPage'
import { OnboardingWizard } from './components/onboarding/OnboardingWizard'
import { McpPage } from './components/mcp/McpPage'
import { FileBrowser } from './components/file-browser/FileBrowser'
import { GitPanel } from './components/git/GitPanel'
import { useUiStore } from './store/ui-store'
import { useTabStore, selectActiveTab } from './store/tab-store'
import { useSubagentStore } from './store/subagent-store'
import { useApiConfigStore } from './store/api-config-store'
import { useHistoryStore, buildSessionTitle } from './store/history-store'
import { cn } from './lib/utils'

function ResizablePanel({ storageKey, children }: { storageKey: string; children: React.ReactNode }): React.JSX.Element {
  const [width, setWidth] = useState(() => {
    const saved = localStorage.getItem(storageKey)
    return saved ? Math.max(200, Math.min(600, parseInt(saved, 10))) : 320
  })
  const [isResizing, setIsResizing] = useState(false)

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startW = width
    setIsResizing(true)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    const onMove = (ev: MouseEvent) => {
      const w = Math.max(200, Math.min(600, startW - (ev.clientX - startX)))
      setWidth(w)
      localStorage.setItem(storageKey, String(w))
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
  }, [width, storageKey])

  return (
    <div
      className="relative flex flex-shrink-0 flex-col overflow-hidden border-l border-[var(--color-border)] bg-[var(--color-surface)]"
      style={{ width }}
    >
      <div
        className={cn(
          'absolute bottom-0 left-[-2px] top-0 z-10 w-1 cursor-col-resize transition-[background] duration-150 hover:bg-[var(--color-accent)] hover:opacity-50',
          isResizing && 'bg-[var(--color-accent)] opacity-50'
        )}
        onMouseDown={handleResizeStart}
      />
      {children}
    </div>
  )
}

export function AppShell(): React.JSX.Element {
  const activePage = useUiStore((s) => s.activePage)
  const showGit = useUiStore((s) => s.showGit)
  const showFiles = useUiStore((s) => s.showFiles)
  const showSearch = useUiStore((s) => s.showSearch)
  const toggleGit = useUiStore((s) => s.toggleGit)
  const toggleFiles = useUiStore((s) => s.toggleFiles)
  const setShowSearch = useUiStore((s) => s.setShowSearch)

  const cwd = useTabStore((s) => selectActiveTab(s)?.cwd ?? '')
  const sessionId = useTabStore((s) => selectActiveTab(s)?.sessionId ?? null)
  const sessionStatus = useTabStore((s) => selectActiveTab(s)?.status ?? 'idle')
  const messagesCount = useTabStore((s) => (selectActiveTab(s)?.messages ?? []).length)
  const resetSession = useTabStore((s) => s.resetSession)
  const projectName = useMemo(() => cwd.split('/').filter(Boolean).pop() ?? '', [cwd])
  const { projects } = useHistoryStore()
  const sessionTitle = useMemo(() => {
    if (!sessionId) return sessionStatus === 'running' ? 'Running…' : 'New session'
    for (const p of projects) {
      if (p.cwd !== cwd) continue
      const s = p.sessions.find((s) => s.sessionId === sessionId)
      if (s) return buildSessionTitle(s)
    }
    return sessionStatus === 'running' ? 'Running…' : 'New session'
  }, [sessionId, sessionStatus, projects, cwd])

  const handleAgentEvent = useTabStore((s) => s.handleAgentEvent)
  const handleAgentDone = useTabStore((s) => s.handleAgentDone)
  const handleAgentError = useTabStore((s) => s.handleAgentError)
  const handlePermissionRequest = useTabStore((s) => s.handlePermissionRequest)
  const applySubagentEvent = useSubagentStore((s) => s.applyEvent)

  const loadApiConfig = useApiConfigStore((s) => s.load)
  useEffect(() => { void loadApiConfig() }, [loadApiConfig])

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

  const [showOnboarding, setShowOnboarding] = useState(
    () => !localStorage.getItem('happycode:onboarding_done')
  )

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />

      <div className="flex flex-1 flex-col overflow-hidden bg-[var(--color-surface)]">
        {/* Content header */}
        <div
          className="relative z-[100] flex h-[38px] flex-shrink-0 items-center overflow-visible border-b border-[var(--color-border)] px-4"
          style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        >
          {activePage === 'chat' ? (
            <>
              {cwd ? (
                <div
                  className="flex min-w-0 flex-1 items-center gap-[6px] overflow-hidden"
                  style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                >
                  <FolderOpen size={13} className="flex-shrink-0 text-[var(--color-text-faint)]" />
                  <span className="flex-shrink-0 text-[13px] font-semibold text-[var(--color-text)]">
                    {projectName}
                  </span>
                  <span className="mx-[1px] flex-shrink-0 text-[13px] text-[var(--color-text-faint)]">/</span>
                  <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[13px] text-[var(--color-text-muted)]">
                    {sessionTitle}
                  </span>
                </div>
              ) : (
                <span
                  className="flex-1 text-[13px] font-semibold text-[var(--color-text-muted)]"
                  style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                >
                  HappyCode
                </span>
              )}

              {/* Right-side icon buttons */}
              <div
                className="ml-auto flex flex-shrink-0 items-center gap-[3px]"
                style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
              >
                {(sessionStatus === 'done' || sessionStatus === 'error') && (
                  <button
                    onClick={resetSession}
                    title="New chat"
                    style={{ height: 26, width: 26 }}
                    className="flex cursor-pointer items-center justify-center rounded-[var(--radius-sm)] border-0 bg-transparent text-[var(--color-text-muted)] transition-[background,color] duration-100 hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]"
                  >
                    <Plus size={13} />
                  </button>
                )}
                {messagesCount > 0 && (
                  <button
                    onClick={() => setShowSearch(!showSearch)}
                    title="Search"
                    style={{ height: 26, width: 26 }}
                    className={cn(
                      'flex cursor-pointer items-center justify-center rounded-[var(--radius-sm)] border-0 transition-[background,color] duration-100',
                      showSearch
                        ? 'bg-[var(--color-accent-dim)] text-[var(--color-accent)]'
                        : 'bg-transparent text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]'
                    )}
                  >
                    <Search size={13} />
                  </button>
                )}
                <button
                  onClick={toggleGit}
                  title="Git"
                  style={{ height: 26, width: 26 }}
                  className={cn(
                    'flex cursor-pointer items-center justify-center rounded-[var(--radius-sm)] border-0 transition-[background,color] duration-100',
                    showGit
                      ? 'bg-[var(--color-accent-dim)] text-[var(--color-accent)]'
                      : 'bg-transparent text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]'
                  )}
                >
                  <GitBranch size={13} />
                </button>
                <button
                  onClick={toggleFiles}
                  title="Files"
                  style={{ height: 26, width: 26 }}
                  className={cn(
                    'flex cursor-pointer items-center justify-center rounded-[var(--radius-sm)] border-0 transition-[background,color] duration-100',
                    showFiles
                      ? 'bg-[var(--color-accent-dim)] text-[var(--color-accent)]'
                      : 'bg-transparent text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]'
                  )}
                >
                  <Files size={13} />
                </button>
              </div>
            </>
          ) : (
            <span
              className="flex-1 text-[13px] font-semibold text-[var(--color-text-muted)]"
              style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            >
              {activePage === 'settings' ? '设置' :
               activePage === 'sessions' ? '历史会话' :
               activePage === 'mcp' ? 'MCP 服务器' :
               activePage === 'hooks' ? 'Hooks' :
               activePage === 'skills' ? '技能' :
               'HappyCode'}
            </span>
          )}
        </div>

        {/* All pages mounted; inactive hidden via display:none to preserve scroll + drafts */}
        <div className="flex flex-1 overflow-hidden">
          <div className={cn('flex-1 overflow-hidden', activePage === 'chat' ? 'flex' : 'hidden')}>
            <ChatPanel />
          </div>
          <div className={cn('flex-1 overflow-hidden', activePage === 'hooks' ? 'flex' : 'hidden')}>
            <HooksPanel />
          </div>
          <div className={cn('flex-1 overflow-hidden', activePage === 'skills' ? 'flex' : 'hidden')}>
            <SkillsPanel />
          </div>
          <div className={cn('flex-1 overflow-hidden', activePage === 'settings' ? 'flex' : 'hidden')}>
            <SettingsLayout />
          </div>
          <div className={cn('flex-1 overflow-hidden', activePage === 'sessions' ? 'flex' : 'hidden')}>
            <SessionsPage />
          </div>
          <div className={cn('flex-1 overflow-hidden', activePage === 'mcp' ? 'flex' : 'hidden')}>
            <McpPage />
          </div>
        </div>
      </div>

      <PanelZone />

      {showGit && (
        <ResizablePanel storageKey="happycode:gitPanelWidth">
          <GitPanel />
        </ResizablePanel>
      )}

      {showFiles && (
        <ResizablePanel storageKey="happycode:filesPanelWidth">
          <FileBrowser />
        </ResizablePanel>
      )}

      {showOnboarding && (
        <OnboardingWizard onDone={() => setShowOnboarding(false)} />
      )}
    </div>
  )
}
