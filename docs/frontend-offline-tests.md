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

## 按源码依赖图选择关联测试

已知本轮修改的前端或 SDK 源码，但不确定哪些现有前端测试导入它时，从基础设施目录执行：

```sh
yarn frontend:test-offline --related src/lib/pwa/appUpdateDecision.ts
yarn frontend:test-offline --related sdk/src/utils/stats/api.ts
yarn frontend:test-offline --project-dir /path/to/delivery-checkout \
  --related src/lib/pwa/appUpdateDecision.ts \
  --related src/lib/dates.spec.ts
```

`--related` 可重复，接受目标 `src/`、`landing/`、`sdk/src/` 下存在的 TS/TSX/JS/JSX/JSON 普通文件，测试文件本身也可作为输入；拒绝重复、glob、绝对路径、规范化前后不同的路径和符号链接。SDK 输入沿用目标 Vite 的真实 `sdk` alias 和依赖图，支持经过前端模块的传递导入及混合输入并集。输出与执行范围仍限于 `src/`、`landing/` 前端测试；SDK 自身测试另用 [SDK 离线入口](sdk-offline-tests.md)。不能与 `--suite` 混用。需要断点时，先读取结果中的精确 `suites`，再用原有 `--suite FILE --inspect-port PORT` 单文件调试。

运行器先调用目标 Vitest 的 `list --filesOnly --json`，用原 Vite 配置、原 include/exclude（未设置 include 时使用当前 Vitest 官方默认值）和真实依赖图选择测试，多个输入取关联测试并集。发现阶段不执行测试或 global setup；它会变换依赖模块，因此仍要求完整目标依赖与资源。结果文件经过既有精确路径选择器校验，随后只执行发现的 suite，沿用原有零测试/skip/todo/原生结果检查、运行器侧网络审计、源码指纹与清理规则。无关联测试或发现失败整次退出 1，保留 `failureStage=related-discovery`；不退回默认三文件，不把零测试当通过。

报告新增 `related` 和 `discovery`；后者记录发现阶段的退出与清理、网络审计、`discovery.log`、`discovery-files.json`。发现进程在加载 Vite 配置前安装现有 Node 网络保护器，另存 `discovery-network-events.log`，要求一次安装且零拒绝事件；正式测试继续按 suite 数独立审计。发现和执行各限时 180 秒，共享现有进程组取消/清理。临时目录退出后清理，日志与原生发现清单留在本次 run 目录。

发现阶段与正式测试共用隔离环境和目标 PWA HEAD 时间，Vite 环境目录、缓存仍指向临时目录，两阶段均保持空 CWD，不加载目标 `.env`。运行器读取目标 JSON `.linguirc`，仅在临时目录生成 `rootDir` 及 catalog path/include/exclude 为绝对路径的配置，并通过 `LINGUI_CONFIG` 交给原 Lingui 插件；不修改目标配置或关闭翻译插件。测试包装配置显式使用 `127.0.0.1`，避免 Vite 为 localhost 做 DNS 查询而触发网络拒绝；不放宽保护器。

这是局部回归选择工具，不证明需求覆盖完整。Vitest 的依赖分析无法保证识别运行时拼接的导入、外部数据或所有副作用；删除文件、配置或非代码资源变化仍需按实际影响显式选择测试或运行完整回归，不用关联结果代替这些判断。SDK 源码改动还需独立选择 SDK 自身测试，不能以其前端消费者通过代替。源码指纹和依赖验证边界沿用本页既有范围。交付检查仍绑定报告中实际执行的 suite，不将关联选择当作业务覆盖证明。

关联选择验收（2026-10-27）：当前分支对 PWA 决策源码发现并通过 1 个 suite / 9 项。独立 `origin/release` checkout 不含个人运行器，显式复用锁文件相同的已安装依赖；同一源码 9 项、两个输入并集 14 项及临时副本中的真实传递导入 1 项均通过。无关联源码明确 failed 且未创建正式测试日志；临时 Vite 配置中的 HTTPS 请求在发现阶段被 guard 拒绝，事件独立记录，整次 failed，未发出外部请求。旧显式日期测试 5 项与 release 默认三文件 16 项通过；release 默认数量与当前开发分支的 17 项不同，未修改原测试。目标 HEAD、索引字节与 Git clean 状态保持一致，临时源码/配置注入及 checkout 均已清理，真实业务代码未改。证据在本机忽略目录 `.local/acceptance/frontend-offline/related-acceptance.json` 及其中列出的原始报告。

本轮工程检查：当前分支默认离线 17 项、统一工具回归 108 项、SDK 产物 verify、根类型检查、相关 ESLint/Prettier、136 个文档本地链接和差异检查通过；完整前端回归 299 个文件、3,014 项通过，1 个文件及其 1 项既有跳过，退出 0。当前分支默认报告为同目录 `related-current-default.json`，工程日志为 `related-{tools.tap,sdk.json,types.log,tests.log}`。

## 只发现关联测试

需要先判断影响范围、避免 SDK 共享模块直接触发大量串行测试时，使用同一入口的只发现模式：

```sh
yarn frontend:test-offline --discover-only --related sdk/src/utils/stats/api.ts
yarn frontend:test-offline --project-dir /path/to/feature-checkout \
  --discover-only --changed-since origin/release
```

`--discover-only` 必须配合 `--related` 或 `--changed-since`，不能用于默认范围、`--suite` 或断点调试。它复用上一节的原生发现、精确路径校验、隔离配置和网络保护；不执行测试模块或 global setup。发现仍会加载 Vite 配置、变换依赖图，要求目标完整依赖与资源，不是无副作用的文本扫描。零匹配、图解析失败、发现联网、中断或清理失败仍明确失败，不回退默认测试。

报告使用 `mode=frontend-source-discovery`、`testsExecuted=false`，`status=passed` 仅表示发现及身份复核成功。保留 `suites`、`discovery`、前后源码/工具摘要；Git 模式还要求 `changesUnchanged=true`。顶层 `network` 为发现进程的审计，安装数为 1，不是所选 suite 数；进程清理看 `discovery.exit.cleanup`，临时目录清理看 `temporaryDirectoryCleanup`。不生成正式执行的 `vitest.log`、`vitest-results.json`，报告没有 `counts`、执行 `exit`、`resultsFile` 或 `logFile`；不能拿文件数量当作通过测试数。

读取清单并判断实际影响后，可重复使用 `--suite FILE` 执行明确的局部测试，或运行 `yarn test:ci` 做完整前端回归。只发现报告不能传作交付的 `--frontend-report`；交付检查沿用原有模式限制拒绝它，需提交版本上实际执行测试后的报告。发现后若源码变化，应重新确认范围，不把历史清单当作当前快照。

只发现验收（2026-10-27）：真实 `sdk/src/utils/stats/api.ts` 在约 13 秒内完成 178 个前端 suite 的发现，源码/工具前后摘要一致，零联网尝试，未生成正式测试日志或结果。独立 release 副本中，测试模块及 global setup 注入顶层报错后，SDK 经前端 bridge 的传递发现和 SDK Git 范围发现仍通过；实际证明未执行这些模块。零关联与配置尝试 HTTPS 均正确失败，发现报告被交付证据模式校验拒绝；恢复副本后普通关联执行 1 项通过，目标 HEAD/索引/源码与清理均核对。证据为本机忽略目录 `.local/acceptance/frontend-offline/discover-only-sdk-stats.json`、`discover-only-acceptance.json` 及所列原始文件。副本注入未进入业务分支。

本轮默认离线 17 项、工具回归 113 项、SDK 产物 verify、根类型检查通过；完整前端回归 299 文件 / 3,014 项通过，既有跳过 1 文件 / 1 项。相关 ESLint、Prettier、151 个文档本地链接及差异检查通过。工程日志为同目录 `discover-only-{default.json,tools.tap,artifacts.log,types.log,tests.log}`。只发现模式用于规划范围，上一轮真实 SDK 大范围执行未通过的限制仍保留，不因本轮发现成功改写为测试通过。

## 按 Git 变更范围运行局部回归

SDK → 前端跨层验收（2026-10-27）：独立 release 副本沿用原 Vite `sdk` alias，临时 SDK leaf 经前端 bridge 的传递导入准确选中 1 个前端 suite / 1 项；混合输入并集及 SDK/前端混合 Git 范围均为 2 个 suite / 6 项，SDK 单独 Git 变化为 1 项。SDK 自身测试未混入；无关联输入明确失败，无默认回退。成功报告的源码、工具、网络与范围检查均通过，目标 HEAD/索引/源码及副本清理已核对。证据在本机忽略目录 `.local/acceptance/frontend-offline/sdk-cross-layer-acceptance.json`。

实际消费者验证同时发现并修复 Lingui 相对 catalog 路径与空 CWD 的冲突：原 `src/domain/synthetics/subaccount/utils.spec.ts` 的翻译加载由失败恢复为 25 项通过。现有 PWA 源码关联 9 项、默认入口 17 项、工具回归 113 项、SDK 产物 verify、根类型检查及完整前端回归 299 文件 / 3,014 项通过（既有跳过 1 文件 / 1 项）；相关语法、ESLint、Prettier 和差异检查通过。原生结果及工程日志为同目录 `sdk-related-diagnostic-fixed.json`、`sdk-cross-layer-{existing-related.json,default.json,tools.tap,artifacts.log,types.log,tests.log}`。

实际 SDK `utils/stats/api.ts` 的关联图选中 178 个前端文件，触及串行执行的 180 秒上限，期间还出现原 oracleKeeperFetcher 测试的一项断言失败；本次报告正确 failed，进程及临时目录清理通过，不能当作整组通过。较早的 objects 源码探索选中 200 个文件，也未完成整组验收。证据为同目录 `sdk-related-stats.json`、`sdk-related-first.json` 及对应原始日志。共享 SDK 模块可能经现有前端依赖图扩散到大量消费者；关联清单不保证小范围，也不保证任意原测试都适合隔离入口。需要时按真实影响明确选择 suite 或运行完整前端回归，不修改业务测试、关闭保护或扩大超时来制造通过。

在只包含前端及 SDK 源码改动的功能 checkout 中，从基础设施目录执行：

```sh
yarn frontend:test-offline --project-dir /path/to/feature-checkout --changed-since origin/release
# Include current index, working files and untracked code relative to HEAD.
yarn frontend:test-offline --project-dir /path/to/feature-checkout --changed-since HEAD
```

`REF` 必须是目标仓库中已有的 commit 引用。运行器只读将其固定为完整 SHA，记录当时 HEAD，合并相对该基线的工作树差异、索引差异和 Git 未忽略的未跟踪文件，再把去重的源码清单交给上节真实依赖图流程。比较是所选基线树与当前 checkout 的差异，不自动计算 merge-base，不 fetch、切分支或更新索引；用户应选对实际功能基线。索引中存在但工作文件已撤销的变化仍纳入选择，但测试执行的是当前工作文件，不证明暂存版本通过；交付绑定仍要求干净版本重跑。

参数与 `--suite`、`--related` 互斥；断点调试继续使用发现后的明确 suite。自动范围仅允许已存在的 `src/`、`landing/`、`sdk/src/` TS/TSX/JS/JSX/JSON 普通文件，支持前端与 SDK 源码混合范围。无变化、引用无效、删除/重命名前的源路径缺失，或包含文档、配置、样式和其他资源变化时明确失败，列出需要人工判断的路径；不静默略过这些变化或执行默认测试。混合非代码修改时先评估完整影响，再显式选择 `--suite` 或合适的完整验收，不用自动局部回归代替判断。Git 忽略的未跟踪文件不属于此选择范围，需要时显式 `--related`。

报告新增 `changes`，记录 `baseRef/baseSha/head`、`worktreePaths/indexPaths/untrackedPaths` 及最终 `related`；正常执行后用固定基线 SHA 重新收集为 `changesAfter`，要求 `changesUnchanged=true`。源码内容未变但 HEAD、暂存/未跟踪状态或路径范围变化，也不得报告通过；范围变化失败阶段为 `changed-source-selection`。开始前范围不支持时按原 CLI 前置错误退出 1，不启动发现进程。检查不是原子快照，期间不要并发编辑或执行 Git 写操作。

变更范围验收（2026-10-27）：独立 release clone 不含个人运行器。新增干净功能提交后，`HEAD~1` 固定到原 release SHA，自动选择 PWA 原测试 9 项通过；叠加暂存、未暂存和未跟踪源码后，实际执行两个 suite / 10 项，前后范围一致，索引字节及工作区状态未被检查器修改。临时测试仅把已有未跟踪源码加入索引，原生 10 项通过、源码内容指纹未变，但范围状态改变，运行器正确 failed / `changed-source-selection`；恢复后 10 项再次通过。无变化、无效引用、配置混入和删除源码均在发现前失败，未回退默认测试。所有注入和 Git 写操作仅在验收副本中执行，副本已清理；真实业务源码未修改。证据为本机忽略目录 `.local/acceptance/frontend-offline/changed-acceptance.json` 及其中列出的原始报告。

本机验收曾观察到：禁用索引自动刷新时，恢复原字节后的文件仍可能出现在 `diff --name-only`，但 Git blob 哈希相同且 `--numstat` 无差异。工具因此使用 `--numstat -z --no-renames --no-textconv --no-ext-diff` 读取内容差异，而不为清除统计缓存写入索引；回归保留“改动后恢复原字节应为空范围”的检查。若其他只读工作树差异工具遇到同类问题，先核对 blob/内容差异，不直接刷新用户索引。该结论不影响只比较两个已提交树的交付检查。

本轮范围选择工程检查：统一工具回归 109 项、SDK 产物 verify、根类型检查、相关 ESLint/Prettier、137 个文档本地链接及差异检查通过；完整前端回归 299 个文件、3,014 项通过，1 个文件及其 1 项既有跳过，退出 0。日志为同一忽略目录中的 `changed-{tools.tap,sdk.json,types.log,tests.log}`。

## 结束时核对工具指纹

2026-10-27 已修复前端和 SDK 离线入口的工具变化漏检。原实现只在开始记录 `toolSha256`；测试执行中即使 setup、配置包装器或网络保护器变化，原生断言和源码摘要仍可能通过。现在成功前重新计算同一清单，记录 `toolSha256After` 和 `toolingUnchanged`；必须前后相等才可 passed。变化或结束时文件缺失会在 `tooling-evidence` 阶段失败，保留原生结果、计数、网络审计和进程/临时目录清理证据，不把原生 success 当作整次验收通过。

普通、关联选择、Git 范围选择和调试模式共用这一步。出现此失败时，先确认并发工具编辑已结束，再用稳定版本重跑相关测试；不要复制旧指纹或修改报告状态。工具清单沿用各自既有计划，包含运行器、共享进程/网络工具、配置包装器、setup、发现保护器及基础设施锁文件；不扩展到全部安装包内容，也不是运行期间的文件锁、连续监控或系统沙箱。

[交付检查](linear-development-workflow.md#前端测试证据绑定)同时要求 `toolingUnchanged=true`，并将前后指纹与当前工具比较。缺字段、false 或最终指纹不符均 blocked；缺少这项证据的历史报告需使用当前工具重跑，不能手补字段。

真实验收在隔离工具副本与独立 release checkout 中复现前端、SDK 两种旧误报；修复后原断言仍通过，但工具变化均正确失败，稳定工具的关联选择仍通过。交付 checkout 中，真实前端日期 5 项与 SDK BigMath 6 项报告共同绑定通过；两类报告各自缺检查标识、标识 false、缺最终指纹及最终指纹不符，共 8 种拒绝场景均正确 blocked。目标 HEAD/索引和实际业务源码未被修改，副本已清理。摘要与归档的原始日志/结果在本机忽略目录 `.local/acceptance/sdk-offline/tool-drift/` 的 `repro.json`、`fixed.json`、`delivery.json`，本次工具契约回归沿用既有交付检查测试。

本轮工程检查：默认前端 17 项、SDK 153 项及稳定工具的双入口关联验收通过；统一工具回归 113 项、SDK 产物只读核验、根类型检查、相关 ESLint/Prettier、166 个文档本地目标及差异检查通过。完整前端回归 299 个文件 / 3,014 项通过，另有 1 个文件 / 1 项既有跳过，退出 0。未执行构建或启动服务，未修改业务源码、原测试或依赖版本。

## 结束时核对网络审计

2026-10-27 起，前端、SDK 和 API 离线入口共用运行器侧的网络事件审计。保护器在每个所选文件安装时记录 `installed`，拒绝连接时记录 `blocked`；日志路径在安装时固定，测试修改环境变量不会关闭记录。运行器结束后独立读取 `network-events.log`，报告 `network.status/installations/blockedAttempts/eventsFile`。安装数须等于所选文件数、拒绝数为 0，缺日志或未知事件也失败；不能只凭原生测试 JSON 的 success 判断通过。

测试框架的末尾 hook 可能晚于保护器自己的 afterAll 检查；本轮已在真实 API Jest 中复现原生及旧运行器误报通过，并用独立审计拒绝同一用例。前端/SDK 同样接入审计，捕获连接异常仍失败。普通和断点模式使用相同入口，不增加关闭开关；保护范围仍是原 Node guard，不是操作系统沙箱，不防御恶意测试修改文件或撤销保护。

交付检查选择前端或 SDK 报告时，还会重新读取事件日志并核对汇总字段；保留该日志和原生结果，缺失或内容变化会 blocked。工具和 guard 指纹变化后应重跑相关测试，不手改旧报告。

本轮验收：前端默认 17 项、SDK 默认 153 项、API 离线 12 项及隔离数据库集成 5 项通过，安装数分别为 3、3、2、2，拒绝数均为 0。独立 release checkout 的前端 5 项与 SDK 6 项正常报告共同通过交付检查；向原始事件日志追加 `blocked` 后检查拒绝，恢复后再次通过。工具回归 97 项、根类型检查、相关 ESLint/Prettier 通过；完整前端回归 3,014 项通过、1 项既有跳过，退出码 0。证据保存在本机忽略目录：前端/SDK 的 `audit-default.json`、前端 `network-audit-acceptance.json`，以及 API 目录下的 `offline-audit-default.json`、`integration-audit-default.json`、`offline-audit-tools.tap`、`offline-audit-tscheck.log`、`offline-audit-test-ci.log`。

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
