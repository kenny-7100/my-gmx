# GMTrade 四个页面完整功能与依赖核验

核验日期：2026-10-26。范围：线上 GMTrade 的 **Stake、GT Points、Stats、Referrals** 四个菜单页面；GT Points 包括 My、Global、Buyback 三个子路由。本次仅调查和文档整理，没有实施页面、修改 Linear 或执行交易。

**四页当前启用的前端路径均未发现对新 GMX `api-solana` 的直接调用，但只有部分功能可以脱离旧服务独立推进。** GT/VIP 当前链上信息、Global 当前周期、Referral 邀请码及绑定关系最容易拆出；完整 Stake、Buyback、历史、排行榜、市场统计仍有明确服务依赖。

## 范围与读表规则

- 按当前启用代码逐项覆盖信息字段、Tab、弹窗、输入校验、筛选、排序、分页、导航和链上操作；同一数据来源的功能可合并成一行。公共钱包、响应式及加载状态另列，不把每个重复按钮拆成新业务功能。
- 表格沿用六列。旧 Web 指 `gmtrade-web-backend.gmtrade.xyz`，专用 keeper 指 `keeper-prod-api.gmtrade.xyz`，不是 GMX Arbitrum oracle keeper，也不是新 gmx-api。Core SQD 与 GT SQD 分开标记。
- “否”描述该功能前端的直接调用，不保证上游服务内部没有其他依赖。特别是 Web WS 的价格生产、R2 统计文件的生产链路，不能从浏览器请求推断其全部内部依赖。
- “沿用底层”表示本地交互不新增接口，但必须先有对应数据；不能把它当成可独立交付的完整功能。“可先行”是技术拆分建议，不代表已通过产品范围确认、PR 去重或交易验收。
- 用户提出这些页面部分呈现方式可能沿用 GMTrade，本表据此评估功能。尚未逐页批准整体复制 UI、旧状态体系或长期依赖旧服务；实施仍应遵循现有 GMX 架构边界。原有 Linear 范围差异见文末。

## 当前线上服务

| 服务 | 核验地址 | 本表用途 |
| --- | --- | --- |
| 旧 Web HTTP | `https://gmtrade-web-backend.gmtrade.xyz` | GT 日线缓存、全局 feeApy、附属错误日志 |
| 旧 Web WS | `wss://gmtrade-web-backend.gmtrade.xyz/ws` | 市场、价格、GLV、mint、余额等共享主题 |
| 专用 keeper HTTP | `https://keeper-prod-api.gmtrade.xyz/graphql` | Buyback prepare / submit |
| 专用 keeper WS | `wss://keeper-prod-api.gmtrade.xyz/graphql-ws` | 质押交易编排与完成提交 |
| Core SQD | `https://gmx-solana-sqd.squids.live/gmx-solana-base:prod/api/graphql` | GT 历史、排行、质押历史、旧推荐奖励和推荐关系索引 |
| GT SQD | `https://gmsol-sqd-test.squids.live/gmtrade-gt:prod/api/graphql` | 当前 Buyback、额度、水位、结算和新推荐奖励；域名含 test，但部署标识为 prod |
| RPC HTTP / WS | `https://rpc-1.gmtrade.xyz/` / `wss://rpc-1.gmtrade.xyz` | 链上状态、钱包余额、交易；本次未证明广播或 RPC WS 全部能力 |
| Stats 静态数据 | `https://r2.gmtrade.xyz/common/stats-new.json` | 跨链 Overview / Stats 卡片 |
| 外部 Analytics | `https://dune.com/gmtrade/gmtrade-analytics` | Stats 的外链目的地；未验收 Dune 内部查询 |

其他线上服务、历史观察窗口和地址纠错见 [GMTrade 当前线上服务地址](docs/gmtrade-live-services.md)。Treasury SQD 虽存在发布配置，但未发现是这四页当前功能的直接必要路径，不应强行加入。

## Stake：`/stake`

源码依据：[S1](#s1-stake)、[S2](#s2-共享市场与余额)。

| 页面 / 功能 | 依赖旧 GMTrade Web 后端？ | 依赖专用 keeper？ | 依赖 SQD？ | 其他前置 | 是否适合提前推进 |
| --- | --- | --- | --- | --- | --- |
| S01 标题、说明、Buy 按钮及无资产弹窗中的 Buy GLV / GM 导航 | 导航本身否 | 否 | 否 | 本地路由；部分按钮要求已连接；目标 Pools 购买流程另计 | 可先做交互，但不等于购买能力完成 |
| S02 APR Tiers：六档持续周数及 APR、解释 tooltip | 否 | 否 | 否 | RPC 读取 globalState.apyGradient；六档为 <1、1–4、5–12、13–24、25–48、>48 周 | 可作为纯 RPC 只读切片 |
| S03 质押配置和原始仓位：启用状态、最小金额、claimEnabled、控制器停用时间、owner 仓位 | 否 | 否 | 否 | RPC getAccountInfo / getProgramAccounts；globalState、lpTokenController、position 布局和程序版本 | 可先行，但只是完整页面的底层能力 |
| S04 Overview：Wallet Value | 是，WS 市场价格、GLV / mint / 市场数据 | 前端无直接调用 | 否 | RPC 钱包余额及 GLV 持有的 GM 余额；余额更新含 RPC WS / 轮询路径 | 有条件；不能当作纯 RPC 估值 |
| S05 Overview：Stake Value | 当前页面有 WS 就绪门槛；数值本身来自链上 | 否 | 否 | 汇总 position.stakedValueUsd，表示初始质押价值，非当前市值 | 可拆纯链上切片；照搬页面仍等待 WS |
| S06 Overview：Claimed GT from Stake | 累计查询本身否 | 否 | Core | 当前奖励累计路径合并 gtUpdateds / gtRewardRecords；RPC 提供 GT 精度 | 有条件；需索引契约与完整性 |
| S07 Overview：Unclaimed GT from Stake | 当前页面有 WS 就绪门槛；核心计算可链上完成 | 否 | 否 | position、controller、globalState、Store 与本地计息计算 | 可拆只读切片；完整展示仍有当前 gate |
| S08 Stake Positions：代币/池子身份、数量、初始价值、持续时间、当前/平均 APR、未领 GT、已领 GT tooltip、停用提示 | 是，token / market / GLV 映射及市场开放状态 | 前端无直接调用 | 此仓位展示核心否 | RPC 仓位、控制器和 GT 状态；时间及积分本地计算 | 有条件；完整列表并非独立纯 RPC 页面 |
| S09 仓位列表金额/时长排序、分页、单选/全选、批量入口、移动卡片 | 沿用 S08 | 否 | 不新增 | 本地列表和 selection 状态 | 可随 S08；不能单独消除数据依赖 |
| S10 Stake / Unstake History：动作、代币、数量、时间 | 历史查询否；当前代币映射需 WS | 否 | Core：stakeGmGlvs + unstakeLps | 合并两类事件；RPC / WS 提供 token 精度和身份 | 有条件；不是仅查 Unstake 事件 |
| S11 历史 Tab 切换、金额排序、分页、加载/空状态 | 沿用 S10 | 否 | Core，分页继续取所需事件 | 当前 UnStakeListNew 分支；列表前缀取数后合并 | 可随 S10 |
| S12 Stake 弹窗：GM/GLV 选择、全选、Max、金额输入/slider、总 USD、最小金额、RWA 开放限制 | 是，估值与市场/GLV/mint 数据 | 弹窗展示本身否 | 否 | RPC 余额、controller、globalState；钱包连接 | 有条件；UI 校验与服务契约均需保留 |
| S13 单资产/多资产质押提交 | 当前页面前置数据需 WS | **是，WS createLpTokenStaking → 签名 → completeLpTokenStaking** | 前端提交不直接依赖 | 钱包签名、资金、RPC、正确程序/Oracle；keeper 编排未做真实交易验收 | 不作为首个无外部依赖任务 |
| S14 Unstake 弹窗：单仓/批量、全选、部分/全部、Max/slider、总额、Current APR、同时领取 GT 数量、RWA 与开关限制 | 当前 token / market / 可操作状态需 WS | 否 | 否 | RPC；claimEnabled=false 时协议要求全部解押 | 可拆；完整弹窗仍有展示数据依赖 |
| S15 解押提交：prepareUser / ATA、unstakeLp、分组签名和广播 | 核心指令与广播否；页面沿用 S14 | **否，本地构建** | 否 | 钱包 signAllTransactions + RPC sendRawTransaction；每笔最多 3 个仓位；需有真实仓位及授权 | 有条件先行，必须单独验收交易结果 |
| S16 Claim GT：单仓/批量、确认奖励、按钮可用性、构建与广播 | 核心指令否；当前仓位展示沿用 S08 | **否，本地 claimGt** | 否 | RPC + 钱包；claimEnabled=true 且奖励>0；每笔最多 4 个仓位 | 可拆，但需要可领取状态和交易授权 |
| S17 操作结果、错误提示、列表/余额/历史刷新 | 沿用对应功能 | 质押沿用 keeper；解押/领取否 | 历史/累计刷新需要 Core | RPC、账户更新；部分旧路径广播后未完整确认，不能直接复用为验收标准 | 应随各写操作验收，不单独视为已就绪 |
| S18 解押/Claim 失败的附属错误上报 | 是，GET /log/p | 否 | 否 | 上报失败被独立捕获；不是交易核心条件 | 可与核心交易拆开，不应误列为解押硬依赖 |

**Stake 关键边界：** 当前 `isPositionsListLoading` 等待 balanceMap、GLV、marketInfosMap、GT 状态等，不能仅因某个字段可链上计算就断言现有页面不依赖旧 Web。名称带 Marin 的当前 hooks 实际消费 Web WS 的 `glvs` / `tokenMints`，不意味着前端正在直接调用独立 Marin keeper。

## GT Points：`/gt/my`、`/gt/global`、`/gt/buyback`

源码依据：[G1](#g1-gt-my--global)、[G2](#g2-buyback)。

| 页面 / 功能 | 依赖旧 GMTrade Web 后端？ | 依赖专用 keeper？ | 依赖 SQD？ | 其他前置 | 是否适合提前推进 |
| --- | --- | --- | --- | --- | --- |
| G01 My / Global / Buyback Tab、对应路由和无效 Tab 重定向 | 否 | 否 | 否 | 本地路由；不是旧 localStorage Tab 实现 | 可先做路由壳 |
| G02 My：当前 GT、VIP0–9、下一等级差额、Achieved / Locked / Max VIP | 否 | 否 | 否 | RPC Store + owner userHeader；未连接/无账户分支 | **优先候选：纯 RPC 当前状态** |
| G03 My：VIP 等级选择/轮播、门槛、VIP 手续费折扣、Referral 折扣、合并折扣 tooltip、推荐奖励系数 | 否 | 否 | 否 | RPC Store 参数与个人 GT；本地计算、Swiper / selector | 可与 G02 同批先行 |
| G04 My：How To Earn GT 帮助 panel，Trade / Stake / Referral 三卡导航 | 否 | 否 | 否 | 静态说明、本地导航；目标页行为另计 | 可先行；当前入口为标题问号 |
| G05 My：GT History，Trading / Sell to Treasury / Referral / Staking 的动作、正负数量、时间 | 否 | 否 | Core：gtUpdateds + gtRewardRecords | RPC GT 精度；历史分类规则 | 有条件；需 Core 索引 |
| G06 My 历史 Action 多选/选项搜索、分页、桌面表格与移动简化卡片 | 否 | 否 | Core，筛选/分页改变查询 | Action 筛选当前提供于桌面，移动端仍有分页 | 随 G05，不能漏掉端差异 |
| G07 My：GT Summary 弹窗，Trading / Referral / Staking 累计和已售 GT | 否 | 否 | Core：推荐/质押累计、Burn 累计 | Trading 累计为 RPC userHeader.totalMinted；sold>0 才展示已售行 | 有条件；不是纯 RPC 汇总 |
| G08 Global：当前周期、周期 mint 进度、当前 mint price、累计 GT minted | 否 | 否 | 否 | RPC Store；本地精度/进度计算 | **可与 G02/G03 合并先行** |
| G09 Global：累计 minted / mint price 双轴历史图 | **是，HTTP /v2/cache/daily/gtUpdates** | 否 | Core：gtGlobalHistories | 两来源拼接；后端快照还表明日缓存来自 SQD，但线上内部版本未确认 | 完整 Global 有旧 Web 依赖 |
| G10 Global 图表 30 / 90 / 180 / Total、hover、图例与本地显示交互 | 沿用 G09 | 否 | 沿用 G09 | 图表范围处理与展示 | 可随 G09；不包含旧注释 Buyback 曲线 |
| G11 Global：Top GT Holders，名次/GT/邀请码、本人高亮、前 1000 名分页 | 否 | 否 | Core：userGtInfos | RPC Store 精度、批量 userHeader / referralCodeV2；头像/昵称为本地生成 | 有条件；无 SNS / ENS 必要依赖 |
| G12 Global 排行：复制邀请码/推荐链接、地址浏览器外链 | 否 | 否 | 排行沿用 G11；操作不新增查询 | clipboard、location.origin、外部区块浏览器 | 随 G11；当前调用没有启用本人置顶 |
| G13 Buyback：Season 2 标识/说明、下一 UTC 零点倒计时 | 否 | 否 | 显示文字/倒计时本身否 | 本地 clock / 配置；内部 seasonId 实为 prod-season-1，窗口需与实际池一致 | 可做壳，不代表回购服务就绪 |
| G14 Buyback：My Sellable GT，Total Earned / Remaining / Available 及状态提示 | 否 | 否 | **GT：sellQuota / snapshots / userSrStates / 水位** | RPC 用户 GT；available 受余额限制；referenceSlot 来自 SQD 水位，非 RPC getSlot | 有条件；必须保留 not-ready / stalled 等状态 |
| G15 Buyback：Today's Pool，USDC 上限、排队 GT、估价、Strong / Moderate / Pressure 及 tooltip | 否 | **前端展示不直接调用** | **GT：currentGtBuybackPool** | 池返回价格和状态；不是旧 keeper summary 接口 | 有条件；不能当作纯 keeper 查询 |
| G16 Buyback：My Participation，已排队 GT、预计收益 | 否 | 前端展示否 | GT 池与 srDecisions、归属截止快照 | 当前 owner、正确 season/network | 随 G14/G15；无独立手动领取收益按钮 |
| G17 Sell GT 弹窗：输入、Max、slider、最少 0.01 GT、预计收益、提交前刷新 | 否 | 输入展示否 | GT 池/额度刷新 | RPC 用户余额；本地校验 | 随 G14/G15，不单独宣称可交易 |
| G18 Sell GT 准备、完整性校验、签名、提交与 pending 重试 | 否 | **是，HTTP prepareGtBuybackSellRequest / submitGtBuybackSellRequest** | GT 提供额度与 referenceSlot | 校验 prepared versioned tx / integrity signature；钱包；RPC blockHeight / signature status / 必要时 getTransaction；重试复用原签名交易 | 不适合当作无服务依赖任务；需真实交易验收 |
| G19 卖出后的自动回购、结算、收益转钱包 | 否，未发现前端直接调用旧 Web | **需要后台持续执行，非页面本地完成** | GT 结算与状态可观察 | 实际池资金、keeper 执行、链上结果；页面说明约 24h，不是本次确认的 SLA | 需服务负责人和端到端条件；提交成功不等于完成 |
| G20 Buyback Chart：mint price、buyback price、累计 USDC，hover 每日金额/数量 | 否 | 否 | **GT：gtBuybackSettlements** | 当前 season 起点与本地图表计算 | 有条件；不同于 Global 的 Web 日线 |
| G21 Buyback Chart：30 / 90 / 180 / Total、hover / 图例 | 否 | 否 | 沿用 G20 | 当前分支按 season 获取数据后本地截范围 | 随 G20 |
| G22 Claim Rent 弹窗：请求发现、可退账户数/SOL、loading / error / retry / empty | 否 | **否** | **GT：发现 sell requests** | RPC 扫 gtExchange、核对 vault confirmed；匹配 owner/store/season/network | 可单拆，但不是 Referral 奖励领取 |
| G23 Claim Rent：构建、模拟、批量签名/发送、确认、pending 恢复、部分成功和刷新 | 否 | **否，不走 prepare / submit** | 发现和刷新沿用 G22 | RPC treasuryVaultConfig / gtBank；本地 completeGtExchange、ATA 和 remaining accounts；钱包与授权 | 有条件；需可回收账户，不能视为普通 SOL 转账 |

## Stats：`/stats`

源码依据：[T1](#t1-stats)。

| 页面 / 功能 | 依赖旧 GMTrade Web 后端？ | 依赖专用 keeper？ | 依赖 SQD？ | 其他前置 | 是否适合提前推进 |
| --- | --- | --- | --- | --- | --- |
| T01 Analytics 外链 | 否 | 否 | 否 | Dune 外部页面；跳转本身为本地行为 | 可先行；未验证 Dune 内部数据 |
| T02 Overview：24h volume / Open interest / Long positions / Short positions | 前端直接读取否 | 前端直接读取否 | 前端不直接查询；生成链路未知 | **R2 stats-new.json**；Solana / Arbitrum / Avalanche / MegaETH / Total 分解 tooltip | 有条件；需确认文件生产者、口径和更新承诺 |
| T03 Overview：Fees for the past、TVL、GM pools 及各链分解/解释 | 前端直接读取否 | 前端直接读取否 | 前端不直接查询；生成链路未知 | 同一 R2；费用时长标签按本地 UTC 周三起算，不能替代实际统计周期验证 | 有条件；不是“无后端数据来源” |
| T04 Stats：Fees / Volume / Users / Treasury 及 tooltip | 前端直接读取否 | 前端直接读取否 | 前端不直接查询；生成链路未知 | R2；前三项跨链分解，Treasury 分 other tokens / GMX | 同 T02；跨链总额不等于 Solana 自有数据 |
| T05 卡片缓存、加载/失败与再次访问显示 | 否 | 否 | 否 | useStatsJson 的内存/localStorage 缓存和共享请求；**无定时刷新、无缓存时间戳** | 实施需明确新鲜度验收；有数字不等于实时 |
| T06 GM Pools 市场列表：市场身份、指数价格、Liquidity、Long/Short Net Rate / 1h、Utilization | **是，WS indexTokens / marketInfos 等** | **当前列表前端无直接调用** | 否 | 本地聚合/精度；列表价格为 index price，非 GM token price | 完整 Stats 仍有旧 WS 依赖 |
| T07 逐池 tooltip：池子/代币对、liquidity、Long/Short Net Rate，以及 funding / borrowing 规则说明 | 是，沿用市场数据 | 前端无直接调用 | 否 | 本地计算；费用说明排除 open / swap / impact fees | 随 T06；不能把 tooltip 数据漏算 |
| T08 Search Pools、清空、收藏/取消收藏和优先排序 | 沿用 T06 | 否 | 否 | 本地搜索；localStorage pools_gm_favorites | 可随 T06，不新增后台接口 |
| T09 Price / Liquidity / Utilization 三态排序、每页 10 条分页、横向滚动/移动适配、骨架/无结果 | 沿用 T06 | 否 | 否 | 本地排序分页；没有启用的 TVL 排序入口 | 可随 T06 |
| T10 More 菜单逐池 Buy GM 与跳转 | 菜单内容沿用 T06；跳转不新增请求 | 否 | 否 | /pools?market=…；目标购买不在 Stats 范围 | 可随列表，不等于购买实现完成 |

**Stats 边界：** 当前列表虽然调用余额 hook 并计算 `walletUsd` / `walletNum`，但它们没有在表格单元格中渲染，不能列成现有“钱包持仓列”。同样，逐池 GM price / TVL 的中间字段存在计算，但没有当前 tooltip 展示入口；funding / borrowing 是规则说明，当前 tooltip 展示的是净费率，没有各自独立的数值明细。`useStoreTokensValueForStats` 也不是当前顶部卡片的数据来源。`socketStore` 中 keeper setter 的定义不能证明被使用；本轮未发现当前 Stats 通过这些 setter 请求 keeper 补齐市场数据。Web 后端内部价格来源仍需另行确认。

## Referrals：`/referrals`

源码依据：[R1](#r1-referrals)。

| 页面 / 功能 | 依赖旧 GMTrade Web 后端？ | 依赖专用 keeper？ | 依赖 SQD？ | 其他前置 | 是否适合提前推进 |
| --- | --- | --- | --- | --- | --- |
| R01 自己的邀请码、解码、推荐链接显示与复制 | 否 | 否 | 否 | RPC userHeader / referralCodeV2；链接为当前 origin /r/code；clipboard | **可先做纯 RPC 只读切片** |
| R02 创建邀请码弹窗：输入、Base58/长度≤12 校验、实时重名检查、状态提示 | 否 | 否 | 否 | 本地校验 + RPC 查询邀请码 PDA；钱包连接 | 可先行；不能只做本地格式校验 |
| R03 创建邀请码：可选 prepareUser + initializeReferralCode、签名发送、轮询创建结果 | 否 | 否 | 否 | 本地指令、RPC、钱包、资金和明确交易授权 | 可单拆链上操作；本次未执行 |
| R04 当前推荐人/绑定关系、Set Referrer 卡片显示/关闭、手动输入与校验、拒绝自己的码 | 否 | 否 | 否 | RPC userHeader / referralCodeV2；本地表单状态 | **可先行，不必依赖排行榜** |
| R05 绑定推荐人：可选 prepareUser + setReferrer、签名、广播和结果刷新 | 否 | 否 | 否 | RPC + 钱包、资金和授权；链上绑定约束 | 可单拆；不同于仅访问带 ref 链接 |
| R06 No code? Top GT Holders 选择器，排行榜、邀请码复制/回填、头像/地址链接、桌面与移动弹窗 | 否 | 否 | **Core：GT 排行** | RPC 补邀请码；本地生成昵称/头像；外部浏览器 | 有条件；这是绑定弹窗的额外 SQD 依赖 |
| R07 /r/:code 与旧 /referrals?ref 入口、pending code 保存、连接后恢复/展示 | 否 | 否 | 否 | 路由 state / sessionStorage；后续绑定沿用 R04/R05 | 可先行；**链接不自动执行链上绑定** |
| R08 Total Referrals | 否 | 否 | 否 | RPC userHeader.refereeCount | 可与 R01 同批 |
| R09 Referral Reward Rate、VIP 相关系数、说明中的动态示例 | 否 | 否 | 否 | RPC Store + 用户 GT 等级；Header 当前读取路径也参与用户等级状态 | 可与 GT/VIP 当前状态同批 |
| R10 Active / Inactive 受邀人及“最近 7 天交易”tooltip | 否 | 否 | **Core：固定 7 天 gtUpdateds / referral gtRewardRecords** | 总数来自 RPC；Inactive=总数−Active；独立于下方历史窗口 | 有条件；不是只凭链上人数或当前 Tab 推导 |
| R11 Recent Activity：时间、Referee、GT Reward、Sellable Quota | 否 | 否 | **GT 新奖励 + Core 旧奖励，按时间边界组合** | 2026-09-28 后新记录用 GT referralRewardRecords；旧段用 Core gtUpdateds / gtRewardRecords；RPC 精度 | 有条件；近 7 天成功不代表旧历史已覆盖 |
| R12 Activity 的 7d / 30d / 90d、时间整理、每页 10 条分页、桌面/移动卡片 | 否 | 否 | 沿用 R11，时间窗口影响查询 | 本地展示/分页；跨边界时查询两套索引 | 随 R11；需覆盖跨边界验收 |
| R13 Referees：地址、加入时间、窗口内累计 GT Reward / Sellable Quota、Last Reward | 否 | 否 | **Core setReferrers + Core/GT 奖励历史** | 推荐关系使用 PDA 查询；收益按受邀人聚合 | 有条件；完整列表仍需索引 |
| R14 Referees 的 30d / 90d / Total、Joined / GT Reward / Last Reward 三态排序、分页、移动 Reset / Apply 排序面板 | 否 | 否 | 沿用 R13；收益窗口查询 | **窗口改变收益统计，不按加入时间过滤受邀人数**；本地排序分页 | 随 R13；需明确该产品语义 |
| R15 Recent Activity / Referees Tab、加载/空状态、历史错误及 Retry | 否 | 否 | 相应索引重试 | 本地 UI 状态；账户不存在与查询失败应区分 | 随对应数据；不能把错误显示为空历史 |
| R16 How Referral Rewards Work：桌面说明、移动帮助弹窗、永久折扣/VIP 规则说明 | 否 | 否 | 否 | 静态文字 + R09 动态比例/示例 | 可先做，但动态参数仍需 RPC |

当前启用页面没有“转移邀请码”按钮或独立“领取 Referral 奖励”流程；不要因仓库存在未调用 hook，就把它当作待迁移现成功能。

## 四页共有能力与附属依赖

| 页面 / 功能 | 依赖旧 GMTrade Web 后端？ | 依赖专用 keeper？ | 依赖 SQD？ | 其他前置 | 是否适合提前推进 |
| --- | --- | --- | --- | --- | --- |
| C01 页面路由、桌面/移动布局、Tab/弹窗开关、语言和 tooltip | 本地交互否 | 否 | 否 | 目标 GMX 的既有组件/路由/国际化；内容数据沿用各行 | 可先做，不应引入并行旧应用 |
| C02 钱包连接/断开、地址/账户切换、网络、Header 用户 GT 等级 | 否 | 否 | 当前 GT 等级否 | 钱包适配、RPC Store/userHeader；目标复用 GMX 钱包体系 | 共享前置；未连接页面不能覆盖全部个人状态 |
| C03 全局配置/公告和 feeApy 引导 | **feeApy 为旧 Web HTTP** | 无本轮直接证据 | 非本轮直接查询 | R2 config.json / notices.json；App 全局请求不等于每项业务硬依赖 | 不照搬整套 bootstrap；按功能决定必要性 |
| C04 RPC 状态、刷新、交易反馈、外部浏览器、剪贴板 | 依具体功能 | 依具体功能 | 依具体功能 | 程序/Store/network 一致；RPC 读、模拟、签名、广播分别验收 | 必须按具体操作核验权限和结果 |
| C05 监控/日志、地理限制相关旧代码 | 部分附属日志是；见 S18 | 否 | 否 | Datadog 等监控；当前 isRestrictedArea() 恒 false，不能宣称地区限制已生效 | 不作为核心交易依赖，也不照搬失效逻辑 |

## 覆盖依据与版本边界

参考前端 `main` 本地与 GitHub 核验 SHA 均为 `74170b8ad4e06c73b8ed86e72930f6eee61fe2ba`；协议参考 SHA 为 `f102501f30635062fac156ca05831c0fb63a8590`；SQD 参考 SHA 为 `55d26a728712eb2032a789135e1d741588c86db3`。

线上公开页面显示 v2.16.0；本次重新读取 `https://gmtrade.xyz/assets/index-CMX6WD7U.js`，SHA-256 为 `619757c1da64d01eb046131a63bcc2d3c7d8dce8054ba127abb851bdebae1cda`。页面与请求符合本表所述当前路径，但未证明部署与该源码提交逐字一致。

当前分支判断同时核对 graduated flags，包括 GMW299/300、331、396、403/404/406/410/411/430/431/446/486/503。未启用、未调用、已被替代的代码不作为现有功能：旧 Referral 页面、旧 Unstake-only 列表、旧 GT Tab 保存逻辑、旧 keeper Buyback summary/burn 路径、注释中的 Global Buyback 曲线、未被页面调用的 transferReferralCode hook 等。实施时应重新核对开关与版本。

### S1 Stake

- [Stake 入口及数据就绪门槛](gmx-solana-interface/app/src/components/Stake/index.tsx)、[Overview / APR](gmx-solana-interface/app/src/components/Stake/components/Overview.tsx)、[仓位列表](gmx-solana-interface/app/src/components/Stake/components/StakeList.tsx)、[当前历史列表](gmx-solana-interface/app/src/components/Stake/components/UnStakeListNew.tsx)。
- [原始仓位](gmx-solana-interface/app/src/components/Stake/Hooks/useStakePositions.ts)、[控制器](gmx-solana-interface/app/src/components/Stake/Hooks/useStakeQueryController.ts)、[全局配置](gmx-solana-interface/app/src/components/Stake/Hooks/useStakeGlobalState.ts)、[历史查询](gmx-solana-interface/app/src/components/Stake/Hooks/useStakeHistoryData.ts)。
- [当前弹窗与解押/Claim 内联实现](gmx-solana-interface/app/src/components/Stake/components/StakeGLVGM.tsx)、[keeper 质押编排](gmx-solana-interface/app/src/components/Stake/Hooks/useStakeManySingleSocket.ts)、[WS client](gmx-solana-interface/app/src/components/Stake/wsClient.ts)、[附属错误上报](gmx-solana-interface/app/src/components/Stake/utils/fetchErrorLog.ts)。不要只看旧 submitUnStake / submitClaimGt helper。
- [协议质押/解押/领取约束](gmx-solana/programs/liquidity-provider/src/lib.rs)。本地协议源码不代表线上部署必然同版本。

### S2 共享市场与余额

- [当前市场适配](gmx-solana-interface/app/src/hooks/fetchHooks/useGlvMarkets.ts)、[GLV 账户来自 socketStore](gmx-solana-interface/app/src/hooks/marin/useMarinGlvAccounts.ts)、[mint 数据来自 socketStore](gmx-solana-interface/app/src/hooks/marin/useMarinTokenMetadatas.ts)、[GLV 所持 GM 余额 RPC](gmx-solana-interface/app/src/hooks/fetchHooks/useGlvMarketTokenBalances.ts)。
- [共享 socketStore](gmx-solana-interface/app/src/zustand/socketStore.ts)。keeper setter 仅定义、未发现调用，不能据定义推断当前页面已直接依赖 keeper 市场查询。

### G1 GT My / Global

- [GT 入口](gmx-solana-interface/app/src/components/newGT/index.tsx)、[My](gmx-solana-interface/app/src/components/newGT/My/index.tsx)、[VIP 卡片](gmx-solana-interface/app/src/components/newGT/My/VipCardCarousel.tsx)、[等级选择](gmx-solana-interface/app/src/components/newGT/My/VipLevelSelector.tsx)、[帮助 panel](gmx-solana-interface/app/src/components/newGT/My/EarnGtPanel.tsx)。
- [历史 UI](gmx-solana-interface/app/src/components/newGT/My/GtHistorySection.tsx)、[历史查询](gmx-solana-interface/app/src/components/newGT/hooks/gtHistoryQuery.ts)、[奖励累计](gmx-solana-interface/app/src/components/newGT/hooks/useGtEarnedTotals.ts)、[Burn 累计](gmx-solana-interface/app/src/components/newGT/hooks/useGtBurnSoldTotal.ts)。
- [Store 当前 GT](gmx-solana-interface/app/src/hooks/fetchHooks/useGtGlobalDetails.ts)、[用户当前 GT](gmx-solana-interface/app/src/hooks/fetchHooks/useGtUserDetails.ts)、[Global 当前信息](gmx-solana-interface/app/src/components/newGT/Global/components/headerInfo.tsx)、[排行](gmx-solana-interface/app/src/components/newGT/Global/components/topGtHolders.tsx)、[日线合并查询](gmx-solana-interface/app/src/hooks/gtHooks/useGtPriceHistoryPaginated.ts)。

### G2 Buyback

- [Season 2 页面](gmx-solana-interface/app/src/components/newGT/Buyback/BuybackSeason2.tsx)、[GT SQD 查询](gmx-solana-interface/app/src/components/newGT/Buyback/api/gtBuybackSqd.ts)、[额度/水位上下文](gmx-solana-interface/app/src/components/newGT/Buyback/hooks/useGtSellContext.ts)、[池与参与信息](gmx-solana-interface/app/src/components/newGT/Buyback/hooks/useGtBuybackSummary.ts)。
- [Sell 弹窗](gmx-solana-interface/app/src/components/newGT/Buyback/SellGtModal.tsx)、[keeper API](gmx-solana-interface/app/src/components/newGT/Buyback/api/keeperBuyback.ts)、[交易完整性校验](gmx-solana-interface/app/src/components/newGT/Buyback/utils/sellTransactionValidation.ts)、[提交/重试](gmx-solana-interface/app/src/components/newGT/Buyback/utils/sellRequestSubmission.ts)、[图表](gmx-solana-interface/app/src/components/newGT/Buyback/BuybackChart.tsx)。
- [Claim Rent 弹窗](gmx-solana-interface/app/src/components/newGT/Buyback/ClaimRentModal.tsx)、[发现/状态](gmx-solana-interface/app/src/components/newGT/Buyback/hooks/useClaimableGtRent.ts)、[RPC 校验](gmx-solana-interface/app/src/components/newGT/Buyback/api/gtRentRpc.ts)、[提交/恢复](gmx-solana-interface/app/src/components/newGT/Buyback/hooks/useClaimGtRent.ts)、[交易构建](gmx-solana-interface/app/src/components/newGT/Buyback/utils/claimGtRentTransactions.ts)、[completeGtExchange](gmx-solana-interface/app/src/hooks/gtHooks/utils/completeGtExchange.ts)。

### T1 Stats

- [页面](gmx-solana-interface/app/src/routes/Stats.tsx)、[Overview 全部字段与周期文字](gmx-solana-interface/app/src/components/Stats/OverviewCard/OverviewCard.tsx)、[Stats 卡片](gmx-solana-interface/app/src/components/Stats/StatsCard/StatsCard.tsx)、[JSON 缓存](gmx-solana-interface/app/src/hooks/statsHooks/useStatsJson.ts)。
- [市场来源](gmx-solana-interface/app/src/components/Stats/Hooks/useMarkets.ts)、[列表全部字段/tooltip/搜索/排序/分页](gmx-solana-interface/app/src/components/Stats/MarketList/MarketList.tsx)、[Buy GM 菜单](gmx-solana-interface/app/src/components/Stats/components/PopupMenu.tsx)。

### R1 Referrals

- [当前页面、统计、Tab、筛选、排序和移动状态](gmx-solana-interface/app/src/routes/NewReferral.tsx)、[推荐关系读取](gmx-solana-interface/app/src/hooks/fetchHooks/useReferralDetails.ts)、[邀请码创建](gmx-solana-interface/app/src/hooks/referralHooks/useInitializeReferralCode.ts)、[绑定](gmx-solana-interface/app/src/hooks/referralHooks/useSetReferrer.ts)、[邀请码校验](gmx-solana-interface/app/src/hooks/referralHooks/checkReferralCode.ts)。
- [Set Referrer 卡片及选择器入口](gmx-solana-interface/app/src/components/Referrals/Referral/ReferralSetCard.tsx)、[推荐关系索引](gmx-solana-interface/app/src/components/Referrals/Hooks/GetReferrals.ts)、[奖励/活跃统计](gmx-solana-interface/app/src/components/Referrals/Hooks/UseReferralsReward.ts)、[跨 Core/GT 历史查询](gmx-solana-interface/app/src/components/Referrals/Hooks/referralHistoryQuery.ts)。

## 线上只读核验结果

本轮访问 `/stake`、`/gt/my`、`/gt/global`、`/gt/buyback`、`/stats`、`/referrals`；实际打开 My Summary / How To Earn、Referral Set Referrer，并切换 Referees。没有连接钱包、调用业务 mutation、签名或广播。移动端功能由源码确认，本轮未完成真实移动视口交互验收。

| 核验对象 | 本轮观察 | 证明范围与限制 |
| --- | --- | --- |
| Stats 旧 Web WS | 成功连接，收到 indexTokens、tickers、glvs、tokenMints、storeBalances 等主题 | 证明实际来源；不证明所有资产、字段或价格都正确 |
| Stats R2 | stats-new.json 实际 HTTP 200，卡片读取对应字段 | 未确认生产者、时间戳、刷新承诺和跨链口径 |
| Global | 观察到旧 Web gtUpdates、Core gtGlobalHistories、userGtInfos 成功查询且无 GraphQL errors | 证明当前路径确有两类服务，不代表全部历史完整 |
| Core 其他数据 | setReferrers、stakeGmGlvs、unstakeLps、gtRewardRecords 有限查询返回数据且无 GraphQL errors | 示例质押/解押时间为 10 月 25 日；未验收任意 owner 全历史 |
| GT Buyback | 当前池 READY / OPEN；池查询水位样本 461462679；settlements 返回数据，最新样本 2026-10-26T00:01:27Z | 状态为观察时刻快照，不保证任意账户有可卖额度 |
| GT 水位 | quota isReady=true、pendingAssociationCount=0、authorityStallReason=null；SR 两水位样本均 461462408 | 样本不代表长期无延迟；不作为新鲜度阈值通过证据 |
| GT 推荐奖励 | referralRewardRecords 无 GraphQL errors；最新样本 2026-10-26T00:35:08Z | 证明近期记录存在，不能证明跨切换边界完整性 |
| keeper HTTP schema | QueryRoot / MutationRoot / SubscriptionRoot 可 introspect；存在 prepareGtBuybackSellRequest、submitGtBuybackSellRequest、completeLpTokenStaking、createLpTokenStaking | 仅 schema 可访问；没有执行上述 mutation / subscription |
| keeper WS | graphql-transport-ws 握手与 connection_ack 成功；只读 query { __typename } 返回 QueryRoot，随后关闭连接 | 比仅“脚本有地址”更强，但不证明质押编排、Oracle 或卖出执行成功 |

本轮涉及的 Store 为 `CTDLvGGXnoxvqLyTpGzdGLg9pD6JexKxKXSV8tqqo8bN`（实施前必须从实际配置重新核对，不手抄为交易配置）；Treasury config 为 `4tf9zEjvj2BUR9ZaAr53sQdULDWGGpJTr2zngSrmjtN6`。个人状态和交易条件主要依据当前源码，不能写成已通过真实钱包验收。

## 推进判断与实施前必须补齐的条件

1. **最容易独立推进：G02/G03/G08，即当前 GT/VIP + Global 当前周期。** 数据来自 Store/userHeader，不等待新 gmx-api、旧 Web、keeper 或 SQD。实施验收应覆盖真实账户数值、未连接、无 userHeader、切换 owner/network、RPC 失败，并证明目标切片未引入上述服务调用。此切片不是完整 GT 页。
2. **其次：R01/R04/R08/R09 的当前推荐信息，以及单独立项的 R02/R03/R05。** 手动输入/创建/绑定路径不需要排行服务；若范围包含 Top GT Holders 则必须承认 Core SQD。写操作需明确程序版本、钱包和资金、广播通道及授权。
3. **历史/排行榜可提前开发，但必须确认索引契约和长期服务归属。** Core / GT 当前可只读访问，不等于新集成已获准长期依赖；迁移历史边界、查询失败和数据完整性应单独验收。
4. **Stats 顶部卡片实施量可能小，但仍需确认 R2 生产链路及新鲜度。** 完整市场列表需要旧 WS 或明确的新市场数据契约。不能因 HTTP 200 就跳过生产者和口径问题。
5. **完整 Stake / Buyback 暂不归入无外部依赖任务。** 质押与卖出依赖专用 keeper，解押/Claim/Claim Rent 有本地交易路径但仍需要可验收链上状态；公开查询成功不能代替完整资金与结果验收。

现有需求中，FESOL-1 原 GT/Earn 方向已 Canceled；FESOL-2 原方向偏统一 GMX Referral；FESOL-79 原方向明确复用 GMX Stats 布局。它们与“保留部分 GMTrade 呈现”不完全相同。上述为前轮查阅结果，本轮未重新修改 Linear，也未完成全状态 PR 差异去重。**本表提供功能/技术依赖事实，不直接宣告某条需求已无阻塞或无人覆盖。** 正式立项前，按实时 Linear、相关 PR 和最新代码确认范围与归属。
