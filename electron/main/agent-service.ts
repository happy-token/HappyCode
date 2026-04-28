import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'
import type { AgentDefinition, AgentSource } from '../shared/types'

// ── Frontmatter ─────────────────────────────────────────────

interface Frontmatter {
  name?: string
  description?: string
  tools?: string[]
  model?: string
  [key: string]: unknown
}

function parseFrontmatter(content: string): { frontmatter: Frontmatter; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  if (!match) return { frontmatter: {}, body: content }

  const yamlText = match[1]
  const body = match[2].trim()
  const frontmatter: Frontmatter = {}

  for (const line of yamlText.split('\n')) {
    const colonIdx = line.indexOf(':')
    if (colonIdx === -1) continue
    const key = line.slice(0, colonIdx).trim()
    const rawVal = line.slice(colonIdx + 1).trim()

    if (key === 'tools') {
      if (rawVal.startsWith('[')) {
        try {
          frontmatter.tools = JSON.parse(rawVal) as string[]
        } catch {
          frontmatter.tools = rawVal
            .replace(/[\[\]"]/g, '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        }
      } else {
        frontmatter.tools = rawVal.split(',').map((s) => s.trim()).filter(Boolean)
      }
    } else {
      frontmatter[key] = rawVal
    }
  }

  return { frontmatter, body }
}

function agentFromFile(
  filePath: string,
  source: AgentSource,
  plugin?: string,
): AgentDefinition | null {
  let content: string
  try {
    content = fs.readFileSync(filePath, 'utf-8')
  } catch {
    return null
  }
  const { frontmatter, body } = parseFrontmatter(content)
  const agentType = (frontmatter.name as string | undefined) ?? path.basename(filePath, '.md')

  return {
    agentType,
    source,
    plugin,
    description: frontmatter.description as string | undefined,
    systemPrompt: body || undefined,
    tools: frontmatter.tools,
    modelDisplay: frontmatter.model as string | undefined,
    isActive: true,
    baseDir: path.dirname(filePath),
  }
}

// ── Plugin detection ─────────────────────────────────────────

interface PluginInstall {
  scope: string
  installPath: string
}

interface InstalledPluginsJson {
  plugins: Record<string, PluginInstall[]>
}

function getEnabledPluginInstalls(home: string): Map<string, string> {
  // Returns Map<pluginId, installPath> for user-scope, enabled plugins
  const result = new Map<string, string>()
  try {
    const settingsPath = path.join(home, '.claude', 'settings.json')
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8')) as Record<string, unknown>
    const enabledMap = (settings.enabledPlugins ?? {}) as Record<string, boolean>
    const enabledIds = new Set(
      Object.entries(enabledMap)
        .filter(([, v]) => v)
        .map(([k]) => k),
    )
    if (enabledIds.size === 0) return result

    const installedPath = path.join(home, '.claude', 'plugins', 'installed_plugins.json')
    const data = JSON.parse(fs.readFileSync(installedPath, 'utf-8')) as InstalledPluginsJson

    for (const [pluginId, installs] of Object.entries(data.plugins)) {
      if (!enabledIds.has(pluginId)) continue
      const userInstall = installs.find((i) => i.scope === 'user')
      if (!userInstall) continue
      result.set(pluginId, userInstall.installPath)
    }
  } catch {
    // ignore missing files
  }
  return result
}

// Map<filename.md, {pluginId, content}>
function buildPluginAgentIndex(home: string): Map<string, { pluginId: string; content: string }> {
  const index = new Map<string, { pluginId: string; content: string }>()
  const installs = getEnabledPluginInstalls(home)

  for (const [pluginId, installPath] of installs) {
    const agentsDir = path.join(installPath, 'agents')
    if (!fs.existsSync(agentsDir)) continue

    for (const entry of fs.readdirSync(agentsDir, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith('.md')) continue
      if (index.has(entry.name)) continue // first plugin wins
      try {
        const content = fs.readFileSync(path.join(agentsDir, entry.name), 'utf-8')
        index.set(entry.name, { pluginId, content })
      } catch {
        continue
      }
    }
  }

  return index
}

// ── Loading ──────────────────────────────────────────────────

function loadPluginAgents(home: string): AgentDefinition[] {
  const agents: AgentDefinition[] = []
  const installs = getEnabledPluginInstalls(home)

  for (const [pluginId, installPath] of installs) {
    const agentsDir = path.join(installPath, 'agents')
    if (!fs.existsSync(agentsDir)) continue

    // Derive a short display name: "ecc@ecc" → "ecc"
    const pluginName = pluginId.split('@')[0]

    for (const entry of fs.readdirSync(agentsDir, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith('.md')) continue
      const agent = agentFromFile(path.join(agentsDir, entry.name), 'plugin', pluginName)
      if (agent) agents.push(agent)
    }
  }

  return agents
}

function loadUserAgents(
  userDir: string,
  pluginIndex: Map<string, { pluginId: string; content: string }>,
): AgentDefinition[] {
  const agents: AgentDefinition[] = []
  if (!fs.existsSync(userDir)) return agents

  for (const entry of fs.readdirSync(userDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue

    const filePath = path.join(userDir, entry.name)
    const pluginMatch = pluginIndex.get(entry.name)

    if (pluginMatch) {
      // Compare content — if identical to plugin version, skip (it's the installed copy)
      try {
        const userContent = fs.readFileSync(filePath, 'utf-8')
        if (userContent === pluginMatch.content) continue
      } catch {
        continue
      }
      // Content differs → user modified the plugin agent, show as userSettings override
    }

    const agent = agentFromFile(filePath, 'userSettings')
    if (agent) agents.push(agent)
  }

  return agents
}

function loadDirAgents(dir: string, source: AgentSource): AgentDefinition[] {
  const agents: AgentDefinition[] = []
  if (!fs.existsSync(dir)) return agents

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue
    const agent = agentFromFile(path.join(dir, entry.name), source)
    if (agent) agents.push(agent)
  }

  return agents
}

// ── Public API ───────────────────────────────────────────────

export function listAgents(cwd?: string): { agents: AgentDefinition[]; activeAgents: string[] } {
  const home = (() => { try { return app.getPath('home') } catch { return '' } })()
  const agents: AgentDefinition[] = []

  // 1. Plugin agents (from plugin install directories)
  agents.push(...loadPluginAgents(home))

  // 2. User agents (~/.claude/agents/) — skip identical plugin copies
  if (home) {
    const userDir = path.join(home, '.claude', 'agents')
    const pluginIndex = buildPluginAgentIndex(home)
    agents.push(...loadUserAgents(userDir, pluginIndex))
  }

  // 3. Project agents
  if (cwd) {
    agents.push(...loadDirAgents(path.join(cwd, '.claude', 'agents'), 'projectSettings'))
    agents.push(...loadDirAgents(path.join(cwd, '.claude', 'agents.local'), 'localSettings'))
  }

  return {
    agents,
    activeAgents: agents.map((a) => a.agentType),
  }
}

export function getAgentDetail(
  agentType: string,
  source: AgentSource,
  cwd?: string,
): AgentDefinition | null {
  const { agents } = listAgents(cwd)
  return agents.find((a) => a.agentType === agentType && a.source === source) ?? null
}
