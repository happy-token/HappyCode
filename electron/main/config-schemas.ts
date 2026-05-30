import { z } from 'zod'

// Reused from shared/types but with runtime validation

export const apiConfigSchema = z.object({
  baseUrl: z.string(),
  authToken: z.string(),
})

export const permissionModeSchema = z.enum([
  'default',
  'acceptEdits',
  'bypassPermissions',
  'plan',
  'dontAsk',
  'auto',
])

export const thinkingModeSchema = z.enum(['adaptive', 'enabled', 'disabled'])
export const effortLevelSchema = z.enum(['low', 'medium', 'high', 'xhigh'])

export const agentSettingsSchema = z.object({
  permissionMode: permissionModeSchema.optional(),
  maxTurns: z.number().int().positive().optional(),
  allowedTools: z.string().optional(),
  disallowedTools: z.string().optional(),
  systemPrompt: z.string().optional(),
  appendSystemPrompt: z.string().optional(),
  additionalDirectories: z.string().optional(),
  thinking: thinkingModeSchema.optional(),
  maxThinkingTokens: z.number().int().positive().optional(),
  effort: effortLevelSchema.optional(),
  maxBudgetUsd: z.number().positive().optional(),
  fallbackModel: z.string().optional(),
  context1mBeta: z.boolean().optional(),
  enableFileCheckpointing: z.boolean().optional(),
  mcpServersJson: z.string().optional(),
})

export const exportRedactModeSchema = z.enum(['full', 'tools-only', 'custom'])

export const exportSettingsSchema = z.object({
  redactMode: exportRedactModeSchema,
  customPatterns: z.array(z.string()),
})

export const agentStartParamsSchema = z.object({
  prompt: z.string(),
  cwd: z.string().min(1),
  resumeId: z.string().optional(),
  model: z.string().optional(),
  apiConfig: apiConfigSchema.optional(),
  agentSettings: agentSettingsSchema.optional(),
  attachments: z.array(z.object({
    name: z.string(),
    mimeType: z.enum(['image/jpeg', 'image/png', 'image/gif', 'image/webp']),
    data: z.string(),
  })).optional(),
})

export const providerConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  baseUrl: z.string(),
  apiFormat: z.enum(['anthropic', 'openai_chat']),
  apiKey: z.string(),
  models: z.object({
    main: z.string(),
    haiku: z.string(),
    sonnet: z.string(),
    opus: z.string(),
  }),
})

// Type exports derived from schemas
export type ApiConfig = z.infer<typeof apiConfigSchema>
export type AgentSettings = z.infer<typeof agentSettingsSchema>
export type ExportSettings = z.infer<typeof exportSettingsSchema>
export type AgentStartParams = z.infer<typeof agentStartParamsSchema>
export type ProviderConfig = z.infer<typeof providerConfigSchema>
