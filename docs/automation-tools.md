# 自动化工具沉淀约定

交付分支使用[隔离检查](linear-development-workflow.md#交付隔离自动检查) `yarn agent:delivery-check --head REF --allow-path FILE ...`：只读固定 release、开发基础及交付 SHA，检查祖先关系、混入的基础提交/等价补丁及清单外文件；不 fetch、切分支或转移补丁。回归 `yarn test:agent-delivery-check` 使用真实临时 Git 历史，工具通过仍需审查清单内的完整内容。 已完成离线测试时，使用 `--require-clean` 并显式选择 `--frontend-report` / `--sdk-report` / `--browser-report`，复核原生结果、目标目录、交付 commit 与当前源码/工具身份；三项可同时核对，检查不重新执行测试或启动服务。

全栈联调优先复用 [Agent Solana 工作区](solana-dev-workspace.md)：`yarn solana:dev` 管理选定 API/Vite/RPC 及开发代理，`solana:dev:browser` 与 trace 查询关联真实请求，contracts 提供来源固定的未评审样例形状检查。借用服务不被 stop 清理，业务消费和 reviewed contract 缺口明确报告；仅属个人开发基础，不进入上游业务交付。

API 源码调试使用既有持续服务上的[断点验收入口](solana-api-local.md#agent-可重复的源码断点验收)：`yarn solana:api-debug` 自动验证真实 inspector、TypeScript 映射、请求断点、限定局部变量与恢复结果；默认启动并清理所属服务，`--attach` 保留借用服务。回归命令为 `yarn test:solana-api-debug`，使用真实隔离 Node inspector，不改业务源码。

前端局部测试使用[源码离线入口](frontend-offline-tests.md) `yarn frontend:test-offline --suite src/...spec.ts`：复用原 Vite/happy-dom 配置、初始化、网络保护器和精确结果检查，在隔离 CWD/环境中运行，保存独立原生结果；不修改原 `test:ci`。`--project-dir PATH` 可验证独立交付 checkout 的源码、配置与依赖，工具和报告留在基础设施目录，不复制到业务分支。默认日期、PWA 和 Solana flag 三文件 17 项已实测通过，选择器回归自动纳入统一工具测试。单 suite 加 `--inspect-port 9240` 可在隔离的单个 Vitest fork 调试原 TypeScript 源码；已核对断点、输入、调用栈及恢复，进程清理复用共享工具并记录结果，操作见同一文档。

SDK 计算使用[源码离线回归](sdk-offline-tests.md) `yarn sdk:test-offline`（独立交付目录显式使用 `--sdk-dir PATH/sdk`，准备目标依赖并核对运行器/锁文件身份）：复用原 SDK Vitest 配置，精确选测试文件，使用空环境目录和共享 Node 网络保护器，无需构建；报告保留源码摘要和原生结果，拒绝零测试、范围不符及捕获后的联网尝试。SDK 执行与取消复用共享进程组工具，报告明确中断/超时和核实后的清理状态，避免取消后长时间等待或误用成功结果。工具回归为 `yarn test:sdk-offline`，不复制业务实现或预期值。 单 suite 加 `--inspect-port 9238` 可在单个 Vitest fork 的真实 TypeScript 源码设置断点，保留离线隔离；端口预检及 inspector 启动日志核验防止绑定失败却误报成功，操作与实测见同一文档。

前端、SDK、API 离线入口和数据库集成入口共用 `scripts/lib/agent-network-audit.mjs` 读取安装/拒绝事件；各 profile 保留自己的网络权限。离线保护器同步记录事件，运行器独立拒绝迟到或捕获后的连接尝试；回归复用既有 guard 测试，不重复建设测试框架。详见[结束时网络审计](frontend-offline-tests.md#结束时核对网络审计)。

SDK 产物使用[构建产物准备入口](sdk-artifacts.md)：`yarn sdk:artifacts verify` 只读核对源码、工具链与完整产物，已获构建授权后用 `yarn sdk:artifacts build` 隔离预生成和编译，成功后才替换产物。回归入口 `yarn test:sdk-artifacts` 覆盖拒绝错误来源、完整性及替换失败恢复旧产物。

独立网络选择 UI 验收使用[管理浏览器冒烟](solana-browser-smoke.md#一条命令执行并保存独立报告) `yarn solana:browser-check`：复用已有预检、只读用例和 Playwright `webServer`，自动启动/停止 Vite，每次保存独立 JSON/HTML/诊断，不覆盖历史结果、不接管既有服务。功能分支可显式加 `--project-dir PATH`，核对目标依赖及已批准资源后启动目标 Vite，报告和用例留在基础设施目录。回归入口为 `yarn test:solana-browser-check`。

更新日期：2026-10-25。用户已授权 Agent 在实际协作中主动发现、实现并积累有复用价值的自动化能力，减少重复推理、人工操作、执行时间和成本。

API 离线和隔离数据库测试共用 `scripts/lib/gmx-api-source.mjs` 的 Git 身份读取，显式选择普通 suite 不依赖 Solana 样例文件；独立目录用法与实际验收见[API checkout 测试](solana-api-local.md#在独立-api-checkout-中运行测试)。保留全部源码聚合指纹与网络/清理检查。

持续联调复用 [solana:dev 工作区](solana-dev-workspace.md#独立前端-checkout-的持续联调)：`--project-dir` 同时选择目标 Vite 与控制 socket，不同目标可使用独立端口并存；浏览器探测核对管理地址和实际目标源码身份，报告留在基础设施目录。

## 统一离线工具回归

2026-10-27 已验收。修改 Agent 工具或公共辅助能力后，先在主仓库根目录运行：

```sh
yarn test:agent-tools
# Save the native TAP output when evidence is needed.
yarn test:agent-tools > .local/acceptance/agent-tools/latest.tap 2>&1
```

归档前先 `mkdir -p .local/acceptance/agent-tools`。入口直接复用 Node 22 的 `node --import tsx --test --test-concurrency=2` 和现有锁定依赖，不增加框架、测试包装器或依赖版本。原单项 `test:*` 命令继续可用；只验证一个独立工具时可运行原单项命令，修改跨工具共享能力或交接整个基础设施分支时使用统一入口。

| 纳入范围 | 用途 |
| --- | --- |
| `scripts/*.test.mjs`、`scripts/*.test.ts` | Agent 钱包公开向量与校验、预检、证据包、验收工作表、API/SDK 工具、断点客户端、分支隔离等已有工具回归 |
| `scripts/test-eslint-solana-imports.cjs` | 既有 Solana 导入边界规则回归 |
| `tools/solana-rpc-proxy/proxy.test.mjs` | RPC 代理 handler、方法限制与错误处理回归 |
| `autotests/regression/ci/*.test.cjs`、`*.test.ts` | 预览 URL 解析与报告摘要等既有 CI 辅助测试 |

路径由 shell 在上述明确目录展开，不递归发现测试、不扫描嵌套参考仓库，不重复执行单项 package 命令。上述目录增加同后缀工具测试时自动纳入；新增其他目录或命名方式时需要显式维护命令，不能认为全仓库测试已覆盖。并发限定为两个测试文件，各文件由 Node 隔离执行，避免调试器、子进程等测试无限并发争用资源。

退出码沿用原生 Node test runner：全部通过为 0，有测试失败或加载错误为非零；TAP 末尾给出 tests/pass/fail/cancelled/skipped/todo 和耗时，报告时保留真实跳过情况。该入口不额外禁止测试显式 skip，新增跳过必须说明，不把测试总数固定成长期验收门槛。

这些现有测试使用公开测试向量、临时目录、临时 Git 仓库、注入的数据源及本地 Node inspector/loopback 监听，不需要真实凭据、钱包余额、Docker 容器或外部服务，也不启动 Vite/浏览器、构建或部署。它不是网络或文件系统沙箱，仍应审查新加入测试的副作用，不允许把真实交易、钱包配置或依赖远端服务的验收加入这个默认入口。

**测试范围区别：** 这里验证工具自身，不执行 `agent:preflight` 的真实 RPC/keeper 检查，不运行真实 API 数据库/HTTP 验收或 Chrome 冒烟。`yarn test:ci` 的前端业务测试、`yarn sdk:test-offline` 的 SDK 原有业务计算测试，以及 regression fixture/funded 测试仍使用各自命令；本入口通过不能代替它们。根据任务选择真实验收，避免重复执行没有变化的检查。

本轮真实结果：27 个文件、85 项全部通过，无失败、取消、跳过或 todo，首轮约 5 秒。已核对目标目录内全部现有测试恰好纳入一次；临时注入一份失败测试后命令正确退出 1，删除后恢复通过。范围及失败证据保留在本机忽略目录 `.local/acceptance/agent-tools/scope-and-failure.json`、`failure-propagation.tap`，正常输出为 `baseline.tap` 和 `final.tap`。数量反映本次版本，后续增加测试应以本次运行结果为准。 工程收尾：根类型检查、package 格式、107 个文档本地目标及差异检查通过；完整前端回归 3,014 项通过、1 项既有跳过，汇总为同目录 `acceptance.json`。

## 何时沉淀

优先关注实际任务中反复执行、步骤固定、结果可验证的工作，例如资料定位、跨仓库信息汇总、格式转换、接口与数据契约核对、精度对照、静态检查和测试验证辅助。

发现机会后，先检查 `scripts/`、`package.json`、现有测试工具、SDK 工具及参考仓库是否已有可复用能力。只有在能减少重复劳动或明显降低错误时才增加工具；一次性简单命令不必封装，判断标准不明确的任务先澄清，不将猜测写进自动化逻辑。

## 如何实现

1. 在当前任务范围内实现最小可用能力，优先采用现有运行环境和依赖；避免引入通用框架、大量新依赖或无关重构。
2. 项目辅助脚本优先放在 `scripts/`，测试辅助能力沿用现有测试目录及组织方式。需要复用到运行时代码的逻辑仍按项目分层放置，不为脚本打破架构边界。
3. 路径、网络、输入和输出等可变项用明确参数表达，避免硬编码个人机器路径和凭据。脚本、注释、日志、错误信息和帮助文本使用英文，配套说明使用中文。
4. 失败时返回非零退出码并提供可定位的信息，不把缺失依赖、网络错误或未知结果当成验证通过。不在工具中隐藏提交、推送、部署、删除等操作。
5. 用当前任务的真实输入验证结果，必要时与人工核对结果对照；检查有意义的失败路径和边界。测试遵守 gmx-prompts 的准入标准，不为简单脚本堆砌测试或测试框架。

工具创建与执行分别遵守授权：沉淀自动化能力不代表获准自动运行 UI 测试、构建、部署、打开浏览器或启动服务器，也不扩大 Git 操作和外部写入权限。收到 `push` 时直接执行原定流程，不插入工具建设。

## 如何交接

每个正式沉淀的工具都应在对应主题文档中记录，并通过 `docs/README.md` 或相关文档提供可发现的入口：

- 用途与适用条件，明确替代哪部分重复工作。
- 脚本路径、工作目录、调用示例、依赖及必要配置。
- 输入输出、退出码含义，以及是否修改文件或访问网络。
- 已验证的样例、核验日期、已知限制和未验证事项。

优先更新已有工具和文档，避免同一任务出现多套近似脚本。遇到接口或项目结构变化时，同步修正当前任务涉及的工具及说明，不让旧检查产生错误信心。

已沉淀 [Linear 需求工具](linear-requirements.md)：复用同一入口完成 FESOL 实时查询、全量快照、筛选和差异比较，避免每次由 Agent 手工翻页、统计及比对。脚本为 `scripts/linear-requirements.mjs`，验证入口为 `yarn test:linear-tools`。

已实现[本地 Agent 验收钱包](agent-wallet.md)的入口：`yarn agent:wallet addresses` 从根 `.env.local` 的 `AGENT_TEST_WALLET_MNEMONIC` 派生固定路径 EVM/Solana 公开地址，不访问网络、不签名或发送交易。公开向量与失败路径测试入口为 `yarn test:agent-wallet`；2026-10-24 用户配置并授权后，三组测试及实际地址派生、重复性检查通过。Mainnet 原生 SOL 余额预检命令为 `yarn agent:wallet balances --network solana-mainnet`，先启动既有 RPC 代理；先校验完整网络 genesis，再输出精确余额、slot 和时间。另有 `yarn agent:wallet tokens --network solana-mainnet` 查询 SPL Token/Token-2022 全账户与精确金额/状态，不能将其当作可花费额度。当前共九组钱包测试及真实 Mainnet 对照验收通过；Devnet 暂缓，尚无签名或发送功能。资金相关验收先重新运行预检，不依赖历史余额。

已沉淀 [keeper 只读预检](keeper-preflight.md)：`yarn keeper:preflight` 复用现有 Arbitrum keeper/代币配置，显式设置已验证的 User-Agent，检查五种基础资产价格（最大年龄 30 秒）、三种非稳定币的 24h/1m K 线与 `solanaTrading`。验证入口为 `yarn test:keeper-preflight`；真实请求发现主端点和两个备用端点均缺少交易开关，正确返回 `blocked` / 退出 2，不伪装成整体通过。工具不启动服务、不发送交易，不自动切换上游。

已沉淀[本地 Solana RPC 代理](../tools/solana-rpc-proxy/README.md)：通过现有 fallback key 和固定上游 Origin 为 Agent/本地前端提供统一 HTTP 入口，拒绝交易发送；手动启动 `yarn solana:rpc-proxy`，不自动启动前端。单元验证入口为 `yarn test:solana-rpc-proxy`，真实只读验收为 `yarn solana:rpc-proxy:verify`（需先启动代理）；2026-10-24 经用户授权已通过 handler、真实读取、100 账户、订单扫描及本地浏览器 CORS 验收。前端统一 URL 配置已加入，当前分支尚无 Solana RPC client 消费它；跟踪状态见 [A01 实施清单](agent-acceptance-infrastructure.md)。

已沉淀[本地 Solana API 样例验收服务](solana-api-local.md)：`yarn solana:api-local doctor` 先汇总环境缺项，`yarn solana:api-local check` 自动启动、限时等待、检查并清理所属服务，保留日志和成功报告。持续联调可用 `yarn solana:api-local start` 在隔离环境中运行已有 gmx-api Solana 入口，`yarn solana:api-local verify` 检查 14 项健康、样例、动态时间戳、地址错误、404 和 CORS 行为，输出 sample 模式、预期源码 SHA/dirty 和文件摘要。无需钱包或后端凭据；不自动安装依赖、启动前端或切换业务 host。实际使用前按文档准备锁定依赖，完成后关闭自启服务。

已沉淀[Agent 统一只读预检](agent-preflight.md)：`yarn agent:preflight` 复用已有 RPC、keeper 和样例 API 检查；`--checks` 可显式选择钱包余额。输出统一 JSON、退出码、本地源码与配置摘要；单项失败不阻止其余检查，不启动服务或发送交易。另有 `--compare-source REPORT.json`，按固定源码计划离线比较历史指纹，列出变化而不重跑原检查。状态/隔离测试入口为 `yarn test:agent-preflight`，真实数据模式、授权和前置仍遵循原工具。

已沉淀[Solana SDK 与程序版本证据预检](solana-runtime-preflight.md)：`yarn solana:runtime-preflight --local-only` 核对已安装 SDK 和现有独立 WASM；默认模式经已启动的代理读取 Mainnet 程序部署证据，分段计算完整程序区摘要并核对前后元数据。测试入口为 `yarn test:solana-runtime-preflight`。不读取钱包、不构建/部署，不将文件指纹当作业务兼容证明。

已沉淀[Solana ALT 资源预检](solana-alt-preflight.md)：`yarn solana:alt-preflight` 复用现有两张 Mainnet 表配置和 RPC 代理，批量读取后校验账户布局、生命周期与生效地址数，记录 authority、完整地址和摘要。测试入口 `yarn test:solana-alt-preflight`；不创建/修改表，不把表可读当作任意交易地址覆盖。

已沉淀[Solana Mainnet 交易回执证据](solana-transaction-evidence.md)：`yarn solana:transaction-evidence --network solana-mainnet --signature <signature>` 复用既有代理读取 finalized 回执与历史签名状态，交叉核对身份/结果，保存精确整数、完整回执、内容摘要和工具源码身份。测试入口 `yarn test:solana-transaction-evidence`；未知/未 finalized/缺回执为 blocked，链上失败为 failed，不读取钱包或推断 keeper 执行。

已沉淀[Agent 验收证据包](agent-evidence.md)：`yarn agent:evidence pack` 显式收集已有工具 JSON，保留原字节/状态/观察时间、生成文件清单及摘要；可用 `--worksheet` 绑定并携带工作表，`verify` 在接收目录离线检查完整性及其与报告的一致性，可用 `--expected-manifest-sha256` 比对包外记录，不依赖原路径或链上服务。测试入口 `yarn test:agent-evidence`；不重新执行验收、不脱敏或上传，包完整不代表业务通过。

已沉淀[Agent 本地 PR 预览定位](agent-preview.md)：`yarn agent:preview --pr NUMBER [--expected-sha SHA]` 通过 gh 只读 API 复用 CI 的精确部署解析器，提供分页、版本/URL/检查链接与源码摘要。验证入口 `yarn test:agent-preview`；报告可加入证据包，不打开页面、构建、部署或运行 UI。

已沉淀[Solana 统计索引只读预检](solana-index-preflight.md)：`yarn solana:index-preflight` 从现有 API 源码默认配置核实 SQD 端点/阈值，轻量检查 GraphQL 契约、高度与最新 volume 事件年龄。测试入口 `yarn test:solana-index-preflight`；支持证据包，不扫描全历史、不部署或自动切源，事件年龄不等于处理延迟。

已沉淀[真实 SDK/WASM 基础向量](solana-sdk-vectors.md)：`yarn solana:sdk-vectors` 复用本地指纹检查后，实例化真实固定 WASM 并逐项对照独立 Python 整数生成的 apply_factor 参考值。测试入口 `yarn test:solana-sdk-vectors`；无 RPC/钱包/构建，不把基础数值结果当复杂业务计算或链上兼容证明。

已沉淀[验收工作表一致性检查](agent-acceptance-workflow.md#工作表自动一致性检查)：`yarn agent:acceptance --file PATH.md` 直接读取既有 Markdown 条件/执行表，核对唯一编号、引用、执行结果和汇总状态，输出工作表/检查器摘要；验证入口 `yarn test:agent-acceptance`。不执行表内命令、不读取凭据或原始证据，不评判需求完整覆盖及证据充分性。

已沉淀[Solana 浏览器环境预检](solana-browser-smoke.md#先准备再执行)：`yarn solana:browser-preflight` 将已遇到的缺包、缺浏览器、SDK 产物及测试发现检查前置，输出可归档 JSON 与阶段状态，不启动浏览器或服务。测试入口 `yarn test:solana-browser-preflight`；不将准备通过当页面或需求通过。

已沉淀 [gmx-api Solana 离线计算回归](solana-api-local.md#gmx-api-solana-离线计算回归)：`yarn gmx-api:test-offline` 默认复用 API 两个既有 Solana suite（12 项），支持重复 `--suite src/...test.ts` 精确选择其他离线测试；使用独立无数据库配置、UTC 和环境隔离，阻断意外外连，核对精确执行范围及 API 本地源码依赖摘要。已实测 number 与收益计算两份原测试 59 项通过；`yarn test:gmx-api-offline` 验证网络 guard、结果拒绝组合和源码指纹。测试使用独立进程组，成功、失败、中断与超时后清理所属子进程并记录清理结果；真实 Node 生命周期回归自动纳入统一工具测试。单 suite 加 `--inspect-port 9239` 可暂停 Jest，在原 TypeScript 源码查看参数与调用栈；保留网络和环境隔离，详见同一文档的断点调试章节。该 profile 不替代默认数据库集成、HTTP 或实时服务验收。

已沉淀 [gmx-api 隔离 PostgreSQL 集成测试](solana-api-local.md#gmx-api-隔离-postgresql-集成测试)：`yarn gmx-api:test-integration` 使用本地 postgres:15 镜像建立专属临时容器，复用原有 Jest 配置、迁移和数据库 setup/teardown，默认运行两个既有 suite / 5 项测试，可重复传入 `--suite` 指定其他 API 测试（已验证迁移/市场模型 11 项）；校验路径并固定 UTC，复用离线入口的完整 API 源码扫描，核对运行前后源码及原配置/迁移证据，保留实际范围、版本和日志，成功或测试失败均清理所属容器。单 suite 加 `--inspect-port 9241` 可在原数据库测试中命中 TypeScript 模型断点并读取参数，保持 UTC 和所属资源清理；调试步骤见同一文档。默认网络限制仅允许本次数据库及测试进程自建服务器，拒绝事件由运行器独立核对，捕获异常或末尾钩子也不能误报通过；要求本地 Docker，不自动拉镜像，不接触已有数据库，不代表完整 API 或真实数据验收。

已沉淀 [gmx-api 路由准备与过期检查](solana-api-local.md#gmx-api-路由生成准备与过期检查)：`yarn gmx-api:prepare` 复用原 v1/v2 TSOA 配置生成路由及 OpenAPI；`--verify` 只读比较输入和产物摘要，缺失、损坏或过期返回非零。真实路由映射/Express HTTP 测试共 6 项通过；不替代契约评审、部署或实时服务验证。

已沉淀 [Solana 持续联调服务](solana-api-local.md#持续运行的-solana-联调环境)：`yarn solana:api-dev up/status/logs/stop` 管理原 Solana 入口及 tsx watch，提供显式 loopback inspector、环境隔离、状态验证、所属进程清理和持久日志；16 项生命周期/异常检查及真实 Chrome 跨域访问已通过。当前入口仍为 sample，不启动数据库/采集，不修改前端 host 或业务代码。


交付隔离复用[既有 delivery-check](linear-development-workflow.md#交付隔离自动检查)：`--project-dir PATH --require-clean` 可从基础设施目录核对独立交付 checkout 的 HEAD 与暂存、未暂存、未跟踪状态；默认仍仅看提交历史，检查不改 Git 或文件。真实 Git 回归覆盖三种脏状态、目标身份、特殊文件名、忽略产物及只读保持，不复制工具到业务分支。


API 数据库集成入口也复用共享测试进程组工具：`yarn gmx-api:test-integration` 分别记录 `exit.cleanup` 与容器/临时目录 `cleanup`，中断、超时或任一清理失败都不能 passed。已通过隔离 API 副本复现并修复 Jest `--forceExit` 后派生进程残留；具体执行与验收见[API 集成测试说明](solana-api-local.md#测试派生进程清理验收2026-10-27)。共享生命周期回归纳入 `yarn test:agent-tools`，不另建重复测试框架。


前端交付证据绑定复用 `agent:delivery-check --require-clean --frontend-report PATH`，校验现有报告与目标 checkout、head、当前源码/工具指纹及原生测试结果的一致性；不重跑测试、不更新历史报告。具体命令、拒绝条件和真实独立 checkout 验收见[交付说明](linear-development-workflow.md#前端测试证据绑定)。前端运行器与该检查共享原有源码、工具摘要计算，读取 Git 状态禁用可选索引写入。
