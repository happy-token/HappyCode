import type { WidgetType, WidgetConfig } from '../../../electron/shared/types'
import type React from 'react'
import { SvgWidget } from './widgets/SvgWidget'
import { ChartWidget } from './widgets/ChartWidget'
import { TableWidget } from './widgets/TableWidget'
import { CalculatorWidget } from './widgets/CalculatorWidget'
import { FormWidget } from './widgets/FormWidget'

type WidgetComponent = React.FC<{ config: WidgetConfig }>

const registry = new Map<WidgetType, WidgetComponent>()

registry.set('svg', SvgWidget as WidgetComponent)
registry.set('chart', ChartWidget as WidgetComponent)
registry.set('table', TableWidget as WidgetComponent)
registry.set('calculator', CalculatorWidget as WidgetComponent)
registry.set('form', FormWidget as WidgetComponent)

export function getWidget(type: WidgetType): WidgetComponent | undefined {
  return registry.get(type)
}

export function hasWidget(type: WidgetType): boolean {
  return registry.has(type)
}

export function registerWidget(type: WidgetType, component: WidgetComponent): void {
  registry.set(type, component)
}
