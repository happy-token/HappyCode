import React from 'react'
import { useTranslation } from 'react-i18next'
import {
  Settings2, ShieldCheck, Globe, Plug, Bot, Zap, Puzzle,
  Webhook, Monitor, Terminal, Download, Info,
  type LucideIcon,
} from 'lucide-react'
import { useSettingsStore, type SettingsTab } from '../../store/settings-store'
import { cn } from '@renderer/lib/utils'

const TAB_ICONS: Record<SettingsTab, LucideIcon> = {
  general: Settings2,
  permissions: ShieldCheck,
  providers: Globe,
  mcp: Plug,
  agents: Bot,
  skills: Zap,
  plugins: Puzzle,
  hooks: Webhook,
  computerUse: Monitor,
  claudeCode: Terminal,
  export: Download,
  about: Info,
}

const SETTINGS_TAB_IDS: SettingsTab[] = [
  'general', 'permissions', 'providers', 'mcp',
  'agents', 'skills', 'plugins', 'hooks',
  'computerUse', 'claudeCode',
]

const SETTINGS_BOTTOM_TAB_IDS: SettingsTab[] = ['export', 'about']

export function SettingsTabButton({ id }: { id: SettingsTab }) {
  const { t } = useTranslation()
  const activeTab = useSettingsStore((s) => s.activeTab)
  const setActiveTab = useSettingsStore((s) => s.setActiveTab)
  const isActive = activeTab === id
  const Icon = TAB_ICONS[id]

  return (
    <button
      onClick={() => setActiveTab(id)}
      className={cn(
        'flex w-full cursor-pointer items-center gap-[10px] border-0 border-l-[3px] px-4 py-[7px] text-[12px] text-left transition-colors duration-150',
        isActive ? 'border-l-[var(--color-accent)]' : 'border-l-transparent hover:bg-[var(--color-surface-2)]',
        isActive
          ? 'bg-[var(--color-accent-dim)] font-semibold text-[var(--color-accent)]'
          : 'bg-transparent font-normal text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
      )}
    >
      <Icon size={14} className="flex-shrink-0" />
      {t(`tabs.${id}`)}
    </button>
  )
}

export function SettingsTabList() {
  return (
    <>
      {SETTINGS_TAB_IDS.map((id) => <SettingsTabButton key={id} id={id} />)}
      <div className="mt-3 border-t border-[var(--color-border)] pt-2">
        {SETTINGS_BOTTOM_TAB_IDS.map((id) => <SettingsTabButton key={id} id={id} />)}
      </div>
    </>
  )
}
