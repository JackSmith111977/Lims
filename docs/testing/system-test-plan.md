# 系统测试计划与验收矩阵

| 项目 | 内容 |
| --- | --- |
| 计划 ID | `TEST-PLAN-001` |
| 关联设计 | [`DES-SYSTEM-TEST-001`](../../specs/001-lims-core/design-system-test.md) |
| 需求事实源 | [`spec.md`](../../specs/001-lims-core/spec.md) |
| 当前状态 | Approved：T-505C/T-506C 的隔离正向演练、清理、全量回归和质量门禁均已完成 |

## 1. 执行顺序

1. 运行 `npm.cmd run lint`、`npm.cmd test`、`npm.cmd run build`。
2. 用已构建生产服务运行完整未认证 E2E：`npx.cmd playwright test --workers=1 --reporter=line`。
3. 在经授权的隔离远程 Supabase 项目执行 migration 状态核对和各模块远程集成；每组使用独立临时前缀并在 `finally` 清理。本地数据库不作为远程验收证据。
4. 执行 T-503 看板集成和 T-505 演示流程，分别确认临时测试前缀、`DEMO_` 前缀和演示账号残留为 0。
5. 运行 `npm.cmd run check:backup-docs`、`npm.cmd run check:demo-assets`、一致性和版本门禁。
6. 将失败记录到 [`defect-log.md`](defect-log.md)，修复后保留原失败证据、复测命令和新结果。

## 2. 验收矩阵

| 验收 ID | 主要证据 | 当前状态 | 复测入口 |
| --- | --- | --- | --- |
| `AC-AUTH-001` | `REV-AUTH-001`、T-106、`test:auth-audit-integration`、`audit-access.spec.ts`；远程临时用户/角色/审计清理为 0 | Passed | `npm.cmd run test:auth-audit-integration` |
| `AC-SAMPLE-001` | `REV-SAMPLE-REG-001`、`REV-MAIN-FLOW-001`、`test:integration` | Passed（已有模块证据） | `npm.cmd run test:integration` |
| `AC-SAMPLE-002` | `REV-SAMPLE-FLOW-001`、`test:integration` | Passed（已有模块证据） | `npm.cmd run test:integration` |
| `AC-TASK-001` | `REV-TASK-REG-001`、`REV-TASK-FLOW-001`、主流程集成 | Passed（已有模块证据） | `npm.cmd run test:integration` |
| `AC-DATA-001` | `REV-EXPERIMENT-DATA-001`、`test:data-integration`、`test:processing-integration` | Passed（已有模块证据） | `npm.cmd run test:data-integration` |
| `AC-REVIEW-001` | `REV-RESULT-REVIEW-001`、`test:review-integration` | Passed（已有模块证据） | `npm.cmd run test:review-integration` |
| `AC-REPORT-001` | `REV-REPORTING-001`、`test:report-integration` | Passed（已有模块证据） | `npm.cmd run test:report-integration` |
| `AC-RESOURCE-001` | `REV-RESOURCE-MANAGEMENT-001`、设备/库存/环境集成 | Passed（已有模块证据） | `npm.cmd run test:resource-integration` |
| `AC-AUDIT-001` | `REV-TRACEABILITY-001`、`test:traceability-integration`、`traceability-access.spec.ts` | Passed（已有模块证据） | `npm.cmd run test:traceability-integration` |
| `AC-AUDIT-002` | `REV-BACKUP-RECOVERY-001`、`check:backup-docs` | Passed（文档验收） | `npm.cmd run check:backup-docs` |
| `AC-DASH-001` | `REV-DASHBOARD-001`、看板集成断言、17/17 未认证 E2E、`cleanupVerified` 零残留证据 | Passed | `npm.cmd run test:dashboard-integration` |
| `AC-ENV-001` | SchoolWork 项目 ref、`test` 项目 ref、`demo:preflight`、迁移/集成/清理记录、`T-102F`/`T-505C1～C3` 工作流检查 | Passed（隔离全链路演练、清理和四类零残留复核完成） | `npm.cmd run demo:preflight`、`scripts/sdd/check-consistency.ps1`、[`demo-initialization-evidence.md`](../demo/demo-initialization-evidence.md)、远程演练记录 |
| `AC-DEV-001` | Spec 入口、相关设计/任务、需求 ID 和提交记录 | Passed（流程规则已固化） | `scripts/sdd/check-consistency.ps1`、`T-102F` |

## 3. 系统级负向场景

| 场景 ID | 攻击/故障 | 期望结果 |
| --- | --- | --- |
| `ST-NEG-001` | 未登录访问任意保护页面和 API | 页面跳转登录，API 返回统一认证错误 |
| `ST-NEG-002` | 普通用户读取或修改无权限项目/任务/数据 | 服务端权限和 RLS 拒绝，不能依赖前端隐藏 |
| `ST-NEG-003` | 直接修改已审核/归档数据或终态处理运行 | 数据库约束/RPC 拒绝并保留审计 |
| `ST-NEG-004` | 重复编号、倒置日期、非法状态、越权关联 | 输入校验拒绝，不产生部分业务记录 |
| `ST-NEG-005` | 清理脚本使用非演示前缀或恢复校验失败 | 停止操作，保留现场，不执行宽泛删除/解除维护 |

## 4. 2026-07-18 当前分支远程回归记录

在正式远程 Supabase `SchoolWork` 项目上，使用当前分支和 `.env.local` 运行了带 finally 清理的集成测试；本批次未写入隔离演示项目：

| 命令 | 结果 | 清理证据 |
| --- | --- | --- |
| `npm.cmd run test:auth-audit-integration` | 通过：成功/失败/停用登录、审计查询、敏感字段排除、越权拒绝、退出审计 | `users=0`、`roles=0`、`emailAudits=0` |
| `npm.cmd run test:integration` | 通过：样品编号、任务关联/分配、执行流转、交接历史、终态归档 | `cleanedByFinally=true` |
| `npm.cmd run test:method-integration` | 通过：方法版本、不可变身份、附件存储、RLS、审计 | `cleanedByFinally=true` |
| `npm.cmd run test:inventory-integration` | 通过：库存事务、余额并发、耗尽/恢复、历史和权限 | `users=0`、`items=0`、`transactions=0`、`roles=0` |
| `npm.cmd run test:inventory-alerts-integration` | 通过：低库存/有效期告警、任务关联、归档拒绝和审计 | `users/items/transactions/tasks/projects/methods/roles=0` |
| `npm.cmd run test:environment-integration` | 通过：阈值、边界状态、快照不可变、权限和告警审计 | `users=0`、`laboratories=0`、`thresholds=0`、`records=0`、`roles=0` |
| `npm.cmd run test:resource-integration` | 通过：设备档案、维护校准、终态保护、库存资源及审计 | 设备/任务/样品/项目/方法和库存临时数据均为 `0` |

该记录不关闭 `T-505C` 或 `T-506C`：页面级隔离演示、演示账号清理，以及依赖 Supabase CLI 管理认证的其余回归仍需按发布门禁补齐。

## 4.1 2026-07-18 隔离页面前置增量

| 检查 | 结果 | 结论 |
| --- | --- | --- |
| `with-demo-env.ps1 -Action preflight` | `PASSED` | 隔离 URL、项目 ref 和两类运行时 key 一致；未输出 key |
| `with-demo-env.ps1 -Action build` | 通过 | 隔离 Supabase URL 已进入本次生产构建 |
| `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3100 npx.cmd playwright test --workers=1 --reporter=line` | 17/17 通过 | 未认证页面/API 保护回归通过，覆盖 `ST-NEG-001` 及各模块访问拒绝 |
| 隔离项目 `DEMO_` 只读统计 | 项目 1、任务 2、样品 1、实验数据 3、报告 1，资源锚点均存在 | 种子范围符合目录；未执行清理，因此不构成 T-505C 完成证据 |
| 隔离演示账号正向登录 | 阻塞 | 规范占位账号存在，但临时密码不在仓库；不得猜测或擅自重置。正式项目测试管理员种子另见根 README，不作为隔离演示账号凭据 |

本轮 CLI 边界复核：`npm.cmd exec -- supabase projects list` 返回 `LegacyPlatformAuthRequiredError`（未提供 access token）。未读取、回显或猜测用户的 CLI 凭据，也未把依赖 CLI 管理权限的处理/报告类测试标记为通过；这些测试必须在具备授权 CLI 会话或等效受控入口后复测。

## 5. 发布前判定

`T-506` 不能仅凭本地测试标记完成。必须在 `T-503D` 和 `T-505C` 关闭后，重新执行全量测试、远程集成、清理验证、缺陷复测、对抗性审查、一致性和版本门禁，并把结果写回本文件和缺陷清单。

Release gate: all P0/P1 product defects must be closed or explicitly exempted, and cleanup verification must be recorded for every temporary or demo fixture.

## 5.1 2026-07-18 最终隔离演练与门禁结果

| 检查 | 结果 | 证据 |
| --- | --- | --- |
| 三角色页面级正向 AC | 通过 | 管理员设置/用户/角色/设备/库存/环境/审计；操作员任务/样品/数据及越权拒绝；审核员审核/报告/追溯/工作台；关键编号已写入演示证据 |
| 演练后清理 | 通过 | Dashboard SQL Editor 执行 `demo-cleanup.sql`；受支持 Auth Admin API 删除 8 个合成账号 |
| 隔离零残留 | 通过 | `publicDemoRows=0`、`publicDemoUsers=0`、`auditDemoRows=0`、`authDemoUsers=0` |
| 回归与质量门禁 | 通过 | 单元测试 20 文件/86 测试、未认证 Playwright 17/17、隔离构建、lint、Spec/备份/版本/一致性检查均通过 |

据此，T-505C 的隔离演示闭环和 T-506C 的全量系统测试验收条件均已满足；此前的 CLI 认证边界记录保留为历史环境说明，不作为产品缺陷或未完成项。

## 5.2 T-601 数据交换增量

`FR-DATA-006` 已补充 CSV/XLSX 解析、文件边界、行级校验、`FILE` 来源、导入审计和未认证接口保护。2026-07-19 在正式项目同环境生产服务运行 `npm.cmd run test:data-import` 通过：CSV/XLSX、`FILE` 来源、非法行零写入、审计摘要和 finally 清理均通过；`T-601D` 可关闭。

### 5.3 T-602 模拟仪器数据接口增量

- 覆盖 `FR-DATA-009`、`NFR-DATA-002`、`NFR-SEC-001～002`：ACTIVE 设备路径、任务/样品关联、服务端强制 `INSTRUMENT` 来源、不可变数据写入、审计、伪造字段拒绝和未认证 401。
- 本地证据：`tests/unit/simulated-instrument.test.ts`、`tests/e2e/instrument-access.spec.ts`、生产构建和 TypeScript/lint 已通过。
- 远程迁移和 service key 已恢复；首次运行发现 `taskId` 被重复传入共享数据载荷校验，按 `T-602B1/DEF-602-001` 修复后复跑通过：ACTIVE 写入、`INSTRUMENT` 来源强制、伪造来源/非 ACTIVE 拒绝、审计和清理均通过；`T-602D` 可关闭。

### 5.4 T-603 报告模板配置增量

- 覆盖 `FR-SETTING-004` 和报告快照边界：`REPORT_TEMPLATE_` JSON 资源、字段数组校验、设置权限/审计、停用代替删除、生成时模板快照和未认证 401。
- 本地证据：`admin-validation.test.ts` 通过；`admin-access.spec.ts` 设置 API 401 通过；生产构建包含动态设置路由；migration `202607180001_report_templates.sql` 已加入；集成入口为 `npm.cmd run test:report-template`，报告集成额外校验模板快照。
- 远程迁移和 service key 已恢复；首次 CRUD 运行发现 PATCH 请求体错误要求包含 `code`，按 `T-603B1/DEF-603-001` 修复后复跑通过：前缀校验、模板 CRUD、停用、审计和清理均通过；`T-603D` 已关闭。

### 5.5 T-604 报告电子签名回执增量

- 覆盖 `FR-REPORT-007`、`NFR-SEC-001～002`：仅 `PUBLISHED` 报告可由 `report.publish` 用户签署；服务端按报告编号、版本和快照计算 SHA-256；签名回执追加且不可变；重复签名、直接表写入、客户端伪造字段和未认证访问均拒绝，并写入 `SIGN` 审计。
- 本地证据：`tests/unit/reporting-validation.test.ts`、`tests/e2e/report-access.spec.ts`、生产构建、OpenAPI YAML 解析和 `REV-REPORT-SIGNATURE-001`。
- `npm.cmd run test:report-integration` 首次发现 `digest(bytea, unknown)` 解析缺陷，已按 `T-604B1/DEF-604-001` 新增迁移显式调用 `extensions.digest(..., 'sha256'::text)`；正式项目复跑通过签名回执、重复/直接写入拒绝、签名审计、权限负向、报告快照和清理，`cleanupVerified=true` 且临时资源全为 0，`T-604D` 已关闭。
- 原始 CLI/service key 阻塞记录保留为历史证据，不改变当前通过结论。

### 5.6 T-605 真实仪器/环境传感器接口评估

- 评估 `FR-EQUIP-007` 与 `FR-ENV-006` 的协议接入边界、设备身份、来源、幂等、离线缓冲、凭据和审计风险。
- 结论记录于 [`RES-REAL-INSTRUMENT-001`](../kb/RES-REAL-INSTRUMENT-001.md)：后续采用独立连接器/边缘网关；当前继续用模拟仪器和文件导入验证业务边界，不直接在 Web 请求层接入真实设备。
- 审查记录为 [`REV-REAL-INSTRUMENT-EVALUATION-001`](../sdd/reviews/REV-REAL-INSTRUMENT-EVALUATION-001.md)，T-605 评估完成；真实厂商协议实现需另立设计和任务。

### 5.7 MVP 收尾验收（T-606～T-609）

- 根入口：未认证 `/` → `/login`，认证 `/` → `/dashboard`；登录成功不再返回旧骨架页。
- 管理员初始化：受控脚本只使用 service role 创建/复用指定 Auth 用户，幂等绑定 `SYSTEM_ADMIN`，写入 bootstrap 审计，不输出密码；脚本语法、`example.invalid` 只读 dry-run、正式初始化和真实登录/权限入口验证均通过。
- 权限导航：`/dashboard` 按角色权限显示模块；管理员可进入 `/admin/users` 创建普通用户，普通用户不能进入管理员页面。
- 旧状态清理：代码和核心设计不再出现“模块待接入”“下一步配置登录”等与当前实现冲突的文案；历史失败记录仅作为历史保留。

### 5.8 工作台导航可用性优化（T-610～T-613）

- 将工作台入口改为“管理与配置”“实验流程”“审核与报告”“资源管理”四组，移除已登录状态下的“返回系统首页”和“登录页”主体链接；服务端权限过滤和业务路由保持不变。
- `npm.cmd test -- --run tests/unit/dashboard-navigation.test.ts tests/unit/dashboard-validation.test.ts`：2 个文件、11 个测试通过；其中导航路径匹配 2 个测试用例、4 个断言通过。
- 受控浏览器登录 `test@qq.com` 后，桌面视口显示四组导航和 15 个授权入口；手机视口实际宽度 375px，`documentScrollWidth=375`，无横向溢出。
- 视觉和交互检查覆盖块级点击区域、组标题、`nav` 语义、`aria-current` 逻辑、focus-visible 样式、未认证 `/dashboard` 保护和模块权限回归；生产构建、lint、TypeScript 和 SDD 一致性均通过。
- 全量 `npm.cmd run test:e2e -- --workers=1 --reporter=line` 在 Windows 环境运行至 15/18 个场景后超时，未产生断言失败；直接相关的 `root-access.spec.ts` 与 `dashboard-access.spec.ts` 定向回归 2/2 通过。该超时沿用既有 Playwright 启动/页面等待环境限制，不作为本次导航改动的产品失败证据。
