# 试剂耗材提醒与任务关联设计

| Item | Value |
| --- | --- |
| Design ID | DES-INVENTORY-ALERTS-001 |
| Status | Approved |
| Scope | FR-INVENTORY-005～006、AC-RESOURCE-001 |
| Depends | DES-INVENTORY-MANAGEMENT-001、现有 `experiment_task` 状态模型 |

## 1. 目标与边界

T-404 在 T-403 的库存主档和变动事务之上增加低库存/有效期提醒，以及将资源使用记录关联到实验任务。提醒采用服务端实时计算，不新增重复的通知表；任务关联只扩展库存变动记录，不修改实验任务状态机。

## 2. 低库存与有效期提醒

- `inventory_item.low_stock_threshold` 为非负数，默认为 `0`；`0` 表示不启用低库存提醒。
- 当 `quantity <= low_stock_threshold` 且阈值大于 `0` 时返回 `LOW_STOCK` 提醒；余额为 `0` 的耗材可返回 `CRITICAL` 级别。
- `expiry_date <= 当前日期 + days` 时返回有效期提醒；已过期记录仍返回并标记为 `EXPIRED`，未过期但在窗口内标记为 `EXPIRING`。
- `days` 由服务端校验为 `0～365`；提醒使用数据库当前日期，避免客户端时区影响。`INACTIVE` 主档不产生提醒。
- 同一条主档可以同时产生低库存和有效期两条提醒；接口按严重程度、日期和主档编号稳定排序。

## 3. 资源使用与实验任务关联

- `inventory_transaction.task_id` 为可选字段；只有 `OUTBOUND`（领用/使用）允许携带任务 ID，其他变动类型必须为空。
- 任务必须存在且不能为 `ARCHIVED`；写入者除 `resource.manage` 外还需要 `task.read`，避免把资源记录关联到不可见或已归档任务。
- `task_id`、责任人、发生时间、数量和余额仍由数据库事务生成/校验；客户端不能直接写表或修改历史流水。
- 关联写入与库存扣减、审计写入处于同一事务中；失败时不得留下孤立的任务关联或库存变化。

## 4. API、权限与验证

- `GET /inventory/alerts?days=30` 需要 `resource.read`，返回实时提醒视图。
- `PATCH /inventory/items/{id}` 可维护低库存阈值，但不能修改余额；`POST /inventory/items/{id}/transactions` 可在 `OUTBOUND` 中提交 `taskId`。
- 服务层拒绝客户端控制的 `operatorId`、`occurredAt`、`balanceBefore`、`balanceAfter` 和非领用任务关联字段。
- 测试覆盖窗口边界、已过期/停用排除、双重提醒、任务状态/权限、并发领用、审计一致性、直接写入拒绝和临时数据清理。

## 5. 迁移与回滚

迁移增加阈值字段、扩展库存事务 RPC 和提醒查询 RPC，并保留现有主档与流水数据。回滚通过后续迁移恢复兼容函数或禁用提醒入口，不直接删除已有库存流水或任务外键。
