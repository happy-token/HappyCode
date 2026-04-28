import React from 'react'
import { useUiStore, type Theme } from '../../store/ui-store'
import { useApiConfigStore } from '../../store/api-config-store'
import type { EffortLevel } from '../../../electron/shared/types'
import { cn } from '@renderer/lib/utils'

const EFFORT_LABELS: Record<EffortLevel, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  xhigh: 'XHigh',
}

const THEMES: Array<{ value: Theme; label: string }> = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

export function GeneralSettings(): React.JSX.Element {
  const theme = useUiStore((s) => s.theme)
  const setTheme = useUiStore((s) => s.setTheme)
  const { agentSettings, saveAgentSettings } = useApiConfigStore()

  function handleEffort(level: EffortLevel): void {
    void saveAgentSettings({ ...agentSettings, effort: level })
  }

  return (
    <div className="max-w-[480px]">
      {/* Theme */}
      <div className="mb-6">
        <div className="mb-1 text-[14px] font-bold text-[var(--color-text)]">外观</div>
        <div className="mb-3 text-[12px] text-[var(--color-text-muted)]">选择浅色或深色主题</div>
        <div className="flex gap-2">
          {THEMES.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setTheme(value)}
              className={cn(
                'flex-1 cursor-pointer rounded-[var(--radius-sm)] py-2 text-[12px] font-semibold',
                theme === value
                  ? 'border border-[var(--color-accent)] bg-[var(--color-accent)] text-white'
                  : 'border border-[var(--color-border)] bg-transparent text-[var(--color-text-muted)]'
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Effort Level */}
      <div className="mb-6">
        <div className="mb-1 text-[14px] font-bold text-[var(--color-text)]">努力程度</div>
        <div className="mb-3 text-[12px] text-[var(--color-text-muted)]">控制 AI 在任务上的投入程度</div>
        <div className="flex gap-1.5">
          {(['low', 'medium', 'high', 'xhigh'] as EffortLevel[]).map((level) => (
            <button
              key={level}
              onClick={() => handleEffort(level)}
              className={cn(
                'flex-1 cursor-pointer rounded-[var(--radius-sm)] py-1.5 text-[11px] font-semibold',
                agentSettings.effort === level
                  ? 'border border-[var(--color-accent)] bg-[var(--color-accent)] text-white'
                  : 'border border-[var(--color-border)] bg-transparent text-[var(--color-text-muted)]'
              )}
            >
              {EFFORT_LABELS[level]}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
