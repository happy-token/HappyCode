require('dotenv').config()
const { execSync } = require('child_process')
const path = require('path')
const fs = require('fs')

module.exports = async function afterPack(context) {
  const platform = context.electronPlatformName

  // electron-rebuild is needed because electron-builder may not rebuild
  // native modules against the correct Electron node version.
  console.log('[afterPack] Rebuilding native modules for Electron...')
  try {
    execSync('npx electron-rebuild', { stdio: 'inherit' })
  } catch (err) {
    // npx may fail to find electron-rebuild; fall back to npm/pnpm exec
    try {
      execSync('npm exec electron-rebuild || pnpm exec electron-rebuild', { stdio: 'inherit' })
    } catch (err2) {
      console.warn('[afterPack] electron-rebuild failed, skipping:', err2.message || err.message)
    }
  }

  if (platform !== 'darwin') return

  const identity = process.env.CSC_NAME
  if (!identity) {
    console.warn('[afterPack] CSC_NAME not set, skipping re-sign')
    return
  }

  const appOutDir = context.appOutDir
  const appName = context.packager.appInfo.productFilename
  const appPath = path.join(appOutDir, `${appName}.app`)
  const unpackedPath = path.join(appPath, 'Contents', 'Resources', 'app.asar.unpacked')

  if (fs.existsSync(unpackedPath)) {
    console.log('[afterPack] Re-signing native modules in app.asar.unpacked...')
    signNativeModules(unpackedPath, identity)
  }

  console.log('[afterPack] Re-signing app bundle...')
  execSync(`codesign --force --deep --sign "${identity}" "${appPath}"`, { stdio: 'inherit' })
}

function signNativeModules(dir, identity) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      signNativeModules(fullPath, identity)
    } else if (entry.name.endsWith('.node')) {
      console.log(`[afterPack] Signing: ${fullPath}`)
      execSync(`codesign --force --sign "${identity}" "${fullPath}"`, { stdio: 'inherit' })
    }
  }
}
