import React, { useRef, useState, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { Attachment } from '../../../electron/shared/types'

interface AttachmentDraft extends Attachment {
  dataUrl: string // full data URL for preview
}

interface SlashCommand {
  name: string
  description: string
  isSkill?: boolean
}

const SLASH_COMMANDS: SlashCommand[] = [
  { name: '/clear', description: 'Clear conversation history' },
  { name: '/compact', description: 'Compact context to save tokens' },
  { name: '/cost', description: 'Show token usage and cost' },
  { name: '/doctor', description: 'Run diagnostics and check configuration' },
  { name: '/help', description: 'Show help and available commands' },
  { name: '/init', description: 'Initialize project with CLAUDE.md' },
  { name: '/memory', description: 'View and edit project memory files' },
  { name: '/model', description: 'Switch model (e.g. /model claude-opus-4-7)' },
  { name: '/permissions', description: 'Manage tool permissions for this session' },
  { name: '/review', description: 'Review recent code changes' },
  { name: '/status', description: 'Show current session status and stats' },
  { name: '/vim', description: 'Toggle vim keybinding mode' },
]

interface Props {
  onSend: (prompt: string, attachments?: Attachment[]) => void
  onStop: () => void
  disabled: boolean
  running: boolean
}

const ACCEPTED_TYPES: ReadonlySet<string> = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp'])

function readFileAsBase64(file: File): Promise<AttachmentDraft> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      const commaIdx = dataUrl.indexOf(',')
      const data = dataUrl.slice(commaIdx + 1)
      resolve({
        name: file.name,
        mimeType: file.type as Attachment['mimeType'],
        data,
        dataUrl,
      })
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function PromptInput({ onSend, onStop, disabled, running }: Props): React.JSX.Element {
  const [value, setValue] = useState('')
  const [attachments, setAttachments] = useState<AttachmentDraft[]>([])
  const [dragging, setDragging] = useState(false)
  const [selectedCmdIdx, setSelectedCmdIdx] = useState(-1)
  const [skillCmds, setSkillCmds] = useState<SlashCommand[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Load enabled skills on mount
  useEffect(() => {
    if (typeof window.electron?.listSkills !== 'function') return
    window.electron.listSkills()
      .then(({ skills }) => {
        const cmds = skills
          .filter((s) => s.enabled)
          .map((s) => ({ name: `/${s.name}`, description: s.description ?? 'Skill', isSkill: true }))
          .sort((a, b) => a.name.localeCompare(b.name))
        setSkillCmds(cmds)
      })
      .catch(() => {})
  }, [])

  // Detect slash command mode: value must be exactly /word (no spaces)
  const slashMatch = /^\/(\w*)$/.exec(value)
  const slashQuery = slashMatch ? slashMatch[1].toLowerCase() : null
  const allCmds = [...SLASH_COMMANDS, ...skillCmds]
  const filteredCmds = slashQuery !== null
    ? allCmds.filter(c => c.name.slice(1).startsWith(slashQuery))
    : []
  const showCmdDropdown = filteredCmds.length > 0

  // Reset selection when filter changes
  useEffect(() => {
    setSelectedCmdIdx(-1)
  }, [slashQuery])

  const applyCmd = (cmd: SlashCommand): void => {
    setValue(cmd.name + ' ')
    setSelectedCmdIdx(-1)
    textareaRef.current?.focus()
  }

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const arr = Array.from(files).filter((f) => ACCEPTED_TYPES.has(f.type))
    if (!arr.length) return
    const drafts = await Promise.all(arr.map(readFileAsBase64))
    setAttachments((prev) => [...prev, ...drafts])
  }, [])

  const removeAttachment = (idx: number): void => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx))
  }

  const submit = (): void => {
    const trimmed = value.trim()
    if ((!trimmed && attachments.length === 0) || disabled) return
    const sendAttachments: Attachment[] = attachments.map(({ name, mimeType, data }) => ({ name, mimeType, data }))
    onSend(trimmed, sendAttachments.length ? sendAttachments : undefined)
    setValue('')
    setAttachments([])
    textareaRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (showCmdDropdown) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedCmdIdx(i => Math.min(i + 1, filteredCmds.length - 1))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedCmdIdx(i => Math.max(i - 1, 0))
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setValue('')
        return
      }
      if (e.key === 'Tab') {
        e.preventDefault()
        const idx = selectedCmdIdx >= 0 ? selectedCmdIdx : 0
        if (filteredCmds[idx]) applyCmd(filteredCmds[idx])
        return
      }
      if (e.key === 'Enter' && !e.shiftKey && selectedCmdIdx >= 0) {
        e.preventDefault()
        applyCmd(filteredCmds[selectedCmdIdx])
        return
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  const handlePaste = useCallback((e: React.ClipboardEvent): void => {
    const items = Array.from(e.clipboardData.items)
    const imageFiles = items
      .filter((item) => ACCEPTED_TYPES.has(item.type))
      .map((item) => item.getAsFile())
      .filter((f): f is File => f !== null)
    if (imageFiles.length) {
      e.preventDefault()
      addFiles(imageFiles).catch(console.error)
    }
  }, [addFiles])

  const handleDragOver = (e: React.DragEvent): void => {
    e.preventDefault()
    setDragging(true)
  }

  const handleDragLeave = (): void => setDragging(false)

  const handleDrop = useCallback((e: React.DragEvent): void => {
    e.preventDefault()
    setDragging(false)
    addFiles(e.dataTransfer.files).catch(console.error)
  }, [addFiles])

  // Compute dropdown position from container bounding rect
  let dropdownRect: { bottom: number; left: number; width: number } | null = null
  if (showCmdDropdown && containerRef.current) {
    const rect = containerRef.current.getBoundingClientRect()
    dropdownRect = {
      bottom: window.innerHeight - rect.top + 4,
      left: rect.left,
      width: rect.width,
    }
  }

  return (
    <div
      ref={containerRef}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        padding: '12px 16px',
        borderTop: `1px solid ${dragging ? 'var(--color-accent)' : 'var(--color-border)'}`,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        background: dragging ? 'var(--color-accent-dim)' : 'var(--color-surface)',
        flexShrink: 0,
        transition: 'background 0.1s, border-color 0.1s',
      }}
    >
      {/* Slash command dropdown — rendered via portal to escape overflow: hidden */}
      {showCmdDropdown && dropdownRect && createPortal(
        <div
          style={{
            position: 'fixed',
            bottom: dropdownRect.bottom,
            left: dropdownRect.left,
            width: dropdownRect.width,
            maxHeight: 300,
            overflowY: 'auto',
            zIndex: 9999,
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 -6px 24px rgba(0,0,0,0.3)',
          }}
        >
          <div style={{ padding: '4px 10px 4px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Slash Commands
            </span>
            <span style={{ fontSize: 9, color: 'var(--color-text-muted)' }}>
              ↑↓ navigate · Tab/Enter select · Esc dismiss
            </span>
          </div>
          {filteredCmds.map((cmd, i) => (
            <div
              key={cmd.name}
              onMouseDown={(e) => { e.preventDefault(); applyCmd(cmd) }}
              onMouseEnter={() => setSelectedCmdIdx(i)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '7px 12px',
                background: i === selectedCmdIdx ? 'var(--color-accent-dim)' : 'transparent',
                cursor: 'pointer',
                borderBottom: i < filteredCmds.length - 1 ? '1px solid var(--color-border)' : 'none',
                transition: 'background 0.08s',
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-accent)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
                {cmd.name}
              </span>
              {cmd.isSkill && (
                <span style={{
                  fontSize: 9,
                  fontWeight: 700,
                  color: 'var(--color-success)',
                  background: 'rgba(var(--color-success-rgb, 52, 211, 153), 0.12)',
                  border: '1px solid var(--color-success)',
                  borderRadius: 3,
                  padding: '0 4px',
                  flexShrink: 0,
                  lineHeight: '16px',
                }}>
                  skill
                </span>
              )}
              <span style={{ fontSize: 11, color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                {cmd.description}
              </span>
            </div>
          ))}
        </div>,
        document.body
      )}

      {/* Attachment thumbnails */}
      {attachments.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {attachments.map((att, idx) => (
            <div
              key={idx}
              style={{ position: 'relative', display: 'inline-block' }}
            >
              <img
                src={att.dataUrl}
                alt={att.name}
                style={{
                  height: 64,
                  width: 64,
                  objectFit: 'cover',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border)',
                }}
              />
              <button
                onClick={() => removeAttachment(idx)}
                title="Remove"
                style={{
                  position: 'absolute',
                  top: -6,
                  right: -6,
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  background: 'var(--color-danger)',
                  color: '#fff',
                  fontSize: 11,
                  lineHeight: '18px',
                  textAlign: 'center',
                  padding: 0,
                  cursor: 'pointer',
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Text + controls row */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        {/* Attach button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled && !running}
          title="Attach image"
          style={{
            padding: '7px 10px',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--color-surface-2)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-muted)',
            fontSize: 15,
            cursor: 'pointer',
            flexShrink: 0,
            lineHeight: 1,
          }}
        >
          📎
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files).catch(console.error)
            e.target.value = ''
          }}
        />

        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={(e) => void handlePaste(e)}
          placeholder={
            dragging
              ? 'Drop images here…'
              : running
              ? 'Claude is working…'
              : 'Ask Claude anything · / for commands (Enter to send, Shift+Enter for newline)'
          }
          disabled={disabled && !running}
          rows={3}
          style={{
            flex: 1,
            resize: 'none',
            fontFamily: 'var(--font-sans)',
            fontSize: 13,
            lineHeight: 1.5,
            background: 'var(--color-surface-2)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            padding: '8px 12px',
            color: 'var(--color-text)',
            outline: 'none',
            transition: 'border-color 0.15s',
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--color-accent)')}
          onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--color-border)')}
        />
        {running ? (
          <button
            onClick={onStop}
            title="Stop"
            style={{
              padding: '8px 16px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--color-danger)',
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            ■ Stop
          </button>
        ) : (
          <button
            onClick={submit}
            disabled={disabled || (!value.trim() && attachments.length === 0)}
            title="Send (Enter)"
            style={{
              padding: '8px 16px',
              borderRadius: 'var(--radius-sm)',
              background:
                disabled || (!value.trim() && attachments.length === 0)
                  ? 'var(--color-surface-2)'
                  : 'var(--color-accent)',
              color:
                disabled || (!value.trim() && attachments.length === 0)
                  ? 'var(--color-text-muted)'
                  : '#fff',
              fontSize: 13,
              fontWeight: 600,
              flexShrink: 0,
              transition: 'background 0.15s',
            }}
          >
            Send ↵
          </button>
        )}
      </div>
    </div>
  )
}
