import { createHash } from 'crypto'
import type { AuditEntry, ExportSettings } from '../shared/types'

const CSV_HEADER = 'session_id,timestamp,tool_name,input_json,output_json,model,cost_usd,chain_hash'

export function escapeCsvField(value: string): string {
  if (!value.includes(',') && !value.includes('"') && !value.includes('\n')) {
    return value
  }
  return `"${value.replace(/"/g, '""')}"`
}

export function buildCsvRow(sessionId: string, entry: AuditEntry): string {
  const fields = [
    escapeCsvField(sessionId),
    escapeCsvField(String(entry.timestamp)),
    escapeCsvField(entry.toolName ?? ''),
    escapeCsvField(entry.inputJson ?? ''),
    escapeCsvField(entry.outputJson ?? ''),
    escapeCsvField(entry.model ?? ''),
    escapeCsvField(entry.costUsd !== undefined ? String(entry.costUsd) : ''),
    escapeCsvField(entry.chainHash ?? ''),
  ]
  return fields.join(',')
}

export function applyRedaction(entries: AuditEntry[], settings: ExportSettings): AuditEntry[] {
  if (settings.redactMode === 'full') return entries

  if (settings.redactMode === 'tools-only') {
    return entries.map((e) => ({ ...e, inputJson: '', outputJson: '' }))
  }

  // 'custom': apply each user-defined regex pattern
  const compiled = settings.customPatterns
    .map((p) => { try { return new RegExp(p, 'g') } catch { return null } })
    .filter((r): r is RegExp => r !== null)

  if (compiled.length === 0) return entries

  return entries.map((e) => {
    let inputJson = e.inputJson ?? ''
    let outputJson = e.outputJson ?? ''
    for (const re of compiled) {
      re.lastIndex = 0
      inputJson = inputJson.replace(re, '[REDACTED]')
      re.lastIndex = 0
      outputJson = outputJson.replace(re, '[REDACTED]')
    }
    return { ...e, inputJson, outputJson }
  })
}

// Hash payload: prevHash|sessionId|timestamp|toolName|inputJson|outputJson|model|costUsd
function hashEntry(prevHash: string, sessionId: string, entry: AuditEntry): string {
  const payload = [
    prevHash,
    sessionId,
    String(entry.timestamp),
    entry.toolName ?? '',
    entry.inputJson ?? '',
    entry.outputJson ?? '',
    entry.model ?? '',
    entry.costUsd !== undefined ? String(entry.costUsd) : '',
  ].join('|')
  return createHash('sha256').update(payload, 'utf8').digest('hex')
}

export function computeChainHashes(sessionId: string, entries: AuditEntry[]): AuditEntry[] {
  let prevHash = ''
  return entries.map((entry) => {
    const chainHash = hashEntry(prevHash, sessionId, entry)
    prevHash = chainHash
    return { ...entry, chainHash }
  })
}

export function buildVerifierScript(sessionId: string): string {
  return `#!/usr/bin/env node
// HappyCode audit chain verifier
// Usage: node verify-chain.js <path-to-csv>
// Verifies SHA-256 chain integrity for session: ${sessionId}

const fs = require('fs')
const crypto = require('crypto')

const csvPath = process.argv[2]
if (!csvPath) {
  console.error('Usage: node verify-chain.js <path-to-csv>')
  process.exit(1)
}

const lines = fs.readFileSync(csvPath, 'utf8').trim().split('\\n')
const header = lines[0].split(',')
const colIndex = (name) => header.indexOf(name)

const idxSessionId   = colIndex('session_id')
const idxTimestamp   = colIndex('timestamp')
const idxToolName    = colIndex('tool_name')
const idxInputJson   = colIndex('input_json')
const idxOutputJson  = colIndex('output_json')
const idxModel       = colIndex('model')
const idxCostUsd     = colIndex('cost_usd')
const idxChainHash   = colIndex('chain_hash')

function parseField(raw) {
  if (raw.startsWith('"') && raw.endsWith('"')) {
    return raw.slice(1, -1).replace(/""/g, '"')
  }
  return raw
}

function parseCsvLine(line) {
  const fields = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++ }
      else if (ch === '"') { inQuotes = false }
      else { cur += ch }
    } else {
      if (ch === '"') { inQuotes = true }
      else if (ch === ',') { fields.push(cur); cur = '' }
      else { cur += ch }
    }
  }
  fields.push(cur)
  return fields
}

let prevHash = ''
let ok = true

for (let i = 1; i < lines.length; i++) {
  if (!lines[i].trim()) continue
  const fields = parseCsvLine(lines[i])
  const sessionId   = parseField(fields[idxSessionId] ?? '')
  const timestamp   = parseField(fields[idxTimestamp] ?? '')
  const toolName    = parseField(fields[idxToolName] ?? '')
  const inputJson   = parseField(fields[idxInputJson] ?? '')
  const outputJson  = parseField(fields[idxOutputJson] ?? '')
  const model       = parseField(fields[idxModel] ?? '')
  const costUsd     = parseField(fields[idxCostUsd] ?? '')
  const storedHash  = parseField(fields[idxChainHash] ?? '')

  const payload = [prevHash, sessionId, timestamp, toolName, inputJson, outputJson, model, costUsd].join('|')
  const expected = crypto.createHash('sha256').update(payload, 'utf8').digest('hex')

  if (expected !== storedHash) {
    console.error(\`Row \${i}: TAMPERED — expected \${expected}, got \${storedHash}\`)
    ok = false
  }
  prevHash = storedHash
}

if (ok) {
  console.log(\`OK — all \${lines.length - 1} rows verified (session: ${sessionId})\`)
  process.exit(0)
} else {
  console.error('FAIL — chain integrity check failed')
  process.exit(1)
}
`
}

export function buildCsvContent(sessionId: string, entries: AuditEntry[]): string {
  const rows = [CSV_HEADER, ...entries.map((e) => buildCsvRow(sessionId, e))]
  return rows.join('\n')
}
