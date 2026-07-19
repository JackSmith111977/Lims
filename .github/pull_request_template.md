## 变更类型

- [ ] 新功能
- [ ] 缺陷修复
- [ ] 重构
- [ ] 文档 / Spec / SDD
- [ ] 依赖、构建或发布维护

## 追踪关系

- Spec / NFR / AC ID：
- Plan / Design / Task ID：
- 关联 Issue / PR：

## 变更说明

<!-- 说明变更结果、范围、未包含的内容和已知风险。不要只粘贴提交列表。 -->

## 数据与接口影响

- [ ] 无数据库 migration
- [ ] 有 migration，已说明执行顺序、回滚/向前修复方式和验证结果
- [ ] 无 API 契约变化
- [ ] 有 API 契约变化，已同步 `api-contract.md` 和 OpenAPI
- [ ] 无环境变量变化
- [ ] 有环境变量变化，已同步 README、部署和回滚说明

## 验证证据

```text
# 粘贴实际执行的命令和结果摘要
```

- [ ] `npm run lint`
- [ ] `npm run test`
- [ ] `npm run build`
- [ ] `scripts/sdd/check-consistency.ps1`
- [ ] `scripts/sdd/check-versioning.ps1`
- [ ] 远程 Supabase migration / 集成验证（如适用）
- [ ] 正常流程和至少一个异常流程已验证

## 对抗性审查

- [ ] 已检查权限、RLS、审计、越权和敏感数据泄露
- [ ] 已检查并发、重复提交、非法状态、失败重试和恢复路径
- [ ] 已检查旧入口、冲突设计、兼容性和回滚影响
- [ ] P0/P1 问题已关闭或有明确批准的豁免

## 发布与回滚

- 版本影响：`PATCH` / `MINOR` / `MAJOR` / 无版本变化
- CHANGELOG：
- 回滚方式：
- 已知限制：

## 提交前确认

- [ ] 没有提交 `.env.local`、密钥、生产数据或构建产物
- [ ] 已同步 Spec、Plan、Tasks、traceability 和相关测试依据（如适用）
- [ ] 已更新 CHANGELOG（如属于可发布变更）
