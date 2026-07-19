# 数据库备份与恢复操作手册

| 项目 | 内容 |
| --- | --- |
| 关联 Spec | `FR-AUDIT-006`、`NFR-BACKUP-001`、`AC-AUDIT-002` |
| 关联设计 | [`DES-BACKUP-RECOVERY-001`](../../specs/001-lims-core/design-backup-recovery.md) |
| 适用环境 | 本地 Windows 开发机、Supabase 托管演示项目 |
| 操作人 | 具备项目和数据库管理权限的系统管理员 |

> 本手册只提供受控运维步骤。不要把真实 token、数据库密码、service role key、连接串、真实用户数据或备份文件提交到 Git、聊天记录或论文截图。

## 1. 备份前检查

本项目演示环境的基线 RPO 是最近一次逻辑备份，RTO 取决于数据库规模和恢复耗时；托管日备份和 PITR 的 RPO/RTO 受 Supabase 计划和恢复点约束，不能当作无条件 SLA。

1. 在发布/migration 工单中记录当前 Git 提交、Supabase project ref、数据库版本、备份原因和计划维护窗口。
2. 确认没有正在执行的 migration、批量导入、审核发布或远程集成测试；临时测试数据先清理并核对为 0。
3. 在本机环境变量或密码管理器中设置凭据，不要直接写入 PowerShell 历史或脚本文件：

```powershell
$env:SUPABASE_ACCESS_TOKEN = "<仅在本机设置的 Supabase access token>"
$env:SUPABASE_DB_PASSWORD = "<仅在本机设置的数据库密码>"
$env:PROJECT_REF = "<Supabase project ref>"
$env:BACKUP_DIR = Join-Path $env:USERPROFILE ("lims-backups\" + (Get-Date -Format "yyyyMMdd-HHmmss"))
New-Item -ItemType Directory -Force -Path $env:BACKUP_DIR | Out-Null
```

4. 检查 CLI：

```powershell
npx.cmd supabase --version
npx.cmd supabase db dump --help
```

如果项目尚未链接，使用一次性密码环境变量完成链接；已链接项目不要重复覆盖配置：

```powershell
npx.cmd supabase link --project-ref $env:PROJECT_REF --password $env:SUPABASE_DB_PASSWORD
```

## 2. 创建逻辑备份

以下命令将 schema、业务数据和自定义数据库角色分开保存。`schema.sql` 是应急参考，正式结构仍以仓库 migration 为准。

```powershell
npx.cmd supabase db dump --linked --schema public -f (Join-Path $env:BACKUP_DIR "schema.sql")
npx.cmd supabase db dump --linked --schema public --data-only --use-copy -f (Join-Path $env:BACKUP_DIR "data.sql")
npx.cmd supabase db dump --linked --role-only -f (Join-Path $env:BACKUP_DIR "roles.sql")

Get-FileHash (Join-Path $env:BACKUP_DIR "schema.sql") -Algorithm SHA256
Get-FileHash (Join-Path $env:BACKUP_DIR "data.sql") -Algorithm SHA256
Get-FileHash (Join-Path $env:BACKUP_DIR "roles.sql") -Algorithm SHA256
```

完成后将备份目录复制到独立加密存储，并记录文件 hash、代码提交和 migration 状态。`/backups/` 已被 Git 忽略，但“被忽略”不等于“可以保存密钥或真实数据”。

数据库逻辑备份不包含实际 Storage 对象；对每个 bucket 另行保存对象清单、路径、大小和校验值，并把对象文件放入独立加密存储。若本次演示没有附件对象，也要在记录中写明“无对象”而不是跳过说明。

## 3. 托管日备份或 PITR 恢复

这是保留原项目 Auth、Storage 和数据库环境的首选路径。

1. 在 Supabase Dashboard 打开 `Database > Backups`，或打开 Point-in-Time Recovery 设置，确认可用恢复点。
2. 选择最接近目标且不晚于故障时间的恢复点；记录预期丢失的数据范围和停机窗口。
3. 冻结应用写入，确认没有不允许丢失的并发事务，执行 Dashboard 的恢复确认。
4. 恢复期间不要重试写操作。完成后检查自定义数据库角色密码、订阅/复制槽和 Realtime 配置；必要时重新配置。
5. 按第 5 节清单验证，全部通过后才解除维护状态。

托管恢复会使项目在恢复期间不可访问，恢复时间取决于数据库大小和恢复点；不要把 PITR 当作免费计划的默认能力。

## 4. 恢复到新项目（逻辑备份）

仅在需要迁移或隔离演练时使用。请先创建目标项目并确认 extension、区域和计算规格。

```powershell
$env:TARGET_DB_URL = "<仅在本机设置并按要求 URL 编码的目标数据库连接串>"

# 目标项目只选择一种结构来源：优先使用仓库 migration。
npx.cmd supabase link --project-ref "<target-project-ref>" --password $env:SUPABASE_DB_PASSWORD
npx.cmd supabase db push --linked --yes

# 使用 data-only 文件导入 public 业务数据；单事务失败即回滚。
psql $env:TARGET_DB_URL --single-transaction --set ON_ERROR_STOP=1 --file (Join-Path $env:BACKUP_DIR "data.sql")
```

如果目标数据库没有 `psql`，先安装与目标 PostgreSQL 主版本兼容的客户端；不要为了“方便”把密码写入命令行文本或仓库。schema-only 文件只用于新项目/取证恢复，不能与已有 migration 无计划地重复执行。

逻辑备份默认不携带 Auth 用户、密码和 Storage 对象。恢复后必须重新建立 Auth 账号/角色映射并单独恢复文件；如果必须保持原用户 UUID 和附件关系，改走第 3 节托管恢复路径。

## 5. 恢复后验证清单

逐项勾选并在演练记录中保存结果：

- [ ] migration history 与目标 Git 提交一致，结构、函数、RLS policy 和唯一约束存在。
- [ ] 项目、任务、样品、实验数据、审核、报告、设备、库存、环境和 `audit_log` 的数量及关键外键关系通过核对。
- [ ] 管理员可登录；停用用户被阻断；普通用户不能越权读取或修改其他数据范围。
- [ ] 关键状态流转、数据处理、结果审核、报告追溯、看板和审计查询通过回归。
- [ ] Storage bucket、对象路径、文件大小和 SHA-256 与独立对象清单一致；无附件时有明确记录。
- [ ] `npm.cmd run lint`、`npm.cmd test`、`npm.cmd run build`、必要 E2E 和远程集成通过。
- [ ] 新环境变量、OAuth/邮件配置、域名和密钥轮换结果已记录，日志中没有秘密值。

## 6. 回滚与故障降级

- 代码问题：回退到上一个稳定提交/tag，数据库采用向前修复 migration。
- 数据误删/污染：先冻结写入并保留当前状态备份，再由管理员审批托管备份/PITR 恢复点；禁止直接执行未经评审的远程 `migration down`。
- Storage 未恢复：应用保持维护或只读提示，禁止展示“附件已恢复”的成功状态。
- Auth 未恢复：禁止批量猜测或导出密码；重新创建账号、强制重置密码并重新绑定 `sys_user`。
- Supabase/网络不可用：保留故障现场和错误日志摘要，等待恢复后进行一次有证据的重试；不要连续重复恢复。

每次回滚或降级都记录：操作者、时间、代码版本、数据库恢复点、备份 hash、影响范围、验证结果和后续行动。

## 7. 参考

- [Supabase Database Backups](https://supabase.com/docs/guides/platform/backups)
- [Supabase Backup and Restore using the CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)
- [Supabase CLI `db dump`](https://supabase.com/docs/reference/cli/supabase-db-dump)
- [Supabase local backup restore](https://supabase.com/docs/guides/local-development/restoring-downloaded-backup)
