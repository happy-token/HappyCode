import express from 'express'
import type { BrowserWindow } from 'electron'
import type { SessionStore } from './session-store'
import type { HookEvent } from '../shared/types'

const PORT = 37421

export class HookServer {
  private server: ReturnType<typeof express.application.listen> | null = null

  constructor(
    private store: SessionStore,
    private win: BrowserWindow,
  ) {}

  start(): void {
    const app = express()
    app.use(express.json({ limit: '4mb' }))

    // Claude Code hooks POST to this endpoint
    // Body schema (superset — fields depend on hook type):
    // { hook_type, tool_name?, cwd?, session_id?, tool_input?, tool_response?, exit_code? }
    app.post('/hook', (req, res) => {
      const body = req.body as Record<string, unknown>

      const event: Omit<HookEvent, 'id'> = {
        ts: Date.now(),
        hook_type: String(body['hook_type'] ?? 'Unknown'),
        tool_name: body['tool_name'] as string | undefined,
        cwd: body['cwd'] as string | undefined,
        session_id: body['session_id'] as string | undefined,
        input_json:
          body['tool_input'] !== undefined
            ? JSON.stringify(body['tool_input'])
            : undefined,
        output_json:
          body['tool_response'] !== undefined
            ? JSON.stringify(body['tool_response'])
            : undefined,
        exit_code: body['exit_code'] as number | undefined,
      }

      const id = this.store.insertHookEvent(event)
      const stored: HookEvent = { ...event, id }

      this.win.webContents.send('hook:event', stored)

      res.json({ ok: true, id })
    })

    // Health check
    app.get('/health', (_req, res) => res.json({ ok: true, port: PORT }))

    this.server = app.listen(PORT, '127.0.0.1', () => {
      console.log(`[HookServer] listening on http://127.0.0.1:${PORT}`)
    })

    this.server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        console.warn(`[HookServer] port ${PORT} already in use — skipping`)
      } else {
        console.error('[HookServer] error:', err)
      }
    })
  }

  stop(): void {
    this.server?.close()
    this.server = null
  }
}
