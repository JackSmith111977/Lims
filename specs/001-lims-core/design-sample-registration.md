# 样品登记与唯一编号技术设计

| 项目 | 内容 |
| --- | --- |
| 设计编号 | DES-SAMPLE-REGISTRATION-001 |
| 来源 Spec | `FR-SAMPLE-001～003`、`AC-SAMPLE-001`、`NFR-SEC-001～002`、`NFR-DATA-001` |
| 状态 | Approved |
| 日期 | 2026-07-15 |

## 设计目标与边界

T-203 建立“样品 → 项目 → 任务/方法”的登记闭环：保存样品基础信息，生成或维护唯一编号，绑定所属科研项目，并可将样品关联到已有任务。样品与方法不新增重复关系表，样品详情通过 `task_sample` 和 `experiment_task.method_id` 展开关联方法。

本任务明确不实现：

- 样品状态变更、采集/分发/转移/处理/归档和流转历史（T-204）。样品登记创建为 `REGISTERED`，登记接口拒绝直接覆盖 `status`。
- 任务分配和任务状态机（T-205）。
- 送样单、照片和附件（后续任务）。
- 方法版本维护（T-301）；只展示任务已引用的方法版本。

## 模块边界

```text
样品页面
  └─ /api/v1/samples、/api/v1/samples/{id}
       ├─ sample service：sample
       ├─ project reference：research_project
       └─ task/method relation：task_sample → experiment_task → experiment_method
```

- `src/lib/server/sample-registration.ts` 集中处理字段校验、编号生成、项目/任务引用校验、关联替换和审计。
- Route Handler 只负责认证、权限、query/body 解析和响应转换。
- 不创建 `sample_method` 或复制项目、任务、方法名称，避免关系事实漂移。

## 数据模型和完整性

复用现有表：

- `sample`：`sample_code` 唯一；`project_id` 必填；名称、规格、数量、单位、来源、批号和存储条件为登记字段；数据库默认状态为 `REGISTERED`。
- `task_sample`：样品与任务的多对多关联；每个任务必须属于样品同一项目，归档任务不能作为新关联目标。
- `experiment_task.method_id`：样品关联方法的唯一来源；详情返回任务及其方法摘要。

唯一编号策略：

- `sampleCode` 可由用户提供，服务端去除首尾空白并规范为大写；数据库唯一约束是最终并发安全边界。
- 未提供编号时生成 `SMP-YYYYMMDD-XXXXXXXX`，其中随机段来自服务端密码学随机源；遇到唯一冲突最多重试 3 次。
- 编号长度不超过数据库 `VARCHAR(32)`，不允许空字符串。

字段规则：

- `projectId` 必须引用存在且非 `ARCHIVED` 的项目。
- `quantity` 为非负、最多 6 位小数的十进制数，映射数据库 `DECIMAL(18,6)`；`unit` 必填。
- 创建时状态固定为 `REGISTERED`；修改请求出现 `status` 返回稳定错误 `SAMPLE_STATUS_DEFERRED`。
- `taskIds` 缺省为空数组；关联写入前校验任务存在、属于同一项目、不是 `ARCHIVED`。

## API 契约

权限：

- `sample.read`：查询样品及可见的项目、任务和方法摘要。
- `sample.manage`：创建和修改样品基础登记信息。
- `task.manage`：维护样品与任务关联；若当前用户没有该权限，带 `taskIds` 的写请求拒绝。

接口：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/v1/samples` | 样品列表，支持 keyword/status/projectId |
| POST | `/api/v1/samples` | 创建样品，可省略 sampleCode，可带 taskIds |
| GET | `/api/v1/samples/{id}` | 样品详情、项目、任务及方法摘要 |
| PATCH | `/api/v1/samples/{id}` | 修改登记字段和任务关联，不改变 status |

成功响应使用 `{ data: ... }`；失败使用 `{ error: { code, message } }`。重复编号返回 `409 SAMPLE_CODE_EXISTS`，项目/任务引用和字段错误返回 `400`。

## 页面和交互

- `/samples`：样品列表、关键词/状态/项目筛选、创建和编辑表单。
- 样品表单展示自动生成编号或允许手工填写编号；数量、单位、项目和登记字段均在服务端再次校验。
- 任务关联使用当前项目下已有任务；详情展示任务状态和方法版本，不能在此页面修改任务状态或方法定义。
- 无任务时允许先登记样品，之后通过编辑补充关联。

## 权限、安全和审计

- 页面、API 和数据库 RLS 分别执行认证、`sample.*`/`task.manage` 权限校验。
- 不接受 `created_at`、`updated_at`、`registered_at` 或服务端审计字段；不记录密码、令牌或密钥。
- 样品创建/修改及任务关联变化调用 `record_audit_event`，前后值只包含样品业务字段和任务 ID。
- 关联更新采用删除后重建，并在失败时补偿恢复样品基础字段和旧关联，避免页面显示与数据库事实分离。

## 异常、恢复和降级

- 未认证返回 401，无权限返回 403，不存在返回 404，重复编号返回 409。
- 归档项目、无效任务、跨项目任务和归档任务关联返回 400；状态字段由 T-204 接管。
- 自动编号发生唯一冲突时服务端重试；连续冲突返回 `SAMPLE_CODE_GENERATION_FAILED`，不写入半成品数据。
- 审计写入失败时整体操作失败，保持可追溯要求。

## 可扩展性和验证

- 编号生成封装在服务层，可在不改变 API 的情况下替换为数据库序列或组织级编号策略。
- 任务/方法只通过 ID 和关联查询连接，后续 T-204、T-206、T-301 可复用详情契约。
- 单元测试覆盖编号规范化、数量/状态/任务 ID 校验；远程集成覆盖生成编号、手工编号、重复编号、任务关联和权限越权。
