import React, { useMemo } from 'react'
import { ReactFlow, Background, Handle, Position, type Node, type Edge, type NodeProps } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { SubagentNodeInfo } from '../../../electron/shared/types'

const STATUS_COLOR: Record<SubagentNodeInfo['status'], string> = {
  running: '#7c6af7',
  done: '#3dd68c',
  error: 'var(--color-danger)',
}

function buildLayout(
  nodes: Map<string, SubagentNodeInfo>
): { flowNodes: Node[]; flowEdges: Edge[] } {
  const NODE_W = 160
  const NODE_H = 64
  const X_GAP = 24
  const Y_GAP = 80

  // Build children map
  const childrenMap = new Map<string, string[]>()
  for (const [id, node] of nodes) {
    const pid = node.parentId
    if (pid) {
      if (!childrenMap.has(pid)) childrenMap.set(pid, [])
      childrenMap.get(pid)!.push(id)
    } else {
      if (!childrenMap.has(id)) childrenMap.set(id, [])
    }
  }

  // Find roots
  const roots = [...nodes.values()].filter((n) => n.parentId === null).map((n) => n.id)

  // Compute subtree widths for centering
  const subtreeWidth = new Map<string, number>()
  function calcWidth(id: string): number {
    const children = childrenMap.get(id) ?? []
    if (children.length === 0) {
      subtreeWidth.set(id, NODE_W)
      return NODE_W
    }
    const total = children.reduce((sum, c) => sum + calcWidth(c) + X_GAP, -X_GAP)
    subtreeWidth.set(id, Math.max(NODE_W, total))
    return subtreeWidth.get(id)!
  }
  roots.forEach(calcWidth)

  const positions = new Map<string, { x: number; y: number }>()

  function place(id: string, x: number, y: number): void {
    positions.set(id, { x, y })
    const children = childrenMap.get(id) ?? []
    if (children.length === 0) return
    const totalW = children.reduce((sum, c) => sum + (subtreeWidth.get(c) ?? NODE_W) + X_GAP, -X_GAP)
    let cx = x + (NODE_W - totalW) / 2
    for (const child of children) {
      const cw = subtreeWidth.get(child) ?? NODE_W
      place(child, cx + (cw - NODE_W) / 2, y + NODE_H + Y_GAP)
      cx += cw + X_GAP
    }
  }

  let rootX = 0
  roots.forEach((r) => {
    place(r, rootX, 0)
    rootX += (subtreeWidth.get(r) ?? NODE_W) + X_GAP * 2
  })

  const flowNodes: Node[] = []
  const flowEdges: Edge[] = []

  for (const [id, node] of nodes) {
    const pos = positions.get(id) ?? { x: 0, y: 0 }
    const color = STATUS_COLOR[node.status]
    flowNodes.push({
      id,
      type: 'agentNode',
      position: pos,
      data: { label: node.description || node.agentType, status: node.status, color },
      style: {
        width: NODE_W,
        height: NODE_H,
        background: `${color}22`,
        border: `1.5px solid ${color}`,
        borderRadius: 8,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '4px 8px',
        gap: 2,
      },
    })

    if (node.parentId) {
      flowEdges.push({
        id: `${node.parentId}-${id}`,
        source: node.parentId,
        target: id,
        style: { stroke: '#4a4a5a', strokeWidth: 1.5 },
        animated: node.status === 'running',
      })
    }
  }

  return { flowNodes, flowEdges }
}

type AgentNodeData = { label: string; status: string; color: string }

function AgentNodeLabel({ data }: NodeProps<Node<AgentNodeData>>): React.JSX.Element {
  return (
    <>
      <Handle type="target" position={Position.Top} className="border-0" style={{ background: data.color }} />
      <div className="text-[10px] font-bold uppercase tracking-[0.05em]" style={{ color: data.color }}>
        {data.status}
      </div>
      <div className="text-[11px] text-[var(--color-text)] font-mono overflow-hidden text-ellipsis whitespace-nowrap max-w-[140px]">
        {data.label}
      </div>
      <Handle type="source" position={Position.Bottom} className="border-0" style={{ background: data.color }} />
    </>
  )
}

const nodeTypes = { agentNode: AgentNodeLabel }

interface SubagentTreeProps {
  nodes: Map<string, SubagentNodeInfo>
}

export function SubagentTree({ nodes }: SubagentTreeProps): React.JSX.Element {
  const { flowNodes, flowEdges } = useMemo(() => buildLayout(nodes), [nodes])

  return (
    <div className="w-full h-full bg-[var(--color-surface-2)]">
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="var(--color-border)" gap={20} />
      </ReactFlow>
    </div>
  )
}
