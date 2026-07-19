# 系统测试缺陷与环境问题清单

| ID | 等级 | 类型 | 现象/影响 | 处置 | 状态 |
| --- | --- | --- | --- | --- | --- |
| `ENV-503-001` | Environment gate | Supabase CLI 认证 | 当前受控终端复核 `npm.cmd exec -- supabase projects list` 仍返回 `LegacyPlatformAuthRequiredError`，无法读取用户 Terminal 保存的 CLI 凭据；这只影响依赖 CLI 管理权限的自动清理，不否定已有业务断言和浏览器 SQL 清理证据 | 已在可访问系统凭据的用户环境验证目标项目为 `linked`/`ACTIVE_HEALTHY`，并复跑 `test:dashboard-integration`；`dashboardIntegration`、`cleanupVerified` 和零残留核对均通过。后续 CLI 依赖测试必须在有授权会话或等效受控入口后复测，不回显或猜测 token | Closed |
| `TEST-503D-001` | P2 | 测试基础设施 | 首次自动清理进入数据库后，直接删除 `public.instrument` 触发 `guard_instrument_write()`，导致临时数据清理失败 | 清理 SQL 在仪器删除前后临时禁用并恢复用户触发器；修复后直接清理和完整看板集成均通过，仪器残留为 0 | Closed |
| `ENV-505-001` | Environment gate | 演示环境 | 隔离项目 `test` 的页面级全链路演练已完成，正式项目保护仍有效 | 已验证三角色页面证据、Dashboard SQL Editor 清理、受支持 Auth Admin API 删除 8 个合成账号，以及最终只读结果 `publicDemoRows=0`、`publicDemoUsers=0`、`auditDemoRows=0`、`authDemoUsers=0`；未直接删除 `auth.users`，未触及正式项目 | Closed |
| `ENV-OPS-001` | P2 | 运维增强 | 当前没有 Storage 对象自动导出脚本，数据库备份不能证明附件文件已恢复 | 手册已明确 Storage 独立边界；后续可增加受控对象清单/校验脚本，不阻塞当前文档验收 | Accepted follow-up |
| `ENV-PLAYWRIGHT-001` | P2 | Windows runner | Playwright 自动启动 Next 服务曾出现长时间无输出；HTTP 和测试逻辑本身正常 | 2026-07-18 使用已构建生产服务 `3100` 端口并运行 `npx.cmd playwright test --workers=1 --reporter=line`，完整未认证回归 17/17 通过；默认自动 webServer 模式仍不作为通过证据 | Mitigated |

## 当前批次验证增量（2026-07-18）

- `scripts/integration/demo-cleanup.sql` 已补齐库存事务/库存项的受控触发器处理，并补充 `DEMO_` 单位和参数清理；此前远程受控执行已观察到 `publicDemoRows: 0`，但本轮种子重新执行后仍需再执行一次完整清理并复核。
- `scripts/integration/demo-seed.sql` 已修复两类可重复执行问题：复用不可变的 `DEMO_RULE_ROUND_001`，以及为报告快照写入追溯页面所需的完整任务、样品、数据和审核字段。补丁后的种子脚本已在隔离项目 Dashboard SQL Editor 返回 `Success. No rows returned`；页面级报告追溯需在同一隔离运行时重新登录后复测。
- 本批次本地质量门禁：`npm.cmd run lint`、`npm.cmd test`（20 个测试文件、86 个测试）、隔离构建、`check:demo-assets`、`check:system-test-plan`、`check:backup-docs`、`check:versioning`、`check-consistency.ps1` 和 `git diff --check` 均通过。上述门禁不替代 T-505C 的页面全链路和最终清理证据。
- 本轮新增证据：隔离 `demo:preflight` 通过；隔离生产构建通过；对 `http://127.0.0.1:3100` 执行未认证 Playwright 回归 17/17 通过；只读 API 核验确认项目 1、任务 2、样品 1、实验数据 3、报告 1 和设备/库存/方法各 1。正向页面演练未开始写入，故未执行清理，也未把种子存在误记为页面验收完成。

## 2026-07-18 增量任务环境门禁更新

- T-603 的远程迁移、模板 CRUD 和报告快照正向验收继续受 `ENV-601-001` 阻塞；未执行任何未经授权的替代写入。
- T-604 的 `npm.cmd run test:report-integration` 在 linked cleanup 阶段因 Supabase CLI/service key 命令失败退出，未产生可宣称的远程签名验收证据；恢复授权后必须重跑 migration、签名正向/负向用例和清理核验。
- 复核补充：Supabase Dashboard 的正式项目登录会话可见，但 SQL Editor 控件在本次受控操作中连续超时，未形成可验证查询结果，也未执行迁移或其他写入；恢复 service key，或由授权人员在 Dashboard SQL Editor 执行迁移后，仍需按 T-601D～T-604D 的脚本和清理证据复验。

## 判定规则

- `P0/P1` 产品缺陷未关闭前不得发布；`Environment gate` 不等于产品缺陷，但必须有复现、责任条件和复测入口。
- 不能用“手工看起来正常”关闭缺陷；必须补充命令、运行环境、结果和清理证据。
- 关闭记录只能追加，不删除原始失败记录。

## 页面级正向演练追加记录（2026-07-18）

- 页面正向演练已完成，管理员、操作员、审核员的授权与负向访问证据已记录于 `docs/demo/demo-initialization-evidence.md`；审计页最终加载 12 条记录，首次登录后的瞬时 403 判定为会话传播现象，不构成产品缺陷。
- `ENV-505-001` 已关闭：页面演练后已完成 `demo-cleanup.sql`、受支持 Auth 删除及公开/业务用户/审计/Auth 四类零残留只读核验；此前的阻塞记录保留不变。
- 历史状态保留：`ENV-505-001` 在页面演练和清理前曾为 `Open`；该历史状态不代表当前结论，当前表格状态为 `Closed`。

## T-601 环境边界追加记录（2026-07-18）

- `ENV-601-001`：正式 `.env.local` 的 Supabase REST 只读探测返回 401，未执行任何正式项目写入；该环境凭据问题不归因于 T-601 产品代码。为保持可复现进度，T-601 正向集成改在已批准隔离项目 `test` 运行，并通过 `DATA_IMPORT_ENV_FILE=.env.demo.local` 与 `with-demo-env.ps1` 明确记录环境边界；正式环境凭据恢复后需复跑同一脚本。当前状态：Open（Environment gate）。
- T-602 复用 `ENV-601-001`：模拟仪器接口的远程正向写入和审计核对同样需要 Supabase service key；凭证恢复前只保留本地与未认证 E2E 证据，不将远程验收标记为通过。

## T-602 远程验收追加记录（2026-07-19）

- `DEF-602-001`（P1，Open）：远程验收在服务已启动且 Supabase 直连正常后，`POST /api/v1/instruments/{id}/simulate-data` 返回 `400 INVALID_DATA_FIELD`，消息为 `taskId 由服务端生成`。
- 根因：模拟接口需要从请求体读取 `taskId` 选择任务，但 `buildSimulatedInstrumentPayload` 提取后仍将该字段传入共享 `buildExperimentDataPayload`；共享校验器正确拒绝客户端控制的 `taskId`。
- 修复计划：按 `FR-DATA-009`、`NFR-SEC-001` 执行 `T-602B1`，提取 `taskId` 后从数据载荷剥离；保留通用校验器的服务端字段拒绝，并补充单测、远程正向/伪造字段回归和自动清理证据。

## T-603 远程验收追加记录（2026-07-19）

- `DEF-603-001`（P1，Open）：报告模板创建成功后，`PATCH /api/v1/settings/report-templates/{code}` 仅提交 `value` 时返回 `400 INVALID_FIELD`，消息为 `code不能为空且长度不能超过 64`。
- 根因：`buildSettingPayload` 在 `update=true` 时仍无条件调用 `requireText(body.code, ...)`；路由已经使用路径 `code` 定位资源，导致 PATCH 的部分更新契约被实现破坏。
- 修复计划：按 `FR-SETTING-004`、`FR-REPORT-001～006` 执行 `T-603B1`，更新时仅在请求体显式提供 `code` 时校验/写入；补充模板 PATCH、审计、权限和自动清理回归。

## T-604 远程验收追加记录（2026-07-19）

- `DEF-604-001`（P1，Open）：`npm.cmd run test:report-integration` 已通过认证、迁移和资源创建阶段，但签名请求失败，数据库返回 `function digest(bytea, unknown) does not exist`；脚本的 finally 清理核验通过，临时用户、报告、历史、签名、任务、样品、项目、仪器和方法均为 0。
- 根因：`sign_report` 是 `security definer` 且设置 `search_path = public`，而 Supabase 的 `pgcrypto.digest` 位于 `extensions` schema；未限定 schema 的函数调用无法解析，算法字符串也未显式声明为 `text`。
- 修复计划：按 `FR-REPORT-007`、`NFR-SEC-001～002` 执行 `T-604B1`，新增迁移以保持 RPC 签名不变并使用 `extensions.digest(..., 'sha256'::text)`；随后重跑报告签名正向/负向、审计、不可变约束和自动清理。

## 2026-07-19 远程回归关闭记录

- `ENV-601-001`（Environment gate，Closed）：CLI 会话、正式项目绑定和 service key 已恢复；正式项目迁移列表与本地一致，数据导入、模拟仪器、报告模板和报告签名集成均在同环境生产服务中完成并自动清理。原始 401/CLI 失败记录保留在上文，不再阻塞本批次。
- `DEF-602-001`（P1，Closed）：按 `T-602B1` 从共享数据载荷剥离路由 `taskId`；单元测试与正式远程回归通过，`ACTIVE instrument write`、来源强制、伪造来源/非 ACTIVE 拒绝、审计和 `cleanedByFinally=true` 均有证据。
- `DEF-603-001`（P1，Closed）：按 `T-603B1` 允许路径编码 PATCH 的请求体省略 `code`；单元测试与正式远程回归通过，模板 CRUD、停用、审计和 `cleanedByFinally=true` 均有证据。
- `DEF-604-001`（P1，Closed）：按 `T-604B1` 推送 `202607190001_fix_report_signature_digest.sql`，显式限定 `extensions.digest` 和 `text` 参数；正式远程报告集成全量通过，签名、重复/直接写入拒绝、不可变性、审计、权限负向和清理均有证据。

## MVP 收尾缺陷（2026-07-19）

- `DEF-MVP-001`（P1，Closed）：`T-606` 已将 `/` 改为会话入口，登录成功进入 `/dashboard`；生产服务黑盒验证 `/`、`/dashboard`、`/login` 和新增 E2E 2/2 通过，旧骨架文案已移除。
- `DEF-MVP-002`（P1，Closed）：`T-607` 的受控 bootstrap 已在正式项目创建首个管理员并绑定 `SYSTEM_ADMIN`；真实登录、根入口到工作台和 `/admin/users` 权限验证通过。测试种子按约定记录在根 README，正式密码未写入文档、脚本源码或日志。
- `DEF-MVP-003`（P1，Closed）：原工作台把全部入口压缩在无分组横向链接行中，导致模块关系不清晰、文字拥挤且窄屏难以操作；`T-610～T-613` 已改为权限过滤的四组块级导航，桌面/手机视口检查通过，375px 下无横向溢出。
