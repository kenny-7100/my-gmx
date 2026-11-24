# TRD-29 — RPC provider keys proxy

2026-11-24，角色：只读责任定位。实时Linear assignee Tim，Done；历史评论明确Worker由Tim实现（private#1），前端切换由Divhead实现（#3334）。用户报告的Solana成交通知无法确认，已核实proxy拒绝getTransaction/getSignaturesForAddress/getBlock；QA报告只列getSlot探活。相关TRD-127为Divhead负责provider/key选择。详见[线上定位及责任核对](../solana-trading-dependencies.md#市价单已成交但通知未确认的线上定位2026-11-24)。本轮只起草询问，未改Linear或发送消息。
