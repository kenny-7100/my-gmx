# TRD-92 — Solana 钱包与转账

2026-11-24，参与角色：只读 refining 调研，未认领实现。[Linear](https://linear.app/gmx-io/issue/TRD-92)。

调研 Sulliven 的剩余范围，未认领。连接/恢复/资产已有；release WalletProvider 只配置 Ethereum embedded，不能称 Solana embedded 已通。Receive/Send 与 Privy 配置/签名分别梳理，确认 ATA、rent、SOL fee、Max、pending 跟踪。订单 sender 非通用转账 sender，Vite system package stub 也需考虑；未验证真实 embedded 签名。

完整固定版本、代码/PR/生产查询证据及排序理由见 [11 月 24 日 refining 调研](../solana-refining-priorities-2026-11-24.md)。本文未完成业务实现或验收；恢复时刷新受影响依赖。
