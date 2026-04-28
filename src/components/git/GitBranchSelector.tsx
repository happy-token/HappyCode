import React, { useState } from 'react'
import { GitBranch, Plus, Lock } from 'lucide-react'
import { useGitStore } from '../../store/git-store'
import { cn } from '@renderer/lib/utils'

export function GitBranchSelector(): React.JSX.Element {
  const branches = useGitStore((s) => s.branches)
  const worktrees = useGitStore((s) => s.worktrees)
  const refreshAll = useGitStore((s) => s.refreshAll)
  const [showNewBranch, setShowNewBranch] = useState(false)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)

  const localBranches = branches.filter((b) => !b.isRemote)
  const worktreeBranches = new Set(worktrees.map((w) => w.branch))

  return (
    <div className="flex flex-col gap-[6px]">
      <div className="flex flex-col gap-px">
        {localBranches.map((branch) => {
          const occupied = worktreeBranches.has(branch.name)
          return (
            <button
              key={branch.name}
              className={cn(
                'flex items-center gap-[6px] w-full px-[6px] py-1 text-[11px] rounded-[var(--radius-sm)] text-left transition-[background,color] duration-100',
                branch.isCurrent
                  ? 'text-[var(--color-accent)] bg-[var(--color-accent-dim)] hover:bg-[var(--color-accent-dim)] hover:text-[var(--color-accent)]'
                  : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]',
              )}
              onClick={async () => {
                if (occupied || branch.isCurrent) return
                setCheckoutError(null)
                const ok = await useGitStore.getState().checkout(branch.name)
                if (ok) {
                  await refreshAll()
                } else {
                  setCheckoutError(`Failed to checkout '${branch.name}'`)
                }
              }}
            >
              {occupied ? <Lock size={12} className="text-[var(--color-text-faint)] flex-shrink-0" /> : <GitBranch size={12} />}
              <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{branch.name}</span>
              {branch.isCurrent && <span className="text-[9px] font-bold text-[var(--color-accent)] bg-[var(--color-accent-dim)] px-[5px] py-px rounded-full flex-shrink-0">current</span>}
            </button>
          )
        })}
      </div>
      {checkoutError && <div className="text-[11px] text-[var(--color-danger)] py-1">{checkoutError}</div>}
      <button className="inline-flex items-center gap-1 text-[10px] px-[7px] py-[2px] border border-[var(--color-border)] rounded-[var(--radius-sm)] bg-[var(--color-surface-2)] text-[var(--color-text-muted)] transition-[color,border-color,background] duration-100 whitespace-nowrap hover:text-[var(--color-text)] hover:border-[var(--color-border-focus)] hover:bg-[var(--color-surface-3)] disabled:opacity-40 disabled:cursor-not-allowed" onClick={() => setShowNewBranch(true)}>
        <Plus size={12} /> New branch
      </button>
      {showNewBranch && <NewBranchDialog onClose={() => setShowNewBranch(false)} />}
    </div>
  )
}

function NewBranchDialog({ onClose }: { onClose: () => void }): React.JSX.Element {
  const [name, setName] = useState('')
  const [error, setError] = useState('')

  const handleCreate = async () => {
    if (!name.trim()) { setError('Branch name is required'); return }
    const result = await window.electron.gitCreateBranch({
      cwd: useGitStore.getState().cwd,
      branch: name.trim(),
    })
    if (result.success) {
      await useGitStore.getState().refreshAll()
      onClose()
    } else {
      setError(result.error ?? 'Failed to create branch')
    }
  }

  return (
    <div className="fixed inset-0 bg-[rgba(0,0,0,0.5)] flex items-center justify-center z-[500]">
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-lg)] p-5 w-[320px] shadow-[0_12px_40px_rgba(0,0,0,0.5)] flex flex-col gap-[10px]">
        <h3 className="text-[13px] font-semibold text-[var(--color-text)] m-0">New Branch</h3>
        <input
          className="w-full font-mono text-[12px] px-2 py-[6px] border border-[var(--color-border)] rounded-[var(--radius-sm)] bg-[var(--color-surface-2)] text-[var(--color-text)] outline-none transition-[border-color] duration-100 focus:border-[var(--color-border-focus)]"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Branch name"
          autoFocus
          onKeyDown={(e) => { if (e.key === 'Enter') void handleCreate() }}
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
