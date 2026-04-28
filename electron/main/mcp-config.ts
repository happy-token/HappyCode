import fs from 'fs'
import path from 'path'
import os from 'os'
import type { McpServerConfig, McpScope } from '../shared/types'
export type { McpScope }

export interface McpServerRecord {
  name: string
  config: McpServerConfig
  transport: 'stdio' | 'http' | 'sse'
  scope: McpScope
  enabled: boolean
  configLocation: string
  status?: string
  statusLabel?: string
  summary?: string
  canToggle?: boolean
  canEdit?: boolean
  canRemove?: boolean
  canReconnect?: boolean
}

/** Resolve the user-level Claude config file path */
function getUserClaudeConfigPath(): string {
  const claudeHome = process.env.CLAUDE_CONFIG_DIR || os.homedir()
  // Check for legacy .config.json first
  const legacyPath = path.join(claudeHome, '.claude', '.config.json')
  if (fs.existsSync(legacyPath)) return legacyPath
  // Primary: ~/.claude.json (or with oauth suffix — we just check both)
  const primaryPath = path.join(claudeHome, '.claude.json')
  if (fs.existsSync(primaryPath)) return primaryPath
  const oauthPath = path.join(claudeHome, '.claude-oauth.json')
  if (fs.existsSync(oauthPath)) return oauthPath
  // Also check ~/.claude/settings.json for mcpServers
  const settingsPath = path.join(os.homedir(), '.claude', 'settings.json')
  if (fs.existsSync(settingsPath)) return settingsPath
  return ''
}

/** Parse mcpServers from a JSON file if present */
function readMcpServersFromFile(filePath: string): Record<string, McpServerConfig> | null {
  if (!filePath || !fs.existsSync(filePath)) return null
  try {
    const raw = fs.readFileSync(filePath, 'utf-8')
    const parsed: unknown = JSON.parse(raw)
    if (parsed !== null && typeof parsed === 'object' && 'mcpServers' in parsed) {
      const mcpServers = (parsed as Record<string, unknown>).mcpServers
      if (mcpServers !== null && typeof mcpServers === 'object' && !Array.isArray(mcpServers)) {
        return mcpServers as Record<string, McpServerConfig>
      }
    }
  } catch { /* ignore parse errors */ }
  return null
}

/** Get list of enabled plugin directories from ~/.claude/settings.json */
function getEnabledPluginPaths(): Array<{ name: string; mcpJsonPath: string }> {
  const settingsPath = path.join(os.homedir(), '.claude', 'settings.json')
  if (!fs.existsSync(settingsPath)) return []

  try {
    const raw = fs.readFileSync(settingsPath, 'utf-8')
    const settings = JSON.parse(raw) as Record<string, unknown>
    const enabledPlugins = settings.enabledPlugins as Record<string, unknown> | undefined
    if (!enabledPlugins) return []

    const result: Array<{ name: string; mcpJsonPath: string }> = []
    const pluginCacheDir = path.join(os.homedir(), '.claude', 'plugins', 'cache')

    for (const [key] of Object.entries(enabledPlugins)) {
      // Key format: "pluginName@pluginName" (e.g. "ecc@ecc")
      if (!key.includes('@')) continue
      const [pluginName] = key.split('@')
      if (!pluginName) continue

      const pluginBaseDir = path.join(pluginCacheDir, pluginName, pluginName)
      if (!fs.existsSync(pluginBaseDir)) continue

      // Find the version directory (e.g. "1.10.0")
      const entries = fs.readdirSync(pluginBaseDir)
      for (const version of entries) {
        const mcpJsonPath = path.join(pluginBaseDir, version, '.mcp.json')
        if (fs.existsSync(mcpJsonPath)) {
          result.push({ name: pluginName, mcpJsonPath })
          break
        }
      }
    }
    return result
  } catch { return [] }
}

/** Read MCP servers from all scopes and merge them */
export function readAllMcpServers(cwd?: string): McpServerRecord[] {
  const result: McpServerRecord[] = []
  const seen = new Set<string>()

  // 1. Plugin scope: read .mcp.json from enabled plugins
  const pluginPaths = getEnabledPluginPaths()
  for (const { name, mcpJsonPath } of pluginPaths) {
    const servers = readMcpServersFromFile(mcpJsonPath)
    if (servers) {
      for (const [serverName, config] of Object.entries(servers)) {
        if (!seen.has(serverName)) {
          seen.add(serverName)
          const namespacedName = `plugin:${name}:${serverName}`
          result.push({
            name: namespacedName,
            config,
            transport: config.type ?? 'stdio',
            scope: 'plugin',
            enabled: true,
            configLocation: `${name}/.mcp.json`,
          })
        }
      }
    }
  }

  // 2. Local scope: <cwd>/.claude/settings.json
  if (cwd) {
    const localPath = path.join(cwd, '.claude', 'settings.json')
    const servers = readMcpServersFromFile(localPath)
    if (servers) {
      for (const [name, config] of Object.entries(servers)) {
        if (!seen.has(name)) {
          seen.add(name)
          result.push({
            name,
            config,
            transport: config.type ?? 'stdio',
            scope: 'local',
            enabled: true,
            configLocation: localPath,
          })
        }
      }
    }
  }

  // 3. Project scope: <cwd>/.mcp.json (and parent dirs, closer wins)
  if (cwd) {
    const dirs: string[] = []
    let current = cwd
    while (true) {
      dirs.push(current)
      const parent = path.dirname(current)
      if (parent === current) break
      current = parent
    }
    for (const dir of dirs.reverse()) {
      const projectPath = path.join(dir, '.mcp.json')
      const servers = readMcpServersFromFile(projectPath)
      if (servers) {
        for (const [name, config] of Object.entries(servers)) {
          if (!seen.has(name)) {
            seen.add(name)
            result.push({
              name,
              config,
              transport: config.type ?? 'stdio',
              scope: 'project',
              enabled: true,
              configLocation: projectPath,
            })
          }
        }
      }
    }
  }

  // 4. User scope: ~/.claude.json
  const userPath = getUserClaudeConfigPath()
  const userServers = readMcpServersFromFile(userPath)
  if (userServers) {
    for (const [name, config] of Object.entries(userServers)) {
      if (!seen.has(name)) {
        seen.add(name)
        result.push({
          name,
          config,
          transport: config.type ?? 'stdio',
          scope: 'user',
          enabled: true,
          configLocation: userPath.replace(os.homedir(), '~'),
        })
      }
    }
  }

  return result
}

/** Save MCP servers to the user-level config file */
export function saveMcpServersToUserConfig(servers: Record<string, McpServerConfig>): void {
  const userPath = getUserClaudeConfigPath()
  if (!userPath) return

  let existing: Record<string, unknown> = {}
  if (fs.existsSync(userPath)) {
    try {
      existing = JSON.parse(fs.readFileSync(userPath, 'utf-8')) as Record<string, unknown>
    } catch { /* start fresh */ }
  }

  existing.mcpServers = servers
  fs.writeFileSync(userPath, JSON.stringify(existing, null, 2), 'utf-8')
}

/** Delete a server from the user-level config */
export function deleteMcpServerFromUserConfig(serverName: string): void {
  const userPath = getUserClaudeConfigPath()
  if (!userPath || !fs.existsSync(userPath)) return

  try {
    const existing = JSON.parse(fs.readFileSync(userPath, 'utf-8')) as Record<string, unknown>
    if (existing.mcpServers && typeof existing.mcpServers === 'object') {
      const mcpServers = existing.mcpServers as Record<string, unknown>
      delete mcpServers[serverName]
      existing.mcpServers = mcpServers
      fs.writeFileSync(userPath, JSON.stringify(existing, null, 2), 'utf-8')
    }
  } catch { /* ignore */ }
}

/** Determine initial server status based on transport type */
export async function getInitialServerStatus(servers: McpServerRecord[]): Promise<McpServerRecord[]> {
  // Mark all servers as "checking" — real connection status is determined at runtime
  // when the Agent actually starts and the MCP SDK establishes connections.
  return servers.map((s) => ({
    ...s,
    status: 'checking' as const,
    statusLabel: '检查中',
  })) as McpServerRecord[]
}