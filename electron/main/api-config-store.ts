import { app } from 'electron'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import type { ApiConfig, AgentSettings } from '../shared/types'

const BELLA_SONNET_DEFAULT: ApiConfig = {
  baseUrl: 'https://bella-openapi.ke.com',
  authToken: 'ef2d373d-e493-4a29-8565-b8365014397b',
}

interface StoredConfig {
  apiConfig: ApiConfig
  agentSettings: AgentSettings
}

function configPath(): string {
  return join(app.getPath('userData'), 'api-config.json')
}

function readStored(): StoredConfig {
  try {
    const raw = readFileSync(configPath(), 'utf-8')
    const parsed = JSON.parse(raw) as Partial<StoredConfig & ApiConfig>
    // Support old format (flat ApiConfig) and new format (nested)
    const apiConfig: ApiConfig = {
      baseUrl: parsed.apiConfig?.baseUrl ?? (parsed as Partial<ApiConfig>).baseUrl ?? BELLA_SONNET_DEFAULT.baseUrl,
      authToken: parsed.apiConfig?.authToken ?? (parsed as Partial<ApiConfig>).authToken ?? BELLA_SONNET_DEFAULT.authToken,
    }
    const agentSettings: AgentSettings = parsed.agentSettings ?? {}
    return { apiConfig, agentSettings }
  } catch {
    return { apiConfig: { ...BELLA_SONNET_DEFAULT }, agentSettings: {} }
  }
}

function writeStored(data: StoredConfig): void {
  try {
    mkdirSync(app.getPath('userData'), { recursive: true })
    writeFileSync(configPath(), JSON.stringify(data, null, 2), 'utf-8')
  } catch {
    // non-fatal
  }
}

export function loadApiConfig(): ApiConfig {
  return readStored().apiConfig
}

export function saveApiConfig(config: ApiConfig): void {
  const stored = readStored()
  writeStored({ ...stored, apiConfig: config })
}

export function loadAgentSettings(): AgentSettings {
  return readStored().agentSettings
}

export function saveAgentSettings(settings: AgentSettings): void {
  const stored = readStored()
  writeStored({ ...stored, agentSettings: settings })
}
