# FESOL-19 — 共享 TradeBox 的 Solana 下单入口

## 五需求目标实施接续（2026-11-18 深夜）

TRD-70接续72 Lighthouse与78失败原因展示，另接地址key；原暂缓范围不恢复。 已同步release `38b1503444`。具体提交、验证、推送与剩余金融/LUT验收见[统一实施记录](../solana-trading-dependencies.md#五需求跟进实施2026-11-18-深夜)。目标持续active，修复交付不等于完整主网矩阵完成。

## 上游与后续核查（2026-11-18 23:12 CST）

当前TRD-70；#3262仍 `532c8c050d`、Draft，无新review。代码核对缺72的Lighthouse兼容及78的失败reason，两者136/playground均已有；余额#3195地址key新提交未接入。先精确接续现有修复，不恢复swap/max leverage/完整simulate_order/GT Rewards暂缓项。证据见[统一核查](../solana-trading-dependencies.md#四需求与-trd-136-最新跟进核查2026-11-18-2312-cst)。

## 正式替代实施（2026-11-17）

TRD-70 原开发/交付线已精确接续 TRD-72 本轮正式余额/字段候选差异；既有 swaps/max leverage/full simulate_order/GT Rewards 暂缓边界保留。 验证和推送收尾状态以[统一实施记录](../solana-trading-dependencies.md#trd-136-正式替代实施2026-11-17)为准。

## 五需求前置接续实施完成（2026-11-17 晚间）

已授权并接续原开发/交付线最新release、保留SDK双侧导出；最终API2.9.3隔离验证已通过，原4条交付实际目录验证、普通推送及Draft正文更新已完成。真实交易/退出等暂缓边界不变。版本、证据及当前未完成项见[统一实施记录](../solana-trading-dependencies.md#五需求前置接续实施完成2026-11-17-晚间)。

## 五需求晚间前置核验（2026-11-17）

市场/header与列表前置已合入release，可接续原线并保留余额/TP-SL/恢复扩展；此前明确暂缓范围不自动恢复。 角色为只读依赖调研，来源与验证边界见[统一核验](../solana-trading-dependencies.md#五需求晚间前置核验2026-11-17)。

## 四条批次状态复核（2026-11-17）

只读核对当前 Linear、原 Draft PR 和最终 head CI；最新 release 冲突与 CI 收尾结果见[统一复核](../solana-trading-dependencies.md#四条批次状态复核2026-11-17)。本轮未改业务或执行交易，既有验收边界保留。

## 上游跟进实施（2026-11-17）

TRD-70 原 development/delivery 已同步 release `7868f48f3e` 并精确接续 #3243 等值常量复用。真实钱包余额接线仍在原 development `9a3342837b`，delivery 包含精确提交 `d0726f09d9`；本轮将其纳入同一原 Draft #3262 的更新范围。15/25额外列表/selector范围仍按原边界，不整支合入delivery；PR差异收敛为135文件。随后跟进远端CI发现4条lint warning，在原线 `5c5acd03fb` 修复import顺序/fixture引用，精确进入delivery `00d5d7b138` 和136 `0a6277ec90`；保留全部余额断言，未放宽lint。最终head与检查见统一实施表。 统一来源、交付版本、验证和外部剩余项见[五需求跟进实施](../solana-trading-dependencies.md#五需求跟进实施2026-11-17)。

## 前置增量核验（2026-11-17）

当前TRD-70五需求前置核验：65已合，100/80可推进review；原PR3262仍996a167e5c，本地余额修复delivery d0726f09d9未推送。只读核验不自动更新PR。 统一证据、版本及跟进建议见[五需求依赖核验](../solana-trading-dependencies.md#五需求前置增量核验2026-11-17)。

## 本地真实交易版本评估（2026-11-16）

用户询问不等待LUT/API正式前置、自行本地实现的可行性；本轮仅评估。已核对原development的下单math gate、市场/账户数据依赖及既有RPC发送/跟踪：有条件可行，优先复用本地API#340和个人冻结LUT，纯浏览器RPC适配成本更高。最小范围、替代方案、真实输入及keeper边界见[统一可行性评估](../solana-trading-dependencies.md#不等待71112正式交付的本地交易可行性2026-11-16)。未改业务、启动服务或执行链上写入，不自动恢复原暂缓范围。

## Review 经验复审（2026-11-15）

已先核对原development与远端Draft的成果同步，再按新review经验审查。最新版本、发现/修复、定向验证与运行边界统一见[四PR复审](../solana-trading-dependencies.md#基于-review-经验的四-pr-复审2026-11-15)。本轮未确认新的P0/P1/P2代码问题；56/20/19已补齐过期交易README并推送原PR，72产物无需改动。以下剩余验收/暂缓项继续有效，不据复审通过修改需求状态。

## 剩余事项与恢复条件（2026-11-15）

基于本日目标收尾的已核验证据整理，未新增远端调查。本节作为下一次接续入口，优先于下方历史候选与旧阻碍。

| 待完成事项 | 恢复条件与下一步 | 完成证据 |
| --- | --- | --- |
| 真实已连接账户页面与下单 | 可信LUT/API rollout及56流程就绪，钱包操作获授权后，验证实际余额/仓位/订单、输入到预览校验到提交、确认刷新 | 最终整合页的真实账户、费用/价格、交易回执及数据变化；无钱包输入渲染不作金融数值验收 |
| 恢复入口与交易反馈的浏览器验收 | 有真实部分准备成功、拒签、未知receipt或待恢复订单条件时，核对UI提示、主动重试/取消、原动作跟踪类型及会话切换 | 真实页面与交易证据；未知状态先reconcile，禁止重签重复金融动作。既有离线恢复/会话测试沿用 |
| 暂缓：最大杠杆一致性 | 用户明确恢复此范围后，核对共享计算、费用buffer、输入限制和参考值 | 共享计算到实际UI的同输入结果及边界回归；暂缓不等于豁免 |
| 暂缓：支付币兑换抵押品 | 明确恢复范围且路由/输入契约可用后，复用共享swap数据与固定ABI，不能猜测路由或替代服务 | 真实路由、价格保护与资金变化验收 |
| 暂缓：完整simulate_order数学对照 | 明确恢复范围且固定市场/仓位/价格输入与参考版本具备后实施 | 同输入可复现数值对照，包含费用/impact等所需范围；API契约通过不代替数学等价 |
| 暂缓：GT Rewards | 明确恢复范围并取得产品/数据契约后实施 | 与确认契约一致的共享数据消费和产品行为 |
| 前置与独立交付差异收口 | 当前19代码依赖20；跟随52/56/20等前置进入release再精确收口#3262，不将development已有15/25整支带入delivery | 最终PR只含应交付差异、实际目标验证及review；若要求脱离20交付，需先明确产品/交付取舍 |

共享外部条件见[恢复条件](../solana-trading-dependencies.md#四需求剩余事项与恢复条件2026-11-15)。开发 `43a3466b40`，交付 `50f45cfd57`。此前真实浏览器市场/输入/设置/刷新/切链和空态检查已完成，不重复列为新开发。


## 四 PR 目标执行（2026-11-15）

消费56同一紧凑编码修复，完成原生Chrome整合输入/市场/列表空态/设置及切链回归；钱包未连接，恢复入口与真实仓位未冒充验收。 完整版本、验证与外部条件见[统一执行结果](../solana-trading-dependencies.md#四-pr-目标执行结果2026-11-15)。本节优先于下方历史1255-byte限制及候选。


## Base58 TP/SL 预览修复已交付（2026-11-15）

用户授权按推荐顺序实施。本轮在原 development 修复并提交 `2b52d15ec3`，精确 cherry-pick 到原 delivery `40653d3026`，两路已分别推送 my-gmx/my-gmx-pr，[原 PR #3262](https://github.com/gmx-io/gmx-interface/pull/3262) 保持 Draft。未恢复下文暂缓项。

`buildTpSlPositionInfo` 对 `tradeMath: gmsol` 使用显式预览 identity override：已有 position 可保留其 API contractKey，新仓位尚无 position account 则为空；不再把 base58 owner/market/collateral 送入 EVM ABI 哈希。`getPendingMockPosition` 默认哈希行为保持，其他 EVM optimistic callers 不变。未伪造 Solana PDA，也未放宽 SDK 地址校验。

先增加调用真实 builder 的回归，修复前 Solana 多空两项 InvalidAddressError、EVM 对照通过；修复后 development 与实际 delivery 各 3 suites / 25 项全通过，分别通过 app/landing types，改动文件 ESLint/Prettier 与 diff 检查通过。离线报告位于个人基础 `.local/acceptance/frontend-offline/run-96IhV7/`（red）、`run-FwJG8M/`（development green）、`run-47jWh6/`（delivery green）。没有新的已连接钱包 UI/链上签名、广播或完整 raw-account simulate_order 验收。该修复解除函数级异常，不代表 API/LUT 上线或完整需求验收。

最终 head `40653d3026` 的 GitHub 检查已核对：除组件 workflow 外其余已完成检查通过或按配置 skipped；组件 workflow 的 Run component tests 与上传 artifact 步骤成功，失败位于 Deploy report to GitHub Pages（bot push 403）和 Post report link（Resource not accessible by integration / 403）。未修改 workflow token 权限或发布评论。日志为个人基础 `.local/acceptance/upstream-followup-20261115/fesol19-final-ci-failure.log`，对应 [workflow](https://github.com/gmx-io/gmx-interface/actions/runs/43672575371)。

## Base58预览异常定位（2026-11-15）

角色：只读诊断/可推进性调研。development `1155c46f87`与delivery `e4e9067a0f`相关文件一致。SideOrderEntry消费的selector虽改走buildTpSlPositionInfo，仍调用getPendingMockPosition并以base58 owner/market/collateral执行EVM hashedPositionKey。提取当前四个原函数的最小执行诊断中，EVM对照正常返回，真实API fixture owner的Solana多空均抛InvalidAddressError。触发前提是已连接账户及有效计算预览数据；当前公开API缺math/旧未连接钱包页面回归不能排除该错误。本轮未作新的完整selector/UI运行，也未修复。将其列为首选独立正确性切片，不自动恢复兑换/最大杠杆/simulate_order/GT Rewards暂缓项；详情与最小验收见[可推进切片](../solana-next-task-2026-11-15.md)。

## 上游刷新与证据边界（2026-11-14）

本轮新增事实、契约适配、交付及验收结果见[四需求统一记录](../solana-trading-dependencies.md#四需求上游刷新2026-11-14)，优先于下方历史状态。Linear目标访问返回Entity not found，不能据历史正文或评论判定本轮实时状态；GitHub、源码及部署按统一记录分别核验。


## release Draft 已交付（2026-11-13）

用户明确授权整理20/19 Draft到release，已创建 [PR #3262](https://github.com/gmx-io/gmx-interface/pull/3262)，保持Draft、base release。交付head `2b7642e7e50f7fb1c9aaeef15f5bd9b27e5d3669`，分支 `solana-tradebox-entry-release-fesol-19`，目录 `/Volumes/kenny/gmx/gmx-interface-fesol-19-release`。本次仅交付现有成果，没有恢复下方暂缓开发项，也未修改Linear状态。

基于最新release `83474e0e94c88c2b4a18cd436a564b97062f807f`，集成20 Draft #3261的纯产品delivery `41a6e9cba3`（集成commit `5eaf1486db`），精确转入19现有共享TradeBox、TP/SL目标价与恢复入口。20→56前置公开列在PR正文；三份trade-state/storage guard精确来自15/#3201 `056f8d689c`且与19 development一致，未整支带入15/25 selector/list UI、个人基础或参考gitlink。完整市场/仓位选择仍需15/#3201、25/#3238，不伪称独立可合并。

实际交付目录完整frontend **3468 passed/1 skipped**（346 files passed/1 skipped）；完成immutable install（含独立SDK postinstall build）、Lingui、app/landing types、production app/WASM build及19变更TS的ESLint/Prettier/自身diff check；构建均使用8GiB。全部转入的19 TS源码和development `c708d8a634`一致。SDK source/lock/config/vendor与20 delivery完全相同，复用其65 files/954 passed结果，不冒充19重新跑过SDK suite。日志位于目标 `.local/acceptance/draft-delivery-20261113/`。生成WASM glue的继承EOF空行warning保留，不更改固定vendor。无新浏览器或真实交易验收；下方延期清单、71/112、版本确认等边界仍适用。PR后修复仍先回原development，再精确更新同一Draft。


## 当前决定：剩余问题暂缓（2026-11-13）

用户明确认为FESOL-19剩余问题可以之后解决，本阶段停止主动推进这些剩余项，保留当前成果。此决定是实施优先级调整，不代表需求已完成、验收通过或范围豁免；不修改Linear状态，也不把原需求条件删去。

后续恢复清单：

- 最大杠杆展示与实际可提交上限的一致性：当前测试能拒绝费用后保证金不足的100/101倍输入，但未证明展示上限本身可直接提交。需核对市场菜单、Adjust Leverage和下单输入；涉及57公式时交其负责人确认，不直接修改他人实现。
- 支付币到抵押品兑换：当前仅支持直接抵押品支付，仍需核实路由输入、固定WASM能力及指令/账户校验契约，未证明可直接完整实施。
- `simulate_order`同输入数值对照：尚缺完整原始市场账户、supply、价格及仓位快照；现有selectors/mapper检查不替代此验收。
- GT Rewards数据和展示契约：待核实或确认，不能自行定义新字段/数值。
- 完整下单及附带TP/SL的真实验收：仍需112线上数学能力和56/71可信LUT、交易条件，现有离线测试不替代实际落链。

恢复入口：用户明确恢复后，从原开发分支`solana-tradebox-entry-fesol-19`、worktree `/Volumes/kenny/gmx/gmx-interface-fesol-19`接续；本轮保存head `c708d8a634`。沿用下文及[统一实施记录](../solana-trading-dependencies.md#独立开发切片实施结果2026-11-13)的验证证据，仅刷新受影响来源。当前不因存在上述可做事项自动继续开发。

## 五条内部依赖同步收尾（2026-11-13）

已确认共享运行源码和20一致，新增交付依赖说明并推送 `c6b20fd8d4`；保留market两阶段通知，20为当前代码前置。组合41项通过。 完整版本矩阵、验证边界和已保留的依赖顺序见[统一记录](../solana-trading-dependencies.md#五条内部同步结果2026-11-13用户限定不处理外部依赖)。用户本轮明确暂不处理五条之外的依赖；不将本次内部同步视为完整需求验收。

## 交易链路依赖统一核验（2026-11-13 16:16）

本轮参与跨需求依赖分析，核对实际集成版本、PR堆叠和merge-tree预检。新增结论、责任边界与跟进顺序统一见[交易链路依赖审计](../solana-trading-dependencies.md)，不将预检当作实际合并或组合测试通过。

## 负责人确认（2026-11-13 16:12，Asia/Shanghai）

用户明确 FESOL-19 由 kenny 负责，并授权修改 assignee。已通过 Linear MCP 仅将 assignee 从空更新为 kenny（`3dfe9db7-5e43-4d28-8b57-eb40462dd679`），返回状态仍为 Execution。正文历史 Owner 标记未改；下方未分配观察保留为修改前记录。

## 当前状态复核（2026-11-13 16:08，Asia/Shanghai）

角色：只读状态与依赖调研。实时查询正文、双向关系、评论、关联 PR checks，并对照既有实施记录；本节优先于下方历史状态。

实时 Linear 已为 Execution，assignee 仍为空（正文 Owner 为 chloe）；本地实现由既有任务承担，不据此修改线上分配。开发 head `0d7b4b49a7` 与 my-gmx 远端一致、工作区干净；GitHub 按五个编号搜索未发现专属 19 PR。已同步 56 的意图快照/freshness/确认 slot 修复、57 `f16deff8a7` 和 72 固定 `0.11.0-beta.1`。共享 GmsolTradeboxAdapter 确实消费 sender 与 notifications，旧“未接 sender”观察已过时。既有整合全量 3464 passed/1 skipped、types/build 和 SDK 952 passed 可按版本复用，本轮未重跑或操作浏览器。

新增范围核对：正文要求 payment-to-collateral conversion，而当前 `transactions/buildOrderTransactions.ts` 明确拒绝非空 swapPath 或 payToken≠collateralToken（Native SOL→WSOL 另有支持）；不能把同币下单/SOL wrapping 当作完整兑换能力。GT Rewards 契约、simulate_order 对照、真实交易/TP/SL 与 keeper 验收仍未完成。线上 markets/config 67 个市场无 tradeMath；71 仍 Todo、无新地址。

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


## 2026-11-13 FESOL-56 PR 后依赖复核

角色：下游依赖影响分析；本轮未修改业务分支。实时确认 [UI#3258](https://github.com/gmx-io/gmx-interface/pull/3258) OPEN/Draft，head `b2fdb4c74543c31523a845eae7ee1cd27356822a`，Linear 56 为 Review、无评论。19/20 仍分别为 `5ceb145308`/`1608901e2b`，均 clean，但未接入 56 后续修复：`722d1cdbaa`（等待 RPC 前克隆 action）、`ccbde8e995`（主动刷新使用 freshness envelope）、`5ba8eaf327`（确认 slot 下限在刷新失败后保留并约束后续读取）。后两项已在 56 修复发布，但在下游旧代码中仍存在，不能复用 56 修复后的验证结果冒充下游通过。

建议先在 20 原 development 精确转入 56 业务修复、保留 20 sender identity/onSubmitted/trackingRequests/失败分类，再接入 19；共同基线只接受一份实现，避免两个现场独立解同一 sender 冲突。需在实际整合目录验证 SWR hook 确认刷新、失败后追赶、sender 和 lifecycle 组合。

本次最新 head CI：Audit、SDK standalone build、Lint/Type Checking/Tests 均 SUCCESS；Component Tests job FAILURE 的失败步骤是报告 Pages 发布和评论 403，报告正文 All tests passed；不是用例失败，但总 CI 尚非全绿。无 GitHub reviews/inline comments。71 仍 Todo，无新评论或替代 LUT 地址；未重新查询链上表状态。既有 1255-byte 有限价 atomic 限制与四钱包真实落链未解除。

72 本地进行中记录已按用户指定 stable 固定 `0.11.0-beta.1`，采用仓库内产物，并已集成 56 PR head；Linear 正文仍写 v0.10.0，不能拿旧正文覆盖用户明确目标。19/20 尚未接入该进行中产物，待其稳定后固定源码/哈希并验证 builder/validator/event ABI 组合。本轮公开 `/v1/markets/config` 返回 67 个市场，均未含 tradeMath；不能用本地数学通过证明线上 gmsol math rollout 完成。

19 另缺 56 已集成的 FESOL-57 `f16deff8a7`（当前 #3242 head）：涉及 limit acceptable price、零 token size、decrease、仓位净值/impact 与默认 impact buffer，应与 TradeBox mapper、TP/SL/最大杠杆一起复验。#3193 最新仍 `258e4da6ab`，56 PR 明列只集成旧 `732b4a1322`；共享 SDK provider 迁移需单独审查，不能以 56 最新就假定全部依赖最新。#3201/#3238 仍 OPEN；最终 release 交付仍需厘清这些未合并前置，不随意把它们混入独立 PR。


## 2026-11-13 下游修复接入与重启恢复

角色：实现/整合。原开发分支保留，未触碰 56/72 的业务现场。已精确接入 56 `722d1cdbaa`、`ccbde8e995`、`5ba8eaf327`：准备 RPC 前快照订单意图、主动缓存写入 freshness envelope、确认 slot floor 跨失败刷新/普通轮询持续生效；保留 20 sender 的即时通知、trackingRequests 和已知失败分类。冲突仅在 sender spec 的追加区域，保留新安全向量和原 20 索引延迟回归；后者通过独立修正提交恢复，不用覆盖 sender 实现解决冲突。

两个分支也接入 FESOL-57 `f16deff8a7`，以及 72 已发布 #3259 的业务提交 `6b3b5ec259`、`ae7c2ad21a`、`9fbd7d33f5`；固定 SDK `0.11.0-beta.1`、WASM SHA-256 `e82184caacc60828f024743f88a0a92d97b9d3d55db6839e0d3fab8a9b46c840`，安装 immutable。72 PR head `0f36780317` 已实时确认 OPEN/Draft；没有使用其先前变化中的未提交产物。严格 event decoder 的四个 discriminator 和全部 15 个相关类型已对照 `7fe4008292ffc09061f3a733ad9b5cd2e6235fa8` IDL，排除 docs 后逐结构一致，兼容说明进入业务 README；不改历史 fixture provenance，也不据此宣称部署 ABI 已验证。

Mac 意外重启后核对工作区均 clean，未完成类型/全量测试重新执行；此前 20 56-only 修复版本全量 3454 passed/1 skip、types passed，只作为该版本证据。19 SDK 被输入变化保护拒绝过一次，未替换旧产物；固定新依赖后重新构建 verify passed（1200 artifacts）。两个分支各自重建 SDK，未共享输出。日志最终复制到各自忽略目录 `.local/acceptance/followup-20261113/`，避免只保留易失 /tmp。

本轮新增修复：真实页面输入 TP/SL 时错误显示 EVM“最多 0 个自动取消订单”警告，已仅在非 Solana 渲染该提示，保留 EVM 行为。现有 Chrome 新 tab 验证 3017 指向 19 worktree：10 USDC 输入、市场/限价、多空切换、TP/SL 价格输入、执行价格/费用/抵押品价差展示；修复后错误警告消失。未解锁 Phantom、连接/签名/广播，没有把无钱包状态下的 PnL 占位和输入可见当作完整计算验收。已关闭自己新建的 tab 并停止 3017；未触碰另一个 72 的 3072 服务。19 新产物生产 build passed（15300 modules），SDK 64 suites/952 tests passed。

最终 head `0d7b4b49a7`；完整 frontend 346 suites passed/1 skipped、3464 tests passed/1 skipped；app+landing tscheck（UI 修复后再次通过）、变更 ESLint、Prettier、diff check 均通过。生产 build 与 SDK 952 tests 结果见上；20 的独立目录检查不冒充本目录通过。开发分支已推送 my-gmx，尚未创建本需求 PR，未更新 Linear/外部评论。剩余真实交易、simulate_order 对照、GT Rewards 契约、线上数学 rollout 与前置 PR 交付边界保持明确。

## FESOL-52 共享 Provider 关联接入（2026-11-13）

用户授权的52依赖整合覆盖本需求。原始52 head `258e4da6ab`的消费、共享SDK传递、确认slot/freshness保护及通知组合统一记录于[依赖审计](../solana-trading-dependencies.md#fesol-52-最新依赖接入2026-11-13)。沿用原development现场，未另起并行实现或覆盖下游扩展。本次不补签名/广播证据，不解除已有外部验收条件。

## 2026-11-13 独立开发切片实施

角色：实现：输入/TP-SL修复及共享恢复入口。实施、版本、行为证据与剩余边界见[统一记录](../solana-trading-dependencies.md#独立开发切片实施结果2026-11-13)。未进行真实钱包签名/广播，既有外部验收条件未解除。

## gmx-prompts review 与修复（2026-11-13）

角色：实现与审查。按 gmx-prompts 对当前 Draft #3262 及 release merge result 完成代码、GMX/Solana、安全、状态收尾与运行检查。确认并修复共享 TradeBox 的 EVM account-type 与 incentive 请求泄漏；修复前回归实际失败，修复后跨网络隔离通过。另修复零 warning CI fixture 并消费 20 import 修复。development `e4cf921834`，delivery `69ba4dab7a`，均已推送；保持原 Draft。实际 delivery 严格 lint/types、完整 frontend 3469 passed/1 skipped、8GB production build passed。线上 67 市场均无 tradeMath；真实签名和 deferred scope 未解。审查/逐项验收矩阵、原生浏览器样本及限制见[统一记录](../solana-trading-dependencies.md#gmx-prompts-review-与修复2026-11-13)。


## 2026-11-14 独立推进收尾

最终CI、19交付组合的原生Chrome未连接钱包回归与56固定WASM原子体积归因已完成，详见[三项收尾](../solana-trading-dependencies.md#独立推进三项收尾2026-11-14)。四PR关键代码检查通过；组件报告403，56另有1 flaky重试通过。未确认需新增业务修复的问题，HEAD未变。原子组合仍1255/1232 bytes，假设单表1221不代表真实LUT可用。71/112及真实钱包验收未解除；72版本已由用户确认。既有Draft正文已更新，未转正式review。


## TRD-136 真实钱包联调发现的余额接线修复（2026-11-16）

当前编号 TRD-70，沿用原任务及 Draft #3262。真实 Phantom 连接后，既有 owner/network scoped useSolanaBalances 已返回实际余额，但 useGmsolTokensData 只有价格，balance/walletBalance 未赋值，loaded flags为false，共用TradeBox因此误报USDC不足。修复在原 development `9a3342837b`：Provider复用既有余额Hook，错误时不提供余额；TokensData按mint合并真实balance/walletBalance并设置loaded flags，未知/切换/错误保留undefined，真实零保持0，GMX-account余额标记仍false。没有增加重复RPC层或本地数值覆盖。

新增消费者回归覆盖 pending→funded→scope/error unknown→真实零；原开发目录相关3 suites/12 tests与TypeScript通过，全量352 suites passed/1 skipped、3484 tests passed/1 skipped。本任务精确cherry-pick `3cee91eb7e`，该目录TypeScript与相关12tests通过；原release delivery精确转入 `d0726f09d9`，该目录TypeScript与相关12tests通过。交付提交仍仅本地，未推送更新PR；不把开发全量结果冒充delivery全量。

现有原生Chrome在TRD-136集成页验证真实余额展示，3 USDC/6 USD多空输入通过；1 USDC被最低保证金校验阻止。没有订单提交、签名或广播。复用判断更新 [RL-02](../review-lessons.md#rl-02-数据含义与完整性)：RPC读取成功仍需追踪共享消费者，不能只看Hook就确认余额业务可用。
