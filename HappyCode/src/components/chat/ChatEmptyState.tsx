import React from 'react'
import { Sparkles, FolderOpen, History, Zap } from 'lucide-react'

const QUICK_COMMANDS = [
  { label: '/init', desc: 'Generate CLAUDE.md for this project' },
  { label: '/review', desc: 'Review recent changes' },
  { label: '/compact', desc: 'Compress conversation context' },
  { label: '/help', desc: 'Show available commands' },
]

interface ChatEmptyStateProps {
  cwd: string
  sessionId: string
  lastSessionId: string | null
  onResumeLastSession: () => void
  onPickFolder: () => void
  onSendPrompt: (prompt: string) => void
}

export function ChatEmptyState({
  cwd,
  sessionId,
  lastSessionId,
  onResumeLastSession,
  onPickFolder,
  onSendPrompt,
}: ChatEmptyStateProps): React.JSX.Element {
  if (sessionId) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          color: 'var(--color-text-muted)',
          padding: 32,
        }}
      >
        <div style={{ fontSize: 28 }}>↩</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>Session loaded</div>
        <div style={{ fontSize: 12 }}>Type a message to continue this session</div>
        <div
          style={{
            fontSize: 10,
            fontFamily: 'var(--font-mono)',
            color: 'var(--color-text-faint)',
            marginTop: 4,
          }}
        >
          {sessionId}
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 24px',
        gap: 0,
      }}
    >
      {/* Icon */}
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: '50%',
          background: 'var(--color-accent-dim)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 16,
        }}
      >
        <Sparkles size={24} color="var(--color-accent)" />
      </div>

      {/* Headline */}
      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text)', marginBottom: 8 }}>
        Start a conversation
      </div>

      {/* Sub */}
      <div
        style={{
          fontSize: 13,
          color: 'var(--color-text-muted)',
          marginBottom: 28,
          textAlign: 'center',
          maxWidth: 340,
          lineHeight: 1.6,
        }}
      >
        {cwd
          ? `Working in ${cwd.split('/').pop() ?? cwd}`
          : 'Pick a project folder to get started'}
      </div>

      {/* No CWD CTA */}
      {!cwd && (
        <button
          onClick={onPickFolder}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            fontSize: 12,
            fontWeight: 600,
            padding: '8px 20px',
            background: 'var(--color-accent)',
            color: '#fff',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
            marginBottom: 24,
          }}
        >
          <FolderOpen size={14} />
          Choose project folder
        </button>
      )}

      {/* Resume last session */}
      {!sessionId && lastSessionId && (
        <button
          onClick={onResumeLastSession}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            marginBottom: 28,
            fontSize: 12,
            padding: '6px 18px',
            border: '1px solid var(--color-accent)',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--color-accent-dim)',
            color: 'var(--color-accent)',
            cursor: 'pointer',
          }}
        >
          <History size={13} />
          Resume last session
        </button>
      )}

      {/* Quick commands */}
      {cwd && (
        <div style={{ width: '100%', maxWidth: 360 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: 'var(--color-text-faint)',
              textTransform: 'uppercase',
              letterSpacing: '0.07em',
              marginBottom: 8,
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <Zap size={10} />
            Quick commands
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 6,
            }}
          >
            {QUICK_COMMANDS.map((cmd) => (
              <button
                key={cmd.label}
                onClick={() => onSendPrompt(cmd.label)}
                style={{
                  textAlign: 'left',
                  padding: '8px 10px',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--color-surface-2)',
                  cursor: 'pointer',
                  transition: 'border-color 0.12s',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-accent)'
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-border)'
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 600,
                    color: 'var(--color-accent)',
                    marginBottom: 2,
                  }}
                >
                  {cmd.label}
                </div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
                  {cmd.desc}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
