# 报告电子签名回执对抗性审查记录

| 项目 | 内容 |
| --- | --- |
| Review ID | `REV-REPORT-SIGNATURE-001` |
| 审查对象 | `DES-REPORT-SIGNATURE-001` / `T-604` / `FR-REPORT-007` |
| 审查人 | Codex |
| 日期 | 2026-07-19 |
| 状态 | Approved |

## 审查范围

- 仅允许 `PUBLISHED` 报告签署，签署人必须具有 `report.publish` 权限。
- 签名哈希由数据库事务 RPC 根据报告编号、版本和完整快照计算，客户端不得提交或覆盖签名字段。
- 签名回执追加写入且同一报告只能有一条；直接表写入、更新和删除均应被拒绝。
- 签名审计与报告状态流转审计分开校验，未认证 API 访问必须返回 401。
- 明确当前实现是 LIMS 内部电子签名回执，不宣称外部 CA/HSM 或法定证书签名能力。

## 发现与处置

| ID | 级别 | 场景 | 处置 | 状态 |
| --- | --- | --- | --- | --- |
| REV-REPORT-SIGNATURE-001-01 | P1 | 客户端提交 `signatureHash`、`signedBy` 等回执字段 | `buildReportTransitionRequest` 统一拒绝签名身份、哈希和时间字段；单元测试覆盖 | Closed |
| REV-REPORT-SIGNATURE-001-02 | P1 | 对非发布报告或无 `report.publish` 权限签署 | `sign_report` 锁定报告后检查状态和权限；服务端映射为 403/409 | Closed |
| REV-REPORT-SIGNATURE-001-03 | P1 | 重复签名或篡改既有签名 | `unique(report_id)`、不可变触发器和集成负向用例覆盖 | Closed |
| REV-REPORT-SIGNATURE-001-04 | P1 | 签名成功但审计缺失 | RPC 在同一事务中调用 `record_audit_event`；集成脚本校验 `SIGN` 审计 | Closed |
| REV-REPORT-SIGNATURE-001-05 | P2 | 远程迁移和正向集成无法执行 | 历史 `.env.local` 与 `.env.demo.local` Supabase REST service key 401 已由恢复后的正式项目 CLI/service key 复测闭环；`ENV-601-001` 已关闭 | Closed |
| REV-REPORT-SIGNATURE-001-06 | P1 | `security definer` 函数在 `search_path = public` 下无法解析 `pgcrypto.digest` | 新增 `202607190001_fix_report_signature_digest.sql`，显式调用 `extensions.digest(..., 'sha256'::text)`；`DEF-604-001` 已复测关闭 | Closed |

## 本地验证证据

- `tests/unit/reporting-validation.test.ts`：覆盖签名字段伪造拒绝。
- `tests/e2e/report-access.spec.ts`：未认证报告 API/页面保护通过。
- `npm.cmd run lint`、`npx.cmd tsc --noEmit`、`npm.cmd run build`：通过。
- `specs/001-lims-core/contracts/openapi.yaml`：OpenAPI YAML 解析通过；包含签名 API、回执和报告快照字段。
- `npm.cmd run test:report-integration`：正式项目迁移修复后通过发布后签名、重复签名、签名不变性、审计、权限负向和清理验证；`cleanupVerified=true` 且临时资源全为 0。

## 结论

本地实现和对抗性覆盖满足 T-604A～T-604C；远程 migration、正向/负向集成、清理验证和最终质量门禁均已完成，批准关闭 `T-604D`。
