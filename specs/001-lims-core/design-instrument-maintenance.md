# 仪器维护、维修与校准设计

| Item | Value |
| --- | --- |
| Design ID | DES-INSTRUMENT-MAINTENANCE-001 |
| Status | Approved |
| Scope | FR-EQUIP-003～006、AC-RESOURCE-001 |
| Depends | DES-INSTRUMENT-REGISTRY-001 |

## 1. 目标与边界

本设计实现仪器维护、维修、巡检和校准的追加记录、校准周期、下次到期日、责任人和到期提醒。真实仪器控制、自动读取校准结果和电子签名不在本版本范围内。

## 2. 事件模型

`instrument_maintenance.maintenance_type` 只能是 `MAINTENANCE`、`REPAIR`、`INSPECTION` 或 `CALIBRATION`。记录包含发生日期、责任人（由当前会话生成）、结果、备注、周期天数和下次到期日。

- 事件只允许追加，不提供客户端更新或删除。
- `occurred_on` 不得早于设备启用日期；`next_due_on` 不得早于发生日期。
- `CALIBRATION` 必须填写正整数 `cycle_days` 和 `next_due_on`，且下次到期日必须等于发生日期加周期天数。
- 校准事件成功写入后，在同一事务中更新设备 `next_calibration_at`；报废设备不能新增维护或校准事件。

## 3. 权限与提醒

- `resource.read`：查询设备维护历史和到期提醒。
- `resource.manage`：创建维护、维修、巡检和校准事件；责任人和发生时间由服务端生成/校验。
- `GET /instruments/maintenance/reminders?days=30` 返回已到期或未来指定天数内到期的事件，按到期日升序排列。
- 客户端只能 `SELECT` 维护记录；事务 RPC 负责追加记录、同步校准日期和审计。

## 4. 事务与测试重点

`record_instrument_maintenance(_instrument_id, _payload)` 锁定设备，校验状态、日期和周期，插入追加记录；校准事件同时更新设备下次校准日并写入审计记录。

测试覆盖非法类型、日期/周期、报废设备、直接写入、读写权限、校准日期同步、提醒排序、设备关联、审计和临时数据清理。
