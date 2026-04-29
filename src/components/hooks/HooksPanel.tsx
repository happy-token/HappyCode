import React, { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronUp, X, Check, Plus, Zap } from 'lucide-react'
import type { HookEvent, ClaudeSettings, ClaudeHookRule, HookType, HookBridgeStatus } from '../../../electron/shared/types'
import { HookRuleWizard } from './HookRuleWizard'
import { cn } from '@renderer/lib/utils'

const HOOK_TYPES: HookType[] = [
  'PreToolUse', 'PostToolUse', 'PostToolUseFailure',
  'UserPromptSubmit', 'Stop',
  'SubagentStart', 'SubagentStop',
  'SessionStart', 'SessionEnd',
  'Notification', 'PreCompact',
]

const HOOK_TYPE_COLOR: Record<string, string> = {
  PreToolUse:         '#7c6af7',
  PostToolUse:        '#3dd68c',
  PostToolUseFailure: 'var(--color-danger)',
  UserPromptSubmit:   '#a78bfa',
  Stop:               '#f59e0b',
  SubagentStart:      '#34d399',
  SubagentStop:       '#6ee7b7',
  SessionStart:       '#60a5fa',
  SessionEnd:         '#93c5fd',
  Notification:       '#f472b6',
  PreCompact:         '#fb923c',
}

function hookColor(type: string): string {
  return HOOK_TYPE_COLOR[type] ?? '#7a7a8a'
}

function formatTs(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function JsonBlock({ json, label }: { json: string; label: string }): React.JSX.Element {
  const [expanded, setExpanded] = useState(false)
  let pretty = json
  try {
    pretty = JSON.stringify(JSON.parse(json), null, 2)
  } catch { /* keep raw */ }

  return (
    <div className="mt-1">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="text-[10px] text-[var(--color-text-muted)] bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-[var(--radius-sm)] px-2 py-px"
      >
        <span className="inline-flex items-center gap-[3px]">{label} {expanded ? <ChevronUp size={9} /> : <ChevronDown size={9} />}</span>
      </button>
      {expanded && (
        <pre className="mt-1 px-2.5 py-1.5 bg-[var(--color-surface-2)] rounded-[var(--radius-sm)] font-mono text-[11px] text-[var(--color-text-muted)] whitespace-pre-wrap break-all max-h-[200px] overflow-auto">
          {pretty}
        </pre>
      )}
    </div>
  )
}

function HookRow({ event }: { event: HookEvent }): React.JSX.Element {
  const color = hookColor(event.hook_type)
  return (
    <div className="px-4 py-2.5 border-b border-[var(--color-border)] flex flex-col gap-1">
      <div className="flex items-center gap-2.5">
        <span
          className="text-[10px] font-bold rounded-[var(--radius-sm)] px-2 py-px flex-shrink-0"
          style={{ color, background: `${color}22` }}
        >
          {event.hook_type}
        </span>
        {event.tool_name && (
          <span className="font-mono text-[12px] text-[var(--color-text)] font-semibold">
            {event.tool_name}
          </span>
        )}
        <span className="ml-auto text-[11px] text-[var(--color-text-muted)] flex-shrink-0">
          {formatTs(event.ts)}
        </span>
        {event.exit_code !== undefined && event.exit_code !== null && (
          <span className={cn('text-[10px] flex-shrink-0', event.exit_code === 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]')}>
            exit {event.exit_code}
          </span>
        )}
      </div>
      {event.cwd && (
        <div className="font-mono text-[10px] text-[var(--color-text-muted)] overflow-hidden text-ellipsis whitespace-nowrap">
          {event.cwd}
        </div>
      )}
      {event.input_json && <JsonBlock json={event.input_json} label="input" />}
      {event.output_json && <JsonBlock json={event.output_json} label="output" />}
    </div>
  )
}

function normalizeRules(raw: ClaudeHookRule[] | undefined): ClaudeHookRule[] {
  if (!Array.isArray(raw)) return []
  return (raw as unknown[]).flatMap((entry): ClaudeHookRule[] => {
    if (!entry || typeof entry !== 'object') return []
    const obj = entry as Record<string, unknown>
    const matcher = String(obj['matcher'] ?? '')
    if (typeof obj['command'] === 'string') {
      return [{ matcher, command: obj['command'], description: obj['description'] as string | undefined }]
    }
    // Nested format: {matcher, hooks: [{type:'command', command:'...'}]}
    if (Array.isArray(obj['hooks'])) {
      return (obj['hooks'] as unknown[]).flatMap((h): ClaudeHookRule[] => {
        if (!h || typeof h !== 'object') return []
        const hObj = h as Record<string, unknown>
        if (typeof hObj['command'] === 'string') {
          return [{ matcher, command: hObj['command'], description: hObj['description'] as string | undefined }]
        }
        return []
      })
    }
    return []
  })
}

function ConfigTab(): React.JSX.Element {
  const [settings, setSettings] = useState<ClaudeSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showWizard, setShowWizard] = useState(false)

  useEffect(() => {
    const doLoad = async (): Promise<void> => {
      try {
        const s = await window.electron.getClaudeSettings()
        const normalized: ClaudeSettings = {
          ...s,
          hooks: s.hooks
            ? (Object.fromEntries(
                HOOK_TYPES.map((t) => [t, normalizeRules(s.hooks?.[t])])
              ) as ClaudeSettings['hooks'])
            : undefined,
        }
        setSettings(normalized)
      } catch (e: unknown) {
        setError(String(e))
      } finally {
        setLoading(false)
      }
    }
    void doLoad()
  }, [])

  function getRules(type: HookType): ClaudeHookRule[] {
    return settings?.hooks?.[type] ?? []
  }

  function setRules(type: HookType, rules: ClaudeHookRule[]): void {
    setSettings((prev) => ({
      ...prev,
      hooks: {
        ...prev?.hooks,
        [type]: rules,
      },
    }))
  }

  function deleteRule(type: HookType, index: number): void {
    const rules = [...getRules(type)]
    rules.splice(index, 1)
    setRules(type, rules)
  }

  function addRule(hookType: HookType, rule: ClaudeHookRule): void {
    setRules(hookType, [...getRules(hookType), rule])
    setShowWizard(false)
  }

  async function save(): Promise<void> {
    if (!settings) return
    setSaving(true)
    try {
      await window.electron.saveClaudeSettings(settings)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e: unknown) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-6 text-[var(--color-text-muted)] text-[13px]">Loading…</div>
  if (error) return <div className="p-6 text-[var(--color-danger,var(--color-danger))] text-[13px]">{error}</div>

  const totalRules = HOOK_TYPES.reduce((n, t) => n + getRules(t).length, 0)

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3">
      {totalRules === 0 && (
        <div className="mb-4 px-3 py-2 bg-[var(--color-accent-dim)] rounded-[var(--radius-sm)] text-[11px] text-[var(--color-accent)]">
          No hooks configured. Add rules below and click Save — they'll be written to <code className="font-mono">~/.claude/settings.json</code>.
        </div>
      )}

      {HOOK_TYPES.map((type) => {
        const rules = getRules(type)
        const color = hookColor(type)
        return (
          <div key={type} className="mb-5">
            <div className="flex items-center gap-2 mb-2">
              <span
                className="text-[10px] font-bold rounded-[var(--radius-sm)] px-2 py-px"
                style={{ color, background: `${color}22` }}
              >
                {type}
              </span>
              <span className="text-[11px] text-[var(--color-text-muted)]">
                {rules.length} rule{rules.length !== 1 ? 's' : ''}
              </span>
            </div>
            {rules.length === 0 ? (
              <div className="text-[11px] text-[var(--color-text-muted)] py-px italic">No rules</div>
            ) : (
              rules.map((rule, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 px-2.5 py-1.5 mb-1 bg-[var(--color-surface-2)] rounded-[var(--radius-sm)] border border-[var(--color-border)]"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-[11px] text-[var(--color-text)] mb-0.5">
                      <span className="text-[var(--color-text-muted)]">matcher: </span>{rule.matcher}
                    </div>
                    <div className="font-mono text-[11px] text-[var(--color-text)] break-all">
                      <span className="text-[var(--color-text-muted)]">cmd: </span>{rule.command}
                    </div>
                    {rule.description && (
                      <div className="text-[10px] text-[var(--color-text-muted)] mt-0.5">{rule.description}</div>
                    )}
                  </div>
                  <button
                    onClick={() => deleteRule(type, i)}
                    className="flex flex-shrink-0 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--color-border)] px-1.5 py-px text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-danger)] hover:text-[var(--color-danger)]"
                    title="Delete rule"
                  >
                    <X size={10} />
                  </button>
                </div>
              ))
            )}
          </div>
        )
      })}

      {/* Add rule */}
      <div className="border-t border-[var(--color-border)] pt-3.5 mt-1">
        {showWizard ? (
          <HookRuleWizard
            onSave={addRule}
            onCancel={() => setShowWizard(false)}
          />
        ) : (
          <button
            onClick={() => setShowWizard(true)}
            className="text-[11px] px-4 py-1.5 border border-[var(--color-accent)] rounded-[var(--radius-md)] bg-[var(--color-accent-dim)] text-[var(--color-accent)] cursor-pointer font-semibold"
          >
          <Plus size={12} className="inline mr-0.5" />{t('hooks.addRule')}
          </button>
        )}
      </div>

      {/* Save */}
      <div className="mt-4 pt-3 border-t border-[var(--color-border)] flex justify-end">
        <button
          onClick={() => void save()}
          disabled={saving}
          className={cn(
            'text-[11px] px-[18px] py-[5px] border border-[var(--color-accent)] rounded-[var(--radius-sm)] text-white',
            saved ? 'bg-[var(--color-success)]' : 'bg-[var(--color-accent)]',
            saving ? 'cursor-default' : 'cursor-pointer',
          )}
        >
          {saving ? 'Saving…' : saved ? <span className="inline-flex items-center gap-1"><Check size={11} />Saved</span> : 'Save to settings.json'}
        </button>
      </div>
    </div>
  )
}

export function HooksPanel(): React.JSX.Element {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<'events' | 'config'>('events')
  const [events, setEvents] = useState<HookEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [bridgeStatus, setBridgeStatus] = useState<HookBridgeStatus | null>(null)

  const load = useCallback(async () => {
    try {
      const result = await window.electron.listHookEvents()
      setEvents(result.events)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    void window.electron.getBridgeStatus().then(setBridgeStatus)

    const unsub = window.electron.onHookEvent((event) => {
      setEvents((prev) => [event, ...prev].slice(0, 500))
    })
    return unsub
  }, [load])

  async function handleEnableBridge(): Promise<void> {
    const status = await window.electron.injectBridge()
    setBridgeStatus(status)
  }

  async function handleClear(): Promise<void> {
    await window.electron.clearHookEvents()
    setEvents([])
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--color-border)] bg-[var(--color-surface)] flex-shrink-0">
        <button
          onClick={() => setActiveTab('events')}
          className={cn(
            'px-3 py-[3px] text-[11px] rounded-[var(--radius-sm)] border transition-colors',
            activeTab === 'events'
              ? 'font-bold text-[var(--color-accent)] bg-[var(--color-accent-dim)] border-[var(--color-accent)]'
              : 'font-normal text-[var(--color-text-muted)] bg-transparent border-transparent',
          )}
        >
          Events
        </button>
        <button
          onClick={() => setActiveTab('config')}
          className={cn(
            'px-3 py-[3px] text-[11px] rounded-[var(--radius-sm)] border transition-colors',
            activeTab === 'config'
              ? 'font-bold text-[var(--color-accent)] bg-[var(--color-accent-dim)] border-[var(--color-accent)]'
              : 'font-normal text-[var(--color-text-muted)] bg-transparent border-transparent',
          )}
        >
          Config
        </button>

        {activeTab === 'events' && (
          <>
            <span className="text-[10px] text-[var(--color-accent)] bg-[var(--color-accent-dim)] rounded-[var(--radius-sm)] px-2 py-px">
              {events.length}
            </span>
            <div className="flex-1" />

            {/* Bridge status indicator */}
            {bridgeStatus !== null && (
              <div className="flex items-center gap-1.5">
                <span
                  className={cn(
                    'w-1.5 h-1.5 rounded-full flex-shrink-0',
                    bridgeStatus.injected ? 'bg-[var(--color-success,var(--color-success))]' : 'bg-[var(--color-text-faint,#888)]',
                  )}
                />
                <span
                  className={cn(
                    'text-[10px]',
                    bridgeStatus.injected ? 'text-[var(--color-success,var(--color-success))]' : 'text-[var(--color-text-faint,#888)]',
                  )}
                >
                  {bridgeStatus.injected ? t('hooks.bridgeConnected') : t('hooks.notConnected')}
                </span>
                {!bridgeStatus.injected && (
                  <button
                    onClick={() => void handleEnableBridge()}
                    className="text-[10px] text-[var(--color-accent)] bg-transparent border border-[var(--color-accent)] rounded-[var(--radius-sm)] px-1.5 py-px cursor-pointer"
                  >
                    {t('hooks.enable')}
                  </button>
                )}
              </div>
            )}

            <button
              onClick={() => void handleClear()}
              className="text-[11px] text-[var(--color-text-muted)] px-2.5 py-[3px] border border-[var(--color-border)] rounded-[var(--radius-sm)] cursor-pointer"
            >
              {t('hooks.clear')}
            </button>
            <button
              onClick={() => void load()}
              className="text-[11px] text-[var(--color-text-muted)] px-2.5 py-[3px] border border-[var(--color-border)] rounded-[var(--radius-sm)] cursor-pointer"
            >
              ↺ Refresh
            </button>
          </>
        )}
        {activeTab === 'config' && <div className="flex-1" />}
      </div>

      {activeTab === 'events' ? (
        <>
          {/* Config hint */}
          <div className="px-4 py-2 bg-[var(--color-accent-dim)] border-b border-[var(--color-border)] text-[11px] text-[var(--color-accent)] flex items-center gap-2 flex-shrink-0">
            <span>Hook server listening on</span>
            <code className="font-mono">http://127.0.0.1:37421/hook</code>
            <span className="text-[var(--color-text-muted)] ml-1">
              Manage rules in the{' '}
              <button
                onClick={() => setActiveTab('config')}
                className="text-[var(--color-accent)] underline bg-transparent border-none cursor-pointer text-[11px] p-0"
              >
                Config tab
              </button>
            </span>
          </div>

          {/* Event list */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-6 text-[var(--color-text-muted)] text-[13px]">Loading…</div>
            ) : events.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center gap-2.5 text-[var(--color-text-muted)]">
                <Zap size={28} className="text-[var(--color-text-faint)]" />
                <div className="text-[14px] font-semibold text-[var(--color-text)]">
                  No hook events yet
                </div>
                <div className="text-[12px] text-center max-w-[360px]">
                  Configure Claude Code hooks to POST to{' '}
                  <code className="font-mono text-[var(--color-accent)]">
                    http://127.0.0.1:37421/hook
                  </code>
                </div>
              </div>
            ) : (
              events.map((e) => <HookRow key={e.id} event={e} />)
            )}
          </div>
        </>
      ) : (
        <ConfigTab />
      )}
    </div>
  )
}
