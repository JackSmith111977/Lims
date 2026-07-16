# 数据库备份与恢复设计

| 项目 | 内容 |
| --- | --- |
| Design ID | `DES-BACKUP-RECOVERY-001` |
| 来源 Spec | `FR-AUDIT-006`、`NFR-BACKUP-001`、`AC-AUDIT-002`、`BR-003` |
| 状态 | Approved（毕业设计演示规模） |
| 日期 | 2026-07-17 |
| 操作手册 | [`docs/ops/backup-recovery.md`](../../docs/ops/backup-recovery.md) |

## 1. 目标和边界

本设计为 Supabase 托管项目和 Next.js 应用定义可执行的数据库备份、恢复、验证和回滚方案，满足 `FR-AUDIT-006` 与 `NFR-BACKUP-001`。系统不在应用页面中提供危险的“立即恢复”按钮；恢复是由系统管理员在受控维护窗口执行的运维操作。

覆盖范围分为四类：

1. `supabase/migrations/`、代码提交和配置快照：数据库结构与应用版本的可复现事实源。
2. Supabase PostgreSQL 业务数据：表、约束、函数、RLS 和审计数据的托管备份或逻辑备份。
3. Supabase Auth 身份数据：账号、密码哈希和会话由 Supabase 管理，不能用普通业务逻辑备份替代。
4. Supabase Storage 对象：数据库备份只包含对象元数据，不包含实际文件，必须单独导出和校验。

## 2. 备份策略

### 2.1 事实源和备份层级

| 层级 | 方式 | 适用场景 | 恢复能力和限制 |
| --- | --- | --- | --- |
| L0 | Git 提交、migration、`package-lock.json` 和环境变量清单 | 每次变更、发布前 | 可重建代码和结构；不包含业务数据、Auth 密钥或 Storage 文件 |
| L1 | Supabase 托管日备份 | Pro/Team/Enterprise 计划 | 通过 Dashboard 恢复项目；保留天数、停机时间和可用能力由计划决定 |
| L2 | Supabase PITR | 需要更小 RPO 的付费环境 | 可恢复到时间点；需要 PITR add-on 和至少 Small compute，本项目基础环境不默认启用 |
| L3 | `supabase db dump`/`pg_dump` 逻辑备份 | 免费计划、迁移到新项目、离线留存 | 可携带公共业务结构/数据；默认不覆盖托管 Auth、Storage 对象和平台配置 |

官方文档说明 Pro、Team 和 Enterprise 项目提供日备份，免费计划应定期使用 CLI 导出；PITR 是付费能力且需要 Small compute。本项目不把某一付费计划当作基础交付前提，因此 L0+L3 是最低可执行方案，L1/L2 是可选增强。

### 2.2 演示规模的 RPO/RTO 口径

| 场景 | 目标 RPO | 目标 RTO | 说明 |
| --- | --- | --- | --- |
| 发布或 migration 前 | 最近一次手工逻辑备份 | 由备份大小和迁移耗时决定 | 必须先冻结写入或安排维护窗口 |
| 仅使用托管日备份 | 最多约 24 小时的数据窗口 | 由 Supabase 恢复耗时决定 | 这是计划能力的估算，不是 SLA 承诺 |
| 已启用 PITR | 以选定恢复点为准，目标可到秒级 | 由数据库规模和平台恢复耗时决定 | 需要额外付费和容量配置 |
| 仅有代码/migration | 无业务数据恢复能力 | 可重建结构，不等于数据恢复 | 不能把 Git 当作数据库备份 |

恢复前必须记录备份时间、目标恢复点、预期数据损失、预计停机时间和审批人；没有这些信息时只允许做只读检查，不直接覆盖远程数据库。

## 3. 数据覆盖和安全边界

- `public` 业务表、审计日志、函数和策略以 migration 为结构事实源；逻辑备份用于数据携带和离线留存。
- Supabase CLI 的 `db dump` 默认排除 Supabase 管理的 `auth`、`storage` 和扩展 schema。逻辑恢复不能假设会保留 Auth 用户、密码或 Storage 文件。
- 完整项目恢复优先使用 Supabase Dashboard 的日备份/PITR。若恢复到新项目，Auth 用户需要按单独的身份恢复流程处理，不能把密码导出到 SQL 或日志中。
- Storage 对象必须独立导出到受控、加密且与数据库备份不同的存储位置，并保存 bucket、对象路径、大小和校验信息；数据库中的对象路径不能证明文件本身已备份。
- `SUPABASE_ACCESS_TOKEN`、`SUPABASE_DB_PASSWORD`、数据库连接串和 service role key 只能通过本机环境变量或密码管理器提供，不能写入仓库、备份文件名、命令日志或论文截图。
- 备份文件至少执行 SHA-256 校验；备份目录不纳入 Git，项目已在 `.gitignore` 中忽略 `/backups/`。

## 4. 恢复路径选择

### 路径 A：托管日备份或 PITR 恢复原项目

适合需要保留原项目 Auth、Storage、数据库对象和项目配置的完整故障恢复。管理员在 Dashboard 的 Database > Backups 或 Point-in-Time Recovery 中选择恢复点，确认停机影响后执行。恢复期间应用进入维护状态；恢复完成后重置自定义数据库角色密码，重新检查订阅/复制槽，并验证 Auth、Storage、RLS 和应用健康状态。

### 路径 B：逻辑备份恢复到新项目

适合项目迁移、原项目不可用或需要在隔离环境验证数据。流程必须保持以下顺序：

1. 创建目标 Supabase 项目，记录新 project ref，启用源项目使用的扩展和 Storage bucket 结构。
2. 将目标项目链接到本地 CLI，先执行仓库 migration；migration 是结构事实源，不要用未知来源的 schema dump 覆盖版本化结构。
3. 使用数据-only 逻辑备份导入 `public` 数据，采用单事务和 `ON_ERROR_STOP`；失败时整个导入回滚。
4. 按 Auth 恢复清单创建/导入账号并重新核对 `sys_user.id` 外键关系；不能导入密码哈希或会话。
5. 单独恢复 Storage bucket 和对象，核对对象路径、大小和 SHA-256；缺少对象时不得宣称附件恢复完成。
6. 更新应用环境变量和 OAuth/邮件配置，轮换不应继续使用的密钥，完成登录、RLS、关键业务和审计回归。

路径 B 的逻辑备份是“可迁移业务数据”恢复，不是原项目的完全克隆；毕业设计演示如需保留账号和附件，应优先演练路径 A 或在隔离项目中明确补做 Auth/Storage 恢复。

## 5. 验证、回滚和降级

恢复后按以下清单逐项记录结果：

1. migration history 与目标提交一致，关键表、外键、唯一约束、函数、RLS policy 存在。
2. 核对项目、任务、样品、实验数据、审核、报告、设备、库存、环境和 `audit_log` 的数量及关键关联；不在日志中写出实验原始值或用户密码。
3. 使用测试账号验证登录、停用账号阻断、角色菜单、普通用户越权拒绝和管理员查询；确认 Auth 用户与 `sys_user` 关联完整。
4. 运行 `npm.cmd run lint`、`npm.cmd test`、`npm.cmd run build`、未认证 E2E 和关键远程集成；检查看板、报告追溯和审计查询。
5. 独立抽查 Storage 对象可读性、文件大小和校验值；失败时将附件恢复标记为不完整。

回滚遵循“应用回退、数据库向前修复”的原则：代码使用上一个稳定提交/tag，远程数据库不执行未经批准的 `migration down`；数据污染或误删才使用已审批的托管恢复点覆盖数据库。覆盖前必须再做当前状态备份并冻结写入。Supabase 不可用或恢复校验失败时，应用显示维护/只读提示，保留故障现场，不重复盲目恢复。

## 6. 演练频率和责任

- 系统管理员在每次正式 migration、发布前和答辩前至少执行一次逻辑备份与校验清单。
- 指导教师验收时重点检查：备份文件不入库、恢复路径可复现、Auth/Storage 边界已说明、验证结果可追溯。
- 每次演练记录备份时间、代码提交、migration 状态、文件 hash、恢复点、验证结果、失败原因和后续行动；记录可放在 `docs/ops/restore-drills/`，禁止放入真实备份和敏感数据。

## 7. 官方依据

- [Supabase Database Backups](https://supabase.com/docs/guides/platform/backups)
- [Supabase Backup and Restore using the CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)
- [Supabase CLI Reference](https://supabase.com/docs/reference/cli/supabase-db-dump)
- [Restoring a downloaded backup locally](https://supabase.com/docs/guides/local-development/restoring-downloaded-backup)
