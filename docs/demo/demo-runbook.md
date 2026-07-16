# LIMS 毕业设计演示流程

| 项目 | 内容 |
| --- | --- |
| 场景 ID | `DEMO-LIMS-001` |
| 关联设计 | [`DES-DEMO-SCENARIO-001`](../../specs/001-lims-core/design-demo-scenario.md) |
| 数据目录 | [`demo-data-catalog.json`](demo-data-catalog.json) |
| 预计时长 | 12～15 分钟 |
| 演示数据 | 全部为合成数据，统一使用 `DEMO_` 前缀 |

## 0. 演示前准备

1. 确认应用使用目标 Supabase 项目，先执行一次备份或确认本次为隔离环境。
2. 确认三类演示账号已由管理员在隔离环境创建：管理员、实验人员、项目负责人/教师。账号使用占位邮箱和临时密码，不把密码写入文档。
3. 按数据目录准备 `DEMO_LAB_01`、`DEMO_ZONE_01`、`DEMO_P_001`、`DEMO_M_001`、`DEMO_INST_001`、`DEMO_REAGENT_001`、`DEMO_T_001`、`DEMO_S_001` 和 `DEMO_RAW_001`。
4. 打开浏览器但不要预先登录多个账号；每次切换角色都先退出，避免把一个角色的会话误用于下一步。

## 1. 管理员初始化（约 2 分钟）

登录 `/login`，进入 `/admin/settings`，展示实验室、区域、分类或计量单位；进入 `/admin/users` 和 `/admin/roles`，说明角色与权限边界。确认管理员可以看到资源、审计和看板入口，但普通实验人员不能看到管理入口。

进入 `/instruments` 创建或确认 `DEMO_INST_001`，状态设为 ACTIVE、位置为 `DEMO_ZONE_01`；进入 `/inventory` 建立 `DEMO_REAGENT_001` 的批号 `DEMO_BATCH_001`、库存和有效期；进入 `/environment` 记录 `DEMO_ENV_001` 的温度、湿度和采集时间。

证据：保存实验室/设备/耗材/环境记录编号，不保存账号密码或 token。

## 2. 项目、方法、样品和任务（约 3 分钟）

1. 在 `/projects` 创建 `DEMO_P_001`“标准样品稳定性验证”。
2. 在 `/methods` 创建 `DEMO_M_001` 的 1.0 版本，确认任务引用的是明确版本。
3. 在 `/samples` 登记 `DEMO_S_001`，填写名称、数量、来源、批号和存储条件，绑定 `DEMO_P_001`。
4. 在 `/tasks` 创建 `DEMO_T_001`，关联项目、样品和方法，设置优先级与计划周期。
5. 在任务分配区域把任务分给实验人员，并展示任务状态历史。

证据：记录项目、方法版本、样品、任务和分配关系；确认唯一编号和状态变更可查询。

## 3. 样品流转和实验执行（约 2 分钟）

使用实验人员账号登录，打开 `/tasks` 查看被分配的 `DEMO_T_001`，推进任务到执行中；在 `/samples` 查看 `DEMO_S_001`，登记采集、分发、转移或处理节点，填写位置、交接人和说明。回到任务页面确认样品和执行人关联仍然存在。

证据：展示样品流转时间线、当前位置、任务状态历史和当前执行人。

## 4. 数据录入和处理（约 2 分钟）

在 `/data` 或任务数据入口录入 `DEMO_RAW_001`，填写数值、单位、采集时间、来源、样品、任务、方法和 `DEMO_INST_001`。执行已配置的处理规则，确认原始值不可被处理结果覆盖，处理运行保留规则版本、执行人和说明。

可选异常分支：使用第二条合成读数触发 FLAGGED 或不通过判定，展示异常说明；不要修改第一条正常原始数据来制造异常。

证据：记录原始数据 ID、处理运行 ID、规则版本和异常/处理状态。

## 5. 审核、报告和追溯（约 2 分钟）

切换项目负责人/教师账号，进入 `/reviews` 查看待审核任务。选择通过并填写审核意见；若演示退回分支，先退回再补充后重新提交，展示未通过审核不能归档。

进入 `/reports` 生成 `DEMO_T_001` 报告，展示报告编号、版本、样品、任务和结果，执行发布或归档流程。打开报告追溯入口 `/reports/trace/<reportId>`，依次展示报告、任务、样品、数据、审核和审计节点。

证据：保存报告编号、版本号、审核记录 ID 和追溯页面截图。

## 6. 看板、审计和权限反例（约 2 分钟）

1. 进入 `/dashboard`，展示样品总数、任务状态/完成率、待审核、异常数据、设备状态和库存预警。
2. 使用项目、人员、状态和时间筛选，确认统计范围变化且没有跨权限数据。
3. 进入 `/admin/audit` 查询本次任务、审核、报告和登录事件。
4. 切换实验人员账号尝试打开管理页面或读取不属于自己的数据，展示页面/接口拒绝；不要使用真实敏感数据做反例。

## 7. 结束和清理

答辩环境需要保留数据时，保留 `DEMO_` 前缀并在演示记录中写明隔离项目。需要重置时，先按备份恢复手册备份，再使用受控清理脚本按外键顺序删除演示用户、任务、样品、数据、报告、设备、耗材和审计测试记录，最后用只读查询确认 `DEMO_` 和演示账号残留为 0。

## P0 覆盖清单

本表用于演示验收，不替代核心 Spec：

Audit and permission checks are mandatory. Cleanup must be confirmed by a read-only query after the demonstration.

```text
FR-AUTH-001 FR-AUTH-002 FR-AUTH-003 FR-AUTH-004 FR-AUTH-005
FR-PER-001 FR-PER-002
FR-SAMPLE-001 FR-SAMPLE-002 FR-SAMPLE-003 FR-SAMPLE-004 FR-SAMPLE-005 FR-SAMPLE-006
FR-TASK-001 FR-TASK-002 FR-TASK-003 FR-TASK-004 FR-TASK-005 FR-TASK-006
FR-METHOD-001 FR-METHOD-002
FR-DATA-001 FR-DATA-002 FR-DATA-003 FR-DATA-004 FR-DATA-005
FR-REVIEW-001 FR-REVIEW-002 FR-REVIEW-003 FR-REVIEW-004
FR-REPORT-001 FR-REPORT-002 FR-REPORT-003 FR-REPORT-004
FR-EQUIP-001 FR-EQUIP-002 FR-EQUIP-003
FR-INVENTORY-001 FR-INVENTORY-002 FR-INVENTORY-003 FR-INVENTORY-004
FR-ENV-001 FR-ENV-002 FR-ENV-003
FR-AUDIT-001 FR-AUDIT-002 FR-AUDIT-003 FR-AUDIT-004 FR-AUDIT-005
FR-DASH-001 FR-DASH-002 FR-DASH-003
FR-SETTING-001 FR-SETTING-002
```
