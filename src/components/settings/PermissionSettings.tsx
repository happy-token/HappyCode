import React from 'react'
import { Check, Lock, Pencil, ListTodo, Zap, Ban, Bot } from 'lucide-react'
import { useApiConfigStore } from '../../store/api-config-store'
import type { PermissionMode } from '../../../electron/shared/types'
import { cn } from '@renderer/lib/utils'

const MODES: Array<{ mode: PermissionMode; icon: React.ReactNode; label: string; desc: string }> = [
  { mode: 'default',           icon: <Lock size={18} />,    label: 'Default',        desc: '默认模式，每个工具调用前询问' },
  { mode: 'acceptEdits',       icon: <Pencil size={18} />,  label: 'AcceptEdits',    desc: '自动接受文件修改，其他操作询问' },
  { mode: 'plan',              icon: <ListTodo size={18} />, label: 'Plan',           desc: '仅生成计划，不执行' },
  { mode: 'bypassPermissions', icon: <Zap size={18} />,     label: 'Bypass',         desc: '跳过所有确认提示' },
  { mode: 'dontAsk',           icon: <Ban size={18} />,     label: "Don't Ask",      desc: '拒绝任何未预批准的请求' },
  { mode: 'auto',              icon: <Bot size={18} />,     label: 'Auto',           desc: '由模型分类器自动决定' },
]

export function PermissionSettings(): React.JSX.Element {
  const { agentSettings, saveAgentSettings } = useApiConfigStore()
  const current = agentSettings.permissionMode ?? 'default'

  async function handleSelect(mode: PermissionMode): Promise<void> {
    await saveAgentSettings({ ...agentSettings, permissionMode: mode })
  }

  return (
    <div className="max-w-[480px]">
      <div className="mb-1 text-[16px] font-bold text-[var(--color-text)]">权限设置</div>
      <div className="mb-5 text-[13px] text-[var(--color-text-muted)]">配置 AI 代理的权限模式</div>

      <div className="flex flex-col gap-2">
        {MODES.map(({ mode, icon, label, desc }) => {
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
                <div className="text-[14px] font-semibold text-[var(--color-text)]">{label}</div>
                <div className="mt-0.5 text-[12px] text-[var(--color-text-muted)]">{desc}</div>
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
