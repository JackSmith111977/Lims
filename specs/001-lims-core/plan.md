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
- 报告生成、版本和归档

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
- [design-personnel.md](design-personnel.md)：实验室人员档案设计
- [design-task-registration.md](design-task-registration.md)：科研项目与实验任务登记设计
- [design-sample-registration.md](design-sample-registration.md)：样品登记与唯一编号设计
- [data-model.md](data-model.md)：字段、约束和索引
- [ui.md](ui.md)：页面导航和权限
- [api-contract.md](api-contract.md)：REST API 契约
- [contracts/openapi.yaml](contracts/openapi.yaml)：OpenAPI 契约初稿
