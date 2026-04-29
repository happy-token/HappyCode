import React, { useCallback, useRef, useState } from 'react'
import { cn } from '@renderer/lib/utils'

interface SpotlightBgProps {
  className?: string
}

export function SpotlightBg({ className }: SpotlightBgProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x: 190, y: 160 })

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    setPos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
  }, [])

  return (
    <div
      ref={containerRef}
      onMouseMove={onMouseMove}
      className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}
    >
      <div className="absolute inset-0 bg-[var(--color-surface-2)]" />

      {/* grain texture */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='still'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")",
        }}
      />

      {/* primary warm spotlight */}
      <div
        className="absolute inset-0 transition-none"
        style={{
          background: `radial-gradient(circle 260px at ${pos.x}px ${pos.y}px, rgba(160,134,106,0.10) 0%, transparent 70%)`,
        }}
      />

      {/* secondary cool accent */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(circle 160px at ${pos.x}px ${pos.y}px, rgba(120,100,200,0.06) 0%, transparent 60%)`,
        }}
      />
    </div>
  )
}
