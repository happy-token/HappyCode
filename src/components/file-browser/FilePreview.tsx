import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react'
import hljs from 'highlight.js/lib/core'
import typescript from 'highlight.js/lib/languages/typescript'
import javascript from 'highlight.js/lib/languages/javascript'
import python from 'highlight.js/lib/languages/python'
import css from 'highlight.js/lib/languages/css'
import json from 'highlight.js/lib/languages/json'
import markdown from 'highlight.js/lib/languages/markdown'
import bash from 'highlight.js/lib/languages/bash'
import xml from 'highlight.js/lib/languages/xml'
import rust from 'highlight.js/lib/languages/rust'
import go from 'highlight.js/lib/languages/go'
import { useFileBrowserStore } from '../../store/file-browser-store'
import './file-preview.css'

// Register only the languages we need to keep bundle size small
hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('typescriptreact', typescript)
hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('javascriptreact', javascript)
hljs.registerLanguage('python', python)
hljs.registerLanguage('css', css)
hljs.registerLanguage('json', json)
hljs.registerLanguage('markdown', markdown)
hljs.registerLanguage('bash', bash)
hljs.registerLanguage('xml', xml)
hljs.registerLanguage('rust', rust)
hljs.registerLanguage('go', go)

const MAX_LINES_DISPLAY = 10000

function getFilename(path: string): string {
  return path.split('/').pop() ?? path
}

export function FilePreview(): React.JSX.Element {
  const preview = useFileBrowserStore(s => s.preview)
  const selectedPath = useFileBrowserStore(s => s.selectedPath)
  const [copied, setCopied] = useState(false)

  // Syntax-highlight the content; memoized so it only reruns when content/language changes
  const highlightedHtml = useMemo(() => {
    if (!preview?.content) return ''
    const lang = preview.language || ''
    try {
      // hljs.highlight produces safe HTML from code content — not user-controlled HTML
      return hljs.highlight(preview.content, { language: lang }).value
    } catch {
      // Language not registered — escape HTML to prevent XSS and display as plain text
      return preview.content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    }
  }, [preview?.content, preview?.language])

  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleCopy = useCallback(() => {
    if (!preview?.content) return
    void navigator.clipboard.writeText(preview.content).then(() => {
      setCopied(true)
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current)
      copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000)
    })
  }, [preview?.content])

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current)
    }
  }, [])

  // ── Empty state ──────────────────────────────────────────────────
  if (!selectedPath) {
    return (
      <div className="flex flex-col h-full overflow-hidden bg-[var(--color-bg-secondary,#1e1e2e)] text-[var(--color-text,#cdd6f4)] font-mono text-[13px] items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-[var(--color-text-muted,#6c7086)] text-[13px] font-[var(--font-sans,system-ui,sans-serif)]">
          <svg viewBox="0 0 24 24" width="32" height="32" aria-hidden="true">
            <path
              d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <polyline
              points="14 2 14 8 20 8"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>Select a file to preview</span>
        </div>
      </div>
    )
  }

  // ── Too large ────────────────────────────────────────────────────
  if (preview?.tooLarge) {
    return (
      <div className="flex flex-col h-full overflow-hidden bg-[var(--color-bg-secondary,#1e1e2e)] text-[var(--color-text,#cdd6f4)] font-mono text-[13px] items-center justify-center">
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-[var(--color-border,rgba(255,255,255,0.08))] bg-[var(--color-bg-tertiary,#181825)] flex-shrink-0">
          <span className="text-[12px] font-semibold text-[var(--color-text,#cdd6f4)] whitespace-nowrap overflow-hidden text-ellipsis min-w-0">{getFilename(selectedPath)}</span>
        </div>
        <div className="px-3 py-[6px] text-[11px] flex-shrink-0 bg-[var(--color-warn-bg,rgba(250,179,135,0.08))] text-[var(--color-warn,#fab387)] border-b border-[var(--color-border,rgba(255,255,255,0.08))]">
          File too large to preview
        </div>
      </div>
    )
  }

  // ── Loading (selected but preview not yet loaded) ────────────────
  if (!preview) {
    return (
      <div className="flex flex-col h-full overflow-hidden bg-[var(--color-bg-secondary,#1e1e2e)] text-[var(--color-text,#cdd6f4)] font-mono text-[13px] items-center justify-center">
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-[var(--color-border,rgba(255,255,255,0.08))] bg-[var(--color-bg-tertiary,#181825)] flex-shrink-0">
          <span className="text-[12px] font-semibold text-[var(--color-text,#cdd6f4)] whitespace-nowrap overflow-hidden text-ellipsis min-w-0">{getFilename(selectedPath)}</span>
        </div>
        <div className="w-5 h-5 border-2 border-[var(--color-border,rgba(255,255,255,0.08))] border-t-[var(--color-accent,#89b4fa)] rounded-full animate-spin" aria-label="Loading preview" />
      </div>
    )
  }

  const filename = getFilename(selectedPath)

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[var(--color-bg-secondary,#1e1e2e)] text-[var(--color-text,#cdd6f4)] font-mono text-[13px]">
      {/* Header: filename, language badge, line count, copy button */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-[var(--color-border,rgba(255,255,255,0.08))] bg-[var(--color-bg-tertiary,#181825)] flex-shrink-0">
        <span className="text-[12px] font-semibold text-[var(--color-text,#cdd6f4)] whitespace-nowrap overflow-hidden text-ellipsis min-w-0" title={selectedPath}>{filename}</span>
        <div className="flex items-center gap-2 flex-shrink-0">
          {preview.language && (
            <span className="text-[11px] px-[6px] py-[2px] rounded bg-[var(--color-accent-muted,rgba(137,180,250,0.15))] text-[var(--color-accent,#89b4fa)] font-medium lowercase">{preview.language}</span>
          )}
          <span className="text-[11px] text-[var(--color-text-muted,#6c7086)]">
            {preview.totalLines.toLocaleString()} {preview.totalLines === 1 ? 'line' : 'lines'}
          </span>
          <button
            className={`flex items-center justify-center w-6 h-6 border-0 rounded bg-transparent cursor-pointer transition-[background,color] duration-150 ease p-0${copied ? ' text-[var(--color-success,#a6e3a1)]' : ' text-[var(--color-text-muted,#6c7086)] hover:bg-[var(--color-hover,rgba(255,255,255,0.08))] hover:text-[var(--color-text,#cdd6f4)]'}`}
            onClick={handleCopy}
            aria-label={copied ? 'Copied!' : 'Copy file content'}
            title={copied ? 'Copied!' : 'Copy'}
          >
            {copied ? (
              <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                <path d="M2 8l4 4 8-8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                <rect x="5" y="5" width="9" height="9" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
                <path d="M11 5V3.5A1.5 1.5 0 009.5 2h-6A1.5 1.5 0 002 3.5v6A1.5 1.5 0 003.5 11H5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Truncation notice */}
      {preview.truncated && (
        <div className="px-3 py-[6px] text-[11px] flex-shrink-0 bg-[var(--color-info-bg,rgba(137,180,250,0.08))] text-[var(--color-info,#89b4fa)] border-b border-[var(--color-border,rgba(255,255,255,0.08))]">
          Showing first {MAX_LINES_DISPLAY.toLocaleString()} lines
        </div>
      )}

      {/* Highlighted code block */}
      <div className="flex-1 overflow-auto min-h-0">
        <pre className="m-0 px-4 py-3 min-h-full bg-transparent whitespace-pre overflow-visible">
          {/* dangerouslySetInnerHTML is safe here: hljs only produces HTML from
              the code content itself, never from user-controlled HTML strings */}
          <code
            className={`hljs language-${preview.language || 'plaintext'}`}
            dangerouslySetInnerHTML={{ __html: highlightedHtml }}
          />
        </pre>
      </div>
    </div>
  )
}
