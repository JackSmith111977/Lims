# 任务分配与状态流转对抗性审查记录

| 项目 | 内容 |
| --- | --- |
| Review ID | REV-TASK-FLOW-001 |
| 审查对象 | DES-TASK-FLOW-001、T-205A～T-205E、任务分配/状态流转 migration、RLS、API、任务详情页面 |
| 关联需求 | FR-TASK-003～006、FR-TASK-008、FR-PER-002、FR-PER-004、BR-001～005、NFR-SEC-002 |
| 审查人 | Codex 角色切换审查 |
| 日期 | 2026-07-15 |

## 攻击范围

- 绕过 RPC 直接修改任务状态或写入个人/实验组分配。
- 伪造状态前值、操作人和发生时间。
- 不可用人员、停用实验组、空分配、非法跳转和归档后继续操作。
- 并发状态流转、状态历史与审计记录的一致性。
- 只有 `task.read` 且为当前执行人的用户推进任务。
- 未认证访问、客户端组件引入服务端模块和构建回归。

## 发现与处置

| ID | 等级 | 场景 | 影响 | 修复/验证 | 状态 |
| --- | --- | --- | --- | --- | --- |
| REV-TASK-FLOW-001-01 | P1 | 未设置事务标记时，`current_setting(..., true) <> 'on'` 对 NULL 求值为 UNKNOWN | 任务状态直写可能绕过保护器 | 通过 `coalesce(current_setting(...), 'off')` 修复，并新增 `202607150008_task_flow_guard_fix.sql`；远程直写负向测试通过 | Closed |
| REV-TASK-FLOW-001-02 | P1 | 直接向 `task_assignee` 写入或绕过服务端字段 | 可伪造分配人、时间或跳过分配事务 | 移除写策略；分配仅通过 security-definer RPC，远程 RLS 负向测试通过 | Closed |
| REV-TASK-FLOW-001-03 | P1 | 不可用人员或停用实验组被分配 | 任务责任链可能指向不可执行主体 | RPC 校验 ACTIVE/AVAILABLE 与 ACTIVE；远程拒绝测试通过 | Closed |
| REV-TASK-FLOW-001-04 | P1 | 非法跳转、空分配和归档后继续操作 | 状态机或终态完整性被破坏 | RPC 使用行锁和显式状态白名单；远程完整状态机与终态测试通过 | Closed |
| REV-TASK-FLOW-001-05 | P1 | 当前执行人没有 `task.manage` 时状态流转审计失败 | 合法执行人无法推进任务 | 状态流转审计按 `task.read` 记录，RPC 仍要求当前有效个人分配或 `task.manage`；远程自定义只读执行人测试通过 | Closed |
| REV-TASK-FLOW-001-06 | P1 | 状态历史与状态变更或审计写入不一致 | 无法追溯关键任务状态 | 状态、历史、审计在同一 RPC 事务中写入；远程历史/审计数量一致性通过 | Closed |
| REV-TASK-FLOW-001-07 | P2 | 页面当前以 UUID/组 ID 展示分配对象，没有人员/实验组名称查询 | 可用性一般，扩展时需要补充查询视图 | 保留为后续人员选择器任务，不阻塞 T-205 | Accepted follow-up |

## 验证结果

- `npx.cmd tsc --noEmit`：通过。
- `npm.cmd run lint`：通过。
- `npm.cmd test -- --run`：6 个测试文件、24 个测试通过。
- `npm.cmd run build`：通过；任务分配、状态流转、历史 API 均出现在生产路由清单中。
- 未认证 Playwright E2E：手动复用生产服务、单 worker 运行 6/6 通过；Playwright 内置 `webServer` 在 Windows 下 180 秒超时，已记录为环境限制。
- 远程迁移 `202607150007_task_flow.sql` 和修复迁移 `202607150008_task_flow_guard_fix.sql`：已应用。
- 远程集成：直写保护、分配 RLS、不可用人员/停用组拒绝、完整状态机、归档终态、历史/审计一致性、当前执行人推进均通过；临时账号和业务数据已在 finally 清理。
- Supabase CLI 的 Docker catalog cache warning 不影响远程迁移执行；本机 Docker 未运行，已记录为环境限制。

## 结论

T-205 的 P0/P1 风险均已关闭，P2 仅为后续人员选择器体验改进，不阻塞任务完成。允许进入一致性检查、生产构建和版本门禁。
