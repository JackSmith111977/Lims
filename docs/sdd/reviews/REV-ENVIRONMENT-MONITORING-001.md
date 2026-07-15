# 环境监测与阈值提醒对抗性审查记录

| 项目 | 内容 |
| --- | --- |
| Review ID | REV-ENVIRONMENT-MONITORING-001 |
| 审查对象 | DES-ENVIRONMENT-MONITORING-001；FR-ENV-001～005；AC-RESOURCE-001；T-405 |
| 日期 | 2026-07-16 |
| 状态 | Closed |

## 攻击范围

- 伪造实验室、指标、单位、阈值、采集时间、来源、记录人、状态和阈值快照字段。
- 直接绕过 RPC 写入、修改或删除环境记录及阈值配置。
- 停用实验室、无阈值、上下界边界、未来时间、非法提醒窗口和阈值修改后的历史一致性。
- `resource.read` / `resource.manage` 权限边界、未认证页面/API、提醒过滤和排序。
- 阈值/记录审计一致性、迁移重复执行风险、临时账号与业务数据清理。

## 发现与处置

| ID | 级别 | 场景 | 证据 / 处置 | 状态 |
| --- | --- | --- | --- | --- |
| REV-ENVIRONMENT-MONITORING-001-01 | P0 | 客户端提交 `recorded_by`、`status`、阈值快照或未来时间，伪造环境结论。 | 服务层拒绝服务字段；数据库 RPC 只从当前会话、活动实验室、活动阈值和服务端时间生成记录；未来 5 分钟以上的采集时间被拒绝。远程边界集成通过。 | Closed |
| REV-ENVIRONMENT-MONITORING-001-02 | P0 | 通过表直写绕过环境 API，篡改或删除历史记录。 | 表仅向认证用户授予查询权限；写入触发器拒绝非 RPC 上下文；记录由追加 RPC 产生。远程 reader 直写、更新、删除均被拒绝。 | Closed |
| REV-ENVIRONMENT-MONITORING-001-03 | P1 | 阈值缺失、上下界反转、停用实验室或非法状态导致错误提醒。 | 数据库约束和 RPC 同时校验至少一个边界、最大值不小于最小值、实验室 ACTIVE 和状态白名单；边界值按包含边界计算。远程测试覆盖正常/超限/边界/停用/非法窗口。 | Closed |
| REV-ENVIRONMENT-MONITORING-001-04 | P1 | 更新阈值后历史记录被重新解释，或提醒查询泄漏无权限数据。 | 记录保存写入时阈值快照；提醒 RPC 仅返回 EXCEEDED、按数据库当前日期计算窗口并支持实验室过滤；reader 只能读取。远程历史快照、提醒和权限检查通过。 | Closed |
| REV-ENVIRONMENT-MONITORING-001-05 | P1 | 配置和记录缺少审计，导致无法追溯操作人及前后值。 | 阈值创建/更新和记录创建均在同一 RPC 事务中调用 `record_audit_event`；远程审计 JSON 与业务数据一致。 | Closed |
| REV-ENVIRONMENT-MONITORING-001-06 | P1 | 未认证用户访问环境页面或任一 API，或动态路由遮蔽固定路由。 | Proxy、页面权限和 API 权限三层保护；构建列出四个环境 API 路由及环境页面；新增未认证 E2E 与其余访问回归共 13/13 通过。 | Closed |
| REV-ENVIRONMENT-MONITORING-001-07 | P2 | 集成测试重试后遗留临时用户、角色、实验室、阈值、记录或审计。 | 集成脚本按外键依赖逆序清理并验证剩余计数；远程运行报告 users/laboratories/thresholds/records/roles 全部为 0。 | Closed |

## 验证证据

- `npm.cmd exec tsc -- --noEmit`：通过。
- `npm.cmd run lint`：通过。
- `npm.cmd test`：16 个测试文件 / 57 个测试通过。
- `npm.cmd run build`：通过；已生成环境页面及四个环境 API 路由。Windows 原生 SWC 绑定仍提示 `Invalid access to memory location`，Next 使用 WASM/webpack 回退，不影响构建产物。
- `npm.cmd run test:e2e -- --workers=1 --timeout=30000 --reporter=line`：13/13 通过。由于自动 webServer 在当前 Windows 沙箱中出现启动等待，使用同一生产服务的显式 3018 端口复测；新增环境访问用例单独 1/1 通过。
- `npm.cmd run test:environment-integration`：通过；覆盖阈值、状态、快照、提醒、权限、只读历史、审计和清理。
- Supabase SQL Editor：迁移 `202607160019_environment_monitoring.sql` 显示 `Success. No rows returned`。
- `scripts/sdd/check-consistency.ps1`、`npm.cmd run check:versioning`、`git diff --check`：已在提交前执行并通过。

## 结论

P0/P1 风险均已关闭。T-405 的设施复用、环境阈值、追加式采集记录、服务端状态计算、超限提醒、权限边界、审计、页面/API、远程迁移和清理证据齐备，可以进入提交阶段。
