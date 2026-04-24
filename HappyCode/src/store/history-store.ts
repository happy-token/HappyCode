import { create } from 'zustand'
import type { ProjectHistory, SessionSummary } from '../../electron/shared/types'

interface HistoryState {
  projects: ProjectHistory[]
  loading: boolean
  error: string | null

  load: () => Promise<void>
  deleteSession: (encodedPath: string, sessionId: string) => Promise<void>
  deleteProject: (encodedPath: string) => Promise<void>
}

export const useHistoryStore = create<HistoryState>((set) => ({
  projects: [],
  loading: false,
  error: null,

  load: async () => {
    set({ loading: true, error: null })
    try {
      const result = await window.electron.listAllHistory()
      set({ projects: result.projects, loading: false })
    } catch (e: unknown) {
      set({ loading: false, error: String(e) })
    }
  },

  deleteSession: async (encodedPath, sessionId) => {
    await window.electron.deleteSession(encodedPath, sessionId)
    set((s) => ({
      projects: s.projects
        .map((p) =>
          p.encodedPath === encodedPath
            ? { ...p, sessions: p.sessions.filter((sess) => sess.sessionId !== sessionId) }
            : p
        )
        .filter((p) => p.sessions.length > 0),
    }))
  },

  deleteProject: async (encodedPath) => {
    await window.electron.deleteProject(encodedPath)
    set((s) => ({
      projects: s.projects.filter((p) => p.encodedPath !== encodedPath),
    }))
  },
}))

export function buildSessionTitle(session: SessionSummary): string {
  const { firstUserPrefix, lastUserSuffix, sessionId } = session
  if (!firstUserPrefix && !lastUserSuffix) return sessionId.slice(0, 8)
  if (firstUserPrefix === lastUserSuffix || !lastUserSuffix) return firstUserPrefix ?? sessionId.slice(0, 8)
  return `${firstUserPrefix}…${lastUserSuffix}`
}

export function buildSessionTooltip(session: SessionSummary): string {
  const parts: string[] = []
  if (session.firstUserText) parts.push(`▶ ${session.firstUserText}`)
  if (session.lastUserText && session.lastUserText !== session.firstUserText) {
    parts.push(`◀ ${session.lastUserText}`)
  }
  const date = new Date(session.lastUsed)
  parts.push(date.toLocaleString())
  parts.push(session.sessionId.slice(0, 8))
  return parts.join('\n')
}
