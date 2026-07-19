# 报告模板配置设计

| Item | Value |
| --- | --- |
| Design ID | `DES-REPORT-TEMPLATE-001` |
| Status | Approved |
| Scope | `FR-SETTING-004`、`FR-REPORT-001～006`、`NFR-SEC-001～002` |
| Depends | `DES-SETTING-001`、`DES-REPORTING-001` |

## 1. 设计选择

报告模板使用已有 `sys_parameter` 的 JSON 能力，但通过独立资源 `/settings/report-templates` 和 `REPORT_TEMPLATE_` 编码前缀形成明确的业务边界。每条模板包含模板名称、版本化字段列表和可选标题/说明，例如：

```json
{
  "title": "实验结果报告",
  "fields": ["task", "samples", "data", "reviews"],
  "description": "默认实验报告字段"
}
```

模板配置是设置数据，不直接覆盖已生成报告；生成报告时数据库触发器将当前 ACTIVE 的 `REPORT_TEMPLATE_DEFAULT` 合并到 `experiment_report.report_payload.template`，形成不可变快照。没有活动默认模板时使用空对象，历史报告不受后续配置改变影响。

## 2. API、权限和校验

- `GET/POST /api/v1/settings/report-templates` 和 `PATCH /api/v1/settings/report-templates/{code}` 均要求 `settings.manage`。
- 服务端强制 `valueType=JSON`，编码必须匹配 `REPORT_TEMPLATE_[A-Z0-9_]+`；模板 JSON 必须是对象，`fields` 如存在必须是非空字符串数组，最多 64 个字段。
- PATCH 通过路径中的 `code` 定位模板，`code` 在请求体中可省略；更新请求只提交要变更的字段，服务端仍以路径编码作为唯一定位依据。
- 停用使用 `status=INACTIVE`，不提供物理删除；写入通过现有 `record_audit_event` 记录前后值。
- 模板值不得保存密码、密钥、令牌或文件内容；数据库 RLS 继续复用 `sys_parameter_settings_manage`。

## 3. 迁移与降级

新增 migration 只创建 `apply_report_template_snapshot` 触发器函数和触发器，不改动报告状态机。模板配置写入失败时报告生成事务失败，不生成缺少模板快照的半成品；若没有默认模板，报告仍可生成并保存 `template={}`。

## 4. 验收

- 设置管理员可创建、查询、修改和停用模板；非法前缀、非 JSON、空字段列表和越权请求均拒绝。
- 新报告快照包含生成时的模板，后续修改模板不会改变历史报告。
- 报告既有状态、版本、审计和导出契约保持不变；未认证 API 返回 401。
