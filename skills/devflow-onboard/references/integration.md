# Devflow 接入边界

## 组件职责

共享 Webhook 服务位于 `http://43.142.20.161/devflow/webhooks/github`，负责：

- 校验 `X-Hub-Signature-256`；
- 按 `X-GitHub-Delivery` 去重；
- 记录不含请求正文的事件审计；
- 按需把 `pull_request` 摘要发送到飞书。

它不会替客户端执行安装、测试、AI Review 或合并。客户端仓库需要自己的 GitHub Actions；这些 Actions 负责 CI、Review 发布和按策略请求 GitHub 原生 auto-merge。

## 接入后的最小客户端文件

- `AGENTS.md`：给 Codex 的项目规则和安全边界；
- `devflow.yaml`：项目命令、预览、Review 和合并策略；
- `.github/workflows/ci.yml`：安装依赖并执行项目检查；
- `.github/workflows/review.yml`：生成结构化 Review 结果；
- `.github/workflows/review-publish.yml`：发布 Check 和可更新评论；
- `.github/workflows/auto-merge.yml`：仅在项目明确启用无人值守模式时使用。

## 权限与 Secret

GitHub Webhook Secret 是共享服务与 GitHub 之间的签名密钥。它不属于客户端源代码，也不应写入 `devflow.yaml`、Actions 文件、PR 描述或日志。接入 Skill 只能在用户确认后读取一次并直接提交到 GitHub Webhook API。

当前服务使用 IP over HTTP，适合现有环境验证；正式推广前应改为固定 HTTPS 域名，并同步更新 Skill 的 endpoint 配置。
