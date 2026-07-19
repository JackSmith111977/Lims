# SDD 版本管理与分支规约

本规约适用于实验室信息管理系统的代码、Spec、数据库迁移、接口契约和论文支撑材料。目标是让每一次变更都可追踪、可审查、可回滚。

## 1. 版本事实源

| 内容 | 事实源 |
| --- | --- |
| 应用版本 | `package.json` 的 `version` |
| 依赖锁定 | `package-lock.json` |
| 需求版本 | `specs/001-lims-core/spec.md` 与其变更记录 |
| 数据库版本 | `supabase/migrations/` 和远程 migration history |
| 发布说明 | `CHANGELOG.md` |
| 分支/提交规则 | 本文件与 `CONTRIBUTING.md` |

任何文档、代码或数据库变更都不得创建第二份相互矛盾的版本事实源。

## 2. 分支模型

本项目采用轻量分支模型，不建立长期 `develop` 分支；所有短期分支从 `main` 创建并最终合并回 `main`。

| 分支 | 用途 | 基线 | 是否可直接提交 |
| --- | --- | --- | --- |
| `main` | 可演示、可发布、可回滚 | — | 否，必须审查合并 |
| `feature/<spec-id>-<slug>` | 新功能或需求实现 | `main` | 否 |
| `fix/<issue-or-spec-id>-<slug>` | 缺陷修复 | `main` | 否 |
| `refactor/<area>-<slug>` | 不改变行为的重构 | `main` | 否 |
| `docs/<topic>` | 文档、Spec、知识库 | `main` | 否 |
| `chore/<topic>` | 工具、依赖、构建维护 | `main` | 否 |
| `release/v<semver>` | 发布前冻结与验证 | `main` | 否 |
| `hotfix/v<semver>-<slug>` | 已发布版本的紧急修复 | 发布 tag | 否 |

命名约束：使用小写英文、数字和连字符；禁止空格、中文、下划线和长期个人分支。示例：

> 需求、验收、设计、任务和缺陷编号是可追踪标识，允许保留大写；其后的可读 slug 使用小写。`release` / `hotfix` 分支中的 SemVer 点号是版本格式的必要例外。

```text
feature/FR-SAMPLE-001-register-sample
fix/BR-005-block-archived-task
docs/sdd-versioning
chore/update-supabase-cli
```

工作规则：

1. 开始任务前从最新 `main` 创建短期分支。
2. 一个分支只服务一个逻辑变更，需求 ID 或 issue ID 必须能追溯到 Spec/任务。
3. `main` 禁止直接提交、强制推送和无审查合并。
4. 合并前必须通过 lint、测试、构建、SDD 一致性检查和必要的对抗性审查。
5. 合并后删除短期分支；发布分支和 tag 保留。

### 2.1 分支名执行检查

分支命名不是只靠人工记忆。创建分支后立即运行：

```powershell
npm run check:branch -- -BranchName (git branch --show-current)
```

同一检查会在面向 `main` 的 Pull Request 中自动运行。当前检查允许 `feature`、`fix`、`refactor`、`docs`、`chore`、`release` 和 `hotfix` 约定，并拒绝空格、中文、下划线、未关联标识的功能分支和不符合 SemVer 的发布分支。

## 3. 提交规范

提交格式：

```text
<type>(<scope>): <summary> [<spec-id>]
```

允许的 `type`：`feat`、`fix`、`docs`、`refactor`、`test`、`chore`、`build`、`ci`、`perf`、`revert`。

约束：

- `summary` 使用动词开头，说明结果，不写无意义的“修改代码”。
- 一次提交只完成一个逻辑变化；不要混入无关格式化。
- 功能、数据库迁移、测试和文档可以在同一功能提交中关联，但必须有 Spec ID。
- 破坏性变更在 type 后加 `!`，并在正文说明迁移和回滚方案。
- 提交正文说明动机、影响范围、验证命令和已知风险。

示例：

```text
feat(sample): add sample registration [FR-SAMPLE-001]
fix(task): reject archived task mutation [BR-005]
chore(supabase): add migration automation [NFR-MAINT-001]
docs(sdd): define release and branch policy
```

## 4. 版本号规则

应用和发布版本采用 SemVer：`MAJOR.MINOR.PATCH`。

- `PATCH`：向后兼容的缺陷修复、文档或内部维护。
- `MINOR`：向后兼容的新功能或数据库新增能力。
- `MAJOR`：破坏性 API、数据模型或部署方式变化。
- 当前基线：`0.1.0`，表示仍处于毕业设计开发阶段。
- 发布 tag 格式：`v0.1.0`、`v0.2.0`、`v1.0.0`。
- API 当前基线为 `/api/v1`，破坏性接口进入 `/api/v2`。

Spec 使用 `v0.x` 表示持续澄清，核心需求冻结后进入 `v1.0`。数据库 migration 版本必须唯一，已执行 migration 禁止修改，只能新增 migration 修正。

## 5. 发布流程

```text
需求/设计变更
  ↓
feature/fix 分支
  ↓
局部实现与测试
  ↓
对抗性审查 + 质量门禁 + 一致性检查
  ↓
main
  ↓
release/v<semver>
  ↓
更新 CHANGELOG、版本号、迁移说明
  ↓
发布 tag v<semver>
```

发布前必须确认：

- `npm run lint`、`npm run test`、`npm run build` 通过。
- `scripts/sdd/check-consistency.ps1` 和 `scripts/sdd/check-versioning.ps1` 通过。
- `supabase migration list` 与待发布 migration 一致；生产迁移先执行 dry-run。
- 所有 P0/P1 审查问题已关闭或有明确豁免。
- `CHANGELOG.md` 已记录 Spec ID、migration、环境变量和已知问题。
- 已记录回滚方式和演示环境验证结果。

## 6. 回滚规则

- 应用回滚使用上一个稳定 tag，不在 `main` 上临时改历史。
- 数据库默认采用向前修复 migration，不在远程环境直接执行 `migration down`。
- 破坏性 migration 必须先提供兼容窗口、备份和恢复演练记录。
- 环境变量变化必须在发布说明中记录，旧变量在确认无流量后再删除。
- 回滚结果必须补充到发布记录和缺陷记录。

## 7. 依赖与锁文件

- `package-lock.json` 必须与 `package.json` 同步提交。
- 依赖升级必须说明原因、版本范围、兼容性、验证结果和回滚方式。
- Supabase CLI、Next.js、Supabase SDK 等基础依赖的大版本升级必须先在独立分支验证。
- 依赖安全问题按 P0/P1 处理，不延迟到毕业设计最后阶段。

## 8. GitHub 仓库执行设置

仓库文件可以提供 CI 和模板，但 `main` 的保护规则仍需要仓库管理员在 GitHub 设置中启用。建议设置如下：

1. `main`：要求 Pull Request、禁止强制推送和删除、要求 conversation resolved，并将 CI 中实际出现的 `Quality gates` 检查设为合并前必需检查。
2. `main`：采用 squash merge 或 rebase merge，保持线性历史；禁止直接向 `main` 推送。
3. 有第二位维护者后：增加至少 1 个批准评审，并启用新提交后旧批准失效；单人维护阶段使用 Draft PR、PR 模板和对抗性审查清单，不把无法满足的自审批准伪装成质量证据。
4. `release/v*` 和 `v*` tag：仅从已验证的 `main` 发布，禁止移动已发布 tag。
5. 所有 PR 运行 `.github/workflows/quality-gates.yml`；该工作流只使用构建占位环境，不访问远程 Supabase 密钥或生产数据。

GitHub 官方文档支持通过 branch protection / ruleset 要求 Pull Request、状态检查、线性历史、conversation resolution 和禁止强制推送；工作流文件应存放在 `.github/workflows/`，发布则以 Git tag 为基础创建 Release：[分支保护](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)、[Rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets)、[Actions 工作流语法](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax)、[GitHub Releases](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases)。

## 9. 可复现发布清单

发布必须从干净的 `main` 开始，不能从普通功能分支直接打正式 tag：

```powershell
git fetch origin
git switch main
git pull --ff-only
git status --short

# 例：准备 0.2.0；此命令只更新 package.json / package-lock.json，不自动创建 tag
npm version 0.2.0 --no-git-tag-version
# 手动更新 CHANGELOG.md 的版本节、migration、环境变量、验证结果和回滚方式

npm ci
npm run lint
npm run test
npm run build
.\scripts\sdd\check-consistency.ps1
.\scripts\sdd\check-versioning.ps1

git add package.json package-lock.json CHANGELOG.md
git commit -m "chore(release): prepare v0.2.0"
git tag -a v0.2.0 -m "Release v0.2.0"
git push origin main
git push origin v0.2.0
gh release create v0.2.0 --title "v0.2.0" --generate-notes
```

发布后必须把 Release URL、验证结果、migration history、已知问题和回滚结果补充到发布记录；tag 一旦公开，不得复用同一版本号指向其他提交。
