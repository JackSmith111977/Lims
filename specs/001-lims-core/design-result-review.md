# 实验结果审核、退回与审核意见设计

| 项目 | 内容 |
| --- | --- |
| Design ID | `DES-RESULT-REVIEW-001` |
| 状态 | Approved |
| 日期 | 2026-07-15 |
| 需求 | `FR-REVIEW-001～006`、`AC-REVIEW-001`、`BR-003`、`BR-005`、`NFR-SEC-002` |
| 依赖 | `DES-TASK-FLOW-001`、`DES-EXPERIMENT-PROCESSING-001` |

## 1. 设计目标与边界

T-304 为已进入 `PENDING_REVIEW` 的实验任务提供结果审核闭环。审核必须能够查看任务、样品、原始/处理/结果数据和处理运行，提交 `APPROVED`、`RETURNED` 或 `NEED_MORE`，保存审核人、时间和意见，并通过事务把任务推进到正确状态。

本阶段包含：

- 审核记录的只读查询和追加式写入；
- 待审核任务、实验数据和处理运行的汇总视图；
- 通过、退回、要求补充三类审核结果；
- 审核权限、任务锁、任务状态历史和审计记录；
- 审核结果、任务状态和审计记录的原子提交；
- `/reviews` 页面及 `/api/v1/tasks/{id}/reviews` 接口。

本阶段不包含：

- 报告生成、发布和版本管理（T-305）；
- 电子签名、多人会签和签名密码（T-604）；
- 审核规则引擎或自动审核；
- 修改实验数据或处理运行记录。

## 2. 审核状态与业务规则

| 审核结果 | 任务目标状态 | 意见要求 | 说明 |
| --- | --- | --- | --- |
| `APPROVED` | `APPROVED` | 可选 | 当前结果通过，允许后续报告生成和归档流程使用 |
| `RETURNED` | `RETURNED` | 必填 | 结果不通过，实验人员按意见补充或重新处理 |
| `NEED_MORE` | `RETURNED` | 必填 | 需要补充数据、说明或处理步骤 |

- 只有当前任务状态为 `PENDING_REVIEW` 时才能提交审核；任务不存在返回 404，其他状态返回 409。
- 审核人必须是 ACTIVE 用户并拥有 `review.manage`；项目负责人/教师、实验室管理员和系统管理员按 RBAC 授权。
- `result_review` 采用追加式历史。同一任务允许多次审核，查询按 `reviewed_at desc, id desc` 返回，最新记录为当前有效审核。
- 通过退回后，任务必须重新执行 `RETURNED → IN_PROGRESS → PENDING_REVIEW`，不能覆盖旧审核记录。
- 审核意见、审核人和时间均由服务端/数据库会话生成；客户端不得传入 `reviewerId`、`reviewedAt`、任务目标状态或审计对象。
- 未通过审核的任务不能直接进入 `ARCHIVED`；现有任务状态机保持 `APPROVED → ARCHIVED` 的前置条件。

## 3. 数据模型、事务与不可变边界

继续复用现有 `result_review`：

`id`、`task_id`、`reviewer_id`、`result`、`comment`、`reviewed_at`、`created_at`。

新增数据库函数 `review_task_result(_task_id, _result, _comment)`，在一个事务中完成：

1. 校验会话用户、`review.manage`、任务存在和 `PENDING_REVIEW` 状态，并锁定任务行；
2. 校验结果枚举和非通过意见；
3. 以 `auth.uid()` 写入一条 `result_review`；
4. 使用任务状态事务标记更新任务状态并写入 `task_status_history`；
5. 写入 `audit_log`，对象类型为 `result_review`，包含任务、结果和目标状态；
6. 返回审核记录和任务状态摘要。

审核记录在应用客户端上只允许 `SELECT`；数据库触发器禁止 `UPDATE/DELETE`，所有写入只能通过安全定义函数完成。函数对任务加 `FOR UPDATE` 锁，重复并发审核只有一个事务能在 `PENDING_REVIEW` 状态校验处成功，另一个事务收到明确的状态冲突错误。

## 4. 服务与 API 契约

新增 `src/lib/server/result-review.ts`：

- `buildReviewRequest` 只接受 `result` 和可选 `comment`，拒绝未知字段和服务端字段；
- `loadTaskReviews` 读取任务、相关实验数据、处理运行和审核历史；
- `reviewTask` 调用事务 RPC 并序列化审核记录；
- 错误映射统一为 `REVIEW_TASK_NOT_FOUND`、`REVIEW_TASK_NOT_PENDING`、`REVIEW_COMMENT_REQUIRED`、`FORBIDDEN` 和 `REVIEW_FAILED`。

| 方法 | 路径 | 权限 | 说明 |
| --- | --- | --- | --- |
| GET | `/api/v1/tasks/{id}/reviews` | `review.read` | 返回任务摘要、数据/运行摘要、审核历史和最新审核 |
| POST | `/api/v1/tasks/{id}/reviews` | `review.manage` | 事务提交审核记录并推进任务状态 |

请求体：

```json
{
  "result": "APPROVED",
  "comment": "数据、处理说明和血缘关系已核对"
}
```

响应使用 `{ data }` 包装。POST 成功返回 201；未认证返回 401，无权限返回 403，任务状态冲突返回 409，缺少退回意见返回 400。

## 5. 页面与交互

`/reviews` 只对拥有 `review.read` 的用户开放：

- 左侧显示 `PENDING_REVIEW` 任务及项目/方法摘要；
- 选择任务后展示数据记录、处理运行状态/判定/血缘和审核历史；
- 拥有 `review.manage` 时显示通过、退回、要求补充操作；
- `RETURNED` 和 `NEED_MORE` 必须填写意见，提交按钮在意见为空时禁用；
- 提交后刷新任务列表和历史，不提供修改或删除历史审核的控件；
- 页面明确说明 `RETURNED`/`NEED_MORE` 会把任务置为“待补充”，不能直接归档。

页面只负责展示和提交审核选择，权限、状态、操作者身份和事务由服务端/数据库决定。

## 6. 权限、审计与异常恢复

- `review.read` 只能读取审核记录和关联结果摘要；`review.manage` 才能提交审核；
- RLS 禁止匿名访问、直接插入、更新或删除 `result_review`；
- 审核事务失败时，审核记录、任务状态历史和审计记录全部回滚；
- 审计内容不复制原始实验数值、令牌或文件原文，只保存任务 ID、审核记录 ID、结果和目标状态；
- 并发审核依赖任务行锁和 `PENDING_REVIEW` 条件，失败方可刷新后重新查看；
- 页面请求超时不做跨请求补偿，依赖事务回滚和可重试的同一审核操作。

## 7. 扩展与维护策略

- 审核结果枚举集中在数据库约束、服务常量和 OpenAPI schema 中；
- 后续会签或电子签名通过新表和新 RPC 扩展，不改变 `result_review` 的历史含义；
- 报告模块只引用最新有效审核和任务状态，不复制审核意见；
- 审核页面与数据处理页面通过任务 ID 和稳定 API 契约解耦。

## 8. 验证方式

- 单元测试：结果/意见校验、未知字段拒绝和服务端字段拒绝；
- 远程集成：三类审核结果、非通过意见、审核权限、并发/非待审核冲突、历史追加、任务状态历史、审计和直接写入拒绝；
- API/E2E：未认证 401/重定向、读者可读不可写、页面展示和提交后状态更新；
- 质量门禁：TypeScript、Lint、Vitest、生产构建、远程集成、对抗性审查、`check-consistency.ps1` 和版本检查。
