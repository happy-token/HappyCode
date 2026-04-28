import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'
import type { ProviderConfig, ProviderPreset, ApiFormat, ProviderTestResult } from '../shared/types'

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: 'anthropic',
    name: 'Anthropic',
    baseUrl: 'https://api.anthropic.com',
    apiFormat: 'anthropic',
    defaultModels: { main: 'claude-sonnet-4-6-20250514', haiku: 'claude-haiku-4-5-20251001', sonnet: 'claude-sonnet-4-6-20250514', opus: 'claude-opus-4-7-20250514' },
    needsApiKey: true,
    websiteUrl: 'https://www.anthropic.com',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com',
    apiFormat: 'openai_chat',
    defaultModels: { main: 'gpt-4o', haiku: 'gpt-4o-mini', sonnet: 'gpt-4o', opus: 'o1' },
    needsApiKey: true,
    websiteUrl: 'https://platform.openai.com',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com',
    apiFormat: 'openai_chat',
    defaultModels: { main: 'deepseek-chat', haiku: 'deepseek-chat', sonnet: 'deepseek-chat', opus: 'deepseek-reasoner' },
    needsApiKey: true,
    websiteUrl: 'https://platform.deepseek.com',
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    apiFormat: 'openai_chat',
    defaultModels: { main: 'gemini-2.0-flash', haiku: 'gemini-2.0-flash-lite', sonnet: 'gemini-2.0-flash', opus: 'gemini-2.5-pro-preview-05-06' },
    needsApiKey: true,
    websiteUrl: 'https://aistudio.google.com',
  },
  {
    id: 'siliconflow',
    name: 'SiliconFlow',
    baseUrl: 'https://api.siliconflow.cn',
    apiFormat: 'openai_chat',
    defaultModels: { main: 'Qwen/Qwen3-8B', haiku: 'Qwen/Qwen3-8B', sonnet: 'Qwen/Qwen3-30B-A3B', opus: 'Qwen/Qwen3-235B-A22B' },
    needsApiKey: true,
    websiteUrl: 'https://siliconflow.cn',
  },
  {
    id: 'ollama',
    name: 'Ollama',
    baseUrl: 'http://localhost:11434/v1',
    apiFormat: 'openai_chat',
    defaultModels: { main: 'llama3.2', haiku: 'llama3.2', sonnet: 'llama3.2', opus: 'llama3.2' },
    needsApiKey: false,
    websiteUrl: 'https://ollama.com',
  },
  {
    id: 'custom',
    name: 'Custom',
    baseUrl: '',
    apiFormat: 'openai_chat',
    defaultModels: { main: '', haiku: '', sonnet: '', opus: '' },
    needsApiKey: true,
    websiteUrl: '',
  },
]

const PROVIDERS_FILE = 'providers.json'
const ACTIVE_FILE = 'active-provider.json'

function getConfigDir(overrideDir?: string): string {
  if (overrideDir) return overrideDir
  const userData = app.getPath('userData')
  fs.mkdirSync(userData, { recursive: true })
  return userData
}

function providersPath(overrideDir?: string): string {
  return path.join(getConfigDir(overrideDir), PROVIDERS_FILE)
}

function activePath(overrideDir?: string): string {
  return path.join(getConfigDir(overrideDir), ACTIVE_FILE)
}

function readProviders(overrideDir?: string): ProviderConfig[] {
  const filePath = providersPath(overrideDir)
  if (!fs.existsSync(filePath)) return []
  try {
    const raw = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(raw) as ProviderConfig[]
  } catch {
    return []
  }
}

function writeProviders(providers: ProviderConfig[], overrideDir?: string): void {
  fs.writeFileSync(providersPath(overrideDir), JSON.stringify(providers, null, 2), 'utf-8')
}

function generateId(): string {
  return `provider_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export async function saveProvider(
  input: Omit<ProviderConfig, 'id'>,
  overrideDir?: string,
): Promise<{ id: string }> {
  const providers = readProviders(overrideDir)
  const id = generateId()
  const provider: ProviderConfig = { ...input, id }
  providers.push(provider)
  writeProviders(providers, overrideDir)

  if (providers.length === 1) {
    await activateProvider(id, overrideDir)
  }

  return { id }
}

export async function listProviders(
  overrideDir?: string,
): Promise<{ providers: ProviderConfig[]; activeId: string | null }> {
  const providers = readProviders(overrideDir)
  const activeId = await getActiveProvider(overrideDir)
  return { providers, activeId }
}

export async function deleteProvider(
  id: string,
  overrideDir?: string,
): Promise<void> {
  const providers = readProviders(overrideDir)
  const activeId = await getActiveProvider(overrideDir)
  const filtered = providers.filter((p) => p.id !== id)
  writeProviders(filtered, overrideDir)

  if (activeId === id) {
    await activateOfficial(overrideDir)
  }
}

export async function updateProvider(
  id: string,
  updates: Partial<ProviderConfig>,
  overrideDir?: string,
): Promise<void> {
  const providers = readProviders(overrideDir)
  const idx = providers.findIndex((p) => p.id === id)
  if (idx === -1) throw new Error(`Provider not found: ${id}`)
  providers[idx] = { ...providers[idx], ...updates }
  writeProviders(providers, overrideDir)
}

export async function activateProvider(
  id: string,
  overrideDir?: string,
): Promise<void> {
  fs.writeFileSync(activePath(overrideDir), JSON.stringify({ id }), 'utf-8')
}

export async function activateOfficial(overrideDir?: string): Promise<void> {
  fs.writeFileSync(activePath(overrideDir), JSON.stringify({ id: null }), 'utf-8')
}

export async function getActiveProvider(overrideDir?: string): Promise<string | null> {
  const filePath = activePath(overrideDir)
  if (!fs.existsSync(filePath)) return null
  try {
    const raw = fs.readFileSync(filePath, 'utf-8')
    const parsed = JSON.parse(raw) as { id: string | null }
    return parsed.id
  } catch {
    return null
  }
}

export async function testProviderById(
  id: string,
  overrideDir?: string,
): Promise<ProviderTestResult> {
  const providers = readProviders(overrideDir)
  const provider = providers.find((p) => p.id === id)
  if (!provider) throw new Error(`Provider not found: ${id}`)
  return testProviderConfigFn({
    baseUrl: provider.baseUrl,
    apiKey: provider.apiKey,
    modelId: provider.models.main,
    apiFormat: provider.apiFormat,
  })
}

export async function testProviderConfigFn(config: {
  baseUrl: string
  apiKey: string
  modelId: string
  apiFormat: ApiFormat
}): Promise<ProviderTestResult> {
  const start = Date.now()
  try {
    const base = config.baseUrl.replace(/\/$/, '')
    const url = config.apiFormat === 'anthropic'
      ? `${base}/v1/models`
      : `${base}/v1/models`

    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (config.apiFormat === 'anthropic') {
      headers['x-api-key'] = config.apiKey
      headers['anthropic-version'] = '2023-06-01'
    } else {
      headers['Authorization'] = `Bearer ${config.apiKey}`
    }

    const res = await fetch(url, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(10000),
    })
    const latencyMs = Date.now() - start
    // 200 or 401 (bad key but reachable) both mean connectivity ok
    const reachable = res.status < 500
    return {
      connectivity: {
        success: reachable,
        latencyMs,
        error: reachable ? undefined : `HTTP ${res.status}`,
      },
    }
  } catch (err) {
    return {
      connectivity: {
        success: false,
        latencyMs: Date.now() - start,
        error: err instanceof Error ? err.message : 'Connection failed',
      },
    }
  }
}
