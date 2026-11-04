# 运维

Webhook 服务运行：`npm run webhook`，默认监听 `8787`。服务器通过 `GITHUB_WEBHOOK_SECRET` 校验签名，并将接收的事件摘要追加到 `GITHUB_AUDIT_FILE`（默认 `.devflow/webhook-audit.jsonl`）。delivery ID 在进程内去重；服务重启后可通过审计文件追踪历史投递。生产环境应放在 HTTPS 反向代理后，并限制管理端口只监听本机。

合并策略可在 `devflow.yaml` 中选择 `manual`、`auto_after_human_approval` 或 `auto_after_ai_and_ci`。无人值守模式还要求仓库管理员设置变量 `DEVFLOW_MERGE_STRATEGY=auto_after_ai_and_ci`；可信的 `workflow_run` Job 会检查 CI、AI Review 和未解决对话，然后只请求 GitHub 原生 squash auto-merge。AI 不提交伪造的人工 Approve，也不绕过分支保护。新项目默认使用 `auto_after_human_approval`。

AI Review 先在 PR Job 生成 `review-result.json`，再由 `review-publish.yml` 在可信的 `workflow_run` Job 中发布 Check 和可更新的 PR 评论。发布 Job 不检出 PR 分支代码。
