import * as fs from 'fs'
import * as path from 'path'
import type { ComputerUseConfig } from '../shared/types'

function configPath(): string {
  return path.join(process.env.HOME || '', '.claude', 'computer-use.json')
}

const DEFAULT_CONFIG: ComputerUseConfig = {
  enabled: false,
  permissionMode: 'default',
  screenshotTool: '',
  authorizedApps: [],
  grantFlags: {
    clipboardRead: true,
    clipboardWrite: true,
    systemKeyCombos: true,
  },
}

export function getComputerUseConfig(): ComputerUseConfig {
  try {
    const raw = fs.readFileSync(configPath(), 'utf-8')
    const parsed = JSON.parse(raw) as Partial<ComputerUseConfig>
    return { ...DEFAULT_CONFIG, ...parsed }
  } catch {
    return { ...DEFAULT_CONFIG }
  }
}

export function saveComputerUseConfig(config: ComputerUseConfig): void {
  const p = configPath()
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, JSON.stringify(config, null, 2) + '\n', 'utf-8')
}
