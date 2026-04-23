import { describe, it, expect } from 'vitest'
import { buildCsvRow, buildCsvContent, escapeCsvField } from '../electron/main/export-utils'
import type { AuditEntry } from '../electron/shared/types'

// ── RFC 4180 CSV 转义 ─────────────────────────────────────────
describe('escapeCsvField', () => {
  it('returns plain string as-is when no special chars', () => {
    expect(escapeCsvField('hello')).toBe('hello')
  })

  it('wraps field with double quotes when it contains a comma', () => {
    expect(escapeCsvField('a,b')).toBe('"a,b"')
  })

  it('wraps field with double quotes when it contains a newline', () => {
    expect(escapeCsvField('a\nb')).toBe('"a\nb"')
  })

  it('doubles internal double quotes (RFC 4180)', () => {
    expect(escapeCsvField('say "hello"')).toBe('"say ""hello"""')
  })

  it('handles empty string', () => {
    expect(escapeCsvField('')).toBe('')
  })
})

// ── CSV 行构建 ────────────────────────────────────────────────
describe('buildCsvRow', () => {
  const sessionId = 'sess-123'

  it('produces correct field order: session_id,timestamp,tool_name,input_json,output_json,model,cost_usd', () => {
    const entry: AuditEntry = {
      uuid: 'u1',
      timestamp: 1713700000,
      type: 'assistant',
      toolName: 'Bash',
      inputJson: '{"command":"ls"}',
      outputJson: '{"output":"file1"}',
      model: 'claude-sonnet-4-6',
      costUsd: 0.0012,
    }
    const row = buildCsvRow(sessionId, entry)
    // JSON strings always contain double quotes — RFC 4180 wraps them
    expect(row).toBe(
      'sess-123,1713700000,Bash,"{""command"":""ls""}","{""output"":""file1""}",claude-sonnet-4-6,0.0012'
    )
  })

  it('has NO approved field', () => {
    const entry: AuditEntry = {
      uuid: 'u1',
      timestamp: 1713700000,
      type: 'assistant',
    }
    const row = buildCsvRow(sessionId, entry)
    expect(row).not.toContain('approved')
    const fields = row.split(',')
    expect(fields).toHaveLength(7) // session_id,timestamp,tool_name,input_json,output_json,model,cost_usd
  })

  it('escapes input_json containing commas and quotes (RFC 4180)', () => {
    const entry: AuditEntry = {
      uuid: 'u1',
      timestamp: 1713700000,
      type: 'assistant',
      inputJson: '{"a":1,"b":2}',
    }
    const row = buildCsvRow(sessionId, entry)
    // Contains quotes and commas → wrapped in quotes, internal quotes doubled
    expect(row).toContain('"{""a"":1,""b"":2}"')
  })

  it('handles undefined optional fields with empty string', () => {
    const entry: AuditEntry = {
      uuid: 'u1',
      timestamp: 1713700000,
      type: 'user',
    }
    const row = buildCsvRow(sessionId, entry)
    const fields = row.split(',')
    expect(fields).toHaveLength(7)
  })
})

// ── 完整 CSV 内容（含 header）────────────────────────────────
describe('buildCsvContent', () => {
  it('starts with header row', () => {
    const csv = buildCsvContent('s1', [])
    expect(csv.startsWith('session_id,timestamp,tool_name,input_json,output_json,model,cost_usd')).toBe(true)
  })

  it('header has NO approved field', () => {
    const csv = buildCsvContent('s1', [])
    expect(csv).not.toContain('approved')
  })

  it('adds one data row per entry', () => {
    const entries: AuditEntry[] = [
      { uuid: 'u1', timestamp: 1000, type: 'assistant' },
      { uuid: 'u2', timestamp: 2000, type: 'user' },
    ]
    const csv = buildCsvContent('s1', entries)
    const lines = csv.trim().split('\n')
    expect(lines).toHaveLength(3) // 1 header + 2 data
  })
})
