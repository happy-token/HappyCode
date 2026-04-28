# Build 指南

## 开发模式

```bash
pnpm dev
```

启动 Electron 热重载开发服务器。支持 HMR。

## 类型检查

```bash
pnpm typecheck        # 全量
pnpm typecheck:node   # 主进程 + preload
pnpm typecheck:web    # 渲染进程
```

## 测试

```bash
pnpm test          # 运行一次
pnpm test:watch    # watch 模式
```

## 本地打包

```bash
pnpm package
```

等同于 `pnpm build && electron-builder`。

签名和公证依赖 `.env` 中的环境变量：
- 如果 `.env` 已配置 Apple 凭证 → 本地自动签名 + 公证
- 如果 `.env` 不存在或缺少凭证 → 签名/公证自动跳过

产物在 `dist/` 目录：
- macOS: `dist/HappyCode-x.x.x.dmg`（x64 + arm64）
- Windows: `dist/HappyCode Setup x.x.x.exe`
- Linux: `dist/HappyCode-x.x.x.AppImage`

## CI 发布

```bash
bash scripts/release.sh
```

交互式选择版本号 → 更新 package.json → commit → tag → push。
推送 tag 后 GitHub Actions 自动：

1. 在 macos/windows/ubuntu runner 上分别构建
2. macOS 走完整签名 + 公证 + stapler 流程
3. 全部成功后创建 GitHub Release 并上传产物

### GitHub Secrets 要求

| Secret | 说明 |
|---|---|
| `APPLE_ID` | Apple 开发者账号 |
| `APPLE_APP_SPECIFIC_PASSWORD` | App 专用密码 |
| `APPLE_TEAM_ID` | Team ID |
| `CSC_NAME` | 签名证书 CN |
| `CSC_LINK` | p12 证书 base64 |
| `CSC_KEY_PASSWORD` | p12 密码 |
