# 实验室信息管理系统 PRD（产品简报视图）

| 项目 | 内容 |
| --- | --- |
| 文档性质 | 产品简报视图，非功能需求事实源 |
| 当前状态 | 需求已完成第一轮确认 |
| 产品规格 | [specs/product.md](E:/Work%20Space/SchoolWork/specs/product.md) |
| 核心系统 Spec | [specs/001-lims-core/spec.md](E:/Work%20Space/SchoolWork/specs/001-lims-core/spec.md) |
| 更新时间 | 2026-07-11 |

> 本文档只保留产品层信息：为什么做、为谁做、目标和边界。功能需求、验收条件和非功能要求统一维护在核心 Spec 中，避免 PRD 与 Requirement 文档重复。

## 1. 产品概述

实验室信息管理系统（LIMS）面向高校科研实验室，用于统一管理实验项目、样品、实验任务、人员、设备、实验方法、试剂耗材、实验数据、审核记录和报告。

系统的核心价值是把分散的实验信息组织成可追踪的业务流程：

```text
实验需求 → 样品与任务 → 实验执行 → 数据处理 → 结果审核 → 报告与归档
```

## 2. 目标用户

- 系统管理员
- 实验室管理员
- 实验人员
- 项目负责人/教师

## 3. 产品目标

- 统一管理实验室业务数据和资源信息。
- 提高样品、任务、结果和报告之间的可追溯性。
- 支持实验结果审核和实验资料归档。
- 提供基础统计和实验室运行状态查看能力。

## 4. 产品边界

第一版为单个高校科研实验室的 Web 管理系统，优先完成样品—任务—数据—审核—报告主闭环。真实仪器硬件对接、外部企业系统集成、多租户和完整法规认证暂不作为基础交付要求。

## 5. 参考资料

- 项目根目录：`GBT+40343-2021.pdf`
- [GB/T 40343—2021 分析](E:/Work%20Space/SchoolWork/docs/kb/GB-T-40343-2021-%E6%99%BA%E8%83%BD%E5%AE%9E%E9%AA%8C%E5%AE%A4%E4%BF%A1%E6%81%AF%E7%AE%A1%E7%90%86%E7%B3%BB%E7%BB%9F%E5%8A%9F%E8%83%BD%E8%A6%81%E6%B1%82-%E5%88%86%E6%9E%90.md)
- [赛默飞世尔科技：LIMS 软件功能](https://www.thermofisher.cn/cn/zh/home/digital-solutions/lab-informatics/lab-information-management-systems-lims/features.html)

## 6. 维护规则

本文件只维护产品层变化。涉及具体功能、字段、权限、状态和验收条件时，应修改 [核心系统 Spec](E:/Work%20Space/SchoolWork/specs/001-lims-core/spec.md)，而不是在本文件新增一份功能清单。
