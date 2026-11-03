# 架构

项目是 npm workspaces monorepo。CLI 负责本地初始化、检查和预览；Webhook 服务接收 GitHub 事件；config、github、feishu、review、preview 包分别隔离配置、平台 API、通知、模型和进程生命周期。

GitHub 通过 App installation token 调用 API，Webhook 通过 HMAC 签名和 delivery ID 去重。Review Provider 只返回结构化 JSON，合并策略由独立策略函数判断。默认流程是 CI 通过、无 P0/P1、对话解决、至少一名人工审批，然后请求 GitHub auto-merge。

所有 Provider 都有接口和 dry-run 实现，方便替换为 Ollama、其他 Git 平台或其他通知渠道。
