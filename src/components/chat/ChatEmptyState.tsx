import React, { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Sparkles, History, Zap, CornerDownLeft } from 'lucide-react'
import { motion } from 'motion/react'
import { cn } from '@renderer/lib/utils'
import { TypingAnimation } from '@renderer/components/ui/typing-animation'
import { WordRotate } from '@renderer/components/ui/word-rotate'
import { BlurFade } from '@renderer/components/ui/blur-fade'
import { ShimmerButton } from '@renderer/components/ui/shimmer-button'
import { Particles } from '@renderer/components/ui/particles'
import { AnimatedBeam } from '@renderer/components/ui/animated-beam'

interface ChatEmptyStateProps {
  cwd: string
  sessionId: string
  lastSessionId: string | null
  onResumeLastSession: () => void
  onPickFolder: () => void
  onSendPrompt: (prompt: string) => void
}

function AuroraBackground(): React.JSX.Element {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <motion.div
        className="absolute left-[15%] top-[5%] h-[60%] w-[60%] rounded-full bg-[radial-gradient(circle,var(--color-accent),transparent_70%)] opacity-25 blur-[56px]"
        animate={{ x: [0, 40, -20, 0], y: [0, -30, 20, 0], scale: [1, 1.15, 0.9, 1] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute right-[8%] top-[40%] h-[50%] w-[50%] rounded-full bg-[radial-gradient(circle,rgba(100,80,180,1),transparent_70%)] opacity-[0.12] blur-[64px]"
        animate={{ x: [0, -50, 20, 0], y: [0, 40, -30, 0], scale: [1, 0.9, 1.1, 1] }}
        transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
      />
      <motion.div
        className="absolute bottom-[15%] left-[40%] h-[40%] w-[40%] rounded-full bg-[radial-gradient(circle,rgba(50,180,180,1),transparent_70%)] opacity-[0.08] blur-[72px]"
        animate={{ x: [0, 30, -40, 0], y: [0, -20, 30, 0], scale: [1, 1.1, 0.85, 1] }}
        transition={{ duration: 26, repeat: Infinity, ease: 'easeInOut', delay: 4 }}
      />
    </div>
  )
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
  const containerRef = useRef<HTMLDivElement>(null)
  const iconRef = useRef<HTMLDivElement>(null)
  const commandsRef = useRef<HTMLDivElement>(null)

  const quickCommands = [
    { label: '/init', desc: t('chatEmpty.quickInit') },
    { label: '/review', desc: t('chatEmpty.quickReview') },
    { label: '/compact', desc: t('chatEmpty.quickCompact') },
    { label: '/help', desc: t('chatEmpty.quickHelp') },
  ]

  if (sessionId) {
    return (
      <div className="relative flex min-h-[60vh] flex-col items-center justify-center gap-2 overflow-hidden p-8 text-[var(--color-text-muted)]">
        <AuroraBackground />
        <div className="relative z-10 flex flex-col items-center gap-2">
          <CornerDownLeft size={28} className="text-[var(--color-text-muted)]" />
          <div className="text-[14px] font-semibold text-[var(--color-text)]">{t('chatEmpty.sessionLoaded')}</div>
          <div className="text-[12px]">{t('chatEmpty.continueSession')}</div>
          <div className="mt-1 font-mono text-[10px] text-[var(--color-text-faint)]">{sessionId}</div>
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative flex min-h-[60vh] flex-col items-center justify-center overflow-hidden px-6 py-8">
      <AuroraBackground />
      <Particles
        className="absolute inset-0"
        quantity={35}
        color="#a0866a"
        size={0.35}
        staticity={60}
      />

      {cwd && (
        <AnimatedBeam
          containerRef={containerRef}
          fromRef={iconRef}
          toRef={commandsRef}
          gradientStartColor="var(--color-accent)"
          gradientStopColor="#7c6af7"
          pathColor="var(--color-border)"
          pathOpacity={0.12}
          pathWidth={1.5}
          duration={5}
          curvature={-40}
        />
      )}

      <BlurFade delay={0.1} className="relative z-10 flex flex-col items-center">
        {/* Icon */}
        <div ref={iconRef} className="mb-4 flex h-[52px] w-[52px] items-center justify-center rounded-full bg-[var(--color-accent-dim)]">
          <Sparkles size={24} color="var(--color-accent)" />
        </div>

        {/* Headline */}
        <div className="mb-2 text-[18px] font-bold text-[var(--color-text)]">
          <TypingAnimation text={t('chatEmpty.startConversation')} duration={50} />
        </div>

        {/* Sub */}
        <div className="mb-7 max-w-[340px] text-center text-[13px] leading-[1.6] text-[var(--color-text-muted)]">
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
          <div ref={commandsRef} className="w-full max-w-[360px]">
            <div className="mb-2 flex items-center gap-[5px] text-[10px] font-bold uppercase tracking-[0.07em] text-[var(--color-text-faint)]">
              <Zap size={10} />
              {t('chatEmpty.quickCommands')}
            </div>
            <div className="grid grid-cols-2 gap-[6px]">
              {quickCommands.map((cmd) => (
                <button
                  key={cmd.label}
                  onClick={() => onSendPrompt(cmd.label)}
                  className={cn(
                    'group cursor-pointer rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-[10px] text-left',
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
