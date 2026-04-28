import React, { useState } from 'react'
import { X } from 'lucide-react'
import { cn } from '@renderer/lib/utils'

const CONTEXT_WINDOW = 200_000

function fmtTok(n: number): string {
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

interface Props {
  inputTokens: number
  outputTokens: number
}

export function ContextHUD({ inputTokens, outputTokens }: Props): React.JSX.Element | null {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed || inputTokens === 0) return null

  const pct = Math.min(Math.round((inputTokens / CONTEXT_WINDOW) * 100), 100)

  const barCls = pct >= 90 ? 'bg-[var(--color-danger)]' : pct >= 70 ? 'bg-[var(--color-warning)]' : 'bg-[var(--color-success)]'
  const textCls = pct >= 90 ? 'text-[var(--color-danger)]' : pct >= 70 ? 'text-[var(--color-warning)]' : 'text-[var(--color-text-muted)]'

  return (
    <div className="absolute top-3 right-4 z-10 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] px-2.5 py-[7px] min-w-[160px] shadow-[0_4px_16px_rgba(0,0,0,0.25)]">
      {/* Close */}
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-1 right-1 text-[var(--color-text-muted)] p-0.5 leading-none"
        aria-label="Dismiss"
      >
        <X size={10} />
      </button>

      {/* Label + pct */}
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-[9px] font-bold text-[var(--color-text-muted)] uppercase tracking-[0.06em]">
          Context
        </span>
        <div className="flex-1 h-1 bg-[var(--color-surface-3)] rounded-[2px] overflow-hidden">
          <div
            className={cn('h-full rounded-[2px] transition-[width]', barCls)}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className={cn('text-[10px] font-bold min-w-[28px] text-right', textCls)}>
          {pct}%
        </span>
      </div>

      {/* Token counts */}
      <div className="text-[10px] text-[var(--color-text-muted)] font-mono">
        <span className="text-[var(--color-text)]">{fmtTok(inputTokens)}</span>
        <span> in · </span>
        <span className="text-[var(--color-text)]">{fmtTok(outputTokens)}</span>
        <span> out</span>
      </div>
    </div>
  )
}
