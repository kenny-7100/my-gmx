# Agent Solana 本地全栈联调工具

更新日期：2026-10-27。本文只建设个人开发配置、工具及测试辅助，不实现迁移业务。现有 API 持续服务见 [Solana API 说明](solana-api-local.md)。

## 已完成的范围与当前边界

| 项目 | 本轮交付 | 保留的业务缺口 |
| --- | --- | --- |
| 本地 API 入口 | 独立 Vite 开发配置，固定 `/__agent/solana-api` 转发到所选本地 API | 当前分支没有 Solana API client/parser/状态接入；入口可访问不等于 GMX 页面已消费数据 |
| 工作区管理 | 所选 API/Vite/RPC 的 up/status/logs/stop、归属判断、失败清理与报告 | 不启用数据库、EVM master 或新增业务后台任务；RPC 本地健康不证明上游可用 |
| 请求诊断 | 代理请求日志、浏览器采集 helper、trace 查询及已有后端日志行号 | 不修改 API 日志中间件；当前正常和多数 4xx 请求不产生逐条后端日志，允许没有匹配行 |
| 接口回归 | 固定来源的样例形状基线、离线与 HTTP 检查、变化失败报告 | 无前端 Solana parser 可执行；字段语义、精度、空状态和契约评审未完成，结构通过仍是 partial |

本轮没有修改 `src/`、`sdk/`、`gmx-api/` 或原有 `vite.config.ts`。所有新行为仅通过显式工具命令启用，常规 Vite/构建不加载这套配置；不存在 URL 替换 EVM host、响应替代或新建平行业务数据流。

## 使用顺序

工作目录为主仓库根目录。依赖 Node 22、已有锁定依赖、API checkout、POSIX 本地进程与 Unix socket；本机 macOS 已验证。Chrome 探测沿用已安装且锁定的 Playwright/Chrome，先按[环境顺序](coding-and-self-review.md#执行前的环境检查与顺序)处理已知前置条件。

```bash
# Start API and Vite (defaults: API 3004, Vite 3010)
yarn solana:dev up
# Include the existing read-only Mainnet RPC proxy explicitly
yarn solana:dev up --services api,vite,rpc
# Inspect current health / log paths / stop owned services
yarn solana:dev status
yarn solana:dev logs
yarn solana:dev stop
```

第二条是另一种启动方式，不要在工作区已运行时重复 up。重复工作区、未知端口占用明确失败，不自动接管。可在 up 时指定 `--web-port 3012 --api-port 3014 --rpc-port 3034`，或仅选 `--services api` / `vite` / `rpc`。控制命令按前端 checkout 定位唯一管理实例，不需要重复端口参数；默认仍是基础设施目录的工作区。

- API：优先借用已有 `solana:api-dev` 管理的健康服务，核对实际 apiDir；找不到才调用原有 up。stop 保留 borrowed 服务，仅关闭本工作区 owned 的 API；停止前再次核对 supervisor PID。
- Vite：工作区自己启动，绑定 `127.0.0.1`、strictPort；未知已有 Vite 不借用。原 API 自身的监听范围沿用[已记录的 OS 默认行为](solana-api-local.md#持续运行的-solana-联调环境)。
- RPC：只启动已有代理，绑定 loopback；不借用未知代理、不读取钱包助记词。选中 RPC 时，仅在本次 Vite 配置中将既有 `VITE_APP_SOLANA_RPC_URL` 指向所选端口，不修改配置源码或 `.env.local`。healthz 仅代表本地代理存活，报告 `upstream: unchecked`。
- 服务异常：status 实时检查所选服务。RPC 子进程意外退出会使工作区失败并清理所属资源；API 已有自己的 watcher 管理，故障由 status 暴露，不擅自重启借用服务。

控制 socket 位于 `/tmp/gmx-solana-stack-<uid>-<workspace-hash>.sock`，权限 0600。SIGTERM 正常清理；SIGKILL/系统崩溃不保证清理，须先核对资源归属后处理残留，不盲目 kill 或接管。服务生命周期快照不代表当前健康，必须运行 status。

## 独立前端 checkout 的持续联调

从基础设施仓库运行，工具留在基础设施目录，Vite 加载目标自己的原配置、源码及本地环境文件：

```sh
yarn solana:dev up --project-dir /path/to/frontend-checkout --web-port 3016
# All controls select the same checkout; ports are read from its supervisor.
yarn solana:dev status --project-dir /path/to/frontend-checkout
yarn solana:dev logs --project-dir /path/to/frontend-checkout
yarn solana:dev:browser --project-dir /path/to/frontend-checkout --web-port 3016
yarn solana:dev stop --project-dir /path/to/frontend-checkout
```

目标须为前端 Git checkout 根目录，已按自己的锁文件安装完整依赖，已安装 Vite 版本与基础设施运行时相同；缺目录、缺依赖或版本不一致在启动服务前失败。工具不安装或链接依赖、不向目标复制个人工具、不修改原 Vite 配置。监督进程以目标为 CWD，保留原配置对 Git/PWA、Lingui/Babel 及相对路径的解析。正常开发所需 SDK 静态资源仍按原环境流程准备，本工具不自动构建或提供替代资源。

管理 socket 按目标真实目录区分；同一目标拒绝重复启动，不同目标可使用不同空闲端口并存。控制命令同样规范化目录，停止前不要移动或删除目标目录。默认基础设施目录保留原 socket 身份，因此不会接管或停止已运行的旧工作区。API 默认仍为基础设施目录的 `gmx-api`；需要联调 API 功能分支时，在 up 显式传 `--api-dir`，见下节。API 不自动取前端目录下的嵌套仓库；RPC 和代理行为相同。多个工作区借用同一 API 时，需保留其原管理服务，否则借用方健康检查会失败。

新工作区报告增加 `projectDir`，`frontendSourceAtStart` 记录目标 Git 身份、前端/landing/SDK 源码与必要配置聚合指纹及目标 API 配置摘要；`frontendToolSha256` 单独记录基础设施管理脚本和 Vite 包装器。源码指纹沿用局部测试范围，不覆盖所有静态资源或第三方安装内容，且仍是启动快照。浏览器诊断在执行时重新读取目标源码，并确认探测前后身份一致，不把热更新后的代码当作启动时版本。

浏览器工具先连接所选工作区，要求 ready、已选 API/Vite，且 `--web-port` 与实际管理地址相同，再启动 Chrome；任意外部 Vite 地址或错误目标不能通过身份检查。诊断报告、请求记录与 stdout 均包含目标目录和执行时身份；它仍只探测代理，不表示业务页面已接入。旧监督进程不会热加载新工具代码，缺少新身份字段时浏览器工具会明确失败；需要新诊断能力时按原归属流程停止并重新启动该工作区，不修改旧报告补字段。

2026-10-27 真实验收：以本地 `origin/release` 的 `8ef82eb8a465b2045f73805a66941bf7f836630d` 建立不含个人工具的隔离 clone，核对依赖声明及锁文件一致后，仅为本次验收显式链接现有依赖。在原工作区继续运行时，用独立端口 3016 启动目标，借用既有 3004 API；真实 Chrome 从目标加载验收模块，修改后读取到新值，浏览器 API 探测通过并记录正确 commit/dirty。缺依赖、不兼容 Vite、重复启动、错误浏览器 origin、端口占用均拒绝，原监听者保留；独立工作区停止后 Vite 端口释放，原工作区/API PID 不变且健康，目标没有写入工具报告，验收 clone 已删除。测试没有验证完整 GMX 页面渲染或业务功能。

工程检查通过：98 项统一工具回归、SDK 产物 verify、根类型检查、相关 ESLint/Prettier、125 个文档本地目标及差异检查；完整前端回归 3,014 项通过、1 项既有跳过，退出 0。证据位于本机忽略目录 `.local/acceptance/solana-dev/checkout-acceptance.json`、`checkout-workspace.json`、`checkout-tools.tap`、`checkout-sdk-verify.json`、`checkout-tscheck.log`、`checkout-test-ci.log` 和摘要引用的 `browser-*/`。这些历史身份不代表当前环境；后续使用重新运行 status 和本次所需验收。

## 独立 API checkout 的组合联调

2026-10-27 起，up 可同时选择前端与 API checkout：

```sh
yarn solana:dev up --project-dir /path/to/frontend-checkout \
  --api-dir /path/to/api-checkout --web-port 3026 --api-port 3024
# Controls address the frontend workspace; API selection is retained by its supervisor.
yarn solana:dev status --project-dir /path/to/frontend-checkout
yarn solana:dev:browser --project-dir /path/to/frontend-checkout --web-port 3026
yarn solana:dev stop --project-dir /path/to/frontend-checkout
```

`--api-dir` 仅用于 up；须为 API Git 根目录并具有其自身锁定依赖、现有 Solana sample launch mode 与样例文件。一般计算测试不要求样例，但本节持续服务仍要求它们，不能用[通用模块测试](solana-api-local.md#在独立-api-checkout-中运行测试)的前置代替服务前置。工具不安装依赖、复制样例或构建，不切换业务数据源。服务启动授权仍遵循既有约定。

工作区沿用前端目录对应的唯一 socket，API 路径保存在监督进程中；改变前后端目录、端口或启动参数前先停止自己管理的工作区。已运行的 API 必须 ready 且真实 apiDir 匹配，才会 borrowed；端口属于其他 checkout 时明确失败并保留原服务。找不到已管理服务时，按原 API manager 在显式端口启动所选 checkout，记录 owned。未知监听仍不接管；路径别名会在启动时规范化。

工作区报告新增顶层 `apiDir` 与 `services.api.apiDir`，保留 API 自身的启动来源证据。status 每次核对 API 路径与 supervisor PID；同一路径的 API 被重新启动后，旧工作区会 failed，需明确重建工作区来重新借用，不能把换过的实例当作原依赖。停止工作区只停止自己创建且 PID 仍匹配的 API，借用或替换实例不归它清理。

浏览器诊断从管理报告取得实际 apiDir，不接受另一个目录覆盖。stdout、report 与请求元数据均记录 `apiDir`、`apiSource`，包含 commit/dirty、入口与样例摘要及全部 API TS/JS/JSON 源码聚合指纹；探测前后必须一致。Git 身份读取禁用可选索引写入。已有运行中的 contracts 检查也读取所选 API 的样例，仍核对固定基线并保持 unreviewed / partial；不运行服务的 `contracts --offline` 继续使用基础设施默认 API。诊断通过仅证明所选 sample 服务与代理工作，不代表前端业务已接入或真实 API 数据通过。

实际验收：分别从本地前端/API `origin/release` 创建两个不含个人工作区工具的独立 clone，仅增加 README 身份提交；核对依赖声明和锁文件一致后，仅为本次验收显式链接已有依赖。3026/3024 工作区真实启动所选 API，代理和 Chrome 探测通过，报告的前后端路径与 commit 准确，contracts 结构检查通过但仍 partial。请求使用基础设施 3004 API 端口时，因 checkout 不同被拒绝，原 API 保留；嵌套 API 目录也拒绝。owned 停止后两端口释放；匹配 borrowed 服务在工作区停止后仍健康。借用 API 被替换成新实例后，status 正确失败，停止工作区保留替换实例。原默认工作区及 3004 API 的 PID 不变且健康，目标 checkout 保持 clean，验收 clone 已删除。未修改真实业务源码、样例或原配置，没有验证完整业务页面。

证据在本机忽略目录 `.local/acceptance/solana-dev/api-checkout-acceptance.json`、`api-checkout-acceptance.log` 及摘要引用的浏览器报告。后续机器或源码变化后按实际前置重跑，不把本次联调当作未来版本的就绪证明。

本轮工程检查通过：`yarn test:agent-tools`（100 项通过）、`yarn sdk:artifacts verify`、`yarn tscheck`、`yarn test:ci`（299 个文件、3014 项通过，1 个文件及其 1 项原有跳过）、4 个改动脚本的 Prettier/ESLint、129 个本地文档链接及 `git diff --check`。主项目测试仍输出既有 happy-dom teardown AbortError 日志，命令退出码为 0。日志分别为同目录下的 `api-checkout-tools.tap`、`api-checkout-sdk-verify.json`、`api-checkout-tscheck.log` 和 `api-checkout-test-ci.log`。

## 工作区内的 API 源码断点调试

2026-10-27 已验收。需要在组合工作区中调试 API 时，在主仓库根目录显式启用 inspector，再复用[既有源码断点验收](solana-api-local.md#agent-可重复的源码断点验收)：

```sh
yarn solana:dev up --project-dir /path/to/frontend-checkout \
  --api-dir /path/to/api-checkout --web-port 3026 --api-port 3024 \
  --api-inspect-port 9247
# Attach verifies the selected API and preserves the workspace service.
yarn solana:api-debug --api-dir /path/to/api-checkout --port 3024 --attach
yarn solana:dev stop --project-dir /path/to/frontend-checkout
```

`--api-inspect-port` 仅在 up 时使用，必须选中 api 服务，端口须为 1–65535 且与 Web/API/RPC 配置端口不同。新建 API 默认关闭 inspector；显式启用时沿用 API manager 的端口预检和 `127.0.0.1` 监听。`services.api.inspector` 记录实际地址或 `disabled`，status 继续核对路径、实例和所请求的调试地址；HTTP ready 不代表断点已验收。

借用 API 不会自动开启、关闭或重配 inspector。显式要求调试时，既有服务必须已在同一端口启用，否则工作区明确失败并保留服务；未指定时允许沿用已有服务状态。未知 inspector 监听者不接管。修改启动参数须先停止所属工作区；不要通过重启别人的 API 解决不匹配。

`solana:api-debug --attach` 的 inspector 地址来自 API manager，不需要重复 `--inspect-port`；API 路径仍须显式匹配。它核对当前 TypeScript 路径、source map、断点、限定变量与恢复后的 HTTP 结果，结束后清除自身断点并断开，不停止 API。串行执行调试，避免与人工调试同时控制同一进程；暂停期间其他 API 请求可能阻塞。需要手动调试时可用 IDE Node attach 或 Chrome `chrome://inspect` 连接报告中的地址。工作区停止时仍按 owned/borrowed 规则清理。

真实验收使用从本地前端/API `origin/release` 创建的独立 clone，核对锁文件和依赖声明一致后，仅为本次验收链接已有依赖；业务源码、样例与配置均未修改。工作区在 3026/3024 启动所选 API，9247 inspector 的真实断点两次命中 `src/solanaApp.ts` 第 48 行，读取公开地址/invalid、GET 与 `/positions`，恢复后分别为 200/400。断点工具退出后 API 和工作区保持 ready；工作区停止后 API、Vite、inspector 均释放。默认 inspector 关闭、无 inspector 的借用拒绝、借用端口不匹配拒绝、匹配借用保留及未知 inspector 端口占用保留均已验证；非法参数拒绝。原默认工作区/API PID 不变且健康，目标 checkout 保持 clean，临时 clone 已删除。

本机证据为 `.local/acceptance/solana-dev/api-debug-workspace-acceptance.json`、同名 `.log` 及摘要引用的 `solana-api-local/debug-*/report.json`。这是现有 sample handler 的调试验收，不代表前端业务接入、任意新 handler、数据库或真实链上数据验收通过。

工程验收通过：统一工具回归 100 项、SDK 产物 verify、`yarn tscheck`、`yarn test:ci`（299 个文件、3014 项通过，1 个文件及其 1 项原有跳过）、两个改动脚本的 Prettier/ESLint、140 个本地文档链接及 `git diff --check`。主项目测试仍输出既有 happy-dom teardown AbortError，退出码为 0；工程日志保存在同目录的 `api-debug-workspace-tools.tap`、`api-debug-workspace-sdk-verify.json`、`api-debug-workspace-tscheck.log` 和 `api-debug-workspace-test-ci.log`。

## 1. 本地 API 路径

独立配置为 `tools/solana-dev/vite.mjs`，通过 Vite Node API 复用原配置并添加开发代理。例如：

```bash
curl http://127.0.0.1:3010/__agent/solana-api/ping
curl http://127.0.0.1:3010/__agent/solana-api/v1/markets/config
```

前缀被去掉后转发给本地 API。仅允许 GET/OPTIONS；其他方法返回 405。上游不可用返回 502，并保留可追踪 ID，不切换生产 host。HTTP 状态及 body 来自原 API；代理仅补充诊断 header，不注入样例或更改响应字段。

`/__agent/probe` 是仅供工具使用的空白页面，用于从 Vite origin 发起真实请求，不是 GMX 页面或业务 UI。API 自带 CSP/sandbox，因此直接打开 API 的 pong 页面无法作为浏览器 fetch 探测页面；不为此移除 API 安全响应头。

未来业务分支实现正式 API client 和配置时，可显式使用此本地路径进行联调；必须沿用已有统一数据流，不能把本工具当成业务消费已实现的证据。

## 2. 日志、身份和失败定位

每次工作区报告位于 `.local/acceptance/solana-dev/run-*/report.json`，提供所选服务、归属、URL、sample 模式、API 启动源码证据及日志位置。管理进程/Vite 日志为 `launcher-*/workspace.log`，RPC 日志为该 run 下的 `rpc.log`；借用 API 的日志保留在原服务目录。

`frontendSourceAtStart` 记录目标前端 HEAD/dirty、源码与必要配置指纹及前端/SDK API 配置摘要；`frontendToolSha256` 记录基础设施工具摘要。它是启动证据，不是热更新后状态；浏览器探测另记录执行时的目标前端及 API 源码身份和相关文件摘要。

所有工具报告和日志都在忽略目录，不随 Git 交付。磁盘日志不自动轮转；长期开发按需停服后整理。失败先查看对应 report、workspaceLog、API log，不通过改业务或放宽断言使环境变绿。

## 3. 浏览器与请求关联

```bash
# Real Chrome requests through the selected Vite origin
yarn solana:dev:browser
# Custom Vite port
yarn solana:dev:browser --web-port 3012
# Use the failureTraceId printed by the browser report
yarn solana:dev trace --id TRACE_ID
```

探测读取市场、持仓并发起一项预期 400 请求，验证原 API 的真实响应。报告明确 `requestSource: explicit-tool-probe`、`businessPageAcceptance: not-run`；它不验证 GMX 页面展示。失败保留阶段及已采集记录。

代理生成/校验 `X-Trace-Id` 并转发；`requests.jsonl` 记录方法、已知路由、状态、响应头耗时或传输失败耗时、trace ID。query、body、鉴权 header 不写入请求报告；未知路径统一为 `<unmatched>`，避免记录路径中的账户或任意输入。后端自己的原始日志仍遵循原有日志行为。

`trace` 输出对应代理记录和已有 API 日志的匹配行号，不复制原始日志内容；无匹配行如实返回空数组，不能推断请求未处理。502 也有 trace ID，可关联代理传输失败；如果工作区未选择 API，则没有对应后端日志资源。

可复用浏览器 helper 为 `scripts/lib/agent-browser-diagnostics.mjs`：

```js
import { attachApiDiagnostics } from "./scripts/lib/agent-browser-diagnostics.mjs";

const capture = attachApiDiagnostics(page, "http://127.0.0.1:3010/__agent/solana-api");
// Run the authorized scenario using the existing page and request flow.
await capture.save(".local/acceptance/requests.json", { requestSource: "business-scenario" });
capture.detach();
```

helper 仅采集指定 origin/前缀，不拦截、替代或修改请求；保存时等待异步响应元数据，采集失败明确报告，不静默当作无错误。后续页面真实接入本地 API 后，测试辅助代码可直接复用。

## 4. 样例结构回归与契约缺口

```bash
# Uses the running workspace API, through Vite when selected
yarn solana:dev contracts
# No service needed
yarn solana:dev contracts --offline
# Repeatable tool regressions
yarn test:solana-dev
```

固定基线为 `tools/solana-dev/sample-shapes.json`，记录原 API commit、五份样例原始摘要及字段形状。检查新增/缺失字段、字段类型、整数字符串的词法类型、数组元素结构；HTTP 模式同时检查真实响应状态及结构。源码样例摘要变化也失败，不能把自动重新生成基线作为修复步骤。

这不是评审后的业务 schema：不验证金额实际单位、符号语义、枚举取值或字段之间的关系，不根据当前非空样例规定空状态是否合法。现有样例中的占位地址和拼写也不擅自修改。基线变化须先说明来源及变化原因，业务契约待确认时保留缺口，不改 API/parser 来凑齐预期。

退出码：0 为一般工具操作成功；contracts 的结构检查通过仍返回 **2 / partial**，列出未有 Solana 前端 parser、语义/精度/空状态契约未评审；结构或 HTTP 检查失败返回 **1 / failed**。不将本项 partial 汇总为完整契约验收 passed，也不将其当作环境启动失败。

## 验收与交付隔离

2026-10-26 本机完成 12 项集成演练：借用 API 保留、三服务启动与归属、代理只读/trace/脱敏、真实 Chrome 关联、HTTP/离线 partial、真实 Mainnet genesis 读取、重复工作区拒绝、所属 Vite/RPC 停服、未知端口保护、新建 API 停服、RPC 异常退出、无 API 时可追踪 502。报告为 `.local/acceptance/solana-dev/acceptance.json`；浏览器、trace、contract 报告位于同目录对应 run 下。本机证据只描述执行时观察，不代表未来运行或线上部署状态。

工程检查通过：4 组工具回归（路径脱敏、形状变化、基线/缺口和异步浏览器采集失败）、脚本语法、ESLint、代码格式、`yarn tscheck`、`yarn test:ci`（3014 项通过、1 项原有跳过）、本地文档链接及 `git diff --check`。API checkout 保持无跟踪改动。

这些文件属于 `solana-integration` 的个人开发基础：`scripts/solana-dev*`、本主题的 `scripts/lib/` 辅助、`tools/solana-dev/`、package 工具命令和相关 docs。后续功能分支可在此环境开发，但交付上游必须按[分支隔离流程](linear-development-workflow.md#分支基础与隔离)从最新 origin/release 整理，只转入当前业务需求的必要改动；不得携带个人工具、测试基线或本地配置。若业务本身需要正式 host/client/契约改动，应在对应需求中独立审查和验收，不从本工具隐式获得。
