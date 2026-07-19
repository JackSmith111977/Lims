# Changelog

所有重要变更都记录在本文件。版本遵循 [Semantic Versioning](https://semver.org/)。

## [Unreleased]

### Next

- 收敛 MVP 入口、首个管理员初始化、权限导航和业务模块接入。
- 优化工作台导航的视觉层级、信息密度和响应式点击体验。
- 建立分支命名检查、Pull Request 模板和 GitHub Actions 质量门禁。
- 明确从需求分支到发布 tag 的可复现版本管理和回滚流程。

## [0.1.0] - 2026-07-12

### Added

- 建立统一 Spec、SDD 流程、质量门禁和一致性检查。
- 初始化 Next.js、TypeScript、Tailwind CSS、Supabase Auth 和 Supabase PostgreSQL 技术栈。
- 建立登录、退出、会话刷新和 `/dashboard` 路由保护。
- 部署初始数据库 migration `202607120001`。
- 部署 RBAC migration `202607120003`，包含角色、权限、RPC 和基础 RLS 策略。
- 接入 Supabase CLI、项目级只读 MCP 配置和远程数据库 TypeScript 类型生成。
