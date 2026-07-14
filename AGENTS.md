# AGENTS.md

## Spec 驱动开发规则

- 开始任何需求、设计或编码工作前，先阅读 `specs/README.md` 和相关核心 Spec。
- 按 `docs/sdd/README.md` 执行 SDD 流程；涉及调研、任务、审查或发布时读取对应规则和模板。
- 系统功能需求的唯一事实源是 `specs/001-lims-core/spec.md`。
- 遵循 `Spec → Plan → Tasks → Implement → Verify` 流程。
- `docs/prd/` 和 `docs/requirements/` 是阅读视图，不得在其中新增与核心 Spec 重复的功能需求正文。
- 任何新增或修改功能都必须使用需求 ID，并同步更新 `traceability.md`、`plan.md`、`tasks.md` 及相关测试依据。
- 并行任务必须声明依赖、文件边界和集成点；同一核心文件或数据契约不得并行修改。
- 合并和发布前必须完成对抗性审查、质量门禁和 `scripts/sdd/check-consistency.ps1` 检查。
- 分支、提交、版本、发布和回滚必须遵循 `docs/sdd/versioning.md` 与 `CONTRIBUTING.md`。
- 发布前额外运行 `npm run check:versioning`，并同步 `CHANGELOG.md`、package version 和 migration 记录。
- P0/P1 审查问题未关闭或获批准豁免时，不得标记任务完成。
- 技术栈尚未确定时，不要擅自进入正式编码；先更新实现计划并记录技术决策。

## 信息不足与问题定位规则

- 当现有知识不足以可靠解决问题，或连续试错仍未解决时，暂停盲目试错，主动收集信息。
- 优先检查本地配置、日志、依赖、文档和可复现步骤；必要时联网搜索，优先使用官方文档、源码和一手资料。
- 在掌握足够证据后，先总结现象、可能原因和验证结果，再继续实施修复或下一轮尝试。
- 涉及密钥、登录态、个人数据或其他敏感信息时，不得回显、提交或外传；只进行必要的最小范围操作。
