# 实验方法与版本管理设计

| 项目 | 内容 |
| --- | --- |
| Design ID | `DES-METHOD-VERSIONING-001` |
| 状态 | Approved |
| 日期 | 2026-07-15 |
| 需求 | `FR-METHOD-001`～`FR-METHOD-004`、`FR-TASK-002`、`BR-003`、`BR-005`、`NFR-SEC-002` |

## 1. 设计决策

`experiment_method` 的一行代表一个明确的方法版本。`(method_code, version)` 是业务唯一键，任务通过 `method_id` 引用具体版本；版本号和方法编号一旦创建不可修改，新版本通过新增行建立。这样任务历史、样品关联和审计记录不会随方法库更新而漂移。

方法状态沿用现有字典：`DRAFT`、`ACTIVE`、`INACTIVE`、`EXPIRED`。任务创建和更新只接受 `ACTIVE` 方法版本，由任务服务统一校验。

## 2. 数据与审计

- 新增 `experiment_method_history`，记录创建版本、字段更新、启用/停用/过期等状态变化，以及操作人和时间。
- 数据库触发器禁止修改 `method_code`、`version`，并在认证用户写入时追加方法历史和审计日志。
- 不提供物理删除策略；失效方法通过状态保留，避免破坏历史任务引用。
- `attachment` 以 `object_type=experiment_method`、`object_id=method.id` 保存文件名、Storage 路径、大小和 MIME 类型；文件二进制写入私有 `lims-methods` Storage bucket。上传使用 multipart 接口，元数据写入失败时删除已上传对象进行补偿。

## 3. 权限边界

- `resource.read`：读取方法、历史和方法附件。
- `task.read`：读取任务/样品展示所需的方法摘要和方法附件。
- `resource.manage`：创建和修改方法、状态及附件元数据。
- 服务端校验与 RLS 双重生效；不向浏览器暴露 service role key。

## 4. API

- `GET /api/v1/methods`：按关键字和状态查询方法版本。
- `POST /api/v1/methods`：创建方法版本。
- `GET /api/v1/methods/{id}`：读取方法详情、变更历史和附件。
- `PATCH /api/v1/methods/{id}`：修改可变字段或状态；不能修改编号和版本。
- `POST /api/v1/methods/{id}/attachments`：以 multipart 上传方法附件并登记元数据；仅保留 JSON 元数据登记作为受控兼容入口。

所有写接口只接收业务字段，服务端生成主键、操作人和时间；敏感文件内容不经过应用日志。

## 5. 验证

- 数据库：唯一版本键、版本身份不可变、状态和日期约束、历史/审计写入、RLS 越权验证。
- 服务层：字段校验、重复版本、非法状态、非法日期范围和附件元数据验证。
- 集成：管理员创建并启用方法版本，读取历史和附件；普通资源读取者可读但不能写；重复版本被拒绝。
