/**
 * IPC Handler Coordinator — delegates to domain modules under ipc/
 *
 * Domain mapping:
 *   ipc/hook-handlers.ts     → hook:*
 *   ipc/session-handlers.ts  → session:*, export:csv
 *   ipc/agent-handlers.ts    → agent:*
 *   ipc/config-handlers.ts   → config:*, settings:*
 *   ipc/skills-handlers.ts   → skills:*, plugins:*
 *   ipc/history-handlers.ts  → history:*
 *   ipc/file-handlers.ts     → file:*, fs:*
 *   ipc/misc-handlers.ts     → commands:*, system:open-url
 *   ipc/system-handlers.ts   → app:*, computer-use:*, apps:*
 *   ipc/git-handlers.ts      → git:*, fs:git-status
 *   ipc/provider-handlers.ts → providers:*
 *   ipc/mcp-handlers.ts      → mcp:*, agents:*
 *   ipc/auth-handlers.ts     → auth:*, dialog:*
 *   ipc/export-handlers.ts   → export:pdf, export:markdown, preview:*
 */
import { BrowserWindow } from 'electron'
import type { SessionStore } from './session-store'
import type { AgentManager } from './agent-manager'
import { registerHookHandlers } from './ipc/hook-handlers'
import { registerSessionHandlers } from './ipc/session-handlers'
import { registerAgentHandlers } from './ipc/agent-handlers'
import { registerConfigHandlers } from './ipc/config-handlers'
import { registerSkillsHandlers } from './ipc/skills-handlers'
import { registerHistoryHandlers } from './ipc/history-handlers'
import { registerFileHandlers } from './ipc/file-handlers'
import { registerMiscHandlers } from './ipc/misc-handlers'
import { registerSystemHandlers } from './ipc/system-handlers'
import { registerGitHandlers } from './ipc/git-handlers'
import { registerProviderHandlers } from './ipc/provider-handlers'
import { registerMcpHandlers } from './ipc/mcp-handlers'
import { registerAuthHandlers } from './ipc/auth-handlers'
import { registerExportHandlers } from './ipc/export-handlers'

export function registerIpcHandlers(
  store: SessionStore,
  agentManager: AgentManager,
  createPreviewWindow: (filePath: string) => BrowserWindow,
): void {
  registerHookHandlers(store)
  registerSessionHandlers(store)
  registerAgentHandlers(agentManager)
  registerConfigHandlers()
  registerSkillsHandlers()
  registerHistoryHandlers(store)
  registerFileHandlers(store)
  registerMiscHandlers()
  registerSystemHandlers()
  registerGitHandlers()
  registerProviderHandlers()
  registerMcpHandlers()
  registerAuthHandlers()
  registerExportHandlers(store, createPreviewWindow)
}
