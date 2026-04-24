import { describe, it, expect } from 'vitest'
import { buildCsvRow, buildCsvContent, escapeCsvField, applyRedaction, computeChainHashes } from '../electron/main/export-utils'
import type { AuditEntry, ExportSettings } from '../electron/shared/types'

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
    // JSON strings always contain double quotes — RFC 4180 wraps them; trailing comma = empty chain_hash
    expect(row).toBe(
      'sess-123,1713700000,Bash,"{""command"":""ls""}","{""output"":""file1""}",claude-sonnet-4-6,0.0012,'
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
    // session_id,timestamp,tool_name,input_json,output_json,model,cost_usd,chain_hash
    const fields = row.split(',')
    expect(fields).toHaveLength(8)
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
    expect(fields).toHaveLength(8)
  })
})

// ── 完整 CSV 内容（含 header）────────────────────────────────
describe('buildCsvContent', () => {
  it('starts with header row including chain_hash', () => {
    const csv = buildCsvContent('s1', [])
    expect(csv.startsWith('session_id,timestamp,tool_name,input_json,output_json,model,cost_usd,chain_hash')).toBe(true)
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

// ── applyRedaction ────────────────────────────────────────────
describe('applyRedaction', () => {
  const entry: AuditEntry = {
    uuid: 'u1',
    timestamp: 1000,
    type: 'assistant',
    toolName: 'Read',
    inputJson: '{"file_path":"/Users/alice/project/secret.txt"}',
    outputJson: '{"content":"token=sk-abc123456789012345678901234567"}',
  }

  it('full mode returns entries unchanged', () => {
    const settings: ExportSettings = { redactMode: 'full', customPatterns: [] }
    const result = applyRedaction([entry], settings)
    expect(result[0]).toBe(entry) // same reference — no copy
  })

  it('tools-only mode clears inputJson and outputJson', () => {
    const settings: ExportSettings = { redactMode: 'tools-only', customPatterns: [] }
    const [result] = applyRedaction([entry], settings)
    expect(result.inputJson).toBe('')
    expect(result.outputJson).toBe('')
    expect(result.toolName).toBe('Read') // other fields preserved
    expect(result.timestamp).toBe(1000)
  })

  it('tools-only does not mutate the original entry', () => {
    const settings: ExportSettings = { redactMode: 'tools-only', customPatterns: [] }
    applyRedaction([entry], settings)
    expect(entry.inputJson).not.toBe('')
  })

  it('custom mode replaces pattern matches with [REDACTED]', () => {
    const settings: ExportSettings = {
      redactMode: 'custom',
      customPatterns: ['/(?:Users|home)/[^/\\s,"\']+'],
    }
    const [result] = applyRedaction([entry], settings)
    expect(result.inputJson).toBe('{"file_path":"[REDACTED]/project/secret.txt"}')
    expect(result.outputJson).toBe(entry.outputJson) // no match in outputJson
  })

  it('custom mode applies multiple patterns', () => {
    const settings: ExportSettings = {
      redactMode: 'custom',
      customPatterns: [
        '/(?:Users|home)/[^/\\s,"\']+',
        'sk-[A-Za-z0-9_\\-]{20,}',
      ],
    }
    const [result] = applyRedaction([entry], settings)
    expect(result.inputJson).toContain('[REDACTED]')
    expect(result.outputJson).toContain('[REDACTED]')
    expect(result.outputJson).not.toContain('sk-')
  })

  it('custom mode silently skips invalid regex patterns', () => {
    const settings: ExportSettings = {
      redactMode: 'custom',
      customPatterns: ['[invalid(regex', 'sk-[A-Za-z0-9]{20,}'],
    }
    expect(() => applyRedaction([entry], settings)).not.toThrow()
    const [result] = applyRedaction([entry], settings)
    // valid second pattern still applied
    expect(result.outputJson).not.toContain('sk-abc')
  })

  it('custom mode with no valid patterns returns entries unchanged', () => {
    const settings: ExportSettings = {
      redactMode: 'custom',
      customPatterns: [],
    }
    const result = applyRedaction([entry], settings)
    expect(result[0].inputJson).toBe(entry.inputJson)
  })

  it('handles entries with undefined inputJson / outputJson', () => {
    const sparse: AuditEntry = { uuid: 'u2', timestamp: 2000, type: 'user' }
    const settings: ExportSettings = { redactMode: 'tools-only', customPatterns: [] }
    const [result] = applyRedaction([sparse], settings)
    expect(result.inputJson).toBe('')
    expect(result.outputJson).toBe('')
  })

  it('processes multiple entries independently', () => {
    const e1: AuditEntry = { uuid: 'u1', timestamp: 1, type: 'assistant', inputJson: 'path=/Users/alice/file' }
    const e2: AuditEntry = { uuid: 'u2', timestamp: 2, type: 'assistant', inputJson: 'nothing sensitive' }
    const settings: ExportSettings = {
      redactMode: 'custom',
      customPatterns: ['/(?:Users|home)/[^/\\s,"\']+'],
    }
    const [r1, r2] = applyRedaction([e1, e2], settings)
    expect(r1.inputJson).toContain('[REDACTED]')
    expect(r2.inputJson).toBe('nothing sensitive')
  })
})

// ── computeChainHashes ────────────────────────────────────────
describe('computeChainHashes', () => {
  const sessionId = 'sess-abc'
  const e1: AuditEntry = { uuid: 'u1', timestamp: 1000, type: 'assistant', toolName: 'Read', inputJson: '{"file":"/a"}', outputJson: '{"content":"x"}', model: 'claude-sonnet-4-6', costUsd: 0.001 }
  const e2: AuditEntry = { uuid: 'u2', timestamp: 2000, type: 'assistant', toolName: 'Bash', inputJson: '{"cmd":"ls"}', outputJson: '{"out":"f"}', model: 'claude-sonnet-4-6', costUsd: 0.002 }

  it('assigns a non-empty hex chainHash to every entry', () => {
    const result = computeChainHashes(sessionId, [e1, e2])
    expect(result[0].chainHash).toMatch(/^[0-9a-f]{64}$/)
    expect(result[1].chainHash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('does not mutate original entries', () => {
    computeChainHashes(sessionId, [e1, e2])
    expect(e1.chainHash).toBeUndefined()
    expect(e2.chainHash).toBeUndefined()
  })

  it('first entry hash depends on empty prevHash', () => {
    const [r] = computeChainHashes(sessionId, [e1])
    // running the same function again must produce the same hash (deterministic)
    const [r2] = computeChainHashes(sessionId, [e1])
    expect(r.chainHash).toBe(r2.chainHash)
  })

  it('second entry hash depends on first entry hash', () => {
    const [r1, r2] = computeChainHashes(sessionId, [e1, e2])
    // changing e1 must cascade and invalidate r2.chainHash
    const alt1: AuditEntry = { ...e1, inputJson: '{"file":"/different"}' }
    const [, r2alt] = computeChainHashes(sessionId, [alt1, e2])
    expect(r2alt.chainHash).not.toBe(r2.chainHash)
  })

  it('different sessionId produces different hashes', () => {
    const [rA] = computeChainHashes('sess-A', [e1])
    const [rB] = computeChainHashes('sess-B', [e1])
    expect(rA.chainHash).not.toBe(rB.chainHash)
  })

  it('returns empty array for empty input', () => {
    expect(computeChainHashes(sessionId, [])).toEqual([])
  })

  it('handles entries without optional fields', () => {
    const sparse: AuditEntry = { uuid: 'u3', timestamp: 3000, type: 'user' }
    const [r] = computeChainHashes(sessionId, [sparse])
    expect(r.chainHash).toMatch(/^[0-9a-f]{64}$/)
  })
})
