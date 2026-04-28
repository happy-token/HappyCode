import React, { useEffect, useMemo } from 'react'
import { ChevronLeft } from 'lucide-react'
import { useAgentStore } from '../../store/agent-store'
import type { AgentDefinition, AgentSource } from '../../../electron/shared/types'

const SOURCE_LABELS: Record<AgentSource, string> = {
  'userSettings': '用户自定义 (~/.claude/agents)',
  'projectSettings': '项目 (.claude/agents)',
  'localSettings': '本地',
  'policySettings': '策略',
  'plugin': '插件',
  'flagSettings': '标志',
  'built-in': '内置',
}

function getGroupLabel(source: AgentSource, agents: AgentDefinition[]): string {
  if (source === 'plugin') {
    const pluginNames = [...new Set(agents.map((a) => a.plugin).filter(Boolean))]
    if (pluginNames.length === 1) return `插件: ${pluginNames[0]}`
    if (pluginNames.length > 1) return `插件 (${pluginNames.join(', ')})`
  }
  return SOURCE_LABELS[source] ?? source
}

const SOURCE_ORDER: AgentSource[] = [
  'built-in', 'plugin', 'userSettings', 'projectSettings', 'localSettings', 'flagSettings', 'policySettings',
]

export function AgentSettings(): React.JSX.Element {
  const { agents, activeAgents, selectedAgent, isLoading, fetchAgents, selectAgent } = useAgentStore()

  useEffect(() => {
    void fetchAgents()
  }, [fetchAgents])

  const grouped = useMemo(() => {
    const groups = new Map<AgentSource, AgentDefinition[]>()
    for (const agent of agents) {
      const group = groups.get(agent.source) ?? []
      group.push(agent)
      groups.set(agent.source, group)
    }
    return groups
  }, [agents])

  const stats = useMemo(() => ({
    total: agents.length,
    active: activeAgents.length,
    sources: grouped.size,
  }), [agents, activeAgents, grouped])

  if (selectedAgent) {
    return (
      <AgentDetail
        agent={selectedAgent}
        onBack={() => selectAgent(null)}
      />
    )
  }

  if (isLoading) {
    return <div className="text-[13px] text-[var(--color-text-muted)]">Loading agents...</div>
  }

  if (agents.length === 0) {
    return (
      <div className="max-w-[640px]">
        <div className="mb-2 text-[16px] font-bold text-[var(--color-text)]">Agent 管理</div>
        <div className="text-[13px] leading-[1.6] text-[var(--color-text-muted)]">
          未找到 Agent 定义。<br />
          在 <code className="rounded-[3px] bg-[var(--color-surface-2)] px-1 py-px text-[11px]">~/.claude/agents/</code> 目录中添加 <code className="rounded-[3px] bg-[var(--color-surface-2)] px-1 py-px text-[11px]">.md</code> 文件来创建自定义 Agent。
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-[640px]">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <div className="text-[16px] font-bold text-[var(--color-text)]">Agent 管理</div>
          <div className="mt-0.5 text-[12px] text-[var(--color-text-muted)]">
            共 {stats.total} 个 · {stats.sources} 个来源
          </div>
        </div>
      </div>

      {SOURCE_ORDER.filter((s) => grouped.has(s)).map((source) => {
        const items = grouped.get(source)!
        return (
          <div key={source} className="mb-6">
            <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.05em] text-[var(--color-text-muted)]">
              {getGroupLabel(source, items)} <span className="font-normal">({items.length})</span>
            </div>
            <div className="flex flex-col gap-1.5">
              {items.map((agent) => (
                <AgentCard
                  key={agent.agentType}
                  agent={agent}
                  onSelect={() => selectAgent(agent)}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function AgentCard({
  agent,
  onSelect,
}: {
  agent: AgentDefinition
  onSelect: () => void
}) {
  return (
    <div
      onClick={onSelect}
      className="flex cursor-pointer items-center gap-3 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] p-[10px_14px] transition-colors hover:bg-[var(--color-surface-2)]"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[13px] font-semibold text-[var(--color-text)]">
            {agent.agentType}
          </span>
          {agent.modelDisplay && (
            <span className="rounded-[3px] border border-[var(--color-border)] px-[5px] py-px text-[9px] font-semibold uppercase tracking-[0.04em] text-[var(--color-text-muted)]">
              {agent.modelDisplay}
            </span>
          )}
        </div>
        {agent.description && (
          <div className="mt-0.5 overflow-hidden text-ellipsis whitespace-nowrap text-[11px] text-[var(--color-text-muted)]">
            {agent.description}
          </div>
        )}
      </div>
      {agent.tools && agent.tools.length > 0 && (
        <div className="flex-shrink-0 text-[11px] text-[var(--color-text-muted)]">
          {agent.tools.length} tools
        </div>
      )}
      <span className="flex-shrink-0 text-[14px] text-[var(--color-text-muted)]">›</span>
    </div>
  )
}

function AgentDetail({
  agent,
  onBack,
}: {
  agent: AgentDefinition
  onBack: () => void
}) {
  return (
    <div className="max-w-[640px]">
      <div className="mb-5 flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex cursor-pointer items-center border-none bg-transparent px-2 py-1 text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="flex-1">
          <div className="text-[16px] font-bold text-[var(--color-text)]">
            {agent.agentType}
          </div>
          <div className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">
            {agent.source === 'plugin' && agent.plugin
              ? `插件: ${agent.plugin}`
              : SOURCE_LABELS[agent.source as AgentSource] ?? agent.source}
            {agent.baseDir && ` · ${agent.baseDir}`}
          </div>
        </div>
      </div>

      {agent.description && (
        <div className="mb-4">
          <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.05em] text-[var(--color-text-muted)]">描述</div>
          <div className="text-[13px] leading-[1.6] text-[var(--color-text)]">{agent.description}</div>
        </div>
      )}

      <div className="mb-4 flex gap-3">
        {agent.modelDisplay && (
          <div>
            <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.05em] text-[var(--color-text-muted)]">模型</div>
            <span className="rounded-[4px] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-0.5 text-[12px] text-[var(--color-text)]">
              {agent.modelDisplay}
            </span>
          </div>
        )}
      </div>

      {agent.tools && agent.tools.length > 0 && (
        <div className="mb-4">
          <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.05em] text-[var(--color-text-muted)]">
            工具 ({agent.tools.length})
          </div>
          <div className="flex flex-wrap gap-1">
            {agent.tools.map((tool) => (
              <span key={tool} className="rounded-[4px] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-0.5 text-[11px] text-[var(--color-text-muted)]">
                {tool}
              </span>
            ))}
          </div>
        </div>
      )}

      {agent.systemPrompt && (
        <div>
          <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.05em] text-[var(--color-text-muted)]">系统提示词</div>
          <pre className="box-border max-h-[320px] w-full overflow-y-auto rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-[10px] py-[6px] font-mono text-[11px] leading-[1.6] text-[var(--color-text)] [white-space:pre-wrap] [word-break:break-word]">
            {agent.systemPrompt.split('\n').slice(0, 60).join('\n')}
            {agent.systemPrompt.split('\n').length > 60 && '\n\n... (已截断)'}
          </pre>
        </div>
      )}
    </div>
  )
}
