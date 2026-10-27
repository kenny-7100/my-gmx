# 本地 Solana API 样例验收服务

更新日期：2026-10-27。对应基础设施清单 A08；本文维护当前操作入口、前置条件和证明边界。2026-10-25～27 的执行结果已分离到[历史验收记录](solana-api-local-history.md)，过去的 passed 不能作为当前环境就绪证明。

## 按任务定位

所有工具从主仓库基础设施 checkout 根目录调用，目标 API 使用自己的锁定依赖；独立目录通过 `--api-dir PATH` 显式选择。下表仅帮助选择入口，不要求逐项执行。

| 当前任务 | 首选入口 | 前置与证明范围 |
| --- | --- | --- |
| 样例 HTTP 一次性检查 | [doctor / check](#agent-默认入口) | doctor 只读；check 启动并清理所属 API，先核对服务启动授权；仅证明 sample HTTP |
| 保留服务联调与热更新 | [持续服务](#日常命令与调试) | up / status / logs / stop，核对目标目录、端口与所属进程，不误停借用服务 |
| 样例 HTTP 源码断点验收 | [自动调试](#agent-可重复的源码断点验收) | 独立模式启动服务，attach 保留借用服务；核对实际源码映射及请求恢复 |
| 选择测试范围 | [按源码依赖发现](#按源码依赖发现-api-测试)或[按 Git 范围发现](#按-api-git-变更范围发现测试) | 只发现，不执行测试；基线属于目标 API，发现后仍需人工选择执行环境 |
| 纯计算与离线行为 | [离线入口](#gmx-api-solana-离线计算回归)及[离线调试](#api-离线测试源码断点调试) | 无数据库或真实外部服务；所选测试必须适合离线运行 |
| 新 checkout 或生成路由过期 | [路由准备](#gmx-api-路由生成准备与过期检查)及[失败恢复](#生成失败恢复与并发保护) | 先只读 verify；缺失或过期再显式 prepare，不自动构建或修复收据 |
| API 全项目类型检查 | [类型检查入口](#独立-api-checkout-的类型检查) | 依赖有效路由来源；根前端 tscheck 不能代替 API 检查 |
| 数据库状态或真实 Express 测试 | [隔离 PostgreSQL](#gmx-api-隔离-postgresql-集成测试)、[按需选 suite](#按需求选择测试文件)及[数据库调试](#数据库集成测试源码断点调试) | 本地 Docker / postgres:15；消费生成路由时显式[强制校验来源](#在集成测试中强制校验路由来源)，两类清理均需通过 |
| 独立功能 checkout 的执行与交付 | [目标目录与证据身份](#在独立-api-checkout-中运行测试) | 使用目标依赖与基线，报告留在基础设施目录；交付复核当前源码和原始产物 |
| 查询过去验证了什么 | [历史记录](solana-api-local-history.md) | 保留原日期、结果和本机证据位置，不刷新历史有效性 |

本地样例、离线 fixture、隔离数据库均不能替代[真实 API 部署身份](agent-acceptance-infrastructure.md#待协调资源与-a03-验收门槛)或 reviewed contract。执行前仍按[环境检查与顺序](coding-and-self-review.md#执行前的环境检查与顺序)选择所需项；缺服务资源时按根规则协调，不换源或补业务实现。

## 用途与边界

后续 Agent 验证 Solana 市场、持仓、订单和费用折扣的数据接入时，可直接启动现有 `gmx-api` 的 `LAUNCH_MODE=solana` 样例服务，并用同一条命令检查 HTTP 行为与源码样例是否一致。工具位于主仓库 [scripts/solana-api-local.mjs](../scripts/solana-api-local.mjs)，不复制服务或样例，不修改业务代码。

这是固定样例服务：不需要钱包、数据库、RPC、subgraph 或 keeper。返回的持仓、订单、地址占位符及金额不代表请求地址的真实链上状态；市场 `updatedAt` 是样例服务每次生成的时间，不证明链上数据新鲜。验收通过只代表本地服务与选定源码一致，不代表 A04 的 reviewed samples、真实 API、计算正确性或交易闭环已经通过。

2026-10-25 实时核对 [FESOL-62](https://linear.app/gmx-io/issue/FESOL-62)：该需求为 Done，评论说明样例服务已经部署；本轮没有取得或验证实际 `run.app` 地址，A03 仍待推进。不修改 Linear 状态，也不重新实现 FESOL-62。

## 持续运行的 Solana 联调环境

2026-10-26 已实施并验收。目标是持续运行当前 gmx-api 的正式 `LAUNCH_MODE=solana` 入口，供 Agent 请求接口、修改源码并联调。使用 `scripts/solana-api-dev.mjs` 管理现有 `tsx watch`，不复制 API、不改变业务或前端数据流。

### 日常命令与调试

在主仓库根目录执行，依赖 Node 22、POSIX 本地系统（本机 macOS 已验证）、现有 API checkout 及其锁定依赖：

```bash
# Start independently of the current terminal
yarn solana:api-dev up
# Check the owned process and all 14 HTTP checks
yarn solana:api-dev status
# Read the last 100 log lines, limited to the last 64 KiB
yarn solana:api-dev logs
# Stop the owned watcher and API process group
yarn solana:api-dev stop
```

默认 HTTP 地址为 `http://127.0.0.1:3004`。`up` 可加 `--api-dir PATH` 指向其他 checkout，所有命令可用 `--port 3014` 选择服务。控制命令按“本工作区 + API 端口”定位所属服务；`status` 报告中的 `apiDir` 为实际目标。重复 up 和被占用端口明确失败，不自动复用或关闭其他服务。命令退出 0 表示启动 ready、当前检查通过、日志读取成功或停服成功，失败退出 1。

需要断点时，在启动时显式指定：

```bash
yarn solana:api-dev up --inspect-port 9229
```

Node inspector 仅绑定 `127.0.0.1`；Chrome `chrome://inspect` 或 IDE 可连接 9229。已实际验证 inspector WebSocket 连接、HTTP handler 断点暂停和继续执行。自动重启会更换调试目标，调试器需重连；断点暂停期间 HTTP 请求可能超时，status 不会因此伪报健康。调试端口冲突会阻止启动。关闭 inspector 需 stop 后不带该选项重新 up。

源码 `src/**/*` 的变化由 tsx 监控，已验证响应修改、语法错误、修复后的重启和恢复；应用启动异常时 watcher 可继续等待修复，但 HTTP/status 为失败。watcher 本身意外退出时，管理进程清理所属子进程并记录失败，不无限自动重启。修改依赖、启动选项或工具本身后需 stop/up，依赖安装仍按锁文件流程进行。服务持续到显式 stop、系统退出或异常结束，不注册开机启动。

### 配置、日志与身份

无需新增 `.env.local` 变量。管理进程和 API 使用环境白名单，API 在临时空目录启动，固定 `LAUNCH_MODE=solana`、`NODE_ENV=development`、UTC 和选定 PORT，只传必要 PATH/TMPDIR/APP_ROOT/commit；不加载主仓库钱包配置或 API checkout 的 `.env`，不沿用 `yarn dev` 中关闭 TLS 校验的设置。已用无秘密的哨兵配置和运行时 inspector 核实隔离。

每次启动保留 `.local/acceptance/solana-api-local/dev-*/service.log`、`report.json`；stdout 给出绝对路径、API checkout、启动源码摘要、supervisor/watcher PID、数据模式及初次 14 项检查。`status` 实时重跑检查，返回当前期望源码摘要；`sourceAtStart` 是启动时证据，不能据此证明热更新后每个模块的加载身份。磁盘日志不自动轮转，长期开发按需停服后整理，不把它作为生产日志设施。`report.json` 是生命周期快照，ready 不代表读取时仍健康；当前健康状态必须运行 status。停服或失败后可直接读取保留的日志和报告。

控制通道是 `/tmp/gmx-solana-api-<uid>-<workspace-hash>-<port>.sock`，权限 0600，路径亦记录于报告；stop 通过所属管理进程清理进程组，不读取 PID 文件后盲目 kill。普通 stop 和 SIGTERM 已验证清理。管理进程被 SIGKILL 或系统崩溃无法保证清理；先核实报告中的进程、端口及 socket 归属，确认无所属服务后才手工清理残留，不自动接管未知资源。

现有 API 的 `listen(port)` 未指定 host，因此 HTTP 监听沿用 OS 默认地址，并非工具强制仅监听 loopback；报告明确记录这一点。此入口用于本机开发，不应映射到公网。它没有生产凭据、数据库或交易发送入口，也不代表经过生产环境部署验收。

### 当前接口和真实依赖边界

| 能力 | 当前 Solana 入口行为 | 运行依赖 |
| --- | --- | --- |
| `/ping` | `pong` | 本地进程 |
| `/v1/markets/config` | 仓库市场配置样例 | 本地 JSON |
| `/v1/markets/values` | 仓库市场数值样例；updatedAt 每次请求刷新 | 本地 JSON；时间更新不代表真实行情新鲜 |
| `/v1/positions`、`/v1/orders`、`/v1/fee-discount` | 校验 address 参数后返回固定样例，不按用户读取真实账户 | 本地 JSON，无需钱包资金 |
| `/v1/pairs`、EVM/其他 API 路由 | 当前入口不挂载，返回 404 | 不通过添加替代路由补齐 |
| PostgreSQL、Redis、RPC、keeper、SQD、后台采集 | 当前 `solana` 模式不启用 | 无需为此服务启动或配置 |
| 已有 Solana pairs 采集代码 | worker 由 `master` 模式持有，不在 Solana bootstrap 中执行 | 属于另一条运行路径，不能将其存在当作本服务已有真实数据 |
| 前端自动连接此服务 | 当前分支尚无 Solana API host 消费入口 | 随对应业务需求接入统一数据流；本轮验证浏览器直接请求/CORS |

以上根据 `src/index.ts`、`src/solanaBootstrap.ts`、`src/solanaApp.ts`、`src/config/launchModes.ts` 核实，API commit 为 `b86956df00902e44e0295827d651b206a6153942`。无需用 EVM master 模式或旧 GMTrade 服务来绕过 Solana 的真实数据缺口；未来入口切换为真实数据时，需同步更新检查器与模式证据，不能仍沿用 sample 成功口径。

### 本轮验收结果

见[历史验收记录](solana-api-local-history.md#持续服务验收记录)。

## 执行前准备与顺序

### Agent 可重复的源码断点验收

2026-10-26 新增 `yarn solana:api-debug`。用途是让后续 Agent 独立核实“当前 API checkout 可以命中 TypeScript 源码断点、查看局部变量并恢复真实请求”，复用已有持续服务和 Node inspector。工具只位于主仓库 `scripts/`，不修改 API、前端或 SDK 业务代码，不新增依赖。

在主仓库根目录执行：

```bash
# Start an owned sample API, verify debugging, then stop it
yarn solana:api-debug
# Choose unused ports explicitly
yarn solana:api-debug --port 3017 --inspect-port 9237
# Attach to an existing managed API with inspector enabled; keep it running
yarn solana:api-debug --attach --port 3016
# Regression checks use an isolated real Node inspector fixture
yarn test:solana-api-debug
```

默认独立使用 API 3017 / inspector 9237；不会停止或重配默认 3004 上的已有服务。借用模式只连接本工作区 `solana:api-dev` 管理且启用了 inspector 的服务，核对 `--api-dir`（默认 `gmx-api`）与实际 checkout；inspector 地址从服务记录取得，`--inspect-port` 仅用于独立启动。未知端口占用或未启用 inspector 均失败，不接管、不重启、不降级成普通 HTTP 验收。请串行执行调试验收，使用专门的调试服务，避免与人工调试同时操作同一进程。

组合前后端联调时，可通过[工作区调试入口](solana-dev-workspace.md#工作区内的-api-源码断点调试)在 `solana:dev up` 显式加 `--api-inspect-port PORT`，再用本节 `--attach --api-dir PATH --port PORT` 验收实际 API checkout；调试器保留 API，服务由工作区按原归属管理。

实际验证步骤：

1. 连接服务记录中的 loopback Node inspector，读取已加载脚本。
2. 核对 `src/solanaApp.ts` 路径及 tsx inline source map 中的源码与当前文件逐字一致；把 `/positions` handler 的地址校验行映射到可执行断点。路径、源码、映射或 handler 结构变化时明确失败，需要人工核对场景，不猜测其他位置。
3. 设置只对本次随机 `X-Trace-Id` 生效的断点，用公开固定地址及 `invalid` 分别发送真实 GET 请求。其他请求不命中该断点；进程暂停期间仍会暂时阻塞该 API 的其他请求。
4. 两次均核对实际断点、源码行和调用栈；使用无副作用求值读取 `req.query.address`、`req.method`、`req.path`。不读取钱包、环境变量或任意完整作用域。
5. 恢复执行，分别核对 200 样例内容和 400 原始错误；比较验收前后 API commit、dirty 和既有关键文件摘要。
6. 清除自身断点、禁用本调试会话并断开；独立模式按 supervisor 身份关闭所属服务，借用模式保留服务。普通 SIGINT/SIGTERM 会进入清理；SIGKILL/系统崩溃不能保证清理，沿用持续服务的归属核实规则。

退出 0 表示该调试场景及清理通过；退出 1 表示失败。正常运行在 `.local/acceptance/solana-api-local/debug-*/report.json` 保存报告，包含阶段、错误摘要、源码位置、限定变量、前五层调用栈、HTTP 结果及资源清理状态；参数或目录配置错误在 stderr 报告。单条 inspector 命令/断点事件默认限时 5 秒，HTTP 请求限时 12 秒。报告不保存完整 inspector 输出或 API 响应正文。

这里验证 source map 与当前源码的对应关系，不是整个进程所有已加载依赖的身份认证，也不证明业务契约、真实链上持仓、钱包或交易已验收。HTTP 场景继续明确标为 sample，`businessAcceptance=not-run`。

实现入口为 [solana-api-debug.mjs](../scripts/solana-api-debug.mjs)，CDP 通信辅助为 [agent-inspector.mjs](../scripts/lib/agent-inspector.mjs)。后续排查源码断点问题可先运行此命令，不需要启动前端、数据库、RPC 或旧后端。

见[历史验收记录](solana-api-local-history.md#源码断点自动验收记录)。

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

# Select exact existing source suites; repeat --suite to combine
yarn gmx-api:test-offline --suite src/lib/__test__/number.test.ts
yarn gmx-api:test-offline --suite src/lib/__test__/number.test.ts --suite src/domain/gmUserEarnings/math.test.ts

# From gmx-api
node ../scripts/gmx-api-offline-tests.mjs --api-dir .
```

适用于修改或核对纯计算及离线行为时的快速回归。默认继续执行以下两个原有 Solana 测试集；2026-10-27 已扩展为支持重复 `--suite src/...test.ts` 精确选择其他现有测试。路径校验复用隔离集成测试的选择器：只接受所选 API checkout 内真实存在的 `src/**/*.test.ts`，拒绝重复、缺失、目录、glob 及逃逸符号链接。选择需要数据库、HTTP 或外部数据的测试会明确失败，不自动补依赖或切换 profile。

| 原有测试 | 当前覆盖 |
| --- | --- |
| `src/domain/gmtrade/marketStatus.test.ts` | 7 组市场 fixture，核对资金费率方向、流动性、持仓价值及市场账户解码 |
| `src/domain/pairs/solanaPairsRows.test.ts` | 5 项 pair 输出、价格/成交量、funding 间隔、禁用市场，以及开放/休市市场的陈旧数据行为 |

依赖 Node 22 及 API 锁定的 Jest / ts-jest / 业务依赖。工具以独立 Jest 配置串行运行所选测试，不调用原配置的数据库 globalSetup / teardown，不启动服务；ts-jest 使用 CommonJS 及 Node 模块解析转换现有测试。原有数据库集成和 Solana launch-mode 测试仍按 API 默认流程运行，本入口没有覆盖它们，也不替代完整 API 测试。

测试进程使用临时空工作目录和环境变量白名单，不继承钱包/数据库凭据或 `NODE_OPTIONS`，dotenv 默认不会读取项目 `.env`。网络 guard 拦截测试环境中常见 Node HTTP、TCP、TLS、HTTP/2、UDP、DNS 和 fetch 入口；外连尝试即时报错，且即使异常被捕获，suite 的 afterAll 仍报告失败。这是用于防止意外外连的测试约束，不是操作系统级沙箱，不支持不可信测试代码。

运行总超时 120 秒、单项测试超时 10 秒，不重试、不使用 forceExit 掩盖未清理资源。成功要求所选 suite 及每份文件内的实际断言全部通过、测试非空且无 skip/todo、实际结果文件路径与选择精确一致且无重复、进程退出 0，并且运行前后的源码证据一致。已通过的是历史 fixture 回归，不证明当前链上状态或实时 keeper / SQD 数据。

stdout 输出 `mode: offline-fixtures` 的 JSON，含实际 apiDir、API commit/dirty、选定文件摘要、guard 摘要、测试数量和 excluded 范围。`sourceInputs` / `sourceInputsAfter` 聚合 API `src/` 下 TS/JS/JSON（含本地模块、fixture 和生成源码）及 package、锁文件、tsconfig 的摘要与文件数，不仅检查测试文件；源码符号链接需先显式审查，不自动跟随。此摘要不覆盖所有已安装第三方包内容或项目外任意读取，不能代表完整运行时/部署身份。测试固定 TZ=UTC。成功退出 0，其余退出 1；测试失败也保留结构化报告。前置条件缺失时 stderr 给出固定诊断信息，不启动数据库或自动安装依赖。

运行器为 Jest 创建独立 POSIX 进程组。测试成功、失败或主进程提前退出后，仍会检查并终止组内存活子进程；120 秒超时直接终止该组，SIGINT / SIGTERM 中断先发送 SIGTERM，1 秒后仍未退出则发送 SIGKILL。报告 `exit` 包含 `processGroup`、`interrupted`、`timedOut`、`cleanup`，信号发送异常时另有 `signalError`；中断、超时、清理失败或信号异常均不能判为 passed，即使 Jest 已生成成功结果。清理使用系统 `ps` 核实组内非 zombie 进程，不影响其他进程组；适用于本项目 macOS/Linux 环境，不保证清理由测试主动脱离进程组的后代，也不能在运行器自身被 SIGKILL 后执行清理。进程生命周期回归为 `node --test scripts/agent-test-process.test.mjs`，已纳入 `yarn test:agent-tools`。

每次实际执行的日志与原始 Jest JSON 保存在 `.local/acceptance/solana-api-local/offline-*/`，报告提供 `logFile`、`resultsFile`；临时工作目录自动清理。源码身份不是当前部署身份。工具入口为 `scripts/gmx-api-offline-tests.mjs`，guard 回归为 `yarn test:gmx-api-offline`。

见[历史验收记录](solana-api-local-history.md#离线执行与进程清理验收记录)。

### 按源码依赖发现 API 测试

在主仓库根目录使用 Node 22，先准备目标 API 的锁定依赖，再执行：

```sh
yarn gmx-api:discover-tests --api-dir /path/to/gmx-api --related src/domain/gmtrade/marketStatus.ts
```

可重复传入 `--related`，只接受目标 checkout 内真实存在且不经过符号链接的 `src/` 下 TS/JS/JSON 文件，不接受 glob、重复或逃逸路径。省略 `--api-dir` 时使用本仓库的 `gmx-api/`。工具复用目标实际安装的 Jest、原 `jest.config.ts`、路径别名及依赖图，通过 `--findRelatedTests --listTests --json` 列出直接和间接受影响的测试；不执行测试正文、数据库 globalSetup/globalTeardown 或 setupFilesAfterEnv，不启动数据库或服务，也不生成路由。

**发现通过只表示获得测试清单。** Agent 应先检查返回的 `suites` 及真实依赖，再明确选择已有 `gmx-api:test-offline` 或 `gmx-api:test-integration`，逐个传入 `--suite`；不得把整个发现清单直接当作离线测试。实际 `marketStatus.ts` 的依赖图也会涉及 HTTP/数据库 suite，本工具不根据文件名猜测 profile。动态加载、Jest 未解析的依赖和原有测试覆盖缺口仍需人工核对；发现不能代替需求验收。

每次输出 `mode: api-jest-related-discovery` 的 JSON，保留输入源码、API commit/dirty、配置及完整源码聚合指纹、工具/运行时身份、精确 suite 清单、日志、原生 Jest 清单和进程退出/清理结果。报告在 `.local/acceptance/solana-api-local/discovery-*/`，临时空 CWD 和 Jest 缓存会清理。子进程仅继承 PATH、测试/UTC/CI 设置及审计位置，不加载调用方凭据；使用既有 Node 网络保护器并独立核对安装与拒绝事件。原 Jest 配置本身仍会被加载执行，此约束用于防止意外联网，不是运行不可信配置的系统沙箱。

退出 0 为发现通过；退出 1 为发现失败（包括零匹配、原生错误、联网尝试、中断、超时、清理失败或执行前后源码/工具变化）；退出 2 为参数或前置条件阻塞。零匹配不会退回默认 suite。当前执行器只支持 `src/**/*.test.ts`，发现其他命名的测试会明确拒绝，需要人工选择适用的执行流程。

见[历史验收记录](solana-api-local-history.md#关联测试发现验收记录)。

#### 按 API Git 变更范围发现测试

已知 API 功能分支的明确基线时，可以省去手工列举源码：

```sh
yarn gmx-api:discover-tests --api-dir /path/to/gmx-api --changed-since origin/release
```

`--changed-since` 与 `--related` 互斥，REF 在目标 API Git 根目录中解析，不使用主前端仓库的分支；执行前固定为 commit SHA。它直接比较基线树和当前工作树/索引，并合并未忽略的未跟踪文件，覆盖相对基线已提交、暂存、未暂存及新增源码，不自动寻找 merge-base，不 fetch 或切换分支。先核对报告 `changes.baseSha` 是否为本次期望基线。

仅接受全部变化都属于现存 `src/` 下 TS/JS/JSON 的范围。空范围、删除、迁移、配置、文档、依赖或资源混合改动均退出 2，提示人工评估并使用 `--related`；不会悄悄忽略清单外文件，也不以“无源码变化”代表无需测试。忽略文件不进入 Git 范围；生成路由等忽略源码仍受原有源码指纹约束，但其准备状态及覆盖范围需按对应流程核对。

报告 `changes` 保存原始 ref、固定 SHA、HEAD、工作树/索引/未跟踪路径及最终源码清单，再复用上节原生 Jest 流程。发现结束时以固定 SHA 重算范围，记录 `changesAfter` 和 `changesUnchanged`；新增路径、暂存状态或 HEAD 改变均不得通过。源码内容变化另由原有 `sourceUnchanged` 检查覆盖。任何阶段 failed 都不能复用该次结果；发现成功也仍须明确选择离线或数据库执行环境。

Git 范围读取固定禁用索引自动刷新、外部 diff、textconv 和 rename 推断，并使用内容 numstat 与 NUL 分隔路径。文件恢复原字节后不会仅因 stat 缓存而误选；检查不写入目标索引，不修改用户暂存状态。

见[历史验收记录](solana-api-local-history.md#git-范围发现验收记录)。

### 在独立 API checkout 中运行测试

2026-10-27 起，离线与隔离数据库入口的测试身份读取独立于样例服务。显式选择普通 API suite 时，不再要求无关的 `solanaApp.ts`、`solanaBootstrap.ts`、Solana 样例 JSON、默认测试文件或 `solanaPairsService.ts`；所选测试自身的真实导入和数据库测试框架文件仍须完整。

从基础设施主仓库执行：

```sh
yarn gmx-api:test-offline --api-dir /path/to/api-checkout --suite src/domain/gmUserEarnings/math.test.ts
yarn gmx-api:test-integration --api-dir /path/to/api-checkout --suite src/domain/market/marketModel.test.ts
# Debug one selected source suite using its target checkout.
yarn gmx-api:test-offline --api-dir /path/to/api-checkout --suite src/domain/gmUserEarnings/math.test.ts --inspect-port 9239
```

目标须为 API Git checkout 根目录，已按自身锁文件安装依赖；不自动安装、链接基础设施目录依赖、切换分支或准备生成路由。数据库入口仍要求本地 Docker 与现有 postgres:15 镜像，并保留原迁移及 setup；消费 TSOA 路由的测试仍先按[生成准备说明](#gmx-api-路由生成准备与过期检查)处理目标目录。缺文件、依赖或资源明确失败，不改用其他环境。

报告的 `apiDir` 为目标真实路径，`source.commit/dirty/sha256` 来自目标 Git 和所选文件/必要配置；`sourceInputs/sourceInputsAfter` 继续覆盖全部 API 源码和 package/lock/TS 配置，集成入口另外核对原 Jest/DB setup 与迁移文件。离线 `sourceHashes` 仅列所选 suite，其他源码由聚合指纹覆盖。Git 根目录不匹配会在执行测试或创建数据库前失败，不将父仓库身份当作 API 身份。证据始终保存在基础设施目录 `.local/acceptance/solana-api-local/`，不会向目标写入测试配置或报告；普通和断点模式共用该流程。

见[历史验收记录](solana-api-local-history.md#独立-checkout-执行验收记录)。

此能力不改变默认 Solana suites，也不改变样例 HTTP 服务、doctor/check 或 `solana:api-debug` 的样例文件要求；测试通过不等于 API 已部署、真实数据或整项需求验收通过。

需要作为 API 交付证据时，按[API 测试证据绑定](linear-development-workflow.md#api-测试证据绑定)对当前 API checkout 使用 `agent:delivery-check --require-clean --api-report PATH`，可同时选择离线和数据库报告。两类报告新增 `schemaVersion`、`sourceAfter`、`toolSha256`、`runtime` 和 `toolingUnchanged`；离线另显式记录 `temporaryDirectoryCleanup`。工具或 Node/Jest/转换器版本运行中变化会失败；交付检查还会重新核对原始结果和网络日志。旧报告需重跑，不手工补字段。

### API 离线测试源码断点调试

2026-10-27 已实现并真实验收。需要排查现有 API 纯计算测试时，在主仓库根目录显式选择一份 suite：

```bash
yarn gmx-api:test-offline --suite src/domain/gmUserEarnings/math.test.ts --inspect-port 9239
```

1. 入口先检查 loopback 端口可用，再输出 `API offline debug session`，含 inspector、日志、报告路径及总时限。这只是启动安排；该次 `jest.log` 出现 `Debugger listening on ws://127.0.0.1:9239/...` 才说明 inspector 已监听。端口占用明确失败，不接管或停止既有服务。
2. Chrome `chrome://inspect` 配置 `127.0.0.1:9239` 后 Inspect，或用 IDE 的 Node attach。Agent 可复用 `scripts/lib/agent-inspector.mjs`，连接该端口 `/json/list` 返回的 WebSocket；它属于本次 Jest 主进程，`--runInBand` 不另启测试 worker。仅允许 `127.0.0.1` 监听。
3. 开启 source maps，在当前 API checkout 的 TypeScript 文件设置断点，再恢复初始暂停。本机已在 `src/domain/gmUserEarnings/math.ts` 的 `calcEndOfPeriodIncome` 条件行命中，读取 `latestBalanceChange.tokensBalance`、`accumulatorNow` 和原测试调用栈。初始暂停、端口可连接或测试通过均不能替代目标源码断点证据。
4. 自动化连接 Jest 时，可在恢复前用 `Debugger.setBreakpointByUrl` 对目标文件 URL 设置入口断点；命中后检查 `Debugger.scriptParsed` 的 inline source map 与磁盘源码一致，用映射和 `Debugger.getPossibleBreakpoints` 选择具体 TypeScript 行。ts-jest 的 data URL 可包含 `charset=utf-8`，不能只接受 SDK 使用的固定前缀。本机 Jest VM 场景中 `beforeScriptExecution` 未截住目标文件，改用 URL 断点完成验收，不照搬 SDK 的 instrumentation 流程。
5. 完成后移除自身断点、恢复执行并断开调试器；Node 可能在测试已结束后仍等待 debugger 断开。需要中止时对外层命令 Ctrl-C / SIGTERM，沿用所属进程组清理，核对报告 `exit.cleanup` 和端口释放。

调试整次上限 30 分钟，包含等待连接与暂停；普通模式仍为 120 秒，原 suite 单项 10 秒超时保留。仅支持单 suite，保留空 CWD、环境白名单、UTC、联网保护及前后源码指纹，不需要数据库、API HTTP 服务或构建。报告新增 `debug.inspector`、`pauseOnStart`、`timeoutMs`、`started`，启动日志未确认 inspector 成功时不得 passed；日志确认仍不能证明实际命中断点。前置失败在 stderr 提供具体诊断，退出 1。

见[历史验收记录](solana-api-local-history.md#离线源码调试验收记录)。

## gmx-api 路由生成准备与过期检查

2026-10-26 已完成并验收。新 checkout 的 `src/codegen/tsoa/` 可能缺失；`src/app.ts` 直接导入生成的 v1/v2 路由及 Swagger。需要测试真实 Express 路由或修改 TSOA controller/类型时，先检查生成状态，再运行相关测试；仅运行已有 Solana 样例服务或纯计算测试不需要这一步。

在主仓库根目录执行（依赖 Node 22 与 API 已安装的锁定依赖）：

```bash
yarn gmx-api:prepare --verify
# If missing or stale
yarn gmx-api:prepare
yarn gmx-api:prepare --verify
yarn gmx-api:test-integration --require-routes --suite src/routes/routeMap.test.ts --suite src/routes/v1/relay/__test__/relayLaunchMode.test.ts
```

工具为 `scripts/gmx-api-prepare.mjs`，支持 `--api-dir PATH`。生成命令依次运行 API 原有 `tsoa.json` 与 `tsoa-v2.json` 的 `spec-and-routes`，写入 `src/codegen/tsoa/` 中四个已被 API Git 忽略的文件，不修改业务源码、配置或依赖。每阶段限时 120 秒，不启动 API/数据库，不安装依赖或连接真实 keeper。stdout 输出结构化报告，生成报告、阶段日志及清单保留于 `.local/acceptance/solana-api-local/prepare-*/` 与 `prepared-*.json`，按 checkout 绝对路径区分。`tsoa.log` 现在保存阶段日志路径与进程退出/清理摘要，原始输出分别在 `tsoa.json.log`、`tsoa-v2.json.log`。

`--verify` 只读比较清单：记录 `src/` 下 TS/TSX/JS/JSON（排除生成目录）及 package/lock/TS/TSOA 配置的摘要、四个产物摘要，并检查 OpenAPI 3 非空路径和路由注册入口。源码检查有意保守，测试文件变化也要求重生成。2026-10-27 起收据升级为 schemaVersion 2，加入下述实际生成工具指纹；旧收据不再当作当前证据。返回 0 表示摘要一致；有效文件但源码、工具、产物摘要或收据版本变化返回 2 / `regeneration-required`；文件、清单缺失或格式错误、目标不符合约定、生成失败返回 1 / `api-generation-not-ready`。失败时先确认 Node/依赖/文件和目标约定，再查看生成日志，不手改产物或收据绕过检查。

新增来源及输出检查：

- `--api-dir` 必须是 API Git 根目录。生成前核对两份原配置的输出目录和文件名仍为 `src/codegen/tsoa/` 下的四个约定产物，逐个确认被 Git 忽略且未跟踪，拒绝输出目录/文件符号链接；不自动修复配置或忽略规则。源码输入也拒绝未经核实的符号链接。
- `tooling` 记录 Node 版本/可执行文件、准备脚本与 Git 来源辅助脚本摘要，以及实际解析到的 `tsoa`、`@tsoa/cli`、`@tsoa/runtime`、TypeScript 的目录、版本、文件数和摘要。扫描三个 TSOA 包的 package.json/dist（含模板），以及实际 TypeScript 的 package.json/lib；沿生成器模块解析链选择依赖，不假定 API 根目录版本就是实际版本。本机根 TypeScript 为 5.4.2，TSOA 实际使用其嵌套的 5.9.3。
- 生成结束前再次核对源码、工具与输出约定；任一变化不得写入新成功收据。`repository` 记录当前 Git 身份，verify 另以 `generatedRepository` 展示原生成时身份；纯 Git 提交变化不替代实际输入比较。已进入忽略目录的中间产物不作为成功证据，失败后仍须按日志处理并重新生成。
- 本次检查覆盖上述四个实际工具包，未覆盖所有传递依赖、外部业务类型包或完整 TypeScript 导入图；仍须准备目标锁定依赖。依赖目录移动、工具脚本或 Node 改变时也要求重生成，不从其他 checkout 复制收据。旧 schemaVersion 1 在文件有效时退出 2，应对实际目标显式重新执行 prepare，再 verify；工具不自动执行生成。

见[历史验收记录](solana-api-local-history.md#路由生成来源验收记录)。

### 生成失败恢复与并发保护

2026-10-27 已验收。生成按 API realpath 在基础设施目录持有 `prepared-<path-hash>.json.lock`，记录 pid、apiDir、runDir 和时间。同一 checkout 的第二次生成以 `generation-in-progress` / 退出 1 拒绝；verify 在读取前后检查生成锁，发现正在生成也退出 1，不把中间文件当作当前产物。不同 checkout 分别管理。锁不授予停止其他进程或删除其文件的权限，也不阻止人工/其他工具直接修改产物。

取得锁后先保存四个产物及旧收据的原字节/缺失状态，再重新核对输入与输出约定。两个生成阶段复用共享进程组管理，每阶段限时 120 秒；普通 SIGINT/SIGTERM 标记失败、停止所属生成进程组，然后恢复旧文件并逐个核对。旧文件缺失时删除本次生成的对应文件。全部生成及输入/产物检查通过后，以 rename 替换新收据；失败不会保留新成功收据，原收据恢复不等于当前输入通过，修改过生成工具后仍需恢复环境或重新生成。

失败报告为该次 `prepare-*/report.json`，CLI stderr 提供 `reportFile`、`logFile`；检查 `failureStage`、`interrupted`、阶段 `exit.cleanup` 与 `restoration`。恢复失败明确记录 `restoration=failed`，不能复用产物。恢复备份仅保存在当前进程内存，SIGKILL、崩溃或断电无法保证恢复；残留锁须先核对记录进程及所属生成任务，不能自动删锁或假定旧产物完整，确认无人运行后按实际目标重新准备并 verify。正常成功、失败和中断均释放所属锁；生成期间避免运行消费这些产物的其他测试。

见[历史验收记录](solana-api-local-history.md#路由生成恢复验收记录)。

这证明本地生成状态，不能替代类型检查、HTTP 回归、A04 契约评审或部署/真实数据验收。生成报告明确 `runtimeVerification: not-run`，运行时验证须单独执行上面的测试。

ABI 加载使用 `process.cwd()/src/abi`，仅设 `APP_ROOT` 不足。后续遇到 `ABI directory not found`，先核对测试 CWD 的真实 `src/abi` 资源链接，不调整业务查找逻辑或移除隔离目录。现有 HTTP 用例沿用原测试的本地 keeper stub，不访问真实 keeper、不发送链上交易。

见[历史验收记录](solana-api-local-history.md#路由生成初次验收记录)。

### 独立 API checkout 的类型检查

在主仓库基础设施目录执行，目标使用自己的 TypeScript 与 `tsconfig.json`，无需包含个人工具：

```sh
yarn gmx-api:prepare --api-dir /path/to/api-checkout --verify
# Prepare explicitly only when routes are missing or stale.
yarn gmx-api:prepare --api-dir /path/to/api-checkout
yarn gmx-api:tscheck --api-dir /path/to/api-checkout
```

已有有效收据时直接运行 `gmx-api:tscheck`，无需重复 verify 或 prepare。它检查 API 整个原有 TS 项目，不按 Solana 模块缩小范围；固定 `--noEmit --incremental false --pretty false`，不运行 package lifecycle，不生成路由、构建、写增量缓存或启动数据库/HTTP/RPC 服务。根前端的 `yarn tscheck` 不包含嵌套 API，不能代替本入口。

前置要求为 Node 22、API Git 根目录、该目标已安装的锁定依赖，以及有效的路由收据与产物。运行前后只读 verify 路由来源；缺失/过期时退出 2 / blocked，按上面的显式准备步骤处理，不能关闭校验或手改收据。检查期间使用独立环境，仅传 PATH、临时目录和 UTC，不继承 NODE_OPTIONS、TS_NODE 或业务环境变量。TypeScript 不执行项目业务代码，不需要凭据。

每次结果位于基础设施目录 `.local/acceptance/gmx-api-tscheck/run-*/`：`tsc.log` 保留原生诊断，`report.json` 和 stdout 记录实际 apiDir、Git commit/dirty、源码前后指纹、Node/目标 TypeScript 版本与编译器内容指纹、路由前后证据、退出码、原始日志 SHA-256 及所属进程组清理。退出 0 / passed 要求原生编译成功、无中断/超时/信号异常、进程清理成功，源码/工具/路由前后均一致；类型错误或检查期间变化退出 1 / failed。普通编译失败查看报告的 `logFile`，不修改类型断言或业务逻辑来绕过错误。整次编译限时 180 秒，SIGINT/SIGTERM 复用现有进程组清理工具；SIGKILL/机器崩溃仍需人工核实所属进程。

源码指纹覆盖 `src/`（含忽略的生成文件）、可选 `scripts/`、`migrations/` 中全部普通文件，以及根 JSON/TS/JS 配置与 yarn.lock；拒绝这些源码目录中的符号链接。编译器指纹覆盖实际 TypeScript lib/bin，未逐字节核对全部第三方依赖，外部扩展配置或其他自定义源码目录也不在本轮指纹范围。dirty checkout 可用于开发反馈，但报告不能充当干净交付版本证明。用于干净 API 交付版本时，按[类型检查证据绑定](linear-development-workflow.md#api-类型检查证据绑定)使用 `--require-clean --api-typecheck-report PATH`，只读复核当前身份、源码/编译器、路由来源及原始日志摘要；`--api-report` 仍只接受原有测试报告，不把类型检查当作测试或业务验收。

见[历史验收记录](solana-api-local-history.md#api-类型检查验收记录)。

### 在集成测试中强制校验路由来源

需要测试真实 TSOA 路由或导入 `src/app.ts` 时，在主仓库根目录执行：

```sh
yarn gmx-api:prepare --api-dir /path/to/api-checkout --verify
# Explicitly regenerate first when missing or stale, then run the existing tests.
yarn gmx-api:test-integration --api-dir /path/to/api-checkout --require-routes \
  --suite src/routes/routeMap.test.ts \
  --suite src/routes/v1/relay/__test__/relayLaunchMode.test.ts
```

`--require-routes` 在 API 目录规范化后、Docker 环境及容器准备之前，复用 prepare 的只读 verify；收据缺失、旧版本、输入/生成器/产物过期或生成锁存在时，返回退出 1 / `generated-routes-prerequisite`。它不会自动生成、安装或修复产物。已明确需要运行测试时可直接调用带此参数的集成入口，无需先重复 verify；预先 prepare 的操作与授权仍按上节处理。

Jest 执行、进程和容器清理结束后，再次 verify 并逐项比较 schema、API 目录、源码输入、工具与四个产物摘要。报告 `generatedRoutes.before/after` 保留两次证据，全部一致为 passed；缺失、过期或变化为 failed / `generated-routes-changed`，即使原生 Jest 断言全通过也不接受整体结果。`generatedRoutes=not-checked` 表示未选择该前置，不代表产物已验证。默认纯计算/数据库场景保持原流程；不根据文件名猜测是否需要路由，调用者须按真实导入选择。API 测试工具指纹已包含准备脚本，工具变化后旧测试证据需要重跑。用于[API 交付证据绑定](linear-development-workflow.md#api-测试证据绑定)时，delivery-check 会再次只读 verify，并比较测试前、测试后与当前来源；测试通过后改动生成器或忽略产物、丢失收据也会 blocked。未启用路由校验的报告在交付结果中明确标记 not-checked。

该检查不锁住整个测试期间的产物，也不能证明外部消费者没有并发修改后又恢复文件；测试期间避免同时生成或人工修改。它验证来源与前后稳定性，不替代业务路由契约、线上部署或完整 API 测试。

见[历史验收记录](solana-api-local-history.md#强制路由来源验收记录)。

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

执行串行测试，关闭原有失败重试，整个 Jest 进程限时 180 秒；数据库就绪等待约 30 秒。沿用 API 原有 `--forceExit` 选项，因此不声称证明了 API 全部连接/定时器能自然退出；Jest 通过共享 `scripts/lib/agent-test-process.mjs` 在独立 POSIX 进程组运行，主进程退出后也检查并终止组内存活子进程；SIGINT / SIGTERM 先发送 SIGTERM，1 秒后仍未退出则强制结束，180 秒超时直接结束所属组。使用系统 `ps` 核实非 zombie 成员已消失，不保证清理由测试主动脱离进程组的后代，运行器自身遭 SIGKILL/系统崩溃也无法执行 finally。测试进程清理完成后，所属容器和临时目录由工具 finally 单独处理。正常结束或测试失败后，只删除 owner label 匹配的本次容器及其匿名卷，并检查容器已不存在。清理失败会让整次验收失败，报告中的 container ID 可用于定位，不删除其他容器或运行 Docker prune。

stdout JSON 的 `mode` 为 `isolated-postgres-integration`，包括 API commit/dirty、原有 Jest/DB setup/选定测试及迁移文件摘要、镜像 ID、随机端口、测试数量和 cleanup。`exit` 单独记录测试进程的 `processGroup`、`interrupted`、`timedOut`、`cleanup`，信号异常时包含 `signalError`；顶层 `cleanup` 仍表示所属容器及临时目录清理。中断、超时、进程或容器清理失败均不能 passed，`errorCode` 分别标识 `interrupted`、`test-timeout` 或 `process-cleanup-failed` 等执行问题。只有所有选定 suite 全部通过、无 skip/todo、退出 0、源码未变化且清理成功，才报告 passed。前置条件不足在 stderr 报告固定错误；实际测试失败仍输出带日志位置的失败报告。连接密码不写入工具报告。

### 离线测试的独立网络审计

前端、SDK 和 API 离线入口共用[网络审计](frontend-offline-tests.md#结束时核对网络审计)。API 报告新增 `network`：安装数等于所选 suite 数且拒绝次数为 0 才能通过。运行器在 Jest 结束后读取 `network-events.log`，即使最后 afterAll 捕获了联网异常、原生 Jest 仍 success，也会整体失败。API 隔离数据库集成入口复用同一份事件读取逻辑，保留其独立的数据库/本地服务器策略和错误码；两类 profile 不交换网络权限。

见[历史验收记录](solana-api-local-history.md#离线网络审计验收记录)。

### 集成测试的网络范围

2026-10-27 起，`gmx-api:test-integration` 默认在所选 Jest suite 执行前安装[网络限制](../tools/gmx-api-integration/network-guard.cjs)。仅允许 loopback 上本次临时 PostgreSQL 端口，以及测试进程自己创建且仍在监听的 TCP 服务器，保留 Supertest 临时 HTTP 服务；外部地址、无关本地服务及 Unix socket 均拒绝。阻断 TLS、UDP、外部 DNS 查询及独立 DNS Resolver；普通 HTTP/fetch 的底层 socket 同样受限。数据库的 `localhost` 解析保留，不将真实服务响应替换成模拟数据。

运行器读取原 Jest 配置的 `setupFilesAfterEnv`，在其前面加入 guard，保留原有 setup 顺序、迁移、全局 setup/teardown 和断言。每个 suite 检查捕获后的网络尝试；另外将安装和拒绝事件记录到本次 `network-events.log`，运行器独立核对。因此即使测试捕获异常，或在最终 afterAll 中捕获异常且原生 Jest 仍成功，整体验收也会失败。`network.installations` 必须等于选定 suite 数，`blockedAttempts` 必须为 0；报告另保留 policy、guardSha256 和作用范围。

出现 `errorCode=network-access-forbidden` 时查看本次 Jest 日志，核对所选测试是否确实需要真实外部依赖；不要关闭限制、捕获异常压过失败或连接共享数据库。确实需要外部服务的场景使用其完整验收环境。`network-guard-not-installed` 表示未完整安装，应检查本次启动/配置失败，不能只复用原生成功结果。该入口没有绕过开关，源码断点模式同样保留限制。

保护作用于所选 Jest 测试进程的常见 Node 网络入口，不是操作系统沙箱。原有全局 setup/teardown、配置加载仍作为可信测试基础；不防御测试主动撤销保护、另起外连子进程或使用原生扩展。它不代表整个 API 已完全离线，也不代替所选测试范围及真实业务需求的验收。

见[历史验收记录](solana-api-local-history.md#集成网络限制验收记录)。

### 集成测试的完整源码指纹

2026-10-27 已补齐。原有 `source.sha256` 继续记录选定测试、数据库配置、Jest setup/teardown 及迁移等文件；报告另有 `sourceInputs` / `sourceInputsAfter`，由与 API 离线入口共享的 `scripts/lib/gmx-api-source.mjs` 计算。聚合指纹覆盖全部 `src/` 下 TS/JS/JSON，以及 `package.json`、`yarn.lock`、`tsconfig.json` 的相对路径和内容，报告摘要及文件数；已有依赖修改、文件新增/删除都会改变指纹。源码符号链接明确拒绝，不自动跟随。普通模式和调试模式使用同一检查，不新增参数。

`sourceUnchanged=true` 要求原有证据与完整源码聚合指纹均在运行前后相同；测试断言通过但指纹变化时整次返回 failed / 退出 1，仍清理所属进程、容器及目录。后续 Agent 不应只比较选中测试文件或 commit：工作区中导入依赖也可能在测试时变化。失败先比较两份摘要及文件数，核实并发编辑，再在稳定源码下重跑，不修改报告或放宽断言。

该扫描用于本地执行前后的一致性，不是持续监控或安全沙箱；无法发现中途修改后恢复到原字节的情况，不覆盖所有安装依赖、静态资源、环境或部署身份。源码在扫描之后仍可变化，不能把它视为锁定的原子快照。运行中出现扫描错误仍明确失败，不自动接受旧证据。

见[历史验收记录](solana-api-local-history.md#集成源码指纹验收记录)。

### 测试派生进程清理验收（2026-10-27）

见[历史验收记录](solana-api-local-history.md#集成派生进程清理验收记录)。

### 数据库集成测试源码断点调试

2026-10-27 已实现并真实验收。排查数据库读写、迁移或时间戳问题时，复用原测试及临时 PostgreSQL，显式选择一份 suite：

```sh
yarn gmx-api:test-integration --suite src/domain/market/marketModel.test.ts --inspect-port 9241
```

1. 入口在 Docker 操作前检查端口及单 suite 约束，随后按原流程创建所属容器。stderr 的 `API integration debug session` 给出本次 inspector、日志和报告路径，只代表启动安排；日志出现 `Debugger listening on ws://127.0.0.1:9241/...` 才说明调试器已监听。
2. Chrome `chrome://inspect` 配置 `127.0.0.1:9241` 后 Inspect，或用 IDE Node attach；Agent 复用 `scripts/lib/agent-inspector.mjs` 连接该端口 `/json/list` 的 WebSocket。Jest 保留 `--runInBand`，仅监听 `127.0.0.1`，在运行原数据库 setup、迁移和测试之前等待连接。
3. 开启 source maps，按[API 离线调试步骤](#api-离线测试源码断点调试)在目标 TypeScript 文件设置断点，核对 inline source map 与磁盘源码一致，再恢复初始暂停。数据库调用含异步边界，Agent 可先设置 `Debugger.setAsyncCallStackDepth` 的 `maxDepth=32`，结合暂停事件的同步与异步调用栈定位原测试，不能只把初始暂停当作模型函数断点。
4. 本机已在 `src/domain/market/marketModel.ts` 的 `updateMarkets` 序列化输入行命中，读取原测试传入的 `marketConfigUpdatedAt` 并核对 UTC 时间戳及原测试调用栈。仅读取所需变量，不读取完整环境或连接密码。完成后移除自身断点、恢复测试并断开 debugger；需要中止时对外层命令 Ctrl-C / SIGTERM，核对 `exit.cleanup`、资源 `cleanup`、端口关闭及 `temporaryDirectory` 不再存在。

Jest 调试进程上限 30 分钟，包含等待连接和暂停；普通模式仍为 180 秒，原 Jest 单项 120 秒超时、数据库准备及清理时限保留。调试期间容器保持存在，结束时仍按 owner label 删除，不复用其他数据库。不改变原数据库 setup/teardown、迁移、UTC、环境白名单或失败重试配置；缺 Docker、镜像或目标依赖时明确失败，不自动安装或改用共享服务。

报告新增 `debug.inspector`、`pauseOnStart`、`timeoutMs`、`started`，同时记录 `temporaryDirectory`；inspector 启动日志不成立时不得 passed。日志确认不代表源码断点已验收，具体命中、参数和恢复仍需独立证据。非法端口、多 suite 和端口占用退出 1，stderr 给出具体诊断，占用服务保持运行。

见[历史验收记录](solana-api-local-history.md#数据库源码调试验收记录)。

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

见[历史验收记录](solana-api-local-history.md#数据库范围扩展验收记录)。

日志、原始 Jest 结果及报告保留在 `.local/acceptance/solana-api-local/integration-*/`。入口为 `scripts/gmx-api-integration-tests.mjs`。本机最终报告为 `integration-latest.json`，失败与隔离验收摘要为 `integration-acceptance.json`，均在同一忽略目录，不随 Git 共享。

见[历史验收记录](solana-api-local-history.md#数据库初次验收记录)。

## 实施进度与验收

### 2026-10-26 Agent 生命周期闭环

见[历史验收记录](solana-api-local-history.md#样例服务初次与生命周期验收记录)。
