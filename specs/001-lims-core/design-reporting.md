# 报告生成、版本与发布设计

| Item | Value |
| --- | --- |
| Design ID | DES-REPORTING-001 |
| Status | Approved |
| Scope | FR-REPORT-001～006、FR-AUDIT-005、AC-REPORT-001 |
| Depends | DES-EXPERIMENT-DATA-001、DES-RESULT-REVIEW-001 |

## 1. 目标与边界

本设计实现报告的生成、版本、查看、状态流转、变更记录和 JSON 文件导出。报告只允许从 `APPROVED` 任务生成，生成时固化任务、样品、实验数据和有效审核记录快照；报告生成后不再动态拼接业务表，避免后续业务数据变化导致历史报告漂移。

FR-REPORT-007 的电子签名/正式签署流程不纳入本次实现，保留 `report.publish` 权限和签署扩展点。

## 2. 状态与版本模型

报告状态为 `DRAFT → REVIEW → PUBLISHED → ARCHIVED`。

- `POST /tasks/{id}/reports` 在任务为 `APPROVED` 且存在 `APPROVED` 有效审核时生成新的 `DRAFT` 版本；版本号按任务锁内的最大值加一，报告编号由服务端根据任务生成。
- `POST /reports/{id}/submit-review` 只允许 `report.manage` 将 `DRAFT` 变为 `REVIEW`。
- `POST /reports/{id}/publish` 只允许 `report.publish` 将 `REVIEW` 变为 `PUBLISHED`；同一报告编号的旧 `PUBLISHED` 版本在同一事务中变为 `ARCHIVED`，不覆盖旧版本。
- `POST /reports/{id}/archive` 只允许 `report.publish` 将 `PUBLISHED` 变为 `ARCHIVED`。
- 报告身份字段、版本号和快照不可修改。每次状态变化写入 `experiment_report_history` 和 `audit_log`，操作人和时间由当前会话/数据库生成。

## 3. 快照内容

`experiment_report.report_payload` 为 JSONB，至少包含：

```json
{
  "task": { "id": 1, "taskCode": "TASK-001", "name": "...", "status": "APPROVED" },
  "samples": [],
  "data": [],
  "reviews": []
}
```

快照中的数据只读，包含来源记录的 ID、类型、值、单位、采集时间、方法/设备引用和审核意见，足以从报告回查任务、样品、结果和审核记录。

## 4. 权限与数据边界

- `report.read`：查看报告、历史、快照和导出文件。
- `report.manage`：生成草稿、提交审核；仅服务端事务函数可以写报告表。
- `report.publish`：发布和归档；项目负责人/教师可发布，但不能生成报告草稿。
- 报告、报告历史和相关快照均由 RLS 通过 `report.read` 保护；客户端不能直接插入、更新或删除。
- 数据库函数锁定目标任务/报告后再验证状态并写入，防止并发生成相同版本或绕过状态机。

## 5. 事务函数与接口

数据库迁移提供四个 `SECURITY DEFINER` 函数：

- `generate_report(_task_id)`：锁任务，校验审核通过，生成版本和快照。
- `submit_report_for_review(_report_id, _remark)`：锁报告并记录 `DRAFT → REVIEW`。
- `publish_report(_report_id, _remark)`：锁报告，归档旧发布版本并发布当前版本。
- `archive_report(_report_id, _remark)`：锁报告并记录 `PUBLISHED → ARCHIVED`。

Next.js 服务层只负责权限校验、输入校验、错误映射和快照序列化；不接收 `generatedBy`、时间、版本号、报告编号或状态作为可信输入。

## 6. 验收与测试重点

- 未审核/退回任务不能生成报告；已通过任务可以生成 DRAFT。
- 同一任务连续生成报告得到递增版本，旧版本快照不改变。
- 非法状态转换、越权生成/发布、直接表写入和伪造服务端字段均被拒绝。
- 发布新版本会归档旧发布版本；历史、审计和快照保持一致。
- `report.read` 用户可以查看和导出，未认证用户页面/API 均被拒绝；临时报告资源可完整清理。
