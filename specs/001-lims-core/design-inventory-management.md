# 试剂耗材与库存变动设计

| Item | Value |
| --- | --- |
| Design ID | DES-INVENTORY-MANAGEMENT-001 |
| Status | Approved |
| Scope | FR-INVENTORY-001～004、AC-RESOURCE-001 |
| Depends | Existing `inventory_item` and `inventory_transaction` tables; resource permission model |

## 1. 目标与边界

T-403 实现试剂/耗材主档、库存余额和入库、领用、退库、报废变动。低库存和临近有效期提醒、库存与任务的正式关联由 T-404 负责；T-403 不把提醒规则或任务资源分配散落到页面中。

## 2. 数据与不变量

- `inventory_item` 保存唯一编号、类型、名称、批号、厂家、单位、存储条件、位置、有效期和状态。
- `quantity` 是由变动记录维护的余额投影。新建主档余额固定为 0，不能通过客户端 PATCH 直接修改。
- `inventory_transaction` 是追加明细，类型为 `INBOUND`、`OUTBOUND`、`RETURN` 或 `SCRAP`；数量始终为正数，方向由类型决定。
- `OUTBOUND` 和 `SCRAP` 不能使余额小于 0；余额变为 0 时状态变为 `DEPLETED`。入库或退库使余额恢复为正数时，`DEPLETED` 可恢复为 `ACTIVE`，但不覆盖 `INACTIVE` 或由 T-404 管理的 `EXPIRED` 语义。
- 责任人、发生时间和变动前后余额由服务端生成；客户端不得伪造这些字段。

## 3. 权限与事务边界

- `resource.read` 可查询库存主档和变动历史。
- `resource.manage` 可创建/维护主档和追加变动。
- `create_inventory_item`、`update_inventory_item` 和 `record_inventory_transaction` 使用当前认证用户，服务端校验字段并记录审计。
- `record_inventory_transaction` 锁定库存行，在同一事务中校验余额、插入明细、更新余额和写审计；直接写入 `inventory_item` 或 `inventory_transaction` 对 authenticated 客户端关闭。
- `task_id` 在本任务不作为客户端输入；T-404 通过独立的任务资源流程接入，避免提前形成未审计关联。

## 4. API 与验证

- `GET/POST /inventory/items` 查询或创建主档。
- `GET/PATCH /inventory/items/{id}` 查询或修改非余额字段。
- `GET/POST /inventory/items/{id}/transactions` 查询历史或追加库存变动。
- 校验覆盖重复编号、服务端字段伪造、正数数量、非法类型、库存不足、不可修改余额、直接写入、读写权限和审计一致性。

## 5. 迁移与回滚

迁移增加变动类型约束、RLS/触发器/RPC 和必要索引；不改已有主档字段含义。回滚只能通过后续 migration 恢复兼容约束，不直接修改线上表结构。
