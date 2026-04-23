import React, { useEffect, useState, useCallback } from 'react'
import type { HookEvent, ClaudeSettings, ClaudeHookRule, HookType } from '../../../electron/shared/types'

const HOOK_TYPES: HookType[] = ['PreToolUse', 'PostToolUse', 'Stop', 'Notification']

const HOOK_TYPE_COLOR: Record<string, string> = {
  PreToolUse: '#7c6af7',
  PostToolUse: '#3dd68c',
  Stop: '#f59e0b',
  Notification: '#60a5fa',
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
    <div style={{ marginTop: 4 }}>
      <button
        onClick={() => setExpanded((v) => !v)}
        style={{
          fontSize: 10,
          color: 'var(--color-text-muted)',
          background: 'var(--color-surface-2)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-sm)',
          padding: '1px 8px',
        }}
      >
        {label} {expanded ? '▲' : '▼'}
      </button>
      {expanded && (
        <pre
          style={{
            marginTop: 4,
            padding: '6px 10px',
            background: 'var(--color-surface-2)',
            borderRadius: 'var(--radius-sm)',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--color-text-muted)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
            maxHeight: 200,
            overflow: 'auto',
          }}
        >
          {pretty}
        </pre>
      )}
    </div>
  )
}

function HookRow({ event }: { event: HookEvent }): React.JSX.Element {
  const color = hookColor(event.hook_type)
  return (
    <div
      style={{
        padding: '10px 16px',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            color,
            background: `${color}22`,
            borderRadius: 'var(--radius-sm)',
            padding: '2px 8px',
            flexShrink: 0,
          }}
        >
          {event.hook_type}
        </span>
        {event.tool_name && (
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              color: 'var(--color-text)',
              fontWeight: 600,
            }}
          >
            {event.tool_name}
          </span>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--color-text-muted)', flexShrink: 0 }}>
          {formatTs(event.ts)}
        </span>
        {event.exit_code !== undefined && event.exit_code !== null && (
          <span
            style={{
              fontSize: 10,
              color: event.exit_code === 0 ? 'var(--color-success)' : 'var(--color-danger)',
              flexShrink: 0,
            }}
          >
            exit {event.exit_code}
          </span>
        )}
      </div>
      {event.cwd && (
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: 'var(--color-text-muted)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {event.cwd}
        </div>
      )}
      {event.input_json && <JsonBlock json={event.input_json} label="input" />}
      {event.output_json && <JsonBlock json={event.output_json} label="output" />}
    </div>
  )
}

const inputSt: React.CSSProperties = {
  width: '100%',
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  padding: '4px 6px',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--color-surface-2)',
  color: 'var(--color-text)',
  boxSizing: 'border-box',
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

  const [newType, setNewType] = useState<HookType>('PostToolUse')
  const [newMatcher, setNewMatcher] = useState('')
  const [newCommand, setNewCommand] = useState('')
  const [newDescription, setNewDescription] = useState('')

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

  function addRule(): void {
    if (!newMatcher.trim() || !newCommand.trim()) return
    const rule: ClaudeHookRule = {
      matcher: newMatcher.trim(),
      command: newCommand.trim(),
      ...(newDescription.trim() ? { description: newDescription.trim() } : {}),
    }
    setRules(newType, [...getRules(newType), rule])
    setNewMatcher('')
    setNewCommand('')
    setNewDescription('')
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

  if (loading) return <div style={{ padding: 24, color: 'var(--color-text-muted)', fontSize: 13 }}>Loading…</div>
  if (error) return <div style={{ padding: 24, color: 'var(--color-danger, #ef4444)', fontSize: 13 }}>{error}</div>

  const totalRules = HOOK_TYPES.reduce((n, t) => n + getRules(t).length, 0)

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
      {totalRules === 0 && (
        <div style={{ marginBottom: 16, padding: '8px 12px', background: 'var(--color-accent-dim)', borderRadius: 'var(--radius-sm)', fontSize: 11, color: 'var(--color-accent)' }}>
          No hooks configured. Add rules below and click Save — they'll be written to <code style={{ fontFamily: 'var(--font-mono)' }}>~/.claude/settings.json</code>.
        </div>
      )}

      {HOOK_TYPES.map((type) => {
        const rules = getRules(type)
        const color = hookColor(type)
        return (
          <div key={type} style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color, background: `${color}22`, borderRadius: 'var(--radius-sm)', padding: '2px 8px' }}>
                {type}
              </span>
              <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                {rules.length} rule{rules.length !== 1 ? 's' : ''}
              </span>
            </div>
            {rules.length === 0 ? (
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', padding: '2px 0', fontStyle: 'italic' }}>No rules</div>
            ) : (
              rules.map((rule, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8,
                    padding: '6px 10px',
                    marginBottom: 4,
                    background: 'var(--color-surface-2)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-text)', marginBottom: 2 }}>
                      <span style={{ color: 'var(--color-text-muted)' }}>matcher: </span>{rule.matcher}
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-text)', wordBreak: 'break-all' }}>
                      <span style={{ color: 'var(--color-text-muted)' }}>cmd: </span>{rule.command}
                    </div>
                    {rule.description && (
                      <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 2 }}>{rule.description}</div>
                    )}
                  </div>
                  <button
                    onClick={() => deleteRule(type, i)}
                    style={{
                      fontSize: 11,
                      color: 'var(--color-danger, #ef4444)',
                      padding: '1px 6px',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-sm)',
                      flexShrink: 0,
                    }}
                    title="Delete rule"
                  >
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>
        )
      })}

      {/* Add rule form */}
      <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 14, marginTop: 4 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
          Add Rule
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
          <label style={{ display: 'block' }}>
            <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginBottom: 3 }}>Hook Type</div>
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value as HookType)}
              style={inputSt}
            >
              {HOOK_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label style={{ display: 'block' }}>
            <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginBottom: 3 }}>Matcher (tool name or pattern)</div>
            <input
              value={newMatcher}
              onChange={(e) => setNewMatcher(e.target.value)}
              placeholder="e.g. Write|Edit"
              style={inputSt}
            />
          </label>
        </div>
        <label style={{ display: 'block', marginBottom: 8 }}>
          <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginBottom: 3 }}>Command</div>
          <input
            value={newCommand}
            onChange={(e) => setNewCommand(e.target.value)}
            placeholder='e.g. pnpm prettier --write "$FILE_PATH"'
            style={inputSt}
          />
        </label>
        <label style={{ display: 'block', marginBottom: 10 }}>
          <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginBottom: 3 }}>Description (optional)</div>
          <input
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            placeholder="e.g. Format edited files"
            style={inputSt}
          />
        </label>
        <button
          onClick={addRule}
          disabled={!newMatcher.trim() || !newCommand.trim()}
          style={{
            fontSize: 11,
            padding: '4px 14px',
            border: '1px solid var(--color-accent)',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--color-accent-dim)',
            color: 'var(--color-accent)',
            cursor: !newMatcher.trim() || !newCommand.trim() ? 'default' : 'pointer',
            opacity: !newMatcher.trim() || !newCommand.trim() ? 0.5 : 1,
          }}
        >
          + Add Rule
        </button>
      </div>

      {/* Save */}
      <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={() => void save()}
          disabled={saving}
          style={{
            fontSize: 11,
            padding: '5px 18px',
            border: '1px solid var(--color-accent)',
            borderRadius: 'var(--radius-sm)',
            background: saved ? 'var(--color-success)' : 'var(--color-accent)',
            color: '#fff',
            cursor: saving ? 'default' : 'pointer',
          }}
        >
          {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save to settings.json'}
        </button>
      </div>
    </div>
  )
}

export function HooksPanel(): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<'events' | 'config'>('events')
  const [events, setEvents] = useState<HookEvent[]>([])
  const [loading, setLoading] = useState(true)

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

    const unsub = window.electron.onHookEvent((event) => {
      setEvents((prev) => [event, ...prev].slice(0, 500))
    })
    return unsub
  }, [load])

  function tabStyle(active: boolean): React.CSSProperties {
    return {
      padding: '3px 12px',
      fontSize: 11,
      fontWeight: active ? 700 : 400,
      color: active ? 'var(--color-accent)' : 'var(--color-text-muted)',
      background: active ? 'var(--color-accent-dim)' : 'transparent',
      border: active ? '1px solid var(--color-accent)' : '1px solid transparent',
      borderRadius: 'var(--radius-sm)',
      cursor: 'pointer',
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 16px',
          borderBottom: '1px solid var(--color-border)',
          background: 'var(--color-surface)',
          flexShrink: 0,
        }}
      >
        <button onClick={() => setActiveTab('events')} style={tabStyle(activeTab === 'events')}>Events</button>
        <button onClick={() => setActiveTab('config')} style={tabStyle(activeTab === 'config')}>Config</button>

        {activeTab === 'events' && (
          <>
            <span
              style={{
                fontSize: 10,
                color: 'var(--color-accent)',
                background: 'var(--color-accent-dim)',
                borderRadius: 'var(--radius-sm)',
                padding: '1px 8px',
              }}
            >
              {events.length}
            </span>
            <div style={{ flex: 1 }} />
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {Object.entries(HOOK_TYPE_COLOR).map(([type, color]) => (
                <span key={type} style={{ fontSize: 10, color, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block' }} />
                  {type}
                </span>
              ))}
            </div>
            <button
              onClick={() => void load()}
              style={{
                fontSize: 11,
                color: 'var(--color-text-muted)',
                padding: '3px 10px',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              ↺ Refresh
            </button>
          </>
        )}
        {activeTab === 'config' && <div style={{ flex: 1 }} />}
      </div>

      {activeTab === 'events' ? (
        <>
          {/* Config hint */}
          <div
            style={{
              padding: '8px 16px',
              background: 'var(--color-accent-dim)',
              borderBottom: '1px solid var(--color-border)',
              fontSize: 11,
              color: 'var(--color-accent)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexShrink: 0,
            }}
          >
            <span>Hook server listening on</span>
            <code style={{ fontFamily: 'var(--font-mono)' }}>http://127.0.0.1:37421/hook</code>
            <span style={{ color: 'var(--color-text-muted)', marginLeft: 4 }}>
              Manage rules in the <button onClick={() => setActiveTab('config')} style={{ color: 'var(--color-accent)', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, padding: 0 }}>Config tab</button>
            </span>
          </div>

          {/* Event list */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ padding: 24, color: 'var(--color-text-muted)', fontSize: 13 }}>Loading…</div>
            ) : events.length === 0 ? (
              <div
                style={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  color: 'var(--color-text-muted)',
                }}
              >
                <div style={{ fontSize: 28 }}>⚡</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>
                  No hook events yet
                </div>
                <div style={{ fontSize: 12, textAlign: 'center', maxWidth: 360 }}>
                  Configure Claude Code hooks to POST to{' '}
                  <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-accent)' }}>
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
