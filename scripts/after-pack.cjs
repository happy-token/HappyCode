const { execSync } = require('child_process')
const path = require('path')
const fs = require('fs')

module.exports = async function afterPack(context) {
  const platform = context.electronPlatformName

  console.log('[afterPack] Rebuilding native modules...')
  execSync('npx electron-rebuild', { stdio: 'inherit' })

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
