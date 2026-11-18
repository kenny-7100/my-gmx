# TRD-85 — Solana 共享图表与个人成交

## 最新候选核查（2026-11-18）

实时 Linear In Test、Rainer，无评论；显式前置 TRD-65/86 已进 release。[PR #3223](https://github.com/gmx-io/gmx-interface/pull/3223) OPEN、非 Draft、release base，head `beaa4d28dd3ee05b6ae9852ac289f16f66369a3a`，MERGEABLE、REVIEW_REQUIRED。历史记录见 [FESOL-29](FESOL-29.md)，本节以该实时 head 为准。

实际 diff 14 文件：共用 TVChartContainer 接入 Solana wallet、个人成交 fetcher 与 current 生命周期筛选、15s 增量历史刷新，仓位失败重试与 refetch 透传。当前 TRD-136 尚无 fetcher，图表相关代码仍等同 release，具有实际新增价值。当前 diff 已无早期 development depth preview，不据旧 PR 正文声称完整 Depth/overlay/chart trading AC 已完成。fetcher 使用公开 Squid GraphQL；本次没有重新请求服务或验证其历史覆盖与最终页面效果。

主检查、standalone、Audit、Cloudflare 成功；组件 workflow 红色源于 [run 44088629315](https://github.com/gmx-io/gmx-interface/actions/runs/44088629315) 报告发布 git push origin gh-pages 的 non-fast-forward，实际 286 项组件测试通过（4.9m）。不是测试失败，也不是权限 403。三个未关闭 review thread 已 outdated，Rainer 已回复处理；增量游标/缓存和移除 depth preview 在当前源码可见，不将 thread 未 resolve 等同代码未修。

集成风险：PR 的 useGmsolAccountData 基于旧接口，当前 TRD-136 有 GmsolAccountSlotTracker/minContextSlot、成交确认新鲜度和 positions 15s/fee 60s 刷新预算，不能被旧文件覆盖；refetch 应叠加到当前接口。Provider 必须保留余额及 TRD-84 GmsolOrderActionsProvider。只读 patch 检查账户 hook 上下文不匹配，尚未实际 merge，不声称已证明 merge 冲突。建议在 TRD-142 后单独接入，验收标记、市场/钱包切换、操作后刷新与重试；计划见 [TRD-136](TRD-136.md)。
