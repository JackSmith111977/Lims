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

必须使用隔离环境变量重新构建（不能直接复用正式环境构建产物，因为 `NEXT_PUBLIC_*` 会进入浏览器 bundle）：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\integration\with-demo-env.ps1 -Action build
```

构建通过后再运行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\integration\with-demo-env.ps1 -Action start -Port 3100
```

只有 `Demo preflight: PASSED` 后才允许开始 `demo-runbook.md` 的页面级演练。演练结束仍须通过受控 Dashboard/Auth UI 清理账号，并在隔离项目执行 `demo-cleanup.sql` 后做只读残留核对。

## 页面验收临时凭据边界（`NFR-ENV-001`、`NFR-SEC-002`、`AC-ENV-001`、`T-505C`）

如果三个规范占位账号已经存在但没有可用临时密码，页面验收可以由具备隔离项目权限的本机受控流程为这些账号生成一次性随机密码。密码只能存在于当前进程内并仅用于本次隔离登录，不得写入仓库、环境文件、日志、截图或聊天；不得为正式 `SchoolWork` 项目执行该操作。演练完成后，必须先通过支持的 Auth API 或 Dashboard Auth Users 删除演示账号，再执行 `demo-cleanup.sql` 并用只读查询确认公开 `DEMO_` 残留为 0。该流程只服务于 T-505C/T-506C 的隔离验收，不改变产品登录契约。
