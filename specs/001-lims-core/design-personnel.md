# 实验室人员档案技术设计

| 项目 | 内容 |
| --- | --- |
| 设计编号 | DES-PERSONNEL-001 |
| 来源 Spec | `FR-PER-001～004`、`BR-001～005`、`NFR-SEC-001～002` |
| 状态 | Approved |
| 日期 | 2026-07-15 |

## 设计目标

在不复制用户身份数据的前提下，提供实验室人员档案、岗位、业务可用状态、技能、资质、培训和任务状态摘要。人员档案属于资源管理域，账户登录状态继续由 `sys_user.status` 管理，业务可用状态由独立字段管理。

本设计覆盖：

- `FR-PER-001`：姓名、部门沿用 `sys_user`，岗位引用 `sys_position`，可用状态使用 `sys_user.availability_status`。
- `FR-PER-002`：读取当前有效任务分配及任务状态，不在本任务写入任务分配。
- `FR-PER-003`：使用技能、资质、培训三类子记录保存人员能力信息。
- `FR-PER-004`：返回不可用、离岗、资格暂停和即将到期的提醒信息；不自动改变任务状态。

## 架构和模块边界

```text
人员页面
  └─ /api/v1/personnel
       ├─ personnel profile service：sys_user + sys_position + lab_department
       ├─ capability records：sys_user_skill / qualification / training
       └─ task status read model：task_assignee + experiment_task
```

- 业务规则集中在 `src/lib/server/personnel.ts`。
- Route Handler 只负责认证、HTTP 参数和响应转换，不直接拼装跨模块业务规则。
- 任务分配和任务状态流转由 T-205 负责；本任务只消费已有表。
- 账户创建、登录状态和角色分配仍由 T-105A 的用户管理模块负责。

## 数据模型和迁移

### 复用和扩展 `sys_user`

新增字段：

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| `position_id` | BIGINT | FK `sys_position(id)`，可空 | 当前岗位 |
| `availability_status` | VARCHAR(32) | `AVAILABLE/ON_LEAVE/QUALIFICATION_SUSPENDED/UNAVAILABLE` | 业务可用状态 |
| `availability_note` | VARCHAR(255) | 可空 | 状态说明 |
| `availability_until` | DATE | 可空 | 预计恢复日期 |

`sys_user.status` 仍表示账户是否允许登录，不能由人员档案接口修改。

### 新增表

- `sys_position(id, code, name, description, status, created_at, updated_at)`：岗位字典，`code` 唯一。
- `sys_user_skill(id, user_id, skill_name, level, verified_at, expires_at, notes, created_at, updated_at)`：技能记录，用户和技能名称联合唯一。
- `sys_user_qualification(id, user_id, qualification_name, certificate_no, status, issued_at, expires_at, notes, created_at, updated_at)`：资质记录，状态为 `ACTIVE/SUSPENDED/EXPIRED`。
- `sys_user_training(id, user_id, training_name, provider, completed_at, expires_at, result, notes, created_at, updated_at)`：培训记录。

所有子表对用户使用 `ON DELETE CASCADE`，对日期和状态执行数据库约束；到期提醒使用查询时计算，不用定时任务，便于后续替换为通知服务。

## API 契约

权限：

- `resource.read`：人员列表、详情和岗位字典只读。
- `resource.manage`：更新人员档案和维护技能、资质、培训记录。
- 任务状态摘要使用现有任务读取策略；当前角色均按既有 RLS 验证，查询失败不降级为伪造数据。

接口：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/v1/personnel` | 列表、筛选、任务状态摘要和提醒 |
| GET | `/api/v1/personnel/{id}` | 人员详情及三类能力记录 |
| PATCH | `/api/v1/personnel/{id}` | 更新姓名、部门、岗位和业务可用状态 |
| GET/POST | `/api/v1/personnel/{id}/skills` | 查询/新增技能 |
| PATCH/DELETE | `/api/v1/personnel/{id}/skills/{recordId}` | 修改/删除技能 |
| GET/POST | `/api/v1/personnel/{id}/qualifications` | 查询/新增资质 |
| PATCH/DELETE | `/api/v1/personnel/{id}/qualifications/{recordId}` | 修改/删除资质 |
| GET/POST | `/api/v1/personnel/{id}/training` | 查询/新增培训 |
| PATCH/DELETE | `/api/v1/personnel/{id}/training/{recordId}` | 修改/删除培训 |

成功响应使用 `{ data: ... }`；失败使用统一 `{ error: { code, message } }`。列表支持 `keyword`、`availabilityStatus`、`departmentId` 和 `positionId`，不返回密码、令牌或服务端密钥。

## 页面和交互

`/personnel` 面向拥有 `resource.read` 的用户开放，管理操作仅对 `resource.manage` 用户显示：

- 列表显示姓名、部门、岗位、账户状态、可用状态、任务数量和提醒。
- 详情页分为基础档案、技能、资质、培训、任务状态五个区域。
- `ON_LEAVE`、`QUALIFICATION_SUSPENDED`、`UNAVAILABLE` 和账户停用使用明显提醒；提醒只读，不提供绕过审批的任务操作。
- 表单在客户端提供必填、长度、日期和状态校验，服务端重复校验。

## 权限、安全和审计

- 所有 Route Handler 先校验登录用户账户状态，再校验 `resource.read/resource.manage`。
- `sys_user`、岗位和三类子表启用 RLS；服务端不得绕过 RLS 读取人员任务数据。
- 档案、能力记录的新增、修改和删除调用 `record_audit_event`，记录操作人、对象、前后值和结果。
- 不允许修改 `sys_user.status`，避免人员档案操作绕过登录账户停用策略。
- 自引用用户 ID、未知岗位/部门、越权子记录 ID 和非法日期均返回明确 4xx 错误。

## 异常、恢复和降级

- 已停用账户或不存在的人员返回 `403/404`。
- 重复技能返回 `409`；外键、日期和状态错误返回 `400`。
- 审计写入失败时整体操作失败，避免产生不可追溯变更。
- 本任务不引入缓存、队列或定时任务；后续通知能力可在提醒查询之上增加适配器。
- 数据库迁移可通过回滚上一版本备份恢复；新增表不破坏已有任务分配表。

## 可扩展性和可维护性

- 岗位和能力记录采用独立表，后续可增加证书附件、授权范围和实验室范围而不修改任务表。
- `availability_status` 为稳定状态字典；新增状态必须先更新 Spec、设计、校验、OpenAPI 和迁移。
- 任务状态摘要是读取适配器，T-205 完成分配流程后无需改变人员档案契约。
- 人员 API 保持 `/api/v1` 版本边界，破坏性字段改动进入新版本。

## 备选方案与取舍

- 复制一张 `personnel_profile` 保存姓名和部门：拒绝，会造成与 `sys_user` 的双写和一致性风险。
- 将技能/资质/培训存成 JSON：拒绝，难以约束、查询、审计和后续附件关联。
- 新增专用 `personnel.*` 权限：暂不采用，人员属于已有资源管理域，复用 `resource.*` 可减少角色权限矩阵重复；若后续需要更细粒度授权，再通过变更记录拆分。

## 验证方式

- 单元测试：状态、日期、子记录和筛选参数校验。
- 未认证 E2E：页面跳转登录、API 返回 `401`。
- 权限负向集成：无 `resource.manage` 只能读取，不能更新/写入/删除。
- 正向集成：岗位、人员状态、技能/资质/培训 CRUD、任务状态摘要和提醒；结束后清理临时账号、数据和审计记录。
- 质量门禁：`tsc`、lint、Vitest、生产 build、Playwright、`check-consistency.ps1`、`check:versioning`、对抗性审查。
