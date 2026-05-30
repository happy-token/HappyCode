/**
 * Shared debug logger for Electron main process.
 * Uses stderr to avoid interfering with IPC (stdout is JSONL).
 * In production, replace with structured logging (pino/winston).
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogEntry {
  ts: string
  level: LogLevel
  module: string
  message: string
  error?: string
}

function formatEntry(entry: LogEntry): string {
  const parts = [
    `[${entry.ts}]`,
    entry.level.toUpperCase(),
    `[${entry.module}]`,
    entry.message,
  ]
  if (entry.error) parts.push(`| error=${entry.error}`)
  return parts.join(' ')
}

function log(level: LogLevel, module: string, message: string, error?: unknown): void {
  const entry: LogEntry = {
    ts: new Date().toISOString(),
    level,
    module,
    message,
    error: error instanceof Error ? error.message : error ? String(error) : undefined,
  }
  const line = formatEntry(entry)
  if (level === 'error') {
    process.stderr.write(line + '\n')
  } else {
    process.stderr.write(line + '\n')
  }
}

export const logger = {
  debug: (module: string, message: string) => log('debug', module, message),
  info: (module: string, message: string) => log('info', module, message),
  warn: (module: string, message: string, error?: unknown) => log('warn', module, message, error),
  error: (module: string, message: string, error?: unknown) => log('error', module, message, error),
}
