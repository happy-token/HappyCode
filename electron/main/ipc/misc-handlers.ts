import { ipcMain, shell } from 'electron'
import fs from 'fs'
import os from 'os'
import path from 'path'
import type { CustomCommand, ListCustomCommandsResult } from '../../shared/types'

function listCustomCommandsFromDir(dir: string, source: 'personal' | 'project'): CustomCommand[] {
  if (!fs.existsSync(dir)) return []
  const commands: CustomCommand[] = []
  try {
    const entries = fs.readdirSync(dir)
    for (const entry of entries) {
      if (!entry.endsWith('.md')) continue
      const filePath = path.join(dir, entry)
      const name = entry.slice(0, -3)
      let description = ''
      try {
        const content = fs.readFileSync(filePath, 'utf-8')
        const lines = content.split('\n')
        for (const line of lines) {
          const trimmed = line.trim()
          if (trimmed && !trimmed.startsWith('#')) {
            description = trimmed.slice(0, 120)
            break
          }
          if (trimmed.startsWith('# ')) {
            description = trimmed.slice(2).slice(0, 120)
            break
          }
        }
      } catch { /* skip unreadable files */ }
      commands.push({ name, description, source, filePath })
    }
  } catch { /* skip unreadable dirs */ }
  return commands.sort((a, b) => a.name.localeCompare(b.name))
}

export function registerMiscHandlers(): void {
  ipcMain.handle('commands:list-custom', (_event, { cwd }: { cwd: string }): ListCustomCommandsResult => {
    const personalDir = path.join(os.homedir(), '.claude', 'commands')
    const projectDir = cwd ? path.join(cwd, '.claude', 'commands') : ''
    const personal = listCustomCommandsFromDir(personalDir, 'personal')
    const project = projectDir ? listCustomCommandsFromDir(projectDir, 'project') : []
    return { commands: [...personal, ...project] }
  })

  ipcMain.handle('system:open-url', (_event, url: string) => {
    shell.openExternal(url)
  })
}
