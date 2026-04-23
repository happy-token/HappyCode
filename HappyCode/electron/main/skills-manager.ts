import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import type { SkillInfo, SkillsResult, PluginInfo, PluginsResult, InstallSkillResult } from '../shared/types'

const execAsync = promisify(exec)

const SKILLS_DIR = path.join(os.homedir(), '.claude', 'skills')
const SETTINGS_FILE = path.join(os.homedir(), '.claude', 'settings.json')

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

export function listSkills(): SkillsResult {
  if (!fs.existsSync(SKILLS_DIR)) return { skills: [] }

  const disabled = new Set(getDisabledSkills())
  const entries = fs.readdirSync(SKILLS_DIR, { withFileTypes: true })
  const skills: SkillInfo[] = []

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const skillPath = path.join(SKILLS_DIR, entry.name)
    let stat: fs.Stats
    try {
      stat = fs.statSync(skillPath)
    } catch {
      continue
    }
    skills.push({
      id: entry.name,
      name: entry.name,
      path: skillPath,
      enabled: !disabled.has(entry.name),
      description: getSkillDescription(skillPath),
      lastModified: stat.mtimeMs,
    })
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

export function getSkillContent(skillId: string): { content: string } {
  const skillMd = path.join(SKILLS_DIR, skillId, 'SKILL.md')
  if (!fs.existsSync(skillMd)) return { content: '' }
  try {
    return { content: fs.readFileSync(skillMd, 'utf-8') }
  } catch {
    return { content: '' }
  }
}

export async function listPlugins(): Promise<PluginsResult> {
  try {
    const { stdout } = await execAsync('claude plugin list 2>/dev/null', { timeout: 10000 })
    const plugins: PluginInfo[] = stdout
      .split('\n')
      .filter((l) => l.trim())
      .map((line) => {
        const [name, version] = line.trim().split(/\s+/)
        return {
          id: name ?? line.trim(),
          name: name ?? line.trim(),
          version,
          enabled: true,
        }
      })
    return { plugins }
  } catch {
    return { plugins: [] }
  }
}

export async function installPlugin(name: string): Promise<InstallSkillResult> {
  try {
    await execAsync(`claude plugin add "${name}"`, { timeout: 60000 })
    return { success: true }
  } catch (e: unknown) {
    return { success: false, error: String(e) }
  }
}

export async function removePlugin(name: string): Promise<InstallSkillResult> {
  try {
    await execAsync(`claude plugin remove "${name}"`, { timeout: 30000 })
    return { success: true }
  } catch (e: unknown) {
    return { success: false, error: String(e) }
  }
}

