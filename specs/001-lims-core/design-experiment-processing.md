# 实验数据处理与规则判定设计

| 项目 | 内容 |
| --- | --- |
| Design ID | `DES-EXPERIMENT-PROCESSING-001` |
| 状态 | Approved |
| 日期 | 2026-07-15 |
| 需求 | `FR-DATA-004`、`FR-DATA-007～008`、`AC-DATA-001`、`BR-003`、`BR-005`、`NFR-DATA-002～003`、`NFR-SEC-002` |
| 依赖 | `DES-EXPERIMENT-DATA-001`、`DES-METHOD-VERSIONING-001` |

## 1. 设计目标与边界

本设计为 T-303 提供可审计、可重放和可扩展的数据处理边界。处理输入来自已经保存的 `experiment_data`，处理输出仍然写入新的 `experiment_data` 记录；任何规则执行都不得覆盖原始数据或既有处理结果。

本阶段包含：

- 版本化处理规则、处理运行记录和输入输出血缘；
- 数值修约和阈值判定两个最小可用规则类型；
- 处理成功、异常标记和失败的结果状态；
- `/api/v1` 处理接口、处理记录查询和 `/data` 页面交互；
- 数据库约束、RLS、审计和失败补偿。

本阶段不包含：

- CSV/Excel 导入导出（`FR-DATA-006`，由 T-601 实现）；
- 真实或模拟仪器接口接入（`FR-DATA-009`，由 T-602 实现）；
- 结果审核、报告发布和电子签名（由 T-304、T-305、T-604 实现）；
- 从数据库配置中执行任意 SQL、JavaScript 或表达式代码。

## 2. 核心设计决策

### 2.1 规则版本不可变

处理规则以 `(rule_code, version)` 作为业务唯一身份。规则的类型、配置和适用范围在创建后不可修改；规则变更必须创建新版本。历史处理运行始终引用具体的 `rule_id`，因此规则库后续新增版本不会改变历史结果的含义。

T-303 只通过 migration 提供两个演示用的活动规则：

- `ROUND`：按规则配置的 `scale` 和 `HALF_UP` 模式进行数值修约；
- `THRESHOLD`：按 `min`、`max` 和边界是否包含配置进行范围判定。

规则分派使用服务层的显式策略注册表（`rule_type -> pure function`），不使用 `eval`、动态脚本或数据库表达式执行。后续增加规则类型必须同时增加配置校验、纯函数单元测试、审计说明和版本记录。

### 2.2 处理运行是一次不可变的业务操作

一次运行具有唯一 `run_id`，可以引用一个或多个输入数据。运行状态只允许从 `RUNNING` 转为一个终态：`SUCCEEDED`、`FLAGGED` 或 `FAILED`。进入终态后不允许修改规则、输入、输出、判定或异常说明；重新处理必须创建新的运行记录。

状态含义如下：

| 状态 | 含义 | 是否产生输出 |
| --- | --- | --- |
| `RUNNING` | 已创建运行，正在执行持久化流程 | 否 |
| `SUCCEEDED` | 规则成功执行，结果通过判定 | 是，`PROCESSED` 或 `RESULT` |
| `FLAGGED` | 规则成功执行，但结果需要关注或未通过阈值 | 是，并保留异常说明 |
| `FAILED` | 输入、规则配置或执行过程无法完成 | 否 |

`ROUND` 默认产生 `PROCESSED` 数据，`THRESHOLD` 产生 `RESULT` 数据并额外保存 `PASS`、`FAIL` 或 `REVIEW` 判定。异常说明只记录规则版本、边界、判定和数据 ID，不在审计日志中复制原始数值。

### 2.3 数据血缘使用独立关联表

输入和输出通过 `experiment_data_lineage` 关联，而不是在 `experiment_data` 中增加易变的上游字段。每条血缘记录至少包含 `run_id`、`source_data_id`、`output_data_id` 和 `relation_type=DERIVED_FROM`，并对同一组合建立唯一约束。

该设计同时支持单输入和多输入规则。T-303 的两个规则只接受一个数值输入，但后续均值、空白校正或批量汇总可以复用同一模型，而不需要改变 `experiment_data` 的含义。

## 3. 模块与数据模型

### 3.1 `experiment_processing_rule`

建议字段：

| 字段 | 约束与用途 |
| --- | --- |
| `id` | 主键 |
| `rule_code` | 稳定编码，非空 |
| `name` | 展示名称，非空 |
| `version` | 规则版本，非空 |
| `rule_type` | `ROUND` 或 `THRESHOLD` |
| `config` | JSONB；由服务层和数据库约束共同校验 |
| `status` | `DRAFT`、`ACTIVE`、`RETIRED` |
| `created_by`、`created_at` | 创建者和创建时间 |

唯一键为 `(rule_code, version)`。`config` 不是可执行代码：`ROUND` 只允许 `scale: 0～8` 和 `roundingMode: HALF_UP`；`THRESHOLD` 只允许有限数值边界及布尔边界配置，且 `min <= max`。

### 3.2 `experiment_processing_run`

建议字段：

| 字段 | 约束与用途 |
| --- | --- |
| `id` | 主键，作为运行标识 |
| `task_id`、`rule_id` | 任务和规则版本引用 |
| `execution_mode` | `MANUAL` 或 `SIMULATED`；`SIMULATED` 仅表示生成演示处理结果，不代表仪器接入 |
| `status` | `RUNNING`、`SUCCEEDED`、`FLAGGED`、`FAILED` |
| `output_data_id` | 成功或标记运行的输出数据 ID，可空 |
| `decision` | `PASS`、`FAIL`、`REVIEW` 或空 |
| `explanation` | 判定或异常说明 |
| `error_code`、`error_message` | 失败原因，禁止写入密钥和原始文件内容 |
| `executed_by`、`executed_at` | 执行者和执行时间 |

数据库触发器只允许状态单向进入终态，并禁止终态运行的业务字段变更。`output_data_id` 只能指向同一任务的新记录。

### 3.3 `experiment_data_lineage`

建议字段为 `id`、`run_id`、`source_data_id`、`output_data_id`、`relation_type`、`created_at`。建立以下约束：

- 输入和输出不得为同一记录；
- 输入数据必须属于运行任务，且只能是 `RAW` 或已有的 `PROCESSED/RESULT`；
- 输出必须属于运行任务，且只能是新建的 `PROCESSED/RESULT`；
- `(run_id, source_data_id, output_data_id, relation_type)` 唯一；
- 运行、血缘和输出的删除策略为禁止删除，任务归档后仍可查询。

T-303 的输出统一使用 `source_type=API`，并通过现有 `experiment_data` 插入守卫检查任务状态、样品关联、设备状态和记录人。原始记录的行和数值字段不执行 `UPDATE`。

## 4. 服务与 API 契约

### 4.1 服务层

新增 `src/lib/server/experiment-processing.ts`，分为四个边界：

1. 规则加载与配置校验；
2. 纯函数策略执行（修约、阈值判定）；
3. 输入数据、任务状态和方法版本的追溯校验；
4. 通过事务性 RPC 持久化运行、输出、血缘和审计。

服务层不接受客户端传入 `executedBy`、时间、运行状态或输出 ID。记录人从当前会话生成，规则和输入数据只接受 ID，所有返回数据按服务器查询结果序列化。

### 4.2 接口

| 方法 | 路径 | 权限 | 说明 |
| --- | --- | --- | --- |
| GET | `/api/v1/processing-rules` | `data.read` | 查询可选择的活动规则版本 |
| POST | `/api/v1/tasks/{id}/data/process` | `data.manage` | 按规则处理选定输入并创建新输出 |
| GET | `/api/v1/tasks/{id}/data/process-runs` | `data.read` | 查询运行、判定、异常和血缘 |

处理请求业务字段：

```json
{
  "ruleId": 1,
  "sourceDataIds": [10],
  "executionMode": "MANUAL"
}
```

接口必须拒绝未知字段、空输入、非数值输入、非活动规则、跨任务输入和 `APPROVED`/`ARCHIVED` 任务。任务被锁定时返回 `409 DATA_TASK_LOCKED`；规则或输入不属于当前任务时返回 `400/404`；无权限返回 `403`。同一规则和输入可以再次执行，但每次执行都会产生新的 `run_id`。

处理成功返回 `201`，包含运行摘要、输出数据摘要、判定、说明和血缘。失败处理返回 `422 PROCESSING_FAILED`，同时保留一条 `FAILED` 运行记录；若事务本身失败，不得留下半成品输出或血缘。

## 5. 页面与交互

`/data` 页面复用 T-302 的历史数据列表，增加处理区域：

- 选择当前任务和一个或多个可处理的数据行；
- 显示规则名称、版本、类型和配置摘要；
- 选择 `MANUAL` 或 `SIMULATED` 后提交处理；
- 展示运行状态、输出类型、判定、异常说明、规则版本和输入/输出血缘；
- 明确标记“生成新记录”，不提供覆盖原始数据的按钮；
- 任务为 `APPROVED` 或 `ARCHIVED` 时禁用执行并显示锁定原因。

页面只负责选择和展示，计算、权限和状态校验均在服务层及数据库完成。后续结果审核页面可以通过 `run_id` 和 `output_data_id` 直接引用处理结果。

## 6. 权限、审计与失败补偿

- `data.read` 可读取规则、运行和血缘；`data.manage` 才能执行处理；
- RLS 禁止客户端直接更新或删除规则、运行和血缘；
- 处理操作写入 `audit_log`，对象类型为 `experiment_processing_run`，保存操作者、规则 ID、输入/输出 ID、状态和判定；
- 规则配置、异常说明和审计内容不得包含 service role key、密码、令牌或文件原文；
- 持久化使用一个事务性数据库函数：创建运行、插入输出、插入血缘、更新终态和写审计要么全部成功，要么全部回滚；
- 计算失败时由服务层调用失败记录函数，只创建 `FAILED` 运行，不创建输出；数据库异常时不进行不可靠的跨请求补偿，依靠事务回滚和可重试的新运行恢复；
- 处理请求不使用浏览器端 service role key。

## 7. 扩展与维护策略

- 新规则类型通过策略注册表扩展，不修改既有规则版本的语义；
- 规则配置使用独立校验器和版本化 fixture，避免把业务条件散落在页面组件中；
- 数据库函数只负责权限、约束和事务，不承载复杂的展示逻辑；
- API 返回运行和血缘的稳定 ID，审核、报告和导出模块通过 ID 复用，不复制处理结果；
- 当规则需要文件、批量队列或外部仪器时，新增适配器和任务，不改变本设计的不可变数据与血缘原则。

## 8. 验证方式

- 单元测试：规则配置边界、修约结果、阈值包含/不包含边界、异常说明和未知规则拒绝；
- 数据库集成测试：规则版本唯一且不可变、终态运行不可改、输出与血缘原子性、RLS 越权拒绝、原始数据不变；
- API/E2E：未认证 401/重定向、读者可读不可执行、正常处理、阈值异常、任务锁定和失败路径；
- 质量门禁：`npm run lint`、`npx tsc --noEmit`、单元测试、生产构建、远程集成测试、对抗性审查、`scripts/sdd/check-consistency.ps1` 和版本检查。

## 9. 事务边界的规则防伪校验

持久化 RPC 在同一数据库事务内重新计算选中规则的期望输出类型、修约值或阈值判定、decision 和终态。调用方即使绕过服务层直接通过 PostgREST RPC 提交伪造的处理值或判定，也不能写入与规则不一致的运行记录。服务层继续负责面向用户的输入校验和说明文本，数据库事务负责最终的数据完整性边界。
