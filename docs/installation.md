# 安装

1. 安装 Node.js 22、Git 和 Docker（Docker 仅在需要 Webhook 容器时使用）。
2. 在空目录运行 `npm install`。
3. 运行 `npm run devflow -- init --docker`。
4. 按 `devflow.yaml` 调整命令，再运行 `npm run devflow -- test`。
5. 运行 `npm run devflow -- preview` 并打开终端显示的地址。

接入 GitHub 时可以先只配置 Webhook：在仓库 Webhook 设置中填入服务地址和 `GITHUB_WEBHOOK_SECRET`。当前接收模式不需要 GitHub App、飞书或 OpenAI 密钥；这些 Provider 可以在后续需要时通过环境变量启用。没有外部账号时使用 mock/dry-run 不影响本地工作流。

## 云服务器部署

服务器已提供 `deploy/docker-compose.server.yml`，用于和已有 Nginx 共享网络：

```bash
docker compose -f docker-compose.yml -f deploy/docker-compose.server.yml up -d
```

健康检查地址为 `/devflow/healthz`，Webhook 地址为 `/devflow/webhooks/github`。服务器当前运行在 `http://43.142.20.161`，已配置随机 Webhook secret 并仅接收 GitHub 事件；Feishu、GitHub App 和 OpenAI 配置保持为空。生产使用前，应给 Nginx 配置域名和 HTTPS。接收事件审计记录写入容器内 `.devflow/webhook-audit.jsonl`，该目录已被 Git 忽略。
