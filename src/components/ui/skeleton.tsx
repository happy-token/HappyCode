import React from 'react'
import { cn } from '@renderer/lib/utils'

interface SkeletonProps {
  className?: string
  /** Number of skeleton lines to render (default 1) */
  lines?: number
  /** Gap between lines in px (default 8) */
  gap?: number
}

function SkeletonLine({ className }: { className?: string }): React.JSX.Element {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn(
        'animate-pulse rounded-[var(--radius-sm)] bg-[var(--color-surface-2)]',
        className
      )}
    />
  )
}

/**
 * Skeleton loading placeholder.
 * Use instead of spinners for loading states per DESIGN.md § 交互状态矩阵.
 *
 * @example
 * // Single line
 * <Skeleton className="h-4 w-48" />
 *
 * // Card skeleton
 * <Skeleton lines={3} className="h-3" />
 */
export function Skeleton({ className, lines = 1, gap = 8 }: SkeletonProps): React.JSX.Element {
  if (lines === 1) {
    return <SkeletonLine className={className} />
  }

  return (
    <div
      role="status"
      aria-label="Loading"
      className="flex flex-col"
      style={{ gap }}
    >
      {Array.from({ length: lines }, (_, i) => (
        <SkeletonLine
          key={i}
          className={cn(
            className,
            // Last line is 60% width for visual variety
            i === lines - 1 && 'w-[60%]'
          )}
        />
      ))}
    </div>
  )
}

/**
 * Card-shaped skeleton with header + body lines
 */
export function SkeletonCard({ lines = 3 }: { lines?: number }): React.JSX.Element {
  return (
    <div className="space-y-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <SkeletonLine className="mb-2 h-4 w-2/5" />
      <Skeleton lines={lines} className="h-3" />
    </div>
  )
}

/**
 * Message bubble skeleton for chat loading state
 */
export function SkeletonMessage(): React.JSX.Element {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <SkeletonLine className="h-8 w-8 flex-shrink-0 rounded-full" />
      <div className="flex flex-1 flex-col gap-2">
        <SkeletonLine className="h-3 w-24" />
        <SkeletonLine className="h-3 w-full" />
        <SkeletonLine className="h-3 w-3/4" />
      </div>
    </div>
  )
}
