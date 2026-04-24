import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import type { ClaudeSettings } from '../shared/types'

function settingsPath(): string {
  return path.join(app.getPath('home'), '.claude', 'settings.json')
}

export function getClaudeSettings(): ClaudeSettings {
  try {
    const raw = fs.readFileSync(settingsPath(), 'utf-8')
    return JSON.parse(raw) as ClaudeSettings
  } catch {
    return {}
  }
}

export function saveClaudeSettings(settings: ClaudeSettings): void {
  const p = settingsPath()
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, JSON.stringify(settings, null, 2) + '\n', 'utf-8')
}
