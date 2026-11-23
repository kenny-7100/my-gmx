# TRD-49 — Oracle ticker 类型契约

## 五需求前置复核（2026-11-23）

本轮以依赖调研角色核对实时Linear/PR/checks与关键源码：自有修复传播和冲突处理已完成，当前checks全成功，无需重复接入未变前置。后续重点是84作者原线同步及Receive接缝、107部署后性能/恢复、108真实刷新闭环与109剩余参考钱包/flags；同时更正3273为ticker类型修正。具体版本、跟进归属、可更新状态与未验证边界见[统一复核](../solana-trading-dependencies.md#五需求前置跟进复核2026-11-23-0934-cst)。未修改业务或外部状态。

## 接入实施（2026-11-18）

两个来源提交已精确转入TRD-136与playground；完整frontend、SDK构建/1011测试、实际交付47项受影响测试通过。 版本、检查与外部服务边界统一见[三项集成记录](TRD-136.md#三项正式-pr-集成与验收2026-11-18)。

## 候选核查（2026-11-18）

实时 Linear In Review、Tano，无评论/依赖。[PR #3273](https://github.com/gmx-io/gmx-interface/pull/3273) OPEN、非 Draft、release base，head `6995d3a0d5439e0edcdfb898ed6fb0a38149799a`，MERGEABLE、REVIEW_REQUIRED，无 review，全部 checks success。

已读实际 5 文件 diff：补充 timestamp 秒、明确 updatedAt 毫秒及价格单位；app 类型删除无效 oracleDecimals，SDK 仅 deprecated 保留以避免类型兼容破坏，更新三处 fixture（含 gmsol oracle 测试）。这与 issue 原 AC 要求直接删除 SDK 字段存在兼容性取舍，不能直接宣称所有 AC 满足。当前 TRD-136 未包含该差异。无运行时算法变化，可以作为 [TRD-136](TRD-136.md) 小型契约修正伴随接入，不是图表/入口功能的阻塞，也不计为新增用户功能。本次仅调查，未集成或重跑业务测试。
