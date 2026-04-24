import React, { useEffect, useState } from 'react'
import { Sun, Moon } from 'lucide-react'
import { Sidebar } from './components/nav/Sidebar'
import { PanelZone } from './components/nav/PanelZone'
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
  const theme = useUiStore((s) => s.theme)
  const toggleTheme = useUiStore((s) => s.toggleTheme)

  const cwd = useTabStore((s) => selectActiveTab(s)?.cwd ?? '')
  const runningCostUsd = useTabStore((s) =>
    (selectActiveTab(s)?.messages ?? []).reduce(
      (sum, m) => (m.type === 'done' ? sum + m.costUsd : sum),
      0
    )
  )
  const totalTokens = useTabStore((s) =>
    (selectActiveTab(s)?.messages ?? []).reduce(
      (sum, m) =>
        m.type === 'done'
          ? sum + m.inputTokens + m.outputTokens
          : sum,
      0
    )
  )

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
        {/* SessionBar */}
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '0 16px',
            height: 38,
            borderBottom: '1px solid var(--color-border)',
            background: 'var(--color-surface)',
            flexShrink: 0,
            WebkitAppRegion: 'drag',
          } as React.CSSProperties}
        >
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--color-text)',
              WebkitAppRegion: 'no-drag',
            } as React.CSSProperties}
          >
            {cwd.split('/').pop() || 'HappyCode'}
          </span>
          <div style={{ flex: 1 }} />
          {(runningCostUsd > 0 || totalTokens > 0) && (
            <span
              style={{
                fontSize: 10,
                color: 'var(--color-text-faint)',
                fontFamily: 'var(--font-mono)',
                WebkitAppRegion: 'no-drag',
              } as React.CSSProperties}
            >
              {runningCostUsd > 0
                ? `$${runningCostUsd.toFixed(4)}`
                : `${totalTokens.toLocaleString()} tok`}
            </span>
          )}
          <button
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 26,
              height: 26,
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
              background: 'transparent',
              color: 'var(--color-text-muted)',
              cursor: 'pointer',
              WebkitAppRegion: 'no-drag',
            } as React.CSSProperties}
          >
            {theme === 'dark' ? <Sun size={12} /> : <Moon size={12} />}
          </button>
        </header>

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
