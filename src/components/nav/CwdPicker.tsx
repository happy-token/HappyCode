import React, { useState } from 'react'

interface Props {
  cwd: string
  onChange: (cwd: string) => void
}

export function CwdPicker({ cwd, onChange }: Props): React.JSX.Element {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(cwd)

  async function browse(): Promise<void> {
    const picked = await window.electron.selectFolder()
    if (picked) onChange(picked)
  }

  return (
    <div className="flex items-center gap-1">
      {editing ? (
        <>
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                onChange(draft)
                setEditing(false)
              }
              if (e.key === 'Escape') setEditing(false)
            }}
            className="w-[300px] font-mono text-[12px] px-2 py-0.5 border border-[var(--color-border)] rounded-[var(--radius-sm)] bg-[var(--color-surface-2)] text-[var(--color-text)]"
          />
          <button
            onClick={() => { onChange(draft); setEditing(false) }}
            className="text-[11px] text-[var(--color-accent)] bg-transparent border-none cursor-pointer"
          >
            Apply
          </button>
        </>
      ) : (
        <button
          onClick={() => { setDraft(cwd); setEditing(true) }}
          className="font-mono text-[12px] text-[var(--color-text-muted)] px-2 py-[2px] border border-[var(--color-border)] rounded-[var(--radius-sm)] bg-transparent cursor-pointer"
        >
          {cwd || 'Set project path…'}
        </button>
      )}
      <button
        onClick={() => void browse()}
        title="Browse for folder"
        className="text-[13px] text-[var(--color-text-muted)] px-[6px] py-[2px] border border-[var(--color-border)] rounded-[var(--radius-sm)] leading-none bg-transparent cursor-pointer"
      >
        📁
      </button>
    </div>
  )
}
