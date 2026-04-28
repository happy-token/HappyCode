import React from 'react'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import type { ValidWidgetConfig } from '../widget-schema'

const COLORS = ['#a0866a', '#4f8cff', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']

type ChartData = {
  chartType: 'line' | 'bar' | 'pie'
  labels: string[]
  datasets: { label: string; data: number[] }[]
}

export function ChartWidget({ config }: { config: ValidWidgetConfig }): React.JSX.Element {
  const data = config.data as ChartData

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
          {data.chartType === 'bar' ? (
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
          ) : data.chartType === 'line' ? (
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
          ) : (
            <PieChart>
              <Pie
                data={data.datasets[0]?.data.map((v, i) => ({ name: data.labels[i], value: v })) ?? []}
                cx="50%" cy="50%" outerRadius={80}
                dataKey="value" label
              >
                {(data.datasets[0]?.data ?? []).map((_, i) => (
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
