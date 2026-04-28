import { z } from 'zod'
import type { WidgetConfig } from '../../../electron/shared/types'

const baseWidgetSchema = z.object({
  type: z.enum(['svg', 'chart', 'table', 'calculator', 'form']),
  title: z.string().min(1),
  config: z.record(z.string(), z.unknown()).optional(),
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
    rows: z.array(z.record(z.string(), z.unknown())),
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
        validation: z.record(z.string(), z.unknown()).optional(),
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
