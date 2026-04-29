import React, { useCallback, useRef, useState } from 'react'
import { cn } from '@renderer/lib/utils'

interface SpotlightBgProps {
  className?: string
}

export function SpotlightBg({ className }: SpotlightBgProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const [spotX, setSpotX] = useState(190)
  const [spotY, setSpotY] = useState(160)

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    setSpotX(e.clientX - rect.left)
    setSpotY(e.clientY - rect.top)
  }, [])

  return (
    <div
      ref={containerRef}
      onMouseMove={onMouseMove}
      className={cn('absolute inset-0 overflow-hidden', className)}
    >
      {/* grain texture */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='noStitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")",
          opacity: 0.02,
        }}
      />

      {/* primary warm spotlight */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(circle 260px at ${spotX}px ${spotY}px, rgba(160,134,106,0.10) 0%, transparent 70%)`,
        }}
      />

      {/* secondary cool accent */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(circle 160px at ${spotX}px ${spotY}px, rgba(120,100,200,0.06) 0%, transparent 60%)`,
        }}
      />
    </div>
  )
}
