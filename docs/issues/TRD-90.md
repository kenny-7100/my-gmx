# TRD-90 — Solana Claims

2026-11-24，参与角色：只读 refining 调研，未认领实现。[Linear](https://linear.app/gmx-io/issue/TRD-90)。

已沿 TRD-170 追到 SQD #44，于 11/23 merged；main 有 rebateBalances/rebateClaimSources/rebateClaims，含 READY/SYNCING、revision、source/授权量与分页，不能称返还后端不存在。但默认关闭/重放/生产启用未证明，Keeper #475 仓库本轮无法解析，合并与部署未知。funding 自动结算/手动同额动作与 rebate claim 分开核实；五天不证明链上可领取。

完整固定版本、代码/PR/生产查询证据及排序理由见 [11 月 24 日 refining 调研](../solana-refining-priorities-2026-11-24.md)。本文未完成业务实现或验收；恢复时刷新受影响依赖。
