# Agent 本地环境与依赖清单

更新日期：2026-10-27。入口：`yarn agent:environment`，实现为 [scripts/agent-environment.mjs](../scripts/agent-environment.mjs)。用于任务开始前盘点当前基础设施 checkout 的本地条件，并列出尚需单独核验的服务和资源，减少重复查包、版本、浏览器与产物。

版本选择、根 Node 20 与个人工具 Node 22 的差异、API 声明及独立 checkout 准备顺序见[运行版本矩阵](agent-runtime-matrix.md)。清单中的版本是本机观察，不是跨版本兼容范围。

## 使用与状态

从个人基础设施 checkout 根目录执行，使用现有 Node 和锁定依赖：

```sh
yarn agent:environment
# Select only the local prerequisites required by this task.
yarn agent:environment --checks node,yarn,frontend
yarn agent:environment --checks sdk,sdk-artifacts,wasm
# Save a dated local observation explicitly.
mkdir -p .local/acceptance/agent-tools/environment
yarn agent:environment > .local/acceptance/agent-tools/environment/current.json
```

默认选择下表全部 9 个本地检查。`--checks` 为逗号分隔的精确名称，不接受空值、重复或未知项；未选择的本地项和全部外部项均保留在输出中。报告是缩进 JSON，人工可直接阅读；stdout 不混入子进程日志。重定向后仍核对最终退出码。

| 资源状态 | 含义 |
| --- | --- |
| `ready` | 本次该项注明的有限检查通过，不表示相关服务或业务可用 |
| `blocked` | 所选本地检查缺前置、失败、超时或结果不可识别；按 `next` 到原工具诊断 |
| `stale` | 本次确认安装版本偏离精确声明/SDK 测试运行器，或 SDK 产物核验报告来源、内容已变化；需要重新准备 |
| `not-checked` | 本次未检查，`checkedAt=null`；不是 ready，也不暗示过去曾经检查过 |

退出码 0 表示所有**选定本地项** ready 且清单输入身份前后一致；2 表示存在 blocked/stale 或输入身份变化；1 表示调用参数、仓库身份或证据采集错误。每个有效报告包含 `scope=agent-local-environment-inventory`、schemaVersion、selected、起止时间、逐项 checkedAt/code/next、前后身份和 `sourceUnchanged`。单项失败仍检查其他选定项；全局身份采集失败则只输出固定错误，不输出原始异常。

`environmentReadiness` 与 `requirementAcceptance` 固定为 `not-evaluated`。全局 status=ready 仅说明选定本地检查通过，不消除列表里的 not-checked。

## 当前检查范围

| `--checks` 名称 | 实际读取/执行 | 证明边界 |
| --- | --- | --- |
| `node` | 当前 Node major 是否为 22，记录完整版本 | 沿用现有 Agent 工具要求；不修改 `.nvmrc`，不宣称仓库所有命令已统一支持矩阵 |
| `yarn` | 仓库 `.yarnrc.yml` 指向的本地 Yarn release `--version`，与 packageManager 比较 | 不调用 Corepack 下载或安装，不证明锁文件完整性 |
| `frontend` | 根 Vite/Vitest/tsx/TypeScript 的精确声明、安装版本及根锁文件存在性 | 仅这些关键包的元数据，不验证整个依赖树或 package 内容 |
| `sdk` | SDK Vitest/tsx/TypeScript 的声明、安装版本及 SDK 锁文件存在性；SDK Vitest 还需与基础设施运行器匹配 | 不构建、不执行 SDK 测试 |
| `api` | 固定嵌套 `gmx-api` 的 Jest/ts-jest/tsx/TypeScript 声明、安装版本及锁文件存在性 | 不启动 API、数据库，不核验生成路由或 sample 契约 |
| `chrome` | 复用浏览器预检的精确 Playwright 版本检查和 Chrome 文件可执行检查 | 不启动 Chrome，不发现/执行页面用例，不证明浏览器运行成功 |
| `docker` | `docker --version`，仅保留规范化 CLI 版本 | 不连接 daemon、不检查镜像、不创建容器；CLI 可用不表示 PostgreSQL 测试可运行 |
| `sdk-artifacts` | 复用现有 `sdk:artifacts verify` | 来源及产物完整性，不构建；失败详情回到原入口读取 |
| `wasm` | 复用 `solana:runtime-preflight --local-only` | 当前固定 SDK/WASM 本地产物指纹，不读 RPC/链上程序，不证明业务数学或程序兼容 |

以下资源始终为 `not-checked`，并提供下一步指引：Docker daemon/镜像、RPC、keeper、本地 API 服务、远端 API 部署身份、钱包、链上程序版本、评审契约与真实账户样本。涉及哪个条件，再按[任务启动卡](agent-task-start.md)和[验收映射](agent-acceptance-workflow.md)调用已有工具或协调资源。历史 A03/契约缺口不会被写成这次实时查询结果。

## 身份、隔离与历史报告

工具只盘点**自身所在基础设施 checkout** 及其固定 `sdk/`、`gmx-api/`，不支持把本机输出当成另一个交付 checkout 的证明；独立目标继续使用现有前端/SDK/API/浏览器入口的显式目录参数。

报告记录 Git commit/dirty、实际基础设施目录及前后输入摘要：根/SDK/API package 与锁文件、相关工具和静态 SDK 配置、关键已安装包元数据。不存在的可选文件记为 missing，让对应检查单独报告 blocked；其他读取错误明确失败。Git 读取禁用可选索引写入，不 fetch、创建分支或修改索引。

摘要不覆盖全部业务源码、安装包实现、浏览器/Docker 二进制、所有 SDK 产物字节或链上部署；SDK/WASM 由其原核验器独立检查。它不是原子快照或安全签名。检查期间避免并发修改工具和依赖；输入变化时清单整体 blocked，即使各项曾经 ready。

此入口不读取 `.env` 或钱包配置，不启动服务/浏览器/容器，不运行测试、构建、安装、部署、签名或交易，不请求远端服务。子进程仅取得 PATH 与只读 Git 设置，超时 30 秒、输出上限 1 MiB；仅接收需要的版本/状态，不转发 stdout/stderr 或任意异常内容。调用范围限于仓库现有本地工具和 Docker CLI 版本读取，不是通用进程沙箱。

状态文件是带时间的本机观察，不跟踪为共享当前状态，也不提供历史状态自动续期。历史文件即使写着 ready，也不能证明现在 ready；需要当前状态时重跑所需项。`stale` 表示本次确认的本地偏离，不是自动根据任意时长推断服务失效。该清单不是测试执行报告，不能用于 `agent:delivery-check` 的测试证据参数。

## 验证与维护

回归命令：`yarn test:agent-environment`，已由 `scripts/*.test.mjs` 自动纳入 `yarn test:agent-tools`。回归覆盖依赖版本匹配/偏离/缺失/格式异常、检查异常脱敏、选项错误、未检查项保留、输入身份变化和退出码。

新增资源先复用已有核验器，写清本地观察与服务/业务就绪的界限；远端检查和秘密读取不加入默认清单。详细执行结果见[路线表实施记录](solana-agent-friendliness-roadmap.md)。失败时按[诊断入口](agent-failure-diagnosis.md)回到相应原工具，不自动安装、构建或换数据源。
