# 核心系统开发任务

| 项目 | 内容 |
| --- | --- |
| 来源 | `spec.md` 与 `plan.md` |
| 状态 | Draft |
| 说明 | 本文件是实现任务来源；毕业论文、答辩和整体进度仍记录在 `docs/task/` |

## 1. 基础分析与设计

- [x] T-001 建立需求 ID 与测试用例的追踪表（Spec：全部）
- [x] T-002 绘制系统上下文图（Spec：产品边界）
- [x] T-003 绘制用户用例图（Spec：角色与权限）
- [x] T-004 绘制样品—任务—数据—审核—报告业务流程图（Spec：BR-001～BR-005）
- [x] T-005 设计核心数据库 ER 图（Spec：数据模型要求）
- [x] T-006 确定技术栈和部署方式（Plan：技术决策待办）
- [x] T-007 完善数据库字段、约束和索引（Spec：数据模型要求）
- [x] T-008 设计页面导航和权限映射（Spec：用例与功能需求）
- [x] T-009 设计 REST API 和 OpenAPI 契约（Spec：全部 P0）
- [x] T-010 形成分层架构和模块边界（Spec：产品边界、NFR-MAINT-001）
- [x] T-011 确认实际依赖版本并建立项目骨架（Plan：技术决策）

## 2. 基础框架与权限

- [x] T-101 创建前后端项目基础结构（Spec：NFR-MAINT-001）
- [x] T-102 配置开发环境、依赖和测试框架（Spec：NFR-MAINT-001）
- [x] T-102A 建立 Supabase 数据库迁移和环境变量模板（Spec：数据模型要求、NFR-SEC-002）
- [x] T-102B 接入 Supabase CLI、迁移脚本和项目级只读 MCP 配置（Plan：技术决策）
- [x] T-102C 执行远程初始迁移并核验核心表（Spec：数据模型要求、NFR-DATA-001）
- [x] T-102D 从远程数据库生成并接入 TypeScript 类型（Spec：NFR-MAINT-001）
- [x] T-102E 建立版本管理、分支规约和发布检查（Plan：版本管理）
- [x] T-102F [S] 固化远程 Supabase、受控浏览器和开发准入规则（Spec：NFR-ENV-001～002、NFR-DEV-001、AC-ENV-001、AC-DEV-001；Files：`specs/README.md`、`specs/constitution.md`、`docs/sdd/README.md`、`docs/sdd/remote-supabase-workflow.md`、`plan.md`、`traceability.md`、`docs/testing/system-test-plan.md`；Verify：一致性、系统测试计划和版本门禁）
- [x] T-103A 完成登录页面、Supabase 客户端分层和 Auth 回调骨架（Spec：FR-AUTH-001）
- [x] T-103 实现用户登录和退出（Spec：FR-AUTH-001）
- [x] T-104A 实现登录态读取和 `/dashboard` 路由保护（Spec：FR-AUTH-002）
- [x] T-104 实现角色、权限和路由保护（Spec：FR-AUTH-002～005）
- [x] T-105 实现用户、角色和基础设置管理（Spec：FR-AUTH-003～004、FR-SETTING-001～003；T-105A、T-105B 子任务及 T-106 验证均完成）
  - [x] T-105A 实现用户与角色管理页面、API、授权 RPC 和审计记录（Spec：FR-AUTH-003～006、FR-AUTH-005、NFR-SEC-001～002；设计：DES-AUTH-001；正向用户创建、普通用户越权和停用用户负向集成验收已通过，临时测试数据已清理）
  - [x] T-105B 实现实验室、部门、基础分类和系统参数管理（Spec：FR-SETTING-001～003；设计：DES-SETTING-001；全量正向/未认证负向验收通过，临时数据已清理）
    - [x] T-105B1 [S] 实现组织结构数据模型、RLS、API 和审计（Spec：FR-SETTING-001；Depends：T-105A；Files：supabase/migrations、src/lib/server、src/app/api/v1/settings；实验室新增/查询/停用集成验收通过）
    - [x] T-105B2 [P] 实现通用分类、计量单位和系统参数数据模型与 API（Spec：FR-SETTING-002～003；Depends：T-105B1 契约；Files：supabase/migrations、src/lib/server、src/app/api/v1/settings；共享动态路由和类型校验已实现）
    - [x] T-105B3 [P] 实现基础设置页面和表单校验（Spec：FR-SETTING-001～003；Depends：T-105B1、T-105B2；Files：src/app/admin/settings、src/components/settings；页面和未认证负向 E2E 已通过）
    - [x] T-105B4 [S] 集成测试、对抗性审查和远程迁移验收（Spec：FR-SETTING-001～003、NFR-SEC-001～002；Depends：T-105B1～B3；全量设置资源新增/列表/停用通过）
- [x] T-106 编写登录、越权和用户状态测试（Spec：AC-AUTH-001、NFR-SEC-001；`npm.cmd run test:auth-audit-integration` 远程验证通过，成功/失败/停用登录、审计查询、越权、RLS 和退出审计均通过，`cleanupVerified` 为 0）

## 3. 样品与任务主流程

- [x] T-201 [S] 实现实验室人员档案（Spec：FR-PER-001～004；设计：DES-PERSONNEL-001；Depends：T-105B；Integration：T-205 复用任务状态摘要；REV-PERSONNEL-001 已关闭 P0/P1）
  - [x] T-201A [S] 锁定人员、岗位、技能、资质和培训数据契约（Files：specs/001-lims-core/design-personnel.md、data-model.md、api-contract.md、contracts/openapi.yaml）
  - [x] T-201B [S] 创建岗位和人员能力记录 migration、RLS、审计约束（Files：supabase/migrations、src/types/database.ts；Verify：远程迁移和 RLS 负向测试）
  - [x] T-201C [S] 实现人员档案与任务状态 API（Files：src/lib/server/personnel.ts、src/app/api/v1/personnel；Verify：API 单元/集成测试）
  - [x] T-201D [P] 实现人员列表/详情和能力记录界面（Files：src/app/personnel、src/components/personnel；Depends：T-201C；Verify：未认证 E2E、生产构建和真实会话路由渲染）
  - [x] T-201E [S] 完成集成测试、对抗性审查和一致性门禁（Depends：T-201B～D；Verify：全量质量门禁、临时数据清理；Review：REV-PERSONNEL-001）
- [x] T-202 [S] 实现科研项目和任务登记（Spec：FR-TASK-001～002；设计：DES-TASK-REGISTRATION-001；Depends：T-201；Integration：T-203/204/205 复用项目/任务契约；REV-TASK-REG-001 已关闭 P0/P1）
  - [x] T-202A [S] 锁定项目、任务、方法引用和样品关联边界（Files：specs/001-lims-core/design-task-registration.md、data-model.md、api-contract.md、contracts/openapi.yaml）
  - [x] T-202B [S] 扩展项目/任务审计权限并实现服务端校验（Files：supabase/migrations、src/lib/server/task-registration.ts；Verify：单元测试和数据库约束）
  - [x] T-202C [S] 实现项目与任务列表/详情/创建/修改 API（Files：src/app/api/v1/projects、src/app/api/v1/tasks；Verify：API 正负向集成）
  - [x] T-202D [P] 实现项目与任务登记页面和筛选交互（Files：src/app/projects、src/app/tasks、src/components/task-registration；Depends：T-202C；Verify：生产 build 和页面 E2E）
  - [x] T-202E [S] 完成集成测试、对抗性审查和一致性门禁（Depends：T-202B～D；Verify：远程临时夹具清理和全量质量门禁；Review：REV-TASK-REG-001）
- [x] T-203 [S] 实现样品登记和唯一编号（Spec：FR-SAMPLE-001～003、AC-SAMPLE-001；设计：DES-SAMPLE-REGISTRATION-001；Depends：T-202；Integration：T-204/206 复用样品关联契约；REV-SAMPLE-REG-001 已关闭 P0/P1）
  - [x] T-203A [S] 锁定样品字段、编号生成和任务/方法关联边界（Files：specs/001-lims-core/design-sample-registration.md、data-model.md、api-contract.md、contracts/openapi.yaml）
  - [x] T-203B [S] 实现样品登记服务、编号唯一性、关联校验、RLS 审计支持（Files：supabase/migrations、src/lib/server/sample-registration.ts；Verify：单元测试和数据库约束）
  - [x] T-203C [S] 实现样品列表/详情/创建/修改 API（Files：src/app/api/v1/samples；Verify：API 正负向集成）
  - [x] T-203D [P] 实现样品登记页面和筛选交互（Files：src/app/samples、src/components/sample-registration；Depends：T-203C；Verify：生产 build 和未认证 E2E）
  - [x] T-203E [S] 完成集成测试、对抗性审查和一致性门禁（Depends：T-203B～D；Verify：远程临时夹具清理和全量质量门禁；Review：REV-SAMPLE-REG-001）
- [x] T-204 [S] 实现样品状态和流转记录（Spec：FR-SAMPLE-004～006、AC-SAMPLE-002；设计：DES-SAMPLE-FLOW-001；Depends：T-203；Integration：T-206 复用样品流转查询；REV-SAMPLE-FLOW-001 已关闭 P0/P1）
  - [x] T-204A [S] 锁定样品状态机、物流事件、事务边界和流转 API（Files：`specs/001-lims-core/design-sample-flow.md`、`data-model.md`、`api-contract.md`、`ui.md`、`plan.md`）
  - [x] T-204B [S] 实现 `sample_flow` 读取策略和事务状态流转 RPC（Files：`supabase/migrations`、`src/types/database.ts`；Verify：迁移、RLS 负向和状态约束）
  - [x] T-204C [S] 实现流转服务和样品流转 API（Files：`src/lib/server/sample-registration.ts`、`src/app/api/v1/samples/[id]/flows`；Verify：节点/状态/交接人校验和远程集成）
  - [x] T-204D [P] 实现样品详情当前位置、流转时间线和流转登记表单（Files：`src/components/sample-registration`、`src/app/samples`；Depends：T-204C；Verify：生产构建和未认证 E2E）
  - [x] T-204E [S] 完成集成测试、对抗性审查和一致性门禁（Depends：T-204B～D；Verify：远程临时数据清理、全量质量门禁；Review：`REV-SAMPLE-FLOW-001`）
- [x] T-205 [S] 实现任务分配和任务状态流转（Spec：FR-TASK-003～006、FR-TASK-008、FR-PER-002、FR-PER-004、BR-001～005；设计：DES-TASK-FLOW-001；Depends：T-202、T-201；Integration：T-206 复用任务状态与分配查询）
  - [x] T-205A [S] 锁定个人/实验组分配、状态机、事务边界和 API（Files：`specs/001-lims-core/design-task-flow.md`、`data-model.md`、`api-contract.md`、`plan.md`）
  - [x] T-205B [S] 实现组分配历史、状态保护触发器和事务 RPC（Files：`supabase/migrations`、`src/types/database.ts`；Verify：迁移、RLS 负向和状态约束）
  - [x] T-205C [S] 实现任务分配、状态流转和状态历史 API（Files：`src/lib/server/task-flow.ts`、`src/app/api/v1/tasks/[id]/assignments`、`transition`、`history`；Verify：服务端校验和远程集成）
  - [x] T-205D [P] 实现任务详情的分配、状态操作和历史时间线（Files：`src/components/task-registration`、`src/app/tasks`；Depends：T-205C；Verify：生产构建和未认证 E2E）
  - [x] T-205E [S] 完成集成测试、对抗性审查和一致性门禁（Depends：T-205B～D；Verify：远程临时数据清理、全量质量门禁；Review：`REV-TASK-FLOW-001`）
- [x] T-206 编写样品和任务主流程测试（Spec：AC-SAMPLE-001～002、AC-TASK-001；Files：`scripts/integration/sample-task-main-flow.mjs`、`package.json`；Verify：`npm run test:integration` 远程临时夹具自动清理）

## 4. 数据、审核与报告

- [x] T-301 [S] 实现实验方法和版本管理（Spec：FR-METHOD-001～004；设计：DES-METHOD-VERSIONING-001；Depends：T-202；Integration：T-302 复用方法版本）
- [x] T-301A [S] 锁定方法版本、历史、附件和权限边界（Files：`specs/001-lims-core/design-method-versioning.md`、`data-model.md`、`api-contract.md`、`contracts/openapi.yaml`、`plan.md`）
  - [x] T-301B [S] 实现方法历史、版本身份保护、附件 RLS 和审计触发器（Files：`supabase/migrations`、`src/types/database.ts`；Verify：迁移、RLS 负向和唯一版本约束）
- [x] T-301C [S] 实现方法版本服务和 API（Spec：FR-METHOD-001～004；Files：`src/lib/server/methods.ts`、`src/app/api/v1/methods`；Verify：字段校验、状态变更和重复版本测试）
- [x] T-301D [P] 实现方法库页面、历史时间线、附件登记和任务方法版本选择（Spec：FR-METHOD-001～004、FR-TASK-002；Files：`src/app/methods`、`src/components/methods`、`src/app/tasks`、`src/components/task-registration`；Depends：T-301C；Verify：生产构建和未认证 E2E）
  - [x] T-301E [S] 完成远程集成、对抗性审查和一致性门禁（Depends：T-301B～D；Verify：临时账号/数据自动清理、全量质量门禁；Review：`REV-METHOD-VERSIONING-001`）
- [x] T-302 [S] 实现实验原始数据和结果录入（Spec：FR-DATA-001～005、AC-DATA-001；设计：DES-EXPERIMENT-DATA-001；Depends：T-301）
  - [x] T-302A [S] 锁定原始/处理/结果数据模型、追溯关系、权限和不可变边界（Files：`specs/001-lims-core/design-experiment-data.md`、`data-model.md`、`api-contract.md`、`contracts/openapi.yaml`、`plan.md`）
  - [x] T-302B [S] 实现数据类型约束、值字段约束、插入 RLS 和审计权限迁移（Files：`supabase/migrations`、`src/types/database.ts`；Verify：RLS 负向、状态锁定和约束）
  - [x] T-302C [S] 实现实验数据查询和录入服务/API（Spec：FR-DATA-001～005；Files：`src/lib/server/experiment-data.ts`、`src/app/api/v1/tasks/[id]/data`；Verify：字段校验、任务/样品/方法/设备关联）
  - [x] T-302D [P] 实现数据录入和历史查询页面（Spec：FR-DATA-001～005、AC-DATA-001；Files：`src/app/data`、`src/components/experiment-data`、`src/app/dashboard/page.tsx`；Depends：T-302C；Verify：生产构建和未认证 E2E）
  - [x] T-302E [S] 完成远程集成、对抗性审查和一致性门禁（Depends：T-302B～D；Verify：临时数据自动清理、全量质量门禁；Review：`REV-EXPERIMENT-DATA-001`）
- [x] T-303 [S] 实现数据处理、规则判定或模拟处理（Spec：FR-DATA-007～008；设计：DES-EXPERIMENT-PROCESSING-001；Depends：T-302）
- [x] T-303A [S] 锁定规则版本、处理运行、结果判定、异常和数据血缘模型（Files：`specs/001-lims-core/design-experiment-processing.md`、`data-model.md`、`api-contract.md`、`contracts/openapi.yaml`、`plan.md`；Verify：设计覆盖规则不可变、运行终态、输出血缘、权限、审计和失败补偿；明确排除 FR-DATA-006/009）
  - [x] T-303B [S] 实现规则/运行/血缘约束、RLS、审计和失败补偿迁移（Files：`supabase/migrations`；Verify：规则版本不可变、原始数据不变、异常可追溯；远程落地验证汇总至 T-303E）
  - [x] T-303C [S] 实现规则处理服务/API 和模拟处理结果生成（Files：`src/lib/server/experiment-processing.ts`、`src/app/api/v1/tasks/[id]/data/process`；Verify：修约、阈值判定、失败路径；服务层与事务 RPC 双重校验）
  - [x] T-303D [P] 实现处理规则选择、运行结果和异常说明页面（Files：`src/app/data`、`src/components/experiment-data`；Depends：T-303C；Verify：生产构建和未认证 E2E；远程落地验证汇总至 T-303E）
  - [x] T-303E [S] 完成远程集成、对抗性审查和一致性门禁（Depends：T-303B～D；Verify：临时数据自动清理、全量质量门禁；Review：`REV-EXPERIMENT-PROCESSING-001`；远程迁移 `202607150012` 已应用，集成测试和清理计数均通过）
- [x] T-304 实现结果审核、退回和审核意见（Spec：FR-REVIEW-001～006；设计：DES-RESULT-REVIEW-001；Depends：T-303）
  - [x] T-304A [S] 锁定审核记录、三类结果、任务状态事务、权限和审计边界（Files：`specs/001-lims-core/design-result-review.md`、`data-model.md`、`api-contract.md`、`contracts/openapi.yaml`、`plan.md`；Verify：审核追加、非通过意见、并发和状态映射）
  - [x] T-304B [S] 实现审核记录约束、RLS、不可变触发器和审核事务迁移（Files：`supabase/migrations`、`src/types/database.ts`；Verify：三类结果、任务锁、直接写入拒绝、任务历史和审计；远程迁移 `202607150013` 已应用）
  - [x] T-304C [S] 实现审核服务/API 和错误模型（Files：`src/lib/server/result-review.ts`、`src/app/api/v1/tasks/[id]/reviews`；Verify：字段校验、权限、状态冲突和事务响应）
  - [x] T-304D [P] 实现待审核列表、结果上下文和审核操作页面（Files：`src/app/reviews`、`src/components/result-review`、`src/app/dashboard/page.tsx`；Depends：T-304C；Verify：生产构建、未认证 E2E 和提交后刷新；E2E 9/9）
  - [x] T-304E [S] 完成远程集成、对抗性审查和一致性门禁（Depends：T-304B～D；Verify：临时账号/数据清理、全量质量门禁；Review：`REV-RESULT-REVIEW-001`；集成检查、清理计数和远程迁移核对均通过）
- [x] T-305 实现报告生成、状态和版本（Spec：FR-REPORT-001～006；设计：DES-REPORTING-001）
  - [x] T-305A [S] 锁定报告快照、版本状态机、权限、导出和审计边界（Files：`specs/001-lims-core/design-reporting.md`、`data-model.md`、`api-contract.md`、`contracts/openapi.yaml`、`plan.md`；Verify：设计覆盖只允许审核通过任务生成、版本递增、发布归档和不可变快照）
  - [x] T-305B [S] 实现报告快照、版本/状态约束、历史、RLS 和事务函数迁移（Files：`supabase/migrations`、`src/types/database.ts`；Verify：越权、并发、直接写入和状态机负向测试；远程迁移 `202607150014` 已应用）
  - [x] T-305C [S] 实现报告服务/API、列表详情和 JSON 导出（Files：`src/lib/server/reporting.ts`、`src/app/api/v1/tasks/[id]/reports`、`src/app/api/v1/reports`；Verify：字段校验、快照一致性、版本递增和错误模型）
  - [x] T-305D [P] 实现报告列表、详情、状态操作和导出页面（Files：`src/app/reports`、`src/components/reporting`、`src/app/dashboard/page.tsx`；Depends：T-305C；Verify：生产构建、未认证 E2E 和状态刷新；E2E 10/10）
  - [x] T-305E [S] 完成远程集成、对抗性审查和一致性门禁（Depends：T-305B～D；Verify：临时账号/数据清理、全量质量门禁；Review：`REV-REPORTING-001`；集成检查、清理计数和远程迁移核对均通过）
- [x] T-306 编写数据、审核和报告测试（Spec：AC-DATA-001、AC-REVIEW-001、AC-REPORT-001）
  - [x] T-306A [S] 完成数据、处理、审核和报告的单元校验、未认证 E2E 及 OpenAPI/一致性门禁测试（Files：`tests/unit`、`tests/e2e`、`scripts/sdd`；Verify：42 个单元测试、E2E 10/10）
  - [x] T-306B [S] 完成 Supabase 远程数据/审核/报告回归和临时资源清理验证（Files：`scripts/integration`；Verify：`test:data-integration`、`test:processing-integration`、`test:review-integration`、`test:report-integration` 全部通过）

## 5. 实验室资源

- [x] T-401 实现仪器设备档案（Spec：FR-EQUIP-001～003；设计：DES-INSTRUMENT-REGISTRY-001）
  - [x] T-401A [S] 锁定设备档案字段、状态终态、权限、数据关联和 T-402 边界（Files：`specs/001-lims-core/design-instrument-registry.md`、`data-model.md`、`api-contract.md`、`contracts/openapi.yaml`、`plan.md`；Verify：设计覆盖 SCRAPPED 终态、直接写入拒绝和审计）
  - [x] T-401B [S] 实现设备字段约束、状态保护、RLS 和事务 RPC（Files：`supabase/migrations`、`src/types/database.ts`；Verify：编号唯一、负责人、状态负向和审计；远程迁移 `202607150015` 已应用）
  - [x] T-401C [S] 实现设备服务/API 和关联摘要（Files：`src/lib/server/instruments.ts`、`src/app/api/v1/instruments`；Verify：字段校验、查询过滤和报废边界）
  - [x] T-401D [P] 实现设备档案列表、详情和状态维护页面（Files：`src/app/instruments`、`src/components/instruments`、`src/app/dashboard/page.tsx`；Depends：T-401C；Verify：生产构建和未认证 E2E；E2E 11/11）
  - [x] T-401E [S] 完成远程集成、对抗性审查和一致性门禁（Depends：T-401B～D；Verify：临时账号/数据清理、全量质量门禁；Review：`REV-INSTRUMENT-REGISTRY-001`；集成检查、清理计数和远程迁移核对均通过）
- [x] T-402 实现维护和校准记录（Spec：FR-EQUIP-004～006；设计：DES-INSTRUMENT-MAINTENANCE-001）
  - [x] T-402A [S] 锁定追加事件、校准周期、到期提醒、权限和设备同步边界（Files：`specs/001-lims-core/design-instrument-maintenance.md`、`data-model.md`、`api-contract.md`、`contracts/openapi.yaml`、`plan.md`；Verify：设计覆盖报废设备、直接写入和校准日期一致性）
  - [x] T-402B [S] 实现维护/校准字段约束、追加 RLS、提醒查询和事务 RPC（Files：`supabase/migrations`、`src/types/database.ts`；Verify：事件不可变、周期校验、设备日期同步和审计）
  - [x] T-402C [S] 实现维护服务/API（Files：`src/lib/server/instrument-maintenance.ts`、`src/app/api/v1/instruments/[id]/maintenance`；Verify：字段校验、历史查询、到期提醒和权限）
  - [x] T-402D [P] 实现设备维护/校准历史和提醒页面（Files：`src/components/instruments`、`src/app/instruments`；Depends：T-402C；Verify：生产构建和未认证 E2E）
  - [x] T-402E [S] 完成远程集成、对抗性审查和一致性门禁（Depends：T-402B～D；Verify：临时账号/数据清理、全量质量门禁；Review：`REV-INSTRUMENT-MAINTENANCE-001`）
- [x] T-403 实现试剂耗材和库存变动（Spec：FR-INVENTORY-001～004；设计：DES-INVENTORY-MANAGEMENT-001）
  - [x] T-403A [S] 锁定主档字段、余额投影、变动方向、权限和 T-404 边界（Files：`specs/001-lims-core/design-inventory-management.md`、`data-model.md`、`api-contract.md`、`plan.md`；Verify：设计明确不允许直接改余额，且覆盖入库/领用/退库/报废）
  - [x] T-403B [S] 实现库存字段约束、追加 RLS、余额事务 RPC 和审计（Files：`supabase/migrations`、`src/types/database.ts`；Verify：并发余额、库存不足、不可变明细和直接写入拒绝）
  - [x] T-403C [S] 实现库存服务/API（Files：`src/lib/server/inventory.ts`、`src/app/api/v1/inventory`；Verify：字段校验、主档查询、变动历史和权限）
  - [x] T-403D [P] 实现试剂耗材主档和变动页面（Files：`src/components/inventory`、`src/app/inventory`；Depends：T-403C；Verify：生产构建和未认证 E2E）
  - [x] T-403E [S] 完成远程集成、对抗性审查和一致性门禁（Depends：T-403B～D；Verify：临时账号/数据清理、全量质量门禁；Review：`REV-INVENTORY-MANAGEMENT-001`）
- [x] T-404 实现库存和有效期提醒（Spec：FR-INVENTORY-005～006；设计：DES-INVENTORY-ALERTS-001）
  - [x] T-404A [S] 锁定低库存阈值、有效期窗口、提醒视图和 OUTBOUND-任务关联边界（Files：`specs/001-lims-core/design-inventory-alerts.md`、`data-model.md`、`api-contract.md`、`plan.md`；Verify：明确停用排除、过期包含和任务状态边界）
  - [x] T-404B [S] 实现提醒字段、提醒查询 RPC、任务关联校验和审计扩展（Files：`supabase/migrations`、`src/types/database.ts`；Verify：窗口边界、任务权限、并发扣减和直接写入拒绝）
  - [x] T-404C [S] 实现提醒/阈值/任务关联服务与 API（Files：`src/lib/server/inventory.ts`、`src/app/api/v1/inventory`；Verify：提醒排序、字段校验和权限）
  - [x] T-404D [P] 实现提醒摘要和任务关联交互页面（Files：`src/components/inventory`、`src/app/inventory`；Depends：T-404C；Verify：生产构建和未认证 E2E）
  - [x] T-404E [S] 完成远程集成、对抗性审查和一致性门禁（Depends：T-404B～D；Verify：临时账号/任务/库存清理、全量质量门禁；Review：`REV-INVENTORY-ALERTS-001`）
- [x] T-405 实现设施、环境记录和阈值提醒（Spec：FR-ENV-001～005）
  - [x] T-405A [S] 锁定基础设施复用、阈值配置、环境记录快照和提醒边界（Files：`specs/001-lims-core/design-environment-monitoring.md`、`data-model.md`、`api-contract.md`、`plan.md`；Verify：明确复用实验室/区域主档且不接入真实传感器）
  - [x] T-405B [S] 实现阈值配置、不可变环境记录、状态计算和审计 RPC（Files：`supabase/migrations`、`src/types/database.ts`；Verify：边界值、停用实验室、直接写入拒绝和快照一致性）
  - [x] T-405C [S] 实现环境阈值/记录/提醒服务与 API（Files：`src/lib/server/environment.ts`、`src/app/api/v1/environment`；Verify：过滤、提醒排序、字段校验和权限）
  - [x] T-405D [P] 实现实验室环境记录和提醒页面（Files：`src/components/environment`、`src/app/environment`；Depends：T-405C；Verify：生产构建和未认证 E2E）
  - [x] T-405E [S] 完成远程集成、对抗性审查和一致性门禁（Depends：T-405B～D；Verify：临时实验室/阈值/记录清理、全量质量门禁；Review：`REV-ENVIRONMENT-MONITORING-001`）
- [x] T-406 编写资源管理测试（Spec：AC-RESOURCE-001；Verify：`npm run test:resource-integration` 串行执行设备和试剂耗材远程验收，并自动清理临时资源；Review：`REV-RESOURCE-MANAGEMENT-001`）

## 6. 追溯、统计与交付

- [x] T-501 实现认证和关键业务操作日志（Spec：FR-AUDIT-001～004）
  - [x] T-501A [S] 锁定认证事件、既有审计表复用、服务端写入和 `audit.read` 查询边界（Files：`specs/001-lims-core/design-audit-logging.md`、`plan.md`；Verify：不记录密码/令牌且登录失败可追踪）
  - [x] T-501B [S] 实现认证审计适配器和登录/退出 Route Handler（Files：`src/lib/server/audit.ts`、`src/app/api/v1/auth`；Verify：成功、失败、停用拦截、退出和审计写入失败）
  - [x] T-501C [S] 实现日志查询服务和 `audit.read` API（Files：`src/lib/server/audit-data.ts`、`src/app/api/v1/audit-logs`；Verify：过滤、排序、分页上限和越权）
  - [x] T-501D [P] 实现日志查询页面并接入登录/退出交互（Files：`src/app/admin/audit`、`src/components/admin`、`src/app/login`、`src/components/auth`；Depends：T-501B～C；Verify：无敏感字段展示、未认证 E2E）
  - [x] T-501E [S] 完成远程审计集成、对抗性审查和一致性门禁（Depends：T-501B～D；Verify：认证事件/查询权限/临时清理/全量质量门禁；Review：`REV-AUDIT-LOGGING-001`）
- [x] T-502 实现报告到样品、任务、数据和审核的追溯（Spec：FR-AUDIT-005、AC-AUDIT-001）
  - [x] T-502A [S] 锁定报告不可变快照、追溯返回模型和 `report.read` 权限边界（Files：`specs/001-lims-core/design-traceability.md`、`plan.md`）
  - [x] T-502B [S] 实现报告追溯查询服务和 Route Handler（Files：`src/lib/server/traceability.ts`、`src/app/api/v1/trace`；Verify：报告、任务、样品、数据、审核节点只读返回）
  - [x] T-502C [P] 实现报告页追溯入口和只读追溯页面（Files：`src/components/reporting`、`src/app/reports/trace`；Depends：T-502B；Verify：节点完整、无编辑入口）
  - [x] T-502D [S] 完成追溯单元/E2E/远程集成、对抗性审查和质量门禁（Depends：T-502B～C；Review：`REV-TRACEABILITY-001`）
- [x] T-503 实现样品、任务、审核和库存统计（Spec：FR-DASH-001～005；设计：DES-DASHBOARD-001）
  - [x] T-503A [S] 锁定统计口径、筛选参数、分区权限和窄接口边界（Files：`specs/001-lims-core/design-dashboard-statistics.md`、`plan.md`、`traceability.md`；Verify：设计覆盖样品/任务/审核/异常/设备/库存及失败降级）
  - [x] T-503B [S] 实现看板统计服务、权限分区和 API 契约（Files：`src/lib/server/dashboard.ts`、`src/app/api/v1/dashboard`、`specs/001-lims-core/api-contract.md`、`specs/001-lims-core/contracts/openapi.yaml`；Verify：参数校验、RLS 边界、稳定聚合和窄接口一致性；本地类型检查、Lint、单元测试、构建和未认证接口 E2E 已通过）
  - [x] T-503C [P] 实现工作台统计卡片、筛选和待审核/异常/库存摘要（Files：`src/components/dashboard`、`src/app/dashboard/page.tsx`；Depends：T-503B；Verify：登录页面渲染、筛选刷新和无权限分区隐藏；全量未认证 Playwright E2E 17/17 已通过）
  - [x] T-503D [S] 完成单元/E2E/远程集成、对抗性审查和一致性门禁（Depends：T-503B～C；Files：`scripts/integration/experiment-processing.mjs`、`scripts/integration/cleanup-experiment-processing.sql`；Verify：临时数据自动清理、全量质量门禁；Review：`REV-DASHBOARD-001`）
- [x] T-504 编写数据库备份和恢复说明（Spec：FR-AUDIT-006、NFR-BACKUP-001、AC-AUDIT-002；设计：DES-BACKUP-RECOVERY-001）
  - [x] T-504A [S] 锁定托管备份、逻辑备份、Auth/Storage 边界和 RPO/RTO 口径（Files：`specs/001-lims-core/design-backup-recovery.md`、`plan.md`；Verify：覆盖 Supabase 计划差异、密钥处理和恢复路径）
  - [x] T-504B [S] 编写数据库备份、恢复、验证、回滚和演练说明（Files：`docs/ops/backup-recovery.md`；Verify：操作步骤、故障降级、敏感信息和完整性检查清单）
  - [x] T-504C [S] 完成文档完整性检查、对抗性审查和一致性门禁（Files：`scripts/sdd/check-backup-recovery.ps1`、`package.json`、`traceability.md`；Verify：文档检查、CLI 能力检查、SDD 一致性和版本门禁；Review：`REV-BACKUP-RECOVERY-001`）
- [ ] T-505 准备演示数据和演示流程（Spec：所有 P0；设计：DES-DEMO-SCENARIO-001）
  - [x] T-505A [S] 锁定合成数据目录、角色切换、P0 覆盖和清理边界（Files：`specs/001-lims-core/design-demo-scenario.md`、`docs/demo/demo-data-catalog.json`；Verify：不含真实数据/凭据，所有 P0 有对应演示实体）
  - [x] T-505B [S] 编写逐页演示流程和验收证据清单（Files：`docs/demo/demo-runbook.md`；Verify：覆盖登录、设置、项目、样品、任务、数据、审核、报告、追溯、看板和审计）
  - [x] T-505C1 [S] 建立演示环境前置检查和生产项目保护（Spec：NFR-ENV-001～002、AC-ENV-001；Files：`docs/demo/demo-environment.json`、`scripts/integration/demo-preflight.mjs`、`tests/unit/demo-preflight.test.ts`；Verify：读取 Next.js 实际环境文件，阻止未批准/非隔离/生产项目或 URL 混用，校验项目 URL 和占位账号）
  - [x] T-505C2 [S] 确认 SchoolWork 为本项目规范远程数据库（Spec：NFR-ENV-001～002；Files：`spec.md`、`plan.md`、`remote-supabase-workflow.md`、`demo-environment.json`；Verify：project ref、正式数据源角色和演示隔离边界均有记录）
  - [x] T-505C3 [S] 创建并初始化隔离演示项目 `test`（Spec：NFR-ENV-001、AC-ENV-001；Files：`demo-environment.json`、`demo-initialization-evidence.md`；Verify：23 个迁移文件通过受控 Dashboard SQL Editor 执行，41 张表/45 个函数/58 条 RLS policy 的只读核验通过）
  - [ ] T-505C [S] 在隔离环境生成演示数据并完成全链路演练和清理（Depends：T-503D、T-505A～C；Files：`scripts/integration/demo-seed.sql`、`scripts/integration/demo-cleanup.sql`、`docs/demo/demo-initialization-evidence.md`；Verify：种子只读统计、P0 流程、截图/编号证据、演练后 `DEMO_` 残留为 0；Review：`REV-DEMO-001`）
- [ ] T-506 完成系统测试和缺陷修复（Spec：所有 AC）
  - [x] T-506A [S] 建立系统测试策略、AC 验收矩阵和缺陷记录（Files：`specs/001-lims-core/design-system-test.md`、`docs/testing/system-test-plan.md`、`docs/testing/defect-log.md`；Verify：每个 AC 有证据/复测入口，区分环境门禁和产品缺陷）
  - [x] T-506B [S] 完成测试计划完整性检查和对抗性审查（Files：`scripts/sdd/check-system-test-plan.ps1`、`package.json`、`traceability.md`；Verify：AC 覆盖、负向场景、敏感信息检查；Review：`REV-SYSTEM-TEST-001`）
  - [ ] T-506C [S] 执行全量系统测试、关闭缺陷并形成测试报告（Depends：T-503D、T-505C、T-506A～B；Verify：所有 AC、P0/P1 缺陷、远程清理和回归门禁通过）

## 7. 扩展任务

- [ ] T-601 实现 CSV/Excel 数据交换（Spec：FR-DATA-006）
- [ ] T-602 实现模拟仪器数据接口（Spec：FR-DATA-009）
- [ ] T-603 实现报告模板配置（Spec：FR-SETTING-004）
- [ ] T-604 实现电子签名或正式签署流程（Spec：FR-REPORT-007）
- [ ] T-605 评估真实仪器或传感器接口（Spec：FR-EQUIP-007、FR-ENV-006）
