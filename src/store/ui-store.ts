import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

export type ActivePage = 'chat' | 'sessions' | 'settings' | 'hooks' | 'skills' | 'mcp'
export type Theme = 'dark' | 'light'
export type Locale = 'en' | 'zh' | 'es' | 'ja' | 'ko' | 'fr' | 'pt' | 'de' | 'ar'

function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme)
  document.documentElement.classList.toggle('dark', theme === 'dark')
}

function loadTheme(): Theme {
  const saved = localStorage.getItem('happycode:theme')
  const theme: Theme = saved === 'dark' ? 'dark' : 'light'
  applyTheme(theme)
  return theme
}

function loadJson<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback }
  catch { return fallback }
}

function loadLocale(): Locale {
  const saved = localStorage.getItem('happycode:locale')
  const valid: Locale[] = ['en', 'zh', 'es', 'ja', 'ko', 'fr', 'pt', 'de', 'ar']
  if (valid.includes(saved as Locale)) return saved as Locale
  return 'en'
}

interface UiState {
  activePage: ActivePage
  showPanel: boolean
  theme: Theme
  locale: Locale
  pinnedProjects: string[]
  projectOrder: string[]
  showGit: boolean
  showFiles: boolean
  showSearch: boolean
  showClaudeMd: boolean
  sidebarCollapsed: boolean

  setActivePage: (page: ActivePage) => void
  setShowPanel: (show: boolean) => void
  togglePanel: () => void
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
  setLocale: (locale: Locale) => void
  togglePin: (encodedPath: string) => void
  setPinnedOrder: (order: string[]) => void
  setProjectOrder: (order: string[]) => void
  toggleGit: () => void
  toggleFiles: () => void
  setShowGit: (v: boolean) => void
  setShowFiles: (v: boolean) => void
  setShowSearch: (v: boolean) => void
  setShowClaudeMd: (v: boolean) => void
  setSidebarCollapsed: (v: boolean) => void
}

export const useUiStore = create<UiState>()(
  immer((set) => ({
    activePage: 'chat',
    showPanel: false,
    theme: loadTheme(),
    locale: loadLocale(),
    pinnedProjects: loadJson<string[]>('happycode:pinnedProjects', []),
    projectOrder: loadJson<string[]>('happycode:projectOrder', []),
    showGit: false,
    showFiles: false,
    showSearch: false,
    showClaudeMd: false,
    sidebarCollapsed: localStorage.getItem('happycode:sidebarCollapsed') === 'true',

    setActivePage: (page) =>
      set((s) => { s.activePage = page }),

    setShowPanel: (show) =>
      set((s) => { s.showPanel = show }),

    togglePanel: () =>
      set((s) => { s.showPanel = !s.showPanel }),

    setTheme: (theme) =>
      set((s) => {
        s.theme = theme
        localStorage.setItem('happycode:theme', theme)
        applyTheme(theme)
      }),

    toggleTheme: () =>
      set((s) => {
        const next: Theme = s.theme === 'dark' ? 'light' : 'dark'
        s.theme = next
        localStorage.setItem('happycode:theme', next)
        applyTheme(next)
      }),

    setLocale: (locale) =>
      set((s) => {
        s.locale = locale
        localStorage.setItem('happycode:locale', locale)
        void import('i18next').then((m) => { m.default.changeLanguage(locale) })
      }),

    togglePin: (encodedPath) =>
      set((s) => {
        const next = s.pinnedProjects.includes(encodedPath)
          ? s.pinnedProjects.filter((id) => id !== encodedPath)
          : [...s.pinnedProjects, encodedPath]
        s.pinnedProjects = next
        localStorage.setItem('happycode:pinnedProjects', JSON.stringify(next))
      }),

    setPinnedOrder: (order) =>
      set((s) => {
        s.pinnedProjects = order
        localStorage.setItem('happycode:pinnedProjects', JSON.stringify(order))
      }),

    setProjectOrder: (order) =>
      set((s) => {
        s.projectOrder = order
        localStorage.setItem('happycode:projectOrder', JSON.stringify(order))
      }),

    toggleGit: () => set((s) => { s.showGit = !s.showGit }),
    toggleFiles: () => set((s) => { s.showFiles = !s.showFiles }),
    setShowGit: (v) => set((s) => { s.showGit = v }),
    setShowFiles: (v) => set((s) => { s.showFiles = v }),
    setShowSearch: (v) => set((s) => { s.showSearch = v }),
    setShowClaudeMd: (v) => set((s) => { s.showClaudeMd = v }),
    setSidebarCollapsed: (v) => set((s) => {
      s.sidebarCollapsed = v
      localStorage.setItem('happycode:sidebarCollapsed', String(v))
    }),
  }))
)
