import React, { useState, useEffect, useCallback } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import type { ClaudeCliStatus, ClaudeSettings } from '../../../electron/shared/types'

// ── Tab bar ──────────────────────────────────────────────────────

type SubTab = 'status' | 'config'

function SubTabBar({ active, onChange }: { active: SubTab; onChange: (t: SubTab) => void }) {
  const tabs: Array<{ id: SubTab; label: string }> = [
    { id: 'status', label: 'Claude Code 状态' },
    { id: 'config', label: 'Claude Code 配置' },
  ]
  return (
    <div className="mb-5 flex gap-0.5 border-b border-[var(--color-border)]">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            '-mb-px cursor-pointer rounded-none border-none [background:none] px-4 py-1.5 text-[13px]',
            active === t.id
              ? 'border-b-2 border-[var(--color-accent)] font-semibold text-[var(--color-accent)]'
              : 'border-b-2 border-transparent font-normal text-[var(--color-text-muted)]'
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

// ── Status helpers ───────────────────────────────────────────────

function StatusRow({ label, value, ok, detail }: { label: string; value: string; ok: boolean | null; detail?: string }) {
  return (
    <div className="flex items-start gap-2.5 border-b border-[var(--color-border)] py-2">
      <span className={cn('mt-1 h-2 w-2 flex-shrink-0 rounded-full', ok === null ? 'bg-[var(--color-text-muted)]' : ok ? 'bg-[var(--color-success)]' : 'bg-[var(--color-danger)]')} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-[100px] flex-shrink-0 text-[12px] text-[var(--color-text-muted)]">{label}</span>
          <span className="break-all text-[12px] font-medium text-[var(--color-text)]">{value}</span>
        </div>
        {detail && <div className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">{detail}</div>}
      </div>
    </div>
  )
}

// ── Status Tab ───────────────────────────────────────────────────

function StatusTab() {
  const [status, setStatus] = useState<ClaudeCliStatus | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const s = await window.electron.getClaudeCliStatus()
      setStatus(s)
    } catch {
      setStatus(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 text-[var(--color-text-muted)]">
        <Loader2 size={16} className="animate-spin" />
        <span className="text-[13px]">正在检测...</span>
      </div>
    )
  }

  if (!status) {
    return (
      <div className="py-4 text-[12px] text-[var(--color-danger)]">检测失败，请重试</div>
    )
  }

  const authMethods = [
    status.auth.oauthToken && '浏览器 OAuth',
    status.auth.apiKeyEnv && '环境变量 API Key',
    status.auth.apiKeyFile && '配置文件 API Key',
  ].filter(Boolean)

  return (
    <div className="flex max-w-[560px] flex-col gap-4">
      {/* CLI 安装状态 */}
      <div className="rounded-[10px] border border-[var(--color-border)] bg-transparent p-[12px_14px]">
        <div className="mb-2.5 text-[13px] font-bold text-[var(--color-text)]">CLI 安装</div>
        <StatusRow
          label="安装状态"
          value={status.found ? '已安装' : '未找到'}
          ok={status.found}
          detail={!status.found ? '请运行 npm install -g @anthropic-ai/claude-code 安装' : undefined}
        />
        {status.found && (
          <>
            <StatusRow label="二进制路径" value={status.binaryPath ?? '—'} ok={null} />
            <StatusRow
              label="版本"
              value={status.version ?? '获取失败'}
              ok={!!status.version}
              detail={!status.version ? '可能需要在终端中手动执行 claude --version 确认' : undefined}
            />
          </>
        )}
      </div>

      {/* 认证状态 */}
      <div className="rounded-[10px] border border-[var(--color-border)] bg-transparent p-[12px_14px]">
        <div className="mb-2.5 text-[13px] font-bold text-[var(--color-text)]">认证</div>
        <StatusRow
          label="认证方式"
          value={authMethods.length > 0 ? authMethods.join(' · ') : '未配置'}
          ok={authMethods.length > 0}
          detail={authMethods.length === 0 ? '请运行 claude 并登录，或设置 ANTHROPIC_API_KEY 环境变量' : undefined}
        />
        {status.auth.oauthToken && status.auth.credentialsPath && (
          <StatusRow label="凭证文件" value={status.auth.credentialsPath} ok={null} />
        )}
        {status.auth.apiKeyEnv && (
          <StatusRow label="环境变量" value="ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN" ok={null} />
        )}
      </div>

      {/* 配置目录 */}
      <div className="rounded-[10px] border border-[var(--color-border)] bg-transparent p-[12px_14px]">
        <div className="mb-2.5 text-[13px] font-bold text-[var(--color-text)]">配置目录</div>
        <StatusRow label="配置目录" value={status.configDir} ok={null} />
        <StatusRow
          label="settings.json"
          value={status.settingsExists ? status.settingsPath : '不存在（将使用默认值）'}
          ok={null}
        />
      </div>

      <button
        onClick={() => void refresh()}
        className="self-start cursor-pointer rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-transparent px-4 py-1.5 text-[12px] text-[var(--color-text-muted)]"
      >
        刷新
      </button>
    </div>
  )
}

// ── Config Tab ───────────────────────────────────────────────────

const KNOWN_FIELDS: Array<{ key: string; label: string; desc: string; type: 'boolean' | 'object' | 'string' }> = [
  { key: 'permissions', label: '权限 (permissions)', desc: '工具调用的允许/禁止规则列表', type: 'object' },
  { key: 'env', label: '环境变量 (env)', desc: '传递给 Claude Code 进程的环境变量', type: 'object' },
  { key: 'hooks', label: 'Hooks', desc: 'PreToolUse / PostToolUse / Stop 钩子配置', type: 'object' },
]

type ViewMode = 'form' | 'json'

const inputCls = 'box-border w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-[10px] py-[6px] text-[12px] text-[var(--color-text)]'

function ConfigTab() {
  const [settings, setSettings] = useState<ClaudeSettings | null>(null)
  const [original, setOriginal] = useState<ClaudeSettings | null>(null)
  const [jsonText, setJsonText] = useState('')
  const [jsonError, setJsonError] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [view, setView] = useState<ViewMode>('form')
  const [showConfirm, setShowConfirm] = useState(false)
  const [pendingSource, setPendingSource] = useState<ViewMode | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const s = await window.electron.getClaudeSettings()
      setSettings(s)
      setOriginal(s)
      setJsonText(JSON.stringify(s, null, 2))
    } catch {
      setSettings({})
      setOriginal({})
      setJsonText('{}')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const hasChanges = JSON.stringify(settings) !== JSON.stringify(original)

  const doSave = async (source: ViewMode) => {
    let data: ClaudeSettings
    if (source === 'json') {
      try {
        data = JSON.parse(jsonText) as ClaudeSettings
        setJsonError('')
      } catch {
        setJsonError('JSON 格式无效')
        return
      }
    } else {
      data = settings ?? {}
    }
    setSaving(true)
    try {
      await window.electron.saveClaudeSettings(data)
      setSettings(data)
      setOriginal(data)
      setJsonText(JSON.stringify(data, null, 2))
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch { /* ignore */ } finally {
      setSaving(false)
      setShowConfirm(false)
      setPendingSource(null)
    }
  }

  const requestSave = (source: ViewMode) => {
    setPendingSource(source)
    setShowConfirm(true)
  }

  const handleReset = () => {
    setSettings(original)
    setJsonText(JSON.stringify(original, null, 2))
    setJsonError('')
  }

  const updateField = (key: string, value: unknown) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  const formatJson = () => {
    try {
      const parsed = JSON.parse(jsonText) as ClaudeSettings
      setJsonText(JSON.stringify(parsed, null, 2))
      setJsonError('')
    } catch {
      setJsonError('JSON 格式无效，无法格式化')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 text-[var(--color-text-muted)]">
        <Loader2 size={16} className="animate-spin" />
        <span className="text-[13px]">加载中...</span>
      </div>
    )
  }

  const s = settings ?? {}

  const knownKeys = new Set(KNOWN_FIELDS.map((f) => f.key))
  const extraEntries = Object.entries(s).filter(([k]) => !knownKeys.has(k))

  return (
    <div className="max-w-[600px]">
      {/* View toggle */}
      <div className="mb-4 flex gap-1">
        {(['form', 'json'] as ViewMode[]).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={cn(
              'cursor-pointer rounded-[var(--radius-sm)] px-3.5 py-1 text-[12px]',
              view === v
                ? 'border border-[var(--color-accent)] bg-[var(--color-accent-dim)] text-[var(--color-accent)]'
                : 'border border-[var(--color-border)] bg-transparent text-[var(--color-text-muted)]'
            )}
          >
            {v === 'form' ? '表单' : 'JSON'}
          </button>
        ))}
      </div>

      {view === 'form' && (
        <div className="flex flex-col gap-3">
          {KNOWN_FIELDS.map((field) => (
            <div key={field.key} className="flex flex-col gap-1.5 rounded-[10px] border border-[var(--color-border)] bg-transparent p-[12px_14px]">
              <label className="mb-1 block text-[12px] font-semibold text-[var(--color-text)]">{field.label}</label>
              <div className="mb-1 text-[11px] text-[var(--color-text-muted)]">{field.desc}</div>
              <textarea
                value={
                  typeof s[field.key] === 'object'
                    ? JSON.stringify(s[field.key], null, 2)
                    : String(s[field.key] ?? '')
                }
                onChange={(e) => {
                  try { updateField(field.key, JSON.parse(e.target.value)) }
                  catch { updateField(field.key, e.target.value) }
                }}
                className={cn(inputCls, 'min-h-[80px] resize-y font-mono')}
                spellCheck={false}
              />
            </div>
          ))}

          {extraEntries.map(([key, value]) => (
            <div key={key} className="flex flex-col gap-1.5 rounded-[10px] border border-[var(--color-border)] bg-transparent p-[12px_14px]">
              <label className="mb-1 block text-[12px] font-semibold text-[var(--color-text)]">{key}</label>
              {typeof value === 'boolean' ? (
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={value}
                    onChange={(e) => updateField(key, e.target.checked)}
                    className="h-3.5 w-3.5"
                  />
                  <span className="text-[12px] text-[var(--color-text-muted)]">{value ? '启用' : '禁用'}</span>
                </label>
              ) : typeof value === 'string' ? (
                <input
                  value={value}
                  onChange={(e) => updateField(key, e.target.value)}
                  className={inputCls}
                />
              ) : (
                <textarea
                  value={JSON.stringify(value, null, 2)}
                  onChange={(e) => {
                    try { updateField(key, JSON.parse(e.target.value)) }
                    catch { updateField(key, e.target.value) }
                  }}
                  className={cn(inputCls, 'min-h-[80px] resize-y font-mono')}
                  spellCheck={false}
                />
              )}
            </div>
          ))}

          <div className="mt-1 flex items-center gap-2">
            <button
              onClick={() => requestSave('form')}
              disabled={!hasChanges || saving}
              className={cn('cursor-pointer rounded-[var(--radius-sm)] border border-[var(--color-accent)] bg-[var(--color-accent)] px-4 py-1.5 text-[12px] text-white', (!hasChanges || saving) && 'opacity-50')}
            >
              {saving ? '保存中...' : '保存'}
            </button>
            <button
              onClick={handleReset}
              disabled={!hasChanges}
              className={cn('cursor-pointer rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-transparent px-4 py-1.5 text-[12px] text-[var(--color-text-muted)]', !hasChanges && 'opacity-50')}
            >
              重置
            </button>
            {saved && <span className="text-[12px] text-[var(--color-success)]">已保存</span>}
          </div>
        </div>
      )}

      {view === 'json' && (
        <div className="flex flex-col gap-2.5">
          <textarea
            value={jsonText}
            onChange={(e) => { setJsonText(e.target.value); setJsonError('') }}
            className={cn(inputCls, 'min-h-[360px] resize-y font-mono')}
            spellCheck={false}
          />
          {jsonError && <div className="text-[12px] text-[var(--color-danger)]">{jsonError}</div>}
          <div className="flex items-center gap-2">
            <button
              onClick={() => requestSave('json')}
              disabled={saving}
              className={cn('cursor-pointer rounded-[var(--radius-sm)] border border-[var(--color-accent)] bg-[var(--color-accent)] px-4 py-1.5 text-[12px] text-white', saving && 'opacity-50')}
            >
              {saving ? '保存中...' : '保存'}
            </button>
            <button
              onClick={formatJson}
              className="cursor-pointer rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-transparent px-4 py-1.5 text-[12px] text-[var(--color-text-muted)]"
            >
              格式化
            </button>
            <button
              onClick={handleReset}
              className="cursor-pointer rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-transparent px-4 py-1.5 text-[12px] text-[var(--color-text-muted)]"
            >
              重置
            </button>
            {saved && <span className="text-[12px] text-[var(--color-success)]">已保存</span>}
          </div>
        </div>
      )}

      {/* Save confirmation dialog */}
      {showConfirm && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/50">
          <div className="w-full max-w-[380px] rounded-[12px] bg-[var(--color-surface)] p-6">
            <div className="mb-2 text-[14px] font-bold text-[var(--color-text)]">确认保存</div>
            <div className="mb-4 text-[12px] text-[var(--color-text-muted)]">
              即将修改 <code className="rounded-[3px] bg-[var(--color-surface-2)] px-[5px] py-px text-[11px]">~/.claude/settings.json</code>，此操作会影响所有 Claude Code 会话。
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => { setShowConfirm(false); setPendingSource(null) }} className="cursor-pointer rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-transparent px-4 py-1.5 text-[12px] text-[var(--color-text-muted)]">取消</button>
              <button onClick={() => pendingSource && void doSave(pendingSource)} className="cursor-pointer rounded-[var(--radius-sm)] border border-[var(--color-accent)] bg-[var(--color-accent)] px-4 py-1.5 text-[12px] text-white">确认保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Root export ──────────────────────────────────────────────────

export function ClaudeCodeSettings(): React.JSX.Element {
  const [tab, setTab] = useState<SubTab>('status')

  return (
    <div className="max-w-[640px]">
      <div className="mb-4">
        <div className="text-[16px] font-bold text-[var(--color-text)]">Claude Code</div>
        <div className="mt-0.5 text-[12px] text-[var(--color-text-muted)]">查看 CLI 状态并管理 ~/.claude/settings.json 配置</div>
      </div>
      <SubTabBar active={tab} onChange={setTab} />
      {tab === 'status' && <StatusTab />}
      {tab === 'config' && <ConfigTab />}
    </div>
  )
}
