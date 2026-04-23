import { describe, it, expect } from 'vitest'
import {
  encodeCwd,
  deduplicateByUuid,
  parseJsonlLines,
  shouldSkipEntry,
  extractTimestamp,
  checkFileSizeLimit,
} from '../electron/main/session-store-utils'

// ── 1. CWD 编码 ────────────────────────────────────────────────
describe('encodeCwd', () => {
  it('replaces forward slashes with dashes', () => {
    expect(encodeCwd('/home/user/project')).toBe('-home-user-project')
  })

  it('preserves underscores', () => {
    expect(encodeCwd('/home/user/my_project')).toBe('-home-user-my_project')
  })

  it('preserves dots', () => {
    expect(encodeCwd('/home/user/.config')).toBe('-home-user-.config')
  })

  it('preserves hyphens', () => {
    expect(encodeCwd('/home/user/my-app')).toBe('-home-user-my-app')
  })

  it('handles Windows-style paths (backslash)', () => {
    // Windows 路径 \\ 不替换（Phase 0 known limitation）
    expect(encodeCwd('C:\\Users\\foo')).toBe('C:\\Users\\foo')
  })

  it('handles empty string', () => {
    expect(encodeCwd('')).toBe('')
  })
})

// ── 2. UUID 去重（保留 last occurrence）───────────────────────
describe('deduplicateByUuid', () => {
  it('keeps the last occurrence of each uuid', () => {
    const entries = [
      { uuid: 'aaa', value: 1 },
      { uuid: 'bbb', value: 2 },
      { uuid: 'aaa', value: 3 }, // 覆盖第一条
    ]
    const result = deduplicateByUuid(entries)
    expect(result).toHaveLength(2)
    const aaa = result.find((e) => e.uuid === 'aaa')
    expect(aaa?.value).toBe(3)
  })

  it('preserves order of first appearance for distinct uuids', () => {
    const entries = [
      { uuid: 'first', value: 1 },
      { uuid: 'second', value: 2 },
    ]
    const result = deduplicateByUuid(entries)
    expect(result[0].uuid).toBe('first')
    expect(result[1].uuid).toBe('second')
  })

  it('handles entries without uuid (assigns unique key, no dedup)', () => {
    const entries = [{ value: 1 }, { value: 2 }]
    const result = deduplicateByUuid(entries)
    expect(result).toHaveLength(2)
  })

  it('returns empty array for empty input', () => {
    expect(deduplicateByUuid([])).toHaveLength(0)
  })
})

// ── 3. JSONL 行解析（malformed / partial last line）──────────
describe('parseJsonlLines', () => {
  it('parses valid lines', () => {
    const raw = '{"type":"assistant"}\n{"type":"user"}'
    const { entries, skippedLines } = parseJsonlLines(raw)
    expect(entries).toHaveLength(2)
    expect(skippedLines).toBe(0)
  })

  it('skips malformed lines without crashing', () => {
    const raw = '{"type":"ok"}\nnot-json\n{"type":"ok2"}'
    const { entries, skippedLines } = parseJsonlLines(raw)
    expect(entries).toHaveLength(2)
    expect(skippedLines).toBe(1)
  })

  it('handles partial last line gracefully (live-write safety)', () => {
    const raw = '{"type":"ok"}\n{"partial":true' // incomplete last line
    const { entries, skippedLines } = parseJsonlLines(raw)
    expect(entries).toHaveLength(1)
    expect(skippedLines).toBe(1)
  })

  it('ignores empty lines', () => {
    const raw = '{"type":"a"}\n\n\n{"type":"b"}'
    const { entries } = parseJsonlLines(raw)
    expect(entries).toHaveLength(2)
  })

  it('returns empty for completely empty input', () => {
    const { entries, skippedLines } = parseJsonlLines('')
    expect(entries).toHaveLength(0)
    expect(skippedLines).toBe(0)
  })
})

// ── 4. 条目过滤（跳过 file-history-snapshot 和 system/init）──
describe('shouldSkipEntry', () => {
  it('skips file-history-snapshot entries', () => {
    expect(shouldSkipEntry({ type: 'file-history-snapshot' })).toBe(true)
  })

  it('skips system/init entries', () => {
    expect(shouldSkipEntry({ type: 'system', subtype: 'init' })).toBe(true)
  })

  it('keeps assistant entries with message.usage', () => {
    expect(shouldSkipEntry({ type: 'assistant', message: { usage: {} } })).toBe(false)
  })

  it('keeps user entries', () => {
    expect(shouldSkipEntry({ type: 'user' })).toBe(false)
  })

  it('keeps other system subtypes', () => {
    expect(shouldSkipEntry({ type: 'system', subtype: 'compact_boundary' })).toBe(false)
  })
})

// ── 5. Timestamp 提取 ─────────────────────────────────────────
describe('extractTimestamp', () => {
  it('parses ISO 8601 string timestamp (Claude Code format)', () => {
    const entry = { type: 'assistant', timestamp: '2026-04-21T09:10:49.140Z' }
    const { timestamp, estimated } = extractTimestamp(entry, 9999999)
    expect(timestamp).toBeCloseTo(new Date('2026-04-21T09:10:49.140Z').getTime() / 1000, 0)
    expect(estimated).toBe(false)
  })

  it('handles numeric Unix timestamp as fallback', () => {
    const entry = { type: 'assistant', timestamp: 1713700000 }
    const { timestamp, estimated } = extractTimestamp(entry, 9999999)
    expect(timestamp).toBe(1713700000)
    expect(estimated).toBe(false)
  })

  it('falls back to file mtime when timestamp missing', () => {
    const entry = { type: 'user' }
    const fileMtime = 1713700000
    const { timestamp, estimated } = extractTimestamp(entry, fileMtime)
    expect(timestamp).toBe(fileMtime)
    expect(estimated).toBe(true)
  })

  it('handles timestamp = 0 as missing (falsy fallback)', () => {
    const entry = { type: 'user', timestamp: 0 }
    const { estimated } = extractTimestamp(entry, 1713700000)
    expect(estimated).toBe(true)
  })

  it('falls back to file mtime for invalid ISO string', () => {
    const entry = { type: 'user', timestamp: 'not-a-date' }
    const { timestamp, estimated } = extractTimestamp(entry, 1713700000)
    expect(timestamp).toBe(1713700000)
    expect(estimated).toBe(true)
  })
})

// ── 6. MAX_JSONL_SIZE 检查 ────────────────────────────────────
describe('checkFileSizeLimit', () => {
  const MAX = 10 * 1024 * 1024 // 10MB

  it('returns ok for files under limit', () => {
    expect(checkFileSizeLimit(MAX - 1)).toEqual({ ok: true })
  })

  it('returns error for files at exactly the limit', () => {
    expect(checkFileSizeLimit(MAX)).toEqual({ ok: false, reason: 'file_too_large' })
  })

  it('returns error for files over the limit', () => {
    expect(checkFileSizeLimit(MAX + 1)).toEqual({ ok: false, reason: 'file_too_large' })
  })
})
