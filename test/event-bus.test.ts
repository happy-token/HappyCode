import { describe, it, expect, vi, beforeEach } from 'vitest'
import { bus } from '../src/lib/event-bus'

beforeEach(() => {
  bus.removeAll()
})

describe('EventBus', () => {
  // ── on / emit / off ──────────────────────────────────────
  it('delivers events to registered listeners', () => {
    const fn = vi.fn()
    bus.on('session:started', fn)
    bus.emit('session:started', { sessionId: 'abc-123' })
    expect(fn).toHaveBeenCalledWith({ sessionId: 'abc-123' })
  })

  it('does not deliver to unregistered listeners', () => {
    const fn = vi.fn()
    bus.on('session:started', fn)
    bus.emit('tab:changed', { tabId: 't1', cwd: '/tmp' })
    expect(fn).not.toHaveBeenCalled()
  })

  it('delivers to multiple listeners for the same event', () => {
    const fn1 = vi.fn()
    const fn2 = vi.fn()
    bus.on('session:done', fn1)
    bus.on('session:done', fn2)
    bus.emit('session:done', { sessionId: 's1', inputTokens: 100, outputTokens: 50, costUsd: 0.01 })
    expect(fn1).toHaveBeenCalledTimes(1)
    expect(fn2).toHaveBeenCalledTimes(1)
  })

  // ── off ───────────────────────────────────────────────────
  it('stops delivering after listener is removed', () => {
    const fn = vi.fn()
    const off = bus.on('session:error', fn)
    bus.emit('session:error', { sessionId: 's1', error: 'fail' })
    expect(fn).toHaveBeenCalledTimes(1)
    off()
    bus.emit('session:error', { sessionId: 's1', error: 'fail again' })
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('off is a no-op for unknown events', () => {
    expect(() => {
      bus.off('session:started' as never, vi.fn())
    }).not.toThrow()
  })

  // ── removeAll ─────────────────────────────────────────────
  it('removeAll clears all listeners', () => {
    const fn1 = vi.fn()
    const fn2 = vi.fn()
    bus.on('session:started', fn1)
    bus.on('session:done', fn2)
    bus.removeAll()
    bus.emit('session:started', { sessionId: 'x' })
    bus.emit('session:done', { sessionId: 'x', inputTokens: 0, outputTokens: 0, costUsd: 0 })
    expect(fn1).not.toHaveBeenCalled()
    expect(fn2).not.toHaveBeenCalled()
  })

  // ── Error resilience ──────────────────────────────────────
  it('continues delivering to other listeners when one throws', () => {
    const bad = vi.fn(() => { throw new Error('listener crash') })
    const good = vi.fn()
    bus.on('session:started', bad)
    bus.on('session:started', good)
    expect(() => {
      bus.emit('session:started', { sessionId: 's1' })
    }).not.toThrow()
    expect(bad).toHaveBeenCalledTimes(1)
    expect(good).toHaveBeenCalledTimes(1)
  })

  // ── Multiple event types ──────────────────────────────────
  it('isolates events by type', () => {
    const onSession = vi.fn()
    const onTab = vi.fn()
    bus.on('session:started', onSession)
    bus.on('tab:changed', onTab)
    bus.emit('session:started', { sessionId: 'a' })
    bus.emit('tab:changed', { tabId: 't1', cwd: '/x' })
    expect(onSession).toHaveBeenCalledTimes(1)
    expect(onTab).toHaveBeenCalledTimes(1)
  })
})
