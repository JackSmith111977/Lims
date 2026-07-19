# 模拟仪器数据接口设计

| Item | Value |
| --- | --- |
| Design ID | `DES-SIMULATED-INSTRUMENT-001` |
| Status | Approved |
| Scope | `FR-DATA-009`、`NFR-DATA-002`、`NFR-SEC-001～002` |
| Depends | `DES-EXPERIMENT-DATA-001`、`DES-INSTRUMENT-REGISTRY-001` |

## 1. 目标与边界

模拟接口用于在没有真实仪器通信驱动时，向指定任务写入一条“仪器来源”的实验观测。它验证任务、样品、设备、数据类型、数值形状、任务锁定和审计链，不能代表 `FR-EQUIP-007` 的真实设备控制或通信；真实接口评估单独由 T-605 负责。

接口采用 `POST /instruments/{id}/simulate-data`，请求体包含 `taskId`、`sampleId`、`dataType`、`metricName`、对应数值、可选单位/采集时间/备注。设备 ID 只从路径取得，`sourceType` 固定由服务端写为 `INSTRUMENT`。

## 2. 安全与一致性约束

- 仅具备 `data.manage` 的已认证用户可以调用；`recordedBy`、创建时间和审计操作人由当前会话生成。
- 设备必须存在且处于 `ACTIVE`；`INACTIVE`、`MAINTENANCE` 和 `SCRAPPED` 均拒绝模拟写入，报废设备使用 `INSTRUMENT_SCRAPPED`。
- 任务必须存在且未进入 `APPROVED`/`ARCHIVED`；样品必须已关联到该任务；数据仍复用 `experiment_data` 的不可变约束和 `RAW`/`PROCESSED`/`RESULT` 值形状。
- `taskId` 是模拟接口用于选择任务的请求字段；服务端读取后必须在传入共享实验数据载荷校验器前移除，保持通用校验器继续拒绝客户端伪造的 `taskId`。
- 客户端提供 `instrumentId` 或 `sourceType` 时拒绝请求，避免路径设备和来源被伪造；服务端不接受更新/删除接口。
- 成功写入复用实验数据 `CREATE` 审计，审计对象为新增 `experiment_data`，不会记录密钥或无关请求内容。

## 3. 验收与降级

- 正向：ACTIVE 设备 + 已关联任务样品写入成功，查询结果的 `sourceType` 为 `INSTRUMENT`，且 `instrumentId` 为路径设备。
- 负向：未认证/无权限、设备不存在或非 ACTIVE、样品未关联、任务已锁定、非法值形状和客户端伪造字段均返回明确错误且不产生数据。
- 回归：`taskId` 仅用于服务端选定任务，不进入最终实验数据载荷；共享数据校验仍拒绝 `id`、`taskId`、`recordedBy` 等服务端字段。
- 远程正向集成需要可用的 Supabase service key；若环境凭证返回 401/审计不可写，只记录环境门禁，不宣称业务验收通过。
