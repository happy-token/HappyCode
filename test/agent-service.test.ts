import { describe, it, expect } from 'vitest'
import { listAgents, getAgentDetail } from '../electron/main/agent-service'

describe('agent-service', () => {
  it('returns built-in agents', () => {
    const result = listAgents()
    expect(result.agents.length).toBeGreaterThanOrEqual(3)
    expect(result.agents.some((a) => a.agentType === 'general-purpose')).toBe(true)
    expect(result.agents.some((a) => a.agentType === 'code-reviewer')).toBe(true)
  })

  it('returns active agents list', () => {
    const result = listAgents()
    expect(result.activeAgents.length).toBeGreaterThan(0)
  })

  it('finds agent detail by type and source', () => {
    const detail = getAgentDetail('general-purpose', 'built-in')
    expect(detail).not.toBeNull()
    expect(detail?.agentType).toBe('general-purpose')
  })

  it('returns null for unknown agent', () => {
    const detail = getAgentDetail('nonexistent', 'built-in')
    expect(detail).toBeNull()
  })
})
