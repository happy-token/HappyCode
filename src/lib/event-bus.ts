/**
 * Lightweight typed event bus for cross-store communication.
 * Replaces direct `useXxxStore.getState()` imports between Zustand stores.
 *
 * Usage:
 *   import { bus } from '@renderer/lib/event-bus'
 *   bus.emit('session:started', { sessionId: 'xxx' })
 *   bus.on('session:started', ({ sessionId }) => { ... })
 */

type EventMap = {
  'session:started': { sessionId: string }
  'session:done': { sessionId: string; inputTokens: number; outputTokens: number; costUsd: number }
  'session:error': { sessionId: string; error: string }
  'agent:permission-request': { sessionId: string; toolName: string }
  'agent:permission-resolved': { sessionId: string; allowed: boolean }
  'tab:changed': { tabId: string; cwd: string }
  'provider:activated': { providerId: string }
  'settings:theme-changed': { theme: 'dark' | 'light' }
  'git:branch-changed': { branch: string }
  'file:opened': { filePath: string }
}

type Listener<T> = (data: T) => void

class EventBus {
  private listeners = new Map<string, Set<Listener<unknown>>>()

  on<K extends keyof EventMap>(event: K, listener: Listener<EventMap[K]>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(listener as Listener<unknown>)
    return () => this.off(event, listener)
  }

  off<K extends keyof EventMap>(event: K, listener: Listener<EventMap[K]>): void {
    this.listeners.get(event)?.delete(listener as Listener<unknown>)
  }

  emit<K extends keyof EventMap>(event: K, data: EventMap[K]): void {
    this.listeners.get(event)?.forEach((fn) => {
      try {
        fn(data)
      } catch (err: unknown) {
        console.warn(`[EventBus] listener error for "${event}":`, err instanceof Error ? err.message : String(err))
      }
    })
  }

  removeAll(): void {
    this.listeners.clear()
  }
}

export const bus = new EventBus()
