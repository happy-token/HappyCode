import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import type { SkillInfo, SkillSource, SkillsResult, PluginInfo, PluginsResult, InstallSkillResult, PluginReadmeResult, PluginOperationResult, PluginScope } from '../shared/types'

const execAsync = promisify(exec)

const HOME = os.homedir()
const SKILLS_DIR = path.join(HOME, '.claude', 'skills')
const SETTINGS_FILE = path.join(HOME, '.claude', 'settings.json')

// ── Plugin detection (mirrors agent-service pattern) ──────────

interface PluginInstall { scope: string; installPath: string }
interface InstalledPluginsJson { plugins: Record<string, PluginInstall[]> }

function getEnabledPluginInstalls(): Map<string, string> {
  const result = new Map<string, string>()
  try {
    const settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8')) as Record<string, unknown>
    const enabledMap = (settings.enabledPlugins ?? {}) as Record<string, boolean>
    const enabledIds = new Set(
      Object.entries(enabledMap).filter(([, v]) => v).map(([k]) => k),
    )
    if (enabledIds.size === 0) return result

    const installedPath = path.join(HOME, '.claude', 'plugins', 'installed_plugins.json')
    const data = JSON.parse(fs.readFileSync(installedPath, 'utf-8')) as InstalledPluginsJson
    for (const [pluginId, installs] of Object.entries(data.plugins)) {
      if (!enabledIds.has(pluginId)) continue
      const userInstall = installs.find((i) => i.scope === 'user')
      if (userInstall) result.set(pluginId, userInstall.installPath)
    }
  } catch { /* ignore missing files */ }
  return result
}

// Map<skillDirName, { pluginId, skillMdContent }>
function buildPluginSkillIndex(): Map<string, { pluginId: string; content: string }> {
  const index = new Map<string, { pluginId: string; content: string }>()
  for (const [pluginId, installPath] of getEnabledPluginInstalls()) {
    const skillsDir = path.join(installPath, 'skills')
    if (!fs.existsSync(skillsDir)) continue
    for (const entry of fs.readdirSync(skillsDir, { withFileTypes: true })) {
      if (!entry.isDirectory() || index.has(entry.name)) continue
      try {
        const content = fs.readFileSync(path.join(skillsDir, entry.name, 'SKILL.md'), 'utf-8')
        index.set(entry.name, { pluginId, content })
      } catch {
        index.set(entry.name, { pluginId, content: '' })
      }
    }
  }
  return index
}

function readSettings(): Record<string, unknown> {
  try {
    const raw = fs.readFileSync(SETTINGS_FILE, 'utf-8')
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    return {}
  }
}

function writeSettings(settings: Record<string, unknown>): void {
  const existing = readSettings()
  const merged = { ...existing, ...settings }
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(merged, null, 2), 'utf-8')
}

function getDisabledSkills(): string[] {
  const settings = readSettings()
  const disabled = settings['disabledSkills']
  return Array.isArray(disabled) ? (disabled as string[]) : []
}

function getSkillDescription(skillDir: string): string | undefined {
  const skillMd = path.join(skillDir, 'SKILL.md')
  if (!fs.existsSync(skillMd)) return undefined
  try {
    const content = fs.readFileSync(skillMd, 'utf-8')
    const firstLine = content.split('\n').find((l) => l.trim().length > 0)
    return firstLine?.replace(/^#+\s*/, '').slice(0, 80)
  } catch {
    return undefined
  }
}

function makeSkill(
  id: string,
  skillPath: string,
  source: SkillSource,
  disabled: Set<string>,
  plugin?: string,
): SkillInfo | null {
  let stat: fs.Stats
  try {
    stat = fs.statSync(skillPath)
  } catch {
    return null
  }
  return {
    id,
    name: id,
    path: skillPath,
    enabled: !disabled.has(id),
    description: getSkillDescription(skillPath),
    lastModified: stat.mtimeMs,
    source,
    plugin,
  }
}

export function listSkills(): SkillsResult {
  const disabled = new Set(getDisabledSkills())
  const pluginIndex = buildPluginSkillIndex()
  const skills: SkillInfo[] = []

  // 1. Plugin skills — from plugin install dirs
  for (const [pluginId, installPath] of getEnabledPluginInstalls()) {
    const skillsDir = path.join(installPath, 'skills')
    if (!fs.existsSync(skillsDir)) continue
    const pluginName = pluginId.split('@')[0]
    for (const entry of fs.readdirSync(skillsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const skill = makeSkill(entry.name, path.join(skillsDir, entry.name), 'plugin', disabled, pluginName)
      if (skill) skills.push(skill)
    }
  }

  // 2. User skills — skip identical plugin copies
  if (fs.existsSync(SKILLS_DIR)) {
    for (const entry of fs.readdirSync(SKILLS_DIR, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const skillPath = path.join(SKILLS_DIR, entry.name)
      const pluginMatch = pluginIndex.get(entry.name)
      if (pluginMatch) {
        try {
          const userContent = fs.readFileSync(path.join(skillPath, 'SKILL.md'), 'utf-8')
          if (userContent === pluginMatch.content) continue
        } catch { continue }
      }
      const skill = makeSkill(entry.name, skillPath, 'userSettings', disabled)
      if (skill) skills.push(skill)
    }
  }

  return { skills: skills.sort((a, b) => b.lastModified - a.lastModified) }
}

export async function installSkillFromGit(url: string, name?: string): Promise<InstallSkillResult> {
  if (!fs.existsSync(SKILLS_DIR)) {
    fs.mkdirSync(SKILLS_DIR, { recursive: true })
  }
  const repoName = name ?? url.split('/').pop()?.replace(/\.git$/, '') ?? 'skill'
  const destPath = path.join(SKILLS_DIR, repoName)
  if (fs.existsSync(destPath)) {
    return { success: false, error: `Skill "${repoName}" already exists` }
  }
  try {
    await execAsync(`git clone "${url}" "${destPath}"`, { timeout: 60000 })
    return { success: true }
  } catch (e: unknown) {
    return { success: false, error: String(e) }
  }
}

export function deleteSkill(skillId: string): void {
  const skillPath = path.join(SKILLS_DIR, skillId)
  if (!fs.existsSync(skillPath)) return
  fs.rmSync(skillPath, { recursive: true, force: true })
  // also remove from disabled list
  const disabled = getDisabledSkills().filter((s) => s !== skillId)
  writeSettings({ disabledSkills: disabled })
}

export function toggleSkill(skillId: string, enabled: boolean): void {
  const disabled = getDisabledSkills()
  const newDisabled = enabled
    ? disabled.filter((s) => s !== skillId)
    : [...new Set([...disabled, skillId])]
  writeSettings({ disabledSkills: newDisabled })
}

export function getSkillContent(skillPath: string): { content: string } {
  const skillMd = path.join(skillPath, 'SKILL.md')
  if (!fs.existsSync(skillMd)) return { content: '' }
  try {
    return { content: fs.readFileSync(skillMd, 'utf-8') }
  } catch {
    return { content: '' }
  }
}

interface PluginInstallEntry {
  scope: string
  installPath: string
  projectPath?: string
}

function getPluginInstallEntry(pluginId: string): PluginInstallEntry | undefined {
  try {
    const installedPath = path.join(HOME, '.claude', 'plugins', 'installed_plugins.json')
    const data = JSON.parse(fs.readFileSync(installedPath, 'utf-8')) as InstalledPluginsJson
    const installs = data.plugins[pluginId] as PluginInstallEntry[] | undefined
    if (!installs || installs.length === 0) return undefined
    return installs.find((i) => i.scope === 'user') ?? installs[installs.length - 1]
  } catch {
    return undefined
  }
}

function getPluginInstallPath(pluginId: string): string | undefined {
  return getPluginInstallEntry(pluginId)?.installPath
}

function countDirEntries(dirPath: string, filter: (name: string) => boolean): number {
  try {
    return fs.readdirSync(dirPath).filter(filter).length
  } catch {
    return 0
  }
}

export async function listPlugins(): Promise<PluginsResult> {
  try {
    const { stdout } = await execAsync('claude plugin list 2>/dev/null', { timeout: 10000 })
    const lines = stdout.split('\n')
    const plugins: PluginInfo[] = []

    let i = 0
    while (i < lines.length) {
      const line = lines[i].trim()
      if (line.startsWith('❯')) {
        const name = line.replace('❯', '').trim()
        let version: string | undefined
        let enabled = true

        i++
        while (i < lines.length && lines[i].startsWith('    ')) {
          const propLine = lines[i].trim()
          if (propLine.startsWith('Version:')) {
            version = propLine.replace('Version:', '').trim()
          } else if (propLine.startsWith('Status:')) {
            enabled = !propLine.replace('Status:', '').trim().includes('disabled')
          }
          i++
        }

        const entry = getPluginInstallEntry(name)
        const installPath = entry?.installPath
        const scope = (entry?.scope ?? 'user') as PluginScope
        const skillCount = installPath
          ? countDirEntries(path.join(installPath, 'skills'), () => true)
          : 0
        const agentCount = installPath
          ? countDirEntries(path.join(installPath, 'agents'), (n) => n.endsWith('.md'))
          : 0

        plugins.push({ id: name, name, version, enabled, scope, installPath, skillCount, agentCount })
      } else {
        i++
      }
    }

    return { plugins }
  } catch {
    return { plugins: [] }
  }
}

export function getPluginReadme(pluginId: string): PluginReadmeResult {
  const installPath = getPluginInstallPath(pluginId)
  if (!installPath) return { content: '', skills: [], agents: [] }

  let content = ''
  try {
    content = fs.readFileSync(path.join(installPath, 'README.md'), 'utf-8')
  } catch { /* no readme */ }

  const skills: string[] = []
  try {
    const skillsDir = path.join(installPath, 'skills')
    for (const entry of fs.readdirSync(skillsDir, { withFileTypes: true })) {
      if (entry.isDirectory()) skills.push(entry.name)
    }
  } catch { /* no skills dir */ }

  const agents: string[] = []
  try {
    const agentsDir = path.join(installPath, 'agents')
    for (const entry of fs.readdirSync(agentsDir, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith('.md')) agents.push(entry.name.replace(/\.md$/, ''))
    }
  } catch { /* no agents dir */ }

  return { content, skills, agents }
}

export async function installPlugin(name: string): Promise<InstallSkillResult> {
  try {
    await execAsync(`claude plugin install "${name}"`, { timeout: 60000 })
    return { success: true }
  } catch (e: unknown) {
    return { success: false, error: String(e) }
  }
}

export async function uninstallPlugin(name: string): Promise<PluginOperationResult> {
  try {
    await execAsync(`claude plugin uninstall "${name}"`, { timeout: 30000 })
    return { success: true, message: `插件 "${name}" 已卸载` }
  } catch (e: unknown) {
    const msg = String(e)
    return { success: false, message: msg }
  }
}

export async function enablePlugin(pluginId: string): Promise<PluginOperationResult> {
  try {
    await execAsync(`claude plugin enable "${pluginId}"`, { timeout: 15000 })
    return { success: true, message: `插件已启用` }
  } catch (e: unknown) {
    return { success: false, message: String(e) }
  }
}

export async function disablePlugin(pluginId: string): Promise<PluginOperationResult> {
  try {
    await execAsync(`claude plugin disable "${pluginId}"`, { timeout: 15000 })
    return { success: true, message: `插件已禁用` }
  } catch (e: unknown) {
    return { success: false, message: String(e) }
  }
}

export async function updatePlugin(pluginId: string): Promise<PluginOperationResult> {
  try {
    const { stdout } = await execAsync(`claude plugin update "${pluginId}"`, { timeout: 120000 })
    const msg = stdout.trim() || `插件 "${pluginId}" 已更新，重启后生效`
    return { success: true, message: msg }
  } catch (e: unknown) {
    const msg = String(e)
    if (msg.includes('already up to date') || msg.includes('up-to-date')) {
      return { success: true, message: '已是最新版本' }
    }
    return { success: false, message: msg }
  }
}

