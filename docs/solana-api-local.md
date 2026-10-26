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

## gmx-api 路由生成准备与过期检查

2026-10-26 已完成并验收。新 checkout 的 `src/codegen/tsoa/` 可能缺失；`src/app.ts` 直接导入生成的 v1/v2 路由及 Swagger。需要测试真实 Express 路由或修改 TSOA controller/类型时，先检查生成状态，再运行相关测试；仅运行已有 Solana 样例服务或纯计算测试不需要这一步。

在主仓库根目录执行（依赖 Node 22 与 API 已安装的锁定依赖）：

```bash
yarn gmx-api:prepare --verify
# If missing or stale
yarn gmx-api:prepare
yarn gmx-api:prepare --verify
yarn gmx-api:test-integration --suite src/routes/routeMap.test.ts --suite src/routes/v1/relay/__test__/relayLaunchMode.test.ts
```

工具为 `scripts/gmx-api-prepare.mjs`，支持 `--api-dir PATH`。生成命令依次运行 API 原有 `tsoa.json` 与 `tsoa-v2.json` 的 `spec-and-routes`，写入 `src/codegen/tsoa/` 中四个已被 API Git 忽略的文件，不修改业务源码、配置或依赖。每阶段限时 120 秒，不启动 API/数据库，不安装依赖或连接真实 keeper。stdout 输出结构化报告，生成日志及清单保留于 `.local/acceptance/solana-api-local/prepare-*/` 与 `prepared-*.json`，按 checkout 绝对路径区分。

`--verify` 只读比较清单：记录 `src/` 下 TS/TSX/JS/JSON（排除生成目录）及 package/lock/TS/TSOA 配置的摘要、四个产物摘要，并检查 OpenAPI 3 非空路径和路由注册入口。源码检查有意保守，测试文件变化也要求重生成；不检查 node_modules 实际内容、外部类型依赖或完整 TypeScript 导入图，依赖仍须按锁文件准备。返回 0 表示摘要一致；有效文件但摘要变化返回 2 / `regeneration-required`；文件、清单缺失或格式错误、生成失败返回 1 / `api-generation-not-ready`。失败时先确认 Node/依赖/文件，再查看报告中的生成日志，不手改产物绕过检查。

这证明本地生成状态，不能替代类型检查、HTTP 回归、A04 契约评审或部署/真实数据验收。生成报告明确 `runtimeVerification: not-run`，运行时验证须单独执行上面的测试。

| 验收条件 | 状态与证据 |
| --- | --- |
| 复用原有两套生成配置 | 已通过；生成 v1/v2 路由及 OpenAPI，真实 checkout 生成与 verify 通过 |
| 过期及损坏不能误通过 | 已通过；独立源码副本真实生成后验证正常、源码变更、产物变更、损坏/缺失 spec、恢复、清单缺失；另验证生成器缺失时退出 1 且保留日志，共 9 项检查，副本已清理 |
| 生成产物可用于原有测试 | 已通过；routeMap 5 项及 relayLaunchMode 1 项，共 6 项；隔离数据库 cleanup passed |
| 环境修复及接手顺序 | 已完成；运行器临时目录链接真实 `src/abi`，修复导入 `src/app.ts` 的 ABI 查找失败；未改业务和断言，通用执行入口已更新 |

工程检查已通过：两份脚本的语法、ESLint、代码格式、`yarn tscheck`、现有测试选择回归，以及 `yarn test:ci`（3014 项通过，1 项原有跳过，退出 0）；文档本地链接和 `git diff --check` 通过，API checkout 无跟踪改动，测试容器已清理。

本机证据：`prepare-latest.json`、`prepare-acceptance.json`、`integration-routes.json`，均位于上述忽略目录。首次 HTTP 测试失败日志保留在 `integration-HWdri2/jest.log`。ABI 加载使用 `process.cwd()/src/abi`，仅设 `APP_ROOT` 不足；后续遇到 `ABI directory not found` 先核对测试 CWD 的资源链接，不调整业务查找逻辑或移除隔离目录。HTTP 用例沿用原测试的本地 keeper stub，不访问真实 keeper、不发送链上交易。

## gmx-api 隔离 PostgreSQL 集成测试

2026-10-26 增加数据库测试入口，补充离线计算与样例 HTTP 检查无法覆盖的数据库状态行为。在主仓库执行：

```sh
yarn gmx-api:test-integration

# From gmx-api
node ../scripts/gmx-api-integration-tests.mjs --api-dir .
```

依赖 Node 22、API 已安装的锁定依赖、可用的本地 Docker Unix socket context，以及本地 `postgres:15` 镜像。预检发现缺项时返回退出 1，不自动下载镜像、安装工具或连接替代数据库；需要资源所有者准备后重跑。当前实现面向本机 macOS/Linux Docker context，不接受远端 TCP daemon。

每次使用镜像实际 ID 创建带唯一 owner label 的专属容器，PostgreSQL 数据位于 tmpfs；容器只映射到 `127.0.0.1` 随机端口，并使用本次随机密码。工具不接受外部数据库连接参数，也不复用已有数据库。容器就绪后，在临时空工作目录执行 API **原有** `jest.config.ts`、globalSetup、setup 与 teardown，通过临时 migrations 链接及 APP_ROOT 定位原有源码。默认运行：

| 原有测试 | 验证范围 |
| --- | --- |
| `src/domain/pairs/solanaPairsService.test.ts` | 4 项数据库状态回归：不可用时 503、24h 成交量跨轮次去重、索引停滞与缓存过期、休市市场价格保留；外部 keeper/SQD 由该原有测试模拟 |
| `src/solanaApp.test.ts` | 1 项既有 Solana 样例应用检查，验证该应用路径不加载 EVM 配置；全局测试准备仍沿用原有数据库流程 |

工具不修改 API 默认配置，不跳过数据库迁移或测试 setup。测试进程只继承必要环境白名单，TEST_DB_CONNECTION 由工具生成并指向专属容器；不继承真实数据库、RPC 或钱包凭据，默认 dotenv 不会读项目 `.env`。原有 Jest 的 NODE_ENV=test 仍选择 Hardhat/master 测试配置，这不是 Solana 主网数据验收，也不启动生产 worker。

执行串行测试，关闭原有失败重试，整个 Jest 进程限时 180 秒；数据库就绪等待约 30 秒。沿用 API 原有 `--forceExit` 选项，因此不声称证明了 API 全部连接/定时器能自然退出；所属容器和临时目录清理由工具 finally 单独处理。正常结束或测试失败后，只删除 owner label 匹配的本次容器及其匿名卷，并检查容器已不存在。清理失败会让整次验收失败，报告中的 container ID 可用于定位，不删除其他容器或运行 Docker prune。

stdout JSON 的 `mode` 为 `isolated-postgres-integration`，包括 API commit/dirty、原有 Jest/DB setup/选定测试及迁移文件摘要、镜像 ID、随机端口、测试数量和 cleanup。只有所有选定 suite 全部通过、无 skip/todo、退出 0、源码未变化且清理成功，才报告 passed。前置条件不足在 stderr 报告固定错误；实际测试失败仍输出带日志位置的失败报告。连接密码不写入工具报告。

### 按需求选择测试文件

默认范围不变；需要验证其他 API 模块时，重复传入 `--suite`，文件路径相对于 `--api-dir` 指定的 API checkout：

```sh
yarn gmx-api:test-integration --suite src/lib/__test__/db.test.ts --suite src/domain/market/marketModel.test.ts
```

只执行实际选定文件，不自动追加默认两个 suite。文件必须是 API `src/` 内现有的 `.test.ts` 普通文件；绝对路径、越界路径、指向仓库外的符号链接、重复文件、目录、通配符及不存在文件都拒绝。校验在 Docker 操作前完成，错误退出 1，stderr 错误码为 `invalid-test-selection`。测试选择回归为 `yarn test:gmx-api-integration`，不依赖 Docker。

报告的 `suites`、测试计数及选定测试文件摘要随实际范围变化。每个自定义 suite 仍执行 API 原有数据库 setup/teardown；选得少不代表其他模块通过。其他 suite 可能还需代码生成或独立外部资源，路径校验通过不代表其依赖齐全；缺资源应明确处理，不通过修改断言、跳过测试或替代服务绕过。总超时仍为 180 秒，按本次需求选择范围。

### 时区前置与排障经验

2026-10-26 首次扩展市场模型测试时，本机 Asia/Shanghai 环境出现两项时间戳往返偏移 8 小时：预期 `2026-06-03T12:00:00.000Z`，实际 `2026-06-03T20:00:00.000Z`。保持业务代码与断言不变，仅将 Jest 子进程固定 `TZ=UTC` 后，数据库迁移及市场模型 11 项全部通过。工具现已显式固定 Node 测试进程和临时 PostgreSQL 为 UTC，并在报告输出 `timezone: UTC`；不会改变宿主机器时区或用户配置。

以后数据库时间戳断言失败时，先检查报告时区和实际存取值，再定位代码；不要立即重写断言或调整业务时间计算。这是可重复的 UTC 测试环境，不代表已经修复或验收业务在非 UTC 运行环境下的时间戳行为。初次失败记录 `integration-selected.json` 与最终 `integration-selected-utc.json` 均保留于本机证据目录。`db.test.ts` 会故意触发迁移未完成并断言退出行为，日志中的对应 FATAL 是该用例的预期输出；判断本次结果应查看 Jest 断言、退出码和结构化报告，不仅按日志级别判断。

| 2026-10-26 按需范围扩展 | 状态 |
| --- | --- |
| 自定义真实测试 | 已通过；迁移与市场模型 2 个 suite / 11 项，无跳过 |
| 默认范围回归 | 已通过最终复验；2 个 suite / 5 项，无跳过 |
| 路径约束 | 已通过；8 类无效选择与有效顺序/归一化的自动回归，非法 CLI 在创建容器前失败 |
| 自定义失败与清理 | 已通过；临时副本只执行指定测试，断言失败退出 1，仍清理容器；父进程 Asia/Shanghai 不影响子进程 UTC |
| 静态检查与交接 | 已通过；路径回归、Node 语法、ESLint、Prettier、yarn tscheck、文档链接及 git diff --check；未重跑完整 API/前端测试 |

自定义失败演练摘要为同目录 `integration-selection-acceptance.json`；临时副本已清理。该扩展复用原运行器，不增加新数据库服务或修改 API 文件。

日志、原始 Jest 结果及报告保留在 `.local/acceptance/solana-api-local/integration-*/`。入口为 `scripts/gmx-api-integration-tests.mjs`。本机最终报告为 `integration-latest.json`，失败与隔离验收摘要为 `integration-acceptance.json`，均在同一忽略目录，不随 Git 共享。

| 阶段 | 实施与验收状态 |
| --- | --- |
| 本地前置 | 已核实；Docker daemon 与 postgres:15 本地镜像可用，无新增资源需求 |
| 真实数据库测试 | 已通过；原有迁移/setup/teardown，2 个 suite / 5 项测试全部通过，无跳过；API commit `b86956df00902e44e0295827d651b206a6153942`，dirty false |
| 数据库隔离与清理 | 已通过；随机 loopback 端口，成功结束后删除容器；临时副本失败断言退出 1，仍清理容器，其他容器列表未变化 |
| 环境隔离 | 已通过；公开父进程凭据哨兵和副本 `.env` 没有进入测试，测试使用工具生成的 localhost 连接 |
| 静态检查与相关回归 | 已通过；Node 语法、ESLint、定向 Prettier、yarn tscheck、文档链接、git diff --check；离线计算 12 项与网络 guard 回归仍通过。未重跑完整 API/前端测试 |

本轮只新增测试运行基础设施。未修改业务代码、依赖、迁移或原有 Jest 配置；不代表完整 API、实时 RPC/keeper/SQD、前端集成或交易通过。失败注入在已删除的临时副本执行，不污染 API checkout。

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
