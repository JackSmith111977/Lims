# REV-SIMULATED-INSTRUMENT-001 模拟仪器数据接口审查

| Item | Value |
| --- | --- |
| Scope | `T-602` / `FR-DATA-009` |
| Design | `DES-SIMULATED-INSTRUMENT-001` |
| Status | Approved |
| Reviewer | Codex adversarial review |
| Date | 2026-07-18 |

## 已完成检查

- 契约已固定为 `POST /instruments/{id}/simulate-data`，服务端从路径取得设备并强制 `sourceType=INSTRUMENT`。
- 服务端只允许 ACTIVE 设备，复用实验数据任务锁定、样品关联、值形状、不可变写入和 `data.manage` 审计边界。
- 客户端伪造 `instrumentId` 或 `sourceType` 会被拒绝；未认证调用返回 401。
- `tests/unit/simulated-instrument.test.ts` 3/3 通过；`instrument-access.spec.ts` 1/1 通过；TypeScript、lint、生产构建和 diff 检查通过。

## 对抗性检查

- 身份边界：未认证、无 `data.manage`、设备不存在、非 ACTIVE 和报废设备均有专门错误路径。
- 数据完整性：模拟接口不提供更新/删除，不接受客户端记录人和时间；写入复用 `createTaskData` 的任务/样品/数据类型约束。
- 审计边界：成功写入复用 `experiment_data` 的 CREATE 审计；接口不把密钥或请求凭证写入业务数据。
- 降级边界：真实仪器通信仍明确排除在 T-602 外，由 T-605 评估。

## 远程复测与结论（2026-07-19）

- 首次远程复测发现 `taskId` 被重复传入共享数据载荷校验，已按 `T-602B1/DEF-602-001` 修复；单元测试验证路由字段与数据载荷边界。
- 修复后在正式项目同环境生产服务运行 `npm.cmd run test:simulated-instrument`：ACTIVE 设备写入、服务端强制 `INSTRUMENT`、伪造来源拒绝、非 ACTIVE 设备拒绝和审计一致性均通过，`cleanedByFinally=true`。
- 正式迁移与本地迁移完全一致，远程正向/负向、清理、对抗性检查和质量门禁完成，批准关闭 `T-602D`。
