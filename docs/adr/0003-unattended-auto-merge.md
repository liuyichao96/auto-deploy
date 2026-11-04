# ADR 0003：无人值守合并策略

## 决策

平台保留 `auto_after_ai_and_ci` 作为显式可选策略。启用后，可信的 `workflow_run` Job 检查 CI、AI Review 和已解决对话，再请求 GitHub 原生 squash auto-merge。AI 不伪造人工审批。

## 原因

部分团队需要无人值守交付，但仍希望把权限动作放在默认分支工作流中，并由 GitHub 分支保护执行最终约束。仓库变量 `DEVFLOW_MERGE_STRATEGY` 防止 PR 修改合并策略。

## 限制

该模式会移除“至少一名人工审批”这一门槛，必须由仓库管理员明确设置并调整分支保护。Fork PR 不进入该自动合并路径。
