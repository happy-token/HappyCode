import React, { useEffect, useRef } from 'react'
import { Wrench } from 'lucide-react'
import type { PermissionRequest } from '../../../electron/shared/types'

interface Props {
  request: PermissionRequest
  onAllow: () => void
  onDeny: () => void
}

export function PermissionDialog({ request, onAllow, onDeny }: Props): React.JSX.Element {
  const inputStr =
    request.toolInput && typeof request.toolInput === 'object'
      ? JSON.stringify(request.toolInput, null, 2)
      : String(request.toolInput ?? '')

  const allowRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    // Auto-focus the Allow button on mount
    allowRef.current?.focus()

    function handleKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') onDeny()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onDeny])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="perm-dialog-title"
      className="fixed inset-0 bg-[rgba(0,0,0,0.6)] flex items-center justify-center z-[100]"
    >
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-lg)] p-6 w-[480px] max-w-[90vw] max-h-[70vh] overflow-hidden flex flex-col gap-4">
        <div className="flex items-center gap-2.5">
          <Wrench size={18} className="text-[var(--color-text-muted)] flex-shrink-0" aria-hidden="true" />
          <div>
            <div id="perm-dialog-title" className="font-bold text-[14px]">Tool permission required</div>
            <div className="font-mono text-[11px] text-[var(--color-accent)] mt-0.5">
              {request.toolName}
            </div>
          </div>
        </div>

        <pre
          className="flex-1 overflow-auto font-mono text-[11px] bg-[var(--color-surface-2)] rounded-[var(--radius-md)] p-3 text-[var(--color-text-muted)] whitespace-pre-wrap break-all max-h-[200px]"
          tabIndex={0}
          aria-label={`Tool input for ${request.toolName}`}
        >
          {inputStr.slice(0, 2000)}
          {inputStr.length > 2000 ? '\n…' : ''}
        </pre>

        <div className="flex gap-2.5 justify-end">
          <button
            onClick={onDeny}
            className="px-[18px] py-2 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-transparent text-[13px] text-[var(--color-danger)] cursor-pointer"
          >
            Deny
          </button>
          <button
            ref={allowRef}
            onClick={onAllow}
            className="px-[18px] py-2 rounded-[var(--radius-sm)] bg-[var(--color-accent)] text-white text-[13px] font-semibold border-none cursor-pointer"
          >
            Allow
          </button>
        </div>
      </div>
    </div>
  )
}
