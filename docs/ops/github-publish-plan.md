# GitHub 远程发布计划

## 目标

将本地 LIMS 项目按 SDD 和版本规约发布到远程仓库：

`https://github.com/JackSmith111977/Lims`

本文件只记录发布流程和前置条件，不保存任何 Supabase 密钥、服务角色密钥或个人令牌。

## 当前前置检查

- 本地分支：`feature/FR-DATA-001-record-results`
- 工作区：存在上一轮 MVP 收尾、业务模块接入和本轮导航优化相关的未提交变更；发布前必须逐项审阅 `git status` 与 `git diff`，不得默认把无关文件全部加入提交。
- 远程配置：`origin` 已配置为 `https://github.com/JackSmith111977/Lims.git`。用户已在实际 Codex 终端核验仓库信息：`JackSmith111977/Lims` 为公开仓库，当前账号权限为 `ADMIN`，`defaultBranchRef.name` 为空，说明远程仓库尚无默认分支。
- GitHub CLI：已完成全局安装，自动化执行环境可找到 `C:\Program Files (x86)\GitHub CLI\gh.exe`，版本为 2.96.0。用户反馈其实际 Codex 内置终端已登录成功；自动化执行环境与该终端会话未共享可验证的凭据状态，因此不得要求用户提供 token。

## 发布顺序

1. 完成本轮导航视觉优化、单元测试、lint、生产构建和 SDD 一致性检查。
2. 审阅工作区差异，确认哪些既有 MVP 变更属于本次发布；如存在无关改动，拆分或由用户确认范围。
3. 检查或配置 `origin`，核对仓库所有者、仓库名和默认分支；不提交 `.env.local`、密钥、令牌、临时日志和 `tmp/` 运行产物。
4. 按版本规约使用短期分支和带 Spec ID 的小提交；当前功能变更对应 `DES-DASHBOARD-NAV-001`、`T-614～T-616`。
5. 安装并登录 GitHub CLI 后执行 `gh auth status`，为远程空仓库先建立 `main` 基线，再推送当前功能分支并设置 upstream。
6. 确认 `main` 已成为远程默认分支后创建 Draft PR，PR 说明必须包含变更内容、原因、用户影响、验证命令和已知风险。

## GitHub CLI 官方流程依据

- Windows 安装优先使用 WinGet：`winget install --id GitHub.cli --source winget`；安装程序会修改 PATH，必须重新打开终端后再检查 `gh --version`。
- 认证使用 `gh auth login --web` 的浏览器设备流程，完成后使用 `gh auth status --hostname github.com` 验证；不把 token 写入命令行、脚本、文件或日志。
- 远程信息使用 `gh repo view JackSmith111977/Lims --json nameWithOwner,defaultBranchRef,isPrivate,viewerPermission` 核对，避免把分支推到错误仓库。
- Git 只提交已审阅的文件：`git add <explicit-paths>`、`git commit -m "<type>(<scope>): <summary> [<spec-id>]"`，再执行 `git push -u origin <branch>`。
- Draft PR 使用 `gh pr create --draft --repo JackSmith111977/Lims --base <default-branch> --head <branch> --title <title> --body-file <temp-body-file>`；正文写明变更、原因、用户影响、验证和已知风险。

官方参考：

- [GitHub CLI Windows 安装](https://github.com/cli/cli/blob/trunk/docs/install_windows.md)
- [`gh auth login`](https://cli.github.com/manual/gh_auth_login)
- [`gh auth status`](https://cli.github.com/manual/gh_auth_status)
- [`gh repo view`](https://cli.github.com/manual/gh_repo_view)
- [`gh pr create`](https://cli.github.com/manual/gh_pr_create)
- [推送提交到远程仓库](https://docs.github.com/en/get-started/using-git/pushing-commits-to-a-remote-repository)

## 本轮执行记录

- 目标仓库已由用户确认：`JackSmith111977/Lims`。
- 当前本地分支：`feature/FR-DATA-001-record-results`。
- 当前工作区包含上一轮 MVP/业务模块改动和本轮导航改动；提交前逐文件审阅，`tmp/` 运行产物不纳入提交。
- 当前状态：`origin` 已写入本地 Git 配置；本地已有 `main` 基线分支，且为当前功能分支的祖先；本轮暂存区已审阅，76 个项目文件将提交，`.env*` 与 `tmp/` 未纳入。
- 当前阻塞：远程仓库为空，尚无默认分支；需先推送 `main` 基线，再推送当前功能分支。自动化执行环境不能读取或转移用户终端 token；本轮尚未创建提交、推送或 PR。

## 暂停条件

- `gh` 未安装或未认证。
- 工作区存在无法确认归属的无关改动。
- 远程仓库地址、默认分支或当前分支关系不明确。
- 质量门禁或一致性检查失败。
