# T-505 毕业设计演示场景对抗性审查

| 项目 | 内容 |
| --- | --- |
| Review ID | `REV-DEMO-001` |
| 关联设计 | `DES-DEMO-SCENARIO-001` |
| 关联任务 | `T-505` |
| 审查状态 | Conditional：隔离项目结构和合成种子通过；页面全链路、账号清理和残留核对待完成 |

## 审查范围

审查 P0 功能是否能在一个连续场景中演示，数据是否为合成数据，角色切换是否清晰，证据是否可追溯，以及演示结束后是否有安全清理路径。

## 对抗性检查

| 检查项 | 结果 | 说明 |
| --- | --- | --- |
| 演示依赖真实个人或实验数据 | 通过 | 目录使用 synthetic-only 策略，账号使用占位邮箱 |
| 一个账号承担所有角色 | 通过 | 手册要求管理员、实验人员和项目负责人分开登录并退出切换 |
| 演示只展示页面、不证明数据关系 | 通过 | 每一步要求保存编号、状态历史、审核 ID、报告追溯和审计证据 |
| 异常结果被误当成正常通过 | 通过 | 可选异常分支使用第二条合成读数，不修改正常原始数据 |
| 演示数据污染其他项目 | Conditional | 目标项目固定为隔离 `test`（project ref：`vrggsiwqttxciaaemhri`）；正式 `SchoolWork`（project ref：`fofjsknqdrmgyxtxwxwo`）禁止写入演示数据 |
| 清理时误删非演示数据 | Conditional | `demo-cleanup.sql` 使用严格 `DEMO_` 前缀、外键顺序和只读计数；尚未完成远程执行后的残留为 0 复核 |
| 演示凭据泄露 | 通过 | 不保存密码、token、service role key、连接串或真实邮箱 |
| P0 覆盖不完整 | 通过资产检查 | `check:demo-assets` 从 Spec P0 列表核对目录和演示手册 |

## 验证证据

- `npm.cmd run check:demo-assets`：通过。
- `npm.cmd run demo:preflight`：当前按预期 `BLOCKED`，因为 Next.js 实际 `.env.local` 仍指向正式项目；这证明门禁已经读取运行时配置并阻止混用，而不是把远程种子证据当作页面环境已就绪。

- 2026-07-18 增强运行时凭据门禁：旧版 key 校验 JWT 的 `ref`/`role`，新版 `sb_publishable_`/`sb_secret_` key 使用隔离项目 `auth/v1/health` 验证；仅临时切换 URL 而保留正式 key 时，实跑被两类 key 拒绝，未继续页面演练。
- `demo-data-catalog.json`：包含三类角色占位符、核心实体、P0 覆盖列表和验收场景。
- `demo-runbook.md`：覆盖登录、设置、项目、样品、任务、方法、设备、库存、环境、数据、审核、报告、追溯、看板、审计和清理。
- `demo-cleanup.sql`：已加入受控清理路径，使用显式事务和严格前缀范围；明确不直接操作 `auth.users`，账号本体须经 Dashboard Auth Users 或受支持的 Auth API 删除。
- 2026-07-18 受控浏览器：隔离项目 Auth Users 已进入 `demo-e2e@example.invalid` 删除确认，但提交时 Supabase Auth API 返回 `Failed to fetch`，账号未删除；未改用直接 SQL 操作 `auth.users`。
- 2026-07-18 受控 Dashboard SQL Editor：隔离项目 `test` 已成功执行 23 个迁移，结构只读核验为 41 张表、45 个函数、58 条 RLS policy。
- 2026-07-18 隔离项目合成种子：只读统计返回 Auth 演示账号 3、系统用户 3、角色关联 3、项目 1、任务 2、样品 1、方法 1、原始数据 2、处理结果 1、审核 1、报告 1、审计 5。
- 用户确认：Supabase `SchoolWork` 项目（project ref：`fofjsknqdrmgyxtxwxwo`）就是本系统的规范远程数据库；演示种子仅允许写入隔离 `test` 项目。
- 2026-07-18 本地环境复核：`npm.cmd run supabase:status` 因 Windows Docker Engine 管道不存在失败；未启动本地数据库。
- 已补充 `T-505C1`：`npm.cmd run demo:preflight` 读取 Next.js 实际环境配置，并在 `status=blocked`、`isolated=false`、项目 ref 为空、URL 混用、旧版 key 跨项目或新版 key 未被目标项目接受时阻断后续写入；单元测试覆盖批准环境、生产项目拒绝、URL 不匹配、两类 key 项目匹配和凭据形状检查。
- `npm.cmd run demo:preflight` 当前实跑结果：`BLOCKED`，报告 `application Supabase URL does not match the approved project ref`；配置隔离项目三件套后才允许页面演练。
- `npm.cmd test -- tests/unit/demo-preflight.test.ts`：通过，12/12；`npm.cmd run check:demo-assets`：通过并检查环境配置无凭据。
- 平台约束复核：[Supabase Free 计划不包含 Branching](https://supabase.com/pricing)，[Branching 是独立的 Preview 环境且按计划计费](https://supabase.com/docs/guides/platform/manage-your-usage/branching)；因此不能未经批准恢复或复用其他暂停项目代替隔离环境。

## 最新验证增量（2026-07-18）

- 种子脚本已修复不可变处理规则的重复执行问题，并补齐报告追溯快照所需字段；隔离项目 SQL Editor 已返回 `Success. No rows returned`。
- 清理脚本已补齐库存触发器的受控处理，以及 `DEMO_` 单位/参数清理；此前受控执行曾确认 `publicDemoRows: 0`。
- 本地 lint、单元测试、隔离构建、演示资产、系统测试计划、备份文档、一致性和版本门禁均通过，但这些结果不能替代页面级证据。

## 未关闭项

1. 页面级全链路仍未完成：本地 `.env.local` 的 Supabase URL/公开 key/server-only `SUPABASE_SERVICE_ROLE_KEY` 尚未切换为同一个隔离 `test` 项目，门禁已阻断混用；需由开发者在本地安全配置隔离项目三件套后再做登录、角色切换、负向权限、报告追溯和审计页面验证。
2. 诊断用临时账号 `demo-e2e@example.invalid` 尚未通过 Dashboard Auth Users 删除；不得把该账号当作三类必需演示账号，也不得直接删除 `auth.users`。
3. 尚未完成一次完整的演示后清理：需执行 `demo-cleanup.sql`、通过受支持 Auth UI/API 删除演示账号，并以只读查询确认公开 `DEMO_` 残留为 0；因此 T-505C 和依赖它的 T-506C 仍保持未完成。
