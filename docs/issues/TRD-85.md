# TRD-85 — Solana 共享图表与个人成交

## 协调表合并状态刷新（2026-11-26）

只读核对Linear/评论及GitHub：仍Rainer/Done/Cycle1，#3223已于北京时间11月26日02:30合入release，APPROVED，head `e10845c5a4`六项checks成功。线上协调表已改灰；Reflectiv的历史feature-branch verified不扩大为生产发布或完整验收。未重新审源码/测试，见[本轮三表核验](FESOL-109.md#三表完整刷新2026-11-26-1411北京时间)。

## 五需求晚间核查（2026-11-23）

参与角色：只读依赖调研。#3223更新019069b7ed，相对已集成head仅新增locale并同步release，未发现新增chart runtime；Reflectiv新评论要求修正label，本轮未查看图片/聊天，不推断具体内容。 版本、证据与验证边界见[统一增量核查](../solana-trading-dependencies.md#五需求晚间增量核查2026-11-23-2130-cst)。本轮未修改业务或外部状态。

## 发布范围风险审计（2026-11-23）

本轮按TRD-101当前及历史计划复核12月10日发布范围，区分已实现、交付/验收缺口与个人切片暂缓；发现83已有独立远端实现、77已Done，仍需收口产品范围、共享交易及跨侧验收。具体归属、证据与执行建议见[统一审计](FESOL-109.md#12-月-10-日目标范围与交付风险复核2026-11-23-1002-北京时间)。未修改业务或外部状态。

## 五需求前置复核（2026-11-23）

本轮以依赖调研角色核对实时Linear/PR/checks与关键源码：自有修复传播和冲突处理已完成，当前checks全成功，无需重复接入未变前置。后续重点是84作者原线同步及Receive接缝、107部署后性能/恢复、108真实刷新闭环与109剩余参考钱包/flags；同时更正3273为ticker类型修正。具体版本、跟进归属、可更新状态与未验证边界见[统一复核](../solana-trading-dependencies.md#五需求前置跟进复核2026-11-23-0934-cst)。未修改业务或外部状态。

## 五需求前置复核（2026-11-22）

本轮只读重查当前需求及相关交付证据。API365合并提交Solana部署check成功，107仍In Progress且负载/恢复目标未完成；108四输出对照已有证据，控制交易序列待验收；109冻结LUT已交付，参考钱包/flags仍需收口；84原PR当前冲突且无新业务head，85无新head。具体归属、跟进动作与本轮验证边界见[统一清单](../solana-trading-dependencies.md#五需求前置跟进清单2026-11-22)。未操作业务、服务或钱包。

## 接入实施（2026-11-18）

已按release-relative业务diff接入TRD-136与playground，保留slot保护与正式订单Provider；真实当前DOGE索引1条、无关owner0条、原owner恢复1条。 版本、检查与外部服务边界统一见[三项集成记录](TRD-136.md#三项正式-pr-集成与验收2026-11-18)。

## 最新候选核查（2026-11-18）

实时 Linear In Test、Rainer，无评论；显式前置 TRD-65/86 已进 release。[PR #3223](https://github.com/gmx-io/gmx-interface/pull/3223) OPEN、非 Draft、release base，head `beaa4d28dd3ee05b6ae9852ac289f16f66369a3a`，MERGEABLE、REVIEW_REQUIRED。历史记录见 [FESOL-29](FESOL-29.md)，本节以该实时 head 为准。

实际 diff 14 文件：共用 TVChartContainer 接入 Solana wallet、个人成交 fetcher 与 current 生命周期筛选、15s 增量历史刷新，仓位失败重试与 refetch 透传。当前 TRD-136 尚无 fetcher，图表相关代码仍等同 release，具有实际新增价值。当前 diff 已无早期 development depth preview，不据旧 PR 正文声称完整 Depth/overlay/chart trading AC 已完成。fetcher 使用公开 Squid GraphQL；本次没有重新请求服务或验证其历史覆盖与最终页面效果。

主检查、standalone、Audit、Cloudflare 成功；组件 workflow 红色源于 [run 44088629315](https://github.com/gmx-io/gmx-interface/actions/runs/44088629315) 报告发布 git push origin gh-pages 的 non-fast-forward，实际 286 项组件测试通过（4.9m）。不是测试失败，也不是权限 403。三个未关闭 review thread 已 outdated，Rainer 已回复处理；增量游标/缓存和移除 depth preview 在当前源码可见，不将 thread 未 resolve 等同代码未修。

集成风险：PR 的 useGmsolAccountData 基于旧接口，当前 TRD-136 有 GmsolAccountSlotTracker/minContextSlot、成交确认新鲜度和 positions 15s/fee 60s 刷新预算，不能被旧文件覆盖；refetch 应叠加到当前接口。Provider 必须保留余额及 TRD-84 GmsolOrderActionsProvider。只读 patch 检查账户 hook 上下文不匹配，尚未实际 merge，不声称已证明 merge 冲突。建议在 TRD-142 后单独接入，验收标记、市场/钱包切换、操作后刷新与重试；计划见 [TRD-136](TRD-136.md)。

## Kenny 消费者集成（2026-11-20）

参与角色：候选集成与组合验证，未接管原需求、修改原作者PR或代作验收。候选c8f9c4a85d已集成136/playground，组合positions+markets+prices refetch并保留isSyncing、手动Retry与balance injection；SDK按本分支源码重建。 证据与边界见[本轮接续](../solana-trading-dependencies.md#五需求上游接续实施2026-11-20)。
