# 首个系统管理员初始化

本流程只用于正式项目第一次启用或明确批准的受控恢复，不是公开注册功能。

## 前置条件

- 已确认当前目录和 `.env.local` 指向正式目标 Supabase 项目。
- 已完成 `npx.cmd supabase migration list --linked`，本地和远程 migration 一致。
- 执行人具备该项目的 service role 管理权限。
- 正式环境初始密码只在当前 PowerShell 进程中提供，不写入仓库、`.env`、日志或聊天；当前测试环境的非生产种子见根目录 [`README.md`](../../README.md)。

## PowerShell 执行

```powershell
$env:BOOTSTRAP_ADMIN_EMAIL = "admin@example.com"
$env:BOOTSTRAP_ADMIN_PASSWORD = "仅在当前进程中暂存的强密码"
npm.cmd run bootstrap:admin
Remove-Item Env:BOOTSTRAP_ADMIN_EMAIL -ErrorAction SilentlyContinue
Remove-Item Env:BOOTSTRAP_ADMIN_PASSWORD -ErrorAction SilentlyContinue
```

如果邮箱已存在，脚本不会重置密码，只会复用该 Auth 用户并确保其业务资料和 `SYSTEM_ADMIN` 角色存在；如果邮箱不存在，必须提供初始密码。脚本输出不包含密码、token 或 service role key。

正式启用时必须替换运行时的 `BOOTSTRAP_ADMIN_EMAIL` 和 `BOOTSTRAP_ADMIN_PASSWORD`。脚本入口和读取逻辑位于 [`scripts/ops/bootstrap-admin.mjs`](../../scripts/ops/bootstrap-admin.mjs)；当前测试种子不应继续用于正式环境。

## 完成后

1. 使用该邮箱和初始密码访问 `/login`。
2. 确认登录后进入 `/dashboard`，并可看到用户、角色、设置和审计入口。
3. 进入 `/admin/users` 创建其他实验室用户并分配最小角色。
4. 首次登录后按组织策略修改初始密码，并保存本次初始化审计证据。

## 安全边界

- 不直接插入或修改 `auth.users`；Auth 用户由 Supabase Auth Admin API 管理。
- 不在浏览器端使用 service role key，不新增公开注册页面。
- 不对正式项目执行 demo seed/cleanup；演示账号只允许在隔离项目使用。
