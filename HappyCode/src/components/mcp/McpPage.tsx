import React, { useEffect, useState } from 'react'
import { Plus, Trash2, Server, Radio, Terminal } from 'lucide-react'
import { useApiConfigStore } from '../../store/api-config-store'
import type { AgentSettings } from '../../../electron/shared/types'

// ── Types ───────────────────────────────────────────────────────

interface McpServerStdio {
  type: 'stdio'
  command: string
  args?: string[]
  env?: Record<string, string>
}

interface McpServerSse {
  type: 'sse'
  url: string
}

type McpServerConfig = McpServerStdio | McpServerSse
type McpServersMap = Record<string, McpServerConfig>

function parseServers(json: string | undefined): McpServersMap {
  if (!json?.trim()) return {}
  try {
    return JSON.parse(json) as McpServersMap
  } catch {
    return {}
  }
}

function serversToJson(map: McpServersMap): string {
  if (Object.keys(map).length === 0) return ''
  return JSON.stringify(map, null, 2)
}

// ── Empty add-form state ────────────────────────────────────────

interface AddForm {
  name: string
  type: 'stdio' | 'sse'
  command: string
  args: string
  url: string
  envPairs: Array<{ key: string; value: string }>
}

const emptyForm = (): AddForm => ({
  name: '',
  type: 'stdio',
  command: '',
  args: '',
  url: '',
  envPairs: [],
})

// ── Component ───────────────────────────────────────────────────

export function McpPage(): React.JSX.Element {
  const agentSettings = useApiConfigStore((s) => s.agentSettings)
  const saveAgentSettings = useApiConfigStore((s) => s.saveAgentSettings)

  const [servers, setServers] = useState<McpServersMap>(() =>
    parseServers(agentSettings.mcpServersJson)
  )
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState<AddForm>(emptyForm)
  const [saveMsg, setSaveMsg] = useState<'idle' | 'saved' | 'error'>('idle')
  const [jsonError, setJsonError] = useState<string | null>(null)
  const [showJsonEdit, setShowJsonEdit] = useState(false)
  const [rawJson, setRawJson] = useState('')

  // Sync if store updates externally
  useEffect(() => {
    setServers(parseServers(agentSettings.mcpServersJson))
  }, [agentSettings.mcpServersJson])

  async function persist(updated: McpServersMap): Promise<void> {
    const next: AgentSettings = { ...agentSettings, mcpServersJson: serversToJson(updated) }
    await saveAgentSettings(next)
    setSaveMsg('saved')
    setTimeout(() => setSaveMsg('idle'), 1400)
  }

  function handleDeleteServer(name: string): void {
    const updated = { ...servers }
    delete updated[name]
    setServers(updated)
    void persist(updated)
  }

  function handleAddServer(): void {
    const name = form.name.trim()
    if (!name) return
    if (form.type === 'stdio' && !form.command.trim()) return

    let config: McpServerConfig
    if (form.type === 'stdio') {
      const argsList = form.args
        .split(/\s*,\s*|\s+/)
        .map((a) => a.trim())
        .filter(Boolean)
      const env: Record<string, string> = {}
      form.envPairs.forEach(({ key, value }) => {
        if (key.trim()) env[key.trim()] = value
      })
      config = {
        type: 'stdio',
        command: form.command.trim(),
        ...(argsList.length > 0 && { args: argsList }),
        ...(Object.keys(env).length > 0 && { env }),
      }
    } else {
      config = { type: 'sse', url: form.url.trim() }
    }

    const updated = { ...servers, [name]: config }
    setServers(updated)
    void persist(updated)
    setForm(emptyForm())
    setShowAdd(false)
  }

  function openJsonEdit(): void {
    setRawJson(serversToJson(servers) || '{}')
    setJsonError(null)
    setShowJsonEdit(true)
  }

  function applyJsonEdit(): void {
    try {
      const parsed = JSON.parse(rawJson) as McpServersMap
      setServers(parsed)
      void persist(parsed)
      setShowJsonEdit(false)
      setJsonError(null)
    } catch (e) {
      setJsonError((e as Error).message)
    }
  }

  const serverCount = Object.keys(servers).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '0 16px',
          height: 44,
          borderBottom: '1px solid var(--color-border)',
          background: 'var(--color-surface)',
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>MCP Servers</span>
        <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
          {serverCount} configured
        </span>
        <div style={{ flex: 1 }} />
        {saveMsg === 'saved' && (
          <span style={{ fontSize: 11, color: 'var(--color-success)' }}>✓ Saved</span>
        )}
        <button
          onClick={openJsonEdit}
          style={headerBtnStyle}
          title="Edit raw JSON"
        >
          {'{ }'}
        </button>
        <button
          onClick={() => { setShowAdd((v) => !v); setForm(emptyForm()) }}
          style={{
            ...headerBtnStyle,
            background: showAdd ? 'var(--color-accent-dim)' : 'transparent',
            color: showAdd ? 'var(--color-accent)' : 'var(--color-text-muted)',
            borderColor: showAdd ? 'var(--color-accent)' : 'var(--color-border)',
          }}
        >
          <Plus size={12} />
          Add server
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {/* Add-server form */}
        {showAdd && (
          <div
            style={{
              border: '1px solid var(--color-accent)',
              borderRadius: 'var(--radius-md)',
              padding: 16,
              marginBottom: 16,
              background: 'var(--color-accent-dim)',
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 12, color: 'var(--color-text)' }}>
              New MCP server
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 8, marginBottom: 8 }}>
              <Field label="Server name">
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. filesystem"
                  style={inputStyle}
                />
              </Field>
              <Field label="Type">
                <select
                  value={form.type}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as 'stdio' | 'sse' }))}
                  style={{ ...inputStyle, cursor: 'pointer' }}
                >
                  <option value="stdio">stdio</option>
                  <option value="sse">sse</option>
                </select>
              </Field>
            </div>

            {form.type === 'stdio' ? (
              <>
                <Field label="Command" style={{ marginBottom: 8 }}>
                  <input
                    value={form.command}
                    onChange={(e) => setForm((f) => ({ ...f, command: e.target.value }))}
                    placeholder="e.g. npx"
                    style={inputStyle}
                  />
                </Field>
                <Field label="Args (space or comma separated)">
                  <input
                    value={form.args}
                    onChange={(e) => setForm((f) => ({ ...f, args: e.target.value }))}
                    placeholder="-y @modelcontextprotocol/server-filesystem ."
                    style={inputStyle}
                  />
                </Field>
                <div style={{ marginTop: 8 }}>
                  <div style={fieldLabelStyle}>Env vars</div>
                  {form.envPairs.map((pair, i) => (
                    <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
                      <input
                        value={pair.key}
                        onChange={(e) =>
                          setForm((f) => {
                            const p = [...f.envPairs]
                            p[i] = { ...p[i], key: e.target.value }
                            return { ...f, envPairs: p }
                          })
                        }
                        placeholder="KEY"
                        style={{ ...inputStyle, width: 120, flexShrink: 0 }}
                      />
                      <input
                        value={pair.value}
                        onChange={(e) =>
                          setForm((f) => {
                            const p = [...f.envPairs]
                            p[i] = { ...p[i], value: e.target.value }
                            return { ...f, envPairs: p }
                          })
                        }
                        placeholder="value"
                        style={{ ...inputStyle, flex: 1 }}
                      />
                      <button
                        onClick={() =>
                          setForm((f) => ({ ...f, envPairs: f.envPairs.filter((_, j) => j !== i) }))
                        }
                        style={{ ...iconBtnStyle, color: 'var(--color-danger)' }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => setForm((f) => ({ ...f, envPairs: [...f.envPairs, { key: '', value: '' }] }))}
                    style={{ ...iconBtnStyle, fontSize: 11, gap: 4, marginTop: 2 }}
                  >
                    <Plus size={11} /> Add env var
                  </button>
                </div>
              </>
            ) : (
              <Field label="SSE URL">
                <input
                  value={form.url}
                  onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                  placeholder="http://localhost:3000/sse"
                  style={inputStyle}
                />
              </Field>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setShowAdd(false); setForm(emptyForm()) }}
                style={cancelBtnStyle}
              >
                Cancel
              </button>
              <button
                onClick={handleAddServer}
                disabled={!form.name.trim() || (form.type === 'stdio' && !form.command.trim()) || (form.type === 'sse' && !form.url.trim())}
                style={saveBtnStyle}
              >
                Add server
              </button>
            </div>
          </div>
        )}

        {/* Empty state */}
        {serverCount === 0 && !showAdd && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 48,
              color: 'var(--color-text-muted)',
              gap: 10,
            }}
          >
            <Server size={28} />
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>No MCP servers configured</div>
            <div style={{ fontSize: 12 }}>
              Add a server to extend Claude with tools, resources, and prompts.
            </div>
            <button
              onClick={() => setShowAdd(true)}
              style={{ ...saveBtnStyle, marginTop: 4 }}
            >
              <Plus size={13} />
              Add your first server
            </button>
          </div>
        )}

        {/* Server cards */}
        {Object.entries(servers).map(([name, cfg]) => (
          <ServerCard
            key={name}
            name={name}
            cfg={cfg}
            onDelete={() => handleDeleteServer(name)}
          />
        ))}
      </div>

      {/* JSON edit modal */}
      {showJsonEdit && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 200,
          }}
          onClick={() => setShowJsonEdit(false)}
        >
          <div
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: 20,
              width: 520,
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Edit MCP config (JSON)</div>
            <textarea
              value={rawJson}
              onChange={(e) => setRawJson(e.target.value)}
              rows={14}
              style={{ ...inputStyle, width: '100%', resize: 'vertical', fontFamily: 'var(--font-mono)', fontSize: 11 }}
              spellCheck={false}
            />
            {jsonError && (
              <div style={{ fontSize: 11, color: 'var(--color-danger)', marginTop: 6 }}>
                Parse error: {jsonError}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
              <button onClick={() => setShowJsonEdit(false)} style={cancelBtnStyle}>Cancel</button>
              <button onClick={applyJsonEdit} style={saveBtnStyle}>Apply</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── ServerCard ──────────────────────────────────────────────────

function ServerCard({
  name,
  cfg,
  onDelete,
}: {
  name: string
  cfg: McpServerConfig
  onDelete: () => void
}): React.JSX.Element {
  const isStdio = cfg.type === 'stdio'
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: '10px 14px',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        background: 'var(--color-surface)',
        marginBottom: 8,
      }}
    >
      <div
        style={{
          width: 30,
          height: 30,
          borderRadius: 'var(--radius-sm)',
          background: 'var(--color-surface-2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          marginTop: 1,
        }}
      >
        {isStdio ? (
          <Terminal size={14} color="var(--color-accent)" />
        ) : (
          <Radio size={14} color="var(--color-info)" />
        )}
      </div>

      <div style={{ flex: 1, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>{name}</span>
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              padding: '2px 5px',
              borderRadius: 'var(--radius-xs)',
              background: isStdio ? 'rgba(129,140,248,0.15)' : 'rgba(96,165,250,0.15)',
              color: isStdio ? 'var(--color-accent)' : 'var(--color-info)',
            }}
          >
            {cfg.type}
          </span>
        </div>

        {isStdio ? (
          <div
            style={{
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
              color: 'var(--color-text-muted)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {cfg.command}
            {cfg.args && cfg.args.length > 0 ? ' ' + cfg.args.join(' ') : ''}
          </div>
        ) : (
          <div
            style={{
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
              color: 'var(--color-text-muted)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {cfg.url}
          </div>
        )}

        {isStdio && cfg.env && Object.keys(cfg.env).length > 0 && (
          <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {Object.keys(cfg.env).map((k) => (
              <span
                key={k}
                style={{
                  fontSize: 9,
                  fontFamily: 'var(--font-mono)',
                  padding: '1px 5px',
                  borderRadius: 'var(--radius-xs)',
                  background: 'var(--color-surface-2)',
                  color: 'var(--color-text-faint)',
                  border: '1px solid var(--color-border)',
                }}
              >
                {k}
              </span>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={onDelete}
        title="Remove server"
        style={{ ...iconBtnStyle, color: 'var(--color-text-faint)', flexShrink: 0 }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-danger)' }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-faint)' }}
      >
        <Trash2 size={13} />
      </button>
    </div>
  )
}

// ── Field helper ────────────────────────────────────────────────

function Field({
  label,
  children,
  style,
}: {
  label: string
  children: React.ReactNode
  style?: React.CSSProperties
}): React.JSX.Element {
  return (
    <div style={style}>
      <div style={fieldLabelStyle}>{label}</div>
      {children}
    </div>
  )
}

// ── Styles ──────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%',
  fontSize: 12,
  padding: '5px 8px',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--color-surface-2)',
  color: 'var(--color-text)',
  fontFamily: 'var(--font-mono)',
}

const fieldLabelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  color: 'var(--color-text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: 4,
}

const headerBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  fontSize: 11,
  color: 'var(--color-text-muted)',
  padding: '3px 8px',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-sm)',
  cursor: 'pointer',
  background: 'transparent',
}

const iconBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  fontSize: 11,
  color: 'var(--color-text-muted)',
  padding: '3px 6px',
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
}

const cancelBtnStyle: React.CSSProperties = {
  fontSize: 12,
  padding: '5px 14px',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-sm)',
  cursor: 'pointer',
  color: 'var(--color-text-muted)',
  background: 'transparent',
}

const saveBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  fontSize: 12,
  fontWeight: 600,
  padding: '5px 14px',
  border: '1px solid var(--color-accent)',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--color-accent)',
  color: '#fff',
  cursor: 'pointer',
}
