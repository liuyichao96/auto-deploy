# 产品需求

Devflow 让没有专业开发经验的人也能用 Codex、Claude Code 或 Cursor 完成一次可验证的开发任务。用户只需阅读 `AGENTS.md`，修改代码后运行 `devflow test` 和 `devflow preview`，再创建 Pull Request。

成功标准是：初始化可重复、失败信息可理解、预览地址可访问、CI 和 Review 状态可见，并且自动合并始终受人工审批和分支保护约束。

MVP 只提供本地预览；公网 PR Preview 通过 Preview Provider 作为第二阶段扩展。GitHub Free、OpenAI/Codex 账号权限、模型费用和飞书机器人权限由使用者承担，未配置时使用本地 dry-run。
