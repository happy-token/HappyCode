import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import {
  saveProvider,
  listProviders,
  deleteProvider,
  updateProvider,
  activateProvider,
  activateOfficial,
  getActiveProvider,
  type ProviderConfig,
} from '../electron/main/provider-manager'

const testDir = path.join(os.tmpdir(), 'happycode-provider-test-' + Date.now())

function setupTestDir(): void {
  fs.mkdirSync(testDir, { recursive: true })
}

function cleanupTestDir(): void {
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true })
  }
}

describe('provider-manager', () => {
  beforeEach(() => {
    setupTestDir()
  })

  afterEach(() => {
    cleanupTestDir()
  })

  it('saves and lists a provider', async () => {
    const provider: Omit<ProviderConfig, 'id'> = {
      presetId: 'custom',
      name: 'Test Provider',
      baseUrl: 'https://api.test.com',
      apiKey: 'sk-test',
      apiFormat: 'anthropic',
      models: { main: 'test-model', haiku: '', sonnet: '', opus: '' },
    }

    const result = await saveProvider(provider, testDir)
    expect(result.id).toBeDefined()

    const { providers } = await listProviders(testDir)
    expect(providers).toHaveLength(1)
    expect(providers[0].name).toBe('Test Provider')
  })

  it('returns empty list when no providers saved', async () => {
    const { providers } = await listProviders(testDir)
    expect(providers).toHaveLength(0)
  })

  it('deletes a provider', async () => {
    const result = await saveProvider({
      presetId: 'custom',
      name: 'To Delete',
      baseUrl: 'https://test.com',
      apiKey: 'sk-test',
      apiFormat: 'anthropic',
      models: { main: 'm', haiku: '', sonnet: '', opus: '' },
    }, testDir)

    await deleteProvider(result.id, testDir)
    const { providers } = await listProviders(testDir)
    expect(providers).toHaveLength(0)
  })

  it('activates a provider and returns active id', async () => {
    const p1 = await saveProvider({
      presetId: 'custom', name: 'P1', baseUrl: 'https://a.com',
      apiKey: 'sk-1', apiFormat: 'anthropic',
      models: { main: 'm', haiku: '', sonnet: '', opus: '' },
    }, testDir)

    const p2 = await saveProvider({
      presetId: 'custom', name: 'P2', baseUrl: 'https://b.com',
      apiKey: 'sk-2', apiFormat: 'anthropic',
      models: { main: 'm', haiku: '', sonnet: '', opus: '' },
    }, testDir)

    await activateProvider(p1.id, testDir)
    let active = await getActiveProvider(testDir)
    expect(active).toBe(p1.id)

    await activateOfficial(testDir)
    active = await getActiveProvider(testDir)
    expect(active).toBeNull()
  })

  it('updates a provider', async () => {
    const result = await saveProvider({
      presetId: 'custom', name: 'Original', baseUrl: 'https://old.com',
      apiKey: 'sk-old', apiFormat: 'anthropic',
      models: { main: 'm', haiku: '', sonnet: '', opus: '' },
    }, testDir)

    await updateProvider(result.id, { name: 'Updated', baseUrl: 'https://new.com' }, testDir)
    const { providers } = await listProviders(testDir)
    expect(providers[0].name).toBe('Updated')
    expect(providers[0].baseUrl).toBe('https://new.com')
  })
})
