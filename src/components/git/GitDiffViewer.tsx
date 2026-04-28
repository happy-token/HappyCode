import React from 'react'
import { cn } from '@renderer/lib/utils'

export function GitDiffViewer({ diff }: { diff: string }): React.JSX.Element {
  const lines = diff.split('\n')
  return (
    <pre className="font-mono text-[11px] leading-[1.5] overflow-auto bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-sm)] p-2 max-h-[400px] whitespace-pre">
      {lines.map((line, i) => {
        const isAdd = line.startsWith('+') && !line.startsWith('+++')
        const isDel = line.startsWith('-') && !line.startsWith('---')
        const isHunk = line.startsWith('@@')
        const isHeader = line.startsWith('diff ') || line.startsWith('---') || line.startsWith('+++')
        return (
          <div
            key={i}
            className={cn(
              'block px-1 rounded-[var(--radius-xs)]',
              isAdd && 'text-[var(--color-success)] bg-[rgba(22,163,74,0.08)]',
              isDel && 'text-[var(--color-danger)] bg-[rgba(220,38,38,0.08)]',
              isHunk && 'text-[var(--color-info)] bg-[rgba(37,99,235,0.08)]',
              isHeader && 'text-[var(--color-text-muted)] font-semibold',
            )}
          >{line}</div>
        )
      })}
    </pre>
  )
}
