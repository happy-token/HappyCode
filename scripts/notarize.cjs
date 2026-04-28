require('dotenv').config()
const { notarize } = require('@electron/notarize')
const { execSync } = require('child_process')

exports.default = async (context) => {
  if (context.electronPlatformName !== 'darwin') return

  const { APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID } = process.env
  if (!APPLE_ID || !APPLE_APP_SPECIFIC_PASSWORD || !APPLE_TEAM_ID) {
    console.warn('跳过公证：.env 中缺少 APPLE_ID / APPLE_APP_SPECIFIC_PASSWORD / APPLE_TEAM_ID')
    return
  }

  const appPath = `${context.appOutDir}/${context.packager.appInfo.productFilename}.app`
  console.log(`公证中：${appPath}`)

  await notarize({
    tool: 'notarytool',
    appPath,
    appleId: APPLE_ID,
    appleIdPassword: APPLE_APP_SPECIFIC_PASSWORD,
    teamId: APPLE_TEAM_ID,
  })

  console.log('公证完成')

  // Staple 票据
  console.log('Stapling 票据...')
  try {
    execSync(`xcrun stapler staple "${appPath}"`, { stdio: 'inherit' })
    console.log('Stapling 完成')
  } catch (err) {
    console.warn('Warning：stapler 失败（应用仍可正常使用）')
  }

  // Gatekeeper 验证
  console.log('Gatekeeper 验证...')
  try {
    execSync(`spctl --assess --type execute --verbose "${appPath}"`, { stdio: 'inherit' })
    console.log('Gatekeeper 验证通过')
  } catch (err) {
    console.warn('Warning：Gatekeeper 检查未通过（CI 环境下正常）')
  }
}
