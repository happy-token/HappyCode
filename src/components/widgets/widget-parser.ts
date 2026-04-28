import type { WidgetConfig } from '../../../electron/shared/types'

const WIDGET_FENCE_PATTERN = /```show-widget\s*\n([\s\S]*?)```/g

function tryParseJson(jsonStr: string): unknown {
  try {
    return JSON.parse(jsonStr)
  } catch {
    return null
  }
}

function isWidgetConfig(v: unknown): v is WidgetConfig {
  return (
    v !== null &&
    typeof v === 'object' &&
    'type' in v &&
    'title' in v &&
    'data' in v
  )
}

export function parseShowWidget(content: string): WidgetConfig | null {
  const regex = new RegExp(WIDGET_FENCE_PATTERN.source)
  const match = regex.exec(content)
  if (!match) return null

  const jsonStr = match[1]?.trim() ?? ''
  const parsed = tryParseJson(jsonStr)
  if (isWidgetConfig(parsed)) return parsed

  return null
}

export function parseAllShowWidgets(content: string): WidgetConfig[] {
  const results: WidgetConfig[] = []
  const regex = new RegExp(WIDGET_FENCE_PATTERN.source, 'g')
  let match

  while ((match = regex.exec(content)) !== null) {
    const jsonStr = match[1]?.trim() ?? ''
    const parsed = tryParseJson(jsonStr)
    if (isWidgetConfig(parsed)) {
      results.push(parsed)
    }
  }

  return results
}

export function isWidgetRelatedPrompt(prompt: string): boolean {
  const keywords = [
    'diagram', 'flowchart', 'chart', 'graph', 'visualization', 'visualize',
    '图表', '流程图', '可视化', '图示', '柱状图', '折线图', '饼图',
    'timeline', 'hierarchy', 'widget',
  ]
  const lower = prompt.toLowerCase()
  return keywords.some((kw) => lower.includes(kw.toLowerCase()))
}
