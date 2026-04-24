import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ExportSettings } from '../../electron/shared/types'

export const DEFAULT_CUSTOM_PATTERNS = [
  '/(?:Users|home)/[^/\\s,"\']+',
  '[A-Z]:\\\\[^\\s,"\']+',
  'sk-[A-Za-z0-9_\\-]{20,}',
]

interface ExportSettingsStore {
  settings: ExportSettings
  setSettings: (settings: ExportSettings) => void
}

export const useExportSettingsStore = create<ExportSettingsStore>()(
  persist(
    (set) => ({
      settings: {
        redactMode: 'full',
        customPatterns: DEFAULT_CUSTOM_PATTERNS,
      },
      setSettings: (settings) => set({ settings }),
    }),
    { name: 'happycode:export-settings' },
  ),
)
