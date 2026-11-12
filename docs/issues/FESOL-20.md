# FESOL-20 — 订单发送与成交状态

2026-11-13，角色：下一条任务就绪调研。任务：https://linear.app/gmx-io/issue/FESOL-20 。当前 Todo、kenny；已实时读取正文、评论和关系，未认领或实施。

本轮建议作为首选。56 已提交 `a8733143f47230d996303d174b2ca9dcaf0b1c87`，可接续开发；`GmsolSendResult` 仅返回 signatures、slot、refreshErrors，尚缺 order/account/action id 的 typed correlation。先由经校验的 builder 或创建回执提供 program/store/order/action/creation signature，再连接 GMX RPC tracker，不能从签名确认推断成交。

已阅读个人实验分支 `solana-independent-implementation@f3842a7d501d8506980a2df4c6dde81659cb2211` 的 decoder、layout、reducer、spec 和 fixture provenance，可选择性复用，不整支带入。布局固定 IDL c6778dc9，真实历史 receipt 记录与结构变体测试并存；历史 binary/source identity 未证明，fixtures 的 businessAcceptance 为 not-evaluated，contract 仍标 source-derived。需要重新核对当前支持版本与可复现证据，不能视为生产验收。

协议 [#492](https://github.com/gmsol-labs/gmx-solana/pull/492) 已 merged，语义覆盖完整生命周期；Rust reader 的 failed transaction 过滤不在该 PR 范围。前端必须自行过滤失败交易，匹配 program/store/order/action，处理地址复用、乱序/重复/缺失和执行/关闭分交易；不足证据 unresolved。94 已归档且归本任务，不再另开平行实现/RPC scanner。

可先完成身份接口、离线解析/归约和 tracker 测试，再复用 GMX shared toast 与既有状态刷新；真实 toast 验收仍需交易入口、可用 LUT 与真实钱包订单。本轮只读代码与证据，没有运行测试、RPC 交易或广播。完整候选比较与固定 PR heads 见[任务评估](../solana-next-task-2026-11-13.md)。

## 2026-11-13 并行实施记录

角色：实现负责人（与 FESOL-19 并行），共享 sender/notification 接口由协调者统一整合。

实现分支：`solana-order-lifecycle-fesol-20`，当前 head `1608901e2b`；FESOL-19 消费了该分支的共享接口，形成整合 head `5ceb145308`。实现包含固定 IDL/CPI event decoder、失败交易过滤、program/store/order/actionId 关联、生命周期 reducer、bounded RPC history scan、creation slot 边界和同 slot block 排序、延迟 receipt 恢复、confirmed/failed/ambiguous 分类、owner/network/unmount abort，以及 shared `useSolanaOrderNotifications`。

验证：相关 parser/reducer/RPC/notification/sender/hook suite 通过；FESOL-20 全量 `yarn test:ci` 为 343 test files、3445 passed、1 skipped；root/landing TypeScript、ESLint、Prettier、diff check、lingui prepare 和 `NODE_OPTIONS=--max-old-space-size=8192 yarn build-app` 均通过。使用现有 Solana RPC 做历史 trade/cancel 只读回放并正确归约；没有签名、广播或 public fallback。

边界：历史 fixture/replay 不等于当前部署 ABI、新订单、keeper execution 或真实浏览器两阶段 toast 验收；FESOL-56 的 LUT trust gate 和部分组合 transaction size 仍是生产验收前置。并行期间发现 locale/ignored output 会跨 worktree 污染，已通过路径级清理和精确 cherry-pick 修复并记录在协作文档。
