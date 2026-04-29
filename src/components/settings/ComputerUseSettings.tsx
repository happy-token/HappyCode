import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, X, AlertTriangle } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import type {
  ComputerUseConfig,
  ComputerUsePermissionMode,
  ComputerUseGrantFlags,
  ComputerUseAuthorizedApp,
  ComputerUseAppPermissionTier,
  ComputerUseTccState,
  InstalledApp,
} from '../../../electron/shared/types'

// ── Permission modes ──

const PERMISSION_MODE_KEYS = ['default', 'plan', 'acceptEdits', 'dontAsk', 'auto'] as ComputerUsePermissionMode[]
const TIER_KEYS = ['read', 'click', 'full'] as ComputerUseAppPermissionTier[]

// ── Sentinel apps ──

const SHELL_ACCESS_IDS = new Set([
  'com.apple.Terminal', 'com.googlecode.iterm2', 'com.microsoft.VSCode',
  'dev.warp.Warp-Stable', 'com.github.wez.wezterm', 'io.alacritty',
  'net.kovidgoyal.kitty', 'com.jetbrains.intellij', 'com.jetbrains.pycharm',
  'com.jetbrains.CLion', 'com.jetbrains.WebStorm', 'com.jetbrains.GoLand',
  'com.jetbrains.RubyMine', 'com.jetbrains.rider',
])

const FILESYSTEM_ACCESS_IDS = new Set(['com.apple.finder'])
const SYSTEM_SETTINGS_IDS = new Set(['com.apple.systempreferences', 'com.apple.SystemSettings'])

const SENTINEL_WARNINGS: Record<string, string> = {
  shell: 'computerUse.warnings.shell',
  filesystem: 'computerUse.warnings.filesystem',
  systemSettings: 'computerUse.warnings.systemSettings',
}

function getSentinelWarning(bundleId: string): string | null {
  if (SHELL_ACCESS_IDS.has(bundleId)) return SENTINEL_WARNINGS.shell
  if (FILESYSTEM_ACCESS_IDS.has(bundleId)) return SENTINEL_WARNINGS.filesystem
  if (SYSTEM_SETTINGS_IDS.has(bundleId)) return SENTINEL_WARNINGS.systemSettings
  return null
}

function getSentinelWarningText(bundleId: string, t: (key: string) => string): string | null {
  const key = getSentinelWarning(bundleId)
  return key ? t(key) : null
}

// ── Tier options ──

const DEFAULT_GRANT_FLAGS: ComputerUseGrantFlags = {
  clipboardRead: true,
  clipboardWrite: true,
  systemKeyCombos: true,
}

const DEFAULT_CONFIG: ComputerUseConfig = {
  enabled: false,
  permissionMode: 'default',
  screenshotTool: '',
  authorizedApps: [],
  grantFlags: DEFAULT_GRANT_FLAGS,
}

export function ComputerUseSettings(): React.JSX.Element {
  const { t } = useTranslation()
  const [config, setConfig] = useState<ComputerUseConfig>(DEFAULT_CONFIG)
  const [saved, setSaved] = useState(true)
  const [tccState, setTccState] = useState<ComputerUseTccState>({ accessibility: true, screenRecording: true })
  const [installedApps, setInstalledApps] = useState<InstalledApp[]>([])
  const [installedAppsLoading, setInstalledAppsLoading] = useState(false)
  const [appSearch, setAppSearch] = useState('')

  useEffect(() => {
    window.electron.getComputerUseConfig().then((cfg) => {
      setConfig(cfg)
    }).catch(() => { /* defaults */ })

    checkTcc()

    setInstalledAppsLoading(true)
    window.electron.listInstalledApps().then((result) => {
      setInstalledApps(result.apps)
    }).catch(() => { /* ignore */ }).finally(() => {
      setInstalledAppsLoading(false)
    })
  }, [])

  const checkTcc = useCallback(() => {
    window.electron.getMacOsPermissions?.().then((state) => {
      setTccState(state)
    }).catch(() => { /* ignore */ })
  }, [])

  const updateConfig = useCallback((updates: Partial<ComputerUseConfig>) => {
    setConfig((prev) => ({ ...prev, ...updates }))
    setSaved(false)
  }, [])

  const updateGrantFlags = useCallback((flags: Partial<ComputerUseGrantFlags>) => {
    setConfig((prev) => ({
      ...prev,
      grantFlags: { ...prev.grantFlags, ...flags },
    }))
    setSaved(false)
  }, [])

  const updateAppTier = useCallback((bundleId: string, tier: ComputerUseAppPermissionTier) => {
    setConfig((prev) => ({
      ...prev,
      authorizedApps: prev.authorizedApps.map((a) =>
        a.bundleId === bundleId ? { ...a, tier } : a,
      ),
    }))
    setSaved(false)
  }, [])

  const handleSave = useCallback(() => {
    window.electron.setComputerUseConfig(config).then(() => {
      setSaved(true)
    })
  }, [config])

  const removeAuthorizedApp = useCallback((bundleId: string) => {
    updateConfig({
      authorizedApps: config.authorizedApps.filter((a) => a.bundleId !== bundleId),
    })
  }, [config.authorizedApps, updateConfig])

  const openSystemSettings = useCallback((type: 'accessibility' | 'screenRecording') => {
    const url = type === 'accessibility'
      ? 'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility'
      : 'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture'
    window.electron.openUrl?.(url)
  }, [])

  const checkedBundleIds = React.useMemo(
    () => new Set(config.authorizedApps.map((a) => a.bundleId)),
    [config.authorizedApps],
  )

  const toggleAppCheck = useCallback((bundleId: string, checked: boolean) => {
    if (checked) {
      const app = installedApps.find((a) => a.bundleId === bundleId)
      if (!app) return
      const newApp: ComputerUseAuthorizedApp = {
        bundleId: app.bundleId,
        displayName: app.displayName,
        tier: 'click',
      }
      updateConfig({ authorizedApps: [...config.authorizedApps, newApp] })
    } else {
      updateConfig({
        authorizedApps: config.authorizedApps.filter((a) => a.bundleId !== bundleId),
      })
    }
  }, [installedApps, config.authorizedApps, updateConfig])

  const filteredInstalled = React.useMemo(
    () => installedApps.filter(
      (a) => !checkedBundleIds.has(a.bundleId) && (!appSearch || a.displayName.toLowerCase().includes(appSearch.toLowerCase()) || a.bundleId.toLowerCase().includes(appSearch.toLowerCase())),
    ),
    [installedApps, checkedBundleIds, appSearch],
  )

  const needsTcc = !tccState.accessibility || !tccState.screenRecording

  return (
    <div className="max-w-[640px]">
      <div className="mb-4">
        <div className="text-[16px] font-bold text-[var(--color-text)]">Computer Use</div>
        <div className="mt-0.5 text-[12px] text-[var(--color-text-muted)]">{t('computerUse.description')}</div>
      </div>

      <div className="flex flex-col gap-6">
        {needsTcc && (
          <TccPanel
            tccState={tccState}
            onOpen={openSystemSettings}
            onRetry={checkTcc}
            t={t}
          />
        )}

        <Section title={t('computerUse.enableSection')}>
          <ToggleGroup
            options={[
              { value: true, label: t('computerUse.on') },
              { value: false, label: t('computerUse.off') },
            ]}
            value={config.enabled}
            onChange={(v) => updateConfig({ enabled: v })}
          />
        </Section>

        <Section title={t('computerUse.defaultModeSection')}>
          <div className="flex flex-col gap-2">
            {PERMISSION_MODE_KEYS.map((mode) => (
              <label
                key={mode}
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-[8px] p-3 transition-all',
                  config.permissionMode === mode
                    ? 'border-[1.5px] border-[var(--color-accent)] bg-[var(--color-accent-dim)]'
                    : 'border border-[var(--color-border)] bg-transparent'
                )}
              >
                <input
                  type="radio"
                  name="permissionMode"
                  checked={config.permissionMode === mode}
                  onChange={() => updateConfig({ permissionMode: mode })}
                  className="mt-0.5 flex-shrink-0 [accent-color:var(--color-accent)]"
                />
                <div className="flex flex-1 items-center gap-2">
                  <div>
                    <div className="text-[12px] font-semibold text-[var(--color-text)]">{t(`computerUse.modes.${mode}`)}</div>
                    <div className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">{t(`computerUse.modes.${mode}Desc`)}</div>
                  </div>
                </div>
              </label>
            ))}
          </div>
        </Section>

        {/* Section 3: Authorized Apps */}
        <Section title={t('computerUse.authorizedAppsSection')}>
          <input
            value={appSearch}
            onChange={(e) => setAppSearch(e.target.value)}
            placeholder={t('computerUse.searchPlaceholder')}
            className="box-border mb-2 w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-[10px] py-[6px] text-[12px] text-[var(--color-text)]"
          />

          {config.authorizedApps.length > 0 && (
            <div className="mb-3">
              <div className="mb-2 text-[11px] font-semibold text-[var(--color-text)]">
                {t('computerUse.authorized')} ({config.authorizedApps.length})
              </div>
              <div className="flex flex-col gap-1">
                {config.authorizedApps.map((app) => {
                  const warning = getSentinelWarningText(app.bundleId, t)
                  return (
                    <div
                      key={app.bundleId}
                      className={cn(
                        'flex items-center gap-2 rounded-[6px] px-[10px] py-2 border',
                        warning
                          ? 'border-[var(--color-danger)] bg-[rgba(239,68,68,0.05)]'
                          : 'border-[var(--color-border)] bg-[var(--color-surface-2)]'
                      )}
                    >
                      <span className="h-2 w-2 flex-shrink-0 rounded-full bg-[var(--color-accent)]" />
                      <div className="min-w-0 flex-1">
                        <div className="text-[12px] font-semibold text-[var(--color-text)]">{app.displayName}</div>
                        <div className="font-mono text-[9px] text-[var(--color-text-muted)]">{app.bundleId}</div>
                      </div>
                      {warning && (
                        <span title={warning}><AlertTriangle size={11} className="flex-shrink-0 text-[var(--color-danger)]" /></span>
                      )}
                      <select
                        value={app.tier}
                        onChange={(e) => updateAppTier(app.bundleId, e.target.value as ComputerUseAppPermissionTier)}
                        className="flex-shrink-0 cursor-pointer rounded-[4px] border border-[var(--color-border)] bg-[var(--color-surface)] px-1.5 py-0.5 text-[11px] text-[var(--color-text-muted)]"
                      >
                        {TIER_KEYS.map((key) => (
                          <option key={key} value={key}>{t(`computerUse.accessLevels.${key}`)}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => removeAuthorizedApp(app.bundleId)}
                        className="flex-shrink-0 cursor-pointer rounded-[4px] border border-[var(--color-border)] bg-transparent px-2 py-0.5 text-[11px] text-[var(--color-text-muted)]"
                      >
                        {t('computerUse.remove')}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Available installed apps */}
          <div className="mb-2 text-[11px] font-semibold text-[var(--color-text)]">
            {installedAppsLoading ? t('computerUse.scanning') : `${t('computerUse.selectApp')} (${filteredInstalled.length}/${installedApps.length})`}
          </div>
          {installedAppsLoading && (
            <div className="py-2 text-[11px] text-[var(--color-text-muted)]">{t('computerUse.scanning')}</div>
          )}
          {!installedAppsLoading && filteredInstalled.length === 0 && (
            <div className="py-2 text-[11px] text-[var(--color-text-muted)]">
              {installedApps.length === 0 ? t('computerUse.noAvailableApps') : t('computerUse.noAppsFound')}
            </div>
          )}
          {!installedAppsLoading && (
            <div className="flex max-h-[320px] flex-col gap-0.5 overflow-y-auto">
              {filteredInstalled.map((app) => {
                const warning = getSentinelWarning(app.bundleId)
                const isChecked = checkedBundleIds.has(app.bundleId)
                return (
                  <label
                    key={app.bundleId}
                    className={cn(
                      'flex cursor-pointer items-center gap-2 rounded-[6px] px-[10px] py-1.5 transition-all',
                      isChecked
                        ? 'border border-[var(--color-accent)] bg-[var(--color-accent-dim)]'
                        : 'border border-[var(--color-border)] bg-transparent'
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => toggleAppCheck(app.bundleId, e.target.checked)}
                      className="flex-shrink-0 [accent-color:var(--color-accent)]"
                    />
                    <div className="min-w-0 flex-1">
                      <div className={cn('text-[11px]', isChecked ? 'font-semibold text-[var(--color-text)]' : 'font-normal text-[var(--color-text-muted)]')}>
                        {app.displayName}
                      </div>
                      <div className="font-mono text-[9px] text-[var(--color-text-muted)]">{app.bundleId}</div>
                    </div>
                    {warning && (
                      <AlertTriangle size={11} className="flex-shrink-0 text-[var(--color-danger)]" />
                    )}
                  </label>
                )
              })}
            </div>
          )}
        </Section>

        {/* Section 4: Grant Flags */}
        <Section title={t('computerUse.permissionsSection')}>
          <div className="flex flex-col gap-2.5">
            <ToggleRow
              label={t('computerUse.allowReadClipboard')}
              desc={t('computerUse.allowReadClipboardDesc')}
              checked={config.grantFlags.clipboardRead}
              onChange={(v) => updateGrantFlags({ clipboardRead: v })}
            />
            <ToggleRow
              label={t('computerUse.allowWriteClipboard')}
              desc={t('computerUse.allowWriteClipboardDesc')}
              checked={config.grantFlags.clipboardWrite}
              onChange={(v) => updateGrantFlags({ clipboardWrite: v })}
            />
            <ToggleRow
              label={t('computerUse.allowSystemShortcuts')}
              desc={t('computerUse.allowSystemShortcutsDesc')}
              checked={config.grantFlags.systemKeyCombos}
              onChange={(v) => updateGrantFlags({ systemKeyCombos: v })}
            />
          </div>
        </Section>

        {/* Section 5: Screenshot Tool */}
        <Section title={t('computerUse.screenshotToolSection')}>
          <input
            value={config.screenshotTool || ''}
            onChange={(e) => updateConfig({ screenshotTool: e.target.value })}
            placeholder={t('computerUse.screenshotToolPlaceholder')}
            className="box-border w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-[10px] py-[6px] text-[12px] text-[var(--color-text)]"
          />
        </Section>

        {/* Save button */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={saved}
            className={cn(
              'rounded-[var(--radius-sm)] border-none px-6 py-2 text-[12px] font-semibold transition-all',
              saved
                ? 'cursor-default bg-[var(--color-surface-2)] text-[var(--color-text-muted)] opacity-60'
                : 'cursor-pointer bg-[var(--color-accent)] text-white'
            )}
          >
            {saved ? t('computerUse.saved') : t('computerUse.save')}
          </button>
        </div>

        {/* Security Warning */}
        <div className="rounded-[8px] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3">
          <div className="text-[11px] leading-[1.6] text-[var(--color-text-muted)]">
            {t('computerUse.infoText')}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── TCC Panel ──

function TccPanel({ tccState, onOpen, onRetry, t }: {
  tccState: ComputerUseTccState
  onOpen: (type: 'accessibility' | 'screenRecording') => void
  onRetry: () => void
  t: (key: string) => string
}) {
  return (
    <div
      className="rounded-[8px] p-3 border border-[var(--color-danger)] bg-[rgba(239,68,68,0.05)]"
    >
      <div className="mb-2 text-[12px] font-bold text-[var(--color-text)]">
        {t('computerUse.needsPermissions')}
      </div>
      <div className="mb-2.5 flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-text-muted)]">
          {tccState.accessibility
            ? <Check size={12} className="flex-shrink-0 text-[var(--color-success)]" />
            : <X size={12} className="flex-shrink-0 text-[var(--color-danger)]" />}
          {t('computerUse.accessibility')}
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-text-muted)]">
          {tccState.screenRecording
            ? <Check size={12} className="flex-shrink-0 text-[var(--color-success)]" />
            : <X size={12} className="flex-shrink-0 text-[var(--color-danger)]" />}
          {t('computerUse.screenRecording')}
        </div>
      </div>
      <div className="flex gap-2">
        {!tccState.accessibility && (
          <button
            onClick={() => onOpen('accessibility')}
            className="cursor-pointer rounded-[4px] border border-[var(--color-accent)] bg-transparent px-3 py-1 text-[11px] text-[var(--color-accent)]"
          >
            {t('computerUse.openAccessibilitySettings')}
          </button>
        )}
        {!tccState.screenRecording && (
          <button
            onClick={() => onOpen('screenRecording')}
            className="cursor-pointer rounded-[4px] border border-[var(--color-accent)] bg-transparent px-3 py-1 text-[11px] text-[var(--color-accent)]"
          >
            {t('computerUse.openScreenRecordingSettings')}
          </button>
        )}
        <button
          onClick={onRetry}
          className="cursor-pointer rounded-[4px] border border-[var(--color-border)] bg-transparent px-3 py-1 text-[11px] text-[var(--color-text-muted)]"
        >
          {t('computerUse.recheck')}
        </button>
      </div>
    </div>
  )
}

// ── Sub-components ──

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2.5 text-[12px] font-semibold text-[var(--color-text)]">{title}</div>
      {children}
    </div>
  )
}

function ToggleGroup({ options, value, onChange }: { options: { value: boolean; label: string }[]; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex gap-2">
      {options.map((opt) => (
        <button
          key={String(opt.value)}
          onClick={() => onChange(opt.value)}
          className={cn(
            'cursor-pointer rounded-[var(--radius-sm)] px-4 py-1.5 text-[12px]',
            value === opt.value
              ? 'border border-[var(--color-accent)] bg-[var(--color-accent-dim)] text-[var(--color-accent)]'
              : 'border border-[var(--color-border)] bg-transparent text-[var(--color-text-muted)]'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function ToggleRow({ label, desc, checked, onChange }: { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between rounded-[6px] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2">
      <div>
        <div className="text-[12px] font-semibold text-[var(--color-text)]">{label}</div>
        <div className="mt-px text-[11px] text-[var(--color-text-muted)]">{desc}</div>
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 [accent-color:var(--color-accent)]"
      />
    </label>
  )
}
