import { describe, it, expect, vi, beforeEach } from 'vitest'
import { parseGitStatus, parseGitLog } from '../electron/main/git-service'

vi.mock('child_process')

describe('parseGitStatus', () => {
  it('parses porcelain v1 output', () => {
    const output = ` M src/index.ts\nA  src/new.ts\n?? untracked.txt\n`
    const result = parseGitStatus(output, 'main', 'origin/main', 1, 0)
    expect(result.branch).toBe('main')
    expect(result.upstream).toBe('origin/main')
    expect(result.ahead).toBe(1)
    expect(result.behind).toBe(0)
    expect(result.entries).toHaveLength(3)
    expect(result.entries[0].file).toBe('src/index.ts')
    expect(result.entries[0].code).toBe('M')
    expect(result.entries[0].staged).toBe(false)
    expect(result.entries[1].file).toBe('src/new.ts')
    expect(result.entries[1].code).toBe('A')
    expect(result.entries[1].staged).toBe(true)
    expect(result.entries[2].file).toBe('untracked.txt')
    expect(result.entries[2].code).toBe('?')
    expect(result.entries[2].staged).toBe(false)
  })

  it('handles empty output', () => {
    const result = parseGitStatus('', 'main')
    expect(result.entries).toEqual([])
  })
})

describe('parseGitLog', () => {
  it('parses log output', () => {
    const output = `abc123def456\x00abc123\x00Fix login bug\x00John Doe\x002026-04-26T10:00:00+08:00\x002 hours ago\n789xyz000\x00789xyz\x00Add tests\x00Jane Smith\x002026-04-25T15:00:00+08:00\x001 day ago`
    const result = parseGitLog(output)
    expect(result).toHaveLength(2)
    expect(result[0].sha).toBe('abc123def456')
    expect(result[0].shortSha).toBe('abc123')
    expect(result[0].message).toBe('Fix login bug')
    expect(result[0].author).toBe('John Doe')
  })

  it('returns empty array for empty output', () => {
    expect(parseGitLog('')).toEqual([])
  })
})
