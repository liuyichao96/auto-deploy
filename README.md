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

创建 GitHub App 并配置最小权限后，将 App ID、私钥和 Webhook secret 放入环境变量；飞书 Webhook 和 Review Provider 也只通过环境变量配置。仓库不会保存任何密钥。没有外部账号时可使用默认 mock Review 与飞书 dry-run。

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
