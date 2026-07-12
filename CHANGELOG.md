# Changelog

所有重要变更都记录在本文件。版本遵循 [Semantic Versioning](https://semver.org/)。

## [Unreleased]

### Next

- 完成测试用户创建、用户/角色管理页面和业务模块接入。

## [0.1.0] - 2026-07-12

### Added

- 建立统一 Spec、SDD 流程、质量门禁和一致性检查。
- 初始化 Next.js、TypeScript、Tailwind CSS、Supabase Auth 和 Supabase PostgreSQL 技术栈。
- 建立登录、退出、会话刷新和 `/dashboard` 路由保护。
- 部署初始数据库 migration `202607120001`。
- 部署 RBAC migration `202607120003`，包含角色、权限、RPC 和基础 RLS 策略。
- 接入 Supabase CLI、项目级只读 MCP 配置和远程数据库 TypeScript 类型生成。
