# 基础设置管理对抗性审查记录

| 项目 | 内容 |
| --- | --- |
| Review ID | REV-SETTING-001 |
| 审查对象 | DES-SETTING-001、T-105B1～B3、settings migration、动态管理 API 与页面 |
| 版本/提交 | 工作树（未提交） |
| 审查人 | Codex 角色切换审查 |
| 日期 | 2026-07-12 |

## 攻击范围

从未认证访问、普通用户越权、编码冲突、父节点错误、停用代替删除、参数类型错误、审计缺失和远程迁移风险角度审查基础设置实现。

## 发现

| ID | 等级 | 场景 | 影响 | 修复/豁免 | 状态 |
| --- | --- | --- | --- | --- | --- |
| REV-SETTING-001-01 | P1 | 未认证访问设置页面或 API | 可能越权读取或修改系统基础配置 | Proxy、页面和 API 三层校验；未认证页面/API E2E 已通过 | Closed |
| REV-SETTING-001-02 | P1 | 普通用户调用 `settings` API | 可能越权修改实验室和参数 | `settings.manage` 服务端权限 + RLS；未认证 API E2E 已通过，T-105A 普通用户越权策略已通过 | Closed |
| REV-SETTING-001-03 | P1 | 分类或部门跨作用域挂接 | 数据树失真或业务归属错误 | 服务端校验父节点同类型/同实验室；外键保证引用完整性 | Closed by code review |
| REV-SETTING-001-04 | P2 | 重复编码或参数类型错误 | 数据覆盖或运行时解析异常 | 唯一约束映射 409；参数按 valueType 校验并映射 400 | Closed by code review |
| REV-SETTING-001-05 | P2 | 物理删除设置导致历史记录断裂 | 追溯和外键失败 | 仅提供停用/启用，不提供删除 API | Closed by design |
| REV-SETTING-001-06 | P2 | 设置变更无审计 | 无法追踪配置来源 | 所有写接口统一调用 `record_audit_event` | Closed by code review and integration |

## 复测结果

- `npx tsc --noEmit`：通过。
- `npm run lint`：通过。
- `npm run test`：通过，4 个单元测试通过。
- 生产构建：通过，新增 `/admin/settings` 和 `/api/v1/settings/[resource]` 路由已进入构建产物。
- 未认证管理页/API E2E：3 个测试通过。
- 远程设置正向集成：新增、查询、停用实验室分别返回 `201`、`200`、`200`；审计记录 2 条，临时账号和实验室已清理。
- 远程设置全量正向集成：实验室、部门、实验组、通用分类、计量单位和系统参数均完成新增、列表、停用验收，临时账号和设置数据已清理。
- migration `202607120005_settings.sql`：已应用到远程测试项目，类型已重新生成。

## 结论

T-105B1～B4 的实现、权限边界、全量基础设置正向验收和未认证负向验收已完成，T-105B 可以标记完成。后续仍可补充更细的字段编辑体验和故障注入演练，但不阻塞当前任务。
