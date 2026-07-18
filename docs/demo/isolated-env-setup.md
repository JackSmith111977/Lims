# 隔离演示环境配置

本文件用于把本地应用临时连接到 Supabase `test` 项目，不改写正式项目的 `.env.local`，也不保存任何真实密钥。

## 配置

1. 复制 `docs/demo/demo.env.local.example` 到仓库根目录 `.env.demo.local`。
2. 在 Supabase `test` 项目的 API Keys 页面分别填入同一项目的 Publishable key 和 Secret key；不要把值写入文档、提交记录或聊天消息。
3. 在 PowerShell 中运行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\integration\with-demo-env.ps1 -Action preflight
```

脚本只把四个允许的变量注入当前子进程；它不会改写 `.env.local`。门禁会校验项目 URL、旧版 JWT key 的 `ref`/`role`，并通过 `auth/v1/health` 验证新版 key 确实被隔离项目接受。

## 启动应用

先执行 `npm.cmd run build`，再运行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\integration\with-demo-env.ps1 -Action start -Port 3100
```

只有 `Demo preflight: PASSED` 后才允许开始 `demo-runbook.md` 的页面级演练。演练结束仍须通过受控 Dashboard/Auth UI 清理账号，并在隔离项目执行 `demo-cleanup.sql` 后做只读残留核对。
