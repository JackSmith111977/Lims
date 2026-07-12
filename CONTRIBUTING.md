# 贡献与开发协作规范

## 开始工作

1. 阅读 `AGENTS.md`、`specs/README.md` 和相关核心 Spec。
2. 从最新 `main` 创建短期分支：`feature/<spec-id>-<slug>`、`fix/<id>-<slug>` 或 `chore/<topic>`。
3. 按 `Spec → Plan → Tasks → Implement → Verify` 执行。

## 本地验证

```powershell
npm install
npm run lint
npm run test
npm run build
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\sdd\check-consistency.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\sdd\check-versioning.ps1
```

涉及 Supabase 的变更还需要：

```powershell
npm run supabase:dry-run
npm run supabase:migrations
```

## 提交与合并

提交遵循 Conventional Commits，并在功能提交中附带 Spec ID，例如：

```text
feat(task): add task assignment [FR-TASK-003]
```

合并请求必须说明：

- 关联的 Spec、任务和问题 ID。
- 变更内容、影响范围和风险。
- 数据库 migration、环境变量或 API 契约变化。
- 已执行的验证命令和结果。
- 回滚方式。

禁止提交 `.env.local`、密钥、生产数据和构建产物。禁止直接向 `main` 提交或强制推送。
