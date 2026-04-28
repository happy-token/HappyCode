import React, { useEffect, useState, useCallback } from 'react'
import { X, Check, ChevronDown, ChevronUp, Zap, Plus, Download } from 'lucide-react'
import type { SkillInfo, PluginInfo, PluginReadmeResult } from '../../../electron/shared/types'
import { BUILT_IN_SKILLS } from '../../../electron/shared/types'
import { cn } from '@renderer/lib/utils'

type Tab = 'skills' | 'plugins'

const inputCls = 'text-[11px] px-2 py-1 border border-[var(--color-border)] rounded-[var(--radius-sm)] bg-[var(--color-surface-2)] text-[var(--color-text)]'

export function SkillsPanel(): React.JSX.Element {
  const [tab, setTab] = useState<Tab>('skills')
  const [skills, setSkills] = useState<SkillInfo[]>([])
  const [plugins, setPlugins] = useState<PluginInfo[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [previewContent, setPreviewContent] = useState<string>('')
  const [selectedPlugin, setSelectedPlugin] = useState<string | null>(null)
  const [pluginReadme, setPluginReadme] = useState<PluginReadmeResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [installUrl, setInstallUrl] = useState('')
  const [installName, setInstallName] = useState('')
  const [installing, setInstalling] = useState(false)
  const [installError, setInstallError] = useState<string | null>(null)
  const [pluginInstallName, setPluginInstallName] = useState('')
  const [showBuiltIn, setShowBuiltIn] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const loadSkills = useCallback(async () => {
    setLoading(true)
    try {
      const result = await window.electron.listSkills()
      setSkills(result.skills)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadPlugins = useCallback(async () => {
    setLoading(true)
    try {
      const result = await window.electron.listPlugins()
      setPlugins(result.plugins)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadSkills()
  }, [loadSkills])

  useEffect(() => {
    if (tab === 'plugins') void loadPlugins()
  }, [tab, loadPlugins])

  async function handleSelectSkill(skillId: string): Promise<void> {
    setSelected(skillId)
    const { content } = await window.electron.getSkillContent(skillId)
    setPreviewContent(content)
  }

  async function handleToggle(skillId: string, enabled: boolean): Promise<void> {
    await window.electron.toggleSkill(skillId, enabled)
    setSkills((prev) => prev.map((s) => s.id === skillId ? { ...s, enabled } : s))
  }

  async function handleDelete(skillId: string): Promise<void> {
    if (!confirm(`Delete skill "${skillId}"?`)) return
    await window.electron.deleteSkill(skillId)
    setSkills((prev) => prev.filter((s) => s.id !== skillId))
    if (selected === skillId) { setSelected(null); setPreviewContent('') }
  }

  async function handleInstall(): Promise<void> {
    if (!installUrl.trim()) return
    setInstalling(true)
    setInstallError(null)
    const result = await window.electron.installSkillFromGit(installUrl.trim(), installName.trim() || undefined)
    setInstalling(false)
    if (result.success) {
      setInstallUrl('')
      setInstallName('')
      void loadSkills()
    } else {
      setInstallError(result.error ?? 'Install failed')
    }
  }

  async function handleInstallBuiltIn(url: string, name: string): Promise<void> {
    setInstalling(true)
    setInstallError(null)
    const result = await window.electron.installSkillFromGit(url, name)
    setInstalling(false)
    if (result.success) {
      void loadSkills()
    } else {
      setInstallError(result.error ?? 'Install failed')
    }
  }

  async function handleRemovePlugin(name: string): Promise<void> {
    if (!confirm(`Remove plugin "${name}"?`)) return
    await window.electron.uninstallPlugin(name)
    void loadPlugins()
    if (selectedPlugin === name) { setSelectedPlugin(null); setPluginReadme(null) }
  }

  async function handleSelectPlugin(pluginId: string): Promise<void> {
    setSelectedPlugin(pluginId)
    const readme = await window.electron.getPluginReadme(pluginId)
    setPluginReadme(readme)
  }

  async function handleInstallPlugin(): Promise<void> {
    if (!pluginInstallName.trim()) return
    setInstalling(true)
    const result = await window.electron.installPlugin(pluginInstallName.trim())
    setInstalling(false)
    if (result.success) {
      setPluginInstallName('')
      void loadPlugins()
    } else {
      setInstallError(result.error ?? 'Install failed')
    }
  }

  const filteredSkills = skills.filter((s) =>
    !searchQuery || s.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Left: list */}
      <div className="w-[260px] flex-shrink-0 border-r border-[var(--color-border)] flex flex-col overflow-hidden">
        {/* Tab bar */}
        <div className="flex border-b border-[var(--color-border)] flex-shrink-0">
          {(['skills', 'plugins'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'flex-1 py-[7px] text-[11px] border-b-2 border-t-0 border-x-0 cursor-pointer transition-colors',
                tab === t
                  ? 'font-bold text-[var(--color-accent)] bg-[var(--color-accent-dim)] border-b-[var(--color-accent)]'
                  : 'font-normal text-[var(--color-text-muted)] bg-transparent border-b-transparent',
              )}
            >
              {t === 'skills' ? `Skills (${skills.length})` : `Plugins (${plugins.length})`}
            </button>
          ))}
        </div>

        {tab === 'skills' && (
          <>
            {/* Search + install */}
            <div className="px-2.5 py-2 border-b border-[var(--color-border)] flex-shrink-0">
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search skills…"
                className={cn(inputCls, 'w-full box-border mb-1.5')}
              />
              <div className="flex gap-1">
                <input
                  value={installUrl}
                  onChange={(e) => setInstallUrl(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') void handleInstall() }}
                  placeholder="GitHub URL…"
                  className={cn(inputCls, 'flex-1 min-w-0')}
                />
                <button
                  onClick={() => void handleInstall()}
                  disabled={installing || !installUrl.trim()}
                  className={cn(
                    'text-[11px] px-2.5 py-1 border border-[var(--color-accent)] rounded-[var(--radius-sm)] bg-[var(--color-accent)] text-white flex-shrink-0 transition-opacity',
                    installing || !installUrl.trim() ? 'opacity-50 cursor-default' : 'opacity-100 cursor-pointer',
                  )}
                >
                  {installing ? '…' : <><Download size={11} className="inline mr-0.5" />Install</>}
                </button>
              </div>
              {installError && (
                <div className="mt-1 text-[10px] text-[var(--color-danger)]">{installError}</div>
              )}
              <button
                onClick={() => setShowBuiltIn((v) => !v)}
                className="mt-1.5 inline-flex items-center gap-[3px] border-none bg-transparent p-0 text-[10px] text-[var(--color-text-muted)] underline cursor-pointer"
              >
                {showBuiltIn ? <>Hide <ChevronUp size={9} /></> : <>Recommended <ChevronDown size={9} /></>}
              </button>
              {showBuiltIn && (
                <div className="mt-1.5">
                  {BUILT_IN_SKILLS.map((s) => {
                    const alreadyInstalled = skills.some((sk) => sk.id === s.id)
                    return (
                      <div
                        key={s.id}
                        className="flex items-center gap-1.5 py-1 border-b border-[var(--color-border)]"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-[11px] font-semibold text-[var(--color-text)]">{s.name}</div>
                          <div className="text-[10px] text-[var(--color-text-muted)] overflow-hidden text-ellipsis whitespace-nowrap">{s.description}</div>
                        </div>
                        <button
                          disabled={alreadyInstalled || installing}
                          onClick={() => void handleInstallBuiltIn(s.url, s.id)}
                          className={cn(
                            'text-[10px] px-2 py-px rounded-[var(--radius-sm)] bg-transparent flex-shrink-0',
                            alreadyInstalled
                              ? 'border border-[var(--color-border)] text-[var(--color-text-muted)] cursor-default'
                              : 'border border-[var(--color-accent)] text-[var(--color-accent)] cursor-pointer',
                          )}
                        >
                          {alreadyInstalled ? <Check size={10} /> : <><Plus size={9} className="inline" />Get</>}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Skills list */}
            <div className="flex-1 overflow-y-auto">
              {loading && <div className="p-3 text-[11px] text-[var(--color-text-muted)]">Loading…</div>}
              {!loading && filteredSkills.length === 0 && (
                <div className="p-3 text-[11px] text-[var(--color-text-muted)]">
                  No skills found in ~/.claude/skills/
                </div>
              )}
              {filteredSkills.map((skill) => (
                <div
                  key={skill.path}
                  onClick={() => void handleSelectSkill(skill.id)}
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 py-[7px] cursor-pointer border-l-2 transition-colors',
                    selected === skill.id
                      ? 'bg-[var(--color-surface-2)] border-l-[var(--color-accent)]'
                      : 'bg-transparent border-l-transparent hover:bg-[var(--color-surface-2)]',
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div
                      className={cn(
                        'text-[11px] font-semibold',
                        skill.enabled ? 'text-[var(--color-text)]' : 'text-[var(--color-text-muted)]',
                      )}
                    >
                      {skill.name}
                    </div>
                    {skill.description && (
                      <div className="text-[10px] text-[var(--color-text-muted)] overflow-hidden text-ellipsis whitespace-nowrap">
                        {skill.description}
                      </div>
                    )}
                  </div>
                  <label
                    onClick={(e) => e.stopPropagation()}
                    className="flex-shrink-0 cursor-pointer"
                    title={skill.enabled ? 'Disable' : 'Enable'}
                  >
                    <input
                      type="checkbox"
                      checked={skill.enabled}
                      onChange={(e) => void handleToggle(skill.id, e.target.checked)}
                      className="cursor-pointer"
                    />
                  </label>
                  <button
                    onClick={(e) => { e.stopPropagation(); void handleDelete(skill.id) }}
                    title="Delete"
                    className="flex-shrink-0 cursor-pointer border-none bg-transparent text-[var(--color-text-muted)] opacity-40 transition-all hover:opacity-100 hover:text-[var(--color-danger)]"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === 'plugins' && (
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="px-2.5 py-2 border-b border-[var(--color-border)] flex-shrink-0">
              <div className="flex gap-1">
                <input
                  value={pluginInstallName}
                  onChange={(e) => setPluginInstallName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') void handleInstallPlugin() }}
                  placeholder="Plugin name…"
                  className={cn(inputCls, 'flex-1 min-w-0')}
                />
                <button
                  onClick={() => void handleInstallPlugin()}
                  disabled={installing || !pluginInstallName.trim()}
                  className={cn(
                    'text-[11px] px-2.5 py-1 border border-[var(--color-accent)] rounded-[var(--radius-sm)] bg-[var(--color-accent)] text-white flex-shrink-0 transition-opacity',
                    installing || !pluginInstallName.trim() ? 'opacity-50 cursor-default' : 'opacity-100 cursor-pointer',
                  )}
                >
                  {installing ? '…' : <><Plus size={11} className="inline mr-0.5" />Add</>}
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {loading && <div className="p-3 text-[11px] text-[var(--color-text-muted)]">Loading…</div>}
              {!loading && plugins.length === 0 && (
                <div className="p-3 text-[11px] text-[var(--color-text-muted)]">No plugins installed</div>
              )}
              {plugins.map((plugin) => (
                <div
                  key={plugin.id}
                  onClick={() => void handleSelectPlugin(plugin.id)}
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 py-[7px] cursor-pointer border-l-2 border-b border-b-[var(--color-border)] transition-colors',
                    selectedPlugin === plugin.id
                      ? 'bg-[var(--color-surface-2)] border-l-[var(--color-accent)]'
                      : 'bg-transparent border-l-transparent hover:bg-[var(--color-surface-2)]',
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <span className="text-[11px] font-semibold text-[var(--color-text)]">{plugin.name}</span>
                    {plugin.version && (
                      <span className="text-[10px] text-[var(--color-text-muted)] ml-1.5">v{plugin.version}</span>
                    )}
                    {(plugin.skillCount != null || plugin.agentCount != null) && (
                      <span className="text-[10px] text-[var(--color-text-muted)] ml-1.5">
                        {plugin.skillCount != null && plugin.skillCount > 0 ? `${plugin.skillCount} skill${plugin.skillCount > 1 ? 's' : ''}` : ''}
                        {plugin.skillCount != null && plugin.skillCount > 0 && plugin.agentCount != null && plugin.agentCount > 0 ? ' · ' : ''}
                        {plugin.agentCount != null && plugin.agentCount > 0 ? `${plugin.agentCount} agent${plugin.agentCount > 1 ? 's' : ''}` : ''}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); void handleRemovePlugin(plugin.id) }}
                    className="flex-shrink-0 cursor-pointer border-none bg-transparent text-[var(--color-text-muted)] opacity-40 transition-all hover:opacity-100 hover:text-[var(--color-danger)]"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Right: preview */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {tab === 'skills' && selected ? (
          <>
            <div className="px-4 py-2 border-b border-[var(--color-border)] flex-shrink-0 flex items-center gap-2.5">
              <span className="text-[12px] font-bold text-[var(--color-text)]">{selected}</span>
              <span className="text-[10px] text-[var(--color-text-muted)]">SKILL.md</span>
              <span className="flex-1" />
              <button
                onClick={() => void handleToggle(selected, !skills.find((s) => s.id === selected)?.enabled)}
                className="text-[11px] px-2.5 py-[3px] border border-[var(--color-border)] rounded-[var(--radius-sm)] text-[var(--color-text-muted)] cursor-pointer"
              >
                {skills.find((s) => s.id === selected)?.enabled ? 'Disable' : 'Enable'}
              </button>
              <button
                onClick={() => void handleDelete(selected)}
                className="cursor-pointer rounded-[var(--radius-sm)] border border-[var(--color-danger)] px-2.5 py-[3px] text-[11px] text-[var(--color-danger)]"
              >
                Delete
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-3 font-mono text-[12px] leading-relaxed text-[var(--color-text)] whitespace-pre-wrap break-words">
              {previewContent || <span className="text-[var(--color-text-muted)]">Empty SKILL.md</span>}
            </div>
          </>
        ) : tab === 'plugins' && selectedPlugin && pluginReadme ? (
          <>
            <div className="px-4 py-2 border-b border-[var(--color-border)] flex-shrink-0 flex items-center gap-2.5">
              <span className="text-[12px] font-bold text-[var(--color-text)]">{selectedPlugin}</span>
              <span className="text-[10px] text-[var(--color-text-muted)]">README.md</span>
              <span className="flex-1" />
              {pluginReadme.skills.length > 0 && (
                <span className="text-[10px] text-[var(--color-text-muted)]">
                  {pluginReadme.skills.length} skill{pluginReadme.skills.length > 1 ? 's' : ''}
                </span>
              )}
              {pluginReadme.agents.length > 0 && (
                <span className="text-[10px] text-[var(--color-text-muted)]">
                  {pluginReadme.agents.length} agent{pluginReadme.agents.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div className="flex-1 overflow-y-auto">
              {/* Skills & agents summary */}
              {(pluginReadme.skills.length > 0 || pluginReadme.agents.length > 0) && (
                <div className="px-5 py-3 border-b border-[var(--color-border)]">
                  {pluginReadme.skills.length > 0 && (
                    <div className="mb-2">
                      <div className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase mb-1">Skills</div>
                      <div className="flex flex-wrap gap-1">
                        {pluginReadme.skills.map((s) => (
                          <span
                            key={s}
                            className="text-[10px] px-2 py-px rounded-[var(--radius-sm)] bg-[var(--color-surface-2)] text-[var(--color-text)] border border-[var(--color-border)]"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {pluginReadme.agents.length > 0 && (
                    <div>
                      <div className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase mb-1">Agents</div>
                      <div className="flex flex-wrap gap-1">
                        {pluginReadme.agents.map((a) => (
                          <span
                            key={a}
                            className="text-[10px] px-2 py-px rounded-[var(--radius-sm)] bg-[var(--color-surface-2)] text-[var(--color-text)] border border-[var(--color-border)]"
                          >
                            {a}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              {/* README content */}
              <div className="px-5 py-3 font-mono text-[12px] leading-relaxed text-[var(--color-text)] whitespace-pre-wrap break-words">
                {pluginReadme.content || <span className="text-[var(--color-text-muted)]">No README</span>}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center flex-col gap-2 text-[var(--color-text-muted)]">
            <Zap size={28} className="text-[var(--color-text-faint)]" />
            <div className="text-[13px] font-semibold text-[var(--color-text)]">
              {tab === 'skills' ? 'Skills Manager' : 'Plugins'}
            </div>
            <div className="text-[11px]">
              {tab === 'skills' ? 'Select a skill to preview its SKILL.md' : 'Manage Claude Code plugins'}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
