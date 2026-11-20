# FESOL-20 — 订单发送与成交状态

## 五需求现状复核（2026-11-20）

本轮只读核对五条 Linear 正文/关系/空评论与对应上游 PR/head/checks/review。当前状态、Divhead 新增72原子订单准备拆分提交及尚未进入下游历史、78报告发布失败边界，见[统一核查](../solana-trading-dependencies.md#五需求当前状态复核2026-11-20)。未改业务、外部状态、部署或交易；既定暂缓及未完成验收范围继续有效。

## 下一条正式 review 推荐（2026-11-19 15:13 CST）

本轮只读核验后，推荐 TRD-78 / #3316 作为下一条正式申请 review 的 PR：77/#3314及72/#3315已Ready且已请求团队review；78生命周期/通知范围比70集中，70又消费78。当前head `164102b83c` 主检查先因公网fetchMarkets AbortError失败、随后同head通过；组件286项通过，报告gh-pages并发push仍失败，不称全绿。已有市价开/平仓消费证据不替代真实取消reason、异常路径及完整AC。最新release前进至 `2c107c63a1`，本轮未同步分支。完整比较、代码证据、检查链接和送审边界见[统一推荐](../solana-trading-dependencies.md#下一条正式-review-推荐2026-11-19-1513-cst)。未转Ready、请求reviewer、改Linear或发送消息。


## 开仓后同步警告修复（2026-11-19）

TRD-72 原线分离正常账户同步与真实刷新错误，TRD-70 保持同步期间下单禁用；同一修复已接续本需求原development/delivery并推送既有上游PR。具体提交、各目录验证及playground部署结果见[统一修复记录](TRD-136.md#开仓后同步警告修复交付2026-11-19)。本轮未执行新交易，不扩大原需求金融或钱包验收。

## 五需求最新状态复核（2026-11-19 10:27 CST）

本轮只读复核 Linear 正文/关系/评论与当前上游 PR/checks/review。状态、#3314 已转 Ready 事件、#3316/#3317 组件测试286 passed但报告发布 gh-pages 非快进失败，以及验收边界见[统一核查](../solana-trading-dependencies.md#五需求实时状态复核2026-11-19-1027-cst)。未改业务、PR/Linear 状态、CI、部署或钱包。

## 保留多提交的上游 PR 迁移（2026-11-19）

原 fork #3261 已迁移为上游仓库内 Draft [#3316](https://github.com/gmx-io/gmx-interface/pull/3316)，原 PR 已关闭。原 31 个 commit 的拆分、顺序、message、逐提交 tree 与 merge 父节点映射均保留；所有 PR commit 经 GitHub 验证为有效 GPG 签名。新 head `5da468c4a3`，最终 tree 与原 `00f93d0687` 一致，未新增业务修改或同步 release。旧历史备份于本地 refs/backup/pr-3261-before-gpg-migration，commit 映射与远端验证快照留忽略目录 .local/pr-upstream-migration。交付 registry 已绑定上游 origin/新 PR；普通需求 development 未改，playground 因原 26 个提交全签名，保持 SHA 不变。已有同源码测试证据可复用，本轮只验证历史/内容/签名，不声称新 PR CI 已结束，也不重新执行钱包或交易。完整批次见[迁移结果](../solana-trading-dependencies.md#保留多提交的上游-pr-迁移完成2026-11-19)。

## TRD-78 正式平仓消费证据（2026-11-19）

原修复集成后的playground ca6fa8f824/4f3109d8完成用户签名的BTC多仓100%平仓：请求与keeper均finalized成功，8条Lighthouse断言成功，到账9.515259USDC，Order filled、空仓及刷新后余额得到核验。公网API首次stale503后恢复，minContextSlot以keeper471002042为floor返回471002755、0仓位/0订单。实际部署WASM下载hash仍为固定e82184ca…b46c840。具体回执与边界归[TRD-136](TRD-136.md#正式平仓到账与刷新闭环2026-11-19)。这是一种钱包/一个市价平仓样本，不扩大为完整AC；原暂缓范围不变。

## 五需求目标实施接续（2026-11-18 深夜）

TRD-78接续72 Lighthouse；同时保留sender跟踪回调，另接地址key。 已同步release `38b1503444`。具体提交、验证、推送与剩余金融/LUT验收见[统一实施记录](../solana-trading-dependencies.md#五需求跟进实施2026-11-18-深夜)。目标持续active，修复交付不等于完整主网矩阵完成。

## 上游与后续核查（2026-11-18 23:12 CST）

当前TRD-78；#3261仍 `0c50b8d579`、Draft，无新review。失败reason已交付，但sender仍旧逐字节比较，缺72 Lighthouse修复；接续时保留trackingRequests/receipts。136/playground已具备组合修复，无需重复搬运。余额新提交及矩阵边界见[统一核查](../solana-trading-dependencies.md#四需求与-trd-136-最新跟进核查2026-11-18-2312-cst)。

## Playground 下单异常原因展示修复（2026-11-18）

用户要求先补齐下单失败原因并更新 playground。本次回 TRD-78 原 development 实施：useSolanaOrderNotifications.failed 将 Error/带字符串 message 的对象/字符串异常的原因接入既有 reason 展示，不改变失败/广播未知/确认/执行的状态判定、签名链接、autoClose、owner/network/unmount guards。保留现有 generic 状态标题；无法取得字符串原因时不渲染对象或虚构原因。扩展现有真实通知组件回归，验证 LUT 原因显示及未知广播的原因、提示和 explorer 链接。

原 development `25affe5753` 已签名、推送 my-gmx；完整frontend 349 files/3475 tests passed、1既有skip，app/landing tscheck、定向lint/Prettier通过。lingui:prepare通过，无新增固定文案，生成的既有无关catalog漂移未交付。同补丁签名转入原delivery `0c50b8d579`、更新同一Draft #3261；该实际目录5项通知测试、types及定向lint通过，未将development全量结果冒充delivery重跑。TRD-136 `73947297f9` 与 playground `93ebbd773f` 均已签名推送。playground 的实际5项通知测试、lint/Prettier、app/landing types及production build通过；最终部署和远端CI见 [TRD-136](TRD-136.md)。本次不修改LUT、不代点下单或签名，不以展示修复宣称交易恢复。

## 正式替代实施（2026-11-17）

TRD-78 原开发/交付线已精确接续 TRD-72 本轮正式余额/字段候选差异，未改 watcher/receipt/recovery 语义。 验证和推送收尾状态以[统一实施记录](../solana-trading-dependencies.md#trd-136-正式替代实施2026-11-17)为准。

## 五需求前置接续实施完成（2026-11-17 晚间）

已授权并接续原开发/交付线最新release、保留SDK双侧导出；最终API2.9.3隔离验证已通过，原4条交付实际目录验证、普通推送及Draft正文更新已完成。真实交易/退出等暂缓边界不变。版本、证据及当前未完成项见[统一实施记录](../solana-trading-dependencies.md#五需求前置接续实施完成2026-11-17-晚间)。

## 五需求晚间前置核验（2026-11-17）

63/80及SDK2.9.3已合入，可随原交易线接续，保护sender/tracker及slot/freshness；真实通知验收未因上游合并完成。 角色为只读依赖调研，来源与验证边界见[统一核验](../solana-trading-dependencies.md#五需求晚间前置核验2026-11-17)。

## 四条批次状态复核（2026-11-17）

只读核对当前 Linear、原 Draft PR 和最终 head CI；最新 release 冲突与 CI 收尾结果见[统一复核](../solana-trading-dependencies.md#四条批次状态复核2026-11-17)。本轮未改业务或执行交易，既有验收边界保留。

## 上游跟进实施（2026-11-17）

TRD-78 原 development/delivery 已同步 release `7868f48f3e` 并精确接续 #3243 等值常量复用；保留本需求receipt/watcher/recovery/notification扩展，未改事件判定或重签保护。原 Draft #3261 继续同一逻辑开发线，Provider前置合并后PR差异收敛为112文件；最终head与检查见统一实施表。 统一来源、交付版本、验证和外部剩余项见[五需求跟进实施](../solana-trading-dependencies.md#五需求跟进实施2026-11-17)。

## 前置增量核验（2026-11-17）

当前TRD-78；PR3261 head未变，主体依赖TRD72和API确认刷新链路。136真实long已有两阶段证据，新API仍需核验coverage/minContextSlot行为后才能替换运行。 统一证据、版本及跟进建议见[五需求依赖核验](../solana-trading-dependencies.md#五需求前置增量核验2026-11-17)。

## Review 经验复审（2026-11-15）

已先核对原development与远端Draft的成果同步，再按新review经验审查。最新版本、发现/修复、定向验证与运行边界统一见[四PR复审](../solana-trading-dependencies.md#基于-review-经验的四-pr-复审2026-11-15)。本轮未确认新的P0/P1/P2代码问题；56/20/19已补齐过期交易README并推送原PR，72产物无需改动。以下剩余验收/暂缓项继续有效，不据复审通过修改需求状态。

## 剩余事项与恢复条件（2026-11-15）

基于本日目标收尾的已核验证据整理，未新增远端调查。本节作为下一次接续入口，优先于下方历史候选与旧阻碍。

| 待完成事项 | 恢复条件与下一步 | 完成证据 |
| --- | --- | --- |
| 新订单执行/取消的真实闭环 | 56可实际交易、可信LUT及钱包/keeper条件齐备并获授权后，验证market执行、limit/TP-SL创建与后续执行/取消，保持提交阶段与执行阶段区分 | 链上事件、order/action身份、receipt与keeper结果相互对应；历史回放不替代新订单 |
| 真实浏览器两阶段通知与恢复 | 使用19交易入口产生真实结果，验证sending/confirmed/unresolved/executed/cancelled、失败及取消原因、链接、关闭和超时/延迟后恢复 | 页面通知与真实状态对应，切钱包/网络/卸载不更新其他会话；既有真实组件/离线会话测试沿用 |
| API索引延迟后的状态刷新 | rollout后检查确认slot下限、延迟receipt/索引追赶和失败恢复，在当前部署/最终host上复验 | orders/positions刷新不回退旧快照，明确失败和未知结果不混淆，不重复发送 |
| 前置与release交付收口 | 随56/数据前置落release，精确整理原#3261并保持19消费接口 | 最终目录验证、CI和review收口；不整文件覆盖带扩展的sender |

共享资源、权限与CI边界见[恢复条件](../solana-trading-dependencies.md#四需求剩余事项与恢复条件2026-11-15)。开发 `beeb108e49`（含开发目录重复脚本键清理），交付 `a6f155737a`。离线parser/reducer/通知/恢复与会话组合已通过，不再列为待实现能力。


## 四 PR 目标执行（2026-11-15）

消费56同一紧凑编码修复并保留sender扩展；恢复会话与真实通知组合定向检查通过，未重复实现已有功能。 完整版本、验证与外部条件见[统一执行结果](../solana-trading-dependencies.md#四-pr-目标执行结果2026-11-15)。本节优先于下方历史1255-byte限制及候选。


## 上游刷新与证据边界（2026-11-14）

本轮新增事实、契约适配、交付及验收结果见[四需求统一记录](../solana-trading-dependencies.md#四需求上游刷新2026-11-14)，优先于下方历史状态。Linear目标访问返回Entity not found，不能据历史正文或评论判定本轮实时状态；GitHub、源码及部署按统一记录分别核验。


## release Draft 已交付（2026-11-13）

用户明确授权整理20/19 Draft到release。已创建 [PR #3261](https://github.com/gmx-io/gmx-interface/pull/3261)，保持Draft、base release；交付head `41a6e9cba3eed60518b3fcc0a03b63983ed1f8f4`，分支 `solana-order-lifecycle-release-fesol-20`，目录 `/Volumes/kenny/gmx/gmx-interface-fesol-20-release`。本节替代下方历史“尚无20 PR”的观察，不修改Linear状态。

从实时fetch的release `83474e0e94c88c2b4a18cd436a564b97062f807f`创建，先合入56已核验的纯产品delivery `11da18dfb7`（集成commit `9771426b15`），再精确转入20生命周期、通知和恢复源码，保留最新release翻译；没有带入个人基础、参考仓库gitlink或额外stats/indexer差异。PR已明确56前置及其SDK/math/WASM依赖；不是独立可合并状态。

实际交付目录：immutable install、Lingui prepare、SDK build、app/landing types、production app/WASM build通过（所有构建使用8GiB）；完整frontend 3459 passed/1 skipped，SDK 65 files/954 passed；20变更TS的ESLint/Prettier及自身diff check通过。完整diff仅保留上游生成WASM glue的既有EOF空行warning，未改固定vendor产物。日志在目标 `.local/acceptance/draft-delivery-20261113/`。无新浏览器或钱包真实交易验收，71可信LUT/体积、112上线及新订单通知验收仍未解除。修复仍先在原development实施，再精确更新同一Draft。


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

## 2026-11-13 独立开发切片实施

角色：实现：安全恢复消费、通知分类与真实组件验证。实施、版本、行为证据与剩余边界见[统一记录](../solana-trading-dependencies.md#独立开发切片实施结果2026-11-13)。未进行真实钱包签名/广播，既有外部验收条件未解除。

## gmx-prompts review 与修复（2026-11-13）

角色：实现与审查。按 gmx-prompts 对 Draft #3261 lifecycle/sender/真实通知组件及 release merge result 完成审查，包含四遍定向检查和异步终态。修复阻断 general CI 的 sender spec import/order（development `8a7ac5a454` → delivery `6087908e19`），均已推送并由 19 消费；delivery 零 warning lint 与 6 files/36 tests passed。未核实到其他需独立修改的重要问题。旧组件 CI 的用例通过、报告发布/评论 403 保留；新 head 的 CI 不冒充旧结果。真实订单执行/取消/toast 验收仍待 71/钱包/keeper 条件；保持 Draft。方法、逐项验收和人工检查重点见[统一记录](../solana-trading-dependencies.md#gmx-prompts-review-与修复2026-11-13)。


## 2026-11-14 独立推进收尾

最终CI、19交付组合的原生Chrome未连接钱包回归与56固定WASM原子体积归因已完成，详见[三项收尾](../solana-trading-dependencies.md#独立推进三项收尾2026-11-14)。四PR关键代码检查通过；组件报告403，56另有1 flaky重试通过。未确认需新增业务修复的问题，HEAD未变。原子组合仍1255/1232 bytes，假设单表1221不代表真实LUT可用。71/112及真实钱包验收未解除；72版本已由用户确认。既有Draft正文已更新，未转正式review。
