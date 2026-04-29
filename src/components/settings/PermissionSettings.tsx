import React from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Lock, Pencil, ListTodo, Zap, Ban, Bot } from 'lucide-react'
import { useApiConfigStore } from '../../store/api-config-store'
import type { PermissionMode } from '../../../electron/shared/types'
import { cn } from '@renderer/lib/utils'

export function PermissionSettings(): React.JSX.Element {
  const { t } = useTranslation()
  const { agentSettings, saveAgentSettings } = useApiConfigStore()
  const current = agentSettings.permissionMode ?? 'default'

  const MODES: Array<{ mode: PermissionMode; icon: React.ReactNode; labelKey: string; descKey: string }> = [
    { mode: 'default',           icon: <Lock size={18} />,    labelKey: 'permissions.modes.default',           descKey: 'permissions.modes.defaultDesc' },
    { mode: 'acceptEdits',       icon: <Pencil size={18} />,  labelKey: 'permissions.modes.acceptEdits',      descKey: 'permissions.modes.acceptEditsDesc' },
    { mode: 'plan',              icon: <ListTodo size={18} />, labelKey: 'permissions.modes.plan',              descKey: 'permissions.modes.planDesc' },
    { mode: 'bypassPermissions', icon: <Zap size={18} />,     labelKey: 'permissions.modes.bypassPermissions', descKey: 'permissions.modes.bypassPermissionsDesc' },
    { mode: 'dontAsk',           icon: <Ban size={18} />,     labelKey: 'permissions.modes.dontAsk',           descKey: 'permissions.modes.dontAskDesc' },
    { mode: 'auto',              icon: <Bot size={18} />,     labelKey: 'permissions.modes.auto',              descKey: 'permissions.modes.autoDesc' },
  ]

  async function handleSelect(mode: PermissionMode): Promise<void> {
    await saveAgentSettings({ ...agentSettings, permissionMode: mode })
  }

  return (
    <div className="max-w-[480px]">
      <div className="mb-1 text-[16px] font-bold text-[var(--color-text)]">{t('permissions.title')}</div>
      <div className="mb-5 text-[13px] text-[var(--color-text-muted)]">{t('permissions.description')}</div>

      <div className="flex flex-col gap-2">
        {MODES.map(({ mode, icon, labelKey, descKey }) => {
          const isSelected = current === mode
          return (
            <button
              key={mode}
              onClick={() => void handleSelect(mode)}
              className={cn(
                'flex cursor-pointer items-center gap-3 rounded-[12px] p-[14px] text-left',
                isSelected
                  ? 'border-2 border-[var(--color-accent)] bg-[var(--color-accent-dim)]'
                  : 'border border-[var(--color-border)] bg-transparent'
              )}
            >
              <span className="flex items-center text-[var(--color-text-muted)]">{icon}</span>
              <div className="flex-1">
                <div className="text-[14px] font-semibold text-[var(--color-text)]">{t(labelKey)}</div>
                <div className="mt-0.5 text-[12px] text-[var(--color-text-muted)]">{t(descKey)}</div>
              </div>
              {isSelected && (
                <Check size={18} className="flex-shrink-0 text-[var(--color-accent)]" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
