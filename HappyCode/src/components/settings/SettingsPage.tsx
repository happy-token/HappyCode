import React, { useState } from 'react'
import { useApiConfigStore } from '../../store/api-config-store'
import type { ApiConfig, AgentSettings, PermissionMode, ThinkingMode, EffortLevel } from '../../../electron/shared/types'

const inputStyle: React.CSSProperties = {
  width: '100%',
  fontFamily: 'var(--font-mono)',
  fontSize: 12,
  padding: '5px 8px',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--color-surface-2)',
  color: 'var(--color-text)',
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--color-text-muted)',
  marginBottom: 4,
}

const sectionHeadStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--color-text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  marginBottom: 10,
}

export function SettingsPage(): React.JSX.Element {
  const { config, agentSettings, save, saveAgentSettings } = useApiConfigStore()
  const [draftApi, setDraftApi] = useState<ApiConfig>({ ...config })
  const [draftAgent, setDraftAgent] = useState<AgentSettings>({ ...agentSettings })
  const [saved, setSaved] = useState(false)

  async function handleSave(): Promise<void> {
    await Promise.all([save(draftApi), saveAgentSettings(draftAgent)])
    setSaved(true)
    setTimeout(() => setSaved(false), 1200)
  }

  return (
    <div
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: 24,
      }}
    >
      <div style={{ maxWidth: 520 }}>

        {/* ── API Config ── */}
        <div style={sectionHeadStyle}>API Configuration</div>

        <label style={{ display: 'block', marginBottom: 10 }}>
          <div style={labelStyle}>API Base URL</div>
          <input
            value={draftApi.baseUrl}
            onChange={(e) => setDraftApi((d) => ({ ...d, baseUrl: e.target.value }))}
            placeholder="https://api.anthropic.com"
            style={inputStyle}
          />
        </label>

        <label style={{ display: 'block', marginBottom: 18 }}>
          <div style={labelStyle}>Auth Token / API Key</div>
          <input
            type="password"
            value={draftApi.authToken}
            onChange={(e) => setDraftApi((d) => ({ ...d, authToken: e.target.value }))}
            placeholder="sk-… or uuid"
            style={inputStyle}
          />
        </label>

        {/* ── Agent Settings ── */}
        <div style={{ ...sectionHeadStyle, borderTop: '1px solid var(--color-border)', paddingTop: 14 }}>
          Agent Settings
        </div>

        <label style={{ display: 'block', marginBottom: 10 }}>
          <div style={labelStyle}>Permission Mode</div>
          <select
            value={draftAgent.permissionMode ?? 'default'}
            onChange={(e) => setDraftAgent((d) => ({ ...d, permissionMode: e.target.value as PermissionMode }))}
            style={{ ...inputStyle, cursor: 'pointer' }}
          >
            <option value="default">default — ask for each tool</option>
            <option value="acceptEdits">acceptEdits — auto-accept file edits</option>
            <option value="bypassPermissions">bypassPermissions — skip all prompts</option>
            <option value="plan">plan — plan only, no execution</option>
            <option value="dontAsk">dontAsk — deny anything not pre-approved</option>
            <option value="auto">auto — model classifier decides</option>
          </select>
        </label>

        <label style={{ display: 'block', marginBottom: 10 }}>
          <div style={labelStyle}>Max Turns (empty = unlimited)</div>
          <input
            type="number"
            min={1}
            value={draftAgent.maxTurns ?? ''}
            onChange={(e) => setDraftAgent((d) => ({ ...d, maxTurns: e.target.value ? Number(e.target.value) : undefined }))}
            placeholder="e.g. 20"
            style={inputStyle}
          />
        </label>

        <label style={{ display: 'block', marginBottom: 10 }}>
          <div style={labelStyle}>Allowed Tools (comma-separated, auto-approved)</div>
          <input
            value={draftAgent.allowedTools ?? ''}
            onChange={(e) => setDraftAgent((d) => ({ ...d, allowedTools: e.target.value || undefined }))}
            placeholder="e.g. Read,Grep,Glob,Bash"
            style={inputStyle}
          />
        </label>

        <label style={{ display: 'block', marginBottom: 10 }}>
          <div style={labelStyle}>Disallowed Tools (comma-separated, always blocked)</div>
          <input
            value={draftAgent.disallowedTools ?? ''}
            onChange={(e) => setDraftAgent((d) => ({ ...d, disallowedTools: e.target.value || undefined }))}
            placeholder="e.g. Bash,Write"
            style={inputStyle}
          />
        </label>

        <label style={{ display: 'block', marginBottom: 10 }}>
          <div style={labelStyle}>Additional Directories (comma-separated)</div>
          <input
            value={draftAgent.additionalDirectories ?? ''}
            onChange={(e) => setDraftAgent((d) => ({ ...d, additionalDirectories: e.target.value || undefined }))}
            placeholder="/path/to/dir1, /path/to/dir2"
            style={inputStyle}
          />
        </label>

        <label style={{ display: 'block', marginBottom: 10 }}>
          <div style={labelStyle}>System Prompt (overrides default)</div>
          <textarea
            value={draftAgent.systemPrompt ?? ''}
            onChange={(e) => setDraftAgent((d) => ({ ...d, systemPrompt: e.target.value || undefined }))}
            placeholder="You are a helpful coding assistant."
            rows={3}
            style={{ ...inputStyle, resize: 'vertical', fontFamily: 'var(--font-mono)' }}
          />
        </label>

        <label style={{ display: 'block', marginBottom: 10 }}>
          <div style={labelStyle}>Append System Prompt (appended after default)</div>
          <textarea
            value={draftAgent.appendSystemPrompt ?? ''}
            onChange={(e) => setDraftAgent((d) => ({ ...d, appendSystemPrompt: e.target.value || undefined }))}
            placeholder="Additional context appended to the default system prompt."
            rows={2}
            style={{ ...inputStyle, resize: 'vertical', fontFamily: 'var(--font-mono)' }}
          />
        </label>

        {/* ── Advanced ── */}
        <div style={{ ...sectionHeadStyle, borderTop: '1px solid var(--color-border)', paddingTop: 14 }}>
          Advanced
        </div>

        <label style={{ display: 'block', marginBottom: 10 }}>
          <div style={labelStyle}>Thinking Mode</div>
          <select
            value={draftAgent.thinking ?? 'adaptive'}
            onChange={(e) => setDraftAgent((d) => ({ ...d, thinking: e.target.value as ThinkingMode }))}
            style={{ ...inputStyle, cursor: 'pointer' }}
          >
            <option value="adaptive">adaptive (default)</option>
            <option value="enabled">enabled — always think</option>
            <option value="disabled">disabled — no thinking</option>
          </select>
        </label>

        {draftAgent.thinking === 'enabled' && (
          <label style={{ display: 'block', marginBottom: 10 }}>
            <div style={labelStyle}>Max Thinking Tokens (empty = model default)</div>
            <input
              type="number"
              min={1024}
              step={1024}
              value={draftAgent.maxThinkingTokens ?? ''}
              onChange={(e) => setDraftAgent((d) => ({ ...d, maxThinkingTokens: e.target.value ? Number(e.target.value) : undefined }))}
              placeholder="e.g. 10000"
              style={inputStyle}
            />
          </label>
        )}

        <label style={{ display: 'block', marginBottom: 10 }}>
          <div style={labelStyle}>Effort Level</div>
          <select
            value={draftAgent.effort ?? ''}
            onChange={(e) => setDraftAgent((d) => ({ ...d, effort: (e.target.value as EffortLevel) || undefined }))}
            style={{ ...inputStyle, cursor: 'pointer' }}
          >
            <option value="">model default</option>
            <option value="low">low</option>
            <option value="medium">medium</option>
            <option value="high">high</option>
            <option value="xhigh">xhigh (Opus only)</option>
          </select>
        </label>

        <label style={{ display: 'block', marginBottom: 10 }}>
          <div style={labelStyle}>Max Budget USD (empty = unlimited)</div>
          <input
            type="number"
            min={0}
            step={0.01}
            value={draftAgent.maxBudgetUsd ?? ''}
            onChange={(e) => setDraftAgent((d) => ({ ...d, maxBudgetUsd: e.target.value ? Number(e.target.value) : undefined }))}
            placeholder="e.g. 0.50"
            style={inputStyle}
          />
        </label>

        <label style={{ display: 'block', marginBottom: 10 }}>
          <div style={labelStyle}>Fallback Model (if primary unavailable)</div>
          <input
            value={draftAgent.fallbackModel ?? ''}
            onChange={(e) => setDraftAgent((d) => ({ ...d, fallbackModel: e.target.value || undefined }))}
            placeholder="e.g. claude-sonnet-4-6"
            style={inputStyle}
          />
        </label>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={draftAgent.context1mBeta ?? false}
              onChange={(e) => setDraftAgent((d) => ({ ...d, context1mBeta: e.target.checked || undefined }))}
            />
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
              Enable 1M token context beta (Sonnet 4.x only)
            </span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={draftAgent.enableFileCheckpointing ?? false}
              onChange={(e) => setDraftAgent((d) => ({ ...d, enableFileCheckpointing: e.target.checked || undefined }))}
            />
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
              Enable file checkpointing (track file changes per turn)
            </span>
          </label>
        </div>

        {/* ── MCP Servers ── */}
        <div style={{ ...sectionHeadStyle, borderTop: '1px solid var(--color-border)', paddingTop: 14 }}>
          MCP Servers
        </div>

        <label style={{ display: 'block', marginBottom: 24 }}>
          <div style={labelStyle}>Server config (JSON object — key = server name)</div>
          <textarea
            value={draftAgent.mcpServersJson ?? ''}
            onChange={(e) => setDraftAgent((d) => ({ ...d, mcpServersJson: e.target.value || undefined }))}
            placeholder={`{\n  "filesystem": {\n    "type": "stdio",\n    "command": "npx",\n    "args": ["-y", "@modelcontextprotocol/server-filesystem", "."]\n  }\n}`}
            rows={6}
            style={{ ...inputStyle, resize: 'vertical', fontFamily: 'var(--font-mono)', fontSize: 11 }}
          />
        </label>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => void handleSave()}
            style={{
              fontSize: 12,
              padding: '6px 20px',
              border: '1px solid var(--color-accent)',
              borderRadius: 'var(--radius-sm)',
              background: saved ? 'var(--color-success)' : 'var(--color-accent)',
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            {saved ? '✓ Saved' : 'Save Settings'}
          </button>
        </div>

      </div>
    </div>
  )
}
