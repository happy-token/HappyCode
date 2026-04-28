import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Check, AlertTriangle, X, ChevronDown, ChevronRight, Loader2, Activity } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import type { DiagResult, DiagProbe, DiagSeverity } from '../../../electron/shared/types'

// ── Status helpers ───────────────────────────────────────────────

const SEVERITY_LABEL: Record<DiagSeverity, string> = {
  pass: '正常',
  warn: '警告',
  error: '错误',
}

function severityTextClass(s: DiagSeverity): string {
  if (s === 'pass') return 'text-[var(--color-success)]'
  if (s === 'warn') return 'text-[var(--color-warning)]'
  return 'text-[var(--color-danger)]'
}

function severityDotClass(s: DiagSeverity): string {
  if (s === 'pass') return 'bg-[var(--color-success)]'
  if (s === 'warn') return 'bg-[var(--color-warning)]'
  return 'bg-[var(--color-danger)]'
}

function severityBgClass(s: DiagSeverity): string {
  if (s === 'pass') return 'bg-[rgba(34,197,94,0.08)]'
  if (s === 'warn') return 'bg-[rgba(245,158,11,0.08)]'
  return 'bg-[rgba(239,68,68,0.08)]'
}

function severityBorderClass(s: DiagSeverity): string {
  if (s === 'pass') return 'border-[rgba(34,197,94,0.25)]'
  if (s === 'warn') return 'border-[rgba(245,158,11,0.25)]'
  return 'border-[rgba(239,68,68,0.25)]'
}

function StatusDot({ status }: { status: DiagSeverity }) {
  return (
    <span className={cn('inline-block h-2 w-2 flex-shrink-0 rounded-full', severityDotClass(status))} />
  )
}

function StatusBadge({ status }: { status: DiagSeverity }) {
  return (
    <span className={cn('rounded-[4px] border px-1.5 py-px text-[10px] font-bold uppercase tracking-[0.04em]', severityBgClass(status), severityBorderClass(status), severityTextClass(status))}>
      {SEVERITY_LABEL[status]}
    </span>
  )
}

// ── Finding icon ─────────────────────────────────────────────────

function FindingIcon({ severity }: { severity: DiagSeverity }) {
  const icon = severity === 'pass'
    ? <Check size={11} />
    : severity === 'warn'
      ? <AlertTriangle size={11} />
      : <X size={11} />
  return (
    <span className={cn('w-3.5 flex-shrink-0 text-center', severityTextClass(severity))}>
      {icon}
    </span>
  )
}

// ── Probe Row ────────────────────────────────────────────────────

function ProbeRow({ probe, defaultExpanded }: { probe: DiagProbe; defaultExpanded: boolean }) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const hasFindings = probe.findings.length > 0

  return (
    <div className="overflow-hidden rounded-[8px] border border-[var(--color-border)]">
      <button
        onClick={() => hasFindings && setExpanded(!expanded)}
        className={cn(
          'flex w-full items-center gap-2 border-none bg-transparent px-3 py-2 text-left',
          hasFindings ? 'cursor-pointer' : 'cursor-default'
        )}
      >
        <span className="w-4 flex-shrink-0 text-[var(--color-text-muted)]">
          {hasFindings && (expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />)}
        </span>
        <StatusDot status={probe.status} />
        <span className="flex-1 text-[13px] font-medium text-[var(--color-text)]">{probe.name}</span>
        <span className="mr-2 text-[11px] text-[var(--color-text-muted)]">{probe.durationMs}ms</span>
        <StatusBadge status={probe.status} />
      </button>

      {expanded && hasFindings && (
        <div className="flex flex-col gap-1.5 pb-2.5 pl-9 pr-3">
          {probe.findings.map((finding, i) => (
            <div key={i} className="flex items-start gap-1.5">
              <FindingIcon severity={finding.severity} />
              <div className="min-w-0 flex-1">
                <div className="text-[12px] text-[var(--color-text)]">{finding.message}</div>
                {finding.detail && (
                  <div className="mt-0.5 break-all text-[11px] text-[var(--color-text-muted)]">
                    {finding.detail}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main Dialog ──────────────────────────────────────────────────

interface Props {
  open: boolean
  onClose: () => void
  providerId: string
  providerName: string
}

export function ProviderDiagDialog({ open, onClose, providerId, providerName }: Props) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<DiagResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const runIdRef = useRef(0)

  const runDiagnosis = useCallback(async () => {
    const runId = ++runIdRef.current
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await window.electron.diagnoseProvider(providerId)
      if (runId !== runIdRef.current) return
      setResult(res)
    } catch (err) {
      if (runId !== runIdRef.current) return
      setError(err instanceof Error ? err.message : '诊断失败')
    } finally {
      if (runId === runIdRef.current) setLoading(false)
    }
  }, [providerId])

  useEffect(() => {
    if (open) void runDiagnosis()
  }, [open, runDiagnosis])

  const handleExport = () => {
    if (!result) return
    const payload = JSON.stringify({ provider: providerName, ...result }, null, 2)
    const blob = new Blob([payload], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `provider-diag-${providerName.replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center bg-[rgba(0,0,0,0.55)]"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-[520px] max-h-[80vh] overflow-y-auto rounded-[14px] bg-[var(--color-surface)] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.3)]"
      >
        {/* Header */}
        <div className="mb-4 flex items-start gap-2.5">
          <Activity size={18} className="flex-shrink-0 text-[var(--color-text-muted)]" />
          <div className="flex-1">
            <div className="text-[14px] font-bold text-[var(--color-text)]">连接诊断</div>
            <div className="mt-0.5 text-[12px] text-[var(--color-text-muted)]">{providerName}</div>
          </div>
          <button
            onClick={onClose}
            className="flex cursor-pointer items-center justify-center border-none bg-transparent p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
          >
            <X size={14} />
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center gap-2 py-6 text-[var(--color-text-muted)]">
            <Loader2 size={16} className="animate-spin" />
            <span className="text-[13px]">正在诊断...</span>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div
            className="rounded-[8px] px-3 py-2.5 text-[12px] text-[var(--color-danger)] bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.25)]"
          >
            {error}
          </div>
        )}

        {/* Results */}
        {result && !loading && (
          <div className="flex flex-col gap-3">
            {/* Overall summary */}
            <div className={cn('flex items-center gap-2.5 rounded-[10px] border p-[10px_14px]', severityBgClass(result.overall), severityBorderClass(result.overall))}>
              <StatusDot status={result.overall} />
              <div className="flex-1">
                <span className={cn('text-[13px] font-semibold', severityTextClass(result.overall))}>
                  {result.overall === 'pass' ? '全部检测通过' : result.overall === 'warn' ? '存在警告，请关注' : '发现错误，需要修复'}
                </span>
                <span className="ml-2 text-[11px] text-[var(--color-text-muted)]">
                  {result.durationMs}ms
                </span>
              </div>
              <StatusBadge status={result.overall} />
            </div>

            {/* Probes */}
            <div className="flex flex-col gap-1.5">
              {result.probes.map((probe, i) => (
                <ProbeRow
                  key={i}
                  probe={probe}
                  defaultExpanded={probe.status !== 'pass'}
                />
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={() => void runDiagnosis()}
            disabled={loading}
            className={cn(
              'rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-transparent px-3.5 py-1.5 text-[12px] text-[var(--color-text-muted)]',
              loading ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
            )}
          >
            重新检测
          </button>
          <button
            onClick={handleExport}
            disabled={loading || !result}
            className={cn(
              'rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-transparent px-3.5 py-1.5 text-[12px] text-[var(--color-text-muted)]',
              !result || loading ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
            )}
          >
            导出日志
          </button>
          <button
            onClick={onClose}
            className="cursor-pointer rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3.5 py-1.5 text-[12px] text-[var(--color-text)]"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  )
}
