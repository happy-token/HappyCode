import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock node:fs before importing the module under test
vi.mock('node:fs', () => ({
  default: {
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
    chmodSync: vi.fn(),
  },
}))

vi.mock('node:os', () => ({
  default: {
    homedir: vi.fn(() => '/home/testuser'),
  },
}))

import fs from 'node:fs'
import { injectBridgeHook, getBridgeStatus } from '../electron/main/bridge-injector'

const mockFs = fs as unknown as {
  existsSync: ReturnType<typeof vi.fn>
  readFileSync: ReturnType<typeof vi.fn>
  writeFileSync: ReturnType<typeof vi.fn>
  mkdirSync: ReturnType<typeof vi.fn>
  chmodSync: ReturnType<typeof vi.fn>
}

const SCRIPT_PATH = '/home/testuser/.claude/hooks/gui-bridge.sh'
const SETTINGS_PATH = '/home/testuser/.claude/settings.json'

beforeEach(() => {
  vi.clearAllMocks()
  // Default: settings file exists and is empty object
  mockFs.existsSync.mockImplementation((p: unknown) => {
    if (String(p) === SETTINGS_PATH) return true
    if (String(p) === SCRIPT_PATH) return false
    return false
  })
  mockFs.readFileSync.mockReturnValue('{}')
})

// ── readSettings branches ──────────────────────────────────────

describe('readSettings (via getBridgeStatus)', () => {
  it('returns {} when settings file does not exist', () => {
    mockFs.existsSync.mockReturnValue(false)
    const status = getBridgeStatus()
    expect(status.scriptExists).toBe(false)
    expect(status.injected).toBe(false)
  })

  it('returns {} when settings file contains invalid JSON', () => {
    mockFs.existsSync.mockImplementation((p: unknown) => {
      if (String(p) === SCRIPT_PATH) return true
      if (String(p) === SETTINGS_PATH) return true
      return false
    })
    mockFs.readFileSync.mockReturnValue('not-valid-json{{{')
    const status = getBridgeStatus()
    // No crash, injected=false because hooks key won't exist
    expect(status.scriptExists).toBe(true)
    expect(status.injected).toBe(false)
  })
})

// ── getBridgeStatus branches ───────────────────────────────────

describe('getBridgeStatus', () => {
  it('returns scriptExists=false when script is missing', () => {
    mockFs.existsSync.mockReturnValue(false)
    const status = getBridgeStatus()
    expect(status.scriptExists).toBe(false)
    expect(status.injected).toBe(false)
    expect(status.scriptPath).toBe(SCRIPT_PATH)
  })

  it('returns injected=false when script exists but not in settings', () => {
    mockFs.existsSync.mockImplementation((p: unknown) => {
      if (String(p) === SCRIPT_PATH) return true
      return false
    })
    mockFs.readFileSync.mockReturnValue(JSON.stringify({
      hooks: { PreToolUse: [{ type: 'command', command: '/other/hook.sh' }] },
    }))
    const status = getBridgeStatus()
    expect(status.scriptExists).toBe(true)
    expect(status.injected).toBe(false)
  })

  it('returns injected=true when gui-bridge command is in PreToolUse', () => {
    mockFs.existsSync.mockReturnValue(true)
    mockFs.readFileSync.mockReturnValue(JSON.stringify({
      hooks: {
        PreToolUse: [{ type: 'command', command: SCRIPT_PATH }],
      },
    }))
    const status = getBridgeStatus()
    expect(status.scriptExists).toBe(true)
    expect(status.injected).toBe(true)
  })
})

// ── injectBridgeHook idempotency ───────────────────────────────

describe('injectBridgeHook idempotency', () => {
  it('injects hook into all 11 event types on first call', () => {
    mockFs.existsSync.mockImplementation((p: unknown) => {
      if (String(p) === SETTINGS_PATH) return true
      if (String(p) === SCRIPT_PATH) return true
      return false
    })
    mockFs.readFileSync.mockReturnValue('{}')

    injectBridgeHook()

    expect(mockFs.writeFileSync).toHaveBeenCalled()
    const settingsCall = [...(mockFs.writeFileSync as ReturnType<typeof vi.fn>).mock.calls].find(
      (args) => String(args[0]) === SETTINGS_PATH
    )
    expect(settingsCall).toBeDefined()
    const written = JSON.parse(String(settingsCall![1]))
    const hookTypes = Object.keys(written.hooks)
    expect(hookTypes).toHaveLength(11)
  })

  it('does not duplicate hooks on second inject call', () => {
    let capturedSettings = '{}'

    mockFs.existsSync.mockImplementation((p: unknown) => {
      if (String(p) === SCRIPT_PATH) return true
      return true // settings also exists
    })
    mockFs.readFileSync.mockImplementation(() => capturedSettings)
    mockFs.writeFileSync.mockImplementation((filePath: unknown, data: unknown) => {
      if (String(filePath) === SETTINGS_PATH) {
        capturedSettings = String(data)
      }
    })

    // First inject
    injectBridgeHook()
    const afterFirst = JSON.parse(capturedSettings)
    const countAfterFirst = (afterFirst.hooks['PreToolUse'] as unknown[]).length

    // Second inject — should be idempotent
    injectBridgeHook()
    const afterSecond = JSON.parse(capturedSettings)
    const countAfterSecond = (afterSecond.hooks['PreToolUse'] as unknown[]).length

    expect(countAfterSecond).toBe(countAfterFirst)
  })
})
