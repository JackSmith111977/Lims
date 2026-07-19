# REV-REPORT-TEMPLATE-001 报告模板配置审查

| Item | Value |
| --- | --- |
| Scope | `T-603` / `FR-SETTING-004` |
| Design | `DES-REPORT-TEMPLATE-001` |
| Status | Approved |
| Reviewer | Codex adversarial review |
| Date | 2026-07-18 |

## 已完成检查

- 使用已有 `sys_parameter` 存储，但通过 `/settings/report-templates` 和 `REPORT_TEMPLATE_` 前缀隔离业务语义；服务端强制 JSON 对象及字段数组边界。
- 设置页面新增报告模板资源；写入、修改、停用沿用 `settings.manage`、RLS 和审计链。
- `202607180001_report_templates.sql` 为报告插入增加服务端模板快照触发器；无活动默认模板时保存空模板，不改变报告状态机。
- `admin-validation.test.ts` 7/7 通过；设置和仪器未认证 E2E 组合 7/7 通过；TypeScript、lint、生产构建和 diff 检查通过。

## 对抗性检查

- 客户端不能用普通参数编码绕过模板资源边界；模板编码、类型和字段数量由服务端复核。
- 模板修改不会回写历史 `experiment_report`，报告快照由数据库触发器在插入时生成。
- 触发器不信任客户端 `report_payload.template`，以活动默认模板覆盖；服务端生成流程仍负责任务审核状态和版本锁。
- 模板内容不得保存密钥、令牌或文件内容；通用 JSON 值的敏感信息规则由设置设计继续约束。

## 远程复测与结论（2026-07-19）

- 首次远程复测发现 PATCH 仅提交 `value` 时错误要求请求体包含 `code`，已按 `T-603B1/DEF-603-001` 修复路径编码与部分更新边界。
- 修复后在正式项目同环境生产服务运行 `npm.cmd run test:report-template`：编码前缀校验、模板创建/更新/停用和审计一致性均通过，`cleanedByFinally=true`。
- 正式迁移、CRUD、权限、审计、快照边界和清理均完成，批准关闭 `T-603D`。
