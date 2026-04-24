import React, { useState } from 'react'
import { Play, CheckCircle, XCircle } from 'lucide-react'
import type { HookTestResult } from '../../../electron/shared/types'

const MOCK_PAYLOADS: Record<string, unknown> = {
  PreToolUse: { session_id: 'mock-123', tool_name: 'Bash', tool_input: { command: 'ls -la' } },
  PostToolUse: { session_id: 'mock-123', tool_name: 'Bash', tool_input: { command: 'ls -la' }, tool_response: { output: 'file.txt' } },
  PostToolUseFailure: { session_id: 'mock-123', tool_name: 'Bash', error: 'command not found' },
  UserPromptSubmit: { session_id: 'mock-123', prompt: 'Hello Claude' },
  Stop: { session_id: 'mock-123', stop_reason: 'end_turn', CLAUDE_STOP_HOOK_ACTIVE: '0' },
  SubagentStart: { session_id: 'mock-123', parent_session_id: 'parent-456' },
  SubagentStop: { session_id: 'mock-123', parent_session_id: 'parent-456' },
  SessionStart: { session_id: 'mock-123', cwd: '/home/user/project' },
  SessionEnd: { session_id: 'mock-123', cwd: '/home/user/project' },
  Notification: { session_id: 'mock-123', message: 'Task completed' },
  PreCompact: { session_id: 'mock-123', summary: 'Compacting context...' },
}

interface HookTestSandboxProps {
  command: string
  eventName: string
}

export function HookTestSandbox({ command, eventName }: HookTestSandboxProps): React.JSX.Element {
  const defaultPayload = MOCK_PAYLOADS[eventName] ?? { session_id: 'mock-123' }
  const [payloadText, setPayloadText] = useState(JSON.stringify(defaultPayload, null, 2))
  const [result, setResult] = useState<HookTestResult | null>(null)
  const [running, setRunning] = useState(false)

  async function runTest(): Promise<void> {
    setRunning(true)
    setResult(null)
    try {
      let payload: unknown
      try { payload = JSON.parse(payloadText) } catch { payload = defaultPayload }
      const res = await window.electron.testHookRule({ command, eventName, payload })
      setResult(res)
    } catch (err) {
      console.error('[HookTestSandbox] Test failed:', err)
    } finally {
      setRunning(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div>
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 4 }}>Mock Payload（可编辑）</div>
        <textarea
          value={payloadText}
          onChange={(e) => setPayloadText(e.target.value)}
          style={{
            width: '100%',
            height: 120,
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            padding: '6px 8px',
            background: 'var(--color-surface-2)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-text)',
            resize: 'vertical',
            boxSizing: 'border-box',
          }}
        />
      </div>

      <button
        onClick={() => void runTest()}
        disabled={running || !command.trim()}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          padding: '7px 14px',
          background: running ? 'var(--color-surface-3)' : 'var(--color-accent)',
          color: running ? 'var(--color-text-muted)' : '#fff',
          border: 'none',
          borderRadius: 'var(--radius-md)',
          fontSize: 12,
          fontWeight: 600,
          cursor: running || !command.trim() ? 'not-allowed' : 'pointer',
        }}
      >
        <Play size={12} />
        {running ? '运行中…' : '运行测试'}
      </button>

      {result !== null && (
        <div
          style={{
            background: 'var(--color-surface-2)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            padding: '8px 10px',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {result.exitCode === 0
              ? <CheckCircle size={14} color="var(--color-success)" />
              : <XCircle size={14} color="var(--color-danger)" />
            }
            <span style={{
              fontSize: 12,
              fontFamily: 'var(--font-mono)',
              color: result.exitCode === 0 ? 'var(--color-success)' : 'var(--color-danger)',
            }}>
              exit {result.exitCode ?? 'null'}
            </span>
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{result.durationMs}ms</span>
          </div>

          {result.stdout.length > 0 && (
            <div>
              <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginBottom: 2 }}>stdout</div>
              <pre style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                color: 'var(--color-text)',
                background: 'var(--color-surface)',
                padding: '4px 8px',
                borderRadius: 'var(--radius-sm)',
                overflow: 'auto',
                maxHeight: 100,
                margin: 0,
              }}>
                {result.stdout}
              </pre>
            </div>
          )}

          {result.stderr.length > 0 && (
            <div>
              <div style={{ fontSize: 10, color: 'var(--color-danger)', marginBottom: 2 }}>stderr</div>
              <pre style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                color: 'var(--color-danger)',
                background: 'var(--color-surface)',
                padding: '4px 8px',
                borderRadius: 'var(--radius-sm)',
                overflow: 'auto',
                maxHeight: 100,
                margin: 0,
              }}>
                {result.stderr}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
