# T-601 CSV/Excel 数据交换对抗性审查

| 项目 | 内容 |
| --- | --- |
| Review ID | `REV-DATA-EXCHANGE-001` |
| 关联设计 | `DES-DATA-EXCHANGE-001` |
| 关联任务 | `T-601` |
| 审查状态 | Approved：解析、权限边界、页面入口、本地正负向验证和正式项目远程正向/负向/清理均通过 |

## 对抗性检查

| 检查项 | 结果 | 说明 |
| --- | --- | --- |
| 未认证调用导入接口 | 通过 | 未认证 E2E 对 `/api/v1/tasks/{id}/data/import` 返回 401 |
| 上传文件类型/大小/行数 | 通过 | 仅 CSV/XLSX，5 MiB、500 行边界有服务测试；不支持 XLS |
| 任一非法行导致部分写入 | 通过 | 服务端先完成所有行解析、字段和关联校验，再批量插入；正式远程临时夹具验证非法行零写入 |
| 原始/处理数据边界 | 通过 | 复用既有数据值形状校验，导入统一使用 `sourceType=FILE`，不接受客户端服务字段 |
| 公式、未知列和重复列 | 通过 | 公式单元格拒绝，字段白名单拒绝未知/重复列，不回显整行内容 |
| 审计泄露文件内容 | 通过设计 | 审计仅保存文件名、扩展名和导入数量，不保存文件内容或凭据 |
| 远程环境和清理 | Passed | 正式项目迁移已对齐；`test:data-import` 的 `cleanedByFinally=true`，CSV/XLSX、来源、非法行零写入和审计摘要均通过 |

## 当前证据

- `npm.cmd test`：21 个测试文件、89 个测试通过；新增 `data-import.test.ts` 覆盖 CSV、XLSX、未知格式、缺少列和行数上限。
- `npx.cmd tsc --noEmit`、`npm.cmd run lint`、生产构建和 `check-consistency.ps1` 通过。
- 未认证 E2E：`experiment-data-access.spec.ts` 1/1 通过，包含导入接口认证保护。
- `npm.cmd run test:data-import` 在正式项目同环境生产服务中通过：CSV/XLSX、`FILE` 来源、非法行原子拒绝和导入审计均通过，`cleanedByFinally=true`。

## 结论

正式项目远程集成、审计核对、自动清理、对抗性检查和质量门禁均已完成，本审查批准关闭 `T-601D`。
