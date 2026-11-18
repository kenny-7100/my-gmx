# TRD-84 — Solana 平仓、编辑和撤单

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
