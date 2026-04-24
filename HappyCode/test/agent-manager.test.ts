import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks (hoisted by vitest) ───────────────────────────────────────────────

vi.mock('electron', () => ({
  BrowserWindow: class MockBrowserWindow {
    isDestroyed() { return false }
    on(_event: string, _cb: () => void) {}
    webContents = { send: vi.fn() }
  },
}))

vi.mock('@anthropic-ai/claude-agent-sdk')

// ── Imports ─────────────────────────────────────────────────────────────────

import { query } from '@anthropic-ai/claude-agent-sdk'
import { BrowserWindow } from 'electron'
import { AgentManager } from '../electron/main/agent-manager'
import type { AgentStartParams } from '../electron/shared/types'

const mockQuery = vi.mocked(query)

// ── Helpers ──────────────────────────────────────────────────────────────────

function deferred<T = void>() {
  let resolve!: (v: T) => void
  const promise = new Promise<T>((res) => { resolve = res })
  return { promise, resolve }
}

async function* syncMessages(...msgs: unknown[]) {
  for (const msg of msgs) yield msg
}

const initMsg = (sessionId: string) => ({
  type: 'system',
  subtype: 'init',
  session_id: sessionId,
})

const defaultParams: AgentStartParams = {
  prompt: 'hello world',
  cwd: '/tmp/test-project',
}

type CanUseTool = (toolName: string, toolInput: Record<string, unknown>) => Promise<unknown>

// ── Tests ────────────────────────────────────────────────────────────────────

describe('AgentManager', () => {
  let win: InstanceType<typeof BrowserWindow>
  let manager: AgentManager
  let mockSend: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    win = new BrowserWindow()
    mockSend = win.webContents.send as ReturnType<typeof vi.fn>
    manager = new AgentManager(win as unknown as import('electron').BrowserWindow)
  })

  // ── 1. Session lifecycle ──────────────────────────────────────────────────

  describe('startSession', () => {
    it('returns a temporary pending-* ID synchronously', () => {
      mockQuery.mockReturnValue(syncMessages() as unknown as ReturnType<typeof query>)
      const id = manager.startSession(defaultParams)
      expect(id).toMatch(/^pending-\d+$/)
    })

    it('forwards every message as agent:event', async () => {
      const sessionId = 'sess-lifecycle-1'
      mockQuery.mockReturnValue(
        syncMessages(
          initMsg(sessionId),
          { type: 'user', message: {} },
        ) as unknown as ReturnType<typeof query>
      )
      manager.startSession(defaultParams)
      await vi.waitUntil(
        () => mockSend.mock.calls.filter((c) => c[0] === 'agent:event').length >= 2,
        { timeout: 2000 },
      )
      const types = mockSend.mock.calls
        .filter((c) => c[0] === 'agent:event')
        .map((c) => c[1].msg.type)
      expect(types).toContain('system')
      expect(types).toContain('user')
    })

    it('sends agent:done after generator exhausts', async () => {
      const sessionId = 'sess-done-1'
      mockQuery.mockReturnValue(
        syncMessages(initMsg(sessionId)) as unknown as ReturnType<typeof query>
      )
      manager.startSession(defaultParams)
      await vi.waitUntil(
        () => mockSend.mock.calls.some((c) => c[0] === 'agent:done'),
        { timeout: 2000 },
      )
      const doneCall = mockSend.mock.calls.find((c) => c[0] === 'agent:done')!
      expect(doneCall[1].sessionId).toBe(sessionId)
    })

    it('sends agent:error on non-abort SDK errors', async () => {
      const sessionId = 'sess-err-1'
      mockQuery.mockImplementation(() => {
        return (async function* () {
          yield initMsg(sessionId)
          throw new Error('SDK exploded')
        })() as unknown as ReturnType<typeof query>
      })
      manager.startSession(defaultParams)
      await vi.waitUntil(
        () => mockSend.mock.calls.some((c) => c[0] === 'agent:error'),
        { timeout: 2000 },
      )
      const errCall = mockSend.mock.calls.find((c) => c[0] === 'agent:error')!
      expect(errCall[1].error).toBe('SDK exploded')
      expect(errCall[1].sessionId).toBe(sessionId)
    })
  })

  // ── 2. Session ID resolution ──────────────────────────────────────────────

  describe('session ID resolution', () => {
    it('updates all subsequent agent:event sessionIds after system/init', async () => {
      const realId = 'real-uuid-abc123'
      const { promise: pause, resolve: unpause } = deferred()

      mockQuery.mockImplementation(() => {
        return (async function* () {
          yield initMsg(realId)
          yield { type: 'assistant', message: { content: [] } }
          await pause
        })() as unknown as ReturnType<typeof query>
      })

      manager.startSession(defaultParams)
      await vi.waitUntil(
        () => mockSend.mock.calls.filter((c) => c[0] === 'agent:event').length >= 2,
        { timeout: 2000 },
      )

      const sessionIds = mockSend.mock.calls
        .filter((c) => c[0] === 'agent:event')
        .map((c) => c[1].sessionId)
      expect(sessionIds[0]).toBe(realId)
      expect(sessionIds[1]).toBe(realId)

      unpause()
    })
  })

  // ── 3. Internal tools — auto-allowed ─────────────────────────────────────

  describe('canUseTool — internal tools', () => {
    const INTERNAL = [
      'ExitPlanMode', 'EnterPlanMode',
      'TodoWrite', 'TaskCreate', 'TaskUpdate', 'TaskList', 'TaskGet',
      'PushNotification', 'ScheduleWakeup', 'CronCreate', 'CronDelete', 'CronList',
    ]

    it('auto-allows all internal tools without sending agent:permission-request', async () => {
      const { promise: pause, resolve: unpause } = deferred()
      let canUseTool: CanUseTool | undefined

      mockQuery.mockImplementation((opts: unknown) => {
        canUseTool = (opts as { options: { canUseTool: CanUseTool } }).options.canUseTool
        return (async function* () {
          yield initMsg('sess-internal-1')
          await pause
        })() as unknown as ReturnType<typeof query>
      })

      manager.startSession(defaultParams)
      await vi.waitUntil(() => canUseTool !== undefined, { timeout: 2000 })

      for (const tool of INTERNAL) {
        const result = await canUseTool!(tool, {})
        expect(result, `${tool} should be auto-allowed`).toEqual({ behavior: 'allow' })
      }

      expect(mockSend.mock.calls.filter((c) => c[0] === 'agent:permission-request')).toHaveLength(0)
      unpause()
    })
  })

  // ── 4. External tools — permission request + response ────────────────────

  describe('canUseTool — external tools', () => {
    it('sends agent:permission-request IPC and resolves allow', async () => {
      const { promise: pause, resolve: unpause } = deferred()
      let canUseTool: CanUseTool | undefined
      const sessionId = 'sess-ext-allow-1'

      mockQuery.mockImplementation((opts: unknown) => {
        canUseTool = (opts as { options: { canUseTool: CanUseTool } }).options.canUseTool
        return (async function* () {
          yield initMsg(sessionId)
          await pause
        })() as unknown as ReturnType<typeof query>
      })

      manager.startSession(defaultParams)
      await vi.waitUntil(
        () => mockSend.mock.calls.some((c) => c[0] === 'agent:event'),
        { timeout: 2000 },
      )
      await vi.waitUntil(() => canUseTool !== undefined, { timeout: 2000 })

      const permPromise = canUseTool!('Bash', { command: 'ls' })

      await vi.waitUntil(
        () => mockSend.mock.calls.some((c) => c[0] === 'agent:permission-request'),
        { timeout: 2000 },
      )

      const permReq = mockSend.mock.calls.find((c) => c[0] === 'agent:permission-request')![1]
      expect(permReq.sessionId).toBe(sessionId)
      expect(permReq.toolName).toBe('Bash')
      expect(permReq.toolInput).toEqual({ command: 'ls' })
      expect(permReq.reqId).toBeTruthy()

      manager.respondPermission({ sessionId, reqId: permReq.reqId, allowed: true })

      const result = await permPromise
      expect(result).toEqual({ behavior: 'allow' })

      unpause()
    })

    it('resolves with deny when user rejects permission', async () => {
      const { promise: pause, resolve: unpause } = deferred()
      let canUseTool: CanUseTool | undefined
      const sessionId = 'sess-ext-deny-1'

      mockQuery.mockImplementation((opts: unknown) => {
        canUseTool = (opts as { options: { canUseTool: CanUseTool } }).options.canUseTool
        return (async function* () {
          yield initMsg(sessionId)
          await pause
        })() as unknown as ReturnType<typeof query>
      })

      manager.startSession(defaultParams)
      await vi.waitUntil(
        () => mockSend.mock.calls.some((c) => c[0] === 'agent:event'),
        { timeout: 2000 },
      )
      await vi.waitUntil(() => canUseTool !== undefined, { timeout: 2000 })

      const permPromise = canUseTool!('Write', { file_path: '/etc/hosts' })
      await vi.waitUntil(
        () => mockSend.mock.calls.some((c) => c[0] === 'agent:permission-request'),
        { timeout: 2000 },
      )

      const permReq = mockSend.mock.calls.find((c) => c[0] === 'agent:permission-request')![1]
      manager.respondPermission({ sessionId, reqId: permReq.reqId, allowed: false })

      const result = await permPromise
      expect(result).toEqual({ behavior: 'deny', message: 'User denied' })

      unpause()
    })

    it('respondPermission for unknown reqId is a no-op (does not throw)', () => {
      expect(() => {
        manager.respondPermission({ sessionId: 'no-such-session', reqId: 'fake', allowed: true })
      }).not.toThrow()
    })
  })

  // ── 5. AskUserQuestion ────────────────────────────────────────────────────

  describe('AskUserQuestion handling', () => {
    it('pauses without IPC and resolves via sendToolResult', async () => {
      const { promise: pause, resolve: unpause } = deferred()
      let canUseTool: CanUseTool | undefined
      const sessionId = 'sess-ask-1'

      mockQuery.mockImplementation((opts: unknown) => {
        canUseTool = (opts as { options: { canUseTool: CanUseTool } }).options.canUseTool
        return (async function* () {
          yield initMsg(sessionId)
          await pause
        })() as unknown as ReturnType<typeof query>
      })

      manager.startSession(defaultParams)
      await vi.waitUntil(
        () => mockSend.mock.calls.some((c) => c[0] === 'agent:event'),
        { timeout: 2000 },
      )
      await vi.waitUntil(() => canUseTool !== undefined, { timeout: 2000 })

      const askPromise = canUseTool!('AskUserQuestion', { question: 'Proceed?' })

      // No permission IPC fired for AskUserQuestion
      expect(mockSend.mock.calls.filter((c) => c[0] === 'agent:permission-request')).toHaveLength(0)

      manager.sendToolResult(sessionId, 'tool-use-abc', 'yes please')

      const result = await askPromise
      expect(result).toEqual({ behavior: 'deny', message: 'yes please' })

      unpause()
    })

    it('sendToolResult for unknown session is a no-op (does not throw)', () => {
      expect(() => {
        manager.sendToolResult('no-such-session', 'tool-id', 'answer')
      }).not.toThrow()
    })
  })

  // ── 6. Abort ──────────────────────────────────────────────────────────────

  describe('abortSession', () => {
    it('sends agent:done but NOT agent:error when session is aborted', async () => {
      const sessionId = 'sess-abort-1'

      mockQuery.mockImplementation((opts: unknown) => {
        const abort = (opts as { options: { abortController: AbortController } }).options.abortController
        return (async function* () {
          yield initMsg(sessionId)
          await new Promise<void>((_, reject) => {
            abort.signal.addEventListener('abort', () => {
              const err = new Error('Aborted')
              err.name = 'AbortError'
              reject(err)
            })
          })
        })() as unknown as ReturnType<typeof query>
      })

      manager.startSession(defaultParams)
      await vi.waitUntil(
        () => mockSend.mock.calls.some((c) => c[0] === 'agent:event'),
        { timeout: 2000 },
      )

      manager.abortSession(sessionId)

      await vi.waitUntil(
        () => mockSend.mock.calls.some((c) => c[0] === 'agent:done'),
        { timeout: 2000 },
      )

      expect(mockSend.mock.calls.filter((c) => c[0] === 'agent:error')).toHaveLength(0)
      expect(mockSend.mock.calls.find((c) => c[0] === 'agent:done')![1].sessionId).toBe(sessionId)
    })

    it('abortSession for unknown sessionId is a no-op (does not throw)', () => {
      expect(() => {
        manager.abortSession('non-existent-session')
      }).not.toThrow()
    })
  })

  // ── 7. Subagent events ────────────────────────────────────────────────────

  describe('subagent events', () => {
    it('emits agent:subagent-event with status=running on task_started', async () => {
      const sessionId = 'sess-subagent-1'
      mockQuery.mockReturnValue(
        syncMessages(
          initMsg(sessionId),
          {
            type: 'system',
            subtype: 'task_started',
            task_id: 'task-001',
            description: 'Running subtask',
            task_type: 'agent',
          },
        ) as unknown as ReturnType<typeof query>
      )
      manager.startSession(defaultParams)
      await vi.waitUntil(
        () => mockSend.mock.calls.some((c) => c[0] === 'agent:subagent-event'),
        { timeout: 2000 },
      )
      const ev = mockSend.mock.calls.find((c) => c[0] === 'agent:subagent-event')![1]
      expect(ev.rootSessionId).toBe(sessionId)
      expect(ev.node.id).toBe('task-001')
      expect(ev.node.description).toBe('Running subtask')
      expect(ev.node.status).toBe('running')
    })

    it('emits status=done for task_notification completed', async () => {
      const sessionId = 'sess-subagent-2'
      mockQuery.mockReturnValue(
        syncMessages(
          initMsg(sessionId),
          { type: 'system', subtype: 'task_started', task_id: 'task-002', description: 'Sub', task_type: 'agent' },
          { type: 'system', subtype: 'task_notification', task_id: 'task-002', status: 'completed', usage: { input_tokens: 100, output_tokens: 50 } },
        ) as unknown as ReturnType<typeof query>
      )
      manager.startSession(defaultParams)
      await vi.waitUntil(
        () => mockSend.mock.calls.filter((c) => c[0] === 'agent:subagent-event').length >= 2,
        { timeout: 2000 },
      )
      const notif = mockSend.mock.calls.filter((c) => c[0] === 'agent:subagent-event')[1][1]
      expect(notif.node.id).toBe('task-002')
      expect(notif.node.status).toBe('done')
      expect(notif.node.usage).toEqual({ input_tokens: 100, output_tokens: 50 })
    })

    it('emits status=error for task_notification failed', async () => {
      const sessionId = 'sess-subagent-3'
      mockQuery.mockReturnValue(
        syncMessages(
          initMsg(sessionId),
          { type: 'system', subtype: 'task_started', task_id: 'task-003', description: 'Sub', task_type: 'agent' },
          { type: 'system', subtype: 'task_notification', task_id: 'task-003', status: 'failed' },
        ) as unknown as ReturnType<typeof query>
      )
      manager.startSession(defaultParams)
      await vi.waitUntil(
        () => mockSend.mock.calls.filter((c) => c[0] === 'agent:subagent-event').length >= 2,
        { timeout: 2000 },
      )
      const notif = mockSend.mock.calls.filter((c) => c[0] === 'agent:subagent-event')[1][1]
      expect(notif.node.status).toBe('error')
    })

    it('ignores task_notification for unknown task_id', async () => {
      const sessionId = 'sess-subagent-4'
      mockQuery.mockReturnValue(
        syncMessages(
          initMsg(sessionId),
          // notification without prior task_started
          { type: 'system', subtype: 'task_notification', task_id: 'ghost-task', status: 'completed' },
        ) as unknown as ReturnType<typeof query>
      )
      manager.startSession(defaultParams)
      await vi.waitUntil(
        () => mockSend.mock.calls.some((c) => c[0] === 'agent:done'),
        { timeout: 2000 },
      )
      // Only the init agent:event; no subagent-event for unknown task_id
      expect(mockSend.mock.calls.filter((c) => c[0] === 'agent:subagent-event')).toHaveLength(0)
    })
  })

  // ── 8. Concurrent sessions ────────────────────────────────────────────────

  describe('concurrent sessions', () => {
    it('routes agent:event to correct session when two sessions run in parallel', async () => {
      const { promise: pause1, resolve: unpause1 } = deferred()
      const { promise: pause2, resolve: unpause2 } = deferred()
      const sessId1 = 'sess-concurrent-1'
      const sessId2 = 'sess-concurrent-2'

      mockQuery
        .mockImplementationOnce(() =>
          (async function* () {
            yield initMsg(sessId1)
            await pause1
          })() as unknown as ReturnType<typeof query>
        )
        .mockImplementationOnce(() =>
          (async function* () {
            yield initMsg(sessId2)
            await pause2
          })() as unknown as ReturnType<typeof query>
        )

      manager.startSession({ prompt: 'task 1', cwd: '/tmp/p1' })
      manager.startSession({ prompt: 'task 2', cwd: '/tmp/p2' })

      await vi.waitUntil(
        () => mockSend.mock.calls.filter((c) => c[0] === 'agent:event').length >= 2,
        { timeout: 2000 },
      )

      const sessionIds = new Set(
        mockSend.mock.calls
          .filter((c) => c[0] === 'agent:event')
          .map((c) => c[1].sessionId),
      )
      expect(sessionIds).toContain(sessId1)
      expect(sessionIds).toContain(sessId2)

      unpause1()
      unpause2()
    })
  })
})
