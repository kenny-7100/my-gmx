# Unification 前端 refining 优先级 — 2026-11-24

后继评估：[2026-11-27 实施候选](solana-readiness-2026-11-27.md)。Net Rate已有前端PR，Pools/Swap/收发已有负责人；本页保留11月24日历史依据，当前选择以新报告为准。

知识库归属：本仓库 `docs/` 的 Unification 需求评估。事实核验日期：2026-11-24；本次整理沿用该轮证据，没有重新查询线上状态。持续跟踪及再次排序的固定入口见[需求推荐与就绪核验](solana-next-task.md#unification-持续跟踪与重复评估)。本文保存本轮完整表格、说明及证据，作为下一轮比较的基线。

本轮建议先 refining **TRD-91 Net Rate → TRD-92 钱包剩余范围 → TRD-110 Swap**。随后是客服、个人历史、Claims、Pools；TradFi 提前协调关键外部条件，但不把其后端工作列为前端候选。按用户与 Chloe 的讨论，Referrals、GT/Stake、Earn 放在正式 UI 代码合入后推进实现的后续批次。

## 本轮阶段收尾与四条需求接续

用户已确认本轮调研/沟通准备暂时完成，不代表业务实现完成或各需求已验收。以下沿用 2026-11-24 已核验证据与最终讨论，没有为收尾再次刷新线上状态；初始排序不因本表而重新计算。

| 需求与记录 | 阶段结论 | 下次讨论/恢复的入口 |
| --- | --- | --- |
| [TRD-91](issues/TRD-91.md) Net Rate | Rainer 推进中，GMX 正式 rates 可用，可实施；无需旧 SQD | 对齐实际开发分支、network SDK/cache 接线；确认不足完整7/30天的展示和验收 |
| [TRD-92](issues/TRD-92.md) 钱包与收发 | Sulliven 负责，现有外部钱包基础可继续完善；Receive/Send 可实施 | 扣除已有连接/资产成果，落实收发、费用校验和状态反馈；embedded 已拆 [TRD-210](https://linear.app/gmx-io/issue/TRD-210)，不再并入本单验收 |
| [TRD-110](issues/TRD-110.md) Swap | Refining/未分配，可开始；固定 WASM 与真实数据证据不等于链上执行验收 | 补报价→构造→校验→提交→执行反馈；三池覆盖在 GMX 正式链路协调，禁用池保留运行限制 |
| [TRD-151](issues/TRD-151.md) 客服 | Refining/未分配，独立前端可做；完整统计前置未闭合 | 明确 GMX 正式总量/30d数据契约与交付归属，Tier 同步处理；结合 #3337 与真实 Intercom 验收，不接旧 SQD/后端 |

TRD-91、TRD-110、TRD-151 已按用户分别授权评论 Linear，发布记录及 ID 在各 issue 文档；TRD-92 已按授权拆分并与 TRD-210 关联。四条链接和中英文简短情况、供团队“明天讨论”的通知已起草；未向团队发送、未创建会议，不把相对日期固化为日历安排。未认领新需求或开始业务实现。

后续先从本节和对应 issue 当前摘要接续，按变化刷新 Linear/PR/代码/服务；需要完整重新排序时走[持续评估入口](solana-next-task.md#unification-持续跟踪与重复评估)。本轮可复用的就绪判断和协作方法已分别回到该入口及[协作说明](agent-collaboration.md#cycle-收尾与后续-refining)，不另建重复报告。

这是准备下一批需求的排序，不是认领、开发排期或发布承诺。可实施性优先、重要性其次；判断包含整条需求的真实缺口，不能只取一个按钮、只读页或 wrap 小切片便宣称完整需求就绪。首选也不意味着所有验收条件已经满足。

## 排除 GMTrade SQD/后端后的复核（2026-11-24）

用户现已明确排除 GMTrade SQD 和后端；不再把“旧服务是否可接受”留作实施选项。沿原固定版本补读正式 API 的 `gmsolConfig`、`marketSnapshot`、`indexWorker/indexStore`、`rateHistory` 及前端资产链路；复用本轮已有远端/生产观察，不声称重新刷新 Linear 或重测所有需求。前三项为实际代码路径复核；其余依据原调查和本次定向源码检索做来源重分类，不代表逐项完成替代数据方案或新一轮全量排名。

| 需求 | 在新边界下的判断 | 需修正或继续核实的事项 |
| --- | --- | --- |
| TRD-91 Net Rate | 原可实施判断成立 | gmx-api 从 RPC/GMX oracle keeper 构造 snapshot，自行采样入 solanaRates；没有旧 SQD/后端查询前置。历史不足仍如实保留，不通过旧服务补洞 |
| TRD-92 外部钱包/收发 | 原可实施判断成立 | session、RPC 与 GMX 价格源足够；不复制旧站资产聚合路径。TRD-210 的 Privy 配置另核，不属于旧业务后端 |
| TRD-110 Swap | 原可开始实施判断成立 | 正式 markets/orders 链路为 RPC+GMX 价格，固定 SDK/链上状态跟踪可用；三池覆盖在 GMX 正式链路收口，不以旧 keeper/SQD 补齐。协议 keeper 正常执行不等于前端依赖旧查询服务 |
| TRD-151 客服 | **完整就绪结论需撤回** | 总量/30d/Tier 的旧 SQD 方案不可采用；需正式 GMX 用户统计来源。聊天、钱包、资产及错误适配仍可先做 |
| TRD-89 个人历史 | 数据前置需重新建立 | 旧 SQD 事件/schema 仅作参考，不能计为 GMX 历史服务已就绪；需正式历史索引、分页/生命周期/费用口径 |
| TRD-90 Claims | 原“旧返还索引改善前置”的说法不能用于 GMX 就绪度 | 旧 SQD #44 的 claimable/来源/历史不可直接消费；需 GMX 正式可领取状态/授权/来源数据与链上动作契约。资金费结算和返还分开，不能把领取全部都称为 SQD 依赖 |
| TRD-116 Pools | 收益/历史等数据范围需重核 | 旧 poolsSquidOverview 不可直接迁入；当前账户/存取动作可按 RPC/SDK 探路，APY/performance、GLV/质押持仓和历史须逐字段找 GMX 来源 |
| TRD-114 Referrals | 链上动作与历史统计分别判断 | 绑定/创建仍可沿协议；历史 savings/rewards/受邀用户等需正式来源，不能用旧 SQD/后端充当现成输入 |
| TRD-113 GT/Stake | 动作与历史/汇总分别判断 | RPC 质押/领取/解押等可独立分析；GT 历史、回购曲线和汇总的旧服务需要正式替代 |
| TRD-115 Earn | 统一收益数据前置更明确 | 旧站 useUserEarnings 等读取旧 SQD，不能只等 UI 合并就接线；需 GMX 正式 LP/GT 持仓与收益契约 |
| TRD-69/TRD-117 | 原“先补来源/契约”结论保留 | 上市日期和 TradFi 价格/闭市等仍待确认；旧服务中的字段存在不能证明 GMX 已供应，不据此扩大成全部阻塞 |

现阶段仍优先推进 TRD-91/TRD-92/TRD-110 的 refining；TRD-151 不再视为下一条完整低阻塞前端候选，应先协调正式统计数据。后续数据型需求先做来源/字段/归属矩阵，再比较实施顺序。UI 合入只解决页面基础，不消除数据依赖；保留 Chloe 对 Earn/Referrals/GT 的后移倾向。本轮未形成新的全量排序，不以此表伪装最新线上状态。

判定依赖须追到真实源头：gmx-api 代理旧服务不会消除依赖；但某独立 protocolStats/pairs 模块仍读旧服务，也不能推断 rates/markets/orders 全部读旧服务。正式接口、链上数据、协议 SDK 和共享第三方服务分别按真实调用判断。未授权更改 Linear 评论/需求；原已发布 TRD-91/TRD-110 评论暂不修改，当前未发现这两项因本约束必须撤回。

## 范围、来源和版本

- 已实时查询 Trading 非归档需求 190 条、Unification 项目需求 83 条，两者分页均已结束；阅读目标正文、候选评论和关系。项目有 13 条 Backlog：其中 DES-65 是设计依赖，TRD-118 为 Divhead 工作，剩余 11 条前端/混合需求；另加入 Refining 的 TRD-151，共 12 条排序。TRD-117 只评前端范围，不能因创建者是 Divhead 就把整个前端需求排除。
- 只读调查 `gmx-interface`、旧 `gmx-solana-interface`，并沿需要核验 `gmx-api`、gmsol SDK/协议及 `gmtrade-sqd`。不将旧 GMTrade 标签任务、EVM Contracts 项目或 UI 的 Stats 页面计入前端迁移候选；相关成果只作依赖证据。统计页已取消，见 TRD-101。
- 产品协作依据为用户提供并已沉淀的 [Chloe/UI 协作结论](agent-collaboration.md#unification-的-ui-与前端协作)。本轮复用这些结论，不声称重新看到了原聊天截图。
- 对远端固定 SHA 下载只读源码，保留本地开发现场；未更新子仓库 checkout/gitlink。在线 PR 查询、源码阅读及生产 rates GET 是本轮验证；未执行构建、业务测试、浏览器、签名、广播或服务部署，也未完整 review 所有依赖 PR。

| 来源 | 本轮核对版本 | 用途 |
| --- | --- | --- |
| `gmx-io/gmx-interface` release | `993474e4377b75f919e587bc4f30e6adc24cecd1` | 当前正式共享前端；不能用个人基础代替 |
| `gmsol-labs/gmx-solana-interface` main | `0e863b8dae7e1d9bef2cf28efe168b16c0992d20` | 旧页面、规则、查询和指令参考；本地与远端一致 |
| `gmx-io/gmx-api` main | `f1a271e102b554200945ed4b1a88064b216c2c08` | 当前 Solana API 源码；本地 checkout 较旧，使用远端归档 |
| `gmsol-labs/gmtrade-sqd` main | `6b08d4b96028415268b3f00214ce377e4ae37d27` | 最新历史/返还索引源码；本地 checkout 较旧，使用远端归档 |
| `gmsol-labs/gmx-solana` main | `3e0a4115ad975e972601f5e7a24f60a7ba52439b` | 协议与 JS/WASM 源码参考；不是所有消费者的包版本 |
| 当前交易集成 PR [#3337](https://github.com/gmx-io/gmx-interface/pull/3337) | `be9ca46ecba8031467bc13a7a771e1368d7aeccd` | OPEN / release / REVIEW_REQUIRED，无正式 review；查询时最新 CI 仍运行 |

交易集成 #3337 合并了原 #3315/#3316/#3317/#3293 的工作，原 PR 已关闭；保证进一步讨论接在现有交付线上。PR 正文报告了部分真实交易测试，并明确剩余验收；本文不把正文自述扩为全面验收。保证金操作仍在 Sulliven 的 [#3335](https://github.com/gmx-io/gmx-interface/pull/3335)，head `371253f08ddfe30ca66609412ebd83f616ceddb0`，OPEN / REVIEW_REQUIRED，查询只看到两项 Cloudflare 成功检查。上述能力未合入不自动阻断 refining 或按授权集成开发，但影响独立交付和最终验收。

## 完整排序

以下保留首轮排序与当时状态快照；TRD-91 后续转 In Progress，TRD-110 转 Refining，TRD-92 已拆 embedded，TRD-151 与数据型需求受最新旧服务排除边界修正。当前接续以顶部两节及对应 issue 为准，不将本表的旧状态/范围当作实时结论。“可收敛”表示能产出明确范围、接口和验收方案；“先补契约”表示还不能把整条直接交给开发。所有编号链接均为当前 Linear 需求。

| 排名 | 需求 / 当前状态与负责人 | 用户最终得到什么 | 现在的 refining 入口及相对理由 |
| --- | --- | --- | --- |
| 1 | [TRD-91](https://linear.app/gmx-io/issue/TRD-91) Net Rate；Backlog / Rainer | 在同一张图查看 Solana 多空资金费、借贷费和净费率 | **最接近收敛。** API 已合并且生产有真实历史；前端网络路由缺口可定位。先和 Rainer 对齐剩余范围，确认历史不足的验收口径。优先于钱包是因为只读、复用路径短、无新增签名动作。 |
| 2 | [TRD-92](https://linear.app/gmx-io/issue/TRD-92) 钱包与转账；Backlog / Sulliven | 连接/恢复钱包、查看资产、接收和发送 SOL/SPL，支持 embedded wallet | **可收敛但必须拆清剩余工作。** 连接和余额已有，不重做；Receive/Send 和 Solana embedded 并未完成。转账可以使用 RPC，与历史索引依赖较少；embedded 的 Privy 配置/签名适配单列验证。 |
| 3 | [TRD-110](https://linear.app/gmx-io/issue/TRD-110) Swap；Backlog / 未分配 | 换币，及在生产入口转换 SOL/WSOL | **可做完整技术方案。** 共享报价已有 gmsol 分支，旧站有真实 Swap/wrap/unwrap；但当前订单 sender 明确拒绝 swap routes，不能只接按钮。比钱包多路由、费用、执行生命周期，故靠后。 |
| 4 | [TRD-151](https://linear.app/gmx-io/issue/TRD-151) 客服；Refining / 未分配 | Solana 钱包可用客服，客服知道用户交易和错误上下文 | **独立前端可实施；完整数据前置待明确。** 用户重申不引入 GMTrade 后端，旧站 SQD 可用不证明它已获 GMX 正式接入认可；须确认认可的总量/30d 来源，Tier 同样受影响。完整验收另需 #3337 与真实 Intercom。 |
| 5 | [TRD-89](https://linear.app/gmx-io/issue/TRD-89) 个人 Trades 历史；Backlog / 未分配 | 查订单、成交、调保证金、清算，过滤/分页/导出并追踪一次仓位的全过程 | **先补事件与数据契约。** 重要、能帮助交易后核对；索引已有较丰富事件，但 GMX 完整历史模型尚未接上，PnL、折扣、生命周期不能照搬。较客服涉及更广的历史数据对齐。 |
| 6 | [TRD-90](https://linear.app/gmx-io/issue/TRD-90) Claims；Backlog / 未分配 | 看资金费结算与价格冲击返还，领取真正可领取的金额 | **先确认执行与部署契约。** SQD 返还支持已合并，较旧调查更成熟；但 Keeper PR 不可读、统一服务未证明就绪，资金费与返还是两条经济路径。涉及资产领取，不能凭时间或状态猜。 |
| 7 | [TRD-116](https://linear.app/gmx-io/issue/TRD-116) Pools；Backlog / 未分配 | 浏览 GM/GLV 池、看详情、存入和取出流动性 | **先拆读数据/预览/GM/GLV 交易。** 无需等新 UI；已有组件、协议能力、旧站参考，但收益/持仓/GLV 数据与交易接入面大，整体就绪度低于前六项。它是 Earn 的重要数据基础。 |
| 8 | [TRD-69](https://linear.app/gmx-io/issue/TRD-69) 上市日期；Backlog / 未分配 | 正确标记 New，使用 Recently Listed 筛选 | **小型产品/数据确认。** 正文本来就以确认语义和来源为交付；可顺手协调，但可信来源仍缺，且现有隐藏/不标记方案有效、明确不阻塞发布。不因为小就挤占主要 frontend refining。 |
| 9 | [TRD-117](https://linear.app/gmx-io/issue/TRD-117) TradFi 前端；Backlog / 未分配 | 交易股票、外汇和商品，并正确处理休市和盘外风险 | **高重要性、低当前可实施性。** 27 个市场、价格源、闭市规则、静态映射及域名条款跨多个角色；不把后端/keeper 工作转给前端。应提前协调，但可直接交开发的前端范围尚未证明。 |
| 10 | [TRD-114](https://linear.app/gmx-io/issue/TRD-114) Referrals；Backlog / 未分配 | 绑定/创建/分享推荐码，查优惠、奖励和受邀用户 | **UI 合入后的第一候选。** 旧站已有链上绑定/创建，业务边界较 GT/Stake 窄；完整历史优惠和旧链接归属仍需核实。按 Chloe 倾向整体后移。 |
| 11 | [TRD-113](https://linear.app/gmx-io/issue/TRD-113) GT / Stake；Backlog / 未分配 | 查 GT/VIP/回购，出售 GT、回收租金，质押/领取/解押 GM/GLV | **UI 合入后拆多条动作链。** 旧站真实能力丰富，仍需新框架数据、多个 program/token 类型、批量操作与历史接入；多模块不能用一个空 Hook 的接线任务概括。 |
| 12 | [TRD-115](https://linear.app/gmx-io/issue/TRD-115) Earn；Backlog / 未分配 | 汇总 GM/GLV 持仓、LP 收益和 GT 回购收益 | **UI 合入后、数据定义稳定再推进。** 本身交易动作少，但依赖池收益、已质押/未质押持仓及 GT 汇总的一致口径，缺口更多在数据而非布局；过早接数据容易重复计算和返工。 |

10–12 的顺序是当前证据下的次级判断：Referrals 的历史数据若迟迟不能供应，而 Stake/RPC 能力先完成验证，GT 可以先于它；Earn 若先有稳定统一数据，也可以提前。用户要求的是适当后移，不是永久冻结三项，更不是强制所有功能等 UI 合并。

## 1. TRD-91：先收口网络路由与历史验收

**代码已具备：** release 的 `src/components/NetRateChart/NetRateChart.tsx` 及 `useRateSnapshots.ts` 已提供 1d/7d/30d、资金/借贷/净费率、小时至年化投影及 loading/error。SDK `fetchRates → sdk/src/utils/rates/api.ts` 调 `/v1/rates`；地址工具已对 base58 精确比较，不应重复修一个已解决的大小写问题。API [#341](https://github.com/gmx-io/gmx-api/pull/341) 11 月 19 日合并，测试检查成功；`domain/gmsol/rates/rateHistory.ts` 按小时持久化，用共享费用函数输出 30 位 factor，net=funding−borrowing，无历史回填、缺口保留。

**真实缺口：** `useRateSnapshots` 用 `selectChainId` 选 SDK；`GmsolSyntheticsStateProvider` 的 `globals.chainId` 保留 EVM chainId，而 Solana API 使用 `SOLANA_NETWORK_ID` 的 SDK。主页面展示了 Solana 市场，不代表这个 Hook 自动走 Solana host。应在这个消费者按实际 network 选择 SDK/cache，保留共享状态既有语义，避免全局替换 chainId。图还需证明历史 per-second factor 与 live hourly rate 的投影一致，缺口不伪造连续数据。

**生产只读证据：** `https://solana.gmxapi.io/v1/rates?period=1d|7d|30d` 均 HTTP 200，均返回 67 个市场；抽查一个市场分别 25/126/126 点。另按 SOL/USDC 市场 `6UU9sF5fryafHDYPcmVcV7ucfnYs6iMVcvb8p7SBQgTc` 精确请求 `period=30d&address=...`，126 点，UTC 11 月 19 日 09:00 至 24 日 14:00，样本间隔均 1 小时。这只证明这些查询和样本覆盖，不证明全部市场完整 30 天或没有其他缺口。

**本轮 refining 应产出：** 与 Rainer 对齐接线归属；网络/钱包切换和 cache 键；精度/符号/投影样本；7d/30d 暂时不足历史的明确显示和验收决定。接口已可用，但“与 GMX 同范围历史”当前不能按完整 30 天验收通过。若产品必须先补满历史且不接受如实展示，首选只保留为前端准备项，开发排期让位给钱包。

证据：[release Hook](https://github.com/gmx-io/gmx-interface/blob/993474e4377b75f919e587bc4f30e6adc24cecd1/src/domain/synthetics/markets/useRateSnapshots.ts)、[Solana provider](https://github.com/gmx-io/gmx-interface/blob/993474e4377b75f919e587bc4f30e6adc24cecd1/src/domain/gmsol/GmsolSyntheticsStateProvider.tsx)、[API 历史实现](https://github.com/gmx-io/gmx-api/blob/f1a271e102b554200945ed4b1a88064b216c2c08/src/domain/gmsol/rates/rateHistory.ts)。Rainer 的 Price/Depth [#3223](https://github.com/gmx-io/gmx-interface/pull/3223) 仍 OPEN（head `db43a011192fa9cbe40d813407f7617cdbfa6b7a`，检查成功、review COMMENTED/REVIEW_REQUIRED）；其 chart trade markers 不等于 TRD-89 个人完整历史，也不使 Net Rate 自动完成。review 中性能与开发曲线问题有后续修复回复，本轮未做完整复审。

## 2. TRD-92：以剩余能力矩阵开始，不重做钱包基础

release 已有 Privy Solana external connectors、session/恢复、`SolanaWalletAssetsContext`、地址/浏览器/资产列表及 Solana wallet-only modal；余额和价格错误有独立状态。TRD-97/98 的已有工作是前置，不能因总任务 Backlog 而按“钱包还没做”估算。

`src/lib/wallets/WalletProvider.tsx` 当前 `embeddedWallets` 只配置 `ethereum.createOnLogin`，不是 Solana embedded 已通。`MainView` 对 Solana 隐藏 Receive/Send 按钮；`GmxAccountModal` 本身没有仅限 main view 的硬限制，但 Receive/Send 视图仍走 EVM 来源/交易，Receive 路由需绕过 EVM funding-options，Send 需 Solana 实现。现成接收地址不等于带 QR、网络识别和确认刷新的一整条 Receive。

refining 分成连接/恢复回归、Receive、SOL/SPL Send、Solana embedded 四组，逐项标“已有/待做/待配置验证”；不擅自从原需求删除 embedded。发送需明确支持 mint/token program、收款 ATA 创建与租金、保留 SOL 支付网络费、Max、签名所用当前钱包、拒签/失败/未知结果、关闭 modal 后 pending 跟踪。构建还 stub `@solana-program/system`，不能仅因库安装便假设可以直接 import 原生转账 API。优先复用现有 session、RPC 与反馈，不能把订单专用 sender 当通用转账 sender。

下一次动作是和现负责人 Sulliven 对齐剩余交付，不是 Kenny 重开一份同范围实现。Privy app 配置与真实 embedded signing 未验证；这是特定子范围的验证项，不自动阻断外部钱包 Receive/Send 方案。

证据：[WalletProvider](https://github.com/gmx-io/gmx-interface/blob/993474e4377b75f919e587bc4f30e6adc24cecd1/src/lib/wallets/WalletProvider.tsx)、[MainView](https://github.com/gmx-io/gmx-interface/blob/993474e4377b75f919e587bc4f30e6adc24cecd1/src/components/GmxAccountModal/MainView.tsx)、[Vite 配置](https://github.com/gmx-io/gmx-interface/blob/993474e4377b75f919e587bc4f30e6adc24cecd1/vite.config.ts)。

## 3. TRD-110：报价基础已有，普通 Swap 和 wrap 是不同执行路径

共享 SDK `utils/swap/swapStats.ts` 已按 `tradeMath === "gmsol"` 采用 native midpoint/rounding，`utils/gmsol/README.md` 明确计算边界；不能判成“只有 EVM math”。旧站 `useTriggerCreateSwapMarketOrder.ts` 真实调用 `invokeCreateSwapOrder`，传 swapPath、输入/输出 token 及 wrap/unwrap 选项。协议 SDK 有 `MarketGraph`、best swap path 和订单模拟，也不是协议尚无 Swap。

但 #3337 的支持契约明确拒绝 swap routes，TradeBox 的 `buildTradeboxOrderAction` 也拒绝非 noSwap 策略；已支持下单前 SOL wrapping，不代表支持任意 Swap 或生产入口独立转换。旧站 wrap 用 transfer+SyncNative，unwrap 用关闭 WSOL ATA，故“WSOL 仅换 SOL、Max、Unwrap all”有真实机制依据；不能无条件沿用旧站对 ATA 已存在的假设。

refining 输出 token/路径范围、market/limit 支持边界、报价到 SDK 指令的字段/精度、execution fee/rent/network fee、签名校验的合法指令集合、提交到执行和余额刷新矩阵。单列 wrap/unwrap，明确 ATA/租金/SOL 保留额，隐藏模拟细节和 TWAP；它可成为独立交付切片，但整条 TRD-110 仍包括普通换币，不以 wrap 完成代替。

证据：[共享 swap math](https://github.com/gmx-io/gmx-interface/blob/993474e4377b75f919e587bc4f30e6adc24cecd1/sdk/src/utils/swap/swapStats.ts)、[#3337 sender 支持契约](https://github.com/gmx-io/gmx-interface/blob/be9ca46ecba8031467bc13a7a771e1368d7aeccd/src/domain/gmsol/transactions/README.md)、[旧站 Swap](https://github.com/gmsol-labs/gmx-solana-interface/blob/0e863b8dae7e1d9bef2cf28efe168b16c0992d20/app/src/hooks/triggerHooks/useTriggerCreateSwapMarketOrder.ts)、[旧站 unwrap](https://github.com/gmsol-labs/gmx-solana-interface/blob/0e863b8dae7e1d9bef2cf28efe168b16c0992d20/app/src/hooks/initializeHooks/useUnwrapNativeToken.ts)。

## 4. TRD-151：按完整客服能力收口

**最新边界修正：** 用户明确排除 GMTrade SQD 和后端，不再将旧 SQD 作为候选路径。下述 SQD 观察仅作数据口径参考；gmx-api 已引用它不消除旧服务依赖。完整实施需落实 GMX 正式的用户总量/30d 数据能力，Tier 间接受影响。独立前端可先做，完整范围就绪判断以 [最新 issue 记录](issues/TRD-151.md) 为准。

范围与过去“只恢复入口”推荐不同，见[当前 issue 记录](issues/TRD-151.md)。release 的 `useShowSupportChat` 仍隐藏 Solana，`useSupportChat` 的指标组件仅 EVM 挂载。旧站已用同一 Intercom app，并有钱包、总量、30d、资产和 Tier；本轮核对其 `useUserTotalVolume` 查询 `users.volume`，30d 对 `volumeRecords` 做时间窗口/分页。总量/30d 是真实来源线索，不能因 gmx-api 没有对应 controller 就宣称数据不存在，也不能运行时照搬旧站服务。

共享前端已有独立 Solana asset totalUsd；旧 GMTrade Tier 使用 30d/总量/钱包资产任一超过相应阈值分层，GMX 也已有近似共享 Tier 函数，但含 GMX Account 维度，Solana 不应误读 EVM 指标。refining 明确可接受的统一查询入口、20→30 位精度、索引不可用语义、Tier 规则、钱包切换清理及 Intercom 测试环境。

错误入口要接 #3337 的真实状态链：捕获失败时上下文、去重、排除拒签，未知广播结果不算确定失败；不能只接任意 catch。跨域旧站聊天身份迁移是另一个问题，不能顺带承诺。

**本条深挖更新（不重排全表）：** 生产 SQD 已实测 owner 总量、30d 时间窗口/游标和状态高度可读；小样本 13 条 volumeRecords 总和与 users.volume 一致。gmx-api 当前 protocolStats 配置已引用相同 SQD，不能认定只能依赖旧站后台，也不能因暂无 owner-volume API 就要求 Divhead 先提供接口。实际旧站口径包括合约、swap 和 LP 存取；接入时保留口径、20→30 位精度与未知值语义。共享前端查询适配属于可独立实施的工作；强制 API 中转尚未核实为架构要求，不凭空列为硬阻塞。可开工，完整验收需结合仍 open/unmerged 的 #3337 `be9ca46ecb`（专用通知尚无客服接入）及真实 Intercom。后台权限未验证不等于缺失；若既有测试环境可用，前端验证不列外部依赖。详见 [TRD-151 深挖](issues/TRD-151.md#当前深挖结论2026-11-24)。

## 5. TRD-89：先拿事件覆盖表和真实样例

release `useTradeHistory.ts` 用共享 Subsquid `tradeActions`，包含 eventName、lifecycle、basePnl、fee、impact、discount、hash；旧站 `useTradeHistoryData.ts` 是 `tradeEvents + orderRemoveds` 适配，不等于覆盖 GMX 全部事件，其部分错误还返回空数组，不能复制这种不可用语义。

最新 SQD `schema_store.graphql` 已有 TradeEvent 的 before/after、tradeId、position、PnL、priceImpactDiff、funding 等，也有 OrderUpdated/UpdateOrder/UpdateOrderV2/Liquidate。**索引有原始事件，与已存在能被共享 UI 消费的完整历史 API 是两件事。** 当前 gmx-api Solana controller 集中在 markets/positions/orders/rates/fee-discount，尚未核实满足个人历史的统一契约。

refining 产出每种 GMX 事件→来源→唯一 ID/时间/hash→价格/费用/PnL 字段矩阵，准备开仓、减仓、调保证金、取消/修改、清算和再次开同向仓位样本。确认 position 生命周期如何从真实历史构造；不得按 market+direction 合并两次仓位。GT VIP 折扣进费用，GT mint/reward 不进 Trades/tooltips。DES-65 的市场 Trades/VOB 展示决策与个人历史是不同 surface；未定市场面板不等于个人历史全部不能分析，个人历史也不能被面板调整删掉。

证据：[共享历史字段](https://github.com/gmx-io/gmx-interface/blob/993474e4377b75f919e587bc4f30e6adc24cecd1/src/domain/synthetics/tradeHistory/useTradeHistory.ts)、[原始事件 schema](https://github.com/gmsol-labs/gmtrade-sqd/blob/6b08d4b96028415268b3f00214ce377e4ae37d27/squids/core/schema_store.graphql)。

## 6. TRD-90：新返还索引改善了前置，领取契约仍需确认

TRD-170 是旧 GMTrade 标签 / Ethan CC / In Review，只作为依赖线索。其 [SQD #44](https://github.com/gmsol-labs/gmtrade-sqd/pull/44) 已于 11 月 23 日合并（head `c56ba29341be105de981ad76435991bb52d09852`，最终 APPROVED，所见 Core Rebate Checks 成功）。main 已有 `rebateBalances`、`rebateClaimSources`、`rebateClaims`，区分 accrued/claimable，支持 walletRevision、分页与 SYNCING/READY；claim sources 返回 source、mint、delegate、tokenProgram、amount 和期望余额/授权量。这比“后端什么也没有”的判断更接近事实。

但此功能默认关闭、需新库重放及完整 coverage；合并不证明生产已启用。正文和实现仍需确认估值/选市场 claim/共用 token account 的契约。关联 Keeper [#475](https://github.com/gmsol-labs/gmsol-keeper/pull/475) 本轮 GitHub 返回无法解析仓库，不能判断 merged、diff 或部署；没有绕过权限，也没有把这一缺口当作整轮调查阻塞。

资金费则由协议自动在 size/collateral 变化时结算；协议 `ops/order.rs` 还有不改变仓位领取 funding 的路径。需核对零变化 settlement 如何映射 SDK/费用/事件，不能新增强制手动步骤。Settle 和 Claim 同额同动作、同步状态，避免重复计数。返还仅针对减仓负 impact 超 cap，经过五天不等于可领取；需要真实授权/可领取状态和 claim 历史。

refining 首先形成 funding 与 rebate 两列的读取/动作/签名/费用/确认/历史矩阵，并确定新框架可消费的入口与部署验证负责人，不让前端承担未完成的后端交付。

## 7. TRD-116：没有新设计依赖，仍需真实池数据和独立交易适配

Chloe 已明确复用 GMX UI。release `pages/Pools/Pools.tsx` 仍按 chainId 查询 APY/performance，不能认为切到 Solana 就会有正确 Pools。交易页的 gmsol markets provider 主要提供 trade 数据；不能由其存在推导 LP supply/价格、GLV 组合、历史收益、已质押持仓等都已进入 Pools。

旧站 `poolsSquidOverview.ts` 查询 GM/GLV 日/小时 fees、APY/performance；SDK 则有 `simulate_deposit/withdrawal/glv_*` 与 `create_*` JS bindings。底层可参考，但必须对齐当前 app pin 的 WASM/ABI，且这些流动性指令不在 #3337 订单 sender 的已审支持集合。旧站 `execOrder.ts` 的批量签名/串行广播不应直接成为新框架执行器。

refining 建议分列表/详情与估值、GM 存取、GLV 存取及执行反馈；明确 GMX 特有能力哪些 Solana 不支持，由 Chloe 确认后再省略。列出 pool DTO、钱包/质押持仓、preview、租金/费用、订单完成与余额刷新契约。TRD-92 和不足 SOL 的 TRD-158 为相关前置；并非一定要等钱包所有 embedded 范围完成才能做外部钱包 Pools。为 Earn 预先稳定同一资产/收益口径，不另建第二套估值。

证据：[当前 Pools](https://github.com/gmx-io/gmx-interface/blob/993474e4377b75f919e587bc4f30e6adc24cecd1/src/pages/Pools/Pools.tsx)、[旧站池数据](https://github.com/gmsol-labs/gmx-solana-interface/blob/0e863b8dae7e1d9bef2cf28efe168b16c0992d20/app/src/components/Pools/Hooks/poolsSquidOverview.ts)、[协议 SDK 模拟](https://github.com/gmsol-labs/gmx-solana/blob/3e0a4115ad975e972601f5e7a24f60a7ba52439b/crates/sdk/src/js/simulation/simulator.rs)。

## 8–9. 上市日期与 TradFi：区别小型确认和重度跨侧前置

**TRD-69：** 当前静态 market config 没有可信原始上市日期，已实现未知日期不标 New、无符合市场时隐藏筛选。首先确定 pool→index token 的上市日定义、原始与新增市场日期来源、timestamp/timezone/null/覆盖和数据负责人；不能用迁移时间、部署或首根 candle 代替。它自身是契约确认需求，不必先写代码；重要性低，适合穿插推进。

**TRD-117：** release 的 `config/gmsol/markets.ts` 明确 crypto only；价格与 candle 通过 gmsolOracleUtils 的既有 keeper 映射。需要 27 个 TradFi market/mint 与真实 V8/V11 feed，不可用相同 ticker 的 Arbitrum V3 价格替代。API 底层解码已有 closed/config 的处理，但不等于正式对外 DTO、ticker/candle、前端状态和 SDK 支持已经齐全。

本轮发现 TRD-189 已 Done，属于 EVM Contracts 的 V8/V11 Data Streams provider，链接 private protocol PR #523；**这修正了“所有 V8/V11 decoder 都未做”的宽泛说法，但不能据此证明 GMX oracle keeper 已订阅/服务 Solana 的 27 个 feed。** EVM 闭市 UI/SDK PR #3339/#3336/#3309 也只能作为共享方案参考。

先列价格/历史源、market state 与参数、开市/闭市允许操作、盘外杠杆/清算风险、SPCX 24/7 例外、Forex 分类和原有状态样式、法务条款的对照表。价格/keeper/API 由相应团队确认，前端只承接展示、校验与现有交易路径适配。重要性上 Chloe 的交易后计划优先 TradFi；可实施性上当前外部缺口多，所以主列表较低。等待外部确认期间可以提前提出具体问题，不应等前八项全部完成才协调。

## 10–12. UI 已交页面代码，前端仍负责数据和真实动作

本轮刷新正式 UI PR：全部 OPEN、base release、REVIEW_REQUIRED，无正式 GitHub review。所见有效检查成功（Referrals 有重复 workflow 的 skipped 项）；这不等于功能已验收。Tester 不进入正式交付。

| 需求 | 正式 UI PR / 固定 head | 已有 / 前端剩余 |
| --- | --- | --- |
| TRD-114 Referrals | [#3226](https://github.com/gmx-io/gmx-interface/pull/3226) / `02715736ea12dccb5892843e247d462113c2f1dd` | 页面/向导/表格/链接基础已有；数据 Hook 空，绑定/创建未连接。补 on-chain code、真实历史优惠/奖励、旧链接归属、钱包网络隔离。 |
| TRD-113 GT / Stake | [#3220](https://github.com/gmx-io/gmx-interface/pull/3220) / `19e9b8cfeed77497bb3b5472522283a1859c4474` | My/Global/Buyback/Stake、交互与计算结构已有；业务 Hook 无数据，确认动作 toast 后关闭。补真实 GT/VIP、回购额度/销售、租金回收、质押/claim/unstake 与历史。 |
| TRD-115 Earn | [#3211](https://github.com/gmx-io/gmx-interface/pull/3211) / `b2467ec7b17da959ec0f35f5e6bfcab2a5e6c677` | Portfolio/Discover/卡片结构已有；gt/lp undefined、assets 空。补真实资产/LP/GT 数据，保持 staked+unstaked 持仓及 lifetime 收益一致。 |

更详细的交接证据在 [DES-90](issues/DES-90.md)、[DES-89](issues/DES-89.md)、[DES-88](issues/DES-88.md)，不重复逐组件登记。正式 PR 的字段类型是 UI 消费契约线索，不是 API 已评审/已部署证明。

**Referrals 首要问题：** 旧站 `useInitializeReferralCode/useSetReferrer` 有链上 instruction 与 PDA/编码逻辑；其输入正则与 base58/8-byte 编码不能仅按外观照搬，需对照协议确认可接受字符和长度。历史优惠按每笔交易当时 GT VIP 与 referral 的组合折扣计算，不能用当前 VIP 或直接相加。现有 `/fee-discount` 是当前折扣，不证明有历史 savings。UI 分享链接有 `chainId=solana` 和独立 storage key，但消费/旧站迁移归属仍待接通；两个动作“绑定别人/创建自己”互不替代。

**GT/Stake 首要问题：** 旧站 staking RPC、stake/claim/unstake 与 rent 回收已有真实实现，不是零基础。但 GM/GLV 涉及不同 token program，旧站 `submitUnStake` 对 GLV 用 Token-2022；而 #3337 订单 sender 明确拒绝其 account setup。要明确新 Stake adapter、批量动作、off-hours 限制、claim 对后续收益影响、租金回收账户与余额刷新。GT 7 位、LP 18 位、USD 30 位的 UI 类型须逐来源对照，不能套单一精度。

**Earn 首要问题：** summary、LP 卡片和 staking 页应消费同一组持仓/收益来源；wallet-only LP balance 会漏掉只持有 staked shares 的资产。lifetime LP earning、GT buyback proceeds、Total GT balance+unclaimed 要去重且可解释。Referrals/GT 的 UI 合并并不自动解决这些数据问题，Pools/Stake 的统计定义稳定后更适合接续。

## 推荐第一轮 refining 的实际产出

1. **TRD-91 与 Rainer：** 收口 network SDK 接线、费率样本和历史不足处理，判断能否形成独立前端交付。无需重做整张图。
2. **TRD-92 与 Sulliven：** 对照原需求标出已覆盖项，拆出 Receive、Send、embedded 的实现与验证条件；确认需修改的共享入口和 pending 行为。
3. **TRD-110：** 写清普通 Swap 与 wrap/unwrap 的支持矩阵、报价和执行边界，列出对 #3337 的最小新增契约，避免误用订单 sender。

每项应得到“做什么、复用什么、还缺哪个具体输入、由谁确认、如何验收”，不要求先开新业务分支或把状态改为 Refining。本轮未修改 Linear、认领任务、创建 PR 或向成员发消息。

若 rates 历史验收不能接受、Privy embedded 配置不可用、Swap 合法指令/SDK API 不匹配，分别只调整受影响范围；不把单个前置扩大为所有需求停工。若 Claims Keeper/统一 API 部署证据补齐，TRD-90 可提前；若 TradFi 价格、闭市与条款完成确认，它的重要性足以明显前移。排序仅对本次证据有效。

## 后续跟踪与版本接续

2026-11-24 22:45 单项跟踪：TRD-91 已从本表观察时的 Backlog 变为 In Progress，负责人仍 Rainer；生产接口可用、前端接线和历史覆盖的判断未变。最新单项证据见 [TRD-91 当前记录](issues/TRD-91.md)。本文原表保留当轮状态与排序，未重评全部候选；当前应按已有负责人推进中的任务接续，不能按待认领候选处理。

用户于 2026-11-24 明确将本表和相关说明作为频繁跟踪、重复分析的知识库资料。下次从本文及对应 issue 记录恢复，遵循[持续评估约定](solana-next-task.md#unification-持续跟踪与重复评估)，不依赖聊天记录重新拼接背景。

- **只跟踪进展时：** 刷新指定需求及受影响依赖，记录哪些产品决定、PR、代码、数据或验收发生变化；未重新比较全部候选时，不宣称整张排名已更新。普通调查事实归对应 issue，只有影响排序的重要变化才回到下一轮优先级报告。
- **重新排序时：** 重新确认完整候选范围，复用仍有效的源码分析，刷新影响可实施性和重要性的事实；输出同样易读的完整排序表、逐项解释与首轮 refining 建议。按实际变化重算，不机械延续本次顺序。
- **保存新结论时：** 新建带日期的报告；同一天多轮实质重评增加可区分的时间后缀。记录相对本文的进入/移出、排名升降、阻碍解除或新增，以及证据原因。更新固定入口指向新报告，并在本文标明后继；历史证据保留原核验日期。
- **影响范围：** Divhead/明显后端工作不列候选，但核对必要依赖；UI 三项的后移是本批产品安排，后续依据最新产品决定、正式代码和真实业务前置重新判断。排名、负责人和状态都是观察结果，不是永久规则。

本次仅补充知识库接续与维护方式，12 项排名及业务核验结论未变。维护记录以本文件说明和 Git 历史为准。

2026-11-24 单项跟踪：TRD-92 仍为 Backlog / Sulliven。深入核对确认连接和余额已有 release 交付，切网无记忆时自动打开连接流程仍有行为差异；Receive/Send 和 embedded 仍需实现或核验。TRD-101 将钱包切换/失败恢复列入当前交易验收，将转账/embedded 放在交易之后，不应把整张 TRD-92 当成当前交易硬阻塞。能力矩阵、具体接线和边界见 [TRD-92 当前记录](issues/TRD-92.md)；未重排全量候选。

2026-11-24 23:10 范围调整：已按用户授权将 TRD-92 的 Solana embedded 扩展拆为 [TRD-210](https://linear.app/gmx-io/issue/TRD-210) 并关联；TRD-92 保留现有外部钱包基础上的完善与资产收发。上表是拆分前排序基线，embedded 的未知项不再作为 TRD-92 当前验收项。

2026-11-24 TRD-110 单项跟踪：当前已为 Refining，未指定实施 assignee。release 的 Solana swap feature 仍关闭；共享报价和 vendor SDK 有基础，#3337 明确排除 swap，独立 wrap executor 仍为 EVM。API 已适配 Swap 订单，不预设后端从零缺失；Market/Limit 范围与报价到执行契约需先收口。详细证据见 [TRD-110 当前记录](issues/TRD-110.md)，未重排全量候选。

TRD-110 二次核验补充：以用户明确的“GMX 框架内承接 GMTrade，前端自身验证不算依赖”判断，可开始实施。固定真实 WASM 8 组 swap 构造及 update/close 构造成功；生产 API/RPC 核实四币对池链上 disabled，另有 GMTrade 默认 BOME/MELANIA/TON 三个 enabled 的 WSOL/USDC 池未纳入统一 API，完全同池覆盖需协调数据服务范围。具体版本、slot、样本和验证边界见 [TRD-110](issues/TRD-110.md)，不无条件承诺全部 GMTrade 路径等价可用。
