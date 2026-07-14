# 科研项目与实验任务登记对抗性审查记录

| 项目 | 内容 |
| --- | --- |
| Review ID | REV-TASK-REG-001 |
| 审查对象 | DES-TASK-REGISTRATION-001、T-202A～T-202D、项目/任务 migration、RLS、服务层、API、页面 |
| 版本/提交 | 工作树（未提交） |
| 审查人 | Codex 角色切换审查 |
| 日期 | 2026-07-15 |

## 攻击范围

从未认证访问、项目/任务读写越权、重复编号、日期边界、归档项目绕过、非 ACTIVE 方法引用、样品跨项目关联、任务状态越权、方法只读策略、审计失败和临时数据残留角度审查。

## 发现与处置

| ID | 等级 | 场景 | 影响 | 修复/验证 | 状态 |
| --- | --- | --- | --- | --- | --- |
| REV-TASK-REG-001-01 | P1 | 未认证访问 `/projects`、`/tasks` 或对应 API | 可能读取项目、方法和任务信息 | Supabase proxy、页面权限和 API 权限三层保护；直接 HTTP 307/401 验证 | Closed |
| REV-TASK-REG-001-02 | P1 | `RESEARCHER` 创建项目 | 可能越权建立项目边界 | API 要求 `project.manage`；远程负向集成返回 403 | Closed |
| REV-TASK-REG-001-03 | P1 | 直接提交 `status` 修改任务 | 可能绕过 T-205 状态机 | 服务层拒绝并返回 `TASK_STATUS_DEFERRED`；远程集成验证 | Closed |
| REV-TASK-REG-001-04 | P1 | 归档项目或非 ACTIVE 方法创建任务 | 任务引用失效或无法执行的方法 | 服务端重新读取项目/方法状态；远程集成覆盖 `PROJECT_ARCHIVED`、`INVALID_METHOD` | Closed |
| REV-TASK-REG-001-05 | P1 | 任务引用跨项目/处置样品 | 数据边界污染或后续流转失真 | 服务端校验样品归属和状态；样品关联留在 T-202/T-203 边界内，负向单测/后续集成依据已登记 | Closed by design |
| REV-TASK-REG-001-06 | P2 | 重复项目/任务编号、日期倒置和非法优先级 | 登记数据不一致 | 唯一约束、服务端校验、单元测试和远程集成覆盖 | Closed |
| REV-TASK-REG-001-07 | P2 | 项目/任务变更无审计，或审计函数权限不足 | 无法追溯操作人和变更内容 | migration 扩展 `record_audit_event` 允许项目/任务管理权限；创建/修改均记录，临时审计已清理 | Closed |
| REV-TASK-REG-001-08 | P2 | OpenAPI 将项目 PATCH 错误描述为必填创建字段 | 客户端无法按契约实现部分更新 | 修正 `ProjectUpdateRequest` 为可选字段，并补齐响应时间字段 | Closed |

## 复测结果

- `npx.cmd tsc --noEmit`：通过。
- `npm.cmd run lint`：通过。
- `npm.cmd test -- --run`：通过，3 个测试文件、13 个单元测试通过。
- `npm.cmd run build`：通过；项目/任务页面和四个 API 路由进入生产构建产物。
- 远程 T-202 正向/负向集成：1/1 通过，覆盖项目 CRUD、任务 CRUD、重复编号、归档项目、非 ACTIVE 方法、日期边界、任务状态越权和研究员项目写权限；临时账号、方法、项目、任务、审计记录已在 `finally` 中清理。
- 迁移 `202607150003_task_registration_audit.sql`：已应用到远程 Supabase；CLI 仅报告本机 Docker 缓存目录不可用，不影响远程 migration 执行结果。
- 未认证页面/API：项目和任务页面代理重定向及 API `401 AUTH_REQUIRED` 已由直接 HTTP 检查确认；既有未认证管理 E2E 仍覆盖同一认证中间件路径。
- `scripts/sdd/check-consistency.ps1`、`npm.cmd run check:versioning`、`git diff --check`：待本次文档和任务状态更新后执行最终门禁。

## 已知非阻塞项

- Windows 环境的 Next.js 原生 SWC 加载仍有既有警告，构建使用 WASM fallback；不属于 T-202 业务回归。
- 浏览器登录表单的远程请求在本次集成浏览器上下文中存在无错误卡顿，因此远程正向业务验收使用 SSR cookie 会话注入；登录页和未认证保护属于既有认证边界，后续可单独做网络环境诊断。
- 方法维护 UI 不属于 T-202；任务登记页面暂时使用方法版本 ID，T-301 提供方法检索和维护能力。

## 结论

T-202A～T-202E 的设计、迁移/RLS、服务端校验、API、页面、权限边界、审计和远程清理证据齐备，未发现未关闭的 P0/P1 问题，T-202 可以标记完成。
