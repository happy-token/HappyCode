import React from 'react'
import {
  Settings2, ShieldCheck, Globe, Plug, Bot, Zap, Puzzle,
  Webhook, Monitor, Terminal, Download, Info,
  type LucideIcon,
} from 'lucide-react'
import { useSettingsStore, type SettingsTab } from '../../store/settings-store'
import { cn } from '@renderer/lib/utils'

export const SETTINGS_TABS: Array<{ id: SettingsTab; Icon: LucideIcon; label: string }> = [
  { id: 'general',       Icon: Settings2,    label: '通用' },
  { id: 'permissions',   Icon: ShieldCheck,  label: '权限' },
  { id: 'providers',     Icon: Globe,        label: '服务商' },
  { id: 'mcp',           Icon: Plug,         label: 'MCP' },
  { id: 'agents',        Icon: Bot,          label: 'Agents' },
  { id: 'skills',        Icon: Zap,          label: '技能' },
  { id: 'plugins',       Icon: Puzzle,       label: '插件' },
  { id: 'hooks',         Icon: Webhook,      label: 'Hooks' },
  { id: 'computerUse',   Icon: Monitor,      label: 'Computer Use' },
  { id: 'claudeCode',    Icon: Terminal,     label: 'Claude Code' },
]

export const SETTINGS_BOTTOM_TABS: Array<{ id: SettingsTab; Icon: LucideIcon; label: string }> = [
  { id: 'export',  Icon: Download, label: '导出' },
  { id: 'about',   Icon: Info,     label: '关于' },
]

export function SettingsTabButton({ id, Icon, label }: { id: SettingsTab; Icon: LucideIcon; label: string }) {
  const activeTab = useSettingsStore((s) => s.activeTab)
  const setActiveTab = useSettingsStore((s) => s.setActiveTab)
  const isActive = activeTab === id

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
      {label}
    </button>
  )
}
