# TRD-89 — Solana 个人 Trades 历史

2026-11-24，参与角色：只读 refining 调研，未认领实现。[Linear](https://linear.app/gmx-io/issue/TRD-89)。

已核对 release 共享 tradeActions 字段、旧站 tradeEvents/orderRemoveds 与最新 SQD schema。原始事件丰富但尚未证明有可供 GMX 全历史消费的完整接口。下一步事件覆盖/费用/PnL/折扣/lifecycle/分页矩阵和真实样例；DES-65 市场面板争议与个人历史区别处理，GT rewards 不进入 Trades。

完整固定版本、代码/PR/生产查询证据及排序理由见 [11 月 24 日 refining 调研](../solana-refining-priorities-2026-11-24.md)。本文未完成业务实现或验收；恢复时刷新受影响依赖。
