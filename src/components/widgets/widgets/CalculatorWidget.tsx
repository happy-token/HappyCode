import React, { useState, useMemo } from 'react'
import { evaluate } from 'mathjs'
import type { ValidWidgetConfig } from '../widget-schema'

type CalcVariable = { name: string; value: number; min?: number; max?: number; step?: number }
type CalcData = { formula: string; variables: CalcVariable[] }

function evaluateFormula(formula: string, variables: Record<string, number>): number {
  // Replace {varName} placeholders with mathjs scope variable names
  const expr = formula.replace(/\{(\w+)\}/g, '$1')
  try {
    const result = evaluate(expr, variables)
    return typeof result === 'number' ? result : NaN
  } catch {
    return NaN
  }
}

export function CalculatorWidget({ config }: { config: ValidWidgetConfig }): React.JSX.Element {
  const data = config.data as CalcData
  const [values, setValues] = useState<Record<string, number>>(
    Object.fromEntries(data.variables.map((v) => [v.name, v.value]))
  )

  const result = useMemo(() => evaluateFormula(data.formula, values), [data.formula, values])

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
