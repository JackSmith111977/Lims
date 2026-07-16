# T-504 数据库备份与恢复对抗性审查

| 项目 | 内容 |
| --- | --- |
| Review ID | `REV-BACKUP-RECOVERY-001` |
| 关联设计 | `DES-BACKUP-RECOVERY-001` |
| 关联任务 | `T-504` |
| 审查状态 | Approved（文档任务；真实跨项目恢复演练列为后续运维验证） |

## 审查范围

审查 `FR-AUDIT-006`、`NFR-BACKUP-001` 和 `AC-AUDIT-002` 是否覆盖托管备份、逻辑备份、Auth/Storage 边界、密钥安全、验证、回滚、降级和可复现操作步骤。

## 对抗性检查

| 检查项 | 结果 | 说明 |
| --- | --- | --- |
| 把 Git/migration 当成完整数据备份 | 通过 | 设计明确区分结构事实源和业务数据备份 |
| 逻辑 dump 被误认为包含 Auth/Storage | 通过 | 手册明确说明 CLI dump 的托管 schema/Storage 对象边界，并将完整恢复优先指向托管备份/PITR |
| 恢复覆盖当前数据前没有审批或二次备份 | 通过 | 恢复前冻结写入、记录恢复点、保留当前状态备份并要求管理员审批 |
| 备份命令泄露密码或 token | 通过 | 使用本机环境变量/密码管理器，禁止写入仓库、日志、文件名和论文截图 |
| 备份文件被意外提交 | 通过 | `.gitignore` 忽略 `/backups/`，同时手册说明忽略规则不替代加密和访问控制 |
| 恢复完成但没有业务验证 | 通过 | 包含 migration、数据关联、RLS、Auth、Storage、关键流程和构建回归清单 |
| Supabase 计划/功能差异 | 通过 | 日备份、PITR 和免费计划限制均有条件化说明，不承诺未购买能力 |
| 复制槽或订阅阻塞恢复 | 通过 | 托管恢复步骤要求检查并按平台规则处理复制槽/订阅 |

## 验证证据

- `npm.cmd run check:backup-docs`：通过。
- `npx.cmd supabase db dump --help`：已确认 `--linked`、`--data-only`、`--role-only`、`--schema`、`--file` 和 `--db-url` 能力。
- 官方依据已写入设计和操作手册：Supabase Database Backups、CLI Backup/Restore、`db dump` 和本地备份恢复文档。
- `scripts/sdd/check-consistency.ps1`、`npm.cmd run check:versioning`：通过。

## 已知限制

1. 当前项目没有专门的 Storage 对象导出脚本；手册将其作为独立恢复项，并要求无对象时显式记录，未把数据库元数据误报为文件备份。
2. 当前环境没有创建第二个 Supabase 项目和可公开保存的备份文件，因此本次不执行破坏性跨项目恢复；真实恢复演练应在隔离项目和受控凭据下完成。
3. Auth 密码和会话不进入逻辑备份；需要保留原身份 UUID 时使用托管项目恢复，否则按账号重建和外键核对流程处理。

上述限制均已记录在操作手册，不构成 `FR-AUDIT-006` 的文档交付缺失；跨项目恢复演练属于后续运维增强项。
