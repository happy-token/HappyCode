import React, { useState, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import hljs from 'highlight.js'
import 'highlight.js/styles/github-dark.css'
import { Copy, ChevronDown, ChevronUp, ListTodo, Check, Database, AlertTriangle, ArrowUp, ArrowDown } from 'lucide-react'
import type { UIMessage, AskQuestion } from '../../../electron/shared/types'
import { useTabStore } from '../../store/tab-store'
import { parseAllShowWidgets } from '../widgets/widget-parser'
import { WidgetRenderer } from '../widgets/WidgetRenderer'
import { cn } from '@renderer/lib/utils'

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
    <div className="my-2 overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)] text-xs">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-1">
        <span className="font-mono text-[10px] text-[var(--color-text-muted)]">
          {language || 'code'}
        </span>
        <button
          onClick={copy}
          className={cn(
            'cursor-pointer rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-transparent px-2 py-px text-[10px]',
            copied ? 'text-[var(--color-success)]' : 'text-[var(--color-text-muted)]'
          )}
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <pre className="m-0 overflow-auto px-[14px] py-[10px] font-mono leading-[1.6]" style={{ background: 'var(--color-code-bg)' }}>
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
    <p className="mb-[10px] leading-[1.7]">{children}</p>
  ),
  h1: ({ children }) => (
    <h1 className="mb-2 mt-[14px] text-[18px] font-bold text-[var(--color-text)]">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-1.5 mt-3 text-[15px] font-bold text-[var(--color-text)]">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-1 mt-[10px] text-[13px] font-bold text-[var(--color-text)]">{children}</h3>
  ),
  ul: ({ children }) => (
    <ul className="mb-[10px] pl-5 leading-[1.7]">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-[10px] pl-5 leading-[1.7]">{children}</ol>
  ),
  li: ({ children }) => <li className="mb-0.5">{children}</li>,
  strong: ({ children }) => (
    <strong className="font-bold text-[var(--color-text)]">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-[3px] border-[var(--color-accent)] pl-3 italic text-[var(--color-text-muted)]">
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
        className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-[5px] py-px font-mono text-[0.9em] text-[var(--color-accent)]"
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
      className="text-[var(--color-accent)] underline"
      onClick={(e) => { e.preventDefault(); if (href && /^https?:\/\//.test(href)) window.open(href) }}
    >
      {children}
    </a>
  ),
  hr: () => <hr className="my-3 border-0 border-t border-[var(--color-border)]" />,
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto">
      <table className="w-full border-collapse text-xs">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-[var(--color-border)] bg-[var(--color-surface-2)] px-[10px] py-[6px] text-left font-bold">{children}</th>
  ),
  td: ({ children }) => (
    <td className="border border-[var(--color-border)] px-[10px] py-[6px]">{children}</td>
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
    <div className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)] text-xs">
      <button
        onClick={() => setExpanded((v) => !v)}
        className={cn(
          'flex w-full items-center gap-2 bg-[var(--color-surface-2)] px-3 py-2 text-left',
          expanded && 'border-b border-[var(--color-border)]'
        )}
      >
        <span className={cn('flex-shrink-0 text-[11px] font-bold', color === 'var(--color-success)' ? 'text-[var(--color-success)]' : 'text-[var(--color-accent)]')}>{label}</span>
        <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[var(--color-text-muted)]">
          {filePath}
        </span>
        {expanded ? <ChevronUp size={10} className="flex-shrink-0 text-[var(--color-text-muted)]" /> : <ChevronDown size={10} className="flex-shrink-0 text-[var(--color-text-muted)]" />}
      </button>
      {expanded && (
        <div className="flex max-h-[360px] overflow-auto">
          {oldString && (
            <pre
              className="m-0 flex-1 whitespace-pre-wrap break-all border-r border-[var(--color-border)] px-3 py-2 font-mono text-[11px] text-[var(--color-danger)] bg-[rgba(239,68,68,0.06)]"
            >
              {oldString}
            </pre>
          )}
          <pre
            className="m-0 flex-1 whitespace-pre-wrap break-all px-3 py-2 font-mono text-[11px]" style={{ color: 'var(--color-success)', background: 'rgba(61,214,140,0.08)' }}
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
    <div className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)] text-xs">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2 bg-[var(--color-surface-2)] px-3 py-1.5 text-left text-[11px] text-[var(--color-text-muted)]"
      >
        <span>💭</span>
        <span>Thinking…</span>
        {expanded ? <ChevronUp size={10} className="ml-auto" /> : <ChevronDown size={10} className="ml-auto" />}
      </button>
      {expanded && (
        <pre className="m-0 max-h-[300px] overflow-auto whitespace-pre-wrap break-all px-3 py-2 font-mono text-[11px] text-[var(--color-text-muted)]">
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
  const sendToolResult = useTabStore((s) => s.sendToolResult)
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

  async function submit(): Promise<void> {
    const content = buildAnswerContent(questions, selections, others)
    try {
      await sendToolResult(toolUseId, content)
    } catch (err) {
      console.error('[AskBlock] Failed to submit tool result:', err)
    }
  }

  const allAnswered = questions.every((_, i) => (selections[i]?.length ?? 0) > 0)

  return (
    <div className="px-4 py-1">
      <div
        className={cn(
          'max-w-[84%] rounded-[var(--radius-md)] bg-[var(--color-surface-2)] p-[12px_14px]',
          answered ? 'border border-[var(--color-success)]' : 'border border-[var(--color-accent)]'
        )}
      >
        <div className={cn('mb-2 text-[11px] font-bold', answered ? 'text-[var(--color-success)]' : 'text-[var(--color-accent)]')}>
          {answered ? <span className="inline-flex items-center gap-1"><Check size={11} />Answered</span> : 'Claude asked:'}
        </div>
        {questions.map((q, i) => {
          const cur = selections[i] ?? []
          return (
            <div key={i} className={cn(i < questions.length - 1 && 'mb-3')}>
              {q.header && (
                <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.05em] text-[var(--color-text-muted)]">
                  {q.header}
                </div>
              )}
              <div className="mb-2 text-[13px] text-[var(--color-text)]">
                {q.question}
              </div>
              {q.options.length > 0 && !answered && (
                <div className="flex flex-wrap gap-[6px]">
                  {q.options.map((opt, j) => {
                    const selected = cur.includes(opt.label)
                    return (
                      <button
                        key={j}
                        onClick={() => toggle(i, opt.label, q.multiSelect)}
                        title={opt.description}
                        className={cn(
                          'cursor-pointer rounded-[var(--radius-sm)] px-[10px] py-[3px] text-[11px]',
                          selected
                            ? 'border border-[var(--color-accent)] bg-[var(--color-accent)] text-white'
                            : 'border border-transparent bg-[var(--color-accent-dim)] text-[var(--color-accent)]'
                        )}
                      >
                        {opt.label}
                      </button>
                    )
                  })}
                  <button
                    onClick={() => toggle(i, '__other__', q.multiSelect)}
                    className={cn(
                      'cursor-pointer rounded-[var(--radius-sm)] border border-[var(--color-border)] px-[10px] py-[3px] text-[11px]',
                      cur.includes('__other__')
                        ? 'bg-[var(--color-accent)] text-white'
                        : 'bg-transparent text-[var(--color-text-muted)]'
                    )}
                  >
                    Other
                  </button>
                  {cur.includes('__other__') && (
                    <input
                      autoFocus
                      value={others[i] ?? ''}
                      onChange={(e) => setOthers((prev) => ({ ...prev, [i]: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === 'Enter' && allAnswered) void submit() }}
                      placeholder="Type your answer…"
                      className="min-w-0 flex-1 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-[3px] text-[11px] text-[var(--color-text)] outline-none"
                    />
                  )}
                </div>
              )}
              {answered && cur.length > 0 && (
                <div className="text-[11px] text-[var(--color-text-muted)]">
                  {cur.map((s) => (s === '__other__' ? (others[i] ?? 'Other') : s)).join(', ')}
                </div>
              )}
            </div>
          )
        })}
        {!answered && (
          <button
            onClick={() => void submit()}
            disabled={!allAnswered}
            className={cn(
              'mt-[10px] rounded-[var(--radius-sm)] border border-[var(--color-border)] px-[14px] py-1 text-[11px]',
              allAnswered
                ? 'cursor-pointer bg-[var(--color-accent)] text-white'
                : 'cursor-default bg-[var(--color-surface-2)] text-[var(--color-text-muted)]'
            )}
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
      className={cn(
        'flex-shrink-0 cursor-pointer rounded-[var(--radius-sm)] bg-transparent px-2 py-[2px] text-[10px] leading-[1.4]',
        light
          ? cn('border border-[rgba(255,255,255,0.3)]', copied ? 'text-[#a8f0c8]' : 'text-[rgba(255,255,255,0.6)]')
          : cn('border border-[var(--color-border)]', copied ? 'text-[var(--color-success)]' : 'text-[var(--color-text-muted)]')
      )}
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  )
}

type DoneInfo = { inputTokens: number; outputTokens: number; costUsd: number; cacheReadTokens?: number }

function AssistantTextBubble({ msg, doneInfo }: { msg: Extract<UIMessage, { type: 'text' }>; doneInfo?: DoneInfo }): React.JSX.Element {
  const [hovered, setHovered] = useState(false)
  const [copied, setCopied] = useState(false)

  const widgets = useMemo(() => parseAllShowWidgets(msg.text), [msg.text])
  const cleanContent = widgets.length > 0
    ? msg.text.replace(/```show-widget\s*\n[\s\S]*?```/g, '').trim()
    : msg.text

  function copy(): void {
    void navigator.clipboard.writeText(msg.text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  const cacheHitPct = doneInfo && (doneInfo.cacheReadTokens ?? 0) > 0
    ? Math.round((doneInfo.cacheReadTokens ?? 0) / ((doneInfo.inputTokens + (doneInfo.cacheReadTokens ?? 0)) || 1) * 100)
    : null

  return (
    <div
      className="relative py-1.5"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {widgets.length > 0 && (
        <div className="my-2 flex flex-col gap-3">
          {widgets.map((widget, i) => (
            <WidgetRenderer key={i} config={widget} />
          ))}
        </div>
      )}
      <div className="whitespace-pre-wrap text-[13px] leading-[1.65] text-[var(--color-text)]">
        {cleanContent && (
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
            {cleanContent}
          </ReactMarkdown>
        )}
        {msg.streaming && (
          <span className="ml-0.5 inline-block h-[14px] w-2 animate-[blink_1s_step-end_infinite] align-text-bottom bg-[var(--color-accent)]" />
        )}
      </div>
      {!msg.streaming && (hovered || copied) && (
        <div
          className="absolute bottom-0 right-0 inline-flex items-center gap-[6px] rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-[2px] font-mono text-[10px] text-[var(--color-text-muted)] shadow-[0_1px_6px_rgba(0,0,0,0.12)]"
        >
          {doneInfo && (
            <>
              <span title="Input tokens" className="inline-flex items-center gap-[2px]"><ArrowUp size={9} />{doneInfo.inputTokens.toLocaleString()}</span>
              <span title="Output tokens" className="inline-flex items-center gap-[2px]"><ArrowDown size={9} />{doneInfo.outputTokens.toLocaleString()}</span>
              {cacheHitPct !== null && (
                <span className="inline-flex items-center gap-[2px] text-[var(--color-success)]" title="Cache hit rate">
                  <Database size={9} />{cacheHitPct}%
                </span>
              )}
              <span className="inline-block h-[10px] w-px flex-shrink-0 bg-[var(--color-border)]" />
            </>
          )}
          <button
            onClick={copy}
            title="Copy message"
            className={cn(
              'flex cursor-pointer items-center gap-[3px] border-0 bg-transparent p-[1px_2px] text-[10px] leading-none',
              copied ? 'text-[var(--color-success)]' : 'text-[var(--color-text-muted)]'
            )}
          >
            <Copy size={10} />
            {copied && <span>Copied</span>}
          </button>
        </div>
      )}
    </div>
  )
}

function ToolCallBubble({ msg }: { msg: Extract<UIMessage, { type: 'tool_call' }> }): React.JSX.Element {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="py-px">
      <button
        onClick={() => setExpanded((v) => !v)}
        className={cn(
          'inline-flex max-w-full items-center gap-[5px] py-[3px] text-left text-xs text-[var(--color-text-muted)]',
          msg.fullInput ? 'cursor-pointer' : 'cursor-default'
        )}
      >
        <span className="flex-shrink-0 text-[10px] text-[var(--color-text-faint)]">›</span>
        <span className="flex-shrink-0 font-mono font-semibold text-[var(--color-accent)]">
          {msg.toolName}
        </span>
        {msg.inputSummary && (
          <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[var(--color-text-faint)]">
            {msg.inputSummary}
          </span>
        )}
        {msg.fullInput && (
          expanded
            ? <ChevronUp size={10} className="ml-0.5 flex-shrink-0 text-[var(--color-text-faint)]" />
            : <ChevronDown size={10} className="ml-0.5 flex-shrink-0 text-[var(--color-text-faint)]" />
        )}
      </button>
      {expanded && msg.fullInput && (
        <pre className="mb-1 ml-3 mt-0.5 max-h-[260px] overflow-auto whitespace-pre-wrap break-all rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-[10px] py-[6px] font-mono text-[11px] text-[var(--color-text-muted)]">
          {msg.fullInput}
        </pre>
      )}
    </div>
  )
}

function UserMessageBubble({ msg }: { msg: Extract<UIMessage, { type: 'user' }> }): React.JSX.Element {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      className="flex flex-row-reverse items-center gap-[6px] py-1.5"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="w-fit max-w-[80%] whitespace-pre-wrap rounded-[18px] bg-[var(--color-accent)] px-[14px] py-[7px] text-left text-[13px] leading-[1.55] text-white">
        {msg.attachments && msg.attachments.length > 0 && (
          <div className={cn('flex flex-wrap gap-[6px]', msg.text && 'mb-2')}>
            {msg.attachments.map((att, i) => (
              <img
                key={i}
                src={att.dataUrl}
                alt={att.name}
                className="h-20 w-20 rounded-[var(--radius-sm)] border border-[rgba(255,255,255,0.3)] object-cover"
              />
            ))}
          </div>
        )}
        {msg.text}
      </div>
      {msg.text && (
        <div className={cn('transition-opacity duration-100', hovered ? 'opacity-100' : 'opacity-0 pointer-events-none')}>
          <CopyButton text={msg.text} light />
        </div>
      )}
    </div>
  )
}

export function MessageBubble({ msg, doneInfo }: { msg: UIMessage; doneInfo?: DoneInfo }): React.JSX.Element | null {
  switch (msg.type) {
    case 'user':
      return <UserMessageBubble msg={msg} />

    case 'text':
      return <AssistantTextBubble msg={msg} doneInfo={doneInfo} />

    case 'thinking':
      return (
        <div className="px-4 py-1">
          <ThinkingBlock text={msg.text} />
        </div>
      )

    case 'tool_call':
      return (
        <div>
          <ToolCallBubble msg={msg} />
        </div>
      )

    case 'diff':
      return (
        <div className="px-4 py-1">
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
        <div className="px-4 py-1">
          <div className="max-w-[84%] rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-[14px] py-[10px]">
            <div className="mb-1.5 flex items-center gap-[5px] text-[11px] font-bold text-[var(--color-text-muted)]">
              <ListTodo size={11} />
              Todo List
            </div>
            <pre className="m-0 whitespace-pre-wrap font-mono text-[11px] leading-[1.8] text-[var(--color-text)]">
              {msg.plan}
            </pre>
          </div>
        </div>
      )

    case 'error':
      return (
        <div className="flex justify-center px-4 py-1">
          <div
            className="max-w-[85%] rounded-[20px] px-[14px] py-1 text-center font-mono text-[11px] text-[var(--color-danger)] bg-[rgba(248,113,113,0.10)] border border-[rgba(248,113,113,0.25)]"
          >
            <AlertTriangle size={11} className="inline mr-1" />{msg.text}
          </div>
        </div>
      )

    case 'compact_boundary':
      return (
        <div className="flex justify-center px-4 py-1.5">
          <span
            className="rounded-[20px] px-3 py-[3px] text-[10px] text-[var(--color-text-muted)] bg-[rgba(107,114,128,0.08)] border border-[rgba(107,114,128,0.15)]"
          >
            context compacted
          </span>
        </div>
      )

    case 'done':
      return null

    default:
      return null
  }
}
