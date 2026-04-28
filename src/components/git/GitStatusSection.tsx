import React from 'react'
import { GitBranch, Upload } from 'lucide-react'
import { useGitStore } from '../../store/git-store'
import { CommitDialog } from './dialogs/CommitDialog'

const STATUS_COLORS: Record<string, string> = {
  M: 'var(--color-warning)',
  A: 'var(--color-success)',
  D: 'var(--color-danger)',
  R: 'var(--color-info)',
  '?': 'var(--color-text-muted)',
  '!': 'var(--color-danger)',
}

export function GitStatusSection(): React.JSX.Element {
  const status = useGitStore((s) => s.status)
  const loading = useGitStore((s) => s.loading)
  const refreshAll = useGitStore((s) => s.refreshAll)
  const [showCommit, setShowCommit] = React.useState(false)
  const [pushError, setPushError] = React.useState<string | null>(null)

  if (!status) return <div className="text-[11px] text-[var(--color-text-faint)] px-1 py-2">Loading...</div>

  const staged = status.entries.filter((e) => e.staged)
  const unstaged = status.entries.filter((e) => !e.staged)

  return (
    <div className="flex flex-col gap-[6px]">
      <div className="flex items-center gap-[5px] text-[11px] font-semibold text-[var(--color-accent)] py-[2px] pb-[4px] border-b border-[var(--color-border)]">
        <GitBranch size={13} />
        <span>{status.branch || '(no branch)'}</span>
      </div>

      {staged.length > 0 && (
        <div className="flex flex-col gap-[2px]">
          <div className="text-[9px] font-bold text-[var(--color-text-faint)] uppercase tracking-[0.06em] py-[2px]">Staged ({staged.length})</div>
          {staged.map((entry) => (
            <div key={entry.file} className="flex items-center gap-[6px] px-1 py-[2px] rounded-[var(--radius-xs)] text-[11px] transition-[background] duration-100 hover:bg-[var(--color-surface-2)]">
              <span className="font-mono text-[10px] font-bold w-[14px] flex-shrink-0" style={{ color: STATUS_COLORS[entry.code] }}>
                {entry.code}
              </span>
              <span className="font-mono text-[11px] text-[var(--color-text)] overflow-hidden text-ellipsis whitespace-nowrap">{entry.file}</span>
            </div>
          ))}
        </div>
      )}

      {unstaged.length > 0 && (
        <div className="flex flex-col gap-[2px]">
          <div className="text-[9px] font-bold text-[var(--color-text-faint)] uppercase tracking-[0.06em] py-[2px]">Unstaged ({unstaged.length})</div>
          {unstaged.map((entry) => (
            <div key={entry.file} className="flex items-center gap-[6px] px-1 py-[2px] rounded-[var(--radius-xs)] text-[11px] transition-[background] duration-100 hover:bg-[var(--color-surface-2)]">
              <span className="font-mono text-[10px] font-bold w-[14px] flex-shrink-0" style={{ color: STATUS_COLORS[entry.code] }}>
                {entry.code}
              </span>
              <span className="font-mono text-[11px] text-[var(--color-text)] overflow-hidden text-ellipsis whitespace-nowrap">{entry.file}</span>
            </div>
          ))}
        </div>
      )}

      {staged.length === 0 && unstaged.length === 0 && (
        <div className="text-[11px] text-[var(--color-text-faint)] py-1">Clean</div>
      )}

      <div className="flex gap-[6px] pt-1 flex-wrap">
        <button
          className="inline-flex items-center gap-1 text-[11px] px-[10px] py-1 border border-[var(--color-accent)] rounded-[var(--radius-sm)] bg-[var(--color-accent)] text-[#1a1a1f] font-semibold transition-opacity duration-100 whitespace-nowrap hover:opacity-85 disabled:opacity-40 disabled:cursor-not-allowed"
          onClick={() => setShowCommit(true)}
          disabled={unstaged.length === 0 && staged.length === 0}
        >
          Commit
        </button>
        <button
          className="inline-flex items-center gap-1 text-[11px] px-[10px] py-1 border border-[var(--color-border)] rounded-[var(--radius-sm)] bg-[var(--color-surface-2)] text-[var(--color-text-muted)] transition-[color,border-color,background] duration-100 whitespace-nowrap hover:text-[var(--color-text)] hover:border-[var(--color-border-focus)] hover:bg-[var(--color-surface-3)] disabled:opacity-40 disabled:cursor-not-allowed"
          onClick={async () => {
            setPushError(null)
            const ok = await useGitStore.getState().push()
            if (!ok) {
              setPushError('Push failed')
            } else {
              await refreshAll()
            }
          }}
          disabled={loading}
        >
          <Upload size={12} /> Push
        </button>
        <button className="inline-flex items-center gap-1 text-[11px] px-[10px] py-1 border border-[var(--color-border)] rounded-[var(--radius-sm)] bg-[var(--color-surface-2)] text-[var(--color-text-muted)] transition-[color,border-color,background] duration-100 whitespace-nowrap hover:text-[var(--color-text)] hover:border-[var(--color-border-focus)] hover:bg-[var(--color-surface-3)] disabled:opacity-40 disabled:cursor-not-allowed" onClick={() => void refreshAll()}>
          Refresh
        </button>
      </div>

      {pushError && <div className="text-[11px] text-[var(--color-danger)] py-1">{pushError}</div>}
      {showCommit && <CommitDialog onClose={() => setShowCommit(false)} />}
    </div>
  )
}
