# 样品状态与流转对抗性审查记录

| 项目 | 内容 |
| --- | --- |
| Review ID | REV-SAMPLE-FLOW-001 |
| 审查对象 | DES-SAMPLE-FLOW-001、T-204A～T-204D、样品流转 migrations、RLS、服务层、API、页面 |
| 版本/提交 | 工作树（待提交） |
| 审查人 | Codex 角色切换审查 |
| 日期 | 2026-07-15 |

## 攻击范围

从状态机绕过、并发状态覆盖、终态继续流转、伪造操作人/时间/前后状态、停用交接人、`sample_flow` 直写、项目负责人越权、未认证访问、审计缺失、客户端引入服务端依赖和远程迁移失败角度审查。

## 发现与处置

| ID | 等级 | 场景 | 影响 | 修复/验证 | 状态 |
| --- | --- | --- | --- | --- | --- |
| REV-SAMPLE-FLOW-001-01 | P1 | 客户端提交 `toStatus`、`operatorId` 或 `occurredAt` | 可能伪造状态、操作人和追溯时间 | 服务层拒绝服务端字段；数据库 RPC 从锁定行、`auth.uid()` 和 `now()` 推导；单元测试覆盖 | Closed |
| REV-SAMPLE-FLOW-001-02 | P1 | 两次并发流转读取同一状态 | 状态和历史记录可能不一致 | `transition_sample_flow` 使用 `FOR UPDATE`，状态更新、流转插入和审计在同一事务；远程状态推进和终态验证通过 | Closed |
| REV-SAMPLE-FLOW-001-03 | P1 | 对已归档/已处置样品继续流转 | 终态被破坏，追溯链失真 | 数据库状态机拒绝终态节点；远程归档后转移返回 `Invalid sample flow transition` | Closed |
| REV-SAMPLE-FLOW-001-04 | P1 | 直接向 `sample_flow` INSERT | 绕过状态机和审计 | 仅建立 `sample.read` SELECT RLS，未建立浏览器端写策略；远程直写被拒绝 | Closed |
| REV-SAMPLE-FLOW-001-05 | P1 | 使用停用交接用户或项目负责人登记流转 | 样品责任链或权限边界失真 | RPC 校验交接用户 ACTIVE；补充 migration 撤销 `PROJECT_OWNER.sample.manage`；远程项目负责人可读不可写、停用交接人被拒绝 | Closed |
| REV-SAMPLE-FLOW-001-06 | P1 | 流转成功但审计失败，或审计记录缺失 | 关键状态不可追溯 | 状态、`sample_flow` 和 `record_audit_event` 同事务；远程 5 条流转对应 5 条审计记录 | Closed |
| REV-SAMPLE-FLOW-001-07 | P2 | 客户端组件复用服务端模块中的节点常量 | Next.js 构建将 `next/headers` 带入客户端，生产构建失败 | 构建首次发现后抽取 `src/lib/sample-flow.ts` 纯共享模块；TypeScript、Lint、生产构建通过 | Closed |
| REV-SAMPLE-FLOW-001-08 | P2 | 未认证访问流转 API/页面 | 可能读取样品位置和交接信息 | proxy、页面和 Route Handler 三层保护；未认证 E2E 6/6 通过，流转 API 401、受保护页面 307 | Closed |

## 复测结果

- `npx.cmd tsc --noEmit`：通过。
- `npm.cmd run lint`：通过。
- `npm.cmd test -- --run`：通过，5 个测试文件、20 个单元测试通过。
- `npm.cmd run build`：通过；包含 `/samples` 和 `/api/v1/samples/[id]/flows`，使用 WASM fallback 仅产生既有 Windows SWC 警告。
- 未认证 Playwright E2E：单 worker 6/6 通过；多 worker 首次运行受当前 Windows 沙箱的 `webServer` 生命周期影响超时，手动同 shell 管理生产服务后复测通过。
- 远程 T-204 集成：通过；采集/分发保持 `REGISTERED`，两次处理推进到 `PROCESSED`，归档进入终态，非法转换、非法节点、停用交接人、`sample_flow` 直写和项目负责人写入均被拒绝；流转历史 5 条、审计 5 条；临时用户、项目、方法、样品、流转和审计已清理。
- 远程 migrations `202607150005_sample_flow.sql`、`202607150006_project_owner_sample_readonly.sql`：已应用；CLI Docker 缓存警告不影响远程执行。
- `scripts/sdd/check-consistency.ps1`、`npm.cmd run check:versioning`：通过。

## 已知非阻塞项

- Windows 环境的 Next.js 原生 SWC 加载仍有既有警告，构建使用 WASM fallback；不影响产物和业务测试。
- Playwright 的并行 `webServer` 在当前沙箱中启动不稳定；单 worker、同 shell 生产服务管理的回归已通过，后续可在标准开发机复核并行配置。
- 交接人页面目前使用 UUID 输入，人员选择器可在后续人员/任务协作体验优化中补充，不影响服务端安全边界。

## 结论

T-204A～T-204E 的状态机设计、数据库事务、RLS、权限、审计、API、详情位置、流转时间线、测试和质量证据齐备，未发现未关闭的 P0/P1 问题，可以标记 T-204 完成。
