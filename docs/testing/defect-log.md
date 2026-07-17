# 系统测试缺陷与环境问题清单

| ID | 等级 | 类型 | 现象/影响 | 处置 | 状态 |
| --- | --- | --- | --- | --- | --- |
| `ENV-503-001` | Environment gate | Supabase CLI 认证 | 初始沙箱身份无法读取用户 Terminal 保存的 CLI 凭据，`supabase db query --linked` 无法完成 T-503 自动清理；业务断言和浏览器 SQL 清理已有证据 | 已在可访问系统凭据的用户环境验证目标项目为 `linked`/`ACTIVE_HEALTHY`，并复跑 `test:dashboard-integration`；`dashboardIntegration`、`cleanupVerified` 和零残留核对均通过 | Closed |
| `TEST-503D-001` | P2 | 测试基础设施 | 首次自动清理进入数据库后，直接删除 `public.instrument` 触发 `guard_instrument_write()`，导致临时数据清理失败 | 清理 SQL 在仪器删除前后临时禁用并恢复用户触发器；修复后直接清理和完整看板集成均通过，仪器残留为 0 | Closed |
| `ENV-505-001` | Environment gate | 演示环境 | 没有隔离项目和授权持久演示账号，不能安全生成 `DEMO_` 远程数据或声称全链路演练通过；2026-07-18 受控浏览器确认 `SchoolWork` 组织仅有当前活动项目，只读 CLI 核对到的其他项目均为 `INACTIVE`；本地 `supabase status` 因 Docker Engine 管道不存在而不可用 | 已增加 `T-505C1` 的 `demo:preflight` 安全门禁，当前配置会明确阻断写入；仍需准备经批准的隔离 Supabase 项目/分支和三类演示账号，或启动本地 Docker Supabase，随后执行 `demo-runbook.md`，截图/编号留档并只读核对残留为 0。Free 计划不包含 Supabase Branching，不能把其他暂停项目当作隔离环境 | Open |
| `ENV-OPS-001` | P2 | 运维增强 | 当前没有 Storage 对象自动导出脚本，数据库备份不能证明附件文件已恢复 | 手册已明确 Storage 独立边界；后续可增加受控对象清单/校验脚本，不阻塞当前文档验收 | Accepted follow-up |
| `ENV-PLAYWRIGHT-001` | P2 | Windows runner | Playwright 自动启动 Next 服务曾出现长时间无输出；HTTP 和测试逻辑本身正常 | 使用已构建生产服务和显式端口运行，完整未认证回归已 17/17 通过 | Mitigated |

## 判定规则

- `P0/P1` 产品缺陷未关闭前不得发布；`Environment gate` 不等于产品缺陷，但必须有复现、责任条件和复测入口。
- 不能用“手工看起来正常”关闭缺陷；必须补充命令、运行环境、结果和清理证据。
- 关闭记录只能追加，不删除原始失败记录。
