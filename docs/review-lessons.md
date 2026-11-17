# Review 经验与开发判断

2026-11-15 启用。本文是个人 Agent 协作的当前经验入口，服务 Kenny/Sulliven/Rainer 的 Solana 前端迁移；优先吸收四位作者 Kenny（`kenny-7100`）、Sulliven（`sulliven2700-lgtm`）、Rainer（`rainer-vivi`）、Divhead（`divhead`）的 PR、讨论、修复和直接提交。相关成员经验按组件与契约关联吸收。详细取证见[历史调查](review-learning-investigation-2026-11-15.md)，具体任务经历留在 [issue 记录](issues/README.md)。

本地经验补充判断条件和反例；通用编码、测试与自审规范仍从 [gmx-prompts 入口](coding-and-self-review.md#查阅入口)读取。这里的项目倾向不等于 reviewer 对所有场景的永久要求，历史源码不等于当前部署，文档记忆也不等于模型持续训练。

## 在工作中使用

1. **开始或恢复开发**：从当前需求、改动组件、调用方和状态 owner 选择下表相关条目；先读个人基础上的当前版本，再核对目标分支实际契约。按需以 `rg -n '关键词' docs/review-lessons.md docs/issues` 检索，无需遍历所有 PR。当前任务已有有效观察直接复用。
2. **选方案与编码**：先找现有接缝及真实消费者。新增或调整 filter、guard、mapper、cache、fallback、Hook 时，使用对应案例追踪入口→请求→转换→状态→UI/交易，确认保护的行为及会使旧实现出错的输入。重要取舍留在 issue；长任务用现有 note 的 `decisions`/`links` 指向条目，不新增表单。
3. **自审与交付**：按上游规范审最终组合 diff，重新检查相关历史修复是否被过滤、迁移或抽取撤销；删去无消费者的机制和无区分力的验证。交付目录仍做自身必要检查，旧目录结果不冒充新目标结果。
4. **处理 review**：读原评论、上下文、后续回复与直接修复提交，先确定最终要求和原问题全链，再修复、核对相邻调用方和 EVM 行为。在自然切片收尾主动更新对应 issue 与已有经验；可复用判断不必等用户提醒，也不必等 PR 合并才记录，但须保留确认边界。

## 按改动检索

| 改动或疑问 | 当前经验 |
| --- | --- |
| SDK/API、重复包装、ctx、fixture、无消费者字段、图标 | [RL-01 共享接缝与删减](#rl-01-共享接缝与删减) |
| 持仓、缺价格、disabled market、缓存、owner、空列表 | [RL-02 数据含义与完整性](#rl-02-数据含义与完整性) |
| 钱包余额、isSynthetic、collateral/pay token、Token-2022、ATA | [RL-03 资格条件属于具体用途](#rl-03-资格条件属于具体用途) |
| 网络开关、Provider、Hook、pending、promise、轮询、设置入口 | [RL-04 入口与状态生命周期](#rl-04-入口与状态生命周期) |
| guard、旧会话、测试输入、精度来源、构建保护 | [RL-05 验证必须能区分错误](#rl-05-验证必须能区分错误) |
| 价格、PnL、liquidation、BigInt、rounding、SDK/WASM | [RL-06 原生单位与计算顺序](#rl-06-原生单位与计算顺序) |
| review 修复、规范冲突、撤回建议、继承代码、最终 PR | [RL-07 最终取舍与修复闭合](#rl-07-最终取舍与修复闭合) |

## RL-01 共享接缝与删减

**项目倾向：** 新网络优先在既有数据流的正确边界适配。新增类、包装、状态、slot 或字段保留需要具体消费者与不能复用的理由；真实来源可用后撤去临时 fixture。删减的目标是减少维护面，不能只按行数判断，也不授权顺手全面重构。

**证据与应用：** [#3193 总评](https://github.com/gmx-io/gmx-interface/pull/3193#pullrequestreview-5789044554)要求清理 fixture、无人使用的机制及复制 mapper；[Divhead 的 #3197](https://github.com/gmx-io/gmx-interface/pull/3197)把 API 客户端纳入 SDK，[直接提交 4f62a4eacf](https://github.com/gmx-io/gmx-interface/commit/4f62a4eacfc0a18381c218488049de766b93dc58)将 ctx 类改为普通对象，并在真实 EVM 操作边界验证。图标扩展沿用[既有 SVG 命名机制](https://github.com/gmx-io/gmx-interface/pull/3201#discussion_r4483355252)。上述为历史 review/提交证据。

**反例与边界：** “当时无人读取”不是永久禁止。显示阶段删掉的订单 metadata 或 refetch，可能被后续 update/cancel 消费者需要。抽取或删除前检索当前调用方和字段流向，验证共享消费者仍收到所需数据；历史调查对 compose 字段的观察只是待核验线索，不是新增缺陷结论。

## RL-02 数据含义与完整性

**要保护的行为：** 资产仍存在时，缺价格、请求失败或市场禁止新开仓不能被表示为零资产。区分零、空、未知、部分、过期；首次失败和带缓存刷新失败应分别处理。保留缓存需核对 owner、来源和本次列表，不能跨钱包复用或无限沿用过期值。

**证据与应用：** #3193 的[缺价格隐藏持仓](https://github.com/gmx-io/gmx-interface/pull/3193#discussion_r4466217370)、[刷新错误态](https://github.com/gmx-io/gmx-interface/pull/3193#discussion_r4483646280)、[Sulliven 指出 disabled market 仍有仓位](https://github.com/gmx-io/gmx-interface/pull/3193#discussion_r4490450787)共同支持此判断。调查时静态读取的 snapshot 保留本次 API 仍列出但无法 compose 的旧项、标记 incomplete，缓存按 owner 隔离；这只是当时实现，未重新运行行为验证。

**有区分力的核验：** 按影响选择“持仓存在但缺一项价格”“已有仓位的市场 disabled”“刷新失败后恢复”“切换 owner”。追踪原始列表、compose、selector、计数、展示与可操作性，不能只断言数组非空。新鲜度/禁止操作策略须按当前契约决定，历史缓存做法不能自动推广。

**真实消费者反例（2026-11-16）：** [TRD-70 本地联调](issues/FESOL-19.md#trd-136-真实钱包联调发现的余额接线修复2026-11-16)中余额 Hook 成功但共享 TokensData 未合并 balance/walletBalance，TradeBox按未知余额显示不足。核验必须走到共享验证/展示消费者及 loaded flags；合并时按当前 owner/network，未知与错误保留 undefined，合法0保持0，并验证 funded→切换/错误→zero，不能用一次 RPC 成功代替业务接线验收。

**验收保护补充（2026-11-17）：** 同一余额接线修复在本地类型/行为测试通过后，远端零warning lint仍因import顺序及回归用例的JSX临时对象失败。相关修复/接缝除行为验证外须运行既有适用lint；测试文件同样受规则约束，不能以“只改测试”跳过。该次最小清理保留funded→undefined→zero断言及owner/network余额清除语义，不删除测试或放宽规则消除失败。

**隐藏消费者重新启用（2026-11-16）：** [GMTrade #1096 / FESOL-115](issues/FESOL-115.md)恢复 FEES 列时，旧 formatter 将接口 null 显示为 `$0.00`。已有函数也须按新启用场景核对未知、不适用与真实零的显示契约；区分旧逻辑存在与本次首次暴露。移除提现 PDA 聚合则应核实当前接口 owner 已是钱包，不能用旧注释推定回归。

## RL-03 资格条件属于具体用途

**要保护的行为：** 钱包能持有某 mint，与它可作抵押或 pay token 是不同资格。`isSynthetic` 等标签不能未经消费者语义核对就复用于余额过滤；读取后的展示筛选也需要单独确认。ATA 的合法零余额与损坏数据要区分，不能全部吞成零。

**证据与回归风险：** [#3195 评论](https://github.com/gmx-io/gmx-interface/pull/3195#discussion_r4483348370)明确指出当时 WIF/BONK/PUMP 等真实资产仍能持有，PUMP 涉及 Token-2022；修复 `ae69b848ca` 后有 [11 月 6 日 reviewer 确认](https://github.com/gmx-io/gmx-interface/pull/3195#pullrequestreview-5800286122)。[11 月 9 日提交](https://github.com/gmx-io/gmx-interface/commit/2ad57a5c3bc21ced95528290c976ff757004cd8e)又引入 `!token.isSynthetic`，调查读取的 head `2495be234e` 仍有该过滤。不能推断作者动机，也未在本轮运行余额复现。另见[预充值、system-owned 空 ATA](https://github.com/gmx-io/gmx-interface/pull/3195#discussion_r4492569684)的合法状态判断。

**适用条件与冲突：** 当时上游 Solana Tokens 规范“排除 pay tokens 和 balances”的表述，与具体钱包资产 review 存在语义冲突。遇到相同情形先说明具体视图/消费者和冲突证据，核实当前最终约定；未明确时澄清，不机械复制任一过滤，也不自行改上游规范。历史 token 数量不是长期常量。

**有区分力的核验：** 选当前配置里“能持有但不能作抵押”的真实 mint，沿配置→reader→mapper→钱包列表检查，并按影响覆盖 Token/Token-2022、合法空 ATA 与 malformed 数据。必须确保输入确实到达被测分支。当前条目用于预防与核验，不授权修改 #3195。

**2026-11-17 接续：** 最新 #3190 `9896a85fbc` / #3195 `666fa1669a` 已恢复配置 mint 全量 reader/list；本地交易线接续该正式候选并撤掉旧 GMSOL_BALANCE_TOKENS 过滤，未修改他人原 PR。当前代码已有 WSOL/WGMX 图标，旧“缺图标需回退”不再适用；需以目标版本实际资源核对，不能永久保留历史兼容。

## RL-04 入口与状态生命周期

**项目判断：** UI 可见性、请求启停、业务状态归属及在途任务存活分别决定。隐藏入口不等于关闭所有入口；CSS 隐藏或丢弃 Hook 返回值仍可能请求。暂停新读取不应无条件销毁在途交易 watcher，关闭整页也可能误伤网络中立设置。

**GMTrade pending 退出入口（2026-11-16）：** Sulliven 的 [旧前端 #1095](https://github.com/gmsol-labs/gmx-solana-interface/pull/1095) 将价格不可用与关联市价单 pending 拆为独立条件：两者都锁定一般操作，但仅价格不可用禁用 Close，且表格/卡片保持一致。不要把所有状态合成整行 `pointer-events-none` 而误封退出入口；遍历订单时也不要让后遇到的普通订单覆盖先前发现的 pending。核验正常/pending/价格不可用/两者同时存在，逐一检查 Close、编辑抵押、TP/SL 与大小屏。此为旧项目前端设计证据，不自动作为新 GMX 产品规则，也不证明 Keeper 执行或交易已通过；[本次调查与证据边界](gmtrade-eur-pending-investigation.md#后续修复pr-1095)。

同 PR 的 CR 补充：`pointer-events-none` 只阻断指针命中，原生 button 仍可经 Tab + Enter/Space 激活。业务禁用条件须传到 Button 的 `disabled` 或 handler guard；父级置灰不能替代语义禁用。不要把“弹窗可打开”的代码证据扩大为“交易最终校验可绕过”。

**证据：** #3120 的[dropdown 外仍有铅笔入口](https://github.com/gmx-io/gmx-interface/pull/3120#discussion_r4336793693)、[设置页与 Hook](https://github.com/gmx-io/gmx-interface/pull/3120#discussion_r4336793730)，#3110 的[未使用结果仍启动 RPC](https://github.com/gmx-io/gmx-interface/pull/3110#discussion_r4358191016)。#3193 先修 [pending 状态归属](https://github.com/gmx-io/gmx-interface/pull/3193#discussion_r4466217380)，又修[旧 promise 引用已卸载 poller 回调](https://github.com/gmx-io/gmx-interface/pull/3193#discussion_r4469286763)。这些是历史 review，不证明当前所有分支已通过。

**有区分力的核验：** 对受影响部分列明入口、请求、state owner、异步回调和销毁时机；按需验证 flag off/on、刷新/站内切换、单链/双钱包、在途成功/失败/超时与卸载。不要把所有组合变成每个任务的固定门禁。历史切片延期不等于永久免做，后续范围以当前 Linear 与最终决定为准。

**2026-11-17 中央 RPC 接续：** #3190 新 registry 仅管理 Solana 选择事件及 lazy init；EVM 的 start/stop 属于 RpcTrackersRegistry.syncTracking，不能因 registerRpcTracker 不再自动启动 EVM 就重复添加 owner。接续中央实现时应撤掉已被替代的本地 hook，同时核验当前 tab/flag、切换后延迟初始化、清理和 EVM 切回；保留仍在使用的 watcher，而非按名称批量删 tracking。

## RL-05 验证必须能区分错误

**要保护的判断：** 通过的测试要能说明目标行为。先问“旧实现或缺少该 guard 时，这个输入是否仍通过？”对关键保护可定向做反例验证，不要求普遍 mutation testing，不以 mock 调用次数或样例数量代替业务结果。

**证据：** [#3201 guard 缺失仍通过](https://github.com/gmx-io/gmx-interface/pull/3201#discussion_r4483355273)；[#3110 旧会话没有 picked 记录](https://github.com/gmx-io/gmx-interface/pull/3110#discussion_r4324738579)，新 preview 会话无法覆盖；[#3138 NEAR 两链精度不同](https://github.com/gmx-io/gmx-interface/pull/3138#discussion_r4375833519)，可区分精度来源。#3068 的 [worker 入口](https://github.com/gmx-io/gmx-interface/pull/3068#discussion_r4259921377)与 [bootstrap 缺失](https://github.com/gmx-io/gmx-interface/pull/3068#discussion_r4259921402)说明保护工具也要有失败反例。

**应用与边界：** 选择有差异的真实配置、恢复状态、精度或账户类型，再断言可观察结果。历史 FESOL-42 用 MegaETH→Phantom 区别 settlement 行为，这是当时验收条件，不是永久指定网络。生命周期问题注意实际生产构建与 StrictMode 差别；仍按上游测试准入和当前授权选择必要验证，不为简单改动镜像实现写测试。

**2026-11-17 结果复用自审：** 核对测试配置应读取实际入口（本项目 Vitest 使用 vite.config.ts），不能把两边同名文件均不存在当作 identity。源码相同不保证发现范围、alias/project 路径或构建配置相同；记录已知差异，并让交付目录执行必要的实际检查，不把其他目录结果改写成自己执行。

## RL-06 原生单位与计算顺序

**要保护的行为：** BigInt 只保证整数表示，不能证明与协议的量化、舍入顺序或单位一致。金融计算先标明输入/中间量/输出单位、舍入方向、执行顺序及固定参考版本，再验证边界；不能一律到最后才截断。

**证据：** Divhead 的[直接提交 916eb3594a](https://github.com/gmx-io/gmx-interface/commit/916eb3594a5ba0ec39a232f71127b4753cf378e7)调整中间 USD 量化与原生价格截断；[7ac6b41594](https://github.com/gmx-io/gmx-interface/commit/7ac6b41594d88b49981672416161cea40e79417a)处理原子单位边界、部分 PnL、impact cap 并区分 EVM；[1e4d3350bc](https://github.com/gmx-io/gmx-interface/commit/1e4d3350bc79f15f53fdc1d3ac8d9544c6e20a86)整理数值与类型组织。它们是历史修复证据，不能直接证明当前部署兼容。

**有区分力的核验：** 按改动选择 ±1 atom、正负 PnL、阈值两侧、不同精度、partial close 等输入，对照锁定版本的链上/原生 reference；保留受影响的 EVM 对照。不能把某公式的具体舍入方向推广到全部协议，源码测试也不能冒充真实 SDK/WASM 或链上验收。

## RL-07 最终取舍与修复闭合

**执行判断：** review 意见会演进，先核实最终要求与理由，不能只记第一条评论。修复要覆盖原始问题全链，并确认没有破坏共享调用方；后续相关修改还要保留已确认行为。最终 PR 的差异、依赖、历史和正文应对应真实交付目标。

**证据：** #3138 [keeper Hook 建议撤回](https://github.com/gmx-io/gmx-interface/pull/3138#discussion_r4414811590)，[安全 kill switch 撤回早期批准](https://github.com/gmx-io/gmx-interface/pull/3138#pullrequestreview-5783812883)：同一 endpoint 的 banner 与签名前检查可能需要不同 timeout、fallback 和 stale 策略。#3201 [共享 setter 修复后 EVM 回归](https://github.com/gmx-io/gmx-interface/pull/3201#discussion_r4519631690)说明不能只测 Solana guard。RL-03 的过滤重引入则要求复核后续 diff。

**核验边界：** resolved/outdated、空 approve、作者回复“fixed”、最终合并均不是当前行为通过证明。#3201/#3223 的相同反馈可能来自继承代码，不能直接计作两次独立犯错。不要因此自动 squash/rebase/强推，也不擅自发评论、请求 reviewer 或合并。

本轮应用：[四PR复审](solana-trading-dependencies.md#基于-review-经验的四-pr-复审2026-11-15)发现个人知识与PR描述已更新，但随产品交付的README仍保留旧体积限制。修复闭合应检查实际消费者及公开技术说明，历史证据标明原版本/日期，避免将已解决的问题继续列为当前阻碍；不能只检查开发分支或个人文档。

2026-11-17 在 #3201 应用：旧前置 Provider/fixture 可能在 merge 中无冲突地保留；解决冲突文件还不够，应对最终 release diff 按归属逐项核验，清除已被上游替代的残留。仅保留 11 个需求文件，另以真实 Hook/SWR 的有效反例验证 listing null key；细节见 [TRD-63 接续](issues/FESOL-15.md#上游冲突处理2026-11-17)。

2026-11-17 playground/#3288：fork组件测试的Pages/comment 403应在权限步骤按same-repository条件处理，保留测试、artifact及测试失败门禁；不要把整项workflow跳过或改成忽略失败。本轮修复后远端组件workflow成功。部署SDK验证需读取entry实际引用的hash路径并核对WASM摘要；SPA对不存在路径也可能返回HTML200，单独HTTP状态不能证明产物存在。见[TRD-136持续实验分支](issues/TRD-136.md#持续实验分支交付2026-11-17)。

2026-11-17 在 #3201 验收补齐：金融数据页面对照先区分 selector 按 index 聚合与 header 按选中池展示，并记录 API/价格采集时间；实际 OI/volume 变化不能当成计算回归。真实响应经过生产 parser/compose/格式化路径能验证技术一致性，不能代替金融语义批准或独立链上 reference。PR描述编辑也可能触发edited CI，终态报告需区分已完成检查与同head的新任务。CI 公共接口超时须保留首次失败和重跑结果，本地重跑通过不能写成远端全绿；[本次证据](issues/FESOL-15.md#自动验收补齐2026-11-17)。

## 日常增量维护

2026-11-17 #3201补充：不能把“未获reviewer最终批准”推导成“缺少产品选择”。先读reviewer原话并核对既有合并规则：Divhead明确解释GMX公式较旧版低且要求写字段表；表已补后应收敛为普通review验收。旧前端还同时保留不同selector/helper，追当前消费者再找后端公式，避免用同名helper或数值巧合解释历史行为。[证据与对先前阻塞判断的修正](issues/FESOL-15.md#ac2-口径调查结论2026-11-17)。

以下信号触发 Agent 主动判断是否更新：新 review/作者回复/reviewer 直接提交；用户纠正；自审发现；调试确认的根因；与既有规则冲突；后续修改撤销历史修复；新消费者使旧结论失效。发现依赖查询或收到信号，没有后台监听，不承诺实时吸收所有 PR。

- **先落事实，再提炼。** 具体经历进原 issue，记录原问题、最终取舍、实际处理和验证边界。跨任务可复用时更新本页对应 RL 条目；新问题族才新增稳定编号，索引补组件/符号关键词。一次猜测只作待确认线索，不能升为团队偏好。
- **保留最小判断链。** 写适用场景、保护行为、错误原因、反例输入、来源/版本及失效条件即可，不要求长模板。标清明确规范、案例支持的倾向、版本事实或待议提案；另标历史发生、作者声称修复、reviewer 确认、静态读取或实际行为验证，不混为一个“已解决”。
- **已有规则覆盖时修入口。** 补充案例、检索词或适用条件，不复制上游全文。建议撤回/契约更新时修改原条目，旧结论保留日期和被替代缘由；代码已自动保护、上游已吸收时撤掉无效人工步骤，保留必要证据索引。
- **再次发生时定位失效环节。** 是未检索到、条件误用、反例无区分力、未审最终组合，还是新契约？修正同一条目与入口；同源继承问题先追提交，避免重复归因。不能只再加一篇复盘。
- **自然节点收尾。** issue 链接通用条目，note 只保留当前取舍与链接；按[知识收尾](documentation-maintenance.md#沉淀收尾与自动推送)检查、提交、必要回流并推送个人基础。旧任务通过基础目录读最新经验，不整支合入个人基础或把知识带入业务 PR。

## 如何观察效果

下一次相关开发或 review 修复，在原 issue 简记经验是否提前改变方案、选中了有效反例、保护了旧行为；没有影响或仍漏掉时写具体原因并改入口，无需为每项写“已阅读”。不按评论数、resolved 比例、代码行数或测试数打分，也不增加品味门禁。

启用时仅做文档路径演练：余额过滤可定位 RL-03→RL-05→规范冲突；Provider 切网可定位 RL-04→RL-02；review 修复与跨会话恢复可定位 RL-07→日常维护→个人基础入口。这验证检索与维护路径，不是业务运行验证；实际收益仍需后续真实任务检验。
