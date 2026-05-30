import React, { useRef } from 'react'
import { MessageSquare, History, Plug, Zap, Webhook, Settings } from 'lucide-react'
import { motion, useMotionValue, useSpring, useTransform, type MotionValue } from 'motion/react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { useUiStore, type ActivePage } from '../../store/ui-store'
import { cn } from '@renderer/lib/utils'

const ICON_SIZE = 20
const PROXIMITY = 80

interface NavItem {
  page: ActivePage
  Icon: React.ComponentType<{ size?: number }>
  label: string
}

const MAIN_ITEMS: NavItem[] = [
  { page: 'chat',     Icon: MessageSquare, label: 'Chat' },
  { page: 'sessions', Icon: History,       label: 'Sessions' },
  { page: 'mcp',      Icon: Plug,          label: 'MCP' },
  { page: 'skills',   Icon: Zap,           label: 'Skills' },
  { page: 'hooks',    Icon: Webhook,       label: 'Hooks' },
]

interface DockButtonProps {
  page: ActivePage
  Icon: React.ComponentType<{ size?: number }>
  label: string
  active: boolean
  onClick: () => void
  mouseY: MotionValue<number>
}

function DockButton({ Icon, label, active, onClick, mouseY }: DockButtonProps): React.JSX.Element {
  const ref = useRef<HTMLButtonElement>(null)

  const distanceY = useTransform(mouseY, (val: number) => {
    const b = ref.current?.getBoundingClientRect() ?? { y: 0, height: 0 }
    return val - b.y - b.height / 2
  })

  const scale = useSpring(
    useTransform(distanceY, [-PROXIMITY, 0, PROXIMITY], [1, 1.45, 1]),
    { mass: 0.1, stiffness: 160, damping: 13 }
  )

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <motion.button
          ref={ref}
          onClick={onClick}
          aria-label={label}
          whileTap={{ scale: 0.88 }}
          className={cn(
            'relative flex h-12 w-12 flex-shrink-0 items-center justify-center cursor-pointer border-0 p-0 transition-colors',
            active
              ? 'text-[var(--color-accent)] bg-[var(--color-accent-dim)]'
              : 'text-[var(--color-text-muted)] bg-transparent hover:text-[var(--color-text)]'
          )}
        >
          {active && (
            <motion.span
              layoutId="dock-indicator"
              className="absolute left-0 top-2 bottom-2 w-0.5 rounded-r-sm bg-[var(--color-accent)]"
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
          )}
          <motion.span style={{ scale }} className="flex items-center justify-center">
            <Icon size={ICON_SIZE} />
          </motion.span>
        </motion.button>
      </TooltipTrigger>
      <TooltipContent side="right">
        <p>{label}</p>
      </TooltipContent>
    </Tooltip>
  )
}

export function NavRail(): React.JSX.Element {
  const activePage = useUiStore((s) => s.activePage)
  const setActivePage = useUiStore((s) => s.setActivePage)
  const mouseY = useMotionValue(Infinity)

  return (
    <TooltipProvider delayDuration={300}>
      <nav
        aria-label="Main navigation"
        onMouseMove={(e) => mouseY.set(e.clientY)}
        onMouseLeave={() => mouseY.set(Infinity)}
        className="flex w-12 flex-shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)]"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        {MAIN_ITEMS.map(({ page, Icon, label }) => (
          <DockButton
            key={page}
            page={page}
            Icon={Icon}
            label={label}
            active={activePage === page}
            onClick={() => setActivePage(page)}
            mouseY={mouseY}
          />
        ))}
        <div className="flex-1" />
        <DockButton
          page="settings"
          Icon={Settings}
          label="Settings"
          active={activePage === 'settings'}
          onClick={() => setActivePage('settings')}
          mouseY={mouseY}
        />
      </nav>
    </TooltipProvider>
  )
}
