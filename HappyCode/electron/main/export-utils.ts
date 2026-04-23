import type { AuditEntry } from '../shared/types'

const CSV_HEADER = 'session_id,timestamp,tool_name,input_json,output_json,model,cost_usd'

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
  ]
  return fields.join(',')
}

export function buildCsvContent(sessionId: string, entries: AuditEntry[]): string {
  const rows = [CSV_HEADER, ...entries.map((e) => buildCsvRow(sessionId, e))]
  return rows.join('\n')
}
