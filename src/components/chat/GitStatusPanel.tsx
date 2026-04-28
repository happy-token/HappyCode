import React, { useEffect, useState, useCallback } from 'react'
import { RefreshCw, X } from 'lucide-react'
import type { GitStatusEntry, GitStatusResult } from '../../../electron/shared/types'
import { cn } from '@renderer/lib/utils'

interface Props {
  cwd: string
  onClose: () => void
}

const CODE_COLOR: Record<string, string> = {
  M: 'var(--color-warning)',
  A: 'var(--color-success)',
  D: 'var(--color-danger)',
  R: 'var(--color-info)',
  '?': 'var(--color-text-muted)',
  '!': 'var(--color-text-faint)',
}

const CODE_LABEL: Record<string, string> = {
  M: 'M', A: 'A', D: 'D', R: 'R', '?': '?', '!': '!',
}

function EntryRow({ entry }: { entry: GitStatusEntry }): React.JSX.Element {
  const color = CODE_COLOR[entry.code] ?? 'var(--color-text-muted)'
  const label = CODE_LABEL[entry.code] ?? entry.code
  return (
    <div className="flex items-center gap-1.5 py-px text-[11px] font-mono">
      <span
        className="w-[14px] text-center font-bold flex-shrink-0"
        style={{ color }}
      >
        {label}
      </span>
      <span
        className={cn(
          'overflow-hidden text-ellipsis whitespace-nowrap',
          entry.staged ? 'text-[var(--color-text)]' : 'text-[var(--color-text-muted)]',
        )}
        title={entry.file}
      >
        {entry.file}
      </span>
    </div>
  )
}

export function GitStatusPanel({ cwd, onClose }: Props): React.JSX.Element {
  const [result, setResult] = useState<GitStatusResult | null>(null)
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const r = await window.electron.gitStatus(cwd)
      setResult(r)
    } finally {
      setLoading(false)
    }
  }, [cwd])

  useEffect(() => { void refresh() }, [refresh])

  const staged = result?.entries.filter((e) => e.staged) ?? []
  const unstaged = result?.entries.filter((e) => !e.staged) ?? []

  return (
    <div className="w-[260px] flex-shrink-0 flex flex-col border-l border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center px-2.5 py-2 border-b border-[var(--color-border)] gap-1.5 flex-shrink-0">
        <span className="text-[11px] font-bold text-[var(--color-text)] flex-1">
          Git
          {result?.branch && (
            <span className="font-normal text-[var(--color-accent)] ml-1.5">
              {result.branch}
            </span>
          )}
        </span>
        <button
          onClick={() => void refresh()}
          disabled={loading}
          title="Refresh"
          className={cn('text-[var(--color-text-muted)] p-0.5', loading && 'opacity-50')}
        >
          <RefreshCw size={12} />
        </button>
        <button onClick={onClose} className="text-[var(--color-text-muted)] p-0.5" title="Close">
          <X size={12} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-2.5 py-2">
        {result?.error && (
          <div className="text-[11px] text-[var(--color-danger)] mb-2">
            {result.error.includes('not a git') ? 'Not a git repository' : result.error}
          </div>
        )}

        {result && !result.error && result.entries.length === 0 && (
          <div className="text-[11px] text-[var(--color-text-muted)]">Clean</div>
        )}

        {staged.length > 0 && (
          <div className="mb-2">
            <div className="text-[9px] font-bold text-[var(--color-text-faint)] uppercase tracking-[0.07em] mb-1">
              Staged
            </div>
            {staged.map((e) => <EntryRow key={`s-${e.file}`} entry={e} />)}
          </div>
        )}

        {unstaged.length > 0 && (
          <div>
            <div className="text-[9px] font-bold text-[var(--color-text-faint)] uppercase tracking-[0.07em] mb-1">
              Changes
            </div>
            {unstaged.map((e) => <EntryRow key={`u-${e.file}`} entry={e} />)}
          </div>
        )}
      </div>
    </div>
  )
}
