import React, { useState, useEffect, useMemo } from 'react'
import { Plus } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { useProviderStore } from '../../store/provider-store'
import { useApiConfigStore } from '../../store/api-config-store'
import type { ProviderConfig, ProviderPreset, ModelMapping, ApiFormat, ProviderTestResult } from '../../../electron/shared/types'
import { ProviderDiagDialog } from './ProviderDiagDialog'
import { MagicCard } from '@renderer/components/ui/magic-card'

type TestState = { status: 'idle' } | { status: 'testing' } | { status: 'done'; result: ProviderTestResult }

export function ProviderSettings(): React.JSX.Element {
  const {
    providers, activeId, presets,
    fetchProviders, fetchPresets, deleteProvider,
    activateProvider, activateOfficial, testProvider,
  } = useProviderStore()
  const fetchSettings = useApiConfigStore((s) => s.load)

  const [editingProvider, setEditingProvider] = useState<ProviderConfig | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  const [testStates, setTestStates] = useState<Record<string, TestState>>({})
  const [diagProvider, setDiagProvider] = useState<{ id: string; name: string } | null>(null)

  useEffect(() => {
    void fetchProviders()
    void fetchPresets()
  }, [fetchProviders, fetchPresets])

  const presetMap = useMemo(
    () => new Map(presets.map((p) => [p.id, p])),
    [presets],
  )

  const handleDelete = (id: string): void => {
    if (activeId === id) return
    setPendingDelete(id)
  }

  const confirmDelete = async (): Promise<void> => {
    if (!pendingDelete) return
    await deleteProvider(pendingDelete)
    setPendingDelete(null)
    await fetchSettings()
  }

  const handleActivate = async (id: string): Promise<void> => {
    await activateProvider(id)
    await fetchSettings()
  }

  const handleActivateOfficial = async (): Promise<void> => {
    await activateOfficial()
    await fetchSettings()
  }

  const handleTest = async (id: string): Promise<void> => {
    setTestStates((prev) => ({ ...prev, [id]: { status: 'testing' } }))
    try {
      const result = await testProvider(id)
      setTestStates((prev) => ({ ...prev, [id]: { status: 'done', result } }))
    } catch {
      setTestStates((prev) => ({
        ...prev,
        [id]: { status: 'done', result: { connectivity: { success: false, latencyMs: 0, error: '请求失败' } } },
      }))
    }
  }

  const isOfficialActive = activeId === null

  return (
    <div className="max-w-[640px]">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-[16px] font-bold text-[var(--color-text)]">服务商管理</div>
          <div className="mt-0.5 text-[12px] text-[var(--color-text-muted)]">配置和管理 API 服务商</div>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex cursor-pointer items-center gap-1 rounded-[var(--radius-sm)] border border-[var(--color-accent)] bg-[var(--color-accent)] px-3.5 py-1.5 text-[12px] text-white"
        >
          <Plus size={11} />添加服务商
        </button>
      </div>

      {/* Official provider */}
      <MagicCard
        className={cn(
          'mb-3 rounded-[12px]',
          isOfficialActive
            ? 'border-2 border-[var(--color-accent)] bg-[var(--color-accent-dim)]'
            : 'border border-[var(--color-border)] bg-transparent'
        )}
        gradientSize={200}
        gradientOpacity={isOfficialActive ? 0.1 : 0.2}
      >
        <div
          className={cn('flex items-center gap-3 p-3.5', !isOfficialActive && 'cursor-pointer')}
          onClick={() => !isOfficialActive && void handleActivateOfficial()}
        >
          <span
            className={cn('h-2.5 w-2.5 flex-shrink-0 rounded-full', isOfficialActive ? 'bg-[var(--color-success)]' : 'bg-[var(--color-text-muted)]')}
          />
          <div className="flex-1">
            <div className="text-[13px] font-bold text-[var(--color-text)]">
              Anthropic 官方
              {isOfficialActive && (
                <span className="ml-1.5 rounded-[4px] border border-[var(--color-accent)] bg-[var(--color-accent-dim)] px-1.5 py-0.5 text-[9px] font-bold text-[var(--color-accent)]">默认</span>
              )}
            </div>
            <div className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">api.anthropic.com · 使用 Claude 官方 API</div>
          </div>
          {!isOfficialActive && (
            <button
              onClick={(e) => { e.stopPropagation(); void handleActivateOfficial() }}
              className="cursor-pointer rounded-[var(--radius-sm)] border border-[var(--color-accent)] bg-transparent px-[10px] py-1 text-[11px] text-[var(--color-accent)]"
            >
              设为默认
            </button>
          )}
        </div>
      </MagicCard>

      {/* Saved providers */}
      <div className="flex flex-col gap-2">
        {providers.map((provider) => {
          const isActive = activeId === provider.id
          const preset = presetMap.get(provider.presetId)
          const testState = testStates[provider.id] ?? { status: 'idle' }
          return (
            <div key={provider.id}>
              <MagicCard
                className={cn(
                  'flex items-center gap-3 p-3.5',
                  isActive
                    ? 'border-2 border-[var(--color-accent)] bg-[var(--color-accent-dim)]'
                    : 'border border-[var(--color-border)] bg-transparent',
                  testState.status === 'done' ? 'rounded-t-[12px] border-b-0' : 'rounded-[12px]'
                )}
              >
                <span className={cn('h-2.5 w-2.5 flex-shrink-0 rounded-full', isActive ? 'bg-[var(--color-success)]' : 'bg-[var(--color-text-muted)]')} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-bold text-[var(--color-text)]">
                      {provider.name}
                    </span>
                    {preset && preset.id !== 'custom' && (
                      <span className="rounded-[4px] bg-[var(--color-surface-2)] px-1.5 py-px text-[9px] text-[var(--color-text-muted)]">{preset.name}</span>
                    )}
                    {isActive && (
                      <span className="rounded-[4px] border border-[var(--color-accent)] bg-[var(--color-accent-dim)] px-1.5 py-px text-[9px] font-bold text-[var(--color-accent)]">默认</span>
                    )}
                  </div>
                  <div className="mt-0.5 overflow-hidden text-ellipsis whitespace-nowrap text-[11px] text-[var(--color-text-muted)]">
                    {provider.baseUrl} · {provider.models.main}
                  </div>
                </div>
                <div className="flex flex-shrink-0 gap-1">
                  {!isActive && (
                    <button onClick={() => void handleActivate(provider.id)} className="cursor-pointer rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-transparent px-2 py-[3px] text-[11px] text-[var(--color-text-muted)]">
                      设为默认
                    </button>
                  )}
                  <button
                    onClick={() => void handleTest(provider.id)}
                    disabled={testState.status === 'testing'}
                    className={cn(
                      'rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-transparent px-2 py-[3px] text-[11px] text-[var(--color-text-muted)]',
                      testState.status === 'testing' ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
                    )}
                  >
                    {testState.status === 'testing' ? '测试中…' : '测试'}
                  </button>
                  <button
                    onClick={() => setDiagProvider({ id: provider.id, name: provider.name })}
                    className="cursor-pointer rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-transparent px-2 py-[3px] text-[11px] text-[var(--color-text-muted)]"
                  >
                    诊断
                  </button>
                  <button onClick={() => setEditingProvider(provider)} className="cursor-pointer rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-transparent px-2 py-[3px] text-[11px] text-[var(--color-text-muted)]">
                    编辑
                  </button>
                  {!isActive && (
                    <button onClick={() => handleDelete(provider.id)} className="cursor-pointer rounded-[var(--radius-sm)] border border-[var(--color-danger)] bg-transparent px-2 py-[3px] text-[11px] text-[var(--color-danger)]">
                      删除
                    </button>
                  )}
                </div>
              </MagicCard>

              {/* Inline test result */}
              {testState.status === 'done' && (
                <TestResultBar
                  result={testState.result}
                  isActive={isActive}
                  onClose={() => setTestStates((prev) => ({ ...prev, [provider.id]: { status: 'idle' } }))}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Create/Edit Modals */}
      {showCreateModal && (
        <ProviderFormModal
          open
          onClose={() => setShowCreateModal(false)}
          mode="create"
          presets={presets}
        />
      )}
      {editingProvider && (
        <ProviderFormModal
          key={editingProvider.id}
          open
          onClose={() => setEditingProvider(null)}
          mode="edit"
          provider={editingProvider}
          presets={presets}
        />
      )}

      {/* Delete confirmation */}
      {pendingDelete && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50">
          <div className="w-full max-w-[360px] rounded-[12px] bg-[var(--color-surface)] p-6">
            <div className="mb-2 text-[14px] font-bold text-[var(--color-text)]">确认删除</div>
            <div className="mb-4 text-[12px] text-[var(--color-text-muted)]">确定要删除此服务商吗？此操作不可恢复。</div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setPendingDelete(null)} className="cursor-pointer rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-transparent px-4 py-1.5 text-[12px] text-[var(--color-text-muted)]">取消</button>
              <button onClick={() => void confirmDelete()} className="cursor-pointer rounded-[var(--radius-sm)] border border-[var(--color-danger)] bg-[var(--color-danger)] px-4 py-1.5 text-[12px] text-white">删除</button>
            </div>
          </div>
        </div>
      )}

      {/* Diagnostics dialog */}
      {diagProvider && (
        <ProviderDiagDialog
          open
          onClose={() => setDiagProvider(null)}
          providerId={diagProvider.id}
          providerName={diagProvider.name}
        />
      )}
    </div>
  )
}

// ─── Test Result Bar ──────────────────────────────────────────

function TestResultBar({
  result,
  isActive,
  onClose,
}: {
  result: ProviderTestResult
  isActive: boolean
  onClose: () => void
}) {
  const { success, latencyMs, error } = result.connectivity
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-b-[12px] px-3.5 py-2',
        isActive ? 'border-2 border-[var(--color-accent)]' : 'border border-[var(--color-border)]',
        success ? 'border-t border-t-[rgba(34,197,94,0.3)] bg-[rgba(34,197,94,0.06)]' : 'border-t border-t-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.06)]'
      )}
    >
      <span className={cn('text-[12px] font-semibold', success ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]')}>
        {success ? '连接成功' : '连接失败'}
      </span>
      {success && (
        <span className="text-[11px] text-[var(--color-text-muted)]">{latencyMs}ms</span>
      )}
      {error && (
        <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[11px] text-[var(--color-danger)]">{error}</span>
      )}
      <button
        onClick={onClose}
        className="ml-auto cursor-pointer rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-transparent px-2 py-px text-[11px] text-[var(--color-text-muted)]"
      >
        关闭
      </button>
    </div>
  )
}

// ─── Provider Form Modal ──────────────────────────────────────

const inputCls = 'box-border w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-[10px] py-[6px] text-[12px] text-[var(--color-text)]'
const labelCls = 'mb-1 block text-[12px] font-semibold text-[var(--color-text)]'

function ProviderFormModal({
  open, onClose, mode, provider, presets,
}: {
  open: boolean
  onClose: () => void
  mode: 'create' | 'edit'
  provider?: ProviderConfig
  presets: ProviderPreset[]
}) {
  const { createProvider, updateProvider, testProviderConfig } = useProviderStore()
  const fetchSettings = useApiConfigStore((s) => s.load)

  const customPreset: ProviderPreset = {
    id: 'custom',
    name: 'Custom',
    baseUrl: '',
    apiFormat: 'openai_chat',
    defaultModels: { main: '', haiku: '', sonnet: '', opus: '' },
    needsApiKey: true,
    websiteUrl: '',
  }

  const initialPreset = presets[0] ?? customPreset
  const editPreset = provider ? (presets.find((p) => p.id === provider.presetId) ?? customPreset) : initialPreset

  const [selectedPreset, setSelectedPreset] = useState<ProviderPreset>(editPreset)
  const [name, setName] = useState(provider?.name ?? initialPreset.name)
  const [baseUrl, setBaseUrl] = useState(provider?.baseUrl ?? initialPreset.baseUrl)
  const [apiFormat, setApiFormat] = useState<ApiFormat>(provider?.apiFormat ?? initialPreset.apiFormat ?? 'anthropic')
  const [apiKey, setApiKey] = useState('')
  const [models, setModels] = useState<ModelMapping>(provider?.models ?? { ...initialPreset.defaultModels })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [testState, setTestState] = useState<TestState>({ status: 'idle' })

  const canSubmit = name.trim() && baseUrl.trim() && (mode === 'edit' || apiKey.trim()) && models.main.trim()

  const handleSubmit = async (): Promise<void> => {
    if (!canSubmit) return
    setIsSubmitting(true)
    try {
      if (mode === 'create') {
        await createProvider({
          presetId: selectedPreset.id,
          name: name.trim(),
          apiKey: apiKey.trim(),
          baseUrl: baseUrl.trim(),
          apiFormat,
          models,
        })
      } else if (provider) {
        const updates: Partial<ProviderConfig> = {
          name: name.trim(),
          baseUrl: baseUrl.trim(),
          apiFormat,
          models,
        }
        if (apiKey.trim()) updates.apiKey = apiKey.trim()
        await updateProvider(provider.id, updates)
      }
      await fetchSettings()
      onClose()
    } catch (err) {
      console.error('Failed to save provider:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleTest = async (): Promise<void> => {
    if (!baseUrl.trim() || !models.main.trim()) return
    const effectiveKey = apiKey.trim() || provider?.apiKey || ''
    setTestState({ status: 'testing' })
    try {
      const result = await testProviderConfig({
        baseUrl: baseUrl.trim(),
        apiKey: effectiveKey,
        modelId: models.main.trim(),
        apiFormat,
      })
      setTestState({ status: 'done', result })
    } catch {
      setTestState({ status: 'done', result: { connectivity: { success: false, latencyMs: 0, error: '请求失败' } } })
    }
  }

  if (!open) return null

  const canTest = baseUrl.trim() && models.main.trim() && (apiKey.trim() || mode === 'edit')

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50">
      <div className="w-full max-w-[560px] max-h-[80vh] overflow-y-auto rounded-[12px] bg-[var(--color-surface)] p-6">
        <div className="mb-4 text-[14px] font-bold text-[var(--color-text)]">
          {mode === 'create' ? '添加服务商' : '编辑服务商'}
        </div>

        <div className="flex flex-col gap-3">
          {/* Preset chips */}
          {mode === 'create' && (
            <div>
              <div className={labelCls}>预设</div>
              <div className="flex flex-wrap gap-1.5">
                {presets.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => {
                      setSelectedPreset(preset)
                      setName(preset.name)
                      setBaseUrl(preset.baseUrl)
                      setApiFormat(preset.apiFormat ?? 'openai_chat')
                      setModels({ ...preset.defaultModels })
                    }}
                    className={cn(
                      'cursor-pointer rounded-[12px] px-3 py-1 text-[11px]',
                      selectedPreset.id === preset.id
                        ? 'border border-[var(--color-accent)] bg-[var(--color-accent-dim)] text-[var(--color-accent)]'
                        : 'border border-[var(--color-border)] bg-transparent text-[var(--color-text-muted)]'
                    )}
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <label>
            <div className={labelCls}>名称</div>
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="My Provider" />
          </label>

          <label>
            <div className={labelCls}>Base URL</div>
            <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} className={inputCls} placeholder="https://api.example.com" />
          </label>

          <label>
            <div className={labelCls}>API Format</div>
            <select value={apiFormat} onChange={(e) => setApiFormat(e.target.value as ApiFormat)} className={cn(inputCls, 'cursor-pointer')}>
              <option value="anthropic">Anthropic</option>
              <option value="openai_chat">OpenAI Chat</option>
              <option value="openai_responses">OpenAI Responses</option>
            </select>
          </label>

          <label>
            <div className={labelCls}>{mode === 'edit' ? 'API Key (留空不修改)' : 'API Key'}</div>
            <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} className={inputCls} placeholder={mode === 'edit' ? '••••••••' : 'sk-...'} />
          </label>

          {/* Model Mapping */}
          <div>
            <div className={labelCls}>模型映射</div>
            <div className="grid grid-cols-2 gap-2">
              <label>
                <div className="mb-1 block text-[11px] font-semibold text-[var(--color-text)]">Main <span className="text-[var(--color-danger)]">*</span></div>
                <input value={models.main} onChange={(e) => setModels({ ...models, main: e.target.value })} className={inputCls} placeholder="默认模型 ID" />
              </label>
              <label>
                <div className="mb-1 block text-[11px] font-semibold text-[var(--color-text)]">Haiku</div>
                <input value={models.haiku} onChange={(e) => setModels({ ...models, haiku: e.target.value })} className={inputCls} placeholder="可选" />
              </label>
              <label>
                <div className="mb-1 block text-[11px] font-semibold text-[var(--color-text)]">Sonnet</div>
                <input value={models.sonnet} onChange={(e) => setModels({ ...models, sonnet: e.target.value })} className={inputCls} placeholder="可选" />
              </label>
              <label>
                <div className="mb-1 block text-[11px] font-semibold text-[var(--color-text)]">Opus</div>
                <input value={models.opus} onChange={(e) => setModels({ ...models, opus: e.target.value })} className={inputCls} placeholder="可选" />
              </label>
            </div>
          </div>

          {/* Inline test result in modal */}
          {testState.status === 'done' && (
            <div
              className={cn(
                'flex items-center gap-2 rounded-[8px] px-3 py-2 border',
                testState.result.connectivity.success
                  ? 'bg-[rgba(34,197,94,0.08)] border-[rgba(34,197,94,0.3)]'
                  : 'bg-[rgba(239,68,68,0.08)] border-[rgba(239,68,68,0.3)]'
              )}
            >
              <span className={cn('text-[12px] font-semibold', testState.result.connectivity.success ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]')}>
                {testState.result.connectivity.success ? '连接成功' : '连接失败'}
              </span>
              {testState.result.connectivity.success && (
                <span className="text-[11px] text-[var(--color-text-muted)]">{testState.result.connectivity.latencyMs}ms</span>
              )}
              {testState.result.connectivity.error && (
                <span className="text-[11px] text-[var(--color-danger)]">{testState.result.connectivity.error}</span>
              )}
            </div>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="cursor-pointer rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-transparent px-4 py-1.5 text-[12px] text-[var(--color-text-muted)]">取消</button>
          <button
            onClick={() => void handleTest()}
            disabled={!canTest || testState.status === 'testing'}
            className={cn(
              'rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-transparent px-4 py-1.5 text-[12px] text-[var(--color-text-muted)]',
              !canTest || testState.status === 'testing' ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
            )}
          >
            {testState.status === 'testing' ? '测试中…' : '测试连接'}
          </button>
          <button
            onClick={() => void handleSubmit()}
            disabled={!canSubmit || isSubmitting}
            className={cn('cursor-pointer rounded-[var(--radius-sm)] border border-[var(--color-accent)] bg-[var(--color-accent)] px-4 py-1.5 text-[12px] text-white', (!canSubmit || isSubmitting) && 'opacity-50')}
          >
            {mode === 'create' ? '添加' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}
