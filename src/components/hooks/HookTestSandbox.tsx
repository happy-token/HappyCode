import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Play, CheckCircle, XCircle } from 'lucide-react'
import type { HookTestResult } from '../../../electron/shared/types'
import { cn } from '@renderer/lib/utils'

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
  const { t } = useTranslation()
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
    <div className="flex flex-col gap-2.5">
      <div>
        <div className="text-[11px] text-[var(--color-text-muted)] mb-1">{t('hooks.mockPayload')}</div>
        <textarea
          value={payloadText}
          onChange={(e) => setPayloadText(e.target.value)}
          className="w-full h-[120px] font-mono text-[11px] px-2 py-1.5 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-[var(--radius-md)] text-[var(--color-text)] resize-y box-border"
        />
      </div>

      <button
        onClick={() => void runTest()}
        disabled={running || !command.trim()}
        className={cn(
          'flex items-center justify-center gap-1.5 px-3.5 py-[7px] border-none rounded-[var(--radius-md)] text-[12px] font-semibold',
          running || !command.trim()
            ? 'bg-[var(--color-surface-3)] text-[var(--color-text-muted)] cursor-not-allowed'
            : 'bg-[var(--color-accent)] text-white cursor-pointer',
        )}
      >
        <Play size={12} />
        {running ? t('hooks.running') : t('hooks.runTest')}
      </button>

      {result !== null && (
        <div className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-[var(--radius-md)] px-2.5 py-2 flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            {result.exitCode === 0
              ? <CheckCircle size={14} color="var(--color-success)" />
              : <XCircle size={14} color="var(--color-danger)" />
            }
            <span
              className={cn(
                'text-[12px] font-mono',
                result.exitCode === 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]',
              )}
            >
              exit {result.exitCode ?? 'null'}
            </span>
            <span className="text-[11px] text-[var(--color-text-muted)]">{result.durationMs}ms</span>
          </div>

          {result.stdout.length > 0 && (
            <div>
              <div className="text-[10px] text-[var(--color-text-muted)] mb-0.5">stdout</div>
              <pre className="font-mono text-[11px] text-[var(--color-text)] bg-[var(--color-surface)] px-2 py-1 rounded-[var(--radius-sm)] overflow-auto max-h-[100px] m-0">
                {result.stdout}
              </pre>
            </div>
          )}

          {result.stderr.length > 0 && (
            <div>
              <div className="text-[10px] text-[var(--color-danger)] mb-0.5">stderr</div>
              <pre className="font-mono text-[11px] text-[var(--color-danger)] bg-[var(--color-surface)] px-2 py-1 rounded-[var(--radius-sm)] overflow-auto max-h-[100px] m-0">
                {result.stderr}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
