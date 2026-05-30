import { ipcMain } from 'electron'
import {
  listSkills,
  installSkillFromGit,
  deleteSkill,
  toggleSkill,
  getSkillContent,
  listPlugins,
  installPlugin,
  uninstallPlugin,
  enablePlugin,
  disablePlugin,
  updatePlugin,
  getPluginReadme,
} from '../skills-manager'

export function registerSkillsHandlers(): void {
  ipcMain.handle('skills:list', () => listSkills())
  ipcMain.handle('skills:install-from-git', (_event, { url, name }: { url: string; name?: string }) =>
    installSkillFromGit(url, name)
  )
  ipcMain.handle('skills:delete', (_event, { skillId }: { skillId: string }) => deleteSkill(skillId))
  ipcMain.handle('skills:toggle', (_event, { skillId, enabled }: { skillId: string; enabled: boolean }) =>
    toggleSkill(skillId, enabled)
  )
  ipcMain.handle('skills:get-content', (_event, { skillPath }: { skillPath: string }) =>
    getSkillContent(skillPath)
  )
  ipcMain.handle('plugins:list', () => listPlugins())
  ipcMain.handle('plugins:install', (_event, { name }: { name: string }) => installPlugin(name))
  ipcMain.handle('plugins:uninstall', (_event, { name }: { name: string }) => uninstallPlugin(name))
  ipcMain.handle('plugins:enable', (_event, { pluginId }: { pluginId: string }) => enablePlugin(pluginId))
  ipcMain.handle('plugins:disable', (_event, { pluginId }: { pluginId: string }) => disablePlugin(pluginId))
  ipcMain.handle('plugins:update', (_event, { pluginId }: { pluginId: string }) => updatePlugin(pluginId))
  ipcMain.handle('plugins:readme', (_event, { pluginId }: { pluginId: string }) => getPluginReadme(pluginId))
}
