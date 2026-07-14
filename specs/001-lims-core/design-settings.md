# 基础设置管理技术设计

| 项目 | 内容 |
| --- | --- |
| 设计编号 | DES-SETTING-001 |
| 来源 Spec | `FR-SETTING-001`、`FR-SETTING-002`、`FR-SETTING-003`、`NFR-SEC-001`、`NFR-SEC-002`、`NFR-MAINT-001～002` |
| 状态 | Approved |
| 日期 | 2026-07-12 |

## 设计目标

在用户与角色管理完成后，提供实验室组织结构、通用分类、计量单位和系统参数的统一管理能力。设计只覆盖 T-105B 的基础设置，不提前实现实验组业务成员分配、项目业务流程或报告模板。

## 架构和模块边界

```text
系统管理页面 /admin/settings
  → /api/v1/settings/* Route Handlers
  → requireAdminPermission("settings.manage")
  → Supabase SSR Client + PostgreSQL RLS
  → audit_log
```

- 页面按设置类型分区，统一使用状态、编码、名称和反馈组件。
- Route Handler 负责会话、权限、参数校验、冲突映射和审计调用。
- 数据访问集中在 `src/lib/server/settings-data.ts`，页面不直接访问 Supabase。
- 分类使用类型化通用表，新增分类类型只需增加配置，不复制表和接口。

## 数据模型和迁移

继续使用已有 `lab_laboratory` 和 `lab_department`，新增：

- `lab_group`：实验组，字段为 `id`、`laboratory_id`、`code`、`name`、`leader_id`、`status`、时间字段；同一实验室内编码唯一。
- `sys_category`：通用分类，字段为 `id`、`category_type`、`code`、`name`、`parent_id`、`description`、`sort_order`、`status`、时间字段；覆盖 `PROJECT`、`SAMPLE`、`TASK`、`INSTRUMENT`、`RESOURCE` 五类，类型与编码联合唯一。
- `sys_unit`：计量单位，字段为 `id`、`code`、`name`、`symbol`、`dimension`、`sort_order`、`status`、时间字段；编码唯一。
- `sys_parameter`：系统参数，字段为 `id`、`code`、`name`、`value_type`、`value_json`、`description`、`status`、时间字段；编码唯一。参数值使用 JSON 以支持字符串、数字、布尔和结构化配置，但不保存密码、密钥或令牌。

约束和迁移规则：

- 所有设置表启用 RLS，读写权限使用 `settings.manage`。
- 组织、分类、单位和参数默认采用停用，不提供物理删除 API。
- `lab_department.parent_id`、`sys_category.parent_id` 由服务端校验同一作用域和无环；数据库外键负责引用完整性。
- 所有写操作通过 `record_audit_event` 记录对象、动作、前值和后值；`record_audit_event` 扩展允许 `settings.manage`。
- migration 必须可在已有 T-105A 迁移之后执行，回滚通过反向 migration 说明，不手工改线上表。

## API 契约

统一前缀 `/api/v1/settings`，所有接口要求 `settings.manage`：

| 方法 | 路径 | 作用 |
| --- | --- | --- |
| GET/POST | `/laboratories` | 查询、新增实验室 |
| PATCH | `/laboratories/{id}` | 修改实验室或停用 |
| GET/POST | `/departments` | 查询、新增部门 |
| PATCH | `/departments/{id}` | 修改部门或停用 |
| GET/POST | `/groups` | 查询、新增实验组 |
| PATCH | `/groups/{id}` | 修改实验组或停用 |
| GET/POST | `/categories` | 按类型查询、新增分类 |
| PATCH | `/categories/{id}` | 修改分类或停用 |
| GET/POST | `/units` | 查询、新增计量单位 |
| PATCH | `/units/{id}` | 修改计量单位或停用 |
| GET/POST | `/parameters` | 查询、新增系统参数 |
| PATCH | `/parameters/{code}` | 按编码修改参数或停用 |

错误模型沿用管理 API：`401` 未认证、`403` 无权限、`400` 参数或层级错误、`409` 编码冲突、`404` 对象不存在、`500` 数据库或审计失败。

## 页面和交互

- 新增 `/admin/settings`，以“组织结构、分类、计量单位、系统参数”四个区块展示。
- 实验室、部门和实验组使用级联选择；部门和分类显示树形父子关系。
- 分类和单位提供类型、编码、名称、状态、排序和描述字段。
- 系统参数编辑器根据 `value_type` 选择字符串、数字、布尔或 JSON 输入，并在提交前校验类型。
- 停用操作需要二次确认；页面显示服务端错误，不伪造成功。
- 页面入口只对 `settings.manage` 可见，API 始终重复执行服务端权限校验。

## 权限、安全和审计

- 使用现有 `settings.manage` 权限，避免新增重复权限码。
- 参数值响应默认返回脱敏后的结构；本任务禁止保存敏感配置。
- 所有写操作记录 `CREATE`、`UPDATE`、`STATUS_UPDATE` 审计事件，不记录密码或密钥。
- RLS 作为服务端权限之外的数据库兜底；服务端只使用公开客户端会话访问业务表。

## 异常、恢复和降级

- 编码冲突返回 `409 SETTING_CODE_EXISTS`，不覆盖已有记录。
- 父节点不存在、跨实验室引用或形成循环返回 `400 INVALID_PARENT`。
- 参数类型与 `value_json` 不匹配返回 `400 INVALID_PARAMETER_VALUE`。
- Supabase 不可用时返回统一 `500 SETTINGS_LOOKUP_FAILED` 或 `SETTINGS_WRITE_FAILED`，不返回伪造数据。
- 列表读取失败时页面保留错误提示；不会因为单个设置区块失败而写入其他区块。

## 可扩展性与可维护性

- `sys_category.category_type` 和 `sys_parameter.value_type` 作为配置化扩展点，新增业务模块不新增重复基础表。
- Route Handler 通过共享校验和序列化函数保持接口边界稳定。
- 未来可将设置页面拆成独立模块，保持 `/api/v1/settings` 版本边界不变。

## 备选方案与取舍

- 不为样品、任务、设备、资源分别建立分类表，避免分类规则重复和跨模块迁移成本。
- 不把系统参数存入 `config.toml` 或环境变量；运行时业务参数需要审计、状态和数据库一致性。
- 不使用物理删除，保证历史记录和外键关系可追溯。

## 验证方式

- `settings.manage` 管理员可以新增、修改、停用实验室、部门、实验组、分类、单位和参数。
- 重复编码、非法父节点、循环层级和错误参数类型均返回预期错误，数据库无部分写入。
- 无权限用户访问设置 API 返回 `403`，写操作生成审计记录。
- 运行 TypeScript、Lint、单元/E2E、构建和一致性检查，并核验 migration 在远程测试项目成功应用。
