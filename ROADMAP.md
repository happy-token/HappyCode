# ROADMAP

以下为已规划但尚未排期的功能方向，待 Phase 1 完成后按优先级插入执行序列。

---

## IM 远程支持

通过 IM 机器人远程触发 Claude Code 任务，结果推回对话。

**支持渠道：**
- 微信（企业微信 / 个人微信 via WeChatFerry 或 webhook）
- 飞书（Feishu Bot，官方 webhook + 事件订阅）
- Telegram（Bot API，长轮询或 webhook）

**架构思路：**
- 主进程内嵌轻量 IM Gateway（复用 Phase 2 的 Express，端口 37422）
- 每个渠道实现统一 `IMAdapter` 接口：`send(text)` / `onMessage(handler)`
- 消息路由到 AgentManager，结果流式回推到 IM 对话
- 凭证（Bot Token 等）存 Electron safeStorage，不落磁盘明文

**IPC 通道（预留）：**
```typescript
'im:list-channels'     // → { channels: IMChannelInfo[] }
'im:connect'           // { channel, credentials }
'im:disconnect'        // { channel }
'im:send'              // { channel, chatId, text }
```

---

## 菜单栏图标（Tray）操作

在系统菜单栏常驻图标，支持快捷操作，无需打开主窗口。

**功能范围：**
- 显示当前活跃 session 数量和状态
- 快速新建 session（弹出 mini 输入框）
- 查看最近 N 条 session 摘要
- 一键暂停 / 恢复所有 session
- 打开主窗口 / 偏好设置

**实现要点：**
- `Tray` + `Menu` 在主进程创建，随 app 生命周期
- 动态菜单：session 状态变化时调用 `tray.setContextMenu()` 刷新
- mini 输入框用独立 `BrowserWindow`（frameless，固定尺寸）
- 支持 macOS / Windows（Linux 可选）

---

## Session 消息状态维护 + 通知

持久化 session 消息状态，在关键节点推送系统通知。

**状态机：**
```
idle → running → waiting_permission → running → done / error
```

**通知触发点：**
- session 完成（`agent:done`）
- session 出错（`agent:error`）
- 需要用户授权工具（`agent:permission-request`，窗口不在前台时）
- 长时间无响应（超时阈值可配置，默认 5 分钟）

**实现要点：**
- 使用 Electron `Notification` API（主进程），无需第三方依赖
- 通知点击跳转到对应 session
- 状态持久化到 SQLite（`session_status` 表），重启后可恢复
- 用户可在设置中关闭各类通知

**IPC 通道（预留）：**
```typescript
'notification:config'  // { enabled, events: NotificationEvent[] }
'session:status'       // { sessionId } → SessionStatus
```

---

## TokenUsage 集成

将外部 TokenUsage 项目的统计能力内嵌到 HappyCode，统一展示用量和成本。

**功能范围：**
- 读取 TokenUsage 的本地数据源（SQLite / JSON）或直接复用其解析逻辑
- 在 HappyCode 内展示：按日 / 周 / 月的 token 消耗、估算成本、模型分布
- 与 Phase 0 的 JSONL token 计数打通，避免重复解析
- 支持多 API Key / 多 profile 聚合

**集成方式（待确认 TokenUsage 数据格式后选择）：**
- 方案 A：直接读取 TokenUsage 的 SQLite 文件（零依赖，推荐）
- 方案 B：作为 npm 包引入，调用其导出的解析函数
- 方案 C：通过本地 HTTP API 对接（TokenUsage 需先启动）

**UI 位置：** 侧边栏新增「用量」Tab，使用 Recharts 渲染图表（Phase 3 技术栈已包含）。
