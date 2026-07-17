# 系统测试计划与验收矩阵

| 项目 | 内容 |
| --- | --- |
| 计划 ID | `TEST-PLAN-001` |
| 关联设计 | [`DES-SYSTEM-TEST-001`](../../specs/001-lims-core/design-system-test.md) |
| 需求事实源 | [`spec.md`](../../specs/001-lims-core/spec.md) |
| 当前状态 | Conditional：本地自动化和 T-503D 远程闭环已通过，T-505C 隔离环境证据待完成 |

## 1. 执行顺序

1. 运行 `npm.cmd run lint`、`npm.cmd test`、`npm.cmd run build`。
2. 用已构建生产服务运行完整未认证 E2E：`npx.cmd playwright test --workers=1 --reporter=line`。
3. 在经授权的隔离远程 Supabase 项目执行 migration 状态核对和各模块远程集成；每组使用独立临时前缀并在 `finally` 清理。本地数据库不作为远程验收证据。
4. 执行 T-503 看板集成和 T-505 演示流程，分别确认临时测试前缀、`DEMO_` 前缀和演示账号残留为 0。
5. 运行 `npm.cmd run check:backup-docs`、`npm.cmd run check:demo-assets`、一致性和版本门禁。
6. 将失败记录到 [`defect-log.md`](defect-log.md)，修复后保留原失败证据、复测命令和新结果。

## 2. 验收矩阵

| 验收 ID | 主要证据 | 当前状态 | 复测入口 |
| --- | --- | --- | --- |
| `AC-AUTH-001` | `REV-AUTH-001`、T-106、`test:auth-audit-integration`、`audit-access.spec.ts`；远程临时用户/角色/审计清理为 0 | Passed | `npm.cmd run test:auth-audit-integration` |
| `AC-SAMPLE-001` | `REV-SAMPLE-REG-001`、`REV-MAIN-FLOW-001`、`test:integration` | Passed（已有模块证据） | `npm.cmd run test:integration` |
| `AC-SAMPLE-002` | `REV-SAMPLE-FLOW-001`、`test:integration` | Passed（已有模块证据） | `npm.cmd run test:integration` |
| `AC-TASK-001` | `REV-TASK-REG-001`、`REV-TASK-FLOW-001`、主流程集成 | Passed（已有模块证据） | `npm.cmd run test:integration` |
| `AC-DATA-001` | `REV-EXPERIMENT-DATA-001`、`test:data-integration`、`test:processing-integration` | Passed（已有模块证据） | `npm.cmd run test:data-integration` |
| `AC-REVIEW-001` | `REV-RESULT-REVIEW-001`、`test:review-integration` | Passed（已有模块证据） | `npm.cmd run test:review-integration` |
| `AC-REPORT-001` | `REV-REPORTING-001`、`test:report-integration` | Passed（已有模块证据） | `npm.cmd run test:report-integration` |
| `AC-RESOURCE-001` | `REV-RESOURCE-MANAGEMENT-001`、设备/库存/环境集成 | Passed（已有模块证据） | `npm.cmd run test:resource-integration` |
| `AC-AUDIT-001` | `REV-TRACEABILITY-001`、`test:traceability-integration`、`traceability-access.spec.ts` | Passed（已有模块证据） | `npm.cmd run test:traceability-integration` |
| `AC-AUDIT-002` | `REV-BACKUP-RECOVERY-001`、`check:backup-docs` | Passed（文档验收） | `npm.cmd run check:backup-docs` |
| `AC-DASH-001` | `REV-DASHBOARD-001`、看板集成断言、17/17 未认证 E2E、`cleanupVerified` 零残留证据 | Passed | `npm.cmd run test:dashboard-integration` |
| `AC-ENV-001` | 远程项目 ref、`demo:preflight`、迁移/集成/清理记录、`T-102F` 工作流检查 | Conditional（前置检查已通过单元验证，T-505C 的隔离演示环境仍待完成） | `npm.cmd run demo:preflight`、`scripts/sdd/check-consistency.ps1`、远程演练记录 |
| `AC-DEV-001` | Spec 入口、相关设计/任务、需求 ID 和提交记录 | Passed（流程规则已固化） | `scripts/sdd/check-consistency.ps1`、`T-102F` |

## 3. 系统级负向场景

| 场景 ID | 攻击/故障 | 期望结果 |
| --- | --- | --- |
| `ST-NEG-001` | 未登录访问任意保护页面和 API | 页面跳转登录，API 返回统一认证错误 |
| `ST-NEG-002` | 普通用户读取或修改无权限项目/任务/数据 | 服务端权限和 RLS 拒绝，不能依赖前端隐藏 |
| `ST-NEG-003` | 直接修改已审核/归档数据或终态处理运行 | 数据库约束/RPC 拒绝并保留审计 |
| `ST-NEG-004` | 重复编号、倒置日期、非法状态、越权关联 | 输入校验拒绝，不产生部分业务记录 |
| `ST-NEG-005` | 清理脚本使用非演示前缀或恢复校验失败 | 停止操作，保留现场，不执行宽泛删除/解除维护 |

## 4. 发布前判定

`T-506` 不能仅凭本地测试标记完成。必须在 `T-503D` 和 `T-505C` 关闭后，重新执行全量测试、远程集成、清理验证、缺陷复测、对抗性审查、一致性和版本门禁，并把结果写回本文件和缺陷清单。

Release gate: all P0/P1 product defects must be closed or explicitly exempted, and cleanup verification must be recorded for every temporary or demo fixture.
