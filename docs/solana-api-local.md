# 本地 Solana API 样例验收服务

更新日期：2026-10-26。对应基础设施清单 A08；本地样例服务已具备环境预检及一次性启动、验收、清理闭环。

## 用途与边界

后续 Agent 验证 Solana 市场、持仓、订单和费用折扣的数据接入时，可直接启动现有 `gmx-api` 的 `LAUNCH_MODE=solana` 样例服务，并用同一条命令检查 HTTP 行为与源码样例是否一致。工具位于主仓库 [scripts/solana-api-local.mjs](../scripts/solana-api-local.mjs)，不复制服务或样例，不修改业务代码。

这是固定样例服务：不需要钱包、数据库、RPC、subgraph 或 keeper。返回的持仓、订单、地址占位符及金额不代表请求地址的真实链上状态；市场 `updatedAt` 是样例服务每次生成的时间，不证明链上数据新鲜。验收通过只代表本地服务与选定源码一致，不代表 A04 的 reviewed samples、真实 API、计算正确性或交易闭环已经通过。

2026-10-25 实时核对 [FESOL-62](https://linear.app/gmx-io/issue/FESOL-62)：该需求为 Done，评论说明样例服务已经部署；本轮没有取得或验证实际 `run.app` 地址，A03 仍待推进。不修改 Linear 状态，也不重新实现 FESOL-62。

## 执行前准备与顺序

### Agent 默认入口

在主仓库根目录执行：

```sh
yarn solana:api-local doctor
yarn solana:api-local check
```

`doctor` 不启动服务，逐项检查 Node 22、源码/样例及 Git 信息、已安装 tsx 的可执行性和所选端口；汇总全部检查结果，失败退出 1。它不验证所有运行时依赖，后续启动和 HTTP 检查负责发现实际加载问题。源码或依赖缺失时先按下文准备，不反复尝试启动；端口占用时核对所有者或显式选择其他端口。

`check` 自带同一预检，成功后启动现有服务，最多等待约 20 秒就绪，再执行下述 14 项 HTTP 检查；单次请求最多 5 秒。核对启动时与检查时的源码证据一致，成功或检查抛错均关闭自己启动的子进程，最后检查端口已释放。不会复用或终止未知服务，不自动安装依赖、切换真实数据源或修改前端配置。已有服务需要保留运行时，应使用 `verify`。

每次实际启动在 `.local/acceptance/solana-api-local/check-*/` 保留 `service.log`；成功另写 `report.json`。终端 JSON 包含 `preflight`、`logFile`、`cleanup: passed`、`mode: sample` 和 `liveChainData: not-verified`。失败返回非零退出码，stderr 的 JSON 给出失败预检或启动日志路径。预检失败尚未启动服务，不创建运行日志。源码摘要是本地预期证据，不是服务返回的身份认证。

启动失败先查看该次日志，不能通过删除锁文件、跳过鉴权或换样例来源使检查变绿。所有命令支持 `--api-dir PATH --port PORT`，包括从 `gmx-api` 目录调用主仓库工具：

```sh
node ../scripts/solana-api-local.mjs check --api-dir . --port 3005
```

### 依赖准备与持续运行

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

上述 `start` / `verify` 适合需要保持运行的联调。启动输出的 `starting` 仅表示开始启动，等待服务日志的 listening，再执行 verify；verify 退出 0 才代表检查通过。完成后在启动终端按 Ctrl-C，关闭本任务的服务。一次性验收优先使用 `check`，避免手动等待和遗留进程。

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
| `preflight-failed` | `check` 未启动服务；按报告中的失败检查及 remedy 准备环境 |
| `startup-failed` | 服务提前退出或约 20 秒内未就绪；查看 logFile，不继续执行样例验收 |

本工具是可复用的服务 smoke 检查，不是字段语义/精度的独立基准。错误消息存在性检查不等于完整错误契约。CORS 检查是 HTTP 头层面的检查，没有运行浏览器，不能等同浏览器端到端验收。

## 前端使用现状

当前 `src/config/api.ts`、`GmxSdkContext` 和 SDK API 配置仍围绕 EVM `ContractsChainId`，没有可直接把 Solana 页面切到本服务的 host 入口。`stats-api-url` 只覆盖统计 API，不能用于市场/持仓/订单。不要为了使用本工具把 Solana 冒充 Arbitrum，也不要改 EVM host。

本轮完成 Agent 可直接调用的本地样例环境；前端 host 接入属于后续已确认的需求实施，应复用本服务并遵循统一数据流。A08 的前端端到端覆盖仍未具备，不在本轮完成口径内。

## gmx-api Solana 离线计算回归

2026-10-26 增加独立入口，复用 API 已有测试与 fixture，不修改 API 源码、Jest 默认配置或业务算法：

```sh
# From the gmx-interface root
yarn gmx-api:test-offline

# From gmx-api
node ../scripts/gmx-api-offline-tests.mjs --api-dir .
```

适用于修改或核对 `marketStatus`、市场账户解码及 `solanaPairsRows` 时的快速回归。当前固定执行以下两个原有测试集，不接受任意测试路径，以免误把数据库测试放进无数据库环境：

| 原有测试 | 当前覆盖 |
| --- | --- |
| `src/domain/gmtrade/marketStatus.test.ts` | 7 组市场 fixture，核对资金费率方向、流动性、持仓价值及市场账户解码 |
| `src/domain/pairs/solanaPairsRows.test.ts` | 5 项 pair 输出、价格/成交量、funding 间隔、禁用市场，以及开放/休市市场的陈旧数据行为 |

依赖 Node 22 及 API 锁定的 Jest / ts-jest / 业务依赖。工具以独立 Jest 配置串行运行所选测试，不调用原配置的数据库 globalSetup / teardown，不启动服务；ts-jest 使用 CommonJS 及 Node 模块解析转换现有测试。原有数据库集成和 Solana launch-mode 测试仍按 API 默认流程运行，本入口没有覆盖它们，也不替代完整 API 测试。

测试进程使用临时空工作目录和环境变量白名单，不继承钱包/数据库凭据或 `NODE_OPTIONS`，dotenv 默认不会读取项目 `.env`。网络 guard 拦截测试环境中常见 Node HTTP、TCP、TLS、HTTP/2、UDP、DNS 和 fetch 入口；外连尝试即时报错，且即使异常被捕获，suite 的 afterAll 仍报告失败。这是用于防止意外外连的测试约束，不是操作系统级沙箱，不支持不可信测试代码。

运行总超时 120 秒、单项测试超时 10 秒，不重试、不使用 forceExit 掩盖未清理资源。成功要求两个 suite 均通过、测试非空且无 skip/todo、进程退出 0，并且运行前后的选定源码证据一致。已通过的是历史 fixture 回归，不证明当前链上状态或实时 keeper / SQD 数据。

stdout 输出 `mode: offline-fixtures` 的 JSON，含 API commit/dirty、选定文件摘要、guard 摘要、测试数量和 excluded 范围。成功退出 0，其余退出 1；测试失败也保留结构化报告。前置条件缺失时 stderr 给出固定诊断信息，不启动数据库或自动安装依赖。

每次实际执行的日志与原始 Jest JSON 保存在 `.local/acceptance/solana-api-local/offline-*/`，报告提供 `logFile`、`resultsFile`；临时工作目录自动清理。源码身份不是当前部署身份。工具入口为 `scripts/gmx-api-offline-tests.mjs`，guard 回归为 `yarn test:gmx-api-offline`。

实施与验收状态：

| 阶段 | 状态 |
| --- | --- |
| 现有测试与数据库耦合核验 | 已完成；默认 Jest 即使指定纯计算测试也会创建模板数据库，因此使用明确独立的离线 profile |
| 实际 API 测试 | 已通过；2 个 suite、12 项测试，无失败/跳过；API commit `b86956df00902e44e0295827d651b206a6153942`，dirty false |
| 隔离与失败退出 | 已通过；临时副本中注入计算断言失败，返回退出 1 并保留报告；被捕获的 HTTP 外连仍令 suite 失败；公开环境哨兵及副本 `.env` 不进入测试 |
| 网络 guard 回归 | 已通过；9 个网络入口均阻断，累计尝试不能静默通过 |
| 静态检查与最终复验 | 已通过；实际 API 2 个 suite / 12 项最终复验、网络 guard 回归、Node 语法、ESLint、定向 Prettier、yarn tscheck、文档链接及 git diff --check。未重新运行完整前端或 API 数据库测试，业务文件和默认配置未改动 |

本机验收摘要为同目录 `offline-latest.json`，失败/隔离验证为 `offline-acceptance.json`；临时注入仅发生在已清理的源码副本，真实 API 文件未改动。该阶段为 A08/A11 的回归执行能力补充，未新增独立数学基准，不能将旧 fixture 当成未来全部 SDK / 部署版本的正确性证明。

## 实施进度与验收

### 2026-10-26 Agent 生命周期闭环

| 阶段 | 状态与范围 |
| --- | --- |
| 复用现有能力 | 已完成；沿用原 Solana 启动入口和 14 项检查，gmx-api 业务代码及依赖不变 |
| doctor / check | 已实施；Node、源码、运行器、端口逐项诊断；一次性启动、验收、源码核对和清理 |
| 真实服务 | 已通过；默认 3004 及从 gmx-api 目录调用的自定义 3005 端口均完成 14 项检查，cleanup passed；本机报告 `check-latest.json` / `check-custom-port.json` 位于上述忽略目录 |
| 主要失败路径 | 已通过；端口占用不终止其所有者，缺源码/运行器汇总报告，子服务提前退出保留日志，检查抛错关闭所属子进程并释放端口 |
| 静态检查与相关回归 | 已通过；Node 语法、ESLint、定向 Prettier、文档链接、git diff --check、yarn tscheck；统一预检 6 项测试通过；完整前端 299 文件 / 3014 项通过，1 文件 / 1 项原有跳过 |

失败路径报告为同目录 `lifecycle-acceptance.json`，类型检查和完整测试日志为 `typecheck.log` / `frontend-tests.log`。完整测试退出 0，仍有已知 Browserslist 过期提示和 happy-dom teardown AbortError 输出，无失败测试。服务均已关闭，API checkout 为 `b86956df00902e44e0295827d651b206a6153942`，dirty false。

本轮仅验证样例服务，不要求数据库、钱包、RPC 或 keeper；未接入真实 Solana 数据、前端 host 或部署流程。下表为 2026-10-25 原有工具的历史验收记录，不代表本轮重新运行了全部前端测试。

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
