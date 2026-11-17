# TRD-84 — Solana 平仓、编辑和撤单

## 五需求晚间前置核验（2026-11-17）

仍In Progress、Sulliven、无评论；定向搜索未找到新独立PR，不证明无未公开工作。136退出/撤单运行依赖仍保留，本地接线继续按用户决定暂缓。 角色为只读依赖调研，来源与验证边界见[统一核验](../solana-trading-dependencies.md#五需求晚间前置核验2026-11-17)。

2026-11-16，角色：TRD-136 退出路径调研。Issue：[TRD-84](https://linear.app/gmx-io/issue/TRD-84/close-positions-edit-and-cancel-orders-on-solana)，历史 FESOL-59；负责人 Sulliven，本次不接管开发。

通过官方 MCP 实时读取正文、关系及评论：当前 In Progress（11月15日开始）、无评论。要求共用 PositionSeller 平仓、共用订单列表编辑/撤单，复用原交易 builder；callback/referrer 来自 API，不能从已知错误 IDL 推导 referrer。保证金增减归其他需求，不将整个编辑范围扩入 TRD-136。

19 development `14d67c82d0` 当前 OrderList 撤单和 PositionSeller 提交仍依赖 EVM signer/provider，未接通可用 Solana 退出路径。GitHub open PR 按 TRD-84 搜索为空，FESOL-59 搜索只命中前置；不证明负责人没有其他命名/尚未公开的实现。真实开仓前应核实并验证可用成果，不能仅凭底层 builder 支持便确认可退出。就绪边界见[TRD-136](TRD-136.md#实施条件核验2026-11-16-1055-cst)。


2026-11-16 本地真实API与四类unsigned模拟通过后，退出路径仍未因此接通。已询问用户是否授权仅本地最小平仓/撤单接线，或提供负责人已有成果；尚待答复，未改本需求业务、未真实开仓。TRD-136不接管正式归属，不将底层decrease/cancel能力当共用UI验收。


## 最小接线契约核查（2026-11-16，TRD-136 集成 `335a9cd5f3`）

只读分析，尚未获本地接线范围答复，未实现本需求。撤单可以复用 `getGmsolOrderContext(order)`→`useGmsolOrderTransactions.submit({type:"cancel",order:context})`，不另写签名/广播：composeGmsolOrdersInfo 已将 API 的 orderAccount、rentReceiver、actionState、referrer、callback、escrowTokens 保存在 OrderInfo.solana。转换要求 pending、元数据完整且无 callback；builder/validator 继续要求 owner/receiver/rentReceiver匹配钱包，不能为了本地测试清空 callback 或从错误IDL推导referrer。需要实际订单后核对这些真实字段，当前空订单列表不能证明撤单可行。

平仓应从共享 PositionSeller 的现有计算结果映射 MarketDecrease，经过同一 submit，而非绕过共享计算自建命令行退出工具。该 Hook 已提供钱包/网络变化与卸载保护、重复提交锁、未知receipt reconcile、确认后按slot刷新账户及余额。UI仍需正确接入isSubmitting/待确认反馈、原通知生命周期，并隔离EVM allowance/express提交分支；低层已有create/update/cancel测试只验证生成交易，不证明这组UI接线或真实退出。当前不重跑已由同版本全量覆盖的低层测试，后续修改需在实际组合目标做定向与页面验证。
