# 运维

Webhook 服务运行：`npm run webhook`，默认监听 `8787`。服务器通过 `GITHUB_WEBHOOK_SECRET` 校验签名，并将接收的事件摘要追加到 `GITHUB_AUDIT_FILE`（默认 `.devflow/webhook-audit.jsonl`）。delivery ID 在进程内去重；服务重启后可通过审计文件追踪历史投递。生产环境应放在 HTTPS 反向代理后，并限制管理端口只监听本机。

合并策略可在 `devflow.yaml` 中选择 `manual`、`auto_after_human_approval` 或 `auto_after_ai_and_ci`。建议保留默认值，并在 GitHub 分支保护中要求 CI、Review 和人工审批。
