# 认证与关键操作日志技术设计

| 项目 | 内容 |
| --- | --- |
| 设计编号 | DES-AUDIT-LOGGING-001 |
| 来源 Spec | `FR-AUDIT-001～004`、`NFR-SEC-002`、`BR-001～004` |
| 状态 | Approved |
| 日期 | 2026-07-16 |

## 1. 目标和边界

T-501 补齐登录成功、登录失败、退出登录和停用用户拦截的审计事件，并提供带 `audit.read` 权限的日志查询 API 和管理页面。设备、库存、环境、任务、样品、审核、报告、用户和角色等已有关键写入继续复用 `record_audit_event`，本设计不重复创建审计表或替换既有业务事务。

不在本任务范围内：登录失败限流、电子签名、外部 SIEM 投递、备份恢复和 FR-AUDIT-005 的跨对象追溯图。

## 2. 事件模型

复用 `audit_log`：

- `object_type` 使用 `auth` 表示认证事件；`object_id` 使用用户 UUID，未知用户或登录失败使用规范化邮箱，避免记录密码。
- `action` 使用 `LOGIN_SUCCESS`、`LOGIN_FAILURE`、`LOGIN_BLOCKED`、`LOGOUT`；关键业务事件继续使用现有动作名。
- `operator_id` 对成功登录、被拦截登录和退出登录使用当前用户；未知登录失败为 `NULL`。
- `after_json` 仅保存 `result`、`reason`、`email`（失败时）和必要的 `ip_address` 元数据，不保存密码、令牌或完整请求头；`occurred_at` 由数据库默认值生成。
- 认证日志由服务端使用 service-role 数据访问层写入，客户端不能提交或修改日志字段；查询依赖 `audit.read` RLS。

## 3. 认证流程

```text
登录页面
  -> POST /api/v1/auth/login
  -> 服务端 Supabase SSR signInWithPassword（写入 HttpOnly 会话）
  -> 查询 sys_user.status
  -> service-role 写入认证审计
  -> 返回成功 / 认证失败 / 停用拦截

退出按钮
  -> POST /api/v1/auth/logout
  -> 服务端读取当前会话并写入 LOGOUT
  -> SSR signOut 清理会话
```

认证失败响应保持统一，不回显 Supabase 的详细错误，也不把密码、access token 或 refresh token 写入日志。审计写入失败时，成功登录不得继续返回成功，避免产生无审计会话。

## 4. 查询 API 和页面

- `GET /api/v1/audit-logs` 要求 `audit.read`，支持 `objectType`、`action`、`operatorId`、`from`、`to` 和 `limit`；默认按 `occurred_at desc, id desc` 返回最多 100 条，最大 200 条。
- 页面 `/admin/audit` 只负责筛选和展示 `id`、事件时间、操作人、对象、动作、前后 JSON 摘要；不提供编辑或删除操作。
- Dashboard 仅在 `audit.read` 为真时展示入口；Proxy 复用 `/admin` 保护，API 仍执行独立权限校验。

## 5. 安全和可维护性

- 认证输入和查询过滤器由服务端白名单校验；客户端字段不能覆盖操作人、时间、结果或 IP。
- 日志表继续由 RLS 保护，应用角色只读；写入集中在服务端审计适配器，后续可替换为队列或外部审计 sink，而不改变业务 API。
- 既有 `record_audit_event` 继续在业务事务内调用，认证事件通过独立适配器记录，避免给匿名登录失败强行授予业务审计 RPC 权限。
- 查询结果不包含密码、令牌或密钥；日志错误只返回通用错误码。

## 6. 验证依据

- 单元测试：认证事件归一化、查询参数边界、敏感字段剔除。
- E2E：未认证用户无法打开日志页或调用日志 API；登录 API 不接受非法体；退出 API 受会话保护。
- 远程集成：登录成功/失败/停用拦截/退出事件、`audit.read` 读权限、普通用户拒绝、排序过滤、事件字段和临时资源清理。

## 7. 实现补充

- OAuth 回调 `GET /auth/callback` 与密码登录共用认证审计适配器；成功、失败和停用拦截不会绕过 `audit_log`。
- 查询服务对历史审计 JSON 做递归敏感键脱敏，防止旧数据或未来扩展字段把密码、令牌、密钥和授权头返回给授权查询者。
- 代理 IP 只有在通过运行时 IP 校验后才写入 `inet` 字段；非法转发头不会阻断登录和审计写入。
