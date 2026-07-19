# 实验数据文件交换设计

| 项目 | 内容 |
| --- | --- |
| Design ID | `DES-DATA-EXCHANGE-001` |
| 来源 Spec | `FR-DATA-006`、`NFR-DATA-002`、`NFR-SEC-001～002` |
| 关联任务 | `T-601` |
| 状态 | Approved |

## 1. 范围和入口

T-601 为实验人员提供任务级 CSV/Excel 数据导入。入口为受权限保护的 `POST /tasks/{id}/data/import`，页面在实验数据页提供文件选择和导入结果反馈。导入只新增 `experiment_data` 记录，不更新或删除已有原始/处理数据。

支持 `.csv` 和 `.xlsx`（现代 Excel 工作簿）；第一行作为字段名，字段采用以下规范名称，允许对应的 snake_case 别名：

`sampleId`、`instrumentId`、`dataType`、`metricName`、`rawValue`、`processedValue`、`unit`、`sourceType`、`collectedAt`、`remark`。

## 2. 安全和边界

- 仅拥有 `data.manage` 的已认证活动用户可以导入；服务端从会话生成 `recordedBy` 和创建时间，客户端不能覆盖服务端字段。
- 单文件最大 5 MiB，最多 500 条数据行；空文件、缺少必需列、未知列值、非法数值/时间或不支持的扩展名返回可定位的 4xx 错误。
- 任务必须处于可录入状态；每行样品必须已关联到任务，设备必须存在且不能为 `SCRAPPED`。
- 所有行在写入前完成解析和业务校验；任一行失败则整次导入不写入。成功写入的每条数据使用 `sourceType=FILE` 的约束，保留原始/处理数据分离规则。
- 导入成功和失败均写入关键操作审计；审计内容只保存文件名、扩展名、行数、成功/失败摘要，不保存文件内容、密码、Token 或连接串。

## 3. 解析和错误模型

服务端使用统一的表格解析适配器把 CSV/Excel 工作表转换为规范字段，再复用 `experiment-data` 的数据类型、值形状、长度和时间校验。`collectedAt` 在导入层统一解析为带 `Z` 的 ISO 8601 UTC 字符串，避免 ExcelJS、操作系统时区或 CI runner 时区造成同一文件结果不一致；无法解析的时间保留为非法值并由统一行校验拒绝。错误至少包含 `IMPORT_FILE_REQUIRED`、`IMPORT_FILE_TYPE_UNSUPPORTED`、`IMPORT_FILE_TOO_LARGE`、`IMPORT_ROW_LIMIT_EXCEEDED`、`IMPORT_HEADERS_INVALID` 和 `IMPORT_ROW_INVALID`，行错误包含行号和字段名，但不回显整行内容。

响应返回导入数量和新增数据视图：`{ data: ExperimentDataView[], importedCount }`。已有任务锁定错误继续使用 `DATA_TASK_LOCKED`，认证、授权和对象不存在错误沿用现有管理 API 错误模型。

## 4. 验收依据

- CSV 和 XLSX 正常导入后，新增记录可在任务数据历史中查询，且来源为 `FILE`。
- 原始数据与处理数据的值字段约束、任务/样品/设备关联和不可变边界与单条录入一致。
- 未认证、无 `data.manage`、停用用户、错误扩展名、超限文件和部分非法行均被拒绝，拒绝时不产生数据写入。
- 导入操作可由授权审计用户查询，审计不包含文件内容或敏感凭据。
