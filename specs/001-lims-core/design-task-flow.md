# 任务分配与状态流转设计

| 项目 | 内容 |
| --- | --- |
| 来源 Spec | `specs/001-lims-core/spec.md` |
| 需求范围 | `FR-TASK-003～006`、`FR-TASK-008`、`FR-PER-002`、`FR-PER-004`、`BR-001～005`、`NFR-SEC-002` |
| 设计编号 | `DES-TASK-FLOW-001` |
| 状态 | Approved |
| 版本 | v0.1 |
| 更新时间 | 2026-07-15 |

## 1. 目标与边界

本设计实现任务分配给实验人员或实验组、查询当前分配、任务状态流转和状态历史。项目/任务基础登记沿用 `DES-TASK-REGISTRATION-001`；实验方法、设备资源、结果审核和报告业务仍由后续任务实现。

`task_assignee` 继续作为个人分配历史；由于现有 `lab_group` 没有成员表，新增 `task_group_assignee` 保存任务与实验组的分配历史，不把实验组错误展开为组长或临时个人。个人任务状态摘要只统计 `task_assignee` 的当前有效个人分配，组分配在任务详情中单独展示。

## 2. 任务状态机

| 数据库状态 | 业务含义 | 允许的后继状态 | 主要授权 |
| --- | --- | --- | --- |
| `DRAFT` | 待登记/待分配 | `ASSIGNED` | `task.assign`，且必须存在个人或组分配 |
| `ASSIGNED` | 已分配 | `IN_PROGRESS` | 当前执行人或 `task.manage` |
| `IN_PROGRESS` | 执行中 | `PENDING_REVIEW` | 当前执行人或 `task.manage` |
| `PENDING_REVIEW` | 待审核 | `APPROVED`、`RETURNED` | `task.manage`；结果审核细则由 T-304 补充 |
| `RETURNED` | 退回待补充 | `IN_PROGRESS` | 当前执行人或 `task.manage` |
| `APPROVED` | 已通过 | `ARCHIVED` | `task.manage` |
| `ARCHIVED` | 已归档 | 无 | 只读和追溯 |

每次状态变化写入 `task_status_history`，包含前后状态、操作人、时间和备注；任务创建为 `DRAFT` 不额外伪造历史记录。状态机不允许跳跃、回退到未定义状态或直接修改数据库字段。

## 3. 分配规则

- 分配请求一次性提交 `userIds` 和 `groupIds`；两个字段至少出现一个，均为空表示清空当前分配。
- 个人必须存在、账户为 `ACTIVE` 且 `availability_status = AVAILABLE`；离岗、资格暂停、不可用人员不可被新分配。
- 实验组必须存在且为 `ACTIVE`；组成员关系不在本任务虚构，后续成员模型可在不改变任务组分配接口的情况下扩展。
- 分配只关闭当前有效历史行（设置 `unassigned_at`），不删除历史；然后写入新的有效分配行。
- `DRAFT` 首次分配自动推进到 `ASSIGNED`，并写入一条状态历史；其他状态重新分配不改变任务状态。
- 已归档任务不能分配、清空或重新分配。

## 4. 事务与权限

### 4.1 分配事务

`replace_task_assignments` 使用 `FOR UPDATE` 锁定任务，校验任务状态、人员/组状态，关闭旧分配并写入新分配；若任务为 `DRAFT`，同一事务更新为 `ASSIGNED` 并写状态历史，最后写审计事件。任一步失败全部回滚。

### 4.2 状态事务

`transition_task` 使用 `FOR UPDATE` 锁定任务，校验状态转换和执行权限，更新任务状态、写 `task_status_history` 并写审计事件。数据库触发器只允许该事务函数通过事务局部标记更新 `experiment_task.status`，直接 REST/RLS 更新状态一律失败。

### 4.3 读取与写入权限

- 任务、当前个人/组分配和状态历史读取需要 `task.read`。
- 分配需要 `task.assign`。
- 状态流转需要 `task.manage`，当前有效个人执行人可推进 `ASSIGNED → IN_PROGRESS`、`IN_PROGRESS → PENDING_REVIEW` 和 `RETURNED → IN_PROGRESS`。
- Route Handler 做会话和权限校验；RLS 只允许历史读取，分配/状态历史写入仅通过事务函数。

## 5. API 契约

### 5.1 分配

`POST /tasks/{id}/assignments`：

```json
{
  "userIds": ["00000000-0000-4000-8000-000000000001"],
  "groupIds": [12]
}
```

响应返回当前任务、当前个人分配和当前组分配。服务端不接受 `assignedBy`、`assignedAt` 或 `unassignedAt`。

### 5.2 状态流转

`POST /tasks/{id}/transition` 请求体为 `{ toStatus, remark? }`；服务端根据当前状态、会话用户和当前分配判断权限，不接受 `fromStatus`、`operatorId` 或 `occurredAt`。非法状态转移返回 `409 INVALID_TASK_TRANSITION`。

`GET /tasks/{id}/history` 按 `occurred_at desc, id desc` 返回 `fromStatus`、`toStatus`、`operatorId`、`remark` 和 `occurredAt`。

## 6. 验证依据

- 单元测试：用户/组 ID、状态白名单、状态流转表、服务端字段拒绝和备注长度。
- 远程集成：个人/组分配、不可用人员和停用组拒绝、DRAFT 自动进入 ASSIGNED、执行人推进、非法跳跃、归档后写入拒绝、历史与审计一致、直接 status UPDATE 被触发器阻断。
- 质量门禁：TypeScript、Lint、Vitest、Playwright、生产构建、对抗性审查、`check-consistency.ps1` 和 `check:versioning`。
