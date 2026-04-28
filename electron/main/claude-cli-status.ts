import { execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'

export interface ClaudeCliStatus {
  found: boolean
  binaryPath?: string
  version?: string
  auth: {
    oauthToken: boolean
    apiKeyEnv: boolean
    apiKeyFile: boolean
    credentialsPath?: string
  }
  configDir: string
  settingsPath: string
  settingsExists: boolean
}

// Electron's shell inherits a minimal PATH; augment with common install locations
function buildEnv(): NodeJS.ProcessEnv {
  const extraPaths = [
    '/opt/homebrew/bin',
    '/usr/local/bin',
    '/usr/bin',
    '/bin',
  ]
  const existing = (process.env.PATH ?? '').split(':').filter(Boolean)
  const merged = [...new Set([...extraPaths, ...existing])].join(':')
  return { ...process.env, PATH: merged }
}

function findClaudeBinary(): { found: boolean; binaryPath?: string } {
  const env = buildEnv()

  // Try `which` first
  try {
    const result = execSync(
      process.platform === 'win32' ? 'where claude' : 'which claude',
      { encoding: 'utf-8', timeout: 3000, env },
    ).trim()
    if (result) return { found: true, binaryPath: result.split('\n')[0].trim() }
  } catch { /* not in PATH */ }

  // Common install paths
  const homeDir = app.getPath('home')
  const candidates = process.platform === 'win32'
    ? [
        path.join(process.env.APPDATA ?? '', 'npm', 'claude.cmd'),
        path.join(process.env.PROGRAMFILES ?? '', 'nodejs', 'claude.cmd'),
      ]
    : [
        '/opt/homebrew/bin/claude',
        '/usr/local/bin/claude',
        '/usr/bin/claude',
        path.join(homeDir, '.npm-global', 'bin', 'claude'),
        path.join(homeDir, '.local', 'bin', 'claude'),
      ]

  for (const p of candidates) {
    if (fs.existsSync(p)) return { found: true, binaryPath: p }
  }

  return { found: false }
}

function getClaudeVersion(binaryPath: string): string | undefined {
  try {
    const raw = execSync(`"${binaryPath}" --version`, {
      encoding: 'utf-8',
      timeout: 5000,
      env: buildEnv(),
    })
    return raw.trim()
  } catch {
    return undefined
  }
}

function getAuthStatus(homeDir: string): ClaudeCliStatus['auth'] & { credentialsPath?: string } {
  const credPath = path.join(homeDir, '.claude', '.credentials.json')
  let oauthToken = false

  if (fs.existsSync(credPath)) {
    try {
      const raw = fs.readFileSync(credPath, 'utf-8')
      const creds = JSON.parse(raw) as Record<string, unknown>
      oauthToken = !!(creds.claudeAiOauthToken || creds.oauth_token || creds.access_token)
    } catch { /* malformed */ }
  }

  const apiKeyEnv = !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN)

  const settingsPath = path.join(homeDir, '.claude', 'settings.json')
  let apiKeyFile = false
  if (fs.existsSync(settingsPath)) {
    try {
      const s = JSON.parse(fs.readFileSync(settingsPath, 'utf-8')) as Record<string, unknown>
      apiKeyFile = !!(s.apiKey || s.api_key)
    } catch { /* ignore */ }
  }

  return {
    oauthToken,
    apiKeyEnv,
    apiKeyFile,
    credentialsPath: fs.existsSync(credPath) ? credPath : undefined,
  }
}

export function getClaudeCliStatus(): ClaudeCliStatus {
  const homeDir = app.getPath('home')
  const configDir = path.join(homeDir, '.claude')
  const settingsPath = path.join(configDir, 'settings.json')

  const binary = findClaudeBinary()
  const version = binary.found && binary.binaryPath
    ? getClaudeVersion(binary.binaryPath)
    : undefined
  const auth = getAuthStatus(homeDir)

  return {
    found: binary.found,
    binaryPath: binary.binaryPath,
    version,
    auth,
    configDir,
    settingsPath,
    settingsExists: fs.existsSync(settingsPath),
  }
}
