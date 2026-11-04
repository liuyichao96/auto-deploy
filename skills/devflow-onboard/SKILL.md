---
name: devflow-onboard
description: 接入 GitHub 项目到 Devflow 时使用：读取仓库地址，分析项目与现有 CI，生成可审阅的接入变更，并在确认后配置共享 Webhook 和 GitHub 设置。
metadata:
  short-description: 自动分析并接入 GitHub 项目
---

# Devflow GitHub 项目接入

当用户提供 GitHub 仓库地址并要求接入、配置或初始化 Devflow 时，按本流程执行。先读取 [integration.md](references/integration.md) 了解共享 Webhook 与客户端工作流的边界。

## 授权与边界

- 使用本机 `gh` CLI；第一步执行 `gh auth status`。未登录时停止并说明需要用户先运行 `gh auth login`。
- 只处理用户提供的仓库。不要猜测、遍历或批量修改其他仓库。
- 不读取、打印、提交或写入任何密钥。Webhook Secret 只能在用户确认后运行时安全输入，并且不能放入命令参数、日志、PR 或文件。
- 先分析并展示计划，再创建分支、修改文件和创建 Draft PR。外部 GitHub 设置（Webhook、Variables、分支保护、自动合并）必须在用户一次明确确认后执行。
- 共享 Webhook 只接收 GitHub 事件；CI、Review 和合并由客户端仓库的 GitHub Actions 执行。不要在客户端再次部署 Webhook 容器。
- 现有服务地址为 `http://43.142.20.161/devflow/webhooks/github`。使用前提示这是 HTTP IP 地址，生产环境应迁移到 HTTPS 域名。

## 工作流

### 1. 识别仓库并生成报告

从用户消息提取 `https://github.com/<owner>/<repo>` 或 SSH GitHub URL，去掉末尾的 `.git`、路径和查询参数。无法唯一识别仓库时停止并询问用户。

执行：

```text
gh auth status
gh repo view <owner>/<repo> --json nameWithOwner,defaultBranchRef,isPrivate,url
```

将仓库克隆到临时目录；如果当前工作区已经是该仓库，直接使用当前工作区。不要把临时目录中的密钥文件或 `.env*` 内容读入报告。

运行只读分析器：

```text
python skills/devflow-onboard/scripts/analyze_repo.py <repo-path> --json
```

报告至少包括：默认分支、语言、包管理器、运行时版本、安装/检查/测试/构建命令、已有工作流、已有 Devflow 文件、是否已接入，以及无法安全推断的项目特征。

### 2. 设计最小变更

- 已有 `devflow.yaml`、`AGENTS.md` 或工作流时，先展示差异并保留用户自定义内容；不要用模板覆盖整个文件。
- Node 项目优先采用仓库已有的包管理器和 `package.json` scripts。没有对应脚本时保留为空，并在报告中说明。
- 识别 `package-lock.json`、`pnpm-lock.yaml`、`yarn.lock`、`bun.lockb` 时分别使用对应的安装命令；不要强行改成 npm。
- 从 `engines.node`、`.nvmrc`、`.node-version` 或 `.tool-versions` 读取 Node 版本。没有版本信息时使用项目默认的 Node 22，并在 PR 中标注该假设。
- 已有 CI 工作流时只补充缺失的 Devflow 检查；避免创建重复的 CI、Review 或发布工作流。
- 非 Node 项目先输出适配方案。只有能从现有清单和脚本安全推断命令时才生成配置，否则停止在报告阶段，不提交猜测性的工作流。

### 3. 创建接入分支和 Draft PR

在用户已看到报告后：

1. 创建专用分支，分支名应包含 `devflow-onboard`，并保留用户已有修改。
2. 写入或最小化更新 `AGENTS.md`、`devflow.yaml` 和 `.github/workflows`。
3. 运行分析报告中的安装、lint、typecheck、test、build 命令；没有命令的步骤标记为未配置，不伪造通过结果。
4. 检查 `git diff --check` 和变更范围，只保留接入相关文件。
5. 提交 Conventional Commit，并创建 Draft PR。PR 描述必须包含 Summary、Changes、Validation、Risks and Compatibility。

将 PR 地址、文件变更、实际验证结果和未完成事项展示给用户，等待用户审阅确认后再执行 GitHub 设置变更。

### 4. 用户确认后的 GitHub 设置

使用 `gh api` 做幂等更新：

- 查询现有 Webhook；若 URL、事件和 active 状态正确则复用，否则更新；不存在则创建。
- 默认只配置 `pull_request` 事件，除非用户明确要求其他事件。
- 如果仓库配置明确启用无人值守合并，再设置 `DEVFLOW_MERGE_STRATEGY`；不要擅自把人工审批改成自动合并。
- 分支保护只补充 PR 中声明的 required checks 和 review 要求，不清除已有保护规则。
- Secret 通过安全输入读取，构造临时请求体或 stdin，操作完成后立即删除临时数据；禁止把 Secret 放入 shell 历史、输出或 GitHub Actions 文件。

完成后重新读取设置确认结果，输出：PR 地址、Webhook 是否复用/创建/更新、配置的事件、变量和分支保护变化，以及仍需人工完成的事项。

## 停止条件

遇到以下任一情况时停止外部修改并报告原因：`gh` 未登录或权限不足、仓库地址不明确、检测到未提交用户修改无法安全隔离、项目命令无法推断、Webhook Secret 未提供、GitHub API 返回错误，或用户未确认设置变更。
