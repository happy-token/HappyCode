import React, { useState } from 'react'
import { cn } from '@renderer/lib/utils'

export function ExportSettings(): React.JSX.Element {
  const [redactMode, setRedactMode] = useState<'none' | 'sensitive' | 'all'>('sensitive')
  const [customPatterns, setCustomPatterns] = useState('')

  const modes: Array<{ value: typeof redactMode; label: string; desc: string }> = [
    { value: 'none', label: '不脱敏', desc: '导出完整内容，包括敏感信息' },
    { value: 'sensitive', label: '脱敏敏感', desc: '隐藏 API 密钥、令牌等敏感信息' },
    { value: 'all', label: '完全脱敏', desc: '隐藏所有可能泄露的信息' },
  ]

  return (
    <div className="max-w-[640px]">
      <div className="mb-4">
        <div className="text-[16px] font-bold text-[var(--color-text)]">导出设置</div>
        <div className="mt-0.5 text-[12px] text-[var(--color-text-muted)]">配置会话导出的脱敏规则</div>
      </div>

      <div className="flex flex-col gap-5">
        {/* Redact mode */}
        <div>
          <div className="mb-2 text-[12px] font-semibold text-[var(--color-text)]">脱敏模式</div>
          <div className="flex flex-col gap-2">
            {modes.map((mode) => (
              <label
                key={mode.value}
                className={cn(
                  'flex cursor-pointer items-start gap-[10px] rounded-[8px] p-3',
                  redactMode === mode.value
                    ? 'border border-[var(--color-accent)] bg-[var(--color-accent-dim)]'
                    : 'border border-[var(--color-border)] bg-transparent'
                )}
              >
                <input
                  type="radio"
                  name="redactMode"
                  checked={redactMode === mode.value}
                  onChange={() => setRedactMode(mode.value)}
                  className="mt-0.5 flex-shrink-0 [accent-color:var(--color-accent)]"
                />
                <div>
                  <div className="text-[12px] font-semibold text-[var(--color-text)]">{mode.label}</div>
                  <div className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">{mode.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Custom patterns */}
        <div>
          <label>
            <div className="mb-2 text-[12px] font-semibold text-[var(--color-text)]">自定义脱敏模式</div>
            <textarea
              value={customPatterns}
              onChange={(e) => setCustomPatterns(e.target.value)}
              className="box-border min-h-[80px] w-full resize-y rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-[10px] py-[6px] font-mono text-[12px] text-[var(--color-text)] outline-none"
              placeholder={"每行一个正则表达式\n例如:sk-[a-zA-Z0-9]{20,}"}
            />
          </label>
          <div className="mt-1 text-[10px] text-[var(--color-text-faint)]">
            每行一个正则表达式，用于匹配需要脱敏的内容
          </div>
        </div>
      </div>
    </div>
  )
}
