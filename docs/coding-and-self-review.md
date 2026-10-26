# 编码与自审规范

核验日期：2026-10-25。编码与自我代码审查以本地 `gmx-prompts` 的相关规范为依据。本页提供入口和重点，不替代原文；后续工作应阅读当前版本及其引用资料。

## 执行前的环境检查与顺序

需要同时运行前端/API/RPC 时，按[全栈工作区说明](solana-dev-workspace.md)使用 `yarn solana:dev up/status/logs/stop`，核对所选服务及 borrowed/owned 归属。浏览器请求问题使用 `solana:dev:browser` 和 `solana:dev trace --id`；contracts 的 partial 不当作完整通过。当前前端未消费开发代理路径，不为环境验收补业务接入。仅需 API 时仍使用下文的独立 API 入口。

本节用于安排当前任务已获授权的检查，不要求每次任务运行所有命令。用户已长期授权本地 Vite、Chrome 及已授权任务所需的本地页面验收；构建（含 SDK 构建）、其他服务及部署仍须遵循根 `AGENTS.md` 的授权边界；用户仅要求 `push` 时直接执行推送流程，不插入本节检查。纯文档修改只检查文档路径、链接及差异。

1. **先确定目标与范围。** 需求验收先按[验收映射流程](agent-acceptance-workflow.md)实时核对需求，逐项填写条件、预期、数据模式、方法和版本，再选择所需预检；不将环境工具通过当作业务需求全部通过。涉及现有线上行为或真实数据时，先按[线上核验顺序](agent-acceptance-workflow.md#线上行为与数据核验)查对应 GMX/GMTrade 服务表并核对目标页面当前请求，再做本地或 PR 版本验证，不用历史环境文件认定当前部署。确认命令的工作目录、目标仓库和检查范围，再启动批量检查。主仓库含嵌套参考仓库，不能把它们当作前端测试或 TypeScript 配置的自动发现目标。单文件格式检查使用 `yarn exec prettier --check PATH`（写入时用 `--write`）；`yarn prettier` 是仓库全量格式化脚本，追加文件参数不会缩小原有范围。
2. **根目录类型检查前，先确认 SDK 产物状态。** 先在根目录运行只读 `yarn sdk:artifacts verify`，按[SDK 产物准备说明](sdk-artifacts.md)核对来源、输入指纹及全部产物。缺收据、缺失、过期或损坏时，已获 SDK 构建授权则运行 `yarn sdk:artifacts build`，隔离预生成与编译、成功后替换忽略的产物，再 verify 和 `yarn tscheck`；未获授权时说明该前置条件，不自行构建。有效产物直接复用，不反复重建。旧 `yarn build-sdk` 仍可用于原发布流程，但会执行写入源码目录的 prebuild，且不生成该入口的来源收据。
3. **完整前端构建前，先安排内存与执行顺序。** 已获完整构建授权且机器内存允许时，使用下方已验证的进程级内存配置；大型测试、类型检查和构建顺序执行，避免并发争用资源后再重跑。不修改全局 Node 配置，也不把提高内存当作处理所有构建失败的方法。
4. **失败后按已知特征诊断，再判断代码问题。** 对照下表核实原因，保留原始错误。处理前置条件后仍失败，应继续追踪真实代码或环境原因，不添加断言、虚假导出或兜底来压过错误。
5. **keeper 相关验收先检查真实依赖。** 开展已授权的价格展示、价格计算或 Solana 交易验收前，先按[keeper 只读预检](keeper-preflight.md)运行 `yarn keeper:preflight`。默认请求头已处理确认过的 User-Agent 访问差异；查看逐项价格与 flags 结果。用户已批准本地开发用 `VITE_APP_SOLANA_TRADING_OVERRIDE=true/false` 模拟开关，使用时在报告中注明；预检仍检查真实接口，`blocked` 不作为真实交易前置通过，不能因真实开关缺失阻挡已授权 mock 范围的开发。

6. **资金相关验收先核实网络和余额。** 在已获授权的 Solana 只读验收中，按[本地钱包说明](agent-wallet.md#mainnet-余额预检与执行顺序)先启动既有代理并运行 `yarn agent:wallet balances --network solana-mainnet`，涉及抵押代币或代币账户时再运行 `yarn agent:wallet tokens --network solana-mainnet`；成功后核对 mint、程序、状态与具体需求的资金条件，不将非零余额当成可花费额度。读取失败先诊断代理或上游，不把错误当零余额；Devnet 当前暂缓，不自动换公共 RPC。该预检不授予签名或发送权限。

7. **样例 API 验收先使用现有 Solana launch mode。** 已获本地服务验收授权时，按[本地 Solana API 说明](solana-api-local.md#执行前准备与顺序)先运行 `yarn solana:api-local doctor` 汇总环境缺项；准备完成后，一次性验收优先运行 `yarn solana:api-local check`，自动限时启动、执行 14 项检查并清理所属服务。持续联调使用[持续服务入口](solana-api-local.md#持续运行的-solana-联调环境) `yarn solana:api-dev up` / `status` / `logs` / `stop`，需要断点时 up 显式加 `--inspect-port 9229`；简单前台运行仍可用 `start` / `verify`。先核实报告的 sample 模式和 apiDir，源码错误看日志，修正后由 watcher 重启；不为当前无数据库/RPC 依赖的 Solana 入口启动 EVM master 或旧后端。启动失败查看该次报告的 `logFile`，不反复猜测启动参数。仅修改或核对 API Solana 市场计算时，先运行 `yarn gmx-api:test-offline`，默认复用两个既有纯计算 suite，其他纯计算/离线模块可重复 `--suite src/...test.ts` 精确选择；先核实实际依赖，不要先启动无关数据库或因离线失败自动改用共享环境。离线测试若派生子进程，核对报告 `exit.cleanup=passed`；中断、超时或清理失败不得复用已写出的成功 Jest 结果。运行器只清理所属进程组，不手动结束其他本地服务。需要查看离线计算参数时，按[源码调试说明](solana-api-local.md#api-离线测试源码断点调试)选择单 suite 并加 `--inspect-port 9239`；先确认该次日志中的监听地址，再设置真实源码断点，结束后恢复并断开调试器。涉及 Solana pairs 数据库状态时，使用 `yarn gmx-api:test-integration`，先核实本地 Docker 与 postgres:15 镜像，再用独立临时容器运行原有数据库测试；其他 API 模块用重复 `--suite src/...test.ts` 指定实际范围。工具固定 Node/PostgreSQL 为 UTC；时间戳断言偏移时先核对报告时区与存取值，再判断代码错误，不直接改断言。不要把默认 Jest 指向共享数据库。集成测试结束时同时核对 `exit.cleanup=passed`（测试进程组）和顶层 `cleanup=passed`（所属容器及临时目录）；仅容器已删除不能说明测试派生进程已清理。测试导入 `src/app.ts` 或消费 TSOA 路由时，先运行 `yarn gmx-api:prepare --verify`；缺失/过期则运行 `yarn gmx-api:prepare` 后再 verify，随后执行选定集成测试，详见[路由准备说明](solana-api-local.md#gmx-api-路由生成准备与过期检查)。若出现 `ABI directory not found`，先核对隔离 CWD 的真实 `src/abi` 资源链接；运行器已自动提供，不改业务查找逻辑。HTTP、其他数据库场景及实时数据验收仍使用各自完整流程，所选回归通过不能代替。无需准备 EVM 数据库或 RPC；遇到 immutable 安装的 cacheKey 差异先核对文档中的压缩配置，不删除锁文件或升级依赖。样例通过不代表 reviewed contract 或真实链上数据通过。

8. **组合验收先选择依赖检查项。** 同一任务依赖多个已有通道时，按[统一预检说明](agent-preflight.md)先准备已获授权的服务，再运行 `yarn agent:preflight --checks ...`，查看逐项状态后进入业务验收。钱包必须显式选择；keeper 的真实 blocked 不因本地 mock 被改为 passed，未选择项也不能当作通过。单一通道或需自定义端点时仍可直接使用原工具，不重复运行两套相同检查。

9. **SDK 或部署版本相关验收先固定指纹。** 在已授权的 SDK/交易构建/程序升级影响验收中，按[版本证据预检](solana-runtime-preflight.md)先核对本地版本和已批准 WASM 摘要；需要链上证据时再通过现有代理读取 finalized 程序指纹。缺产物不自动构建，完整程序读取使用分段而不是整份 jsonParsed；遇到元数据变化或单段失败明确停止接受该摘要。钱包或样例 HTTP 等无关任务无需运行此项，指纹通过也不代表业务兼容。

10. **依赖 ALT 的验收先核实表资源。** 在已获授权的交易构建/模拟相关工作中，按[ALT 预检说明](solana-alt-preflight.md)通过已启动代理运行 `yarn solana:alt-preflight`，先看生命周期、实际生效地址和 authority，再核对该笔交易的表成员与索引；blocked/failed 不能当作资源 ready。无 ALT 依赖的任务无需运行；不自动创建、替换或修改表。

11. **已有 Solana 签名先核实链上回执。** 在已获授权的交易结果只读验收中，按[回执证据说明](solana-transaction-evidence.md)显式提供 Mainnet 和当前流程产生的签名，核对 finalized 状态、身份和 meta.err 后再进行订单/API 验证。blocked 不当作成功，transaction-failed 保留回执并排障；创建交易成功不代表 keeper 已执行。没有签名的单元/样例验收不运行此项，不自动签名或发送交易。

12. **移交验收证据先固定包摘要。** 已完成检查并确认报告可归档后，按[证据包说明](agent-evidence.md)显式选取 JSON 产物打包；需移交工作表时先冻结并运行一致性检查，使用 `--worksheet` 与报告绑定。保存 manifestSha256 到包外可信交接记录，不写回已归档工作表；接收侧用 `verify --expected-manifest-sha256` 传入包外记录的摘要，确认 `manifestIdentity=matched` 后再消费报告；not-checked 仅代表未做这一步。打包不重跑检查、不更新观察时间、不授予上传权限，包 passed 不代表原报告或需求 passed。只需本地临时诊断时无需额外打包。

13. **PR 页面验收先固定预览身份。** 已有页面验收授权时，按[本地预览说明](agent-preview.md)先执行 `yarn agent:preview --pr ... --expected-sha ...`，将 PR/head/不可变 URL/check 链接记入工作表，再打开该版本。解析失败不切换分支别名或旧成功部署；元数据 passed 不代表页面已验收，PR 更新后重新定位。单元/本地只读任务无需此项。

14. **Solana 统计验收先核实索引依赖。** 目标数据确实来自现有 volumeRecords 时，按[索引预检说明](solana-index-preflight.md)先执行 `yarn solana:index-preflight`，核对配置默认来源与目标环境是否一致。GraphQL 错误不当空数据；旧/空/未来记录为 blocked，先核实活动范围和时钟，不将事件年龄直接当索引处理延迟。钱包/价格/样例验收不运行此项，不自动部署索引器或换源。

15. **SDK 基础数值验收先执行真实 WASM 向量。** 按[基础向量说明](solana-sdk-vectors.md)运行 `yarn solana:sdk-vectors`，复用本地指纹前置并核对真实二进制结果，再进入该需求独立的复杂数学验收。缺产物不自动构建，失败不从 SDK 反向生成期望；基础 passed 不代表费用/PnL/清算或链上兼容。钱包/HTTP 等无关任务不额外执行。

16. **远端 Solana API 验收先确认真实部署身份。** 先查[最新 A03 就绪与协调记录](agent-acceptance-infrastructure.md#下一步就绪复核与-a03-协调2026-10-25)，取得实际部署地址、访问条件与版本/数据模式依据，再实施远端检查。公开域名的 pairs 正常、FESOL-62 Done 或本地 sample 通过均不能替代；新任务有新证据时再复核，入口仍缺失时协调负责人，不重复猜测 URL 或另建包装工具。

17. **验收工作表交接前检查内部一致性。** 按[工作表检查说明](agent-acceptance-workflow.md#工作表自动一致性检查)运行 `yarn agent:acceptance --file PATH.md`，先修复占位符、无效证据引用及错误汇总，再报告结果。退出 2 表示所列条件尚未全部通过；一致性通过不证明需求完整覆盖或证据充分，不自动重跑历史检查或修改 Linear。仅做基础预检而未填写需求工作表时无需运行。

18. **复用统一预检历史报告先比较相关源码。** 按[源码比较说明](agent-preflight.md#复用历史报告前比较源码指纹)执行 `yarn agent:preflight --compare-source REPORT.json`，变化时先核对影响范围，再选择需要复跑的项；不因无关 HEAD/文档变化机械重跑全部检查。比较通过不刷新历史数据有效期，也不把原 failed/blocked 改成通过；价格、余额、flags 和真实服务仍按当前验收要求检查。没有可复用报告时直接执行本次必要预检，无需先造基线。

19. **Solana 开关页面验收先核实运行语义和依赖。** 按[本地只读冒烟说明](solana-browser-smoke.md)先运行 `yarn solana:browser-preflight`，按 Playwright/Chrome/SDK/discovery 逐项结果处理，再运行所需类型检查；需要恢复依赖时用 `yarn install --immutable --mode=skip-build`，普通安装会触发 SDK 构建钩子。现有 fixture 默认 `production-preview=true`，会使零投放的手动 AB 开关被清除；新入口显式关闭该选项且限定本地 development。准备通过后，当前已授权任务可直接启动本地 Vite/Chrome 并运行用例，无需再次确认；不将测试发现当页面通过。导航优先等待 `domcontentloaded` 后断言目标组件就绪；如 `load` 超时但主界面已显示，先查看 trace 与请求诊断，不靠加长超时或屏蔽外部请求通过。

完整前端构建命令（工作目录：主仓库根目录；仅在已获构建授权、机器资源允许时执行）：

```sh
NODE_OPTIONS=--max-old-space-size=8192 yarn build
```

| 触发条件或错误特征 | 优先检查与处理 | 已确认的边界 |
| --- | --- | --- |
| 根测试日志出现嵌套参考仓库路径，或 Vite 扫描旧前端并提示缺少 `@docusaurus/tsconfig` | 先核对 `vite.config.ts` 的测试发现范围和 `tsconfigPaths.projects`，确认当前分支包含范围修复；不要先安装旧仓库依赖 | 当前主仓库测试已限定到 `src`、`landing`，TypeScript 配置发现已显式限定主项目、landing、SDK；正常使用会直接受益，无需每次另做扫描 |
| 根类型检查出现 SDK 相关 `TS6305`、源代码中已有的导出却报 `TS2305`，或 SDK 类型字段与源码不一致 | 核对源码与 `sdk/build` 声明产物是否匹配；符合上述前置条件时先构建 SDK，再重跑类型检查 | 2026-10-24 验收中，更新忽略提交的 SDK 产物后完整类型检查通过；这些错误特征本身不等于已证明产物过期 |
| 完整前端构建在 chunk rendering 阶段出现 `Reached heap limit` / `JavaScript heap out of memory` | 核实 Node 进程堆限制及主机可用资源；资源允许时采用上述 8 GiB 配置，并避免与其他大型检查并发 | 本机默认约 4 GiB 堆构建失败，8 GiB 配置成功；这是本项目已验证配置，不保证其他机器或未来构建同样适用。其他报错按原始错误排查，不持续盲目加内存 |

同一任务中已完成且仍有效的准备工作应复用；源码、依赖、工具链或相关配置发生变化时，再判断哪些前置条件和检查失效。不要在每次小改动后重复整套准备。

**API 源码调试验收：** 需要确认 Agent 能连接 inspector、命中当前 TypeScript 源码并读取变量时，使用[源码断点验收](solana-api-local.md#agent-可重复的源码断点验收) `yarn solana:api-debug`，默认独立端口并自动停服；仅在明确要复用已启用 inspector 的管理服务时加 `--attach --port PORT`。源码映射不一致或断点未命中应检查报告的失败阶段，不把 HTTP 健康检查当成调试通过；无断点需求的任务不增加此项。

**Agent 工具回归：** 根 `yarn test:ci` 不覆盖个人基础设施脚本。修改跨工具公共能力或交接基础设施分支时，先按[统一离线回归](automation-tools.md#统一离线工具回归)运行 `yarn test:agent-tools`，一次覆盖脚本、RPC 代理及 CI 辅助测试；单工具小改仍可选原单项入口。确认原生结果后再安排本任务所需的类型、前端或真实服务验收，不把工具测试通过当作 RPC/keeper/API/页面 ready。新工具测试加入统一范围时，核实其保持离线且只使用临时资源，不把真实资金或外部服务检查放进默认回归。

**交付目录与验收身份：** 独立交付 checkout 完成测试后，按[交付隔离检查](linear-development-workflow.md#交付隔离自动检查)显式传 `--project-dir PATH --require-clean`，核对实际 HEAD 与待交付 head 相同，且暂存、未暂存、未跟踪列表为空；比较测试报告的目标路径和 commit。默认历史检查的 `worktree.status=not-checked` 不代表干净；blocked 不自动清理文件、切换分支或转移提交。检查后源码变化时重新验收。

**前端局部离线测试：** 需要隔离本机配置并防止意外联网时，使用[前端离线入口](frontend-offline-tests.md) `yarn frontend:test-offline --suite src/...spec.ts`，可重复指定 src/landing 文件；验证独立交付 checkout 时显式加 `--project-dir PATH`，先按同一文档准备目标自己的依赖，再核对报告的 projectDir、commit 和测试路径，避免误测开发目录；保留原 Vite/happy-dom、初始化和时区。需要源码断点时选择单 suite 并加 `--inspect-port 9240`，按同一文档连接本次单 fork 调试目标，核对 source map 和真实断点；结束后恢复、断开并核对 `exit.cleanup`。原配置需要 Git/PWA、Lingui/Babel 及 Vitest CLI root 定位，入口已显式处理，不通过读取根 `.env` 或删除原 setup 绕过启动问题。失败先看本次日志，真实网络/浏览器需求使用对应验收入口，不关闭保护；完整前端回归仍用 `yarn test:ci`。

**SDK 纯计算回归：** 根 `yarn test:ci` 不覆盖 `sdk/`。需要验证 SDK 数值、BigInt、费用或其他可离线测试时，使用[SDK 源码离线入口](sdk-offline-tests.md) `yarn sdk:test-offline` 或重复 `--suite src/...spec.ts` 指定范围，复用原配置和源码，无需先构建 SDK 或启动服务。意外联网会明确失败，先核对所选测试的真实依赖，不关闭保护或修改业务预期；该入口通过不代表完整 SDK、Solana 协议或发布产物已通过。 需要断点时显式单选 suite 并加 `--inspect-port 9238`，按[SDK 调试说明](sdk-offline-tests.md#sdk-源码断点调试)连接单 worker、核对源码映射与实际参数；不以 inspector 启动或原测试通过代替目标断点证据。调试端口冲突先换空闲端口，不连接未知监听。

**独立页面冒烟：** 已授权运行本地网络选择页面验收、且不需要保留开发服务时，优先执行[管理入口](solana-browser-smoke.md#一条命令执行并保存独立报告) `yarn solana:browser-check`，复用预检并由 Playwright 管理独立端口的 Vite，逐次保存原生报告并停服；无需先运行一遍相同预检。端口占用时显式换未用端口，不接管既有服务。手动联调仍可使用原两终端入口，无页面验证需求的任务不增加此项。

**中断 Playwright 管理的服务：** 需要停止当前锁定版本 Playwright CLI 的测试时，向 CLI 发 SIGINT，使 runner 执行 teardown；不要直接用 SIGTERM 假定其会清理 webServer。管理入口已将外部 SIGINT/SIGTERM 转为该行为。异常结束后先查端口和所属进程，不能因 CLI 已退出就认定 Vite 已停止；原因与实测见[浏览器冒烟说明](solana-browser-smoke.md#一条命令执行并保存独立报告)。

以上经验来自 2026-10-24 的[本地 RPC 代理验收记录](agent-acceptance-infrastructure.md)；具体事实与验证边界保留在主题文档，本节维护影响后续执行顺序的通用步骤。

## 查阅入口

| 工作 | 必读资料 |
| --- | --- |
| 前端及 SDK 开发 | [gmx-interface-dev](../gmx-prompts/skills/gmx-interface-dev/SKILL.md)、[项目概览](../gmx-prompts/docs/gmx-interface/main.md)、[编码规范](../gmx-prompts/docs/gmx-interface/code-guidelines.md)、[UI 风格](../gmx-prompts/docs/gmx-interface/style-guidlines.md) |
| 前端及 SDK 自审 | [gmx-interface-review](../gmx-prompts/skills/gmx-interface-review/SKILL.md)、[审查标准与实例](../gmx-prompts/skills/gmx-interface-review/references/review-rules.md) |
| Solana 集成 | [gmx-solana](../gmx-prompts/skills/gmx-solana/SKILL.md)，结合开发、自审规范及 ADR-0015 |
| 测试编写及审查 | [测试准入标准](../gmx-prompts/docs/testing.md)、[gmx-tests](../gmx-prompts/skills/gmx-tests/SKILL.md) |
| API 审查 | [gmx-api-review](../gmx-prompts/skills/gmx-api-review/SKILL.md) 及其引用细则 |
| 大型或高风险改动交接 | [审查导航](../gmx-prompts/skills/gmx-interface-review/references/reviewer-map.md) |
| SDK/API 兼容性及发布顺序 | [交付流程](../gmx-prompts/docs/onboarding/release-process.md) |

## 编码重点

- 遵守 `sdk → config → lib → domain → components → pages` 单向依赖及绝对导入。SDK 不依赖 React 或浏览器 API；业务计算和交易逻辑放在 domain/SDK，组件负责展示和交互。
- 复用既有组件、工具和状态模式。遵循类型、显式 `undefined`、对象参数、Storage、错误处理和定时器等原文约定，避免重复实现、无效断言、魔法值、无用注释及无关格式改动。
- 金额运算保留 BigInt 和正确精度，核对舍入方向及分母为零的情况；不要先转 Number 再计算。错误使用现有 `lib/errors` 体系，用户可见文案使用 Lingui。
- Solana 网络代码放在 `lib/solana`，协议代码放在 `domain/gmsol`，静态配置放在 `config/gmsol`；遵守动态加载和导入边界。不得复制 UI、把 Solana 代币注册进 SDK 的 EVM 列表，或将 20 位精度直接传入共享逻辑。
- `solanaNetwork` 关闭时不加载或执行 Solana 功能；发送交易前重新检查 `solanaTrading`。地址保留 base58 大小写，区分原生 SOL 与 WSOL。数据、价格、钱包所有者和 RPC 的来源按 Solana 原文约定。

## 自审方法

1. 确定真实 diff、比较基线及风险等级（T0–T3），阅读调用方和上下文，不只看修改片段；不把配置改动自动视为无风险。
2. 优先检查正确性、安全、资金及真实行为，再检查符合项目规范的代码质量。涉及资金、签名或认证时补充安全检查。
3. 对 T2 及以上的 React 状态、Hook、Effect 改动单独检查生命周期：成功、失败、超时、拒绝、卸载；确保状态复位，失败处理只影响对应项。
4. 对 T3、大型或高风险 diff 分别扫描全部除法、交易及授权步骤、守卫及分支覆盖、值的语义（单位、精度、地址大小写、新鲜度、原生与包装资产等）。可以逐项顺序审查，不假定存在通用审查工具。
5. 涉及集成边界时，核对对应 API、SDK、程序、IDL 和索引 schema，并区分仓库源码与真实部署。适用时只读核对所有受影响网络的端点；无法验证则明确保留验证缺口，不把源码存在当成已部署。
6. 对每个疑似问题尝试反证，追踪实际可达路径和用户影响；去除误报、重复问题、纯偏好和格式噪音。报告提供位置、触发条件、后果和具体修复建议，避免宣称审查覆盖完整。

审查结论在对用户的回复中用中文；提交到 PR 的标题、正文和审查评论用英文。自审不等于获准向外部 PR 发布评论。

## 测试与本地流程边界

- 测试按行为筛选：组合或边界足够多，且涉及风险或共享契约时才随代码交付；已发生的生产问题保留针对性回归测试。避免只验证 mock 调用、实现镜像、快照和不必要测试框架。
- 优先真实配置与编解码器，mock 数据源和必要副作用；使用真实业务输入、表驱动和结果断言，清理临时测试。具体预算、例外与 mock 规则以测试规范原文为准。
- 上游开发规范要求类型检查和单元测试；按改动执行适用检查并如实说明未运行项。本地 Vite/Chrome 与当前已授权任务所需的页面验收已有长期授权；构建、部署及其他服务仍按根 `AGENTS.md` 的独立授权执行。
- 上游提到的自动 pull、分支切换、向官方仓库推送等流程不能覆盖本地授权范围；使用当前工作区实际路径，遵守个人 `my-` remote 和直接 push 约定，不在 push 时插入自审或检查。
- 上游通用的回退建议不能覆盖 Solana 特定的数据来源约束，也不能成为添加推测性兜底的理由。
