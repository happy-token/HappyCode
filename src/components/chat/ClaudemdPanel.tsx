import React, { useEffect, useRef, useState } from 'react'
import { X, Save } from 'lucide-react'
import { cn } from '@renderer/lib/utils'

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
    <div className="absolute inset-0 bg-[var(--color-bg)] flex flex-col z-[100]">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-2 border-b border-[var(--color-border)] bg-[var(--color-surface)] flex-shrink-0">
        <span className="font-mono text-[12px] text-[var(--color-text-muted)] flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
          {filePath}
          {!exists && (
            <span className="ml-2 text-[var(--color-warning)] text-[11px]">
              (not found — will create on save)
            </span>
          )}
        </span>

        {savedAt && (
          <span className="text-[11px] text-[var(--color-success)]">Saved</span>
        )}

        <button
          onClick={() => void handleSave()}
          disabled={saving}
          className={cn(
            'flex items-center gap-[5px] text-[11px] text-[var(--color-accent)] px-2.5 py-[3px] border border-[var(--color-accent)] rounded-[var(--radius-sm)] bg-[var(--color-accent-dim)] transition-opacity',
            saving && 'opacity-50',
          )}
          title="Save (⌘S)"
        >
          <Save size={12} />
          {saving ? 'Saving…' : 'Save'}
        </button>

        <button
          onClick={onClose}
          className="flex items-center justify-center w-[26px] h-[26px] border border-[var(--color-border)] rounded-[var(--radius-sm)] text-[var(--color-text-muted)] bg-transparent"
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
        className="flex-1 resize-none border-none outline-none bg-[var(--color-bg)] text-[var(--color-text)] font-mono text-[13px] leading-[1.6] px-5 py-4"
        placeholder="# CLAUDE.md&#10;&#10;Project instructions for Claude…"
      />
    </div>
  )
}
