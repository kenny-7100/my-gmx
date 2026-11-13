# Solana 交易链路依赖审计

## 当前推进决定（2026-11-13）

用户在独立开发切片完成后明确：**FESOL-19剩余问题暂缓，之后再处理**。当前不再自动推进最大杠杆一致性、兑换、WASM数值对照、GT Rewards及完整下单验收；保留缺口与外部条件，不计作已完成或需求豁免。恢复清单和原开发现场见[FESOL-19当前决定](issues/FESOL-19.md#当前决定剩余问题暂缓2026-11-13)。此决定优先于下方早期“优先继续19”的建议，不扩展成其他需求的暂停，也未修改Linear。

## 独立开发切片实施结果（2026-11-13）

用户明确创建目标并授权实施四个切片。沿用原56/19/20/72现场，没有修改57作者实现、Linear、线上配置或发送协作消息，也未做钱包签名/广播。下方“等待外部条件期间可继续推进”是实施前判断，本节为后续结果。

- **19输入链路**：真实共享selectors→mapper→WASM参数单位核对覆盖全部visualMultiplier=1000的配置市场、多空、market/limit、2/5/100/101倍，支付额固定10、价格展示倍数往返和30→20decimals转换一致。测试专用固定价格/市场元数据没有进入生产。100倍名义上限并不保证费用后可用：样例100倍为min collateral for leverage，101倍为insufficient collateral usd，2/5倍可用，未绕过费用buffer。真实TP/SL组件复现并修复手输100%后切换美元改变触发价的问题：按目标触发价估算抵押品价值换算，四种多空TP/SL组合均保留原价格。没有直接修改57。`MarketGraph.simulate_order`仍需完整原始市场账户/supply/价格/仓位同输入快照；本轮未建立其数值parity，不用selectors测试冒充WASM数学对照或112上线证据。
- **56→20→19安全恢复**：广播前持久化network/owner作用域的原签名、订单地址、操作及market执行跟踪意图；存储读回失败不广播。未知/processed/无历史/RPC失败保留检查点，阻止再次签名；confirmed/finalized后确认失败或prepare成功要求用户另行重试，原订单成功则返回原签名并刷新账户。跨异步钱包/网络/unmount检查保留原检查点。19共享按钮提供查询状态入口，可在新输入/数学数据暂不可用时检查原交易，恢复跟踪使用原订单类型而非当前表单模式。不是跨标签页原子锁，不因blockhash到期或空历史清除未明交易；没有新增取消订单产品UI或自动重发金融动作。
- **20真实通知组件**：prepare确认后拒签被归为失败，保留已有交易链接；发送中/广播未知不会提前显示成交阶段，未知状态不显示持续loading。只在确认提交后进入执行跟踪，真实事件才判成交/取消；现有关闭/会话切换保护保留。已在现有hook harness中渲染真实组件核对文案、阶段和Solana explorer链接，未以mock组件代替实际展示。
- **56 atomic归因**：只读获取现有两表快照slot468884236，重现有限价BTC/USDC三单1255 bytes。完全相同的准备指令已去重，剩一条prepare_user、一条prepare_position、四条不同ATA和三条131byte create_order_v2；wire=65 signatures+4 header/version+417 static keys+32 blockhash+662 instructions+75 lookup=1255。改表顺序仍1255；只用第一张1252，第二张1376，都不满足1232。**将相同地址内容合为一张表的离线诊断为1221 bytes**，节省一条34byte lookup descriptor，全部订单和价格边界保留。此合并表未部署/审批，生产配置和信任门禁未修改；71可考虑一次提供受信且合并覆盖的表来同时解决信任和该示例大小问题。两个独立副本或仅冻结原两表仍不足，其他输入需逐项测量。公开技术说明同步transactions README。

产品提交：56 recovery `72167ff0b6`、意图/atomic说明`dfd20a5083`；20语义接入`46326e5c44`、通知修复`9f8c74d2f0`、意图`307cbeb595`；19共享TP/SL修复`e8914b0941`、消费20 recovery/通知`769043f`/`c942c11`、意图`10540d1d5c`、共享按钮及catalog`9c59791f45`。72 development精确消费56两提交为`a2445492b0`/`e6044ced38`；72 delivery/#3259仍为`0f36780317`，没有夹带56业务。

日志、临时核验源码和只读原始快照保存在各实际目录`.local/acceptance/independent-20261113/`。scratch文件已移出src，不提交测试专用行情或临时诊断代码。最终版本：19 `c708d8a634`、20 `c9c895cdce`（最后仅按lint整理import，无行为变化）；56 dev `dfd20a5083`，56 delivery `11da18dfb7`，72 dev `e6044ced38`。四条development均已推送my-gmx；56实际delivery已推送my-gmx-pr，同一Draft #3258已更新恢复行为、atomic结果与真实验证。发布后核对head为`11da18dfb7`、OPEN/Draft；本轮未等待或宣称新head远端CI全部通过。

验证：56 dev及实际delivery各完整frontend **3437 passed/1既有skip**；19 **3469 passed/1 skip**，20 **3458 passed/1 skip**，72 dev **3437 passed/1 skip**。19/20/72及56 delivery应用与landing类型检查通过；19最终定向5 suites/40 tests、20最终定向3 suites/21 tests、56真实WASM恢复2 suites/15 tests通过；输入链scratch有非空市场断言并覆盖80组合，另做真实TP/SL组件17项检查。变更ESLint无error（19测试fixture一条react-perf warning），56 Prettier和各目标diff check通过。56默认堆production build在chunk rendering报JavaScript heap out of memory，未当作代码失败；用户明确后续构建统一8 GiB，已沉淀根规则/编码入口/排障说明并推送`15dd1d720b`，原失败日志保留。56实际delivery与19整合目标的8 GiB production app/WASM build均通过（分别55.33s、52.03s）；大型构建串行执行。72独立PR/head已再次核对仍为`0f36780317`/Draft。开发/交付工作区均clean。


## FESOL-52 最新依赖接入（2026-11-13）

用户随后明确优先处理52，范围含56、19、20、72；本节取代下方“外部暂不处理52”的旧阶段决定。实时确认 #3193 head 为 `258e4da6abafc75c683983993544f4eb9c1a8abc`，release仍为 `e4714280749c00a90468abdde3060aae619717e7`。只消费已发布成果，未修改52或57作者的分支、PR或Linear。

52从旧 `732b4a1322` 新增共享SDK Provider迁移，删除gmsol专用singleton和本地host override。56原development先接入，账户hook冲突按语义解决：读取使用 `useGmxSdk(SOLANA_NETWORK_ID)` 与统一host缓存key；交易开始时捕获该SDK，确认后显式传给账户刷新。保留required/accepted slot分离、最高确认下限、普通轮询minContextSlot、在途旧响应复核和freshness envelope，未退回上游较早的单纯accepted slot实现。

20精确消费56同一补丁，sender冲突保留自身identity/onSubmitted/trackingRequests等扩展；执行通知捕获共享SDK和提交owner，通过lazy import调用刷新前再次检查当前会话有效性。19精确消费20的相同实现，继续保留20为当前19的代码交付前置。72 development消费56补丁用于组合验收，72 delivery/#3259保持原 `0f36780317`，不反向夹带52/56业务链。

账户回归改为真实共享Provider和真实SWR/hooks，仅模拟SDK网络方法；继续覆盖失败保留最高slot、较旧轮询拒绝与追上恢复、立即展示确认数组、后续旧快照拒绝和失败保留数据。20新增真实Provider实例传递至执行刷新回归。没有新增SDK singleton或替代host。

版本：56 dev `ea591a5533`、56 delivery `e7ac104ba5`；20 `afb96056c3`（52消费 `6632b31d7b`、测试 `4cf75c9572`、通知适配 `afb96056c3`）；19 `6da9f94679`（精确消费前三项）；72 dev `7dd74997e5`。56的实现来自52上游 `258e4da6ab`，本地语义集成提交 `9557351152`、测试提交 `ea591a5533`；其余分支均cherry-pick该实现，不独立重写。

验证：56 dev及实际delivery各自完整frontend **3436 passed/1既有skip**、app/landing types、production app/WASM build通过；20完整frontend **3456 passed/1既有skip**及types通过；19完整frontend **3466 passed/1既有skip**、types和production app/WASM build通过。19/20账户/provider/通知/tracking定向各9 suites/36 tests通过。72真实WASM/transaction/account/provider组合4 suites/19 tests、types通过；初次SDK verify因缺少 `.agent-build.json` 收据blocked，已在该目录实际重建prebuild/types/CJS/ESM并通过1200产物核验，tracked文件未变。19/20既有SDK来源收据也按当前源码核验1200文件通过；SDK源码/依赖未改，952单元测试沿用既有结果，不称本轮重跑。所有6目录（含72独立delivery）vendor全部8文件hash匹配，未重跑Rust。变更手写文件Prettier、ESLint及diff whitespace通过。四条development均已推送my-gmx，56 delivery推送my-gmx-pr，registry重新绑定实际完整SHA并更新后续入口。各实际目标日志位于 `.local/acceptance/fesol52-20261113/`。56同一Draft #3258已更新共享Provider来源与真实delivery验证，远端head `e7ac104ba5`、OPEN/Draft；新head的Audit/WASM reproduction/component/general/standalone checks已启动，观察时均IN_PROGRESS，未冒充远端CI已完成。外部review/release合并、71可信LUT、112线上数学字段及真实钱包落链的既有边界不由本次迁移解除。

## 等待外部条件期间可继续推进的切片（2026-11-13）

角色：限定56/19/20/72的就绪分析，未实施业务。沿用本轮四条实时Linear正文/关系/评论，重新核对实际开发源码、52整合后PR和release；release仍 `e471428074`。用户决定atomic、兑换和Rewards等需求内问题暂不追加问Divhead，留在开发/review内处理，不代表需求豁免。

首选19共享输入到交易参数的行为核验：当前mapper spec仅2个聚合case，覆盖传入已计算amounts的映射/拒绝，没有独立证明完整UI输入计算链。可离线核对k-token visualMultiplier来回转换、TP/SL百分比与美元输入及抵押品目标价分母、杠杆改变保留支付额、最大杠杆与费用buffer，复用真实selectors/math/mapper、独立参考输入；发现差异只修前端消费，不直接改Rainer的57实现。WASM实际导出 `MarketGraph.simulate_order`，可先检查固定市场/仓位/价格输入是否足够，再做可复现同输入对照；本次只查导出，未证明完整离线对照现成可跑，不以伪造生产字段绕过112。

19/20的第二切片为失败恢复和真实组件组合：sender已保留confirmed/pending signatures及trackingRequests，adapter只转发成功/失败通知，尚未证明满足19正文部分成功后的retry/cancel体验。先覆盖prepare已确认后钱包拒绝、发送超时状态未知、receipt/API延迟、跟踪超时及会话切换的组合；未知状态先reconcile，禁止直接重发整个金融动作。20 notification hook有现有测试，但未发现专属SolanaOrderStatusNotification组件story/spec；可验证真实文案/链接/取消原因/关闭行为，不重复堆parser单测，不把离线组件验收当新订单keeper验收。

56可用固定WASM、真实已留存LUT快照/ABI做atomic静态大小归因；现有recompile已经去重ATA/prepare_user/prepare_position并合并Compute Budget，不能假设再去重即可解决1255 bytes。评估安全的布局/编码改进，保留价格边界、原子性与1232上限；是否能修复尚未确认。支付币兑换可先核对现有swap ABI与共享路由契约，但未确认路由输入来源前不列为可完整独立实施；GT Rewards仍缺契约，不猜测新增字段。

72构建切片已完成，无需重复Rust/CI重建或换版本；等待版本确认与主网复验，沿用现有出处/hash/loader证据，仅在发生实际变化时更新。19/20交付边界和review材料可以整理，未授权本轮创建新PR。

新CI事实：56 head `e7ac104ba5`的Audit、WASM reproduction、两轮general和standalone均成功；Component workflow `43399669597`失败日志明确用例All tests passed，失败是Pages发布403及报告评论Resource not accessible by integration。72 head未变，同样保留历史报告发布权限失败。没有为绿色状态扩大token权限或改共享workflow。两个PR均OPEN/Draft、reviews为空。

## 五条内部同步结果（2026-11-13，用户限定不处理外部依赖）

本节优先于下方16:16审计中的旧版本矩阵和建议。用户授权将五条内部需要跟进的依赖同步好；未扩展到52、51、71、112等外部需求，未修改57作者分支/PR、上游release或线上状态。

- **72→56已补齐。** 在56原development精确消费72正式交付 `0f36780317` 的18文件产品补丁，提交 `a86cfdd54a`；package脚本列表的冲突保留本地工具和新增source-build命令。版本来源/历史模拟说明更新为 `bfda3ff947`。精确转入原delivery为 `3db0a203e0`、`0091a24556`；交付package冲突只保留产品命令，未夹带个人工具。已有Draft #3258已更新并核对head `0091a24556b42e49502e3d616d2838fec7d159b7`；#3259仍独立，不把56带回72正式PR。新head的GitHub检查已启动，尚未终态；旧head检查不代替它。
- **57→56/20/19无遗漏。** 上游最新数学提交和20/19的两个cherry-pick，stable patch-id同为 `3a0d9c557d70a00b8011a20f4274b4f105da4362`。三分支SDK源码、WASM配置和transaction ABI一致；没有修改Rainer实现。SDK952项历史通过按未变源码/依赖复用，不称本轮重跑。
- **56→20/19已核对。** 两个下游均保留订单意图快照、freshness envelope、确认slot floor和20 sender的identity/onSubmitted/trackingRequests/失败分类；两者共享transactions、orderTracking、notifications、账户hook、SDK/vendor的tree diff为空。未用56基础sender覆盖20扩展。
- **19/20的现有代码依赖已明确保留。** 本轮没有把已实现两阶段反馈拆回提交阶段；20是当前19的代码交付前置，market trackExecution=true，limit/TP-SL创建false。共用README由20提交 `e2b6b354aa`，精确转到19为 `c6b20fd8d4`；仅文档变更，运行行为未改。若以后要求19脱离20单独交付，再独立处理该拆分，不能声称本次已解除依赖。
- **统一产物。** 56 development/delivery、19、20与72 delivery均使用 `0.11.0-beta.1`、source `7fe4008292ffc09061f3a733ad9b5cd2e6235fa8`；WASM SHA-256 `e82184caacc60828f024743f88a0a92d97b9d3d55db6839e0d3fab8a9b46c840`，各目标全部8文件实际hash匹配。未重新运行Rust可复现构建，复用完全相同产物及72原GMX CI证据。

验证：56 development和实际delivery各自完整frontend **3435 passed/1既有skip**，app/landing types、SDK重建、production app/WASM build、变更手写文件Prettier、app ESLint、Node脚本语法通过；development真实WASM/账户/钱包定向21项通过。19组合9 suites/41 tests、20组合8 suites/39 tests通过，分别核验SDK产物来源收据1200文件通过；两者运行源码未改，既有全量结果按原记录复用。delivery服务产物WASM hash相符，主app JS不含WASM binding/start。首次将Node构建脚本按浏览器ESLint环境检查报process未定义，改用Node环境后无error（2个既有console warning）；没有为此改72源码或共享lint配置。generated vendor字节不格式化。

日志与版本矩阵存各实际目录 `.local/acceptance/internal-dependencies-20261113/`；56 development原构建收据在其SDK产物目录，delivery使用原生build-sdk。业务开发分支已推送my-gmx，56 delivery推送my-gmx-pr，task registry已重绑并更新接续信息。当前五条内部没有已确认遗漏的版本同步项；不等于产品范围完成、外部条件解除或真实钱包验收通过。本轮没有浏览器/钱包签名、广播、新主网模拟或外部评论。

核验：2026-11-13 16:16（Asia/Shanghai）。角色：只读依赖分析。范围为 FESOL-56/57/19/20/72 及直接影响它们的 PR、API rollout 和验收条件；不是全量迁移进度评估。五条实时 Linear/评论与 CI 沿用本轮 16:08 已核实结果，19 assignee 已于 16:12 改为 kenny；本次新增核对远端 release、十个 PR head/base/mergeability、112/113 实时正文及实际分支代码。未改业务、合并分支、创建/更新 PR、发评论或执行交易。

## 结论与依赖方向

release 仍为 `e4714280749c00a90468abdde3060aae619717e7`。五项已经有组合开发，但组合成功不等于其前置已进入 release。

- 57 是共享 TypeScript 金融数学，72 是链上交易 WASM；两种 SDK 不互相替代。57 评审/发布后由 112 更新 API SDK pin 并启用市场字段，19 才能使用线上 gmsol 预览/校验；19 的 buildTradeboxOrderAction 对 `tradeMath !== "gmsol"` 明确拒绝，映射提示为 Solana market calculations are unavailable。16:08 实测 67 市场均无该字段。112 实时 Todo、Divhead，无评论；gmx-api 按编号未发现专属 PR，不等于没有任何相关改动。
- 56 提供交易 builder、签名前检查、发送确认；92 提供 units，51/89/96 提供余额与 RPC，52/113 提供统一账户/市场/折扣数据及字段契约。19 是共享下单消费者；20 是订单结果跟踪消费者，签名确认不能当作成交。
- 72 的构建替换代码可以独立交付（#3259 仅 18 文件），其“新版真实落链复验”仍依赖 56 和 71。不能把 Linear 的 56 blocks 72 解释为 72 代码不能先合，也不能把 72 构建成功解释为 56 已完成钱包验收。原文要求完整验收后才算完成；若要提前合并构建切片，需要任务负责人/评审明确接受验收安排。
- 71 可信 LUT 阻碍生产签名落链；有限价格边界 increase+TP+SL 的 1255 bytes 超 1232 是独立限制，复制/冻结相同 LUT 内容不能自动解决。19 支付币兑换抵押品与 GT Rewards 是产品/适配范围缺口，不由合并前置自动补齐。

## 当前开发集成矩阵

| 依赖 | 当前上游 | 实际集成与判断 |
| --- | --- | --- |
| 92 / #3243 | OPEN，`5e081e5ab1`，REVIEW_REQUIRED | 56/20/19 包含；仍未进 release |
| 57 / #3242 | OPEN，`f16deff8a7`，REVIEW_REQUIRED | 56 merge；20/19 cherry-pick 最新数学；仍待 Rainer/评审完成材料与发布 |
| 51/89/96 / #3195 | OPEN，`2495be234e`，CHANGES_REQUESTED | 三分支均包含最新 head，但 review 未解决；不能凭已集成当作可合并 |
| 52 / #3193 | OPEN，`258e4da6ab`，CONFLICTING | 三分支仍集成 `732b4a1322`，缺共享 SDK provider 迁移；需要补同步 |
| 113 fee/order / #3205、#3207 | OPEN，`087a98fa37` / `c711f6ebe7`，均 CONFLICTING | 三分支包含最新 head；#3205 base=FESOL-52，#3207 base=fesol-113-fee-discount-fields（Draft），属于堆叠链，不能当独立 release PR 任意合并 |
| 15 / #3201 | OPEN，`056f8d689c`，CHANGES_REQUESTED、CONFLICTING | 19 已有相关功能修复的等价 cherry-pick，`git cherry` 标记对应修复为 `-`；不因 head 非祖先而重复集成。PR 整体仍有上游/交付冲突，需负责人处理 |
| 25 / #3238 | OPEN，`07117e1691`，REVIEW_REQUIRED、CONFLICTING | 19 的 `096c0cd353` 与当前功能提交在 src/sdk 的 stable patch-id 均为 `6ed6b787c7696da51a21cc46f16a5b5399ec9a18`，所查五个功能源文件树一致；不是该功能提交漏同步。整个 PR 携带的依赖不因此判为相同 |
| 72 / #3259 | OPEN/Draft，`0f36780317` | 19/20 已精确接入业务产物；56 原 PR 仍旧 pin；72 dev 已组合 56 测过新版，但不替代 56 目标版本自身验收 |

当前 19=`0d7b4b49a7`、20=`d677e174c1`；两者 transactions、solanaOrderTracking、useGmsolAccountData、sdk 和 vendor/gmsol-sdk 的 tree diff 为空。它们的 SHA 因 cherry-pick 不同，但这些关键源码相同。56 与 20 的 sender 等文件差异包含20新增的身份、即时提交回调和 tracking 契约，不能用整文件覆盖来“同步”。

## 已定位的集成风险

1. **52 更新与 56 安全修复重叠。** `732b4a1322..258e4da6ab` 只有一笔 use shared SDK provider for Solana，12 文件、120 additions/93 deletions，改 useGmxSdk(SOLANA_NETWORK_ID)、host cache key 与账户 hook，删除旧 gmsolApiSdk/getGmsolApiUrl。`git merge-tree --write-tree --name-only` 对 56 development 与该 head 的预检只报 useGmsolAccountData.ts 内容冲突。合并应保留新共享 provider、host/owner/request 隔离、required/accepted slot floor、freshness envelope、确认刷新失败后拒绝旧轮询和恢复行为；再转入20、19，保留其 sender 扩展。merge-tree 只创建对象，不更新任何分支/checkout，不能称为实际合并或测试通过。
2. **19→20 的代码依赖超出产品顺序。** 19 adapter 直接 import/use useSolanaOrderNotifications，`begin({ trackExecution: isMarket })` 会为 market 启动20成交跟踪。19正文明确先交付提交阶段、20后续增加成交阶段。因此当前19无法按“仅19改动”独立交付。建议保持19提交阶段可独立交付，把即时提交回调/订单身份作为最小共享契约；20提供成交tracking。若决定保留当前耦合，则明确20成为19的代码合并前置，review/PR正文说明，仍不把“提交成功”当“成交”。本轮仅提出交付建议，没有擅自修改行为或范围。
3. **56 Draft 混有前置。** #3258 正文明确包含92/57/51/52/113六个未合并PR；允许整体review，不代表可绕过其独立review直接合。对应前置落release后，按实际文件差异精确收敛同一PR，不整支需求合个人基础，不重写他人历史。当前 #3193/#3205/#3207 和 UI #3201/#3238 GitHub 均报冲突，不能只安排日期而不处理基线。
4. **92和57的真实交叉冲突。** 对两当前head的 merge-tree 预检在 sdk/src/utils/gmsol/index.ts 出现 add/add；需同时保留units与math exports，不能任取一边。现有56组合已解决，但两个原PR合release时仍需由合并负责人处理。
5. **72与56无文本冲突不等于组合通过。** 对当前两个delivery head的 merge-tree 预检成功生成树，无冲突路径。可规划统一新版WASM作为最终验收基线；56 development先消费72已发布成果、验证，再按72是否已落release精确更新56 delivery。不要把72开发分支携带的56全部前置整支合回56，也不以无文本冲突代替build/ABI/wallet验收。

## 跟进次序与责任

1. 我们的前端整合优先处理52最新provider迁移，唯一实现落56原development，再精确更新其delivery和20/19；对实际变化运行账户刷新/SWR、sender/notification组合及类型检查。不要在三个分支独立解同一冲突。
2. 与Rainer/SDK评审协调57参考generator/JSON版本化、review和SDK发布；与92负责人协调index导出冲突。我们无直接修改57实现/分支/PR的权限，本轮未发送外部消息。
3. 与Divhead协调71可信LUT（地址、authority/归属、内容覆盖证据）和112的发布pin、market fields、金融reference/minContextSlot验收。两项可以并行跟进，不能只等71而忽略112。113的stacked PR按52→3205→3207由负责人同步基线/解除冲突。3195需负责人处理CHANGES_REQUESTED，当前评论仍含empty System-owned ATA、RpcDebug与历史清理事项；完整解决状态需原作者/reviewer确认，不由我们改其分支。
4. 我们确定19/20提交阶段与成交阶段的交付边界，避免下游反向阻塞入口。15/25相关功能已有等价接入，主要跟进其review/冲突与release落地，无需重复搬功能提交。
5. 代码合并顺序以92/57与数据基础前置优先、52→113堆叠随后、56适配器、19入口、20成交增强为建议拓扑；15/25在19前收敛。72构建PR可以并行review，具体落release时机须按其未完成验收明确协调，不机械排到所有UI之后。
6. 获得可信LUT、API数学可用并统一新版WASM后，在最终19整合目标做一轮贯穿验收：预览/余额→签名前校验→提交确认→20按真实事件判结果→slot-aware账户刷新；覆盖limit/edit/cancel、atomic及四钱包，明确记录每项由哪个版本证明。只在实际依赖变化时重验受影响项，不重复已稳定的SDK重建/历史测试。

## 证据入口

[56 PR](https://github.com/gmx-io/gmx-interface/pull/3258)、[57 PR](https://github.com/gmx-io/gmx-interface/pull/3242)、[72 PR](https://github.com/gmx-io/gmx-interface/pull/3259)；[52 PR](https://github.com/gmx-io/gmx-interface/pull/3193)、[51 PR](https://github.com/gmx-io/gmx-interface/pull/3195)、[92 PR](https://github.com/gmx-io/gmx-interface/pull/3243)、[fee fields](https://github.com/gmx-io/gmx-interface/pull/3205)、[order fields](https://github.com/gmx-io/gmx-interface/pull/3207)、[15 PR](https://github.com/gmx-io/gmx-interface/pull/3201)、[25 PR](https://github.com/gmx-io/gmx-interface/pull/3238)。历史验证范围见各[issue记录](issues/README.md)，本审计不重跑业务测试、不重新证明部署或签名落链。
