import React, { useState } from 'react'
import { Sparkles, ArrowRight, Check } from 'lucide-react'
import { useApiConfigStore } from '../../store/api-config-store'
import { cn } from '@renderer/lib/utils'

interface OnboardingWizardProps {
  onDone: () => void
}

const STEPS = ['welcome', 'apikey'] as const
type Step = (typeof STEPS)[number]

export function OnboardingWizard({ onDone }: OnboardingWizardProps): React.JSX.Element {
  const [step, setStep] = useState<Step>('welcome')
  const [baseUrl, setBaseUrl] = useState('')
  const [authToken, setAuthToken] = useState('')
  const [saving, setSaving] = useState(false)

  const save = useApiConfigStore((s) => s.save)
  const existingConfig = useApiConfigStore((s) => s.config)

  function goNext(): void {
    const idx = STEPS.indexOf(step)
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1])
  }

  async function handleFinish(): Promise<void> {
    setSaving(true)
    if (baseUrl || authToken) {
      await save({ baseUrl: baseUrl || existingConfig.baseUrl, authToken: authToken || existingConfig.authToken })
    }
    localStorage.setItem('happycode:onboarding_done', '1')
    onDone()
  }

  const stepIndex = STEPS.indexOf(step)

  return (
    <div className="fixed inset-0 bg-[rgba(0,0,0,0.75)] flex items-center justify-center z-[1000]">
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-lg)] w-[480px] p-9 shadow-[0_24px_64px_rgba(0,0,0,0.6)]">
        {/* Step dots */}
        <div className="flex gap-1.5 mb-8 justify-center">
          {STEPS.map((s, i) => (
            <div
              key={s}
              className={cn(
                'h-1.5 rounded-[3px] transition-[width,background] duration-[250ms]',
                i <= stepIndex ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-border)]',
              )}
              style={{ width: i <= stepIndex ? 24 : 6 }}
            />
          ))}
        </div>

        {step === 'welcome' && <WelcomeStep onNext={goNext} />}
        {step === 'apikey' && (
          <ApiKeyStep
            baseUrl={baseUrl}
            authToken={authToken}
            onBaseUrlChange={setBaseUrl}
            onAuthTokenChange={setAuthToken}
            saving={saving}
            onFinish={() => void handleFinish()}
          />
        )}
      </div>
    </div>
  )
}

function WelcomeStep({ onNext }: { onNext: () => void }): React.JSX.Element {
  return (
    <div className="text-center">
      <div className="w-14 h-14 rounded-full bg-[var(--color-accent-dim)] flex items-center justify-center mx-auto mb-5">
        <Sparkles size={26} color="var(--color-accent)" />
      </div>
      <h2 className="text-[22px] font-bold mb-2.5 text-[var(--color-text)]">
        Welcome to HappyCode
      </h2>
      <p className="text-[13px] text-[var(--color-text-muted)] leading-[1.6] mb-8">
        A GUI for Claude Code — manage sessions, view history, configure hooks, and run AI agents from a clean interface. Takes 30 seconds to set up.
      </p>
      <PrimaryButton onClick={onNext} label="Get started" icon={<ArrowRight size={14} />} />
    </div>
  )
}

function ApiKeyStep({
  baseUrl,
  authToken,
  onBaseUrlChange,
  onAuthTokenChange,
  saving,
  onFinish,
}: {
  baseUrl: string
  authToken: string
  onBaseUrlChange: (v: string) => void
  onAuthTokenChange: (v: string) => void
  saving: boolean
  onFinish: () => void
}): React.JSX.Element {
  return (
    <div>
      <h2 className="text-[18px] font-bold mb-2 text-[var(--color-text)]">
        Configure API access
      </h2>
      <p className="text-[13px] text-[var(--color-text-muted)] leading-[1.6] mb-6">
        Leave blank to use Claude Code's default auth (API key from <code className="text-[11px]">~/.claude/</code>). Or enter a custom proxy endpoint.
      </p>

      <label className="block text-[11px] font-semibold text-[var(--color-text-muted)] mb-1.5 uppercase tracking-[0.05em]">
        Base URL (optional)
      </label>
      <input
        value={baseUrl}
        onChange={(e) => onBaseUrlChange(e.target.value)}
        placeholder="https://your-proxy.example.com"
        className="w-full text-[12px] px-2.5 py-[7px] border border-[var(--color-border)] rounded-[var(--radius-sm)] bg-[var(--color-surface-2)] text-[var(--color-text)] font-mono"
      />

      <label className="block text-[11px] font-semibold text-[var(--color-text-muted)] mb-1.5 uppercase tracking-[0.05em] mt-3">
        Auth token (optional)
      </label>
      <input
        type="password"
        value={authToken}
        onChange={(e) => onAuthTokenChange(e.target.value)}
        placeholder="Bearer token or API key"
        className="w-full text-[12px] px-2.5 py-[7px] border border-[var(--color-border)] rounded-[var(--radius-sm)] bg-[var(--color-surface-2)] text-[var(--color-text)] font-mono"
      />

      <div className="flex gap-2 justify-end mt-6">
        <button
          onClick={onFinish}
          className="text-[12px] text-[var(--color-text-muted)] px-4 py-[6px] border border-[var(--color-border)] rounded-[var(--radius-sm)] cursor-pointer bg-transparent"
        >
          Skip
        </button>
        <PrimaryButton
          onClick={onFinish}
          label={saving ? 'Starting…' : 'Start using HappyCode'}
          icon={<Check size={14} />}
          disabled={saving}
        />
      </div>
    </div>
  )
}

function PrimaryButton({
  onClick,
  label,
  icon,
  disabled,
}: {
  onClick: () => void
  label: string
  icon?: React.ReactNode
  disabled?: boolean
}): React.JSX.Element {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex items-center gap-1.5 text-[12px] font-semibold px-[18px] py-[7px] border-none rounded-[var(--radius-sm)] transition-[background] duration-150',
        disabled
          ? 'bg-[var(--color-border)] text-[var(--color-text-muted)] cursor-default'
          : 'bg-[var(--color-accent)] text-white cursor-pointer',
      )}
    >
      {label}
      {icon}
    </button>
  )
}
