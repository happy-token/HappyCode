import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

export type ActivePage = 'chat' | 'sessions' | 'mcp' | 'skills' | 'hooks' | 'settings'

interface UiState {
  activePage: ActivePage
  cwd: string
  showPanel: boolean
  setActivePage: (page: ActivePage) => void
  setCwd: (cwd: string) => void
  setShowPanel: (show: boolean) => void
  togglePanel: () => void
}

export const useUiStore = create<UiState>()(
  immer((set) => ({
    activePage: 'chat',
    cwd: '',
    showPanel: false,

    setActivePage: (page) =>
      set((s) => {
        s.activePage = page
      }),

    setCwd: (cwd) =>
      set((s) => {
        s.cwd = cwd
      }),

    setShowPanel: (show) =>
      set((s) => {
        s.showPanel = show
      }),

    togglePanel: () =>
      set((s) => {
        s.showPanel = !s.showPanel
      }),
  }))
)
