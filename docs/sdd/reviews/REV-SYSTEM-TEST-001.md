# T-506 系统测试计划对抗性审查

| 项目 | 内容 |
| --- | --- |
| Review ID | `REV-SYSTEM-TEST-001` |
| 关联设计 | `DES-SYSTEM-TEST-001` |
| 关联任务 | `T-506` |
| 审查状态 | Conditional：测试计划和缺陷记录通过，完整隔离环境执行待完成 |

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

## 当前证据

- `npm.cmd run check:system-test-plan`：通过。
- 现有单元测试：20 个文件、86 个测试通过（2026-07-18 当前分支复测）。
- 完整未认证 Playwright：17/17 通过。
- 2026-07-18 正式远程回归：`test:auth-audit-integration`、`test:integration`、`test:method-integration`、`test:inventory-integration`、`test:inventory-alerts-integration`、`test:environment-integration`、`test:resource-integration` 全部通过；每组均有 finally 清理，认证/审计、库存、环境和资源核对为零残留。
- 本批次未将 CLI 管理 token 不可用的处理/报告类脚本误记为通过；其既有证据仍需在 T-505C 完成后按发布门禁复测。
- CLI 复核 `npm.cmd exec -- supabase projects list` 返回 `LegacyPlatformAuthRequiredError`；未读取用户凭据，未用该失败结果替代 Dashboard/浏览器证据。
- T-503D 的正式远程证据已补充；T-505C 的隔离项目页面级演练、账号清理和 `DEMO_` 残留核对仍待补齐，未在本审查中宣称完成。
