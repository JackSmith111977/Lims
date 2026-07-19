# 隔离演示数据库初始化证据

| 项目 | 结果 |
| --- | --- |
| 场景 ID | `DEMO-LIMS-001` |
| 目标项目 | Supabase `test`（project ref：`vrggsiwqttxciaaemhri`） |
| 正式项目保护 | SchoolWork（project ref：`fofjsknqdrmgyxtxwxwo`）未作为演示写入目标 |
| 操作入口 | 已登录 Supabase Dashboard 的 SQL Editor |
| 迁移来源 | `supabase/migrations/`，按文件名顺序，共 23 个迁移文件 |
| 执行结果 | Dashboard 返回 `Success. No rows returned` |
| 种子脚本 | `scripts/integration/demo-seed.sql`，仅生成 `DEMO_` 合成数据 |
| 种子执行结果 | Dashboard 返回 `Success. No rows returned`；只读统计通过 |
| 清理结果 | 已完成页面演练、Dashboard SQL 清理、8 个合成 Auth 账号删除；最终四类只读残留均为 0 |
| 清理脚本 | [`scripts/integration/demo-cleanup.sql`](../../scripts/integration/demo-cleanup.sql) 已准备；只清理公开 `DEMO_` 数据和演示用户公开资料，不直接操作 `auth.users` |

## 只读结构核验

初始化后在同一隔离项目执行只读统计查询，结果为：

- public 表：41
- public 函数：45
- public RLS policy：58
- public 字段：362
- 已核对的核心业务锚点表：`environment_record`、`experiment_data`、`experiment_report`、`experiment_task`、`instrument`、`inventory_item`、`lab_laboratory`、`result_review`、`sys_user`

本证据不记录数据库密码、API key、Service Role Key、浏览器会话或临时账号密码。迁移通过 Dashboard 手工执行，因此未把该次执行误记为 Supabase CLI migration ledger；后续变更仍必须回到仓库迁移文件并按远程项目规约核验。

## 合成演示数据种子执行

在三类占位演示账号已创建并自动确认后，通过同一隔离项目的 Dashboard SQL Editor 执行仓库脚本 `scripts/integration/demo-seed.sql`，执行结果为 `Success. No rows returned`。脚本使用事务，并按邮箱解析已存在的 Auth 用户，不包含密码、token 或任何真实业务数据。

执行后的只读统计结果如下：

| 对象 | 数量 |
| --- | ---: |
| 必需 Auth 演示账号 | 3 |
| `sys_user` | 3 |
| 角色分配 | 3 |
| 研究项目 | 1 |
| 实验任务 | 2 |
| 样品 | 1 |
| 方法 | 1 |
| 原始数据 | 2 |
| 已处理数据 | 1 |
| 结果审核 | 1 |
| 实验报告 | 1 |
| 审计记录 | 5 |

上述结果证明数据库种子事务已提交，但不等同于全链路页面验收。一个仅用于定位应用登录链路的临时诊断账号 `demo-e2e@example.invalid` 尚未完成 Dashboard Auth Users 删除；2026-07-18 受控浏览器已进入删除确认，但提交时 Supabase Auth API 返回 `Failed to fetch`，未发生删除，因此 T-505C 的远程清理门禁仍保持未完成。

## 当前证据增量（2026-07-18）

本轮对演示脚本进行了两项修复：清理脚本在删除库存事务和库存项时临时处理用户触发器，并清理 `DEMO_` 单位/参数；种子脚本复用不可变处理规则，并按追溯服务契约补齐报告快照字段。修复后的种子脚本在隔离项目 Dashboard SQL Editor 可执行并返回 `Success. No rows returned`；修复前的清理执行曾返回 `publicDemoRows: 0`。

随后在同一隔离项目 SQL Editor 进行只读核验，结果为：演示 Auth 用户 3、系统用户 3、项目 1、方法 1、设备 1、库存项 1、样品 1、任务 2、报告 1、演示审计记录 5。该结果证明当前隔离数据库中种子数据存在且范围符合目录，但仍不等于页面级验收或演练后的清理结果。

这些结果只证明脚本事务和本地契约检查有效，不证明修复后的页面全链路已验收。由于当前受控浏览器对本地追溯 URL 的复测被安全策略拦截，且 Dashboard 临时账号提交曾出现 `Failed to fetch`，本记录暂不把 T-505C 标记为完成；仍需在隔离运行时复测报告追溯、负向权限和审计页面，执行最终清理，通过受支持 Auth UI/API 处理临时账号，并在清理后只读确认 `DEMO_` 残留为 0。

为减少手工统计误差，已补充只读核验脚本 [`scripts/integration/demo-verify.sql`](../../scripts/integration/demo-verify.sql)，它只返回演示 Auth 用户、公开演示行和审计行计数，不执行写操作。

## 页面级验证前置条件

本地 `.env.local` 当前仍含正式项目的 Supabase URL/公开 key/服务端 key；`npm.cmd run demo:preflight` 已读取 Next.js 实际环境并以 URL 不匹配阻断，因此页面登录不能作为通过证据。不得读取、回显或提交正式项目密钥；继续页面级演练前，必须由用户在本地进程环境中配置同一个隔离项目自己的三件套，再重新运行应用并按 `docs/demo/demo-runbook.md` 留存证据。

2026-07-18 已补充隔离运行入口：`docs/demo/demo.env.local.example` 提供 `test` 项目 ref 和 URL，`scripts/integration/with-demo-env.ps1` 仅向当前子进程注入本地填写的三件套，不改写正式 `.env.local`。新版 `sb_publishable_`/`sb_secret_` key 通过隔离项目 `auth/v1/health` 校验；旧版 JWT key 通过 `ref`/`role` 校验。实跑时仅临时切换 URL 而保留正式 key，门禁返回 `public Supabase key was rejected by the approved project` 与 `server-only Supabase key was rejected by the approved project`，因此未进入页面演练。

## 当前批次页面前置与负向验证（2026-07-18）

本轮按隔离运行手册复核了实际运行时边界：默认 `npm.cmd run demo:preflight` 读取正式 `.env.local` 并按预期 `BLOCKED`；通过 `with-demo-env.ps1 -Action preflight` 注入本地隔离三件套后，`demo:preflight` 输出 `PASSED`，且未回显任何 key。使用同一隔离入口重新构建生产包成功，随后在 `http://127.0.0.1:3100` 复跑未认证 Playwright E2E，结果为 17/17 通过。

当前隔离项目只读 API 核验得到：`DEMO_LAB_01` 1、`DEMO_P_001` 1、`DEMO_S_001` 1、任务 2、`DEMO_M_001` 1、`DEMO_INST_001` 1、`DEMO_REAGENT_001` 1、实验数据 3、报告 1。该核验仅读取编号和数量，不执行写操作；说明既有种子仍在批准的 `test` 项目中，不能替代正向页面演练。

正向页面演练仍被账号凭据阻塞：三个规范占位 Auth 账号已确认存在且已确认邮箱，但仓库和本地运行文件均不保存临时密码。本轮没有猜测、重置或回显密码，也没有执行页面写入和清理；因此 T-505C 仍未完成，`DEMO_` 残留不能宣称为 0。继续步骤是由具备隔离项目权限的用户在本机提供临时登录凭据，完成 `demo-runbook.md` 第 1～7 节的页面证据、Auth 用户清理和 `demo-cleanup.sql` 后只读核验。

## 当前批次页面级正向演练增量（2026-07-18）

上段为此前阻塞记录，以下为同日已完成的隔离项目正向页面演练。临时登录密码由受控本地进程在 `test` 项目内生成并使用，未写入仓库、环境文件、日志、聊天或截图；本记录不包含密码。演练仅针对批准的隔离项目 `vrggsiwqttxciaaemhri`，不触及正式项目。

- 管理员 `demo-admin@example.invalid`：`/admin/settings`、`/admin/users`、`/admin/roles`、`/instruments`、`/inventory`、`/environment` 和 `/admin/audit` 均已加载并核对页面标识；审计页在完成会话传播后显示 12 条记录，包含 `DEMO_INST_001`、`DEMO_REAGENT_001`、`DEMO_M_001`、`DEMO_P_001` 与 `DEMO_RAW_001` 的记录。
- 操作员 `demo-operator@example.invalid`：`/tasks`、`/samples`、`/data` 已加载；`/admin/settings` 显示无权访问，负向权限边界符合预期。
- 操作员数据页：显示 `DEMO_T_001` 为 `APPROVED`、`DEMO_T_002` 为 `PENDING_REVIEW`；原始数据 `#10` 为 `98.7654321 mg/L`，处理数据 `#11` 为 `98.77 mg/L`；处理运行 `#4` 为 `SUCCEEDED`，决策为 `PASS`，血缘为 `10 -> 11`。
- 审核员 `demo-reviewer@example.invalid`：`/reviews` 显示 `DEMO_T_002` 待审核；`/reports` 显示 `DEMO_RPT_001 v1` 为 `PUBLISHED`；`/reports/trace/4` 显示样品 `DEMO_S_001`、原始/处理数据 `#10/#11` 和审核记录 `#5`；`/dashboard` 显示待审核任务入口。
- 受控浏览器已采集上述页面快照并以页面 URL、任务/数据/报告/审核记录编号作为可复核证据；未将认证信息或密钥写入快照记录。

页面正向证据已完成；演练后公开数据清理、Auth 演示账号删除和 `DEMO_` 残留只读复核尚未执行，因此在清理完成前不将 T-505C/T-506C 标记为完成。

## 演练后清理与零残留复核（2026-07-18）

页面证据写入文档后，在隔离项目 `test` 的 Dashboard SQL Editor 受控执行 `scripts/integration/demo-cleanup.sql`，返回清理校验 `publicDemoRows: 0`；随后通过受支持 Auth Admin API 仅删除匹配 `demo-*@example.invalid` 的 8 个合成账号。未直接操作 `auth.users`，未删除正式项目数据。

最终只读 API 复核结果：`publicDemoRows=0`、`publicDemoUsers=0`、`auditDemoRows=0`、`authDemoUsers=0`。临时删除脚本执行后即移除，仓库不保留凭据或临时脚本。
