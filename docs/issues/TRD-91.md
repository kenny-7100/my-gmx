# TRD-91 — Solana Net Rate

2026-11-24，参与角色：只读 refining 调研，未认领实现。[Linear](https://linear.app/gmx-io/issue/TRD-91)。

与 Rainer 协作的 refining 首选。API #341 已 merged，生产 rates 三个 period 查询均 200；SOL/USDC 30d 样本仅 126 个小时点，UTC 11/19 09:00–11/24 14:00。release useRateSnapshots 读 globals.chainId，而 Solana provider 保留 EVM chainId；需按实际 network 选 SDK/cache。地址比较已支持 base58 精确比较，无需重复修。先确认历史不足验收、符号/精度/投影；未做 UI 验收。

完整固定版本、代码/PR/生产查询证据及排序理由见 [11 月 24 日 refining 调研](../solana-refining-priorities-2026-11-24.md)。本文未完成业务实现或验收；恢复时刷新受影响依赖。
