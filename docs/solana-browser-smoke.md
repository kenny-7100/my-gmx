# Solana 本地只读浏览器冒烟

更新日期：2026-10-26。A09 首个只读页面冒烟入口及环境预检均已完成真实验收；新增一条命令完成预检、独立 Vite、真实 Chrome、独立报告及停服。用户已长期授权后续任务启动本地 Vite 和 Chrome，在已授权任务中无需再次确认本地页面运行；不扩大到构建、部署、其他服务或签名广播。

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

## 开关与状态隔离

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

首轮两项均在 `page.goto` 等待默认 `load` 时超过 60 秒；页面快照中主界面已显示，诊断无未处理 JS 错误，但有外部资源失败/中断。仅将本组 `goto` 和 `reload` 改为 `waitUntil: "domcontentloaded"`，继续由网络菜单可见和状态断言确认应用就绪；复验两项均 passed，16.7 秒。不开自动重试，不加长超时、不屏蔽外部请求，也不修改业务代码。后续遇到导航超时先核实等待的事件、页面快照和 trace，再判断资源/应用问题，不能直接断言前端不可用。

真实 Chrome 验收开始于北京时间 2026-10-25 08:09:01；checkout 为 `5fe2d88919d60f8f6135bfbfc4ad24accb9b7684`、dirty=true。关闭用例最终 Solana 选择为 null、EVM/结算 ID 均为 42161、SDK/WASM 请求为空；开启用例的选择与刷新均由断言通过，切回 Arbitrum 后 Solana 选择为 null。两个用例 JS errors 均为空；开启用例仍记录 81 条外部请求失败或刷新中断，不将其抹去或当作所有外部服务可用。

本机产物目录 `.local/acceptance/solana-browser/a09-live-20261025/` 被 Git 忽略，不随仓库共享，包含首轮失败 JSON/截图/trace、副本化的复验 JSON/HTML、准备报告和测试源码摘要。原生 Playwright JSON 不属于当前 agent:evidence 支持的工具报告格式，本轮保留原始产物与包外摘要，不转换为伪造的工具 passed 报告。

复验 `run-2-results.json` 的 SHA-256 为 `0fd46c58055e0575e1750bbc7095d6bb5204d03cf5bd29f7a23be5e9b7894014`；实际用例源码 SHA-256 为 `e2060c4de26c5d52fdaee97db466bfd986c2f98d06aea8c9bd05f2e993e6fae3`。配置与共用 fixture 摘要另存 `test-source-sha256.json`，可将 dirty checkout 的实际测试内容与结果对应核对。新一轮运行不会沿用历史 passed，应记录自己的实际报告。

本轮完成的是网络选择冒烟阶段，A09 整体仍部分完成；钱包、余额、交易、远端预览及完整 EVM 回归仍需按具体需求推进。
