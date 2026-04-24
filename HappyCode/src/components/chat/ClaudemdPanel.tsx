import React, { useEffect, useRef, useState } from 'react'
import { X, Save } from 'lucide-react'

interface Props {
  cwd: string
  onClose: () => void
}

export function ClaudemdPanel({ cwd, onClose }: Props): React.JSX.Element {
  const [content, setContent] = useState('')
  const [exists, setExists] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    void window.electron.readClaudeMd(cwd).then(({ content: c, exists: e }) => {
      setContent(c)
      setExists(e)
      setTimeout(() => textareaRef.current?.focus(), 50)
    })
  }, [cwd])

  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        void handleSave()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose, content]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSave(): Promise<void> {
    setSaving(true)
    try {
      await window.electron.writeClaudeMd(cwd, content)
      setExists(true)
      setSavedAt(Date.now())
    } finally {
      setSaving(false)
    }
  }

  const filePath = `${cwd}/CLAUDE.md`

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'var(--color-bg)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 100,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '8px 16px',
          borderBottom: '1px solid var(--color-border)',
          background: 'var(--color-surface)',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            color: 'var(--color-text-muted)',
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {filePath}
          {!exists && (
            <span style={{ marginLeft: 8, color: 'var(--color-warning)', fontSize: 11 }}>
              (not found — will create on save)
            </span>
          )}
        </span>

        {savedAt && (
          <span style={{ fontSize: 11, color: 'var(--color-success)' }}>Saved</span>
        )}

        <button
          onClick={() => void handleSave()}
          disabled={saving}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            fontSize: 11,
            color: 'var(--color-accent)',
            padding: '3px 10px',
            border: '1px solid var(--color-accent)',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--color-accent-dim)',
            opacity: saving ? 0.5 : 1,
          }}
          title="Save (⌘S)"
        >
          <Save size={12} />
          {saving ? 'Saving…' : 'Save'}
        </button>

        <button
          onClick={onClose}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 26,
            height: 26,
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--color-text-muted)',
          }}
          title="Close (Esc)"
        >
          <X size={13} />
        </button>
      </div>

      {/* Editor */}
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => { setContent(e.target.value); setSavedAt(null) }}
        spellCheck={false}
        style={{
          flex: 1,
          resize: 'none',
          border: 'none',
          outline: 'none',
          background: 'var(--color-bg)',
          color: 'var(--color-text)',
          fontFamily: 'var(--font-mono)',
          fontSize: 13,
          lineHeight: 1.6,
          padding: '16px 20px',
        }}
        placeholder="# CLAUDE.md&#10;&#10;Project instructions for Claude…"
      />
    </div>
  )
}
