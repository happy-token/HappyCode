import React, { useEffect } from 'react'
import { useSettingsStore } from '../../store/settings-store'
import { GeneralSettings } from './GeneralSettings'
import { PermissionSettings } from './PermissionSettings'
import { ProviderSettings } from './ProviderSettings'
import { AgentSettings } from './AgentSettings'
import { SkillSettings } from './SkillSettings'
import { PluginSettings } from './PluginSettings'
import { ComputerUseSettings } from './ComputerUseSettings'
import { ExportSettings } from './ExportSettings'
import { AboutSettings } from './AboutSettings'
import { McpSettings } from '../mcp/McpPage'
import { HooksPanel } from '../hooks/HooksPanel'
import { ClaudeCodeSettings } from './ClaudeCodeSettings'

export function SettingsLayout(): React.JSX.Element {
  const activeTab = useSettingsStore((s) => s.activeTab)
  const pendingTab = useSettingsStore((s) => s.pendingTab)
  const setPendingTab = useSettingsStore((s) => s.setPendingTab)

  useEffect(() => {
    if (!pendingTab) return
    setPendingTab(null)
  }, [pendingTab, setPendingTab])

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {activeTab === 'hooks' ? (
        <HooksPanel />
      ) : (
        <div className="relative flex-1 overflow-y-auto px-8 py-6">
          {activeTab === 'general' && <GeneralSettings />}
          {activeTab === 'permissions' && <PermissionSettings />}
          {activeTab === 'providers' && <ProviderSettings />}
          {activeTab === 'mcp' && <McpSettings />}
          {activeTab === 'agents' && <AgentSettings />}
          {activeTab === 'skills' && <SkillSettings />}
          {activeTab === 'plugins' && <PluginSettings />}
          {activeTab === 'computerUse' && <ComputerUseSettings />}
          {activeTab === 'claudeCode' && <ClaudeCodeSettings />}
          {activeTab === 'export' && <ExportSettings />}
          {activeTab === 'about' && <AboutSettings />}
        </div>
      )}
    </div>
  )
}
