import { ipcMain } from 'electron'
import type { SessionStore } from '../session-store'

export function registerHistoryHandlers(store: SessionStore): void {
  ipcMain.handle('history:list-all', () => store.listAllHistory())
  ipcMain.handle('history:load-session-messages', (_event, { encodedPath, sessionId }: { encodedPath: string; sessionId: string }) =>
    store.loadSessionMessages(encodedPath, sessionId)
  )
  ipcMain.handle('history:delete-session', (_event, { encodedPath, sessionId }: { encodedPath: string; sessionId: string }) =>
    store.deleteSession(encodedPath, sessionId)
  )
  ipcMain.handle('history:delete-project', (_event, { encodedPath }: { encodedPath: string }) =>
    store.deleteProject(encodedPath)
  )
}
