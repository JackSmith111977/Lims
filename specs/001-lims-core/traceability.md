# 核心系统需求追踪矩阵

| 参考依据 | Spec 需求 | 设计/实现方向 | 验收依据 |
| --- | --- | --- | --- |
| GB/T 40343—2021：任务登记 | `FR-TASK-001～002`、`FR-SAMPLE-001～003` | 项目、任务和样品登记 | `AC-SAMPLE-001`、`AC-TASK-001` |
| GB/T 40343—2021：任务分配 | `FR-TASK-003～009`、`FR-PER-001～004` | 人员档案、任务分配和状态流转 | `AC-TASK-001` |
| GB/T 40343—2021：数据获取 | `FR-DATA-001～005` | 手工录入、来源、时间和历史查询；[`design-experiment-data.md`](design-experiment-data.md) | T-302、T-306、`AC-DATA-001`、`test:data-integration` |
| GB/T 40343—2021：数据处理 | `FR-DATA-004`、`FR-DATA-007～008` | 原始/处理数据分离、版本化规则处理和异常；[`design-experiment-processing.md`](design-experiment-processing.md) | T-302、T-303、T-306、`AC-DATA-001`、`REV-EXPERIMENT-PROCESSING-001`、`test:processing-integration` |
| GB/T 40343—2021：数据审核 | `FR-REVIEW-001～006` | 审核、退回、补充和审核日志；[`design-result-review.md`](design-result-review.md) | T-304、T-306、`AC-REVIEW-001`、`REV-RESULT-REVIEW-001`、`test:review-integration` |
| GB/T 40343—2021：报告生成 | `FR-REPORT-001～006` | 报告快照、版本、状态、发布、归档和导出；[`design-reporting.md`](design-reporting.md) | T-305、T-306、`AC-REPORT-001`、`REV-REPORTING-001`、`test:report-integration` |
| GB/T 40343—2021：人员管理 | `FR-PER-001～004` | `sys_user` 扩展、岗位字典、技能/资质/培训记录和任务状态摘要；[`design-personnel.md`](design-personnel.md) | T-201 集成测试、提醒场景和 `REV-PERSONNEL-001` |
| GB/T 40343—2021：设备管理 | `FR-EQUIP-001～006` | 仪器设备档案、维护/维修/校准、状态、负责人、提醒和数据关联；[`design-instrument-registry.md`](design-instrument-registry.md)、[`design-instrument-maintenance.md`](design-instrument-maintenance.md) | T-401、T-402、T-406、`AC-RESOURCE-001`、`REV-INSTRUMENT-REGISTRY-001`、`REV-INSTRUMENT-MAINTENANCE-001`、`REV-RESOURCE-MANAGEMENT-001`、`test:instrument-integration`、`test:resource-integration`、`instrument-maintenance-validation.test.ts`、`instrument-access.spec.ts` |
| GB/T 40343—2021：试剂与耗材 | `FR-INVENTORY-001～004` | 试剂耗材主档、批号/厂家/有效期、库存余额和入库/领用/退库/报废变动；[`design-inventory-management.md`](design-inventory-management.md)、migration `202607160017` | T-403、T-406、`AC-RESOURCE-001`、`REV-INVENTORY-MANAGEMENT-001`、`REV-RESOURCE-MANAGEMENT-001`、`test:inventory-integration`、`test:resource-integration`、`inventory-validation.test.ts`、`inventory-access.spec.ts` |
| GB/T 40343—2021：库存提醒与资源关联 | `FR-INVENTORY-005～006` | 低库存/有效期实时提醒，以及 OUTBOUND 记录关联实验任务；[`design-inventory-alerts.md`](design-inventory-alerts.md)、migration `202607160018` | T-404、`AC-RESOURCE-001`、`REV-INVENTORY-ALERTS-001`、`test:inventory-alerts-integration`、`inventory-alert-validation.test.ts`、`inventory-access.spec.ts` |
| GB/T 40343—2021：样品管理 | `FR-SAMPLE-001～008` | 唯一编号、流转、处理和附件 | `AC-SAMPLE-001～002` |
| GB/T 40343—2021：方法管理 | `FR-METHOD-001～004` | 方法版本库、不可变版本引用、附件元数据和变更审计；[`design-method-versioning.md`](design-method-versioning.md) | T-301 集成测试、`REV-METHOD-VERSIONING-001` 和 `AC-DATA-001` |
| GB/T 40343—2021：设施和环境管理 | `FR-ENV-001～006` | 复用实验室/区域主档，维护环境阈值、采集记录和超阈值提醒；真实传感器接口预留；[`design-environment-monitoring.md`](design-environment-monitoring.md) | T-105B、T-405、`AC-RESOURCE-001`、`REV-ENVIRONMENT-MONITORING-001`、`test:environment-integration`、`environment-validation.test.ts`、`environment-access.spec.ts` |
| GB/T 40343—2021：用户管理和权限控制 | `FR-AUTH-001～007` | 认证、角色、权限和授权记录；[`design-auth-admin.md`](design-auth-admin.md) | `AC-AUTH-001`；`REV-AUTH-001` 正向/负向集成验收 |
| GB/T 40343—2021：基础设置 | `FR-SETTING-001～003` | 实验室、部门、实验组、通用分类、计量单位和系统参数；[`design-settings.md`](design-settings.md) | T-105B 集成测试和设置管理审查 |
| GB/T 40343—2021：任务登记 | `FR-TASK-001～002` | 科研项目、实验任务、有效方法引用和已有样品关联；[`design-task-registration.md`](design-task-registration.md) | T-202/T-206 集成测试和 `REV-TASK-REG-001` |
| GB/T 40343—2021：样品登记 | `FR-SAMPLE-001～003`、`AC-SAMPLE-001` | 样品基础字段、唯一编号、项目绑定和任务/方法关联；[`design-sample-registration.md`](design-sample-registration.md) | T-203/T-206 集成测试和 `REV-SAMPLE-REG-001` |
| GB/T 40343—2021：样品流转 | `FR-SAMPLE-004～006`、`AC-SAMPLE-002`、`BR-003`、`BR-005` | 样品状态机、物流事件、当前位置、事务流转和审计；[`design-sample-flow.md`](design-sample-flow.md) | T-204 集成测试和 `REV-SAMPLE-FLOW-001` |
| GB/T 40343—2021：任务分配与执行 | `FR-TASK-003～006`、`FR-TASK-008`、`FR-PER-002`、`FR-PER-004`、`BR-001～005` | 个人/实验组分配、任务状态机、状态历史、执行人权限和审计；[`design-task-flow.md`](design-task-flow.md) | T-205 集成测试和 `REV-TASK-FLOW-001` |
| GB/T 40343—2021：系统安全 | `FR-AUDIT-001～006`、`NFR-SEC-*` | 登录、退出、失败登录、关键业务审计、日志查询、备份、恢复和数据保护；[`design-audit-logging.md`](design-audit-logging.md)、[`design-traceability.md`](design-traceability.md)、[`design-backup-recovery.md`](design-backup-recovery.md) | T-501、T-502、T-504、`AC-AUDIT-001`、`AC-AUDIT-002`、`REV-AUDIT-LOGGING-001`、`REV-TRACEABILITY-001`、`REV-BACKUP-RECOVERY-001`、`test:auth-audit-integration`、`test:traceability-integration`、`check:backup-docs`、`audit-validation.test.ts`、`traceability-validation.test.ts`、`audit-access.spec.ts`、`traceability-access.spec.ts` |
| GB/T 40343—2021：数据看板与统计 | `FR-DASH-001～005`、`AC-DASH-001` | 样品/任务/审核/异常/设备/库存统计，项目/人员/状态/时间筛选和按分区权限返回；[`design-dashboard-statistics.md`](design-dashboard-statistics.md) | T-503、`REV-DASHBOARD-001`、`test:dashboard-integration`、`dashboard-validation.test.ts`、`dashboard-access.spec.ts` |
| GB/T 40343—2021：通信功能 | `FR-DATA-006`、`FR-DATA-009` | 文件交换和模拟接口 | 导入导出/接口测试 |
| 项目安全与可维护性 | `NFR-USE-001`、`NFR-SEC-001～002`、`NFR-MAINT-001～002` | 表单校验、权限、审计和分层设计 | 质量门禁与安全测试 |
| 数据完整性与恢复 | `NFR-DATA-001～003`、`NFR-PERF-001`、`NFR-BACKUP-001` | 唯一性、原始数据保护、演示规模稳定性和备份恢复 | 数据约束、恢复演练和回归测试 |
| 需求族覆盖 | `FR-AUTH-*`、`FR-PER-*`、`FR-SAMPLE-*`、`FR-TASK-*`、`FR-METHOD-*`、`FR-DATA-*`、`FR-REVIEW-*`、`FR-REPORT-*`、`FR-EQUIP-*`、`FR-INVENTORY-*`、`FR-ENV-*`、`FR-AUDIT-*`、`FR-DASH-*`、`FR-SETTING-*`、`NFR-*`、`BR-*`、`AC-*` | 族级需求由各模块行和测试目录覆盖 | 自动一致性检查 |
| 细分族覆盖 | `NFR-DATA-*`、`NFR-MAINT-*`、`AC-*` | 数据完整性、可维护性和验收场景 | 自动一致性检查 |
| 验收族覆盖 | `AC-SAMPLE-*`、`AC-DASH-*` | 样品流转和工作台统计验收 | 自动一致性检查 |

## 使用规则

- 新增需求先添加到 `spec.md`，再补充本表。
- 需求完成后补充对应的设计文件和测试用例路径。
- 发现设计、任务或代码与 Spec 不一致时，优先判断是否需要变更 Spec。
