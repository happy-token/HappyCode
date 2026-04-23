import React, { useEffect } from 'react'
import { NavRail } from './components/nav/NavRail'
import { PanelZone } from './components/nav/PanelZone'
import { CwdPicker } from './components/nav/CwdPicker'
import { ChatPanel } from './components/chat/ChatPanel'
import { HooksPanel } from './components/hooks/HooksPanel'
import { SkillsPanel } from './components/skills/SkillsPanel'
import { SettingsPage } from './components/settings/SettingsPage'
import { useUiStore } from './store/ui-store'
import { useChatStore } from './store/session-store'
import { useApiConfigStore } from './store/api-config-store'

export function AppShell(): React.JSX.Element {
  const activePage = useUiStore((s) => s.activePage)
  const cwd = useUiStore((s) => s.cwd)
  const setCwd = useUiStore((s) => s.setCwd)
  const setActivePage = useUiStore((s) => s.setActivePage)

  const chatStatus = useChatStore((s) => s.status)
  const startChatSession = useChatStore((s) => s.startSession)

  const loadApiConfig = useApiConfigStore((s) => s.load)
  useEffect(() => { void loadApiConfig() }, [loadApiConfig])

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <NavRail />

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
              color: 'var(--color-accent)',
              WebkitAppRegion: 'no-drag',
            } as React.CSSProperties}
          >
            HappyCode
          </span>

          <div style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
            <CwdPicker cwd={cwd} onChange={setCwd} />
          </div>

          {cwd && chatStatus !== 'running' && (
            <div style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
              <button
                onClick={() => {
                  setActivePage('chat')
                  void startChatSession('/init')
                }}
                title="Initialize project — runs /init to generate CLAUDE.md"
                style={{
                  fontSize: 11,
                  padding: '3px 10px',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--color-text-muted)',
                  cursor: 'pointer',
                }}
              >
                Init
              </button>
            </div>
          )}

          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>v0.1</span>
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
          <div
            style={{
              display: activePage === 'sessions' ? 'flex' : 'none',
              flex: 1,
              overflow: 'hidden',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Sessions — coming soon</span>
          </div>
          <div
            style={{
              display: activePage === 'mcp' ? 'flex' : 'none',
              flex: 1,
              overflow: 'hidden',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>MCP — coming soon</span>
          </div>
        </div>
      </div>

      <PanelZone />
    </div>
  )
}
