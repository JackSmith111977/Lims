# T-506 系统测试计划对抗性审查

| 项目 | 内容 |
| --- | --- |
| Review ID | `REV-SYSTEM-TEST-001` |
| 关联设计 | `DES-SYSTEM-TEST-001` |
| 关联任务 | `T-506` |
| 审查状态 | Approved：测试计划、隔离页面演练、清理复核、回归门禁和缺陷闭环均完成 |

## 审查范围

审查所有 `AC-*` 是否有测试入口和状态、是否覆盖未认证/越权/状态终态/数据清理等负向场景，以及环境阻塞是否与产品缺陷区分。

## 对抗性检查

| 检查项 | 结果 | 说明 |
| --- | --- | --- |
| 用本地构建通过替代远程集成 | 通过 | 计划将 T-503D/T-505C 标为 Pending，并要求真实隔离环境复测 |
| AC 需求断链 | 通过 | `check:system-test-plan` 从 Spec 的 AC 列表核对测试计划 |
| 只测正常路径 | 通过 | 计划包含未认证、越权、终态修改、重复数据、清理和恢复失败场景 |
| 环境问题被伪装成 P0/P1 产品缺陷 | 通过 | 缺陷清单区分 Environment gate、P2 运维增强和已缓解 runner 问题 |
| 测试凭据进入报告 | 通过 | 检查脚本拒绝真实 Supabase key，文档只保留占位符 |

## 当前证据（清理前历史快照；最终结论见下文）

- `npm.cmd run check:system-test-plan`：通过。
- 现有单元测试：20 个文件、86 个测试通过（2026-07-18 当前分支复测）。
- 完整未认证 Playwright：17/17 通过。
- 2026-07-18 正式远程回归：`test:auth-audit-integration`、`test:integration`、`test:method-integration`、`test:inventory-integration`、`test:inventory-alerts-integration`、`test:environment-integration`、`test:resource-integration` 全部通过；每组均有 finally 清理，认证/审计、库存、环境和资源核对为零残留。
- 本批次未将 CLI 管理 token 不可用的处理/报告类脚本误记为通过；其既有证据仍需在 T-505C 完成后按发布门禁复测。
- CLI 复核 `npm.cmd exec -- supabase projects list` 返回 `LegacyPlatformAuthRequiredError`；未读取用户凭据，未用该失败结果替代 Dashboard/浏览器证据。
- T-503D 的正式远程证据已补充；T-505C 的隔离项目页面级演练、账号清理和 `DEMO_` 残留核对仍待补齐，未在本审查中宣称完成。
- 2026-07-18 增量复测：隔离 `demo:preflight` 为 `PASSED`，隔离生产构建通过；`PLAYWRIGHT_BASE_URL=http://127.0.0.1:3100 npx.cmd playwright test --workers=1 --reporter=line` 为 17/17 通过；隔离 `DEMO_` 只读统计仍符合目录。三个规范占位账号存在但临时密码不可用/未提供，正向 AC 与清理仍保持 Conditional。

## 页面级正向演练追加证据（2026-07-18）

隔离项目三角色页面演练已完成：管理员页面及审计页、操作员任务/样品/数据页和无权访问验证、审核员审核/报告/追溯/工作台均已核对。关键业务证据为 `DEMO_T_001/002`、数据 `#10/#11`、处理运行 `#4`、报告 `DEMO_RPT_001 v1` 和审核记录 `#5`；审计页最终显示 12 条记录。未认证 Playwright 仍为 17/17 通过。

页面演练已补齐正向 AC 的运行时证据；演练后 SQL 清理、Auth 账号删除和公开 `DEMO_` 零残留复核待执行，故本审查暂保持 Conditional。

## 结论更新（2026-07-18）

页面级正向 AC 已完成三角色复核；隔离清理后只读结果为 `publicDemoRows=0`、`publicDemoUsers=0`、`auditDemoRows=0`、`authDemoUsers=0`。本地质量门禁、隔离生产构建和未认证 Playwright 17/17 回归均通过，未发现未关闭的 P0/P1 产品缺陷，审查结论更新为 Approved。
