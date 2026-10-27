# Agent 测试与验收失败诊断

更新日期：2026-10-27。用于 Solana 集成开发和验收的基础设施排障，复用现有工具、日志和专题文档。遇到失败时从本页选择排查路径；业务契约或资源不明确时先协调，不通过修改业务逻辑消除环境报错。

## 先定位失败发生在哪一层

1. **保存本次事实。** 等待命令结束，记录完整命令、工作目录、目标 checkout、时间和最终退出码；读取 stdout/stderr 给出的报告和日志路径。前置参数错误可能只有 stderr JSON，没有 run 目录，这不等于报告丢失。不要按日志中的一个 `passed` 或 `FATAL` 判断整体结果。
2. **确认工具及证明范围。** 读取报告的 `mode`/`scope`（以实际存在字段为准）、`status`、`failureStage`/`code`。discovery、plan、原生测试、sample HTTP、真实只读和业务验收分别判断。退出码按对应工具文档解释，不全局套用：`agent:acceptance` 退出 2 可以是合法但不完整的工作表，`agent:preflight` 退出 2 表示所选依赖受阻。
3. **先前置与身份，再断言。** 确认参数、依赖、目标/版本和服务归属后，再检查网络、数据契约、原生断言及清理。修复一个原因后，只重跑受影响项；不在失败原因未明确时重复全量测试或构建。
4. **给出下一步。** 已执行但不符预期用 failed；缺已确认资源/权限/决策用 blocked 并暂停依赖工作；未执行用 not-run；部分验证用 partial。工作表汇总规则见[验收映射](agent-acceptance-workflow.md#状态约定)。基础设施通过不自动改变业务需求状态。

## 按错误特征排查

下表的错误码和字段用于识别当前工具的具体检查阶段；没有报告该字段时不要自行补造。错误码可能只表示前置失败总类，必须结合本次 `message` 和日志继续定位。

| 分类与可观察特征 | 先查什么、按什么顺序处理 | 继续入口与停止条件 |
| --- | --- | --- |
| **参数/路径**：`frontend-offline-prerequisite`、`sdk-offline-prerequisite`、API `offline-test-prerequisite`、预检 `configuration-or-evidence-error`；重复 suite、缺失文件、混用选择模式、非法路径 | 核对目标仓库根目录和检查项名称；前端 suite 相对前端根，SDK suite 相对 SDK 根，API suite 相对 API 根；使用真实、存在的普通文件，不传 glob；支持这些参数的发现/执行入口中，`--suite`、`--related`、`--changed-since` 三选一 | 看[启动卡](agent-task-start.md)和对应 CLI `--help`；纠正调用后重跑。目标行为不明确时先澄清，不能换成默认测试取得通过 |
| **范围/覆盖**：零关联、`related-discovery`、配置/资源/删除混入 Git 源码范围 | 先核对 `changes.baseSha`、完整变化路径及原生发现清单；确认是否缺覆盖，或依赖图无法表达动态导入/资源；前端与 SDK 各自判断 | [联合规划](agent-test-plan.md)、[前端范围](frontend-offline-tests.md#按-git-变更范围运行局部回归)、[SDK 范围](sdk-offline-tests.md#按-git-变更范围运行回归)；人工选与需求对应的 suite/页面/服务，不将零匹配当无需测试 |
| **依赖/运行时**：`Use Node 22`、缺模块、目标 Vitest/Vite 不匹配、Chrome 不可用 | 先确认当前进程 Node 版本、目标自己的 package/锁文件及已安装运行器；需要浏览器才检查 Chrome；需要数据库才检查 Docker 和本地镜像 | [执行前顺序](coding-and-self-review.md#执行前的环境检查与顺序)、[浏览器前置](solana-browser-smoke.md#先准备再执行)、[API 入口](solana-api-local.md)；缺安装/构建授权或用户资源时说明前置，不链接其他 checkout 依赖绕过身份检查 |
| **SDK 产物/生成路由**：根类型检查缺 SDK 导出、`TS2305`、SDK 来源核验失败、API 路由收据缺失/过期 | 根类型检查前先 `yarn sdk:artifacts verify`，不是看到 TS2305 就断定产物过期；API 依赖路由时按原流程只读 verify，比较输入、生成器、Node/编译器和产物 | [SDK 产物](sdk-artifacts.md)、[API 路由准备](solana-api-local.md#gmx-api-路由生成准备与过期检查)；需要生成/构建时先核对授权，成功后重跑受影响检查，不写虚假导出、类型断言或手补收据 |
| **目标身份/证据过期**：`sourceUnchanged=false`、`toolingUnchanged=false`、`changesUnchanged=false`、规划过期、交付 `*-evidence-invalid` | 比较 projectDir/apiDir/sdkDir、commit/dirty、前后源码/工具摘要、Git 范围及原生报告；确认是否误测开发目录、测试中并发编辑或使用了旧报告 | [规划执行](agent-test-plan.md#按规划执行明确范围)、[工具指纹](frontend-offline-tests.md#结束时核对工具指纹)、[交付检查](linear-development-workflow.md#交付隔离自动检查)；先稳定目标再重新规划/执行，不能手改摘要或混用其他 checkout 报告 |
| **离线网络拒绝**：`network.status` 非 passed、拒绝事件、测试捕获了连接错误但原生结果成功 | 读本次 `network.eventsFile`、discovery 网络日志及原生日志，定位真实依赖或初始化联网；区分 suite 自身、Vite/Jest 配置、setup；检查安装数和拒绝数 | [网络审计](frontend-offline-tests.md#结束时核对网络审计)、[API 网络范围](solana-api-local.md#集成测试的网络范围)；确需 RPC/数据库/浏览器则选择相应环境并记录范围，不关闭 guard 或吞异常。依赖缺资源时暂停该项 |
| **服务/真实网络**：连接失败、超时、HTTP/RPC 错误、GraphQL partial errors | 先核对实际服务地址、网络、端口及版本；对管理实例用 status 核对 checkout、PID、owned/borrowed；再查同次日志、响应错误与新鲜度。端口存活不证明上游 ready | [统一预检](agent-preflight.md)、[工作区](solana-dev-workspace.md)、[线上核验](agent-acceptance-workflow.md#线上行为与数据核验)；未知监听者不接管，错误不转零余额/空数组。缺地址、鉴权或配额等资源时协调 |
| **契约/数据语义**：sample 形状变化、contracts 返回 partial、金额单位/枚举/空状态不明确 | 核对数据模式、样例来源、契约评审状态、单位精度、网络/地址/时间和目标部署；区分本地样例与真实账户。两端结果相同不构成独立数学基准 | [样例边界](solana-dev-workspace.md)、[当前缺口](agent-acceptance-infrastructure.md#当前阶段与接手结论2026-10-27)；缺 reviewed contract 或真实样本时暂停依赖实现，不自动重生成基线、猜测兜底或接入替代数据源 |
| **原生测试失败**：Vitest/Jest/Playwright 断言失败、零断言、跳过、重试、runner errors | 读取精确 suite、原生结果和第一个实际失败断言；核对输入、时间/时区、环境和版本，确认预期后追踪调用方；不要仅看汇总计数 | [前端结果](frontend-offline-tests.md#结果版本与清理)、[SDK 结果](sdk-offline-tests.md#隔离与结果)、[API 时区](solana-api-local.md#时区前置与排障经验)；确认业务 bug 时按明确需求处理，基础设施任务不擅自改业务预期或删测试 |
| **中断/超时/清理**：`exit.interrupted`、`exit.timedOut`、`exit.cleanup` 非 passed、临时目录/容器或端口未释放 | 先等待外层命令最终退出，读本次进程组/端口/容器身份及清理字段；原生断言通过不能覆盖清理失败。超时先核对测试范围和真实依赖，不直接提高限制 | [进程清理](sdk-offline-tests.md#进程清理统一验收2026-10-27)、[浏览器停服](solana-browser-smoke.md#一条命令执行并保存独立报告)、[API 清理](solana-api-local.md#测试派生进程清理验收2026-10-27)；只处理本任务所属资源，不盲目 kill。SIGKILL/系统崩溃后先人工核实归属 |
| **工作表/证据包**：工作表不合法、结论不一致、缺原始文件或包摘要不匹配 | 先区分工作表内部一致性与业务结论；检查条件编号/引用/退出码和未覆盖项，再检查原报告、manifest 与包外预期摘要；已冻结包不写回摘要 | [工作表检查](agent-acceptance-workflow.md#工作表自动一致性检查)、[证据包](agent-evidence.md)；保留失败/受阻，缺证据就补实际执行或移交，不重写历史为 passed |
| **外部资源/授权**：远端 API 身份、权限、reviewed contract、协议样本、交易预算或签名授权缺失 | 明确缺什么、用途、责任方和用户需完成的动作；秘密只配置到文档指定的本地位置，不要求在对话中发送。启动 Vite/Chrome 的长期授权不包含其他服务、构建、签名或广播 | [根规则](../AGENTS.md)、[资源协调记录](agent-acceptance-infrastructure.md#待协调资源与-a03-验收门槛)；暂停依赖项、标 blocked，继续独立工作；不注册、采购、换源或用 mock 绕过 |

## 向后续 Agent 交接

在当前需求工作表或对应主题文档中记录：错误分类、触发命令、目标目录与版本、时间/退出码、最小错误摘要、报告/日志位置、已排除原因、当前结论、下一步及责任方。本机 `.local/acceptance/` 产物不自动共享，移交时按[证据包说明](agent-evidence.md)实际携带。

发现可复用的新环境原因时，把它提升到[执行前顺序](coding-and-self-review.md#执行前的环境检查与顺序)或相关专题入口，再补本页导航；详细操作和原始证据只维护在对应主题中。不要把未经证实的推测加入通用前置检查，也不要要求后续任务重跑所有诊断命令。
