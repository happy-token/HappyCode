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
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
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
            style={{ width: 300, fontFamily: 'var(--font-mono)', fontSize: 12 }}
          />
          <button
            onClick={() => { onChange(draft); setEditing(false) }}
            style={{ fontSize: 11, color: 'var(--color-accent)' }}
          >
            Apply
          </button>
        </>
      ) : (
        <button
          onClick={() => { setDraft(cwd); setEditing(true) }}
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            color: 'var(--color-text-muted)',
            padding: '2px 8px',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)',
          }}
        >
          {cwd || 'Set project path…'}
        </button>
      )}
      <button
        onClick={() => void browse()}
        title="Browse for folder"
        style={{
          fontSize: 13,
          color: 'var(--color-text-muted)',
          padding: '2px 6px',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-sm)',
          lineHeight: 1,
        }}
      >
        📁
      </button>
    </div>
  )
}
