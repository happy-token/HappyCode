import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import type { HookBridgeStatus } from '../shared/types'

const PORT = 37421
const BRIDGE_MARKER = 'happycode-gui-bridge'

const ALL_HOOK_TYPES = [
  'PreToolUse', 'PostToolUse', 'PostToolUseFailure',
  'UserPromptSubmit', 'Stop',
  'SubagentStart', 'SubagentStop',
  'SessionStart', 'SessionEnd',
  'Notification', 'PreCompact',
] as const

function hooksDir(): string {
  return path.join(os.homedir(), '.claude', 'hooks')
}

function getScriptPath(): string {
  const isWin = process.platform === 'win32'
  return path.join(hooksDir(), isWin ? 'gui-bridge.ps1' : 'gui-bridge.sh')
}

function settingsPath(): string {
  return path.join(os.homedir(), '.claude', 'settings.json')
}

function writeScript(): string {
  const sp = getScriptPath()
  fs.mkdirSync(hooksDir(), { recursive: true })

  if (process.platform === 'win32') {
    fs.writeFileSync(sp, [
      `# ${BRIDGE_MARKER}`,
      `$payload = $input | Out-String`,
      `try {`,
      `  Invoke-RestMethod -Uri "http://127.0.0.1:${PORT}/hook" \``,
      `    -Method Post -ContentType "application/json" \``,
      `    -Headers @{"X-Hook-Event" = $env:HOOK_EVENT_NAME} \``,
      `    -Body $payload -TimeoutSec 2 | Out-Null`,
      `} catch {}`,
      `exit 0`,
    ].join('\n'))
  } else {
    fs.writeFileSync(sp, [
      `#!/bin/bash`,
      `# ${BRIDGE_MARKER}`,
      `payload=$(cat)`,
      `curl -s --max-time 2 -X POST http://127.0.0.1:${PORT}/hook \\`,
      `  -H "Content-Type: application/json" \\`,
      `  -H "X-Hook-Event: \${HOOK_EVENT_NAME}" \\`,
      `  -d "$payload" &`,
      `exit 0`,
    ].join('\n'))
    fs.chmodSync(sp, '755')
  }

  return sp
}

function readSettings(): Record<string, unknown> {
  const sp = settingsPath()
  if (!fs.existsSync(sp)) return {}
  try {
    return JSON.parse(fs.readFileSync(sp, 'utf-8')) as Record<string, unknown>
  } catch {
    return {}
  }
}

function writeSettings(settings: Record<string, unknown>): void {
  const sp = settingsPath()
  fs.mkdirSync(path.dirname(sp), { recursive: true })
  fs.writeFileSync(sp, JSON.stringify(settings, null, 2))
}

export function injectBridgeHook(): HookBridgeStatus {
  const sp = writeScript()
  const isWin = process.platform === 'win32'
  const command = isWin ? `powershell -NonInteractive -File "${sp}"` : sp

  const settings = readSettings()
  const hooks = (settings['hooks'] ?? {}) as Record<string, unknown[]>

  for (const event of ALL_HOOK_TYPES) {
    const existing = (hooks[event] ?? []) as Array<Record<string, unknown>>
    const alreadyInjected = existing.some((h) =>
      String(h['command'] ?? '').includes(BRIDGE_MARKER) ||
      String(h['command'] ?? '').includes('gui-bridge')
    )
    if (!alreadyInjected) {
      hooks[event] = [...existing, { type: 'command', command }]
    }
  }

  settings['hooks'] = hooks
  writeSettings(settings)

  console.log('[BridgeInjector] Bridge hook injected')
  return getBridgeStatus()
}

export function getBridgeStatus(): HookBridgeStatus {
  const sp = getScriptPath()
  const scriptExists = fs.existsSync(sp)

  if (!scriptExists) {
    return { injected: false, scriptExists: false, scriptPath: sp }
  }

  const settings = readSettings()
  const hooks = (settings['hooks'] ?? {}) as Record<string, unknown[]>
  const preToolUseHooks = (hooks['PreToolUse'] ?? []) as Array<Record<string, unknown>>
  const injected = preToolUseHooks.some((h) =>
    String(h['command'] ?? '').includes('gui-bridge')
  )

  return { injected, scriptExists, scriptPath: sp }
}
