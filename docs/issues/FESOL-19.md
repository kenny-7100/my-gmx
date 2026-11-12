# FESOL-19 — 共享 TradeBox 的 Solana 下单入口

2026-11-13，角色：下一条任务就绪调研。任务：https://linear.app/gmx-io/issue/FESOL-19 。当前 Todo、未分配；已实时读取正文和双向关系，未认领或实施。

本轮判断为未分配任务首选。56 已提交 a8733143f47230d996303d174b2ca9dcaf0b1c87，已提供 market/limit increase、TP/SL、发送与确认刷新；在该提交的共享 TradeBox 中未发现 `useGmsolOrderTransactions` 调用。56 现有实测记录指出 header 钱包已连接，但 TradeBox 仍显示 Connect Wallet；`useTradeButtonState` 仍依赖 account/signer，这使共享钱包/按钮/交易入口适配成为明确实施缺口。不得复制 nightly TradeBox。

最小有效阶段为共享 market increase：Solana session、输入/预览与余额风控、56 sender、提交阶段反馈和账户刷新，随后覆盖 limit、附带 TP/SL 与已有仓位/订单的选择，保持同一逻辑任务。19 明确不等待执行阶段 toast；20 是后续成交跟踪，不应人为成为 19 的前置。

开发可集成未合并前置：56 已含 52/#3193、51/#3195、57/#3242、92/#3243、字段 #3205/#3207；真实市场/仓位入口还涉及15/#3201、25/#3238。余额 PR 尚有空 System-owned ATA 审查缺口。数学启用112、费用折扣/真实 API、71 frozen LUT 与覆盖仍限制完整主网验收；部分 TP/SL 组合超1232字节，不应承诺冻结 LUT 就够。k-token visualMultiplier、最大杠杆、TP/SL 百分比分母与 SDK simulate_order 对齐也属于整需求范围。

允许叠前置提高开发就绪程度，不等于可独立 release 交付或主网验收。未执行测试、签名广播或创建分支。固定 heads、版本与全部候选比较见[任务评估](../solana-next-task-2026-11-13.md)。

## 2026-11-13 并行实施记录

角色：实现负责人（与 FESOL-20 并行），协调 FESOL-56 前置集成。

实现分支：`solana-tradebox-entry-fesol-19`，当前整合 head `5ceb145308`。FESOL-20 的 sender identity、即时提交回调、延迟索引跟踪和通知生命周期通过精确 cherry-pick 集成；FESOL-56 保持独立 worktree，未把其未确认的生产 LUT 能力当作验收条件。

已完成共享 TradeBox 的 Solana market/limit increase、atomic attached TP/SL、已有仓位 TP/SL 创建入口、SOL→WSOL 映射、partial collateral withdrawal、acceptable price/slippage、费用折扣与最大杠杆传递、price impact/execution price 展示、stale session 防护，以及 Solana 提交阶段即时反馈。edit/cancel 继续属于 FESOL-59，GT Rewards 因没有可靠统一数据契约未伪造。

整合验证：相关 TradeBox、decoder/reducer、RPC lifecycle、notification、sender 和 hook 共 7 个 suite / 30 tests passed；root 与 landing TypeScript passed；19 分支 clean。Chrome 原生窗口加载 `http://127.0.0.1:3017/trade`，可观察到 Solana 市场和 TradeBox。未执行钱包签名、广播、keeper 或生产 LUT 验收。

并行经验：worktree 不隔离 locale 生成物和忽略目录，必须路径级 restore 后再精确 cherry-pick，禁止 `git add .`；共享 sender/notification 由协调者维护；独立 node_modules、SDK build 和端口可减少资源争用。非最终本地提交按用户授权使用命令级 `commit.gpgsign=false`，未修改全局配置。
