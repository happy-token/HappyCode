import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

export type ActivePage = 'chat' | 'sessions' | 'mcp' | 'skills' | 'hooks' | 'settings'
export type Theme = 'dark' | 'light'

function loadTheme(): Theme {
  const saved = localStorage.getItem('happycode:theme')
  return saved === 'light' ? 'light' : 'dark'
}

interface UiState {
  activePage: ActivePage
  showPanel: boolean
  theme: Theme
  setActivePage: (page: ActivePage) => void
  setShowPanel: (show: boolean) => void
  togglePanel: () => void
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

export const useUiStore = create<UiState>()(
  immer((set) => ({
    activePage: 'chat',
    showPanel: false,
    theme: loadTheme(),

    setActivePage: (page) =>
      set((s) => {
        s.activePage = page
      }),

    setShowPanel: (show) =>
      set((s) => {
        s.showPanel = show
      }),

    togglePanel: () =>
      set((s) => {
        s.showPanel = !s.showPanel
      }),

    setTheme: (theme) =>
      set((s) => {
        s.theme = theme
        localStorage.setItem('happycode:theme', theme)
        document.documentElement.setAttribute('data-theme', theme)
      }),

    toggleTheme: () =>
      set((s) => {
        const next: Theme = s.theme === 'dark' ? 'light' : 'dark'
        s.theme = next
        localStorage.setItem('happycode:theme', next)
        document.documentElement.setAttribute('data-theme', next)
      }),
  }))
)
