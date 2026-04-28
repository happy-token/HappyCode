import React, { useEffect, useState, useCallback } from 'react'
import { X, ChevronRight, ChevronDown, Folder, FolderOpen, FileText, FileCode, Image } from 'lucide-react'
import { cn } from '@renderer/lib/utils'

interface Props {
  cwd: string
  onClose: () => void
}

interface TreeNode {
  name: string
  fullPath: string
  isDir: boolean
  size?: number
  children?: TreeNode[]
  loaded?: boolean
}

const IGNORED = new Set(['.git', 'node_modules', '.DS_Store', '__pycache__', '.next', 'dist', 'build', '.turbo'])

function fileIcon(name: string): React.ReactNode {
  const ext = name.slice(name.lastIndexOf('.') + 1).toLowerCase()
  if (['ts', 'tsx', 'js', 'jsx', 'py', 'go', 'rs', 'cpp', 'c', 'h', 'css', 'html', 'json', 'yaml', 'yml', 'toml', 'md'].includes(ext)) {
    return <FileCode size={11} />
  }
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico'].includes(ext)) {
    return <Image size={11} />
  }
  return <FileText size={11} />
}

function fmtSize(bytes?: number): string {
  if (bytes === undefined) return ''
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}K`
  return `${(bytes / 1024 / 1024).toFixed(1)}M`
}

function TreeRow({
  node,
  depth,
  expanded,
  onToggle,
}: {
  node: TreeNode
  depth: number
  expanded: boolean
  onToggle: (path: string) => void
}): React.JSX.Element {
  return (
    <button
      onClick={() => { if (node.isDir) onToggle(node.fullPath) }}
      title={node.fullPath}
      className={cn(
        'flex items-center gap-1 w-full text-left text-[11px] font-mono pr-2 py-px bg-transparent transition-colors hover:bg-[var(--color-surface-2)]',
        node.isDir ? 'text-[var(--color-text)] cursor-pointer' : 'text-[var(--color-text-muted)] cursor-default',
      )}
      style={{ paddingLeft: `${8 + depth * 12}px` }}
    >
      <span className="w-3 flex-shrink-0 text-[var(--color-text-faint)]">
        {node.isDir ? (expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />) : null}
      </span>
      <span className={cn('flex-shrink-0', node.isDir ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)]')}>
        {node.isDir ? (expanded ? <FolderOpen size={11} /> : <Folder size={11} />) : fileIcon(node.name)}
      </span>
      <span className="overflow-hidden text-ellipsis whitespace-nowrap flex-1">
        {node.name}
      </span>
      {!node.isDir && node.size !== undefined && (
        <span className="text-[9px] text-[var(--color-text-faint)] flex-shrink-0 ml-1">
          {fmtSize(node.size)}
        </span>
      )}
    </button>
  )
}

export function FileTreePanel({ cwd, onClose }: Props): React.JSX.Element {
  const [nodes, setNodes] = useState<TreeNode[]>([])
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set())
  const [childrenCache, setChildrenCache] = useState<Map<string, TreeNode[]>>(new Map())

  const loadDir = useCallback(async (dirPath: string): Promise<TreeNode[]> => {
    const entries = await window.electron.listDir({ dirPath, cwd })
    return entries
      .filter((e) => !IGNORED.has(e.name) && !e.name.startsWith('.'))
      .map((e) => ({
        name: e.name,
        fullPath: `${dirPath}/${e.name}`,
        isDir: e.isDir,
        size: e.size,
      }))
  }, [])

  useEffect(() => {
    void loadDir(cwd).then(setNodes)
  }, [cwd, loadDir])

  const handleToggle = useCallback(async (fullPath: string) => {
    const isExpanded = expandedPaths.has(fullPath)
    if (isExpanded) {
      setExpandedPaths((prev) => { const s = new Set(prev); s.delete(fullPath); return s })
      return
    }
    if (!childrenCache.has(fullPath)) {
      const children = await loadDir(fullPath)
      setChildrenCache((prev) => new Map(prev).set(fullPath, children))
    }
    setExpandedPaths((prev) => new Set(prev).add(fullPath))
  }, [expandedPaths, childrenCache, loadDir])

  function renderNodes(list: TreeNode[], depth: number): React.ReactNode {
    return list.map((node) => {
      const expanded = expandedPaths.has(node.fullPath)
      const children = childrenCache.get(node.fullPath)
      return (
        <React.Fragment key={node.fullPath}>
          <TreeRow node={node} depth={depth} expanded={expanded} onToggle={(p) => void handleToggle(p)} />
          {expanded && children && renderNodes(children, depth + 1)}
        </React.Fragment>
      )
    })
  }

  return (
    <div className="w-[240px] flex-shrink-0 flex flex-col border-l border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center px-2.5 py-2 border-b border-[var(--color-border)] gap-1.5 flex-shrink-0">
        <span className="text-[11px] font-bold text-[var(--color-text)] flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
          {cwd.split('/').pop() ?? 'Files'}
        </span>
        <button onClick={onClose} className="text-[var(--color-text-muted)] p-0.5 flex-shrink-0" title="Close">
          <X size={12} />
        </button>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto py-1">
        {renderNodes(nodes, 0)}
        {nodes.length === 0 && (
          <div className="text-[11px] text-[var(--color-text-muted)] px-3 py-2">
            Empty directory
          </div>
        )}
      </div>
    </div>
  )
}
