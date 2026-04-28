import React from 'react'
import { useTranslation } from 'react-i18next'
import { useUiStore, type Theme, type Locale } from '../../store/ui-store'
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

const LOCALES: Array<{ value: Locale; labelKey: string }> = [
  { value: 'en', labelKey: 'general.languages.en' },
  { value: 'zh', labelKey: 'general.languages.zh' },
  { value: 'ja', labelKey: 'general.languages.ja' },
  { value: 'ko', labelKey: 'general.languages.ko' },
  { value: 'es', labelKey: 'general.languages.es' },
  { value: 'fr', labelKey: 'general.languages.fr' },
  { value: 'de', labelKey: 'general.languages.de' },
  { value: 'pt', labelKey: 'general.languages.pt' },
  { value: 'ar', labelKey: 'general.languages.ar' },
]

export function GeneralSettings(): React.JSX.Element {
  const { t } = useTranslation()
  const theme = useUiStore((s) => s.theme)
  const setTheme = useUiStore((s) => s.setTheme)
  const locale = useUiStore((s) => s.locale)
  const setLocale = useUiStore((s) => s.setLocale)
  const { agentSettings, saveAgentSettings } = useApiConfigStore()

  function handleEffort(level: EffortLevel): void {
    void saveAgentSettings({ ...agentSettings, effort: level })
  }

  return (
    <div className="max-w-[480px]">
      {/* Theme */}
      <div className="mb-6">
        <div className="mb-1 text-[14px] font-bold text-[var(--color-text)]">{t('general.appearance')}</div>
        <div className="mb-3 text-[12px] text-[var(--color-text-muted)]">{t('general.appearanceDescription')}</div>
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

      {/* Language */}
      <div className="mb-6">
        <div className="mb-1 text-[14px] font-bold text-[var(--color-text)]">{t('general.language')}</div>
        <div className="mb-3 text-[12px] text-[var(--color-text-muted)]">{t('general.languageDescription')}</div>
        <select
          value={locale}
          onChange={(e) => setLocale(e.target.value as Locale)}
          className="w-full cursor-pointer rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-[13px] text-[var(--color-text)]"
        >
          {LOCALES.map(({ value, labelKey }) => (
            <option key={value} value={value}>
              {t(labelKey)}
            </option>
          ))}
        </select>
      </div>

      {/* Effort Level */}
      <div className="mb-6">
        <div className="mb-1 text-[14px] font-bold text-[var(--color-text)]">{t('general.effort')}</div>
        <div className="mb-3 text-[12px] text-[var(--color-text-muted)]">{t('general.effortDescription')}</div>
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
