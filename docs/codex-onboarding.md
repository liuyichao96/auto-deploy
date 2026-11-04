# 用 Codex 接入 GitHub 项目

项目内的 `skills/devflow-onboard` 是可安装的 Codex Skill。安装后，用户可以直接把目标仓库地址交给 Codex：

```text
请使用 $devflow-onboard 接入这个项目：
https://github.com/owner/repo
```

Skill 会先检查本机 `gh` 登录状态，读取仓库清单、默认分支、包管理器、运行时版本、已有 CI 和 Devflow 文件，再展示拟议变更。它会在专用分支中生成或最小化更新配置，运行项目检查，并创建 Draft PR。

## 使用前准备

1. 安装 GitHub CLI 并完成 `gh auth login`。
2. 确认 Codex 能访问包含 Skill 的目录。
3. 确认现有共享 Webhook 地址仍为 `http://43.142.20.161/devflow/webhooks/github`。
4. 准备好 Webhook Secret，但不要把它粘贴到仓库文件、PR 描述或普通聊天记录中。

用户审阅 Draft PR 并确认后，Skill 才会通过 `gh api` 幂等配置 Webhook、必要的 Actions Variables 和分支保护。Secret 只在运行时输入，不会保存到工作区或输出。

共享 Webhook 只负责验签、去重、审计和可选通知；客户端仓库的 GitHub Actions 负责 CI、AI Review 和合并策略。客户端不需要再次部署 Webhook 容器。

当前地址使用 IP over HTTP，仅适合现有环境验证。正式推广前应迁移到固定 HTTPS 域名，并同步更新 Skill 文档和配置。
