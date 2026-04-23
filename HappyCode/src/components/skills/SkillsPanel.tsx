import React, { useEffect, useState, useCallback } from 'react'
import type { SkillInfo, PluginInfo } from '../../../electron/shared/types'
import { BUILT_IN_SKILLS } from '../../../electron/shared/types'

type Tab = 'skills' | 'plugins'

const PANEL_STYLE: React.CSSProperties = {
  display: 'flex',
  flex: 1,
  overflow: 'hidden',
}

export function SkillsPanel(): React.JSX.Element {
  const [tab, setTab] = useState<Tab>('skills')
  const [skills, setSkills] = useState<SkillInfo[]>([])
  const [plugins, setPlugins] = useState<PluginInfo[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [previewContent, setPreviewContent] = useState<string>('')
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
    await window.electron.removePlugin(name)
    void loadPlugins()
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

  const labelStyle: React.CSSProperties = {
    fontSize: 10,
    fontWeight: 700,
    color: 'var(--color-text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  }

  return (
    <div style={PANEL_STYLE}>
      {/* Left: list */}
      <div
        style={{
          width: 260,
          flexShrink: 0,
          borderRight: '1px solid var(--color-border)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Tab bar */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
          {(['skills', 'plugins'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1,
                padding: '7px 0',
                fontSize: 11,
                fontWeight: tab === t ? 700 : 400,
                color: tab === t ? 'var(--color-accent)' : 'var(--color-text-muted)',
                background: tab === t ? 'var(--color-accent-dim)' : 'transparent',
                border: 'none',
                borderBottom: tab === t ? '2px solid var(--color-accent)' : '2px solid transparent',
                cursor: 'pointer',
              }}
            >
              {t === 'skills' ? `Skills (${skills.length})` : `Plugins (${plugins.length})`}
            </button>
          ))}
        </div>

        {tab === 'skills' && (
          <>
            {/* Search + install */}
            <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search skills…"
                style={{
                  width: '100%',
                  fontSize: 11,
                  padding: '4px 8px',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--color-surface-2)',
                  color: 'var(--color-text)',
                  boxSizing: 'border-box',
                  marginBottom: 6,
                }}
              />
              <div style={{ display: 'flex', gap: 4 }}>
                <input
                  value={installUrl}
                  onChange={(e) => setInstallUrl(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') void handleInstall() }}
                  placeholder="GitHub URL…"
                  style={{
                    flex: 1,
                    fontSize: 11,
                    padding: '4px 8px',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--color-surface-2)',
                    color: 'var(--color-text)',
                    minWidth: 0,
                  }}
                />
                <button
                  onClick={() => void handleInstall()}
                  disabled={installing || !installUrl.trim()}
                  style={{
                    fontSize: 11,
                    padding: '4px 10px',
                    border: '1px solid var(--color-accent)',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--color-accent)',
                    color: '#fff',
                    cursor: installing ? 'wait' : 'pointer',
                    flexShrink: 0,
                    opacity: installing || !installUrl.trim() ? 0.5 : 1,
                  }}
                >
                  {installing ? '…' : '+ Install'}
                </button>
              </div>
              {installError && (
                <div style={{ fontSize: 10, color: '#ef4444', marginTop: 4 }}>{installError}</div>
              )}
              <button
                onClick={() => setShowBuiltIn((v) => !v)}
                style={{
                  marginTop: 6,
                  fontSize: 10,
                  color: 'var(--color-text-muted)',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  textDecoration: 'underline',
                }}
              >
                {showBuiltIn ? 'Hide' : 'Recommended ▾'}
              </button>
              {showBuiltIn && (
                <div style={{ marginTop: 6 }}>
                  {BUILT_IN_SKILLS.map((s) => {
                    const alreadyInstalled = skills.some((sk) => sk.id === s.id)
                    return (
                      <div
                        key={s.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '4px 0',
                          borderBottom: '1px solid var(--color-border)',
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text)' }}>{s.name}</div>
                          <div style={{ fontSize: 10, color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.description}</div>
                        </div>
                        <button
                          disabled={alreadyInstalled || installing}
                          onClick={() => void handleInstallBuiltIn(s.url, s.id)}
                          style={{
                            fontSize: 10,
                            padding: '2px 8px',
                            border: `1px solid ${alreadyInstalled ? 'var(--color-border)' : 'var(--color-accent)'}`,
                            borderRadius: 'var(--radius-sm)',
                            color: alreadyInstalled ? 'var(--color-text-muted)' : 'var(--color-accent)',
                            background: 'transparent',
                            cursor: alreadyInstalled ? 'default' : 'pointer',
                            flexShrink: 0,
                          }}
                        >
                          {alreadyInstalled ? '✓' : '+ Get'}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Skills list */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {loading && <div style={{ padding: 12, fontSize: 11, color: 'var(--color-text-muted)' }}>Loading…</div>}
              {!loading && filteredSkills.length === 0 && (
                <div style={{ padding: 12, fontSize: 11, color: 'var(--color-text-muted)' }}>
                  No skills found in ~/.claude/skills/
                </div>
              )}
              {filteredSkills.map((skill) => (
                <div
                  key={skill.id}
                  onClick={() => void handleSelectSkill(skill.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '7px 10px',
                    cursor: 'pointer',
                    background: selected === skill.id ? 'var(--color-surface-2)' : 'transparent',
                    borderLeft: selected === skill.id ? '2px solid var(--color-accent)' : '2px solid transparent',
                  }}
                  onMouseEnter={(e) => { if (selected !== skill.id) (e.currentTarget as HTMLDivElement).style.background = 'var(--color-surface-2)' }}
                  onMouseLeave={(e) => { if (selected !== skill.id) (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: skill.enabled ? 'var(--color-text)' : 'var(--color-text-muted)' }}>
                      {skill.name}
                    </div>
                    {skill.description && (
                      <div style={{ fontSize: 10, color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {skill.description}
                      </div>
                    )}
                  </div>
                  <label
                    onClick={(e) => e.stopPropagation()}
                    style={{ flexShrink: 0, cursor: 'pointer' }}
                    title={skill.enabled ? 'Disable' : 'Enable'}
                  >
                    <input
                      type="checkbox"
                      checked={skill.enabled}
                      onChange={(e) => void handleToggle(skill.id, e.target.checked)}
                      style={{ cursor: 'pointer' }}
                    />
                  </label>
                  <button
                    onClick={(e) => { e.stopPropagation(); void handleDelete(skill.id) }}
                    title="Delete"
                    style={{ fontSize: 11, color: 'var(--color-text-muted)', background: 'transparent', border: 'none', cursor: 'pointer', flexShrink: 0, opacity: 0.4 }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; (e.currentTarget as HTMLButtonElement).style.color = '#ef4444' }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.4'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-muted)' }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === 'plugins' && (
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
              <div style={{ display: 'flex', gap: 4 }}>
                <input
                  value={pluginInstallName}
                  onChange={(e) => setPluginInstallName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') void handleInstallPlugin() }}
                  placeholder="Plugin name…"
                  style={{
                    flex: 1,
                    fontSize: 11,
                    padding: '4px 8px',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--color-surface-2)',
                    color: 'var(--color-text)',
                    minWidth: 0,
                  }}
                />
                <button
                  onClick={() => void handleInstallPlugin()}
                  disabled={installing || !pluginInstallName.trim()}
                  style={{
                    fontSize: 11,
                    padding: '4px 10px',
                    border: '1px solid var(--color-accent)',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--color-accent)',
                    color: '#fff',
                    cursor: 'pointer',
                    flexShrink: 0,
                    opacity: installing || !pluginInstallName.trim() ? 0.5 : 1,
                  }}
                >
                  + Add
                </button>
              </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {loading && <div style={{ padding: 12, fontSize: 11, color: 'var(--color-text-muted)' }}>Loading…</div>}
              {!loading && plugins.length === 0 && (
                <div style={{ padding: 12, fontSize: 11, color: 'var(--color-text-muted)' }}>No plugins installed</div>
              )}
              {plugins.map((plugin) => (
                <div
                  key={plugin.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '7px 10px',
                    borderBottom: '1px solid var(--color-border)',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text)' }}>{plugin.name}</span>
                    {plugin.version && (
                      <span style={{ fontSize: 10, color: 'var(--color-text-muted)', marginLeft: 6 }}>v{plugin.version}</span>
                    )}
                  </div>
                  <button
                    onClick={() => void handleRemovePlugin(plugin.id)}
                    style={{ fontSize: 11, color: 'var(--color-text-muted)', background: 'transparent', border: 'none', cursor: 'pointer', opacity: 0.4 }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; (e.currentTarget as HTMLButtonElement).style.color = '#ef4444' }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.4'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-muted)' }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Right: preview */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {tab === 'skills' && selected ? (
          <>
            <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--color-border)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text)' }}>{selected}</span>
              <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>SKILL.md</span>
              <span style={{ flex: 1 }} />
              <button
                onClick={() => void handleToggle(selected, !skills.find((s) => s.id === selected)?.enabled)}
                style={{
                  fontSize: 11,
                  padding: '3px 10px',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--color-text-muted)',
                  cursor: 'pointer',
                }}
              >
                {skills.find((s) => s.id === selected)?.enabled ? 'Disable' : 'Enable'}
              </button>
              <button
                onClick={() => void handleDelete(selected)}
                style={{ fontSize: 11, padding: '3px 10px', border: '1px solid #ef4444', borderRadius: 'var(--radius-sm)', color: '#ef4444', cursor: 'pointer' }}
              >
                Delete
              </button>
            </div>
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '12px 20px',
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                lineHeight: 1.6,
                color: 'var(--color-text)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {previewContent || <span style={{ color: 'var(--color-text-muted)' }}>Empty SKILL.md</span>}
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8, color: 'var(--color-text-muted)' }}>
            <div style={{ fontSize: 28 }}>◈</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>
              {tab === 'skills' ? 'Skills Manager' : 'Plugins'}
            </div>
            <div style={{ fontSize: 11 }}>
              {tab === 'skills' ? 'Select a skill to preview its SKILL.md' : 'Manage Claude Code plugins'}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
