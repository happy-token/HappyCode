import React, { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import type { CustomCommand } from '../../../electron/shared/types'

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

const mono: React.CSSProperties = { fontFamily: 'var(--font-mono)' }

function KeyChip({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <span
      style={{
        ...mono,
        fontSize: 11,
        color: 'var(--color-accent)',
        background: 'var(--color-accent-dim)',
        border: '1px solid var(--color-accent)',
        borderRadius: 3,
        padding: '1px 5px',
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      {children}
    </span>
  )
}

function ShortcutCol({ rows }: { rows: ShortcutRow[] }): React.JSX.Element {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {rows.map((r) => (
        <div key={r.key} style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
          <KeyChip>{r.key}</KeyChip>
          <span style={{ ...mono, fontSize: 11, color: 'var(--color-text-muted)' }}>{r.desc}</span>
        </div>
      ))}
    </div>
  )
}

function GeneralTab(): React.JSX.Element {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <p style={{ ...mono, fontSize: 12, color: 'var(--color-text)', lineHeight: 1.6, margin: 0 }}>
          Claude understands your codebase, makes edits with your permission, and executes commands — right from your terminal.
        </p>
        <p style={{ ...mono, fontSize: 11, color: 'var(--color-text-muted)', lineHeight: 1.6, margin: '10px 0 0' }}>
          New here? Run <KeyChip>/powerup</KeyChip> to learn the features most people miss.
        </p>
      </div>

      <div>
        <div style={{ ...mono, fontSize: 11, fontWeight: 700, color: 'var(--color-text)', marginBottom: 10 }}>
          Shortcuts
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px 24px', alignItems: 'start' }}>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {COMMANDS.map((cmd) => (
        <div
          key={cmd.name}
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 16,
            padding: '5px 8px',
            borderRadius: 4,
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'var(--color-surface-2)' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
        >
          <span style={{ ...mono, fontSize: 12, fontWeight: 600, color: 'var(--color-accent)', minWidth: 160, flexShrink: 0 }}>
            {cmd.name}
          </span>
          <span style={{ ...mono, fontSize: 11, color: 'var(--color-text-muted)' }}>
            {cmd.desc}
          </span>
        </div>
      ))}
    </div>
  )
}

function CommandGroup({ title, items }: { title: string; items: CustomCommand[] }): React.JSX.Element {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <div style={{ ...mono, fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', padding: '4px 8px' }}>
        {title}
      </div>
      {items.map((cmd) => (
        <div
          key={cmd.filePath}
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 16,
            padding: '5px 8px',
            borderRadius: 4,
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'var(--color-surface-2)' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
        >
          <span style={{ ...mono, fontSize: 12, fontWeight: 600, color: 'var(--color-accent)', minWidth: 160, flexShrink: 0 }}>
            /{cmd.name}
          </span>
          <span style={{ ...mono, fontSize: 11, color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
      <div style={{ ...mono, fontSize: 12, color: 'var(--color-text-muted)', padding: '20px 0' }}>
        Loading custom commands…
      </div>
    )
  }

  if (commands.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <p style={{ ...mono, fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.6, margin: 0 }}>
          No custom commands found. Create <KeyChip>.md</KeyChip> files in:
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <KeyChip>~/.claude/commands/</KeyChip>
            <span style={{ ...mono, fontSize: 11, color: 'var(--color-text-muted)' }}>personal (all projects)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <KeyChip>.claude/commands/</KeyChip>
            <span style={{ ...mono, fontSize: 11, color: 'var(--color-text-muted)' }}>project (checked into repo)</span>
          </div>
        </div>
        <div
          style={{
            ...mono,
            fontSize: 11,
            color: 'var(--color-text)',
            background: 'var(--color-surface-2)',
            border: '1px solid var(--color-border)',
            borderRadius: 6,
            padding: '10px 14px',
            lineHeight: 1.7,
          }}
        >
          <div><span style={{ color: 'var(--color-text-muted)' }}># ~/.claude/commands/</span><span style={{ color: 'var(--color-accent)' }}>deploy.md</span></div>
          <div style={{ color: 'var(--color-text-muted)', marginTop: 6 }}>Describe the command here.</div>
          <div style={{ color: 'var(--color-text-muted)' }}>Use {'$ARGUMENTS'} to inject user input.</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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

  const tabStyle = (t: Tab): React.CSSProperties => ({
    ...mono,
    fontSize: 12,
    padding: '4px 12px',
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
    background: tab === t ? 'var(--color-accent)' : 'transparent',
    color: tab === t ? '#fff' : 'var(--color-text-muted)',
    fontWeight: tab === t ? 700 : 400,
    transition: 'background 0.12s, color 0.12s',
  })

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 'min(780px, 92vw)',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px 0',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ ...mono, fontSize: 13, fontWeight: 700, color: 'var(--color-accent)' }}>
              Claude Code
            </span>
            <div style={{ display: 'flex', gap: 4 }}>
              {(['general', 'commands', 'custom-commands'] as Tab[]).map((t) => (
                <button key={t} style={tabStyle(t)} onClick={() => setTab(t)}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              ...mono,
              fontSize: 14,
              color: 'var(--color-text-muted)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '2px 6px',
              lineHeight: 1,
            }}
            title="Close (Esc)"
          >
            ✕
          </button>
        </div>

        {/* Tab line */}
        <div style={{ borderBottom: '1px solid var(--color-border)', marginTop: 10, flexShrink: 0 }} />

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px' }}>
          {tab === 'general' && <GeneralTab />}
          {tab === 'commands' && <CommandsTab />}
          {tab === 'custom-commands' && <CustomCommandsTab commands={customCommands} loading={loadingCommands} />}
        </div>

        {/* Footer */}
        <div
          style={{
            ...mono,
            fontSize: 10,
            color: 'var(--color-text-muted)',
            padding: '8px 20px',
            borderTop: '1px solid var(--color-border)',
            flexShrink: 0,
          }}
        >
          press <KeyChip>esc</KeyChip> to close · <KeyChip>←</KeyChip><KeyChip>→</KeyChip> to switch tabs
        </div>
      </div>
    </div>,
    document.body
  )
}
