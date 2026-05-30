import Database from 'better-sqlite3'
import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import type { SessionInfo, AuditEntry, ListSessionsResult, ReadHistoryResult, HookEvent, AllHistoryResult, ProjectHistory, SessionSummary } from '../shared/types'
import {
  encodeCwd,
  parseSessionFile,
  shouldSkipEntry,
  extractTimestamp,
} from './session-store-utils'

export interface SessionUsage {
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheCreationTokens: number
  costUsd: number
}

export class SessionStore {
  private db: Database.Database

  constructor() {
    const dbPath = path.join(app.getPath('userData'), 'db.sqlite3')
    this.db = new Database(dbPath)
    this.db.pragma('journal_mode = WAL')
    this.init()
  }

  private init(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        cwd TEXT NOT NULL,
        started_at INTEGER NOT NULL,
        last_message_at INTEGER NOT NULL,
        message_count INTEGER DEFAULT 0,
        total_cost_usd REAL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS hook_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ts INTEGER NOT NULL,
        hook_type TEXT NOT NULL,
        tool_name TEXT,
        cwd TEXT,
        session_id TEXT,
        input_json TEXT,
        output_json TEXT,
        exit_code INTEGER
      );
    `)
  }

  upsertSession(session: Pick<SessionInfo, 'session_id' | 'cwd' | 'last_used'>): void {
    this.db
      .prepare(
        `INSERT INTO sessions (id, cwd, started_at, last_message_at)
         VALUES (@id, @cwd, @started_at, @last_message_at)
         ON CONFLICT(id) DO UPDATE SET last_message_at = excluded.last_message_at`
      )
      .run({
        id: session.session_id,
        cwd: session.cwd,
        started_at: session.last_used,
        last_message_at: session.last_used,
      })
  }

  listByCwd(cwd: string): ListSessionsResult {
    const rows = this.db
      .prepare(
        `SELECT id as session_id, cwd, last_message_at as last_used, message_count, total_cost_usd
         FROM sessions WHERE cwd = ? ORDER BY last_message_at DESC`
      )
      .all(cwd) as SessionInfo[]

    if (rows.length === 0) {
      return this.scanFromFS(cwd)
    }
    return { sessions: rows, warnings: [] }
  }

  scanFromFS(cwd: string): ListSessionsResult {
    const encodedCwd = encodeCwd(cwd)
    const dir = path.join(os.homedir(), '.claude', 'projects', encodedCwd)
    const warnings: string[] = []

    if (!fs.existsSync(dir)) return { sessions: [], warnings }

    // 优先读 sessions-index.json
    const indexFile = path.join(dir, 'sessions-index.json')
    if (fs.existsSync(indexFile)) {
      try {
        const index = JSON.parse(fs.readFileSync(indexFile, 'utf-8')) as unknown
        if (Array.isArray(index)) {
          return {
            sessions: (index as Record<string, unknown>[]).map((s) => ({
              session_id: (s['session_id'] ?? s['id']) as string,
              cwd,
              title: s['title'] as string | undefined,
              last_used: (s['last_used'] as number) ?? Date.now(),
            })),
            warnings,
          }
        }
      } catch {
        /* fallthrough to .jsonl scan */
      }
    }

    // 扫描 .jsonl 文件
    const sessions: SessionInfo[] = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.jsonl') && !f.startsWith('.'))
      .map((f) => ({
        session_id: f.replace('.jsonl', ''),
        cwd,
        last_used: fs.statSync(path.join(dir, f)).mtimeMs,
      }))
      .sort((a, b) => b.last_used - a.last_used)

    return { sessions, warnings }
  }

  readHistory(sessionId: string, cwd: string): ReadHistoryResult {
    const encodedCwd = encodeCwd(cwd)
    const filePath = path.join(os.homedir(), '.claude', 'projects', encodedCwd, `${sessionId}.jsonl`)

    const { entries: deduplicated, skippedLines, skipped, reason, fileMtimeSec } = parseSessionFile(filePath)

    if (skipped) return { entries: [], skippedLines, skipped, reason }
    if (deduplicated.length === 0) return { entries: [], skippedLines }

    const entries: AuditEntry[] = []
    for (const entry of deduplicated) {
      if (shouldSkipEntry(entry)) continue

      const { timestamp, estimated } = extractTimestamp(entry, fileMtimeSec)

      const entryType = entry['type'] as string
      const message = entry['message'] as Record<string, unknown> | undefined
      const content = Array.isArray(message?.['content'])
        ? (message['content'] as unknown[])
        : undefined

      let toolName: string | undefined
      let inputJson: string | undefined
      let outputJson: string | undefined

      if (entryType === 'assistant' && content) {
        const toolUseBlock = content.find(
          (b): b is Record<string, unknown> =>
            typeof b === 'object' && b !== null &&
            (b as Record<string, unknown>)['type'] === 'tool_use'
        ) as Record<string, unknown> | undefined
        if (toolUseBlock) {
          toolName = toolUseBlock['name'] as string | undefined
          if (toolUseBlock['input'] !== undefined) {
            inputJson = JSON.stringify(toolUseBlock['input'])
          }
        }
      } else if (entryType === 'user' && content) {
        const toolResultBlock = content.find(
          (b): b is Record<string, unknown> =>
            typeof b === 'object' && b !== null &&
            (b as Record<string, unknown>)['type'] === 'tool_result'
        ) as Record<string, unknown> | undefined
        if (toolResultBlock) {
          const resultContent = toolResultBlock['content']
          outputJson =
            typeof resultContent === 'string'
              ? resultContent
              : resultContent !== undefined
                ? JSON.stringify(resultContent)
                : undefined
        }
      }

      if (!toolName && !inputJson && !outputJson) continue

      entries.push({
        uuid: (entry['uuid'] as string) ?? '',
        timestamp,
        timestampEstimated: estimated || undefined,
        type: entryType,
        toolName,
        inputJson,
        outputJson,
        model: message?.['model'] as string | undefined,
        costUsd: entry['cost_usd'] as number | undefined,
      })
    }

    return { entries, skippedLines }
  }

  insertHookEvent(event: Omit<HookEvent, 'id'>): number {
    const result = this.db
      .prepare(
        `INSERT INTO hook_events (ts, hook_type, tool_name, cwd, session_id, input_json, output_json, exit_code)
         VALUES (@ts, @hook_type, @tool_name, @cwd, @session_id, @input_json, @output_json, @exit_code)`
      )
      .run({
        ts: event.ts,
        hook_type: event.hook_type,
        tool_name: event.tool_name ?? null,
        cwd: event.cwd ?? null,
        session_id: event.session_id ?? null,
        input_json: event.input_json ?? null,
        output_json: event.output_json ?? null,
        exit_code: event.exit_code ?? null,
      })
    return result.lastInsertRowid as number
  }

  listHookEvents(limit = 200): HookEvent[] {
    return this.db
      .prepare(
        `SELECT id, ts, hook_type, tool_name, cwd, session_id, input_json, output_json, exit_code
         FROM hook_events ORDER BY ts DESC LIMIT ?`
      )
      .all(limit) as HookEvent[]
  }

  clearHookEvents(): void {
    this.db.prepare('DELETE FROM hook_events').run()
  }

  listAllHistory(): AllHistoryResult {
    const projectsBase = path.join(os.homedir(), '.claude', 'projects')
    if (!fs.existsSync(projectsBase)) return { projects: [] }

    const projects: ProjectHistory[] = []

    for (const encoded of fs.readdirSync(projectsBase)) {
      const projectDir = path.join(projectsBase, encoded)
      let stat: fs.Stats
      try {
        stat = fs.statSync(projectDir)
        if (!stat.isDirectory()) continue
      } catch {
        continue
      }

      const cwd = encoded.replace(/-/g, '/')
      const projectName = cwd.split('/').filter(Boolean).pop() ?? encoded
      const sessions: SessionSummary[] = []
      let projectLastUsed = 0

      for (const file of fs.readdirSync(projectDir)) {
        if (!file.endsWith('.jsonl')) continue
        const sessionId = file.replace(/\.jsonl$/, '')
        const filePath = path.join(projectDir, file)
        let fileStat: fs.Stats
        try {
          fileStat = fs.statSync(filePath)
        } catch {
          continue
        }
        const lastUsed = fileStat.mtimeMs
        if (lastUsed > projectLastUsed) projectLastUsed = lastUsed

        let firstUserPrefix: string | undefined
        let lastUserSuffix: string | undefined
        let firstUserText: string | undefined
        let lastUserText: string | undefined

        const { entries } = parseSessionFile(filePath, 512 * 1024 /* 512KB for perf */)

        const allUserTexts: string[] = []
        for (const entry of entries) {
          if (entry['type'] !== 'user') continue
          if (entry['isMeta']) continue
          const msg = entry['message'] as Record<string, unknown> | undefined
          const content = msg?.['content']
          let text = ''
          if (Array.isArray(content)) {
            for (const block of content as Record<string, unknown>[]) {
              if (block['type'] === 'text' && typeof block['text'] === 'string') {
                text += block['text']
              }
            }
          } else if (typeof content === 'string') {
            text = content
          }
          if (text.trim()) allUserTexts.push(text.trim())
        }

        if (allUserTexts.length > 0) {
          const first = allUserTexts[0]
          const last = allUserTexts[allUserTexts.length - 1]
          firstUserPrefix = first.slice(0, 5)
          lastUserSuffix = last.slice(-5)
          firstUserText = first.length > 80 ? first.slice(0, 80) + '…' : first
          lastUserText = last.length > 80 ? last.slice(0, 80) + '…' : last
        }

        sessions.push({ sessionId, cwd, lastUsed, firstUserPrefix, lastUserSuffix, firstUserText, lastUserText })
      }

      if (sessions.length === 0) continue
      sessions.sort((a, b) => b.lastUsed - a.lastUsed)

      projects.push({
        cwd,
        projectName,
        encodedPath: encoded,
        sessions,
        lastUsed: projectLastUsed,
      })
    }

    projects.sort((a, b) => b.lastUsed - a.lastUsed)
    return { projects }
  }

  loadSessionMessages(encodedPath: string, sessionId: string): { messages: Array<{ role: 'user' | 'assistant'; text: string; isToolCall?: boolean; toolName?: string; fullInput?: string }>; usage: SessionUsage } {
    const filePath = path.join(os.homedir(), '.claude', 'projects', encodedPath, `${sessionId}.jsonl`)
    const emptyUsage: SessionUsage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0, costUsd: 0 }

    const { entries } = parseSessionFile(filePath, 2 * 1024 * 1024 /* 2MB */)
    if (entries.length === 0) return { messages: [], usage: emptyUsage }

    const messages: Array<{ role: 'user' | 'assistant'; text: string; isToolCall?: boolean; toolName?: string; fullInput?: string }> = []
    let usage: SessionUsage = { ...emptyUsage }

    for (const entry of entries) {
      const entryType = entry['type'] as string

      if (entryType === 'user') {
        if (entry['isMeta']) continue
        const msg = entry['message'] as Record<string, unknown> | undefined
        const content = msg?.['content']
        let text = ''
        if (typeof content === 'string') {
          text = content
        } else if (Array.isArray(content)) {
          for (const block of content as Record<string, unknown>[]) {
            if (block['type'] === 'text' && typeof block['text'] === 'string') {
              text += block['text']
            }
          }
        }
        if (text.trim()) messages.push({ role: 'user', text: text.trim() })

      } else if (entryType === 'assistant') {
        const msg = entry['message'] as Record<string, unknown> | undefined
        const content = msg?.['content']
        if (!Array.isArray(content)) continue
        for (const block of content as Record<string, unknown>[]) {
          if (block['type'] === 'text' && typeof block['text'] === 'string' && (block['text'] as string).trim()) {
            messages.push({ role: 'assistant', text: (block['text'] as string).trim() })
          } else if (block['type'] === 'tool_use') {
            const toolName = block['name'] as string | undefined
            const input = block['input'] as Record<string, unknown> | undefined
            const summary = toolName === 'Edit' || toolName === 'Write' || toolName === 'MultiEdit'
              ? (input?.['file_path'] as string ?? toolName)
              : JSON.stringify(input ?? {}).slice(0, 80)
            const fullInput = input ? JSON.stringify(input, null, 2) : undefined
            messages.push({ role: 'assistant', text: summary, isToolCall: true, toolName: toolName ?? 'Tool', fullInput })
          }
        }
      } else if (entryType === 'result') {
        const subtype = entry['subtype'] as string | undefined
        if (subtype === 'success') {
          const u = entry['usage'] as Record<string, unknown> | undefined
          if (u) {
            usage = {
              inputTokens: (u['input_tokens'] as number) ?? 0,
              outputTokens: (u['output_tokens'] as number) ?? 0,
              cacheReadTokens: (u['cache_read_input_tokens'] as number) ?? 0,
              cacheCreationTokens: (u['cache_creation_input_tokens'] as number) ?? 0,
              costUsd: (entry['cost_usd'] as number) ?? 0,
            }
          }
        }
      }
    }

    return { messages, usage }
  }

  deleteSession(encodedPath: string, sessionId: string): void {
    const filePath = path.join(os.homedir(), '.claude', 'projects', encodedPath, `${sessionId}.jsonl`)
    if (fs.existsSync(filePath)) fs.rmSync(filePath)
  }

  deleteProject(encodedPath: string): void {
    const dirPath = path.join(os.homedir(), '.claude', 'projects', encodedPath)
    if (fs.existsSync(dirPath)) fs.rmSync(dirPath, { recursive: true, force: true })
  }
}
