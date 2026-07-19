# 资源管理验收对抗性审查记录

| 项目 | 内容 |
| --- | --- |
| Review ID | REV-RESOURCE-MANAGEMENT-001 |
| 审查对象 | AC-RESOURCE-001；T-406；设备、维护校准、试剂耗材和库存变动集成测试 |
| 日期 | 2026-07-16 |
| 状态 | Closed |

## 攻击范围

- 普通用户创建、修改或删除设备、维护记录、试剂耗材和库存变动。
- 伪造设备状态、负责人、维护校准周期、库存余额、操作人和历史记录。
- 设备与实验数据关联、设备报废终态、库存不足、耗尽恢复和并发库存扣减。
- 管理员查询资源历史、只读角色查询可见记录，以及测试失败后的临时资源清理。
- Windows 下聚合测试命令的可移植性和子测试失败诊断能力。

## 发现与处置

| ID | 级别 | 场景 | 证据 / 处置 | 状态 |
| --- | --- | --- | --- | --- |
| REV-RESOURCE-MANAGEMENT-001-01 | P0 | 资源读者绕过服务层直写设备或耗材主档、维护记录和库存明细。 | 设备与库存子测试均覆盖 RPC 越权及直接表写入，读者写入、更新、删除均被拒绝；管理员写入通过。 | Closed |
| REV-RESOURCE-MANAGEMENT-001-02 | P0 | 客户端伪造库存余额、库存操作人或设备历史，导致状态/审计不一致。 | 余额仅由变动 RPC 投影，操作人和审计来自当前会话；库存历史追加不可变；设备维护和校准记录追加不可变。远程审计一致性通过。 | Closed |
| REV-RESOURCE-MANAGEMENT-001-03 | P1 | 设备报废后继续使用或恢复，库存不足和并发扣减破坏资源状态。 | 子测试覆盖报废终态、报废设备数据写入拒绝、库存不足、耗尽/再入库和双并发扣减仅一方成功；远程运行通过。 | Closed |
| REV-RESOURCE-MANAGEMENT-001-04 | P1 | 关联记录查询缺失，管理员无法完成 AC-RESOURCE-001 的“查询相关记录”。 | 设备测试查询维护/校准和设备关联数据，库存测试查询库存余额、变动历史和审计；两条子测试均报告通过。 | Closed |
| REV-RESOURCE-MANAGEMENT-001-05 | P2 | Windows 聚合执行失败时吞掉子测试诊断，或只执行其中一个模块。 | 聚合器改用 Windows `cmd.exe` 调用 npm，串行执行两个子测试，保留每个子测试最后两行验收输出和失败信息；设备、库存及聚合测试均通过。 | Closed |
| REV-RESOURCE-MANAGEMENT-001-06 | P2 | 测试失败或重试遗留临时用户、角色、设备、任务、样品、方法、库存和审计。 | 子测试 finally 清理并验证剩余计数；本次设备和库存子测试均报告 users/业务资源/roles 为 0。 | Closed |

## 验证证据

- `npm.cmd run test:instrument-integration`：通过；临时 users/instruments/tasks/samples/projects/methods 全部为 0。
- `npm.cmd run test:inventory-integration`：通过；临时 users/items/transactions/roles 全部为 0。
- `npm.cmd run test:resource-integration`：通过；设备和库存子测试串行执行且均成功。
- `scripts/sdd/check-consistency.ps1`、`npm.cmd run check:versioning`、`git diff --check`：提交前执行并通过。

## 结论

P0/P1 风险均已关闭。T-406 已将设备与试剂耗材的管理员维护、只读查询、关联记录、状态/并发边界、审计和清理纳入统一远程验收入口，可以提交。
