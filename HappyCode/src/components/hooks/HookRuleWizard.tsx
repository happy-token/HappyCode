import React, { useState } from 'react'
import { AlertTriangle, ChevronRight } from 'lucide-react'
import type { HookType, ClaudeHookRule } from '../../../electron/shared/types'
import { HookTestSandbox } from './HookTestSandbox'

const ALL_HOOK_TYPES: HookType[] = [
  'PreToolUse', 'PostToolUse', 'PostToolUseFailure',
  'UserPromptSubmit', 'Stop',
  'SubagentStart', 'SubagentStop',
  'SessionStart', 'SessionEnd',
  'Notification', 'PreCompact',
]

const HOOK_DESCRIPTIONS: Record<HookType, string> = {
  PreToolUse:         '工具执行前。exit 2 可阻止执行并向 Claude 注入反馈',
  PostToolUse:        '工具成功执行后',
  PostToolUseFailure: '工具执行失败后',
  UserPromptSubmit:   '用户发送消息后、Claude 处理前',
  Stop:               'Claude 准备停止时。exit 2 重新激活（⚠ 可能死循环）',
  SubagentStart:      'Subagent 启动时',
  SubagentStop:       'Subagent 结束时',
  SessionStart:       '会话开始时',
  SessionEnd:         '会话结束时',
  Notification:       'Claude 发出通知时',
  PreCompact:         '上下文压缩前',
}

interface HookRuleWizardProps {
  onSave: (hookType: HookType, rule: ClaudeHookRule) => void
  onCancel: () => void
}

export function HookRuleWizard({ onSave, onCancel }: HookRuleWizardProps): React.JSX.Element {
  const [step, setStep] = useState<0 | 1 | 2>(0)
  const [selectedType, setSelectedType] = useState<HookType | null>(null)
  const [matcher, setMatcher] = useState('')
  const [command, setCommand] = useState('')
  const [stopConfirmed, setStopConfirmed] = useState(false)

  function canProceedStep0(): boolean {
    if (!selectedType) return false
    if (selectedType === 'Stop' && !stopConfirmed) return false
    return true
  }

  function handleSave(): void {
    if (!selectedType || !command.trim()) return
    const rule: ClaudeHookRule = { command: command.trim() }
    if (matcher.trim()) rule.matcher = matcher.trim()
    onSave(selectedType, rule)
  }

  const stepTitles = ['选择触发事件', '设置匹配条件', '配置命令']

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Step indicator */}
      <div style={{ display: 'flex', gap: 0, alignItems: 'center', marginBottom: 4 }}>
        {stepTitles.map((title, i) => (
          <React.Fragment key={i}>
            <div style={{
              fontSize: 11,
              color: i === step ? 'var(--color-accent)' : i < step ? 'var(--color-text-muted)' : 'var(--color-text-faint)',
              fontWeight: i === step ? 600 : 400,
            }}>
              {i + 1}. {title}
            </div>
            {i < stepTitles.length - 1 && (
              <ChevronRight size={10} style={{ margin: '0 4px', color: 'var(--color-text-faint)', flexShrink: 0 }} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Step 0: Event type selection */}
      {step === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {ALL_HOOK_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => { setSelectedType(type); setStopConfirmed(false) }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                padding: '7px 10px',
                borderRadius: 'var(--radius-md)',
                background: selectedType === type ? 'var(--color-accent-dim)' : 'var(--color-surface-2)',
                border: selectedType === type ? '1px solid var(--color-accent)' : '1px solid var(--color-border)',
                cursor: 'pointer',
                gap: 2,
                textAlign: 'left',
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text)' }}>{type}</span>
              <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{HOOK_DESCRIPTIONS[type]}</span>
            </button>
          ))}

          {selectedType === 'Stop' && (
            <div style={{
              background: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid var(--color-warning, #f59e0b)',
              borderRadius: 'var(--radius-md)',
              padding: '8px 10px',
              marginTop: 4,
            }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                <AlertTriangle size={13} color="var(--color-warning, #f59e0b)" style={{ flexShrink: 0, marginTop: 1 }} />
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-warning, #f59e0b)' }}>Stop Hook 警告</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
                    exit 2 会让 Claude 继续运行，可能导致无限循环。确保命令有明确的终止条件。
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={stopConfirmed}
                      onChange={(e) => setStopConfirmed(e.target.checked)}
                    />
                    <span style={{ fontSize: 11, color: 'var(--color-text)' }}>我已了解风险</span>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 1: Tool matcher */}
      {step === 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
            设置工具名匹配模式（留空 = 匹配所有工具）
          </div>
          <input
            value={matcher}
            onChange={(e) => setMatcher(e.target.value)}
            placeholder="例：Bash  /  Edit  /  留空表示全部"
            style={{
              padding: '7px 10px',
              background: 'var(--color-surface-2)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--color-text)',
              fontSize: 12,
              fontFamily: 'var(--font-mono)',
            }}
          />
        </div>
      )}

      {/* Step 2: Command + test sandbox */}
      {step === 2 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 4 }}>Shell 命令</div>
            <input
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="例：/home/user/.claude/hooks/my-hook.sh"
              style={{
                width: '100%',
                padding: '7px 10px',
                background: 'var(--color-surface-2)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--color-text)',
                fontSize: 12,
                fontFamily: 'var(--font-mono)',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {selectedType !== null && command.trim() && (
            <HookTestSandbox command={command} eventName={selectedType} />
          )}
        </div>
      )}

      {/* Navigation */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
        <button
          onClick={onCancel}
          style={{
            padding: '6px 14px',
            background: 'var(--color-surface-2)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-text-muted)',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          取消
        </button>

        {step > 0 && (
          <button
            onClick={() => setStep((s) => (s - 1) as 0 | 1 | 2)}
            style={{
              padding: '6px 14px',
              background: 'var(--color-surface-2)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--color-text)',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            上一步
          </button>
        )}

        {step < 2 ? (
          <button
            onClick={() => setStep((s) => (s + 1) as 0 | 1 | 2)}
            disabled={step === 0 && !canProceedStep0()}
            style={{
              padding: '6px 14px',
              background: (step === 0 && !canProceedStep0()) ? 'var(--color-surface-3)' : 'var(--color-accent)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              color: (step === 0 && !canProceedStep0()) ? 'var(--color-text-muted)' : '#fff',
              fontSize: 12,
              fontWeight: 600,
              cursor: (step === 0 && !canProceedStep0()) ? 'not-allowed' : 'pointer',
            }}
          >
            下一步
          </button>
        ) : (
          <button
            onClick={handleSave}
            disabled={!command.trim()}
            style={{
              padding: '6px 14px',
              background: !command.trim() ? 'var(--color-surface-3)' : 'var(--color-accent)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              color: !command.trim() ? 'var(--color-text-muted)' : '#fff',
              fontSize: 12,
              fontWeight: 600,
              cursor: !command.trim() ? 'not-allowed' : 'pointer',
            }}
          >
            保存规则
          </button>
        )}
      </div>
    </div>
  )
}
