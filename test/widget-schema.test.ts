import { describe, it, expect } from 'vitest'
import { validateWidget } from '../src/components/widgets/widget-schema'

describe('validateWidget', () => {
  it('accepts valid chart widget', () => {
    const config = {
      type: 'chart' as const,
      title: 'test',
      data: {
        chartType: 'bar',
        labels: ['A', 'B'],
        datasets: [{ label: 'X', data: [1, 2] }],
      },
    }
    const result = validateWidget(config)
    expect(result.success).toBe(true)
  })

  it('accepts valid svg widget', () => {
    const config = {
      type: 'svg' as const,
      title: 'diagram',
      data: { widget_code: '<svg></svg>' },
    }
    const result = validateWidget(config)
    expect(result.success).toBe(true)
  })

  it('rejects missing type', () => {
    const config = { title: 'test', data: {} }
    const result = validateWidget(config as any)
    expect(result.success).toBe(false)
  })

  it('rejects unknown type', () => {
    const config = { type: 'unknown', title: 'test', data: {} }
    const result = validateWidget(config)
    expect(result.success).toBe(false)
  })

  it('rejects missing title', () => {
    const config = { type: 'table' as const, data: {} }
    const result = validateWidget(config as any)
    expect(result.success).toBe(false)
  })
})
