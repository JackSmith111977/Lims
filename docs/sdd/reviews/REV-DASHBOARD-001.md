# T-503 数据看板对抗性审查

| 项目 | 内容 |
| --- | --- |
| Review ID | `REV-DASHBOARD-001` |
| 关联设计 | `DES-DASHBOARD-001` |
| 关联任务 | `T-503` |
| 审查状态 | Conditional：功能、远程业务断言和本地门禁通过；自动化 CLI 清理仍受当前环境登录态限制 |

## 审查范围

审查 `FR-DASH-001～005`、`AC-DASH-001` 的统计口径、权限分区、筛选组合、异常数据识别、库存告警复用、API 契约、页面降级和测试覆盖。

## 对抗性检查

| 检查项 | 结果 | 说明 |
| --- | --- | --- |
| 未认证访问页面和三个看板 API | 通过 | 页面跳转登录；API 返回 `401 AUTH_REQUIRED` |
| 分区权限隔离 | 通过设计检查 | `sample.read`、`task.read`、`data.read`、`resource.read` 分区返回，未授权分区为 `null`；底层查询继续走用户会话和 RLS |
| 人员筛选越权 | 通过设计检查 | 仅解析当前有效 `task_assignee`；没有 `task.read` 时返回 `DASHBOARD_FILTER_PERMISSION_DENIED` |
| 项目/任务状态筛选的数据范围 | 通过设计检查 | 异常数据需要 `task.read` 才能按任务关系缩小范围，否则拒绝相关过滤，避免返回看似完整但实际不准确的统计 |
| 时间范围边界 | 通过 | 统一采用 `from` 含、`to` 不含，并拒绝倒置范围 |
| 异常数据识别 | 通过设计检查 | 处理运行 `FLAGGED` 或判定 `FAIL/REVIEW`，不依据客户端字段推断 |
| 库存告警规则重复实现 | 通过 | 复用既有 `get_inventory_alerts` 安全函数，统计层只做分组 |
| 并发一致性 | 接受的低风险限制 | 看板是只读演示统计，多个查询不是单一事务快照；后续规模扩大时可替换为数据库聚合函数，返回模型不变 |
| 敏感字段泄露 | 通过 | 只返回统计所需字段；异常摘要不返回原始实验值、令牌或认证信息 |
| 空数据和无权限降级 | 通过 | 无数据返回零值/空列表；无权限使用 `null`，前端隐藏对应分区 |

## 本地验证证据

- `npm.cmd run lint`：通过。
- `npx.cmd tsc --noEmit`：通过。
- `npm.cmd test`：19 个文件、74 个测试通过。
- `npm.cmd run build`：通过；Windows 原生 SWC 警告由既有 WASM/webpack 回退处理。
- OpenAPI YAML 解析及看板路径/Schema 引用检查：通过。
- 全量未认证 Playwright E2E：17/17 通过；使用已启动的生产服务复测，避免 Playwright 自动启动器在当前 Windows 环境中的超时干扰。
- HTTP 诊断：`/dashboard` 返回 307、登录页返回 200、看板 API 未认证返回 401。
- `scripts/sdd/check-consistency.ps1`：通过。
- `npm.cmd run check:versioning`：通过，版本 `0.1.0` 与锁文件、变更日志一致。

## 远程验证证据

- 远程 Supabase 业务集成主流程已通过：临时用户登录、项目/样品/任务筛选、`PENDING_REVIEW` 待审核、`FLAGGED` 异常统计、窄任务统计接口、库存接口和非法参数拒绝均完成断言。
- 远程集成中的仪器夹具已改为调用 `create_instrument` RPC，符合远程数据库禁止直接写入仪器表的约束。
- 集成清理器现支持两条受控路径：优先使用本机 `SUPABASE_DB_URL` 通过仓库内 CLI 直连查询，否则使用 `supabase db query --linked` 的 CLI 登录态；连接串只作为子进程参数传递，不写日志、不提交。
- 当前环境两种凭据均未配置，因此尚未形成自动清理成功闭环；此前 `--linked` 路径在 `Initialising login role...` 阶段失败，这属于执行环境门禁，不是业务断言失败。
- 经用户授权，在已登录 Supabase SQL 编辑器执行 `scripts/integration/cleanup-experiment-processing.sql`，返回 `Success. No rows returned`。
- 清理后只读核对结果：`users=0`、`tasks=0`、`samples=0`、`projects=0`、`instruments=0`、`methods=0`、`processingRuns=0`、`dataRows=0`。

## 未关闭项与结论

1. `T-503D` 的产品实现、远程业务断言、对抗性检查和本地质量门禁均已有证据；但“自动化 SQL 清理”尚未在本机 CLI 登录态下完成一次成功闭环。
2. 后续只需在本机配置 Supabase CLI access token 或完整数据库连接串（`SUPABASE_DB_URL`），重新执行 `npm.cmd run test:dashboard-integration`，并保留脚本输出中的 `dashboardIntegration` 与 `cleanupVerified` 记录，即可关闭该环境门禁；完整未认证 E2E 已通过。
3. 在该自动化清理证据补齐前，T-503D 及 T-503 暂不标记完成，不宣称 P0/P1 审查已关闭，也不合并或发布。

## 决议

实现可以继续保留在当前分支；当前阻塞点已从功能实现收敛为 Supabase CLI 认证配置。补齐 CLI 认证后，应重新执行远程集成、清理核验、对抗性审查和提交前门禁。
