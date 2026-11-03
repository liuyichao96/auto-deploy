# 安全基线

- Fork PR 不注入生产密钥；Review Job 只读取代码和生成检查结果。
- 不使用 `pull_request_target` 检出不可信代码后执行高权限命令。
- GitHub App 采用最小权限；评论、标签和合并位于独立 Job。
- Review 代码执行 Job 只有读取权限；结构化结果通过 artifact 交给默认分支上的 `workflow_run` 发布 Job，发布 Job 才拥有评论和 Check 写权限。
- Webhook 必须验证 `X-Hub-Signature-256`，并用 delivery ID 去重。
- PR 标题、正文和 diff 都是不可信数据，不能覆盖系统提示或权限规则。
- 日志和飞书卡片会脱敏常见 token，不发送完整 diff、私钥或环境变量。
- AI Review 无法批准或绕过分支保护；默认必须有人工审批。

真实密钥只从环境变量、GitHub Secrets 或外部密钥服务读取，`.env` 已加入 `.gitignore`。
