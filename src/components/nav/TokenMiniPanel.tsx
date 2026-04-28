import React, { useState } from 'react'
import { ChevronDown, ChevronUp, ArrowUp, ArrowDown } from 'lucide-react'
import { useTabStore } from '../../store/tab-store'
import { NumberTicker } from '@renderer/components/ui/number-ticker'

function fmtTok(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

function fmtCost(usd: number): string {
  if (usd === 0) return ''
  if (usd < 0.01) return `$${usd.toFixed(4)}`
  return `$${usd.toFixed(2)}`
}

export function TokenMiniPanel(): React.JSX.Element | null {
  const [expanded, setExpanded] = useState(false)

  const totalInput = useTabStore((s) => {
    let n = 0
    for (const tab of s.tabs) for (const msg of tab.messages) if (msg.type === 'done') n += msg.inputTokens
    return n
  })
  const totalOutput = useTabStore((s) => {
    let n = 0
    for (const tab of s.tabs) for (const msg of tab.messages) if (msg.type === 'done') n += msg.outputTokens
    return n
  })
  const totalCost = useTabStore((s) => {
    let n = 0
    for (const tab of s.tabs) for (const msg of tab.messages) if (msg.type === 'done') n += msg.costUsd
    return n
  })

  if (totalInput === 0 && totalOutput === 0) return null

  const total = totalInput + totalOutput
  const inPct = total > 0 ? (totalInput / total) * 100 : 0
  const outPct = total > 0 ? (totalOutput / total) * 100 : 0
  const costStr = fmtCost(totalCost)

  return (
    <div className="flex-shrink-0 border-t border-[var(--color-border)]">
      {expanded ? (
        <div className="px-2.5 py-2">
          {/* Header */}
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[9px] font-bold text-[var(--color-text-muted)] uppercase tracking-[0.07em]">
              Token Usage
            </span>
            <button
              onClick={() => setExpanded(false)}
              className="flex items-center text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
              aria-label="Collapse"
            >
              <ChevronUp size={12} />
            </button>
          </div>

          {/* Dual bar */}
          <div className="flex h-[5px] rounded-[3px] overflow-hidden bg-[var(--color-surface-3)] mb-1.5">
            <div style={{ width: `${inPct}%` }} className="bg-[var(--color-accent)] transition-[width]" />
            <div style={{ width: `${outPct}%` }} className="bg-[var(--color-info)] transition-[width]" />
          </div>

          {/* Numbers */}
          <div className="text-[10px] text-[var(--color-text-muted)] font-mono leading-relaxed">
            <div>
              <ArrowUp size={9} className="inline text-[var(--color-accent)]" />
              {' '}<NumberTicker value={totalInput} className="text-[var(--color-text)] text-[10px]" /> in
              {'  '}
              <ArrowDown size={9} className="inline text-[var(--color-info)]" />
              {' '}<NumberTicker value={totalOutput} className="text-[var(--color-text)] text-[10px]" /> out
            </div>
            {costStr && (
              <div className="text-[var(--color-accent)]">{costStr}</div>
            )}
          </div>
        </div>
      ) : (
        <button
          onClick={() => setExpanded(true)}
          className="flex items-center gap-1 w-full px-2.5 py-[5px] text-[10px] text-[var(--color-text-muted)] font-mono text-left transition-colors hover:bg-[var(--color-surface-2)]"
          title="Token usage"
        >
          <span className="inline-flex items-center gap-[2px]"><ArrowUp size={9} className="text-[var(--color-accent)]" />{fmtTok(totalInput)}</span>
          <span className="text-[var(--color-text-faint)]">·</span>
          <span className="inline-flex items-center gap-[2px]"><ArrowDown size={9} className="text-[var(--color-info)]" />{fmtTok(totalOutput)}</span>
          {costStr && (
            <>
              <span className="text-[var(--color-text-faint)]">·</span>
              <span className="text-[var(--color-accent)]">{costStr}</span>
            </>
          )}
          <ChevronDown size={11} className="ml-auto flex-shrink-0 text-[var(--color-text-faint)]" />
        </button>
      )}
    </div>
  )
}
