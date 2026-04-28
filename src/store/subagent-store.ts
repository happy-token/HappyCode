import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { SubagentNodeInfo } from '../../electron/shared/types'

interface SubagentState {
  rootSessionId: string | null
  nodes: Map<string, SubagentNodeInfo>

  initRoot: (rootSessionId: string, rootLabel: string) => void
  applyEvent: (rootSessionId: string, node: SubagentNodeInfo) => void
  reset: () => void
}

export const useSubagentStore = create<SubagentState>()(
  immer((set) => ({
    rootSessionId: null,
    nodes: new Map(),

    initRoot: (rootSessionId, rootLabel) =>
      set((s) => {
        s.rootSessionId = rootSessionId
        s.nodes = new Map([
          [
            rootSessionId,
            {
              id: rootSessionId,
              parentId: null,
              agentType: 'root',
              description: rootLabel,
              status: 'running',
              startedAt: Date.now(),
            },
          ],
        ])
      }),

    applyEvent: (rootSessionId, node) =>
      set((s) => {
        if (s.rootSessionId !== rootSessionId) return
        s.nodes.set(node.id, node)
      }),

    reset: () =>
      set((s) => {
        s.rootSessionId = null
        s.nodes = new Map()
      }),
  }))
)
