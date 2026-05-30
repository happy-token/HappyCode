// 纯函数工具集，独立于 Electron/fs，方便 vitest 单元测试

import fs from 'node:fs'

export const MAX_JSONL_SIZE = 10 * 1024 * 1024 // 10MB

// ── CWD 编码 ──────────────────────────────────────────────────
export function encodeCwd(cwd: string): string {
  return cwd.replace(/\//g, '-')
}

// ── UUID 去重（保留最后一次出现）──────────────────────────────
export function deduplicateByUuid<T extends Record<string, unknown>>(
  entries: T[]
): T[] {
  const seen = new Map<string, T>()
  let autoKey = 0
  for (const entry of entries) {
    const uuid = entry['uuid'] as string | undefined
    const key = uuid ?? `__no_uuid_${autoKey++}`
    seen.set(key, entry)
  }
  return Array.from(seen.values())
}

// ── JSONL 行解析 ───────────────────────────────────────────────
export function parseJsonlLines(raw: string): {
  entries: Record<string, unknown>[]
  skippedLines: number
} {
  const lines = raw.split('\n')
  const entries: Record<string, unknown>[] = []
  let skippedLines = 0

  for (const line of lines) {
    if (!line.trim()) continue
    try {
      entries.push(JSON.parse(line) as Record<string, unknown>)
    } catch {
      skippedLines++
    }
  }

  return { entries, skippedLines }
}

// ── 条目过滤 ───────────────────────────────────────────────────
export function shouldSkipEntry(entry: Record<string, unknown>): boolean {
  const type = entry['type'] as string
  if (type === 'file-history-snapshot') return true
  if (type === 'system' && (entry['subtype'] as string) === 'init') return true
  return false
}

// ── Timestamp 提取 ─────────────────────────────────────────────
// Claude Code stores timestamps as ISO 8601 strings, not Unix numbers.
export function extractTimestamp(
  entry: Record<string, unknown>,
  fileMtimeSec: number
): { timestamp: number; estimated: boolean } {
  const ts = entry['timestamp']
  if (typeof ts === 'string' && ts) {
    const ms = new Date(ts).getTime()
    if (!isNaN(ms)) return { timestamp: ms / 1000, estimated: false }
  }
  if (typeof ts === 'number' && ts) return { timestamp: ts, estimated: false }
  return { timestamp: fileMtimeSec, estimated: true }
}

// ── 文件大小限制检查 ───────────────────────────────────────────
export function checkFileSizeLimit(
  sizeBytes: number
): { ok: true } | { ok: false; reason: 'file_too_large' } {
  if (sizeBytes < MAX_JSONL_SIZE) return { ok: true }
  return { ok: false, reason: 'file_too_large' }
}

// ── 统一 JSONL 文件读取/解析/去重 ──────────────────────────────
// 消除 session-store.ts 中 readHistory / loadSessionMessages / listAllHistory 的重复代码
export interface ParseSessionFileResult {
  entries: Record<string, unknown>[]
  skippedLines: number
  skipped?: boolean
  reason?: string
  fileMtimeSec: number
}

export function parseSessionFile(filePath: string, maxSize?: number): ParseSessionFileResult {
  if (!fs.existsSync(filePath)) {
    return { entries: [], skippedLines: 0, fileMtimeSec: 0 }
  }

  const stat = fs.statSync(filePath)

  const effectiveMax = maxSize ?? MAX_JSONL_SIZE
  if (stat.size > effectiveMax) {
    return { entries: [], skippedLines: 0, skipped: true, reason: 'file_too_large', fileMtimeSec: stat.mtimeMs / 1000 }
  }

  let raw: string
  try {
    raw = fs.readFileSync(filePath, 'utf-8')
  } catch {
    return { entries: [], skippedLines: 0, fileMtimeSec: stat.mtimeMs / 1000 }
  }

  const { entries, skippedLines } = parseJsonlLines(raw)
  const deduplicated = deduplicateByUuid(entries)

  return { entries: deduplicated, skippedLines, fileMtimeSec: stat.mtimeMs / 1000 }
}
