# 对抗性审查记录

| 项目 | 内容 |
| --- | --- |
| Review ID | REV-TRACEABILITY-001 |
| 审查对象 | DES-TRACEABILITY-001 / T-502 / 报告追溯实现 |
| 版本/提交 | 工作分支 `feature/FR-DATA-001-record-results` |
| 审查人 | Codex |
| 日期 | 2026-07-16 |

## 攻击范围

- 未认证用户访问报告追溯页面和 API。
- 无 `report.read` 用户直接读取报告快照或构造其他对象类型追溯。
- 客户端提交任务、样品、数据、审核 ID 或覆盖快照内容。
- 报告发布后业务表变化导致历史追溯漂移。
- 恶意或损坏快照导致页面泄露、越权或静默返回不完整链路。
- 测试失败后的临时报告资源和关联外键残留。

## 发现

| ID | 等级 | 场景 | 影响 | 修复/豁免 | 状态 |
| --- | --- | --- | --- | --- | --- |
| REV-TRACE-001 | P1 | 追溯若重新拼接当前业务表，报告发布后可能发生历史漂移。 | 无法证明报告中的结果、样品和审核记录与生成时一致。 | API 只读取 `experiment_report.report_payload` 不可变快照，并通过字段白名单映射四类节点；远程验证版本和快照稳定性。 | Closed |
| REV-TRACE-002 | P1 | 只在报告页隐藏追溯入口。 | 普通用户仍可能直接调用追溯接口。 | Route Handler 独立执行 `report.read`，未认证 E2E 返回 401，报告读者真实会话远程返回完整链路。 | Closed |
| REV-TRACE-003 | P1 | 客户端伪造对象 ID、快照内容或写入追溯结果。 | 可能读取越权对象或污染历史数据。 | 追溯接口仅 GET、路径 ID 服务端解析，返回值完全来自报告表；报告及历史 RLS/不可变触发器继续生效。 | Closed |
| REV-TRACE-004 | P2 | 损坏快照的字段缺失或数组类型异常。 | 静默显示错误或产生不可解释的追溯链。 | 服务端校验任务和节点数组结构，损坏快照返回 `REPORT_SNAPSHOT_INVALID`；单元测试覆盖。 | Closed |
| REV-TRACE-005 | P2 | 报告集成清理删除临时设备时触发设备写入保护。 | 远程测试失败后可能遗留临时资源。 | 补齐 `cleanup-reporting.sql` 的设备触发器隔离；重跑后用户、报告、历史、任务、样品、项目、设备和方法残留均为 0。 | Closed |

## 复测结果

- `npm.cmd exec tsc -- --noEmit`：通过。
- `npm.cmd test`：18 个测试文件、65 个测试通过。
- `npm.cmd run lint`：通过。
- `npm.cmd run build`：通过，新增 `/api/v1/trace/[objectType]/[id]` 与 `/reports/trace/[id]` 路由已生成。
- Playwright E2E：16/16 通过。
- `npm.cmd run test:traceability-integration`：报告生成、快照四节点、真实追溯 API、只读边界和清理通过；远程临时资源残留为 0。
- `check-consistency.ps1`、`check:versioning`、OpenAPI YAML 解析和 `git diff --check`：通过。

## 结论

P0/P1 问题均已关闭，无发布阻塞项。T-502 可标记为 Verified；下一项是 T-503 数据看板统计。
