# 项目 Spec 系统

本目录是实验室信息管理系统的规范驱动开发入口。

## 唯一事实源

当前系统需求的唯一事实源是：

[001-lims-core/spec.md](E:/Work%20Space/SchoolWork/specs/001-lims-core/spec.md)

如果产品简报、需求规格视图、计划、任务或代码与该文件不一致，先以 Spec 为准，再通过变更流程修正其他产物。

## 工作流

```text
Spec → Plan → Tasks → Implement → Verify
```

- `Spec`：定义系统要做什么以及如何验收。
- `Plan`：定义采用什么技术和顺序实现。
- `Tasks`：定义可执行的开发任务。
- `Implement`：实现代码、测试和文档。
- `Verify`：根据需求 ID 验证结果并更新状态。

完整 SDD 流程、模板、质量门禁、并行规则、对抗性审查、版本管理和一致性检查见：[docs/sdd/README.md](E:/Work%20Space/SchoolWork/docs/sdd/README.md)。

## 开发准入

开始任何需求、设计或编码工作前，必须读取本文件、[核心系统 Spec](E:/Work%20Space/SchoolWork/specs/001-lims-core/spec.md)、相关 Plan/Design/Tasks 和 [SDD 流程](E:/Work%20Space/SchoolWork/docs/sdd/README.md)，并使用需求或验收 ID 追踪变更。

本项目的开发、联调、迁移验证、演示和验收直接使用经授权的远程 Supabase 项目，不要求本地数据库。Supabase Dashboard 的人工远程操作通过受控浏览器执行；CLI/API 只在可重复自动化、范围明确且保留证据时使用。具体步骤见：[远程 Supabase 工作流](E:/Work%20Space/SchoolWork/docs/sdd/remote-supabase-workflow.md)。

## 目录说明

- [constitution.md](E:/Work%20Space/SchoolWork/specs/constitution.md)：Spec 治理原则。
- [product.md](E:/Work%20Space/SchoolWork/specs/product.md)：产品级信息，不重复功能需求。
- [001-lims-core/spec.md](E:/Work%20Space/SchoolWork/specs/001-lims-core/spec.md)：核心系统唯一需求事实源。
- [001-lims-core/plan.md](E:/Work%20Space/SchoolWork/specs/001-lims-core/plan.md)：从 Spec 派生的技术计划。
- [001-lims-core/tasks.md](E:/Work%20Space/SchoolWork/specs/001-lims-core/tasks.md)：从 Plan 和 Spec 派生的开发任务。
- [001-lims-core/traceability.md](E:/Work%20Space/SchoolWork/specs/001-lims-core/traceability.md)：需求追踪矩阵。

## 与 docs 的关系

`docs/` 用于论文、阅读和知识沉淀：

- `docs/prd/` 是产品简报视图。
- `docs/requirements/` 是需求规格视图。
- `docs/task/` 是毕业设计宏观阶段计划。
- `docs/kb/` 是参考资料和方法知识库。

这些目录不再维护与 `spec.md` 重复的功能需求正文。
