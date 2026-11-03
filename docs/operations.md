# 运维

Webhook 服务运行：`npm run webhook`，默认监听 `8787`。生产环境应放在 HTTPS 反向代理后，设置 `GITHUB_WEBHOOK_SECRET`，并保存结构化访问日志和 delivery 审计记录。

合并策略可在 `devflow.yaml` 中选择 `manual`、`auto_after_human_approval` 或 `auto_after_ai_and_ci`。建议保留默认值，并在 GitHub 分支保护中要求 CI、Review 和人工审批。

## Smoke test

本段用于验证 GitHub Actions 与 Webhook 编排。

