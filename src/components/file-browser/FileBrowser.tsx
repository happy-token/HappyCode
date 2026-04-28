import React, { useEffect, useCallback, useRef } from 'react'
import { Search, RefreshCw, X } from 'lucide-react'
import { useTabStore, selectActiveTab } from '../../store/tab-store'
import { useFileBrowserStore } from '../../store/file-browser-store'
import { FileTree } from './FileTree'
import { useUiStore } from '../../store/ui-store'

export function FileBrowser(): React.JSX.Element | null {
  const cwd = useTabStore((s) => selectActiveTab(s)?.cwd ?? '')
  const showFiles = useUiStore((s) => s.showFiles)
  const toggleFiles = useUiStore((s) => s.toggleFiles)
  const setCwd = useFileBrowserStore((s) => s.setCwd)
  const searchQuery = useFileBrowserStore((s) => s.searchQuery)
  const search = useFileBrowserStore((s) => s.search)
  const clearSearch = useFileBrowserStore((s) => s.clearSearch)
  const refresh = useFileBrowserStore((s) => s.refresh)

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    void setCwd(cwd)
  }, [cwd, setCwd])

  useEffect(() => {
    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current)
    }
  }, [])

  useEffect(() => {
    const handler = () => { void refresh() }
    window.addEventListener('refresh-file-tree', handler)
    return () => window.removeEventListener('refresh-file-tree', handler)
  }, [refresh])

  const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => {
      if (query) void search(query)
      else clearSearch()
    }, 300)
  }, [search, clearSearch])

  const handleRefresh = useCallback(() => { void refresh() }, [refresh])

  if (!showFiles) return null

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-[6px] p-2 border-b border-[var(--color-border)] flex-shrink-0">
        <div className="flex items-center gap-[6px] flex-1 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-[var(--radius-sm)] px-2 py-1">
          <Search size={13} className="text-[var(--color-text-faint)] flex-shrink-0" />
          <input
            type="text"
            placeholder="Search files..."
            value={searchQuery}
            onChange={handleSearch}
            className="flex-1 bg-transparent border-0 outline-none font-[inherit] text-[12px] text-[var(--color-text)]"
          />
          {searchQuery && (
            <button onClick={clearSearch} className="cursor-pointer bg-transparent border-0 text-[var(--color-text-muted)] p-[2px] flex items-center">
              <X size={11} />
            </button>
          )}
        </div>
        <button className="cursor-pointer bg-transparent border border-[var(--color-border)] rounded-[var(--radius-sm)] text-[var(--color-text-muted)] px-[6px] py-1 flex items-center hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]" onClick={handleRefresh} title="Refresh">
          <RefreshCw size={13} />
        </button>
        <button className="cursor-pointer bg-transparent border border-[var(--color-border)] rounded-[var(--radius-sm)] text-[var(--color-text-muted)] px-[6px] py-1 flex items-center hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]" onClick={toggleFiles} title="Close">
          <X size={13} />
        </button>
      </div>
      <div className="flex flex-1 overflow-hidden">
        <FileTree />
      </div>
    </div>
  )
}
