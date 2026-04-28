import { create } from 'zustand'

export type SettingsTab =
  | 'general'
  | 'permissions'
  | 'providers'
  | 'mcp'
  | 'agents'
  | 'skills'
  | 'plugins'
  | 'hooks'
  | 'computerUse'
  | 'claudeCode'
  | 'export'
  | 'about'

interface SettingsState {
  activeTab: SettingsTab
  pendingTab: SettingsTab | null
  selectedAgent: { agentType: string; source: string; returnTab: SettingsTab } | null

  setActiveTab: (tab: SettingsTab) => void
  setPendingTab: (tab: SettingsTab | null) => void
  setSelectedAgent: (agent: { agentType: string; source: string; returnTab: SettingsTab } | null) => void
}

export const useSettingsStore = create<SettingsState>()((set) => ({
  activeTab: 'general',
  pendingTab: null,
  selectedAgent: null,

  setActiveTab: (tab) => set({ activeTab: tab }),
  setPendingTab: (tab) => set({ pendingTab: tab }),
  setSelectedAgent: (agent) => set({ selectedAgent: agent }),
}))
