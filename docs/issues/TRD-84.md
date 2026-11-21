# TRD-84 — Solana 平仓、编辑和撤单

## 五需求前置复核（2026-11-22）

本轮只读重查当前需求及相关交付证据。API365合并提交Solana部署check成功，107仍In Progress且负载/恢复目标未完成；108四输出对照已有证据，控制交易序列待验收；109冻结LUT已交付，参考钱包/flags仍需收口；84原PR当前冲突且无新业务head，85无新head。具体归属、跟进动作与本轮验证边界见[统一清单](../solana-trading-dependencies.md#五需求前置跟进清单2026-11-22)。未操作业务、服务或钱包。

## 前置增量核查（2026-11-20）

只读实质核对本需求当前Linear、相关PR及固定版本差异；最新变化、处理建议与验证边界见[统一核查](../solana-trading-dependencies.md#五需求前置增量核查2026-11-20-2246-cst)。本轮未改业务或外部状态。

## 正式 PR 集成与页面接缝修复（2026-11-18）

用户明确授权“合并进入 TRD-136，测试验收通过后发布 playground”。精确集成 #3293 末端业务 `0722cc8701`，未整支合并其 TRD-70 前置、未合并上游 PR、未另开平仓业务路径。TRD-136 对应 `aad386e224`，刷新 catalog `a0273c5eb4`；保留 UI2.2、错误 reason 和共享实验无 LUT 构建。

在用户指定、已打开的 kenny Chrome 原生窗口核验当前 DOGE 20 USD/10 USDC 抵押多仓：平仓 Market 默认 100%、按钮可用，但接收行为空。定位共享 TokenSelector 无 tokenInfo 时回查 EVM 配置并返回 null，available receive selector 也仍使用 EVM reachable graph。TRD-136 补丁 `ad71f2f80d`/`daa6df395f` 显式传 Solana tokenInfo、仅提供 collateral（WSOL 可解包 SOL），不扩展 swap。页面再验已显示约10.01 USDC、选择列表仅USDC；金额随行情变化，不是最终到账承诺。最终开发 head `daa6df395f`，playground 对应 `e7d2616b5c`。实际页面没有未完成订单，未验证真实编辑/撤单。未签名或广播。

自动验证：接入后完整前端 353文件/3494 tests通过、1既有skip；app/landing types、变更lint/format通过。接收补丁 44测试通过（后续仅动态import/可选marketInfo修正，selector33测试再通过），开发最终types/lint通过。playground实际目录最终检查、CI和部署收尾见 [TRD-136](TRD-136.md)。

实时 unsigned 诊断从当前真实仓位读取精确size，使用正式 buildGmsolCloseAction→prepare→validator→pre-signature RPC模拟通过：1000 bytes、无LUT、slot470847316、网络费45000lamports。诊断为Node固定WASM/RPC adapters、1%价格边界/零collateral withdrawal，不包含共享UI计算映射，不等同浏览器真实提交；报告在开发目录 `.local/trd-136/close-integration-20261118.json`。真实签名、Keeper成交、仓位删除及余额/UI刷新仍待用户接手；不宣称完整TRD-84 AC通过。

## 正式 PR 已出现：恢复条件满足（2026-11-18 后续）

用户提供 Sulliven 的 [#3293](https://github.com/gmx-io/gmx-interface/pull/3293) 并要求核对上下文。本轮只读分析，没有创建目标、集成代码、构建、部署或操作钱包。PR OPEN、非Draft、base release、head `0722cc8701f2b0b197f6bb3c506ce89dd1f31b82`，MERGEABLE、REVIEW_REQUIRED；正文空，查询时无review/inline评论。当前head check-runs全部success，包含Audit、主lint/types/tests、standalone、WASM、组件和Cloudflare。Linear仍In Progress、Sulliven，验收要求真实平仓、编辑及撤单落链和列表更新。

该PR继承TRD-70原delivery `532c8c050d` 的交易前置，末端独立提交 `0722cc8701` 才是TRD-84新增接线（26文件，含catalog，1391+/120-）。已读固定head的GmsolOrderActionsProvider/buildOrderActions/PositionSeller：共享弹窗分支调用closePosition，跳过EVM allowance loading；Provider复用useGmsolOrderTransactions/notifications，提供market close、TP/SL、update/cancel和未知提交reconcile；cancel取API order.solana上下文。范围与此前等待的正式成果一致，满足“等负责人提出PR再继续”的前置条件，但不是已集成/真实退出验收通过。

后续适合精确接入该末端业务提交，不整支覆盖playground已含的前置。固定WASM pin与当前一致；其配置仍两张mutable LUT+空authority，且notification.failed尚无本轮reason/message修复；需保留现有build-playground共享无LUT实验配置、2.2版本和TRD-78错误原因展示。接收币种默认/selector、精确全平、trigger/update/cancel及API实际字段仍需在组合目标逐项核验，源码入口存在不代替页面/交易验收。此前历史仓位/模拟不得冒充当前资产。用户本轮仅要求看情况，没有自动恢复已清除目标、合并或发布；下一切片是按正式PR接入TRD-136并验证组合，钱包签名由用户接手。

## 目标暂停（2026-11-18）

用户授权创建正式链路实施及测试验收目标后，进一步明确：调查是否已有 PR，若尚未提出 PR，本任务可以暂时停止。最后一次实时查询 TRD-84（全状态）为空；FESOL-59 仅命中既有字段/状态/开关前置，Sulliven 当前 open PR 仅 #3287/TRD-100；Linear 仍 In Progress、无附件。本机无 TRD-84 登记或对应开发分支。依用户条件暂停目标，不新建业务分支、不实现替代接线、不修改 Linear 或联系负责人。恢复条件为用户提供/要求核查可集成的 TRD-84 PR，或明确改变当前安排；没有订阅或后台轮询，不承诺自动感知新 PR。目标验收尚未完成，既有模拟不作为完成证据。

用户确认之后有 PR 再重新开始，并要求沉淀经验；可复用判断已归入 [RL-01](../review-lessons.md#rl-01-共享接缝与删减)。随后用户已清除目标；恢复时读取本记录并核对已有 TRD-136 现场，刷新 TRD-84 PR/评论/源 SHA，检查其前置及本地差异，再集成正式成果；重新核对当前仓位、服务/API/RPC 和签名前状态，历史模拟与旧仓位数值不可直接充当新版本验收。签名仍由用户接手，最终核对 Keeper、仓位与余额/UI 刷新。

## 按正式 PR 路径复核（2026-11-18）

用户明确纠正方案：尽量依赖已有 PR，不为 TRD-136 单独构建随后被替换的退出路径。本节收敛下节“可开始实施”的含义：底层技术条件具备，但尚未找到共享平仓接线的可集成正式成果；先确认 TRD-84 开发线，不能直接在 TRD-136 独立实现同一产品能力。

再次实时核验 Linear 正文、关系、评论：TRD-84 仍由 Sulliven 负责、In Progress、无评论/附件；自动分支名 trd-84 不是实际已推送分支的证据。GitHub 查询全部 open PR、Sulliven 全状态 PR、TRD-84/FESOL-59 搜索及主仓库全部分页分支，没有找到专门平仓 PR 或对应命名分支。覆盖公开可访问主仓库，不代表其本地、私有或其他命名工作不存在。未联系负责人、未修改 Linear。

已有正式成果核验：TRD-72 #3258 `ce2d726b79` 提供 MarketDecrease 构建/提交；TRD-78 #3261 `68ec526e70` 提供生命周期/通知；TRD-70 #3262 `532c8c050d` 提供共享状态和 TradeBox 适配模式，不包含 PositionSeller 接线；TRD-77 #3259 `e164801e28` 提供固定 WASM；#3207 `6bb15c691f` 提供订单字段。逐一检查这些 PR 的文件列表，均未修改 PositionSeller 或其 selector。#3288 playground 也没有这段接线，不能通过切换 playground 获得平仓能力。

Sulliven 的旧 #3238 已关闭，由 #3286（TRD-80，2026-11-17T12:13:19Z 合并，merge `a640205144`）接续；#3286 改仓位 tooltip、功能开关与订单类型筛选，不含平仓提交，merge 已是本地 TRD-136 HEAD 的祖先，无须重复集成。#3287/TRD-100 仅纯 SDK 单位转换，正文明确当前 UI 不调用，也不能解决 Loading。实时 release 仍为 `28ddd42ce6`；直接读取远端 PositionSeller 确认仍取 EVM signer 并调用 sendBatchOrderTxn，selector 仍查 EVM reachable graph。

建议方案：先向负责人确认 TRD-84 实际分支/PR、当前共享弹窗接线与预计可集成切片；若已有成果，以其源 SHA 集成到 TRD-136，修复按所属原开发线完成后再转入集成。若尚未实现，先确定 TRD-84 的唯一开发线及协作归属，再把 Market 平仓作为正式需求的第一切片（共享 UI、USDC 接收、精确全平、现有 submit/通知/刷新及定向回归），其余范围沿同一逻辑开发线继续；TRD-136 只组合验收。不盲扩 TRD-70 PR、不创建临时 CLI 平仓、不接管他人分支或擅自发布新 PR。按这一原则，目前下一项是取得正式开发线信息，而不是重复构建底层或本地临时接线。

## 当前仓位本地全平就绪核查（2026-11-18）

角色：TRD-136 本地退出路径调研，未接管 Sulliven 的完整需求。用户本轮要求调查实施条件，未开始产品实现或钱包操作。结论：已有条件实施当前 BTC/USDC 多仓的 Market 全平、直接接收 USDC；没有发现必须等待的新上游依赖，但共用弹窗尚未接通，真实 Keeper 退出仍待验收。

实时 Linear：In Progress，负责人 Sulliven，updatedAt 为 2026-11-16T02:17:53.092Z，无评论；blockedBy TRD-70/80/129 属于正式需求关系，不能直接当作这个窄范围本地退出的技术阻塞。GitHub 按 TRD-84、历史 FESOL-59 及公开 open PR 标题定向核查，未发现可直接接入的专门实现，不证明没有其他命名或未公开工作。release 仍为 `28ddd42ce6`；本地已有 TRD-72/78/70/77 与 #3207 相关能力，不必等它们合并才开发本地接线。

目标源码 `local-real-solana-trades-trd-136` / `627ed6f9d1`：PositionSeller 仍取 EVM useWallet signer/account，batchParams 缺失使 isAllowanceLoaded=false，按钮持续 Loading；绕过按钮条件也不能解决后面的 EVM sendBatchOrderTxn。另一个必要修复是 positionSellerSelectors 的 available receive tokens 仍查 EVM reachable graph，Solana USDC 得不到可接收列表，当前页面接收行为空。应接入直接收取 collateral USDC 的默认值，并复用共享 decrease 计算、fee-discount、滑点与 gmsol tradeMath，隔离 EVM allowance/express 分支。

底层 MarketDecrease builder、validator、prepare/pre-signature checks 已有；useGmsolOrderTransactions 提供提交锁、未确认 receipt reconcile、钱包/网络/卸载保护以及确认后 slot 刷新和余额更新，watchSubmittedOrders 已支持 MarketDecrease。接线应沿用这些与现有通知生命周期。全平使用真实 position.sizeInUsd，保留 getIsGmsolFullSizeClose 的精度处理，不能用页面两位小数拼全平值。公开 #3284（TRD-40，base master）也涉及显示金额与 debounce 的关闭规模问题，仅为相关风险参考，不盲合该分支。

本地 API 可读真实目标仓位、空订单列表及完整 fee-discount。忽略目录临时诊断 `../gmx-interface-trd-136/.local/trd-136/close-readiness-20261118.mjs` 从模拟时实时仓位读取真实规模，经固定哈希 WASM、真实 prepare/builder/validator/pre-signature RPC 模拟通过：slot `470757481`，交易 892 bytes，小于 1232，无 LUT，网络费估算 45000 lamports。报告位于同目录 `.json`，签名/广播均为 false。诊断以当时 minPrice 向下 1% 构造有限价格边界、minOutput 为 0，只验证底层准备条件，不覆盖共享 UI 参数映射、完整金融约束或 Keeper 最终执行；不将其直接照搬为产品参数。报告中的仓位规模为诊断时读取值，不以较早页面截图值替代。

后续最小实施：共享弹窗的 Solana USDC 接收/默认值与参数映射 → 复用现有 submit/通知/刷新并显示真实提交状态 → 全平精度及 EVM 行为定向回归 → 浏览器签名前链路检查 → 用户自行钱包签名 → 核对订单创建、Keeper 执行、API 仓位消失与余额/UI 更新。编辑、撤单、trigger、TWAP、swap 不属于这笔已有仓位全平的必要范围；此结论不代表 TRD-84 正式 AC 完成。

## 五需求晚间前置核验（2026-11-17）

仍In Progress、Sulliven、无评论；定向搜索未找到新独立PR，不证明无未公开工作。136退出/撤单运行依赖仍保留，本地接线继续按用户决定暂缓。 角色为只读依赖调研，来源与验证边界见[统一核验](../solana-trading-dependencies.md#五需求晚间前置核验2026-11-17)。

2026-11-16，角色：TRD-136 退出路径调研。Issue：[TRD-84](https://linear.app/gmx-io/issue/TRD-84/close-positions-edit-and-cancel-orders-on-solana)，历史 FESOL-59；负责人 Sulliven，本次不接管开发。

通过官方 MCP 实时读取正文、关系及评论：当前 In Progress（11月15日开始）、无评论。要求共用 PositionSeller 平仓、共用订单列表编辑/撤单，复用原交易 builder；callback/referrer 来自 API，不能从已知错误 IDL 推导 referrer。保证金增减归其他需求，不将整个编辑范围扩入 TRD-136。

19 development `14d67c82d0` 当前 OrderList 撤单和 PositionSeller 提交仍依赖 EVM signer/provider，未接通可用 Solana 退出路径。GitHub open PR 按 TRD-84 搜索为空，FESOL-59 搜索只命中前置；不证明负责人没有其他命名/尚未公开的实现。真实开仓前应核实并验证可用成果，不能仅凭底层 builder 支持便确认可退出。就绪边界见[TRD-136](TRD-136.md#实施条件核验2026-11-16-1055-cst)。


2026-11-16 本地真实API与四类unsigned模拟通过后，退出路径仍未因此接通。已询问用户是否授权仅本地最小平仓/撤单接线，或提供负责人已有成果；尚待答复，未改本需求业务、未真实开仓。TRD-136不接管正式归属，不将底层decrease/cancel能力当共用UI验收。


## 最小接线契约核查（2026-11-16，TRD-136 集成 `335a9cd5f3`）

只读分析，尚未获本地接线范围答复，未实现本需求。撤单可以复用 `getGmsolOrderContext(order)`→`useGmsolOrderTransactions.submit({type:"cancel",order:context})`，不另写签名/广播：composeGmsolOrdersInfo 已将 API 的 orderAccount、rentReceiver、actionState、referrer、callback、escrowTokens 保存在 OrderInfo.solana。转换要求 pending、元数据完整且无 callback；builder/validator 继续要求 owner/receiver/rentReceiver匹配钱包，不能为了本地测试清空 callback 或从错误IDL推导referrer。需要实际订单后核对这些真实字段，当前空订单列表不能证明撤单可行。

平仓应从共享 PositionSeller 的现有计算结果映射 MarketDecrease，经过同一 submit，而非绕过共享计算自建命令行退出工具。该 Hook 已提供钱包/网络变化与卸载保护、重复提交锁、未知receipt reconcile、确认后按slot刷新账户及余额。UI仍需正确接入isSubmitting/待确认反馈、原通知生命周期，并隔离EVM allowance/express提交分支；低层已有create/update/cancel测试只验证生成交易，不证明这组UI接线或真实退出。当前不重跑已由同版本全量覆盖的低层测试，后续修改需在实际组合目标做定向与页面验证。
