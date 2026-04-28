import React, { useRef, useState, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'motion/react'
import { Plus, CornerDownLeft, Square, Paperclip, FileText, Terminal, X, ArrowUp, ArrowDown } from 'lucide-react'
import { BorderBeam } from '@renderer/components/ui/border-beam'
import type { Attachment } from '../../../electron/shared/types'
import { cn } from '@renderer/lib/utils'

interface AttachmentDraft extends Attachment {
  dataUrl: string
}

interface TextFileDraft {
  name: string
  content: string
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

const TEXT_EXTS: ReadonlySet<string> = new Set([
  'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs',
  'py', 'go', 'rs', 'c', 'cpp', 'h', 'hpp',
  'css', 'scss', 'html', 'htm', 'json', 'jsonc',
  'yaml', 'yml', 'toml', 'env', 'sh', 'bash', 'zsh',
  'md', 'mdx', 'txt', 'sql', 'prisma', 'graphql', 'gql',
  'xml', 'csv', 'lock', 'gitignore', 'dockerfile',
])

function isTextFile(file: File): boolean {
  const ext = file.name.slice(file.name.lastIndexOf('.') + 1).toLowerCase()
  return TEXT_EXTS.has(ext) || file.type.startsWith('text/')
}

function readFileAsText(file: File): Promise<TextFileDraft> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve({ name: file.name, content: reader.result as string })
    reader.onerror = reject
    reader.readAsText(file)
  })
}

function readFileAsBase64(file: File): Promise<AttachmentDraft> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      const commaIdx = dataUrl.indexOf(',')
      const data = dataUrl.slice(commaIdx + 1)
      resolve({ name: file.name, mimeType: file.type as Attachment['mimeType'], data, dataUrl })
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function PromptInput({ onSend, onStop, disabled, running }: Props): React.JSX.Element {
  const [value, setValue] = useState('')
  const [attachments, setAttachments] = useState<AttachmentDraft[]>([])
  const [textFiles, setTextFiles] = useState<TextFileDraft[]>([])
  const [dragging, setDragging] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const [plusMenuOpen, setPlusMenuOpen] = useState(false)
  const [selectedCmdIdx, setSelectedCmdIdx] = useState(-1)
  const [skillCmds, setSkillCmds] = useState<SlashCommand[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const plusMenuRef = useRef<HTMLDivElement>(null)
  const historyRef = useRef<string[]>([])
  const historyIdxRef = useRef(-1)
  const draftRef = useRef('')

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

  useEffect(() => {
    if (!plusMenuOpen) return
    const handleClick = (event: MouseEvent) => {
      if (plusMenuRef.current && !plusMenuRef.current.contains(event.target as Node)) {
        setPlusMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [plusMenuOpen])

  const slashMatch = /^\/(\w*)$/.exec(value)
  const slashQuery = slashMatch ? slashMatch[1].toLowerCase() : null
  const allCmds = [...SLASH_COMMANDS, ...skillCmds]
  const filteredCmds = slashQuery !== null
    ? allCmds.filter(c => c.name.slice(1).startsWith(slashQuery))
    : []
  const showCmdDropdown = filteredCmds.length > 0

  useEffect(() => { setSelectedCmdIdx(-1) }, [slashQuery])

  const applyCmd = (cmd: SlashCommand): void => {
    setValue(cmd.name + ' ')
    setSelectedCmdIdx(-1)
    textareaRef.current?.focus()
  }

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const arr = Array.from(files)
    const imageFiles = arr.filter((f) => ACCEPTED_TYPES.has(f.type))
    const textFileArr = arr.filter((f) => !ACCEPTED_TYPES.has(f.type) && isTextFile(f))
    if (imageFiles.length) {
      const drafts = await Promise.all(imageFiles.map(readFileAsBase64))
      setAttachments((prev) => [...prev, ...drafts])
    }
    if (textFileArr.length) {
      const drafts = await Promise.all(textFileArr.map(readFileAsText))
      setTextFiles((prev) => [...prev, ...drafts])
    }
  }, [])

  const removeAttachment = (idx: number): void => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx))
  }

  const submit = (): void => {
    const trimmed = value.trim()
    if ((!trimmed && attachments.length === 0 && textFiles.length === 0) || disabled) return
    if (trimmed) {
      historyRef.current = [trimmed, ...historyRef.current.slice(0, 49)]
      historyIdxRef.current = -1
      draftRef.current = ''
    }
    let finalPrompt = trimmed
    if (textFiles.length > 0) {
      const docs = textFiles
        .map((f) => `<file name="${f.name}">\n${f.content}\n</file>`)
        .join('\n\n')
      finalPrompt = trimmed ? `${docs}\n\n${trimmed}` : docs
    }
    const sendAttachments: Attachment[] = attachments.map(({ name, mimeType, data }) => ({ name, mimeType, data }))
    onSend(finalPrompt, sendAttachments.length ? sendAttachments : undefined)
    setValue('')
    setAttachments([])
    setTextFiles([])
    textareaRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (!showCmdDropdown) {
      const ta = textareaRef.current
      if (e.key === 'ArrowUp' && ta && historyRef.current.length > 0) {
        const onFirstLine = !value.slice(0, ta.selectionStart).includes('\n')
        if (onFirstLine) {
          e.preventDefault()
          if (historyIdxRef.current === -1) draftRef.current = value
          const newIdx = Math.min(historyIdxRef.current + 1, historyRef.current.length - 1)
          historyIdxRef.current = newIdx
          const entry = historyRef.current[newIdx]
          setValue(entry)
          requestAnimationFrame(() => { textareaRef.current?.setSelectionRange(entry.length, entry.length) })
          return
        }
      }
      if (e.key === 'ArrowDown' && ta && historyIdxRef.current >= 0) {
        const onLastLine = !value.slice(ta.selectionStart).includes('\n')
        if (onLastLine) {
          e.preventDefault()
          const newIdx = historyIdxRef.current - 1
          historyIdxRef.current = newIdx
          const entry = newIdx < 0 ? draftRef.current : historyRef.current[newIdx]
          setValue(entry)
          requestAnimationFrame(() => { textareaRef.current?.setSelectionRange(entry.length, entry.length) })
          return
        }
      }
    }

    if (showCmdDropdown) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedCmdIdx(i => Math.min(i + 1, filteredCmds.length - 1)); return }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedCmdIdx(i => Math.max(i - 1, 0)); return }
      if (e.key === 'Escape') { e.preventDefault(); setValue(''); return }
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

    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() }
  }

  const handlePaste = useCallback((e: React.ClipboardEvent): void => {
    const items = Array.from(e.clipboardData.items)
    const imageFiles = items
      .filter((item) => ACCEPTED_TYPES.has(item.type))
      .map((item) => item.getAsFile())
      .filter((f): f is File => f !== null)
    if (imageFiles.length) { e.preventDefault(); addFiles(imageFiles).catch(console.error) }
  }, [addFiles])

  const handleDragOver = (e: React.DragEvent): void => { e.preventDefault(); setDragging(true) }
  const handleDragLeave = (): void => setDragging(false)
  const handleDrop = useCallback((e: React.DragEvent): void => {
    e.preventDefault()
    setDragging(false)
    addFiles(e.dataTransfer.files).catch(console.error)
  }, [addFiles])

  let dropdownRect: { bottom: number; left: number; width: number } | null = null
  if (showCmdDropdown && containerRef.current) {
    const rect = containerRef.current.getBoundingClientRect()
    dropdownRect = { bottom: window.innerHeight - rect.top + 4, left: rect.left, width: rect.width }
  }

  const canSend = !disabled && (!!value.trim() || attachments.length > 0 || textFiles.length > 0)

  return (
    <motion.div
      ref={containerRef}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        'relative flex flex-col rounded-[10px] transition-[border-color] duration-150 bg-[var(--color-surface-2)]',
        dragging
          ? 'border-2 border-dashed border-[var(--color-accent)]'
          : 'border border-[var(--color-border)]'
      )}
    >
      {isFocused && !dragging && (
        <BorderBeam
          size={80}
          duration={4}
          colorFrom="var(--color-accent)"
          colorTo="transparent"
          borderWidth={1.5}
        />
      )}
      {/* Slash command dropdown — rendered via portal */}
      {showCmdDropdown && dropdownRect && createPortal(
        <div
          className="fixed max-h-[300px] overflow-y-auto z-[9999] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] shadow-[0_-6px_24px_rgba(0,0,0,0.3)]"
          style={{ bottom: dropdownRect.bottom, left: dropdownRect.left, width: dropdownRect.width }}
        >
          <div className="flex items-center justify-between border-b border-[var(--color-border)] px-[10px] py-1">
            <span className="text-[9px] font-bold uppercase tracking-[0.06em] text-[var(--color-text-muted)]">
              Slash Commands
            </span>
            <span className="text-[9px] text-[var(--color-text-muted)]">
              <ArrowUp size={9} className="inline" /><ArrowDown size={9} className="inline" /> navigate · Tab/Enter select · Esc dismiss
            </span>
          </div>
          {filteredCmds.map((cmd, i) => (
            <div
              key={cmd.name}
              onMouseDown={(e) => { e.preventDefault(); applyCmd(cmd) }}
              onMouseEnter={() => setSelectedCmdIdx(i)}
              className={cn(
                'flex cursor-pointer items-center gap-3 px-3 py-[7px] transition-colors duration-75',
                i < filteredCmds.length - 1 && 'border-b border-[var(--color-border)]',
                i === selectedCmdIdx ? 'bg-[var(--color-accent-dim)]' : 'bg-transparent'
              )}
            >
              <span className="flex-shrink-0 font-mono text-[12px] font-bold text-[var(--color-accent)]">
                {cmd.name}
              </span>
              {cmd.isSkill && (
                <span className="flex-shrink-0 rounded-[3px] border border-[var(--color-success)] bg-[rgba(52,211,153,0.12)] px-1 text-[9px] font-bold leading-4 text-[var(--color-success)]">
                  skill
                </span>
              )}
              <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[11px] text-[var(--color-text-muted)]">
                {cmd.description}
              </span>
            </div>
          ))}
        </div>,
        document.body
      )}

      {/* Drag overlay */}
      {dragging && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-[var(--radius-md)] border-2 border-dashed border-[var(--color-accent)] bg-[var(--color-accent-dim)]">
          <span className="text-[13px] font-semibold text-[var(--color-accent)]">Drop files to attach</span>
        </div>
      )}

      {/* Text file chips */}
      {textFiles.length > 0 && (
        <div className="flex flex-wrap gap-[6px] px-3 pt-2">
          {textFiles.map((tf, idx) => (
            <div
              key={idx}
              className="flex max-w-[200px] items-center gap-[5px] rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-[3px] font-mono text-[11px]"
            >
              <FileText size={11} className="flex-shrink-0 text-[var(--color-text-muted)]" />
              <span
                className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[var(--color-text)]"
                title={tf.name}
              >
                {tf.name}
              </span>
              <button
                onClick={() => setTextFiles((prev) => prev.filter((_, i) => i !== idx))}
                className="ml-0.5 flex-shrink-0 text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-danger)]"
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Attachment thumbnails */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 px-3 pt-2">
          {attachments.map((att, idx) => (
            <div key={idx} className="relative inline-block">
              <img
                src={att.dataUrl}
                alt={att.name}
                className="h-16 w-16 rounded-[var(--radius-sm)] border border-[var(--color-border)] object-cover"
              />
              <button
                onClick={() => removeAttachment(idx)}
                title="Remove"
                className="absolute -right-[6px] -top-[6px] flex h-[18px] w-[18px] cursor-pointer items-center justify-center rounded-full bg-[var(--color-danger)] p-0 text-white"
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input row */}
      <div className="relative flex items-end">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp,text/*,.ts,.tsx,.js,.jsx,.py,.go,.rs,.json,.yaml,.yml,.toml,.md,.sql,.sh,.env"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files).catch(console.error)
            e.target.value = ''
          }}
        />

        {/* Plus button */}
        <div ref={plusMenuRef} className="absolute bottom-[6px] left-[6px]">
          <button
            onClick={() => setPlusMenuOpen((v) => !v)}
            disabled={disabled && !running}
            title="Add files or commands"
            className={cn(
              'flex h-[26px] w-[26px] cursor-pointer items-center justify-center rounded-[6px] transition-colors duration-100 text-[var(--color-text-faint)]',
              plusMenuOpen
                ? 'bg-[var(--color-surface-2)] text-[var(--color-text-muted)]'
                : 'bg-transparent hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-muted)]'
            )}
          >
            <Plus size={14} />
          </button>

          {/* Plus menu dropdown */}
          <AnimatePresence>
            {plusMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.12 }}
                className="absolute bottom-full left-0 z-[100] mb-1 w-[220px] overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[0_-4px_16px_rgba(0,0,0,0.15)]"
              >
                <button
                  onClick={() => { fileInputRef.current?.click(); setPlusMenuOpen(false) }}
                  className="flex w-full cursor-pointer items-center gap-[10px] border-0 bg-transparent px-[14px] py-[10px] text-left transition-colors hover:bg-[var(--color-surface-2)]"
                >
                  <Paperclip size={14} className="flex-shrink-0 text-[var(--color-text-muted)]" />
                  <span className="text-[13px] text-[var(--color-text)]">添加文件或图片</span>
                </button>
                <button
                  onClick={() => {
                    setValue('/')
                    setPlusMenuOpen(false)
                    requestAnimationFrame(() => textareaRef.current?.focus())
                  }}
                  className="flex w-full cursor-pointer items-center gap-[10px] border-0 bg-transparent px-[14px] py-[10px] text-left transition-colors hover:bg-[var(--color-surface-2)]"
                >
                  <Terminal size={14} className="flex-shrink-0 text-[var(--color-text-muted)]" />
                  <span className="text-[13px] text-[var(--color-text)]">斜杠命令</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            const el = e.currentTarget
            el.style.height = 'auto'
            el.style.height = Math.min(el.scrollHeight, 160) + 'px'
          }}
          onKeyDown={handleKeyDown}
          onPaste={(e) => void handlePaste(e)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={dragging ? 'Drop files here…' : running ? 'Claude is working…' : 'Type / for commands'}
          disabled={disabled && !running}
          rows={1}
          className="flex-1 resize-none border-0 bg-transparent py-2 pl-10 pr-10 font-sans text-[13px] leading-[1.55] text-[var(--color-text)] outline-none overflow-hidden min-h-[36px]"
        />

        {/* Send / Stop button */}
        {running ? (
          <button
            onClick={onStop}
            title="Stop (Esc)"
            className="absolute bottom-[6px] right-[6px] flex h-[26px] w-[26px] flex-shrink-0 cursor-pointer items-center justify-center rounded-[6px] bg-[var(--color-danger)] text-white transition-opacity hover:opacity-80"
          >
            <Square size={10} fill="currentColor" />
          </button>
        ) : (
          <button
            onClick={submit}
            disabled={!canSend}
            title="Send (Enter)"
            className={cn(
              'absolute bottom-[6px] right-[6px] flex h-[26px] w-[26px] flex-shrink-0 items-center justify-center rounded-[6px] transition-colors duration-150',
              canSend
                ? 'cursor-pointer bg-[var(--color-accent)] text-white hover:opacity-90'
                : 'cursor-default bg-[var(--color-surface-2)] text-[var(--color-text-faint)]'
            )}
          >
            <CornerDownLeft size={13} />
          </button>
        )}
      </div>
    </motion.div>
  )
}
