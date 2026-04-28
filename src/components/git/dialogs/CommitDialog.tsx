import React, { useState } from 'react'
import { useGitStore } from '../../../store/git-store'

export function CommitDialog({ onClose }: { onClose: () => void }): React.JSX.Element {
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const loading = useGitStore((s) => s.loading)

  const handleCommit = async () => {
    if (!message.trim()) { setError('Commit message is required'); return }
    const ok = await useGitStore.getState().commit(message.trim())
    if (ok) onClose()
    else setError('Commit failed')
  }

  return (
    <div className="fixed inset-0 bg-[rgba(0,0,0,0.5)] flex items-center justify-center z-[500]" onClick={onClose}>
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-lg)] p-5 w-[320px] shadow-[0_12px_40px_rgba(0,0,0,0.5)] flex flex-col gap-[10px]" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-[13px] font-semibold text-[var(--color-text)] m-0">Commit Changes</h3>
        <textarea
          className="w-full font-mono text-[12px] p-2 border border-[var(--color-border)] rounded-[var(--radius-sm)] bg-[var(--color-surface-2)] text-[var(--color-text)] outline-none resize-y transition-[border-color] duration-100 focus:border-[var(--color-border-focus)]"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Commit message..."
          autoFocus
          rows={4}
        />
        {error && <div className="text-[11px] text-[var(--color-danger)] py-1">{error}</div>}
        <div className="flex gap-2 justify-end">
          <button className="inline-flex items-center gap-1 text-[11px] px-[10px] py-1 border border-[var(--color-border)] rounded-[var(--radius-sm)] bg-[var(--color-surface-2)] text-[var(--color-text-muted)] transition-[color,border-color,background] duration-100 whitespace-nowrap hover:text-[var(--color-text)] hover:border-[var(--color-border-focus)] hover:bg-[var(--color-surface-3)] disabled:opacity-40 disabled:cursor-not-allowed" onClick={onClose} disabled={loading}>Cancel</button>
          <button className="inline-flex items-center gap-1 text-[11px] px-[10px] py-1 border border-[var(--color-accent)] rounded-[var(--radius-sm)] bg-[var(--color-accent)] text-[#1a1a1f] font-semibold transition-opacity duration-100 whitespace-nowrap hover:opacity-85 disabled:opacity-40 disabled:cursor-not-allowed" onClick={() => void handleCommit()} disabled={loading}>
            {loading ? 'Committing...' : 'Commit'}
          </button>
        </div>
      </div>
    </div>
  )
}
