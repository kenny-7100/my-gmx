# Review 经验与开发判断

## 前端安全报告按完整影响链筛选（2026-11-28）

已还原 11 个 Immunefi 编号关联的前端修复，结合公开条款形成[筛选标准](gmx-frontend-security-triage.md)与[案例证据](gmx-frontend-security-cases-2026-11.md)。优先追踪用户意图→表单/异步估算→签名/转账→合约结果的一致性；无攻击者的界面逻辑财务损失也在 GMX 范围内。真实 bug、工程确认、已合并、已上线、赏金接纳/支付分开判断，特别保留 PRO-4596“参数错已复现，但报告交易/损失与重复尚未确认”的反例。候选可利用细节先私下交 Kenny→Zeke/Orion，不进入自动推送的普通 issue/docs。

公开 review 的防回归判断：[#3136 保留用户已选 limits](https://github.com/gmx-io/gmx-interface/pull/3136#discussion_r4666974113)不能在 Re-sign 时换成更宽默认值；[#3209 旧合约撤销历史](https://github.com/gmx-io/gmx-interface/pull/3209#discussion_r4680014558)不能只认新 counter，最终已补旧 action-limit 痕迹；[#3292 quote 刷新](https://github.com/gmx-io/gmx-interface/pull/3292#discussion_r4615490315)按影响交易的语义判断失效，不能用整个对象 identity 取消等价签名。以上为已读讨论及最终修复，不代表本次重跑测试或当前生产复测。

**URL 参数不得直接成为交易触发器（2026-11-28，origin/master 只读审查）：** `src/domain/synthetics/orders/useSetOrdersAutoCancelByQueryParams.ts` 在读取非空 `setOrdersAutoCancel` 后，会等待订单数据和 signer，然后直接调用 `setAutoCancelOrdersTxn`，批量把现有 TP/SL 订单编码为 `autoCancel: true`；它没有页面内显式确认步骤，且在调用后立即删除 URL 参数。当前代码仍需要用户在钱包中批准，尚未证明可无交互广播或必然造成资金损失，因此记录为待验证安全候选，不作已确认赏金漏洞。后续审查 URL/deep link 时，应区分“预填页面状态”和“启动签名/交易”；后者必须有明确用户动作、当前状态复核、订单/费用摘要和错误终态处理。验证应覆盖已连接钱包打开链接、订单刷新/钱包切换、重复渲染及拒签/失败路径。代码基线为 `origin/master` `2aa7dd524088c41eb706de060133b23a8a12ad77`，未启动浏览器、钱包或交易。

## RPC探活不等于成交证据方法可用（2026-11-24）

3337真实DOGE市价单回执重放正常，线上代理却允许getSlot、拒绝getTransaction/getSignaturesForAddress/getBlock，导致已成交但toast未确认。RPC接入或切代理后，按真实消费者验证每个方法/参数/响应字段及对应路由；mock suite、探活成功、仓位API可读都不能替代。永久method/权限拒绝须与索引延迟分开诊断，不能静默重试到超时，也不以仓位出现代替同一订单成交证据。见[取证与范围](solana-trading-dependencies.md#市价单已成交但通知未确认的线上定位2026-11-24)。

2026-11-25补充：allowlist PR合并不等于Worker已上线。核对合并后push部署job、环境pending approval及线上X-Worker-Version；本例private#5合并后部署仍待审批，线上版本对应11-20成功发布。前端Pages更新不能替代独立Worker部署。见[发布复定位](solana-trading-dependencies.md#allowlist-已合并但发布待审批的复定位2026-11-25)。

## 订单终态不等于账户已关闭（2026-11-24）

3337复审核对TRD-78、gmx-api与固定程序：keeper执行成功但关闭失败时，completed/cancelled账户仍可能持有escrow/rent，owner close负责补建ATA并完成归还。update的pending限制不能不加区分地复用于close/cancel；mapper/按钮即使正确拒绝“修改已成交订单”，也须保留协议支持的终态账户清理入口。检查API筛选→compose→操作guard→builder，而非把终态视为可直接从列表丢弃。既有过滤与本次新加守卫分别归因，静态契约证明与真实链上验收区分。见[复审证据](solana-trading-dependencies.md#最新head复审2026-11-24-晚间)。

## 跨网络共用表单须核对validation消费点（2026-11-24）

#3337审查确认：新增Solana分支虽然已门控allowance/Express/approval，PositionSeller和OrderEditor仍无条件消费只基于wagmi/Privy ethereum会话的多扩展网络冲突错误。独立Solana session不会自动清除EVM会话，因此可错误阻断Solana操作。共享表单迁移须同时追踪button state、validation汇总和submit guard；只改按钮会留下提交阻断。可用真实helper转译及受控双会话输入证明分支，但与真实钱包runtime验收分开记录。见[具体发现及验证边界](solana-trading-dependencies.md#gmx-prompts审查33372026-11-24)。 最新head `3435c1fe75`已在共享helper按Solana网络豁免并保留EVM保护，本轮两例通过；此条继续用于防回归，不再表示当前缺陷未修复。

## 重建签名与GitHub身份关联（2026-11-24）

保留原author，以实际重建者作为committer并使用匹配的签名key。不能照抄他人committer再用自己的key签名。3337三条原Verified提交重建后本地GPG=G、GitHub却unknown_key，说明密码学有效性不等于托管平台身份验证；交付须另核验GitHub verification。父节点变化后原签名不能复制复用。见[调查记录](solana-trading-dependencies.md#重建提交github签名身份问题2026-11-24)。

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
| SDK/API、重复包装、ctx、fixture、无消费者字段、图标、集成验收与正式 PR 复用 | [RL-01 共享接缝与删减](#rl-01-共享接缝与删减) |
| 持仓、缺价格、disabled market、缓存、owner、空列表 | [RL-02 数据含义与完整性](#rl-02-数据含义与完整性) |
| 钱包余额、isSynthetic、collateral/pay token、Token-2022、ATA | [RL-03 资格条件属于具体用途](#rl-03-资格条件属于具体用途) |
| 网络开关、Provider、Hook、pending、promise、轮询、设置入口 | [RL-04 入口与状态生命周期](#rl-04-入口与状态生命周期) |
| guard、旧会话、测试输入、精度来源、构建保护 | [RL-05 验证必须能区分错误](#rl-05-验证必须能区分错误) |
| 价格、PnL、liquidation、BigInt、rounding、SDK/WASM | [RL-06 原生单位与计算顺序](#rl-06-原生单位与计算顺序) |
| review 修复、规范冲突、撤回建议、继承代码、最终 PR | [RL-07 最终取舍与修复闭合](#rl-07-最终取舍与修复闭合) |

## RL-01 共享接缝与删减

**按完整需求评价就绪（2026-11-24）：** refining 不能把 TRD-151 的聊天按钮、TRD-110 的 wrap 或 TRD-116 的列表切片当作整条需求 ready。按消费者追踪网络身份与真实能力：Solana provider 保留 EVM `globals.chainId`，共享 Hook 若用该值选 SDK，页面显示 Solana 不代表查询已走 Solana；`isSameAddress` 已支持 base58，避免重复修已解决问题。API merged、生产可请求、历史覆盖完整各自取证；本轮 rates 查询成功但30d只有126小时点。旧项目 SQD rebate 已合并也不证明新框架可直接调用或已部署。具体版本与可复核路径见 [refining 调研](solana-refining-priorities-2026-11-24.md)。

**设计代码的正式成果承接（2026-11-24）：** Unification 的 Pasha 已为 Earn、GT/Stake、Referrals 提供正式 UI PR 与独立 Do not merge Tester。前端先核对并复用已有组件、交互、校验和计算，沿数据 Hook 与确认处理判断剩余范围；UI 类型不等于可用 API，空 Hook 不证明后端未实现，toast 不证明真实交易。产品/体验认可与技术 review、合入、真实功能验收分开报告；正式组合须核对共享路由、菜单、跨页链接和 EVM 消费者。协作方式见[交接入口](agent-collaboration.md#unification-的-ui-与前端协作)，固定版本证据见 [DES-88](issues/DES-88.md)、[DES-89](issues/DES-89.md)、[DES-90](issues/DES-90.md)。不重复实现设计师成果，也不擅自修改其开发线。

**项目倾向：** 新网络优先在既有数据流的正确边界适配。新增类、包装、状态、slot 或字段保留需要具体消费者与不能复用的理由；真实来源可用后撤去临时 fixture。删减的目标是减少维护面，不能只按行数判断，也不授权顺手全面重构。

**证据与应用：** [#3193 总评](https://github.com/gmx-io/gmx-interface/pull/3193#pullrequestreview-5789044554)要求清理 fixture、无人使用的机制及复制 mapper；[Divhead 的 #3197](https://github.com/gmx-io/gmx-interface/pull/3197)把 API 客户端纳入 SDK，[直接提交 4f62a4eacf](https://github.com/gmx-io/gmx-interface/commit/4f62a4eacfc0a18381c218488049de766b93dc58)将 ctx 类改为普通对象，并在真实 EVM 操作边界验证。图标扩展沿用[既有 SVG 命名机制](https://github.com/gmx-io/gmx-interface/pull/3201#discussion_r4483355252)。上述为历史 review/提交证据。

**反例与边界：** “当时无人读取”不是永久禁止。显示阶段删掉的订单 metadata 或 refetch，可能被后续 update/cancel 消费者需要。抽取或删除前检索当前调用方和字段流向，验证共享消费者仍收到所需数据；历史调查对 compose 字段的观察只是待核验线索，不是新增缺陷结论。

**集成验收的正式成果承接（2026-11-18，用户纠正）：** [TRD-136 平仓核查](issues/TRD-84.md#按正式-pr-路径复核2026-11-18)中，MarketDecrease 底层和未签名模拟已可用，但共享 PositionSeller 尚未接通。最初以“底层具备条件”推荐独立补最小接线，遗漏了该能力由 Sulliven 的 TRD-84 承接、可能与未公开工作重复的约束。用户明确优先依赖已有 PR，避免为本地闭环构建随后废弃的路径。今后选方案同时判断技术可行性、已有正式成果的覆盖范围及新增修改的交付归属；复用 builder/Hook 不足以证明没有重复实现。先核对目标 PR 的真实消费者、源码和开发线；集成缺口修回所属需求，验收分支只组合成果。查不到 PR 不等于负责人没有实现，也不自动成为接管或新开开发线的依据。本次按用户“无 PR 则暂时停止”暂停；不将这一条件推广为所有任务必须等待 PR 的规则。

2026-11-19 TRD-136 本轮授权进一步明确：已有 PR 的能力无论 PR 状态均采用最新候选，先合入正式成果，只保留当前候选确实未提供的接缝/资源条件。核对源码和来源 ancestry，不能只看 merged/Done，也不能因合并完成就删除正式候选尚未覆盖的 tokenInfo 接线或切回不可信 LUT；本轮实施与三项剩余支持见 [TRD-136](issues/TRD-136.md)。该授权用于本轮集成，不扩大为任意任务自动合并所有开放 PR。

2026-11-20 接续：release #3325 已提供核验过的冻结 LUT，#3294 已提供正式 Pay tokenInfo，因此本轮撤去空 LUT override 与临时 Pay 接线，改用正式来源；保留尚无正式覆盖的 close receive 接缝。独立重建的交付历史合并上游路径迁移时，还需核对旧 hook/test 是否与 canonical 路径并存，删除失效旧路径并验证开发/交付业务 tree 一致；不能仅以 Git 无冲突判断迁移完成。见[实施证据](solana-trading-dependencies.md#五需求上游接续实施2026-11-20)。

2026-11-23 接续：统一交易PR #3337现已提供close receive helper和tokenInfo，TRD-136/playground接续后删除独立selector分支，保留正式Receive行为并将后续交易来源改为3337。旧PR提交作为3337祖先自然保留；用核心文件blob一致和source ancestry确认替代完成，不能仅改README或为“去掉旧依赖”重写全部历史。见[接续记录](issues/TRD-136.md#改用统一交易pr并更新playground2026-11-23)。

2026-11-23 用户授权的历史清理：PR Commits按祖先SHA判断，不代表相同数量的独立业务改动。#3195旧head与release最终head完整tree一致，旧147祖先仍会重复显示；确认后可将已吸收依赖的parent边界接到正式release版本，保留业务拆分、逐提交tree/message及适用merge，重签受影响提交，并核验最终tree不变。必须备份原head、按旧SHA绑定lease更新，连同实际下游映射；新旧历史普通merge会重新引入冗余祖先。不能将所有其他作者/master改动一并当作squash噪音删除；本次授权不推广为默认历史重写权限。见[清理证据](solana-trading-dependencies.md#已吸收依赖历史清理2026-11-23)。

2026-11-23 第二阶段：代码被release吸收不仅来自squash，也可能来自补签/交付重建或选择性适配。清理应以当前release为代码基础、删除被覆盖后变空的迁移提交；混合文件保留真实消费者适配，例如orderInfo.solana，reader/type结构复用release。业务拆分/message/适用merge保留，中间tree会有意更新为release实现，不能同时宣称逐提交旧tree不变；必须核对最终完整tree和release diff一致，映射/签名/必要适配真实存在。最终与release无差异的文件，不应在剩余PR历史里再次引入旧实现再撤销。未吸收master范围独立保留。见[实施记录](solana-trading-dependencies.md#release已吸收实现与重复适配历史清理2026-11-23)。

2026-11-24 重复补丁去重：相同patch-id出现在不同父链时，不能直接删除副本。可把一份原补丁以独立commit放在各副本父节点的共同祖先后，让分叉共同继承；保留后续演进，仅对尚未有补丁的源快照投影。须核对共享commit本身patch-id不变、最终tree/diff一致，以及来源merge/下游映射；有相同tree的merge不因此自动删除。此为本次授权历史整理，不推广为默认扁平化/squash。见[实施证据](solana-trading-dependencies.md#四交易分支重复补丁共享化2026-11-24)。

**Playground 的实验配置一致性（2026-11-18，用户明确）：** playground 本身允许实验能力，应复现 TRD-136 本地验收路径，不能把“常规生产构建”当作必须保留不同 LUT 配置的理由。可共享本地启动/模拟/预览构建的明确配置入口；公开 API/RPC 与本地服务仍按实际环境区分，不宣称数据源完全相同。配置差异必须随产物验证，既有大小/模拟/签名前保护保留，未签名模拟不代替真实下单。历史上此次通过 `build-playground` 与共享无 LUT 模块修正入口（2026-11-20 已由正式冻结 LUT 配置接替），不把实验选择混入普通 `build-app`。

**Playground RPC 构建覆盖（2026-11-21）：** [TRD-136 环境变量改造](issues/TRD-136.md#playground-alchemy-环境变量配置2026-11-21)中主 bundle 替换通过仍不代表独立 Worker 生效；multicall Worker 单独编译并导入中央 RPC。专用转换须同时覆盖 Worker、保留其原 isolation 插件，并扫描最终 JS 与 source map，不能只检查主 transform 的返回值。前端 key 会进入公开产物；2026-11-21 用户随后明确要求 playground 环境文件随分支提交，现按 tracked `.env.playground.local` 执行，不再沿用此前的 gitignore 方案。缺配置明确阻断，不回退失效 key。 2026-11-22 官方RPC从Alchemy assignment迁移到GMX proxy后，旧transform必须显式失配，不能静默构建成忽略用户配置的产物；在原TRD-136线适配当前共享provider入口，覆盖app/Worker及HTTP/WS、各链、开发/生产用途矩阵，普通app继续走官方proxy。用户要求不查看key时，使用临时假配置验证转换契约，部署仍使用原样保留的用户文件，不读取或输出真实值。


**Solana 共享币种组件接缝（2026-11-18，实际页面复现）：** 集成 [TRD-84 #3293](issues/TRD-84.md) 后，平仓按钮已不再等待 EVM allowance，但接收行仍为空。TokenSelector 未传 tokenInfo 时回查 EVM getToken，未知 Solana mint 会直接返回 null；接收列表仍查 EVM reachable graph。修复应向既有组件传真实 token metadata，selector 只列正式 builder 支持的抵押币及 WSOL 对应 native SOL，保留 EVM 原路由；不要扩容 EVM 静态币种表或伪造 swap route。按钮可用、builder 模拟通过不足以证明表单完整，必须走到币种名称、金额、选择列表这些实际消费者。 后续接入TRD-142时，同类路径在TradeBox/MarginField再次出现，向调用方传真实fromToken；因此检查应覆盖所有由MultichainTokenSelector切换回TokenSelector的可达分支，不能只修当次弹窗。

**Pools 共享页面的网络接缝（2026-11-27，TRD-116 原生页面复现）：** 列表数据 adapter 正确仍可能在 GmAssetDropdown 的 `getIcon(-501, "network")` 崩溃；网络图标使用既有 `getChainIcon(networkId)`，header 的链身份也必须取 networkId，不能继续显示兼容保留的 Arbitrum chainId。`selectTokensData` 只有价格，表单需沿实际 Solana wallet balance hook 组合余额，查询失败保持 unknown。同币抵押池（如 USDC/USDC）不能把一个可见输入同时赋给 long/short 金额。以上静态检查和单测不足以代替桌面/移动页面及真实交易验收，具体版本与边界见 [TRD-116 检查点](issues/TRD-116.md#交易提交与页面接通检查点2026-11-27)。

## RL-02 数据含义与完整性

**要保护的行为：** 资产仍存在时，缺价格、请求失败或市场禁止新开仓不能被表示为零资产。区分零、空、未知、部分、过期；首次失败和带缓存刷新失败应分别处理。保留缓存需核对 owner、来源和本次列表，不能跨钱包复用或无限沿用过期值。

**证据与应用：** #3193 的[缺价格隐藏持仓](https://github.com/gmx-io/gmx-interface/pull/3193#discussion_r4466217370)、[刷新错误态](https://github.com/gmx-io/gmx-interface/pull/3193#discussion_r4483646280)、[Sulliven 指出 disabled market 仍有仓位](https://github.com/gmx-io/gmx-interface/pull/3193#discussion_r4490450787)共同支持此判断。调查时静态读取的 snapshot 保留本次 API 仍列出但无法 compose 的旧项、标记 incomplete，缓存按 owner 隔离；这只是当时实现，未重新运行行为验证。

**同步等待与请求失败需分开（2026-11-19，诊断复现）：** [TRD-136 仓位警告闪现](issues/TRD-136.md#开仓后仓位刷新警告闪现定位2026-11-19)中，提高交易确认 slot floor 后、API尚未返回时，账户 Hook 就将 pending 转为 error，导致即使接口成功也短暂显示刷新失败。验收需覆盖“延迟后成功”的在途渲染，而不只验证 await 后终态。修正提示语义时仍须保留 floor、旧快照拒绝、真实失败/超时提示及交易禁用，不能用隐藏警告解除数据保护。随后实施以独立 isSyncing 传递等待状态，主动 mutate 的失败另由 slot tracker 保存并在成功快照后清除；仅删除 pending error 不足以保留失败提示，且不能只改列表而遗漏 TradeBox 的等待保护。实现与接续见[修复记录](issues/TRD-136.md#开仓后同步警告修复交付2026-11-19)。

**有区分力的核验：** 按影响选择“持仓存在但缺一项价格”“已有仓位的市场 disabled”“刷新失败后恢复”“切换 owner”。追踪原始列表、compose、selector、计数、展示与可操作性，不能只断言数组非空。新鲜度/禁止操作策略须按当前契约决定，历史缓存做法不能自动推广。

2026-11-27 TRD-116：SDK/WASM要按固定binding核实所有权和输入契约。MarketGraph必须先插入market再更新token price；虚拟库存参与LP价格影响时须读取正式RPC账户，不能关闭该影响来让preview通过。`insert_glv(model)`借用/复制，调用方free；`CreateGlvWithdrawalsBuilder.build_with_options()`通过`__destroy_into_raw`消耗builder，调用方再free会抛null pointer。估值和预览每次独立模拟器，避免模拟变更累积。历史价格fixture须固定JS Date到参考时间；GLV按poolValue*balance/supply估值，与先截断whole GM price再乘余额的差异须按原子余额推导界限，不能随意放宽容差。详见[TRD-116](issues/TRD-116.md#glv-与流动性预览实施切片2026-11-27)。

**真实消费者反例（2026-11-16）：** [TRD-70 本地联调](issues/FESOL-19.md#trd-136-真实钱包联调发现的余额接线修复2026-11-16)中余额 Hook 成功但共享 TokensData 未合并 balance/walletBalance，TradeBox按未知余额显示不足。核验必须走到共享验证/展示消费者及 loaded flags；合并时按当前 owner/network，未知与错误保留 undefined，合法0保持0，并验证 funded→切换/错误→zero，不能用一次 RPC 成功代替业务接线验收。

**验收保护补充（2026-11-17）：** 同一余额接线修复在本地类型/行为测试通过后，远端零warning lint仍因import顺序及回归用例的JSX临时对象失败。相关修复/接缝除行为验证外须运行既有适用lint；测试文件同样受规则约束，不能以“只改测试”跳过。该次最小清理保留funded→undefined→zero断言及owner/network余额清除语义，不删除测试或放宽规则消除失败。

**隐藏消费者重新启用（2026-11-16）：** [GMTrade #1096 / FESOL-115](issues/FESOL-115.md)恢复 FEES 列时，旧 formatter 将接口 null 显示为 `$0.00`。已有函数也须按新启用场景核对未知、不适用与真实零的显示契约；区分旧逻辑存在与本次首次暴露。移除提现 PDA 聚合则应核实当前接口 owner 已是钱包，不能用旧注释推定回归。

**Solana LP 容量不是 EVM 储备公式的同义字段（2026-11-27）：** TRD-116 对照固定 SDK `7fe4008292ff` 发现，提取上限还受 MaxAfterWithdrawal 正向 trader PnL、储备值向上取整影响；用共享 EVM 可用抵押流动性只能得到部分约束。保持共享页面，在 PoolsData 边界提供协议SDK容量结果；错误/缺数据保持未知，不用旧公式回退。GLV配置的零值也须按协议判定“零cap”还是“无限制”，不能按字段名机械搬运。 TRD-116实现中amount/value零cap独立不限制，禁用组成池不计入容量，每池先clamp再求和以免超限池抵消其他池容量；vault cap估算不能当作含费用/价格影响的执行报价。 GM的USD存入上限也须核对price端点：固定协议按collateral maxPrice校验，Solana展示显式opt-in maxPrice并用适配后的deposit LP价格换算，EVM保留midPrice默认；tooltip与headline使用同一口径。见 [TRD-116 协议核验](issues/TRD-116.md#协议可卖出量与异步确认回归2026-11-27)。

**同地址也可能换了钱包连接器（2026-11-27）：** TRD-116自审发现，地址/网络/金额相同不代表签名会话相同；Phantom与Solflare可暴露同一owner。把明确选中的walletId发布到session，并作为review、异步结果与发送guard的依赖；不要用每render变化的sign函数identity代替业务会话identity。受控测试应覆盖同地址切连接器后旧review失效，以及签名等待期间guard变false。见[TRD-116回归](issues/TRD-116.md#同地址钱包切换保护与共享回归2026-11-27)。

## RL-03 资格条件属于具体用途

**租金接收人与资产所有者分开判断（2026-11-26，自审）：** [TRD-157](issues/TRD-157.md) 旧站修复中，exchange owner 拥有 GT Bank payout，不代表账户 rent 也归 owner。资格判断应覆盖统计金额/count 和实际交易构造；只隐藏按钮或提交前刷新同一缺失筛选均不足。旧 IDL 将新 receiver 暴露为 reserved 时，先核实协议保留布局及零值语义，再用 shipped IDL 的真实 coder 配合固定字节 fixture 验证；未知/解码错误不得默认可领取。共享 builder 的所有调用方一并接续，并保留 owner 的合法收益。此为旧 GMTrade 修复经验，不授权新 GMX 引入旧 SQD/后端；离线验证与真实链上验收分开。

**要保护的行为：** 钱包能持有某 mint，与它可作抵押或 pay token 是不同资格。`isSynthetic` 等标签不能未经消费者语义核对就复用于余额过滤；读取后的展示筛选也需要单独确认。ATA 的合法零余额与损坏数据要区分，不能全部吞成零。

**证据与回归风险：** [#3195 评论](https://github.com/gmx-io/gmx-interface/pull/3195#discussion_r4483348370)明确指出当时 WIF/BONK/PUMP 等真实资产仍能持有，PUMP 涉及 Token-2022；修复 `ae69b848ca` 后有 [11 月 6 日 reviewer 确认](https://github.com/gmx-io/gmx-interface/pull/3195#pullrequestreview-5800286122)。[11 月 9 日提交](https://github.com/gmx-io/gmx-interface/commit/2ad57a5c3bc21ced95528290c976ff757004cd8e)又引入 `!token.isSynthetic`，调查读取的 head `2495be234e` 仍有该过滤。不能推断作者动机，也未在本轮运行余额复现。另见[预充值、system-owned 空 ATA](https://github.com/gmx-io/gmx-interface/pull/3195#discussion_r4492569684)的合法状态判断。

**适用条件与冲突：** 当时上游 Solana Tokens 规范“排除 pay tokens 和 balances”的表述，与具体钱包资产 review 存在语义冲突。遇到相同情形先说明具体视图/消费者和冲突证据，核实当前最终约定；未明确时澄清，不机械复制任一过滤，也不自行改上游规范。历史 token 数量不是长期常量。

**有区分力的核验：** 选当前配置里“能持有但不能作抵押”的真实 mint，沿配置→reader→mapper→钱包列表检查，并按影响覆盖 Token/Token-2022、合法空 ATA 与 malformed 数据。必须确保输入确实到达被测分支。当前条目用于预防与核验，不授权修改 #3195。

**2026-11-17 接续：** 最新 #3190 `9896a85fbc` / #3195 `666fa1669a` 已恢复配置 mint 全量 reader/list；本地交易线接续该正式候选并撤掉旧 GMSOL_BALANCE_TOKENS 过滤，未修改他人原 PR。当前代码已有 WSOL/WGMX 图标，旧“缺图标需回退”不再适用；需以目标版本实际资源核对，不能永久保留历史兼容。

## RL-04 入口与状态生命周期

**项目判断：** UI 可见性、请求启停、业务状态归属及在途任务存活分别决定。隐藏入口不等于关闭所有入口；CSS 隐藏或丢弃 Hook 返回值仍可能请求。暂停新读取不应无条件销毁在途交易 watcher，关闭整页也可能误伤网络中立设置。

**确定拒绝与广播不确定性（2026-11-20）：** [#3315 当前 head review](issues/FESOL-56.md#pr-3315-当前-head-独立-review2026-11-20) 复现：签名前 simulation 成功后，发送 RPC 的 preflight 仍可能明确拒绝；若所有 send 错误一律保留持久化签名，从未广播的签名将始终无 history，使后续提交永久阻塞。应区分明确未广播与超时/断连，前者只清理匹配本次签名的 pending，后者继续 reconcile；不能用通用 catch 清空来破坏防重复保护。反例应覆盖实际 SDK 错误类型、null history、下一次提交和持久化恢复；已在原需求线修复：使用 SDK 的明确 `-32002` 类型判断并比较持久化签名；回归覆盖拒绝后重提及并发替换记录，临时补验保留先前成功 preparation 签名，见[修复记录](issues/FESOL-56.md#pr-3315-p2-修复2026-11-20)。

**共享 TradeBox 的链边界（2026-11-19）：** [TP/SL 输入异常](issues/FESOL-19.md#tpsl-输入触发-evm-payload-异常2026-11-19)证明，渲染后替换 submit state 不能阻止之前无条件执行的 EVM payload Hook。Solana networkId 与兼容保留的 EVM chainId 并存时，须在实际构建边界隔离链专用 payload；共享计算仍可复用。回归需包含已连接账户及有效 TP/SL entries，单测最终 Solana intent builder 不能覆盖共享渲染路径。 同类入口核查需区分显式链隔离、依赖缺少 gas/fee 的隐式短路、以及实际可达的 builder；不要把每个 EVM Hook 调用或通用字符串 key 都判成缺陷。已有 preview 哈希修复不能替代对 payload 消费者的回归。 本轮修复回归在真实 Hook 上覆盖 networkId 单独变化及 EVM 切回，并用有费用的 gmsol 主订单反例证明隔离不依赖缺省数据；已通过 Kenny 钱包会话的有效 BTC/DOGE TP/SL 输入验收，见[交付记录](issues/FESOL-19.md#tpsl-链边界修复已交付2026-11-19)。

**GMTrade pending 退出入口（2026-11-16）：** Sulliven 的 [旧前端 #1095](https://github.com/gmsol-labs/gmx-solana-interface/pull/1095) 将价格不可用与关联市价单 pending 拆为独立条件：两者都锁定一般操作，但仅价格不可用禁用 Close，且表格/卡片保持一致。不要把所有状态合成整行 `pointer-events-none` 而误封退出入口；遍历订单时也不要让后遇到的普通订单覆盖先前发现的 pending。核验正常/pending/价格不可用/两者同时存在，逐一检查 Close、编辑抵押、TP/SL 与大小屏。此为旧项目前端设计证据，不自动作为新 GMX 产品规则，也不证明 Keeper 执行或交易已通过；[本次调查与证据边界](gmtrade-eur-pending-investigation.md#后续修复pr-1095)。

同 PR 的 CR 补充：`pointer-events-none` 只阻断指针命中，原生 button 仍可经 Tab + Enter/Space 激活。业务禁用条件须传到 Button 的 `disabled` 或 handler guard；父级置灰不能替代语义禁用。不要把“弹窗可打开”的代码证据扩大为“交易最终校验可绕过”。

**证据：** #3120 的[dropdown 外仍有铅笔入口](https://github.com/gmx-io/gmx-interface/pull/3120#discussion_r4336793693)、[设置页与 Hook](https://github.com/gmx-io/gmx-interface/pull/3120#discussion_r4336793730)，#3110 的[未使用结果仍启动 RPC](https://github.com/gmx-io/gmx-interface/pull/3110#discussion_r4358191016)。#3193 先修 [pending 状态归属](https://github.com/gmx-io/gmx-interface/pull/3193#discussion_r4466217380)，又修[旧 promise 引用已卸载 poller 回调](https://github.com/gmx-io/gmx-interface/pull/3193#discussion_r4469286763)。这些是历史 review，不证明当前所有分支已通过。

**有区分力的核验：** 对受影响部分列明入口、请求、state owner、异步回调和销毁时机；按需验证 flag off/on、刷新/站内切换、单链/双钱包、在途成功/失败/超时与卸载。不要把所有组合变成每个任务的固定门禁。历史切片延期不等于永久免做，后续范围以当前 Linear 与最终决定为准。

**2026-11-17 中央 RPC 接续：** #3190 新 registry 仅管理 Solana 选择事件及 lazy init；EVM 的 start/stop 属于 RpcTrackersRegistry.syncTracking，不能因 registerRpcTracker 不再自动启动 EVM 就重复添加 owner。接续中央实现时应撤掉已被替代的本地 hook，同时核验当前 tab/flag、切换后延迟初始化、清理和 EVM 切回；保留仍在使用的 watcher，而非按名称批量删 tracking。

## RL-05 验证必须能区分错误

**交易金额展示精度（2026-11-27，TRD-116 真实验收）：** 不凭组件的displayDecimals参数判断保留精度。AmountHumanValue内部formatAmountHumanParts先走默认4位formatAmount，再补6位，会把0.000669098显示成0.000700、微额费用显示为0；minimum显示同样受影响。Solana池表单/确认使用显式token decimals直接格式化bigint，unknown保持unknown，并以实际渲染测试核对输出、minimum及1 atom费用；不要为局部问题修改所有共享/EVM显示。来源：[TRD-116](issues/TRD-116.md#gm-取出完成与金额精度修复2026-11-27)，业务提交1c8a1f975d。

**2026-11-26 只读样本与验收边界：** [TRD-157](issues/TRD-157.md#测试协作经验2026-11-26) 中，可实施不等于已验收；单测证明 fixture 下的逻辑，真实 RPC 数据回放证明该样本的数据链路，均不能自动扩大为页面、钱包或未取得的特殊账户验收。缺少罕见样本时，先明确现有证据与缺口，再由验收负责人决定是否接受当前测试依据，不自行宣称“单测就够”。公共 owner 地址可用于只读校验，不代表能连接或控制该钱包。挑选样本须确认它经过实际 Store/season/索引/vault 等筛选后能到达目标分支；程序扫描的零结果仅覆盖所记录网络、布局、slot 和现存账户，不能推断历史或其他部署不存在该状态。

**要保护的判断：** 通过的测试要能说明目标行为。先问“旧实现或缺少该 guard 时，这个输入是否仍通过？”对关键保护可定向做反例验证，不要求普遍 mutation testing，不以 mock 调用次数或样例数量代替业务结果。

**证据：** [#3201 guard 缺失仍通过](https://github.com/gmx-io/gmx-interface/pull/3201#discussion_r4483355273)；[#3110 旧会话没有 picked 记录](https://github.com/gmx-io/gmx-interface/pull/3110#discussion_r4324738579)，新 preview 会话无法覆盖；[#3138 NEAR 两链精度不同](https://github.com/gmx-io/gmx-interface/pull/3138#discussion_r4375833519)，可区分精度来源。#3068 的 [worker 入口](https://github.com/gmx-io/gmx-interface/pull/3068#discussion_r4259921377)与 [bootstrap 缺失](https://github.com/gmx-io/gmx-interface/pull/3068#discussion_r4259921402)说明保护工具也要有失败反例。

**应用与边界：** 选择有差异的真实配置、恢复状态、精度或账户类型，再断言可观察结果。历史 FESOL-42 用 MegaETH→Phantom 区别 settlement 行为，这是当时验收条件，不是永久指定网络。生命周期问题注意实际生产构建与 StrictMode 差别；仍按上游测试准入和当前授权选择必要验证，不为简单改动镜像实现写测试。

**2026-11-17 结果复用自审：** 核对测试配置应读取实际入口（本项目 Vitest 使用 vite.config.ts），不能把两边同名文件均不存在当作 identity。源码相同不保证发现范围、alias/project 路径或构建配置相同；记录已知差异，并让交付目录执行必要的实际检查，不把其他目录结果改写成自己执行。

**2026-11-18 下单异常与归因边界：** TRD-136 playground 的通用 `Order request failed` 丢掉原始异常，当前 LUT 状态虽能证明准备链路存在确定阻断，却不能证明用户过去每次同文案失败均由它触发。用户明确版本升级前已发生下单错误，不能用本轮操作顺序编造故障发生顺序。通知应保留具体错误原因，同时保持失败/广播未知/成交取消的区别及交易链接；验证实际渲染和未知状态保护，不以补充文案证明下单已恢复。对应修复接回 TRD-78 原开发线，详见 [TRD-136](issues/TRD-136.md)。

**2026-11-18 钱包消息差异必须实测：** TRD-136 原生 Phantom 签名返回时附加8条 Lighthouse 断言；原9条业务/费用指令、账户权限、blockhash均保留，却被逐字节message保护拒绝。诊断应在原签名边界捕获message并按真实账户地址/指令data比较，不把签名新增、优先费调整或独立Privy CSP错误当已证根因。兼容须保留原交易语义与权限保护，不能删除校验或仅按Lighthouse程序ID允许其全部指令；其程序也包含MemoryWrite/MemoryClose。 本轮实现另确认：WASM与Kit重编译可改变static account索引顺序，比较应基于真实地址/全局角色及原指令顺序，不能要求索引相等；Borsh枚举使用ordinal，不按Rust repr数值推断。带新增断言的实际签名交易需在广播前再次sigVerify模拟。具体证据和修复归属见[TRD-136](issues/TRD-136.md#phantom-返回消息差异已实测定位2026-11-18)。 最终验收应证明失败路径实际被覆盖：本次链上开仓回执含8条成功的Lighthouse断言，结合请求/keeper两笔finalized成功、Order filled、刷新后仓位恢复与无剩余订单，才确认本次问题闭环；普通签名成功或仅Order request sent不足。该样本不证明全部钱包/交易类型通过，也未证明上午到晚间首次触发钱包断言的原因。

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

2026-11-19 用户纠正交付入口：业务 PR 应在上游仓库建立需求分支并向 release 提交，不用 fork。遇到 fork 报告写权限失败，先核对 head/base 仓库和实际协作流程，不能默认把适配 fork CI 列为需求工作；本轮已修正规则和工具默认 remote，并将 TRD-77 迁移至上游 #3314。历史 fork 兼容方案仅适用于确实需要接收 fork 的共享 CI。 用户随后重申这是基本研发流程：所有分支重建（含 release 交付、迁移、补签）均保留原 commit，不因独立交付而默认 squash；所有新 commit 显式 GPG 签名并核验。工具也必须显式传入签名参数，不能只依赖本地 commit.gpgsign 配置；本轮修正了 agent-workflow 的 merge/cherry-pick 入口，显式 OpenPGP 签名并 verify-commit；15 项工具回归通过，使用隔离的临时 GPG 密钥覆盖关闭自动签名后的 merge/转移签名，以及签名失败保留 pending/不生成未签名提交。本轮25/31/46/26个commit逐个核对并迁移，TRD-77恢复原5个加release同步。签名改变父节点会连带改变后续SHA和使旧签名失效，按有序父节点映射重签，逐提交 tree/message 与最终树一致才可复用内容验证。

**2026-11-24 历史去重反例：** 稳定patch-id也包含周边context，不能把“没有同patch-id组”解释为没有重复实现。3337全量复查发现两份Phantom Lighthouse修复新增/删除逐行相同、新文件blob相同，但sender import和测试context不同，patch-id未归为一组。候选发现应补充按路径的新增/删除内容比对，再验证父链、上下文和后续演进；不能仅凭归一化文本直接drop。共享前置重建仍须核对最终tree/diff、适用merge、下游及新签名，见[复审记录](solana-trading-dependencies.md#88commit全量历史与整理工作复审2026-11-24)。

同日最终tree预演补充：无整条重复组时仍可存在release行为“先删除再恢复”、混合commit中的重复hunk及locale补丁包含关系。merge第二侧有独有commit也不自动证明有独有实现；3337的6fb第二侧仅独有719这一merge，719的所有业务祖先已由第一侧保留，最终tree相等时可作为冗余拓扑候选。须实际核对独有集合、剩余可达性与完整tree/diff，不按merge标题或parent可达单一条件删除。当前88→81预演及实施边界见[最终代码不变预演](solana-trading-dependencies.md#以最终代码不变为准的清理预演2026-11-24)。

2026-11-17 playground/#3288：fork组件测试的Pages/comment 403应在权限步骤按same-repository条件处理，保留测试、artifact及测试失败门禁；不要把整项workflow跳过或改成忽略失败。本轮修复后远端组件workflow成功。部署SDK验证需读取entry实际引用的hash路径并核对WASM摘要；SPA对不存在路径也可能返回HTML200，单独HTTP状态不能证明产物存在。见[TRD-136持续实验分支](issues/TRD-136.md#持续实验分支交付2026-11-17)。

2026-11-17 在 #3201 验收补齐：金融数据页面对照先区分 selector 按 index 聚合与 header 按选中池展示，并记录 API/价格采集时间；实际 OI/volume 变化不能当成计算回归。真实响应经过生产 parser/compose/格式化路径能验证技术一致性，不能代替金融语义批准或独立链上 reference。PR描述编辑也可能触发edited CI，终态报告需区分已完成检查与同head的新任务。CI 公共接口超时须保留首次失败和重跑结果，本地重跑通过不能写成远端全绿；[本次证据](issues/FESOL-15.md#自动验收补齐2026-11-17)。

## 日常增量维护

2026-11-24 用户纠正测试范围：#3337局部冲突处理中，Agent默认在统一线及两个下游分别跑全量，且在核对Vitest收集规则前启动套件，增加重复等待。下游运行器改动确有广泛影响，但不能据此证明此前全部全量必要。后续按[测试范围与执行确认](coding-and-self-review.md#测试范围与执行确认)选择单用例/相关集合，主动全量先获确认；多目标复用有效结果，失败先定位再重跑。根规则、启动卡、交付skill及交付差异复验入口已同步，不用增加新门禁或独立复盘文档。

2026-11-24 TRD-136/playground接入TRD-166测试分组：Vitest项目`extends: true`会合并父级`include`数组；父级已有全量include时，给shared项目单独配置标记文件列表仍会收集全量测试，造成mock跨文件污染。应将全量include放入isolated项目，shared项目仅列显式标记文件，并用`vitest list --filesOnly --json`确认每文件仅归属一个项目。新增mock/组件/时间状态的下游测试须重新判断隔离要求，不能机械继承纯函数版本的共享标记。详见[冲突处理记录](solana-trading-dependencies.md#3337-冲突定位2026-11-24)。

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
