import React, { useState, useMemo } from 'react'
import { ChevronUp, ChevronDown, Search } from 'lucide-react'
import type { ValidWidgetConfig } from '../widget-schema'

type TableData = {
  columns: { key: string; label: string }[]
  rows: Record<string, unknown>[]
}

export function TableWidget({ config }: { config: ValidWidgetConfig }): React.JSX.Element {
  const data = config.data as TableData
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
