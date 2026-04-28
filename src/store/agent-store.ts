import { create } from 'zustand'
import type { AgentDefinition } from '../../electron/shared/types'

interface AgentState {
  agents: AgentDefinition[]
  activeAgents: string[]
  selectedAgent: AgentDefinition | null
  isLoading: boolean

  fetchAgents: (cwd?: string) => Promise<void>
  selectAgent: (agent: AgentDefinition | null) => void
  toggleAgent: (agentType: string) => void
}

export const useAgentStore = create<AgentState>()((set, get) => ({
  agents: [],
  activeAgents: [],
  selectedAgent: null,
  isLoading: false,

  fetchAgents: async (cwd?: string) => {
    set({ isLoading: true })
    try {
      const result = await window.electron.listAgents(cwd)
      set({ agents: result.agents, activeAgents: result.activeAgents })
    } finally {
      set({ isLoading: false })
    }
  },

  selectAgent: (agent) => {
    set({ selectedAgent: agent })
  },

  toggleAgent: (agentType) => {
    const { agents, activeAgents } = get()
    const isActive = activeAgents.includes(agentType)
    set({
      agents: agents.map((a) =>
        a.agentType === agentType ? { ...a, isActive: !isActive } : a,
      ),
      activeAgents: isActive
        ? activeAgents.filter((t) => t !== agentType)
        : [...activeAgents, agentType],
    })
  },
}))
