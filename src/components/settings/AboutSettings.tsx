import React from 'react'

// Version is injected at build time via Vite define
declare const __APP_VERSION__: string

const VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.2.0'

export function AboutSettings(): React.JSX.Element {
  const version = VERSION
  const repo = 'https://github.com/HappyToken/HappyCode'

  return (
    <div className="max-w-[640px]">
      <div className="mb-4">
        <div className="text-[16px] font-bold text-[var(--color-text)]">关于</div>
      </div>

      <div className="flex flex-col items-center gap-4 py-10">
        <div className="flex h-16 w-16 items-center justify-center rounded-[16px] bg-[var(--color-accent)] text-[28px] font-bold text-white">
          HC
        </div>

        <div className="text-center">
          <div className="text-[18px] font-bold text-[var(--color-text)]">Happy Code</div>
          <div className="mt-1 text-[12px] text-[var(--color-text-muted)]">v{version}</div>
        </div>

        <div className="max-w-[400px] text-center text-[13px] leading-[1.6] text-[var(--color-text)]">
          Claude Code GUI 桌面应用，提供图形化的 AI 编码助手体验。
        </div>

        <div className="mt-2 flex w-full max-w-[320px] flex-col gap-2">
          <div className="flex justify-between border-b border-[var(--color-border)] py-2">
            <span className="text-[12px] text-[var(--color-text-muted)]">作者</span>
            <span className="text-[12px] font-semibold text-[var(--color-text)]">HappyToken</span>
          </div>
          <div className="flex justify-between border-b border-[var(--color-border)] py-2">
            <span className="text-[12px] text-[var(--color-text-muted)]">版本</span>
            <span className="text-[12px] text-[var(--color-text)]">v{version}</span>
          </div>
          <div className="flex justify-between border-b border-[var(--color-border)] py-2">
            <span className="text-[12px] text-[var(--color-text-muted)]">仓库</span>
            <a
              href={repo}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[12px] text-[var(--color-accent)] no-underline"
            >
              GitHub
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
