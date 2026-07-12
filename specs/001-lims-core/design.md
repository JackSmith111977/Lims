# 核心系统设计模型

| 项目 | 内容 |
| --- | --- |
| 来源 Spec | `specs/001-lims-core/spec.md` |
| 设计状态 | Draft |
| 版本 | v0.1 |
| 更新时间 | 2026-07-11 |

> 本文档记录需求阶段的系统分析模型。它描述系统边界、用户交互、业务流程和核心数据关系，不包含具体编程语言、框架或部署实现。

## 1. 系统上下文图

```mermaid
flowchart LR
    Research[科研项目与实验需求]
    Admin[系统管理员]
    LabAdmin[实验室管理员]
    Researcher[实验人员]
    Teacher[项目负责人/教师]
    LIMS((实验室信息管理系统))
    Instruments[仪器设备与环境记录]
    Files[实验文件与附件]
    External[外部系统或仪器接口<br/>后续扩展]

    Research --> LIMS
    Admin <--> LIMS
    LabAdmin <--> LIMS
    Researcher <--> LIMS
    Teacher <--> LIMS
    Instruments --> LIMS
    LIMS <--> Files
    LIMS -.预留接口.-> External
```

### 设计说明

- 系统边界内包含用户、任务、样品、数据、资源、审核、报告和日志管理。
- 科研项目或实验需求是业务流程的起点。
- 仪器和环境在第一版中可以使用人工记录或模拟数据。
- 外部系统和真实仪器接口只保留扩展边界，不阻塞基础系统交付。

## 2. 用户用例图

```mermaid
flowchart LR
    subgraph Actors[系统角色]
        A[系统管理员]
        B[实验室管理员]
        C[实验人员]
        D[项目负责人/教师]
    end

    subgraph System[实验室信息管理系统]
        U1([登录与身份认证])
        U2([用户、角色与权限])
        U3([实验室人员管理])
        U4([项目与任务登记])
        U5([样品登记与流转])
        U6([任务分配与执行])
        U7([方法与设备管理])
        U8([试剂耗材与环境管理])
        U9([实验数据与结果录入])
        U10([结果审核与退回])
        U11([报告生成与归档])
        U12([数据看板与统计])
        U13([操作日志与数据追溯])
    end

    A --> U1
    A --> U2
    A --> U12
    A --> U13

    B --> U1
    B --> U3
    B --> U4
    B --> U5
    B --> U6
    B --> U7
    B --> U8
    B --> U11
    B --> U12
    B --> U13

    C --> U1
    C --> U5
    C --> U6
    C --> U9
    C --> U11

    D --> U1
    D --> U4
    D --> U6
    D --> U10
    D --> U11
    D --> U12
    D --> U13
```

### 用例边界

第一版的每个用例都应至少覆盖：

- 权限检查。
- 业务数据校验。
- 成功结果反馈。
- 异常或失败反馈。
- 关键操作日志。

## 3. 主业务流程图

```mermaid
flowchart TD
    Start([科研项目/实验需求])
    Register[登记项目、任务和样品]
    Assign[分配实验人员、设备和资源]
    Execute[执行实验并更新任务状态]
    Acquire[录入或导入实验数据]
    Process[数据处理、计算和异常判断]
    Review{结果审核}
    Return[退回补充或重新处理]
    Report[生成实验报告]
    Archive[报告发布、统计和归档]
    Trace[保留样品、任务、数据、审核和操作日志]

    Start --> Register --> Assign --> Execute --> Acquire --> Process --> Review
    Review -- 退回/补充 --> Return --> Execute
    Review -- 通过 --> Report --> Archive
    Register -.-> Trace
    Assign -.-> Trace
    Execute -.-> Trace
    Acquire -.-> Trace
    Process -.-> Trace
    Review -.-> Trace
    Report -.-> Trace
    Archive -.-> Trace
```

### 3.1 任务状态模型

```mermaid
stateDiagram-v2
    [*] --> 待登记
    待登记 --> 待分配
    待分配 --> 已分配
    已分配 --> 执行中
    执行中 --> 待审核
    待审核 --> 已通过
    待审核 --> 退回待补充
    退回待补充 --> 执行中
    已通过 --> 已归档
    已归档 --> [*]
```

### 3.2 样品流转模型

```mermaid
stateDiagram-v2
    [*] --> 待登记
    待登记 --> 已登记
    已登记 --> 待处理
    待处理 --> 处理中
    处理中 --> 已处理
    已处理 --> 已归档
    已处理 --> 已处置
    已归档 --> [*]
    已处置 --> [*]
```

## 4. 核心数据库 ER 图

```mermaid
erDiagram
    DEPARTMENT ||--o{ USER : contains
    USER ||--o{ USER_ROLE : has
    ROLE ||--o{ USER_ROLE : grants
    ROLE ||--o{ ROLE_PERMISSION : includes
    PERMISSION ||--o{ ROLE_PERMISSION : defines

    LABORATORY ||--o{ PROJECT : owns
    PROJECT ||--o{ TASK : contains
    PROJECT ||--o{ SAMPLE : contains
    TASK ||--o{ TASK_SAMPLE : uses
    SAMPLE ||--o{ TASK_SAMPLE : assigned
    TASK ||--o{ TASK_ASSIGNMENT : assigned_to
    USER ||--o{ TASK_ASSIGNMENT : receives
    TASK ||--o{ SAMPLE_FLOW : tracks
    SAMPLE ||--o{ SAMPLE_FLOW : moves

    METHOD ||--o{ TASK : applies_to
    TASK ||--o{ EXPERIMENT_DATA : produces
    SAMPLE ||--o{ EXPERIMENT_DATA : measured
    INSTRUMENT ||--o{ EXPERIMENT_DATA : captures
    TASK ||--o{ REVIEW : requires
    USER ||--o{ REVIEW : performs
    TASK ||--o{ REPORT : generates
    REVIEW ||--o{ REPORT : approves

    INSTRUMENT ||--o{ MAINTENANCE : receives
    INVENTORY_ITEM ||--o{ INVENTORY_TXN : changes
    TASK ||--o{ INVENTORY_TXN : consumes
    LABORATORY ||--o{ ENV_RECORD : monitors
    USER ||--o{ AUDIT_LOG : operates

    DEPARTMENT {
        string department_id PK
        string name
        string status
    }
    USER {
        string user_id PK
        string username
        string name
        string status
        string department_id FK
    }
    ROLE {
        string role_id PK
        string name
    }
    PERMISSION {
        string permission_id PK
        string code
        string name
    }
    LABORATORY {
        string laboratory_id PK
        string name
        string location
    }
    PROJECT {
        string project_id PK
        string name
        string owner_id FK
        string status
    }
    TASK {
        string task_id PK
        string project_id FK
        string method_id FK
        string status
        string priority
        date planned_start
        date planned_end
    }
    SAMPLE {
        string sample_id PK
        string project_id FK
        string code UK
        string name
        string status
        string storage_condition
    }
    SAMPLE_FLOW {
        string flow_id PK
        string sample_id FK
        string node
        string operator_id FK
        datetime occurred_at
        string location
    }
    TASK_SAMPLE {
        string task_id PK,FK
        string sample_id PK,FK
    }
    TASK_ASSIGNMENT {
        string assignment_id PK
        string task_id FK
        string user_id FK
        datetime assigned_at
    }
    METHOD {
        string method_id PK
        string version
        string name
        string status
    }
    EXPERIMENT_DATA {
        string data_id PK
        string task_id FK
        string sample_id FK
        string instrument_id FK
        string data_type
        string unit
        datetime collected_at
    }
    REVIEW {
        string review_id PK
        string task_id FK
        string reviewer_id FK
        string result
        string comment
        datetime reviewed_at
    }
    REPORT {
        string report_id PK
        string task_id FK
        string review_id FK
        string version
        string status
    }
    INSTRUMENT {
        string instrument_id PK
        string name
        string status
        string location
    }
    MAINTENANCE {
        string maintenance_id PK
        string instrument_id FK
        string type
        date occurred_on
        string result
    }
    INVENTORY_ITEM {
        string item_id PK
        string type
        string batch_no
        decimal quantity
        date expiry_date
        string location
    }
    INVENTORY_TXN {
        string transaction_id PK
        string item_id FK
        string task_id FK
        string type
        decimal quantity
        datetime occurred_at
    }
    ENV_RECORD {
        string record_id PK
        string laboratory_id FK
        string metric
        decimal value
        string unit
        datetime collected_at
    }
    AUDIT_LOG {
        string log_id PK
        string operator_id FK
        string object_type
        string object_id
        string action
        datetime occurred_at
    }
```

## 5. 数据设计说明

### 5.1 追溯链

```text
项目
  → 任务
  → 样品
  → 实验数据
  → 审核记录
  → 报告
```

任务还可以关联实验人员、实验方法、仪器设备和试剂耗材。报告不应直接保存无法追溯来源的最终数字；它应能够通过关联查询回到原始数据和审核记录。

### 5.2 设计约束

- `sample.code`、`task.task_id` 和 `report.report_id` 必须唯一。
- 原始数据和处理数据至少需要通过数据类型或独立记录区分。
- 状态变化应使用历史记录或审计日志保留过程。
- 任务、样品和报告的关键记录不建议物理删除，优先采用停用、作废或归档状态。
- 第一版可以使用关系型数据库，文件附件采用独立文件记录与业务实体关联。

## 6. 设计到需求的映射

| 设计产物 | 对应 Spec |
| --- | --- |
| 系统上下文图 | 产品边界、角色、通信扩展 |
| 用户用例图 | `FR-AUTH-*`、`FR-SAMPLE-*`、`FR-TASK-*` 等功能域 |
| 主业务流程 | `BR-001～005`、`FR-TASK-*`、`FR-DATA-*`、`FR-REVIEW-*`、`FR-REPORT-*` |
| 任务状态模型 | 任务状态和审核规则 |
| 样品流转模型 | `FR-SAMPLE-004～006` |
| ER 图 | 数据模型要求、`NFR-DATA-*`、`FR-AUDIT-*` |

## 7. 下一步设计任务

- [x] 根据用例图细化用例说明。
- [x] 根据 ER 图确定字段、索引和约束。
- [x] 根据主流程设计页面导航和页面原型清单。
- [x] 确定 API 边界和接口数据格式。
- [x] 确定前端、后端、数据库和部署技术栈。

详细设计已拆分为：

- [architecture.md](architecture.md)
- [data-model.md](data-model.md)
- [ui.md](ui.md)
- [api-contract.md](api-contract.md)
- [contracts/openapi.yaml](contracts/openapi.yaml)
