interface LogoProps {
  className?: string
  variant?: 'purple' | 'warm-brown' | 'amber-gold' | 'green' | 'purple-bridge'
}

const gradients: Record<NonNullable<LogoProps['variant']>, { bg: [string, string], shine?: [string, string] }> = {
  purple: {
    bg: ['#c4b0ff', '#3d1fc0'],
    shine: ['rgba(255,255,255,0.22)', 'rgba(255,255,255,0)'],
  },
  'warm-brown': {
    bg: ['#c9a882', '#8c7055'],
    shine: ['rgba(255,255,255,0.18)', 'rgba(255,255,255,0)'],
  },
  'amber-gold': {
    bg: ['#f5d78e', '#8c7055'],
    shine: ['rgba(255,248,220,0.22)', 'rgba(255,255,255,0)'],
  },
  green: {
    bg: ['#6dd6a0', '#1a8a5e'],
    shine: ['rgba(255,255,255,0.22)', 'rgba(255,255,255,0)'],
  },
  'purple-bridge': {
    bg: ['#c9a882', '#3d1fc0'],
    shine: ['rgba(255,255,255,0.22)', 'rgba(255,255,255,0)'],
  },
}

export function Logo({ className, variant = 'green' }: LogoProps): React.JSX.Element {
  const g = gradients[variant]
  const id = `logo-bg-${variant}`
  const shineId = `logo-shine-${variant}`

  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" fill="none" className={className}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={g.bg[0]} />
          <stop offset="100%" stopColor={g.bg[1]} />
        </linearGradient>
        {g.shine && (
          <linearGradient id={shineId} x1="0" y1="0" x2="0" y2="22" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={g.shine[0]} />
            <stop offset="100%" stopColor={g.shine[1]} />
          </linearGradient>
        )}
      </defs>
      <rect width="40" height="40" rx="10" fill={`url(#${id})`} />
      {g.shine && <rect width="40" height="22" rx="10" fill={`url(#${shineId})`} />}
      {g.shine && <rect x="0" y="10" width="40" height="12" fill={`url(#${shineId})`} />}
      <path d="M24.2,10.4 A12,12 0 1 0 24.2,29.6" stroke="white" strokeWidth="4.2" strokeLinecap="round" />
      <circle cx="30" cy="15" r="2.2" fill="white" />
      <circle cx="30" cy="25" r="2.2" fill="white" />
    </svg>
  )
}
