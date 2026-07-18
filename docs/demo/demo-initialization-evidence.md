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
| 清理结果 | 全链路页面演练和远程清理尚未完成，暂不宣称 `DEMO_` 残留为 0 |
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

上述结果证明数据库种子事务已提交，但不等同于全链路页面验收。一个仅用于定位应用登录链路的临时诊断账号 `demo-e2e@example.invalid` 尚未完成 Dashboard Auth Users 删除，因此 T-505C 的远程清理门禁仍保持未完成。

## 页面级验证前置条件

本地 `.env.local` 当前仍含正式项目的 Supabase URL/公开 key/服务端 key；`npm.cmd run demo:preflight` 已读取 Next.js 实际环境并以 URL 不匹配阻断，因此页面登录不能作为通过证据。不得读取、回显或提交正式项目密钥；继续页面级演练前，必须由用户在本地进程环境中配置同一个隔离项目自己的三件套，再重新运行应用并按 `docs/demo/demo-runbook.md` 留存证据。
