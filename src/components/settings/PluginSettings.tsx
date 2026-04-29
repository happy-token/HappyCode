import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { X } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import type { PluginInfo, PluginReadmeResult, PluginScope, PluginOperationResult } from '../../../electron/shared/types'

function parsePluginId(id: string): { name: string; source?: string } {
  const parts = id.split('@')
  return { name: parts[0] ?? id, source: parts[1] }
}

function scopeLabel(scope: PluginScope, t: (key: string) => string): string {
  const map: Record<PluginScope, string> = {
    user: t('plugins.user'),
    project: t('plugins.project'),
    local: t('plugins.local'),
    managed: t('plugins.managed'),
    builtin: t('plugins.builtin'),
  }
  return map[scope]
}

// ── Operation result banner ───────────────────────────────────

type OpResult = PluginOperationResult & { message: string }

function OpBanner({ result, onDismiss }: { result: OpResult; onDismiss: () => void }) {
  return (
    <div
      className={cn(
        'flex flex-shrink-0 items-center gap-2 rounded-[6px] px-3 py-[7px] text-[11px] border',
        result.success
          ? 'bg-[rgba(34,197,94,0.1)] border-[rgba(34,197,94,0.3)] text-[var(--color-success)]'
          : 'bg-[rgba(239,68,68,0.1)] border-[rgba(239,68,68,0.3)] text-[var(--color-danger)]'
      )}
    >
      <span className="flex-1">{result.message}</span>
      <button onClick={onDismiss} className="flex cursor-pointer items-center border-none bg-none p-0 text-current opacity-70 hover:opacity-100"><X size={12} /></button>
    </div>
  )
}

// ── Plugin Detail ─────────────────────────────────────────────

type OpState = 'idle' | 'enabling' | 'disabling' | 'updating' | 'uninstalling'

interface PluginDetailProps {
  plugin: PluginInfo
  readme: PluginReadmeResult | null
  readmeLoading: boolean
  onEnable: (id: string) => Promise<PluginOperationResult>
  onDisable: (id: string) => Promise<PluginOperationResult>
  onUpdate: (id: string) => Promise<PluginOperationResult>
  onUninstall: (id: string) => void
}

function PluginDetail({ plugin, readme, readmeLoading, onEnable, onDisable, onUpdate, onUninstall }: PluginDetailProps) {
  const { t } = useTranslation()
  const { name, source } = parsePluginId(plugin.name)
  const [opState, setOpState] = useState<OpState>('idle')
  const [opResult, setOpResult] = useState<OpResult | null>(null)

  const runOp = async (state: OpState, fn: () => Promise<PluginOperationResult>) => {
    setOpState(state)
    setOpResult(null)
    const r = await fn()
    setOpState('idle')
    if (r.message) setOpResult(r as OpResult)
  }

  const mdComponents: React.ComponentProps<typeof ReactMarkdown>['components'] = {
    h1: ({ children }) => (
      <div className="mb-1.5 mt-3.5 border-b border-[var(--color-border)] pb-[5px] text-[15px] font-bold text-[var(--color-text)]">{children}</div>
    ),
    h2: ({ children }) => (
      <div className="mb-[5px] mt-3 text-[13px] font-bold text-[var(--color-text)]">{children}</div>
    ),
    h3: ({ children }) => (
      <div className="mb-[3px] mt-2 text-[12px] font-semibold text-[var(--color-text)]">{children}</div>
    ),
    p: ({ children }) => (
      <p className="mb-[7px] mt-[3px] text-[12px] leading-[1.65] text-[var(--color-text-muted)]">{children}</p>
    ),
    ul: ({ children }) => (
      <ul className="mb-[7px] mt-[3px] pl-[18px] text-[12px] leading-[1.65] text-[var(--color-text-muted)]">{children}</ul>
    ),
    ol: ({ children }) => (
      <ol className="mb-[7px] mt-[3px] pl-[18px] text-[12px] leading-[1.65] text-[var(--color-text-muted)]">{children}</ol>
    ),
    li: ({ children }) => <li className="mb-0.5">{children}</li>,
    code: ({ className, children }) => {
      const isBlock = !!className
      if (isBlock) return (
        <code className="block overflow-x-auto rounded-[5px] bg-[var(--color-surface-2)] px-[10px] py-[7px] font-mono text-[11px] leading-[1.55] text-[var(--color-text)]">{children}</code>
      )
      return <code className="rounded-[3px] bg-[var(--color-surface-2)] px-1 py-px font-mono text-[11px] text-[var(--color-accent)]">{children}</code>
    },
    pre: ({ children }) => <pre className="mb-2 mt-[5px] overflow-hidden rounded-[5px]">{children}</pre>,
    blockquote: ({ children }) => (
      <blockquote className="ml-0 border-l-[3px] border-[var(--color-accent)] pl-2.5 text-[var(--color-text-muted)] opacity-80">{children}</blockquote>
    ),
    a: ({ href, children }) => <a href={href} className="text-[12px] text-[var(--color-accent)] no-underline">{children}</a>,
    hr: () => <hr className="my-2 border-none border-t border-[var(--color-border)]" />,
    strong: ({ children }) => <strong className="font-semibold text-[var(--color-text)]">{children}</strong>,
    table: ({ children }) => <table className="my-1.5 w-full border-collapse text-[12px]">{children}</table>,
    th: ({ children }) => <th className="border-b border-[var(--color-border)] px-2 py-1 text-left font-semibold text-[var(--color-text)]">{children}</th>,
    td: ({ children }) => <td className="border-b border-[var(--color-border)] px-2 py-1 text-[var(--color-text-muted)]">{children}</td>,
  }

  const busy = opState !== 'idle'

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-[var(--color-border)] px-[18px] pb-3 pt-3.5">
        {/* Title row */}
        <div className="mb-2.5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-[7px]">
              <span className="text-[14px] font-bold text-[var(--color-text)]">{name}</span>
              {source && (
                <span className="rounded-[3px] bg-[var(--color-surface-2)] px-[5px] py-px text-[10px] text-[var(--color-text-muted)]">@{source}</span>
              )}
              {plugin.version && (
                <span className="rounded-[3px] bg-[var(--color-surface-2)] px-[5px] py-px text-[10px] text-[var(--color-text-muted)]">v{plugin.version}</span>
              )}
              {plugin.scope && plugin.scope !== 'user' && (
                <span className="rounded-[3px] bg-[var(--color-surface-2)] px-[5px] py-px text-[10px] text-[var(--color-text-muted)]">
                  {scopeLabel(plugin.scope, t)}{t('plugins.scopeLabel')}
                </span>
              )}
              <span
                className={cn(
                  'rounded-[4px] px-1.5 py-px text-[9px] font-bold border',
                  plugin.enabled
                    ? 'border-[var(--color-accent)] bg-[var(--color-accent-dim)] text-[var(--color-accent)]'
                    : 'border-[var(--color-border)] bg-transparent text-[var(--color-text-muted)]'
                )}
              >
                {plugin.enabled ? t('plugins.enabledLabel') : t('plugins.disabledLabel')}
              </span>
            </div>

            {/* Stats pills */}
            <div className="mt-1.5 flex gap-1.5">
              {(plugin.skillCount ?? 0) > 0 && (
                <span className="rounded-[10px] bg-[var(--color-surface-2)] px-[7px] py-0.5 text-[11px] text-[var(--color-text-muted)]">
                  {plugin.skillCount} {t('plugins.skillsCount')}
                </span>
              )}
              {(plugin.agentCount ?? 0) > 0 && (
                <span className="rounded-[10px] bg-[var(--color-surface-2)] px-[7px] py-0.5 text-[11px] text-[var(--color-text-muted)]">
                  {plugin.agentCount} {t('plugins.agentsCount')}
                </span>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-shrink-0 items-start gap-1.5">
            {/* Enable / Disable */}
            {plugin.enabled ? (
              <button
                onClick={() => void runOp('disabling', () => onDisable(plugin.id))}
                disabled={busy}
                className={cn(
                  'rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-transparent px-3 py-1 text-[11px] text-[var(--color-text-muted)]',
                  busy ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                )}
              >
                {opState === 'disabling' ? t('plugins.disabling') : t('plugins.disable')}
              </button>
            ) : (
              <button
                onClick={() => void runOp('enabling', () => onEnable(plugin.id))}
                disabled={busy}
                className={cn(
                  'rounded-[var(--radius-sm)] border border-[var(--color-accent)] bg-[var(--color-accent)] px-3 py-1 text-[11px] text-white',
                  busy ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                )}
              >
                {opState === 'enabling' ? t('plugins.enabling') : t('plugins.enable')}
              </button>
            )}

            {/* Update */}
            <button
              onClick={() => void runOp('updating', () => onUpdate(plugin.id))}
              disabled={busy}
              className={cn(
                'rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-transparent px-3 py-1 text-[11px]',
                busy ? 'cursor-not-allowed opacity-50 text-[var(--color-text-muted)]' : 'cursor-pointer text-[var(--color-text)]'
              )}
            >
              {opState === 'updating' ? t('plugins.updating') : t('plugins.update')}
            </button>

            {/* Uninstall */}
            <button
              onClick={() => void onUninstall(plugin.name)}
              disabled={busy}
              className={cn(
                'rounded-[var(--radius-sm)] border border-[var(--color-danger)] bg-transparent px-3 py-1 text-[11px] text-[var(--color-danger)]',
                busy ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
              )}
            >
              {opState === 'uninstalling' ? t('plugins.uninstalling') : t('plugins.uninstall')}
            </button>
          </div>
        </div>

        {/* Operation result */}
        {opResult && (
          <OpBanner result={opResult} onDismiss={() => setOpResult(null)} />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-[18px] py-3.5">
        {/* Skills & Agents */}
        {readme && (readme.skills.length > 0 || readme.agents.length > 0) && (
          <div className="mb-3.5 flex gap-5">
            {readme.skills.length > 0 && (
              <div className="flex-1">
                <div className="mb-[5px] text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--color-text-muted)]">
                  {t('plugins.skillsCount')} ({readme.skills.length})
                </div>
                <div className="flex flex-col gap-0.5">
                  {readme.skills.map((s) => (
                    <div key={s} className="rounded-[4px] bg-[var(--color-surface-2)] px-[7px] py-0.5 font-mono text-[11px] text-[var(--color-text-muted)]">{s}</div>
                  ))}
                </div>
              </div>
            )}
            {readme.agents.length > 0 && (
              <div className="flex-1">
                <div className="mb-[5px] text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--color-text-muted)]">
                  {t('plugins.agentsCount')} ({readme.agents.length})
                </div>
                <div className="flex flex-col gap-0.5">
                  {readme.agents.map((a) => (
                    <div key={a} className="rounded-[4px] bg-[var(--color-surface-2)] px-[7px] py-0.5 font-mono text-[11px] text-[var(--color-text-muted)]">{a}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* README */}
        {readmeLoading ? (
          <div className="py-4 text-[12px] text-[var(--color-text-muted)]">{t('plugins.readmeLoading')}</div>
        ) : readme?.content ? (
          <div>
            <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--color-text-muted)]">README</div>
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
              {readme.content}
            </ReactMarkdown>
          </div>
        ) : (
          <div className="text-[12px] text-[var(--color-text-muted)] opacity-50">{t('plugins.readmeEmpty')}</div>
        )}
      </div>
    </div>
  )
}

// ── Plugin List Row ───────────────────────────────────────────

function PluginRow({ plugin, selected, onSelect }: { plugin: PluginInfo; selected: boolean; onSelect: () => void }) {
  const { name, source } = parsePluginId(plugin.name)
  return (
    <div
      onClick={onSelect}
      className={cn(
        'flex cursor-pointer items-center gap-[9px] rounded-[6px] px-[10px] py-[7px] border-l-2 transition-colors',
        selected
          ? 'bg-[var(--color-accent-dim)] border-l-[var(--color-accent)]'
          : 'bg-transparent border-l-transparent hover:bg-[var(--color-surface-2)]'
      )}
    >
      <span className={cn('h-[7px] w-[7px] flex-shrink-0 rounded-full', plugin.enabled ? 'bg-[var(--color-success)]' : 'bg-[var(--color-text-muted)]')} />
      <div className="min-w-0 flex-1">
        <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[12px] font-semibold text-[var(--color-text)]">{name}</div>
        {source && <div className="mt-px text-[10px] text-[var(--color-text-muted)] opacity-70">@{source}</div>}
      </div>
      <div className="flex flex-shrink-0 flex-col items-end gap-px">
        {plugin.version && <span className="text-[9px] text-[var(--color-text-muted)] opacity-55">v{plugin.version}</span>}
        {((plugin.skillCount ?? 0) > 0 || (plugin.agentCount ?? 0) > 0) && (
          <span className="text-[9px] text-[var(--color-text-muted)] opacity-55">
            {[(plugin.skillCount ?? 0) > 0 ? `${plugin.skillCount}s` : '', (plugin.agentCount ?? 0) > 0 ? `${plugin.agentCount}a` : ''].filter(Boolean).join('·')}
          </span>
        )}
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────

export function PluginSettings(): React.JSX.Element {
  const { t } = useTranslation()
  const [plugins, setPlugins] = useState<PluginInfo[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [readme, setReadme] = useState<PluginReadmeResult | null>(null)
  const [readmeLoading, setReadmeLoading] = useState(false)
  const [showInstallModal, setShowInstallModal] = useState(false)
  const [installName, setInstallName] = useState('')
  const [isInstalling, setIsInstalling] = useState(false)
  const [installError, setInstallError] = useState<string | null>(null)

  const fetchPlugins = async (keepSelected?: string) => {
    setIsLoading(true)
    try {
      const result = await window.electron.listPlugins()
      setPlugins(result.plugins)
      const toSelect = keepSelected ?? (result.plugins.length > 0 && selectedId === null ? result.plugins[0]!.id : null)
      if (toSelect && result.plugins.some((p) => p.id === toSelect)) {
        setSelectedId(toSelect)
        void loadReadme(toSelect)
      }
    } catch (err) {
      console.error('Failed to fetch plugins:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const loadReadme = async (pluginId: string) => {
    setReadmeLoading(true)
    setReadme(null)
    try {
      setReadme(await window.electron.getPluginReadme(pluginId))
    } catch { /* ignore */ } finally {
      setReadmeLoading(false)
    }
  }

  useEffect(() => { void fetchPlugins() }, [])

  const handleSelect = (plugin: PluginInfo) => {
    setSelectedId(plugin.id)
    void loadReadme(plugin.id)
  }

  const handleEnable = async (id: string) => {
    const result = await window.electron.enablePlugin(id)
    if (result.success) {
      setPlugins((prev) => prev.map((p) => p.id === id ? { ...p, enabled: true } : p))
    }
    return result
  }

  const handleDisable = async (id: string) => {
    const result = await window.electron.disablePlugin(id)
    if (result.success) {
      setPlugins((prev) => prev.map((p) => p.id === id ? { ...p, enabled: false } : p))
    }
    return result
  }

  const handleUpdate = async (id: string) => {
    return await window.electron.updatePlugin(id)
  }

  const handleUninstall = async (name: string) => {
    const result = await window.electron.uninstallPlugin(name)
    if (result.success) {
      setSelectedId(null)
      setReadme(null)
      await fetchPlugins()
    } else {
      alert(result.message ?? t('plugins.uninstallFailed'))
    }
  }

  const handleInstall = async () => {
    if (!installName.trim()) return
    setIsInstalling(true)
    setInstallError(null)
    try {
      const result = await window.electron.installPlugin(installName.trim())
      if (result.success) {
        setInstallName('')
        setShowInstallModal(false)
        await fetchPlugins()
      } else {
        setInstallError(result.error ?? t('plugins.installFailed'))
      }
    } catch (err) {
      setInstallError(String(err))
    } finally {
      setIsInstalling(false)
    }
  }

  const selectedPlugin = plugins.find((p) => p.id === selectedId) ?? null

  return (
    <div className="flex h-[calc(100vh-120px)] overflow-hidden rounded-[10px] border border-[var(--color-border)]">
      {/* Left panel */}
      <div className="flex w-[240px] flex-shrink-0 flex-col overflow-hidden border-r border-[var(--color-border)]">
        <div className="flex-shrink-0 border-b border-[var(--color-border)] px-3 pb-2 pt-[11px]">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[12px] font-bold text-[var(--color-text)]">{t('plugins.title')}</div>
              <div className="mt-px text-[10px] text-[var(--color-text-muted)]">
                {plugins.length} {t('plugins.installedCount')} · {plugins.filter((p) => p.enabled).length} {t('plugins.enabledCount')}
              </div>
            </div>
            <button
              onClick={() => { setInstallError(null); setShowInstallModal(true) }}
              className="cursor-pointer rounded-[var(--radius-sm)] border border-[var(--color-accent)] bg-[var(--color-accent)] px-[10px] py-1 text-[11px] text-white"
            >
              + {t('plugins.install')}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-1">
          {isLoading ? (
            <div className="px-[10px] py-4 text-[12px] text-[var(--color-text-muted)]">{t('plugins.loading')}</div>
          ) : plugins.length === 0 ? (
            <div className="px-[10px] py-6 text-center text-[12px] text-[var(--color-text-muted)]">{t('plugins.empty')}</div>
          ) : (
            plugins.map((plugin) => (
              <PluginRow key={plugin.id} plugin={plugin} selected={selectedId === plugin.id} onSelect={() => handleSelect(plugin)} />
            ))
          )}
        </div>
      </div>

      {/* Right panel */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {selectedPlugin ? (
          <PluginDetail
            plugin={selectedPlugin}
            readme={readme}
            readmeLoading={readmeLoading}
            onEnable={handleEnable}
            onDisable={handleDisable}
            onUpdate={handleUpdate}
            onUninstall={(name) => { void handleUninstall(name) }}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center text-[12px] text-[var(--color-text-muted)] opacity-50">
            {t('plugins.selectToView')}
          </div>
        )}
      </div>

      {/* Install Modal */}
      {showInstallModal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50">
          <div className="w-full max-w-[480px] rounded-[12px] bg-[var(--color-surface)] p-6">
            <div className="mb-4 text-[14px] font-bold text-[var(--color-text)]">{t('plugins.installTitle')}</div>
            <label>
              <div className="mb-1 block text-[12px] font-semibold text-[var(--color-text)]">{t('plugins.nameLabel')}</div>
              <input
                value={installName}
                onChange={(e) => setInstallName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void handleInstall() }}
                className="box-border w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-[10px] py-[6px] text-[12px] text-[var(--color-text)]"
                placeholder={t('plugins.namePlaceholder')}
                autoFocus
              />
            </label>
            {installError && (
              <div
                className="mt-2 rounded-[4px] px-2 py-[5px] text-[11px] text-[var(--color-danger)] bg-[rgba(239,68,68,0.08)]"
              >
                {installError}
              </div>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => { setShowInstallModal(false); setInstallName('') }}
                className="cursor-pointer rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-transparent px-4 py-1.5 text-[12px] text-[var(--color-text-muted)]"
              >
                {t('plugins.cancel')}
              </button>
              <button
                onClick={() => void handleInstall()}
                disabled={!installName.trim() || isInstalling}
                className={cn('cursor-pointer rounded-[var(--radius-sm)] border border-[var(--color-accent)] bg-[var(--color-accent)] px-4 py-1.5 text-[12px] text-white', (!installName.trim() || isInstalling) && 'opacity-50')}
              >
                {isInstalling ? t('plugins.installing') : t('plugins.installBtn')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
