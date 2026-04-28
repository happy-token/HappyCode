import React, { useEffect, useState } from 'react'
import type { GitCommitDetail } from '../../../../electron/shared/types'
import { useGitStore } from '../../../store/git-store'
import { GitDiffViewer } from '../GitDiffViewer'

export function CommitDetailDialog({ sha, onClose }: { sha: string; onClose: () => void }): React.JSX.Element {
  const cwd = useGitStore((s) => s.cwd)
  const [detail, setDetail] = useState<GitCommitDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      setError(null)
      try {
        const d = await window.electron.gitCommitDetail({ cwd, sha })
        setDetail(d)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [cwd, sha])

  return (
    <div className="fixed inset-0 bg-[rgba(0,0,0,0.5)] flex items-center justify-center z-[500]" onClick={onClose}>
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-lg)] p-5 w-[600px] max-h-[80vh] overflow-y-auto shadow-[0_12px_40px_rgba(0,0,0,0.5)] flex flex-col gap-[10px]" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-[13px] font-semibold text-[var(--color-text)] m-0">Commit Detail</h3>
        {loading && <div className="text-[11px] text-[var(--color-text-faint)] px-1 py-2">Loading...</div>}
        {error && <div className="text-[11px] text-[var(--color-danger)] py-1">{error}</div>}
        {detail && (
          <>
            <div className="flex flex-col gap-1 py-2 border-b border-[var(--color-border)] mb-2">
              <div className="font-mono text-[11px] text-[var(--color-accent)]">{detail.sha.slice(0, 7)}</div>
              <div className="text-[12px] font-semibold text-[var(--color-text)] leading-[1.4]">{detail.message}</div>
              <div className="text-[11px] text-[var(--color-text-muted)]">{detail.author} · {detail.date}</div>
              <div className="text-[10px] text-[var(--color-text-faint)] font-mono">
                {detail.stats.files} files, +{detail.stats.added} -{detail.stats.deleted}
              </div>
            </div>
            <GitDiffViewer diff={detail.diff} />
          </>
        )}
        <div className="flex gap-2 justify-end">
          <button className="inline-flex items-center gap-1 text-[11px] px-[10px] py-1 border border-[var(--color-border)] rounded-[var(--radius-sm)] bg-[var(--color-surface-2)] text-[var(--color-text-muted)] transition-[color,border-color,background] duration-100 whitespace-nowrap hover:text-[var(--color-text)] hover:border-[var(--color-border-focus)] hover:bg-[var(--color-surface-3)] disabled:opacity-40 disabled:cursor-not-allowed" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
