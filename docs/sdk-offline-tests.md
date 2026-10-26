# SDK 源码离线回归

更新日期：2026-10-27。个人开发基础设施；运行主项目 `sdk/` 中已有测试，不修改 SDK 业务代码、原 Vitest 配置、测试或依赖版本。根目录 `yarn test:ci` 不覆盖 SDK，本入口补充明确范围的源码回归，不代替 SDK 全量测试。

## 使用方式

工作目录为主仓库根目录，使用 Node 22 和现有锁定依赖，不需要 SDK 构建、API、数据库、RPC、钱包或浏览器：

```bash
# Existing BigInt, numbers and fee suites
yarn sdk:test-offline
# Select exact SDK-relative test files; repeat --suite to combine
yarn sdk:test-offline --suite src/utils/__tests__/bigmath.spec.ts
yarn sdk:test-offline --suite src/utils/__tests__/bigmath.spec.ts --suite src/utils/__tests__/fees.spec.ts
# Another existing SDK checkout
yarn sdk:test-offline --sdk-dir PATH --suite src/utils/__tests__/bigmath.spec.ts
# Tool regressions, including the shared network guard
yarn test:sdk-offline
```

默认三份原有测试是 `bigmath.spec.ts`、`numbers.spec.ts`、`fees.spec.ts`，位于 `sdk/src/utils/__tests__/`。本轮实际执行共 153 项；单选 BigInt 为 6 项。选择器要求真实存在、位于所选 SDK `src/` 内的 `.spec.ts` / `.test.ts`（含 tsx）文件，拒绝重复、越界、逃逸符号链接及 glob。原配置的 exclude 继续生效；被排除的文件、空文件或零测试不能通过。

## 按源码依赖选择回归

在主仓库根目录执行，路径相对于所选 SDK 根目录：

```sh
yarn sdk:test-offline --related src/utils/stats/api.ts
yarn sdk:test-offline --sdk-dir /path/to/delivery/sdk --related src/utils/stats/api.ts
```

可重复传入 `--related`，只接受 SDK `src/` 内真实存在、不经过符号链接的 TS/TSX/JS/JSON 文件；拒绝空选择、重复、glob、非规范路径或越界路径。它与 `--suite` 互斥；需要断点时先从报告确认范围，再使用单份 `--suite --inspect-port`，不能把 `--related` 与调试模式混用。

工具先通过目标 SDK 安装的 Vitest `list --filesOnly` 和 `test.related`，复用原 `vitest.config.ts` 的别名、include/exclude 及依赖图，获得直接及间接受影响的测试；随后将精确清单交给同一个离线执行流程。发现阶段不执行测试正文，零匹配明确失败，不回退默认三份测试。原默认范围和显式 `--suite` 行为保持不变。

报告新增 `related` 与 `discovery`，后者保留原生 `discovery-files.json`、日志、进程退出/清理及独立网络审计。发现子进程在加载配置前安装既有 Node 网络保护器，阻断意外联网；被捕获的尝试仍令发现失败。发现与执行各自限时 180 秒，共用临时空 CWD/环境和所属进程组清理，报告保留覆盖整个过程的源码指纹。发现成功后执行失败时，顶层仍为 failed，不能只看 `discovery.status`。

静态依赖图可能因共享索引文件而扩大范围，也不覆盖任意动态加载。**自动选中不代表可离线运行。** 本机实际 `src/utils/bigmath/utils.ts` 发现 35 个测试文件，其中原有 Accounts 测试尝试真实 RPC；离线保护器正确阻断，整次失败，没有忽略该文件或修改业务测试。此时检查报告中的实际依赖，按任务要求使用完整环境，或明确选择本次可离线验证的 suite 并记录覆盖边界，不关闭保护器或把部分通过当作全部通过。

2026-10-27 独立临时 Git checkout 验收：原 Stats 源码选中原测试并通过 7 项；原 BigMath 测试文件通过 `--related` 精确选中后通过 6 项。临时 fixture 验证多个关联源码去重、传递依赖、环境隔离、零匹配不执行、断言失败及配置捕获联网异常后仍失败；目标 HEAD、索引、业务源码保持不变，临时副本已清理。依赖准备沿用下节方式，显式复制目标 Vitest、链接其他已安装依赖，仅用于隔离验收，不代表全新安装通过。证据在本机忽略的 `.local/acceptance/sdk-offline/related-acceptance.json`；路径及参数冲突回归纳入 `yarn test:agent-tools`。

本轮兼容性与工程检查通过：默认三份 SDK suite 共 153 项，显式单 suite 的真实源码断点、BigInt 参数与恢复后 6 项测试；统一工具回归 111 项、SDK 产物只读核验、根类型检查、相关 ESLint/Prettier、143 个文档本地目标及差异检查。完整前端回归 299 个文件 / 3,014 项通过，另有 1 个文件 / 1 项既有跳过，退出 0。没有构建 SDK 或启动外部服务；真实 RPC 依赖仍是上述离线覆盖边界。

## 按 Git 变更范围运行回归

SDK 纯源码功能分支可以使用明确基线自动收集改动，无需逐个列出 `--related`：

```sh
yarn sdk:test-offline --changed-since origin/release
yarn sdk:test-offline --sdk-dir /path/to/delivery/sdk --changed-since origin/release
```

REF 在目标 SDK 所属 Git 仓库中解析并固定为 commit SHA，不使用基础设施仓库的 ref。对于主项目结构，报告 `changes.checkoutDir` 为目标主仓库根目录，`sdkPrefix` 为 `sdk/`；Git 路径保留仓库根目录相对形式，最终 `related` 转为 SDK 根目录相对路径。直接比较基线树与当前工作树/索引，合并未忽略的未跟踪文件，覆盖已提交、暂存、未暂存和新增源码；不自动找 merge-base、不 fetch 或切分支。

只有全部变更均为所选 SDK 内现存的 `src/` TS/TSX/JS/JSON 时才自动选择。空范围、删除、SDK 配置/依赖/资源、根配置、前端或其他目录混合改动均明确失败，要求人工评估后用 `--suite`，不会悄悄丢弃范围外文件。此模式与 `--suite`、`--related`、`--inspect-port` 互斥。文档或配置也变更的 SDK 任务仍可显式选测试，但需独立验证这些变化的影响。

先核对 `changes.baseSha`、`head` 和工作树/索引/未跟踪路径，再检查原生发现及实际结果。执行结束以固定 SHA 重算范围，记录 `changesAfter` 和 `changesUnchanged`；即使断言通过、源码字节不变，暂存状态或 HEAD/路径变化也不能 passed。SDK 内容另由 `sourceUnchanged` 检查。Git 读取固定禁用索引自动刷新、外部 diff、textconv 和 rename 推断，以 NUL 分隔的内容 numstat 识别文件，避免文件恢复原字节后的 stat 缓存误报；不写目标索引。

2026-10-27 已在独立 `origin/release` 主项目 checkout 验收：修改原 BigMath 测试文件后，通过 Git 范围自动选中并执行原 6 项测试。临时 fixture 验证四种变更合并、精确执行和调用方环境隔离；空范围、根/SDK 配置、前端源码混入及删除均失败。测试正文模拟另一个编辑者暂存新增源码，在原断言通过、内容指纹不变时仍报告 `changesUnchanged=false` 并失败。正常运行前后目标 HEAD、索引及源码保持不变；临时副本已删除，实际业务文件未改。验收显式复制目标 Vitest、链接其他现有 SDK 依赖，不代表全新安装通过。真实 Git 路径/模式回归纳入统一工具测试，本机证据为忽略的 `.local/acceptance/sdk-offline/changed-acceptance.json`。

本轮兼容性与工程检查通过：默认 SDK 153 项、原 `--related` 独立目录验收、真实 BigMath 源码断点及恢复后 6 项；统一工具回归 113 项、SDK 产物只读核验、根类型检查、相关 ESLint/Prettier、147 个文档本地目标及差异检查。完整前端回归 299 个文件 / 3,014 项通过，另有 1 个文件 / 1 项既有跳过，退出 0。没有构建、启动服务或修改业务源码、原测试和依赖版本。

## 独立交付目录验收

从当前基础设施目录调用 `--sdk-dir /absolute/path/to/delivery/sdk`，无需把个人工具复制进交付分支。先在目标 SDK 目录准备其锁定依赖；确实需要安装且已获授权时，在目标 `sdk/` 下执行 `yarn install --immutable --mode=skip-build`，不要借用开发基础目录的 `node_modules`，也不要通过普通根安装触发 SDK 构建。完整 checkout 需保留 Yarn 配置引用的根 `.yarn/` 文件。工具本身不安装、不构建、不切换分支。

运行器从目标 `sdk/node_modules/vitest/vitest.mjs` 启动，启动前要求目标 Vitest 与基础设施根目录的 Vitest 版本完全一致；缺少目标包或版本不兼容时直接失败，不回退到开发基础目录。基础设施配置包装器及 setup 仍来自当前工具目录，因此保留这一版本限制；不自动升级目标依赖来满足工具。报告的 `runtime.executable` 为解析符号链接后的实际文件，`runtime.vitest` 为版本；核对其归属和目标源码路径后再消费结果。配置包装器使用基础设施自己的 Vite，不要求目标 SDK 的 Vite 与其相同。

报告的 `sdkDir`、`sourceBefore.commit/dirty`、原生结果文件名必须对应目标 checkout。源码指纹包含目标 SDK 自己的 `yarn.lock`，另记录 `sourceBefore/After.lockSha256`；运行期间修改锁文件会导致 `sourceUnchanged=false` 和整体失败。工具摘要中的根 `yarn.lock` 仍表示基础设施依赖，两者用途不同。锁文件摘要并不证明已安装依赖完整匹配锁文件，准备依赖仍需使用 immutable 安装；该工具不验证全部 `node_modules` 内容。

2026-10-27 已用独立临时 Git checkout 验收：复制原有 SDK 源码、配置与锁文件，复制目标 Vitest 文件，仅为隔离验收显式链接其他现有 SDK 依赖；这不代表验证了全新安装。原 BigMath 6 项通过，commit、干净状态、真实运行器路径和结果路径均属于目标目录；修改目标断言后 1 项失败。缺少目标依赖、Vitest 版本不兼容、捕获联网异常以及测试期间修改目标锁文件均正确失败；环境哨兵未进入测试，正常/失败运行的进程及临时目录均清理。实际 SDK 业务文件未修改，临时 checkout 验收后已删除。证据位于忽略的 `.local/acceptance/sdk-offline/target-acceptance.json`。 当前 SDK 默认 153 项及真实源码断点复验通过；统一工具测试 95 项、根类型检查、前端 3,014 项（另 1 项既有跳过）通过，相关脚本静态检查和 119 个文档本地目标检查通过。

交付前需要自动核对本次测试与交付 HEAD/源码一致时，使用[SDK 测试证据绑定](linear-development-workflow.md#sdk-测试证据绑定)的 `agent:delivery-check --sdk-report PATH --require-clean`；可同时选择前端报告。未选择的证据不算已验收。

## SDK 源码断点调试

2026-10-26 已在真实 SDK 源码与原有 BigMath 测试中验收。需要查看测试中的参数、调用栈或逐步执行时，复用同一入口，显式选择一个 suite 和调试端口：

```bash
yarn sdk:test-offline --suite src/utils/__tests__/bigmath.spec.ts --inspect-port 9238
```

1. 工具先检查 loopback 端口可用，随后 stderr 输出 `SDK debug session`，包含 `inspector`、本次 `logFile`、`reportFile` 和总时限。它表示调试运行已安排，不是 inspector 已就绪；查看该次日志中的 `Debugger listening on ws://127.0.0.1:9238/...`。端口占用则明确失败，不复用或停止既有服务。
2. Vitest 使用单个 fork，并在执行测试前等待调试器。Chrome `chrome://inspect` 中配置 `127.0.0.1:9238` 后 Inspect，或使用支持 Node attach 的 IDE；Agent 可用现有 `scripts/lib/agent-inspector.mjs` 连接该端口 `/json/list` 中的 WebSocket。inspector 仅绑定 `127.0.0.1`，不允许改为公网监听。
3. 启用 source maps，在当前 checkout 的 `sdk/src/utils/bigmath/utils.ts` 中 `mulDiv` 的 `const result = (x * y) / z;` 设置断点，再恢复测试；可查看 `x`、`y`、`z` 和原测试调用栈。其他 suite 同样显式选择实际目标源码。代码进入测试前的初始暂停不是业务函数断点已命中，需继续到目标位置。
4. Agent 自动检查时，可以使用 CDP `Debugger.setInstrumentationBreakpoint(beforeScriptExecution)` 在目标脚本执行前暂停，核对该脚本 URL 和 inline source map 的 `sourcesContent` 与磁盘源码一致，再按 source map 对应位置设断点；移除 instrumentation breakpoint 后恢复。SDK 的 Vite source map 使用相对 `sources`，应相对于脚本 URL 解析，不能直接套用 API tsx 映射格式。
5. BigInt 变量可通过 `Debugger.evaluateOnCallFrame` 逐个读取；CDP 返回 `type=bigint` 和 `unserializableValue`（例如 `10n`），不能直接把含 BigInt 的对象当作普通 JSON 序列化。检查后恢复执行并关闭调试连接，让 Vitest 完成并保存原生结果。

调试只接受一份 suite，避免多个测试文件重建 worker、调试目标和端口冲突。调试整次上限为 30 分钟（包含等待与暂停），普通模式保持 180 秒；原 suite 的测试超时配置仍保留。无需构建 SDK，不加载项目环境文件，不关闭联网保护。需要中止时对外层命令 Ctrl-C 或 SIGTERM，使用共享进程组清理并核对 `exit.cleanup=passed`，不仅关闭浏览器调试窗口；断开 debugger 可能使测试继续执行。

调试报告额外记录 `debug.inspector`、`pauseOnStart`、`timeoutMs` 和日志确认的 `started`。由于已确认当前 Vitest 在 inspector 绑定失败时仍可能运行测试并退出成功，入口同时做端口预检和启动日志检查，失败不能报告 passed。该模式的 passed 仍只代表选定测试通过、源码未变和 inspector 成功启动；具体断点命中、局部变量或业务正确性须有独立证据，不能从端口可连接推断。

### 实际调试验收

2026-10-26，Node v22.17.0，本机实际执行：

- 真实连接单个 Vitest worker，在当前 TypeScript `mulDiv` 源码处命中两次断点；inline source map 内容与磁盘一致，读取 BigInt 参数分别为 `10n / 10n / 2n` 和 `10n / 10n / 3n`，保留原测试调用栈。
- 暂停时核实调用方哨兵变量未进入 worker，`globalThis.fetch` 仍为网络保护器的 `deny`；没有真实发起网络请求、读取钱包或构建。
- 移除断点、恢复并断开后，原有 BigMath 6 项通过，SDK 源码摘要未变化，inspector 端口关闭。
- 初始等待调试器时 SIGTERM 中断：外层退出 1，所属 worker 与调试端口关闭，临时目录清理；端口占用、非法端口和多 suite 调试明确失败，占用端口的服务保留。
- 普通模式默认三份 suite 153 项复验通过；工具回归 4 组通过，包含端口冲突的针对性回归及既有路径、结果和网络保护测试。
- 根 `yarn tscheck` 通过；完整前端单元测试 3,014 项通过、1 项既有跳过；ESLint、Prettier、109 个文档本地目标及差异检查通过。

本机证据位于忽略的 `.local/acceptance/sdk-offline/`：`debug-acceptance.json` 保存两次断点、参数、调用栈与实际运行报告，`debug-negative.json` 保存中断和拒绝路径，`debug-default-compatibility.json` 保存普通模式复验。证据不随仓库共享，后续机器应按本节连接本次运行目标，不能复用历史 WebSocket URL。

## 隔离与结果

结束时同时核对[共享网络审计](frontend-offline-tests.md#结束时核对网络审计)：`network.status=passed`、安装数等于所选文件数、拒绝次数为 0。运行器独立读取 `network-events.log`，捕获异常或更晚的 hook 不得让原生通过结果绕过验收；日志路径在安装时固定，测试修改环境变量不会停用记录。交付时保留该事件文件，delivery-check 会重新读取并比较报告。

- [工具配置](../tools/sdk-offline/vitest.config.mjs) 加载原 `sdk/vitest.config.ts`，保留原源码别名和排除规则，精确限制 include 为所选文件；无需 `sdk/build`。不改生产 SDK 配置，不执行构建、安装或 Git 写操作。
- 测试在独立临时工作目录中运行，Vite envDir 与缓存也指向该目录；只传 PATH、NODE_ENV=test、TZ=UTC、CI 和本轮参数文件路径，不继承钱包、数据库等调用方配置，不加载项目 `.env`。原 Vitest 配置及测试仍是可执行代码，本工具不承诺阻止它们主动读取任意文件。
- 复用 [API 离线网络保护器](../tools/gmx-api-offline/network-guard.cjs)，在测试 setup 阶段阻止 Node fetch、HTTP/HTTPS、socket、TLS、HTTP/2、UDP 和 DNS；同步 builtin ESM 导出。文件结束时检查尝试次数，即使测试捕获了网络异常也失败。保护器不替换业务数据，不提供 RPC/服务兜底。
- 网络保护作用于所选 Node 测试进程，不是操作系统沙箱；不防御恶意测试主动撤销保护或另起子进程。原 Vitest 配置加载发生在测试 setup 之前，只使用可信 checkout；需要真实服务的测试应使用对应环境，不能通过关闭保护器获得本离线入口的 passed。
- 文件串行执行、无重试；普通模式整次 Vitest 限时 180 秒，显式调试模式为 30 分钟，超时终止所属进程组。通过共享 `scripts/lib/agent-test-process.mjs` 创建独立 POSIX 进程组；SIGINT/SIGTERM 先发送 SIGTERM，1 秒后仍未退出则强制停止，超时直接终止所属组。正常退出或失败后也检查并清理组内存活子进程，使用系统 `ps` 核实非 zombie 成员已消失，再删除临时目录；SIGKILL/系统崩溃不保证清理。
- 退出 0 要求进程正常退出、JSON success、实际执行测试全部通过、每个所选文件都有通过断言且无 skipped/todo、结果文件范围精确一致、SDK 源码摘要未变化。其他情况退出 1。路径等前置错误输出 stderr，不进入测试。

日志和报告在忽略目录 `.local/acceptance/sdk-offline/run-*/`：`vitest.log`、原生 `vitest-results.json`、汇总 `report.json`。记录选定文件、时间、进程退出、测试数、SDK Git commit/dirty、源码文件数和聚合 SHA-256，以及工具和根锁文件摘要。源码摘要覆盖 SDK `src/` 中的 TS/TSX/JS/JSON、SDK package/锁文件/tsconfig/Vitest 配置；不读取 `.env`，不代表整个依赖树、构建产物或部署身份。dirty 是所处 Git 仓库状态，不能仅凭 commit 复原工作树。

默认测试沿用现有 EVM/共享计算输入，不能据此声明 Solana 数学、链上兼容、SDK 发布包或真实 API 已验收。工具不修改任何业务预期，失败先查看本轮日志和结果。

## 本轮验收

2026-10-26 实际执行：

| 条件 | 结果 |
| --- | --- |
| 原有 SDK 三文件默认范围 | 153 项通过，无跳过，无 SDK 构建 |
| 显式单文件 | BigInt 6 项通过，报告只包含所选文件 |
| 环境隔离 | 临时项目 `.env` / `.env.test` 及调用方哨兵变量未进入测试 |
| 捕获联网异常后继续执行 | fetch / HTTP builtin ESM / DNS / socket 四次尝试被阻止；测试断言虽通过，afterAll 仍使整次失败 |
| 断言失败与零测试 | 均退出失败，保留原生结果及日志 |
| 中断与资源清理 | 实际发送 SIGTERM，工具退出失败，Vitest worker 随所属进程组停止，临时目录清理通过 |
| 路径与结果判定 | 工具回归覆盖缺失、重复、越界、符号链接、glob，以及范围不符、空断言、skipped/todo、失败与信号退出 |
| 共享保护器兼容 | 原 gmx-api 离线测试复验通过，保持原默认行为 |

临时测试样例只写入忽略目录，验收后删除；原 SDK 源码和测试未改动。失败场景记录在本机 `.local/acceptance/sdk-offline/fixture-acceptance.json`，中断记录为同目录 `interrupt-acceptance.json`；其他实际执行结果随对应 run 保存，不随 Git 共享。

工程检查通过：3 组工具回归、脚本语法、ESLint、Prettier、文档链接和 `git diff --check`；`yarn tscheck` 退出 0；根前端回归 299 个文件通过 / 1 个原有跳过，3014 项通过 / 1 项原有跳过，退出 0。仍有既有 Browserslist 过期提示及 happy-dom teardown AbortError 输出，本轮不修改这些无关内容。汇总为本机 `.local/acceptance/sdk-offline/acceptance.json`。

实现入口：[sdk-offline-tests.mjs](../scripts/sdk-offline-tests.mjs)。本基础设施属于 `solana-integration` 个人开发基础，不携带到基于 `origin/release` 的业务 PR。


## 进程清理统一验收（2026-10-27）

SDK 入口已复用与前端/API 相同的进程组工具，移除原有只发送 SIGTERM 的中断逻辑和不核验结果的结束清理。报告 `exit` 包含 `processGroup`、`interrupted`、`timedOut`、`cleanup`，信号发送异常时包含 `signalError`；中断、超时、清理失败或信号异常均不能 passed，即使测试已写出成功结果。`temporaryDirectory` 保存本次临时路径，`temporaryDirectoryCleanup` 仍记录目录清理。共享工具源码也纳入 `toolSha256`，后续变更会改变测试证据指纹。

适用于 macOS/Linux，依赖系统 `ps`；只清理所属进程组，不保证清理由测试主动脱离组的后代，外层运行器被 SIGKILL 或系统崩溃时也不能执行清理。不要为清理遗留资源而结束其他任务；核对报告中的 processGroup 和归属。

隔离 SDK 源码副本实际运行成功、断言失败和执行中 SIGTERM 三条路径，均确认所属子进程消失、临时目录实际删除；副本随后清理，实际 SDK 文件未改。真实 BigMath 源码断点两次命中、BigInt 参数和调用栈保持正确，环境/网络隔离保留，恢复后原测试 6 项通过。调试初始等待时中断、端口占用、非法端口和多 suite 拒绝路径通过，占用服务保持运行。原默认 153 项通过。忽略 SIGTERM 后强制结束、超时和无关哨兵进程保留由共享真实 Node 回归覆盖，不额外等待 SDK 普通 180 秒或调试 30 分钟重复该测试。

本机证据在忽略目录 `.local/acceptance/sdk-offline/`：`process-acceptance.json` 保存三条真实执行路径，`process-debug-acceptance.json` / `process-debug-negative.json` 保存调试验证，`process-default.json` 保存默认回归。没有新增重复生命周期测试框架，统一回归入口仍为 `yarn test:agent-tools`。
