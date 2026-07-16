# 数据看板与统计设计

| 项目 | 内容 |
| --- | --- |
| 设计 ID | `DES-DASHBOARD-001` |
| 状态 | Approved |
| 来源 | `FR-DASH-001～005`、`AC-DASH-001` |
| 关联任务 | `T-503` |
| 技术栈 | Next.js Route Handlers、Supabase SSR、TypeScript、Tailwind CSS |

## 1. 目标与边界

本设计为登录后的实验室工作台提供可筛选的只读统计，覆盖样品、实验任务、待审核/异常数据、设备状态和库存预警。看板不修改业务数据、不绕过既有 RLS，也不创建第二套状态或告警规则。

本任务不包含实时推送、历史趋势仓库、报表导出、真实仪器采集和自定义指标。统计在毕业设计演示规模下直接读取现有业务表；当数据量需要扩展时，可在不改变返回模型的前提下替换为数据库聚合函数或物化视图。

## 2. 统计口径

| 分区 | 数据源 | 口径 | 需求 |
| --- | --- | --- | --- |
| 样品 | `sample` | `registered_at` 落在时间范围内的样品总数，按 `status` 分组；支持 `projectId`、`sampleStatus`、人员关联范围和时间筛选 | `FR-DASH-001` |
| 任务 | `experiment_task` | `created_at` 落在时间范围内的任务总数，按 `status` 分组；`completedCount` 为 `APPROVED` 与 `ARCHIVED` 之和，完成率为 `completedCount / total` | `FR-DASH-002` |
| 待审核 | `experiment_task` | 任务状态为 `PENDING_REVIEW` 的任务清单，受任务筛选条件约束 | `FR-DASH-003` |
| 异常数据 | `experiment_processing_run` | `status=FLAGGED` 或 `decision in (FAIL, REVIEW)` 的处理运行；按运行 ID 计数并返回有限字段摘要 | `FR-DASH-003` |
| 设备 | `instrument` | 按设备 `status` 分组，返回总数和状态分布 | `FR-DASH-004` |
| 库存预警 | `get_inventory_alerts(_days)` | 复用库存模块既有低库存/有效期提醒规则，按类型和严重级别计数，并返回告警清单 | `FR-DASH-004` |

时间范围使用 `from`（含）和 `to`（不含）两个 ISO 8601 时间；只提供日期时按 UTC 当日边界转换。`sampleStatus` 和 `taskStatus` 分别作用于对应实体，避免两个实体的状态枚举混用。`inventoryDays` 默认 30，范围为 0～365。

`personnelId` 通过当前有效的 `task_assignee` 关联任务。提供该筛选时，任务统计及其关联的样品、异常数据范围均限制到该人员当前承担的任务；需要 `task.read` 权限，否则返回明确的筛选权限错误，不返回误导性的全局统计。

## 3. 权限与数据隔离

概览接口只有在至少具备一个看板分区读取权限时才可访问：

- `sample.read`：样品统计。
- `task.read`：任务统计和待审核任务；同时用于解析人员筛选和任务关联范围。
- `data.read`：异常处理运行统计。
- `resource.read`：设备状态和库存预警。

未具备权限的分区返回 `null`，并在 `availableSections` 中只列出可见分区；前端据此隐藏卡片。服务端查询仍使用用户会话和现有 RLS。库存预警通过既有 `get_inventory_alerts` 安全函数读取，不能通过客户端传入内容覆盖告警规则。

## 4. API 返回模型

### 4.1 `GET /api/v1/dashboard/overview`

查询参数：

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| `projectId` | 正整数 | 项目范围 |
| `personnelId` | UUID | 当前任务负责人范围 |
| `sampleStatus` | 枚举 | `REGISTERED`、`PROCESSING`、`PROCESSED`、`ARCHIVED`、`DISPOSED` |
| `taskStatus` | 枚举 | `DRAFT`、`ASSIGNED`、`IN_PROGRESS`、`PENDING_REVIEW`、`RETURNED`、`APPROVED`、`ARCHIVED` |
| `from` / `to` | ISO 8601 | 时间范围，`from < to` |
| `inventoryDays` | 0～365 整数 | 库存有效期提醒窗口，默认 30 |

返回的 `DashboardOverview` 为只读 JSON：

```text
{
  filters,
  availableSections: string[],
  samples: { total, byStatus } | null,
  tasks: { total, byStatus, completedCount, completionRate } | null,
  pendingReviews: PendingReviewItem[] | null,
  abnormalData: { total, byStatus, byDecision, items } | null,
  instruments: { total, byStatus } | null,
  inventory: { totalAlerts, byType, bySeverity, alerts } | null
}
```

`completionRate` 为 0～100 的百分数，保留两位小数；无任务时为 0。所有分布均按稳定枚举值返回，未知值仍保留在结果中而不会静默丢弃。

### 4.2 窄接口

- `GET /api/v1/dashboard/task-statistics`：只返回 `tasks` 和 `pendingReviews`，要求 `task.read`。
- `GET /api/v1/dashboard/inventory-alerts`：只返回库存统计，要求 `resource.read`，参数仅使用 `inventoryDays`。

窄接口复用同一统计服务和校验逻辑，避免三个接口产生不同的统计口径。

## 5. 服务端实现边界

统计服务位于 `src/lib/server/dashboard.ts`，负责参数解析、权限分区、最小字段查询、稳定聚合和序列化；Route Handler 只负责认证、调用和错误映射。前端 `DashboardPanel` 只消费接口返回模型，不直接访问 Supabase。

直接查询只选择聚合所需字段，并依赖现有索引：样品项目/状态、任务项目/状态、任务负责人、处理运行任务/时间、设备状态和库存有效期。聚合实现保持纯函数可测试，后续可替换数据读取适配器而不改变页面和 API。

## 6. 失败与降级

- 未登录返回 `401 AUTH_REQUIRED`；没有任何看板读取权限返回 `403 FORBIDDEN`。
- 非法 ID、UUID、枚举、日期或库存窗口返回 `400`；时间范围倒置返回 `400 INVALID_QUERY`。
- 指定 `personnelId` 但没有 `task.read` 返回 `403 DASHBOARD_FILTER_PERMISSION_DENIED`。
- 单个统计查询失败时整个请求失败并记录服务端错误，不返回部分可能被误解为完整的数据。
- 没有数据返回零计数和空列表，不使用 `null` 表示“无数据”；`null` 仅表示当前用户无该分区权限。

## 7. 验收映射

| 验收项 | 验证方式 |
| --- | --- |
| 样品/任务统计与状态分布 | 聚合单元测试、登录后看板验收 |
| 待审核与异常数据 | 处理运行 `FLAGGED`/`FAIL`/`REVIEW` 测试夹具、API 集成验证 |
| 设备与库存告警 | 资源权限 API 验收、库存现有告警集成回归 |
| 项目/人员/状态/时间筛选 | 查询参数单元测试、远程最小数据集集成验证 |
| 越权与敏感数据 | 未认证/无权限 E2E、分区权限负向验证 |
| 可维护性 | OpenAPI、Spec 追踪、一致性检查和对抗性审查 |
