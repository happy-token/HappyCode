import React, { useState, useRef, useEffect } from 'react'
import { FolderOpen, Moon, Sun, ChevronDown, DollarSign, Zap } from 'lucide-react'
import { useUiStore } from '../../store/ui-store'
import { useChatStore } from '../../store/session-store'
import { useApiConfigStore } from '../../store/api-config-store'
import { useTabStore, selectActiveTab } from '../../store/tab-store'
import { cn } from '../../lib/utils'

type PermissionMode = 'default' | 'acceptEdits' | 'plan' | 'bypassPermissions'

const MODES: { key: PermissionMode; label: string }[] = [
  { key: 'default', label: 'Default' },
  { key: 'acceptEdits', label: 'Accept Edits' },
  { key: 'plan', label: 'Plan' },
  { key: 'bypassPermissions', label: 'Bypass' },
]

const COMMON_MODELS = [
  'claude-sonnet-4-6-20250514',
  'claude-opus-4-7-20250514',
  'claude-haiku-4-5-20251001',
]

interface TopBarProps {
  projectName: string
  sessionTitle: string
  sessionStatus: string
  rightButtons: React.ReactNode
}

function ModelSelector({ model, onChange }: { model: string; onChange: (m: string) => void }): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent): void {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const display = model.split('/').pop() ?? model

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-[4px] rounded-[var(--radius-sm)] px-[8px] py-[3px] text-[11px] font-medium text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]"
      >
        <Zap size={11} />
        <span className="max-w-[140px] overflow-hidden text-ellipsis whitespace-nowrap">{display}</span>
        <ChevronDown size={10} />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-[200] mt-1 min-w-[200px] rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-1 shadow-[0_4px_20px_rgba(0,0,0,0.4)]">
          {COMMON_MODELS.map((m) => (
            <button
              key={m}
              onClick={() => { onChange(m); setOpen(false) }}
              className={cn(
                'block w-full rounded-[var(--radius-sm)] px-[10px] py-[6px] text-left text-[11px] transition-colors',
                model === m
                  ? 'bg-[var(--color-accent-dim)] text-[var(--color-accent)]'
                  : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]'
              )}
            >
              {m}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function ModePills({ mode, onChange }: { mode: string; onChange: (m: PermissionMode) => void }): React.JSX.Element {
  return (
    <div className="flex items-center gap-[2px] rounded-[var(--radius-sm)] bg-[var(--color-surface-2)] p-[2px]">
      {MODES.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={cn(
            'rounded-[3px] px-[8px] py-[2px] text-[10px] font-medium transition-colors',
            mode === key
              ? 'bg-[var(--color-surface)] text-[var(--color-accent)] shadow-[0_1px_2px_rgba(0,0,0,0.15)]'
              : 'bg-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
          )}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

function CostDisplay(): React.JSX.Element | null {
  const doneMsg = useTabStore((s) => {
    const msgs = selectActiveTab(s)?.messages ?? []
    const last = [...msgs].reverse().find((m) => m.type === 'done')
    return last?.type === 'done' ? last : null
  })

  if (!doneMsg || (doneMsg.inputTokens === 0 && doneMsg.outputTokens === 0)) return null

  return (
    <span className="flex flex-shrink-0 items-center gap-[3px] text-[10px] text-[var(--color-text-faint)]">
      <DollarSign size={10} />
      <span title={`${doneMsg.inputTokens.toLocaleString()} in / ${doneMsg.outputTokens.toLocaleString()} out`}>
        ${doneMsg.costUsd.toFixed(4)}
      </span>
    </span>
  )
}

function ThemeToggle(): React.JSX.Element {
  const theme = useUiStore((s) => s.theme)
  const toggleTheme = useUiStore((s) => s.toggleTheme)
  const nextLabel = theme === 'dark' ? 'Light mode' : 'Dark mode'

  return (
    <button
      onClick={toggleTheme}
      title={nextLabel}
      style={{ height: 26, width: 26 }}
      className="flex cursor-pointer items-center justify-center rounded-[var(--radius-sm)] border-0 bg-transparent text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]"
    >
      {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
    </button>
  )
}

export function TopBar({ projectName, sessionTitle, sessionStatus, rightButtons }: TopBarProps): React.JSX.Element {
  const model = useChatStore((s) => s.model)
  const setModel = useChatStore((s) => s.setModel)
  const permissionMode = useApiConfigStore((s) => s.agentSettings?.permissionMode ?? 'default')
  const agentSettings = useApiConfigStore((s) => s.agentSettings)
  const saveAgentSettings = useApiConfigStore((s) => s.saveAgentSettings)
  const cwd = useTabStore((s) => selectActiveTab(s)?.cwd ?? '')

  return (
    <div
      className="relative z-[100] flex h-[38px] flex-shrink-0 items-center gap-[8px] overflow-visible border-b border-[var(--color-border)] px-4"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* Left: project path + session title */}
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

      {/* Center: mode pills + model selector */}
      <div
        className="flex items-center gap-[6px]"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <ModePills
          mode={permissionMode}
          onChange={(m) => saveAgentSettings({ ...agentSettings, permissionMode: m })}
        />
        <ModelSelector
          model={model || 'claude-sonnet-4-6-20250514'}
          onChange={(m) => setModel(m)}
        />
      </div>

      {/* Right: cost + theme + action buttons */}
      <div
        className="ml-auto flex flex-shrink-0 items-center gap-[4px]"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        {(sessionStatus === 'done' || sessionStatus === 'error') && <CostDisplay />}
        <ThemeToggle />
        {rightButtons}
      </div>
    </div>
  )
}
