# 实验室人员档案对抗性审查记录

| 项目 | 内容 |
| --- | --- |
| Review ID | REV-PERSONNEL-001 |
| 审查对象 | DES-PERSONNEL-001、T-201A～T-201D、人员 migration、RLS、API、页面 |
| 版本/提交 | 工作树（未提交） |
| 审查人 | Codex 角色切换审查 |
| 日期 | 2026-07-15 |

## 攻击范围

从未认证访问、资源读写越权、账户状态绕过、无效岗位/部门、重复能力记录、日期边界、资格暂停提醒、任务状态失真、审计缺失、迁移回滚和临时数据残留角度审查。

## 发现与处置

| ID | 等级 | 场景 | 影响 | 修复/豁免 | 状态 |
| --- | --- | --- | --- | --- | --- |
| REV-PERSONNEL-001-01 | P1 | 未认证访问 `/personnel` 或 `/api/v1/personnel` | 可能读取人员和任务信息 | Middleware、页面和 API 三层认证；未认证 E2E 4/4 通过 | Closed |
| REV-PERSONNEL-001-02 | P1 | `resource.read` 用户写入档案或能力记录 | 可能越权修改人员状态或资质 | API 使用 `resource.manage`，子表 RLS 同步限制；RESEARCHER 负向集成通过 | Closed |
| REV-PERSONNEL-001-03 | P1 | `resource.manage` 用户直接修改 `sys_user.status` | 可能绕过账户停用策略 | `guard_sys_user_account_status` 触发器要求 `auth.user.manage`；LAB_ADMIN 直连更新负向验证通过 | Closed |
| REV-PERSONNEL-001-04 | P1 | FR-PER-002 任务状态摘要不读取当前事实 | 分配任务时可能展示过期或错误状态 | 只读取 `unassigned_at is null` 的 `task_assignee` 并关联 `experiment_task.status`；进行中任务正向集成通过 | Closed |
| REV-PERSONNEL-001-05 | P2 | 档案复制姓名/部门或复制任务状态 | 双写不一致、任务状态漂移 | 沿用 `sys_user` 身份字段，任务摘要按需聚合；设计和数据模型已固定边界 | Closed by design |
| REV-PERSONNEL-001-06 | P2 | 重复技能、非法状态或日期倒置 | 能力档案污染或提醒错误 | 唯一索引、数据库 check、服务端校验和单元测试覆盖 | Closed |
| REV-PERSONNEL-001-07 | P2 | 能力记录变更无追溯 | 无法说明资质和培训来源 | 新增/修改/删除统一写入 `record_audit_event`；集成后按操作人清理临时审计记录 | Closed |
| REV-PERSONNEL-001-08 | P2 | 删除人员记录导致历史关联断裂 | 任务和档案引用失效 | 子记录使用级联清理，任务分配不在 T-201 删除；人员账户仍采用停用策略 | Closed by design |

## 复测结果

- `npx.cmd tsc --noEmit`：通过。
- `npm.cmd run lint`：通过。
- `npm.cmd test -- --run`：通过，10 个单元测试通过。
- `npm.cmd run build`：通过；新增人员页面和四组 API 路由进入生产构建产物。
- 未认证生产 E2E：4/4 通过，覆盖人员页面和 API。
- 远程人员正向/负向集成：档案更新、岗位、技能/资质/培训新增、修改、删除、提醒、资源读写越权和账户状态触发器均通过。
- FR-PER-002 专项集成：临时 `IN_PROGRESS` 任务和当前分配返回 1 条任务及正确状态，夹具已清理。
- 远程 migrations `202607150001_personnel_profiles.sql`、`202607150002_personnel_account_status_guard.sql`：已应用；类型已重新生成。
- 临时账号、岗位、能力记录、任务夹具和审计记录：已在测试 `finally` 中清理。

## 已知非阻塞项

- Windows 环境的 Next.js 原生 SWC 加载仍有既有警告，WASM fallback 下生产构建和 E2E 均通过；不属于人员档案功能回归。
- 浏览器登录表单的远程请求在本次集成浏览器上下文中出现无错误卡顿，因此正向业务验收使用 Supabase SSR cookie 会话注入；既有登录页面和未认证保护仍由独立 E2E/构建覆盖，后续可单独做网络环境诊断。

## 结论

T-201A～T-201E 的设计、数据层、API、页面、权限边界、任务状态读取、审计和质量门禁证据齐备，未发现未关闭的 P0/P1 问题。T-201 可以标记完成。
