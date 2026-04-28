import { describe, it, expect } from 'vitest'
import { parseShowWidget, parseAllShowWidgets } from '../src/components/widgets/widget-parser'

describe('parseShowWidget', () => {
  it('parses complete widget code block', () => {
    const content = 'some text\n```show-widget\n{"type":"chart","title":"test","data":{"chartType":"bar","labels":["A"],"datasets":[{"label":"X","data":[1]}]}}\n```\nmore text'
    const result = parseShowWidget(content)
    expect(result).not.toBeNull()
    expect(result!.type).toBe('chart')
    expect(result!.title).toBe('test')
  })

  it('returns null for no widget', () => {
    const content = 'just plain text'
    expect(parseShowWidget(content)).toBeNull()
  })

  it('handles incomplete JSON gracefully', () => {
    const content = '```show-widget\n{"type":"chart","title":"test","data":{'
    const result = parseShowWidget(content)
    expect(result === null || result.type === 'chart').toBe(true)
  })
})

describe('parseAllShowWidgets', () => {
  it('finds multiple widgets', () => {
    const content = '```show-widget\n{"type":"svg","title":"a","data":{"widget_code":"<svg/>"}}\n```\n\n```show-widget\n{"type":"chart","title":"b","data":{"chartType":"bar","labels":[],"datasets":[]}}\n```'
    const results = parseAllShowWidgets(content)
    expect(results).toHaveLength(2)
  })
})
