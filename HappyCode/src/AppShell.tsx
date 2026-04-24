import React, { useEffect, useState } from 'react'
import { Sun, Moon } from 'lucide-react'
import { Sidebar } from './components/nav/Sidebar'
import { PanelZone } from './components/nav/PanelZone'
import { TabBar } from './components/nav/TabBar'
import { ChatPanel } from './components/chat/ChatPanel'
import { HooksPanel } from './components/hooks/HooksPanel'
import { SkillsPanel } from './components/skills/SkillsPanel'
import { SettingsPage } from './components/settings/SettingsPage'
import { SessionsPage } from './components/sessions/SessionsPage'
import { OnboardingWizard } from './components/onboarding/OnboardingWizard'
import { McpPage } from './components/mcp/McpPage'
import { useUiStore } from './store/ui-store'
import { useTabStore, selectActiveTab } from './store/tab-store'
import { useSubagentStore } from './store/subagent-store'
import { useApiConfigStore } from './store/api-config-store'

export function AppShell(): React.JSX.Element {
  const activePage = useUiStore((s) => s.activePage)
  const setActivePage = useUiStore((s) => s.setActivePage)
  const theme = useUiStore((s) => s.theme)
  const toggleTheme = useUiStore((s) => s.toggleTheme)

  const cwd = useTabStore((s) => selectActiveTab(s)?.cwd ?? '')
  const setCwd = useTabStore((s) => s.setCwd)
  const chatStatus = useTabStore((s) => selectActiveTab(s)?.status ?? 'idle')
  const startChatSession = useTabStore((s) => s.startSession)

  const handleAgentEvent = useTabStore((s) => s.handleAgentEvent)
  const handleAgentDone = useTabStore((s) => s.handleAgentDone)
  const handleAgentError = useTabStore((s) => s.handleAgentError)
  const handlePermissionRequest = useTabStore((s) => s.handlePermissionRequest)
  const applySubagentEvent = useSubagentStore((s) => s.applyEvent)

  const loadApiConfig = useApiConfigStore((s) => s.load)
  useEffect(() => { void loadApiConfig() }, [loadApiConfig])

  // Global IPC listeners — route events to the correct tab by sessionId
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
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar />

      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        {/* TopBar */}
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '0 16px',
            height: 44,
            borderBottom: '1px solid var(--color-border)',
            background: 'var(--color-surface)',
            flexShrink: 0,
            WebkitAppRegion: 'drag',
          } as React.CSSProperties}
        >
          <span
            style={{
              fontWeight: 700,
              fontSize: 14,
              letterSpacing: '-0.01em',
              color: 'var(--color-text)',
              WebkitAppRegion: 'no-drag',
            } as React.CSSProperties}
          >
            HappyCode
          </span>
          <div style={{ flex: 1 }} />
          <button
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
              background: 'transparent',
              color: 'var(--color-text-muted)',
              cursor: 'pointer',
              WebkitAppRegion: 'no-drag',
            } as React.CSSProperties}
          >
            {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
          </button>
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>v0.1</span>
        </header>

        {/* Tab bar — only shown on chat page */}
        {activePage === 'chat' && <TabBar />}

        {/* Page content — all pages mounted; inactive hidden via display:none to preserve scroll + drafts */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
          <div style={{ display: activePage === 'chat' ? 'flex' : 'none', flex: 1, overflow: 'hidden' }}>
            <ChatPanel />
          </div>
          <div style={{ display: activePage === 'hooks' ? 'flex' : 'none', flex: 1, overflow: 'hidden' }}>
            <HooksPanel />
          </div>
          <div style={{ display: activePage === 'skills' ? 'flex' : 'none', flex: 1, overflow: 'hidden' }}>
            <SkillsPanel />
          </div>
          <div style={{ display: activePage === 'settings' ? 'flex' : 'none', flex: 1, overflow: 'hidden' }}>
            <SettingsPage />
          </div>
          <div style={{ display: activePage === 'sessions' ? 'flex' : 'none', flex: 1, overflow: 'hidden' }}>
            <SessionsPage />
          </div>
          <div style={{ display: activePage === 'mcp' ? 'flex' : 'none', flex: 1, overflow: 'hidden' }}>
            <McpPage />
          </div>
        </div>
      </div>

      <PanelZone />

      {showOnboarding && (
        <OnboardingWizard onDone={() => setShowOnboarding(false)} />
      )}
    </div>
  )
}
