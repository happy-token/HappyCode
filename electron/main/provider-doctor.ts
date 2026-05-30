import type { DiagFinding, DiagProbe, DiagResult, DiagSeverity, ApiFormat } from '../shared/types'
import { listProviders } from './provider-manager'

// ── Helpers ─────────────────────────────────────────────────────

function maxSeverity(a: DiagSeverity, b: DiagSeverity): DiagSeverity {
  const rank: Record<DiagSeverity, number> = { pass: 0, warn: 1, error: 2 }
  return rank[a] >= rank[b] ? a : b
}

function probeSeverity(findings: DiagFinding[]): DiagSeverity {
  let sev: DiagSeverity = 'pass'
  for (const f of findings) sev = maxSeverity(sev, f.severity)
  return sev
}

// ── Config Probe ─────────────────────────────────────────────────

async function runConfigProbe(provider: {
  name: string
  baseUrl: string
  apiKey: string
  apiFormat: ApiFormat
  models: { main: string; haiku: string; sonnet: string; opus: string }
}): Promise<DiagProbe> {
  const findings: DiagFinding[] = []
  const start = Date.now()

  // Name
  if (provider.name.trim()) {
    findings.push({ severity: 'pass', message: `服务商名称: ${provider.name}` })
  }

  // Base URL
  if (!provider.baseUrl.trim()) {
    findings.push({ severity: 'error', message: 'Base URL 未设置', detail: '请在服务商编辑页面填写 Base URL' })
  } else {
    try {
      new URL(provider.baseUrl)
      findings.push({ severity: 'pass', message: `Base URL: ${provider.baseUrl}` })
    } catch {
      findings.push({ severity: 'error', message: 'Base URL 格式无效', detail: provider.baseUrl })
    }
  }

  // API Key
  if (!provider.apiKey.trim()) {
    findings.push({ severity: 'error', message: 'API Key 未设置', detail: '请在编辑页面填写 API Key' })
  } else {
    const masked = `${'•'.repeat(Math.max(0, provider.apiKey.length - 4))}${provider.apiKey.slice(-4)}`
    findings.push({ severity: 'pass', message: `API Key 已配置`, detail: masked })
  }

  // Main model
  if (!provider.models.main.trim()) {
    findings.push({ severity: 'warn', message: 'Main 模型未设置', detail: '对话将无法指定模型，可能使用服务商默认模型' })
  } else {
    findings.push({ severity: 'pass', message: `Main 模型: ${provider.models.main}` })
  }

  // API Format
  findings.push({ severity: 'pass', message: `API 格式: ${provider.apiFormat}` })

  return {
    name: '配置检查',
    status: probeSeverity(findings),
    findings,
    durationMs: Date.now() - start,
  }
}

// ── Network Probe ─────────────────────────────────────────────────

async function runNetworkProbe(baseUrl: string): Promise<DiagProbe> {
  const findings: DiagFinding[] = []
  const start = Date.now()

  // Check proxy env
  const httpProxy = process.env.HTTP_PROXY || process.env.http_proxy
  const httpsProxy = process.env.HTTPS_PROXY || process.env.https_proxy
  if (httpsProxy || httpProxy) {
    findings.push({
      severity: 'pass',
      message: '检测到代理设置',
      detail: httpsProxy ? `HTTPS_PROXY=${httpsProxy}` : `HTTP_PROXY=${httpProxy}`,
    })
  } else {
    findings.push({ severity: 'pass', message: '未使用代理 (直连)' })
  }

  // HEAD request to origin
  let origin: string
  try {
    origin = new URL(baseUrl).origin
  } catch {
    findings.push({ severity: 'error', message: 'Base URL 无法解析，跳过网络探测' })
    return { name: '网络探测', status: probeSeverity(findings), findings, durationMs: Date.now() - start }
  }

  try {
    const res = await fetch(origin, {
      method: 'HEAD',
      signal: AbortSignal.timeout(6000),
      headers: { 'User-Agent': 'HappyCode-Doctor/1.0' },
    })
    const ms = Date.now() - start
    findings.push({
      severity: 'pass',
      message: `${origin} 可达`,
      detail: `HTTP ${res.status} · ${ms}ms`,
    })
  } catch (err) {
    const ms = Date.now() - start
    const msg = err instanceof Error ? err.message : String(err)
    const isTimeout = msg.toLowerCase().includes('abort') || msg.toLowerCase().includes('timeout')
    findings.push({
      severity: isTimeout ? 'warn' : 'error',
      message: isTimeout ? `连接超时 (${ms}ms)` : `无法连接到 ${origin}`,
      detail: msg,
    })
  }

  return {
    name: '网络探测',
    status: probeSeverity(findings),
    findings,
    durationMs: Date.now() - start,
  }
}

// ── API Probe ─────────────────────────────────────────────────────

function hasNonLatinChars(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    if (s.charCodeAt(i) > 255) return true
  }
  return false
}

async function runApiProbe(provider: {
  baseUrl: string
  apiKey: string
  apiFormat: ApiFormat
}): Promise<DiagProbe> {
  const findings: DiagFinding[] = []
  const start = Date.now()

  if (!provider.apiKey.trim()) {
    findings.push({ severity: 'warn', message: 'API Key 为空，跳过 API 探测' })
    return { name: 'API 探测', status: 'warn', findings, durationMs: Date.now() - start }
  }

  try {
    const base = provider.baseUrl.replace(/\/$/, '')

    if (hasNonLatinChars(base) || hasNonLatinChars(provider.apiKey)) {
      findings.push({ severity: 'error', message: 'API 请求失败', detail: 'Base URL 或 API Key 包含非 ASCII 字符，请检查输入' })
      return { name: 'API 探测', status: 'error', findings, durationMs: Date.now() - start }
    }

    const url = `${base}/v1/models`
    const headers: Record<string, string> = {}

    if (provider.apiFormat === 'anthropic') {
      headers['x-api-key'] = provider.apiKey
      headers['anthropic-version'] = '2023-06-01'
    } else {
      headers['Authorization'] = `Bearer ${provider.apiKey}`
    }

    const res = await fetch(url, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(10000),
    })
    const ms = Date.now() - start

    if (res.ok) {
      let modelCount = 0
      try {
        const body = await res.json() as unknown
        if (typeof body === 'object' && body !== null && 'data' in body && Array.isArray((body as { data: unknown[] }).data)) {
          modelCount = (body as { data: unknown[] }).data.length
        }
      } catch { /* ignore */ }
      findings.push({
        severity: 'pass',
        message: `API 认证成功`,
        detail: modelCount > 0 ? `返回 ${modelCount} 个模型 · ${ms}ms` : `HTTP 200 · ${ms}ms`,
      })
    } else if (res.status === 401) {
      findings.push({
        severity: 'error',
        message: 'API Key 无效 (401 Unauthorized)',
        detail: `请检查 API Key 是否正确 · ${ms}ms`,
      })
    } else if (res.status === 403) {
      findings.push({
        severity: 'error',
        message: 'API Key 权限不足 (403 Forbidden)',
        detail: `${ms}ms`,
      })
    } else if (res.status === 404) {
      findings.push({
        severity: 'warn',
        message: `/v1/models 端点不存在 (404)`,
        detail: `服务商可能使用不同的 API 路径，但基础连接正常 · ${ms}ms`,
      })
    } else {
      findings.push({
        severity: 'warn',
        message: `收到意外响应 HTTP ${res.status}`,
        detail: `${ms}ms`,
      })
    }
  } catch (err) {
    const ms = Date.now() - start
    const msg = err instanceof Error ? err.message : String(err)
    findings.push({
      severity: 'error',
      message: 'API 请求失败',
      detail: `${msg} · ${ms}ms`,
    })
  }

  return {
    name: 'API 探测',
    status: probeSeverity(findings),
    findings,
    durationMs: Date.now() - start,
  }
}

// ── Main Diagnosis ────────────────────────────────────────────────

export async function diagnoseProvider(id: string): Promise<DiagResult> {
  const start = Date.now()

  const { providers } = await listProviders()
  const provider = providers.find((p) => p.id === id)
  if (!provider) throw new Error(`Provider not found: ${id}`)

  const [configProbe, networkProbe, apiProbe] = await Promise.all([
    runConfigProbe(provider),
    runNetworkProbe(provider.baseUrl),
    runApiProbe(provider),
  ])

  const probes = [configProbe, networkProbe, apiProbe]

  let overall: DiagSeverity = 'pass'
  for (const p of probes) overall = maxSeverity(overall, p.status)

  return {
    overall,
    probes,
    timestamp: new Date().toISOString(),
    durationMs: Date.now() - start,
  }
}
