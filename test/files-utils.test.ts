import { describe, it, expect } from 'vitest'
import { isPathSafe, getFileLanguage, shouldIgnoreDir } from '../electron/main/files-utils'

describe('isPathSafe', () => {
  it('allows paths within cwd', () => {
    expect(isPathSafe('/Users/me/project/src/file.ts', '/Users/me/project')).toBe(true)
  })

  it('rejects paths outside cwd', () => {
    expect(isPathSafe('/Users/other/secret.txt', '/Users/me/project')).toBe(false)
  })

  it('rejects traversal attempts', () => {
    expect(isPathSafe('/Users/me/project/../../../etc/passwd', '/Users/me/project')).toBe(false)
  })

  it('allows exact cwd match', () => {
    expect(isPathSafe('/Users/me/project', '/Users/me/project')).toBe(true)
  })
})

describe('getFileLanguage', () => {
  it('detects TypeScript', () => { expect(getFileLanguage('app.ts')).toBe('typescript') })
  it('detects Python', () => { expect(getFileLanguage('script.py')).toBe('python') })
  it('detects Rust', () => { expect(getFileLanguage('main.rs')).toBe('rust') })
  it('returns empty for unknown', () => { expect(getFileLanguage('file.xyz')).toBe('') })
  it('detects JSON', () => { expect(getFileLanguage('config.json')).toBe('json') })
  it('detects Dockerfile', () => { expect(getFileLanguage('Dockerfile')).toBe('dockerfile') })
  it('detects .env files', () => { expect(getFileLanguage('.env')).toBe('bash') })
  it('detects .env.local', () => { expect(getFileLanguage('.env.local')).toBe('bash') })
  it('returns empty for empty string', () => { expect(getFileLanguage('')).toBe('') })
  it('detects TSX', () => { expect(getFileLanguage('Component.tsx')).toBe('typescriptreact') })
})

describe('shouldIgnoreDir', () => {
  it('ignores node_modules', () => { expect(shouldIgnoreDir('node_modules')).toBe(true) })
  it('allows src', () => { expect(shouldIgnoreDir('src')).toBe(false) })
  it('ignores .git', () => { expect(shouldIgnoreDir('.git')).toBe(true) })
  it('ignores __pycache__', () => { expect(shouldIgnoreDir('__pycache__')).toBe(true) })
  it('is case-sensitive', () => { expect(shouldIgnoreDir('Node_Modules')).toBe(false) })
  it('does not ignore empty string', () => { expect(shouldIgnoreDir('')).toBe(false) })
})
