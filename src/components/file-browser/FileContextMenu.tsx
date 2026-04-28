import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useFileBrowserStore } from '../../store/file-browser-store'
import type { FileTreeNode } from '../../../electron/shared/types'
import './file-context-menu.css'

// ── Types ────────────────────────────────────────────────────────

export interface ContextMenuState {
  visible: boolean
  x: number
  y: number
  node: FileTreeNode | null
}

// ── Hook ─────────────────────────────────────────────────────────

export function useContextMenu() {
  const [state, setState] = React.useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    node: null,
  })

  const openMenu = useCallback((e: React.MouseEvent, node: FileTreeNode) => {
    e.preventDefault()
    e.stopPropagation()
    setState({ visible: true, x: e.clientX, y: e.clientY, node })
  }, [])

  const closeMenu = useCallback(() => {
    setState((prev) => ({ ...prev, visible: false, node: null }))
  }, [])

  return { state, openMenu, closeMenu }
}

// ── Menu items ───────────────────────────────────────────────────

interface MenuItem {
  id: string
  label: string
  danger?: boolean
}

function getMenuItems(node: FileTreeNode): MenuItem[] {
  const items: MenuItem[] = []
  if (node.isDir) {
    items.push({ id: 'new-file', label: 'New File' })
    items.push({ id: 'new-folder', label: 'New Folder' })
  }
  items.push({ id: 'rename', label: 'Rename' })
  items.push({ id: 'delete', label: 'Delete', danger: true })
  if (!node.isDir) {
    items.push({ id: 'open-in-system', label: 'Open in System' })
  }
  return items
}

// ── Inline prompt/confirm state ──────────────────────────────────

type InlineMode =
  | { type: 'new-file' }
  | { type: 'new-folder' }
  | { type: 'rename'; currentName: string }
  | { type: 'delete-confirm' }
  | null

// ── Component ────────────────────────────────────────────────────

interface FileContextMenuProps {
  state: ContextMenuState
  onClose: () => void
}

export function FileContextMenu({ state, onClose }: FileContextMenuProps): React.JSX.Element | null {
  const menuRef = useRef<HTMLDivElement>(null)
  const focusedIndexRef = useRef<number>(-1)
  const inlineInputRef = useRef<HTMLInputElement>(null)

  const [inlineMode, setInlineMode] = useState<InlineMode>(null)
  const [inputValue, setInputValue] = useState('')

  const deleteFile = useFileBrowserStore((s) => s.deleteFile)
  const renameFile = useFileBrowserStore((s) => s.renameFile)
  const cwd = useFileBrowserStore((s) => s.cwd)

  const { visible, x, y, node } = state

  // Reset inline state when menu closes
  useEffect(() => {
    if (!visible) {
      setInlineMode(null)
      setInputValue('')
    }
  }, [visible])

  // Focus inline input when it appears
  useEffect(() => {
    if (inlineMode) {
      const t = setTimeout(() => inlineInputRef.current?.focus(), 10)
      return () => clearTimeout(t)
    }
    return undefined
  }, [inlineMode])

  // Close on outside click
  useEffect(() => {
    if (!visible) return
    const handleMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [visible, onClose])

  // Keyboard navigation
  useEffect(() => {
    if (!visible) return
    // Reset stale index synchronously before registering handler
    focusedIndexRef.current = -1

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (inlineMode) {
          setInlineMode(null)
          setInputValue('')
        } else {
          onClose()
        }
        return
      }
      // Don't intercept arrow keys when inline input is focused
      if (inlineMode) return

      const items = menuRef.current?.querySelectorAll<HTMLButtonElement>('.ctx-menu-item')
      if (!items || items.length === 0) return

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        focusedIndexRef.current = (focusedIndexRef.current + 1) % items.length
        items[focusedIndexRef.current]?.focus()
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        focusedIndexRef.current = (focusedIndexRef.current - 1 + items.length) % items.length
        items[focusedIndexRef.current]?.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [visible, onClose, inlineMode])

  // Focus first item when menu opens
  useEffect(() => {
    if (!visible) return
    focusedIndexRef.current = -1
    // Small delay to let the DOM render
    const t = setTimeout(() => {
      menuRef.current?.querySelector<HTMLButtonElement>('.ctx-menu-item')?.focus()
      focusedIndexRef.current = 0
    }, 10)
    return () => clearTimeout(t)
  }, [visible])

  const commitInline = useCallback(() => {
    if (!node || !inlineMode) return
    const trimmed = inputValue.trim()

    // Issue 1: keep inline open on empty input
    if (!trimmed) return

    if (inlineMode.type === 'new-file' && trimmed) {
      const base = node.path.endsWith('/') ? node.path : node.path + '/'
      void window.electron.createFile({ path: base + trimmed, isDir: false, cwd: cwd ?? '' }).then((r) => {
        if (r.success) void useFileBrowserStore.getState().refresh()
      })
    } else if (inlineMode.type === 'new-folder' && trimmed) {
      const base = node.path.endsWith('/') ? node.path : node.path + '/'
      void window.electron.createFile({ path: base + trimmed, isDir: true, cwd: cwd ?? '' }).then((r) => {
        if (r.success) void useFileBrowserStore.getState().refresh()
      })
    } else if (inlineMode.type === 'rename' && trimmed && trimmed !== node.name) {
      const dir = node.path.substring(0, node.path.lastIndexOf('/') + 1)
      void renameFile(node.path, dir + trimmed)
    }

    setInlineMode(null)
    setInputValue('')
    onClose()
  }, [node, inlineMode, inputValue, cwd, renameFile, onClose])

  const handleItemClick = useCallback(
    (id: string) => {
      if (!node) return

      switch (id) {
        case 'new-file':
          setInlineMode({ type: 'new-file' })
          setInputValue('')
          break
        case 'new-folder':
          setInlineMode({ type: 'new-folder' })
          setInputValue('')
          break
        case 'rename':
          setInlineMode({ type: 'rename', currentName: node.name })
          setInputValue(node.name)
          break
        case 'delete':
          setInlineMode({ type: 'delete-confirm' })
          break
        case 'open-in-system':
          void window.electron.openInSystem({ path: node.path })
          onClose()
          break
      }
    },
    [node, onClose]
  )

  if (!visible || !node) return null

  const items = getMenuItems(node)

  // Clamp position so menu doesn't overflow viewport
  const menuWidth = 180
  const menuHeight = inlineMode !== null ? 120 : items.length * 32 + 8
  const clampedX = Math.min(x, window.innerWidth - menuWidth - 8)
  const clampedY = Math.min(y, window.innerHeight - menuHeight - 8)

  const showInlineInput =
    inlineMode?.type === 'new-file' ||
    inlineMode?.type === 'new-folder' ||
    inlineMode?.type === 'rename'

  const inlinePlaceholder =
    inlineMode?.type === 'new-file'
      ? 'File name…'
      : inlineMode?.type === 'new-folder'
        ? 'Folder name…'
        : 'New name…'

  return (
    <div
      ref={menuRef}
      className="fixed z-[1000] min-w-[180px] rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-1 shadow-[0_8px_24px_rgba(0,0,0,0.15)]"
      role="menu"
      aria-label="File context menu"
      style={{ left: clampedX, top: clampedY }}
    >
      {showInlineInput ? (
        <div className="px-2 py-[3px] text-[11px] text-[var(--color-text-faint)]">
          <input
            ref={inlineInputRef}
            className="ctx-menu-inline-input"
            value={inputValue}
            placeholder={inlinePlaceholder}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitInline()
              if (e.key === 'Escape') {
                setInlineMode(null)
                setInputValue('')
              }
            }}
          />
          <div className="ctx-menu-inline-actions">
            <button tabIndex={-1} className="ctx-menu-inline-btn" onClick={commitInline}>
              OK
            </button>
            <button
              tabIndex={-1}
              className="ctx-menu-inline-btn"
              onClick={() => {
                setInlineMode(null)
                setInputValue('')
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : inlineMode?.type === 'delete-confirm' ? (
        <div className="px-2 py-[3px] text-[11px] text-[var(--color-text-faint)]">
          <span className="ctx-menu-inline-label">Delete &ldquo;{node.name}&rdquo;?</span>
          <div className="ctx-menu-inline-actions">
            <button
              tabIndex={-1}
              className="ctx-menu-inline-btn ctx-menu-inline-btn--danger"
              onClick={() => {
                void deleteFile(node.path)
                onClose()
              }}
            >
              Yes
            </button>
            <button
              tabIndex={-1}
              className="ctx-menu-inline-btn"
              onClick={() => {
                setInlineMode(null)
              }}
            >
              No
            </button>
          </div>
        </div>
      ) : (
        items.map((item) => (
          <button
            key={item.id}
            tabIndex={-1}
            className={`ctx-menu-item${item.danger ? ' ctx-menu-item--danger' : ''}`}
            role="menuitem"
            onClick={() => handleItemClick(item.id)}
          >
            {item.label}
          </button>
        ))
      )}
    </div>
  )
}
