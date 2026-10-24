# 本地 Solana API 样例验收服务

更新日期：2026-10-25。对应基础设施清单 A08；状态：**本轮本地服务与 CLI 范围已实现并验收通过**。

## 用途与边界

后续 Agent 验证 Solana 市场、持仓、订单和费用折扣的数据接入时，可直接启动现有 `gmx-api` 的 `LAUNCH_MODE=solana` 样例服务，并用同一条命令检查 HTTP 行为与源码样例是否一致。工具位于主仓库 [scripts/solana-api-local.mjs](../scripts/solana-api-local.mjs)，不复制服务或样例，不修改业务代码。

这是固定样例服务：不需要钱包、数据库、RPC、subgraph 或 keeper。返回的持仓、订单、地址占位符及金额不代表请求地址的真实链上状态；市场 `updatedAt` 是样例服务每次生成的时间，不证明链上数据新鲜。验收通过只代表本地服务与选定源码一致，不代表 A04 的 reviewed samples、真实 API、计算正确性或交易闭环已经通过。

2026-10-25 实时核对 [FESOL-62](https://linear.app/gmx-io/issue/FESOL-62)：该需求为 Done，评论说明样例服务已经部署；本轮没有取得或验证实际 `run.app` 地址，A03 仍待推进。不修改 Linear 状态，也不重新实现 FESOL-62。

## 执行前准备与顺序

工作目录为主仓库根目录，依赖 Node 22、Git 和现有 `gmx-api` 源码及其依赖。该仓库是主项目的子模块；缺失时按[参考仓库说明](solana-reference-repositories.md)准备，工具不自动 clone、安装依赖或修改 Git 状态。

先确认 `gmx-api/src/solanaApp.ts`、样例目录和 `gmx-api/node_modules/tsx/dist/cli.mjs` 存在。依赖未安装时在 `gmx-api` 目录运行：

```sh
YARN_COMPRESSION_LEVEL=0 yarn install --immutable
```

该进程级配置匹配当前锁文件的 `cacheKey: 10c0`。本轮默认压缩配置会导致 `YN0028`（只要求改写 cacheKey），设置为 0 后 immutable 安装成功，锁文件未变；不要先删除锁文件或升级依赖。未来锁文件变化时重新核对，不能把此配置当作所有 Yarn 项目的通用修复。安装仍有上游已有 peer dependency 警告，未通过改依赖规避。

在主仓库启动现有服务：

```sh
yarn solana:api-local start
```

在另一终端检查：

```sh
yarn solana:api-local verify
```

启动输出的 `starting` 仅表示开始启动，等待服务日志的 listening，再执行 verify；verify 退出 0 才代表检查通过。不自动重试或启动替代服务。完成后在启动终端按 Ctrl-C，关闭本任务的服务。

默认地址为 `http://127.0.0.1:3004`，可在两个命令上同时指定 `--port 3005`。端口被占用时先确认服务归属，使用其他端口或由服务所有者关闭，不自动复用未知进程。源代码不在默认位置时，两条命令均指定 `--api-dir /absolute/path/to/gmx-api`；两者必须指向相同 checkout。

启动器使用现有 `src/index.ts` 和已安装的 tsx，设置 `NODE_ENV=development`、`LAUNCH_MODE=solana` 和端口；只传入所需环境变量，在临时空工作目录运行，阻止 dotenv 读取主项目或 API 目录的 `.env`。不会继承助记词、数据库/RPC 密钥、`NODE_OPTIONS` 或 `NODE_TLS_REJECT_UNAUTHORIZED=0`。启动时检查端口，停止时转发信号并清理临时工作目录。

监听范围沿用上游 `listen(port)` 行为，不承诺仅绑定 loopback；本地工具请求始终发往 `127.0.0.1`，本轮没有修改 API 监听逻辑或部署服务。

## 检查内容与报告

`verify` 只访问本机，使用公开 System Program 地址作为路由参数，不读取助记词；不启动服务或发送交易。顺序执行 14 项检查，每个 HTTP 请求有 5 秒超时，禁止重定向：

| 范围 | 检查 |
| --- | --- |
| 健康 | `/ping` 返回 HTTP 200 和 `pong` |
| 五类样例 | `/v1/markets/config`、`/v1/markets/values`、`/v1/positions`、`/v1/orders`、`/v1/fee-discount` 与本地源码 JSON 一致；仅 markets/values 的动态 `updatedAt` 单独检查为本次请求期间的安全整数 |
| 地址错误 | positions、orders、fee-discount 各检查缺少地址和非法地址，均返回 HTTP 400 与错误消息 |
| 未知路由 | 返回 HTTP 404 |
| CORS | 五类样例携带 localhost Origin 时返回现有允许来源头；另检查 OPTIONS 返回 HTTP 204 和允许来源头 |

输出 JSON 包含 `status`、`mode: sample`、时间、URL、已通过检查列表及 `expectedSource`。后者记录**本地预期源码**的 Git SHA、dirty 标志、入口文件/配置/依赖清单/锁文件与五份样例的 SHA-256；启动日志另有同结构的 `source`，用于对照启动与检查是否使用同一份源码。它不是从服务器取得的部署版本，不能据此证明其他服务的二进制版本或云端部署 SHA。启动后不要改源码再声称验收对应原版本。

如需留存机器报告，使用忽略提交的本地目录：

```sh
mkdir -p .local/acceptance/solana-api-local
yarn solana:api-local verify > .local/acceptance/solana-api-local/report.json
```

成功及 `--help` 退出 0；失败退出 1，stderr 输出结构化错误，stdout 不输出通过报告。错误包含固定错误码、诊断提示及失败路由（适用时），不输出上游响应体或原始异常：

| 错误码 | 处理 |
| --- | --- |
| `missing-prerequisite` | 检查源码路径、样例文件与已安装依赖 |
| `port-in-use` | 核实端口所有者，或明确选择其他端口 |
| `request-failed` | 检查服务是否已就绪、端口是否一致；也包括无法解析的 JSON |
| `response-mismatch` | 对照失败路由、样例和启动源码，不能只因 ping 正常就继续验收 |
| `check-failed` | 检查参数、Git checkout、依赖及服务启动日志 |

本工具是可复用的服务 smoke 检查，不是字段语义/精度的独立基准。错误消息存在性检查不等于完整错误契约。CORS 检查是 HTTP 头层面的检查，没有运行浏览器，不能等同浏览器端到端验收。

## 前端使用现状

当前 `src/config/api.ts`、`GmxSdkContext` 和 SDK API 配置仍围绕 EVM `ContractsChainId`，没有可直接把 Solana 页面切到本服务的 host 入口。`stats-api-url` 只覆盖统计 API，不能用于市场/持仓/订单。不要为了使用本工具把 Solana 冒充 Arbitrum，也不要改 EVM host。

本轮完成 Agent 可直接调用的本地样例环境；前端 host 接入属于后续已确认的需求实施，应复用本服务并遵循统一数据流。A08 的前端端到端覆盖仍未具备，不在本轮完成口径内。

## 实施进度与验收

| 阶段 | 状态 |
| --- | --- |
| 现有入口、FESOL-62 和依赖核实 | 已通过；immutable 安装成功，API checkout 无改动 |
| 启动器和 14 项检查 | 已通过最终复验；3004 与自定义 3005 端口均通过 |
| 失败路径 | 端口占用、源码缺失、非法端口、响应变更、陈旧时间戳、CORS 缺失、HTTP 错误和非法 JSON 已验证 |
| 运行隔离与清理 | 父进程注入 master/test/CHAIN_ID 和公开钱包哨兵后，子服务仍为 solana 样例模式；仅向启动器发 SIGTERM 后服务关闭、临时目录清理通过 |
| 停服失败路径 | 已通过；verify 退出 1，`request-failed`，失败路由 `/ping`，无成功报告 |
| 静态检查与回归 | Node 语法、ESLint（`--env node --max-warnings=0`）、Prettier、`yarn tscheck`、文档路径和 `git diff --check` 通过；`yarn test:ci` 为 299 文件通过 / 1 原有跳过，3014 测试通过 / 1 原有跳过 |

本轮只改测试验收脚本、package 命令和协作资料；未实现页面或协议需求，未配置真实 API 部署、签名或发送交易。

最终真实报告时间为 `2026-10-24T16:12:49.107Z`（北京时间 2026-10-25），预期 API commit 为 `b86956df00902e44e0295827d651b206a6153942`，dirty 为 false；报告保存于本机 `.local/acceptance/solana-api-local/report.json`（被 Git 忽略，其他机器需重新运行），各样例摘要由命令输出。完整前端测试退出 0，日志仍有 Browserslist 数据过期提示与 happy-dom teardown 的 AbortError 输出，未产生失败用例；未为本轮修改无关依赖或业务测试。未运行浏览器、UI、前端构建或部署。

本次验收自行启动的 3004/3005 服务均已关闭，`gmx-api` checkout 和锁文件保持无改动。A08 的本地服务与 CLI 范围完成，整体表仍保留前端 host 尚未接入的边界。
