import React, { useState } from 'react'
import { FolderGit, Plus } from 'lucide-react'
import { useGitStore } from '../../store/git-store'
import { DeriveWorktreeDialog } from './dialogs/DeriveWorktreeDialog'

export function GitWorktreeSection(): React.JSX.Element {
  const worktrees = useGitStore((s) => s.worktrees)
  const [showDerive, setShowDerive] = useState(false)

  if (worktrees.length === 0) {
    return (
      <div className="flex flex-col items-start gap-2 text-[11px] text-[var(--color-text-faint)] py-1">
        No worktrees
        <button className="inline-flex items-center gap-1 text-[10px] px-[7px] py-[2px] border border-[var(--color-border)] rounded-[var(--radius-sm)] bg-[var(--color-surface-2)] text-[var(--color-text-muted)] transition-[color,border-color,background] duration-100 whitespace-nowrap hover:text-[var(--color-text)] hover:border-[var(--color-border-focus)] hover:bg-[var(--color-surface-3)] disabled:opacity-40 disabled:cursor-not-allowed" onClick={() => setShowDerive(true)}>
          <Plus size={12} /> Create
        </button>
        {showDerive && <DeriveWorktreeDialog onClose={() => setShowDerive(false)} />}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      {worktrees.map((wt) => (
        <div key={wt.path} className="flex items-start gap-[6px] px-[6px] py-[5px] border border-[var(--color-border)] rounded-[var(--radius-sm)] bg-[var(--color-surface)] text-[11px] text-[var(--color-text-muted)]">
          <FolderGit size={13} />
          <div className="flex flex-col gap-[2px] overflow-hidden flex-1">
            <div className="text-[11px] font-semibold text-[var(--color-text)] overflow-hidden text-ellipsis whitespace-nowrap">{wt.branch}</div>
            <div className="font-mono text-[10px] text-[var(--color-text-faint)] overflow-hidden text-ellipsis whitespace-nowrap">{wt.path}</div>
            {wt.dirty && <span className="text-[9px] font-bold text-[var(--color-warning)] bg-[rgba(217,119,6,0.12)] px-[5px] py-px rounded-full self-start">dirty</span>}
          </div>
        </div>
      ))}
      <button className="inline-flex items-center gap-1 text-[10px] px-[7px] py-[2px] border border-[var(--color-border)] rounded-[var(--radius-sm)] bg-[var(--color-surface-2)] text-[var(--color-text-muted)] transition-[color,border-color,background] duration-100 whitespace-nowrap hover:text-[var(--color-text)] hover:border-[var(--color-border-focus)] hover:bg-[var(--color-surface-3)] disabled:opacity-40 disabled:cursor-not-allowed" onClick={() => setShowDerive(true)}>
        <Plus size={12} /> Create worktree
      </button>
      {showDerive && <DeriveWorktreeDialog onClose={() => setShowDerive(false)} />}
    </div>
  )
}
