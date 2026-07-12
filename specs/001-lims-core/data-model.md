# 核心数据库详细设计

| 项目 | 内容 |
| --- | --- |
| 来源 | `design.md` ER 图、`spec.md` 数据模型要求 |
| 数据库 | Supabase PostgreSQL |
| 状态 | Draft |
| 更新时间 | 2026-07-11 |

## 1. 统一约定

- 表名和字段名使用小写蛇形命名。
- 业务实体主键使用 `BIGINT` 或 `UUID`，由数据库或服务端统一生成；Supabase Auth 用户主键使用 `UUID`。
- 业务编号使用 `VARCHAR(32)`，并建立唯一索引。
- 时间统一使用 `TIMESTAMPTZ`，前端按 Asia/Shanghai 展示。
- 数量和测量值使用 `DECIMAL`，不得用浮点类型保存需要精确比较的结果。
- 状态使用 `VARCHAR` 保存业务状态，由 Zod/业务枚举和 PostgreSQL CHECK 约束共同校验。
- 关键业务表包含 `created_at`、`updated_at`、`created_by`、`updated_by`，用户关联字段使用 UUID。
- 可停用或归档的数据优先使用状态字段，不直接物理删除。
- 业务删除和状态变更必须写入 `audit_log`。

## 2. 认证与组织表

### 2.1 `sys_user`

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| `id` | UUID | PK, FK | 关联 `auth.users.id` |
| `username` | VARCHAR(64) | NOT NULL, UNIQUE | 登录名 |
| `password_hash` | — | — | 密码由 Supabase Auth 管理，业务库不保存 |
| `real_name` | VARCHAR(64) | NOT NULL | 姓名 |
| `department_id` | BIGINT | FK, NULL | 所属部门 |
| `status` | VARCHAR(16) | NOT NULL | ACTIVE/INACTIVE |
| `email` | VARCHAR(128) | NULL | 邮箱 |
| `last_login_at` | TIMESTAMPTZ | NULL | 最近登录时间 |
| `created_at` | TIMESTAMPTZ | NOT NULL | 创建时间 |
| `updated_at` | TIMESTAMPTZ | NOT NULL | 更新时间 |

### 2.2 `sys_role`、`sys_permission`

- `sys_role(id, code, name, status, created_at, updated_at)`。
- `sys_permission(id, code, name, resource, action)`。
- `sys_user_role(user_id, role_id)`：联合主键，两个字段均为外键。
- `sys_role_permission(role_id, permission_id)`：联合主键，两个字段均为外键。

约束：角色编码、权限编码唯一；停用角色不得分配给新用户；删除角色前必须解除关联。

## 3. 实验室与项目表

### 3.1 `lab_laboratory`

`id`、`code`、`name`、`location`、`manager_id(UUID)`、`status`、`created_at`、`updated_at`。

约束：`code` 唯一；实验室停用后不能创建新任务。

### 3.2 `lab_department`

`id`、`laboratory_id`、`parent_id`、`code`、`name`、`status`、`created_at`、`updated_at`。

约束：同一实验室内 `code` 唯一；`parent_id` 不得形成循环。

### 3.3 `research_project`

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| `id` | BIGINT | PK | 项目主键 |
| `project_code` | VARCHAR(32) | NOT NULL, UNIQUE | 项目编号 |
| `name` | VARCHAR(128) | NOT NULL | 项目名称 |
| `owner_id` | UUID | FK, NOT NULL | 项目负责人 |
| `description` | TEXT | NULL | 项目说明 |
| `status` | VARCHAR(16) | NOT NULL | DRAFT/ACTIVE/ARCHIVED |
| `start_date` | DATE | NULL | 开始日期 |
| `end_date` | DATE | NULL | 结束日期 |

## 4. 样品与方法表

### 4.1 `sample`

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| `id` | BIGINT | PK | 样品主键 |
| `sample_code` | VARCHAR(32) | NOT NULL, UNIQUE | 唯一样品编号 |
| `project_id` | BIGINT | FK, NOT NULL | 所属项目 |
| `name` | VARCHAR(128) | NOT NULL | 样品名称 |
| `specification` | VARCHAR(255) | NULL | 规格 |
| `batch_no` | VARCHAR(64) | NULL | 批号 |
| `quantity` | DECIMAL(18,6) | NOT NULL | 数量 |
| `unit` | VARCHAR(16) | NOT NULL | 数量单位 |
| `source` | VARCHAR(128) | NULL | 来源 |
| `storage_condition` | VARCHAR(255) | NULL | 存储条件 |
| `status` | VARCHAR(16) | NOT NULL | REGISTERED/PROCESSING/PROCESSED/ARCHIVED/DISPOSED |
| `registered_at` | TIMESTAMPTZ | NOT NULL | 登记时间 |

约束：数量不得小于 0；归档或处置样品不得直接进入新任务；样品编号不可复用。

### 4.2 `sample_flow`

`id`、`sample_id`、`from_status`、`to_status`、`node`、`operator_id(UUID)`、`location`、`handover_to(UUID)`、`remark`、`occurred_at(TIMESTAMPTZ)`。

约束：每次状态变更必须有操作人和时间；`sample_id` 建立索引。

### 4.3 `experiment_method`

`id`、`method_code`、`name`、`version`、`scope`、`detection_limit`、`status`、`document_id`、`effective_at`、`expired_at`、`created_at`、`updated_at`。

约束：`method_code + version` 唯一；已停用方法不能绑定新任务；历史任务保留原方法版本。

## 5. 任务与数据表

### 5.1 `experiment_task`

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| `id` | BIGINT | PK | 任务主键 |
| `task_code` | VARCHAR(32) | NOT NULL, UNIQUE | 任务编号 |
| `project_id` | BIGINT | FK, NOT NULL | 所属项目 |
| `method_id` | BIGINT | FK, NOT NULL | 采用的方法版本 |
| `name` | VARCHAR(128) | NOT NULL | 任务名称 |
| `priority` | VARCHAR(16) | NOT NULL | LOW/NORMAL/HIGH |
| `status` | VARCHAR(24) | NOT NULL | 任务状态 |
| `planned_start` | DATE | NULL | 计划开始 |
| `planned_end` | DATE | NULL | 计划结束 |
| `remark` | TEXT | NULL | 说明 |

约束：计划结束不得早于计划开始；已归档任务只允许查看和追溯。

### 5.2 任务关联表

- `task_sample(task_id, sample_id)`：任务与样品多对多，联合主键。
- `task_assignee(id, task_id, user_id(UUID), assigned_by(UUID), assigned_at(TIMESTAMPTZ), unassigned_at(TIMESTAMPTZ))`：任务分配历史。
- `task_resource(id, task_id, resource_type, resource_id, quantity, unit)`：任务使用设备或资源的关联。
- `task_status_history(id, task_id, from_status, to_status, operator_id, remark, occurred_at)`：任务状态历史。

### 5.3 `experiment_data`

`id`、`task_id`、`sample_id`、`instrument_id`、`data_type`、`metric_name`、`raw_value`、`processed_value`、`unit`、`source_type`、`collected_at(TIMESTAMPTZ)`、`recorded_by(UUID)`、`remark`。

约束：原始数据不得被处理值覆盖；数值结果使用 `DECIMAL(20,8)`；查询常用组合建立 `(task_id, sample_id, collected_at)` 索引。

## 6. 审核与报告表

### 6.1 `result_review`

`id`、`task_id`、`reviewer_id(UUID)`、`result`、`comment`、`reviewed_at(TIMESTAMPTZ)`、`created_at(TIMESTAMPTZ)`。

约束：审核结果只能为 APPROVED/RETURNED/NEED_MORE；退回时必须填写意见；同一任务允许多次审核，但仅最后一次有效审核决定状态。

### 6.2 `experiment_report`

`id`、`report_code`、`task_id`、`version_no`、`status`、`storage_path`、`generated_by(UUID)`、`generated_at(TIMESTAMPTZ)`、`published_at(TIMESTAMPTZ)`、`archived_at(TIMESTAMPTZ)`。

约束：`report_code + version_no` 唯一；只有审核通过的任务可以生成正式报告；报告发布后生成新版本而不是覆盖旧版本。

## 7. 设备、库存和环境表

### 7.1 `instrument`

`id`、`instrument_code`、`name`、`type`、`model`、`manufacturer`、`location`、`owner_id`、`status`、`commissioned_at`、`next_calibration_at`。

约束：设备编号唯一；停用设备不能绑定新任务；维护和校准日期不得早于启用日期。

### 7.2 `instrument_maintenance`

`id`、`instrument_id`、`maintenance_type`、`occurred_on`、`operator_id(UUID)`、`result`、`next_due_on`、`attachment_id`、`remark`。

### 7.3 `inventory_item`

`id`、`item_code`、`type`、`name`、`batch_no`、`manufacturer`、`quantity`、`unit`、`expiry_date`、`storage_condition`、`location`、`status`。

约束：库存不得小于 0；耗用数量不得超过可用库存；批号和有效期用于追溯。

### 7.4 `inventory_transaction`

`id`、`item_id`、`task_id`、`transaction_type`、`quantity`、`operator_id(UUID)`、`occurred_at(TIMESTAMPTZ)`、`remark`。

库存数量由交易记录产生，禁止直接修改库存总量而不产生交易记录。库存写操作必须在服务端事务中完成。

### 7.5 `environment_record`

`id`、`laboratory_id`、`metric`、`value`、`unit`、`threshold_min`、`threshold_max`、`collected_at(TIMESTAMPTZ)`、`source_type`、`recorded_by(UUID)`、`status`。

## 8. 附件和审计表

- `attachment(id, object_type, object_id, file_name, storage_path, file_size, content_type, uploaded_by(UUID), uploaded_at(TIMESTAMPTZ))`。
- `audit_log(id, operator_id(UUID), object_type, object_id, action, before_json(JSONB), after_json(JSONB), ip_address, occurred_at(TIMESTAMPTZ))`。

约束：审计日志只追加不更新；附件删除应记录删除事件；`before_json` 和 `after_json` 不保存密码等敏感信息。

## 9. 索引建议

- 所有业务编号建立唯一索引。
- 所有外键建立普通索引。
- 任务：`(status, planned_end)`、`(project_id, status)`。
- 样品：`(project_id, status)`、`(storage_condition)`。
- 实验数据：`(task_id, sample_id, collected_at)`。
- 审计日志：`(object_type, object_id, occurred_at)`、`(operator_id, occurred_at)`。
- 库存：`(expiry_date, status)`、`(type, status)`。

## 10. Supabase 数据安全约束

- 所有业务表启用 RLS。
- 浏览器端只使用 anon key 和用户会话，不得暴露 service role key。
- 页面查询、Route Handler 和数据库 RLS 三层均需考虑权限边界。
- 审核、报告发布、库存扣减等状态变更必须通过服务端业务函数执行。
- Auth 用户删除或停用时，业务档案采用停用策略，不级联删除实验历史。

## 11. 下一步

- [x] 根据 Supabase PostgreSQL 生成数据库 migration 脚本：`supabase/migrations/202607120001_initial_schema.sql`。
- [x] 在演示 Supabase 项目执行 migration 并记录结果：远程迁移版本 `202607120001`，`sys_user` 核心表 REST 查询返回 HTTP 200。
- [ ] 确认状态值字典和错误码。
- [ ] 确认是否使用软删除字段。
- [ ] 根据 API 查询场景复核索引。
