import { create } from 'zustand'
import type { ApiConfig, AgentSettings } from '../../electron/shared/types'

interface ApiConfigState {
  config: ApiConfig
  agentSettings: AgentSettings
  loaded: boolean
  load: () => Promise<void>
  save: (config: ApiConfig) => Promise<void>
  saveAgentSettings: (settings: AgentSettings) => Promise<void>
}

export const useApiConfigStore = create<ApiConfigState>((set) => ({
  config: { baseUrl: '', authToken: '' },
  agentSettings: {},
  loaded: false,

  load: async () => {
    const [config, agentSettings] = await Promise.all([
      window.electron.getApiConfig(),
      window.electron.getAgentSettings(),
    ])
    set({ config, agentSettings, loaded: true })
  },

  save: async (config) => {
    set({ config })
    await window.electron.setApiConfig(config)
  },

  saveAgentSettings: async (settings) => {
    set({ agentSettings: settings })
    await window.electron.setAgentSettings(settings)
  },
}))
