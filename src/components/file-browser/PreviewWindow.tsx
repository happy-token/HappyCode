import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import Editor from '@monaco-editor/react'
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
import type { FilePreviewResult } from '../../../electron/shared/types'
import './file-preview.css'

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
hljs.registerLanguage('html', xml)
hljs.registerLanguage('rust', rust)
hljs.registerLanguage('go', go)

type PreviewData = FilePreviewResult & { filePath: string; cwd?: string; theme?: string }
type ViewMode = 'preview' | 'raw' | 'edit'

export function PreviewWindow(): React.JSX.Element {
  const [data, setData] = useState<PreviewData | null>(null)
  const [copied, setCopied] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('preview')
  const [editContent, setEditContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Apply theme to this window's document root
  useEffect(() => {
    const unsub = window.electron.onPreviewData((d) => {
      setData(d)
      const theme = d.theme ?? 'dark'
      document.documentElement.setAttribute('data-theme', theme)
      document.documentElement.className = theme === 'dark' ? 'dark' : ''
    })
    return unsub
  }, [])

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current)
    }
  }, [])

  const isMarkdown = data?.language === 'markdown'
  const isHtml = data?.language === 'html'
  const supportsPreview = isMarkdown || isHtml
  const canEdit = !data?.isImage && !data?.tooLarge && !data?.truncated

  const highlightedHtml = useMemo(() => {
    if (!data?.content) return ''
    if (supportsPreview && viewMode === 'preview') return ''
    const lang = data.language || ''
    try {
      return hljs.highlight(data.content, { language: lang }).value
    } catch {
      return data.content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    }
  }, [data?.content, data?.language, supportsPreview, viewMode])

  const handleCopy = useCallback(() => {
    if (!data?.content) return
    void navigator.clipboard.writeText(data.content).then(() => {
      setCopied(true)
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current)
      copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000)
    })
  }, [data?.content])

  const handleEditStart = useCallback(() => {
    if (!data?.content) return
    setEditContent(data.content)
    setSaveError(null)
    setViewMode('edit')
  }, [data?.content])

  const handleSave = useCallback(async () => {
    if (!data) return
    const cwd = data.cwd ?? data.filePath.split('/').slice(0, -1).join('/')
    setSaving(true)
    setSaveError(null)
    try {
      const result = await window.electron.writeFile({ path: data.filePath, content: editContent, cwd })
      if (result.success) {
        setData((prev) => prev ? { ...prev, content: editContent } : prev)
        setViewMode('preview')
      } else {
        setSaveError(result.error ?? 'Save failed')
      }
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }, [data, editContent])

  const filename = data?.filePath.split('/').pop() ?? ''

  if (!data) {
    return (
      <div className="fp-root fp-root--loading">
        <div className="fp-spinner" aria-label="Loading preview" />
      </div>
    )
  }

  if (data.isImage) {
    return (
      <div className="fp-root">
        <div className="fp-header">
          <span className="fp-filename" title={data.filePath} style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>{filename}</span>
          <div className="fp-meta" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
            {data.mimeType && <span className="fp-badge">{data.mimeType}</span>}
          </div>
        </div>
        <div className="fp-image-wrap">
          <img src={data.content} alt={filename} className="fp-image" />
        </div>
      </div>
    )
  }

  if (data.tooLarge) {
    return (
      <div className="fp-root">
        <div className="fp-header">
          <span className="fp-filename" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>{filename}</span>
        </div>
        <div className="fp-notice fp-notice--warn">File too large to preview</div>
      </div>
    )
  }

  return (
    <div className="fp-root">
      <div className="fp-header">
        <span className="fp-filename" title={data.filePath} style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>{filename}</span>
        <div className="fp-meta" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          {viewMode === 'edit' ? (
            <>
              <button className="fp-mode-btn fp-mode-btn--active" onClick={() => void handleSave()} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button className="fp-mode-btn" onClick={() => setViewMode('preview')}>Cancel</button>
            </>
          ) : (
            <>
              {supportsPreview && (
                <div className="fp-mode-toggle">
                  <button
                    className={viewMode === 'preview' ? 'fp-mode-btn fp-mode-btn--active' : 'fp-mode-btn'}
                    onClick={() => setViewMode('preview')}
                  >
                    Preview
                  </button>
                  <button
                    className={viewMode === 'raw' ? 'fp-mode-btn fp-mode-btn--active' : 'fp-mode-btn'}
                    onClick={() => setViewMode('raw')}
                  >
                    Raw
                  </button>
                </div>
              )}
              {(!supportsPreview || viewMode === 'raw') && data.language && (
                <span className="fp-badge">{data.language}</span>
              )}
              <span className="fp-lines">
                {data.totalLines.toLocaleString()} {data.totalLines === 1 ? 'line' : 'lines'}
              </span>
              {canEdit && (
                <button
                  className="fp-copy"
                  onClick={handleEditStart}
                  aria-label="Edit file"
                  title="Edit"
                >
                  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                    <path d="M11.5 2.5a1.414 1.414 0 012 2L5 13H3v-2L11.5 2.5z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              )}
              <button
                className={copied ? 'fp-copy fp-copy--done' : 'fp-copy'}
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
            </>
          )}
        </div>
      </div>

      {data.truncated && (
        <div className="fp-notice fp-notice--info">Showing first 10,000 lines</div>
      )}

      {saveError && (
        <div className="fp-notice fp-notice--warn">{saveError}</div>
      )}

      {viewMode === 'edit' ? (
        <div className="fp-edit-wrap">
          <Editor
            height="100%"
            language={data.language || 'plaintext'}
            value={editContent}
            theme={data.theme === 'dark' ? 'vs-dark' : 'light'}
            onChange={(val) => setEditContent(val ?? '')}
            options={{ minimap: { enabled: false }, fontSize: 13, wordWrap: 'on', scrollBeyondLastLine: false }}
          />
        </div>
      ) : isMarkdown && viewMode === 'preview' ? (
        <div className="fp-md-scroll">
          <div className="fp-md-body">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {data.content}
            </ReactMarkdown>
          </div>
        </div>
      ) : isHtml && viewMode === 'preview' ? (
        <div className="fp-html-wrap">
          <iframe
            className="fp-iframe"
            srcDoc={data.content}
            sandbox=""
            title="HTML preview"
          />
        </div>
      ) : (
        <div className="fp-scroll">
          <pre className="fp-pre">
            <code
              className={`hljs language-${data.language || 'plaintext'}`}
              dangerouslySetInnerHTML={{ __html: highlightedHtml }}
            />
          </pre>
        </div>
      )}
    </div>
  )
}
