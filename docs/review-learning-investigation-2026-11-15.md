# Solana 前端 review 经验深挖与协作优化方案

日期：2026-11-15。角色：只读调查、方案起草。本文保留调查当时的证据与提案；用户批准后已完成[当前经验与工作流入口](review-lessons.md)的文档实施，未改业务或工作流工具，实际收益待后续真实任务检验。下文“提案/未实施”均指调查当时状态。本文承接[学习范围](coding-and-self-review.md#review-经验的学习范围)。

## 调查范围与证据边界

- 四个作者账号已核实为 `kenny-7100`、`sulliven2700-lgtm`、`rainer-vivi`、`divhead`。上一轮抓取30个正式迁移及相关PR的inline comments、reviews、issue comments；本轮进一步读取13个关键PR的当前head、正文、commit记录和review threads，线程连接均无下一页。普通评论、回复和机器人记录不计作独立缺陷。
- 关键PR：#3110、#3120、#3138、#3193、#3195、#3201、#3223、#3238、#3242、#3243、#3197、#3205、#3207；静态读取部分当前源码和关键修改提交。没有运行这些分支的测试、浏览器、Rust generator或链上验收，不将历史reviewer实验冒充本次复现。
- 本轮fetch后 `origin/release=84ab9293a8`，包含#3242；#3242 head为`1e4d3350bc`且已合并，#3193 head为`e712a1d342`且仍Open。#3195 `2495be234e`、#3201 `056f8d689c`、#3223 `437fcf5714`均Open。这是本轮观察，不代表未来状态。
- Linear复用现有只读工具。15个历史核心编号实时查询均未成功；最小viewer查询可访问，但FESOL-42按编号及旧UUID均返回Entity not found，不能判断是删除、可见性或其他原因。该访问缺口此前也有记录，不是本轮确认的新故障。当前最新本地快照仅40项，相关条目不存在；需求原文使用2026-11-12 17:47 UTC快照，绝不当作当前正文或评论。
- 实时成功读取[FESOL-110](https://linear.app/gmx-io/issue/FESOL-110)、[FESOL-114](https://linear.app/gmx-io/issue/FESOL-114)、[FESOL-87](https://linear.app/gmx-io/issue/FESOL-87)的正文、关系和评论（2026-11-15 05:18 UTC）。110是48遗留入口和chat的明确后续，87强调独立切片不豁免51/52/56整体验收，114将订单SOL检查扩展到其他交易动作。不能据其状态判断代码已部署。

## 证据链一：少写代码是在正确边界承接差异

[52 review总评](https://github.com/gmx-io/gmx-interface/pull/3193#pullrequestreview-5789044554)建议删除fixture、无人调用的slot机制、复制的mapper和低价值测试。它并非单纯要求缩短PR：历史52原文明写fixture仅用到host有数据为止，review时host已可用；[113历史需求](https://linear.app/gmx-io/issue/FESOL-113)要求API经共享SDK，替代假Arbitrum上下文和app HTTP包装。

[Divhead的#3197](https://github.com/gmx-io/gmx-interface/pull/3197)将Solana API能力放进SDK。随后[4f62a4eacf](https://github.com/gmx-io/gmx-interface/commit/4f62a4eacfc0a18381c218488049de766b93dc58)删掉`GmxApiContext`类、私有ctx与getter/setter的兼容转换，恢复简单对象，在真正的EVM操作入口`requireEvmContext()`验证。实际diff为18 additions/58 deletions。这个提交由Divhead直接完成，不依赖review文字。

可复用判断：先找项目已有接缝，再判断差异属于数据、网络还是协议；适配一次后复用共享层。仅为适配而扩展一套状态/包装/兼容对象，需要具体消费者和不能复用的证据。此结论不授权全面重构，不强求消灭所有重复。

## 证据链二：已经完成的抽取也要随新消费者重新核验

[52评论](https://github.com/gmx-io/gmx-interface/pull/3193#discussion_r4483646300)要求当时删除没有调用者的交易后slot refetch；不是永远禁止。#3205/#3207为折扣和Solana订单字段补类型，说明“目前没人读”与“协议永远不需要”不同。

本轮读取52 head `e712a1d342`的`composeGmsolOrdersInfo.ts`，仍在共享mapper前删除`actionState/orderAccount/positionAccount/rentReceiver`；这在早期显示任务中可理解，但交易update/cancel等消费者出现后必须重新审查字段传递。没有在本轮执行消费者复现，不能把这一观察直接判作新增P1。应与已有[FESOL-56](issues/FESOL-56.md)集成记录共同使用。

建议经验必须带消费者/阶段条件：删除早建机制的历史决策，不能变成后续交易任务拒绝引入必要能力的依据。

## 证据链三：用户资产与请求完整性优先于“页面有结果”

[52首轮缺价格](https://github.com/gmx-io/gmx-interface/pull/3193#discussion_r4466217370)会把有持仓变成零持仓；后续[错误态](https://github.com/gmx-io/gmx-interface/pull/3193#discussion_r4483646280)区分首次失败、带缓存刷新失败及host不可用；[Sulliven的修正](https://github.com/gmx-io/gmx-interface/pull/3193#discussion_r4490450787)指出disabled market不能简单移除，否则已有仓位不能展示/关闭。

当前52源码区分listed/enabled market，以`resolveGmsolAccountSnapshot`保留本次API仍报告、但暂时无法compose的旧对象，并报告isIncomplete；provider的旧持仓缓存按owner隔离。这比“API有非空数组就正常”更接近所需行为。本次只读确认结构，没有重新证明所有错误恢复路径。

可复用判断：区分零、空、未知、部分、过期；区分可新开仓市场与仍需管理已有仓位的市场；缓存不能跨钱包带入。修复时追踪原始数据→compose→selector→计数/列表/可操作性的全过程。

## 证据链四：网络开关、可见性和状态所有权不是同一件事

[48 margin入口](https://github.com/gmx-io/gmx-interface/pull/3120#discussion_r4336793693)只关闭dropdown仍留下铅笔；[设置页](https://github.com/gmx-io/gmx-interface/pull/3120#discussion_r4336793730)CSS隐藏不停止hook，但关闭整个页面又带走网络中立设置。[钱包集成](https://github.com/gmx-io/gmx-interface/pull/3110#discussion_r4358191016)不使用EVM hook结果仍会启动RPC。

[52 pending首轮](https://github.com/gmx-io/gmx-interface/pull/3193#discussion_r4466217380)保住列表后，[replacement二轮](https://github.com/gmx-io/gmx-interface/pull/3193#discussion_r4469286763)仍因旧promise引用已卸载poller回调失效；随后又核对transport gate对在途watcher的影响。可暂停的新请求、必须存活的业务状态和已启动任务需要分别决定归属。

实时110把48刻意延期的TradeBox入口、页面和chat列为后续，87强调切片完成不豁免整体。建议开发前画当前改动所涉及的入口、状态owner与异步任务关系，只检查受影响部分；不要把“Solana无EVM请求”机械扩大为销毁所有EVM在途事务，或关闭共享遥测/chat。

## 证据链五：验收输入要有区分力

历史42验收特意用MetaMask连接MegaETH再接Phantom，注明Arbitrum/Avalanche的settlement跟随行为会让测试证明不了目标。[3110 review](https://github.com/gmx-io/gmx-interface/pull/3110#discussion_r4324738579)还指出preview中新建会话无法覆盖升级前恢复、没有picked记录的旧用户。

[50 NEAR](https://github.com/gmx-io/gmx-interface/pull/3138#discussion_r4375833519)用Solana9位、Arbitrum24位区别错误精度来源；[15 null key测试](https://github.com/gmx-io/gmx-interface/pull/3201#discussion_r4483355273)没有guard也通过；[51 Token-2022](https://github.com/gmx-io/gmx-interface/pull/3195#discussion_r4483348370)被错误过滤后测试可能永远不触及路径。

建议测试先写一句“如果犯哪种错误，此输入会怎样失败”，再选输入和断言；mock只替代必要边界，不提前注入已经正确的最终状态来证明本应在上游发生的行为。反例验证按风险选择，不要求所有测试机械变异。

## 证据链六：BigInt不等于协议数值一致

#3242没有inline threads，但Divhead直接提交多次数学修复；本轮检查提交作者与diff，而非推测这些修改来自评论。

- [916eb3594a](https://github.com/gmx-io/gmx-interface/commit/916eb3594a5ba0ec39a232f71127b4753cf378e7)在decrease acceptable price中先把中间USD值量化到gmsol，再按native price单位截断adjustment。
- [7ac6b41594](https://github.com/gmx-io/gmx-interface/commit/7ac6b41594d88b49981672416161cea40e79417a)补最小保证金±1 atom、部分平仓PnL先量化再结算、impact caps、EVM路径区分等回归。
- [1e4d3350bc](https://github.com/gmx-io/gmx-interface/commit/1e4d3350bc79f15f53fdc1d3ac8d9544c6e20a86)统一numeric/types/constants归属；不能仅凭标题把全部内容解释为风格偏好。

结合历史57要求，关键是单位、原生量化时点、符号/方向和运算顺序，不只是是否用了BigInt。金额边界验证采用能区分错误舍入的输入；独立reference的生成版本、时间和容差仍需核对，本轮未重算reference。Divhead为此新增大量定向测试，也说明不能把测试预算理解为不允许复杂金融回归。

## 证据链七：review建议会改变，关闭问题要覆盖原观察的全部行为

[50修正建议](https://github.com/gmx-io/gmx-interface/pull/3138#discussion_r4414811590)撤回通过Arbitrum keeper hook读取flags的建议，以避免其他EVM网络启动Arbitrum tracker。[撤回提前批准](https://github.com/gmx-io/gmx-interface/pull/3138#pullrequestreview-5783812883)进一步解释kill switch不能受fallback host、独立flag store、无timeout和缓存true影响。banner共享请求与签名前安全检查不能仅因endpoint相同就共用所有策略。

同PR多轮出现“读flags已修好，但hook和banner在Solana根本没有挂载”的现象。建议按“触发→请求→数据→挂载/消费→用户结果”核对原评论，不以文件改动或作者Done代替问题闭合。建议的修正保留替代关系，早期被撤回方案不进入当前规则。

## 证据链八：严格校验也需要理解合法边界

历史51要求null账户为零、RPC/解码错误不能伪装成零；[51空System-owned ATA](https://github.com/gmx-io/gmx-interface/pull/3195#discussion_r4492569684)证明合法预充租金形成的空System账户也应视为未初始化，而非拒绝整个余额读取。当前head已包含这个特判，并仍校验token program、mint、owner和layout。

因此不能归纳为“遇到错误就降级零”，也不能归纳为“非null都严格拒绝”。应根据真实协议状态区分有效空值与损坏/不可信数据。

## 证据链九：已经验证的修复被重新引入，是本轮最具体的学习缺口

[51过滤评论](https://github.com/gmx-io/gmx-interface/pull/3195#discussion_r4483348370)明确要求读取所有配置mint：`isSynthetic`在本项目表示从不作抵押品，WIF/BONK/PUMP等仍是真实钱包资产，且PUMP是覆盖Token-2022的重要输入。作者`ae69b848ca`移除过滤，reviewer在[11月6日总评](https://github.com/gmx-io/gmx-interface/pull/3195#pullrequestreview-5800286122)确认47个地址批量读取及真实资产显示。

但[2ad57a5c3b](https://github.com/gmx-io/gmx-interface/commit/2ad57a5c3bc21ced95528290c976ff757004cd8e)（11月9日）重新新增`GMSOL_BALANCE_TOKENS = GMSOL_TOKENS.filter(token => !token.isSynthetic)`，同时修改reader和wallet list。与`ae929a7a`比较确认这一变化，当前#3195 head `2495be234e`仍保留，WIF/PUMP等配置仍是isSynthetic。已读取的线程中未见对该范围收缩的新决定；不能由reviewer对旧head的确认推断当前head保持修复。

这与上游gmx-solana的Tokens段“keeps it out of pay tokens and balances”存在语境冲突：不可支付/不可抵押的标记不能直接推出整个钱包资产视图应隐藏。不能推定作者是因skill而重新加过滤；只能确认通用文字、具体review与当前实现不一致。下一步应由负责人/reviewer核对钱包资产范围及规范语境，本轮不修改其分支，不宣称已复现浏览器缺陷。

方案应保存这里的完整决策：抵押资格与钱包持有资格分开；后续改变token过滤、余额读取或wallet list时，检索这条经验，并用“钱包持有标记isSynthetic的真实token（含Token-2022）”作为有区分力的输入。相比泛泛写“遵守review意见”，这能实际防止回退到旧方案。

## 当前流程的具体缺口

1. 已有规范多覆盖原则，但没有把当前改动与上述具体失败模式建立稳定检索关系。继续扩写规范不自动改善召回。
2. review评论不是唯一经验来源：#3242的直接修复、#3197的结构调整、52当前availability实现都是重要材料。
3. thread resolved和outdated不能当作解决结论：3110已合并批准但30个thread仅18个resolved，3120已合并批准而25个均未resolved，3138同样10个未resolved。作者回复、reviewer确认、当前代码和运行证据需分开。
4. 当前产品与依赖在演进。#3242已合并、#3193已有新head，不能把旧分支“暂无消费者”的取舍永久化，也不能把当前head所有改动归到初次review。
5. 历史需求本身含条件和覆盖顺序：52的fixture有到期条件，19的technical scope明确优先于冲突的旧Design；当前部分Linear不可读，需保留证据新鲜度缺口，不能以历史快照静默覆盖。
6. 同类评论可能来自同一份继承代码。例如15和29都收到identity updater回归；不能只按两个PR出现就计作两次独立犯错，应追踪源提交与转入关系。本轮未完整还原两支的历史归因。
7. 需要保留已验证修复对应的行为，并检查后续相关修改是否撤销它。#3195的filter重新引入是具体样本；旧review结论不能跨head继承，通用规范遇到具体语义冲突时不能机械套用。

## 修订方案：先建立案例的判断链，再接入四个执行节点

以下均为提案，未改变现有AGENTS、交付skill或工作流命令。

### 经验的最小结构

按问题族整理，每条保留：适用场景、要保护的行为、为什么旧方案会错、当前可选实现及不适用情形、能区分错误的验证输入、来源/版本/最终处理、后续替代或失效条件。短例即可，不设必填表和评分。

来源区分：明确团队规范；多案例支持的项目倾向；具体版本实现；待商议方案。有效性区分：历史发生；作者声称已修；reviewer确认；本轮静态核对；本轮行为验证。thread状态仅作线索。不同维度不能压缩成一个“已解决”。

### 四个节点

| 节点 | Agent具体动作 | 只保留必要结果 |
| --- | --- | --- |
| 选方案 | 按组件/契约/状态owner检索相关案例；找已有实现；核对需求正文与后续决定 | 说明哪些已有能力复用，新增机制的真实消费者和必要性；产品歧义仍澄清 |
| 编码切片 | 追踪入口、数据与生命周期；碰到guard、cache、mapper、fallback新增时复核对应反例 | 以相关输入验证业务结果，不扩大无关检查 |
| 最终自审/交付 | gmx-prompts通用检查加当前案例；审最终组合、删除冗余、检查正文/历史与验证身份 | 未覆盖项如实保留；普通任务不多建证据包，不以通过测试宣称无bug |
| 处理review | 先理解原问题全链，核实最终建议，修复并核对相邻入口/调用方，提炼或修正原经验 | 同一根因合并记录；已在上游覆盖则补案例和可发现性，不再复制规则 |

### 建议落点与增量更新

- `docs/issues/`保留具体经历；建议的`docs/review-lessons.md`保存按场景检索的当前判断与精选案例；本调查保留取证和方案依据。上游规范继续以gmx-prompts为准，不在个人层复制全文。
- 优先接入现有`docs/coding-and-self-review.md`、交付skill和`docs/linear-development-workflow.md`，使旧需求分支从个人基础读取最新经验；不把个人知识带进业务PR。
- 当前任务发生相关review、关键依赖变更或最终交付时增量读取；不后台轮询，不每次全量扫描四人全部PR。初期人工语义整理优先，重复成本明确后再做只读采集/索引。
- 实现责任保持单Agent；作者/审查者不同角色可以作为顺序检查视角，不自动增加多Agent。

### 首批优先级与试用

先落六组可检索经验：共享接缝与删减；数据完整性/恢复；网络与状态生命周期；有效测试输入；金融单位及中间量化；review修复闭合与最终交付。每组用本轮已有正反例，先不追求全历史搬运。

用下一次用户选定的实际需求或已有PR修复试用，明确记录经验是否提前改变实现、是否拦住同类错误、是否减少无效diff。若仍漏报，先判断检索不到、条件错误、执行方法不足还是新契约，再修改原入口。评论条数、resolved比率、代码行数和测试总数均不作为品味分数。

## 尚未核验与后续选择

未完整恢复所有历史commit-before/after、未逐个审早期实验PR、未核对全部第三方库运行路径、未重做浏览器或金融reference验收；当前原迁移Linear可见性缺口未解除。以上不妨碍提出协作方案，但限制对“当次Agent为何漏报”及当前业务正确性的判断。本方案供用户审阅，后续实施另按用户选定范围推进。
