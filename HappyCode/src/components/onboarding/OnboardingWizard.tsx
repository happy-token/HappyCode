import React, { useState } from 'react'
import { FolderOpen, Sparkles, ArrowRight, Check } from 'lucide-react'
import { useTabStore } from '../../store/tab-store'
import { useApiConfigStore } from '../../store/api-config-store'

interface OnboardingWizardProps {
  onDone: () => void
}

const STEPS = ['welcome', 'project', 'apikey'] as const
type Step = (typeof STEPS)[number]

export function OnboardingWizard({ onDone }: OnboardingWizardProps): React.JSX.Element {
  const [step, setStep] = useState<Step>('welcome')
  const [localCwd, setLocalCwd] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [authToken, setAuthToken] = useState('')
  const [saving, setSaving] = useState(false)

  const setCwd = useTabStore((s) => s.setCwd)
  const save = useApiConfigStore((s) => s.save)
  const existingConfig = useApiConfigStore((s) => s.config)

  function goNext(): void {
    const idx = STEPS.indexOf(step)
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1])
  }

  async function pickFolder(): Promise<void> {
    const path = await window.electron.selectFolder()
    if (path) setLocalCwd(path)
  }

  async function handleFinish(): Promise<void> {
    setSaving(true)
    if (localCwd) setCwd(localCwd)
    if (baseUrl || authToken) {
      await save({ baseUrl: baseUrl || existingConfig.baseUrl, authToken: authToken || existingConfig.authToken })
    }
    localStorage.setItem('happycode:onboarding_done', '1')
    onDone()
  }

  const stepIndex = STEPS.indexOf(step)

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          width: 480,
          padding: 36,
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
        }}
      >
        {/* Step dots */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 32, justifyContent: 'center' }}>
          {STEPS.map((s, i) => (
            <div
              key={s}
              style={{
                width: i <= stepIndex ? 24 : 6,
                height: 6,
                borderRadius: 3,
                background: i <= stepIndex ? 'var(--color-accent)' : 'var(--color-border)',
                transition: 'width 0.25s ease, background 0.25s ease',
              }}
            />
          ))}
        </div>

        {step === 'welcome' && <WelcomeStep onNext={goNext} />}
        {step === 'project' && (
          <ProjectStep cwd={localCwd} onPick={pickFolder} onNext={goNext} />
        )}
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
    <div style={{ textAlign: 'center' }}>
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: 'var(--color-accent-dim)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px',
        }}
      >
        <Sparkles size={26} color="var(--color-accent)" />
      </div>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 10, color: 'var(--color-text)' }}>
        Welcome to HappyCode
      </h2>
      <p style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.6, marginBottom: 32 }}>
        A GUI for Claude Code — manage sessions, view history, configure hooks, and run AI agents from a clean interface. Takes 30 seconds to set up.
      </p>
      <PrimaryButton onClick={onNext} label="Get started" icon={<ArrowRight size={14} />} />
    </div>
  )
}

function ProjectStep({
  cwd,
  onPick,
  onNext,
}: {
  cwd: string
  onPick: () => void
  onNext: () => void
}): React.JSX.Element {
  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: 'var(--color-text)' }}>
        Choose your project
      </h2>
      <p style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.6, marginBottom: 24 }}>
        Select the directory where Claude Code will run. You can change this anytime from the toolbar.
      </p>

      <div
        style={{
          display: 'flex',
          gap: 8,
          padding: '10px 12px',
          border: `1px solid ${cwd ? 'var(--color-accent)' : 'var(--color-border)'}`,
          borderRadius: 'var(--radius-md)',
          background: 'var(--color-surface-2)',
          marginBottom: 24,
          cursor: 'pointer',
          alignItems: 'center',
        }}
        onClick={onPick}
      >
        <FolderOpen size={14} color={cwd ? 'var(--color-accent)' : 'var(--color-text-muted)'} />
        <span
          style={{
            fontSize: 12,
            fontFamily: 'var(--font-mono)',
            color: cwd ? 'var(--color-text)' : 'var(--color-text-muted)',
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {cwd || 'Click to pick a folder…'}
        </span>
        {cwd && <Check size={12} color="var(--color-accent)" />}
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button
          onClick={onNext}
          style={{
            fontSize: 12,
            color: 'var(--color-text-muted)',
            padding: '6px 16px',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
          }}
        >
          Skip for now
        </button>
        <PrimaryButton onClick={onNext} label="Continue" icon={<ArrowRight size={14} />} disabled={!cwd} />
      </div>
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
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: 'var(--color-text)' }}>
        Configure API access
      </h2>
      <p style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.6, marginBottom: 24 }}>
        Leave blank to use Claude Code's default auth (API key from <code style={{ fontSize: 11 }}>~/.claude/</code>). Or enter a custom proxy endpoint.
      </p>

      <label style={labelStyle}>Base URL (optional)</label>
      <input
        value={baseUrl}
        onChange={(e) => onBaseUrlChange(e.target.value)}
        placeholder="https://your-proxy.example.com"
        style={inputStyle}
      />

      <label style={{ ...labelStyle, marginTop: 12 }}>Auth token (optional)</label>
      <input
        type="password"
        value={authToken}
        onChange={(e) => onAuthTokenChange(e.target.value)}
        placeholder="Bearer token or API key"
        style={inputStyle}
      />

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 24 }}>
        <button
          onClick={onFinish}
          style={{
            fontSize: 12,
            color: 'var(--color-text-muted)',
            padding: '6px 16px',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
          }}
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
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 12,
        fontWeight: 600,
        padding: '7px 18px',
        background: disabled ? 'var(--color-border)' : 'var(--color-accent)',
        color: disabled ? 'var(--color-text-muted)' : '#fff',
        border: 'none',
        borderRadius: 'var(--radius-sm)',
        cursor: disabled ? 'default' : 'pointer',
        transition: 'background 0.15s',
      }}
    >
      {label}
      {icon}
    </button>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--color-text-muted)',
  marginBottom: 6,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  fontSize: 12,
  padding: '7px 10px',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--color-surface-2)',
  color: 'var(--color-text)',
  fontFamily: 'var(--font-mono)',
}
