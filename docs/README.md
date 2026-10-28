# 协作资料索引

后续 Agent 先阅读根目录 [AGENTS.md](../AGENTS.md)，再根据当前任务查阅以下资料。文档是查阅入口，易变状态仍需对照实际代码、配置及上游确认。

全栈开发与 Solana 专项验收从[Agent 任务启动卡](agent-task-start.md)选择所需命令、目标目录和验证层次，再进入专题文档。

遇到测试或验收失败时，先按[Agent 失败诊断](agent-failure-diagnosis.md)定位参数、依赖、网络、身份、断言、清理或外部资源问题，再进入对应专题排查。

| 文档 | 适用场景 |
| --- | --- |
| [Solana 独立集成实施任务表](../solana-implementation-tasks.md) | 后续 Agent 的实施入口：60 个任务、5 项已有或待复核基础，含优先级、本地状态、依赖、验收与全量 Linear 覆盖；不反写线上状态 |
| [Solana 独立集成调研依据与架构边界](solana-implementation-research.md) | 2026-10-27 全量需求、PR/版本与源码核验；统一数据流、EVM 保护、API 最新进展及待确认的契约与资源；T00/T03接缝记录、T08单位转换、T05余额reader、T09共享SWR及T06.a/b/c存储隔离与Settings/SWR审计、T07网络感知token lookup、T01.a/b钱包接线与T02.a钱包余额/TokenPermits、T02.b1共享支持聊天/EVM属性与T02.b2全局provider/effect/Settings隔离、T02.c1共享地址helper/最近上架筛选、T02.c2订单/历史与T02.c3图表/导出/市场/返佣地址消费及datafeed清理、T02.c4剩余地址消费与保证金入口、T02.d1交易能力/共享状态门槛、T02.d2路由/导航/公告隔离、T02.e1 GMX Account状态/查询隔离、T02.e2a EVM uiFlags查询/fallback隔离、T02.e2b价格/oracle tracker生命周期隔离及T02.f1真实请求审计/残余调用定位、T02.f2a multicall切网取消边界、T02.f2b1启动uiFlags预取隔离及T02.f2b3上报400/版本前置、T02.f2b2 EVM oracle请求取消/迟到fallback的实现及验收边界、T04.a市场字段表/公共API67组真实只读核验与T10版本绑定边界、T11.a复用keeper adapter/共享实时价格hook与限定验收、T11.c共享flags/原公告接线及真实请求归因（正向banner待远端key）、T11.b1共享24h请求/原消费者接线及T11.b2原DataFeed数据源/生命周期/布局隔离与限定消费验证、T12原钱包摘要/资产列表与USD接线及Mainnet捕获消费验证（真实钱包面板待验；真实图表待T13，个人markers待T34；后续数学与builder见下列专题）（其余地址消费/capability、零EVM RPC、真实钱包/最终产物待验） |
| [Agent 本地运行版本矩阵](agent-runtime-matrix.md) | 区分仓库版本声明、Agent 工具前置和本机观察；解释 Node 20/22 及 API patch 差异，记录本机 22.17.0/22.22.0 离线测试、真实 Chrome 页面冒烟实测与产物收据边界，指导独立 checkout 的版本核对 |
| [Agent 本地环境与依赖清单](agent-environment.md) | 支持实际前端/API 目标目录、关键依赖逐项问题、SDK 消费来源、SDK 产物/API 路由和本地数据库前置检查；兼容原本机清单，不将所选前置 ready 当业务就绪 |
| [Agent 基础设施当前阶段与接手结论](agent-acceptance-infrastructure.md#当前阶段与接手结论2026-10-27) | 2026-10-27 能力与验证摘要、真实环境及业务验收边界；开发与局部验收已可用，建议下一阶段用真实需求检验，避免继续无目标扩展工具 |
| [GMTrade 当前线上服务地址](gmtrade-live-services.md) | 当前正式 Web 后端 HTTP/WS、keeper GraphQL、SQD、RPC 与发布配置；线上行为/真实数据验收优先查阅 |
| [GMTrade 四页完整功能与依赖](../gmtrade-pages-dependency-audit.md) | 根目录完整六列表：Stake、GT My/Global/Buyback、Stats、Referrals 共 72 个功能/依赖分组；含当前启用分支、源码证据、线上只读核验和推进条件 |
| [GMX 当前线上服务地址](gmx-live-services.md) | 从真实线上页面请求核实各链 API、价格 keeper/fallback、SQD、Goldsky、RPC 与其他依赖，区分线上调用和发布脚本配置 |
| [Solana gmx-api 进度与联调协调](../solana-api-coordination.md)（[英文版](../solana-api-coordination.en.md)） | 待发送给负责人的沟通草稿：真实交易数据、联调节点、外部依赖及 FESOL-87 独立切片价值确认 |
| [Linear 需求开发与 PR 交付流程](linear-development-workflow.md) | 一需求一分支、开发与交付基础隔离；只读 delivery-check 核对提交来源与显式文件清单，支持独立目录、显式 HEAD/干净状态及前端、SDK、浏览器和 API 测试证据绑定（含已声明的生成路由来源复核）及 API 类型检查证据绑定；命名规范、Draft PR、自测表格及人工确认 |
| [Linear 需求查阅与复盘](linear-requirements.md) | FESOL 实时查询、全量快照、项目筛选和进度差异工具的配置、命令与验收记录 |
| [需求推荐与就绪核验](solana-next-task.md) | 综合 Linear、GitHub PR、最新上游代码和实际前置，推荐下一条迁移需求 |
| [Solana 迁移实际进度评估](solana-progress.md) | 跨仓库取证、去重与工作量估算，输出两个进度口径及中英文简述 |
| [Agent 验收基础设施当前入口](agent-acceptance-infrastructure.md) | 当前能力、限制、执行授权和 A03 资源协调门槛；旧章节保留导航，按日期的调研与验收正文另见历史归档 |
| [Agent 验收基础设施历史调研与实施记录](agent-acceptance-infrastructure-history.md) | 追溯 A01–A17 原调研、候选决策和真实验收证据；旧待授权描述仅属于原时点，不作为当前操作规则 |
| [Solana 集成 Agent 友好度推进路线](solana-agent-friendliness-roadmap.md) | Solana 集成专项的 Agent 开发、测试、验收和交付改进优先级；包含当前实施状态和备注，历史验收按需进入独立记录，不代表整个项目的通用路线 |
| [Solana 集成 Agent 友好度历史实施记录](solana-agent-friendliness-history.md) | 按需追溯路线表的历史验收、命令、结果与本机证据位置；不是日常启动入口或实时环境就绪证明 |
| [Agent 需求验收映射](agent-acceptance-workflow.md) | A07：先映射需求条件，涉及现有行为/真实数据时先核对线上基线，再选择预检与验证；工作表模板、状态汇总规则及 FESOL-55 实例；Markdown 工作表一致性检查及可选逐条件 JSON 映射，拒绝错误汇总与无效证据引用 |
| [真实 SDK/WASM 与基础数值向量](solana-sdk-vectors.md) | A11：离线执行真实固定 WASM，以独立 Python 参考值核对基础定点运算；不证明复杂业务数学或链上兼容 |
| [固定 WASM unsigned builder ABI](solana-builder-abi.md) | T20.a/b1/b2/b3：31-case真实unsigned bytes、v2参数、native/路径/错误/组合非原子、setup/callback/referrer与nonce限制；已覆盖离线样本通过，完整ABI、安全规则和主网仍待验；T23.a1/a2单订单unsigned update/cancel已适配并完成离线限定验收，create/组合、完整签名前校验及真实业务待续 |
| [Solana 签名前指令契约](solana-instruction-contract.md) | T21.a：21case/27笔/10种指令的可复现库存、精确IDL账户/参数与权限并集、LUT/资金/原子性拒绝规则；T24.a1容器/LUT、a2 update与a3 cancel账户/PDA/ATA/权限及恶意变体、b1 create/prepare严格参数解码已离线通过，完整create/组合待续；CPI事件另见下项 |
| [Solana 订单事件与生命周期契约](solana-order-events.md) | T21.b1/b2与T28.a/b：四事件契约、四真实Mainnet回执、纯TS严格decoder与离线生命周期归约（合计11项）；部署源码身份、其他真实变体/业务及生产接线待验 |
| [Solana 交易数学差异与独立参考向量](solana-trade-math-reference.md) | T17：固定v0.10.0；435组model参考值，新增48组funding清算，72次更新/144个相邻价格点；应付扣成本、两token claims不改善清算已核对，组合清算/其余矩阵及SDK/API消费待续 |
| [SDK 构建产物准备与过期检查](sdk-artifacts.md) | 根类型检查前只读 verify；显式隔离 prebuild/编译，成功后替换忽略的产物，保留来源收据与日志 |
| [前端源码离线测试](frontend-offline-tests.md) | 精确运行当前或独立 checkout 的 src/landing 原有单测，支持按真实依赖图从前端/SDK 源码或显式 Git 基线的变更范围选择前端关联测试，可只发现清单后决定执行范围；复用 Vite/happy-dom 初始化，隔离本机环境并阻止意外联网，运行器独立核对网络事件及执行前后工具指纹；单 suite 可进行源码断点调试，不启动应用服务或浏览器 |
| [全栈测试范围规划与执行](agent-test-plan.md) | 前端/SDK/API 各自 Git 基线或显式源码发现，API profile 明确选择离线/隔离数据库；保留混合变更与未分配项，按计划执行并汇总原生失败；兼容原两侧模式，汇总不作为单侧交付证据 |
| [SDK 源码离线回归](sdk-offline-tests.md) | 复用 SDK 原 Vitest 配置与目标目录测试运行器，支持独立交付 checkout 和锁文件身份，默认运行 BigInt、数值及费用原有测试；支持精确选文件、按源码依赖图或目标 Git 基线变更范围自动选择后离线执行，也可只发现清单再选择执行环境；支持环境隔离、阻止意外联网及执行前后工具指纹复核；单 suite 可启用 loopback 源码断点调试，共享进程组工具核实取消与清理，不需要 SDK 构建 |
| [Solana 统计索引只读预检](solana-index-preflight.md) | A16：核实实际 volume 索引的 GraphQL 契约、高度和最新事件年龄；不推断处理延迟或历史完整性 |
| [Solana 本地只读浏览器冒烟](solana-browser-smoke.md) | A09：`solana:browser-check` 一条命令完成预检、独立 Vite、真实 Chrome、独立报告和停服；支持独立功能 checkout 的目标 Vite 与源码/资源身份，复用网络选择/刷新持久化原有用例，保留手动运行和导航排障入口 |
| [Agent 本地 PR 预览定位](agent-preview.md) | A09/A14：复用 CI 解析器，从实时 PR head 定位成功部署的不可变 URL；不打开页面或执行 UI 测试 |
| [Agent 验收证据包](agent-evidence.md) | 默认交付归档、包外摘要、报告/工作表/显式附件；含前端/SDK/API 离线结果与真实浏览器结果的材料选择、诊断附件和接收复核，不替代业务验收或自动上传 |
| [Agent 统一只读预检](agent-preflight.md) | 按任务选择 RPC/keeper/样例 API/可选钱包检查，统一状态、退出码和本地版本证据；不自动启动服务；支持历史报告源码指纹离线比较 |
| [Solana SDK 与程序版本证据预检](solana-runtime-preflight.md) | A14：核对本地 SDK/WASM 完整性，记录 Mainnet 程序部署 slot、权限和完整程序区指纹；不构建或判断业务兼容 |
| [Solana Mainnet 交易回执证据](solana-transaction-evidence.md) | A12：显式签名查询 finalized 状态与完整回执，核对身份/结果并绑定源码与摘要；不推断 keeper 订单执行 |
| [Solana ALT 资源预检](solana-alt-preflight.md) | A05：现有 Mainnet 地址查找表的批量读取、生命周期、authority、完整地址与摘要；不创建或修改表 |
| [本地 Solana RPC 代理](../tools/solana-rpc-proxy/README.md) | 手动启动、前端与 Agent 调用、fallback key/Origin 转发、方法限制及验证边界 |
| [keeper 只读预检](keeper-preflight.md) | A02 真实价格、图表与开关预检；本地 `solanaTrading` 覆盖配置、环境边界及真实交易前置 |
| [本地 Agent 验收钱包](agent-wallet.md) | 本地 Solana CLI 优先排查链上问题的约定、网络与账户核对、Origin 代理边界；A05 Node 钱包配置、固定 EVM/Solana 地址、Mainnet SOL 及代币账户盘点 |
| [Agent Solana 全栈联调工具](solana-dev-workspace.md) | 双 checkout 启动前只读 doctor、个人开发专用 API 代理路径、API/Vite/RPC 工作区管理、一条命令运行 Chrome/可选断点验收并停服、显式 API inspector、目标身份诊断、浏览器 trace 关联及未评审样例结构回归；不新增业务消费、不随业务 PR 交付 |
| [本地 Solana API 样例验收服务](solana-api-local.md) | A08 当前操作入口：按任务定位样例 HTTP、持续服务、源码断点、关联测试发现、离线回归、路由准备、API 类型与隔离 PostgreSQL 测试；保留独立 checkout、网络/源码身份及清理要求，历史执行结果另见归档 |
| [本地 Solana API 基础设施历史验收记录](solana-api-local-history.md) | 追溯 API 工具历次实际执行、失败演练及本机产物；保留原日期与证明边界，不作为当前环境就绪证明 |
| [Solana 迁移参考仓库](solana-reference-repositories.md) | 查找仓库用途、协议与 SDK 资料、ADR-0015 分支、版本注意事项和 remote 规则 |
| [旧 Solana 后端参考说明](gmtrade-web-backend-reference.md) | 旧后端源码快照的数据流、接口和缺失依赖；当前线上地址另见独立服务文档 |
| [文档维护约定](documentation-maintenance.md) | 主动沉淀协作知识，把环境排障经验提升为执行前置，维护索引及接手资料；`agent:docs-check` 显式检查本地文档路径/锚点并输出行号诊断 |
| [编码与自审规范](coding-and-self-review.md) | 执行前核对检查范围、SDK 产物及构建内存；按任务查阅 gmx-prompts，执行编码、自审和跨仓库核验 |
| [自动化工具沉淀约定](automation-tools.md) | `yarn test:agent-tools` 统一离线回归；识别重复任务，复用和实现脚本、检查器等工具，记录验证结果和使用入口 |

## 项目 skill

项目 skill 提供按需执行入口，详细规则、证据和限制仍以主题文档为来源。可直接用名称调用，也可由 Agent 按请求匹配；仅说 `push` 不触发交付流程。

| Skill | 适用场景 | 详细资料 |
| --- | --- | --- |
| [gmx-linear-requirements](../.agents/skills/gmx-linear-requirements/SKILL.md) | 查询 FESOL、同步快照、复盘迁移进度，核对 GMTrade 标签 | [工具说明](linear-requirements.md) |
| [gmx-solana-next-task](../.agents/skills/gmx-solana-next-task/SKILL.md) | 核验需求、PR 和代码，比较并推荐下一条迁移需求 | [推荐流程](solana-next-task.md) |
| [gmx-solana-progress](../.agents/skills/gmx-solana-progress/SKILL.md) | 核验跨仓库实际成果，估算需求范围及完整迁移进度，输出中英文简述 | [评估方法](solana-progress.md) |
| [gmx-solana-task-delivery](../.agents/skills/gmx-solana-task-delivery/SKILL.md) | 按授权阶段开发需求、隔离交付改动、创建及审查 Draft PR | [交付流程](linear-development-workflow.md) |

Skill 放在仓库 `.agents/skills/` 中，属于个人开发基础，不进入业务 PR。首次真实交付后补充流程验收经验，不能把 skill 格式校验当成完整交付验收。若当前会话未显示新 skill，可在后续会话检查发现状态，必要时重新启动 Codex；入口文件仍可直接查阅。

新增主题文档时更新本表。优先查找并更新已有主题，避免为同一结论创建多份说明。
