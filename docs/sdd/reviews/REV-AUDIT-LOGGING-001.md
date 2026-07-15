# 对抗性审查记录

| 项目 | 内容 |
| --- | --- |
| Review ID | REV-AUDIT-LOGGING-001 |
| 审查对象 | DES-AUDIT-LOGGING-001 / T-501 / 认证与审计日志实现 |
| 版本/提交 | 工作分支 `feature/FR-DATA-001-record-results` |
| 审查人 | Codex |
| 日期 | 2026-07-16 |

## 攻击范围

- 未认证用户访问 `/admin/audit` 和 `/api/v1/audit-logs`。
- 普通已认证用户绕过前端直接读取、插入、修改或删除 `audit_log`。
- 错误密码、停用用户、退出登录和 OAuth 回调是否产生正确事件。
- 客户端伪造操作人、时间、结果、密码、令牌和转发 IP。
- 审计写入失败时是否错误地返回登录成功。
- 查询筛选、排序、数量上限、历史日志敏感字段和临时测试资源清理。

## 发现

| ID | 等级 | 场景 | 影响 | 修复/豁免 | 状态 |
| --- | --- | --- | --- | --- | --- |
| REV-AUDIT-001 | P1 | 认证成功原先由浏览器直接调用 Supabase，未经过统一审计入口。 | 登录成功、失败和退出事件无法形成完整链路。 | 新增服务端认证 Route Handler，并将登录页/退出按钮改为调用 `/api/v1/auth/*`；远程集成验证三类登录结果和退出事件。 | Closed |
| REV-AUDIT-002 | P1 | 只隐藏管理端入口不能阻止普通用户直接请求日志 API。 | 可能越权读取全量操作日志。 | API 独立执行 `audit.read`，数据库继续使用 `audit_log` RLS；远程普通用户请求返回 403，直接写入被拒绝。 | Closed |
| REV-AUDIT-003 | P1 | 客户端或旧日志 JSON 可能携带密码、令牌或授权头。 | 授权查询者可能看到敏感凭据。 | 认证写入使用字段白名单；查询结果递归脱敏；单元和远程验证均确认不返回敏感字段。 | Closed |
| REV-AUDIT-004 | P2 | 未校验的 `x-forwarded-for` 可能写入非法 `inet` 值并阻断登录。 | 攻击者可通过伪造代理头触发审计写入失败。 | 使用运行时 IP 校验，非法值被忽略；新增单元测试。 | Closed |
| REV-AUDIT-005 | P2 | OAuth 回调可能绕过密码登录审计流程。 | 另一种登录入口缺少认证事件。 | OAuth 成功、失败和停用拦截复用认证审计适配器。 | Closed |

## 复测结果

- `npm.cmd exec tsc -- --noEmit`：通过。
- `npm.cmd test`：17 个测试文件、63 个测试通过。
- `npm.cmd run lint`：通过。
- `npm.cmd run build`：通过；Windows SWC 原生模块不可用警告由项目既有 WASM/webpack 回退处理，不影响构建。
- Playwright E2E：15/15 通过。
- `npm.cmd run test:auth-audit-integration`：认证事件、`audit.read`、越权拒绝和临时资源清理通过；远程残留用户、角色和邮箱对象审计均为 0。
- `check-consistency.ps1`、`check:versioning`、OpenAPI YAML 解析和 `git diff --check`：通过。

## 结论

P0/P1 问题均已关闭，无发布阻塞项。T-501 可标记为 Verified；T-502、T-503、T-504 仍按任务清单继续推进。
