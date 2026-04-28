import React, { useState } from 'react'
import { useGitStore } from '../../../store/git-store'

export function DeriveWorktreeDialog({ onClose }: { onClose: () => void }): React.JSX.Element {
  const [branch, setBranch] = useState('')
  const [worktreePath, setWorktreePath] = useState('')
  const [error, setError] = useState('')

  const handleCreate = async () => {
    if (!branch.trim()) { setError('Branch name is required'); return }
    if (!worktreePath.trim()) { setError('Path is required'); return }
    const result = await window.electron.gitDeriveWorktree({
      cwd: useGitStore.getState().cwd,
      branch: branch.trim(),
      path: worktreePath.trim(),
    })
    if (result.success) {
      await useGitStore.getState().refreshAll()
      onClose()
    } else {
      setError(result.error ?? 'Failed to create worktree')
    }
  }

  return (
    <div className="fixed inset-0 bg-[rgba(0,0,0,0.5)] flex items-center justify-center z-[500]" onClick={onClose}>
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-lg)] p-5 w-[320px] shadow-[0_12px_40px_rgba(0,0,0,0.5)] flex flex-col gap-[10px]" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-[13px] font-semibold text-[var(--color-text)] m-0">New Worktree</h3>
        <input
          className="w-full font-mono text-[12px] px-2 py-[6px] border border-[var(--color-border)] rounded-[var(--radius-sm)] bg-[var(--color-surface-2)] text-[var(--color-text)] outline-none transition-[border-color] duration-100 focus:border-[var(--color-border-focus)]"
          value={branch}
          onChange={(e) => setBranch(e.target.value)}
          placeholder="Branch name"
          autoFocus
        />
        <input
          className="w-full font-mono text-[12px] px-2 py-[6px] border border-[var(--color-border)] rounded-[var(--radius-sm)] bg-[var(--color-surface-2)] text-[var(--color-text)] outline-none transition-[border-color] duration-100 focus:border-[var(--color-border-focus)]"
          value={worktreePath}
          onChange={(e) => setWorktreePath(e.target.value)}
          placeholder="/path/to/worktree"
        />
        {error && <div className="text-[11px] text-[var(--color-danger)] py-1">{error}</div>}
        <div className="flex gap-2 justify-end">
          <button className="inline-flex items-center gap-1 text-[11px] px-[10px] py-1 border border-[var(--color-border)] rounded-[var(--radius-sm)] bg-[var(--color-surface-2)] text-[var(--color-text-muted)] transition-[color,border-color,background] duration-100 whitespace-nowrap hover:text-[var(--color-text)] hover:border-[var(--color-border-focus)] hover:bg-[var(--color-surface-3)] disabled:opacity-40 disabled:cursor-not-allowed" onClick={onClose}>Cancel</button>
          <button className="inline-flex items-center gap-1 text-[11px] px-[10px] py-1 border border-[var(--color-accent)] rounded-[var(--radius-sm)] bg-[var(--color-accent)] text-[#1a1a1f] font-semibold transition-opacity duration-100 whitespace-nowrap hover:opacity-85 disabled:opacity-40 disabled:cursor-not-allowed" onClick={() => void handleCreate()}>Create</button>
        </div>
      </div>
    </div>
  )
}
