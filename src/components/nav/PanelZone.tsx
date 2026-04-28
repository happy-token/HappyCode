import React, { useState, useCallback } from 'react'
import { useUiStore } from '../../store/ui-store'
import { useSubagentStore } from '../../store/subagent-store'
import { SubagentTree } from '../agent-tree/SubagentTree'
import { cn } from '@renderer/lib/utils'

export function PanelZone(): React.JSX.Element {
  const showPanel = useUiStore((s) => s.showPanel)
  const nodes = useSubagentStore((s) => s.nodes)

  const [panelWidth, setPanelWidth] = useState(() => {
    const saved = localStorage.getItem('happycode:panelZoneWidth')
    return saved ? Math.max(200, Math.min(600, parseInt(saved, 10))) : 280
  })
  const [isResizing, setIsResizing] = useState(false)

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startW = panelWidth
    setIsResizing(true)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const onMove = (ev: MouseEvent) => {
      const w = Math.max(200, Math.min(600, startW - (ev.clientX - startX)))
      setPanelWidth(w)
      localStorage.setItem('happycode:panelZoneWidth', String(w))
    }
    const onUp = () => {
      setIsResizing(false)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [panelWidth])

  if (!showPanel || nodes.size <= 1) return <></>

  return (
    <div
      className="relative flex flex-shrink-0 flex-col overflow-hidden border-l border-[var(--color-border)] bg-[var(--color-surface)]"
      style={{ width: panelWidth }}
    >
      <div
        className={cn(
          'absolute bottom-0 left-[-2px] top-0 z-10 w-1 cursor-col-resize transition-[background] duration-150 hover:bg-[var(--color-accent)] hover:opacity-50',
          isResizing && 'bg-[var(--color-accent)] opacity-50'
        )}
        onMouseDown={handleResizeStart}
      />
      <div className="flex flex-shrink-0 items-center border-b border-[var(--color-border)] px-3 py-[6px] text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--color-text-muted)]">
        Agent Tree
      </div>
      <div className="flex-1 overflow-hidden">
        <SubagentTree nodes={nodes} />
      </div>
    </div>
  )
}
