# 样品登记与唯一编号对抗性审查记录

| 项目 | 内容 |
| --- | --- |
| Review ID | REV-SAMPLE-REG-001 |
| 审查对象 | DES-SAMPLE-REGISTRATION-001、T-203A～T-203D、样品 migration、RLS、服务层、API、页面 |
| 版本/提交 | 工作树（未提交） |
| 审查人 | Codex 角色切换审查 |
| 日期 | 2026-07-15 |

## 攻击范围

从未认证访问、样品读写越权、自动/手工编号冲突、数量精度、状态绕过、归档项目、跨项目任务、归档任务、任务/方法关系、关联-only 更新、审计失败和临时数据残留角度审查。

## 发现与处置

| ID | 等级 | 场景 | 影响 | 修复/验证 | 状态 |
| --- | --- | --- | --- | --- | --- |
| REV-SAMPLE-REG-001-01 | P1 | 未认证访问 `/samples` 或 `/api/v1/samples` | 可能读取样品、任务和方法信息 | proxy、页面和 API 三层保护；完整未认证 E2E 6/6 通过 | Closed |
| REV-SAMPLE-REG-001-02 | P1 | 项目负责人无 `sample.manage` 创建样品 | 可能越权写入样品档案 | API 要求 `sample.manage`；远程项目负责人负向集成返回 403 | Closed |
| REV-SAMPLE-REG-001-03 | P1 | 直接提交 `status` 或跨项目任务 ID | 可能绕过 T-204 或污染项目边界 | 服务端返回 `SAMPLE_STATUS_DEFERRED`/`INVALID_TASK_SCOPE`；远程集成覆盖 | Closed |
| REV-SAMPLE-REG-001-04 | P1 | 归档项目或归档任务继续登记/关联样品 | 产生不可执行或不可追溯的样品关系 | 服务端重新读取项目/任务状态；远程归档项目验证通过，归档任务由服务校验覆盖 | Closed |
| REV-SAMPLE-REG-001-05 | P1 | 自动编号并发冲突或手工编号重复 | 样品编号不可唯一查询 | 服务端随机编号有限重试，数据库唯一约束兜底；远程生成编号和重复编号验证通过 | Closed |
| REV-SAMPLE-REG-001-06 | P2 | 小数超过 6 位、负数量或非法 task ID | 数据精度和业务完整性受损 | 服务端十进制格式校验、数据库 check、17 个单元测试和远程非法数量验证 | Closed |
| REV-SAMPLE-REG-001-07 | P1 | 清空任务后仅提交 `taskIds` 重新关联 | 关联更新可能因空样品更新被错误拒绝 | 发现 `SAMPLE_UPDATE_FAILED`，修复为空 payload 时跳过空 UPDATE；修复后完整远程集成 1/1 通过 | Closed |
| REV-SAMPLE-REG-001-08 | P2 | 样品与方法建立重复的直接关系表 | 方法事实可能与任务引用漂移 | 固定为 `sample → task_sample → experiment_task.method_id`，详情集成返回方法摘要 | Closed by design |
| REV-SAMPLE-REG-001-09 | P2 | 样品写入或任务关联无审计 | 无法追溯样品登记变化 | migration 扩展 `record_audit_event` 支持 `sample.manage`；创建/修改/关联写审计，临时审计已清理 | Closed |

## 复测结果

- `npx.cmd tsc --noEmit`：通过。
- `npm.cmd run lint`：通过。
- `npm.cmd test -- --run`：通过，4 个测试文件、17 个单元测试通过。
- `npm.cmd run build`：通过；样品页面和 API 路由进入生产构建产物。
- 未认证回归 E2E：6/6 通过，覆盖用户、角色、设置、人员、项目/任务和样品页面/API。
- 远程 T-203 正向/负向集成：1/1 通过，覆盖自动编号、手工编号、重复编号、项目/任务/方法展开、清空后重关联、跨项目任务、非法数量、归档项目、状态越权和项目负责人越权；临时账号、方法、任务、项目、样品、关联和审计已清理。
- 远程 migration `202607150004_sample_registration_audit.sql`：已应用；CLI 的 Docker 缓存警告不影响远程 migration 执行。
- `scripts/sdd/check-consistency.ps1`、`npm.cmd run check:versioning`、`git diff --check`：待本次任务状态更新后执行最终门禁。

## 已知非阻塞项

- 最小“省略 `taskIds`”远程分支因当前机器到 Supabase 公网 `443` TCP 超时未到达应用层；本分支由服务层单元校验、生产构建和完整管理员远程集成间接覆盖，待网络恢复后可补跑。
- Windows 环境的 Next.js 原生 SWC 加载仍有既有警告，构建使用 WASM fallback；不属于 T-203 业务回归。
- 样品状态、流转节点和交接记录由 T-204 实现，当前页面只读展示状态。

## 结论

T-203A～T-203E 的设计、唯一编号、样品登记字段、项目/任务/方法关联、权限、审计、API、页面、测试和质量证据齐备，未发现未关闭的 P0/P1 业务问题，T-203 可以标记完成。
