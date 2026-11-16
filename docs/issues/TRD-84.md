# TRD-84 — Solana 平仓、编辑和撤单

2026-11-16，角色：TRD-136 退出路径调研。Issue：[TRD-84](https://linear.app/gmx-io/issue/TRD-84/close-positions-edit-and-cancel-orders-on-solana)，历史 FESOL-59；负责人 Sulliven，本次不接管开发。

通过官方 MCP 实时读取正文、关系及评论：当前 In Progress（11月15日开始）、无评论。要求共用 PositionSeller 平仓、共用订单列表编辑/撤单，复用原交易 builder；callback/referrer 来自 API，不能从已知错误 IDL 推导 referrer。保证金增减归其他需求，不将整个编辑范围扩入 TRD-136。

19 development `14d67c82d0` 当前 OrderList 撤单和 PositionSeller 提交仍依赖 EVM signer/provider，未接通可用 Solana 退出路径。GitHub open PR 按 TRD-84 搜索为空，FESOL-59 搜索只命中前置；不证明负责人没有其他命名/尚未公开的实现。真实开仓前应核实并验证可用成果，不能仅凭底层 builder 支持便确认可退出。就绪边界见[TRD-136](TRD-136.md#实施条件核验2026-11-16-1055-cst)。


2026-11-16 本地真实API与四类unsigned模拟通过后，退出路径仍未因此接通。已询问用户是否授权仅本地最小平仓/撤单接线，或提供负责人已有成果；尚待答复，未改本需求业务、未真实开仓。TRD-136不接管正式归属，不将底层decrease/cancel能力当共用UI验收。
