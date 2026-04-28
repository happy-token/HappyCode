import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { cn } from '@renderer/lib/utils'

interface WordRotateProps {
  words: string[]
  duration?: number
  motionProps?: object
  className?: string
}

export function WordRotate({ words, duration = 2500, motionProps = {}, className }: WordRotateProps) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % words.length), duration)
    return () => clearInterval(id)
  }, [words, duration])

  return (
    <div className="overflow-hidden py-1">
      <AnimatePresence mode="wait">
        <motion.span
          key={words[index]}
          className={cn('inline-block', className)}
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          {...motionProps}
        >
          {words[index]}
        </motion.span>
      </AnimatePresence>
    </div>
  )
}
