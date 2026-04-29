import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Server, CheckCircle2, AlertTriangle, ChevronLeft } from 'lucide-react'
import type { McpServerRecord, McpServerConfig } from '../../../electron/shared/types'
import { useTabStore } from '../../store/tab-store'
import { cn } from '@renderer/lib/utils'

// ── Types ───────────────────────────────────────────────────────

type TransportKind = 'stdio' | 'http' | 'sse'
type ServerStatus = 'connected' | 'checking' | 'needs-auth' | 'failed' | 'disabled'

type GroupKey = 'user' | 'project' | 'local' | 'plugin'

const GROUP_ORDER: GroupKey[] = ['plugin', 'user', 'project', 'local']

function groupLabel(key: GroupKey, t: (key: string) => string): string {
  const map: Record<GroupKey, string> = {
    user: t('mcp.scopeUser'),
    project: t('mcp.scopeProject'),
    local: t('mcp.scopeLocal'),
    plugin: t('mcp.scopePlugin'),
  }
  return map[key]
}

function statusToneClass(s: ServerStatus): string {
  const map: Record<ServerStatus, string> = {
    connected: 'bg-[rgba(34,197,94,0.1)] text-[var(--color-success)] border-[rgba(34,197,94,0.2)]',
    checking: 'bg-[rgba(148,163,184,0.1)] text-[#94a3b8] border-[rgba(148,163,184,0.2)]',
    'needs-auth': 'bg-[rgba(245,158,11,0.1)] text-[#f59e0b] border-[rgba(245,158,11,0.2)]',
    failed: 'bg-[rgba(239,68,68,0.1)] text-[var(--color-danger)] border-[rgba(239,68,68,0.2)]',
    disabled: 'bg-[var(--color-surface-2)] text-[var(--color-text-muted)] border-[var(--color-border)]',
  }
  return map[s]
}

const TRANSPORT_LABELS: Record<TransportKind, string> = {
  stdio: 'STDIO',
  http: 'HTTP',
  sse: 'SSE',
}

// ── Helpers ─────────────────────────────────────────────────────

function getGroupKey(server: McpServerRecord): GroupKey {
  if (server.name.startsWith('plugin:')) return 'plugin'
  return server.scope as GroupKey
}

// ── Draft ───────────────────────────────────────────────────────

type StringRow = { id: string; value: string }
type KeyValueRow = { id: string; key: string; value: string }

type Draft = {
  name: string
  transport: TransportKind
  command: string
  args: StringRow[]
  env: KeyValueRow[]
  url: string
  headers: KeyValueRow[]
  headersHelper: string
  oauthClientId: string
  oauthCallbackPort: string
}

const createId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`

const emptyDraft = (): Draft => ({
  name: '',
  transport: 'stdio',
  command: '',
  args: [{ id: createId(), value: '' }],
  env: [{ id: createId(), key: '', value: '' }],
  url: '',
  headers: [{ id: createId(), key: '', value: '' }],
  headersHelper: '',
  oauthClientId: '',
  oauthCallbackPort: '',
})

const draftFromServer = (server: McpServerRecord): Draft => {
  const base = emptyDraft()
  base.name = server.name
  if (server.config.type === 'stdio') {
    return {
      ...base,
      transport: 'stdio',
      command: server.config.command ?? '',
      args: (server.config.args?.length ? server.config.args : ['']).map((v) => ({ id: createId(), value: v })),
      env: Object.entries(server.config.env ?? {}).map(([k, v]) => ({ id: createId(), key: k, value: v })).concat(
        Object.keys(server.config.env ?? {}).length === 0 ? [{ id: createId(), key: '', value: '' }] : [],
      ),
    }
  }
  return {
    ...base,
    transport: server.config.type,
    url: server.config.url ?? '',
    headers: Object.entries(server.config.headers ?? {}).map(([k, v]) => ({ id: createId(), key: k, value: v })).concat(
      Object.keys(server.config.headers ?? {}).length === 0 ? [{ id: createId(), key: '', value: '' }] : [],
    ),
    headersHelper: server.config.headersHelper ?? '',
    oauthClientId: server.config.oauth?.clientId ?? '',
    oauthCallbackPort: server.config.oauth?.callbackPort ? String(server.config.oauth.callbackPort) : '',
  }
}

const rowsToRecord = (rows: KeyValueRow[]) => {
  const entries: Array<[string, string]> = []
  for (const r of rows) {
    const k = r.key.trim()
    if (!k) continue
    entries.push([k, r.value])
  }
  return Object.fromEntries(entries)
}

const rowsToList = (rows: StringRow[]) => rows.map((r) => r.value.trim()).filter(Boolean)

const isDraftValid = (d: Draft) => d.name.trim().length > 0 && (d.transport === 'stdio' ? d.command.trim().length > 0 : d.url.trim().length > 0)

const buildConfig = (d: Draft): McpServerConfig => {
  if (d.transport === 'stdio') {
    const args = rowsToList(d.args)
    const env = rowsToRecord(d.env)
    return {
      type: 'stdio',
      command: d.command.trim(),
      ...(args.length > 0 && { args }),
      ...(Object.keys(env).length > 0 && { env }),
    }
  }
  const port = d.oauthCallbackPort.trim() ? Number(d.oauthCallbackPort.trim()) : undefined
  const clientId = d.oauthClientId.trim()
  return {
    type: d.transport,
    url: d.url.trim(),
    headers: rowsToRecord(d.headers),
    ...(d.headersHelper.trim() && { headersHelper: d.headersHelper.trim() }),
    ...(clientId || port ? {
      oauth: {
        ...(clientId && { clientId }),
        ...(port && { callbackPort: port }),
      },
    } : {}),
  }
}

const summaryForConfig = (cfg: McpServerConfig): string => {
  if (cfg.type === 'stdio') {
    return `${cfg.command}${cfg.args?.length ? ' ' + cfg.args.join(' ') : ''}`
  }
  return cfg.url ?? ''
}

// ── Shared class strings ─────────────────────────────────────────

const inputCls = 'box-border w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-[10px] py-[6px] text-[12px] text-[var(--color-text)] outline-none'
const sectionCls = 'mb-3 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4'
const labelCls = 'mb-1 block text-[11px] font-semibold uppercase tracking-[0.05em] text-[var(--color-text-muted)]'

// ── Component ───────────────────────────────────────────────────

export function McpSettings(): React.JSX.Element | null {
  const { t } = useTranslation()
  const [servers, setServers] = useState<McpServerRecord[]>([])
  const [view, setView] = useState<'list' | 'create' | 'edit' | 'details'>('list')
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [editingServer, setEditingServer] = useState<McpServerRecord | null>(null)
  const [detailsServer, setDetailsServer] = useState<McpServerRecord | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [deletePending, setDeletePending] = useState<McpServerRecord | null>(null)

  const cwd = useTabStore((s) => {
    const active = s.tabs.find((t) => t.tabId === s.activeTabId)
    return active?.cwd ?? ''
  })

  useEffect(() => {
    const effectiveCwd = cwd || ''
    void (async () => {
      try {
        const result = await window.electron.listMcpServers(effectiveCwd)
        setServers(result.servers)
      } catch { /* ignore */ }
    })()
  }, [cwd])

  const reload = useCallback(async () => {
    const effectiveCwd = cwd || ''
    try {
      const result = await window.electron.listMcpServers(effectiveCwd)
      setServers(result.servers)
    } catch { /* ignore */ }
  }, [cwd])

  const stats = useMemo(() => ({
    total: servers.length,
    connected: servers.filter((s) => s.status === 'connected').length,
    attention: servers.filter((s) => s.status === 'failed' || s.status === 'needs-auth').length,
  }), [servers])

  const grouped = useMemo(() => {
    const groups: Record<GroupKey, McpServerRecord[]> = { user: [], project: [], local: [], plugin: [] }
    for (const s of servers) groups[getGroupKey(s)].push(s)
    return groups
  }, [servers])

  const handleToggle = async (server: McpServerRecord) => {
    if (server.name.startsWith('plugin:')) return
    const updated = servers.map((s) =>
      s.name === server.name
        ? { ...s, enabled: !s.enabled, status: !s.enabled ? 'disabled' as const : 'connected' as const }
        : s,
    )
    setServers(updated)
    try {
      await window.electron.toggleMcpServer(server.name, server.scope as 'user' | 'project' | 'local', !server.enabled)
    } catch { /* revert on error */ }
  }

  const handleDelete = async (server: McpServerRecord) => {
    try {
      await window.electron.deleteMcpServer(server.name, server.scope as 'user' | 'project' | 'local')
      setDeletePending(null)
      await reload()
      if (view === 'edit' || view === 'details') setView('list')
    } catch { /* ignore */ }
  }

  const handleSave = async () => {
    if (!isDraftValid(draft)) return
    setIsSaving(true)
    try {
      const config = buildConfig(draft)
      const record: McpServerRecord = {
        name: draft.name.trim(),
        config,
        transport: draft.transport,
        scope: 'user',
        enabled: true,
        status: 'checking',
        statusLabel: t('mcp.connecting'),
        summary: summaryForConfig(config),
        canToggle: true,
        canEdit: true,
        canRemove: true,
        canReconnect: true,
        configLocation: `~/.claude.json → mcpServers.${draft.name.trim()}`,
      }

      await window.electron.saveMcpServer(record)

      setTimeout(async () => {
        setServers((prev) =>
          prev.map((s) =>
            s.name === record.name
              ? { ...s, status: 'connected' as const, statusLabel: t('mcp.connectedLabel') }
              : s,
          ),
        )
      }, 800)

      await reload()
      setView('list')
      setDraft(emptyDraft())
      setEditingServer(null)
    } finally {
      setIsSaving(false)
    }
  }

  const beginEdit = (server: McpServerRecord) => {
    if (server.name.startsWith('plugin:')) return
    setEditingServer(server)
    setDraft(draftFromServer(server))
    setView('edit')
  }

  const beginCreate = () => {
    setDraft(emptyDraft())
    setEditingServer(null)
    setView('create')
  }

  const viewDetails = (server: McpServerRecord) => {
    setDetailsServer(server)
    setView('details')
  }

  if (view === 'list') {
    return (
      <div className="max-w-[640px]">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-[16px] font-bold text-[var(--color-text)]">{t('mcp.title')}</div>
            <div className="mt-0.5 text-[12px] text-[var(--color-text-muted)]">
              {t('mcp.description')}
            </div>
          </div>
          <button
            onClick={beginCreate}
            className="inline-flex items-center gap-1 cursor-pointer rounded-[var(--radius-sm)] border border-[var(--color-accent)] bg-[var(--color-accent)] px-[14px] py-[6px] text-[12px] font-semibold text-white"
          >
            <X size={11} className="rotate-45" />{t('mcp.addServer')}
          </button>
        </div>

        {/* Stats */}
        <div className="mb-5 grid grid-cols-3 gap-2">
          {([
            { label: t('mcp.total'), value: stats.total, icon: <Server size={11} /> },
            { label: t('mcp.connected'), value: stats.connected, icon: <CheckCircle2 size={11} className="text-[var(--color-success)]" /> },
            { label: t('mcp.attention'), value: stats.attention, icon: <AlertTriangle size={11} className="text-[var(--color-warning)]" /> },
          ] as { label: string; value: number; icon: React.ReactNode }[]).map((s) => (
            <div key={s.label} className="rounded-[8px] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3">
              <div className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-[0.1em] text-[var(--color-text-muted)]">
                {s.icon} {s.label}
              </div>
              <div className="text-[20px] font-bold text-[var(--color-text)]">{s.value}</div>
            </div>
          ))}
        </div>

        {servers.length === 0 ? (
          <div className="py-12 text-center text-[var(--color-text-muted)]">
            <div className="mb-2 flex justify-center"><Server size={28} className="text-[var(--color-text-faint)]" /></div>
            <div className="mb-1 text-[13px] font-semibold text-[var(--color-text)]">{t('mcp.emptyTitle')}</div>
            <div className="text-[12px]">{t('mcp.emptyDesc')}</div>
          </div>
        ) : (
          GROUP_ORDER.map((group) => {
            const groupServers = grouped[group]
            if (!groupServers.length) return null
            return (
              <div key={group} className="mb-4">
                <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.05em] text-[var(--color-text-muted)]">
                  {groupLabel(group, t)} ({groupServers.length})
                </div>
                {groupServers.map((server) => (
                  <ServerRow
                    key={server.name}
                    server={server}
                    onOpen={() => beginEdit(server)}
                    onView={() => viewDetails(server)}
                    onToggle={() => void handleToggle(server)}
                  />
                ))}
              </div>
            )
          })
        )}
      </div>
    )
  }

  if (view === 'details' && detailsServer) {
    const server = detailsServer
    return (
      <ServerDetails
        server={server}
        onBack={() => setView('list')}
        onEdit={() => beginEdit(server)}
      />
    )
  }

  if (view === 'create' || view === 'edit') {
    return (
      <McpForm
        mode={view}
        draft={draft}
        setDraft={setDraft}
        server={editingServer}
        isSaving={isSaving}
        onSave={handleSave}
        onCancel={() => { setView('list'); setDraft(emptyDraft()) }}
        onDelete={() => editingServer && setDeletePending(editingServer)}
      />
    )
  }

  if (deletePending) {
    return (
      <DeleteConfirm
        server={deletePending}
        onConfirm={() => void handleDelete(deletePending)}
        onCancel={() => setDeletePending(null)}
      />
    )
  }

  return null
}

// ── Server Row ──────────────────────────────────────────────────

function ServerRow({
  server,
  onOpen,
  onView,
  onToggle,
}: {
  server: McpServerRecord
  onOpen: () => void
  onView: () => void
  onToggle: () => void
}) {
  const { t } = useTranslation()
  const isPlugin = server.name.startsWith('plugin:')
  return (
    <div
      className={cn(
        'mb-1.5 flex items-center gap-3 rounded-[8px] border border-[var(--color-border)] p-3',
        !server.enabled && 'bg-[var(--color-surface-2)] opacity-60',
      )}
    >
      <ToggleSwitch checked={server.enabled} onChange={isPlugin ? () => {} : onToggle} />

      <div className="min-w-0 flex-1 cursor-pointer" onClick={onView}>
        <div className="mb-0.5 flex flex-wrap items-center gap-2">
          <span className="text-[13px] font-bold text-[var(--color-text)]">{server.name}</span>
          {isPlugin && (
            <span
              className="rounded-[4px] px-1.5 py-px text-[9px] font-semibold border border-[rgba(139,92,246,0.3)] bg-[rgba(139,92,246,0.1)] text-[#a78bfa]"
            >
              {t('mcp.plugin')}
            </span>
          )}
          <span
            className={cn('rounded-[4px] px-1.5 py-px text-[9px] font-semibold border', statusToneClass(server.status))}
          >
            {server.statusLabel}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-[3px] bg-[var(--color-surface-2)] px-[5px] py-px text-[9px] text-[var(--color-text-muted)]">
            {TRANSPORT_LABELS[server.transport]}
          </span>
          <span className="overflow-hidden text-ellipsis whitespace-nowrap font-[var(--font-mono)] text-[11px] text-[var(--color-text-muted)]">
            {server.summary}
          </span>
        </div>
      </div>

      {!isPlugin && (
        <button
          onClick={onOpen}
          className="cursor-pointer rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-transparent px-2 py-[3px] text-[11px] text-[var(--color-text-muted)]"
        >
          {t('mcp.edit')}
        </button>
      )}
    </div>
  )
}

// ── Toggle Switch ───────────────────────────────────────────────

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className={cn(
        'relative h-5 w-9 flex-shrink-0 cursor-pointer rounded-[10px] border-none transition-colors',
        checked ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-border)]',
      )}
    >
      <span
        className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-white transition-[left]', checked ? 'left-[18px]' : 'left-[2px]')}
      />
    </button>
  )
}

// ── Server Details ──────────────────────────────────────────────

function ServerDetails({
  server,
  onBack,
  onEdit,
}: {
  server: McpServerRecord
  onBack: () => void
  onEdit: () => void
}) {
  const { t } = useTranslation()
  const isPlugin = server.name.startsWith('plugin:')
  return (
    <div className="max-w-[640px]">
      <div className="mb-4 flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex cursor-pointer items-center border-none px-2 py-1 text-[var(--color-text-muted)] hover:text-[var(--color-text)] [background:none]"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <div className="text-[16px] font-bold text-[var(--color-text)]">{server.name}</div>
            {isPlugin && (
              <span
                className="rounded-[4px] px-2 py-px text-[10px] font-semibold border border-[rgba(139,92,246,0.3)] bg-[rgba(139,92,246,0.1)] text-[#a78bfa]"
              >
                {t('mcp.plugin')}
              </span>
            )}
          </div>
          <div className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">{server.summary}</div>
        </div>
        {!isPlugin && (
          <button
            onClick={onEdit}
            className="cursor-pointer rounded-[var(--radius-sm)] border border-[var(--color-accent)] bg-transparent px-3 py-1 text-[11px] text-[var(--color-accent)]"
          >
            {t('mcp.edit')}
          </button>
        )}
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2">
        {[
          { label: t('mcp.transport'), value: TRANSPORT_LABELS[server.transport] },
          { label: t('mcp.scope'), value: groupLabel(server.scope as GroupKey, t) },
          { label: t('mcp.status'), value: server.statusLabel },
          { label: t('mcp.location'), value: server.configLocation },
        ].map((item) => (
          <div key={item.label} className="rounded-[6px] bg-[var(--color-surface-2)] p-2.5">
            <div className="mb-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-muted)]">
              {item.label}
            </div>
            <div className="break-all text-[12px] text-[var(--color-text)]">{item.value}</div>
          </div>
        ))}
      </div>

      <div className={sectionCls}>
        <div className={cn(labelCls, 'mb-1.5')}>{t('mcp.rawConfig')}</div>
        <pre className="m-0 max-h-[300px] overflow-x-auto rounded-[6px] bg-[var(--color-surface-2)] p-2.5 font-[var(--font-mono)] text-[11px] text-[var(--color-text-muted)] [white-space:pre-wrap] [word-break:break-word]">
          {JSON.stringify(server.config, null, 2)}
        </pre>
      </div>
    </div>
  )
}

// ── MCP Form (Create/Edit) ──────────────────────────────────────

function McpForm({
  mode,
  draft,
  setDraft,
  server,
  isSaving,
  onSave,
  onCancel,
  onDelete,
}: {
  mode: 'create' | 'edit'
  draft: Draft
  setDraft: React.Dispatch<React.SetStateAction<Draft>>
  server: McpServerRecord | null
  isSaving: boolean
  onSave: () => void
  onCancel: () => void
  onDelete: () => void
}) {
  const { t } = useTranslation()
  const transportLocked = mode === 'edit'
  const valid = isDraftValid(draft)

  const addRow = (key: 'args' | 'env' | 'headers') => {
    setDraft((d) => ({
      ...d,
      [key]: [...d[key], key === 'args' ? { id: createId(), value: '' } : { id: createId(), key: '', value: '' }],
    }))
  }

  const removeRow = (key: 'args' | 'env' | 'headers', id: string) => {
    setDraft((d) => {
      const next = d[key].filter((r) => r.id !== id)
      return {
        ...d,
        [key]: next.length > 0 ? next : [key === 'args' ? { id: createId(), value: '' } : { id: createId(), key: '', value: '' }],
      }
    })
  }

  return (
    <div className="max-w-[640px]">
      <div className="mb-4 flex items-center gap-3">
        <button
          onClick={onCancel}
          className="flex cursor-pointer items-center border-none px-2 py-1 text-[var(--color-text-muted)] hover:text-[var(--color-text)] [background:none]"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="flex-1">
          <div className="text-[16px] font-bold text-[var(--color-text)]">
            {mode === 'edit' ? `${t('mcp.edit')} ${server?.name}` : t('mcp.addServerTitle')}
          </div>
          <div className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">
            {mode === 'edit' ? t('mcp.editServerDesc') : t('mcp.addServerDesc')}
          </div>
        </div>
        {mode === 'edit' && (
          <button
            onClick={onDelete}
            className="cursor-pointer rounded-[var(--radius-sm)] border border-[var(--color-danger)] bg-transparent px-3 py-1 text-[11px] text-[var(--color-danger)]"
          >
            {t('mcp.delete')}
          </button>
        )}
      </div>

      {/* Name */}
      <div className={sectionCls}>
        <label>
          <div className={labelCls}>{t('mcp.name')}</div>
          <input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            className={inputCls}
            placeholder={t('mcp.namePlaceholder')}
            disabled={mode === 'edit'}
          />
        </label>
      </div>

      {/* Transport */}
      <div className="mb-3 overflow-hidden rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="grid grid-cols-3">
          {(['stdio', 'http', 'sse'] as TransportKind[]).map((t) => {
            const active = draft.transport === t
            return (
              <button
                key={t}
                onClick={() => !transportLocked && setDraft({ ...draft, transport: t })}
                disabled={transportLocked}
                className={cn(
                  'h-10 border-none text-[12px] font-semibold transition-colors [border-right:1px_solid_var(--color-border)]',
                  active ? 'bg-[var(--color-accent-dim)] text-[var(--color-accent)]' : 'bg-transparent text-[var(--color-text-muted)]',
                  transportLocked ? 'cursor-not-allowed' : 'cursor-pointer',
                  transportLocked && !active && 'opacity-50',
                )}
              >
                {TRANSPORT_LABELS[t]}
              </button>
            )
          })}
        </div>
      </div>

      {transportLocked && (
        <div className="mb-3 text-[10px] text-[var(--color-text-muted)]">
          {t('mcp.transportHint')}
        </div>
      )}

      {draft.transport === 'stdio' ? (
        <>
          <div className={sectionCls}>
            <label>
              <div className={labelCls}>{t('mcp.command')}</div>
              <input
                value={draft.command}
                onChange={(e) => setDraft({ ...draft, command: e.target.value })}
                className={inputCls}
                placeholder={t('mcp.commandPlaceholder')}
              />
            </label>
          </div>

          {/* Args */}
          <div className={sectionCls}>
            <div className={cn(labelCls, 'mb-2')}>{t('mcp.args')}</div>
            {draft.args.map((row) => (
              <div key={row.id} className="mb-1.5 flex gap-1.5">
                <input
                  value={row.value}
                  onChange={(e) => setDraft((d) => ({
                    ...d,
                    args: d.args.map((r) => r.id === row.id ? { ...r, value: e.target.value } : r),
                  }))}
                  className={inputCls}
                  placeholder={t('mcp.argPlaceholder')}
                />
                <button
                  onClick={() => removeRow('args', row.id)}
                  className="cursor-pointer rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-transparent px-2 py-1 text-[14px] text-[var(--color-text-muted)]"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
            <button
              onClick={() => addRow('args')}
              className="cursor-pointer rounded-[var(--radius-sm)] border border-dashed border-[var(--color-border)] bg-transparent px-[10px] py-1 text-[11px] text-[var(--color-text-muted)]"
            >
              {t('mcp.addArg')}
            </button>
          </div>

          {/* Env */}
          <div className={sectionCls}>
            <div className={cn(labelCls, 'mb-2')}>{t('mcp.envVars')}</div>
            {draft.env.map((row) => (
              <div key={row.id} className="mb-1.5 grid grid-cols-[1fr_1fr_auto] gap-1.5">
                <input
                  value={row.key}
                  onChange={(e) => setDraft((d) => ({
                    ...d,
                    env: d.env.map((r) => r.id === row.id ? { ...r, key: e.target.value } : r),
                  }))}
                  className={inputCls}
                  placeholder="KEY"
                />
                <input
                  value={row.value}
                  onChange={(e) => setDraft((d) => ({
                    ...d,
                    env: d.env.map((r) => r.id === row.id ? { ...r, value: e.target.value } : r),
                  }))}
                  className={inputCls}
                  placeholder="value"
                />
                <button
                  onClick={() => removeRow('env', row.id)}
                  className="cursor-pointer rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-transparent px-2 py-1 text-[14px] text-[var(--color-text-muted)]"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
            <button
              onClick={() => addRow('env')}
              className="cursor-pointer rounded-[var(--radius-sm)] border border-dashed border-[var(--color-border)] bg-transparent px-[10px] py-1 text-[11px] text-[var(--color-text-muted)]"
            >
              {t('mcp.addEnvVar')}
            </button>
          </div>
        </>
      ) : (
        <>
          {/* Remote URL */}
          <div className={sectionCls}>
            <label>
              <div className={labelCls}>{draft.transport === 'http' ? 'URL' : 'SSE URL'}</div>
              <input
                value={draft.url}
                onChange={(e) => setDraft({ ...draft, url: e.target.value })}
                className={inputCls}
                placeholder="http://localhost:3000/sse"
              />
            </label>
          </div>

          {/* Headers */}
          <div className={sectionCls}>
            <div className={cn(labelCls, 'mb-2')}>{t('mcp.headers')}</div>
            {draft.headers.map((row) => (
              <div key={row.id} className="mb-1.5 grid grid-cols-[1fr_1fr_auto] gap-1.5">
                <input
                  value={row.key}
                  onChange={(e) => setDraft((d) => ({
                    ...d,
                    headers: d.headers.map((r) => r.id === row.id ? { ...r, key: e.target.value } : r),
                  }))}
                  className={inputCls}
                  placeholder="Header"
                />
                <input
                  value={row.value}
                  onChange={(e) => setDraft((d) => ({
                    ...d,
                    headers: d.headers.map((r) => r.id === row.id ? { ...r, value: e.target.value } : r),
                  }))}
                  className={inputCls}
                  placeholder="value"
                />
                <button
                  onClick={() => removeRow('headers', row.id)}
                  className="cursor-pointer rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-transparent px-2 py-1 text-[14px] text-[var(--color-text-muted)]"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
            <button
              onClick={() => addRow('headers')}
              className="cursor-pointer rounded-[var(--radius-sm)] border border-dashed border-[var(--color-border)] bg-transparent px-[10px] py-1 text-[11px] text-[var(--color-text-muted)]"
            >
              {t('mcp.addHeader')}
            </button>
          </div>

          {/* OAuth */}
          <div className={sectionCls}>
            <div className="grid grid-cols-2 gap-2">
              <label>
                <div className={cn(labelCls, 'text-[10px]')}>OAuth Client ID</div>
                <input
                  value={draft.oauthClientId}
                  onChange={(e) => setDraft({ ...draft, oauthClientId: e.target.value })}
                  className={inputCls}
                  placeholder={t('mcp.urlPlaceholder')}
                />
              </label>
              <label>
                <div className={cn(labelCls, 'text-[10px]')}>OAuth Callback Port</div>
                <input
                  value={draft.oauthCallbackPort}
                  onChange={(e) => setDraft({ ...draft, oauthCallbackPort: e.target.value })}
                  className={inputCls}
                  placeholder={t('mcp.tokenPlaceholder')}
                />
              </label>
            </div>
          </div>
        </>
      )}

      {/* Save */}
      <div className="mt-2 flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="cursor-pointer rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-transparent px-4 py-[6px] text-[12px] text-[var(--color-text-muted)]"
        >
          {t('mcp.cancel')}
        </button>
        <button
          onClick={onSave}
          disabled={!valid || isSaving}
          className={cn(
            'rounded-[var(--radius-sm)] border border-[var(--color-accent)] bg-[var(--color-accent)] px-4 py-[6px] text-[12px] text-white',
            valid && !isSaving ? 'cursor-pointer' : 'cursor-not-allowed opacity-50',
          )}
        >
          {t('mcp.save')}
        </button>
      </div>
    </div>
  )
}

// ── Delete Confirm ──────────────────────────────────────────────

function DeleteConfirm({
  server,
  onConfirm,
  onCancel,
}: {
  server: McpServerRecord
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="max-w-[400px]">
      <div className="mb-2 text-[16px] font-bold text-[var(--color-text)]">{t('mcp.confirmDeleteTitle')}</div>
      <div className="mb-5 text-[12px] leading-[1.5] text-[var(--color-text-muted)]">
        {t('mcp.confirmDeleteDesc')} <strong>{server.name}</strong> {t('mcp.confirmDeleteWarn')}
      </div>
      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="cursor-pointer rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-transparent px-4 py-[6px] text-[12px] text-[var(--color-text-muted)]"
        >
          {t('mcp.cancel')}
        </button>
        <button
          onClick={onConfirm}
          className="cursor-pointer rounded-[var(--radius-sm)] border border-[var(--color-danger)] bg-[var(--color-danger)] px-4 py-[6px] text-[12px] text-white"
        >
          {t('mcp.deleteBtn')}
        </button>
      </div>
    </div>
  )
}

// Alias for AppShell compatibility
export { McpSettings as McpPage }
