import { useEffect, useRef } from 'react'
import { useMotionValue, useSpring, useTransform, motion } from 'motion/react'
import { cn } from '@renderer/lib/utils'

interface NumberTickerProps {
  value: number
  direction?: 'up' | 'down'
  delay?: number
  decimalPlaces?: number
  className?: string
}

export function NumberTicker({ value, direction = 'up', delay = 0, decimalPlaces = 0, className }: NumberTickerProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const motionVal = useMotionValue(direction === 'down' ? value : 0)
  const springVal = useSpring(motionVal, { damping: 60, stiffness: 100 })
  const display = useTransform(springVal, (n) => n.toFixed(decimalPlaces))

  useEffect(() => {
    const timer = setTimeout(() => {
      motionVal.set(direction === 'down' ? 0 : value)
    }, delay * 1000)
    return () => clearTimeout(timer)
  }, [value, direction, delay, motionVal])

  return (
    <motion.span ref={ref} className={cn('tabular-nums tracking-tight', className)}>
      {display}
    </motion.span>
  )
}
