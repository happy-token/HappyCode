import React, { useState } from 'react'
import { GitCommit } from 'lucide-react'
import { useGitStore } from '../../store/git-store'
import { CommitDetailDialog } from './dialogs/CommitDetailDialog'

export function GitHistorySection(): React.JSX.Element {
  const log = useGitStore((s) => s.log)
  const [selectedSha, setSelectedSha] = useState<string | null>(null)

  if (log.length === 0) {
    return <div className="text-[11px] text-[var(--color-text-faint)] px-1 py-2">No commits yet</div>
  }

  return (
    <div className="flex flex-col gap-px">
      {log.map((entry) => (
        <button
          key={entry.sha}
          className="flex items-start gap-[6px] w-full px-[6px] py-[5px] text-[11px] text-left rounded-[var(--radius-sm)] text-[var(--color-text)] transition-[background] duration-100 hover:bg-[var(--color-surface-2)]"
          onClick={() => setSelectedSha(entry.sha)}
        >
          <GitCommit size={13} className="flex-shrink-0 text-[var(--color-text-faint)] mt-px" />
          <div className="flex flex-col gap-[2px] overflow-hidden flex-1">
            <div className="text-[11px] text-[var(--color-text)] overflow-hidden text-ellipsis whitespace-nowrap">{entry.message}</div>
            <div className="flex gap-[6px] items-center flex-wrap">
              <span className="font-mono text-[9px] text-[var(--color-accent)] bg-[var(--color-accent-dim)] px-1 py-px rounded-[var(--radius-xs)]">{entry.shortSha}</span>
              <span className="text-[10px] text-[var(--color-text-muted)]">{entry.author}</span>
              <span className="text-[10px] text-[var(--color-text-faint)] font-mono">{entry.relativeDate}</span>
            </div>
          </div>
        </button>
      ))}
      {selectedSha && (
        <CommitDetailDialog sha={selectedSha} onClose={() => setSelectedSha(null)} />
      )}
    </div>
  )
}
