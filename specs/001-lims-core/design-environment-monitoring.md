# 设施环境记录与阈值提醒设计

| Item | Value |
| --- | --- |
| Design ID | DES-ENVIRONMENT-MONITORING-001 |
| Status | Approved |
| Scope | FR-ENV-001～005、AC-RESOURCE-001 |
| Depends | T-105B 的 `lab_laboratory`/`lab_department` 主档、现有 `environment_record` |

## 1. 目标与边界

T-405 复用基础设置中已经维护的实验室和区域主档，新增环境指标阈值配置、环境采集记录和超阈值提醒。真实传感器接入（FR-ENV-006）不在本任务内；`source_type` 预留 `SENSOR`/`API`，第一版支持手工录入。

## 2. 阈值与记录模型

- 新增 `environment_threshold`：按实验室、指标和单位保存一条阈值配置，包含 `threshold_min`、`threshold_max` 和 `ACTIVE/INACTIVE` 状态；至少填写一个边界，最大值不得小于最小值。
- `environment_record` 保留采集时的阈值快照，避免后续修改配置改变历史判断；记录包含实验室、指标、数值、单位、采集时间、来源、记录人和 `NORMAL/EXCEEDED` 状态。
- 实验室必须为 `ACTIVE`；指标和单位由服务端校验长度，采集时间不得明显晚于当前时间。没有活动阈值时允许记录，但状态为 `NORMAL`。
- 记录只允许追加，阈值通过状态停用而不是物理删除；客户端不能直接写入、修改或删除环境记录。

## 3. 状态、提醒与权限

- 当数值小于 `threshold_min` 或大于 `threshold_max` 时，记录状态为 `EXCEEDED`，否则为 `NORMAL`。
- `GET /environment/alerts?days=30` 返回最近窗口内的 `EXCEEDED` 记录，按采集时间倒序；提醒是记录的查询视图，不重复保存通知实体。
- `resource.read` 可查询实验室、阈值、环境记录和提醒；`resource.manage` 可维护阈值并新增环境记录。
- 记录人、写入时间、状态和阈值快照由数据库事务生成；审计与记录写入处于同一事务。

## 4. API 与页面

- `GET/POST /environment/thresholds` 查询或创建阈值配置；`PATCH /environment/thresholds/{id}` 修改配置或停用配置。
- `GET/POST /environment/records` 查询或追加环境记录；支持 `laboratoryId`、`metric` 和 `status` 过滤。
- `GET /environment/alerts` 查询超阈值记录。
- `/environment` 页面选择已有实验室，展示阈值、录入表单、最近记录和提醒摘要；实验室/区域主档继续由基础设置页面维护。

## 5. 事务与验证重点

`save_environment_threshold` 锁定阈值行并写入审计；`record_environment_reading` 锁定实验室和活动阈值，计算状态、保存阈值快照、插入不可变记录并写审计。验证覆盖边界值、阈值缺失、停用实验室、直接写入、读写权限、提醒排序、审计一致性和临时数据清理。
