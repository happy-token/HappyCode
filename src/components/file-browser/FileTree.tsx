import React, { useCallback } from 'react'
import { useFileBrowserStore } from '../../store/file-browser-store'
import type { FileTreeNode } from '../../../electron/shared/types'
import { useContextMenu, FileContextMenu } from './FileContextMenu'
import { useUiStore } from '../../store/ui-store'
import { cn } from '@renderer/lib/utils'
import './file-tree.css'

// ── File icon mapping by extension ──────────────────────────────

const FILE_ICONS: Record<string, string> = {
  ts: 'TS',
  tsx: 'TSX',
  js: 'JS',
  jsx: 'JSX',
  py: 'PY',
  rs: 'RS',
  go: 'GO',
  rb: 'RB',
  java: 'JV',
  css: 'CSS',
  scss: 'SC',
  html: 'HT',
  json: '{}',
  yaml: 'YM',
  yml: 'YM',
  md: 'MD',
  sh: 'SH',
  sql: 'SQ',
  xml: 'XML',
  svg: 'SVG',
  png: 'IMG',
  jpg: 'IMG',
  jpeg: 'IMG',
  gif: 'IMG',
  toml: 'TM',
  env: 'ENV',
  lock: 'LK',
  gitignore: 'GI',
}

function getFileIcon(name: string): string {
  // Check dotfiles first
  if (name === '.gitignore') return 'GI'
  if (name === '.env') return 'ENV'
  if (name.startsWith('.') && !name.includes('.')) return FILE_ICONS[name] || '•'

  const ext = name.split('.').pop()?.toLowerCase()
  return (ext && FILE_ICONS[ext]) || '•'
}

function getFileIconColor(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'ts':
    case 'tsx':
      return 'var(--file-icon-ts)'
    case 'js':
    case 'jsx':
      return 'var(--file-icon-js)'
    case 'py':
      return 'var(--file-icon-py)'
    case 'rs':
      return 'var(--file-icon-rs)'
    case 'go':
      return 'var(--file-icon-go)'
    case 'css':
    case 'scss':
      return 'var(--file-icon-css)'
    case 'html':
      return 'var(--file-icon-html)'
    case 'json':
    case 'yaml':
    case 'yml':
    case 'toml':
      return 'var(--file-icon-data)'
    case 'md':
      return 'var(--file-icon-md)'
    case 'sh':
      return 'var(--file-icon-sh)'
    case 'svg':
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
      return 'var(--file-icon-img)'
    default:
      return 'var(--file-icon-default)'
  }
}

// ── TreeNode component ──────────────────────────────────────────

interface TreeNodeProps {
  node: FileTreeNode
  depth: number
  selectedPath: string | null
  searchSet: Set<string>
  onContextMenu: (e: React.MouseEvent, node: FileTreeNode) => void
}

function TreeNode({ node, depth, selectedPath, searchSet, onContextMenu }: TreeNodeProps): React.JSX.Element {
  const expandNode = useFileBrowserStore(s => s.expandNode)
  const selectNode = useFileBrowserStore(s => s.selectNode)
  const cwd = useFileBrowserStore(s => s.cwd)
  const theme = useUiStore(s => s.theme)

  const isExpanded = node.isDir && Array.isArray(node.children)
  const isSelected = selectedPath === node.path
  const isSearchMatch = searchSet.has(node.path)

  const handleSelectAndExpand = useCallback(() => {
    if (node.isDir) {
      void expandNode(node.path)
    } else {
      void window.electron.openFilePreview({ filePath: node.path, cwd: cwd ?? '', theme })
    }
    void selectNode(node.path)
  }, [node.isDir, node.path, expandNode, selectNode, cwd, theme])

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    handleSelectAndExpand()
  }, [handleSelectAndExpand])

  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (node.isDir) {
      void expandNode(node.path)
    }
  }, [node.isDir, node.path, expandNode])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleSelectAndExpand()
    }
  }, [handleSelectAndExpand])

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onContextMenu(e, node)
  }, [onContextMenu, node])

  return (
    <div className="flex flex-col" data-depth={depth}>
      <div
        className={`file-tree-row${isSelected ? ' file-tree-row--selected' : ''}${isSearchMatch ? ' file-tree-row--highlight' : ''}`}
        style={{ paddingLeft: `${depth * 16 + 4}px` }}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onContextMenu={handleContextMenu}
        role="treeitem"
        aria-expanded={node.isDir ? isExpanded : undefined}
        aria-selected={isSelected}
        tabIndex={0}
      >
        {node.isDir && (
          <button
            className="file-tree-chevron"
            aria-label={isExpanded ? 'Collapse folder' : 'Expand folder'}
            onClick={handleToggle}
            tabIndex={-1}
          >
            <svg
              className={cn('file-tree-chevron-icon', isExpanded && 'file-tree-chevron-icon--expanded')}
              viewBox="0 0 16 16"
              width="12"
              height="12"
            >
              <path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
        {!node.isDir && <span className="w-[10px] flex-shrink-0" />}
        <span className={`file-tree-icon file-tree-icon--${node.isDir ? 'dir' : 'file'}`}>
          {node.isDir
            ? (
              <svg viewBox="0 0 16 16" width="14" height="14">
                <path
                  d="M1 3.5A1.5 1.5 0 012.5 2h3.172a1.5 1.5 0 011.06.44l.828.828a.5.5 0 00.354.146H13.5A1.5 1.5 0 0115 4.914V12.5a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 011 12.5v-9z"
                  fill="currentColor"
                />
              </svg>
            )
            : (
              <span className="font-mono text-[11px] flex-shrink-0" style={{ color: getFileIconColor(node.name) }}>
                {getFileIcon(node.name)}
              </span>
            )}
        </span>
        <span className="overflow-hidden text-ellipsis whitespace-nowrap text-[11px]">{node.name}</span>
      </div>
      {isExpanded && node.children && (
        <div className="file-tree-children" role="group">
          {node.children.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              searchSet={searchSet}
              onContextMenu={onContextMenu}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── FileTree container ──────────────────────────────────────────

export function FileTree(): React.JSX.Element {
  const tree = useFileBrowserStore(s => s.tree)
  const selectedPath = useFileBrowserStore(s => s.selectedPath)
  const searchResults = useFileBrowserStore(s => s.searchResults)
  const searchSet = new Set(searchResults)
  const { state: ctxState, openMenu, closeMenu } = useContextMenu()

  if (tree.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto p-1" role="tree" aria-label="File browser">
        <div className="p-4 text-[11px] text-[var(--color-text-faint)]">No files</div>
      </div>
    )
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto p-1" role="tree" aria-label="File browser">
        {tree.map((node) => (
          <TreeNode
            key={node.path}
            node={node}
            depth={0}
            selectedPath={selectedPath}
            searchSet={searchSet}
            onContextMenu={openMenu}
          />
        ))}
      </div>
      <FileContextMenu state={ctxState} onClose={closeMenu} />
    </>
  )
}
