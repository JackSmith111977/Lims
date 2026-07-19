# 样品状态与流转设计

| 项目 | 内容 |
| --- | --- |
| 来源 Spec | `specs/001-lims-core/spec.md` |
| 需求范围 | `FR-SAMPLE-004～006`、`AC-SAMPLE-002`、`BR-003`、`BR-005`、`NFR-SEC-002` |
| 设计编号 | `DES-SAMPLE-FLOW-001` |
| 状态 | Approved |
| 版本 | v0.1 |
| 更新时间 | 2026-07-15 |

## 1. 目标与边界

本设计实现样品当前状态、当前位置和流转历史的可查询能力，以及采集、分发、转移、处理、归档和处置事件的登记能力。样品基础字段、唯一编号和项目/任务/方法关联仍由 `DES-SAMPLE-REGISTRATION-001` 负责；附件和异常提醒分别由后续任务实现。

本任务不新增样品状态表或位置冗余字段，复用 `sample.status` 和已有 `sample_flow` 表。当前位置取该样品最近一条具有 `location` 的流转记录，避免与历史记录产生第二个事实源。

## 2. 状态机与事件

### 2.1 持久化状态

| 状态 | 含义 | 是否终态 |
| --- | --- | --- |
| `REGISTERED` | 样品已登记，等待处理 | 否 |
| `PROCESSING` | 样品正在处理 | 否 |
| `PROCESSED` | 样品处理完成 | 否 |
| `ARCHIVED` | 样品已归档 | 是 |
| `DISPOSED` | 样品已处置 | 是 |

“待处理”是 `REGISTERED` 的业务展示语义，不单独写入数据库。所有状态更新均由流转服务完成，样品登记接口不得接收 `status`。

### 2.2 节点规则

| 节点 | 允许的当前状态 | 目标状态 | 事件语义 |
| --- | --- | --- | --- |
| `COLLECT` | `REGISTERED` | 不变 | 记录采集位置、时间和说明 |
| `DISTRIBUTE` | `REGISTERED` | 不变 | 记录分发位置、交接人和说明 |
| `TRANSFER` | `REGISTERED`、`PROCESSING`、`PROCESSED` | 不变 | 记录转移位置、交接人和说明 |
| `PROCESS` | `REGISTERED` | `PROCESSING` | 开始处理 |
| `PROCESS` | `PROCESSING` | `PROCESSED` | 完成处理 |
| `ARCHIVE` | `PROCESSED` | `ARCHIVED` | 归档 |
| `DISPOSE` | `PROCESSED` | `DISPOSED` | 处置 |

每条事件都写入 `from_status` 和 `to_status`。物流事件两者相同；状态事件两者不同。`ARCHIVED` 和 `DISPOSED` 后不再接受任何节点。

## 3. 事务与安全设计

### 3.1 写入事务

新增数据库函数 `public.transition_sample_flow`，由 `POST /samples/{id}/flows` 调用：

1. 校验调用者具有 `sample.manage`，并以 `FOR UPDATE` 锁定目标样品。
2. 校验节点、终态、状态转换和交接用户的 ACTIVE 状态。
3. 计算 `from_status`、`to_status`、`operator_id = auth.uid()` 和 `occurred_at = now()`。
4. 更新 `sample.status`，插入 `sample_flow`。
5. 在同一事务中写入 `audit_log`，动作使用 `FLOW`，保存前后状态和流转字段。
6. 返回新建流转记录；任一步失败则整笔回滚。

函数使用 `SECURITY DEFINER`、固定 `search_path = public`，只授予 `authenticated` 执行权限并撤销 `public` 执行权限。函数仍在数据库内复核权限，Route Handler 的权限检查不能成为唯一安全边界。

### 3.2 读写权限

- `GET /samples/{id}`、`GET /samples/{id}/flows`：需要 `sample.read`。
- `POST /samples/{id}/flows`：需要 `sample.manage`。
- `sample_flow` 仅建立 `sample.read` 的 SELECT 策略，不建立浏览器端 INSERT/UPDATE/DELETE 策略；写入只能通过事务函数完成。
- `handoverTo` 必须为 ACTIVE 的 `sys_user`；操作人由会话确定，客户端不得伪造。

## 4. API 与返回模型

### 4.1 POST

请求：

```json
{
  "node": "TRANSFER",
  "location": "冷藏柜 A-03",
  "handoverTo": "00000000-0000-4000-8000-000000000001",
  "remark": "转交检测人员"
}
```

`node` 必填；`location` 最长 128 个字符，`handoverTo` 必须为 UUID，`remark` 最长 2000 个字符。请求体不接受 `fromStatus`、`toStatus`、`operatorId`、`occurredAt`。

返回字段：`id`、`sampleId`、`fromStatus`、`toStatus`、`node`、`operatorId`、`location`、`handoverTo`、`remark`、`occurredAt`。

### 4.2 GET

返回该样品的流转记录，按 `occurred_at desc, id desc` 排序。样品详情额外返回 `currentLocation`，其值为最近一条非空位置记录的 `location`，没有位置时为 `null`。

稳定错误码：

| HTTP | 错误码 | 场景 |
| --- | --- | --- |
| 400 | `INVALID_FLOW_NODE` / `INVALID_FIELD` | 节点或字段格式错误 |
| 403 | `FORBIDDEN` | 无 `sample.manage` 写权限 |
| 404 | `SAMPLE_NOT_FOUND` | 样品不存在 |
| 409 | `INVALID_SAMPLE_TRANSITION` | 节点与当前状态不匹配或样品已终止 |
| 409 | `HANDOVER_USER_INACTIVE` | 交接用户不存在、停用或不可用 |

## 5. 验证依据

- 单元测试：节点白名单、字段长度、UUID 和请求不得伪造服务端状态字段。
- 未认证 E2E：流转读写接口均返回认证错误。
- 远程集成：采集/分发/转移保持状态，连续处理推进两个状态，归档/处置进入终态，非法转换和停用交接用户被拒绝，流转记录与审计记录可查询。
- 质量门禁：TypeScript、Lint、Vitest、Playwright、生产构建和 SDD 一致性检查全部通过。
