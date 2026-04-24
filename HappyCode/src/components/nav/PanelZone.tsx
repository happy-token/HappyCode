import React from 'react'
import { useUiStore } from '../../store/ui-store'
import { useSubagentStore } from '../../store/subagent-store'
import { SubagentTree } from '../agent-tree/SubagentTree'

export function PanelZone(): React.JSX.Element {
  const showPanel = useUiStore((s) => s.showPanel)
  const nodes = useSubagentStore((s) => s.nodes)

  if (!showPanel || nodes.size <= 1) return <></>

  return (
    <div
      style={{
        width: 280,
        flexShrink: 0,
        borderLeft: '1px solid var(--color-border)',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--color-surface)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '6px 12px',
          borderBottom: '1px solid var(--color-border)',
          fontSize: 10,
          fontWeight: 700,
          color: 'var(--color-text-muted)',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          flexShrink: 0,
        }}
      >
        Agent Tree
      </div>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <SubagentTree nodes={nodes} />
      </div>
    </div>
  )
}
