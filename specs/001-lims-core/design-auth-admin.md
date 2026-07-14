# 用户与角色管理技术设计

| 项目 | 内容 |
| --- | --- |
| 设计编号 | DES-AUTH-001 |
| 来源 Spec | `FR-AUTH-003`、`FR-AUTH-004`、`FR-AUTH-005`、`FR-AUTH-006`、`NFR-SEC-001`、`NFR-SEC-002` |
| 状态 | Approved |
| 日期 | 2026-07-12 |

## 设计目标

实现系统管理员可验收的用户列表、用户资料维护、用户停用、角色分配、角色创建和角色权限配置。停用用户不能继续通过应用权限校验，关键变更写入审计日志。

本设计对应 T-105A，不包含实验室、分类、计量单位和系统参数等基础设置，后续由 T-105B 实现。

## 架构和模块边界

```text
Admin 页面（Server Component + Client Panel）
  → /api/v1/users、/api/v1/roles
  → 服务端会话与权限校验
  → Supabase SSR Client + PostgreSQL RLS/RPC
  → Supabase Auth Admin Client（仅创建登录用户，服务端密钥）
```

- 页面只负责展示、表单输入和结果反馈。
- Route Handler 负责认证、权限、参数校验和错误映射。
- `src/lib/server/admin.ts` 集中管理管理员接口的授权、审计和 Auth Admin Client。
- 浏览器不读取 `SUPABASE_SERVICE_ROLE_KEY`，也不直接操作 `auth.users`。

## 数据模型和迁移

- 继续使用 `auth.users`、`public.sys_user`、`public.sys_role`、`public.sys_permission`、`public.sys_user_role` 和 `public.sys_role_permission`。
- `has_role` 与 `has_permission` 增加 `sys_user.status = 'ACTIVE'` 约束，保证停用用户不能通过 RLS 权限检查。
- 新增 `record_audit_event`、`set_user_roles` 和 `set_role_permissions` 三个受保护函数。
- 角色和权限替换在单个数据库函数调用中完成，避免先删除后插入导致页面中断时出现半更新状态。

## API 契约

| 方法 | 路径 | 权限 | 作用 |
| --- | --- | --- | --- |
| GET | `/api/v1/users` | `auth.user.manage` | 查询用户及其角色 |
| POST | `/api/v1/users` | `auth.user.manage` | 通过 Auth Admin API 创建用户 |
| PATCH | `/api/v1/users/{id}` | `auth.user.manage` | 修改资料或停用用户 |
| POST | `/api/v1/users/{id}/roles` | `auth.role.manage` | 替换用户角色 |
| GET | `/api/v1/roles` | `auth.role.manage` | 查询角色及权限 |
| POST | `/api/v1/roles` | `auth.role.manage` | 创建角色 |
| PATCH | `/api/v1/roles/{id}` | `auth.role.manage` | 修改角色名称或状态 |
| POST | `/api/v1/roles/{id}/permissions` | `auth.role.manage` | 替换角色权限 |

统一错误：未登录返回 `401`，无权限返回 `403`，参数错误返回 `400`，重复角色返回 `409`，未配置 Auth Admin 密钥返回 `503`。

## 页面和交互

- `/admin/users`：用户查询、资料编辑、状态切换、角色多选和新建用户。
- `/admin/roles`：角色创建、角色状态、权限多选和保存反馈。
- 仅拥有对应权限的用户可看到入口；接口仍重复执行服务端权限校验。
- 停用自己或移除自己最后的 `SYSTEM_ADMIN` 管理能力时拒绝操作，避免管理员自锁。
- 创建用户使用服务端密钥；未配置 `SUPABASE_SERVICE_ROLE_KEY` 时明确提示配置缺失，不降级为浏览器端敏感操作。

## 权限、安全和审计

- 所有管理 API 先读取 Supabase Auth 会话，再检查 `sys_user.status` 和权限 RPC。
- PostgreSQL RLS 继续作为数据层兜底。
- 用户资料、用户角色、角色权限和角色生命周期变更写入 `audit_log`。
- 密码只传给 Supabase Auth Admin API，不写入业务表、日志或响应。
- 角色权限配置保留 `SYSTEM_ADMIN` 的 `auth.role.manage`，防止系统管理员将自身完全锁死。

## 异常、恢复和降级

- Supabase 不可用时返回统一错误，不在页面伪造成功状态。
- Auth Admin 未配置时用户创建按钮可见但提交返回 `503 AUTH_ADMIN_NOT_CONFIGURED`，其他已有用户和角色管理仍可用。
- 角色/权限 RPC 校验未知编码并整体失败，不产生部分映射。
- 用户停用后下一次受保护请求会被权限函数拒绝；前端会回到登录页。

## 可扩展性与可维护性

- 角色和权限以数据库配置为准，不在页面硬编码完整权限矩阵。
- API 响应使用稳定的 `/api/v1` 边界，页面不依赖 Supabase 内部 Auth 表结构。
- 后续可在同一服务层增加部门、岗位、实验室和系统参数管理，不修改认证核心路径。

## 备选方案与取舍

- 不选择浏览器端 `signUp` 创建管理员用户：会改变当前会话，无法安全代表管理员创建其他用户。
- 不直接插入 `auth.users`：该表由 Supabase Auth 管理，直接写入会绕过密码和身份状态处理。
- 暂不引入 React Hook Form/Zod：当前页面规模较小，先使用服务端白名单校验，待通用表单数量增加时再集中引入。

## 验证方式

- 管理员可查询用户、修改资料、停用用户并分配角色。
- 非管理员访问 `/admin/users`、`/admin/roles` 和对应 API 返回 `403`。
- 停用用户的受保护权限检查返回失败。
- 角色和权限替换结果可在数据库中验证，审计日志包含操作者、对象、动作和前后值。
- 运行 `npm run lint`、`npm run test`、`npm run build` 和 `scripts/sdd/check-consistency.ps1`。
