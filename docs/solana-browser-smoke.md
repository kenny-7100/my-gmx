# Solana 本地只读浏览器冒烟

更新日期：2026-10-27。A09 首个只读页面冒烟入口及环境预检均已完成真实验收；新增一条命令完成预检、独立 Vite、真实 Chrome、独立报告及停服。用户已长期授权后续任务启动本地 Vite 和 Chrome，在已授权任务中无需再次确认本地页面运行；不扩大到构建、部署、其他服务或签名广播。

## 用途与验收条件

后续涉及网络选择、开关隔离或选中状态持久化的需求，可先运行此入口，快速检查共享页面的基础行为，再追加该需求自身的验收。它复用现有 Playwright fixture、JS 错误诊断、失败请求记录、截图、trace 和 HTML/JSON 报告，不提供钱包注入或业务数据 mock。

| 用例 | 明确预期 | 当前状态 |
| --- | --- | --- |
| `solanaNetwork=false` | 点击 Solana 显示现有 GMTrade 提示；保持 Arbitrum；不选中 Solana；EVM 网络及结算 ID 保持 42161；本次观察期间无 gmsol SDK/WASM 请求 | passed，真实 Chrome |
| `solanaNetwork=true` | 可选中 Solana，刷新后仍选中；底层 EVM 网络及结算 ID 保持 42161；切回 Arbitrum 后清除 Solana 选中状态 | passed，真实 Chrome |
| 共用诊断 | 页面无未处理 JS 错误；报告包含本地 checkout commit/dirty、目标地址、状态附件；失败保留截图及 trace | passed；首轮失败产物与复验报告均保留 |

不覆盖真实钱包连接、余额、交易组件、签名、广播、keeper 执行、远端预览或完整 EVM 回归。无 SDK 请求断言只覆盖当前用例观察窗口，不替代构建产物分析。此入口不修改业务代码、前端默认开关或线上状态。

## 一条命令执行并保存独立报告

已授权本地页面验收时，在主仓库根目录优先使用：

```bash
# Preflight, start an owned Vite, run real Chrome tests, retain reports, stop Vite
yarn solana:browser-check
# Select a different unused local port
yarn solana:browser-check --port 3015
# Tool regressions do not start a browser
yarn test:solana-browser-check
```

默认使用独立端口 3015，固定 loopback HTTP 地址；不复用或停止 3010 等既有 Vite，不启动 API/RPC、不构建 SDK、不安装依赖。预检复用下文已有实现，缺少依赖或 Chrome/SDK 时仍报告 blocked / 退出 2；其他失败退出 1。仅当现有两项测试实际通过且服务清理通过时退出 0。

[管理配置](../tools/solana-browser/playwright.config.ts) 继承原只读 Playwright 配置，复用全部 fixture、测试和断言，通过 Playwright 原生 `webServer` 启停 Vite；`reuseExistingServer=false`、loopback、strictPort，原 Vite 业务配置保持不变。端口占用在执行前明确拒绝；启动时再次由 Playwright/Vite 保护，不接管未知监听进程。每个用例仍独立 context、无重试，不注入钱包或替代业务数据；前端仍可访问现有真实外部读取服务，并非离线测试。

每次在已忽略的 `.local/acceptance/solana-browser/managed-*/` 中保存：

- `preflight.json`：本次依赖、Chrome、SDK 指纹及两项测试发现结果。
- `playwright-results.json`、`html/index.html`：Playwright 原生结果及 HTML；失败截图/trace 位于本轮 `test-results/`。尚未启动测试的失败可能没有这些原生产物。
- `playwright.log`：Vite/Playwright 输出及失败诊断。
- `report.json`：目标地址、时间、退出码、实际测试统计、checkout 元数据、相关文件摘要及端口释放结果。配置/测试/fixture/开关/SDK 前置等摘要不代表整个应用或依赖树的身份。

不覆盖旧的 `test-results/solana-read-only-results.json`、固定 HTML 目录或其他 managed run。判定要求：恰有两项 `network.spec.ts` 实际通过，无 skipped/flaky/unexpected、无重试或 runner errors、进程退出 0，且相关文件摘要未变化；`--list`、空结果及仅预检通过均不能作为页面 passed。原始附件中的外部请求失败仍保留，不将页面冒烟通过扩大解释为全部外部服务可用。

Playwright 正常退出或失败时负责清理所属 Vite；外层收到 SIGINT/SIGTERM 或超时后，统一向 Playwright CLI 转发 **SIGINT**，使其进入测试 runner 的 teardown。当前锁定版本直接接收 SIGTERM 会终止 CLI 并遗留 Vite，本轮真实中断验收已复现并修正。工具结束前再次检查端口可重新绑定，仍占用则失败，不盲目 kill。全局测试限时 180 秒；外层 240 秒后请求终止，再给 15 秒清理时间。SIGKILL/系统崩溃不能保证清理，先核实端口和进程归属后处理。工具只承诺本地 POSIX 环境，本轮在 macOS 验证。

实现入口：[solana-browser-check.mjs](../scripts/solana-browser-check.mjs)。属于个人开发基础，最终基于 `origin/release` 交付业务需求时不携带本工具、管理配置或相关文档。

2026-10-26 本机管理入口验收：

| 条件 | 实际结果 |
| --- | --- |
| 自动预检、启动 Vite、真实 Chrome 与正常停服 | 两轮各 2 项通过，最终一轮 45.9 秒；无 skipped、flaky、unexpected 或重试，结束后端口释放 |
| 原生报告独立保存 | 两轮各有独立 JSON/HTML/预检/日志，首轮产物仍存在；原固定结果文件 SHA-256 未变化 |
| 未知端口占用 | 正确失败，报告 port 阶段 / not-started，原监听服务保持运行 |
| 执行中断 | 实际测试开始后发送 SIGTERM；外层转发 SIGINT 后，运行正确失败，Playwright 清理 Vite，端口释放 |
| 假通过判定 | 两组工具回归通过，拒绝发现结果、零执行、错误目标/范围、跳过、重试、失败和信号退出；验证端口检查不误停监听进程 |
| 业务隔离 | 未修改前端、SDK、API 或原用例预期；无构建、钱包注入或业务响应替代 |

首轮中断暴露 SIGTERM 直接结束 CLI 的遗留问题；已依据锁定版 Playwright runner 源码修正并真实复验。该次失败报告保留，不覆盖成 passed；遗留进程核对本轮端口、命令和进程组归属后已清理。最终汇总位于本机 `.local/acceptance/solana-browser/managed-acceptance.json`，原生报告位于对应 managed run，不随 Git 共享。

工程检查通过：2 组工具回归、根 `yarn tscheck`、`yarn test:regression:types`、脚本语法、指定文件 ESLint/Prettier、文档链接及 `git diff --check`；完整前端回归 299 个文件通过 / 1 个原有跳过，3014 项通过 / 1 项原有跳过，退出 0。仍有既有 Browserslist、Sass/Vite 及 happy-dom teardown 提示，本轮保留日志，不修改这些无关内容。

移交本管理入口的结果时，按[浏览器证据交接](agent-evidence.md#浏览器原生结果交接)显式携带管理报告、原生结果、预检和日志；状态/诊断内嵌附件与路径型截图/trace 分别处理，接收方不要按历史绝对路径读取本机文件。

## Node patch 页面运行边界

2026-10-27 已在同一 macOS 环境、Chrome 可执行文件版本 `156.0.8078.48` 下，使用 Node 22.17.0 与 22.22.0 分别运行本管理入口：两轮各 2 项 passed，无跳过、重试或 flaky，相关源码/工具一致，独立报告保留，端口释放。两轮各有关闭/开启用例 2/29 条失败请求诊断，均无未处理 JS 错误；不将页面断言通过扩大为外部依赖全部可用。

这是现有两项用例在本机已安装依赖上的运行观察，不证明任意 Node 22 patch、其他 Chrome 版本或跨系统兼容。实际 Node 路径、目标身份、耗时、报告和未验证范围见[版本矩阵实测](agent-runtime-matrix.md#node-22-patch-真实浏览器实测)，后续按任务选择所需运行时，不为普通页面任务机械重跑两套版本。

## 验证独立功能 checkout

从基础设施 checkout 调用入口，显式传入目标 Git 根目录；无需将个人脚本、Playwright 配置或用例复制进功能分支：

```sh
yarn solana:browser-check --project-dir /absolute/path/to/delivery-checkout --port 3016
```

工具从目标 `node_modules/vite/bin/vite.js` 启动 Vite，使用目标工作目录及原 Vite 配置；测试、fixture、Chrome 编排及所有报告留在基础设施目录。`projectDir` 和 `targetBefore/targetAfter` 记录目标 Git commit/dirty、既定前端源码指纹、Vite/SDK 版本、实际 Vite 路径及资产摘要；Playwright `checkout` 元数据也指向目标，并与运行前身份自动核对。目标在运行期间变化或元数据不符时整体失败。原有 `sourceBefore/sourceAfter` 继续表示基础设施用例、配置与工具摘要，预检报告检查的是基础设施测试能力，不代替目标身份。

先准备目标自己的锁定依赖及已批准的 Solana SDK 静态资源。入口不安装、不构建、不自动链接或复制资源。目标必须是实际 Git 根目录，已安装 Vite 版本与基础设施相同；目标声明及已安装 Solana SDK 版本必须一致，并匹配当前基础设施的已批准版本。目标 SDK 配置、已安装 JS/WASM 和准备好的 entry/WASM 与已验证的基础设施资源逐字节核对；缺失、损坏或不兼容在 `target` 阶段失败，退出 1。SDK 资源需要构建时先处理相应授权，不用旧版本或替代资源绕过。当前只支持相同已批准运行时，不承诺任意历史或新 SDK 版本兼容；锁定安装仍是前置，版本检查不证明整个依赖树一致。

既定源码指纹复用[前端离线测试](frontend-offline-tests.md)的计划，不代表全部 CSS、静态资源、环境文件或部署身份；本入口另核对上述 SDK 资源。前端仍读取目标的开发环境配置，报告不记录凭据。测试含外部只读请求，继续保留原错误诊断；不把两项页面用例通过解释为整个功能或数据依赖通过。原有端口归属、停止流程和限时保持不变。

正式交付前可按[浏览器测试证据绑定](linear-development-workflow.md#浏览器测试证据绑定)显式传入 `agent:delivery-check --browser-report PATH --require-clean`，自动核对已有页面结果与交付源码。用于交付的测试应从干净目标 checkout 开始；普通本地开发仍允许 dirty 报告，但不能将其当作干净交付证据。

### 独立目录实际验收（2026-10-27）

基于本地 `origin/release` 引用创建临时 clone，确认目标没有个人浏览器工具；增加仅用于验收的独立静态标记并提交，工具请求该标记核实 Vite 确实服务目标目录。显式链接本机已安装依赖、复制已准备 SDK 静态资源，仅用于本轮隔离验收；没有执行全新安装或构建，也没有改动实际业务 checkout。

- 目标两项原有网络选择用例在真实 Chrome 中通过，无 skipped/flaky/unexpected；目标 Git commit、源码和资源前后一致，服务端口释放，临时 clone 随后删除。
- 错误 Git 根目录、缺目标依赖、损坏的准备资源及不兼容的目标 Vite 均在启动前拒绝。端口占用在 port 阶段失败，原监听服务保留。
- 最终代码的默认入口两项真实 Chrome 用例复验通过，耗时约 47.7 秒，端口释放。

证据在忽略的 `.local/acceptance/solana-browser/checkout-acceptance.json`、`checkout-version-negative.json` 和 `checkout-default.json`，保留各次独立原生报告及 trace。历史报告中的工具摘要不代表后续修改后的工具版本。 本轮统一工具测试 95 项、根类型检查、regression 类型检查及脚本静态检查通过；全量前端回归 3,014 项通过、1 项既有跳过，124 个文档本地目标及差异检查通过。

## 先准备，再执行

工作目录：主仓库根目录。用户已长期授权本地 Vite/Chrome；下列准备检查本身不启动浏览器或本地服务。

优先执行已固化的环境预检，再按失败阶段处理，而不是先启动页面或逐个重跑命令：

```sh
yarn solana:browser-preflight
```

入口：[scripts/solana-browser-preflight.mjs](../scripts/solana-browser-preflight.mjs)；测试：`yarn test:solana-browser-preflight`。命令仅依赖 Node 启动，先核对声明/已安装的 Playwright 版本和解析路径，再检查固定 `chrome` channel 的执行文件、复用既有 `--local-only` SDK/WASM 指纹工具，最后使用固定配置的 `--list --reporter=json` 发现测试。发现阶段须恰有 2 项且无执行结果；增删用例时应同步更新该预期。不执行浏览器二进制，不探测服务或页面，不安装依赖，不读助记词。

成功退出 0；缺依赖、Chrome、SDK 产物或不支持的平台为 blocked / 退出 2；测试发现失败或报告异常为 failed / 退出 1。报告列出 `playwright/chrome/sdk/discovery` 状态，保留 `browserExecution=not-run`、`serverReadiness=not-evaluated` 和 `requirementAcceptance=not-evaluated`；子进程原始 stderr 不输出，避免泄漏配置或任意错误内容。每个子进程限时 30 秒、输出上限 1 MiB，不自动重试。源码摘要覆盖预检、配置、用例、fixture、AB/env、package/lock，SDK 依赖摘要复用既有报告；它不是整个前端或完整依赖树的指纹。

当前 Chrome 文件检查支持 macOS `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` 与 Linux `/opt/google/chrome/chrome`，对应已锁定 Playwright 的 stable Chrome 路径。Windows 等平台明确 blocked；本轮只在 macOS 实测，Linux 路径来自当前 Playwright 源码，未实机验收。文件存在且可执行不证明动态库、沙箱或真实启动成功，这些由当前已授权任务的真实 UI 运行验证。检查不会改用其他浏览器绕过缺失条件。

归档时可执行：

```sh
mkdir -p .local/acceptance/solana-browser
yarn solana:browser-preflight > .local/acceptance/solana-browser/ready.json
```

先核对退出码和逐项状态；该 scope `solana-browser-prerequisites` 已支持现有证据包。准备报告不冒充 Playwright 页面报告；`--list --reporter=json` 的输出仅在内存解析，不覆盖已有 HTML/JSON 页面验收产物。

预检失败后的排障顺序如下：

1. 确认 `@playwright/test` 能从当前工作区解析，再做测试发现及类型检查。2026-10-25 本机 package.json 与锁文件已有 1.58.2，但 node_modules 缺失该包，导致全套 regression 类型报错。使用 `yarn install --immutable --mode=skip-build` 恢复既有锁定依赖；不要升级版本、删锁文件或普通安装。根 `postinstall` 会进入 SDK 安装/构建，普通安装不适合未经构建授权的准备阶段。本轮普通安装已被中止，随后 skip-build 安装成功，锁文件未变。
2. 执行 `yarn test:solana-readonly --list`，应发现本文件列出的 2 项；执行 `yarn test:regression:types`。`--list` 仅发现，不等于执行。需要对指定文件格式检查时用 `yarn exec prettier ...`，根 `yarn prettier` 是范围较广的仓库脚本。
3. 当前入口使用 `channel: "chrome"`，先核实机器已安装 Google Chrome；没有则先协调安装，不自动下载浏览器。2026-10-25 本机 Chrome 已存在，但 Playwright 配套 Chromium 不存在；本轮未启动两者。
4. 核对本地已有 SDK/WASM 产物；需要时执行 `yarn solana:runtime-preflight --local-only`，缺产物先处理构建授权，不自动构建。本机本轮检查 passed，只证明本地产物指纹，不证明页面可用。
5. 本地 Vite/Chrome 已获长期授权；在已授权任务内直接启动服务和执行用例。失败先保留报告并区分基础设施问题与业务问题；业务修复仍须核对任务范围。

需要手动运行或保留现有开发服务时，仍可使用原入口（两个终端，均在主仓库根目录）：

```sh
yarn exec vite --host 127.0.0.1 --port 3010 --strictPort
```

```sh
yarn test:solana-readonly
```

配置文件为 [playwright-solana-readonly.config.ts](../playwright-solana-readonly.config.ts)，默认 `http://127.0.0.1:3010`。可通过 `REGRESSION_BASE_URL` 显式指定其他 loopback HTTP 根地址；非本地、HTTPS、带路径/查询/片段/凭据的地址拒绝。配置没有 `webServer`，不会自动启动服务、构建或部署；前端仍会使用当前配置访问真实外部读取服务，并非离线测试。

## 共享上报验收的版本配置

2026-10-28真实核对：本地Vite缺少`VITE_APP_VERSION`时，`getAppVersion()`返回undefined，event/counter/timing上报缺version，EVM与Solana均收到带required/version关键词的400。显式配置目标真实源码版本后，同源Chrome四阶段12次上报全200，Solana冷启动event保留networkId=-501。见[第二十六轮证据](solana-implementation-research.md#第二十六轮实施记录t02f2b3-共享上报400与本地版本前置2026-10-28)。

开展遥测请求验收前，确认目标Vite有非空`VITE_APP_VERSION`；缺失时仅为本次命令配置真实发布版本或本地HEAD+工作区源码身份。不要复制历史版本号或写生产兜底；无需修改.env.local。此项只适用于遥测验收，普通UI冒烟仍可执行原命令。不能据缺版本的400归因于Solana networkId或关闭上报。

可选请求审计现含`reportDiagnostics`：白名单item types/networkIds、local host/dev布尔值、指标version状态、响应格式及固定错误关键词。不保存原始body、错误文本、账户或凭据。当命令显式提供VITE_APP_VERSION时，原两用例还验证四阶段存在200报告、无>=400报告及冷Solana -501批次；未配置时仍可复现400，不将原网络断言通过写成上报通过。HTTP200及摘要只验证本次请求校验，不证明遥测入库/分析归因；未提供networkId的项目标other，不推断归因。

## 开关与状态隔离

### 可选的实际请求审计

T02.f1新增审计模式，仍使用原两项测试、fixture、独立Vite和真实Chrome，不注入钱包或替换响应：

```sh
SOLANA_REQUEST_AUDIT=1 yarn solana:browser-check --port 3015
```

只在flag-on用例延长观察：EVM初始10秒、暖切换Solana后65秒、Solana刷新后15秒、切回EVM后10秒。既有导航和Settings断言保留；默认不启用，不增加普通冒烟等待时间。该用例限时150秒，管理入口全局180秒限制不变，超时仍按失败处理。

原生结果内的`request-audit-*` JSON附件逐阶段累计外部fetch/XHR记录：相对起始/结束时间、发起阶段、脱敏目标、HTTP方法、JSON-RPC方法、HTTP状态和完成/失败结果。只允许固定公开路径，其余路径标为`/<redacted>`；不保存query、header、RPC参数、完整body或凭据。CDP另记录页面主线程EVM RPC的优先级和调用栈函数/本地源码路径，用于识别tracker；worker调用未必有CDP栈，不能将没有栈的请求全部归为tracker。监听不拦截、不取消实际请求，静态资源、WebSocket帧及真实扩展钱包不在该采集范围内。

自动断言要求Solana刷新阶段无捕获到的EVM RPC，暖切换观察窗口第60秒后无新增EVM RPC；T02.f2a进一步要求暖切换窗口RPC数量与Low优先级且栈含RpcTracker的CDP记录数量一致，并确认初始EVM/切回EVM确有RPC，防止采集失效造成假通过。仍须读取附件，核对具体来源、时间与主线程/worker覆盖差异；不将数量匹配视为任意环境下的完整网络证明。允许保留metrics/chat/wallet HTTP。T02.f2b1/b2历史阶段要求Solana无flags及warm无ticker GET；T11.c接入原生Solana flags后，当前断言要求冷启动确有`/ui-flags/v2`，冷启动及warm观察窗的flags均来自`https://arbitrum-api.gmxinfra.io/ui-flags/v2`且CDP函数栈包含`fetchSolanaUiFlags`，同时保留warm无EVM ticker及RPC归因限制。`flagInitiators`附件仅记录阶段、相对时间、公开目标和函数名，不保存query或响应body。它区分共享Solana flags业务读取与旧EVM预取，不能用历史零flags数量判定当前功能退化；真实公告开关正向验收仍需远端key及owner配置。

2026-10-28的[f1首轮证据](solana-implementation-research.md#第二十二轮实施记录t02f1-实际请求审计2026-10-28)发现viem高优先级eth_call和HTML两链/ui-flags/v2预取；[f2a修复后](solana-implementation-research.md#第二十三轮实施记录t02f2a-multicall-切网取消边界2026-10-28)两次暖切换均只捕获15项Low tracker，0项High或无归因RPC，冷启动0 RPC、切回83项RPC。[f2b1修复后](solana-implementation-research.md#第二十四轮实施记录t02f2b1-启动-uiflags-预取隔离2026-10-28)冷启动/导航0 RPC、0 flags，HTTP从50降至38；暖切换仍15项Low tracker、切回83项RPC。点击期间观察窗前有1项ticker GET，通用oracle迟到fallback/取消属f2b2；共享batch_report本次返回400仅证明仍发送。[f2b2修复后](solana-implementation-research.md#第二十五轮实施记录t02f2b2-evm-oracle-请求取消与迟到-fallback2026-10-28)warm全phase无ticker/flags GET，仍15项Low tracker；cold0 RPC/flags、38项共享HTTP，切回104项RPC且ticker/flags恢复。EVM oracle传输取消和旧代结果拒绝已离线验证；共享report400需f2b3核对。无真实钱包，不能据此完成FESOL-48父需求。

当前 [isDevelopment](../src/config/env.ts) 根据 host 和 `production-preview` localStorage 判断，不只是 Vite build mode。现有 regression fixture 默认写入 `production-preview=true`；[AB 加载逻辑](../src/config/ab.ts) 在非 development 环境会清除投放比例为 0 的手动开关，包括当前 `solanaNetwork`。因此直接复用原 fixture 并写 `ab-flags` 会使开启用例失效，不能靠重试解决。

本轮在共用 fixture 增加 worker 选项 `productionPreview`，默认仍为 true；仅新配置显式设为 false，使用本地 development 语义。测试检查实际存储的开关值，错误环境会失败，不静默降级。每个用例使用独立 context，仅首次初始化状态；刷新不重置选中状态。EVM `chainId` 始终为 42161，Solana 使用独立选中状态，不能把 Solana ID 填入 EVM runner。

## 证据与进度

报告位于本机已忽略的 `playwright-report/solana-read-only/`、`test-results/solana-read-only-results.json`，失败产物在 `test-results/solana-read-only/`。这些原始产物不随仓库共享；按需求工作表记录实际运行版本、时间、结果和证据，不把本工具准备状态当作需求通过。

当前进度：实现完成 → 环境预检通过 → 首轮问题定位与修复完成 → **真实页面复验通过**。以下准备阶段记录为历史结果，不替代本轮真实页面结果。

### 历史准备检查（未运行页面）

已完成的准备验证：新入口发现 2 项；原 EVM regression 入口发现 486 项 / 96 文件，未包含新目录；regression fixture 单元测试 23 passed；根及 regression 类型检查、指定 TypeScript 文件 ESLint/Prettier、6 类非法目标拒绝、本地 SDK/WASM 指纹和文档链接检查通过。仅测试发现未运行任何页面。

完整前端单元测试 299 文件 / 3014 tests passed、1 原有 skipped，退出 0，121.72 秒；日志有已知 happy-dom teardown AbortError。真实 UI 仍未执行。


环境预检阶段验收（2026-10-25）：本机四项真实检查 passed；远端目标 discovery failed / 退出 1；3 组工具测试及 6 组证据包回归通过，故障状态不被升级。真实报告 pack/verify matched，原页面 JSON 和输出目录探针保持不变；根及 regression 类型、ESLint/Prettier/语法及文档链接通过。完整前端单元测试 3014 passed / 1 原有 skipped，退出 0，123.67 秒。证据位置与包外摘要见[本轮实施记录](agent-acceptance-infrastructure.md#a09-浏览器验收环境预检进度2026-10-25)。这些仅为环境预检验收，真实 UI 仍未执行。


## 真实页面验收与导航经验（2026-10-25）

### 本地静态文件与 SPA 路由冲突

新增直达路径验收前，先检查同名本地HTML产物。2026-10-28实测：仓库中已有的`stats.html`使Vite将精确`/stats`解析为构建visualizer，React路由没有挂载。先核对失败快照和导航trace，不将其误诊为网络选择丢失或业务路由错误，也不删除用户产物。本轮以`/stats/`验证同一React前缀路由；精确`/stats`在无该产物环境的直达仍单列待验，不能用尾斜杠用例声称原URL完整通过。生产路由行为不由本地该文件推断。

### 导航等待与历史验收

首轮两项均在 `page.goto` 等待默认 `load` 时超过 60 秒；页面快照中主界面已显示，诊断无未处理 JS 错误，但有外部资源失败/中断。仅将本组 `goto` 和 `reload` 改为 `waitUntil: "domcontentloaded"`，继续由网络菜单可见和状态断言确认应用就绪；复验两项均 passed，16.7 秒。不开自动重试，不加长超时、不屏蔽外部请求，也不修改业务代码。后续遇到导航超时先核实等待的事件、页面快照和 trace，再判断资源/应用问题，不能直接断言前端不可用。

真实 Chrome 验收开始于北京时间 2026-10-25 08:09:01；checkout 为 `5fe2d88919d60f8f6135bfbfc4ad24accb9b7684`、dirty=true。关闭用例最终 Solana 选择为 null、EVM/结算 ID 均为 42161、SDK/WASM 请求为空；开启用例的选择与刷新均由断言通过，切回 Arbitrum 后 Solana 选择为 null。两个用例 JS errors 均为空；开启用例仍记录 81 条外部请求失败或刷新中断，不将其抹去或当作所有外部服务可用。

本机产物目录 `.local/acceptance/solana-browser/a09-live-20261025/` 被 Git 忽略，不随仓库共享，包含首轮失败 JSON/截图/trace、副本化的复验 JSON/HTML、准备报告和测试源码摘要。原生 Playwright JSON 不属于当前 agent:evidence 支持的工具报告格式，本轮保留原始产物与包外摘要，不转换为伪造的工具 passed 报告。

复验 `run-2-results.json` 的 SHA-256 为 `0fd46c58055e0575e1750bbc7095d6bb5204d03cf5bd29f7a23be5e9b7894014`；实际用例源码 SHA-256 为 `e2060c4de26c5d52fdaee97db466bfd986c2f98d06aea8c9bd05f2e993e6fae3`。配置与共用 fixture 摘要另存 `test-source-sha256.json`，可将 dirty checkout 的实际测试内容与结果对应核对。新一轮运行不会沿用历史 passed，应记录自己的实际报告。

本轮完成的是网络选择冒烟阶段，A09 整体仍部分完成；钱包、余额、交易、远端预览及完整 EVM 回归仍需按具体需求推进。
