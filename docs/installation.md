# 安装

1. 安装 Node.js 22、Git 和 Docker（Docker 仅在需要 Webhook 容器时使用）。
2. 在空目录运行 `npm install`。
3. 运行 `npm run devflow -- init --docker`。
4. 按 `devflow.yaml` 调整命令，再运行 `npm run devflow -- test`。
5. 运行 `npm run devflow -- preview` 并打开终端显示的地址。

接入 GitHub 时创建 App、配置 Webhook URL 和 `GITHUB_WEBHOOK_SECRET`；接入飞书时配置 `FEISHU_WEBHOOK_URL`。没有这些账号时使用 mock/dry-run 不影响本地工作流。

## 云服务器部署

服务器已提供 `deploy/docker-compose.server.yml`，用于和已有 Nginx 共享网络：

```bash
docker compose -f docker-compose.yml -f deploy/docker-compose.server.yml up -d
```

健康检查地址为 `/devflow/healthz`。GitHub Webhook 正式使用前，应给 Nginx 配置域名和 HTTPS，并设置 `GITHUB_WEBHOOK_SECRET`；当前服务器部署未写入任何真实密钥。
