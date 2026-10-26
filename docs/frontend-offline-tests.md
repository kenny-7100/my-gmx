# 前端源码离线测试

核验日期：2026-10-27。用于 Agent 对前端局部模块运行已有单元测试：在隔离环境中复用原 Vite 配置和测试初始化，阻止意外联网，记录精确执行范围及结果。只属于个人开发基础，不修改业务源码、原测试、原 Vite 配置或依赖版本。

## 命令与范围

工作目录为主仓库根目录，使用 Node 22 和现有锁定依赖，无需启动服务、浏览器或构建：

```sh
# Three existing date, PWA decision and Solana flag suites
yarn frontend:test-offline
# Repeat --suite to select exact existing source tests
yarn frontend:test-offline --suite src/lib/dates.spec.ts
yarn frontend:test-offline --suite src/lib/dates.spec.ts --suite src/domain/gmsol/fetchSolanaTradingEnabled.spec.ts
```

默认三份测试为 `src/lib/dates.spec.ts`、`src/lib/pwa/appUpdateDecision.spec.ts`、`src/domain/gmsol/fetchSolanaTradingEnabled.spec.ts`，本轮共 17 项。Solana 开关测试沿用原有 mock 数据源，不访问真实 keeper。

支持 `src/` 或 `landing/` 下真实存在的 `.spec` / `.test` 文件（JS/JSX/TS/TSX）。拒绝重复、缺失、glob、绝对路径、目录及越界符号链接；原 Vite exclude 继续有效，被排除或空文件不能通过。只运行明确选定的文件，不递归发现参考仓库。需要真实浏览器、外部服务或业务集成时使用相应验收环境。

## 验证独立 checkout

工具默认验证所在主仓库，也支持显式指定另一个前端 checkout。这样可在不把个人基础设施复制进交付分支的情况下验证独立交付源码：

```sh
# Run from the infrastructure checkout
yarn frontend:test-offline --project-dir /path/to/delivery-checkout --suite src/lib/dates.spec.ts
# Or invoke the infrastructure script by absolute path from any working directory
node /path/to/infrastructure/scripts/frontend-offline-tests.mjs --project-dir /path/to/delivery-checkout --suite src/lib/dates.spec.ts
```

目标必须是前端 Git checkout 的根目录，并已有完整源码和安装好的锁定依赖；运行器不创建分支、不 fetch、不安装依赖，不自动链接或借用基础设施 checkout 的 node_modules。目标的已安装 Vite/Vitest 版本必须与工具运行时一致，否则在执行前明确失败；其他依赖仍按目标自己的锁文件准备，不用版本检查代替完整依赖安装验证。目标没有默认 suite 时需显式选择实际存在的测试。

所选测试、原 Vite 配置、setup/global setup、Lingui 配置、PWA HEAD 时间、node_modules 链接来源、Vitest 可执行文件和源码/Git 指纹均来自 `--project-dir`。配置编排与网络保护仍来自基础设施工具；报告和日志始终写入基础设施 checkout 的 `.local/acceptance/frontend-offline/`，记录规范化 `projectDir`、目标 commit/dirty、源码摘要和 `runtime` 版本。可同时使用 `--inspect-port`，断点应指向目标目录中的源码。不同 checkout 的原配置与依赖变化可能导致明确失败，不承诺任意历史版本兼容。

跨 checkout 的 Vite 文件访问范围显式包含目标源码、目标依赖的真实目录及工具初始化目录，防止外部 Worker/setup 被拒绝。目标目录不会写入工具、报告或 Vite 缓存，隔离临时目录仍按既有流程清理。本能力只执行所选测试，不替代[交付隔离检查](linear-development-workflow.md#交付隔离自动检查)、最新上游核对或整项需求验收。

需要将结果作为交付证据时，可按[前端测试证据绑定](linear-development-workflow.md#前端测试证据绑定)给 `agent:delivery-check` 传 `--require-clean --frontend-report PATH`，自动比较当前目标路径、commit、源码与工具指纹，并复核原生 Vitest 结果。前端测试本身允许 dirty checkout，交付绑定则要求测试前后及当前目标均干净；不要把开发现场报告当作已提交交付版本的证据。

## 源码断点调试

需要查看前端模块的实际参数和调用栈时，显式选择一份原有 suite：

```sh
yarn frontend:test-offline --suite src/lib/pwa/appUpdateDecision.spec.ts --inspect-port 9240
```

1. 工具先检查 loopback 端口可用，再在 stderr 输出 `Frontend debug session`，包含 `inspector`、本次 `logFile`、`reportFile` 和总时限。这只是启动安排；查看本次日志中的 `Debugger listening on ws://127.0.0.1:9240/...` 确认监听成功。端口占用明确失败，不接管或停止已有服务。
2. Chrome `chrome://inspect` 配置 `127.0.0.1:9240` 后 Inspect，或用 IDE Node attach；Agent 可复用 `scripts/lib/agent-inspector.mjs` 连接 `/json/list` 中的 WebSocket。调试模式使用单个 Vitest fork，测试执行前等待连接，仅绑定 `127.0.0.1`。
3. 开启 source maps，在当前 checkout 的 TypeScript 源码设置断点，再恢复初始暂停。本机已在 `src/lib/pwa/appUpdateDecision.ts` 的 `getAppUpdateAction` 首个条件行命中两次，读取 `status.updateBuildId` 及原测试调用栈。初始暂停、端口可连接或测试通过不能代替目标源码断点证据。
4. Agent 自动化可沿用 SDK 的 `Debugger.setInstrumentationBreakpoint(beforeScriptExecution)`：目标脚本执行前暂停，核对脚本 URL 和 inline source map 的 `sourcesContent` 与磁盘一致，再用映射和 `Debugger.getPossibleBreakpoints` 定位具体源码行；Vite 相对 source 路径按脚本 URL 解析，设置目标断点后移除 instrumentation breakpoint。
5. 完成后移除自身断点、恢复执行并断开 debugger。需要中止时，对外层命令 Ctrl-C / SIGTERM，核对报告 `exit.cleanup=passed`、调试端口关闭和临时目录清理；只关闭调试窗口可能使测试继续执行。

调试总时限为 30 分钟，包含等待与暂停；普通模式仍为 180 秒，原有单项测试超时保留。只支持单 suite，不改变原 happy-dom、polyfill、Worker、测试时区及网络保护。报告新增 `debug.inspector`、`pauseOnStart`、`timeoutMs`、`started`；日志未确认 inspector 成功启动时不能 passed。此入口调试 Node/happy-dom 中的单元测试，真实浏览器渲染和交互仍使用页面验收环境。

## 隔离方式与已确认的启动条件

实现位于 `scripts/frontend-offline-tests.mjs`、`tools/frontend-offline/`，复用既有 Node 网络保护器和 SDK 的 Vitest 结果检查器。

- Vitest 在临时工作目录运行，Vite `envDir` 和缓存也指向该目录；环境仅传必要 PATH、测试标识、工具参数和下述明确配置，不继承调用方的钱包、数据库、`NODE_OPTIONS` 或 `VITE_*` 变量，不加载主仓库 `.env` 文件。
- 复用原 `vite.config.ts` 的别名、插件、happy-dom、`src/lib/polyfills.ts`、`@vitest/web-worker` 和 `vitest.global-setup.js`。后者的 `Asia/Dubai` 测试时区保持原状；不擅自改为 UTC。
- 从隔离 CWD 启动时，除配置中的 root 外，必须显式传 Vitest CLI `--root`，否则现有初始化模块可能解析为无法加载的 `/src/...`。初始化文件转为明确绝对路径；保留原执行内容与顺序，最后安装联网保护。
- 原 PWA 标识会在 CWD 调用 Git，Lingui/Babel 也依赖配置和包定位。入口从当前仓库 HEAD 时间戳计算与原逻辑相同的 PWA generation，显式指向原 `.linguirc`，在临时目录链接所选 checkout 已安装的 `node_modules`；不安装依赖、不复制配置、不修改构建流程。临时目录清理只删除链接，不删除真实依赖。
- 网络保护在测试 setup 后阻止常见 Node fetch、HTTP/HTTPS、socket、TLS、HTTP/2、UDP 和 DNS；文件结束时核对尝试次数，即使测试捕获异常也失败。测试可以继续使用原有 mock 数据源，不能为了通过而关闭保护。

该机制用于防止意外读取默认环境和意外外连，不是恶意代码沙箱：可信插件与原配置在 setup 前加载，测试仍能主动读文件、另起进程或改写保护。不得把真实凭据或依赖外部服务的测试放入默认范围。

## 结果、版本与清理

串行执行所选文件、单 worker、无重试；整次限时 180 秒。通过共享 `scripts/lib/agent-test-process.mjs` 管理所属 POSIX 进程组，使用系统 `ps` 核实组内非 zombie 进程。SIGINT/SIGTERM 先发送 SIGTERM，1 秒后仍未退出则强制结束；超时直接终止所属组，正常退出后也清理组内存活子进程。清理仅覆盖同组后代，不保证主动脱离进程组的子进程。结束后删除临时目录和缓存，保留本次日志。SIGKILL/系统崩溃不保证清理，需核实报告的 processGroup 和资源归属，不接管其他任务。

stdout 输出 JSON，退出 0 要求：正常退出、原生 success、精确的所选结果文件、实际断言全部通过、无 skipped/todo，且运行前后源码摘要一致。零测试、失败、中断、超时、清理失败或信号异常均退出 1；前置错误明确失败，不自动构建或启动服务。

每次证据位于忽略的 `.local/acceptance/frontend-offline/run-*/`：`vitest.log`、`vitest-results.json`、`report.json`。报告记录源码 commit/dirty、选择范围、计数、进程组、工具摘要和清理状态；`exit` 另含 `interrupted`、`timedOut`、`processGroup`、`cleanup`，信号异常时含 `signalError`。源码指纹覆盖主 `src/`、`landing/`、`sdk/src/` 中 TS/TSX/JS/JSX/JSON，及 package、锁文件、Vite/TS/Lingui 和测试 global setup 配置；不读取 `.env`，不覆盖所有静态资源、安装包内容或部署身份。

根 `yarn test:ci` 保持原状，仍是完整前端回归入口。本入口通过只代表所选离线范围，不代表 Chrome、真实 keeper/RPC/API 或整项业务需求通过。测试导入依赖 SDK 构建声明时，仍按[环境执行顺序](coding-and-self-review.md#执行前的环境检查与顺序)核对产物，不自动构建。

## 实际验收

2026-10-27：原有三文件 17 项通过，无跳过，源码摘要未变；隔离探针确认调用方普通和 Vite 哨兵未进入测试、钱包配置键未继承，原 `Asia/Dubai`、polyfill 与 Worker 初始化保留。实际捕获联网异常后仍失败；断言失败、skip、零测试以及 SIGTERM 中断全部正确失败并清理临时目录，探针随后删除。

工具选择器回归已纳入 `yarn test:agent-tools`，88 项通过；与既有精确结果和网络保护回归一起验证。负面场景结束后另用进程表核实所属进程组消失，并检查临时目录实际不存在。根类型检查、ESLint、Prettier、111 个文档本地目标和差异检查通过；完整前端单元测试 3,014 项通过、1 项既有跳过。原始结果为本机 `.local/acceptance/frontend-offline/default-acceptance.json`，负面路径为 `negative-acceptance.json`，不随 Git 共享。


2026-10-27 调试验收：原有 PWA suite 中真实命中两次源码断点，分别读取无新版本与新版本 `200` 输入，source map 与磁盘一致，调用栈包含原测试；恢复后 9 项通过。暂停时核对原 `Asia/Dubai`、document、Worker、Promise polyfill、网络保护及环境隔离均保留。等待连接时 SIGTERM 正确失败，所属进程、端口、临时目录清理完成；非法端口、多 suite 与占用端口均拒绝，占用服务保留。普通默认三文件 17 项及统一工具 92 项通过，未改动业务源码、原测试或 Vite 配置。证据在本机忽略目录 `.local/acceptance/frontend-offline/debug-{acceptance,negative,default-compatibility}.json` 和 `debug-tools.tap`。


2026-10-27 独立 checkout 验收：从本地 `origin/release` 固定 SHA `8ef82eb8a465b2045f73805a66941bf7f836630d` 创建临时独立 clone，确认其中没有本工具；锁文件逐字相同后由验收脚本显式链接本机已有依赖，仅用于本次环境准备。原日期 suite 5 项通过，报告目标身份正确且 checkout 保持 clean；仅在临时副本中修改一条断言后准确失败 1 项，证明没有执行开发目录的同名测试。副本随后删除，未变更主仓库分支或实际业务源码。缺目录、缺目标依赖、不兼容运行时回归均明确失败。独立 checkout 证据位于本机忽略目录 `.local/acceptance/frontend-offline/checkout-task/{acceptance,passed,failed}.json`。
