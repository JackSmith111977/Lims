# 报告电子签名设计

| Item | Value |
| --- | --- |
| Design ID | `DES-REPORT-SIGNATURE-001` |
| Status | Approved |
| Scope | `FR-REPORT-007`、`NFR-SEC-001～002` |
| Depends | `DES-REPORTING-001` |

## 1. 边界与语义

本任务实现应用内电子签名回执，不声称具有外部 CA、证书、时间戳服务或法律意义上的正式签署效力。签名只能作用于 `PUBLISHED` 的不可变报告；服务端对报告编号、版本和 JSON 快照按固定字符串计算 SHA-256，保存签名人、签署时间、算法类型和可选备注。

签名表为一份报告最多一条签名的追加记录；不提供撤销、覆盖或删除接口。若报告需要修订，必须生成新版本并重新签署。历史报告和签名回执通过 `report.read` 读取，签署操作要求 `report.publish`。

## 2. API 与一致性

- `POST /reports/{id}/sign` 只接收可选 `remark`，报告 ID、哈希、签署人、时间和算法由服务端生成。
- 数据库 `sign_report` 事务函数锁定报告、复核当前用户与 `PUBLISHED` 状态、计算快照哈希、写入签名和审计；重复签名返回 `409 REPORT_ALREADY_SIGNED`。
- 直接表写入、修改和删除由 RLS/权限和不可变触发器拒绝；签名回执不把密码、密钥或令牌写入数据库。
- Hash 是完整报告快照的完整性回执，不是外部证书；未来接入 CA/HSM 通过适配器替换，不改变报告 API 版本边界。

## 2.1 数据库函数解析约束

`sign_report` 使用 `security definer` 并固定 `search_path = public`。由于 Supabase 将 `pgcrypto` 扩展函数安装在 `extensions` schema，哈希计算必须显式调用 `extensions.digest`，并将算法参数显式转换为 `text`，避免运行时因 schema 或未知字面量重载解析失败。已应用迁移不得原地修改；修复通过后续迁移替换函数体并保持 RPC 签名不变。

## 3. 验收

- 未发布报告、未认证用户、无 `report.publish` 用户、重复签名和伪造字段均拒绝且不产生第二条签名。
- 已发布报告签名成功，回执包含 `SHA-256` 哈希、签署人和时间，审计对象为 `experiment_report_signature`。
- 读取报告或签名不泄露凭据；历史报告签名不会被后续报告版本修改。
- 远程数据库签名成功，且 `digest` 函数在受限 `search_path` 下仍可解析；复测包含重复签名、直接写入拒绝、审计和自动清理。
