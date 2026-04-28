import { motion, useInView } from 'motion/react'
import { useRef } from 'react'
import { cn } from '@renderer/lib/utils'

interface BlurFadeProps {
  children: React.ReactNode
  className?: string
  duration?: number
  delay?: number
  yOffset?: number
  blur?: string
}

export function BlurFade({
  children,
  className,
  duration = 0.35,
  delay = 0,
  yOffset = 8,
  blur = '4px',
}: BlurFadeProps) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-20px' })

  const hidden = { y: yOffset, filter: `blur(${blur})`, opacity: 0 }
  const visible = { y: 0, filter: 'blur(0px)', opacity: 1 }

  return (
    <motion.div
      ref={ref}
      initial={hidden}
      animate={inView ? visible : hidden}
      transition={{ delay, duration, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={cn(className)}
    >
      {children}
    </motion.div>
  )
}
