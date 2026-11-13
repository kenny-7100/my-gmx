# FESOL-20 — 订单发送与成交状态

## 五条内部依赖同步收尾（2026-11-13）

共享契约说明作为唯一来源提交 `e2b6b354aa` 并精确同步19；组合39项通过，sender扩展和56安全修复均保留。 完整版本矩阵、验证边界和已保留的依赖顺序见[统一记录](../solana-trading-dependencies.md#五条内部同步结果2026-11-13用户限定不处理外部依赖)。用户本轮明确暂不处理五条之外的依赖；不将本次内部同步视为完整需求验收。

## 交易链路依赖统一核验（2026-11-13 16:16）

本轮参与跨需求依赖分析，核对实际集成版本、PR堆叠和merge-tree预检。新增结论、责任边界与跟进顺序统一见[交易链路依赖审计](../solana-trading-dependencies.md)，不将预检当作实际合并或组合测试通过。

## 当前状态复核（2026-11-13 16:08，Asia/Shanghai）

角色：只读状态与依赖调研。实时查询正文、双向关系、评论、关联 PR checks，并对照既有实施记录；本节优先于下方历史状态。

实时 Linear 为 Execution、kenny，无评论；开发 head `d677e174c1` 与 my-gmx 远端一致、工作区干净；GitHub 按五个编号搜索未发现专属 20 PR。56 三项安全修复、57 `f16deff8a7` 与 72 固定新版 WASM 均已接入，旧“下游未同步”段落仅保留历史。既有完整 frontend 3454 passed/1 skipped、types、目标检查/构建证据仍按下文范围，不重复声称本轮重跑。RPC parser/reducer/tracker 和共享通知已有实现及历史只读回放；新订单、实际 keeper 结果、取消原因和浏览器两阶段 toast 尚无完整验收证据。受信 LUT/71 仍限制真实生产流程；19 的提交阶段反馈与本任务成交跟踪仍区分。

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


## 2026-11-13 FESOL-56 PR 后依赖复核

角色：下游依赖影响分析；本轮未修改业务分支。实时确认 [UI#3258](https://github.com/gmx-io/gmx-interface/pull/3258) OPEN/Draft，head `b2fdb4c74543c31523a845eae7ee1cd27356822a`，Linear 56 为 Review、无评论。19/20 仍分别为 `5ceb145308`/`1608901e2b`，均 clean，但未接入 56 后续修复：`722d1cdbaa`（等待 RPC 前克隆 action）、`ccbde8e995`（主动刷新使用 freshness envelope）、`5ba8eaf327`（确认 slot 下限在刷新失败后保留并约束后续读取）。后两项已在 56 修复发布，但在下游旧代码中仍存在，不能复用 56 修复后的验证结果冒充下游通过。

建议先在 20 原 development 精确转入 56 业务修复、保留 20 sender identity/onSubmitted/trackingRequests/失败分类，再接入 19；共同基线只接受一份实现，避免两个现场独立解同一 sender 冲突。需在实际整合目录验证 SWR hook 确认刷新、失败后追赶、sender 和 lifecycle 组合。

本次最新 head CI：Audit、SDK standalone build、Lint/Type Checking/Tests 均 SUCCESS；Component Tests job FAILURE 的失败步骤是报告 Pages 发布和评论 403，报告正文 All tests passed；不是用例失败，但总 CI 尚非全绿。无 GitHub reviews/inline comments。71 仍 Todo，无新评论或替代 LUT 地址；未重新查询链上表状态。既有 1255-byte 有限价 atomic 限制与四钱包真实落链未解除。

72 本地进行中记录已按用户指定 stable 固定 `0.11.0-beta.1`，采用仓库内产物，并已集成 56 PR head；Linear 正文仍写 v0.10.0，不能拿旧正文覆盖用户明确目标。19/20 尚未接入该进行中产物，待其稳定后固定源码/哈希并验证 builder/validator/event ABI 组合。本轮公开 `/v1/markets/config` 返回 67 个市场，均未含 tradeMath；不能用本地数学通过证明线上 gmsol math rollout 完成。


## 2026-11-13 下游修复接入与重启恢复

角色：实现/整合。原开发分支保留，未触碰 56/72 的业务现场。已精确接入 56 `722d1cdbaa`、`ccbde8e995`、`5ba8eaf327`：准备 RPC 前快照订单意图、主动缓存写入 freshness envelope、确认 slot floor 跨失败刷新/普通轮询持续生效；保留 20 sender 的即时通知、trackingRequests 和已知失败分类。冲突仅在 sender spec 的追加区域，保留新安全向量和原 20 索引延迟回归；后者通过独立修正提交恢复，不用覆盖 sender 实现解决冲突。

两个分支也接入 FESOL-57 `f16deff8a7`，以及 72 已发布 #3259 的业务提交 `6b3b5ec259`、`ae7c2ad21a`、`9fbd7d33f5`；固定 SDK `0.11.0-beta.1`、WASM SHA-256 `e82184caacc60828f024743f88a0a92d97b9d3d55db6839e0d3fab8a9b46c840`，安装 immutable。72 PR head `0f36780317` 已实时确认 OPEN/Draft；没有使用其先前变化中的未提交产物。严格 event decoder 的四个 discriminator 和全部 15 个相关类型已对照 `7fe4008292ffc09061f3a733ad9b5cd2e6235fa8` IDL，排除 docs 后逐结构一致，兼容说明进入业务 README；不改历史 fixture provenance，也不据此宣称部署 ABI 已验证。

Mac 意外重启后核对工作区均 clean，未完成类型/全量测试重新执行；此前 20 56-only 修复版本全量 3454 passed/1 skip、types passed，只作为该版本证据。19 SDK 被输入变化保护拒绝过一次，未替换旧产物；固定新依赖后重新构建 verify passed（1200 artifacts）。两个分支各自重建 SDK，未共享输出。日志最终复制到各自忽略目录 `.local/acceptance/followup-20261113/`，避免只保留易失 /tmp。

最终 head `d677e174c1`；新 SDK 下完整 frontend 344 suites passed/1 skipped、3454 tests passed/1 skipped，app+landing tscheck、变更 ESLint、diff check、WASM build 与 SDK artifact verify 均通过。SDK 源码及构建输入与 19 相同（输入摘要 aaa5827f…），复用 19 SDK 全量 952 passed；组合页面/生产 app build 在 19 的整合目录实际完成，不冒充 20 目录单独做过完整生产 build 或真实 toast 验收。开发分支已推送 my-gmx，未创建 20 PR、修改 Linear 或发送外部评论。新订单与两阶段 toast 仍需可信 LUT 和明确钱包交易授权。

## FESOL-52 共享 Provider 关联接入（2026-11-13）

用户授权的52依赖整合覆盖本需求。原始52 head `258e4da6ab`的消费、共享SDK传递、确认slot/freshness保护及通知组合统一记录于[依赖审计](../solana-trading-dependencies.md#fesol-52-最新依赖接入2026-11-13)。沿用原development现场，未另起并行实现或覆盖下游扩展。本次不补签名/广播证据，不解除已有外部验收条件。
