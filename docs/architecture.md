# 架构

项目是 npm workspaces monorepo。CLI 负责本地初始化、检查和预览；Webhook 服务接收 GitHub 事件；config、github、feishu、review、preview 包分别隔离配置、平台 API、通知、模型和进程生命周期。

GitHub 通过 App installation token 调用 API，Webhook 通过 HMAC 签名和 delivery ID 去重，并把不含正文和 diff 的事件摘要写入审计文件。配置 `FEISHU_WEBHOOK_URL` 后，只有 Pull Request 事件摘要可按项目路由到飞书卡片；`workflow_run` 和 `check_run` 等 CI 生命周期事件会被忽略，避免同一个 PR 产生多张重复卡片；留空时保持接收-only 模式。Review Provider 只返回结构化 JSON，合并策略由独立策略函数判断。默认流程是 CI 通过、无 P0/P1、对话解决、至少一名人工审批，然后请求 GitHub auto-merge。

所有 Provider 都有接口和 dry-run 实现，方便替换为 Ollama、其他 Git 平台或其他通知渠道。
