# 隔离演示数据库初始化证据

| 项目 | 结果 |
| --- | --- |
| 场景 ID | `DEMO-LIMS-001` |
| 目标项目 | Supabase `test`（project ref：`vrggsiwqttxciaaemhri`） |
| 正式项目保护 | SchoolWork（project ref：`fofjsknqdrmgyxtxwxwo`）未作为演示写入目标 |
| 操作入口 | 已登录 Supabase Dashboard 的 SQL Editor |
| 迁移来源 | `supabase/migrations/`，按文件名顺序，共 23 个迁移文件 |
| 执行结果 | Dashboard 返回 `Success. No rows returned` |
| 清理结果 | 本次仅初始化空项目 schema，未写入 `DEMO_` 业务数据，待演示完成后验证 |

## 只读结构核验

初始化后在同一隔离项目执行只读统计查询，结果为：

- public 表：41
- public 函数：45
- public RLS policy：58
- public 字段：362
- 已核对的核心业务锚点表：`environment_record`、`experiment_data`、`experiment_report`、`experiment_task`、`instrument`、`inventory_item`、`lab_laboratory`、`result_review`、`sys_user`

本证据不记录数据库密码、API key、Service Role Key、浏览器会话或临时账号密码。迁移通过 Dashboard 手工执行，因此未把该次执行误记为 Supabase CLI migration ledger；后续变更仍必须回到仓库迁移文件并按远程项目规约核验。
