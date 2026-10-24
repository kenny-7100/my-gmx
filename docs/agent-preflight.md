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

历史报告复用前可按下文离线比较源码指纹。其本地文件摘要用于绑定本次检查所用的入口和关键配置；它不是完整工作区快照。dirty=true 时不能只凭 commit 复原全部修改。API 的预期源码也不是由服务器返回的云端部署版本，不能据此声称 A03 或整个 A14 已完成。

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


## 复用历史报告前比较源码指纹

后续 Agent 想复用现有统一预检报告时，在主仓库根目录执行：

```sh
yarn agent:preflight --compare-source .local/acceptance/agent-preflight/all.json
```

该参数与 `--checks` 互斥；比较模式不运行 RPC/keeper/API/wallet 检查，不启动服务、不读取钱包、`.env` 或秘密配置、不访问网络。它只读取指定的普通 JSON 报告（最大 1 MiB、拒绝最终文件为符号链接），沿用当前工具对原 selected 检查项的固定采集计划读取关键源码，并执行只读 Git 查询。报告中的路径仅作为摘要键比较，不驱动文件读取；未知 selected、非法相对路径/摘要、错误 scope/schema、缺失或不可读文件都明确失败。

| 退出码 | 本次源码比较含义 |
| --- | --- |
| 0 / passed | 当前固定采集集合与基线记录的摘要全部一致 |
| 2 / blocked | 指纹或采集集合变化；先核对影响并决定哪些验收需要复跑，不自动执行 |
| 3 / failed | 输入、参数、Git 或源码读取失败；不当成源码未变化 |

比较报告的 scope 为 local-source-comparison，包含基线原状态/时间/commit/dirty、原检查选择、当前指纹及 added/removed/changed 文件列表。added/removed 指相对于基线的**采集集合**变化；当前固定计划要求的文件物理缺失时退出 3。commit 或 dirty 单独变化不改变摘要比较结论；文档等未纳入既有计划的变化不会机械触发全部预检。当前采集范围仍按本页原规则，不因此扩大为整个仓库、完整导入图、API 子仓库或 SDK/程序产物校验。

`liveEnvironment` 与 `requirementAcceptance` 固定为 not-evaluated。即使基线原状态 failed/blocked，也可以得到源码比较 passed，原失败仍保留在 baseline.status 中。源码相同不证明历史价格、余额、flags、服务连通、部署和需求状态仍有效；这些按本次验收条件重新检查，不能据此跳过必要的真实数据验收。反之，源码变化只是要求复核，不直接证明业务失败。

来源可信时才使用基线；收到证据包先按[证据包说明](agent-evidence.md)校验预期包摘要。归档比较时显式选择原基线与比较报告一起保存，报告可以进入既有证据包，不自动复制其引用路径。不要改写历史摘要来取得 passed；不能因为比较在当前时刻执行就刷新原报告的观察时间。

隔离演练的环境经验：macOS 的临时路径可能经过 `/var` 到 `/private/var` 的符号链接，复制 CLI 后应先将临时目录解析成真实绝对路径再调用。否则本项目现有的 import.meta.url/main-entry 判断可能不触发，表现为退出 0 但没有 JSON。演练先断言退出码及 JSON 均存在；主仓库正常调用无需增加这一步。隔离目录的 Git 查询使用明确的 GIT_DIR/GIT_WORK_TREE 和 GIT_OPTIONAL_LOCKS=0，只读复用仓库身份，不初始化或改动真实索引。

### 源码比较验收记录（2026-10-25）

6 组统一预检测试（新增 2 组）通过，覆盖新增/移出/改变的指纹、commit/dirty 独立变化、原失败状态保留、未知检查项、不合法基线与读取失败。真实历史报告比较为 blocked，当前实际报告比较为 passed；隔离副本的无关文档不影响结果、RPC 配置变化为 blocked、缺文件为错误退出，业务源码没有被改动。非法输入、参数冲突及符号链接被拒绝。当前基线是未启动代理时生成的真实 RPC-only failed 报告，比较 passed 没有把它提升为环境 passed。比较报告打包及预期摘要验证通过，产物、摘要和工程结果见[清单进度](agent-acceptance-infrastructure.md#a14-历史预检源码复用判定进度2026-10-25)。

工程验收通过：6 组统一预检测试与 6 组证据包回归、类型/ESLint/格式/语法检查；完整前端单元测试 3014 passed / 1 原有 skipped，退出 0；138 个本地文档链接与差异检查通过。
