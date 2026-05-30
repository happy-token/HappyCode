import { describe, it, expect } from 'vitest'
import {
  apiConfigSchema,
  agentSettingsSchema,
  exportSettingsSchema,
  agentStartParamsSchema,
  providerConfigSchema,
} from '../electron/main/config-schemas'

describe('apiConfigSchema', () => {
  it('accepts valid config', () => {
    const result = apiConfigSchema.safeParse({ baseUrl: 'https://api.example.com', authToken: 'sk-xxx' })
    expect(result.success).toBe(true)
  })

  it('rejects missing baseUrl', () => {
    const result = apiConfigSchema.safeParse({ authToken: 'sk-xxx' })
    expect(result.success).toBe(false)
  })

  it('accepts empty strings', () => {
    const result = apiConfigSchema.safeParse({ baseUrl: '', authToken: '' })
    expect(result.success).toBe(true)
  })
})

describe('agentSettingsSchema', () => {
  it('accepts empty object', () => {
    const result = agentSettingsSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('accepts full settings', () => {
    const result = agentSettingsSchema.safeParse({
      permissionMode: 'default',
      maxTurns: 50,
      allowedTools: 'Read,Write',
      thinking: 'enabled',
      maxThinkingTokens: 10000,
      effort: 'high',
      context1mBeta: true,
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid permissionMode', () => {
    const result = agentSettingsSchema.safeParse({ permissionMode: 'superuser' })
    expect(result.success).toBe(false)
  })

  it('rejects negative maxTurns', () => {
    const result = agentSettingsSchema.safeParse({ maxTurns: -1 })
    expect(result.success).toBe(false)
  })

  it('rejects invalid effort level', () => {
    const result = agentSettingsSchema.safeParse({ effort: 'extreme' })
    expect(result.success).toBe(false)
  })
})

describe('exportSettingsSchema', () => {
  it('accepts valid settings', () => {
    const result = exportSettingsSchema.safeParse({ redactMode: 'full', customPatterns: [] })
    expect(result.success).toBe(true)
  })

  it('accepts custom patterns', () => {
    const result = exportSettingsSchema.safeParse({
      redactMode: 'custom',
      customPatterns: ['sk-.*', 'Bearer\\s+\\S+'],
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid redactMode', () => {
    const result = exportSettingsSchema.safeParse({ redactMode: 'none', customPatterns: [] })
    expect(result.success).toBe(false)
  })
})

describe('agentStartParamsSchema', () => {
  it('accepts minimal params', () => {
    const result = agentStartParamsSchema.safeParse({ prompt: 'hello', cwd: '/tmp' })
    expect(result.success).toBe(true)
  })

  it('rejects empty cwd', () => {
    const result = agentStartParamsSchema.safeParse({ prompt: 'hello', cwd: '' })
    expect(result.success).toBe(false)
  })

  it('accepts full params with attachments', () => {
    const result = agentStartParamsSchema.safeParse({
      prompt: 'analyze this',
      cwd: '/project',
      model: 'claude-sonnet-4-6',
      apiConfig: { baseUrl: 'https://api.example.com', authToken: 'sk-xxx' },
      agentSettings: { permissionMode: 'acceptEdits' },
      attachments: [{ name: 'screenshot.png', mimeType: 'image/png', data: 'base64data' }],
    })
    expect(result.success).toBe(true)
  })
})

describe('providerConfigSchema', () => {
  it('accepts valid provider', () => {
    const result = providerConfigSchema.safeParse({
      id: 'p1',
      name: 'My Provider',
      baseUrl: 'https://api.example.com',
      apiFormat: 'openai_chat',
      apiKey: 'sk-xxx',
      models: { main: 'gpt-4', haiku: 'gpt-4-mini', sonnet: 'gpt-4', opus: 'gpt-4' },
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid apiFormat', () => {
    const result = providerConfigSchema.safeParse({
      id: 'p1',
      name: 'Bad',
      baseUrl: 'https://x.com',
      apiFormat: 'graphql',
      apiKey: 'sk',
      models: { main: 'm', haiku: 'm', sonnet: 'm', opus: 'm' },
    })
    expect(result.success).toBe(false)
  })
})
