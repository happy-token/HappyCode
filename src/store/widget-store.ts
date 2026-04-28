import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { WidgetConfig } from '../../electron/shared/types'

interface WidgetState {
  activeWidgets: Map<string, WidgetConfig[]>
  interactions: Map<string, unknown>

  addWidget: (sessionId: string, config: WidgetConfig) => void
  setInteraction: (widgetId: string, data: unknown) => void
  getWidgets: (sessionId: string) => WidgetConfig[]
  clearSession: (sessionId: string) => void
}

export const useWidgetStore = create<WidgetState>()(
  immer((set, get) => ({
    activeWidgets: new Map(),
    interactions: new Map(),

    addWidget: (sessionId: string, config: WidgetConfig) => {
      set((s) => {
        const existing = s.activeWidgets.get(sessionId) ?? []
        s.activeWidgets.set(sessionId, [...existing, config])
      })
    },

    setInteraction: (widgetId: string, data: unknown) => {
      set((s) => { s.interactions.set(widgetId, data) })
    },

    getWidgets: (sessionId: string) => {
      return get().activeWidgets.get(sessionId) ?? []
    },

    clearSession: (sessionId: string) => {
      set((s) => { s.activeWidgets.delete(sessionId) })
    },
  }))
)
