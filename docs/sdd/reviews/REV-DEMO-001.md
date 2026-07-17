# T-505 毕业设计演示场景对抗性审查

| 项目 | 内容 |
| --- | --- |
| Review ID | `REV-DEMO-001` |
| 关联设计 | `DES-DEMO-SCENARIO-001` |
| 关联任务 | `T-505` |
| 审查状态 | Conditional：合成数据目录和演示流程通过；隔离环境全链路生成/清理待执行 |

## 审查范围

审查 P0 功能是否能在一个连续场景中演示，数据是否为合成数据，角色切换是否清晰，证据是否可追溯，以及演示结束后是否有安全清理路径。

## 对抗性检查

| 检查项 | 结果 | 说明 |
| --- | --- | --- |
| 演示依赖真实个人或实验数据 | 通过 | 目录使用 synthetic-only 策略，账号使用占位邮箱 |
| 一个账号承担所有角色 | 通过 | 手册要求管理员、实验人员和项目负责人分开登录并退出切换 |
| 演示只展示页面、不证明数据关系 | 通过 | 每一步要求保存编号、状态历史、审核 ID、报告追溯和审计证据 |
| 异常结果被误当成正常通过 | 通过 | 可选异常分支使用第二条合成读数，不修改正常原始数据 |
| 演示数据污染其他项目 | 通过 | 所有实体使用 `DEMO_` 前缀，设计要求隔离项目和只读清理核对 |
| 清理时误删非演示数据 | 通过 | 禁止通配符删除，要求按前缀、外键顺序和只读计数清理 |
| 演示凭据泄露 | 通过 | 不保存密码、token、service role key、连接串或真实邮箱 |
| P0 覆盖不完整 | 通过资产检查 | `check:demo-assets` 从 Spec P0 列表核对目录和演示手册 |

## 验证证据

- `npm.cmd run check:demo-assets`：通过。
- `demo-data-catalog.json`：包含三类角色占位符、核心实体、P0 覆盖列表和验收场景。
- `demo-runbook.md`：覆盖登录、设置、项目、样品、任务、方法、设备、库存、环境、数据、审核、报告、追溯、看板、审计和清理。
- 2026-07-18 受控浏览器复核：`SchoolWork` 组织仅显示当前活动项目，没有第二个可授权的隔离活动项目。
- 2026-07-18 只读 CLI 复核：可访问项目清单中目标项目为 `ACTIVE_HEALTHY`，其余项目均为 `INACTIVE`；未发现可直接用于 T-505C 的隔离活动项目。
- 2026-07-18 本地环境复核：`npm.cmd run supabase:status` 因 Windows Docker Engine 管道不存在失败；未启动本地数据库。
- 已补充 `T-505C1`：`npm.cmd run demo:preflight` 读取环境配置并在 `status=blocked`、`isolated=false` 或项目 ref 为空时阻断后续写入；单元测试覆盖批准环境、生产项目拒绝、URL 不匹配和凭据形状检查。
- `npm.cmd run demo:preflight` 当前实跑结果：按预期以 `BLOCKED` 退出，明确报告环境未批准、未隔离、项目 ref 缺失和应用 URL 缺失；未发起远程写操作。
- `npm.cmd test -- tests/unit/demo-preflight.test.ts`：通过，5/5；`npm.cmd run check:demo-assets`：通过并检查环境配置无凭据。
- 平台约束复核：[Supabase Free 计划不包含 Branching](https://supabase.com/pricing)，[Branching 是独立的 Preview 环境且按计划计费](https://supabase.com/docs/guides/platform/manage-your-usage/branching)；因此不能未经批准恢复或复用其他暂停项目代替隔离环境。

## 未关闭项

1. 尚未在隔离 Supabase 项目创建持久演示数据，因此没有伪造“全链路演练已通过”的证据。
2. 本次环境复核显示本地 `supabase status` 因 Docker Engine 管道不存在而不可用；当前已验证的远程项目是生产项目，不能用于生成 `DEMO_` 数据；Free 计划也无法通过 Branching 快速创建隔离环境。
3. T-505C 依赖 T-503D 的远程自动清理门禁；准备隔离项目/分支和三类演示账号后，按手册执行一次演示数据生成、截图/编号留档和清理计数核对。
