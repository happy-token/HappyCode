import { ipcMain } from 'electron'
import type { ProviderConfig } from '../../shared/types'
import {
  saveProvider, listProviders, deleteProvider, updateProvider,
  activateProvider, activateOfficial, getActiveProvider,
  testProviderById, testProviderConfigFn, PROVIDER_PRESETS,
} from '../provider-manager'
import { diagnoseProvider } from '../provider-doctor'

export function registerProviderHandlers(): void {
  ipcMain.handle('providers:list', async () => {
    return listProviders()
  })

  ipcMain.handle('providers:create', async (_event, provider) => {
    return saveProvider(provider)
  })

  ipcMain.handle('providers:update', async (_event, { id, updates }: { id: string; updates: Partial<ProviderConfig> }) => {
    await updateProvider(id, updates)
  })

  ipcMain.handle('providers:delete', async (_event, { id }: { id: string }) => {
    await deleteProvider(id)
  })

  ipcMain.handle('providers:activate', async (_event, { id }: { id: string }) => {
    await activateProvider(id)
  })

  ipcMain.handle('providers:activate-official', async () => {
    await activateOfficial()
  })

  ipcMain.handle('providers:active', async () => {
    return getActiveProvider()
  })

  ipcMain.handle('providers:test', async (_event, { id }: { id: string }) => {
    return testProviderById(id)
  })

  ipcMain.handle('providers:test-config', async (_event, config: { baseUrl: string; apiKey: string; modelId: string; apiFormat: import('../../shared/types').ApiFormat }) => {
    return testProviderConfigFn(config)
  })

  ipcMain.handle('providers:presets', async () => {
    return { presets: PROVIDER_PRESETS }
  })

  ipcMain.handle('providers:diagnose', async (_event, { id }: { id: string }) => {
    return diagnoseProvider(id)
  })
}
