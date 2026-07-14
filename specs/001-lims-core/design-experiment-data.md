# 实验数据与结果录入设计

| 项目 | 内容 |
| --- | --- |
| Design ID | `DES-EXPERIMENT-DATA-001` |
| 状态 | Approved |
| 日期 | 2026-07-15 |
| 需求 | `FR-DATA-001～005`、`AC-DATA-001`、`NFR-DATA-002～003`、`NFR-SEC-002`、`BR-003`、`BR-005` |

## 1. 设计决策

`experiment_data` 的一行表示一个不可变的实验观测记录。`data_type` 取 `RAW`、`PROCESSED` 或 `RESULT`：原始记录只填 `raw_value`，处理数据和最终结果只填 `processed_value`。同一指标的处理结果通过新增记录保存，不更新或覆盖原始记录。

任务的 `method_id` 是方法版本的唯一事实源。数据不复制方法编号或版本号，而是在查询响应中通过任务关联返回方法版本；这样可以保证结果始终追溯到任务创建时选择的明确方法版本。

数据必须关联任务和任务已关联的样品；`instrument_id` 可为空以支持人工实验，但提供时必须引用未处置的设备。任务状态为 `APPROVED` 或 `ARCHIVED` 后不再允许新增数据。

## 2. 数据完整性与安全

- 数据值使用既有 `numeric(20,8)` 字段；服务层拒绝非有限数值，数据库约束保证每种 `data_type` 使用正确的值字段。
- `recorded_by`、`created_at` 和主键由服务端/数据库生成，客户端不能伪造。
- `data.read` 只允许查询，`data.manage` 只允许新增；不提供更新、删除 API，RLS 也不开放更新和删除策略。
- 新增数据必须经过任务、样品、方法和设备引用校验，并写入 `audit_log`；审计记录不保存敏感文件内容。
- 通过 Route Handler 校验和 Supabase RLS 双重限制权限，浏览器不接触 service role key。

## 3. API 与页面

- `GET /api/v1/tasks/{id}/data`：按任务查询数据，返回样品、方法版本和设备摘要。
- `POST /api/v1/tasks/{id}/data`：录入一条原始数据、处理数据或最终结果。
- `/data`：选择任务、录入数据并查看该任务的历史数据；表单明确显示数据类型和原始/处理值的分离关系。

请求只接受业务字段：`sampleId`、`instrumentId?`、`dataType`、`metricName`、`rawValue?`、`processedValue?`、`unit?`、`sourceType`、`collectedAt`、`remark?`。

## 4. 迁移与兼容

`202607150011_experiment_data_controls.sql` 在既有表上补充数据类型和值字段约束、仅插入 RLS 策略，以及 `record_audit_event` 对 `data.manage` 的支持。迁移不改变既有列含义，也不修改已执行迁移。

## 5. 验证

- 单元测试覆盖数据类型和值字段组合、数值边界、时间和文本校验。
- 远程集成测试覆盖正向录入、原始/处理分离、任务/样品/方法/设备追溯、读者可读但不可写、已审核/归档任务拒绝、更新删除拒绝、审计一致性和临时数据清理。
- 未认证 E2E 覆盖 `/data` 页面和任务数据 API 的 401/登录跳转。
