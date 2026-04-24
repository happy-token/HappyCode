import React, { useEffect, useState, useCallback } from 'react'
import { MessageSquare, History, Plug, Zap, Webhook, Settings, Plus } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useUiStore, type ActivePage } from '../../store/ui-store'
import { useTabStore, selectActiveTab } from '../../store/tab-store'
import { CwdPicker } from './CwdPicker'
import type { SessionInfo } from '../../../electron/shared/types'

const MAX_RECENT_SESSIONS = 15

interface NavItem {
  page: ActivePage
  Icon: React.ComponentType<{ size?: number }>
  label: string
}

const NAV_ITEMS: NavItem[] = [
  { page: 'chat',     Icon: MessageSquare, label: 'Chat' },
  { page: 'sessions', Icon: History,       label: 'Sessions' },
  { page: 'mcp',      Icon: Plug,          label: 'MCP' },
  { page: 'skills',   Icon: Zap,           label: 'Skills' },
  { page: 'hooks',    Icon: Webhook,       label: 'Hooks' },
]

function formatRelativeTime(ts: number): string {
  const diffMs = Date.now() - ts
  const m = Math.floor(diffMs / 60_000)
  if (m < 1) return '刚刚'
  if (m < 60) return `${m}分钟前`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}小时前`
  return `${Math.floor(h / 24)}天前`
}

export function Sidebar(): React.JSX.Element {
  const activePage = useUiStore((s) => s.activePage)
  const setActivePage = useUiStore((s) => s.setActivePage)

  const cwd = useTabStore((s) => selectActiveTab(s)?.cwd ?? '')
  const setCwd = useTabStore((s) => s.setCwd)
  const activeSessionId = useTabStore((s) => selectActiveTab(s)?.sessionId ?? null)
  const addTab = useTabStore((s) => s.addTab)
  const setSessionForResume = useTabStore((s) => s.setSessionForResume)
  const tabStatuses = useTabStore(
    useShallow((s) => s.tabs.map((t) => ({ sessionId: t.sessionId, status: t.status })))
  )

  const [sessions, setSessions] = useState<SessionInfo[]>([])

  const loadSessions = useCallback(async () => {
    if (!cwd) {
      setSessions([])
      return
    }
    try {
      const result = await window.electron.listSessions(cwd)
      setSessions(result.sessions.slice(0, MAX_RECENT_SESSIONS))
    } catch (err) {
      console.error('[Sidebar] Failed to load sessions:', err)
      setSessions([])
    }
  }, [cwd])

  useEffect(() => { void loadSessions() }, [loadSessions])

  const handleSessionClick = useCallback((session: SessionInfo): void => {
    setActivePage('chat')
    setSessionForResume(session.session_id)
  }, [setActivePage, setSessionForResume])

  const handleNewChat = useCallback((): void => {
    addTab(cwd)
    setActivePage('chat')
  }, [addTab, cwd, setActivePage])

  return (
    <nav
      style={{
        width: 220,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--color-surface)',
        borderRight: '1px solid var(--color-border)',
        WebkitAppRegion: 'no-drag',
        overflow: 'hidden',
      } as React.CSSProperties}
    >
      {/* Zone 1: App header */}
      <div
        style={{
          padding: '14px 14px 10px',
          borderBottom: '1px solid var(--color-border)',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: 'var(--color-text)',
            letterSpacing: '-0.01em',
          }}
        >
          HappyCode
        </span>
      </div>

      {/* Zone 2: Navigation */}
      <div
        style={{
          padding: '6px 8px',
          borderBottom: '1px solid var(--color-border)',
          flexShrink: 0,
        }}
      >
        {NAV_ITEMS.map(({ page, Icon, label }) => {
          const active = activePage === page
          return (
            <button
              key={page}
              onClick={() => setActivePage(page)}
              title={label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                padding: '6px 10px',
                borderRadius: 'var(--radius-md)',
                marginBottom: 2,
                background: active ? 'var(--color-surface-3)' : 'transparent',
                color: active ? 'var(--color-text)' : 'var(--color-text-muted)',
                fontWeight: active ? 600 : 400,
                fontSize: 12,
                textAlign: 'left',
                borderLeft: active ? '2px solid var(--color-accent)' : '2px solid transparent',
                cursor: 'pointer',
                transition: 'background 0.1s, color 0.1s',
              }}
            >
              <Icon size={14} />
              {label}
            </button>
          )
        })}
      </div>

      {/* Zone 3: Project + Recent sessions */}
      <div
        style={{
          flex: 1,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          padding: '8px 8px 0',
        }}
      >
        <div style={{ marginBottom: 10 }}>
          <CwdPicker cwd={cwd} onChange={setCwd} />
        </div>

        {sessions.length > 0 && (
          <>
            <div
              style={{
                fontSize: 10,
                color: 'var(--color-text-faint)',
                letterSpacing: '0.07em',
                textTransform: 'uppercase',
                padding: '0 4px',
                marginBottom: 4,
                flexShrink: 0,
              }}
            >
              Recent
            </div>
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 1,
              }}
            >
              {sessions.map((s) => {
                const isActive = s.session_id === activeSessionId
                const isRunning = tabStatuses.some(
                  (t) => t.sessionId === s.session_id && t.status === 'running'
                )
                const label =
                  s.title ?? (s.cwd.split('/').pop() ?? s.session_id.slice(0, 8))
                return (
                  <button
                    key={s.session_id}
                    onClick={() => handleSessionClick(s)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      padding: '6px 8px',
                      borderRadius: 'var(--radius-md)',
                      background: isActive ? 'var(--color-surface-3)' : 'transparent',
                      color: 'var(--color-text)',
                      fontSize: 11,
                      textAlign: 'left',
                      width: '100%',
                      gap: 2,
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, width: '100%' }}>
                      {isRunning && (
                        <span
                          style={{
                            width: 5,
                            height: 5,
                            borderRadius: '50%',
                            background: 'var(--color-success)',
                            flexShrink: 0,
                            animation: 'blink 1.2s ease-in-out infinite',
                          }}
                        />
                      )}
                      <span
                        style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          flex: 1,
                          fontWeight: isActive ? 500 : 400,
                        }}
                      >
                        {label}
                      </span>
                    </div>
                    <span style={{ fontSize: 10, color: 'var(--color-text-faint)' }}>
                      {formatRelativeTime(s.last_used)}
                    </span>
                  </button>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* Zone 4: Bottom bar */}
      <div
        style={{
          borderTop: '1px solid var(--color-border)',
          padding: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          flexShrink: 0,
        }}
      >
        <button
          onClick={handleNewChat}
          style={{
            flex: 1,
            padding: '6px 10px',
            background: 'var(--color-surface-2)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-text-muted)',
            fontSize: 12,
            textAlign: 'left',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Plus size={12} />
          新对话
        </button>
        <button
          onClick={() => setActivePage('settings')}
          title="Settings"
          style={{
            width: 30,
            height: 30,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--color-surface-2)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-text-muted)',
            cursor: 'pointer',
          }}
        >
          <Settings size={14} />
        </button>
      </div>
    </nav>
  )
}
