import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Lock, Zap, ListTodo, AlertTriangle, Check } from 'lucide-react'
import type { PermissionMode } from '../../store/tab-store'
import { cn } from '@renderer/lib/utils'

interface PermissionModeInfo {
  id: PermissionMode
  label: string
  description: string
  icon: React.ReactNode
}

const PERMISSION_MODES: PermissionModeInfo[] = [
  { id: 'ask', label: 'Ask permissions', description: 'Confirm every file edit or terminal command.', icon: <Lock size={11} /> },
  { id: 'auto', label: 'Auto accept edits', description: 'Claude writes to disk without asking.', icon: <Zap size={11} /> },
  { id: 'plan', label: 'Plan mode', description: 'Architecture & reasoning only. No writes.', icon: <ListTodo size={11} /> },
  { id: 'bypass', label: 'Bypass permissions', description: 'Full root access for shell and file system.', icon: <AlertTriangle size={11} /> },
]

interface PermissionSelectorProps {
  value: PermissionMode
  onChange: (mode: PermissionMode) => void
}

export function PermissionSelector({ value, onChange }: PermissionSelectorProps): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [dropdownPos, setDropdownPos] = useState<{ bottom: number; left: number } | null>(null)

  const currentMode = PERMISSION_MODES.find((m) => m.id === value) ?? PERMISSION_MODES[0]

  useEffect(() => {
    if (!isOpen) return
    function handleClickOutside(e: MouseEvent): void {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  return (
    <div ref={ref} className="relative">
      <button
        ref={buttonRef}
        onClick={() => {
          if (!isOpen && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect()
            setDropdownPos({ bottom: window.innerHeight - rect.top + 4, left: rect.left })
          }
          setIsOpen((v) => !v)
        }}
        className="flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-[var(--radius-sm)] border-0 bg-transparent px-2 py-[3px] text-[11px] text-[var(--color-text-muted)] transition-[background,color] duration-100 hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]"
        title="Execution permissions"
      >
        <span className="flex items-center text-[var(--color-text-muted)]">{currentMode.icon}</span>
        <span>{currentMode.label}</span>
      </button>

      {isOpen && dropdownPos && createPortal(
        <div
          className="w-[280px] overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[0_4px_20px_rgba(0,0,0,0.15)]"
          style={{ position: 'fixed', bottom: dropdownPos.bottom, left: dropdownPos.left, zIndex: 9999 }}
        >
          <div className="px-3 py-2 border-b border-[var(--color-border)] text-[10px] font-semibold uppercase tracking-[0.05em] text-[var(--color-text-muted)]">
            Execution Permissions
          </div>
          <div className="p-1">
            {PERMISSION_MODES.map((mode) => {
              const isSelected = mode.id === value
              const isBypass = mode.id === 'bypass'
              return (
                <button
                  key={mode.id}
                  onClick={() => {
                    onChange(mode.id)
                    setIsOpen(false)
                  }}
                  className={cn(
                    'w-full flex items-start gap-2.5 px-3 py-2.5 border-none rounded-[var(--radius-sm)] cursor-pointer text-left transition-colors',
                    isSelected ? 'bg-[var(--color-accent-dim)]' : 'bg-transparent hover:bg-[var(--color-surface-2)]',
                  )}
                >
                  <span className={cn('flex items-center mt-px', isBypass ? 'text-[var(--color-danger)]' : 'text-[var(--color-text-muted)]')}>{mode.icon}</span>
                  <div className="flex-1">
                    <div
                      className={cn(
                        'text-[13px] font-medium flex items-center justify-between',
                        isBypass ? 'text-[var(--color-danger)]' : 'text-[var(--color-text)]',
                      )}
                    >
                      {mode.label}
                      {isSelected && <Check size={12} className="text-[var(--color-accent)]" />}
                    </div>
                    <div className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                      {mode.description}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
