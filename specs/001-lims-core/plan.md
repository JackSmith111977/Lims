# 核心系统实现计划

| 项目 | 内容 |
| --- | --- |
| 来源 Spec | `specs/001-lims-core/spec.md` |
| 状态 | Approved（技术方案已切换） |
| 版本 | v0.1 |
| 技术栈 | Next.js App Router + TypeScript + Tailwind CSS + Supabase |

> 本文件是从核心 Spec 派生的技术计划，不得在这里新增未经确认的功能需求。技术栈确认后，应补充架构图、部署方式和技术决策记录。

## 1. 实现原则

- 先完成一条可运行的业务闭环，再扩展资源和智能化功能。
- 每个实现阶段都应能够独立演示和验证。
- 先建立稳定的数据模型，再实现页面和复杂统计。
- 使用模拟数据或文件导入替代真实仪器集成。
- 所有实现任务通过需求 ID 追踪到 `spec.md`。

## 2. 建议的实现切片

### Slice 1：基础框架与权限

对应需求：`FR-AUTH-*`、`FR-SETTING-*`、`NFR-SEC-*`

- 项目基础结构
- 用户、角色和权限
- 登录、退出和路由保护
- 基础布局和导航
- 系统基础参数

### Slice 2：样品与任务主流程

对应需求：`FR-SAMPLE-*`、`FR-TASK-*`、`FR-PER-*`

- 科研项目和任务登记
- 样品登记、唯一编号和状态
- 样品流转
- 任务分配和任务状态
- 实验人员基础档案

### Slice 3：实验数据、审核与报告

对应需求：`FR-METHOD-*`、`FR-DATA-*`、`FR-REVIEW-*`、`FR-REPORT-*`

- 实验方法和版本
- 原始数据和处理数据
- 实验结果录入
- 审核、退回和审核意见
- 报告生成、版本和归档（设计：`DES-REPORTING-001`）

### Slice 4：实验室资源管理

对应需求：`FR-EQUIP-*`、`FR-INVENTORY-*`、`FR-ENV-*`

- 仪器设备档案
- 设备维护和校准记录
- 试剂耗材库存
- 环境记录和阈值提醒

### Slice 5：追溯、统计与交付

对应需求：`FR-AUDIT-*`、`FR-DASH-*`、`NFR-BACKUP-001`

- 操作日志
- 报告到样品、任务、数据和审核的追溯
- 数据看板和基础统计
- 数据备份恢复说明
- 测试、部署和演示数据

## 3. 技术决策待办

- [x] 确定全栈框架：Next.js App Router + TypeScript
- [x] 确定 UI：shadcn/ui + Tailwind CSS
- [x] 确定数据服务：Supabase
- [x] 确定数据库：Supabase PostgreSQL
- [x] 确定认证和权限：Supabase Auth + PostgreSQL RLS + 服务端授权
- [x] 确定文件附件存储：Supabase Storage
- [x] 确定 API 边界：Next.js Route Handlers + REST/JSON + OpenAPI
- [x] 确定部署方式：Vercel 或自托管 Next.js，Supabase 托管项目
- [x] 确定实际依赖版本和测试框架：Node.js 24.1.0、Next.js 16.2.10、React 19.2.4、TypeScript 5.9.3、Vitest 4.1.10、Playwright Test 1.61.1
- [x] 配置工程验证命令：lint、Vitest、Playwright Test 和 `next build --webpack`
- [x] 接入 Supabase CLI 与项目级只读 MCP 配置：用于迁移、类型生成和 AI 辅助查询
- [x] 执行首个远程数据库迁移并核验核心表：远程版本 `202607120001`
- [x] 确认本项目远程数据库：Supabase `SchoolWork` 项目（project ref：`fofjsknqdrmgyxtxwxwo`）；其他组织中的暂停项目不属于本系统数据源（Spec：`NFR-ENV-001`）
- [x] 建立隔离演示数据库：Supabase `test` 项目（project ref：`vrggsiwqttxciaaemhri`）仅承载 `DEMO_` 合成数据，不改变正式数据源边界（Spec：`NFR-ENV-001`、`AC-ENV-001`）
- [x] 确定远程环境与操作入口：开发、联调、迁移验证、演示和验收使用远程 Supabase；Dashboard 人工操作通过受控浏览器，CLI/API 仅用于有证据的可重复自动化（Spec：`NFR-ENV-001～002`、`NFR-DEV-001`）
- [x] 确定开发准入：开始需求、设计或编码前读取 Spec 入口、核心 Spec、相关设计/计划/任务和 SDD 流程（Spec：`NFR-DEV-001`）
- [x] 建立 Git 分支、提交、版本、发布和回滚规约
- [x] 建立用户与角色管理设计边界和 T-105A/T-105B 任务拆分
- [x] 确认基础设置统一模型：组织结构、通用分类、计量单位和系统参数（DES-SETTING-001）
- [x] 确认实验室人员档案模型、能力记录和任务状态读取边界（DES-PERSONNEL-001）
- [x] 确认科研项目、实验任务登记和后续分配/状态机的模块边界（DES-TASK-REGISTRATION-001）
- [x] 确认样品登记、编号生成和项目/任务/方法关联边界（DES-SAMPLE-REGISTRATION-001）
- [x] 确认样品状态机、物流事件、事务边界和流转 API（DES-SAMPLE-FLOW-001）
- [x] 确认任务分配、实验组分配、状态机、事务边界和状态历史 API（DES-TASK-FLOW-001）
- [x] 确认方法版本实体、历史审计、附件元数据和不可变版本边界（DES-METHOD-VERSIONING-001）
- [x] 确认原始/处理/结果数据分离、追溯关系、权限和不可变录入边界（DES-EXPERIMENT-DATA-001）
- [x] 确认规则版本、处理运行、结果判定和异常说明边界（DES-EXPERIMENT-PROCESSING-001）；事务 RPC 在数据库边界重新校验修约/阈值结果，防止绕过服务层伪造处理结果
- [x] 完成实验数据处理 migration `202607150012` 的远程应用、集成验证和临时资源清理核验
- [x] 确认结果审核的追加历史、三类结果、任务状态事务、权限和审计边界（DES-RESULT-REVIEW-001）；远程迁移 `202607150013`、集成验证、质量门禁和对抗性审查均已完成。
- [x] 确认报告快照、版本状态机、发布归档、权限和导出边界（DES-REPORTING-001）
- [x] 完成报告迁移 `202607150014`、远程集成、质量门禁和对抗性审查（T-305E）
- [x] 完成数据、审核和报告专项回归测试及远程清理核验（T-306）
- [x] 锁定仪器设备档案字段、状态终态、权限、关联查询和 T-402 边界（DES-INSTRUMENT-REGISTRY-001）
- [x] 完成设备迁移 `202607150015`、远程集成、质量门禁和对抗性审查（T-401E）
- [x] 锁定维护/维修/校准追加记录、周期、提醒和 T-401 事务边界（DES-INSTRUMENT-MAINTENANCE-001）
- [x] 完成维护/校准迁移 `202607150016`、服务/API、设备历史页面、远程集成、质量门禁和对抗性审查（T-402E）
- [x] 锁定试剂耗材主档、库存余额投影、变动类型、事务边界和 T-404 范围（DES-INVENTORY-MANAGEMENT-001）
- [x] 锁定低库存阈值、有效期提醒窗口和 OUTBOUND-实验任务关联边界（DES-INVENTORY-ALERTS-001）
- [x] 完成库存提醒/任务关联迁移 `202607160018`、服务/API、提醒摘要页面、远程集成和回归验证（T-404E）
- [x] 锁定实验室/区域复用、环境阈值配置、采集快照和提醒查询边界（DES-ENVIRONMENT-MONITORING-001）
- [x] 锁定认证事件、既有审计表复用、服务端认证路由和 `audit.read` 查询边界（DES-AUDIT-LOGGING-001）
- [x] 锁定报告快照作为追溯事实源、report.read 权限和只读返回边界（DES-TRACEABILITY-001）
- [x] 锁定看板统计口径、筛选维度、分区权限和可替换聚合边界（DES-DASHBOARD-001）
- [x] 锁定数据库备份、恢复、Auth/Storage 边界、验证和回滚策略（DES-BACKUP-RECOVERY-001）
- [x] 锁定 P0 演示场景、合成数据目录、角色切换和验收证据边界（DES-DEMO-SCENARIO-001）
- [x] 锁定系统测试层级、AC 验收矩阵、负向场景和缺陷闭环规则（DES-SYSTEM-TEST-001）
- [x] 设计并实现 CSV/Excel 实验数据交换：服务端解析、行级校验、文件大小/数量边界、`FILE` 来源、页面入口、审计和正负向测试；正式项目 `test:data-import` 通过并自动清理（Spec：`FR-DATA-006`、`NFR-DATA-002`、`NFR-SEC-001～002`；Design：`DES-DATA-EXCHANGE-001`；Task：`T-601`）
- [x] 设计并实现模拟仪器数据接口：设备路径、任务/样品关联、`INSTRUMENT` 来源强制、ACTIVE 状态约束、不可变数据和审计；`T-602B1` 修复 `taskId` 路由字段与共享数据载荷边界后，正式项目正向/负向/审计/清理通过（Spec：`FR-DATA-009`、`NFR-DATA-002`、`NFR-SEC-001～002`；Design：`DES-SIMULATED-INSTRUMENT-001`；Task：`T-602`、`T-602B1`）
- [x] 设计并实现报告模板配置：JSON 模板资源、`REPORT_TEMPLATE_` 编码边界、设置审计和报告生成时快照；`T-603B1` 修复路径编码 PATCH 的部分更新边界后，正式项目 CRUD/审计/清理通过（Spec：`FR-SETTING-004`、`FR-REPORT-001～006`、`NFR-SEC-001～002`；Design：`DES-REPORT-TEMPLATE-001`；Task：`T-603`、`T-603B1`）
- [x] 设计并实现报告电子签名回执：发布后签署、SHA-256 快照完整性、签署人/时间、追加审计和外部 CA 边界；`T-604B1` 通过后续迁移显式限定 `extensions.digest`，正式项目签名/负向/审计/清理通过（Spec：`FR-REPORT-007`、`NFR-SEC-001～002`；Design：`DES-REPORT-SIGNATURE-001`；Task：`T-604`、`T-604B1`）
- [x] 完成真实仪器/环境传感器接口评估，确定连接器/边缘网关方向并保留当前模拟与文件导入边界（Spec：`FR-EQUIP-007`、`FR-ENV-006`；Research：`RES-REAL-INSTRUMENT-001`；Task：`T-605`）

## 5. MVP 收尾计划（2026-07-19）

本阶段不新增业务域，只收敛已实现能力的入口、初始化和文档一致性，使现有核心闭环可直接使用。

- [x] `T-606` 修复根入口和登录后跳转：`/` 按会话进入 `/login` 或 `/dashboard`，移除旧骨架占位内容；未认证入口 E2E 2/2 通过（Spec：`FR-AUTH-001～002`、`FR-DASH-001～005`；Design：`DES-MVP-CLOSEOUT-001`）。
- [x] `T-607` 增加受控的一次性首个 `SYSTEM_ADMIN` 初始化脚本：创建/复用 Auth 用户、补齐业务资料、幂等分配角色并写入审计；脚本、只读 dry-run、正式初始化和真实登录/权限入口验证均通过（Spec：`FR-AUTH-003～006`、`NFR-SEC-001～002`、`NFR-ENV-001～002`；Design：`DES-AUTH-001`、`DES-MVP-CLOSEOUT-001`）。
- [x] `T-608` 清理已实施设计中的旧状态、冲突导航和“下一步接入”文案；保留历史验收失败记录并标注当前结论（Spec：`NFR-DEV-001`；Design：`DES-MVP-CLOSEOUT-001`）。
- [x] `T-609` 执行 MVP 收尾验收：首个管理员、角色菜单、根入口、未认证保护、管理员创建普通用户、全量质量门禁和文档一致性均通过（Spec：`AC-AUTH-001`、`AC-DASH-001`、`AC-DEV-001`；Design：`DES-SYSTEM-TEST-001`、`DES-MVP-CLOSEOUT-001`）。

## 6. 工作台导航可用性优化计划（2026-07-19）

本阶段仅优化已实现工作台的导航信息架构和响应式交互，沿用既有权限判断和业务路由，不新增业务域或 API。

- [x] `T-610` [S] 固化工作台导航分组、入口裁剪、响应式布局和可访问性规则（Spec：`FR-AUTH-002`、`FR-DASH-001～005`、`NFR-USE-001`；Design：`DES-DASHBOARD-NAV-001`；Files：`specs/001-lims-core/design-dashboard-navigation.md`、`ui.md`、`traceability.md`）
- [x] `T-611` [P] 实现权限过滤的分组导航组件和当前路径状态（Depends：`T-610`；Files：`src/app/dashboard/page.tsx`、`src/components/dashboard/dashboard-navigation.tsx`；Verify：链接路由、权限可见性、`aria-current`、键盘焦点和多视口布局）
- [x] `T-612` [P] 补充工作台导航单元和受控浏览器验收（Depends：`T-611`；Files：`tests/unit/dashboard-navigation.test.ts`；Verify：导航路径匹配 2 个测试用例/4 个断言、未认证工作台保护回归、桌面/手机视口人工检查和 375px 无横向溢出）
- [x] `T-613` [S] 完成对抗性 UI 检查、构建和 Spec 门禁回填（Depends：`T-611`、`T-612`；Verify：lint、Vitest、TypeScript、build、Playwright、SDD consistency、差异检查）

## 7. 工作台导航二次视觉优化计划（2026-07-19）

本轮继续沿用 `DES-DASHBOARD-NAV-001`，只调整导航面板的视觉层级、密度和点击反馈，不改变权限、路由、数据接口或业务页面。

- [x] `T-614` [S] 根据实际页面反馈收敛导航面板层级、间距和入口状态样式（Spec：`FR-AUTH-002`、`FR-DASH-001～005`、`NFR-USE-001`；Design：`DES-DASHBOARD-NAV-001`；Files：`src/components/dashboard/dashboard-navigation.tsx`；Verify：普通项降低视觉噪声、当前项保持可辨识、链接点击区域不小于 44px）
- [ ] `T-615` [P] 补充导航结构/响应式回归验证并完成页面截图检查（Depends：`T-614`；Files：`tests/unit/dashboard-navigation.test.ts`、`tests/e2e/dashboard-access.spec.ts`；Verify：单元测试、lint、生产构建、未认证 E2E 18/18、375px 结构规则已通过；登录态截图仍待本地 Auth 503 修复）
- [ ] `T-616` [S] 完成二次视觉优化的对抗性检查、SDD 一致性回填和变更说明（Depends：`T-614`、`T-615`；Files：`specs/001-lims-core/*`、`CHANGELOG.md`；Verify：一致性检查、版本检查已通过；待 T-615 的登录态视觉验收完成）

## 4. 设计产物

- [x] 系统上下文图
- [x] 分层架构图
- [ ] 模块依赖图
- [x] 数据库 ER 图
- [x] 核心状态流转图
- [x] API 接口设计
- [x] 页面导航和原型清单
- [x] 部署结构图

详细设计文件：

- [architecture.md](architecture.md)：架构和技术决策
- [design-auth-admin.md](design-auth-admin.md)：用户与角色管理设计
- [design-settings.md](design-settings.md)：基础设置管理设计
- [design-report-template.md](design-report-template.md)：报告模板配置与快照设计
- [design-report-signature.md](design-report-signature.md)：报告电子签名与完整性回执设计
- [design-personnel.md](design-personnel.md)：实验室人员档案设计
- [design-task-registration.md](design-task-registration.md)：科研项目与实验任务登记设计
- [design-sample-registration.md](design-sample-registration.md)：样品登记与唯一编号设计
- [data-model.md](data-model.md)：字段、约束和索引
- [ui.md](ui.md)：页面导航和权限
- [api-contract.md](api-contract.md)：REST API 契约
- [contracts/openapi.yaml](contracts/openapi.yaml)：OpenAPI 契约初稿
- [design-dashboard-statistics.md](design-dashboard-statistics.md)：看板统计口径、权限和接口设计
- [design-dashboard-navigation.md](design-dashboard-navigation.md)：工作台导航分组、响应式布局和可访问性设计
- [design-backup-recovery.md](design-backup-recovery.md)：数据库备份、恢复、验证和回滚设计
- [design-demo-scenario.md](design-demo-scenario.md)：毕业设计演示场景、合成数据和 P0 验收证据设计
- [design-system-test.md](design-system-test.md)：系统测试层级、验收矩阵和缺陷闭环设计
