# Spec 系统方法与项目文档治理方案

## 1. 调研结论

### 1.1 ISO/IEC/IEEE 29148 的启发

ISO/IEC/IEEE 29148:2018 面向系统和软件的需求工程，关注需求工程过程、需求相关信息项以及这些信息项应包含的内容和格式。它强调需求不是随意的说明文字，而是需要经过获取、分析、记录、验证和管理的工程成果。

本项目采用其中适合毕业设计的部分原则：

- 区分产品目标、用户需求和系统需求。
- 使用唯一编号管理需求。
- 为需求提供验证或验收依据。
- 记录需求之间的来源和追踪关系。
- 需求变更后同步更新相关计划、任务和测试依据。

参考：[ISO/IEC/IEEE 29148:2018](https://www.iso.org/standard/72089.html)

### 1.2 Spec-Driven Development 的启发

GitHub Spec Kit 将规范驱动开发组织为：

```text
Spec → Plan → Tasks → Implement
```

其中 Spec 描述要构建什么以及必须满足什么行为，Plan 描述如何实现，Tasks 将计划拆成可执行工作，Implement 才进入代码实现。该方法的关键点是规格作为源头，计划和任务是从规格派生的产物。

参考：

- [GitHub Spec Kit：Specification-Driven Development](https://github.com/github/spec-kit/blob/main/spec-driven.md)
- [GitHub Spec Kit：官方概览](https://github.github.io/spec-kit/)
- [GitHub Spec Kit：规格持久化模型](https://github.github.com/spec-kit/concepts/spec-persistence.html)

## 2. 本项目采用的方案

本项目采用“轻量级 SDD + 需求工程管理”的方案，不立即安装外部 CLI，而是在仓库中用 Markdown 建立可追踪的 Spec 目录。原因是当前项目处于需求和设计阶段，手工目录足够清晰，且不会引入额外工具依赖。

### 2.1 唯一事实源

实验室信息管理系统的功能需求唯一事实源为：

`specs/001-lims-core/spec.md`

只有该文件中的需求定义是权威的。其他文档可以解释、索引、引用或派生，但不能另行维护同一条功能需求。

### 2.2 文档职责

| 文档 | 职责 | 是否维护功能需求正文 |
| --- | --- | --- |
| `specs/product.md` | 产品身份、目标、边界和利益相关者 | 否，只维护产品级信息 |
| `specs/001-lims-core/spec.md` | 系统行为、用户故事、验收条件和非功能要求 | 是，唯一事实源 |
| `specs/001-lims-core/plan.md` | 技术架构、实现顺序和技术决策 | 否，从 Spec 派生 |
| `specs/001-lims-core/tasks.md` | 可执行开发任务 | 否，从 Plan 和 Spec 派生 |
| `specs/001-lims-core/traceability.md` | 标准、需求、设计和测试之间的追踪 | 否，维护映射 |
| `docs/prd/` | 面向产品和论文前期阅读的产品简报视图 | 否，禁止复制 FR 条目 |
| `docs/requirements/` | 面向论文和需求工程章节的 SRS 阅读视图 | 否，禁止成为第二事实源 |
| `docs/task/` | 毕业设计阶段计划，如论文、答辩和部署 | 否，不替代开发任务 |
| `docs/kb/` | 参考资料分析和方法知识库 | 否，不直接定义项目需求 |

### 2.3 目录结构

```text
specs/
├─ README.md
├─ constitution.md
├─ product.md
└─ 001-lims-core/
   ├─ spec.md
   ├─ plan.md
   ├─ tasks.md
   └─ traceability.md

docs/
├─ prd/          # 产品简报视图
├─ requirements/ # 需求规格视图
├─ task/         # 毕业设计宏观任务
└─ kb/           # 参考资料与方法知识库
```

## 3. 需求治理规则

### 3.1 编号规则

- 产品决策：`DEC-xxx`。
- 业务规则：`BR-xxx`。
- 功能需求：`FR-模块-编号`，例如 `FR-SAMPLE-001`。
- 非功能需求：`NFR-类别-编号`，例如 `NFR-SEC-001`。
- 验收场景：`AC-模块-编号`。
- 设计决策：`ADR-编号`。

编号一旦发布不得复用。删除需求时保留原编号并标记为 `Rejected` 或 `Deprecated`。

### 3.2 单一事实源规则

- 同一条功能要求只能在 `spec.md` 中写完整正文。
- PRD 只回答“为什么做、为谁做、做什么范围”。
- SRS 视图只回答“系统必须具备哪些可验证行为”，正文通过链接指向 `spec.md`。
- Plan 不得新增未经 Spec 批准的功能。
- Tasks 不得改变需求语义，只能拆分实现工作。
- 代码、测试和论文章节通过需求 ID 追踪，不复制整段需求。

### 3.3 需求状态

每条需求应具有以下状态之一：

- `Draft`：草稿，尚未确认。
- `Proposed`：已提出，等待确认。
- `Approved`：已确认，可以进入计划。
- `Implemented`：已实现。
- `Verified`：已测试或验收通过。
- `Deprecated`：不再推荐使用，但保留历史记录。
- `Rejected`：明确不实现。

### 3.4 变更流程

```text
提出变更
  ↓
更新 spec.md 中的需求和状态
  ↓
更新 traceability.md
  ↓
评估对 plan、tasks、数据模型和测试的影响
  ↓
确认后更新派生文档
```

任何会改变功能行为、验收条件、数据结构或用户权限的修改，都必须先改 Spec，再改 Plan、Tasks、代码和测试。

## 4. 当前项目的重复治理结果

当前 `docs/prd/` 和 `docs/requirements/` 均包含项目范围、角色和功能清单，形成了重复维护风险。本次治理采用以下方式：

1. 将完整功能需求集中到 `specs/001-lims-core/spec.md`。
2. 将 PRD 收缩为产品背景、目标、范围和链接索引。
3. 将 Requirement 文档收缩为 SRS 阅读入口和需求使用说明。
4. 将具体实现顺序移入 `specs/001-lims-core/plan.md`。
5. 将具体开发任务移入 `specs/001-lims-core/tasks.md`。
6. 将标准条款与项目需求的映射集中到 `specs/001-lims-core/traceability.md`。

## 5. 推荐工作流

后续每个功能按以下流程推进：

```text
澄清需求
  ↓
更新 Spec
  ↓
评审和验收条件确认
  ↓
生成/更新 Plan
  ↓
生成/更新 Tasks
  ↓
实现与测试
  ↓
回填需求状态、测试结果和论文材料
```

当前系统级 Spec 已建立，下一步应先完成核心数据模型和系统用例设计，再确定技术栈和实现计划。
