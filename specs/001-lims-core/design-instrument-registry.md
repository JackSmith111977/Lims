# 仪器设备档案设计

| Item | Value |
| --- | --- |
| Design ID | DES-INSTRUMENT-REGISTRY-001 |
| Status | Approved |
| Scope | FR-EQUIP-001～003、AC-RESOURCE-001 |
| Depends | DES-AUTH-ADMIN-001、DES-EXPERIMENT-DATA-001 |

## 1. 目标与边界

本设计实现仪器设备基础档案、状态、负责人和与实验数据的关联查询。T-402 单独负责维护/维修/校准事件和提醒；T-401 不重复实现 `instrument_maintenance` 的业务录入。

真实仪器通信和控制属于 FR-EQUIP-007/T-605，不在本次实现范围内。设备报废采用状态保留历史，不提供物理删除接口。

## 2. 档案字段与状态

`instrument` 保留设备唯一编号、名称、类型、型号、厂商、位置、负责人、启用日期、校准日期和状态。

- `instrument_code` 创建后不可修改，必须唯一。
- 新建状态只能为 ACTIVE 或 INACTIVE，默认 ACTIVE；MAINTENANCE 由 T-402 的维护流程使用，SCRAPPED 为终态。
- SCRAPPED 设备不能恢复、不能绑定新任务或新增实验数据；其他状态由授权管理员维护。
- 负责人必须是 ACTIVE 用户；设备档案更新自动维护 `updated_at` 并记录审计。

## 3. 权限与写入边界

- `resource.read`：查询设备列表和详情，并查看设备在实验数据中的引用摘要。
- `resource.manage`：创建、更新和状态变更；仅通过 `create_instrument`/`update_instrument` 事务 RPC 写入。
- 客户端对 `instrument` 表只有 SELECT 权限，不能直接插入、更新或删除；数据库触发器阻止绕过 RPC 的写入。
- RPC 从当前会话生成操作人，校验字段长度、负责人状态、状态值和 SCRAPPED 终态，并写入 `audit_log`。

## 4. API 与查询

- `GET /instruments` 支持 `keyword`、`status` 查询。
- `POST /instruments` 创建基础档案，不接受 `id`、`updatedAt` 或服务器审计字段。
- `GET /instruments/{id}` 返回档案和使用摘要：实验数据引用数量、最近采集时间和当前状态。
- `PATCH /instruments/{id}` 更新可变档案字段和状态；设备编号、启用日期、校准日期由后续专用流程管理。

## 5. 验收重点

- 唯一编号和字段校验生效；设备负责人、状态、位置和启用信息可保存并查询。
- 未认证、无资源查看权限、直接表写入和跨权限修改均被拒绝。
- SCRAPPED 设备不能恢复；已报废设备不能被实验数据新增流程接受。
- 创建设备、更新档案和状态变更均能查询到对应审计记录。
