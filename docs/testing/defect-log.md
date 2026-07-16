# 系统测试缺陷与环境问题清单

| ID | 等级 | 类型 | 现象/影响 | 处置 | 状态 |
| --- | --- | --- | --- | --- | --- |
| `ENV-503-001` | Environment gate | Supabase CLI 认证 | 当前机器没有 `SUPABASE_ACCESS_TOKEN` 或数据库密码，`supabase db query --linked` 无法完成 T-503 自动清理；业务断言和浏览器 SQL 清理已有证据 | 用户只在本机配置 CLI token/连接串后复跑 `test:dashboard-integration`，保留 `dashboardIntegration` 和 `cleanupVerified` 输出 | Open |
| `ENV-505-001` | Environment gate | 演示环境 | 没有隔离项目和授权持久演示账号，不能安全生成 `DEMO_` 远程数据或声称全链路演练通过 | T-503D 关闭后，在隔离项目执行 `demo-runbook.md`，截图/编号留档并只读核对残留为 0 | Open |
| `ENV-OPS-001` | P2 | 运维增强 | 当前没有 Storage 对象自动导出脚本，数据库备份不能证明附件文件已恢复 | 手册已明确 Storage 独立边界；后续可增加受控对象清单/校验脚本，不阻塞当前文档验收 | Accepted follow-up |
| `ENV-PLAYWRIGHT-001` | P2 | Windows runner | Playwright 自动启动 Next 服务曾出现长时间无输出；HTTP 和测试逻辑本身正常 | 使用已构建生产服务和显式端口运行，完整未认证回归已 17/17 通过 | Mitigated |

## 判定规则

- `P0/P1` 产品缺陷未关闭前不得发布；`Environment gate` 不等于产品缺陷，但必须有复现、责任条件和复测入口。
- 不能用“手工看起来正常”关闭缺陷；必须补充命令、运行环境、结果和清理证据。
- 关闭记录只能追加，不删除原始失败记录。
