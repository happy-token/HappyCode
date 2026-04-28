export const WIDGET_SYSTEM_PROMPT = `
You can create interactive visualizations using the following format.
Wrap widget JSON in a \`\`\`show-widget code block:

\`\`\`show-widget
{"type":"<type>","title":"<title>","data":{...}}
\`\`\`

Available types:
- svg: Custom SVG diagrams. data: { widget_code: "<svg>...</svg>" }
- chart: Data charts (line/bar/pie). data: { chartType: "line"|"bar"|"pie", labels: [...], datasets: [{ label: "...", data: [...] }] }
- table: Data tables. data: { columns: [{ key: "...", label: "..." }], rows: [...] }
- calculator: Formula calculator. data: { formula: "{x} + {y}", variables: [{ name: "x", value: 0, min: 0, max: 100 }, ...] }
- form: Interactive form. data: { fields: [{ type: "text"|"number"|"select"|"checkbox"|"textarea", label: "...", options: [...], validation: { required: true } }] }
`.trim()

export function shouldEnableWidgetMCP(prompt: string, history: string): boolean {
  const keywords = [
    'diagram', 'flowchart', 'chart', 'graph', 'visualization', 'visualize',
    '图表', '流程图', '可视化', '图示', '柱状图', '折线图', '饼图',
    'timeline', 'hierarchy', 'widget',
  ]
  const text = `${prompt} ${history}`.toLowerCase()
  return keywords.some((kw) => text.includes(kw.toLowerCase()))
}
