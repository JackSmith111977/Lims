# 用户与角色管理对抗性审查记录

| 项目 | 内容 |
| --- | --- |
| Review ID | REV-AUTH-001 |
| 审查对象 | DES-AUTH-001、T-105A、用户/角色管理 API 与页面 |
| 版本/提交 | 当前分支认证模块（本次 T-106 远程复测） |
| 审查人 | Codex 角色切换审查 |
| 日期 | 2026-07-18 |

## 攻击范围

从未认证用户、非管理员、停用用户、管理员误操作、敏感密钥泄露、重复提交和数据库部分更新等角度审查用户与角色管理实现。

## 发现

| ID | 等级 | 场景 | 影响 | 修复/豁免 | 状态 |
| --- | --- | --- | --- | --- | --- |
| REV-AUTH-001-01 | P1 | 未登录访问 `/admin/users` | 可能绕过管理页面 | Proxy 与页面双重保护；E2E 已验证跳转登录 | Closed |
| REV-AUTH-001-02 | P1 | 普通用户直接调用管理 API | 可能越权读取或修改用户/角色 | Route Handler 权限校验 + RLS/RPC 兜底；未认证和普通研究人员 API 负向 E2E 已验证 `403 FORBIDDEN` | Closed |
| REV-AUTH-001-03 | P1 | 停用用户继续调用权限接口 | 违反 `BR-004` | `has_role`、`has_permission` 增加 ACTIVE 条件；停用管理员 API 负向 E2E 已验证 `403 USER_INACTIVE` | Closed |
| REV-AUTH-001-04 | P1 | 管理员停用自己或移除自己的系统管理能力 | 造成管理入口自锁 | 页面禁用、API 拒绝自停用、RPC 拒绝移除 `SYSTEM_ADMIN` | Closed by design/code review |
| REV-AUTH-001-05 | P1 | 浏览器或日志泄露 Service Role Key | 可绕过 RLS 管理整个项目 | Auth Admin Client 仅服务端读取；密钥已配置在本地忽略文件，未进入浏览器、日志或版本库 | Closed by configuration review |
| REV-AUTH-001-06 | P2 | 用户创建后角色写入失败 | 产生只有 Auth 用户的部分状态 | 创建流程失败时尝试删除业务用户和 Auth 用户；正常创建链路已完成集成验收，故障注入保留为后续 P2 演练 | Accepted follow-up |
| REV-AUTH-001-07 | P2 | 角色权限替换中途失败 | 产生部分权限映射 | 使用单次数据库 RPC 完成校验、替换和审计写入 | Closed by design/code review |

## 复测结果

- `npm run lint`：通过。
- `npm run test`：通过，4 个单元测试通过。
- `npm run test:e2e`：默认 3000 端口被既有进程占用；改用 `PLAYWRIGHT_PORT=3011` 启动隔离服务后，管理页跳转和管理 API 未认证访问共 2 个 E2E 通过。
- `npx tsc --noEmit`：通过。
- `npm run build`：通过；Windows 原生 SWC 仍有已知兼容性警告，Webpack/WASM 构建成功。
- `scripts/sdd/check-consistency.ps1`：通过。
- 远程迁移 `202607120004_admin_management.sql`：已应用，三个管理 RPC 已核验存在。
- 正向用户创建集成验收：通过；管理员会话下创建接口返回 `201`，远程核验确认业务资料、`RESEARCHER` 角色和 `CREATE` 审计记录各 1 条，随后清理 2 个临时账号及测试审计数据。
- 已认证负向集成验收：通过；普通研究人员和停用管理员各 1 项，共 2 项通过，随后清理 2 个临时账号。
- T-106 远程认证审计复测：通过；`npm.cmd run test:auth-audit-integration` 在隔离的临时 Next.js 服务上执行，成功登录、错误密码、停用用户阻断、`audit.read` 查询、敏感字段排除、普通用户越权、直接审计表写入拒绝和退出审计全部通过。
- T-106 清理复测：通过；`cleanupVerified: true`，`users: 0`、`roles: 0`、`emailAudits: 0`。

## 结论

T-105A、T-105B 和 T-106 的代码、数据库约束、API 契约、密钥配置、正向用户创建验收、认证负向验收和远程清理均已闭环；P2 故障注入演练作为后续质量改进保留，不阻塞认证与基础设置任务完成。
