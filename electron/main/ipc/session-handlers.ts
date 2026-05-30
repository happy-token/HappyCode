import { ipcMain } from 'electron'
import type { SessionStore } from '../session-store'
import { buildCsvContent, applyRedaction, computeChainHashes, buildVerifierScript } from '../export-utils'
import type { ExportSettings } from '../../shared/types'

export function registerSessionHandlers(store: SessionStore): void {
  ipcMain.handle('session:list', (_event, { cwd }: { cwd: string }) => {
    return store.listByCwd(cwd)
  })

  ipcMain.handle(
    'session:history',
    (_event, { sessionId, cwd }: { sessionId: string; cwd: string }) => {
      return store.readHistory(sessionId, cwd)
    }
  )

  ipcMain.handle(
    'export:csv',
    (_event, { sessionId, cwd, settings }: { sessionId: string; cwd: string; settings: ExportSettings }) => {
      const result = store.readHistory(sessionId, cwd)
      if (result.skipped) {
        return { csv: '', error: result.reason }
      }
      const redacted = applyRedaction(result.entries, settings)
      const hashed = computeChainHashes(sessionId, redacted)
      return {
        csv: buildCsvContent(sessionId, hashed),
        verifierScript: buildVerifierScript(sessionId),
      }
    }
  )
}
