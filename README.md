# 实验室信息管理系统（LIMS）

面向科研实验室的样品、实验任务、数据、审核、报告和资源管理系统。本项目采用 Next.js App Router、TypeScript、Tailwind CSS、Supabase Auth 和 Supabase PostgreSQL，需求与设计以 [`specs/001-lims-core/`](specs/001-lims-core/) 为唯一事实源。

## 本地启动

环境要求：Node.js 24.x、npm 11.x。项目根目录的 `.npmrc` 已配置本机 `127.0.0.1:7890` 代理；如代理未启动，依赖安装可能失败。

```powershell
npm install
Copy-Item .env.example .env.local
# 编辑 .env.local，填入 Supabase 项目 URL 和 anon key
npm run dev
```

打开 <http://localhost:3000> 查看工作台，登录入口为 `/login`。

## 测试账号（仅测试环境）

当前 MVP 测试环境的固定测试管理员种子如下，账号具有 `SYSTEM_ADMIN` 角色：

| 项目 | 值 |
| --- | --- |
| 邮箱 | `test@qq.com` |
| 初始密码 | `test1234` |
| 用途 | 本地联调、功能验收和当前测试项目验证 |

该账号和密码不是生产凭据。正式启用前必须替换为组织指定的管理员账号和强密码。切换入口不是把凭据写死在代码中，而是运行 [`scripts/ops/bootstrap-admin.mjs`](scripts/ops/bootstrap-admin.mjs) 时提供以下两个环境变量：

```powershell
$env:BOOTSTRAP_ADMIN_EMAIL = "正式管理员邮箱"
$env:BOOTSTRAP_ADMIN_PASSWORD = "正式管理员强密码"
npm.cmd run bootstrap:admin
Remove-Item Env:BOOTSTRAP_ADMIN_EMAIL -ErrorAction SilentlyContinue
Remove-Item Env:BOOTSTRAP_ADMIN_PASSWORD -ErrorAction SilentlyContinue
```

对应脚本读取位置为 `BOOTSTRAP_ADMIN_EMAIL` 和 `BOOTSTRAP_ADMIN_PASSWORD`；完整操作说明见 [`docs/ops/initial-admin-bootstrap.md`](docs/ops/initial-admin-bootstrap.md)。正式部署时不要继续使用本节测试种子，也不要将正式密码写入 README、脚本源码、环境文件或日志。

隔离演示环境的 `demo-admin@example.invalid`、`demo-operator@example.invalid` 和 `demo-reviewer@example.invalid` 仍遵循“临时密码不入库”规则，详见 [`docs/demo/demo-runbook.md`](docs/demo/demo-runbook.md)。

## 常用命令

```powershell
npm run lint       # ESLint
npm run test       # Vitest 单元测试（暂允许无测试文件）
npm run build      # Next.js Webpack 生产构建
npm run test:e2e   # Playwright 浏览器测试（先执行 npm run build）
```

当前 Windows x64 环境下原生 SWC 存在兼容性警告，因此生产构建脚本固定使用 `next build --webpack`，并通过 WASM 回退完成验证。

## 数据库迁移

首个迁移文件为 [`supabase/migrations/202607120001_initial_schema.sql`](supabase/migrations/202607120001_initial_schema.sql)，包含核心业务表、索引、RLS 开关、用户档案触发器和最小用户自查策略。

项目已接入 Supabase CLI，并生成 `supabase/config.toml`。首次使用远程项目时，在项目根目录执行：

```powershell
npm run supabase:status
npx supabase login
npx supabase link --project-ref fofjsknqdrmgyxtxwxwo
npm run supabase:dry-run
npm run supabase:push
```

迁移状态和类型生成：

```powershell
npm run supabase:migrations
npm run supabase:types > src/types/database.ts
```

迁移命令需要 Supabase CLI 登录授权和远程数据库密码；前端 `.env.local` 中的 publishable key 不能替代这些管理凭据。迁移执行结果需要回填到 Spec 和任务记录中。

项目还提供了只读、项目范围内的 Supabase MCP 配置：`.mcp.json`。它用于 AI 辅助查询数据库和文档，不用于生产环境写操作。

## 文档入口

- [统一 Spec](specs/README.md)
- [SDD 开发流程](docs/sdd/README.md)
- [毕业设计任务清单](docs/task/毕业设计开发任务清单.md)
- [技术栈选型分析](docs/kb/技术栈选型分析.md)
