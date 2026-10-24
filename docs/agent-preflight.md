# Agent 统一只读预检

更新日期：2026-10-25。状态：**本轮统一入口与本地证据范围已完成并验收通过**。

## 目的与范围

在后续任务开展已授权的本地数据验收前，用一条命令复用已有 RPC、keeper、样例 API 和可选钱包余额检查，汇总依赖状态与本地版本证据，减少 Agent 重复运行命令、解释退出码和整理记录的工作。

这是基础设施清单“统一只读预检”的本地阶段，并提供 A14 的部分证据能力。它不是业务需求验收器，不完成 A07 的需求逐条映射，也不证明真实 API、契约评审、预览部署、SDK/WASM、协议程序版本或交易闭环已验收。不修改业务代码、真实 flags 或钱包配置。

入口：[scripts/agent-preflight.mjs](../scripts/agent-preflight.mjs)。依赖现有 Node 22、Git、主项目依赖，以及所选检查器自身的前置条件，不新增依赖。

## 执行顺序与命令

先根据当前任务选检查项，并确认运行授权，再准备所需服务。工具不会启动服务、浏览器、构建、部署或交易，不自动安装依赖、重试、切换上游或使用替代数据。

| 检查项 | 已有工具与前置 | 执行内容 |
| --- | --- | --- |
| `rpc` | [RPC 代理说明](../tools/solana-rpc-proxy/README.md)；先启动 `yarn solana:rpc-proxy` | 复用现有完整 verify：Mainnet、slot、批量账户、CORS/写操作拦截和上游错误；不是仅 ping |
| `keeper` | [keeper 说明](keeper-preflight.md)；不需本地服务 | 复用主端点价格、24h、K 线和真实交易开关检查；不读取本地开关覆盖 |
| `api` | [本地 API 说明](solana-api-local.md)；先启动 `yarn solana:api-local start` | 复用 14 项样例 HTTP 检查；固定本机默认端口 3004，数据模式为 sample |
| `wallet` | [钱包说明](agent-wallet.md)；用户配置根 `.env.local`，启动 RPC 代理 | 显式选择后才运行已实现的 Mainnet 原生 SOL 余额预检；不签名或发送 |

工作目录为主仓库根目录。默认检查 `rpc,keeper,api`，不读取测试钱包助记词：

```sh
yarn agent:preflight
```

按具体任务只选择需要的项，避免给不依赖钱包或价格的任务增加无关检查：

```sh
yarn agent:preflight --checks api
yarn agent:preflight --checks rpc,keeper,api,wallet
```

`--checks` 不接受空列表、重复项或未知名称。执行顺序固定为 RPC → keeper → API → wallet；未选择的项报告 `not-run / not-selected`，不是验收通过。单项失败后继续执行其他已选择项，不因前一项失败而隐藏后续结果。

RPC/钱包继续沿用其已有进程级 `SOLANA_RPC_PROXY_URL` 配置；统一入口不输出带 key 的 URL。API 使用默认目录 `gmx-api` 和端口 3004，keeper 使用主端点。需要自定义 API 路径/端口或 keeper 备用端点时，使用相应独立工具；不临时改业务配置来迁就统一入口。

服务由本次任务启动时，结束后关闭；不要关闭其他任务的服务。钱包配置不等于签名或交易授权。

## 状态、退出码与报告

成功执行检查流程后 stdout 只输出一个 JSON；检查失败或 blocked 时仍输出完整汇总报告，退出码保留真实结论。命令参数或仓库证据读取错误则在 stderr 输出固定配置错误，并退出 3。

| 退出码 | 汇总状态 | 含义 |
| --- | --- | --- |
| 0 | `passed` | 所有**选定**检查通过；不代表未选项目或整个业务已就绪 |
| 1 | `failed` | 至少一项选定检查失败，包括服务未启动、超时、工具异常或非法报告 |
| 2 | `blocked` | 无失败，但仍有阻碍；例如 keeper 的真实交易开关缺失/关闭 |
| 3 | 配置或证据错误 | 参数、Git checkout 或检查脚本等前置不满足，未生成正常汇总报告 |

优先级为 failed → blocked → passed。keeper 内的必需项若为 not-run，同样不能合成为 passed；显式未选择的顶层项目不影响选定范围结论。样例与钱包零余额的含义由原检查器定义，不在这里修改判断标准。

报告包含 schemaVersion、选定范围、开始/结束时间、仓库 SHA/dirty、检查器及相关配置/依赖文件 SHA-256、逐项耗时、状态和固定错误码。API 附带本地预期 API commit/dirty/文件摘要和 sample 标记；keeper 保留逐项检查状态；钱包仅保留公开地址、Mainnet、精确金额和 slot。不保存助记词、私钥、原始 stdout/stderr、上游响应正文或完整密钥 URL。

本地文件摘要用于绑定本次检查所用的入口和关键配置；它不是完整工作区快照。dirty=true 时不能只凭 commit 复原全部修改。API 的预期源码也不是由服务器返回的云端部署版本，不能据此声称 A03 或整个 A14 已完成。

子进程输出上限为 1 MiB，RPC/keeper/API/wallet 的整项执行时限分别为 240/90/100/60 秒，超限明确失败。这些时限位于原检查器逐请求超时之外，不会改写原检查器的检查逻辑。发生异常时保留失败项，按对应工具文档单独重跑诊断；统一报告不转发原始日志。它不应代替日志或业务验收证据。

归档示例（目录已被 Git 忽略；重定向后仍检查进程退出码）：

```sh
mkdir -p .local/acceptance/agent-preflight
yarn agent:preflight --checks rpc,keeper,api,wallet > .local/acceptance/agent-preflight/report.json
```

退出 1/2 时仍可能已生成有效失败/受阻报告；自动化应先读取退出码，再解析 JSON 中的逐项状态。报告仅供本地保存，不上传外部服务。

## 验收条件与进度

| 阶段 | 状态与证据 |
| --- | --- |
| 实现与复用 | 已完成；仅调用原检查器，不改服务、业务逻辑或验收阈值 |
| 状态组合和失败测试 | 4 组 Node 自动测试通过；覆盖结果组合、必需 not-run、矛盾报告、非法 JSON、超时、异常后继续执行和原始错误不泄露 |
| 四项真实验收 | RPC passed、keeper blocked、API passed、wallet passed；汇总 blocked / 退出 2，正确保留真实交易开关缺失 |
| 显式选项范围 | 仅选 API 时 passed / 退出 0，其余三项 not-run；空列表、重复或未知检查项退出 3，无成功报告 |
| 服务停止 | 自启服务关闭后，选 RPC/API/wallet 的三项均 failed，其余 not-run；汇总 failed / 退出 1 |
| 工程与交接 | 已通过；脚本 ESLint 零警告、Prettier、Node 语法、类型检查、文档路径和 `git diff --check`；完整前端回归 299 文件通过 / 1 原有跳过，3014 测试通过 / 1 原有跳过 |

真实报告保存于本机 `.local/acceptance/agent-preflight/` 的 `all.json`、`api-only.json`、`stopped.json`，不随 Git 共享，其他机器需按授权重新执行。主仓库检查基线为 `24293d9efd`，实施中 dirty=true；预期 API commit 为 `b86956df00902e44e0295827d651b206a6153942`，dirty=false。未协调或绕过缺失的真实交易条件；本轮完成标准是正确诊断这些条件。

自动测试入口为 `yarn test:agent-preflight`，不读取实际助记词、不访问 RPC 或 keeper。子进程超时测试仅运行短暂的本地 Node 测试进程。未新增通用框架。

最终复验中的三份报告均已校验检查器 SHA-256 与当前文件一致；本次自行启动的 RPC 代理和 API 服务已全部关闭，API checkout 无改动。完整前端测试退出 0，日志有 Browserslist 过期提示与 happy-dom teardown AbortError 输出，未产生失败测试；本轮未修改这些无关项目，也未运行 UI、浏览器、构建或部署。
