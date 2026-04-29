import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@renderer/lib/utils'

export function ExportSettings(): React.JSX.Element {
  const { t } = useTranslation()
  const [redactMode, setRedactMode] = useState<'none' | 'sensitive' | 'all'>('sensitive')
  const [customPatterns, setCustomPatterns] = useState('')

  const modes: Array<{ value: typeof redactMode; labelKey: string; descKey: string }> = [
    { value: 'none', labelKey: 'export.modes.none', descKey: 'export.modes.noneDesc' },
    { value: 'sensitive', labelKey: 'export.modes.sensitive', descKey: 'export.modes.sensitiveDesc' },
    { value: 'all', labelKey: 'export.modes.all', descKey: 'export.modes.allDesc' },
  ]

  return (
    <div className="max-w-[640px]">
      <div className="mb-4">
        <div className="text-[16px] font-bold text-[var(--color-text)]">{t('export.title')}</div>
        <div className="mt-0.5 text-[12px] text-[var(--color-text-muted)]">{t('export.description')}</div>
      </div>

      <div className="flex flex-col gap-5">
        <div>
          <div className="mb-2 text-[12px] font-semibold text-[var(--color-text)]">{t('export.redactionMode')}</div>
          <div className="flex flex-col gap-2">
            {modes.map((mode) => (
              <label
                key={mode.value}
                className={cn(
                  'flex cursor-pointer items-start gap-[10px] rounded-[8px] p-3',
                  redactMode === mode.value
                    ? 'border border-[var(--color-accent)] bg-[var(--color-accent-dim)]'
                    : 'border border-[var(--color-border)] bg-transparent'
                )}
              >
                <input
                  type="radio"
                  name="redactMode"
                  checked={redactMode === mode.value}
                  onChange={() => setRedactMode(mode.value)}
                  className="mt-0.5 flex-shrink-0 [accent-color:var(--color-accent)]"
                />
                <div>
                  <div className="text-[12px] font-semibold text-[var(--color-text)]">{t(mode.labelKey)}</div>
                  <div className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">{t(mode.descKey)}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label>
            <div className="mb-2 text-[12px] font-semibold text-[var(--color-text)]">{t('export.customRedaction')}</div>
            <textarea
              value={customPatterns}
              onChange={(e) => setCustomPatterns(e.target.value)}
              className="box-border min-h-[80px] w-full resize-y rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-[10px] py-[6px] font-mono text-[12px] text-[var(--color-text)] outline-none"
              placeholder={t('export.placeholder')}
            />
          </label>
          <div className="mt-1 text-[10px] text-[var(--color-text-faint)]">
            {t('export.hint')}
          </div>
        </div>
      </div>
    </div>
  )
}
