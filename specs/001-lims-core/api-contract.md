# REST API 契约

| 项目 | 内容 |
| --- | --- |
| 来源 | `spec.md` 功能需求和 `architecture.md` 技术决策 |
| API 风格 | REST/JSON |
| 契约格式 | OpenAPI 3.2 |
| 基础路径 | `/api/v1` |
| 认证方式 | Supabase Auth access token，使用 `Authorization: Bearer <token>` |
| 状态 | Draft |
| 更新时间 | 2026-07-11 |

## 1. 通用约定

### 1.1 请求

- 使用 JSON 请求体时，`Content-Type: application/json`。
- 受保护接口必须携带 Supabase Auth access token。
- Route Handler 应从服务端会话中读取用户身份，并结合业务权限和 PostgreSQL RLS 校验访问。
- 日期使用 `YYYY-MM-DD`，时间使用 ISO 8601 格式。
- 列表接口统一使用 `page`、`size`、`sort`、`keyword` 和模块筛选字段。
- 业务编号由后端生成，客户端不直接指定主键。

### 1.2 成功响应

```json
{
  "code": "OK",
  "message": "success",
  "data": {},
  "traceId": "01J..."
}
```

列表响应：

```json
{
  "code": "OK",
  "message": "success",
  "data": {
    "items": [],
    "page": 1,
    "size": 20,
    "total": 0
  },
  "traceId": "01J..."
}
```

### 1.3 错误响应

```json
{
  "code": "SAMPLE_NOT_FOUND",
  "message": "样品不存在",
  "data": null,
  "traceId": "01J..."
}
```

HTTP 状态建议：`400` 参数错误、`401` 未认证、`403` 无权限、`404` 资源不存在、`409` 状态冲突、`500` 服务异常。

## 2. 认证接口

| 方法 | 路径 | 角色 | 需求 |
| --- | --- | --- | --- |
| POST | `/auth/login` | 匿名 | `FR-AUTH-001` |
| POST | `/auth/logout` | 登录用户 | `FR-AUTH-001` |
| GET | `/auth/me` | 登录用户 | `FR-AUTH-002` |
| PUT | `/auth/password` | 登录用户 | `FR-AUTH-007` |

## 3. 基础数据接口

| 方法 | 路径 | 角色 | 需求 |
| --- | --- | --- | --- |
| GET/POST | `/projects` | 管理员、负责人 | `FR-TASK-001～002` |
| GET/PATCH | `/projects/{id}` | 管理员、负责人 | `FR-TASK-001～002` |
| GET/POST | `/users` | 系统管理员 | `FR-AUTH-003` |
| PATCH | `/users/{id}` | 系统管理员 | `FR-AUTH-003`、`FR-AUTH-005` |
| POST | `/users/{id}/roles` | 系统管理员 | `FR-AUTH-004～006` |
| GET/POST | `/roles` | 系统管理员 | `FR-AUTH-004` |
| PATCH | `/roles/{id}` | 系统管理员 | `FR-AUTH-004` |
| POST | `/roles/{id}/permissions` | 系统管理员 | `FR-AUTH-004～006` |
| GET/POST/PATCH | `/settings/laboratories`、`/settings/departments`、`/settings/groups` | 设置管理员 | `FR-SETTING-001` |
| GET/POST/PATCH | `/settings/categories`、`/settings/units`、`/settings/parameters` | 设置管理员 | `FR-SETTING-002～003` |
| GET | `/methods` | `resource.read` | `FR-METHOD-001～004` |
| POST | `/methods` | `resource.manage` | `FR-METHOD-001～004` |
| GET | `/methods/{id}` | `resource.read` | `FR-METHOD-001～004` |
| PATCH | `/methods/{id}` | `resource.manage` | `FR-METHOD-001～004` |
| POST | `/methods/{id}/attachments` | `resource.manage` | `FR-METHOD-003～004` |
| GET/POST | `/instruments` | 实验室管理员 | `FR-EQUIP-001～006` |
| GET/POST | `/inventory/items` | 实验室管理员 | `FR-INVENTORY-001～006` |

## 4. 样品接口

| 方法 | 路径 | 角色 | 需求 |
| --- | --- | --- | --- |
| GET | `/samples` | `sample.read` | `FR-SAMPLE-001～004` |
| POST | `/samples` | `sample.manage` | `FR-SAMPLE-001～003` |
| GET | `/samples/{id}` | `sample.read` | `FR-SAMPLE-001～004` |
| PATCH | `/samples/{id}` | `sample.manage`，关联任务需 `task.manage` | `FR-SAMPLE-001～003` |
| POST | `/samples/{id}/flows` | `sample.manage` | `FR-SAMPLE-005～006` |
| GET | `/samples/{id}/flows` | `sample.read` | `FR-SAMPLE-004～006` |

`POST /samples/{id}/flows` 请求体为 `{ node, location?, handoverTo?, remark? }`。`node` 取 `COLLECT`、`DISTRIBUTE`、`TRANSFER`、`PROCESS`、`ARCHIVE`、`DISPOSE`；请求不得提交 `fromStatus`、`toStatus`、`operatorId` 或 `occurredAt`。服务端基于当前状态机推导前后状态并原子写入 `sample`、`sample_flow` 和审计记录；非法节点、非法状态转换或终态继续流转返回 `409`。GET 按 `occurredAt desc, id desc` 返回节点、前后状态、操作人、交接人、位置、说明和时间。

## 5. 项目接口

| 方法 | 路径 | 角色 | 需求 |
| --- | --- | --- | --- |
| GET | `/projects` | `project.read` | `FR-TASK-001` |
| POST | `/projects` | `project.manage` | `FR-TASK-001` |
| GET | `/projects/{id}` | `project.read` | `FR-TASK-001～002` |
| PATCH | `/projects/{id}` | `project.manage` | `FR-TASK-001` |

## 5.1 任务接口

| 方法 | 路径 | 角色 | 需求 |
| --- | --- | --- | --- |
| GET | `/tasks` | 按权限 | `FR-TASK-009` |
| POST | `/tasks` | 管理员、负责人 | `FR-TASK-001～002` |
| GET | `/tasks/{id}` | 按权限 | `FR-TASK-004～006` |
| PATCH | `/tasks/{id}` | 管理员、负责人、执行人 | `FR-TASK-004～006` |
| POST | `/tasks/{id}/assignments` | `task.assign` | `FR-TASK-003`、`FR-TASK-008`、`FR-PER-002`、`FR-PER-004` |
| POST | `/tasks/{id}/transition` | `task.manage` 或当前执行人 | `FR-TASK-004～006`、`BR-001～005` |
| GET | `/tasks/{id}/history` | `task.read` | `FR-TASK-004`、`FR-AUDIT-005` |

`POST /tasks/{id}/assignments` 接收 `userIds?` 和 `groupIds?`，由服务端生成分配人和时间；`POST /tasks/{id}/transition` 接收 `toStatus`、`remark?`，由服务端推导当前状态、操作人和时间；状态历史只允许通过状态流转事务写入。

方法接口把 `method_code + version` 作为版本业务唯一键；`PATCH` 不允许修改方法编号和版本号。方法详情返回方法变更历史和附件元数据，附件二进制通过 Storage 路径承接，不在 API 日志中回显。

## 5.2 人员档案接口

| 方法 | 路径 | 角色 | 需求 |
| --- | --- | --- | --- |
| GET | `/personnel` | `resource.read` | `FR-PER-001～004` |
| GET | `/personnel/{id}` | `resource.read` | `FR-PER-001～004` |
| PATCH | `/personnel/{id}` | `resource.manage` | `FR-PER-001、FR-PER-004` |
| GET/POST | `/personnel/{id}/skills` | `resource.read/manage` | `FR-PER-003` |
| PATCH/DELETE | `/personnel/{id}/skills/{recordId}` | `resource.manage` | `FR-PER-003` |
| GET/POST | `/personnel/{id}/qualifications` | `resource.read/manage` | `FR-PER-003～004` |
| PATCH/DELETE | `/personnel/{id}/qualifications/{recordId}` | `resource.manage` | `FR-PER-003～004` |
| GET/POST | `/personnel/{id}/training` | `resource.read/manage` | `FR-PER-003` |
| PATCH/DELETE | `/personnel/{id}/training/{recordId}` | `resource.manage` | `FR-PER-003` |

## 6. 数据、审核和报告接口

| 方法 | 路径 | 角色 | 需求 |
| --- | --- | --- | --- |
| POST | `/tasks/{id}/data` | 实验人员 | `FR-DATA-001～005` |
| GET | `/tasks/{id}/data` | 按权限 | `FR-DATA-005` |
| GET | `/processing-rules` | 按权限 | `FR-DATA-007～008` |
| POST | `/tasks/{id}/data/process` | 实验人员 | `FR-DATA-007～008` |
| GET | `/tasks/{id}/data/process-runs` | 按权限 | `FR-DATA-007～008` |
| POST | `/tasks/{id}/data/import` | 实验人员 | `FR-DATA-006` |
| POST | `/tasks/{id}/reviews` | `review.manage` | `FR-REVIEW-001～006` |
| GET | `/tasks/{id}/reviews` | `review.read` | `FR-REVIEW-001～006` |
| POST | `/tasks/{id}/reports` | 管理员、负责人 | `FR-REPORT-001～002` |
| GET | `/reports` | 按权限 | `FR-REPORT-003` |
| GET | `/reports/{id}` | 按权限 | `FR-REPORT-003～006` |
| POST | `/reports/{id}/publish` | 管理员、负责人 | `FR-REPORT-004～006` |

`POST /tasks/{id}/data` 只允许新增不可变数据记录。`dataType=RAW` 时必须提供 `rawValue` 且不得提供 `processedValue`；`dataType=PROCESSED/RESULT` 时必须提供 `processedValue` 且不得提供 `rawValue`。服务端从当前会话生成 `recordedBy` 和时间，并校验样品属于任务、方法版本来自任务及设备未处置。任务进入 `APPROVED` 或 `ARCHIVED` 后返回 `409 DATA_TASK_LOCKED`；不提供更新或删除数据接口。

`GET /processing-rules` 只返回活动规则的固定版本。`POST /tasks/{id}/data/process` 接收 `ruleId`、`sourceDataIds` 和 `executionMode`，按选定规则生成新的 `PROCESSED` 或 `RESULT` 数据记录，不覆盖输入数据；每次运行返回唯一 `runId`，并通过血缘记录关联输入、输出和规则版本。`ROUND` 支持 `HALF_UP` 修约，`THRESHOLD` 返回 `PASS` 或 `FAIL`；超出阈值时运行状态为 `FLAGGED` 并保留异常说明。`GET /tasks/{id}/data/process-runs` 返回运行状态、判定、异常和数据血缘。任务进入 `APPROVED` 或 `ARCHIVED` 后处理接口返回 `409 DATA_TASK_LOCKED`。

`GET /tasks/{id}/reviews` 返回任务审核上下文、实验数据摘要、处理运行摘要、审核历史和最新有效审核。`POST /tasks/{id}/reviews` 只接收 `result`（`APPROVED`、`RETURNED` 或 `NEED_MORE`）及可选 `comment`；服务端从当前会话生成审核人和时间，并通过事务函数写入审核、任务状态历史和审计。`RETURNED`/`NEED_MORE` 必须填写意见，任务必须处于 `PENDING_REVIEW`，否则返回 `409 REVIEW_TASK_NOT_PENDING`；通过后任务进入 `APPROVED`，退回或要求补充后进入 `RETURNED`。

## 7. 看板与日志接口

| 方法 | 路径 | 角色 | 需求 |
| --- | --- | --- | --- |
| GET | `/dashboard/overview` | 按权限 | `FR-DASH-001～005` |
| GET | `/dashboard/task-statistics` | 按权限 | `FR-DASH-002` |
| GET | `/dashboard/inventory-alerts` | 管理员 | `FR-DASH-004` |
| GET | `/audit-logs` | 系统管理员、授权管理员 | `FR-AUDIT-001～004` |
| GET | `/trace/{objectType}/{id}` | 按权限 | `FR-AUDIT-005` |

## 8. 状态冲突

以下情况返回 `409`：

- 对已归档任务修改业务数据。
- 对不存在或已处置样品继续流转。
- 对未审核通过的任务生成正式报告。
- 领用数量超过库存可用数量。
- 使用已停用的方法或设备创建新任务。
