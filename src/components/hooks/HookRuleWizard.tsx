import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, ChevronRight } from 'lucide-react'
import type { HookType, ClaudeHookRule } from '../../../electron/shared/types'
import { HookTestSandbox } from './HookTestSandbox'
import { cn } from '@renderer/lib/utils'

const ALL_HOOK_TYPES: HookType[] = [
  'PreToolUse', 'PostToolUse', 'PostToolUseFailure',
  'UserPromptSubmit', 'Stop',
  'SubagentStart', 'SubagentStop',
  'SessionStart', 'SessionEnd',
  'Notification', 'PreCompact',
]

const inputCls = 'w-full px-2.5 py-[7px] bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-[var(--radius-md)] text-[var(--color-text)] text-[12px] font-mono'

function getHookDescriptions(t: ReturnType<typeof useTranslation>['t']): Record<HookType, string> {
  return {
    PreToolUse:         t('hooks.hookDesc.PreToolUse'),
    PostToolUse:        t('hooks.hookDesc.PostToolUse'),
    PostToolUseFailure: t('hooks.hookDesc.PostToolUseFailure'),
    UserPromptSubmit:   t('hooks.hookDesc.UserPromptSubmit'),
    Stop:               t('hooks.hookDesc.Stop'),
    SubagentStart:      t('hooks.hookDesc.SubagentStart'),
    SubagentStop:       t('hooks.hookDesc.SubagentStop'),
    SessionStart:       t('hooks.hookDesc.SessionStart'),
    SessionEnd:         t('hooks.hookDesc.SessionEnd'),
    Notification:       t('hooks.hookDesc.Notification'),
    PreCompact:         t('hooks.hookDesc.PreCompact'),
  }
}

interface HookRuleWizardProps {
  onSave: (hookType: HookType, rule: ClaudeHookRule) => void
  onCancel: () => void
}

export function HookRuleWizard({ onSave, onCancel }: HookRuleWizardProps): React.JSX.Element {
  const { t } = useTranslation()
  const hookDescs = getHookDescriptions(t)
  const [step, setStep] = useState<0 | 1 | 2>(0)
  const [selectedType, setSelectedType] = useState<HookType | null>(null)
  const [matcher, setMatcher] = useState('')
  const [command, setCommand] = useState('')
  const [stopConfirmed, setStopConfirmed] = useState(false)

  function canProceedStep0(): boolean {
    if (!selectedType) return false
    if (selectedType === 'Stop' && !stopConfirmed) return false
    return true
  }

  function handleSave(): void {
    if (!selectedType || !command.trim()) return
    const rule: ClaudeHookRule = { command: command.trim() }
    if (matcher.trim()) rule.matcher = matcher.trim()
    onSave(selectedType, rule)
  }

  const stepTitles = [t('hooks.selectEvent'), t('hooks.setMatcher'), t('hooks.configureCmd')]

  return (
    <div className="flex flex-col gap-3">
      {/* Step indicator */}
      <div className="flex items-center mb-1">
        {stepTitles.map((title, i) => (
          <React.Fragment key={i}>
            <div
              className={cn(
                'text-[11px]',
                i === step
                  ? 'text-[var(--color-accent)] font-semibold'
                  : i < step
                    ? 'text-[var(--color-text-muted)] font-normal'
                    : 'text-[var(--color-text-faint)] font-normal',
              )}
            >
              {i + 1}. {title}
            </div>
            {i < stepTitles.length - 1 && (
              <ChevronRight size={10} className="mx-1 text-[var(--color-text-faint)] flex-shrink-0" />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Step 0: Event type selection */}
      {step === 0 && (
        <div className="flex flex-col gap-1">
          {ALL_HOOK_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => { setSelectedType(type); setStopConfirmed(false) }}
              className={cn(
                'flex flex-col items-start px-2.5 py-[7px] rounded-[var(--radius-md)] border cursor-pointer gap-0.5 text-left',
                selectedType === type
                  ? 'bg-[var(--color-accent-dim)] border-[var(--color-accent)]'
                  : 'bg-[var(--color-surface-2)] border-[var(--color-border)]',
              )}
            >
              <span className="text-[12px] font-medium text-[var(--color-text)]">{type}</span>
              <span className="text-[10px] text-[var(--color-text-muted)]">{hookDescs[type]}</span>
            </button>
          ))}

          {selectedType === 'Stop' && (
            <div className="bg-[rgba(245,158,11,0.1)] border border-[var(--color-warning)] rounded-[var(--radius-md)] px-2.5 py-2 mt-1">
              <div className="flex gap-1.5 items-start">
                <AlertTriangle size={13} className="flex-shrink-0 mt-px text-[var(--color-warning)]" />
                <div>
                  <div className="text-[11px] font-semibold text-[var(--color-warning)]">{t('hooks.stopWarning')}</div>
                  <div className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                    {t('hooks.stopWarningDesc')}
                  </div>
                  <label className="flex items-center gap-1.5 mt-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={stopConfirmed}
                      onChange={(e) => setStopConfirmed(e.target.checked)}
                    />
                    <span className="text-[11px] text-[var(--color-text)]">{t('hooks.understandRisk')}</span>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 1: Tool matcher */}
      {step === 1 && (
        <div className="flex flex-col gap-2">
          <div className="text-[12px] text-[var(--color-text-muted)]">
            {t('hooks.matcherHint')}
          </div>
          <input
            value={matcher}
            onChange={(e) => setMatcher(e.target.value)}
            placeholder={t('hooks.matcherPlaceholder')}
            className={inputCls}
          />
        </div>
      )}

      {/* Step 2: Command + test sandbox */}
      {step === 2 && (
        <div className="flex flex-col gap-2.5">
          <div>
            <div className="text-[11px] text-[var(--color-text-muted)] mb-1">{t('hooks.shellCmd')}</div>
            <input
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder={t('hooks.commandPlaceholder')}
              className={inputCls}
            />
          </div>

          {selectedType !== null && command.trim() && (
            <HookTestSandbox command={command} eventName={selectedType} />
          )}
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-2 justify-end mt-1">
        <button
          onClick={onCancel}
          className="px-3.5 py-1.5 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-[var(--radius-md)] text-[var(--color-text-muted)] text-[12px] cursor-pointer"
        >
          {t('hooks.cancel')}
        </button>

        {step > 0 && (
          <button
            onClick={() => setStep((s) => (s - 1) as 0 | 1 | 2)}
            className="px-3.5 py-1.5 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-[var(--radius-md)] text-[var(--color-text)] text-[12px] cursor-pointer"
          >
            {t('hooks.prevStep')}
          </button>
        )}

        {step < 2 ? (
          <button
            onClick={() => setStep((s) => (s + 1) as 0 | 1 | 2)}
            disabled={step === 0 && !canProceedStep0()}
            className={cn(
              'px-3.5 py-1.5 border-none rounded-[var(--radius-md)] text-[12px] font-semibold',
              step === 0 && !canProceedStep0()
                ? 'bg-[var(--color-surface-3)] text-[var(--color-text-muted)] cursor-not-allowed'
                : 'bg-[var(--color-accent)] text-white cursor-pointer',
            )}
          >
            {t('hooks.nextStep')}
          </button>
        ) : (
          <button
            onClick={handleSave}
            disabled={!command.trim()}
            className={cn(
              'px-3.5 py-1.5 border-none rounded-[var(--radius-md)] text-[12px] font-semibold',
              !command.trim()
                ? 'bg-[var(--color-surface-3)] text-[var(--color-text-muted)] cursor-not-allowed'
                : 'bg-[var(--color-accent)] text-white cursor-pointer',
            )}
          >
            {t('hooks.saveRule')}
          </button>
        )}
      </div>
    </div>
  )
}
