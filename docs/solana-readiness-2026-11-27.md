# Solana 前端迁移实施候选 — 2026-11-27

角色：只读全局就绪评估，未认领、开发或修改 Linear。按用户目标优先复用 GMX 前端组件、共享模型与交互，采用 GMX API / Solana RPC / 协议 SDK，不依赖 GMTrade SQD 或旧业务后端。开工、完整实施与最终验收分别判断；不存在外部阻塞不等于已实现或已验收。

本轮建议：**Kenny 当前首选继续推进 TRD-158。** 若关注新的产品功能，技术条件最充分的队列为 TRD-213、TRD-110、TRD-91、TRD-116，但均已有负责人，应沿原归属推进，不重复认领。未分配需求中暂未核实出另一条既无外部数据缺口、又能完整独立交付的产品任务；TRD-151 是可并行推进前端部分的候选，不能冒充整单就绪。TRD-222 随消费流程逐项接入。

## 范围与来源

官方 Linear MCP 全量读取 Unification 项目 88 条（含归档，hasNextPage=false）：Trading 75 条，另有 13 条设计/旧团队历史记录。75 条 Trading 均逐条读取完整正文与关系；重点12项补读全部评论。Trading 状态为 Done 38、Duplicate 9、其余28；包含非 Solana 专属 TRD-207，不将项目条目数当实际迁移进度。13条额外记录含4条当前设计 DES-65/88/89/90，其余 Canceled/Duplicate。未见 GMTrade 标签冲突。

复用同会话已核实的 Pools/SDK 观察，并刷新公开 PR 全列表、相关 head、review/threads/checks。只读下载固定源码至忽略目录 `.local/solana-readiness-20261127/`，未移动 checkout/gitlink。无浏览器、业务测试、构建、签名、广播或部署。

| 来源 | 固定版本/观察 |
| --- | --- |
| interface release | `5342ad8e1d564813f78a143d93c1a8d73c01cba4` |
| gmx-api main | `5e43dae3fdb665aff39ff12f56a2a6de2054ff3b` |
| 协议 SDK main（同会话核验） | `aa793774927a596180f11a82ae40ac8fdd1149d7`；不等同应用固定 WASM |
| [交易 #3337](https://github.com/gmx-io/gmx-interface/pull/3337) | OPEN / release / `8b7dbfc26ce8a104a5385308ba903d29137cc467` |
| [保证金 #3335](https://github.com/gmx-io/gmx-interface/pull/3335) | OPEN / release / `664fa1ac5c6b334f12d8af6afe8c8a3d41ee0bdc` |
| [Net Rate #3362](https://github.com/gmx-io/gmx-interface/pull/3362) | OPEN / release / `d278ca5d51d5170c683f7dc8e726ad2e408477b2` |

以上三个 PR 当前可见检查均 SUCCESS、REVIEW_REQUIRED；无正式 reviews，reviewThreads 分页结束、无未解决线程，不表示已经人工审查通过。3337 完整 diff 因超过 GitHub 20,000 行限制返回406，改读固定 head 的相关 sender/builder/session 源码；未声称全 PR 复审。3335 读取正文、文件 patch及保证金接入范围；3362 阅读实际 diff。

## 可实施队列

以下按当前接续价值排列，既有实施工作与新候选分开理解，不改变 Linear 排期或归属。

| 顺序 | 需求 / 当前状态及负责人 | 实际工作与复用基础 | 开工及完整交付边界 |
| --- | --- | --- | --- |
| 1 | [TRD-158](https://linear.app/gmx-io/issue/TRD-158) SOL 不足保护；In Progress / Kenny | 复用3337签名前模拟、真实费用与余额检查，统一订单/保证金消费端错误提示与失败归因 | **当前范围可实施**；集成已核验的3337与3335必要增量，依赖未合并不单独阻止开工。最终须组合验证，不能将GM/GLV再列作本单阻塞 |
| 2 | [TRD-213](https://linear.app/gmx-io/issue/TRD-213) 钱包收发；In Progress / Sulliven | 复用钱包Receive/QR/资产组件，kit/System/Token构造SOL/SPL发送，缺ATA/rent/Max/pending/确认刷新 | **可实施**；Receive无需新签名契约，Send的signTransaction在3337，release尚没有。可集成开发，独立交付需前置收敛；不需要gmsol交易调用或新增GMX API接口 |
| 3 | [TRD-110](https://linear.app/gmx-io/issue/TRD-110) Swap；In Progress / Sulliven | 共享Swap报价/组件，补Solana构造、验证、签名与执行生命周期；SOL/WSOL转换 | **可实施**，复用11/24固定WASM无签名构造证据，未重新运行。现有池范围可做；完全等价覆盖仍需对齐先前识别的三池API范围，disabled池不擅自启用 |
| 4 | [TRD-91](https://linear.app/gmx-io/issue/TRD-91) Net Rate；In Progress / Rainer | 共享图表与现成正式rates；前端接线已在3362，包含network/API环境cache、缺口/孤立样本及不足历史显示 | **已在实施，转为推进现有PR/验收**；不要重开。30天覆盖仍需采集，不能把CI成功当分支预览或完整历史验收 |
| 5 | [TRD-116](https://linear.app/gmx-io/issue/TRD-116) Pools；Refining / Sulliven | 共享Pools列表/详情/操作，GMX市场数据+RPC/SDK接GM/GLV存取 | **可开工**；APY/performance等正式数据覆盖和固定WASM待核实，不能承诺整单不需API协作。复用UI，不等新设计，不采用旧SQD |
| 6 | [TRD-222](https://linear.app/gmx-io/issue/TRD-222) 其他交易SOL保护；Todo / Kenny | 复用158的共用检查，随钱包发送/Swap/Pools/Claims/GT/推荐码动作逐项接入 | **可做共用部分并随产品推进**；完整AC依赖六类产品实际发送能力，不能作为当前可一次性独立完成的整单 |

最小有效验收：158覆盖不足/足额、实际费用账户、多步/竞态及错误区分；213覆盖Receive和SOL/SPL发送至缺少ATA的收款方、Max、关闭弹窗后的pending与确认刷新；110覆盖真实报价、受支持路由及wrap/unwrap完整生命周期；91覆盖正式API、切网cache、符号精度、缺口/错误及预览；116阶段实现不替代GM/GLV和全页面AC。真实签名与广播仍需对应授权。

## 尚不能称整单独立就绪的候选

| 顺序 | 需求 / 状态与负责人 | 可以做什么 | 具体缺口及解除方式 |
| --- | --- | --- | --- |
| 7 | [TRD-151](https://linear.app/gmx-io/issue/TRD-151) 客服；Refining / 未分配 | 共享Intercom、Solana钱包/网络上下文、恢复/未读/失败快照与去重 | 钱包total/30d volume及support Tier正式契约仍缺；先落实GMX数据来源/负责人。真实Intercom环境需验收，未验证权限不等于缺权限 |
| 8 | [TRD-210](https://linear.app/gmx-io/issue/TRD-210) Embedded；Backlog / Sulliven | 复用Privy、钱包选择恢复、资产与转账入口 | release Privy只配置ethereum.createOnLogin；Solana创建/访问需核验现有app配置/订阅及签名，完整转账复用213。适合先验证配置与实际API，不把未核验配置直接称外部阻塞 |
| 9 | [TRD-114](https://linear.app/gmx-io/issue/TRD-114) Referrals；Backlog / 未分配 | 承接正式UI3226，链上码创建/绑定/链接适配 | 完整历史volume/savings/rewards/referees与旧链接归属尚未闭合；当前fee-discount的rank/referrer不等于完整referral dashboard |
| 10 | [TRD-113](https://linear.app/gmx-io/issue/TRD-113) GT/Stake；Backlog / 未分配 | 承接正式UI3220，按动作做回购/租金回收/质押/领取/解押 | 历史/全局统计/回购曲线需正式数据；UI确认仅toast不等于交易具备。先拆动作与历史来源，保留Chloe对该批UI正式承接后推进的安排 |
| 11 | [TRD-115](https://linear.app/gmx-io/issue/TRD-115) Earn；Backlog / 未分配 | 承接正式UI3211，接统一GM/GLV与GT读模型 | 已质押+未质押资产与连续收益、LP lifetime和buyback收益去重需先稳定，不建议仅因UI现成就认定完整数据就绪 |
| 12 | [TRD-90](https://linear.app/gmx-io/issue/TRD-90) Claims；Refining / 未分配 | 共享Claims，核对手动funding结算/领取的同额同动作 | rebate真实可领状态、五天规则对应keeper与正式来源/历史未闭合；旧SQD实现不作为前置已满足，五天经过不证明可领取 |
| 13 | [TRD-89](https://linear.app/gmx-io/issue/TRD-89) Trades历史；Refining / 未分配 | 共享表格、过滤分页导出与事件mapper可设计 | 完整历史索引、事件费用/PnL/生命周期接口需GMX正式提供；现有orders/positions快照不等于事件历史。DES-65市场面板决策不得扩大成屏蔽个人历史 |
| 14 | [TRD-117](https://linear.app/gmx-io/issue/TRD-117) TradFi；Backlog / 未分配 | 前端模型与现有市场状态组件可准备 | 27个V8/V11价格流、闭市/盘外、列表和域名规则仍须逐项确认；本轮未深入重新验证keeper部署，不声称全部仍缺或已满足 |
| 15 | [TRD-223](https://linear.app/gmx-io/issue/TRD-223) 交易核心迁SDK；Triage / 未分配，正文Owner Divhead | 可提前评估独立入口与注入配置 | 正文明确3337及后续重构合并后再做，当前不推荐并行搬迁资金校验代码；不因自动建议Kenny就认定已分配 |

TRD-69是上市日期来源/口径确认任务，可协调，但不是已有数据可直接接线的前端功能。TRD-92为钱包父需求，与213/210不重复计数。TRD-72/70/78/84/83在既有交易/保证金PR中接续，不另起同范围开发。TRD-101/107/108/109/118为总计划、API/验收/配置或协调工作，不作为Kenny新的前端候选；TRD-207为Ecosystem内容维护，虽属该项目但非Solana专属功能。

## 关键代码与运行证据

- release `useRateSnapshots.ts`仍按selectChainId选择SDK；3362实际diff改按network与API环境隔离，复用共享图表。生产指定SOL/USDC市场30d GET HTTP200，190小时点，UTC11/19 09:00至11/27 06:00，跨度189小时（约7天21小时），不足30天；本轮未验证全市场/每个点的连续性，不扩为完整7天全市场验收。数据源沿`marketSnapshot → saveRateSample → solanaRates → getRateHistory`，非旧SQD。
- release `WalletProvider.tsx`的embeddedWallets只有ethereum；钱包session尚无signTransaction，3337加入该契约。release `MainView`仍隐藏Solana收发；基础balances/asset上下文存在。
- 3337 sender已有`GmsolInsufficientSolError`、InsufficientFundsForFee/Rent及lamports不足日志识别，文案仍为`Insufficient SOL for network and keeper fees, rent and wrapping`；当前158还需统一产品文案与各失败路径。其订单builder仍限制空swapPath，不把订单发送器当已支持Swap/Pools。
- release `useSupportChat`固定Environment EVM，`useShowSupportChat`在Solana禁用；已有钱包估值纯逻辑。缺完整wallet volume来源，不能用0或gtRank替代support Tier。
- 正式API Solana controller仍为markets、positions、orders、fee-discount、rates。通用v1/trades使用EVM地址校验/marketService/tradeService；未证明Solana完整历史可用。该结论来自调用路径与controller，不只是文件名检索。
- 正式UI3211/3220/3226均OPEN、release base、REVIEW_REQUIRED；同会话固定heads分别`b2467ec7b17da959ec0f35f5e6bfcab2a5e6c677`、`19e9b8cfeed77497bb3b5472522283a1859c4474`、`02715736ea12dccb5892843e247d462113c2f1dd`。重读正文/文件清单与固定业务Hook：数据为空、交易未接，Tester不是正式业务。无未解决review线程不等于已获得正式产品/技术验收。

## 相比11月24日的变化

Net Rate已从“没找到前端PR”变为3362待review/预览，优先推进已有成果；Pools本轮查询已为Refining/Sulliven，先前Backlog/未分配不再有效；Swap/收发也已由Sulliven推进。158明确拆去非永续范围后成为Kenny当前最直接可实施项，222为后续各动作共用保护。其余数据型需求没有因GMX组件存在而自动补齐数据前置。旧报告保留为历史，不继续沿用其公开PR和分配状态。

没有据本轮调查重新分派任务、创建PR或对外发送消息。何时改变推荐：新正式历史/统计接口、Privy配置核验、产品范围调整、前置PR合并/重构或现负责人交接；届时只刷新受影响项。
