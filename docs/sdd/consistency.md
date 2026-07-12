# SDD 一致性对齐规则

## 1. 追踪链

每个核心功能应形成以下链路：

```text
Research
  → DEC/ADR
  → FR/NFR/BR
  → Design
  → Task
  → Code
  → Test/AC
  → Release
```

链路中任何一段缺失，都应在任务或审查记录中说明原因。

## 2. 一致性检查项

- `spec.md` 中的 Approved 需求是否都能在 `traceability.md` 找到。
- `traceability.md` 中的设计文件是否存在。
- `tasks.md` 中的任务是否有 Spec ID、依赖和验证方式。
- PRD/SRS 视图是否没有重复维护 `FR-*` 和 `NFR-*` 正文。
- `openapi.yaml` 是否覆盖所有 P0 API。
- 页面权限表是否覆盖所有受保护页面。
- 数据模型是否覆盖需求中的核心实体和审计字段。
- 代码、测试和发布说明是否引用需求 ID。
- 设计和任务是否引入 Spec 未批准的功能。

## 3. 检查频率

- 每次需求变更后。
- 每次合并前。
- 每个里程碑完成后。
- 发布前必须全量检查。

自动检查入口：

```powershell
pwsh -File .\scripts\sdd\check-consistency.ps1
```

## 4. 人工检查

自动脚本不能替代人工判断。以下内容必须人工审查：

- 需求语义是否发生变化。
- RLS 是否真的符合业务权限。
- 状态机是否存在逻辑死路。
- 错误处理是否适合用户和运维人员。
- 技术抽象是否过度或不足。
