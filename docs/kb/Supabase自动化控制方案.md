# Supabase 自动化控制方案

| 项目 | 结论 |
| --- | --- |
| 研究对象 | Supabase CLI、Supabase 官方 MCP Server |
| 当前项目 | LIMS，项目 ref：`fofjsknqdrmgyxtxwxwo` |
| 采用方案 | CLI 负责迁移和 CI/CD；MCP 负责 AI 辅助查询与文档检索 |
| 安全默认值 | MCP 使用项目范围 + `read_only=true`；生产写操作不通过 MCP |

## 1. Supabase CLI

CLI 适合可复现的工程操作：本地 Supabase、migration、`db push`、migration 状态、数据库 diff、项目管理和 TypeScript 类型生成。

项目已安装 Supabase CLI `2.109.1`，配置文件为 `supabase/config.toml`，常用命令已写入 `package.json`：

```powershell
npx supabase login
npx supabase link --project-ref fofjsknqdrmgyxtxwxwo
npm run supabase:dry-run
npm run supabase:push
npm run supabase:migrations
npm run supabase:types > src/types/database.ts
```

CLI 的登录授权和远程数据库密码不能用前端 publishable key 替代。当前 dry-run 的状态是未完成 `supabase link`，需要用户在本机完成一次登录授权后才能继续。

## 2. 官方 Supabase MCP

项目根目录已生成 `.mcp.json`，配置为项目范围、只读、database + docs 功能：

```json
{
  "mcpServers": {
    "supabase": {
      "type": "http",
      "url": "https://mcp.supabase.com/mcp?project_ref=fofjsknqdrmgyxtxwxwo&read_only=true&features=database,docs"
    }
  }
}
```

MCP 适合让 AI 查询数据库、检查结构、搜索 Supabase 文档和辅助调试。它目前属于 Public Alpha，不应直接连接生产数据；如需写操作，应优先通过代码审查后的 migration 和 CLI 执行。

## 3. 项目工作流

```text
需求/设计
  ↓
supabase/migrations/*.sql
  ↓
supabase db reset（本地验证）
  ↓
supabase db push --dry-run
  ↓
supabase db push（受控部署）
  ↓
supabase gen types
```

MCP 只作为查询、检查和调研入口，不作为迁移事实源。所有结构变更仍必须进入 migration 文件，并经过 lint、dry-run、审查和一致性检查。

## 4. 官方参考

- https://supabase.com/docs/guides/local-development/cli/getting-started
- https://supabase.com/docs/reference/cli/supabase-db-push
- https://supabase.com/docs/guides/deployment/database-migrations
- https://supabase.com/docs/guides/ai-tools/mcp
- https://supabase.com/features/mcp-server
