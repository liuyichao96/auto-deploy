# ADR 0001：Provider 抽象

状态：接受

GitHub、飞书和 AI Review 都通过接口隔离，默认实现使用公共 API，测试使用 mock。这样可以在不改动 CLI 和工作流的情况下替换 Ollama、其他 Git 平台或通知渠道。
