import { create } from 'zustand'
import type { ProviderConfig, ProviderPreset, ProviderTestResult } from '../../electron/shared/types'

interface ProviderState {
  providers: ProviderConfig[]
  activeId: string | null
  presets: ProviderPreset[]
  isLoading: boolean

  fetchProviders: () => Promise<void>
  fetchPresets: () => Promise<void>
  createProvider: (provider: Omit<ProviderConfig, 'id'>) => Promise<void>
  updateProvider: (id: string, updates: Partial<ProviderConfig>) => Promise<void>
  deleteProvider: (id: string) => Promise<void>
  activateProvider: (id: string) => Promise<void>
  activateOfficial: () => Promise<void>
  testProvider: (id: string) => Promise<ProviderTestResult>
  testProviderConfig: (config: { baseUrl: string; apiKey: string; modelId: string; apiFormat: import('../../electron/shared/types').ApiFormat }) => Promise<ProviderTestResult>
}

export const useProviderStore = create<ProviderState>()((set, get) => ({
  providers: [],
  activeId: null,
  presets: [],
  isLoading: false,

  fetchProviders: async () => {
    const result = await window.electron.listProviders()
    set({ providers: result.providers, activeId: result.activeId })
  },

  fetchPresets: async () => {
    const result = await window.electron.listProviderPresets()
    set({ presets: result.presets })
  },

  createProvider: async (provider) => {
    await window.electron.createProvider(provider)
    await get().fetchProviders()
  },

  updateProvider: async (id, updates) => {
    await window.electron.updateProvider(id, updates)
    await get().fetchProviders()
  },

  deleteProvider: async (id) => {
    await window.electron.deleteProvider(id)
    await get().fetchProviders()
  },

  activateProvider: async (id) => {
    await window.electron.activateProvider(id)
    await get().fetchProviders()
  },

  activateOfficial: async () => {
    await window.electron.activateOfficial()
    await get().fetchProviders()
  },

  testProvider: async (id) => {
    return window.electron.testProvider(id)
  },

  testProviderConfig: async (config) => {
    return window.electron.testProviderConfig(config)
  },
}))
