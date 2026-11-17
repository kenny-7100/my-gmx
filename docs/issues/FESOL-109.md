# FESOL-109 — Solana 交易范围与时间节点

## 五需求晚间前置核验（2026-11-17）

前端63/80及SDK2.9.3、API#340现均已合并，需区分原线集成/部署/金融验收；详细增量统一记录。 角色为只读依赖调研，来源与验证边界见[统一核验](../solana-trading-dependencies.md#五需求晚间前置核验2026-11-17)。

## 补充 Cycle 2 已分配或已介入的前端工作（2026-11-17）

用户明确将协调表范围扩展为 Cycle 1 加上 Cycle 2 已分配 Kenny/Rainer/Sulliven、或实际已有前端介入/进展的工作，仍排除 Done。本轮官方 MCP 查询 Trading Cycle 2 全页（8 条，hasNextPage=false），其中迁移项目 4 条：TRD-70、84、83、119。

| 当前需求 | 历史编号 | 当前负责人 | 状态 | 当前周期 | 纳入依据 | 确认的实现 PR |
| --- | --- | --- | --- | --- | --- | --- |
| [TRD-70](https://linear.app/gmx-io/issue/TRD-70) | [FESOL-19](https://linear.app/gmx-io/issue/FESOL-19) | Kenny | In Progress | Cycle 2 | 已分配且已有实现；旧计划 Cycle 3 | [#3262](https://github.com/gmx-io/gmx-interface/pull/3262)，Open/Draft，仍有明确延期范围与验收条件 |
| [TRD-84](https://linear.app/gmx-io/issue/TRD-84) | [FESOL-59](https://linear.app/gmx-io/issue/FESOL-59) | Sulliven | In Progress | Cycle 2 | 已分配且状态为开发中；旧计划 Cycle 3 | 未确认独立实现 PR |
| [TRD-83](https://linear.app/gmx-io/issue/TRD-83) | [FESOL-28](https://linear.app/gmx-io/issue/FESOL-28) | 未分配 | Todo | Cycle 2 | 父需求已有子项 TRD-84 由 Sulliven 推进；Kenny 在 10 月 16 日评论确认评估并将补充技术前置 | 未确认独立实现 PR |

TRD-83 作为父级协调项补列，不代表整条已开工或已分配给 Sulliven/Kenny，不与 TRD-84 重复计算独立交付量；保证金增减等其余范围仍待明确实施负责人。TRD-119/FESOL-18 当前无负责人、Todo、无评论，未核实到实际介入或实现进展，因此未按新条件纳入；创建者为 Kenny 不等于当前已接手。Cycle 2 其他四条不属于此次 Solana 迁移项目/人员范围。

之前 Cycle 1 的 14 条保留，新增 2 条独立实施 issue，加 1 条父级协调项，展示合计 17 行。Cycle 字段不调整，Cycle 2 完整收口不代表届时才开工。本轮仅只读核验，未修改 Linear。TRD-84 未关联 PR，且 GitHub 按 FESOL-59/TRD-84 标题搜索无独立结果；#3207 正文提及其依赖，但不是本需求实现 PR。

## 上游跟进实施（2026-11-17）

TRD-101 相关 API #340 新增量索引候选 `996cf05db9` 已在独立干净checkout实测：105,529账户bootstrap，约32秒ready，未使用钱包过滤补丁；全局非空仓位、slot/freshness拒绝与恢复通过。原索引DB suite（含160k账户prune与追赶未完不serve）及四个金融/records suites共72 passed。只本地运行，未改上游源码/推送/发布；正式部署与完整负载验收仍另行。 统一来源、交付版本、验证和外部剩余项见[五需求跟进实施](../solana-trading-dependencies.md#五需求跟进实施2026-11-17)。

## Trading Cycle 1 前端筛选（2026-11-17）

补充PR实时核验：TRD-63→#3201、72→#3258、77→#3259、78→#3261、75→#3242（Merged）、98→#3195、85→#3223、65→#3193（已Merged，Linear仍In Test）、80→#3238、100→#3243。TRD-103/104均关联#3190，PR正文明确89/96，是同一reader/hook实现；#3195为下游余额集成。TRD-142仅关联#3120，但它是FESOL-48来源PR并明确延期110范围，不列为142的实现PR。TRD-136未确认独立PR；列表只保留确证的实现PR，未声称附属PR/未关联实现全部不存在。

本轮官方 MCP 全页查询 Trading Cycle 1（hasNextPage=false），筛选 Kenny/Rainer/Sulliven 及未分配的前端相关工作，排除 Done/Canceled/Duplicate。共14条：Kenny4、Rainer3、Sulliven4、未分配3。旧编号通过迁移前快照 UUID 匹配；TRD-136为新建需求，无旧FESOL编号，读取完整正文确认它涉及共享TradeBox真实交易本地联调、钱包/发送/生命周期及API环境协作，属于前端参与的跨侧联调，非纯UI实现。

| 当前编号 | 旧编号 | 负责人 | 当前状态 |
| --- | --- | --- | --- |
| TRD-63 | FESOL-15 | Kenny | In Review |
| TRD-72 | FESOL-56 | Kenny | In Review |
| TRD-77 | FESOL-72 | Kenny | In Progress |
| TRD-78 | FESOL-20 | Kenny | In Progress |
| TRD-75 | FESOL-57 | Rainer | In Review |
| TRD-98 | FESOL-51 | Rainer | In Review |
| TRD-85 | FESOL-29 | Rainer | In Review |
| TRD-80 | FESOL-25 | Sulliven | In Review |
| TRD-65 | FESOL-52 | Sulliven | In Test |
| TRD-100 | FESOL-92 | Sulliven | In Review |
| TRD-142 | FESOL-110 | Sulliven | In Progress |
| TRD-104 | FESOL-89 | 未分配 | In Progress |
| TRD-103 | FESOL-96 | 未分配 | In Progress |
| TRD-136 | 无 | 未分配 | In Progress |

与此前对话不同，FESOL-110现已迁移为TRD-142并在Cycle1，不沿用旧Release观察。TRD-105/106为Done排除；TRD-70/84位于Cycle2，不计入当前Cycle1成员（跨周期阶段目标仍保留）。本轮只查询，未修改Linear，不将状态解读为代码/部署验收结论。

## TRD-101 正文全部 FESOL 引用映射（2026-11-16）

用户随后明确授权实施，已通过 Linear patch 将 38 条已迁移需求在 TRD-101 正文中的全部引用（显示编号与 URL）更新为核实的 TRD 编号。保留 FESOL-79/110/114 以及 DES 引用；未追加解释文字或改动原计划语义。更新前从最新正文生成完整编号匹配的预期结果，patch 仅覆盖 Markdown 引用；更新后独立 get_issue 回读，正文与预期逐字符完全一致，确认没有其他正文差异。未修改任何关联任务属性、团队或周期。

替换前二次核验：再次读取最新 TRD-101，仍为 41 个不同 FESOL 引用；41 条均以旧编号实时查询，38 条迁移项再用对应 TRD 编号独立查询，UUID/当前编号全部一致。41 条同时与 2026-11-12T17:47:06.125Z 迁移前快照比较，UUID 与标题均无差异；41 个 UUID 互不重复，无多对一误配。确认可按下表更新 38 条不同迁移项的全部引用，FESOL-79/110/114 保留；核验完成后仍未修改 Linear 正文。

实时读取 TRD-101 正文并去重提取 41 个 FESOL 引用，逐条用官方 Linear MCP get_issue 解析旧编号，核验返回的当前编号、标题、团队和 URL。其中 38 个已迁移到 Trading；FESOL-79、110、114 仍在 Solana Frontend，没有对应的迁移后 TRD 编号。此次只查询，不修改正文、团队或任何任务。范围不限前述 UI/负责人/状态筛选，未递归提取被引用需求正文内的其他编号。

| 原引用 | 当前编号 | 当前需求标题 |
| --- | --- | --- |
| FESOL-15 | [TRD-63](https://linear.app/gmx-io/issue/TRD-63/display-solana-markets-in-the-gmx-market-dropdown-and-primary-header) | Display Solana markets in the GMX market dropdown and primary header |
| FESOL-29 | [TRD-85](https://linear.app/gmx-io/issue/TRD-85/support-solana-price-and-depth-charts-in-gmx) | Support Solana Price and Depth Charts in GMX |
| FESOL-51 | [TRD-98](https://linear.app/gmx-io/issue/TRD-98/show-solana-balances-from-the-gmx-rpc) | Show Solana balances from the GMX RPC |
| FESOL-25 | [TRD-80](https://linear.app/gmx-io/issue/TRD-80/display-solana-positions-and-open-orders) | Display Solana Positions and Open Orders |
| FESOL-57 | [TRD-75](https://linear.app/gmx-io/issue/TRD-75/add-gmsol-variants-to-the-sdk-trade-math) | Add gmsol variants to the SDK trade math |
| FESOL-92 | [TRD-100](https://linear.app/gmx-io/issue/TRD-100/add-sdk-unit-conversions-for-solana-order-inputs) | Add SDK unit conversions for Solana order inputs |
| FESOL-56 | [TRD-72](https://linear.app/gmx-io/issue/TRD-72/build-check-and-send-solana-order-transactions-with-the-gmsol-sdk) | Build, check and send Solana order transactions with the gmsol SDK |
| FESOL-61 | [TRD-102](https://linear.app/gmx-io/issue/TRD-102/write-the-solana-api-spec-and-sample-responses) | Write the Solana API spec and sample responses |
| FESOL-113 | [TRD-99](https://linear.app/gmx-io/issue/TRD-99/call-the-solana-api-through-the-sdk-client) | Call the Solana API through the SDK client |
| FESOL-52 | [TRD-65](https://linear.app/gmx-io/issue/TRD-65/feed-the-solana-trade-state-from-gmx-api) | Feed the Solana trade state from gmx-api |
| FESOL-112 | [TRD-108](https://linear.app/gmx-io/issue/TRD-108/switch-solana-positions-to-the-gmsol-variants-of-the-sdk-trade-math) | Switch Solana positions to the gmsol variants of the SDK trade math |
| FESOL-67 | [TRD-107](https://linear.app/gmx-io/issue/TRD-107/load-check-the-solana-service) | Load-check the Solana service |
| FESOL-89 | [TRD-104](https://linear.app/gmx-io/issue/TRD-104/read-raw-solana-wallet-balances-through-the-gmx-rpc) | Read raw Solana wallet balances through the GMX RPC |
| FESOL-96 | [TRD-103](https://linear.app/gmx-io/issue/TRD-103/add-a-lazy-solana-balance-hook-with-network-scoped-caching) | Add a lazy Solana balance hook with network-scoped caching |
| FESOL-90 | [TRD-106](https://linear.app/gmx-io/issue/TRD-106/isolate-solana-trade-cache-and-storage-keys-by-network) | Isolate Solana trade cache and storage keys by network |
| FESOL-91 | [TRD-105](https://linear.app/gmx-io/issue/TRD-105/add-network-aware-token-lookup-for-solana-mints) | Add network-aware token lookup for Solana mints |
| FESOL-19 | [TRD-70](https://linear.app/gmx-io/issue/TRD-70/adapt-perp-order-entry) | Adapt Perp Order Entry |
| FESOL-20 | [TRD-78](https://linear.app/gmx-io/issue/TRD-78/show-solana-market-order-sending-and-filling-status) | Show Solana Market Order Sending and Filling Status |
| FESOL-59 | [TRD-84](https://linear.app/gmx-io/issue/TRD-84/close-positions-edit-and-cancel-orders-on-solana) | Close positions, edit and cancel orders on Solana |
| FESOL-71 | [TRD-109](https://linear.app/gmx-io/issue/TRD-109/prepare-mainnet-testing-lookup-tables-and-ui-flags) | Prepare mainnet testing: lookup tables and UI flags |
| FESOL-72 | [TRD-77](https://linear.app/gmx-io/issue/TRD-77/build-the-gmsol-sdk-from-v0100-in-gmx-ci-and-replace-the-pinned-build) | Build the gmsol SDK from v0.10.0 in GMX CI and replace the pinned build |
| FESOL-110 | [FESOL-110](https://linear.app/gmx-io/issue/FESOL-110/follow-up-the-solana-pages-tradebox-entries-and-chat-gaps-left-by)（仍在旧团队） | Follow up the Solana pages, TradeBox entries, and chat gaps left by FESOL-48 |
| FESOL-28 | [TRD-83](https://linear.app/gmx-io/issue/TRD-83/adapt-solana-position-and-order-actions-to-gmx) | Adapt Solana Position and Order Actions to GMX |
| FESOL-114 | [FESOL-114](https://linear.app/gmx-io/issue/FESOL-114/block-solana-actions-in-gmx-when-the-wallet-lacks-sol-for-gas)（仍在旧团队） | Block Solana actions in GMX when the wallet lacks SOL for gas |
| FESOL-18 | [TRD-119](https://linear.app/gmx-io/issue/TRD-119/technical-side-multilingual-alignment) | [Technical side] Multilingual alignment |
| FESOL-86 | [TRD-117](https://linear.app/gmx-io/issue/TRD-117/support-solana-tradfi-markets-stocks-fx-and-commodities) | Support Solana TradFi markets: stocks, FX and commodities |
| FESOL-30 | [TRD-89](https://linear.app/gmx-io/issue/TRD-89/support-solana-trades-in-gmx) | Support Solana Trades in GMX |
| FESOL-31 | [TRD-90](https://linear.app/gmx-io/issue/TRD-90/support-solana-claims-in-gmx) | Support Solana Claims in GMX |
| FESOL-32 | [TRD-91](https://linear.app/gmx-io/issue/TRD-91/support-the-solana-net-rate-chart-in-gmx) | Support the Solana Net Rate Chart in GMX |
| FESOL-33 | [TRD-110](https://linear.app/gmx-io/issue/TRD-110/support-solana-swap-in-gmx) | Support Solana Swap in GMX |
| FESOL-8 | [TRD-111](https://linear.app/gmx-io/issue/TRD-111/support-receiving-and-sending-assets-on-solana) | Support receiving and sending assets on Solana |
| FESOL-6 | [TRD-92](https://linear.app/gmx-io/issue/TRD-92/support-solana-wallet-connections-and-asset-visibility) | Support Solana wallet connections and asset visibility |
| FESOL-3 | [TRD-116](https://linear.app/gmx-io/issue/TRD-116/integrate-solana-pools-and-liquidity-actions-into-gmx) | Integrate Solana Pools and liquidity actions into GMX |
| FESOL-79 | [FESOL-79](https://linear.app/gmx-io/issue/FESOL-79/adapt-the-stats-page-for-solana)（仍在旧团队） | Adapt the Stats Page for Solana |
| FESOL-102 | [TRD-115](https://linear.app/gmx-io/issue/TRD-115/support-the-solana-earn-page-in-gmx) | Support the Solana Earn Page in GMX |
| FESOL-104 | [TRD-114](https://linear.app/gmx-io/issue/TRD-114/support-the-solana-referrals-page-in-gmx) | Support the Solana Referrals Page in GMX |
| FESOL-105 | [TRD-113](https://linear.app/gmx-io/issue/TRD-113/support-the-solana-gt-points-page-in-gmx) | Support the Solana GT Points Page in GMX |
| FESOL-106 | [TRD-112](https://linear.app/gmx-io/issue/TRD-112/support-staking-in-gmx-solana-gt-points) | Support Staking in GMX Solana GT Points |
| FESOL-26 | [TRD-118](https://linear.app/gmx-io/issue/TRD-118/ask-gmtrade-for-notice-before-program-upgrades) | Ask GMTrade for notice before program upgrades |
| FESOL-116 | [TRD-69](https://linear.app/gmx-io/issue/TRD-69/confirm-solana-market-listing-dates-for-new-and-recently-listed) | Confirm Solana market listing dates for New and Recently Listed |
| FESOL-5 | [TRD-62](https://linear.app/gmx-io/issue/TRD-62/unify-the-solana-trade-page-with-the-gmx-standard) | Unify the Solana Trade page with the GMX standard |

## 旧 Cycle 2/3 编号对照（2026-11-16）

用户要求列旧周期 issue 与新编号对照。本轮用官方 Linear MCP 全页读取 Trading（135 条，hasNextPage=false），与 2026-11-12T17:47:06.125Z 的迁移前 FESOL 快照按 issue UUID 匹配，下面 30 个不同 issue 中 29 个已迁移、FESOL-110 仍在旧团队。只查询，未改 Linear。

范围依据为历史 FESOL-109 计划正文；这是计划清单及后续补充依赖，不冒充迁移前实际 cycle 字段的完整备份（旧快照没有 cycle 字段）。旧 Cycle 2 为 10 月 26 日至 11 月 9 日边界，Cycle 3 为 11 月 9 日至 23 日边界。主清单按早期计划分组，后续 11 月 12 日 Cycle 3 扩展依赖单列；FESOL-65 跨周期重复展示。FESOL-112 在旧 Cycle 3 正文中明确仍分配旧 Cycle 4，仅为 Cycle 3 财务验收前置，不能误列成旧 Cycle 2/3 实际成员。旧周期现存列表主要为未迁移的 GMTrade 任务，不能以此反推完整迁移清单。

旧 Cycle 2 计划主清单

| 旧编号 | 当前编号 | 当前标题 | 当前 Trading cycle |
| --- | --- | --- | --- |
| FESOL-7 | [TRD-120](https://linear.app/gmx-io/issue/TRD-120/integrate-solana-network-selection-and-app-navigation-inside-gmx) | Integrate Solana network selection and app navigation inside GMX | 未分配 |
| FESOL-42 | [TRD-97](https://linear.app/gmx-io/issue/TRD-97/connect-external-solana-wallets-through-privy) | Connect external Solana wallets through Privy | 未分配 |
| FESOL-51 | [TRD-98](https://linear.app/gmx-io/issue/TRD-98/show-solana-balances-from-the-gmx-rpc) | Show Solana balances from the GMX RPC | Cycle 1 |
| FESOL-48 | [TRD-122](https://linear.app/gmx-io/issue/TRD-122/hide-evm-only-features-on-solana) | Hide EVM-only features on Solana | 未分配 |
| FESOL-15 | [TRD-63](https://linear.app/gmx-io/issue/TRD-63/display-solana-markets-in-the-gmx-market-dropdown-and-primary-header) | Display Solana markets in the GMX market dropdown and primary header | Cycle 1 |
| FESOL-52 | [TRD-65](https://linear.app/gmx-io/issue/TRD-65/feed-the-solana-trade-state-from-gmx-api) | Feed the Solana trade state from gmx-api | Cycle 1 |
| FESOL-29 | [TRD-85](https://linear.app/gmx-io/issue/TRD-85/support-solana-price-and-depth-charts-in-gmx) | Support Solana Price and Depth Charts in GMX | Cycle 1 |
| FESOL-50 | [TRD-86](https://linear.app/gmx-io/issue/TRD-86/add-solana-prices-candles-and-the-24h-change-from-gmxs-oracle-keeper) | Add Solana prices, candles and the 24h change from GMX's oracle keeper | 未分配 |
| FESOL-63 | [TRD-131](https://linear.app/gmx-io/issue/TRD-131/map-solana-mints-to-the-arbitrum-oracle-keeper-prices) | Map Solana mints to the Arbitrum oracle keeper prices | 未分配 |
| FESOL-64 | [TRD-130](https://linear.app/gmx-io/issue/TRD-130/serve-solana-market-config-and-values-from-the-chain) | Serve Solana market config and values from the chain | 未分配 |
| FESOL-65 | [TRD-129](https://linear.app/gmx-io/issue/TRD-129/serve-solana-positions-and-orders-from-the-chain) | Serve Solana positions and orders from the chain | 未分配 |
| FESOL-66 | [TRD-125](https://linear.app/gmx-io/issue/TRD-125/route-solanagmxapiio-to-api-solana-and-add-monitors) | Route solana.gmxapi.io to api-solana and add monitors | 未分配 |

旧 Cycle 3 计划主清单

| 旧编号 | 当前编号 | 当前标题 | 当前 Trading cycle |
| --- | --- | --- | --- |
| FESOL-25 | [TRD-80](https://linear.app/gmx-io/issue/TRD-80/display-solana-positions-and-open-orders) | Display Solana Positions and Open Orders | Cycle 1 |
| FESOL-19 | [TRD-70](https://linear.app/gmx-io/issue/TRD-70/adapt-perp-order-entry) | Adapt Perp Order Entry | Cycle 2 |
| FESOL-56 | [TRD-72](https://linear.app/gmx-io/issue/TRD-72/build-check-and-send-solana-order-transactions-with-the-gmsol-sdk) | Build, check and send Solana order transactions with the gmsol SDK | Cycle 1 |
| FESOL-57 | [TRD-75](https://linear.app/gmx-io/issue/TRD-75/add-gmsol-variants-to-the-sdk-trade-math) | Add gmsol variants to the SDK trade math | Cycle 1 |
| FESOL-20 | [TRD-78](https://linear.app/gmx-io/issue/TRD-78/show-solana-market-order-sending-and-filling-status) | Show Solana Market Order Sending and Filling Status | Cycle 1 |
| FESOL-59 | [TRD-84](https://linear.app/gmx-io/issue/TRD-84/close-positions-edit-and-cancel-orders-on-solana) | Close positions, edit and cancel orders on Solana | Cycle 2 |
| FESOL-65 | [TRD-129](https://linear.app/gmx-io/issue/TRD-129/serve-solana-positions-and-orders-from-the-chain) | Serve Solana positions and orders from the chain | 未分配 |
| FESOL-67 | [TRD-107](https://linear.app/gmx-io/issue/TRD-107/load-check-the-solana-service) | Load-check the Solana service | Cycle 1 |
| FESOL-71 | [TRD-109](https://linear.app/gmx-io/issue/TRD-109/prepare-mainnet-testing-lookup-tables-and-ui-flags) | Prepare mainnet testing: lookup tables and UI flags | Cycle 1 |

旧 Cycle 3 补充前置/联调依赖

| 旧编号 | 当前编号 | 当前标题 | 当前 Trading cycle |
| --- | --- | --- | --- |
| FESOL-61 | [TRD-102](https://linear.app/gmx-io/issue/TRD-102/write-the-solana-api-spec-and-sample-responses) | Write the Solana API spec and sample responses | Cycle 1 |
| FESOL-72 | [TRD-77](https://linear.app/gmx-io/issue/TRD-77/build-the-gmsol-sdk-from-v0100-in-gmx-ci-and-replace-the-pinned-build) | Build the gmsol SDK from v0.10.0 in GMX CI and replace the pinned build | Cycle 1 |
| FESOL-89 | [TRD-104](https://linear.app/gmx-io/issue/TRD-104/read-raw-solana-wallet-balances-through-the-gmx-rpc) | Read raw Solana wallet balances through the GMX RPC | Cycle 1 |
| FESOL-90 | [TRD-106](https://linear.app/gmx-io/issue/TRD-106/isolate-solana-trade-cache-and-storage-keys-by-network) | Isolate Solana trade cache and storage keys by network | Cycle 1 |
| FESOL-91 | [TRD-105](https://linear.app/gmx-io/issue/TRD-105/add-network-aware-token-lookup-for-solana-mints) | Add network-aware token lookup for Solana mints | Cycle 1 |
| FESOL-92 | [TRD-100](https://linear.app/gmx-io/issue/TRD-100/add-sdk-unit-conversions-for-solana-order-inputs) | Add SDK unit conversions for Solana order inputs | Cycle 1 |
| FESOL-96 | [TRD-103](https://linear.app/gmx-io/issue/TRD-103/add-a-lazy-solana-balance-hook-with-network-scoped-caching) | Add a lazy Solana balance hook with network-scoped caching | Cycle 1 |
| FESOL-110 | [FESOL-110](https://linear.app/gmx-io/issue/FESOL-110) | Follow up the Solana pages, TradeBox entries, and chat gaps left by FESOL-48 | 仍在旧团队 |
| FESOL-112 | [TRD-108](https://linear.app/gmx-io/issue/TRD-108/switch-solana-positions-to-the-gmsol-variants-of-the-sdk-trade-math) | Switch Solana positions to the gmsol variants of the SDK trade math | Cycle 1 |
| FESOL-113 | [TRD-99](https://linear.app/gmx-io/issue/TRD-99/call-the-solana-api-through-the-sdk-client) | Call the Solana API through the SDK client | Cycle 1 |

## 已执行 Trading cycle 关联（2026-11-15）

用户明确授权根据 Divhead 的 TRD-101 规划更新 PM 关注的 Trading Cycles，要求避免误导。本轮通过已有 Chrome 登录态执行，参与角色为排期整理与协调，不代表接管整体集成/验收，也未发送消息或评论。

- [Cycle 1](https://linear.app/gmx-io/team/TRD/cycle/1)（11 月 16–29 日）新增关联 19 条；页面总数从 29 增至 48 issues。
- [Cycle 2](https://linear.app/gmx-io/team/TRD/cycle/2)（11 月 30 日至 12 月 13 日）新增关联 4 条；页面总数从 4 增至 8 issues。总数包含其他工作，不等于 Solana 范围。
- 两个周期的 planning 均附上原始 [TRD-101](https://linear.app/gmx-io/issue/TRD-101/solana-trading-plan) 链接；分别新建 [Cycle 1 scope and handoff](https://linear.app/gmx-io/document/solana-cycle-1-scope-and-handoff-7282d8675025) 与 [Cycle 2 completion and acceptance](https://linear.app/gmx-io/document/solana-cycle-2-completion-and-acceptance-ea490bd24c0a)，并互相链接。重新打开确认正文、状态解释及跨周期边界已保存。

| 周期 | 原编号 → Trading 编号 |
| --- | --- |
| Cycle 1：原定 11 月 16 日前的剩余交付/联调/验收 | FESOL-15 → TRD-63；29 → 85；51 → 98；25 → 80；57 → 75；92 → 100；56 → 72；61 → 102；113 → 99；52 → 65 |
| Cycle 1：余额、隔离、交易状态与部署验证 | FESOL-89 → TRD-104；96 → 103；90 → 106；91 → 105；20 → 78；71 → 109；112 → 108；67 → 107；72 → 77 |
| Cycle 2：完整范围收口 | FESOL-19 → TRD-70；59 → 84；28 → 83；18 → 119 |

每条最终 cycle 属性在操作阶段均核验；最终另核验两周期总数和 planning 附件。TRD-70、84、83 按完整 issue 的收口周期放入 Cycle 2，文档明确其 Cycle 1 开始开发/联调及市场单 TP/SL、平仓、开仓→执行→刷新→平仓阶段目标仍有效；单个 issue 只能属于一个 cycle，不表示 11 月 30 日才开始。TRD-70 既有延期子范围仍需明确恢复决定，排期不自动恢复开发。没有重置已开发成果或把排期解释为完成验收。

已观察的 Linear 自动行为及处理：给父 issue 分配 cycle 会带入部分尚无 cycle 的活动子项，已逐一核对；TRD-77 曾随 TRD-70 自动进 Cycle 2，已明确改回 Cycle 1 并核验。抽样已完成子项 TRD-64、86 保持 Done、无 cycle。Backlog issue 排入 cycle 自动转 Todo，改回 Backlog 会移出 cycle；TRD-83、119 因此保留系统生成的 Todo（原为 Backlog），文档明确这是排期而非已开工。没有将任务改成 In Progress/Done，未改负责人、估点、issue 到期日、周期日期或原计划正文。

仍需人工决定的缺口已直接写在周期说明中：

- TRD-104、103 无负责人；TRD-83、119 无负责人及估点，不能认为容量与责任已经确认。
- [FESOL-114](https://linear.app/gmx-io/issue/FESOL-114) 仍在 Solana Frontend/Triage，负责人 Kenny，未迁移或强行排入 Trading。交易相关 SOL 检查属于计划 Cycle 2 范围，团队/triage 处理待确认；GM/GLV/pool 扩展范围不提前纳入。TRD-72 的部分 SOL 检查不证明整条需求完成。
- FESOL-110 仍在旧团队、Release、无 project，未重开/迁移；Cycle 1 说明保留组合前端导航/support 验收核对。DES-65 保留 Design team，仅作验收参考。
- 11 月 30 日交易闭环是两周期交接检查点；12 月 14 日观察边界保留在 Cycle 2 文档，未悄悄改成 13 日结束。12 月 10 日公开目标以验收和重估为条件。TradFi、history、Claims、Net rate、Swap/转账、Pools/Stats、Earn/Referrals/GT 等仍属后续范围。

本轮验证限于 Linear 关系、页面和文档保存；未据此认证 PR、部署、真实钱包/keeper 测试、实际容量或发布日期。

## Trading 迁移后的当前入口（2026-11-15）

用户提供 PM 对话确认 11 月 14 日已将 unification issues 移至 Trading team，并要求 Kenny 重新规划 Trading cycles。本轮通过用户现有 Chrome 原生窗口只读核验：旧 FESOL-109 URL 自动跳转至 [TRD-101 · Solana trading plan](https://linear.app/gmx-io/issue/TRD-101/solana-trading-plan)，不是已删除需求。Activity 显示 chloeee 于 11 月 14 日 10:33:42 将团队从 Solana Frontend 改为 Trading、状态由 Review 改为 In Progress，并移出旧 Cycle 3；当前属性为 Add to cycle，尚未分配新 cycle，assignee 为 Divhead。

- 旧周期列表：[Solana Frontend Cycles](https://linear.app/gmx-io/team/FESOL/cycles)。Cycle 1/2/3/4 起始日分别为 10 月 12 日、10 月 26 日、11 月 9 日、11 月 23 日；旧 Cycle 3 页面仍可访问，不作为新的 Trading 分配。
- 新周期列表：[Trading Cycles](https://linear.app/gmx-io/team/TRD/cycles)。[Cycle 1](https://linear.app/gmx-io/team/TRD/cycle/1) UI 显示 11 月 16–29 日；[Cycle 2](https://linear.app/gmx-io/team/TRD/cycle/2) UI 显示 11 月 30 日至 12 月 13 日。计划正文写 11 月 16–30 日、11 月 30 日至 12 月 14 日，需区分正文周期边界与 UI 显示的末日，不擅自改期。
- 当前 TRD-101 正文已简化为 Trading Cycle 1/2 计划：11 月 20 日 API/数学/负载验证、11 月 30 日交易闭环与目标重估、12 月 4 日实现收口、7–8 日验收、9 日修复与复验、10 日验收后公开、11–14 日观察。日期是计划目标，不是当前完成或上线承诺。
- 项目入口仍为 [GMX and GMTrade Frontend Unification](https://linear.app/gmx-io/project/gmx-and-gmtrade-frontend-unification-0774804d1299)。本轮所见两个新 cycle 的 planning 区域只有 Add document or link，未见已附时间线文档；已确认的总计划入口是 TRD-101。

现有 CLI API key 的 teams 查询只返回 FESOL，无法据此判断 TRD 不存在；浏览器登录态可访问 Trading 与迁移后的需求。后续查迁移需求应优先识别 TRD 新编号，不再将旧 FESOL 团队快照当完整范围。本轮未改 Linear、周期或正文；以下 11 月 13 日记录保留为迁移前历史。

更新：2026-11-13。参与角色：需求查询与计划口径记录，未认领业务实现。
来源：[FESOL-109](https://linear.app/gmx-io/issue/FESOL-109)；本次实时抓取时间为 2026-11-13 00:00（Asia/Shanghai），正文 updatedAt 为 2026-11-12T06:42:35.152Z，评论为空。

## 当前执行口径

- 用户于 2026-11-13 明确：该 issue 是最新制定的时间节点；Cycle 2 已开发完成，部分 issue 仍在 review 或测试，目前处于 Cycle 3。后续讨论沿用这一实际阶段描述；开发完成、review 完成和测试验收完成分别判断，不将 review/test 状态直接解释为尚未开发。
- 正文同时保留两套周期编号：Solana Frontend Cycle 2 为 10 月 26 日至 11 月 9 日，Cycle 3 为 11 月 9 日至 23 日；11 月 11 日新增的 Trading Cycle 1 为 11 月 16 日至 30 日，Trading Cycle 2 为 11 月 30 日至 12 月 14 日。正文明确后者控制排期，较早章节作为历史上下文。用户所述当前 Cycle 3 与前一套编号对应；交流时写明周期体系，避免把它误认为未来的 Trading Cycle 2。

## 最新正文中的交付目标

- 11 月 20 日：钱包/数据基础、交易构建器及已评审 SDK 数学发布与 API 接入目标；11 月 23 日：受控主网交易试点；11 月 27 日：索引部署上的交易、数据一致性与故障/恢复核验；11 月 30 日：重估公开发布目标。
- 12 月 4 日前完成必需实现；12 月 7–8 日完成验收；12 月 9 日修复、复验并作发布决定；12 月 10 日为通过验收后的公开启用目标；12 月 11–14 日观察及修复回归。12 月 24 日仅为应急日期，未获替代发布日期批准。
- 首发要求包括限价、订单编辑/取消、抵押品增减；Depth 默认保留，延期须明确决定。金融正确性与索引后端验收属于必需条件。TradFi、历史、Claims、Swap、转账、Pools、Stats、Earn、Referrals、GT/staking 不进入 12 月 10 日交易关键路径。
- API 交接分别核验索引实现、已发布 SDK 数学接入和实际部署；单个 PR 合并、本地测试或直读 RPC 的内部试点不能替代整体验收。正文历史 PR/分配快照不作为本次最新工程状态。

## 核验边界

本次读取正文、关系与评论，并记录用户补充的开发阶段；未全量核验子 issue、GitHub PR、代码、SDK 发布或部署，因此不提供实际完成率，也不确认正文中各项依赖当前仍然阻塞。未修改 Linear 或发布外部消息。
