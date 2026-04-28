import { useEffect, useState } from 'react'
import { cn } from '@renderer/lib/utils'

interface TypingAnimationProps {
  text: string
  duration?: number
  className?: string
  startOnMount?: boolean
}

export function TypingAnimation({ text, duration = 60, className, startOnMount = true }: TypingAnimationProps) {
  const [displayed, setDisplayed] = useState('')
  const [started, setStarted] = useState(startOnMount)

  useEffect(() => {
    if (!started) return
    setDisplayed('')
    let i = 0
    const id = setInterval(() => {
      if (i < text.length) {
        setDisplayed(text.slice(0, ++i))
      } else {
        clearInterval(id)
      }
    }, duration)
    return () => clearInterval(id)
  }, [text, duration, started])

  return (
    <span className={cn('inline-block', className)} onClick={() => !started && setStarted(true)}>
      {displayed}
      {displayed.length < text.length && (
        <span className="animate-pulse">|</span>
      )}
    </span>
  )
}
