# TRD-92 — Solana 钱包与转账

## 转账子项与协调表刷新（2026-11-25 14:24，北京时间）

实时父项仍Sulliven/In Progress/Cycle1，收发AC仍在正文；新增[TRD-213](https://linear.app/gmx-io/issue/TRD-213)是其正式子项，已于今天09:29进入In Progress，负责人Sulliven/Cycle1。子项正文明确Send依赖TRD-72的钱包session签名能力合入release；Receive独立推进，不依赖gmsol SDK/gmx-api新接口。此为当前交付契约，优先于下面昨日“未发现硬前置”的旧判断；不据此断言技术上无法在需求分支集成前置。已将关系、依赖补入线上提前讨论表，未修改需求本身。TRD-210 embedded继续单独跟踪。未确认专属公开实现PR，未重验代码或真实转账。

## 四条需求跟踪（2026-11-25 14:05，北京时间）

角色：只读跟踪。今天北京时间09:25由 Backlog 进入 In Progress，负责人仍 Sulliven；无评论、无 blockedBy。拆分后的外部钱包与资产收发范围不变，embedded仍由TRD-210承接。

本轮刷新四条Linear正文、关系和全部评论，并检查公开PR及release差异。按编号和开放PR关键词未确认这四条专属实现PR；不据此判断没有本地工作。release已到`a20f68913d`，较昨日基线新增价格REST/SDK类型改动，未改这四条核心接线；#3337仍OPEN、head `be9ca46ecb`。未运行UI/交易验收或修改Linear。

## 排除旧 SQD/后端后的复核（2026-11-24）

用户明确不引入 GMTrade SQD/后端。按当前拆分后的外部钱包、Receive、SOL/SPL Send 范围，现有 session、RPC 余额/转账和 GMX Arbitrum oracle keeper 估值可以承接，不需旧站的 SQD、ticker 或钱包资产聚合服务。前端可实施结论不变；不把旧站转账历史列表顺带纳入本单。TRD-210 embedded 的 Privy 服务/配置是另项验证，不属于旧 GMTrade 业务后端。仅依赖边界复核，未重新验收签名、广播或权限。

2026-11-24，参与角色：只读现状与 refining 调研，未认领实现。[Linear](https://linear.app/gmx-io/issue/TRD-92)。

## 当前范围（拆分后）

2026-11-24 23:10，按用户授权完成 Linear 拆分：TRD-92 保留现有 Privy 外部钱包基础上的连接/恢复、资产展示、Receive、SOL/SPL Send 与交易反馈；Solana embedded 的创建/访问、会话和签名接入迁至 [TRD-210](https://linear.app/gmx-io/issue/TRD-210)，两单建立 related 关联。TRD-210 同属 Unification，Backlog / Sulliven / High。正文只写需求与验收，未发布讨论记录或评论。以下调研为拆分前范围的历史基线；embedded 不再属于当前 TRD-92 的验收范围。

## 拆分后实施就绪核验（2026-11-24）

结论：具备开始实施的代码基础，未发现必须等待其他负责人交付的硬前置；尚不能称完整交易验收条件全部满足。Receive 与连接行为可先实施，Send 的交易规则和签名/提交适配属于本单工作。

本轮刷新确认 release 仍为 `993474e4377b75f919e587bc4f30e6adc24cecd1`；TRD-92 无 blockedBy、无评论。TRD-93/95/97/98 均 Done；#3110/#3195 均 approved 并已 merged 到 release，当前源码仍保留 connector/session、配置 token、RPC 和余额能力。无需重复刷新本阶段未变化的完整依赖树。

- RPC 的 `getSolanaRpc()` 已暴露 kit 客户端；源码提供主网检查、健康探测和账户读取。但本轮没有对当前配置 endpoint 的 fee/blockhash/simulation/status 方法做实时请求或发送交易，不能将读余额通过扩展为发送链路已验证。
- 当前 session 暴露 address/disconnect/restoration，没有通用 signer；实现 Send 时需从 Privy Solana wallets 按选中地址取得签名钱包，避免取列表第一项。不是另一个需求必须先交付的 signer 依赖。
- #3337 仍 OPEN，head `be9ca46ecba8031467bc13a7a771e1368d7aeccd`；订单 sender 可参考但不是通用 transfer，TRD-92 不必等待整条交易 PR 合并。若复用其中代码，需要明确最小来源与接口边界。
- TRD-158 仍 In Progress；发送必须包含足额 SOL、fee/rent/Max 校验，但不能直接假设订单 fee helper 适用于转账，也不将 TRD-158 整单完成视为硬前置。先对齐可共用接口，避免重复实现。
- 开工时收口支持 mint/Token-2022 范围、收款钱包地址到 ATA 的处理、创建费用和 SOL Max 保留额。这些是本单设计/验收规则，当前不要求为所有规则另等外部交付。
- 真实验收还需有四种外部钱包、Solana 开关、可用 mainnet RPC、有少量 SOL/测试代币的自有发送/接收地址，并获得实际签名/广播授权。本轮未重新核验这些运行资源，不声称它们缺失或已全部具备。
- 负责人仍 Sulliven；公开 PR 查询没有确认存在 TRD-92 实现线。按其实际分支接续，不能据搜索结果假设尚未开工。GitHub 编号搜索返回的 #3243 是旧 FESOL-92（SDK 单位换算），不是本需求。

## 拆分前调研结论

TRD-92 不是从零建设钱包，也不是只补两个按钮。外部钱包连接、恢复、地址和资产展示已有正式 release 交付；剩余范围是连接行为的验收差异、Receive、通用 SOL/SPL Send，以及 Solana Privy embedded wallet。标准转账主要通过现有 RPC 与钱包完成，未发现必须新增 gmx-api/SQD 接口的前置；embedded 配置与签名尚未核验，不能写成已通或必需购买第二份 Privy 订阅。

本轮 Linear：Backlog / Sulliven An / High，正文最后更新 2026-11-17，无评论、附件和显式 blockedBy。没有找到关联 TRD-92 的公开 PR；不能由此判断 Sulliven 没有本地或未关联工作。继续推进先和现负责人核对其实际分支与剩余交付。

本轮主项目源码固定为官方 release `993474e4377b75f919e587bc4f30e6adc24cecd1`，不是个人 integration 分支；以下“已有”是代码及合并证据，不代表本轮浏览器/钱包验收通过。

## 能力矩阵

| 范围 | 当前实际状态 | 剩余工作或证据边界 |
| --- | --- | --- |
| 外部钱包连接 | TRD-97 Done；[#3110](https://github.com/gmx-io/gmx-interface/pull/3110) 2026-10-28 合入 release，支持 Phantom、Solflare、OKX、TokenPocket，复用同一 Privy 入口 | 旧 preview 的通过记录不能代替当前四钱包、网络切换和真实签名验收；TRD-97 明确首发不包含 embedded |
| 恢复与显式断开 | session 保存 walletId；恢复有 4 秒占位超时；主动断开先清本地记忆；连接失败保留原网络上下文；有 EVM session 保护 | walletId 来自钱包名称，未单独持久化选定地址；同一扩展多账户切换/恢复需验收，不宣称已保证精确地址恢复 |
| 切网且目标网络没有记忆钱包 | 当前 Solana 下拉仅调用 selectSolanaNetworkInApp，Header 展示 Connect wallet 按钮，点击才打开连接 | 与正文“自动打开对应连接流程”存在代码行为差异，需 Chloe/Sulliven 确认是否补齐，不能算已完全覆盖 |
| 地址及资产展示 | 复用地址、复制、Solana explorer、wallet-only 模式；TRD-98 Done，Rainer 的 [#3195](https://github.com/gmx-io/gmx-interface/pull/3195) 2026-11-20 合入 release；原始余额来自 RPC，USD 来自 keeper 价格映射 | 覆盖 native SOL 和配置 token 的 ATA，并非扫描所有钱包 token account；loading/error 不应视为零；原始余额不是可转出额度 |
| Receive 收款 | MainView 对 Solana 隐藏 Receive；现有 WalletReceiveView 用 wagmi EVM 地址和 EVM 网络，尚未适配 Solana | 接当前 Solana session 地址、QR/复制/网络提示；绕过 EVM funding options，调整桌面/移动返回路径；确认后资产刷新 |
| Send 转账 | MainView 对 Solana 隐藏 Send；WalletSendView 是 EVM/viem/gas/跨链路径；没有正文提议的 SolanaWalletSendView 或通用转账状态实现 | 新增 SOL/SPL 交易构造、费用和账户校验、所选钱包签名、确认跟踪与余额失效；不能直接显示 EVM 页面代替 |
| Privy Solana embedded | WalletProvider 的 embeddedWallets 只配置 ethereum.createOnLogin；连接入口为外部 Solana 钱包专用流程 | 核验现有 Privy app 能力、登录/创建/选择、会话恢复和真实签名；未查看 dashboard，不确定是否有服务侧配置门槛 |
| 转账反馈与关闭后的跟踪 | 钱包资产 provider 随 modal 开关挂卸；普通余额查询按共享 5 秒节奏刷新，隐藏/离线不轮询 | pending 跟踪不能只放在 modal 内；未知超时继续查询，明确失败/拒签才允许检查后重试；确认后按 owner/network 刷新余额 |

## 与当前交易阶段的关系

[TRD-101](https://linear.app/gmx-io/issue/TRD-101) 把“钱包/网络切换、拒签、失败/pending、不影响 EVM 或在旧上下文提交”等列入当前交易验收，引用 TRD-92；同时把“Swap, transfers and embedded wallets”列在交易之后，引用 TRD-110/TRD-92。

因此要分别跟踪当前交易必需的钱包行为，以及后续通用转账/embedded 扩展，不能把整张 TRD-92 Backlog 当成当前交易的统一硬阻塞，也不能因 TRD-97/98 Done 就认为 TRD-92 全部通过。Pools 等历史阻塞关系同样不代表必须先实现全部 embedded 范围。

## Refining 入口与建议顺序

1. **先收口现有钱包行为。** 和 Sulliven 对照 TRD-97/98 交付，确认当前四钱包、EVM/Solana 独立恢复、失败/取消、主动断开、同扩展多账户、切网无记忆的验收矩阵。先识别已完成项和明确差异，避免重做。
2. **Receive 是最短独立交付。** 当前地址和 QR 等 UI 可以复用，但要改地址/网络来源与路由。接收本身无需用户签名，也无需新增后端历史接口。Received assets 用确认后的余额刷新体现。
3. **Send 按真实交易契约细化。** 明确 SOL 与配置 SPL 的首批范围、Token/Token-2022、收款地址是钱包地址还是 token account、目标 ATA 不存在的创建与 rent、SOL fee 与 Max 保留额、费用变化及预检查失效。当前 balance reader 接受 frozen 状态并只验证 Token-2022 扩展封装，不能拿显示余额直接当 spendable；发送必须校验实际可转出条件。
4. **Embedded 单独核验入口。** 先验证同一 Privy app 的 Solana 创建/访问和选中钱包签名，确定与 external session 的身份选择方式，再估算 UI/状态整合。此项未知不自动阻塞 external Receive/Send 的 refining，但不能从原验收范围中删除。

这不是重新排整个 backlog，也不是修改 TRD-101 的阶段安排。Receive 较易落地；Send 的范围与实现工作明显更多，不能因为“不依赖历史 API”就评为小改动。

## 技术接线与复用边界

- 当前 API 是 `isSolanaNetwork(networkId)`、`useSolanaWalletSession`、`useSolanaWalletAssets` 及 `useGmsolWalletBalances`；正文 `useChainId().isSolana`、`useSolanaWallet`、`useSolanaAssets`、`refreshSolanaAssets` 是设计建议或旧命名，不能按现成函数直接引用。
- `getSolanaBalancesKey(networkId, owner)` 是可复用的余额失效入口；转账的 owner/network/signature 要保留在提交上下文，切网、换钱包或关闭 modal 不应把结果归到当前新钱包。
- 更正此前宽泛判断：`GmxAccountModal` 本身没有“Solana 只准 main view”的硬限制。当前缺口是 MainView 隐藏入口、Receive/Send 实现仍为 EVM，以及各端路由/返回行为尚未适配。
- Vite stub `@solana-program/system`，不能仅因依赖存在就直接 import 转账 helper；设计交易构造时需兼容现有构建边界。
- 现有订单 sender 的签名审查、未知状态处理和余额刷新原则可参考；其 owner→自有 WSOL ATA 转账/SyncNative 是下单准备，不能据此认定任意收款人 SOL/SPL 转账已实现。通用转账需要自己的已审查交易契约。
- 旧站 `gmx-solana-interface` main `0e863b8dae7e1d9bef2cf28efe168b16c0992d20` 的 `app/src/components/TradeBoxNew/utils/wraporUnwrap.ts`、`client/src/exchange/instructions/utils.ts` 命中的是自有 WSOL wrap。它们不是新项目通用转账完成证据，也不能直接搬旧 wallet-adapter/web3.js 页面进入当前 Privy/kit 架构。本轮未对旧站所有路径做通用 sender 不存在的断言。

## 固定版本证据与验证边界

- [WalletProvider](https://github.com/gmx-io/gmx-interface/blob/993474e4377b75f919e587bc4f30e6adc24cecd1/src/lib/wallets/WalletProvider.tsx)、[SessionState](https://github.com/gmx-io/gmx-interface/blob/993474e4377b75f919e587bc4f30e6adc24cecd1/src/lib/solana/SolanaWalletSessionState.tsx)、[SessionSync](https://github.com/gmx-io/gmx-interface/blob/993474e4377b75f919e587bc4f30e6adc24cecd1/src/lib/solana/SolanaWalletSessionSync.tsx)。
- [NetworkDropdown](https://github.com/gmx-io/gmx-interface/blob/993474e4377b75f919e587bc4f30e6adc24cecd1/src/components/NetworkDropdown/NetworkDropdown.tsx)、[AppHeaderUser](https://github.com/gmx-io/gmx-interface/blob/993474e4377b75f919e587bc4f30e6adc24cecd1/src/components/AppHeader/AppHeaderUser.tsx)、[ConnectModalContext](https://github.com/gmx-io/gmx-interface/blob/993474e4377b75f919e587bc4f30e6adc24cecd1/src/context/ConnectModalContext/ConnectModalContext.tsx)。
- [MainView](https://github.com/gmx-io/gmx-interface/blob/993474e4377b75f919e587bc4f30e6adc24cecd1/src/components/GmxAccountModal/MainView.tsx)、[WalletReceiveView](https://github.com/gmx-io/gmx-interface/blob/993474e4377b75f919e587bc4f30e6adc24cecd1/src/components/GmxAccountModal/WalletReceiveView.tsx)、[WalletSendView](https://github.com/gmx-io/gmx-interface/blob/993474e4377b75f919e587bc4f30e6adc24cecd1/src/components/GmxAccountModal/WalletSendView.tsx)。
- [余额原始读取](https://github.com/gmx-io/gmx-interface/blob/993474e4377b75f919e587bc4f30e6adc24cecd1/src/lib/solana/balances.ts)、[余额 hook/cache key](https://github.com/gmx-io/gmx-interface/blob/993474e4377b75f919e587bc4f30e6adc24cecd1/src/domain/gmsol/useGmsolWalletBalances.ts)、[估值](https://github.com/gmx-io/gmx-interface/blob/993474e4377b75f919e587bc4f30e6adc24cecd1/src/domain/gmsol/useGmsolWalletAssets.ts)、[modal provider 生命周期](https://github.com/gmx-io/gmx-interface/blob/993474e4377b75f919e587bc4f30e6adc24cecd1/src/components/GmxAccountModal/GmxAccountModal.tsx)。
- [TRD-97](https://linear.app/gmx-io/issue/TRD-97)、[TRD-98](https://linear.app/gmx-io/issue/TRD-98) 正文与评论、#3110/#3195 合并/review/checks 是历史交付证据。本轮没有运行构建、测试或钱包实测，没有查看 Privy dashboard，也没有重新验收这些历史截图；未修改 Linear。

原始全量排序与背景见 [11 月 24 日 refining 调研](../solana-refining-priorities-2026-11-24.md)。恢复时刷新受影响来源，不把本文的日期状态当作长期事实。
