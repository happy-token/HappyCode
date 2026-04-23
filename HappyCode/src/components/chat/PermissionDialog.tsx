import React from 'react'
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

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
    >
      <div
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: 24,
          width: 480,
          maxWidth: '90vw',
          maxHeight: '70vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>🔧</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Tool permission required</div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                color: 'var(--color-accent)',
                marginTop: 2,
              }}
            >
              {request.toolName}
            </div>
          </div>
        </div>

        <pre
          style={{
            flex: 1,
            overflow: 'auto',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            background: 'var(--color-surface-2)',
            borderRadius: 'var(--radius-md)',
            padding: 12,
            color: 'var(--color-text-muted)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
            maxHeight: 200,
          }}
        >
          {inputStr.slice(0, 2000)}
          {inputStr.length > 2000 ? '\n…' : ''}
        </pre>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onDeny}
            style={{
              padding: '8px 18px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-border)',
              background: 'transparent',
              fontSize: 13,
              color: 'var(--color-danger)',
            }}
          >
            Deny
          </button>
          <button
            onClick={onAllow}
            style={{
              padding: '8px 18px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--color-accent)',
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            Allow
          </button>
        </div>
      </div>
    </div>
  )
}
