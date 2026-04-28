# Settings Page Redesign Spec

**Date:** 2026-04-26
**Status:** Approved
**Reference:** `/Users/thinkre/Desktop/CodingDesktop/cc-haha`

## Overview

Refactor the current flat `SettingsPage` component into a tabbed settings panel following cc-haha's dual-pane layout pattern. The left sidebar contains tab navigation, the right pane shows the selected tab's content.

## Layout

### Sidebar Header (when on settings page)
- Replace "HappyCode" text with a back button (←) + "设置" title
- Clicking back returns to the chat page (not the previous page)
- Remove the History and More icons that were in the header

### Left Sidebar (Tab Navigation)
- Width: 180px, fixed
- Scrollable, with tabs stacked vertically
- Selected tab highlighted with accent color + left border indicator
- "About" tab pinned to bottom with separator line

### Right Content Area
- Flexible width, scrollable
- Each tab shows its own content component
- Header shows "设置" label + section title

## Tab Order

| Order | Tab Name | Icon | Description |
|-------|----------|------|-------------|
| 1 | 通用 | ⚙️ | General: theme, language, effort level, web fetch preflight |
| 2 | 权限 | 🔒 | Permission: permission mode selection (radio cards) |
| 3 | 服务商 | 🌐 | Provider: multi-provider management, presets, settings.json, test connection |
| 4 | MCP | 🔌 | MCP: existing MCP server management (keep current functionality) |
| 5 | Agents | 🤖 | Agents: agent list grouped by source, detail view with system prompt |
| 6 | 技能 | ⚡ | Skills: skill list, detail view, enable/disable |
| 7 | 插件 | 🧩 | Plugins: plugin list, detail view, enable/disable |
| 8 | Computer Use | 🖱️ | Computer use: screenshot tools, permission settings |
| — | (separator) | | |
| 9 | 导出 | 📤 | Export: CSV export settings (from current SettingsPage) |
| 10 | 关于 | ℹ️ | About: version, GitHub link, author "HappyToken" |

## Feature Specifications

### 1. General Settings (通用)
- **Theme**: light / dark toggle (existing)
- **Effort Level**: low / medium / high / max selector
- **Web Fetch Preflight**: checkbox toggle
- **Language**: English / 中文 selector

### 2. Permission Settings (权限)
- Radio card selection for permission modes:
  - `default` — Ask for each tool call
  - `acceptEdits` — Auto-accept file edits
  - `plan` — Plan only, no execution
  - `bypassPermissions` — Skip all prompts
  - `dontAsk` — Deny anything not pre-approved
  - `auto` — Model classifier decides

### 3. Provider Settings (服务商) — Full cc-haha implementation
- **Provider List**: Card-style list with active indicator, name, base URL, model
- **Official Provider**: Anthropic official, always shown at top, with OAuth login
- **Add/Edit Provider Modal**:
  - Preset selector chips (custom + preset providers)
  - Fields: name, notes, base URL, API format, API key, model mapping
  - Settings JSON editor (editable, validates JSON, auto-fills form fields)
  - Test connection button with results display
- **Actions per provider**: Set as default, test, edit, delete
- **API Format**: anthropic / openai_chat / openai_responses
- **Model Mapping**: main, haiku, sonnet, opus model IDs

### 4. MCP Settings (MCP)
- Keep existing MCP page functionality
- Integrate into the tabbed layout
- Existing MCP server CRUD

### 5. Agents Settings (Agents) — Full cc-haha implementation
- **Agent List**: Grouped by source (userSettings, projectSettings, localSettings, policySettings, plugin, flagSettings, built-in)
- **Summary Cards**: total agents, active agents, source count
- **Agent Detail View**: agent type, source, model, status, tools list, system prompt
- **Back Navigation**: Return to agent list from detail view
- **Markdown Rendering**: System prompts and descriptions rendered as markdown

### 6. Skills Settings (技能) — Full cc-haha implementation
- **Skill List**: Browse and search installed skills
- **Skill Detail**: Description, source, enable/disable toggle
- **Search Mode**: Filter skills by name

### 7. Plugins Settings (插件) — Full cc-haha implementation
- **Plugin List**: Browse and search installed plugins
- **Plugin Detail**: Description, source, version, enable/disable toggle
- **Search Mode**: Filter plugins by name

### 8. Computer Use Settings
- Screenshot tool configuration
- Computer use permission settings
- Tool enable/disable toggles

### 9. Export Settings (导出)
- CSV export redaction mode: full / tools-only / custom
- Custom regex patterns (one per line)
- Reset to defaults button
- (Migrated from current SettingsPage)

### 10. About (关于)
- App icon + name + version number
- GitHub repo link (HappyCode repo)
- Update check functionality
- Author: "HappyToken"
- Social links: HappyCode GitHub repo link only

## Navigation Flow

```
Sidebar → click Settings → activePage = 'settings'
  Sidebar header: "← 设置"
  Left sidebar: tab navigation
  Right content: selected tab content

Click back button (←) → activePage = 'chat'
  Sidebar header returns to normal "HappyCode + History + More"
```

## Technical Approach

### New ActivePage Type
Add `settings` to the existing `ActivePage` type (already exists).

### Settings State Management
Create a new `useSettingsStore` (Zustand) that:
- Tracks the currently selected tab
- Manages pending tab state for deep linking
- Shares state with the sidebar for header changes

### Component Structure
```
src/components/settings/
├── SettingsLayout.tsx      # Main layout: left sidebar + right content
├── SettingsTabs.tsx        # Tab navigation component
├── GeneralSettings.tsx     # General tab content
├── PermissionSettings.tsx  # Permission tab content
├── ProviderSettings.tsx    # Provider management (full implementation)
├── AgentSettings.tsx       # Agent list + detail
├── SkillSettings.tsx       # Skill list + detail
├── PluginSettings.tsx      # Plugin list + detail
├── ComputerUseSettings.tsx # Computer use configuration
├── ExportSettings.tsx      # CSV export settings (migrated)
├── AboutSettings.tsx       # About page
└── index.ts                # Barrel export
```

### Stores Needed
- `useSettingsStore` — settings tab state, pending tab
- `useProviderStore` — provider CRUD, presets, test connection
- `useAgentStore` — agent list, fetch, select
- `useSkillStore` — skill list, select, enable/disable
- `usePluginStore` — plugin list, select, enable/disable

### IPC Channels (for new features)
- `provider:list` — list saved providers
- `provider:create` — create new provider
- `provider:update` — update provider
- `provider:delete` — delete provider
- `provider:activate` — activate provider
- `provider:test` — test provider connection
- `provider:presets` — list available presets
- `provider:settings` — read/write cc-haha settings.json
- `agent:list` — list agents for a project
- `agent:detail` — get agent system prompt
- `skill:list` — list installed skills
- `skill:enable` / `skill:disable` — toggle skill
- `plugin:list` — list installed plugins
- `plugin:enable` / `plugin:disable` — toggle plugin
- `computer-use:config` — read/write computer use config

### Types (electron/shared/types.ts)
Add types for:
- `ProviderConfig` — provider definition
- `ProviderPreset` — preset configuration
- `ProviderTestResult` — test connection result
- `AgentDefinition` — agent with source, tools, systemPrompt
- `SkillDefinition` — skill metadata
- `PluginDefinition` — plugin metadata
- `ComputerUseConfig` — computer use settings

## Error Handling
- Provider test failures shown inline with error message
- Settings JSON validation errors shown below the editor
- Agent/skill/plugin fetch errors shown as empty state with retry button
- All API errors logged to console with user-friendly toast

## Migration Plan
1. Create the tabbed layout shell first
2. Migrate existing settings (agent, API, export) to appropriate tabs
3. Build provider management
4. Build agents, skills, plugins pages
5. Add computer use and about pages
6. Clean up old SettingsPage component

## Out of Scope
- Theme customization beyond light/dark toggle
- Custom keyboard shortcuts
- Import/export settings as file
- Real-time sync across multiple instances