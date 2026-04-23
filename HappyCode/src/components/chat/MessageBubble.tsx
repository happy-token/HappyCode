import React, { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import hljs from 'highlight.js'
import 'highlight.js/styles/github-dark.css'
import type { UIMessage, AskQuestion } from '../../../electron/shared/types'
import { useChatStore } from '../../store/session-store'

function CodeBlock({ language, code }: { language: string; code: string }): React.JSX.Element {
  const [copied, setCopied] = useState(false)

  const highlighted = (() => {
    try {
      return language
        ? hljs.highlight(code, { language, ignoreIllegals: true }).value
        : hljs.highlightAuto(code).value
    } catch {
      return code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    }
  })()

  function copy(): void {
    void navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <div
      style={{
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        margin: '8px 0',
        fontSize: 12,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '4px 12px',
          background: 'var(--color-surface-2)',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text-muted)' }}>
          {language || 'code'}
        </span>
        <button
          onClick={copy}
          style={{
            fontSize: 10,
            color: copied ? 'var(--color-success)' : 'var(--color-text-muted)',
            padding: '1px 8px',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            background: 'transparent',
            cursor: 'pointer',
          }}
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <pre
        style={{
          margin: 0,
          padding: '10px 14px',
          overflow: 'auto',
          lineHeight: 1.6,
          fontFamily: 'var(--font-mono)',
          background: '#0d1117',
        }}
      >
        <code
          className={language ? `hljs language-${language}` : 'hljs'}
          dangerouslySetInnerHTML={{ __html: highlighted }}
        />
      </pre>
    </div>
  )
}

const mdComponents: React.ComponentProps<typeof ReactMarkdown>['components'] = {
  p: ({ children }) => (
    <p style={{ margin: '0 0 10px', lineHeight: 1.7 }}>{children}</p>
  ),
  h1: ({ children }) => (
    <h1 style={{ fontSize: 18, fontWeight: 700, margin: '14px 0 8px', color: 'var(--color-text)' }}>{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 style={{ fontSize: 15, fontWeight: 700, margin: '12px 0 6px', color: 'var(--color-text)' }}>{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 style={{ fontSize: 13, fontWeight: 700, margin: '10px 0 4px', color: 'var(--color-text)' }}>{children}</h3>
  ),
  ul: ({ children }) => (
    <ul style={{ margin: '0 0 10px', paddingLeft: 20, lineHeight: 1.7 }}>{children}</ul>
  ),
  ol: ({ children }) => (
    <ol style={{ margin: '0 0 10px', paddingLeft: 20, lineHeight: 1.7 }}>{children}</ol>
  ),
  li: ({ children }) => <li style={{ marginBottom: 2 }}>{children}</li>,
  strong: ({ children }) => (
    <strong style={{ fontWeight: 700, color: 'var(--color-text)' }}>{children}</strong>
  ),
  em: ({ children }) => <em style={{ fontStyle: 'italic' }}>{children}</em>,
  blockquote: ({ children }) => (
    <blockquote
      style={{
        borderLeft: '3px solid var(--color-accent)',
        margin: '8px 0',
        paddingLeft: 12,
        color: 'var(--color-text-muted)',
        fontStyle: 'italic',
      }}
    >
      {children}
    </blockquote>
  ),
  code: ({ className, children, ...props }) => {
    const hasLanguage = className?.startsWith('language-')
    const content = String(children)
    // Fenced code blocks (with or without language) always contain a trailing newline
    const isBlock = hasLanguage || content.includes('\n')
    if (isBlock) {
      const language = className?.replace('language-', '') ?? ''
      return <CodeBlock language={language} code={content.trim()} />
    }
    return (
      <code
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.9em',
          background: 'var(--color-surface-2)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-sm)',
          padding: '1px 5px',
          color: 'var(--color-accent)',
        }}
        {...props}
      >
        {children}
      </code>
    )
  },
  pre: ({ children }) => <>{children}</>,
  a: ({ href, children }) => (
    <a
      href={href}
      style={{ color: 'var(--color-accent)', textDecoration: 'underline' }}
      onClick={(e) => { e.preventDefault(); if (href) window.open(href) }}
    >
      {children}
    </a>
  ),
  hr: () => <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)', margin: '12px 0' }} />,
  table: ({ children }) => (
    <div style={{ overflowX: 'auto', margin: '8px 0' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th style={{ border: '1px solid var(--color-border)', padding: '6px 10px', background: 'var(--color-surface-2)', textAlign: 'left', fontWeight: 700 }}>{children}</th>
  ),
  td: ({ children }) => (
    <td style={{ border: '1px solid var(--color-border)', padding: '6px 10px' }}>{children}</td>
  ),
}

function DiffBlock({
  filePath,
  oldString,
  newString,
  toolName,
}: {
  filePath: string
  oldString: string
  newString: string
  toolName: string
}): React.JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const label = toolName === 'Write' ? 'Write' : toolName === 'MultiEdit' ? 'MultiEdit' : 'Edit'
  const color = toolName === 'Write' ? 'var(--color-success)' : 'var(--color-accent)'

  return (
    <div
      style={{
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        fontSize: 12,
      }}
    >
      <button
        onClick={() => setExpanded((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: '100%',
          textAlign: 'left',
          padding: '8px 12px',
          background: 'var(--color-surface-2)',
          borderBottom: expanded ? '1px solid var(--color-border)' : 'none',
        }}
      >
        <span style={{ color, fontWeight: 700, fontSize: 11 }}>{label}</span>
        <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {filePath}
        </span>
        <span style={{ color: 'var(--color-text-muted)', fontSize: 10 }}>{expanded ? '▲' : '▼'}</span>
      </button>
      {expanded && (
        <div style={{ display: 'flex', maxHeight: 360, overflow: 'auto' }}>
          {oldString && (
            <pre
              style={{
                flex: 1,
                padding: '8px 12px',
                margin: 0,
                background: 'rgba(248, 113, 113, 0.08)',
                color: '#f87171',
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                borderRight: '1px solid var(--color-border)',
              }}
            >
              {oldString}
            </pre>
          )}
          <pre
            style={{
              flex: 1,
              padding: '8px 12px',
              margin: 0,
              background: 'rgba(61, 214, 140, 0.08)',
              color: '#3dd68c',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
            }}
          >
            {newString}
          </pre>
        </div>
      )}
    </div>
  )
}

function ThinkingBlock({ text }: { text: string }): React.JSX.Element {
  const [expanded, setExpanded] = useState(false)
  return (
    <div
      style={{
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        fontSize: 12,
      }}
    >
      <button
        onClick={() => setExpanded((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: '100%',
          textAlign: 'left',
          padding: '6px 12px',
          background: 'var(--color-surface-2)',
          color: 'var(--color-text-muted)',
          fontSize: 11,
        }}
      >
        <span>💭</span>
        <span>Thinking…</span>
        <span style={{ marginLeft: 'auto', fontSize: 10 }}>{expanded ? '▲' : '▼'}</span>
      </button>
      {expanded && (
        <pre
          style={{
            padding: '8px 12px',
            margin: 0,
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--color-text-muted)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
            maxHeight: 300,
            overflow: 'auto',
          }}
        >
          {text}
        </pre>
      )}
    </div>
  )
}

function buildAnswerContent(questions: AskQuestion[], selections: Record<number, string[]>, others: Record<number, string>): string {
  const parts = questions.map((q, i) => {
    const sel = selections[i] ?? []
    const finalAnswers = sel.map((s) => (s === '__other__' ? (others[i] ?? 'Other') : s))
    return `"${q.question}"="${finalAnswers.join(', ')}"`
  })
  return `User has answered your questions: ${parts.join(', ')}`
}

function AskBlock({
  toolUseId,
  questions,
  answered,
}: {
  toolUseId: string
  questions: AskQuestion[]
  answered?: boolean
}): React.JSX.Element {
  const sendToolResult = useChatStore((s) => s.sendToolResult)
  const [selections, setSelections] = useState<Record<number, string[]>>({})
  const [others, setOthers] = useState<Record<number, string>>({})

  function toggle(qi: number, label: string, multiSelect: boolean): void {
    setSelections((prev) => {
      const cur = prev[qi] ?? []
      if (multiSelect) {
        return { ...prev, [qi]: cur.includes(label) ? cur.filter((x) => x !== label) : [...cur, label] }
      }
      return { ...prev, [qi]: [label] }
    })
  }

  function submit(): void {
    const content = buildAnswerContent(questions, selections, others)
    sendToolResult(toolUseId, content)
  }

  const allAnswered = questions.every((_, i) => (selections[i]?.length ?? 0) > 0)

  return (
    <div style={{ padding: '4px 16px' }}>
      <div
        style={{
          background: 'var(--color-surface-2)',
          border: `1px solid ${answered ? 'var(--color-success)' : 'var(--color-accent)'}`,
          borderRadius: 'var(--radius-md)',
          padding: '12px 14px',
          maxWidth: '84%',
        }}
      >
        <div style={{ fontSize: 11, color: answered ? 'var(--color-success)' : 'var(--color-accent)', fontWeight: 700, marginBottom: 8 }}>
          {answered ? '✓ Answered' : 'Claude asked:'}
        </div>
        {questions.map((q, i) => {
          const cur = selections[i] ?? []
          return (
            <div key={i} style={{ marginBottom: i < questions.length - 1 ? 12 : 0 }}>
              {q.header && (
                <div style={{ fontSize: 10, color: 'var(--color-text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                  {q.header}
                </div>
              )}
              <div style={{ fontSize: 13, color: 'var(--color-text)', marginBottom: 8 }}>
                {q.question}
              </div>
              {q.options.length > 0 && !answered && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {q.options.map((opt, j) => {
                    const selected = cur.includes(opt.label)
                    return (
                      <button
                        key={j}
                        onClick={() => toggle(i, opt.label, q.multiSelect)}
                        title={opt.description}
                        style={{
                          fontSize: 11,
                          background: selected ? 'var(--color-accent)' : 'var(--color-accent-dim)',
                          color: selected ? '#fff' : 'var(--color-accent)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '3px 10px',
                          border: `1px solid ${selected ? 'var(--color-accent)' : 'transparent'}`,
                          cursor: 'pointer',
                        }}
                      >
                        {opt.label}
                      </button>
                    )
                  })}
                  <button
                    onClick={() => toggle(i, '__other__', q.multiSelect)}
                    style={{
                      fontSize: 11,
                      background: cur.includes('__other__') ? 'var(--color-accent)' : 'transparent',
                      color: cur.includes('__other__') ? '#fff' : 'var(--color-text-muted)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '3px 10px',
                      border: '1px solid var(--color-border)',
                      cursor: 'pointer',
                    }}
                  >
                    Other
                  </button>
                  {cur.includes('__other__') && (
                    <input
                      autoFocus
                      value={others[i] ?? ''}
                      onChange={(e) => setOthers((prev) => ({ ...prev, [i]: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === 'Enter' && allAnswered) submit() }}
                      placeholder="Type your answer…"
                      style={{
                        flex: 1,
                        fontSize: 11,
                        padding: '3px 8px',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--color-surface)',
                        color: 'var(--color-text)',
                        minWidth: 0,
                      }}
                    />
                  )}
                </div>
              )}
              {answered && cur.length > 0 && (
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                  {cur.map((s) => (s === '__other__' ? (others[i] ?? 'Other') : s)).join(', ')}
                </div>
              )}
            </div>
          )
        })}
        {!answered && (
          <button
            onClick={submit}
            disabled={!allAnswered}
            style={{
              marginTop: 10,
              fontSize: 11,
              padding: '4px 14px',
              background: allAnswered ? 'var(--color-accent)' : 'var(--color-surface-2)',
              color: allAnswered ? '#fff' : 'var(--color-text-muted)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-border)',
              cursor: allAnswered ? 'pointer' : 'default',
            }}
          >
            Submit
          </button>
        )}
      </div>
    </div>
  )
}

function CopyButton({ text, light = false }: { text: string; light?: boolean }): React.JSX.Element {
  const [copied, setCopied] = useState(false)
  function copy(): void {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }
  return (
    <button
      onClick={copy}
      title="Copy message"
      style={{
        fontSize: 10,
        padding: '2px 8px',
        border: `1px solid ${light ? 'rgba(255,255,255,0.3)' : 'var(--color-border)'}`,
        borderRadius: 'var(--radius-sm)',
        background: 'transparent',
        color: copied
          ? (light ? '#a8f0c8' : 'var(--color-success)')
          : (light ? 'rgba(255,255,255,0.6)' : 'var(--color-text-muted)'),
        cursor: 'pointer',
        flexShrink: 0,
        lineHeight: 1.4,
      }}
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  )
}

export function MessageBubble({ msg }: { msg: UIMessage }): React.JSX.Element | null {
  switch (msg.type) {
    case 'user':
      return (
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '4px 16px', gap: 6, alignItems: 'flex-end' }}>
          {msg.text && <CopyButton text={msg.text} light />}
          <div
            style={{
              maxWidth: '72%',
              background: 'var(--color-accent)',
              color: '#fff',
              borderRadius: 'var(--radius-lg)',
              padding: '10px 14px',
              fontSize: 13,
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {msg.attachments && msg.attachments.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: msg.text ? 8 : 0 }}>
                {msg.attachments.map((att, i) => (
                  <img
                    key={i}
                    src={att.dataUrl}
                    alt={att.name}
                    style={{
                      height: 80,
                      width: 80,
                      objectFit: 'cover',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid rgba(255,255,255,0.3)',
                    }}
                  />
                ))}
              </div>
            )}
            {msg.text}
          </div>
        </div>
      )

    case 'text':
      return (
        <div style={{ padding: '4px 16px' }}>
          <div
            style={{
              maxWidth: '84%',
              fontSize: 13,
              color: 'var(--color-text)',
              wordBreak: 'break-word',
            }}
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
              {msg.text}
            </ReactMarkdown>
            {msg.streaming && (
              <span
                style={{
                  display: 'inline-block',
                  width: 8,
                  height: 14,
                  background: 'var(--color-accent)',
                  marginLeft: 2,
                  verticalAlign: 'text-bottom',
                  animation: 'blink 1s step-end infinite',
                }}
              />
            )}
          </div>
          {!msg.streaming && <div style={{ marginTop: 4 }}><CopyButton text={msg.text} /></div>}
        </div>
      )

    case 'thinking':
      return (
        <div style={{ padding: '4px 16px' }}>
          <ThinkingBlock text={msg.text} />
        </div>
      )

    case 'tool_call':
      return (
        <div style={{ padding: '4px 16px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: 'var(--color-surface-2)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: '6px 12px',
              fontSize: 12,
            }}
          >
            <span style={{ color: 'var(--color-accent)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
              {msg.toolName}
            </span>
            {msg.inputSummary && (
              <span style={{ color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 360 }}>
                {msg.inputSummary}
              </span>
            )}
          </div>
        </div>
      )

    case 'diff':
      return (
        <div style={{ padding: '4px 16px' }}>
          <DiffBlock
            filePath={msg.filePath}
            oldString={msg.oldString}
            newString={msg.newString}
            toolName={msg.toolName}
          />
        </div>
      )

    case 'ask':
      return <AskBlock toolUseId={msg.toolUseId} questions={msg.questions} answered={msg.answered} />

    case 'plan':
      return (
        <div style={{ padding: '4px 16px' }}>
          <div
            style={{
              background: 'var(--color-surface-2)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: '10px 14px',
              maxWidth: '84%',
            }}
          >
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 700, marginBottom: 6 }}>
              📋 Todo List
            </div>
            <pre
              style={{
                margin: 0,
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                color: 'var(--color-text)',
                whiteSpace: 'pre-wrap',
                lineHeight: 1.8,
              }}
            >
              {msg.plan}
            </pre>
          </div>
        </div>
      )

    case 'error':
      return (
        <div style={{ padding: '4px 16px' }}>
          <div
            style={{
              background: 'rgba(248, 113, 113, 0.1)',
              border: '1px solid var(--color-danger)',
              borderRadius: 'var(--radius-md)',
              padding: '10px 14px',
              fontSize: 12,
              color: 'var(--color-danger)',
              fontFamily: 'var(--font-mono)',
              maxWidth: '84%',
            }}
          >
            ⚠ {msg.text}
          </div>
        </div>
      )

    case 'compact_boundary':
      return (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '8px 16px',
          }}
        >
          <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
          <span style={{ fontSize: 10, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>context compacted</span>
          <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
        </div>
      )

    case 'done':
      return (
        <div style={{ padding: '4px 16px' }}>
          <div
            style={{
              display: 'inline-flex',
              gap: 16,
              background: 'var(--color-surface-2)',
              borderRadius: 'var(--radius-md)',
              padding: '8px 14px',
              fontSize: 11,
              color: 'var(--color-text-muted)',
            }}
          >
            <span>✓ Done</span>
            {msg.costUsd > 0 && (
              <span style={{ color: 'var(--color-accent)' }}>${msg.costUsd.toFixed(4)}</span>
            )}
            <span>↑ {msg.inputTokens.toLocaleString()}</span>
            <span>↓ {msg.outputTokens.toLocaleString()}</span>
          </div>
        </div>
      )

    default:
      return null
  }
}
