# FESOL-20 — 订单发送与成交状态

2026-11-13，角色：下一条任务就绪调研。任务：https://linear.app/gmx-io/issue/FESOL-20 。当前 Todo、kenny；已实时读取正文、评论和关系，未认领或实施。

本轮建议作为首选。56 已提交 `a8733143f47230d996303d174b2ca9dcaf0b1c87`，可接续开发；`GmsolSendResult` 仅返回 signatures、slot、refreshErrors，尚缺 order/account/action id 的 typed correlation。先由经校验的 builder 或创建回执提供 program/store/order/action/creation signature，再连接 GMX RPC tracker，不能从签名确认推断成交。

已阅读个人实验分支 `solana-independent-implementation@f3842a7d501d8506980a2df4c6dde81659cb2211` 的 decoder、layout、reducer、spec 和 fixture provenance，可选择性复用，不整支带入。布局固定 IDL c6778dc9，真实历史 receipt 记录与结构变体测试并存；历史 binary/source identity 未证明，fixtures 的 businessAcceptance 为 not-evaluated，contract 仍标 source-derived。需要重新核对当前支持版本与可复现证据，不能视为生产验收。

协议 [#492](https://github.com/gmsol-labs/gmx-solana/pull/492) 已 merged，语义覆盖完整生命周期；Rust reader 的 failed transaction 过滤不在该 PR 范围。前端必须自行过滤失败交易，匹配 program/store/order/action，处理地址复用、乱序/重复/缺失和执行/关闭分交易；不足证据 unresolved。94 已归档且归本任务，不再另开平行实现/RPC scanner。

可先完成身份接口、离线解析/归约和 tracker 测试，再复用 GMX shared toast 与既有状态刷新；真实 toast 验收仍需交易入口、可用 LUT 与真实钱包订单。本轮只读代码与证据，没有运行测试、RPC 交易或广播。完整候选比较与固定 PR heads 见[任务评估](../solana-next-task-2026-11-13.md)。
