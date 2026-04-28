import path from 'path'
import fs from 'fs'

const IGNORED_DIRS = new Set([
  'node_modules', '.git', 'dist', '.next', '__pycache__', '.turbo', 'build', '.DS_Store', 'out', '.venv', '.cache',
])

/**
 * Check if targetPath is safely inside cwd, preventing directory traversal and symlink escape.
 * Handles macOS symlink quirks (/var -> /private/var, /tmp -> /private/tmp).
 */
export function isPathSafe(targetPath: string, cwd: string): boolean {
  const resolved = path.resolve(cwd, targetPath)
  const resolvedCwd = path.resolve(cwd)

  // Normalize both: try realpath, but if target doesn't exist,
  // prefix-replace the resolvedCwd portion with its realpath version.
  let realCwd: string
  try {
    realCwd = fs.realpathSync.native(resolvedCwd)
  } catch {
    realCwd = resolvedCwd
  }

  let normalized: string
  try {
    normalized = fs.realpathSync.native(resolved)
  } catch {
    // File/dir doesn't exist — resolve by replacing the cwd prefix
    if (resolved === resolvedCwd) return true
    if (resolved.startsWith(resolvedCwd + path.sep)) {
      // Structurally safe under the resolved cwd
      return true
    }
    // Handle symlink prefix mismatch: replace resolvedCwd prefix with realCwd
    normalized = realCwd + resolved.slice(resolvedCwd.length)
  }

  if (!normalized.startsWith(realCwd + path.sep) && normalized !== realCwd) return false
  return true
}

const EXTENSION_MAP: Record<string, string> = {
  '.ts': 'typescript', '.tsx': 'typescriptreact', '.js': 'javascript', '.jsx': 'javascriptreact',
  '.py': 'python', '.rb': 'ruby', '.rs': 'rust', '.go': 'go', '.java': 'java',
  '.kt': 'kotlin', '.scala': 'scala', '.swift': 'swift', '.c': 'c', '.cpp': 'cpp',
  '.h': 'c', '.hpp': 'cpp', '.cs': 'csharp', '.php': 'php', '.lua': 'lua',
  '.sh': 'bash', '.zsh': 'bash', '.fish': 'fish', '.ps1': 'powershell',
  '.html': 'html', '.css': 'css', '.scss': 'scss', '.sass': 'sass', '.less': 'less',
  '.json': 'json', '.yaml': 'yaml', '.yml': 'yaml', '.toml': 'toml', '.xml': 'xml',
  '.md': 'markdown', '.sql': 'sql', '.graphql': 'graphql', '.proto': 'protobuf',
  '.vue': 'vue', '.svelte': 'svelte', '.dart': 'dart', '.ex': 'elixir', '.exs': 'elixir',
  '.erl': 'erlang', '.hs': 'haskell', '.clj': 'clojure', '.r': 'r', '.R': 'r',
  '.m': 'objectivec', '.mm': 'objectivec', '.sol': 'solidity', '.tf': 'hcl',
}

export function getFileLanguage(filePath: string): string {
  if (typeof filePath !== 'string' || filePath.length === 0) return ''
  const ext = path.extname(filePath).toLowerCase()
  const basename = path.basename(filePath).toLowerCase()
  if (basename === '.dockerfile' || basename === 'dockerfile') return 'dockerfile'
  if (basename === '.env' || basename.startsWith('.env.')) return 'bash'
  return EXTENSION_MAP[ext] ?? ''
}

export function shouldIgnoreDir(name: string): boolean {
  return IGNORED_DIRS.has(name)
}
