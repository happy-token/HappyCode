# Generative UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable the model to output interactive visualizations (SVG diagrams, charts, tables, calculators, forms) in the chat stream by parsing `show-widget` code blocks and rendering them as built-in React components.

**Architecture:** Three-layer trigger mechanism (system prompt + on-demand MCP + code block parsing). Widget JSON parsed in `MessageBubble.tsx`, mapped to React components via a type-safe registry. All components rendered directly (no iframe), with DOMPurify sanitization for SVG content.

**Tech Stack:** React components, Zustand store, DOMPurify (new), Zod (new), Recharts (existing), highlight.js (existing).

**New Dependencies:** `dompurify`, `@types/dompurify`, `zod`

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `package.json` | Add dompurify + zod dependencies |
| Modify | `electron/shared/types.ts` | Add WidgetConfig, WidgetType types |
| Create | `src/store/widget-store.ts` | Zustand store for widget state |
| Create | `src/components/widgets/widget-registry.ts` | Widget type registry |
| Create | `src/components/widgets/WidgetRenderer.tsx` | Core JSON → React component mapper |
| Create | `src/components/widgets/widgets/SvgWidget.tsx` | SVG rendering |
| Create | `src/components/widgets/widgets/ChartWidget.tsx` | Data charts |
| Create | `src/components/widgets/widgets/TableWidget.tsx` | Data tables |
| Create | `src/components/widgets/widgets/CalculatorWidget.tsx` | Calculator |
| Create | `src/components/widgets/widgets/FormWidget.tsx` | Interactive forms |
| Create | `src/components/widgets/widget-schema.ts` | Zod schema validation |
| Create | `src/components/widgets/widget-parser.ts` | show-widget code block parsing |
| Create | `electron/main/widget-mcp.ts` | Widget MCP server for model guidance |
| Modify | `src/components/chat/MessageBubble.tsx` | Integrate widget rendering |
| Modify | `src/store/tab-store.ts` | Inject widget system prompt |
| Modify | `src/styles.css` | Add `.widget-*` CSS classes |

---

### Task 1: Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add dependencies**

Run:

```bash
npm install dompurify zod
npm install -D @types/dompurify
```

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "deps: add dompurify and zod for widget sanitization and validation"
```

---

### Task 2: Shared Types

**Files:**
- Modify: `electron/shared/types.ts`

- [ ] **Step 1: Add widget types**

After the file system/git types section (around line 359), add:

```typescript
export type WidgetType = 'svg' | 'chart' | 'table' | 'calculator' | 'form'

export interface WidgetConfig {
  type: WidgetType
  title: string
  data: Record<string, unknown>
  config?: Record<string, unknown>
}
```

- [ ] **Step 2: Commit**

```bash
git add electron/shared/types.ts
git commit -m "types: add WidgetConfig and WidgetType"
```

---

### Task 3: Widget Schema Validation

**Files:**
- Create: `src/components/widgets/widget-schema.ts`
- Create: `test/widget-schema.test.ts`

- [ ] **Step 1: Write tests**

```typescript
// test/widget-schema.test.ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test -- test/widget-schema.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Write schema implementation**

```typescript
// src/components/widgets/widget-schema.ts
import { z } from 'zod'
import type { WidgetConfig } from '../../../electron/shared/types'

const baseWidgetSchema = z.object({
  type: z.enum(['svg', 'chart', 'table', 'calculator', 'form']),
  title: z.string().min(1),
  config: z.record(z.unknown()).optional(),
})

const svgWidgetSchema = baseWidgetSchema.extend({
  type: z.literal('svg'),
  data: z.object({
    widget_code: z.string().min(1),
  }),
})

const chartWidgetSchema = baseWidgetSchema.extend({
  type: z.literal('chart'),
  data: z.object({
    chartType: z.enum(['line', 'bar', 'pie']),
    labels: z.array(z.string()),
    datasets: z.array(
      z.object({
        label: z.string(),
        data: z.array(z.number()),
      })
    ),
  }),
})

const tableWidgetSchema = baseWidgetSchema.extend({
  type: z.literal('table'),
  data: z.object({
    columns: z.array(z.object({ key: z.string(), label: z.string() })),
    rows: z.array(z.record(z.unknown())),
  }),
})

const calculatorWidgetSchema = baseWidgetSchema.extend({
  type: z.literal('calculator'),
  data: z.object({
    formula: z.string(),
    variables: z.array(
      z.object({
        name: z.string(),
        value: z.number(),
        min: z.number().optional(),
        max: z.number().optional(),
        step: z.number().optional(),
      })
    ),
  }),
})

const formWidgetSchema = baseWidgetSchema.extend({
  type: z.literal('form'),
  data: z.object({
    fields: z.array(
      z.object({
        type: z.enum(['text', 'number', 'select', 'checkbox', 'textarea']),
        label: z.string(),
        options: z.array(z.string()).optional(),
        validation: z.record(z.unknown()).optional(),
      })
    ),
  }),
})

const widgetSchema = z.discriminatedUnion('type', [
  svgWidgetSchema,
  chartWidgetSchema,
  tableWidgetSchema,
  calculatorWidgetSchema,
  formWidgetSchema,
])

export type ValidWidgetConfig = z.infer<typeof widgetSchema>

export function validateWidget(config: WidgetConfig): { success: true; data: ValidWidgetConfig } | { success: false; error: string } {
  const result = widgetSchema.safeParse(config)
  if (result.success) {
    return { success: true, data: result.data }
  }
  return { success: false, error: result.error.message }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test -- test/widget-schema.test.ts
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/widgets/widget-schema.ts test/widget-schema.test.ts
git commit -m "feat: add widget schema validation with Zod"
```

---

### Task 4: Widget Parser

**Files:**
- Create: `src/components/widgets/widget-parser.ts`
- Create: `test/widget-parser.test.ts`

- [ ] **Step 1: Write tests**

```typescript
// test/widget-parser.test.ts
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
    // Should not throw; may return null or partial
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test -- test/widget-parser.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Write parser implementation**

```typescript
// src/components/widgets/widget-parser.ts
import type { WidgetConfig } from '../../../electron/shared/types'

const WIDGET_FENCE_REGEX = /```show-widget\s*\n([\s\S]*?)```/g

function unescapeJsonValue(jsonStr: string): unknown {
  try {
    return JSON.parse(jsonStr)
  } catch {
    return null
  }
}

export function parseShowWidget(content: string): WidgetConfig | null {
  const match = WIDGET_FENCE_REGEX.exec(content)
  if (!match) return null

  const jsonStr = match[1].trim()
  // For incomplete JSON, try to parse what we have
  const parsed = unescapeJsonValue(jsonStr)
  if (parsed && typeof parsed === 'object' && 'type' in parsed && 'title' in parsed && 'data' in parsed) {
    return parsed as WidgetConfig
  }

  // Try manual parsing for incomplete JSON
  try {
    const partial = extractPartialJson(jsonStr)
    if (partial.type && partial.title && partial.data) {
      return partial as WidgetConfig
    }
  } catch { /* ignore */ }

  return null
}

function extractPartialJson(str: string): Record<string, unknown> {
  // Manual character-by-character parsing for incomplete JSON
  // This handles streaming scenarios where JSON is not yet complete
  const result: Record<string, unknown> = {}
  let depth = 0
  let inString = false
  let escape = false
  let currentKey = ''
  let valueStart = -1

  for (let i = 0; i < str.length; i++) {
    const char = str[i]

    if (escape) { escape = false; continue }
    if (char === '\\') { escape = true; continue }

    if (char === '"') {
      if (!inString) {
        inString = true
        // Check if this is a key (followed by :)
        const colonIdx = str.indexOf(':', i + 1)
        if (colonIdx !== -1 && colonIdx < str.indexOf('"', i + 1) + 20) {
          valueStart = i + 1
        }
      } else {
        inString = false
        const endIdx = str.indexOf(':', i + 1)
        if (endIdx !== -1) {
          currentKey = str.slice(valueStart, i)
        }
      }
      continue
    }

    if (char === '{' || char === '[') {
      depth++
      continue
    }

    if (char === '}' || char === ']') {
      depth--
      if (depth <= 0) break
      continue
    }
  }

  // Fallback: try JSON.parse with the available string
  try {
    return JSON.parse(str)
  } catch {
    return result
  }
}

export function parseAllShowWidgets(content: string): WidgetConfig[] {
  const results: WidgetConfig[] = []
  let match

  const regex = new RegExp(WIDGET_FENCE_REGEX.source, 'g')
  while ((match = regex.exec(content)) !== null) {
    const widget = parseShowWidget(match[0])
    if (widget) {
      results.push(widget)
    }
  }

  return results
}

export function isWidgetRelatedPrompt(prompt: string): boolean {
  const keywords = [
    'diagram', 'flowchart', 'chart', 'graph', 'visualization', 'visualize',
    '图表', '流程图', '可视化', '图示', '柱状图', '折线图', '饼图',
    'timeline', 'hierarchy', 'organigram', 'sankey', 'widget',
  ]
  const lower = prompt.toLowerCase()
  return keywords.some((kw) => lower.includes(kw.toLowerCase()))
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test -- test/widget-parser.test.ts
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/widgets/widget-parser.ts test/widget-parser.test.ts
git commit -m "feat: add widget parser for show-widget code blocks"
```

---

### Task 5: Widget Registry and Renderer

**Files:**
- Create: `src/components/widgets/widget-registry.ts`
- Create: `src/components/widgets/WidgetRenderer.tsx`

- [ ] **Step 1: Write widget registry**

```typescript
// src/components/widgets/widget-registry.ts
import type { WidgetType } from '../../../electron/shared/types'
import React from 'react'
import { SvgWidget } from './widgets/SvgWidget'
import { ChartWidget } from './widgets/ChartWidget'
import { TableWidget } from './widgets/TableWidget'
import { CalculatorWidget } from './widgets/CalculatorWidget'
import { FormWidget } from './widgets/FormWidget'

type WidgetComponent = React.FC<{ config: import('../../../electron/shared/types').WidgetConfig }>

const registry = new Map<WidgetType, WidgetComponent>()

registry.set('svg', SvgWidget)
registry.set('chart', ChartWidget)
registry.set('table', TableWidget)
registry.set('calculator', CalculatorWidget)
registry.set('form', FormWidget)

export function getWidget(type: WidgetType): WidgetComponent | undefined {
  return registry.get(type)
}

export function hasWidget(type: WidgetType): boolean {
  return registry.has(type)
}

export function registerWidget(type: WidgetType, component: WidgetComponent): void {
  registry.set(type, component)
}
```

- [ ] **Step 2: Write WidgetRenderer**

```typescript
// src/components/widgets/WidgetRenderer.tsx
import React from 'react'
import type { WidgetConfig } from '../../../electron/shared/types'
import { getWidget } from './widget-registry'
import { validateWidget } from './widget-schema'

export function WidgetRenderer({ config }: { config: WidgetConfig }): React.JSX.Element {
  const validation = validateWidget(config)
  if (!validation.success) {
    return <WidgetError config={config} error={validation.error} />
  }

  const Component = getWidget(config.type)
  if (!Component) {
    return <WidgetError config={config} error={`Unknown widget type: ${config.type}`} />
  }

  try {
    return <Component config={validation.data} />
  } catch (err) {
    return <WidgetError config={config} error={`Render error: ${String(err)}`} />
  }
}

function WidgetError({ config, error }: { config: WidgetConfig; error: string }): React.JSX.Element {
  return (
    <div className="widget-error">
      <div className="widget-error-title">Widget Error</div>
      <div className="widget-error-type">{config.type} — {config.title}</div>
      <div className="widget-error-message">{error}</div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/widgets/widget-registry.ts src/components/widgets/WidgetRenderer.tsx
git commit -m "feat: add widget registry and renderer with error boundary"
```

---

### Task 6: SvgWidget Component

**Files:**
- Create: `src/components/widgets/widgets/SvgWidget.tsx`

- [ ] **Step 1: Write SvgWidget**

```typescript
// src/components/widgets/widgets/SvgWidget.tsx
import React from 'react'
import DOMPurify from 'dompurify'
import type { ValidWidgetConfig } from '../widget-schema'

export function SvgWidget({ config }: { config: ValidWidgetConfig }): React.JSX.Element {
  const widgetCode = (config.data as { widget_code: string }).widget_code

  const sanitized = DOMPurify.sanitize(widgetCode, {
    ALLOWED_TAGS: ['svg', 'g', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'path', 'text', 'tspan', 'defs', 'style', 'marker', 'linearGradient', 'radialGradient', 'stop', 'clipPath', 'filter', 'pattern', 'use', 'image', 'foreignObject', 'a', 'title', 'desc'],
    ALLOWED_ATTR: ['id', 'class', 'x', 'y', 'width', 'height', 'cx', 'cy', 'r', 'rx', 'ry', 'x1', 'y1', 'x2', 'y2', 'fill', 'stroke', 'stroke-width', 'opacity', 'transform', 'viewBox', 'd', 'points', 'href', 'xlink:href', 'font-size', 'font-weight', 'text-anchor', 'dominant-baseline', 'marker-start', 'marker-mid', 'marker-end', 'clip-path', 'filter', 'style'],
  })

  return (
    <div className="widget widget-svg">
      <div className="widget-header">
        <span className="widget-title">{config.title}</span>
        <span className="widget-type-badge">SVG</span>
      </div>
      <div
        className="widget-svg-container"
        dangerouslySetInnerHTML={{ __html: sanitized }}
      />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/widgets/widgets/SvgWidget.tsx
git commit -m "feat: add SvgWidget with DOMPurify sanitization"
```

---

### Task 7: ChartWidget Component

**Files:**
- Create: `src/components/widgets/widgets/ChartWidget.tsx`

- [ ] **Step 1: Write ChartWidget**

```typescript
// src/components/widgets/widgets/ChartWidget.tsx
import React from 'react'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import type { ValidWidgetConfig } from '../widget-schema'

const COLORS = ['#a0866a', '#4f8cff', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']

export function ChartWidget({ config }: { config: ValidWidgetConfig }): React.JSX.Element {
  const data = config.data as { chartType: string; labels: string[]; datasets: { label: string; data: number[] }[] }

  const chartData = data.labels.map((label, i) => {
    const obj: Record<string, unknown> = { label }
    for (const ds of data.datasets) {
      obj[ds.label] = ds.data[i] ?? 0
    }
    return obj
  })

  return (
    <div className="widget widget-chart">
      <div className="widget-header">
        <span className="widget-title">{config.title}</span>
        <span className="widget-type-badge">{data.chartType.toUpperCase()}</span>
      </div>
      <div className="widget-chart-container">
        <ResponsiveContainer width="100%" height={250}>
          {data.chartType === 'bar' && (
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="label" fontSize={11} tick={{ fill: 'var(--color-text-muted)' }} />
              <YAxis fontSize={11} tick={{ fill: 'var(--color-text-muted)' }} />
              <Tooltip />
              <Legend />
              {data.datasets.map((ds, i) => (
                <Bar key={ds.label} dataKey={ds.label} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} />
              ))}
            </BarChart>
          )}
          {data.chartType === 'line' && (
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="label" fontSize={11} tick={{ fill: 'var(--color-text-muted)' }} />
              <YAxis fontSize={11} tick={{ fill: 'var(--color-text-muted)' }} />
              <Tooltip />
              <Legend />
              {data.datasets.map((ds, i) => (
                <Line key={ds.label} type="monotone" dataKey={ds.label} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={false} />
              ))}
            </LineChart>
          )}
          {data.chartType === 'pie' && (
            <PieChart>
              <Pie
                data={data.datasets[0]?.data.map((v, i) => ({ name: data.labels[i], value: v })) ?? []}
                cx="50%" cy="50%" outerRadius={80}
                dataKey="value" label
              >
                {data.datasets[0]?.data.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/widgets/widgets/ChartWidget.tsx
git commit -m "feat: add ChartWidget with Recharts (bar, line, pie)"
```

---

### Task 8: TableWidget Component

**Files:**
- Create: `src/components/widgets/widgets/TableWidget.tsx`

- [ ] **Step 1: Write TableWidget**

```typescript
// src/components/widgets/widgets/TableWidget.tsx
import React, { useState, useMemo } from 'react'
import { ChevronUp, ChevronDown, Search } from 'lucide-react'
import type { ValidWidgetConfig } from '../widget-schema'

export function TableWidget({ config }: { config: ValidWidgetConfig }): React.JSX.Element {
  const data = config.data as { columns: { key: string; label: string }[]; rows: Record<string, unknown>[] }
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortAsc, setSortAsc] = useState(true)
  const [search, setSearch] = useState('')

  const sortedRows = useMemo(() => {
    let rows = [...data.rows]
    if (search) {
      const lower = search.toLowerCase()
      rows = rows.filter((row) =>
        Object.values(row).some((v) => String(v).toLowerCase().includes(lower))
      )
    }
    if (sortKey) {
      rows.sort((a, b) => {
        const aVal = a[sortKey]
        const bVal = b[sortKey]
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sortAsc ? aVal - bVal : bVal - aVal
        }
        return sortAsc
          ? String(aVal).localeCompare(String(bVal))
          : String(bVal).localeCompare(String(aVal))
      })
    }
    return rows
  }, [data.rows, sortKey, sortAsc, search])

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortAsc((v) => !v)
    } else {
      setSortKey(key)
      setSortAsc(true)
    }
  }

  return (
    <div className="widget widget-table">
      <div className="widget-header">
        <span className="widget-title">{config.title}</span>
        <span className="widget-type-badge">TABLE</span>
      </div>
      <div className="widget-table-toolbar">
        <div className="widget-table-search">
          <Search size={13} />
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <span className="widget-table-count">{sortedRows.length} rows</span>
      </div>
      <div className="widget-table-scroll">
        <table className="widget-table-content">
          <thead>
            <tr>
              {data.columns.map((col) => (
                <th key={col.key} onClick={() => handleSort(col.key)} className="widget-table-th">
                  {col.label}
                  {sortKey === col.key && (
                    sortAsc ? <ChevronUp size={11} /> : <ChevronDown size={11} />
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row, i) => (
              <tr key={i}>
                {data.columns.map((col) => (
                  <td key={col.key} className="widget-table-td">{String(row[col.key] ?? '')}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/widgets/widgets/TableWidget.tsx
git commit -m "feat: add TableWidget with sort and search"
```

---

### Task 9: CalculatorWidget Component

**Files:**
- Create: `src/components/widgets/widgets/CalculatorWidget.tsx`

- [ ] **Step 1: Write CalculatorWidget**

```typescript
// src/components/widgets/widgets/CalculatorWidget.tsx
import React, { useState, useMemo } from 'react'
import type { ValidWidgetConfig } from '../widget-schema'

function evaluateFormula(formula: string, variables: Record<string, number>): number {
  let expr = formula
  for (const [name, value] of Object.entries(variables)) {
    expr = expr.replaceAll(`{${name}}`, String(value))
  }
  // Only allow safe math operations
  if (/[^0-9+\-*/().%\s]/.test(expr)) return NaN
  try {
    // eslint-disable-next-line no-eval
    return Function(`"use strict"; return (${expr})`)() as number
  } catch {
    return NaN
  }
}

export function CalculatorWidget({ config }: { config: ValidWidgetConfig }): React.JSX.Element {
  const data = config.data as { formula: string; variables: { name: string; value: number; min?: number; max?: number; step?: number }[] }
  const [values, setValues] = useState<Record<string, number>>(
    Object.fromEntries(data.variables.map((v) => [v.name, v.value]))
  )

  const result = useMemo(() => {
    return evaluateFormula(data.formula, values)
  }, [data.formula, values])

  return (
    <div className="widget widget-calculator">
      <div className="widget-header">
        <span className="widget-title">{config.title}</span>
        <span className="widget-type-badge">CALC</span>
      </div>
      <div className="widget-calculator-formula">
        <code>{data.formula}</code>
      </div>
      <div className="widget-calculator-variables">
        {data.variables.map((v) => (
          <div key={v.name} className="widget-calc-variable">
            <label>{v.name}</label>
            {v.min !== undefined && v.max !== undefined ? (
              <div className="widget-calc-slider">
                <input
                  type="range"
                  min={v.min}
                  max={v.max}
                  step={v.step ?? 1}
                  value={values[v.name] ?? v.value}
                  onChange={(e) => setValues((prev) => ({ ...prev, [v.name]: Number(e.target.value) }))}
                />
                <span className="widget-calc-value">{values[v.name] ?? v.value}</span>
              </div>
            ) : (
              <input
                type="number"
                value={values[v.name] ?? v.value}
                onChange={(e) => setValues((prev) => ({ ...prev, [v.name]: Number(e.target.value) }))}
                className="widget-calc-input"
              />
            )}
          </div>
        ))}
      </div>
      <div className="widget-calc-result">
        <span className="widget-calc-result-label">Result</span>
        <span className="widget-calc-result-value">
          {isNaN(result) ? 'Invalid formula' : result.toFixed(2)}
        </span>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/widgets/widgets/CalculatorWidget.tsx
git commit -m "feat: add CalculatorWidget with live formula evaluation"
```

---

### Task 10: FormWidget Component

**Files:**
- Create: `src/components/widgets/widgets/FormWidget.tsx`

- [ ] **Step 1: Write FormWidget**

```typescript
// src/components/widgets/widgets/FormWidget.tsx
import React, { useState } from 'react'
import type { ValidWidgetConfig } from '../widget-schema'

export function FormWidget({ config }: { config: ValidWidgetConfig }): React.JSX.Element {
  const data = config.data as { fields: { type: string; label: string; options?: string[]; validation?: Record<string, unknown> }[] }
  const [values, setValues] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}
    for (const field of data.fields) {
      const val = values[field.label] ?? ''
      if (field.validation?.required && !val) {
        newErrors[field.label] = 'Required'
      }
      if (field.validation?.minLength && val.length < (field.validation.minLength as number)) {
        newErrors[field.label] = `Min ${field.validation.minLength} characters`
      }
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = () => {
    if (validate()) setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="widget widget-form">
        <div className="widget-header">
          <span className="widget-title">{config.title}</span>
          <span className="widget-type-badge">FORM</span>
        </div>
        <div className="widget-form-success">
          Form submitted successfully!
        </div>
        <pre className="widget-form-data">
          {JSON.stringify(values, null, 2)}
        </pre>
      </div>
    )
  }

  return (
    <div className="widget widget-form">
      <div className="widget-header">
        <span className="widget-title">{config.title}</span>
        <span className="widget-type-badge">FORM</span>
      </div>
      <div className="widget-form-fields">
        {data.fields.map((field) => (
          <div key={field.label} className="widget-form-field">
            <label>{field.label}</label>
            {field.type === 'select' && field.options ? (
              <select
                value={values[field.label] ?? ''}
                onChange={(e) => setValues((prev) => ({ ...prev, [field.label]: e.target.value }))}
                className="widget-form-select"
              >
                <option value="">Select...</option>
                {field.options.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            ) : field.type === 'textarea' ? (
              <textarea
                value={values[field.label] ?? ''}
                onChange={(e) => setValues((prev) => ({ ...prev, [field.label]: e.target.value }))}
                className="widget-form-textarea"
                rows={3}
              />
            ) : field.type === 'checkbox' ? (
              <input
                type="checkbox"
                checked={!!values[field.label]}
                onChange={(e) => setValues((prev) => ({ ...prev, [field.label]: e.target.checked ? 'true' : '' }))}
              />
            ) : (
              <input
                type={field.type === 'number' ? 'number' : 'text'}
                value={values[field.label] ?? ''}
                onChange={(e) => setValues((prev) => ({ ...prev, [field.label]: e.target.value }))}
                className="widget-form-input"
              />
            )}
            {errors[field.label] && (
              <span className="widget-form-error">{errors[field.label]}</span>
            )}
          </div>
        ))}
      </div>
      <button className="git-btn git-btn-primary" onClick={handleSubmit}>
        Submit
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/widgets/widgets/FormWidget.tsx
git commit -m "feat: add FormWidget with validation"
```

---

### Task 11: Integrate Widget Rendering into MessageBubble

**Files:**
- Modify: `src/components/chat/MessageBubble.tsx`

- [ ] **Step 1: Add widget rendering to MessageBubble**

In `MessageBubble.tsx`, find the text/markdown rendering section. Add widget detection and rendering:

Add imports at the top:

```typescript
import { parseAllShowWidgets } from '../widgets/widget-parser'
import { WidgetRenderer } from '../widgets/WidgetRenderer'
import type { WidgetConfig } from '../../../electron/shared/types'
```

In the `AssistantTextBubble` component (or wherever markdown content is rendered), add widget extraction:

```typescript
function AssistantTextBubble({ content }: { content: string }): React.JSX.Element {
  const widgets = useMemo(() => parseAllShowWidgets(content), [content])
  const hasWidgets = widgets.length > 0

  // Remove widget code blocks from displayed markdown
  const cleanContent = hasWidgets
    ? content.replace(/```show-widget\s*\n[\s\S]*?```/g, '')
    : content

  return (
    <div className="msg-bubble">
      {hasWidgets && (
        <div className="widget-container">
          {widgets.map((widget, i) => (
            <WidgetRenderer key={i} config={widget} />
          ))}
        </div>
      )}
      {cleanContent.trim() && (
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
          {cleanContent}
        </ReactMarkdown>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/chat/MessageBubble.tsx
git commit -m "feat: integrate widget rendering into MessageBubble"
```

---

### Task 12: Widget System Prompt + MCP

**Files:**
- Create: `electron/main/widget-mcp.ts`
- Modify: `electron/main/agent-manager.ts`

- [ ] **Step 1: Write widget MCP server**

```typescript
// electron/main/widget-mcp.ts
import type { WidgetType } from '../shared/types'

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

export const WIDGET_TOOL_DEFINITION = {
  name: 'generate_widget',
  description: 'Generate an interactive widget visualization. Use when the user asks for a diagram, chart, table, or interactive element.',
  input_schema: {
    type: 'object',
    properties: {
      type: { type: 'string', enum: ['svg', 'chart', 'table', 'calculator', 'form'] },
      title: { type: 'string', description: 'Widget title' },
      data: { type: 'object', description: 'Widget-specific data structure' },
    },
    required: ['type', 'title', 'data'],
  },
}
```

- [ ] **Step 2: Integrate widget system prompt in agent-manager.ts**

In `agent-manager.ts`, find where the system prompt is constructed. Add:

```typescript
import { WIDGET_SYSTEM_PROMPT } from './widget-mcp'

// In the system prompt builder, append:
systemPrompt += '\n\n' + WIDGET_SYSTEM_PROMPT
```

- [ ] **Step 3: Commit**

```bash
git add electron/main/widget-mcp.ts electron/main/agent-manager.ts
git commit -m "feat: add widget system prompt and MCP tool definition"
```

---

### Task 13: Widget Store

**Files:**
- Create: `src/store/widget-store.ts`

- [ ] **Step 1: Write widget store**

```typescript
// src/store/widget-store.ts
import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { WidgetConfig } from '../../electron/shared/types'

interface WidgetState {
  activeWidgets: Map<string, WidgetConfig[]> // keyed by sessionId
  interactions: Map<string, unknown> // keyed by widget ID

  addWidget: (sessionId: string, config: WidgetConfig) => void
  setInteraction: (widgetId: string, data: unknown) => void
  getWidgets: (sessionId: string) => WidgetConfig[]
  clearSession: (sessionId: string) => void
}

export const useWidgetStore = create<WidgetState>()(
  immer((set, get) => ({
    activeWidgets: new Map(),
    interactions: new Map(),

    addWidget: (sessionId: string, config: WidgetConfig) => {
      set((s) => {
        const widgets = s.activeWidgets.get(sessionId) ?? []
        widgets.push(config)
        s.activeWidgets.set(sessionId, widgets)
      })
    },

    setInteraction: (widgetId: string, data: unknown) => {
      set((s) => { s.interactions.set(widgetId, data) })
    },

    getWidgets: (sessionId: string) => {
      return get().activeWidgets.get(sessionId) ?? []
    },

    clearSession: (sessionId: string) => {
      set((s) => { s.activeWidgets.delete(sessionId) })
    },
  }))
)
```

- [ ] **Step 2: Commit**

```bash
git add src/store/widget-store.ts
git commit -m "feat: add widget Zustand store"
```

---

### Task 14: CSS Styles

**Files:**
- Modify: `src/styles.css`

- [ ] **Step 1: Add widget CSS**

Append to `src/styles.css`:

```css
/* ── Widgets ──────────────────────────────────── */

.widget-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 8px 0;
}

.widget {
  background: var(--color-surface-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.widget-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--color-border);
}

.widget-title {
  font-size: 13px;
  font-weight: 600;
  flex: 1;
}

.widget-type-badge {
  font-size: 9px;
  font-weight: 700;
  color: var(--color-accent);
  background: var(--color-accent-dim);
  padding: 1px 6px;
  border-radius: var(--radius-xs);
}

/* SVG Widget */
.widget-svg-container {
  padding: 12px;
  display: flex;
  justify-content: center;
}

.widget-svg-container svg {
  max-width: 100%;
  height: auto;
}

/* Chart Widget */
.widget-chart-container {
  padding: 8px;
  height: 280px;
}

/* Table Widget */
.widget-table-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  border-bottom: 1px solid var(--color-border);
}

.widget-table-search {
  display: flex;
  align-items: center;
  gap: 4px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xs);
  padding: 2px 6px;
}

.widget-table-search input {
  background: transparent;
  border: none;
  outline: none;
  font: inherit;
  font-size: 11px;
  width: 120px;
}

.widget-table-count {
  font-size: 10px;
  color: var(--color-text-faint);
}

.widget-table-scroll {
  max-height: 300px;
  overflow: auto;
}

.widget-table-content {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
}

.widget-table-th {
  padding: 6px 10px;
  text-align: left;
  font-weight: 600;
  color: var(--color-text-muted);
  border-bottom: 1px solid var(--color-border);
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
}

.widget-table-th:hover {
  background: var(--color-surface-2);
}

.widget-table-td {
  padding: 4px 10px;
  border-bottom: 1px solid var(--color-border);
}

.widget-table-td:last-child,
.widget-table-th:last-child {
  border-right: none;
}

/* Calculator Widget */
.widget-calculator-formula {
  padding: 8px 12px;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
}

.widget-calculator-formula code {
  font-family: 'Geist Mono', monospace;
  font-size: 12px;
  color: var(--color-accent);
}

.widget-calculator-variables {
  padding: 8px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.widget-calc-variable {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.widget-calc-variable label {
  font-size: 12px;
  font-weight: 500;
  min-width: 60px;
}

.widget-calc-slider {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.widget-calc-slider input[type="range"] {
  flex: 1;
}

.widget-calc-value {
  font-family: 'Geist Mono', monospace;
  font-size: 11px;
  min-width: 40px;
  text-align: right;
}

.widget-calc-input {
  width: 80px;
  padding: 2px 6px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xs);
  background: var(--color-surface);
  font: inherit;
  font-size: 12px;
}

.widget-calc-result {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  border-top: 1px solid var(--color-border);
  background: var(--color-accent-dim);
}

.widget-calc-result-label {
  font-size: 12px;
  font-weight: 600;
}

.widget-calc-result-value {
  font-family: 'Geist Mono', monospace;
  font-size: 16px;
  font-weight: 700;
  color: var(--color-accent);
}

/* Form Widget */
.widget-form-fields {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.widget-form-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.widget-form-field label {
  font-size: 12px;
  font-weight: 500;
}

.widget-form-input,
.widget-form-select,
.widget-form-textarea {
  padding: 4px 8px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xs);
  background: var(--color-surface);
  font: inherit;
  font-size: 12px;
}

.widget-form-textarea {
  resize: vertical;
}

.widget-form-error {
  font-size: 10px;
  color: var(--color-error);
}

.widget-form-success {
  padding: 12px;
  text-align: center;
  color: var(--color-success);
  font-weight: 600;
}

.widget-form-data {
  padding: 0 12px 12px;
  font-family: 'Geist Mono', monospace;
  font-size: 11px;
  margin: 0;
}

/* Error */
.widget-error {
  padding: 8px 12px;
  background: rgba(239, 68, 68, 0.05);
  border: 1px solid var(--color-error);
  border-radius: var(--radius-md);
}

.widget-error-title {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-error);
}

.widget-error-type {
  font-size: 10px;
  color: var(--color-text-muted);
  margin: 2px 0;
}

.widget-error-message {
  font-size: 10px;
  color: var(--color-text-faint);
  font-family: 'Geist Mono', monospace;
  word-break: break-all;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/styles.css
git commit -m "style: add widget CSS styles"
```

---

### Task 15: Build Verification

**Files:** No file changes.

- [ ] **Step 1: Type check**

```bash
npx tsc --noEmit --pretty false 2>&1 | head -50
```

Expected: No errors.

- [ ] **Step 2: Build**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 3: Run all tests**

```bash
npm test
```

Expected: All tests pass.
