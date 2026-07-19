# 实验室信息管理系统（LIMS）

面向高校科研实验室的 Web 信息管理系统，围绕“项目/任务 → 样品 → 实验执行 → 数据处理 → 结果审核 → 报告归档”形成可追溯闭环。

项目采用 Next.js App Router、React、TypeScript、Tailwind CSS、Supabase Auth 和 Supabase PostgreSQL。系统需求的唯一事实源是 [`specs/001-lims-core/spec.md`](specs/001-lims-core/spec.md)，开发过程遵循 [`docs/sdd/README.md`](docs/sdd/README.md) 的 SDD 流程。

## 功能范围

- 用户、角色、权限、管理员和操作审计
- 实验室人员、科研项目、实验方法、实验任务和任务分配
- 样品登记、样品流转和任务关联
- 实验数据录入、CSV/XLSX 导入、处理规则和结果审核
- 报告生成、报告模板、状态流转、追溯和签名回执
- 仪器设备、模拟仪器数据、维护记录、试剂耗材和库存预警
- 设施环境记录、数据看板和按权限过滤的统计信息

真实仪器硬件控制、跨实验室多租户、ERP/MES 等外部系统联调和商业级合规电子签名不属于当前基础交付范围；相关能力通过模拟数据、文件导入或接口预留支持后续扩展。

## 环境要求

- Git
- Node.js 24.x（项目当前验证版本为 `v24.1.0`；Next.js 当前最低要求为 Node.js 20.9）
- npm 11.x
- 一个你有权限使用的 Supabase 项目

本项目默认使用远程 Supabase，不要求安装 Docker 或运行本地 Supabase 数据库。Supabase CLI 已作为项目开发依赖安装，执行 `npm ci` 后即可使用。

## 从 GitHub 拉取

### 当前 MVP 版本尚未合并时

当前完整 MVP 收尾版本位于功能分支 `feature/FR-DATA-001-record-results`，对应 Draft PR [#1](https://github.com/JackSmith111977/Lims/pull/1)：

```bash
git clone --branch feature/FR-DATA-001-record-results https://github.com/JackSmith111977/Lims.git
cd Lims
```

### PR 合并后

```bash
git clone https://github.com/JackSmith111977/Lims.git
cd Lims
git checkout main
```

如果已经克隆过仓库：

```bash
git fetch origin
git checkout feature/FR-DATA-001-record-results
git pull --ff-only
```

PR 合并后，将上面的分支名替换为 `main`。

## 安装依赖

推荐使用锁文件安装，确保依赖版本可复现：

```bash
npm ci
```

Windows PowerShell 如果提示禁止执行 `npm.ps1`，使用 Node.js 自带的命令包装器：

```powershell
npm.cmd ci
```

仓库不再写死任何个人代理。如果所在网络需要代理，只在本机配置，不要把代理地址提交到仓库：

```bash
npm config set proxy http://127.0.0.1:7890
npm config set https-proxy http://127.0.0.1:7890
```

不再需要代理时可清除：

```bash
npm config delete proxy
npm config delete https-proxy
```

## 配置 Supabase

### 1. 创建或获取 Supabase 项目

从 Supabase Dashboard 创建项目，或向项目负责人获取已有项目的 Project URL、公开客户端 key、数据库密码和 service role key。Project URL 和公开客户端 key 可在 Supabase 项目的 Connect/API 页面获取；Supabase 的 Next.js Auth 配置说明见[官方文档](https://supabase.com/docs/guides/auth/quickstarts/nextjs)。

### 2. 创建本地环境文件

在项目根目录执行：

```bash
cp .env.example .env.local
```

Windows PowerShell：

```powershell
Copy-Item .env.example .env.local
```

编辑 `.env.local`：

```dotenv
# 浏览器和服务端都需要
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<Supabase 的 anon 或 publishable public key>

# 仅服务端使用；管理员初始化和用户管理需要
SUPABASE_SERVICE_ROLE_KEY=<Supabase service_role secret key>
```

注意：代码读取的变量名必须保持为 `NEXT_PUBLIC_SUPABASE_ANON_KEY`。Supabase 控制台可能将这类公开客户端密钥标记为 anon key 或 publishable key，请将对应公开 key 填入该变量。`.env.local` 已被 Git 忽略，禁止提交、截图或发送其中的 service role key。

### 3. 应用数据库迁移

首次使用新建的远程 Supabase 项目时，先登录 CLI、绑定项目并预览迁移：

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npm run supabase:migrations
npm run supabase:dry-run
```

确认 dry-run 只包含预期迁移后，再执行：

```bash
npm run supabase:push
```

Windows PowerShell 对应写法：

```powershell
npx.cmd supabase login
npx.cmd supabase link --project-ref <project-ref>
npm.cmd run supabase:migrations
npm.cmd run supabase:dry-run
npm.cmd run supabase:push
```

`supabase link` 和 `supabase db push` 需要远程项目权限；数据库密码按 CLI 提示输入，不要写入命令历史。迁移通过 [`supabase/migrations/`](supabase/migrations/) 管理，官方流程见 [Supabase Database Migrations](https://supabase.com/docs/guides/local-development/database-migrations) 和 [`supabase db push`](https://supabase.com/docs/reference/cli/supabase-db-push)。

安全边界：只对自己负责的开发、测试或生产项目执行 `supabase:push`；不要对生产项目执行 `supabase db reset --linked`，也不要直接在 Dashboard 修改已由 migration 管理的结构。若远程已有未纳入本仓库的表结构，先停止并由维护者执行 `supabase db pull`、审阅生成的 migration 后再继续。

### 4. 初始化第一个管理员

系统没有公开注册页面。首次启用时，使用服务端 service role key 运行受控初始化脚本；后续用户由管理员在 `/admin/users` 创建。

PowerShell：

```powershell
$env:BOOTSTRAP_ADMIN_EMAIL = "admin@example.com"
$env:BOOTSTRAP_ADMIN_PASSWORD = "请使用至少 8 位的正式强密码"
npm.cmd run bootstrap:admin
Remove-Item Env:BOOTSTRAP_ADMIN_EMAIL -ErrorAction SilentlyContinue
Remove-Item Env:BOOTSTRAP_ADMIN_PASSWORD -ErrorAction SilentlyContinue
```

脚本入口是 [`scripts/ops/bootstrap-admin.mjs`](scripts/ops/bootstrap-admin.mjs)，完整说明见 [`docs/ops/initial-admin-bootstrap.md`](docs/ops/initial-admin-bootstrap.md)。如果邮箱对应的 Auth 用户已经存在，脚本不会重置其密码，只会补齐业务资料和 `SYSTEM_ADMIN` 角色。

当前测试环境可使用以下非生产测试账号：

| 项目 | 值 |
| --- | --- |
| 邮箱 | `test@qq.com` |
| 初始密码 | `test1234` |
| 角色 | `SYSTEM_ADMIN` |

该账号只用于当前测试项目、联调和功能验收。正式启用时必须修改上面 PowerShell 命令中的 `BOOTSTRAP_ADMIN_EMAIL`、`BOOTSTRAP_ADMIN_PASSWORD`，并按组织策略在首次登录后更换密码；正式密码不得写入 README、脚本源码、环境文件或日志。

## 启动开发服务器

完成环境变量和数据库迁移后：

```bash
npm run dev
```

Windows PowerShell：

```powershell
npm.cmd run dev
```

打开 <http://localhost:3000/login>，使用已初始化的管理员账号登录。登录后进入 `/dashboard`；如果直接访问根路径，应用会按当前认证状态跳转。

端口被占用时：

```bash
npm run dev -- --port 3001
```

## 生产构建与本地预览

```bash
npm run build
npm run start
```

Windows PowerShell：

```powershell
npm.cmd run build
npm.cmd run start
```

生产预览默认使用 <http://localhost:3000>。部署到其他域名时，还需在 Supabase Auth 的 URL Configuration 中加入实际站点 URL 和回调地址。

## 验证项目是否正常

提交或发布前建议依次执行：

```bash
npm run test
npm run lint
npm run build
npm run test:e2e
npm run check:versioning
```

Windows PowerShell：

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run build
npm.cmd run test:e2e
npm.cmd run check:versioning
```

`test:e2e` 会在执行前使用生产构建启动 Next.js；如需手动指定端口，可设置 `PLAYWRIGHT_PORT` 和 `PLAYWRIGHT_BASE_URL`。部分需要真实登录或远程数据的集成脚本还需要对应 Supabase 环境变量和已授权的远程项目，不属于纯本地单元测试。

## 常用命令

| 命令 | 用途 |
| --- | --- |
| `npm run dev` | 启动开发服务器 |
| `npm run build` | 生成 Webpack 生产构建 |
| `npm run start` | 启动生产构建 |
| `npm run test` | 运行 Vitest 单元测试 |
| `npm run test:e2e` | 运行 Playwright 浏览器测试 |
| `npm run lint` | 执行 ESLint |
| `npm run bootstrap:admin` | 受控初始化首个管理员 |
| `npm run supabase:migrations` | 查看本地/远程 migration 状态 |
| `npm run supabase:dry-run` | 预览待应用的远程 migration |
| `npm run supabase:push` | 应用待执行的远程 migration |
| `npm run check:versioning` | 检查版本、变更日志和 migration 记录 |

## 常见问题

### `npm` 提示禁止运行 `npm.ps1`

这是 PowerShell 执行策略问题，不是项目依赖错误。改用 `npm.cmd`，例如 `npm.cmd ci`、`npm.cmd run dev`。

### 页面提示缺少 Supabase 环境变量

确认 `.env.local` 位于项目根目录，变量名与 [`.env.example`](.env.example) 完全一致，然后停止并重新启动开发服务器。不要把 service role key 放入任何 `NEXT_PUBLIC_*` 变量。

### 能打开页面但登录返回 401/503

依次检查：

1. `NEXT_PUBLIC_SUPABASE_URL` 是否属于当前项目。
2. 公开客户端 key 是否匹配该项目。
3. 目标项目是否已完成全部 migration。
4. Supabase Auth URL Configuration 是否允许 `http://localhost:3000`。
5. 测试账号是否存在且邮箱状态满足目标项目的 Auth 配置。

### `/admin/users` 无法创建用户

确认 `.env.local` 已配置正确的 `SUPABASE_SERVICE_ROLE_KEY`，并且只在服务端使用；更换环境变量后必须重启 Next.js。不要尝试在浏览器端使用 service role key。

### `supabase db push` 报 migration history 不一致

先执行：

```bash
npx supabase migration list --linked
```

不要直接执行 `migration repair` 或 `db reset --linked`。先确认远程项目、远程历史和本地 migration 的差异，并由项目维护者决定是 `db pull`、补充 migration 还是修复历史。

## 项目文档

- [核心 Spec 入口](specs/README.md)
- [核心系统 Spec](specs/001-lims-core/spec.md)
- [SDD 开发流程](docs/sdd/README.md)
- [首个管理员初始化](docs/ops/initial-admin-bootstrap.md)
- [演示运行手册](docs/demo/demo-runbook.md)
- [发布计划与远程仓库记录](docs/ops/github-publish-plan.md)
- [变更日志](CHANGELOG.md)

## 安全提醒

- `.env.local`、service role key、数据库密码、Supabase CLI token 和正式管理员密码不得提交到 Git。
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` 会进入客户端构建，权限安全依赖 Supabase RLS；不要把 service role key 放到任何 `NEXT_PUBLIC_*` 变量。
- 生产环境不要使用 README 中的测试账号，不要执行演示数据 seed/cleanup 脚本。
