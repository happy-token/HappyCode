import { useEffect, useState } from 'react'
import { cn } from '@renderer/lib/utils'

interface MeteorProps {
  number?: number
  className?: string
}

export function Meteors({ number = 12, className }: MeteorProps) {
  const [meteors, setMeteors] = useState<Array<{ id: number; left: string; delay: string; duration: string; size: number }>>([])

  useEffect(() => {
    setMeteors(
      Array.from({ length: number }, (_, i) => ({
        id: i,
        left: `${Math.floor(Math.random() * 100)}%`,
        delay: `${(Math.random() * 4).toFixed(2)}s`,
        duration: `${(Math.random() * 3 + 4).toFixed(2)}s`,
        size: Math.floor(Math.random() * 60 + 20),
      }))
    )
  }, [number])

  return (
    <div className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}>
      {meteors.map((m) => (
        <span
          key={m.id}
          className="absolute top-0 h-px animate-meteor-effect bg-gradient-to-r from-[var(--color-accent)] to-transparent shadow-[0_0_0_1px_#ffffff10]"
          style={{
            left: m.left,
            width: m.size,
            animationDelay: m.delay,
            animationDuration: m.duration,
          }}
        />
      ))}
    </div>
  )
}
