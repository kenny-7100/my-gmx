# FESOL-109 — Solana 交易范围与时间节点

## 三表刷新（2026-11-27 14:22，北京时间）

按用户授权更新 [Frontend Task Organization](https://linear.app/gmx-io/document/frontend-task-organization-8b65bab92d15)，保留英文正文，在聊天用中文列出结果。实时读取原22项及TRD-210正文、关系、附件和全部评论，新增读取TRD-222及评论；各评论无下一页，文档评论为空。核对Trading cycles、12条主表PR、Net Rate #3362、API #341、旧前端#1108，两前端完整open列表及110/213/151/158/222全状态编号搜索。只做协调状态核验，未审代码diff或独立运行产品测试。

- #3337现`8b7dbfc26c`，#3335现`664fa1ac5c`；两者OPEN/Ready/MERGEABLE/REVIEW_REQUIRED，各返回六项SUCCESS。撤掉旧冲突及3337仅Pages检查结论；报告的手测不扩大为本轮验收。#3318仍`c71a99a0ad`、Draft/CONFLICTING，八项成功、两项跳过，部署声明仍1932baa9/源码1a16e19552，未重验部署。
- TRD-91仍Rainer/In Progress/Cycle1，新增公开前端[#3362](https://github.com/gmx-io/gmx-interface/pull/3362)，`d278ca5d51`、OPEN/Ready/MERGEABLE/REVIEW_REQUIRED，六项checks成功。正文报告本地浏览器验证，branch preview待验证；不冒充独立复验。11月26日rates166小时点保留明确历史日期，本轮未请求接口，不能当当前覆盖。
- TRD-110现Sulliven/In Progress/Cycle1，撤掉Todo/无cycle；未找到专属公开实现PR，不证明没有本地工作。
- TRD-158限定永续订单与保证金；其他动作已移TRD-222/Kenny/Todo/Cycle2，追加同一后续表，保留GLV 0.01/0.03专项及产品链路边界。范围依据沿两单既有记录。
- TRD-157现Kenny/Refining/无cycle，正文Owner Orion仍单列。旧前端[#1108](https://github.com/gmsol-labs/gmx-solana-interface/pull/1108)于11月26日20:52合main，head `9df133bdc0`；评论报告vscode检查主网682/Devnet21账户均无独立receiver，request_gt_exchange_v2未发布、日期未定，真实V2账户验证仍待。此为评论证据，不宣称本轮重扫账户、验收或部署。

保存回读确认三表15+7+1项、10灰5绿、原排序/历史cycle/136例外保留，旧head已撤掉。主表9行实际合并，其他状态/负责人未变。原始GitHub响应在忽略目录`.local/table-refresh-20261127/`；未改issue/PR属性、评论或部署，未签名广播。前置master PR是否已进入release本轮未独立核验，旧状态注明沿用。

## 三表完整刷新（2026-11-26 14:11，北京时间）

按用户授权更新 [Frontend Task Organization](https://linear.app/gmx-io/document/frontend-task-organization-8b65bab92d15)。实时读取全部22项（15+6+1）正文/负责人/cycle/关系/附件及全部评论，文档评论为空、各评论无下一页；查询Trading cycles、12条当前主表PR、API #341、8条已替换PR和5条master前置PR，检索提前讨论/GMTrade专属PR并查看两仓库全部open列表。未查代码diff或执行产品测试；不把PR作者的测试声明当本轮独立验收。

- TRD-85/#3223于北京时间11月26日02:30合入release，APPROVED，head `e10845c5a4`六项checks成功。主表现9行实际合并，加136灰色例外，共10灰/5绿；撤掉85未合并描述。
- TRD-70/83/84实时cycleId均为Cycle1，修正表中旧Cycle2；全部15项现在Cycle1。状态未变，不将当前归属误写为改动issue或重新制定排期。
- #3337现`c9ff8f55fc`，OPEN/Ready/CONFLICTING/REVIEW_REQUIRED，仅两项Pages checks成功；旧head六项通过不得复用于当前head。#3335现`4359c0682f`，OPEN/Ready/CONFLICTING/REVIEW_REQUIRED，六项checks成功，仍独立交付。#3318现`c71a99a0ad`，Draft/CONFLICTING/REVIEW_REQUIRED，八项checks成功、两项重复job跳过；一次UNKNOWN后再次查询确认冲突。
- TRD-110已分配Sulliven，Todo、无cycle；补当前Swap例外。TRD-213的Send仍按正文等待72签名能力进入release，Receive可独立；TRD-210为Sulliven/Backlog，仍独立。
- SOL/USDC正式30d rates GET为200，166小时点、UTC 11/19 09:00–11/26 06:00，跨度165小时、样本内部无缺口，仍不足完整7/30天。未扩大为全市场覆盖；API #341仍merged/main。
- TRD-157仍未实际分配/In Progress/Cycle1，正文Owner Orion；未找到专属前端PR。SCSOL-29 Done、ECO-32 In Review，关联不自动变硬阻塞或部署完成。

保存后回读核对22项、三表、10灰5绿、全部主表Cycle1及新head，旧head/旧cycle/旧计数描述已撤掉。保留原排序、历史周期列、产品验收边界与136例外。#3318所述固定部署仍1932baa9/源码1a16e19552，本轮未重验部署；master前置已合master不等于核实进入release。原始GitHub/生产rates响应保存在忽略目录`.local/table-refresh-20261126/`。本轮未改issue/PR属性、发评论、部署或签名广播。

## 协调文档新增 GMTrade 表（2026-11-26）

按用户授权，在 [Frontend Task Organization](https://linear.app/gmx-io/document/frontend-task-organization-8b65bab92d15) 末尾新增第三表“GMTrade requirements”，先收录 [TRD-157](https://linear.app/gmx-io/issue/TRD-157)（原 ECO-41）的 Buyback 独立 rent receiver 需求。实时核对为 Trading / In Progress / 未分配，正文 Owner Orion；表内区分实际 assignee 与正文 Owner，写明归属、金额/账户数排除、阻止旧 completion 及保留同 owner Claim Rent 的范围。保存回读确认原主表15项、提前讨论表6项完整保留，新表1项；未刷新原两表状态或改 issue/PR 属性。历史代码调查沿用 [ECO-41 记录](ECO-41.md)。

## 两表 Done 与合并状态专项核对（2026-11-25 22:53，北京时间）

角色：只读协调审计。实时回读 Frontend Task Organization（现为主表15项、提前讨论表6项），查询全部21项当前Linear状态，并逐一核对10项Done需求的当前交付PR。结果为8项已合入release，另2项Done但未合并：TRD-85/Rainer的[#3223](https://github.com/gmx-io/gmx-interface/pull/3223)仍OPEN/非Draft/REVIEW_REQUIRED，head `db43a01119`；TRD-136/Kenny的[#3318](https://github.com/gmx-io/gmx-interface/pull/3318)仍OPEN/Draft/REVIEW_REQUIRED，head `c71a99a0ad`。两者mergedAt均为空；本次mergeable返回UNKNOWN，不沿用旧冲突结论。

重读85/136正文、关系及全部评论：85于11月23日21:44标Done，同一分钟Reflectiv评论“Verified on feature branch - looks good”；该证据限于功能分支验证，不能代替合并。136于11月18日14:17标Done，无评论，属于已有持续playground灰色例外。文档已经分别注明85绿色未合并及136灰色例外，不能把9灰理解为9项已合并。第二表没有Done项；另发现TRD-110现已分配Sulliven、仍Todo，线上表仍写Unassigned。本次未改线上文档、issue、PR或执行产品验收。

## 两张协调表完整刷新（2026-11-25 14:24，北京时间）

按用户授权刷新[Frontend Task Organization](https://linear.app/gmx-io/document/frontend-task-organization-8b65bab92d15)两张表并在聊天完整列中文。已读全部20项Linear正文、关系、附件、全部评论（均无下一页）、文档空评论、Trading cycles和12条当前PR的metadata/checks/reviews/正文；另核对新转账子项TRD-213。线上保存后回读确认原15行+提前讨论5行完整，负责人排序/历史周期/9灰6绿保留。未改issue/PR状态、未测试/部署/签名广播。

- TRD-65/80/63由In Test变Done，Reflectiv已报告feature branch verified；TRD-78/70由In Progress变In Review。原负责人和周期不变。
- #3223 `db43a01119`、#3337 `be9ca46ecb`均OPEN/Ready、MERGEABLE、待approval，各返回6项SUCCESS（Audit、component、general、SDK、两Pages）。撤掉旧冲突和仅Pages检查的结论；不等同完整验收。
- #3335 `371253f08d`仍CONFLICTING/待approval，仅两Pages成功；#3318 `c71a99a0ad`仍Draft/CONFLICTING，general/component/SDK/WASM/Audit/Pages有成功，另两重复job为SKIPPED，不记通过。固定playground部署仍1932baa9/源码1a16e19552，不能当最新PR已部署。
- 主表8条PR仍merged/approved，无新主表PR合并。#3337保留master前置的release协调、四条需求独立验收；70暂缓范围、78生命周期要求仍在。
- 第二表91/92/158为Cycle1，110/151无cycle。新TRD-213是92子项，Cycle1/In Progress/Sulliven；Send按正文等待72签名能力进入release，Receive独立推进。父项未移除收发AC，不称范围已从92删除。客服GMX正式volume/Tier前置仍未闭合。

原始GitHub快照在忽略目录`.local/table-refresh-20261125/`。本轮沿用此前同阶段rates142点/约6天观察，没有再次请求接口、重验SDK构造或生产部署。

## 提前讨论需求表追加（2026-11-25 14:08，北京时间）

按用户明确授权，在[Frontend Task Organization](https://linear.app/gmx-io/document/frontend-task-organization-8b65bab92d15)末尾追加独立英文表格“Requirements available for early discussion”，包含TRD-91/92/110/151的链接、负责人、当前状态及简介/讨论重点，声明当前cycle收尾期间可提前讨论。使用本轮已核验状态；保留客服GMX自有总量/30d数据及Tier依赖，注明embedded另归TRD-210。通过Linear skill/MCP执行append并回读确认四行完整、原15行表仍保留；没有刷新原表或修改issue/PR状态。

## Frontend Task Organization 只读核对（2026-11-24 14:12 北京时间）

后续用户明确授权更新；于14:21更新同一线上文档并回读确认15行、9灰/6绿、负责人排序与历史周期列完整保留。更新7项Linear状态、统一#3337/独立#3335链接、当前冲突与checks范围及报告手测边界；未修改issue、PR或发布评论。

角色：协调表状态审计。用户要求核对是否需要更新；读取原线上文档（11月23日14:08版）、15项实时Linear正文/关系/附件及全部评论（均无下一页）、文档空评论、Trading周期及16条新旧PR的状态、head、review、返回checks和相关正文。未修改线上文档、issue或PR，未执行产品测试。

- 7项Linear字段需更新：75 In Review→Done；85 In Test→Done；80、63 In Review→In Test；100 In Review→Done；83 In Progress→In Review；72 In Progress→In Review。负责人及周期均不变（70/83/84为Cycle2，其余Cycle1）。
- 72/78/70/84的原#3315/#3316/#3317/#3293均CLOSED且未合并，统一由[交易整合#3337](https://github.com/gmx-io/gmx-interface/pull/3337)继续，当前OPEN/Ready、待approval、CONFLICTING，head `c957c1be02`。删除原PR仍开放及旧串联合并顺序的描述；保留各需求独立AC和原负责人。
- 83已有独立[PR #3335](https://github.com/gmx-io/gmx-interface/pull/3335)，OPEN/Ready、待approval、CONFLICTING，head `371253f08d`；正文报告preview手测通过，不能写成独立复验或完整父任务AC通过。
- 85/#3223虽Linear Done且Reflectiv于11月23日21:44评论feature branch verified，PR仍OPEN/Ready、待approval、CONFLICTING，head `019069b7ed`；返回六项checks成功，仍保留绿色。
- 136/#3318仍OPEN/Draft、CONFLICTING，head `1a16e19552`，保留Done灰色例外。当前正文记录采用#3337并部署固定版本1932baa9；同时#3337正文新增Kenny报告市价/限价含TP-SL、成交/平仓/撤单测试暂未发现问题。此为报告证据，不扩大为当前签名修正head的四钱包、改单、TP-SL触发、失败恢复及金融对照完整验收。
- #3337/#3335/#3318当前head返回仅两项Pages SUCCESS；旧head的主测试成功不能冒充当前head完整CI。#3337仍包含需协调进入release的master前置。应撤掉“所有开放PR均mergeable、checks全通过”的统一措辞，逐PR注明证据范围。
- 原8项已合并PR仍为MERGED/APPROVED；无新增合并，颜色仍9灰/6绿。70既定暂缓范围及78生命周期验收要求继续保留；本轮未重新审查代码或验收。

## Frontend Task Organization 刷新（2026-11-23 14:08 北京时间）

角色：任务协调状态核验与文档维护。用户授权刷新原15行[线上文档](https://linear.app/gmx-io/document/frontend-task-organization-8b65bab92d15)并在聊天列中文全表。逐条实时读取15项Linear正文、关系、附件及全部评论，核对Trading周期列表和14条当前PR的状态、review、mergeability与返回checks；修改同一文档并回读确认15行、负责人排序与颜色保留。未改issue/PR状态、未发评论、未执行产品验收。

- 新增合并到release：TRD-100/#3287（11月21日05:45）、TRD-98/#3195（06:05）、TRD-142/#3294（06:06）、TRD-77/#3314（06:19），均APPROVED；77的Linear已Done。连同原4项现共8项已合并；136仍按用户例外灰色，合计9灰/6绿。
- 全部负责人、周期不变；70/83/84在Cycle2，其余Cycle1。75/80/100/63仍In Review、65仍In Test，保留Linear与合并状态差异。
- TRD-84/#3293已更新至`0be618507f`，MERGEABLE、Ready、待approval、返回checks成功；不再沿用早上CONFLICTING快照。正文明确先合70/#3317，rebase前手测通过、之后未重测，不能扩大为最新版本手测通过。
- TRD-83远端分支`140cc7295829d0e2a5e4186e657393f6175c8505`仍存在；与旧84 `8818b1d46e`比较多1个实现commit，含PositionEditor、collateral builders/provider与测试。issue附件及新旧编号全状态搜索未确认独立PR；标为已开发未交付，不再仅写无PR而忽略实际分支。
- 72/#3315 `fac83d15bd` Ready，78/#3316 `aa6660fcb0`、70/#3317 `3213ee6e0c`、136/#3318 `f54ba995d5` Draft，均MERGEABLE、待approval、返回checks成功。85/#3223同为Ready/MERGEABLE、待approval、checks成功。
- 表内补充70仍暂缓支付币兑换、最大杠杆一致性、完整simulate_order数值对照和GT Rewards，原需求未豁免；78于11月23日新增全生命周期事件验收说明，需固定事件布局/fixtures、匹配program/store/order/action、排除失败及无关事件，证据不足保持未决。此处记录需求变化，不代表已完成代码差异审查或新版AC验收。

## 12 月 10 日目标范围与交付风险复核（2026-11-23 10:02 北京时间）

角色：只读范围、实际推进与交付风险调查。当前需求为[TRD-101](https://linear.app/gmx-io/issue/TRD-101)，计划负责人及整体集成/验收负责人为Divhead；Kenny为Solana前端lead。未修改业务、Linear、协作文档、PR、部署或钱包。

### 范围与历史版本

读取当前TRD-101（updatedAt 11月20日15:50 UTC）、用户提供的Divhead群聊截图，以及迁移前本地快照中FESOL-109的两个不同正文版本：11月3日版（11月4日抓取）及11月12日版（含11月10/11日的确认与Trading周期调整）。这些是实际保存的历史版本，不是Linear完整逐次修改历史；历史快照UUID与当前任务一致。

| 版本 | 阶段目标 | 对当前判断的作用 |
| --- | --- | --- |
| 旧FESOL Cycle 2，10月26日–11月9日 | 网络/钱包/余额/市场/价格与图表可见 | 基础能力阶段，不能沿用当时Todo或CI失败作为当前阻碍 |
| 旧FESOL Cycle 3，11月9日–23日 | 市价附TP/SL、仓位/订单、平仓及受控主网测试 | 后被Trading周期安排覆盖，不与新Cycle编号混用 |
| 旧FESOL Cycle 4，11月23日–12月7日 | 限价、改单撤单、保证金存取；12月10日公开开启 | 确认保证金存取不是交易后的可选能力 |
| 11月11/12日Trading重排 | Cycle 1为11月16–30日，Cycle 2为11月30日–12月14日；必需实现12月4日前、验收12月8日前，9日修复/决策 | 新周期取代旧分配；12月24日只是历史备选，未批准替代12月10日 |
| 当前TRD-101 | 11月30日开仓/执行/刷新/平仓连通并复核日期；12月4日限价/TP-SL/编辑撤销/存取保证金/不足SOL收口；12月7–9日全流程测试及阻断修复；12月10日验收后公开交易 | 当前执行依据；11月20日API验收节点已过，但107/108仍未关闭 |

12月10日是基于共享GMX界面、真实数据的公开Solana交易，不是只部署playground或实现简单市价开平仓。包含外部四钱包、切网/恢复、余额及交易后刷新、市场/Price图表/默认Depth、仓位订单、market/limit开仓加仓与TP/SL、平仓/改单撤单、抵押品存取、安全检查、金融/API消费与运行验收、桌面/移动/本地化及EVM隔离。Depth只有明确记录延期后才可移出；金融正确性与API验收不能默认为延期候选。TRD-70详细AC仍要求支付币兑换、最大杠杆一致性、simulate_order对照与GT Rewards；个人切片暂缓没有改变发布AC。

After trading排除TradFi、完整个人Trades历史/Claims/Net rate图、Swap、转账/embedded wallet、Pools/Earn/Referrals/GT-staking页面。TRD-92的切网/钱包恢复和错误场景仍被当前交易验收引用，不能因其总任务Backlog而一起后移；完整历史实施后移与DES-65“保留个人历史访问”之间仍需明确首发访问/不可用方式，不能自行推导必须立即完成整条TRD-89。support chat虽已Refining（计划仍写Triage），未明确列首发阻塞；统计页已取消；升级通知/上市日期与月度预算不阻塞。INF-4的standby/消除全部重启503不自动扩为本次硬门槛，但107规定的新鲜度及恢复验收仍需完成。

### 当前缺口与风险

| 工作 | 实际证据 | 分类、影响及下一步 |
| --- | --- | --- |
| 本地化（119→101 checklist） | 119 Duplicate，101仍未勾选；未确认全迁移受影响页面/文案清单、执行负责人或翻译验收。83分支新增Deposit collateral / Withdraw collateral等msgstr为空 | **执行安排缺口，高风险**。有提取/复用翻译工作，不是所有翻译零开工；需落实负责人、影响清单、翻译与移动端验收 |
| DES-65与最终界面验收 | Pasha/Backlog、无评论或附件；正文仍要求accepted desktop/mobile frames及VOB/history明确决定 | **设计交接证据未确认，高风险**。未全量访问Figma，不断言未画设计；先取得已接受方案与交接/验收安排，避免临近发布改共享界面 |
| TRD-70已暂缓范围 | #3317 `3213ee6e0c`正文明确payment conversion/max-leverage parity/full simulate_order/GT Rewards deferred；实际adapter拒绝payToken≠collateral与非noSwap | **已开发中的内部范围缺口，高风险**。SOL wrapping不等于支付币兑换，独立Swap页面后移不自动豁免下单兑换。延续用户暂缓，不自动恢复；需由产品/交付负责人确定何时补齐或正式变更范围，金融验收仍必需 |
| TRD-83保证金存取 | Sulliven/In Progress；新发现远端`TRD-83` `140cc7295829d0e2a5e4186e657393f6175c8505`，11月20日12:58 CST，基于84 `8818b1d46e`多1提交。实际diff包括PositionEditor、deposit/withdraw builders、provider/types/feature开关和测试 | **有实质代码、尚未交付，高风险**。无对应PR，只有两项Pages checks成功，无返回的主lint/types/test检查；当前playground仍关闭collateralDeposit/Withdrawal。作者原线需同步最新前置、验证、建PR并集成验收；不能再说未分配或完全没开始 |
| TRD-84平仓/改单撤单 | #3293 `8818b1d46e`仍OPEN/Ready/CONFLICTING、无review；checks成功；缺playground已有Receive tokenInfo接缝 | **已开发但集成受阻，高风险**。作者原线解决冲突/吸收接缝，完整partial/full close、edit/cancel、刷新与残余TP-SL取消验收；不代改他人PR |
| TRD-72/78/70主链与136联调 | #3315 Ready；#3316/3317/3318 Draft；四者MERGEABLE、当前checks成功、无review。SOL/WSOL builder已统一。77/#3314已merged，Linear在本轮更新为Done（11月23日09:50 CST） | **实质推进，送审/全链验收仍有风险**。不能称交易未开始；已有11月18–19日历史简单交易/单钱包平仓回执，但未完成最新组合的atomic TP/SL、四钱包、限价/触发、拒签/失败/未知回执/切网矩阵。136 Done不是全流程AC通过 |
| TRD-158不足SOL | Kenny/Backlog，无独立实现PR；72 sender已有真实模拟与network/keeper/wrapping余额检查，但模拟失败仍走通用Solana simulation failed | **部分实现、需求未完整收口，中高风险**。交易动作签名前及余额竞态失败后的统一明确文案、租金/多步骤费用边界须验证；GM/GLV随Pools后移，不以整条158 Backlog判全部阻塞 |
| TRD-85图表与Depth | Rainer/In Test，#3223 `c8f9c4a85d`OPEN/Ready/待review、checks成功。release DepthChart已有gmsol真实price-impact/execution-price分支 | **已实现部分，完整AC未证明，中高风险**。不是零开工；PR正文还写dev-only depth preview，晚于正文的代码已移除该preview。需按当前代码验收历史/live切市场、scaled token、overlays/markers/actions与Depth；不以陈旧正文代替实际行为 |
| TRD-107 API运行 | Divhead/In Progress；API361/362/364/365均merged，main `90df09fd2b`部署工作流成功。近期有多轮诊断及修复 | **持续实际推进，但原11月20日验收节点未收口，高风险**。365之后的生产容量/持续新鲜度/恢复、50ms普通读与3秒post-trade目标仍待证据；旧场景测得3.030/4.228/4.583s不能作新版本结论，但也不能四舍五入称达标。adrs#33当前CHANGES_REQUESTED，争议为验收记录是否应放ADR，不等于金融实现被否定 |
| TRD-108 API消费及真实交易 | Divhead/In Progress；12组原生参考四输出对照已有范围证据，公开钱包/链账户与SDK/min-slot读取已验证 | **已推进，控制交易验收未完成，高风险**。待consumer合同确认、开发者GMTrade参考钱包、真实open-with-TP/SL→edit→close每步单次minContextSlot刷新。一次历史平仓不替代该序列 |
| TRD-109测试准备 | Divhead/Todo，但冻结LUT已merged并进入当前组合 | **部分已完成、剩余条件证据不足**。指定开发者自有参考钱包/小额资金与当前flags、四钱包覆盖计划待收口；不共享seed，不再称缺LUT。最新用户配置部署未复验RPC，旧403不继续作为当前故障 |
| 上线安排 | 101明确delivery owners/monitoring/rollback必须确认；125与API330已有监控实现 | **最终发布证据未汇总，中高风险**。核实告警试触发、开关/版本/部署/监控/回滚负责人与review容量；不声称监控从零未做，不把INF-4所有增强强塞为发布前置 |

### 建议执行顺序及日期判断

今天是11月23日，距11月30日闭环检查7天、12月4日必需实现收口11天、公开目标17天。**目前不能确认12月10日已处于稳妥交付轨道，但证据也不支持宣称必然延期。** 主要风险是多项实现、范围决定与全链验收集中在同一剩余窗口；不是单看PR/Done数量。

1. 先补执行安排与范围决定：本地化、DES-65交接/移动端验收、70暂缓项的发布处置；确认83分支实际交付计划，而非重新分配一个已有owner的任务。
2. 并行收口72 review、78/70后续送审计划、84原线冲突及83原线同步；保留72→78→70→84/83的共享交易契约。107/108不是等前端结束才开始，跨侧联合验收需现在安排。
3. 11月30日以固定组合版本证明open→execute→refresh→close，记录WASM/API/前端版本、slot与回执，同时复核12月10日；保留既有历史样本，但不冒充新版本全矩阵。
4. 12月4日前收口limit/TP-SL/edit/cancel/collateral/SOL检查与约定产品范围，12月7–9日留给四钱包、移动/语言、失败恢复、EVM隔离、负载和发布决策；不要把尚无owner/尚未送审的实现全部留到测试窗口。

### 覆盖与证据边界

官方MCP枚举迁移项目78条（含归档，单页hasNextPage=false），完整补读61条非归档非Duplicate正文/关系；另读119、DES-65、INF-4、TRD-12及关键评论、线上Frontend Task Organization（11月20日版，未更新）。枚举主前端全部分支/65个开放PR及11月10日以来104个已关闭PR，API全部分支/14个开放PR及31个近期已关闭PR，ADRs及个人my-gmx分支/PR；定向阅读83相对84的真实delta、当前sender/adapter/features/Depth源码、PR说明/checks和ADRs#33。gmx-infra API返回404，无权核对其当前部署/审核现场；未全量查Figma、他人本地未推送代码或线上负载。故“无执行证据/无PR”不等于证明个人未工作，未生成无依据百分比或更新完整迁移latest指针。

本轮本地证据位于`.local/solana-progress/2026-11-23-release-audit/`，不含用户环境key；当前上游release `d1e9e1fc4c`、API main `90df09fd2b`。本轮以当前正式计划覆盖历史安排；截图的3195/3223组件失败、SDK待合并和83无owner等已被后续事实替代，不继续列为当前故障。完整Linear历史编辑序列不可由本次MCP取得，历史比较限已保存正文版本。

## 12 月 10 日发布未开工范围核查（2026-11-20 14:24 北京时间）

角色：只读交付缺口分析，不接管实施。读取 TRD-101 正文/关系/空评论及迁移项目全部 70 条 issue（Trading，非归档，单页无后续页），定向补读 83/85/92/109/119/158、DES-65 的正文/关系/全部评论及 TRD-70 正文，核对主仓库近期全状态 PR、候选正文/文件及固定源码。此次不估算完整迁移百分比、不修改 Linear、外部文档、PR、部署或钱包。

TRD-101 updatedAt 仍为 2026-11-17T18:34:00.951Z，不能把其旧负责人/PR/CI记录当当前状态。12 月 10 日范围仍包含 collateral、Depth（除非明确延期）、交易签名前不足 SOL 检查、本地化及桌面/移动端设计验收；After trading 独立排除。

- **TRD-70 已开始但内部暂缓**：当前 #3317 `a54508119b` 正文仍明确支付币兑换、最大杠杆一致性、完整 simulate_order 数值对照及 GT Rewards 不在本次集成切片；原需求仍要求相应功能/验收。延续用户此前暂缓决定，本轮只列缺口，不恢复开发；切片暂缓不等于发布范围豁免。完整金融对照属于验收，不描述成全无实现。
- **TRD-83 保证金存取**：11 月 19 日已变为 Sulliven / In Progress，正文仍留“implementation assignee needs confirmation”的旧说明。全状态按 TRD-83/FESOL-28 搜索未确认其独立实现 PR；#3293 `8818b1d46e` 明确提供 close/edit/cancel/TP-SL，未提供 collateral deposit/withdraw。应确认实际开发线与交付切片，不能再说无人负责，也不能凭没有 PR 断言本地没开工。
- **TRD-158**：Kenny / Backlog，无评论。#3315 `b280eadf75` 的 sendOrderTransactions.ts 已有签名前真实 RPC 模拟、network/keeper/wrapping 余额检查；但模拟失败仍可能抛通用日志，未证明完整覆盖规定的明确不足 SOL 文案。属部分覆盖、完整需求未独立收口；GM/GLV 等后续交易随 TRD-116 后移，不强行列为本次发布新增范围。
- **本地化**：TRD-119 已 Duplicate，责任在 TRD-101 checklist。当前计划未列独立执行负责人/全量影响清单/翻译验收证据；不能把已有翻译文件或 extraction checks 等同全迁移语言验收，也不能据此断言所有翻译从未开始。
- **DES-65**：Pasha / Backlog、无评论；正文要求 accepted desktop/mobile frames、VOB/history 决策与网络/失败恢复交接。未确认该需求完整交接，建议核对实际设计成果；未全量调查 Figma，不断言设计从零未做。

纠正容易误判的两项：TRD-109 仍 Todo / Divhead，但 [#3325](https://github.com/gmx-io/gmx-interface/pull/3325) `2b07029b79` 已于 11 月 19 日合入 release，正文称使用 GMX 冻结表且保留 73/155 地址顺序，故不是零开工；本轮未重读链上 authority 或 keeper flags。TRD-85 仍 In Test / Rainer，#3223 `c8f9c4a85d` 不改 DepthChart，但实时 release 的 DepthChart.tsx 已有 tradeMath=gmsol 专用 price-impact/execution-price 分支，不能按旧记录“移除 preview”推断 Depth 完全未实现；仍缺本轮真实 Depth 验收。

TRD-107/108 均已 In Progress / Divhead。11 月 19 日新增证据包含金融四输出固定原生参考对照，以及 API #361 已部署、#362 性能/恢复改进；3 秒 post-trade 目标、生产约束容量/恢复及真实 open-with-TP/SL→edit→close 刷新验收仍开放。它们属于已开始未完成，不列为未开工需求。当前 Kenny 业务 PR 为 #3314/#3315/#3316/#3317，playground #3318；#3259/#3258/#3261/#3262/#3288 已关闭替换。

优先协调：确认 Sulliven collateral 实现线；确认 Kenny 已暂缓产品能力如何满足发布范围；指定本地化执行与设计验收责任；按 11 月 30 日闭环、12 月 4 日功能收口、12 月 7–9 日验收推进。公开可见 PR/字段不能证明个人本地是否已编码，以上对“未开始”保留此边界。

## Frontend Task Organization 刷新（2026-11-20 13:59 北京时间）

角色：任务协调状态核验与文档维护。用户要求重新检查既有15行表并更新；使用已读Linear skill/MCP读取全部15项正文、状态、负责人、cycle、附件及全部评论，核对Trading cycle列表、14个当前PR元数据及所有开放PR最新checks；补查TRD-83/FESOL-28仍无专属PR结果。更新同一[线上文档](https://linear.app/gmx-io/document/frontend-task-organization-8b65bab92d15)并回读核对，保留Rainer→Sulliven→Kenny排序；未改issue/PR状态或发送评论，未执行产品验收。

新增：TRD-98已Done，Reflectiv于11月20日04:26评论feature branch验证通过；#3195仍Open/非Draft/CHANGES_REQUESTED，head `58e343bb14`，检查全成功。TRD-142已Done，Reflectiv于03:47评论逐项验证通过；#3294仍Open/非Draft/REVIEW_REQUIRED，head `5e30dbc18f`，检查全成功。只引用评论结论，未另验截图或扩大到release部署。

TRD-78/#3316 `390eba5a6c`、TRD-70/#3317 `a54508119b`、playground/#3318 `d930bf0641`最新返回检查均全成功，删去旧组件报告发布失败/运行中的描述。72/#3315 `15f50b87d2`仍Ready、77/#3314仍非Draft，均待approval且检查全成功；其余开放PR同样检查全成功。63/65/75/80仍为原已合并PR，其他Linear状态、全部负责人/cycle及PR关联不变。Linear Done与PR未合并的差异原样保留；本轮不把CI/feature branch验证当生产验收。顺带搜索观察到LUT #3325、order fields #3207已合并，非本表独立行，未扩展调查或改写产品完成结论。

## Frontend Task Organization 更新（2026-11-19 13:57 北京时间）

参与角色：任务协调状态核验与文档维护。用户明确要求跟进并更新 [Linear 协调表](https://linear.app/gmx-io/document/frontend-task-organization-8b65bab92d15)。逐条读取原表 15 项的 Linear 正文、状态、负责人、cycle、附件、关系与全部评论，核对 Trading 周期列表及 GitHub 当前 PR/review/latest checks，更新同一文档并回读确认 15 行完整保存。未修改 issue 字段或发送评论，未执行产品验收。

相对 11 月 18 日表：TRD-72 为 In Progress；TRD-136 已 Done，但保留持续 playground；TRD-83 已分配 Sulliven、In Progress，仍未通过附件和新旧编号搜索确认独立实现 PR，不据此判定保证金存取已完成。TRD-142 已 In Review，对应独立 PR #3294；#3120 仍只是历史来源。全部 cycle 与原表一致。

五条当前 PR：TRD-77→#3314（非 Draft），72→#3315、78→#3316、70→#3317、136→#3318（后四条 Draft）；原 #3259/#3258/#3261/#3262/#3288 均已关闭未合并。#3314/#3315 最新返回检查全部成功；#3316 最新组件 job 在 Deploy report to GitHub Pages 步骤失败，其余最新检查成功；#3317/#3318 组件和综合 lint/types/tests 仍运行，其余最新检查成功。均待 approval，不将运行中或历史失败混作当前全部通过。

TRD-98 #3195 仍 Changes Requested，最新检查全成功；#3190 已关闭未合并，当前交易 PR 说明 reader/hook 经 #3195 集成。TRD-85 #3223、TRD-100 #3287、TRD-84 #3293、TRD-142 #3294 最新检查全成功、待 approval。63/65/75/80 的已合并 PR 与 Linear 状态保留差异。此处为状态快照，完整表以线上文档为入口；旧记录保留历史时间，不当作当前状态。

## 17 行协调表 PR 复核（2026-11-18 14:13 北京时间）

参与角色：只读 PR 状态调研。恢复 11 月 17 日 14:29 最终表格后，重新查询 17 条 Linear 的状态/负责人/附件及 GitHub PR。相对该表新增合并：TRD-80 的替代 PR [#3286](https://github.com/gmx-io/gmx-interface/pull/3286) 于 11 月 17 日 20:13、TRD-63 [#3201](https://github.com/gmx-io/gmx-interface/pull/3201) 于 20:14 合入 release。原已合并项仍为 TRD-75 #3242（11 月 14 日 17:41）、TRD-65 #3193（11 月 16 日 16:41）。TRD-63/80/75 的 Linear 仍 In Review，65 仍 In Test；合并不代表完整验收。

TRD-100 旧 #3243 已关闭未合并，当前 #3287 Open、非 Draft、返回检查全成功、REVIEW_REQUIRED。TRD-80 旧 #3238 同样关闭未合并，应使用 #3286。TRD-98 #3195 Open、Changes Requested，#3190 Open/Draft；两者组件测试失败，Linear 98 已 In Test。TRD-85 #3223 Open、非 Draft、组件测试失败，Linear 已 In Test。Kenny #3259/#3258/#3261/#3262 均 Open/Draft、REVIEW_REQUIRED、组件测试失败。#3288 Open/Draft、返回检查全成功，标题为 Solana playground，属于 TRD-136 联调载体，不是独立产品验收完成；Linear 136 当前已分配 Kenny。

新发现 Sulliven [#3293](https://github.com/gmx-io/gmx-interface/pull/3293)，11 月 18 日 10:58 创建，分支 TRD-84，标题为 Close positions, edit and cancel orders on Solana；Open、非 Draft、REVIEW_REQUIRED、返回检查全成功。Linear 84 尚无 PR 附件，按作者/分支/标题及操作文件核实对应。其 diff 包含多条未合并前置代码，本轮只查元数据与文件清单，不代表已审实现范围。TRD-142 仍只关联来源 #3120，不能当作其独立实现；TRD-83 未确认独立 PR。GitHub 全状态按新旧编号搜索也未发现这两项独立实现 PR，不据此断言不存在未关联实现。

TRD-103/104 当前均 Duplicate，指向 TRD-98；#3190 尚未合并，不应把需求归并当作代码完成。本轮未改 Linear、业务代码或执行页面/交易验收；历史表保留原观察值。

## 交易发布范围未分配核验（2026-11-18）

参与角色：只读范围与负责人调研。按 [TRD-101](https://linear.app/gmx-io/issue/TRD-101) 最新正文（updatedAt 2026-11-17T18:34:00.951Z），范围为 11 月 30 日功能开关后开仓/执行/刷新/平仓闭环、12 月 10 日验收后公开交易，排除 After trading、明确非阻塞项及 Done/Canceled/Duplicate。官方 MCP 分别查询迁移项目和整个 Trading 团队的 Assignee=null、非归档 issue，两次均 hasNextPage=false；不是只按周期筛选，也未修改 Linear。

范围内未关闭且 Assignee 为空的只有两条：

- [TRD-83](https://linear.app/gmx-io/issue/TRD-83)：Todo。正文明确首次公开发布需要抵押品存取、实施负责人待确认；TRD-101 明确要求分配 collateral owner。正文历史 Owner 提及 chloe 不等于当前 Assignee；Kenny 10 月 16 日评论仅承诺补技术前置，不构成认领。平仓/改单/撤单按 TRD-84 由 Sulliven 推进，不能将整个 83 的广义正文重新视为无人负责。
- [TRD-136](https://linear.app/gmx-io/issue/TRD-136)：In Progress。Assignee 仍为空、无评论，但 TRD-101/群消息及既有实现记录已明确 Kenny 通过 #3288 推进；属于字段未登记，不是实际无人实施。

TRD-103/104 已 Duplicate，余额范围合入 TRD-98；TRD-119 已 Duplicate，本地化责任保留在 TRD-101 checklist；TRD-62 已 Duplicate，统一界面验收合入 TRD-101 及详细需求。以上不列为独立待认领任务。TRD-133 Done；TRD-69 明确非阻塞，TRD-151 Triage 且未纳入发布必需；TRD-89/90/91/110/113/114/115/116/117 属于 After trading，均未计入。旧 FESOL-114 对应不足 SOL 需求已另建 TRD-158，实时 Assignee 为 Kenny，未计入未分配。未逐个复核 GitHub CI 或部署，不把计划勾选等同验收通过。

## 五需求晚间前置核验（2026-11-17）

前端63/80及SDK2.9.3、API#340现均已合并，需区分原线集成/部署/金融验收；详细增量统一记录。 角色为只读依赖调研，来源与验证边界见[统一核验](../solana-trading-dependencies.md#五需求晚间前置核验2026-11-17)。

## 补充 Cycle 2 已分配或已介入的前端工作（2026-11-17）

用户明确将协调表范围扩展为 Cycle 1 加上 Cycle 2 已分配 Kenny/Rainer/Sulliven、或实际已有前端介入/进展的工作，仍排除 Done。本轮官方 MCP 查询 Trading Cycle 2 全页（8 条，hasNextPage=false），其中迁移项目 4 条：TRD-70、84、83、119。

| 当前需求 | 历史编号 | 当前负责人 | 状态 | 当前周期 | 纳入依据 | 确认的实现 PR |
| --- | --- | --- | --- | --- | --- | --- |
| [TRD-70](https://linear.app/gmx-io/issue/TRD-70) | [FESOL-19](https://linear.app/gmx-io/issue/FESOL-19) | Kenny | In Progress | Cycle 2 | 已分配且已有实现；旧计划 Cycle 3 | [#3262](https://github.com/gmx-io/gmx-interface/pull/3262)，Open/Draft，仍有明确延期范围与验收条件 |
| [TRD-84](https://linear.app/gmx-io/issue/TRD-84) | [FESOL-59](https://linear.app/gmx-io/issue/FESOL-59) | Sulliven | In Progress | Cycle 2 | 已分配且状态为开发中；旧计划 Cycle 3 | 未确认独立实现 PR |
| [TRD-83](https://linear.app/gmx-io/issue/TRD-83) | [FESOL-28](https://linear.app/gmx-io/issue/FESOL-28) | 未分配 | Todo | Cycle 2 | 父需求已有子项 TRD-84 由 Sulliven 推进；Kenny 在 10 月 16 日评论确认评估并将补充技术前置 | 未确认独立实现 PR |

TRD-83 作为父级协调项补列，不代表整条已开工或已分配给 Sulliven/Kenny，不与 TRD-84 重复计算独立交付量；保证金增减等其余范围仍待明确实施负责人。TRD-119/FESOL-18 当前无负责人、Todo、无评论，未核实到实际介入或实现进展，因此未按新条件纳入；创建者为 Kenny 不等于当前已接手。Cycle 2 其他四条不属于此次 Solana 迁移项目/人员范围。

之前 Cycle 1 的 14 条保留，新增 2 条独立实施 issue，加 1 条父级协调项，展示合计 17 行。Cycle 字段不调整，Cycle 2 完整收口不代表届时才开工。本轮仅只读核验，未修改 Linear。TRD-84 未关联 PR，且 GitHub 按 FESOL-59/TRD-84 标题搜索无独立结果；#3207 正文提及其依赖，但不是本需求实现 PR。

## 上游跟进实施（2026-11-17）

TRD-101 相关 API #340 新增量索引候选 `996cf05db9` 已在独立干净checkout实测：105,529账户bootstrap，约32秒ready，未使用钱包过滤补丁；全局非空仓位、slot/freshness拒绝与恢复通过。原索引DB suite（含160k账户prune与追赶未完不serve）及四个金融/records suites共72 passed。只本地运行，未改上游源码/推送/发布；正式部署与完整负载验收仍另行。 统一来源、交付版本、验证和外部剩余项见[五需求跟进实施](../solana-trading-dependencies.md#五需求跟进实施2026-11-17)。

## Trading Cycle 1 前端筛选（2026-11-17）

补充PR实时核验：TRD-63→#3201、72→#3258、77→#3259、78→#3261、75→#3242（Merged）、98→#3195、85→#3223、65→#3193（已Merged，Linear仍In Test）、80→#3238、100→#3243。TRD-103/104均关联#3190，PR正文明确89/96，是同一reader/hook实现；#3195为下游余额集成。TRD-142仅关联#3120，但它是FESOL-48来源PR并明确延期110范围，不列为142的实现PR。TRD-136未确认独立PR；列表只保留确证的实现PR，未声称附属PR/未关联实现全部不存在。

本轮官方 MCP 全页查询 Trading Cycle 1（hasNextPage=false），筛选 Kenny/Rainer/Sulliven 及未分配的前端相关工作，排除 Done/Canceled/Duplicate。共14条：Kenny4、Rainer3、Sulliven4、未分配3。旧编号通过迁移前快照 UUID 匹配；TRD-136为新建需求，无旧FESOL编号，读取完整正文确认它涉及共享TradeBox真实交易本地联调、钱包/发送/生命周期及API环境协作，属于前端参与的跨侧联调，非纯UI实现。

| 当前编号 | 旧编号 | 负责人 | 当前状态 |
| --- | --- | --- | --- |
| TRD-63 | FESOL-15 | Kenny | In Review |
| TRD-72 | FESOL-56 | Kenny | In Review |
| TRD-77 | FESOL-72 | Kenny | In Progress |
| TRD-78 | FESOL-20 | Kenny | In Progress |
| TRD-75 | FESOL-57 | Rainer | In Review |
| TRD-98 | FESOL-51 | Rainer | In Review |
| TRD-85 | FESOL-29 | Rainer | In Review |
| TRD-80 | FESOL-25 | Sulliven | In Review |
| TRD-65 | FESOL-52 | Sulliven | In Test |
| TRD-100 | FESOL-92 | Sulliven | In Review |
| TRD-142 | FESOL-110 | Sulliven | In Progress |
| TRD-104 | FESOL-89 | 未分配 | In Progress |
| TRD-103 | FESOL-96 | 未分配 | In Progress |
| TRD-136 | 无 | 未分配 | In Progress |

与此前对话不同，FESOL-110现已迁移为TRD-142并在Cycle1，不沿用旧Release观察。TRD-105/106为Done排除；TRD-70/84位于Cycle2，不计入当前Cycle1成员（跨周期阶段目标仍保留）。本轮只查询，未修改Linear，不将状态解读为代码/部署验收结论。

## TRD-101 正文全部 FESOL 引用映射（2026-11-16）

用户随后明确授权实施，已通过 Linear patch 将 38 条已迁移需求在 TRD-101 正文中的全部引用（显示编号与 URL）更新为核实的 TRD 编号。保留 FESOL-79/110/114 以及 DES 引用；未追加解释文字或改动原计划语义。更新前从最新正文生成完整编号匹配的预期结果，patch 仅覆盖 Markdown 引用；更新后独立 get_issue 回读，正文与预期逐字符完全一致，确认没有其他正文差异。未修改任何关联任务属性、团队或周期。

替换前二次核验：再次读取最新 TRD-101，仍为 41 个不同 FESOL 引用；41 条均以旧编号实时查询，38 条迁移项再用对应 TRD 编号独立查询，UUID/当前编号全部一致。41 条同时与 2026-11-12T17:47:06.125Z 迁移前快照比较，UUID 与标题均无差异；41 个 UUID 互不重复，无多对一误配。确认可按下表更新 38 条不同迁移项的全部引用，FESOL-79/110/114 保留；核验完成后仍未修改 Linear 正文。

实时读取 TRD-101 正文并去重提取 41 个 FESOL 引用，逐条用官方 Linear MCP get_issue 解析旧编号，核验返回的当前编号、标题、团队和 URL。其中 38 个已迁移到 Trading；FESOL-79、110、114 仍在 Solana Frontend，没有对应的迁移后 TRD 编号。此次只查询，不修改正文、团队或任何任务。范围不限前述 UI/负责人/状态筛选，未递归提取被引用需求正文内的其他编号。

| 原引用 | 当前编号 | 当前需求标题 |
| --- | --- | --- |
| FESOL-15 | [TRD-63](https://linear.app/gmx-io/issue/TRD-63/display-solana-markets-in-the-gmx-market-dropdown-and-primary-header) | Display Solana markets in the GMX market dropdown and primary header |
| FESOL-29 | [TRD-85](https://linear.app/gmx-io/issue/TRD-85/support-solana-price-and-depth-charts-in-gmx) | Support Solana Price and Depth Charts in GMX |
| FESOL-51 | [TRD-98](https://linear.app/gmx-io/issue/TRD-98/show-solana-balances-from-the-gmx-rpc) | Show Solana balances from the GMX RPC |
| FESOL-25 | [TRD-80](https://linear.app/gmx-io/issue/TRD-80/display-solana-positions-and-open-orders) | Display Solana Positions and Open Orders |
| FESOL-57 | [TRD-75](https://linear.app/gmx-io/issue/TRD-75/add-gmsol-variants-to-the-sdk-trade-math) | Add gmsol variants to the SDK trade math |
| FESOL-92 | [TRD-100](https://linear.app/gmx-io/issue/TRD-100/add-sdk-unit-conversions-for-solana-order-inputs) | Add SDK unit conversions for Solana order inputs |
| FESOL-56 | [TRD-72](https://linear.app/gmx-io/issue/TRD-72/build-check-and-send-solana-order-transactions-with-the-gmsol-sdk) | Build, check and send Solana order transactions with the gmsol SDK |
| FESOL-61 | [TRD-102](https://linear.app/gmx-io/issue/TRD-102/write-the-solana-api-spec-and-sample-responses) | Write the Solana API spec and sample responses |
| FESOL-113 | [TRD-99](https://linear.app/gmx-io/issue/TRD-99/call-the-solana-api-through-the-sdk-client) | Call the Solana API through the SDK client |
| FESOL-52 | [TRD-65](https://linear.app/gmx-io/issue/TRD-65/feed-the-solana-trade-state-from-gmx-api) | Feed the Solana trade state from gmx-api |
| FESOL-112 | [TRD-108](https://linear.app/gmx-io/issue/TRD-108/switch-solana-positions-to-the-gmsol-variants-of-the-sdk-trade-math) | Switch Solana positions to the gmsol variants of the SDK trade math |
| FESOL-67 | [TRD-107](https://linear.app/gmx-io/issue/TRD-107/load-check-the-solana-service) | Load-check the Solana service |
| FESOL-89 | [TRD-104](https://linear.app/gmx-io/issue/TRD-104/read-raw-solana-wallet-balances-through-the-gmx-rpc) | Read raw Solana wallet balances through the GMX RPC |
| FESOL-96 | [TRD-103](https://linear.app/gmx-io/issue/TRD-103/add-a-lazy-solana-balance-hook-with-network-scoped-caching) | Add a lazy Solana balance hook with network-scoped caching |
| FESOL-90 | [TRD-106](https://linear.app/gmx-io/issue/TRD-106/isolate-solana-trade-cache-and-storage-keys-by-network) | Isolate Solana trade cache and storage keys by network |
| FESOL-91 | [TRD-105](https://linear.app/gmx-io/issue/TRD-105/add-network-aware-token-lookup-for-solana-mints) | Add network-aware token lookup for Solana mints |
| FESOL-19 | [TRD-70](https://linear.app/gmx-io/issue/TRD-70/adapt-perp-order-entry) | Adapt Perp Order Entry |
| FESOL-20 | [TRD-78](https://linear.app/gmx-io/issue/TRD-78/show-solana-market-order-sending-and-filling-status) | Show Solana Market Order Sending and Filling Status |
| FESOL-59 | [TRD-84](https://linear.app/gmx-io/issue/TRD-84/close-positions-edit-and-cancel-orders-on-solana) | Close positions, edit and cancel orders on Solana |
| FESOL-71 | [TRD-109](https://linear.app/gmx-io/issue/TRD-109/prepare-mainnet-testing-lookup-tables-and-ui-flags) | Prepare mainnet testing: lookup tables and UI flags |
| FESOL-72 | [TRD-77](https://linear.app/gmx-io/issue/TRD-77/build-the-gmsol-sdk-from-v0100-in-gmx-ci-and-replace-the-pinned-build) | Build the gmsol SDK from v0.10.0 in GMX CI and replace the pinned build |
| FESOL-110 | [FESOL-110](https://linear.app/gmx-io/issue/FESOL-110/follow-up-the-solana-pages-tradebox-entries-and-chat-gaps-left-by)（仍在旧团队） | Follow up the Solana pages, TradeBox entries, and chat gaps left by FESOL-48 |
| FESOL-28 | [TRD-83](https://linear.app/gmx-io/issue/TRD-83/adapt-solana-position-and-order-actions-to-gmx) | Adapt Solana Position and Order Actions to GMX |
| FESOL-114 | [FESOL-114](https://linear.app/gmx-io/issue/FESOL-114/block-solana-actions-in-gmx-when-the-wallet-lacks-sol-for-gas)（仍在旧团队） | Block Solana actions in GMX when the wallet lacks SOL for gas |
| FESOL-18 | [TRD-119](https://linear.app/gmx-io/issue/TRD-119/technical-side-multilingual-alignment) | [Technical side] Multilingual alignment |
| FESOL-86 | [TRD-117](https://linear.app/gmx-io/issue/TRD-117/support-solana-tradfi-markets-stocks-fx-and-commodities) | Support Solana TradFi markets: stocks, FX and commodities |
| FESOL-30 | [TRD-89](https://linear.app/gmx-io/issue/TRD-89/support-solana-trades-in-gmx) | Support Solana Trades in GMX |
| FESOL-31 | [TRD-90](https://linear.app/gmx-io/issue/TRD-90/support-solana-claims-in-gmx) | Support Solana Claims in GMX |
| FESOL-32 | [TRD-91](https://linear.app/gmx-io/issue/TRD-91/support-the-solana-net-rate-chart-in-gmx) | Support the Solana Net Rate Chart in GMX |
| FESOL-33 | [TRD-110](https://linear.app/gmx-io/issue/TRD-110/support-solana-swap-in-gmx) | Support Solana Swap in GMX |
| FESOL-8 | [TRD-111](https://linear.app/gmx-io/issue/TRD-111/support-receiving-and-sending-assets-on-solana) | Support receiving and sending assets on Solana |
| FESOL-6 | [TRD-92](https://linear.app/gmx-io/issue/TRD-92/support-solana-wallet-connections-and-asset-visibility) | Support Solana wallet connections and asset visibility |
| FESOL-3 | [TRD-116](https://linear.app/gmx-io/issue/TRD-116/integrate-solana-pools-and-liquidity-actions-into-gmx) | Integrate Solana Pools and liquidity actions into GMX |
| FESOL-79 | [FESOL-79](https://linear.app/gmx-io/issue/FESOL-79/adapt-the-stats-page-for-solana)（仍在旧团队） | Adapt the Stats Page for Solana |
| FESOL-102 | [TRD-115](https://linear.app/gmx-io/issue/TRD-115/support-the-solana-earn-page-in-gmx) | Support the Solana Earn Page in GMX |
| FESOL-104 | [TRD-114](https://linear.app/gmx-io/issue/TRD-114/support-the-solana-referrals-page-in-gmx) | Support the Solana Referrals Page in GMX |
| FESOL-105 | [TRD-113](https://linear.app/gmx-io/issue/TRD-113/support-the-solana-gt-points-page-in-gmx) | Support the Solana GT Points Page in GMX |
| FESOL-106 | [TRD-112](https://linear.app/gmx-io/issue/TRD-112/support-staking-in-gmx-solana-gt-points) | Support Staking in GMX Solana GT Points |
| FESOL-26 | [TRD-118](https://linear.app/gmx-io/issue/TRD-118/ask-gmtrade-for-notice-before-program-upgrades) | Ask GMTrade for notice before program upgrades |
| FESOL-116 | [TRD-69](https://linear.app/gmx-io/issue/TRD-69/confirm-solana-market-listing-dates-for-new-and-recently-listed) | Confirm Solana market listing dates for New and Recently Listed |
| FESOL-5 | [TRD-62](https://linear.app/gmx-io/issue/TRD-62/unify-the-solana-trade-page-with-the-gmx-standard) | Unify the Solana Trade page with the GMX standard |

## 旧 Cycle 2/3 编号对照（2026-11-16）

用户要求列旧周期 issue 与新编号对照。本轮用官方 Linear MCP 全页读取 Trading（135 条，hasNextPage=false），与 2026-11-12T17:47:06.125Z 的迁移前 FESOL 快照按 issue UUID 匹配，下面 30 个不同 issue 中 29 个已迁移、FESOL-110 仍在旧团队。只查询，未改 Linear。

范围依据为历史 FESOL-109 计划正文；这是计划清单及后续补充依赖，不冒充迁移前实际 cycle 字段的完整备份（旧快照没有 cycle 字段）。旧 Cycle 2 为 10 月 26 日至 11 月 9 日边界，Cycle 3 为 11 月 9 日至 23 日边界。主清单按早期计划分组，后续 11 月 12 日 Cycle 3 扩展依赖单列；FESOL-65 跨周期重复展示。FESOL-112 在旧 Cycle 3 正文中明确仍分配旧 Cycle 4，仅为 Cycle 3 财务验收前置，不能误列成旧 Cycle 2/3 实际成员。旧周期现存列表主要为未迁移的 GMTrade 任务，不能以此反推完整迁移清单。

旧 Cycle 2 计划主清单

| 旧编号 | 当前编号 | 当前标题 | 当前 Trading cycle |
| --- | --- | --- | --- |
| FESOL-7 | [TRD-120](https://linear.app/gmx-io/issue/TRD-120/integrate-solana-network-selection-and-app-navigation-inside-gmx) | Integrate Solana network selection and app navigation inside GMX | 未分配 |
| FESOL-42 | [TRD-97](https://linear.app/gmx-io/issue/TRD-97/connect-external-solana-wallets-through-privy) | Connect external Solana wallets through Privy | 未分配 |
| FESOL-51 | [TRD-98](https://linear.app/gmx-io/issue/TRD-98/show-solana-balances-from-the-gmx-rpc) | Show Solana balances from the GMX RPC | Cycle 1 |
| FESOL-48 | [TRD-122](https://linear.app/gmx-io/issue/TRD-122/hide-evm-only-features-on-solana) | Hide EVM-only features on Solana | 未分配 |
| FESOL-15 | [TRD-63](https://linear.app/gmx-io/issue/TRD-63/display-solana-markets-in-the-gmx-market-dropdown-and-primary-header) | Display Solana markets in the GMX market dropdown and primary header | Cycle 1 |
| FESOL-52 | [TRD-65](https://linear.app/gmx-io/issue/TRD-65/feed-the-solana-trade-state-from-gmx-api) | Feed the Solana trade state from gmx-api | Cycle 1 |
| FESOL-29 | [TRD-85](https://linear.app/gmx-io/issue/TRD-85/support-solana-price-and-depth-charts-in-gmx) | Support Solana Price and Depth Charts in GMX | Cycle 1 |
| FESOL-50 | [TRD-86](https://linear.app/gmx-io/issue/TRD-86/add-solana-prices-candles-and-the-24h-change-from-gmxs-oracle-keeper) | Add Solana prices, candles and the 24h change from GMX's oracle keeper | 未分配 |
| FESOL-63 | [TRD-131](https://linear.app/gmx-io/issue/TRD-131/map-solana-mints-to-the-arbitrum-oracle-keeper-prices) | Map Solana mints to the Arbitrum oracle keeper prices | 未分配 |
| FESOL-64 | [TRD-130](https://linear.app/gmx-io/issue/TRD-130/serve-solana-market-config-and-values-from-the-chain) | Serve Solana market config and values from the chain | 未分配 |
| FESOL-65 | [TRD-129](https://linear.app/gmx-io/issue/TRD-129/serve-solana-positions-and-orders-from-the-chain) | Serve Solana positions and orders from the chain | 未分配 |
| FESOL-66 | [TRD-125](https://linear.app/gmx-io/issue/TRD-125/route-solanagmxapiio-to-api-solana-and-add-monitors) | Route solana.gmxapi.io to api-solana and add monitors | 未分配 |

旧 Cycle 3 计划主清单

| 旧编号 | 当前编号 | 当前标题 | 当前 Trading cycle |
| --- | --- | --- | --- |
| FESOL-25 | [TRD-80](https://linear.app/gmx-io/issue/TRD-80/display-solana-positions-and-open-orders) | Display Solana Positions and Open Orders | Cycle 1 |
| FESOL-19 | [TRD-70](https://linear.app/gmx-io/issue/TRD-70/adapt-perp-order-entry) | Adapt Perp Order Entry | Cycle 2 |
| FESOL-56 | [TRD-72](https://linear.app/gmx-io/issue/TRD-72/build-check-and-send-solana-order-transactions-with-the-gmsol-sdk) | Build, check and send Solana order transactions with the gmsol SDK | Cycle 1 |
| FESOL-57 | [TRD-75](https://linear.app/gmx-io/issue/TRD-75/add-gmsol-variants-to-the-sdk-trade-math) | Add gmsol variants to the SDK trade math | Cycle 1 |
| FESOL-20 | [TRD-78](https://linear.app/gmx-io/issue/TRD-78/show-solana-market-order-sending-and-filling-status) | Show Solana Market Order Sending and Filling Status | Cycle 1 |
| FESOL-59 | [TRD-84](https://linear.app/gmx-io/issue/TRD-84/close-positions-edit-and-cancel-orders-on-solana) | Close positions, edit and cancel orders on Solana | Cycle 2 |
| FESOL-65 | [TRD-129](https://linear.app/gmx-io/issue/TRD-129/serve-solana-positions-and-orders-from-the-chain) | Serve Solana positions and orders from the chain | 未分配 |
| FESOL-67 | [TRD-107](https://linear.app/gmx-io/issue/TRD-107/load-check-the-solana-service) | Load-check the Solana service | Cycle 1 |
| FESOL-71 | [TRD-109](https://linear.app/gmx-io/issue/TRD-109/prepare-mainnet-testing-lookup-tables-and-ui-flags) | Prepare mainnet testing: lookup tables and UI flags | Cycle 1 |

旧 Cycle 3 补充前置/联调依赖

| 旧编号 | 当前编号 | 当前标题 | 当前 Trading cycle |
| --- | --- | --- | --- |
| FESOL-61 | [TRD-102](https://linear.app/gmx-io/issue/TRD-102/write-the-solana-api-spec-and-sample-responses) | Write the Solana API spec and sample responses | Cycle 1 |
| FESOL-72 | [TRD-77](https://linear.app/gmx-io/issue/TRD-77/build-the-gmsol-sdk-from-v0100-in-gmx-ci-and-replace-the-pinned-build) | Build the gmsol SDK from v0.10.0 in GMX CI and replace the pinned build | Cycle 1 |
| FESOL-89 | [TRD-104](https://linear.app/gmx-io/issue/TRD-104/read-raw-solana-wallet-balances-through-the-gmx-rpc) | Read raw Solana wallet balances through the GMX RPC | Cycle 1 |
| FESOL-90 | [TRD-106](https://linear.app/gmx-io/issue/TRD-106/isolate-solana-trade-cache-and-storage-keys-by-network) | Isolate Solana trade cache and storage keys by network | Cycle 1 |
| FESOL-91 | [TRD-105](https://linear.app/gmx-io/issue/TRD-105/add-network-aware-token-lookup-for-solana-mints) | Add network-aware token lookup for Solana mints | Cycle 1 |
| FESOL-92 | [TRD-100](https://linear.app/gmx-io/issue/TRD-100/add-sdk-unit-conversions-for-solana-order-inputs) | Add SDK unit conversions for Solana order inputs | Cycle 1 |
| FESOL-96 | [TRD-103](https://linear.app/gmx-io/issue/TRD-103/add-a-lazy-solana-balance-hook-with-network-scoped-caching) | Add a lazy Solana balance hook with network-scoped caching | Cycle 1 |
| FESOL-110 | [FESOL-110](https://linear.app/gmx-io/issue/FESOL-110) | Follow up the Solana pages, TradeBox entries, and chat gaps left by FESOL-48 | 仍在旧团队 |
| FESOL-112 | [TRD-108](https://linear.app/gmx-io/issue/TRD-108/switch-solana-positions-to-the-gmsol-variants-of-the-sdk-trade-math) | Switch Solana positions to the gmsol variants of the SDK trade math | Cycle 1 |
| FESOL-113 | [TRD-99](https://linear.app/gmx-io/issue/TRD-99/call-the-solana-api-through-the-sdk-client) | Call the Solana API through the SDK client | Cycle 1 |

## 已执行 Trading cycle 关联（2026-11-15）

用户明确授权根据 Divhead 的 TRD-101 规划更新 PM 关注的 Trading Cycles，要求避免误导。本轮通过已有 Chrome 登录态执行，参与角色为排期整理与协调，不代表接管整体集成/验收，也未发送消息或评论。

- [Cycle 1](https://linear.app/gmx-io/team/TRD/cycle/1)（11 月 16–29 日）新增关联 19 条；页面总数从 29 增至 48 issues。
- [Cycle 2](https://linear.app/gmx-io/team/TRD/cycle/2)（11 月 30 日至 12 月 13 日）新增关联 4 条；页面总数从 4 增至 8 issues。总数包含其他工作，不等于 Solana 范围。
- 两个周期的 planning 均附上原始 [TRD-101](https://linear.app/gmx-io/issue/TRD-101/solana-trading-plan) 链接；分别新建 [Cycle 1 scope and handoff](https://linear.app/gmx-io/document/solana-cycle-1-scope-and-handoff-7282d8675025) 与 [Cycle 2 completion and acceptance](https://linear.app/gmx-io/document/solana-cycle-2-completion-and-acceptance-ea490bd24c0a)，并互相链接。重新打开确认正文、状态解释及跨周期边界已保存。

| 周期 | 原编号 → Trading 编号 |
| --- | --- |
| Cycle 1：原定 11 月 16 日前的剩余交付/联调/验收 | FESOL-15 → TRD-63；29 → 85；51 → 98；25 → 80；57 → 75；92 → 100；56 → 72；61 → 102；113 → 99；52 → 65 |
| Cycle 1：余额、隔离、交易状态与部署验证 | FESOL-89 → TRD-104；96 → 103；90 → 106；91 → 105；20 → 78；71 → 109；112 → 108；67 → 107；72 → 77 |
| Cycle 2：完整范围收口 | FESOL-19 → TRD-70；59 → 84；28 → 83；18 → 119 |

每条最终 cycle 属性在操作阶段均核验；最终另核验两周期总数和 planning 附件。TRD-70、84、83 按完整 issue 的收口周期放入 Cycle 2，文档明确其 Cycle 1 开始开发/联调及市场单 TP/SL、平仓、开仓→执行→刷新→平仓阶段目标仍有效；单个 issue 只能属于一个 cycle，不表示 11 月 30 日才开始。TRD-70 既有延期子范围仍需明确恢复决定，排期不自动恢复开发。没有重置已开发成果或把排期解释为完成验收。

已观察的 Linear 自动行为及处理：给父 issue 分配 cycle 会带入部分尚无 cycle 的活动子项，已逐一核对；TRD-77 曾随 TRD-70 自动进 Cycle 2，已明确改回 Cycle 1 并核验。抽样已完成子项 TRD-64、86 保持 Done、无 cycle。Backlog issue 排入 cycle 自动转 Todo，改回 Backlog 会移出 cycle；TRD-83、119 因此保留系统生成的 Todo（原为 Backlog），文档明确这是排期而非已开工。没有将任务改成 In Progress/Done，未改负责人、估点、issue 到期日、周期日期或原计划正文。

仍需人工决定的缺口已直接写在周期说明中：

- TRD-104、103 无负责人；TRD-83、119 无负责人及估点，不能认为容量与责任已经确认。
- [FESOL-114](https://linear.app/gmx-io/issue/FESOL-114) 仍在 Solana Frontend/Triage，负责人 Kenny，未迁移或强行排入 Trading。交易相关 SOL 检查属于计划 Cycle 2 范围，团队/triage 处理待确认；GM/GLV/pool 扩展范围不提前纳入。TRD-72 的部分 SOL 检查不证明整条需求完成。
- FESOL-110 仍在旧团队、Release、无 project，未重开/迁移；Cycle 1 说明保留组合前端导航/support 验收核对。DES-65 保留 Design team，仅作验收参考。
- 11 月 30 日交易闭环是两周期交接检查点；12 月 14 日观察边界保留在 Cycle 2 文档，未悄悄改成 13 日结束。12 月 10 日公开目标以验收和重估为条件。TradFi、history、Claims、Net rate、Swap/转账、Pools/Stats、Earn/Referrals/GT 等仍属后续范围。

本轮验证限于 Linear 关系、页面和文档保存；未据此认证 PR、部署、真实钱包/keeper 测试、实际容量或发布日期。

## Trading 迁移后的当前入口（2026-11-15）

用户提供 PM 对话确认 11 月 14 日已将 unification issues 移至 Trading team，并要求 Kenny 重新规划 Trading cycles。本轮通过用户现有 Chrome 原生窗口只读核验：旧 FESOL-109 URL 自动跳转至 [TRD-101 · Solana trading plan](https://linear.app/gmx-io/issue/TRD-101/solana-trading-plan)，不是已删除需求。Activity 显示 chloeee 于 11 月 14 日 10:33:42 将团队从 Solana Frontend 改为 Trading、状态由 Review 改为 In Progress，并移出旧 Cycle 3；当前属性为 Add to cycle，尚未分配新 cycle，assignee 为 Divhead。

- 旧周期列表：[Solana Frontend Cycles](https://linear.app/gmx-io/team/FESOL/cycles)。Cycle 1/2/3/4 起始日分别为 10 月 12 日、10 月 26 日、11 月 9 日、11 月 23 日；旧 Cycle 3 页面仍可访问，不作为新的 Trading 分配。
- 新周期列表：[Trading Cycles](https://linear.app/gmx-io/team/TRD/cycles)。[Cycle 1](https://linear.app/gmx-io/team/TRD/cycle/1) UI 显示 11 月 16–29 日；[Cycle 2](https://linear.app/gmx-io/team/TRD/cycle/2) UI 显示 11 月 30 日至 12 月 13 日。计划正文写 11 月 16–30 日、11 月 30 日至 12 月 14 日，需区分正文周期边界与 UI 显示的末日，不擅自改期。
- 当前 TRD-101 正文已简化为 Trading Cycle 1/2 计划：11 月 20 日 API/数学/负载验证、11 月 30 日交易闭环与目标重估、12 月 4 日实现收口、7–8 日验收、9 日修复与复验、10 日验收后公开、11–14 日观察。日期是计划目标，不是当前完成或上线承诺。
- 项目入口仍为 [GMX and GMTrade Frontend Unification](https://linear.app/gmx-io/project/gmx-and-gmtrade-frontend-unification-0774804d1299)。本轮所见两个新 cycle 的 planning 区域只有 Add document or link，未见已附时间线文档；已确认的总计划入口是 TRD-101。

现有 CLI API key 的 teams 查询只返回 FESOL，无法据此判断 TRD 不存在；浏览器登录态可访问 Trading 与迁移后的需求。后续查迁移需求应优先识别 TRD 新编号，不再将旧 FESOL 团队快照当完整范围。本轮未改 Linear、周期或正文；以下 11 月 13 日记录保留为迁移前历史。

更新：2026-11-13。参与角色：需求查询与计划口径记录，未认领业务实现。
来源：[FESOL-109](https://linear.app/gmx-io/issue/FESOL-109)；本次实时抓取时间为 2026-11-13 00:00（Asia/Shanghai），正文 updatedAt 为 2026-11-12T06:42:35.152Z，评论为空。

## 当前执行口径

- 用户于 2026-11-13 明确：该 issue 是最新制定的时间节点；Cycle 2 已开发完成，部分 issue 仍在 review 或测试，目前处于 Cycle 3。后续讨论沿用这一实际阶段描述；开发完成、review 完成和测试验收完成分别判断，不将 review/test 状态直接解释为尚未开发。
- 正文同时保留两套周期编号：Solana Frontend Cycle 2 为 10 月 26 日至 11 月 9 日，Cycle 3 为 11 月 9 日至 23 日；11 月 11 日新增的 Trading Cycle 1 为 11 月 16 日至 30 日，Trading Cycle 2 为 11 月 30 日至 12 月 14 日。正文明确后者控制排期，较早章节作为历史上下文。用户所述当前 Cycle 3 与前一套编号对应；交流时写明周期体系，避免把它误认为未来的 Trading Cycle 2。

## 最新正文中的交付目标

- 11 月 20 日：钱包/数据基础、交易构建器及已评审 SDK 数学发布与 API 接入目标；11 月 23 日：受控主网交易试点；11 月 27 日：索引部署上的交易、数据一致性与故障/恢复核验；11 月 30 日：重估公开发布目标。
- 12 月 4 日前完成必需实现；12 月 7–8 日完成验收；12 月 9 日修复、复验并作发布决定；12 月 10 日为通过验收后的公开启用目标；12 月 11–14 日观察及修复回归。12 月 24 日仅为应急日期，未获替代发布日期批准。
- 首发要求包括限价、订单编辑/取消、抵押品增减；Depth 默认保留，延期须明确决定。金融正确性与索引后端验收属于必需条件。TradFi、历史、Claims、Swap、转账、Pools、Stats、Earn、Referrals、GT/staking 不进入 12 月 10 日交易关键路径。
- API 交接分别核验索引实现、已发布 SDK 数学接入和实际部署；单个 PR 合并、本地测试或直读 RPC 的内部试点不能替代整体验收。正文历史 PR/分配快照不作为本次最新工程状态。

## 核验边界

本次读取正文、关系与评论，并记录用户补充的开发阶段；未全量核验子 issue、GitHub PR、代码、SDK 发布或部署，因此不提供实际完成率，也不确认正文中各项依赖当前仍然阻塞。未修改 Linear 或发布外部消息。
