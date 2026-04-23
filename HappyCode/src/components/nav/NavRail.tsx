import React from 'react'
import { MessageSquare, History, Plug, Zap, Webhook, Settings } from 'lucide-react'
import { useUiStore, type ActivePage } from '../../store/ui-store'

interface NavItem {
  page: ActivePage
  Icon: React.ComponentType<{ size?: number }>
  label: string
}

const MAIN_ITEMS: NavItem[] = [
  { page: 'chat',     Icon: MessageSquare, label: 'Chat' },
  { page: 'sessions', Icon: History,       label: 'Sessions' },
  { page: 'mcp',      Icon: Plug,          label: 'MCP' },
  { page: 'skills',   Icon: Zap,           label: 'Skills' },
  { page: 'hooks',    Icon: Webhook,       label: 'Hooks' },
]

interface NavButtonProps {
  page: ActivePage
  Icon: React.ComponentType<{ size?: number }>
  label: string
  active: boolean
  onClick: () => void
}

function NavButton({ Icon, label, active, onClick }: NavButtonProps): React.JSX.Element {
  return (
    <button
      onClick={onClick}
      title={label}
      style={{
        position: 'relative',
        width: 48,
        height: 48,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: active ? 'var(--color-accent)' : 'var(--color-text-muted)',
        background: active ? 'var(--color-accent-dim)' : 'transparent',
        border: 'none',
        cursor: 'pointer',
        transition: 'background 0.12s, color 0.12s',
        flexShrink: 0,
      }}
    >
      {active && (
        <span
          style={{
            position: 'absolute',
            left: 0,
            top: 8,
            bottom: 8,
            width: 2,
            background: 'var(--color-accent)',
            borderRadius: '0 2px 2px 0',
          }}
        />
      )}
      <Icon size={20} />
    </button>
  )
}

export function NavRail(): React.JSX.Element {
  const activePage = useUiStore((s) => s.activePage)
  const setActivePage = useUiStore((s) => s.setActivePage)

  return (
    <nav
      style={{
        width: 48,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--color-surface)',
        borderRight: '1px solid var(--color-border)',
        WebkitAppRegion: 'no-drag',
      } as React.CSSProperties}
    >
      {MAIN_ITEMS.map(({ page, Icon, label }) => (
        <NavButton
          key={page}
          page={page}
          Icon={Icon}
          label={label}
          active={activePage === page}
          onClick={() => setActivePage(page)}
        />
      ))}
      <div style={{ flex: 1 }} />
      <NavButton
        page="settings"
        Icon={Settings}
        label="Settings"
        active={activePage === 'settings'}
        onClick={() => setActivePage('settings')}
      />
    </nav>
  )
}
