import React, { useEffect, useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useTranslation } from 'react-i18next'
import type { SkillInfo, SkillSource } from '../../../electron/shared/types'
import { cn } from '@renderer/lib/utils'

const SOURCE_ORDER: SkillSource[] = ['plugin', 'userSettings']

const SOURCE_LABELS: Record<SkillSource, string> = {
  plugin: 'skills.sourcePlugin',
  userSettings: 'skills.sourceUser',
}

const SOURCE_SUBTITLES: Record<SkillSource, string> = {
  plugin: 'skills.sourcePluginSubtitle',
  userSettings: '~/.claude/skills',
}

export function SkillSettings(): React.JSX.Element {
  const { t } = useTranslation('settings')
  const [skills, setSkills] = useState<SkillInfo[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showInstallModal, setShowInstallModal] = useState(false)
  const [installUrl, setInstallUrl] = useState('')
  const [isInstalling, setIsInstalling] = useState(false)
  const [selectedSkill, setSelectedSkill] = useState<SkillInfo | null>(null)
  const [skillContent, setSkillContent] = useState<string | null>(null)
  const [contentLoading, setContentLoading] = useState(false)

  const fetchSkills = async () => {
    setIsLoading(true)
    try {
      const result = await window.electron.listSkills()
      setSkills(result.skills)
    } catch (err) {
      console.error('Failed to fetch skills:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void fetchSkills()
  }, [])

  const grouped = useMemo(() => {
    const groups = new Map<SkillSource, SkillInfo[]>()
    for (const skill of skills) {
      const group = groups.get(skill.source) ?? []
      group.push(skill)
      groups.set(skill.source, group)
    }
    return groups
  }, [skills])

  const handleSelect = async (skill: SkillInfo) => {
    setSelectedSkill(skill)
    setSkillContent(null)
    setContentLoading(true)
    try {
      const result = await window.electron.getSkillContent(skill.path)
      setSkillContent(result.content)
    } catch (err) {
      console.error('Failed to load skill content:', err)
    } finally {
      setContentLoading(false)
    }
  }

  const handleInstall = async () => {
    if (!installUrl.trim()) return
    setIsInstalling(true)
    try {
      const result = await window.electron.installSkillFromGit(installUrl.trim())
      if (result.success) {
        setInstallUrl('')
        setShowInstallModal(false)
        await fetchSkills()
      } else {
        alert(result.error ?? 'Failed to install skill')
      }
    } catch (err) {
      console.error('Failed to install skill:', err)
    } finally {
      setIsInstalling(false)
    }
  }

  const handleDelete = async (skill: SkillInfo) => {
    try {
      await window.electron.deleteSkill(skill.id)
      await fetchSkills()
      if (selectedSkill?.id === skill.id) {
        setSelectedSkill(null)
        setSkillContent(null)
      }
    } catch (err) {
      console.error('Failed to delete skill:', err)
    }
  }

  const handleToggle = async (skill: SkillInfo) => {
    try {
      await window.electron.toggleSkill(skill.id, !skill.enabled)
      const updated = { ...skill, enabled: !skill.enabled }
      setSkills((prev) => prev.map((s) => s.id === skill.id && s.source === skill.source ? updated : s))
      if (selectedSkill?.id === skill.id) setSelectedSkill(updated)
    } catch (err) {
      console.error('Failed to toggle skill:', err)
    }
  }

  if (isLoading) {
    return <div className="p-6 text-[13px] text-[var(--color-text-muted)]">Loading skills...</div>
  }

  return (
    <div className="flex h-[calc(100vh-120px)] min-h-[500px] overflow-hidden rounded-[10px] border border-[var(--color-border)]">
      {/* ── Left panel: skill list ── */}
      <div className="flex w-[260px] flex-shrink-0 flex-col overflow-hidden border-r border-[var(--color-border)]">
        {/* Header */}
        <div className="flex flex-shrink-0 items-center justify-between border-b border-[var(--color-border)] px-4 pb-3 pt-4">
          <div>
            <div className="text-[13px] font-bold text-[var(--color-text)]">{t('skills.title')}</div>
            <div className="mt-px text-[11px] text-[var(--color-text-muted)]">{t('skills.countPrefix')} {skills.length} {t('skills.count')}</div>
          </div>
          <button
            onClick={() => setShowInstallModal(true)}
            className="cursor-pointer rounded-[var(--radius-sm)] border border-[var(--color-accent)] bg-[var(--color-accent)] px-[10px] py-1 text-[11px] text-white"
          >
            + {t('skills.install')}
          </button>
        </div>

        {/* Grouped list */}
        <div className="flex-1 overflow-y-auto py-2">
          {skills.length === 0 && (
            <div className="px-4 py-6 text-center text-[12px] text-[var(--color-text-muted)]">
              {t('skills.empty')}
            </div>
          )}

          {SOURCE_ORDER.filter((s) => grouped.has(s)).map((source) => {
            const items = grouped.get(source)!
            const isPlugin = source === 'plugin'
            const pluginNames = isPlugin
              ? [...new Set(items.map((s) => s.plugin).filter(Boolean))]
              : []
            const title = isPlugin && pluginNames.length === 1
              ? `${t('plugins.plugin')}: ${pluginNames[0]}`
              : t(SOURCE_LABELS[source] as string)
            const subtitle = isPlugin && pluginNames.length === 1
              ? undefined
              : t(SOURCE_SUBTITLES[source] as string)

            return (
              <div key={source} className="mb-1">
                {/* Group header */}
                <div className="flex items-baseline gap-1 px-4 pb-1 pt-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--color-text-muted)]">
                    {title}
                  </span>
                  <span className="text-[10px] text-[var(--color-text-muted)] opacity-70">
                    ({items.length})
                  </span>
                </div>
                {subtitle && (
                  <div className="px-4 pb-1 text-[10px] text-[var(--color-text-muted)] opacity-60">
                    {subtitle}
                  </div>
                )}

                {/* Skill rows */}
                {items.map((skill) => {
                  const isSelected = selectedSkill?.id === skill.id && selectedSkill?.source === skill.source
                  return (
                    <div
                      key={skill.path}
                      onClick={() => handleSelect(skill)}
                      className={cn(
                        'flex cursor-pointer items-center gap-2 px-4 py-1.5 border-l-2 transition-colors',
                        isSelected
                          ? 'bg-[var(--color-accent-dim)] border-l-[var(--color-accent)]'
                          : 'bg-transparent border-l-transparent hover:bg-[var(--color-surface-2)]'
                      )}
                    >
                      <span
                        className={cn('h-1.5 w-1.5 flex-shrink-0 rounded-full', skill.enabled ? 'bg-[var(--color-success)]' : 'bg-[var(--color-text-muted)] opacity-50')}
                      />
                      <span
                        className={cn('flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[12px]', isSelected ? 'text-[var(--color-accent)] font-semibold' : 'text-[var(--color-text)] font-normal')}
                      >
                        {skill.name}
                      </span>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Right panel: detail + markdown preview ── */}
      <div className="flex flex-1 flex-col overflow-y-auto">
        {selectedSkill ? (
          <SkillDetail
            skill={selectedSkill}
            content={skillContent}
            contentLoading={contentLoading}
            onToggle={() => handleToggle(selectedSkill)}
            onDelete={() => handleDelete(selectedSkill)}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center text-[13px] text-[var(--color-text-muted)]">
            {t('skills.selectToView')}
          </div>
        )}
      </div>

      {/* ── Install modal ── */}
      {showInstallModal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50">
          <div className="w-full max-w-[480px] rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
            <div className="mb-4 text-[14px] font-bold text-[var(--color-text)]">{t('skills.installTitle')}</div>
            <div className="mb-4">
              <div className="mb-1 text-[12px] font-semibold text-[var(--color-text)]">{t('skills.gitUrlLabel')}</div>
              <input
                value={installUrl}
                onChange={(e) => setInstallUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void handleInstall() }}
                className="box-border w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-[10px] py-[6px] text-[12px] text-[var(--color-text)]"
                placeholder="https://github.com/..."
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setShowInstallModal(false); setInstallUrl('') }}
                className="cursor-pointer rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-transparent px-4 py-1.5 text-[12px] text-[var(--color-text-muted)]"
              >
                {t('skills.cancel')}
              </button>
              <button
                onClick={() => void handleInstall()}
                disabled={!installUrl.trim() || isInstalling}
                className={cn('cursor-pointer rounded-[var(--radius-sm)] border border-[var(--color-accent)] bg-[var(--color-accent)] px-4 py-1.5 text-[12px] text-white', (!installUrl.trim() || isInstalling) && 'opacity-50')}
              >
                {isInstalling ? t('skills.installing') : t('skills.installBtn')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Skill Detail ─────────────────────────────────────────────

function SkillDetail({
  skill,
  content,
  contentLoading,
  onToggle,
  onDelete,
}: {
  skill: SkillInfo
  content: string | null
  contentLoading: boolean
  onToggle: () => void
  onDelete: () => void
}) {
  const { t } = useTranslation('settings')
  const isPlugin = skill.source === 'plugin'

  return (
    <div className="flex flex-1 flex-col px-7 py-6">
      {/* Title row */}
      <div className="mb-4 flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[18px] font-bold leading-[1.2] text-[var(--color-text)]">
            {skill.name}
          </div>
          <div className="mt-1 break-all text-[11px] text-[var(--color-text-muted)]">
            {isPlugin && skill.plugin ? (
              <span className="mr-1.5 rounded-[3px] border border-[var(--color-border)] px-[5px] py-px text-[9px] font-bold uppercase tracking-[0.04em] text-[var(--color-text-muted)]">
                {skill.plugin}
              </span>
            ) : null}
            {skill.path}
          </div>
        </div>

        {!isPlugin && (
          <div className="mt-0.5 flex flex-shrink-0 gap-1.5">
            <button
              onClick={onToggle}
              className={cn(
                'cursor-pointer rounded-[var(--radius-sm)] px-3 py-1 text-[11px] border',
                skill.enabled
                  ? 'border-[var(--color-accent)] text-[var(--color-accent)] bg-[var(--color-accent-dim)]'
                  : 'border-[var(--color-border)] text-[var(--color-text-muted)] bg-transparent'
              )}
            >
              {skill.enabled ? t('skills.disable') : t('skills.enable')}
            </button>
            <button
              onClick={onDelete}
              className="cursor-pointer rounded-[var(--radius-sm)] border border-[var(--color-danger)] bg-transparent px-3 py-1 text-[11px] text-[var(--color-danger)]"
            >
              {t('skills.delete')}
            </button>
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="mb-5 h-px bg-[var(--color-border)]" />

      {/* Markdown preview */}
      {contentLoading && (
        <div className="text-[12px] text-[var(--color-text-muted)]">{t('skills.loading')}</div>
      )}

      {!contentLoading && content && (
        <div className="text-[13px] leading-[1.7] text-[var(--color-text)]">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h1: ({ children }) => (
                <h1 className="mb-3 mt-5 border-b border-[var(--color-border)] pb-2 text-[18px] font-bold text-[var(--color-text)]">{children}</h1>
              ),
              h2: ({ children }) => (
                <h2 className="mb-2.5 mt-[18px] text-[15px] font-bold text-[var(--color-text)]">{children}</h2>
              ),
              h3: ({ children }) => (
                <h3 className="mb-2 mt-3.5 text-[13px] font-bold text-[var(--color-text)]">{children}</h3>
              ),
              p: ({ children }) => (
                <p className="mb-2.5 mt-0">{children}</p>
              ),
              ul: ({ children }) => (
                <ul className="mb-2.5 mt-1 pl-5">{children}</ul>
              ),
              ol: ({ children }) => (
                <ol className="mb-2.5 mt-1 pl-5">{children}</ol>
              ),
              li: ({ children }) => (
                <li className="mb-[3px]">{children}</li>
              ),
              code: ({ children, className }) => {
                const isBlock = className?.startsWith('language-')
                if (isBlock) {
                  return (
                    <code className="block overflow-x-auto whitespace-pre rounded-[6px] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-[14px] py-3 font-mono text-[11px] text-[var(--color-text)]">{children}</code>
                  )
                }
                return (
                  <code className="rounded-[3px] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-[5px] py-px font-mono text-[0.9em] text-[var(--color-text)]">{children}</code>
                )
              },
              pre: ({ children }) => (
                <pre className="mb-3 mt-1">{children}</pre>
              ),
              blockquote: ({ children }) => (
                <blockquote className="my-2.5 border-l-[3px] border-[var(--color-accent)] pl-3 italic text-[var(--color-text-muted)]">{children}</blockquote>
              ),
              hr: () => (
                <hr className="my-4 border-none border-t border-[var(--color-border)]" />
              ),
              a: ({ children, href }) => (
                <a href={href} className="text-[var(--color-accent)] no-underline">{children}</a>
              ),
              strong: ({ children }) => (
                <strong className="font-bold text-[var(--color-text)]">{children}</strong>
              ),
              table: ({ children }) => (
                <table className="mb-3 w-full border-collapse text-[12px]">{children}</table>
              ),
              th: ({ children }) => (
                <th className="border-b border-[var(--color-border)] px-2.5 py-1.5 text-left text-[11px] font-bold uppercase tracking-[0.04em] text-[var(--color-text-muted)]">{children}</th>
              ),
              td: ({ children }) => (
                <td className="border-b border-[var(--color-border)] px-2.5 py-1.5">{children}</td>
              ),
            }}
          >
            {content}
          </ReactMarkdown>
        </div>
      )}

      {!contentLoading && !content && (
        <div className="text-[12px] text-[var(--color-text-muted)]">
          {t('skills.noSkillMd')}
        </div>
      )}
    </div>
  )
}
