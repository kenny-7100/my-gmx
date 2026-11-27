# TRD-90 — Solana Claims

2026-11-24，参与角色：只读 refining 调研，未认领实现。[Linear](https://linear.app/gmx-io/issue/TRD-90)。

已沿 TRD-170 追到 SQD #44，于 11/23 merged；main 有 rebateBalances/rebateClaimSources/rebateClaims，含 READY/SYNCING、revision、source/授权量与分页，不能称返还后端不存在。但默认关闭/重放/生产启用未证明，Keeper #475 仓库本轮无法解析，合并与部署未知。funding 自动结算/手动同额动作与 rebate claim 分开核实；五天不证明链上可领取。

完整固定版本、代码/PR/生产查询证据及排序理由见 [11 月 24 日 refining 调研](../solana-refining-priorities-2026-11-24.md)。本文未完成业务实现或验收；恢复时刷新受影响依赖。

## 全局实施候选复核（2026-11-27）

角色：只读就绪调查。仍 Refining / 未分配；正文明确keeper五天规则与实际claimable数据前置，旧SQD不用于证明GMX前置满足。 完整证据、优先顺序和验证边界见 [本轮报告](../solana-readiness-2026-11-27.md)。未开发、运行页面/交易或修改 Linear。
