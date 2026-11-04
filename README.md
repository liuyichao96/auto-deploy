# Devflow

Devflow 是面向非专业开发者的开源多人协作自动化开发平台。它把 Agent 规则、自动测试、本地预览、GitHub Pull Request、结构化 AI Review、飞书通知和安全合并策略放进同一个项目模板。

## 5 分钟开始

要求 Node.js 22 和 Git。安装依赖后，在项目目录运行：

```bash
npm install
npm run devflow -- init --docker
npm run devflow -- test
npm run devflow -- preview
```

初始化会生成 `AGENTS.md`、`devflow.yaml`、GitHub Actions 和项目 README。预览服务只在本机启动，终端会显示访问 URL。

## 真实 GitHub / 飞书连接

可以先只启用 GitHub Webhook 接收：服务会验签、去重并写入事件审计，不需要 GitHub App、飞书或 OpenAI 密钥。需要出站通知或 API 操作时，再通过环境变量配置 GitHub App、飞书 Webhook 和 Review Provider；仓库不会保存任何密钥。没有外部账号时可使用默认 mock Review 与飞书 dry-run。

当前示例服务器的 Webhook 地址是 `http://43.142.20.161/devflow/webhooks/github`，健康检查是 `http://43.142.20.161/devflow/healthz`。正式环境请使用域名和 HTTPS。

当前仓库已启用无人值守合并策略：AI Review 只生成结构化检查结果，CI 和 Review 均通过且对话已解决后，由可信的 `workflow_run` Job 请求 GitHub 原生 squash auto-merge。它不会伪造人工审批。仓库变量 `DEVFLOW_MERGE_STRATEGY=auto_after_ai_and_ci` 是显式开关；新项目默认仍要求人工审批。

## 文档

- [产品需求](docs/product-requirements.md)
- [架构](docs/architecture.md)
- [安全](docs/security.md)
- [安装](docs/installation.md)
- [运维](docs/operations.md)
- [排障](docs/troubleshooting.md)

## 开发

```bash
npm test
npm run typecheck
npm run build
```

项目使用 Apache-2.0。公网 PR Preview、真实 Codex 账号授权和云端密钥托管属于可插拔的后续能力。
