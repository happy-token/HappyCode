const { execSync } = require('child_process')
const path = require('path')
const fs = require('fs')

module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== 'linux') {
    console.log('[afterPack] Rebuilding native modules...')
    execSync('npx electron-rebuild', { stdio: 'inherit' })

    if (context.electronPlatformName === 'darwin') {
      const appOutDir = context.appOutDir
      const appName = context.packager.appInfo.productFilename
      const appPath = path.join(appOutDir, `${appName}.app`)
      const appAsarPath = path.join(appPath, 'Contents', 'Resources', 'app.asar.unpacked')

      if (fs.existsSync(appAsarPath)) {
        console.log('[afterPack] Re-signing native modules in app.asar.unpacked...')
        signNativeModules(appAsarPath)
      }

      console.log('[afterPack] Re-signing app bundle...')
      const identity = process.env.CSC_NAME || 'Wenjing Zhu (BL67GP4S58)'
      execSync(`codesign --force --deep --sign "${identity}" "${appPath}"`, { stdio: 'inherit' })
    }
  }
}

function signNativeModules(dir) {
  const identity = process.env.CSC_NAME || 'Wenjing Zhu (BL67GP4S58)'

  const files = fs.readdirSync(dir, { withFileTypes: true })
  for (const file of files) {
    const fullPath = path.join(dir, file.name)
    if (file.isDirectory()) {
      signNativeModules(fullPath)
    } else if (file.name.endsWith('.node')) {
      console.log(`[afterPack] Signing: ${fullPath}`)
      execSync(`codesign --force --sign "${identity}" "${fullPath}"`, { stdio: 'inherit' })
    }
  }
}
