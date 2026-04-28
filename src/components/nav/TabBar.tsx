import React from 'react'
import { Plus, X } from 'lucide-react'
import { useTabStore, selectActiveTab } from '../../store/tab-store'
import { cn } from '@renderer/lib/utils'

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
    <div className="flex h-8 flex-shrink-0 items-center overflow-x-auto overflow-y-hidden border-b border-[var(--color-border)] bg-[var(--color-surface)]">
      {tabs.map((tab) => {
        const active = tab.tabId === activeTabId
        const label = tabLabel(tab.cwd)
        const isRunning = tab.status === 'running'
        return (
          <div
            key={tab.tabId}
            onClick={() => setActiveTab(tab.tabId)}
            className={cn(
              'group flex h-full min-w-[100px] max-w-[180px] flex-shrink-0 cursor-pointer select-none items-center gap-1 border-r border-[var(--color-border)] border-b-2 pl-3 pr-[6px]',
              active
                ? 'bg-[var(--color-surface-2)] border-b-[var(--color-accent)]'
                : 'bg-transparent border-b-transparent hover:bg-[var(--color-surface-2)]/50'
            )}
          >
            {isRunning ? (
              <span className="h-[5px] w-[5px] flex-shrink-0 rounded-full bg-[var(--color-success)] animate-[blink_1.2s_ease-in-out_infinite]" />
            ) : (
              <span className="h-[5px] w-[5px] flex-shrink-0" />
            )}
            <span
              className={cn(
                'flex-1 overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[11px]',
                active ? 'text-[var(--color-text)]' : 'text-[var(--color-text-muted)]'
              )}
              title={tab.cwd || 'New Tab'}
            >
              {label}
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); closeTab(tab.tabId) }}
              title="Close tab"
              className="flex h-[14px] w-[14px] flex-shrink-0 cursor-pointer items-center justify-center rounded-sm border-0 bg-transparent p-0 text-[var(--color-text-faint)] transition-all duration-100 opacity-0 group-hover:opacity-100 hover:text-[var(--color-danger)]"
            >
              <X size={10} />
            </button>
          </div>
        )
      })}

      <button
        onClick={() => addTab(activeCwd)}
        title="New tab (inherits current project path)"
        className="flex h-full w-8 flex-shrink-0 cursor-pointer items-center justify-center border-0 bg-transparent text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-accent)]"
      >
        <Plus size={13} />
      </button>
    </div>
  )
}
