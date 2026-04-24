import React from 'react'
import { Plus, X } from 'lucide-react'
import { useTabStore, selectActiveTab } from '../../store/tab-store'

function tabLabel(cwd: string): string {
  if (!cwd) return 'New Tab'
  const parts = cwd.split('/')
  return parts[parts.length - 1] || cwd
}

export function TabBar(): React.JSX.Element {
  const tabs = useTabStore((s) => s.tabs)
  const activeTabId = useTabStore((s) => s.activeTabId)
  const activeCwd = useTabStore((s) => selectActiveTab(s)?.cwd ?? '')
  const addTab = useTabStore((s) => s.addTab)
  const closeTab = useTabStore((s) => s.closeTab)
  const setActiveTab = useTabStore((s) => s.setActiveTab)

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        height: 32,
        borderBottom: '1px solid var(--color-border)',
        background: 'var(--color-surface)',
        flexShrink: 0,
        overflowX: 'auto',
        overflowY: 'hidden',
      }}
    >
      {tabs.map((tab) => {
        const active = tab.tabId === activeTabId
        const label = tabLabel(tab.cwd)
        const isRunning = tab.status === 'running'
        return (
          <div
            key={tab.tabId}
            onClick={() => setActiveTab(tab.tabId)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '0 10px 0 12px',
              height: '100%',
              minWidth: 100,
              maxWidth: 180,
              cursor: 'pointer',
              borderRight: '1px solid var(--color-border)',
              background: active ? 'var(--color-surface-2)' : 'transparent',
              borderBottom: active ? '2px solid var(--color-accent)' : '2px solid transparent',
              flexShrink: 0,
              userSelect: 'none',
            }}
          >
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
                fontSize: 11,
                color: active ? 'var(--color-text)' : 'var(--color-text-muted)',
                fontFamily: 'var(--font-mono)',
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={tab.cwd || 'New Tab'}
            >
              {label}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation()
                closeTab(tab.tabId)
              }}
              title="Close tab"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 14,
                height: 14,
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                color: 'var(--color-text-faint)',
                flexShrink: 0,
                borderRadius: 2,
                padding: 0,
                opacity: 0.6,
              }}
              onMouseEnter={(e) => {
                ;(e.currentTarget as HTMLButtonElement).style.opacity = '1'
                ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--color-danger)'
              }}
              onMouseLeave={(e) => {
                ;(e.currentTarget as HTMLButtonElement).style.opacity = '0.6'
                ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-faint)'
              }}
            >
              <X size={10} />
            </button>
          </div>
        )
      })}

      <button
        onClick={() => addTab(activeCwd)}
        title="New tab (inherits current project path)"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 32,
          height: '100%',
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          color: 'var(--color-text-muted)',
          flexShrink: 0,
        }}
        onMouseEnter={(e) => {
          ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--color-accent)'
        }}
        onMouseLeave={(e) => {
          ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-muted)'
        }}
      >
        <Plus size={13} />
      </button>
    </div>
  )
}
