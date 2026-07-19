# 报告追溯查询技术设计

| Item | Value |
| --- | --- |
| Design ID | DES-TRACEABILITY-001 |
| Status | Approved |
| Scope | FR-AUDIT-005、AC-AUDIT-001 |
| Depends | DES-REPORTING-001、DES-EXPERIMENT-DATA-001、DES-RESULT-REVIEW-001 |
| Date | 2026-07-16 |

## 1. 目标与边界

为授权的 `report.read` 用户提供从报告回查任务、样品、实验数据和审核记录的只读链路。报告生成事务已经将这些对象固化到 `experiment_report.report_payload`，追溯查询以该不可变快照为事实源，避免报告发布后业务表变化导致历史追溯结果漂移。

本任务不新增表、不修改报告快照、不提供任何追溯节点编辑或删除能力；跨报告比较、图形化血缘和 FR-AUDIT-005 之外的对象追溯不在范围内。

## 2. API 与权限

- `GET /api/v1/trace/{objectType}/{id}` 当前只支持 `objectType=report`。
- 接口先校验当前用户的 `report.read` 权限，再读取报告；未认证返回 401，无权限返回 403，不存在报告返回 404，未知对象类型返回 400。
- 服务端只从报告表读取目标快照，并以字段白名单映射 task、samples、data、reviews，客户端不能提交对象 ID、操作人或时间覆盖查询结果。

## 3. 返回模型

```text
report
└── task
    ├── samples[]
    ├── data[]
    └── reviews[]
```

响应保留报告编号、版本和状态，并返回快照中的任务、样品、结果数据和审核记录。数组顺序使用报告生成时的顺序，节点 ID 用于在页面和后续 API 中继续定位来源。

## 4. 页面

`/reports/trace/{id}` 复用报告读取权限，展示报告摘要和四段只读卡片：任务上下文、样品、实验结果/原始数据、审核记录。报告页提供“查看追溯”入口；页面不提供编辑、状态变更或删除按钮。

## 5. 验证依据

- 单元测试：对象类型、ID、快照字段白名单和缺省数组。
- E2E：未认证用户不能打开追溯页或调用追溯 API。
- 远程集成：报告生成后追溯返回任务、样品、数据和审核记录；普通 `report.read` 用户可读，不能写报告；临时资源清理为 0。
