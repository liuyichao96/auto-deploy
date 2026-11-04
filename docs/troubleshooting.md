# 排障

- **命令失败**：查看 `devflow test` 输出的阶段和原始错误，单独运行该命令后再重试。若出现 `EBADENGINE`，请切换到 Node.js 22；若出现 Windows `EPERM unlink`，先关闭仍在运行的测试、预览或编辑器进程。
- **端口占用**：修改 `preview.port` 或停止占用进程。
- **健康检查超时**：确认开发服务监听 `PORT` 环境变量，并把 `preview.healthPath` 改成可返回 2xx 的地址。
- **Webhook 401**：确认 secret 完全一致，且反向代理没有修改请求体。
- **Review JSON 错误**：Provider 必须只返回结构化 JSON；检查模型响应或切换 mock/Ollama。
- **未自动合并**：检查 CI、P0/P1、未解决对话和人工审批；AI 不能绕过这些条件。
- **飞书失败**：确认机器人权限和 URL，系统会指数退避重试；本地可切换 dry-run。
- **只接收 Webhook**：保持 `FEISHU_WEBHOOK_URL` 为空即可，GitHub 事件仍会验签并写入审计文件，不会向外发送通知。
