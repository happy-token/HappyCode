/**
 * List installed macOS applications using Spotlight (mdfind).
 * Mirrors cc-haha's installed_apps() — finds .app bundles and reads CFBundleIdentifier / CFBundleName from plist.
 */

import { execSync } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'

export interface InstalledApp {
  bundleId: string
  displayName: string
  path: string
}

// ── Noise filtering (mirrors cc-haha appNames.ts) ──

const PATH_ALLOWLIST = ['/Applications/', '/System/Applications/']

const NAME_PATTERN_BLOCKLIST: RegExp[] = [
  /Helper(?:$|\s\()/,
  /Agent(?:$|\s\()/,
  /Service(?:$|\s\()/,
  /Uninstaller(?:$|\s\()/,
  /Updater(?:$|\s\()/,
  /^\./,
]

// Always-keep bundle IDs — bypass path + name filters (trusted vendors)
const ALWAYS_KEEP = new Set([
  'com.apple.Safari',
  'com.google.Chrome',
  'com.microsoft.edgemac',
  'org.mozilla.firefox',
  'company.thebrowser.Browser',
  'com.tinyspeck.slackmacgap',
  'us.zoom.xos',
  'com.microsoft.teams2',
  'com.microsoft.teams',
  'com.apple.MobileSMS',
  'com.apple.mail',
  'com.microsoft.Word',
  'com.microsoft.Excel',
  'com.microsoft.Powerpoint',
  'com.microsoft.Outlook',
  'com.apple.iWork.Pages',
  'com.apple.iWork.Numbers',
  'com.apple.iWork.Keynote',
  'com.google.GoogleDocs',
  'notion.id',
  'com.apple.Notes',
  'md.obsidian',
  'com.linear',
  'com.figma.Desktop',
  'com.github.GitHubDesktop',
  'com.apple.finder',
  'com.apple.iCal',
  'com.apple.systempreferences',
  'com.apple.Terminal',
  'com.googlecode.iterm2',
  'com.microsoft.VSCode',
])

function isUserFacingPath(appPath: string): boolean {
  if (PATH_ALLOWLIST.some((root) => appPath.startsWith(root))) return true
  const home = process.env.HOME || os.homedir()
  const userApps = home.endsWith('/') ? `${home}Applications/` : `${home}/Applications/`
  if (appPath.startsWith(userApps)) return true
  return false
}

function isNoisyName(name: string): boolean {
  return NAME_PATTERN_BLOCKLIST.some((re) => re.test(name))
}

function readPlistValues(appPath: string): { bundleId?: string; displayName?: string } {
  const infoPlist = path.join(appPath, 'Contents', 'Info.plist')
  if (!fs.existsSync(infoPlist)) return {}
  try {
    // Use plutil to convert plist to JSON
    const json = execSync(`/usr/bin/plutil -convert json -o - '${infoPlist}'`, {
      encoding: 'utf-8',
      timeout: 3000,
    })
    const data: Record<string, unknown> = JSON.parse(json)
    return {
      bundleId: data.CFBundleIdentifier as string | undefined,
      displayName: (data.CFBundleDisplayName ?? data.CFBundleName) as string | undefined,
    }
  } catch {
    return {}
  }
}

export function listInstalledApps(): InstalledApp[] {
  if (process.platform !== 'darwin') return []

  const home = process.env.HOME || os.homedir()
  const searchPaths = [
    '/Applications',
    '/System/Applications',
    path.join(home, 'Applications'),
  ].filter((p) => fs.existsSync(p))

  // Use mdfind to find all .app bundles (fast, covers Spotlight-indexed apps)
  const appDirs: string[] = []
  for (const root of searchPaths) {
    try {
      const result = execSync(
        `mdfind 'kMDItemContentType == com.apple.application-bundle' -onlyin '${root}' 2>/dev/null`,
        { encoding: 'utf-8', timeout: 10_000 },
      )
      appDirs.push(
        ...result
          .split('\n')
          .filter(Boolean)
          .filter((p) => p.endsWith('.app')),
      )
    } catch {
      // mdfind failed — fallback to fs.readdir
      try {
        const entries = fs.readdirSync(root)
        for (const entry of entries) {
          const full = path.join(root, entry)
          if (entry.endsWith('.app')) {
            appDirs.push(full)
          } else {
            // recurse one level (e.g. "Microsoft Office/Word.app")
            try {
              const sub = fs.readdirSync(full)
              for (const s of sub) {
                if (s.endsWith('.app')) appDirs.push(path.join(full, s))
              }
            } catch {
              /* skip */
            }
          }
        }
      } catch {
        /* skip unreadable root */
      }
    }
  }

  const results = new Map<string, InstalledApp>()

  for (const appDir of appDirs) {
    const plist = readPlistValues(appDir)
    const bundleId = plist.bundleId
    if (!bundleId) continue

    // Deduplicate by bundleId — keep first occurrence
    if (results.has(bundleId)) continue

    const isTrusted = ALWAYS_KEEP.has(bundleId)
    const displayName = plist.displayName || path.basename(appDir, '.app')

    if (!isTrusted) {
      if (!isUserFacingPath(appDir)) continue
      if (isNoisyName(displayName)) continue
    }

    results.set(bundleId, { bundleId, displayName, path: appDir })
  }

  return [...results.values()].sort((a, b) => a.displayName.toLowerCase().localeCompare(b.displayName.toLowerCase()))
}
