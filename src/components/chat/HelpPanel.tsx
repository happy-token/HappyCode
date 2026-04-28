import React, { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import type { CustomCommand } from '../../../electron/shared/types'
import { cn } from '@renderer/lib/utils'

type Tab = 'general' | 'commands' | 'custom-commands'
const TABS: Tab[] = ['general', 'commands', 'custom-commands']

interface ShortcutRow {
  key: string
  desc: string
}

const COL1: ShortcutRow[] = [
  { key: '!', desc: 'for bash mode' },
  { key: '/', desc: 'for commands' },
  { key: '@', desc: 'for file paths' },
  { key: '&', desc: 'for background' },
  { key: '/btw', desc: 'for side question' },
]

const COL2: ShortcutRow[] = [
  { key: 'double tap esc', desc: 'to clear input' },
  { key: 'shift + tab', desc: 'to auto-accept edits' },
  { key: 'ctrl + o', desc: 'for verbose output' },
  { key: 'ctrl + t', desc: 'to toggle tasks' },
  { key: 'shift + ↵', desc: 'for newline' },
]

const COL3: ShortcutRow[] = [
  { key: 'ctrl + shift + _', desc: 'to undo' },
  { key: 'ctrl + z', desc: 'to suspend' },
  { key: 'ctrl + v', desc: 'to paste images' },
  { key: 'alt + p', desc: 'to switch model' },
  { key: 'ctrl + s', desc: 'to stash prompt' },
  { key: 'ctrl + g', desc: 'to edit in $EDITOR' },
  { key: '/keybindings', desc: 'to customize' },
]

const COMMANDS = [
  { name: '/add-dir', desc: 'Add additional working directories to Claude' },
  { name: '/bug', desc: 'Report a bug or issue with Claude Code' },
  { name: '/clear', desc: 'Clear conversation history and free up context' },
  { name: '/compact', desc: 'Compact context — clears history but keeps a summary' },
  { name: '/config', desc: 'Open the configuration panel' },
  { name: '/cost', desc: 'Show total cost and duration of the current session' },
  { name: '/doctor', desc: 'Check the health of your Claude Code installation' },
  { name: '/help', desc: 'Show help and available commands' },
  { name: '/init', desc: 'Initialize your project with a CLAUDE.md file' },
  { name: '/login', desc: 'Switch Anthropic accounts' },
  { name: '/logout', desc: 'Sign out from your Anthropic account' },
  { name: '/memory', desc: 'Edit CLAUDE.md memory files' },
  { name: '/model', desc: 'Set the AI model to use' },
  { name: '/permissions', desc: 'View and update tool permissions' },
  { name: '/powerup', desc: 'Learn the features most people miss' },
  { name: '/review', desc: 'Review a pull request' },
  { name: '/status', desc: 'View account and system status' },
  { name: '/terminal-setup', desc: 'Install Shift+Enter key binding for terminal' },
  { name: '/vim', desc: 'Enter vim mode' },
]

function KeyChip({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <span className="font-mono text-[11px] text-[var(--color-accent)] bg-[var(--color-accent-dim)] border border-[var(--color-accent)] rounded-[3px] px-[5px] py-px whitespace-nowrap flex-shrink-0">
      {children}
    </span>
  )
}

function ShortcutCol({ rows }: { rows: ShortcutRow[] }): React.JSX.Element {
  return (
    <div className="flex flex-col gap-[5px]">
      {rows.map((r) => (
        <div key={r.key} className="flex items-center gap-1.5 whitespace-nowrap">
          <KeyChip>{r.key}</KeyChip>
          <span className="font-mono text-[11px] text-[var(--color-text-muted)]">{r.desc}</span>
        </div>
      ))}
    </div>
  )
}

function GeneralTab(): React.JSX.Element {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="font-mono text-[12px] text-[var(--color-text)] leading-relaxed m-0">
          Claude understands your codebase, makes edits with your permission, and executes commands — right from your terminal.
        </p>
        <p className="font-mono text-[11px] text-[var(--color-text-muted)] leading-relaxed mt-2.5 mb-0">
          New here? Run <KeyChip>/powerup</KeyChip> to learn the features most people miss.
        </p>
      </div>

      <div>
        <div className="font-mono text-[11px] font-bold text-[var(--color-text)] mb-2.5">
          Shortcuts
        </div>
        <div className="grid grid-cols-3 gap-x-6 gap-y-2 items-start">
          <ShortcutCol rows={COL1} />
          <ShortcutCol rows={COL2} />
          <ShortcutCol rows={COL3} />
        </div>
      </div>
    </div>
  )
}

function CommandsTab(): React.JSX.Element {
  return (
    <div className="flex flex-col gap-0.5">
      {COMMANDS.map((cmd) => (
        <div
          key={cmd.name}
          className="flex items-baseline gap-4 px-2 py-[5px] rounded-[4px] transition-colors hover:bg-[var(--color-surface-2)]"
        >
          <span className="font-mono text-[12px] font-semibold text-[var(--color-accent)] min-w-[160px] flex-shrink-0">
            {cmd.name}
          </span>
          <span className="font-mono text-[11px] text-[var(--color-text-muted)]">
            {cmd.desc}
          </span>
        </div>
      ))}
    </div>
  )
}

function CommandGroup({ title, items }: { title: string; items: CustomCommand[] }): React.JSX.Element {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="font-mono text-[10px] font-bold text-[var(--color-text-muted)] tracking-[0.06em] uppercase px-2 py-1">
        {title}
      </div>
      {items.map((cmd) => (
        <div
          key={cmd.filePath}
          className="flex items-baseline gap-4 px-2 py-[5px] rounded-[4px] transition-colors hover:bg-[var(--color-surface-2)]"
        >
          <span className="font-mono text-[12px] font-semibold text-[var(--color-accent)] min-w-[160px] flex-shrink-0">
            /{cmd.name}
          </span>
          <span className="font-mono text-[11px] text-[var(--color-text-muted)] overflow-hidden text-ellipsis whitespace-nowrap">
            {cmd.description || '(no description)'}
          </span>
        </div>
      ))}
    </div>
  )
}

function CustomCommandsTab({ commands, loading }: { commands: CustomCommand[]; loading: boolean }): React.JSX.Element {
  const personal = commands.filter((c) => c.source === 'personal')
  const project = commands.filter((c) => c.source === 'project')

  if (loading) {
    return (
      <div className="font-mono text-[12px] text-[var(--color-text-muted)] py-5">
        Loading custom commands…
      </div>
    )
  }

  if (commands.length === 0) {
    return (
      <div className="flex flex-col gap-3.5">
        <p className="font-mono text-[12px] text-[var(--color-text-muted)] leading-relaxed m-0">
          No custom commands found. Create <KeyChip>.md</KeyChip> files in:
        </p>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <KeyChip>~/.claude/commands/</KeyChip>
            <span className="font-mono text-[11px] text-[var(--color-text-muted)]">personal (all projects)</span>
          </div>
          <div className="flex items-center gap-2">
            <KeyChip>.claude/commands/</KeyChip>
            <span className="font-mono text-[11px] text-[var(--color-text-muted)]">project (checked into repo)</span>
          </div>
        </div>
        <div className="font-mono text-[11px] text-[var(--color-text)] bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-[6px] px-3.5 py-2.5 leading-[1.7]">
          <div><span className="text-[var(--color-text-muted)]"># ~/.claude/commands/</span><span className="text-[var(--color-accent)]">deploy.md</span></div>
          <div className="text-[var(--color-text-muted)] mt-1.5">Describe the command here.</div>
          <div className="text-[var(--color-text-muted)]">Use {'$ARGUMENTS'} to inject user input.</div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {personal.length > 0 && <CommandGroup title="Personal (~/.claude/commands)" items={personal} />}
      {project.length > 0 && <CommandGroup title="Project (.claude/commands)" items={project} />}
    </div>
  )
}

interface Props {
  onClose: () => void
  cwd?: string
}

export function HelpPanel({ onClose, cwd }: Props): React.JSX.Element {
  const [tab, setTab] = useState<Tab>('general')
  const [customCommands, setCustomCommands] = useState<CustomCommand[]>([])
  const [loadingCommands, setLoadingCommands] = useState(false)

  useEffect(() => {
    if (typeof window.electron?.listCustomCommands !== 'function') return
    setLoadingCommands(true)
    window.electron.listCustomCommands(cwd ?? '')
      .then((result) => { setCustomCommands(result.commands) })
      .catch(() => { setCustomCommands([]) })
      .finally(() => { setLoadingCommands(false) })
  }, [cwd])

  const switchTab = useCallback((direction: 1 | -1) => {
    setTab((current) => {
      const idx = TABS.indexOf(current)
      const next = (idx + direction + TABS.length) % TABS.length
      return TABS[next]
    })
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); switchTab(-1) }
      if (e.key === 'ArrowRight') { e.preventDefault(); switchTab(1) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [switchTab])

  return createPortal(
    <div
      className="fixed inset-0 bg-[rgba(0,0,0,0.55)] flex items-center justify-center z-[9999]"
      onClick={onClose}
    >
      <div
        className="w-[min(780px,92vw)] max-h-[80vh] flex flex-col bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] shadow-[0_16px_48px_rgba(0,0,0,0.5)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-3 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="font-mono text-[13px] font-bold text-[var(--color-accent)]">
              Claude Code
            </span>
            <div className="flex gap-1">
              {(['general', 'commands', 'custom-commands'] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={cn(
                    'font-mono text-[12px] px-3 py-1 border-none rounded-[4px] cursor-pointer transition-[background,color]',
                    tab === t
                      ? 'bg-[var(--color-accent)] text-white font-bold'
                      : 'bg-transparent text-[var(--color-text-muted)] font-normal',
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex cursor-pointer items-center border-none bg-transparent px-1.5 py-px text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
            title="Close (Esc)"
          >
            <X size={14} />
          </button>
        </div>

        {/* Tab line */}
        <div className="border-b border-[var(--color-border)] mt-2.5 flex-shrink-0" />

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-[18px]">
          {tab === 'general' && <GeneralTab />}
          {tab === 'commands' && <CommandsTab />}
          {tab === 'custom-commands' && <CustomCommandsTab commands={customCommands} loading={loadingCommands} />}
        </div>

        {/* Footer */}
        <div className="font-mono text-[10px] text-[var(--color-text-muted)] px-5 py-2 border-t border-[var(--color-border)] flex-shrink-0">
          press <KeyChip>esc</KeyChip> to close · <KeyChip>←</KeyChip><KeyChip>→</KeyChip> to switch tabs
        </div>
      </div>
    </div>,
    document.body
  )
}
