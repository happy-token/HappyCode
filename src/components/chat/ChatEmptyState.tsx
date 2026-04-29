import { useTranslation } from 'react-i18next'
import { History, Zap, CornerDownLeft } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { TypingAnimation } from '@renderer/components/ui/typing-animation'
import { WordRotate } from '@renderer/components/ui/word-rotate'
import { BlurFade } from '@renderer/components/ui/blur-fade'
import { ShimmerButton } from '@renderer/components/ui/shimmer-button'
import { Logo } from '@renderer/assets/Logo'

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
  const { t } = useTranslation()

  const quickCommands = [
    { label: '/init', desc: t('chatEmpty.quickInit') },
    { label: '/review', desc: t('chatEmpty.quickReview') },
    { label: '/compact', desc: t('chatEmpty.quickCompact') },
    { label: '/help', desc: t('chatEmpty.quickHelp') },
  ]

  if (sessionId) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-8 text-[var(--color-text-muted)]">
        <div className="flex flex-col items-center gap-2">
          <CornerDownLeft size={28} className="text-[var(--color-text-muted)]" />
          <div className="text-[14px] font-semibold text-[var(--color-text)]">{t('chatEmpty.sessionLoaded')}</div>
          <div className="text-[12px]">{t('chatEmpty.continueSession')}</div>
          <div className="mt-1 font-mono text-[10px] text-[var(--color-text-faint)]">{sessionId}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full w-full flex-col items-center justify-center">

      <BlurFade delay={0.1} className="flex flex-col items-center">
        {/* Logo */}
        <div className="mb-4">
          <Logo className="h-[52px] w-[52px]" />
        </div>

        {/* Headline */}
        <div className="mb-2 text-[18px] font-bold text-[var(--color-text)]">
          <TypingAnimation text={t('chatEmpty.startConversation')} duration={50} />
        </div>

        {/* Sub */}
        <div className="mb-7 max-w-[480px] text-center text-[13px] leading-[1.6] text-[var(--color-text-muted)]">
          {cwd ? (
            <WordRotate
              words={[
                `${t('chatEmpty.workingIn')} ${cwd.split('/').pop() ?? cwd}`,
                t('chatEmpty.typeOrPick'),
                t('chatEmpty.claudeReady'),
              ]}
              duration={3000}
            />
          ) : (
            t('chatEmpty.pickFolder')
          )}
        </div>

        {/* No CWD CTA */}
        {!cwd && (
          <ShimmerButton
            onClick={onPickFolder}
            background="var(--color-accent)"
            shimmerColor="rgba(255,255,255,0.5)"
            borderRadius="6px"
            className="mb-6 px-5 py-2 text-[12px] font-semibold"
          >
            {t('chatEmpty.chooseFolder')}
          </ShimmerButton>
        )}

        {/* Resume last session */}
        {!sessionId && lastSessionId && (
          <button
            onClick={onResumeLastSession}
            className="mb-7 flex cursor-pointer items-center gap-[7px] rounded-[var(--radius-sm)] border border-[var(--color-accent)] bg-[var(--color-accent-dim)] px-[18px] py-[6px] text-[12px] text-[var(--color-accent)] transition-colors duration-150 hover:bg-[var(--color-accent)] hover:text-white"
          >
            <History size={13} />
            {t('chatEmpty.resumeLastSession')}
          </button>
        )}

        {/* Quick commands */}
        {cwd && (
          <div className="w-full max-w-[640px]">
            <div className="mb-3 flex items-center gap-[5px] text-[10px] font-bold uppercase tracking-[0.07em] text-[var(--color-text-faint)]">
              <Zap size={10} />
              {t('chatEmpty.quickCommands')}
            </div>
            <div className="grid grid-cols-2 gap-[10px] sm:grid-cols-4">
              {quickCommands.map((cmd) => (
                <button
                  key={cmd.label}
                  onClick={() => onSendPrompt(cmd.label)}
                  className={cn(
                    'group cursor-pointer rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-[12px] text-left',
                    'transition-all duration-[120ms] hover:border-[var(--color-accent)] hover:bg-[var(--color-surface)]',
                    'hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)]'
                  )}
                >
                  <div className="mb-[2px] font-mono text-[12px] font-semibold text-[var(--color-accent)] transition-colors group-hover:text-[var(--color-accent-hover)]">
                    {cmd.label}
                  </div>
                  <div className="text-[11px] leading-[1.4] text-[var(--color-text-muted)] transition-colors group-hover:text-[var(--color-text)]">
                    {cmd.desc}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </BlurFade>
    </div>
  )
}
