# TRD-29 — RPC provider keys proxy

## Allowlist 发布复定位（2026-11-25）

角色：只读排障。private#5已合并，但发布workflow等待cloudflare-workers环境审批，线上四路仍为11-20旧Worker版本。新DOGE单4秒已成交，真实回执重放executed/closed；原页面三个历史方法仍403。责任/版本/签名及后续入口见[完整证据](../solana-trading-dependencies.md#allowlist-已合并但发布待审批的复定位2026-11-25)。未审批、部署或新发交易。

2026-11-24，角色：只读责任定位。实时Linear assignee Tim，Done；历史评论明确Worker由Tim实现（private#1），前端切换由Divhead实现（#3334）。用户报告的Solana成交通知无法确认，已核实proxy拒绝getTransaction/getSignaturesForAddress/getBlock；QA报告只列getSlot探活。相关TRD-127为Divhead负责provider/key选择。详见[线上定位及责任核对](../solana-trading-dependencies.md#市价单已成交但通知未确认的线上定位2026-11-24)。本轮只起草询问，未改Linear或发送消息。
