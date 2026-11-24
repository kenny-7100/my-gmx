# Solana 交易链路依赖审计

## 重建提交GitHub签名身份问题（2026-11-24）

用户截图指出三条Unverified。GitHub API确认原始0891747ffc、fac83d15bd、5fa8d01ce8均verified=true/reason=valid；当前映射1b4c70a8、93765725、4c8a3a7b均有签名，但verified=false/reason=unknown_key。本机三者GPG=G，签名者为Kenny key9FB76150CFDA2294，committer却保留Divhead/Sulliven身份。这是重建签名与身份关联验证不匹配，非原作者未正确签名。此前仅核验本地GPG，未充分核验GitHub验证状态，是整理遗漏。parent变化后原签名不能复用；正确重建应保留author，以实际重建者作为committer并使用其匹配key签名，再核验GitHub verification。当前仅调查，未继续改写。修复仍须备份、保留tree/message/顺序及merge关系并核验下游，不修改author伪装归属或把他人邮箱加入Kenny key。

## 原四PR关闭（2026-11-24）

用户明确授权在GitHub关闭原四PR。实时核对3315/fac83d15bd、3316/aa6660fcb0、3317/3213ee6e0c、3293/5fa8d01ce8均未新增head，与统一整合固定来源相同，随后关闭四PR并复查为CLOSED；原分支保留，未发送评论或通知。后续统一使用[Draft #3337](https://github.com/gmx-io/gmx-interface/pull/3337)，未改其Draft状态或Linear需求状态。

## Phantom剩余等价补丁共享化（2026-11-24）

用户明确授权处理a4c488f912/a7174bd3af这一组。两份新增/删除相同但上下文不同，已用后者补丁在共同前置安排一份实现，移除两份旧节点；净减1。三条新head：统一3337 `9320cf7c9f096f043c7f49c97ca040be64ad4fa5`（88→87）、136开发`464826f74e2189e42c0593920ff81b6fdda29368`（546→545）、playground`36d025574b6c0cbfb0c740712005d827ce186a5d`（188→187）。保留原message及适用merge关系，25条master保持原SHA；525保留节点与1共享节点显式GPG签名并验证。

预演中sender import/测试上下文冲突，未接受无上下文按行号应用的结果；最终采用三方合并，冲突处以唯一原文上下文定位替换，文件末尾新增测试按EOF处理。两个被删副本各自tree均与映射后parent相同才删除，三目标最终完整tree与旧head逐字相同，对旧release c588及最新release的完整diff也相同，交易源仍为两下游祖先。中间共享修复前移，不声称中间tree逐个等于原版；没有业务/配置变化。

本轮fetch发现release更新至`92c658ddfe`（CI及移动弹层），未混入这一零代码变化整理；后续需要时另行同步。操作前旧head已有本地/远端`backup/{trading,trd136,playground}-before-phantom-dedup-20261124`，使用显式旧SHA lease更新三远端。两个PR仍Draft，正文/登记已接续；新head CI重新运行，不声称通过。既有playground部署2b141ae5/source8bdeab3148的完整源码与新head相同，本轮未重部署或新增钱包验收。

映射`.git/agent-workflow/phantom-dedup-20261124.json`，预演/执行/独立校验`/tmp/gmx-phantom-dedup-{plan,execute}.log`、`/tmp/gmx-phantom-verification.log`。此前88条复审中的旧候选SHA作为历史快照保留，后续从新统一分支继续。

## 88commit全量历史与整理工作复审（2026-11-24）

用户要求检查全部commit和此前整理过程，本轮只读业务/PR，不继续重写。实时release仍`c588a42b4c`、3337仍`5734a74943`，Draft、88commit/145files。逐条检查88提交的parent/tree/签名/patch及所属范围：63条交易/整合提交均GPG=G，25条固定master历史保持原SHA，其中1条未签名、24条本机不可完整验证（含SSH verifier未配置）；不称全部88条签名通过。没有空单parent提交、没有相同稳定patch-id组、git cherry无release等价单条补丁。

**新增明确候选：** `a4c488f912`与`a7174bd3af`的Phantom Lighthouse修复，四路径的新增/删除逐行完全一致，新增validateWalletTransaction.ts blob同为`a6a4e5ad160e120353a7bbc2c09f5c43e5403ba8`；patch-id不同仅来自周边context差异（sender import及测试上下文），此前去重仅识别其中两份副本，仍遗留第三份的等价实现。两节点处于不同父链，不能直接drop，应扩展现有共享前置并投影后继，预期净减1且须重新确认最终tree/diff/适用拓扑和签名。对全部非master单parent commit另做按文件的新增/删除内容分组，只发现此组；该检查仅提名候选，不替代上下文适用性审查。

两个旧低收益merge候选目前为`ca1c189431`（tree等第二parent；release起始壳）和`cf8a4e9bf2`（tree等第一parent；保留78来源历史）。此前`d827f3ce27`是旧映射，当前对应cf8，不应再当当前SHA。master侧另有tree等parent的上游PR merge，属于保留的25条原始来源，不逐条抹掉。其余同题locale或wallet-key提交仍有真实差异；不按标题删除。建议只将新增Phantom副本列为值得进一步清理的候选，merge保持，master发布范围独立协调。

**整理过程复验：** 独立读取四轮持久映射，共649/649/578/553条记录，保留节点message、记录中的tree及有序parents均与Git对象吻合，四阶段三个root的最终tree均不变。当前3337/136/playground与最初整合后19850b6b46/57e707fe08/509a63e910的完整最终tree分别相同，源到两下游祖先关系通过。已吸收路径投影和共享补丁提前进入历史有意改变中间快照，因此不声称每个中间commit都等于原快照或逐个可构建。最初整合保留release已有变更（含decrease原生抵押TWAP修复），显式接续78拓扑，整合自有Receive补丁仅新增Solana tokenInfo，EVM仍undefined；未带入个人工具/知识文件或TRD83独立交付。

**当前review边界：** 固定master25条仍包含尚未进release的市场、RPC、EVM/图表能力，不能把PR描述为纯四需求独立可合入。GitHub当前head的组件测试步骤成功，红项为报告推gh-pages被fetch-first拒绝（run45218820015），非组件用例失败；主lint/types/tests有一轮成功、另一次触发仍运行，SDK standalone/Audit/两个Pages成功。未重跑业务suite、改业务/PR正文、签名广播或扩大全交易验收；playground最新部署见[TRD136记录](issues/TRD-136.md#同步后重新部署-playground2026-11-24)。详细88条盘点及独立映射核验`/tmp/pr3337-history-audit.json`、`.log`，组件失败证据`/tmp/pr3337-review-component-failure.log`。

## 单条空提交移除（2026-11-24）

用户仅授权删除461ac22420，现场/远端均无新增且clean。确认它与唯一parent563630b4f0完整tree相同后，仅将该节点映射至parent，其他节点保留tree/message/parent顺序，受影响63后继重建并GPG验G，489节点SHA不变。两个低优先级merge保留双parent；master历史不变。三目标最终tree及相对release完整diff一致，drop不再为祖先，统一源/下游祖先关系通过。

当前3337 `5734a74943aecd0e71e9e8724efa2caedfd0b657`（89→88）、136开发`c48f0948987e14626a21339fafc40340c7c15c82`（547→546）、playground`8bdeab314854690d95a4fb3ba1be9273244c2f8e`（189→188）。原head备份origin `backup/trading-before-empty-drop-20261124`、`backup/playground-before-empty-drop-20261124`，my-gmx `backup/trd136-before-empty-drop-20261124`。仅指定空节点移除，无其他候选扩展；三线lease推送，两个PR保留Draft，registry与正文更新。映射`.git/agent-workflow/empty-drop-20261124.json`，校验日志`/tmp/gmx-empty-drop.log`。源码/config不变，复用原验证，CI新head独立运行；不重部署/新增钱包验收，线上source509a63e910仍与playground最终tree相同。

## 89commit清理后复查（2026-11-24）

用户继续询问潜力，仅只读业务核对。刷新release/3337未变，排除master25祖先后64提交：无重复patch-id组，git cherry无release等价补丁；发现去重共享化后461ac22420（Merge reviewed release prerequisites TRD-70）与唯一parent563630b4f0完整tree相同，是本次去重产生、前次收尾未删除的空单parent节点，可安全候选移除但仍需最终tree映射/签名/下游核验。此前有意保留的两merge映射为ca1c189431（tree等第二parent，release起始壳）和d827f3ce27（tree等第一parent，保留78侧来源祖先）；后者第二parent含独有历史，不能按无代码变化抹掉审计来源。暂不扩展为业务commit squash；除空节点和两个低优先级merge外，未发现同类明确自动可删项。master范围需独立语义决策。本轮未改业务/PR/部署。

## 四交易分支重复补丁共享化（2026-11-24）

用户明确同意实施10组重复补丁去重，要求最终源码零变化。新鲜fetch后release仍c588、3337/136/playground无他人新增且clean；已在本地及远端备份三个原head。沿用交付skill，单Agent，无新业务功能。

每组副本先核对稳定patch-id一致，再找所有副本父提交的共同祖先，将一份原补丁以原message/identity签名放在分叉前供各线继承。10组全部可三方干净应用；25个原副本删除，插入10个共享commit，净减15。剩余业务提交仍按原拓扑/message拆分，两个merge候选9aa37fb3b9/879fdbc187均保留为双parent节点；25个未吸收master祖先SHA不变。原生SOL、preflight、slot等后续演进仍在。中间快照有意提前包含共享修复，仅对尚未拥有该补丁的源节点投影；已有该补丁及后续演进时不重放旧补丁覆盖。下游自身历史保留其原快照并接续来源映射，最终tree均不变。

| 目标 | 原head | 新head | 相对release提交数 |
| --- | --- | --- | --- |
| #3337 | `ee7ff037f2` | `e9e6edc6f002ab35802a5f93e21608ec20c877f7` | 104 → 89 |
| TRD136开发 | `5933abb628` | `ed63be9988cad8865e4be6492186bc314e4688aa` | 562 → 547 |
| playground/#3318 | `e2e4caa656` | `e61607039d1f85c43294af32445125c1ce997e50` | 204 → 189 |

核验：三目标完整tree及相对release完整diff逐字节一致，3337仍145files；10个共享补丁的patch-id各与原组完全一致，25旧副本不再是3337祖先；两个双parent merge在新3337祖先中保留；共享补丁、新3337/下游祖先关系通过。518个原保留节点和10个共享节点重新GPG签名并逐一验G，message/parents/tree映射校验通过，25master原节点保持原签名。未将其他独立lint/docs合并或删除。

原head远端备份：origin `backup/trading-before-patch-dedup-20261124`及`backup/playground-before-patch-dedup-20261124`，my-gmx `backup/trd136-before-patch-dedup-20261124`。三目标按旧SHA绑定lease推送并ls-remote复核；GitHub已确认3337=89/145files、3318=189，两个Draft保留，正文及任务映射更新。源码/依赖/config完全不变，复用既有同tree验证，新CI运行中不称通过；无业务suite复跑、重新部署或新增钱包验收。稳定playground仍source509a63e910，完整tree与新分支相同。

原/新映射与共享节点：`.git/agent-workflow/patch-dedup-20261124.json`，SHA256 `50eda3ab3feb4ceaf7849cbde8e14597cf969c4c62706b68884a7a81019c92c8`；本机脚本/核验输出`/tmp/gmx-*patch-dedup*`。未改Linear、Ready/reviewer/merge或通知队友；不要整支合回旧需求历史。

## 104commit剩余清理候选（2026-11-23）

用户只要求分析。刷新release/3337均无变化，排除固定master祖先2aa7dd5240后剩79commit。git cherry对release未找到补丁等价的剩余单parent提交，单parent全tree空commit为0。发现10组同patch-id分支副本，合计15个额外副本：import lint2、atomic zero-output3、packet-limit文档3、artifact provenance文档2、Phantom Lighthouse2、failure reason2、sync-vs-error3、两组locale同步各3、reviewed prerequisites2。副本位于原72/78/70不同父链，不能直接删，否则对应阶段可能缺修复；须统一共同前置/按拓扑重建并最终tree相同，此为未在release交付的同业务副本去重，非上一轮已吸收清理遗漏。

两条merge与某parent tree相等：9aa37fb3b9与第二parent64f28dd43e相同（第一parent为release，可作为起始整合简化候选）；879fdbc187与第一parent3b70d4deff相同（保留78来源历史的显式merge，删除涉及来源可追溯性，不能仅以无代码变化自动移除）。标题含Merge release的09afef5ac7/60e83028e3现在为单parent，实际分别改locale引用/消息，不能当空merge删；c6cafed855有useTradeboxState真实适配及locale，不可按标题删除。

建议仅在用户确实要继续整洁review历史时去重15个补丁副本，保留一份真实业务修复和必要merge；两个tree相等merge优先级较低，不建议为2条重写已稳定来源历史。不合并lint/docs到其他功能commit，除非获得用户单独授权。候选不代表能直接104减15减2，最终取决于重建后的适用merge和重复节点。本轮无业务/PR/部署修改，证据`/tmp/gmx-remaining-cleanup-candidates.json`。

## release已吸收实现与重复适配历史清理（2026-11-23）

用户明确要求实施：对最新release已经覆盖的实现和重复历史统一清理，仅保留交易自身差异及必要适配；尚未吸收的master内容本轮不删除。实时release仍`c588a42b4c`，三个远端/现场head无他人新增且clean，操作前均创建本地和远端备份。使用交付skill，未委派Agent。

重建以release树为基线，四交易源中仅保留当前PR最终仍有差异的路径；原路径中已经完整等于release的实现始终使用release版本，避免中间commit反复引入旧实现。混合文件composeGmsolOrdersInfo采用release的reader/类型结构，仅保留每个阶段真实存在的orderInfo.solana block，该block已在最初交易实现commit中，故后续纯reader迁移commit变空而删除。不将每个中间tree声称与旧版相同；这次有意清理已吸收的中间代码快照。保留业务commit message、原拆分、拓扑次序及适用merge关系，去除空单parent提交/冗余parent。

本次3337减少27commit：fc52 SDK pin、三份TRD98 asset key、三份fee reader与三份order reader、精度常量、余额/RPC/configured-mint旧迁移、已吸收fee计算及变空同步/旧路径清理。对最终无差异的SDK/API/钱包路径使用release，不按作者删提交。交易metadata、确认slot floor、pending/retry、原子TP/SL与原生SOL等最终实现均保留。未被release吸收的25个master提交原SHA/历史/代码不变，含3307/3324/3329/3334/3331及发布同步，因此不是纯四需求最终diff；仍145files。

| 目标 | 本次旧head | 新head | 相对release提交数 |
| --- | --- | --- | --- |
| #3337 | `4a85d23c7b` | `ee7ff037f27f424fbba8f761ebf464d8c5a72242` | 131 → 104 |
| TRD136开发 | `1e5c1894dc` | `5933abb628e4eef5a2596dd299e7db6639608252` | 643 → 562 |
| playground/#3318 | `3403b53969` | `e2e4caa656735b0698d0a67210649a939d970bdd` | 260 → 204 |

三目标649个旧独有提交在映射中分为543个保留重建（显式GPG签名、全部G）、81个被吸收/空commit删除、25个master原提交保留。逐提交核对message、映射后的tree及parents；三目标最终完整tree与相对release的完整diff均逐字节相同，源/下游祖先关系通过。指定SDK/wallet/fee/order旧SHA不再是3337祖先；三目标SDK validation/referrals/orders API仍与release一致，metadata block实际保留在交易commit `d6a96fe333`。清理顺序与校验脚本/输出在本机`/tmp/gmx-absorbed-*`，完整映射保存`.git/agent-workflow/absorbed-cleanup-20261123.json`，SHA256 `6684ce775926e8c0c2650d2034ff36591bc903a65c498d88a02079c97dd5d8fd`。

备份：origin `backup/trading-before-absorbed-cleanup-20261123`与`backup/playground-before-absorbed-cleanup-20261123`，my-gmx `backup/trd136-before-absorbed-cleanup-20261123`。三目标已按旧head绑定force-with-lease推送并用ls-remote复核；GitHub确认3337=104commit/145files、3318=204commit，两个Draft保留，正文已重写说明来源、清理、master边界及验证。业务目录均clean。新head CI已启动，不称通过；清理前同tree主checks/Audit/SDK standalone通过，组件289passed，仅报告gh-pages并发fetch-first失败。

本次仅历史重建，源码、依赖、配置、tracked用户环境最终tree不变，复用原实际目录检查，不为SHA改变重复跑业务suite或重新部署。线上仍为固定部署5c1589d7/source509a63e910，源码与新playground完整tree相同；既有钱包未连接的只读验收边界保持，不新增签名广播、部署、Linear写入、Ready/reviewer/merge或队友消息。旧README来源SHA为历史证据，当前映射以本节为准；从新分支接续，旧四线不整支合回。

## 已吸收依赖历史清理（2026-11-23）

用户明确授权：基于最新release清理已被squash吸收的旧依赖历史，保留未合业务提交的拆分、message、顺序和适用merge关系；本轮允许重建这三条分支并以旧head绑定force-with-lease更新。交付skill负责执行，未扩大为清理所有其他作者的改动。

实时release仍`c588a42b4c6d6c28dc14fa4a40d245559b4aa073`。已确认#3195旧head `bb85bab5e9`与release内最终head `1858f6c992`完整tree相同，但147个旧祖先不在release ancestry中。原四源均已携带截图的Midas `9a267026`；不是本次额外选择其PR，也不能把所有继承改动都称为“只有历史”。保留其余尚未被证明吸收的master/EVM差异；原剩余提交git cherry未发现与release等价的单条补丁，此检查不能单独证明所有跨提交squash关系。

将边界上指向这批旧依赖的parent引用映射到release正式版本，按拓扑重建受影响提交；所有保留提交的完整tree及message逐一不变，未聚合业务commit，适用parent顺序/merge关系保留（重复parent去重）。三目标合计核对649个保留提交，其中216个parent发生变化而重建，均显式GPG签名并验为G；其余原SHA原签名保留，不将旧unsigned或本地不可验SSH签名称作通过。映射存本机`.git/agent-workflow/squash-cleanup-20261123.json`，SHA256 `f5a8b23e9c35edf5b8e2a979c9f1df69050388399f7d89ca78e1d2149f284b76`。

| 目标 | 旧head | 新head | 相对release提交数 |
| --- | --- | --- | --- |
| #3337 | `19850b6b46` | `4a85d23c7b7d7be33a7cf5c58f72ac67c28b7b82` | 278 → 131 |
| TRD-136开发 | `57e707fe08` | `1e5c1894dc80fd64571d20f5b781faeb4197a7ad` | 790 → 643（含个人开发历史） |
| playground/#3318 | `509a63e910` | `3403b5396962f9ce8f7897e3dc5a9d94d64c4cf0` | 407 → 260 |

三目标最终tree均与各旧head完全相同；3337仍145文件最终diff。四源映射后的head均为新3337祖先，新3337为新136/playground祖先；147旧提交均不再出现在三目标的release差集中，截图9a267026不再是祖先。已推送并核对远端head，两个PR正文更新且均保持Draft，远端新CI仍运行，不称全绿。原README中的固定来源SHA与旧部署SHA是历史快照证据，映射以本节为准。

远端备份：origin `backup/trading-before-squash-cleanup-20261123`、`backup/playground-before-squash-cleanup-20261123`；my-gmx `backup/trd136-before-squash-cleanup-20261123`。其他原需求分支和个人基础历史未重写；以后接入这些旧分支可能再次引入旧历史，应从当前统一分支继续，必要时选择性转入真实新增补丁。

仅历史整理、无源码/依赖/环境变动，不重复运行同tree已通过的业务suite。现有[playground固定部署](https://5c1589d7.solana-playground.pages.dev/trade)仍标识`509a63e910`，源码tree与新head相同，未为SHA变化重新部署；稳定URL及此前断开钱包的只读验收边界不变。TRD-83保持独立，未签名广播、修改Linear或发送队友消息。

### 剩余截图提交来源核对（2026-11-23）

用户继续询问清理后截图中的其他作者提交。刷新release/master/3337后确认：TRD-152 `257fe7630a`、PRO-4599 `0fdde8ef3a`、Alchemy轮换 `fb63e4c0be`、master合流 `ee4f5d5649`/#3327及release-136 `3e2bc5fefd`/#3322均在master且不在当前release ancestry，原四条head全部已包含。主要明确入口为Divhead的72 `fac83d15bd` 三parent merge（当前映射`fb1ea8e743`），第三parent `2aa7dd5240`为master侧#3331，沿途包含#3307/TRD-152、#3324/PRO-4599、#3329轮换及#3334 RPC proxy。不是本次3337另外选择这些PR。

其中TRD-152对应SDK/static市场配置相对release仍净增加42/24/6行；PRO-4599的expressOrderUtils.ts仍净增加16行，RPC配置仍有实际差异。因此这些不能按3195完整tree相等的证据一并移除，也不能声称全是仅历史重复。旧key轮换后还有proxy迁移，单条历史存在不证明旧key仍是最终配置，未查看或输出密钥。截图`c59c5fc672`是Divhead原交易线的LUT-backed atomic业务merge，亦非作者无关噪音。若要排除这些实际master能力，属于另一次代码范围调整，应先核对依赖并重新验证，不能作为已授权“移除release已吸收历史”的自动延伸。本轮只查来源，无业务/PR/部署修改。

### 临交付review的方案评估（2026-11-23）

用户要求分析最适合即将review的方案，本轮不授权再次修改业务/PR。实时3337仍`4a85d23c7b`、Draft/MERGEABLE；release仍c588。核对master前置范围时以实际`2aa7dd5240`为固定快照（#3331，base master），#3307/#3334同样已merged到master。最终145个PR变更文件中42个文件内容与此master快照完全一致；另有共享文件同时承载上游金融/RPC/图表与Solana接线，不能从提交标题推断均可独立删除。RPC sender经getSolanaRpc消费共享config/rpc；金融共享计算还带gmsol分支保护，移除需要验证而非历史等价操作。

推荐正式交付：由release维护者确认并通过独立上游同步把需要的固定master前置进入release，再同步3337；目标仍release、不为缩短列表改base为master、不额外拉最新master、不仅把前置压成一个commit掩盖代码范围。前置实际进入release后，GitHub自然排除其祖先/已吸收差异，再核验冲突处理、最终Solana差异及检查。若无法立即同步，可在现有Draft开始交易代码review并明确依赖边界与前置PR列表，但暂不称为独立可合入的纯四需求PR；无需临review冒险剥离/重签全线。只有release维护者明确不接收这些上游改动，才另做最小依赖提取和功能回归；这会改变代码，不复用历史清理的零代码变化结论。不得假设已merged master等于release维护者同意发布。

新head组件run45200945636实际289 tests passed，唯一失败步骤Deploy report to GitHub Pages，日志gh-pages push fetch-first；Audit和SDK standalone已有成功，主测试及Pages仍运行。钱包四端、完整执行/刷新矩阵仍待完成，历史只读playground不扩大验收。不擅自转Ready/请求review/重跑CI或发送协调消息。

### 排除master后的剩余历史核对（2026-11-23）

用户追问排除fac83d15bd引入的master后是否仅四功能。以旧3337减release、固定master快照2aa7dd5240、已吸收3195旧祖先做集合核对，剩106提交（含fac整合节点及3337三个整合/Receive提交，不等于实际重建后的最终数量）；作者Kenny98、Divhead4、Rainer3、Sulliven1，无其他作者。但作者集合不能证明纯需求范围。

明确历史例外：fc52b13066为TRD-77/FESOL-72的GMX WASM构建pin（18路径），Rainer a3c43891f0/d33e372098/44c3b63344是TRD-98钱包asset key同一修复的不同历史版本（1路径）；这些路径当前3337与release均无差异。fee/order field迁移涉及4路径，其中SDK http/referrals/orders API与release一致，仅composeGmsolOrdersInfo还承载交易相关差异。另有release同步、需求间merge、重复转移的修复历史及3337自身三提交，不能声称剩余每条commit均独立属于原四条业务实现。未发现本轮审计范围内另一批同类master功能入口；具体移除fac需保留release侧及后续冲突解决，并重新验最终diff，不能以提交集合等同功能验收。此轮只读核对，无业务修改。

## 四交易PR统一交付（2026-11-23）

用户已明确实施并新建统一PR：仅3315/3316/3317/3293；TRD-83/#3335暂不纳入。新共享分支`solana-trading-integration-trd-72`已推上游origin，向release创建[Draft #3337](https://github.com/gmx-io/gmx-interface/pull/3337)，head `19850b6b461d598b5f9205bd14c60a4c9fc44342`。Kenny/Sulliven后续整合修改在此分支继续，不再在原四条线独立实现同一修复；用户通知Sulliven并手动关闭原四PR。未修改Linear、请求reviewer、转Ready、合并或发送队友消息。

来源固定：72 `fac83d15bd1a773a980bad424d159e58e5515e3f`、78 `aa6660fcb0beb97939f7020c5fa3b309633c326b`、70 `3213ee6e0cf9109277802c4254393aee2adff672`、84 `5fa8d01ce84b35f229073e9d571b0980e8fd6e57`，均为新head祖先。基线release `c588a42b4c6d6c28dc14fa4a40d245559b4aa073`。在该release先merge84（`c680834ef9`），再显式merge78（`344937400e`，tree不变，仅保留剩余merge拓扑），最后补Receive `tokenInfo`（`19850b6b46`）。保留Sulliven最新getSolanaReceiveTokens/native SOL默认、新改单价格保护及swap排除，没有整支吞入playground或83。

完整历史保留原拆分、message及merge关系，未重写历史/强推；四源已带入的共享master/EVM前置保留，含release3321的native collateral TWAP成本修正，未以release整文件覆盖原EVM修复。三笔新增commit均GPG G。来源含既有未签名、SSH签名以及本机不能完整验证的历史签名；原样保留，不冒称全部历史GPG验证通过。最终业务diff 145文件，无个人docs/scripts/AGENTS/.agents变更。

实际统一交付目录验证全部通过：immutable安装及SDK声明/CJS/ESM构建；前端lint、ESLint规则3项、前端/landing类型、前端361文件/3554项通过（另1文件/1项跳过）；SDK lint/类型、69文件/1028项主测试、multicall6文件/14项通过（1项跳过）、v2 public4文件/50项通过（2项跳过）；8GiB生产构建含固定GMSOL产物通过，保留既有Sass/依赖注释/包体警告；diff whitespace及四来源祖先检查通过。Kenny原生Chrome访问本次3026/trade，Arbitrum图表、市场数据及共享TradeBox渲染；默认本地Solana visibility gate关闭，选择Solana正确弹出旧GMTrade域名提示，未覆盖flag，未验收enabled Solana UI及钱包。GitHub CI已启动，SDK standalone已通过，其他hosted检查当时仍运行，不能称CI全绿。新PR保持Draft，不能视为完整交易验收通过。需补当前head远价limit→edit→cancel、market/close/trigger、可信LUT原子entry+TP/SL、四钱包、拒签/preflight/未知回执与执行后slot刷新；历史playground交易不代替本次head。70已暂缓的payment conversion、最大杠杆一致性、完整simulate_order对照与GT Rewards保持原边界。未部署、钱包签名或广播。


## 统一交易PR额外候选筛查（2026-11-23）

用户询问除83外是否还有类似应纳入的PR。本轮列举全部开放PR，定向读取3313/3299/3301/3309/3336/3280/3223/3273/3312的正文、文件、head/checks及部分patch；这是候选筛查，不逐条认领或新建issue记录，未修改业务/外部状态、未复现缺陷或跑测试。

结论：除TRD-83/#3335外，未发现同等程度应整项纳入的候选。83的纳入仍是建议，尚未获得Divhead范围确认。3223图表独立由Rainer交付，Divhead单独安排Reflectiv测试；当前整合环境可组合图表验收但不吞并其正式PR。3301/TRD-17（badbaadaac）修改共享TradeboxMarginFields，保持USD输入size在limit→market/价格变化时一致，关联下单金额，值得优先核对；当前Solana builder消费amounts.sizeDeltaUsd，但未复现本缺陷于Solana，不称必需依赖或直接并入。若阻断最终交易AC，再明确接入固定版本或等release吸收。

3299/TRD-18（63fa3f006f）为共享SDK/TP-SL费用修正，涉及gmsol条件但并非专门Solana整合交付，当前与release冲突；不能因函数重叠整支吸收EVM费用语义，需保留金融分支并关注后续release回归。3313/TRD-51（474db5e837）为TP-SL receive mode编辑，依赖API360，独立功能不自动扩充Solana支持的编辑字段。3309/TRD-149（4f5debe07b）/3336/TRD-150（e6786dffe9）为前端/SDK关闭市场swap路由；3309对GmsolProvider仅新增closedMarkets:undefined，不能当作Solana关闭市场限制已实现，当前payment conversion仍暂缓。3280/TRD-44（2ca1a9ebac）针对GMX Account/Express费用来源，3273是ticker类型契约，3312是发布SDK Node ESM构建，均不因改同文件而吞并。共享文件重叠用于接续与EVM回归，不等于同一PR交付范围。

继续建议原四PR+待确认83作为清晰交易范围；最新release正常同步（含3321已合并数学修正），其他PR由原作者独立推进，实际发现阻断交易验收的前置再精确接入。


## 四交易PR整合实施条件评估（2026-11-23）

用户转述Divhead建议将3315/3316/3317/3293合成一个PR，并询问若由Kenny承担是否具备实施条件；本轮仅评估，未据转述修改交付规则、业务、他人PR或创建整合分支。结论：代码整合可开始，最终送审仍需组合/钱包验收，最终PR归属与旧PR收口需协作对齐（用户后续已明确：新建统一PR，Sulliven后续交易整合修改也在统一分支，用户通知并手动关闭原四PR）。83不在点名整合清单中；不将playground整支当正式交易交付，不改变原需求成果归属。

实时PR head仍为72 fac83d15bd、78 aa6660fcb0、70 3213ee6e0c、84 5fa8d01ce8，均OPEN/MERGEABLE，当前checks成功；release仍c588a42b4c。72/78/70各development/delivery及136/playground共8目录均clean。已有任务登记仍使用历史FESOL编号；以TRD-70查record为空不代表原FESOL-19现场不存在，本轮已核对后者development/delivery登记有效，不能为改编号重建任务。

**生命周期的重要校正**：GitHub compare确认84包含70，78相对84仅多aa6660fcb0（Merge updated Solana transaction prerequisites TRD-78）一个merge节点，反方向84多41节点。进一步读取两个head完整Git tree，逐blob比较orderTracking目录、solanaOrderTracking通知目录与sender/hook两个入口共17文件，全部一致。缺少该merge节点不能直接推出缺少生命周期代码；应保留提交拓扑并核对实际组合接线、变更冲突和行为，尚未证明整合后测试/钱包流程通过。

建议Kenny作为整合负责人在独立整合现场准备成果，原线保留来源与历史；最终复用哪个现有PR或新建统一Draft，以及旧PR由各作者如何标注/关闭，先与Sulliven/Divhead对齐，不擅改3293或关闭现有PR。使用既有固定WASM、同步release，接84新业务并保留Receive tokenInfo；TRD-83等额外范围不自动加入。送审矩阵按Divhead点名submission/status/market-limit+TP-SL/close/edit-cancel，并按各issue原AC保留四钱包、LUT原子落链、失败/未知回执与执行后slot刷新证据；若缩减矩阵需明确共同约定。当前RPC/Privy域名、钱包/资金、flags和API持续新鲜度仍需实测；本轮没有读取key、启动服务、运行钱包或链上交易，旧403不当作当前已复现阻碍。钱包签名/广播与部署按各自授权执行。


## 五需求晚间增量核查（2026-11-23 21:30 CST）

本轮为只读调研：实时读取五条及83/84/85/107/108/109的Linear正文、关系与评论，核对当前PR/head/checks/review threads、release与API main，并定向比较上游源码。没有修改业务、Linear、PR、服务、部署或钱包；未运行测试/负载、浏览器或链上验收。下述运行数据来自负责人更新的Linear正文，本轮未独立访问Datadog或复跑报告。

| 需求 | 最新Linear | PR/head | 实时GitHub结果 |
| --- | --- | --- | --- |
| TRD-77 | Done，11月23日09:50北京时间完成 | [#3314](https://github.com/gmx-io/gmx-interface/pull/3314) / `161e89e4a4` | 已合并、Divhead APPROVED；不再列作等待状态同步 |
| TRD-72 | In Review | [#3315](https://github.com/gmx-io/gmx-interface/pull/3315) / `fac83d15bd` | OPEN/Ready，MERGEABLE、REVIEW_REQUIRED |
| TRD-78 | In Progress | [#3316](https://github.com/gmx-io/gmx-interface/pull/3316) / `aa6660fcb0` | OPEN/Draft，MERGEABLE、REVIEW_REQUIRED |
| TRD-70 | In Progress | [#3317](https://github.com/gmx-io/gmx-interface/pull/3317) / `3213ee6e0c` | OPEN/Draft，MERGEABLE、REVIEW_REQUIRED |
| TRD-136 | Done，仅提前联调切片 | [#3318](https://github.com/gmx-io/gmx-interface/pull/3318) / `f54ba995d5` | 持续playground OPEN/Draft，MERGEABLE、REVIEW_REQUIRED |

四个开放PR均无reviews、无人类普通评论、无未解决review thread；当前返回checks全部SUCCESS。GitHub最初部分mergeability为UNKNOWN，随后GraphQL明确返回MERGEABLE/BLOCKED；BLOCKED与REVIEW_REQUIRED并存，不应误报为代码冲突。五条Linear评论均空。TRD-78新正文进一步强调固定CPI布局、全生命周期/action匹配、失败交易排除、乱序/延迟/执行关闭分交易等；既有记录已有对应实现与回归，仍需实际RPC/toast验收，不能仅据正文更新重建追踪器。

**可更新代码与接续顺序：**

1. **release更新**：当前`c588a42b4c`，比已同步`d1e9e1fc4c`多7commits/14files。[#3321](https://github.com/gmx-io/gmx-interface/pull/3321)改动共享SDK `decrease.ts`和数学测试，按native collateral units分摊GMSOL TWAP费用、首段承担pending费用并保留超cap impact；[#3213](https://github.com/gmx-io/gmx-interface/pull/3213)修复GM/GLV/shift发送后清空输入及Paxos第二步展示。78/70/playground均behind release 7 commits；72实际decrease源码也缺该新增费用实现。适合下一实施切片从原72线正常同步并传播，保留既有master/EVM差异，不整文件覆盖release版本；不因此开放Solana TWAP。
2. **TRD-84已有新业务**：Sulliven [#3293](https://github.com/gmx-io/gmx-interface/pull/3293) head由`8818b1d46e`更新`5fa8d01ce8`，后者父节点即当前70 delivery `3213ee6e0c`，现在MERGEABLE/Ready，checks成功、无review/threads。新增getUpdateError及bounded acceptable-price编辑拒绝、swap订单操作排除、独立getSolanaReceiveTokens，WSOL默认receive改native SOL。与playground实际源码比较确认这些为可接续内容；不能再说仅旧head冲突待同步。仍未传Receive `tokenInfo`，其TokenSelector无该prop时仍走EVM getToken；接续须保留playground已有显式tokenInfo及刷新/pending保护，并告知作者原线缺口，不代改。旧新compare diverged 56/1主要含前置重建，不把56笔当新增业务或整支覆盖。
3. **TRD-83正式PR已出现**：Sulliven [#3335](https://github.com/gmx-io/gmx-interface/pull/3335) head`44580914b7`，OPEN/Ready、MERGEABLE、checks成功、无review，Linear In Review。正文提供保证金deposit/withdraw零size market订单、SOL/WSOL及禁At price方案与作者测试记录；取代上午“只有分支、尚无PR”的观察。当前playground未集成该能力，可在84接续后作为单独集成切片核验；作者Manual test passed不扩为本人真实存取验收或全部AC完成。
4. **TRD-85增量较小**：Rainer [#3223](https://github.com/gmx-io/gmx-interface/pull/3223)新head`019069b7ed`、MERGEABLE/Ready、checks成功。相对已接入`c8f9c4a85d`的独立新增commit`7786fed065`仅10份locale，随后merge最新release；无新的chart runtime，不需重新整合旧图表实现。Linear仍In Test，Reflectiv于19:40北京时间新增“label needs to be fixed/updated”评论；本轮读取文字但未查看附件/聊天，不推断具体label或修复完成。Depth默认范围与完整图表AC仍需负责人收口。

**跨侧进展与剩余验收：**

- **TRD-107 / API366**：当前API main`f1a271e102`，[#366](https://github.com/gmx-io/gmx-api/pull/366)已merged，签名head`3bc1e8cd37`，两项head test checks现已SUCCESS（Linear较早“仍运行”已过时）。新增实际position payload可见性测量与pool/snapshot/decoding分段耗时，非已解决延迟。负责人正文记录Datadog确认reader `00058-tg5`/indexer `00018-6sh`部署；本轮未独立验证流量比例。部署后960/960有界ramp成功，route p95 config62/value60/order62/position65/discount60ms；ADR目标分别market/order50ms、position300ms、discount1500ms，不能继续误用所有路由50ms。market/order仍超标，snapshot均值41.67ms、decode4.88ms、pool0.19ms，均值不是p95。100wallet本地mock-RPC stress payload p95 3.382s仍超3秒，较低负载2.201s不能代替生产容量/恢复。gzip候选尚无后续提交/部署，不列为可立即接入成果。前端无须因监控patch改写sender。
- **TRD-108**：仍In Progress，正文已补11月23日GMTrade public keeper+confirmed chain对照，served markets内12仓位/28订单一致；额外2仓位/4订单按既有市场过滤排除。12 native金融参考向量再通过、SDK2.9.3的60reads/20slot floors/280related-order检查通过。旧“GMTrade参考对照未完成”不再适用；剩余consumer sign-off及真实open-with-TP/SL→edit→close、每步一次post-trade minContextSlot刷新，非单纯等待下一索引slot。本轮未复跑或将顺序provider读取说成原子快照。
- **TRD-109**：已从Todo进入In Progress（16:45北京时间），冻结LUT已合并接入；正文仍要求个人参考钱包TP/SL仓位+限价单、当前solanaTrading=true及banner key存在/off。没有新的当前钱包/flags实测证据，不以状态变化当AC通过，不共享seed。

建议先同步release，再在136/playground精确吸收84新业务并保留Receive接缝；83保证金存取独立集成、85 locale按需接续；并行推进72review及108真实消费者序列，跟进107 market/order延迟与生产恢复、109运行准备。70已暂缓的payment conversion、最大杠杆、完整simulate_order与GT Rewards不自动恢复。最新部署仍以11月22日`f54ba995d5`/`cdd4e7ac`记录为准，本轮未复验RPC、Privy或新交易，不沿用更早Alchemy403为当前阻碍。


## 12月10日发布范围审计接续（2026-11-23）

本轮扩大到TRD-101当前与FESOL历史计划的发布风险审计，发现TRD-83已有Sulliven远端实现分支但尚无PR、当前playground未接入；TRD-77于本轮查询期间已更新Done。本地化、设计交接与70暂缓项仍需明确执行/范围安排，107/108及完整交易矩阵未收口。证据、历史周期区别与跟进顺序见[目标范围审计](issues/FESOL-109.md#12-月-10-日目标范围与交付风险复核2026-11-23-1002-北京时间)。此前09:34状态保留为当时观察，不当作最新Linear字段。

## 五需求前置跟进复核（2026-11-23 09:34 CST）

本轮为指定五条需求及直接前置的只读增量调查，未全量评估迁移。实时重读五条及84/107/108/109的正文、关系和评论（均空），核对16条相关PR的head/review/checks，在线读取关键builder与PositionSeller；未修改业务、Linear、他人PR、部署或钱包，未读取用户key或运行负载。

- release仍为`d1e9e1fc4c`，API main仍为`90df09fd2b`，相关来源未出现需再次接入的新head。72/78/70/playground head分别为`fac83d15bd`、`aa6660fcb0`、`3213ee6e0c`、`f54ba995d5`，均OPEN/MERGEABLE，全部返回checks成功、无reviews；72 Ready，其余Draft。取代前次部署收尾“部分CI仍运行”的状态。77/#3314已merged/approved，Linear仍In Progress；其余72/70/78仍In Progress，136 Done仅指提前联调切片。
- 在线读取四个head的`buildOrderTransactions.ts`，blob均为`9548dccc352eda7bc1efed8b70daa11e2b00c182`且含`wrappedSolBalance`：SOL/WSOL原子资金修复已接入下游，不再列为待传播。70/playground已无此前合并冲突。最新独立部署及未做浏览器/RPC复验的边界沿用下节，不把当前CI通过当作交易验收。
- **首要协调Sulliven的[TRD-84/#3293](https://github.com/gmx-io/gmx-interface/pull/3293)**：仍In Review、OPEN/Ready、CONFLICTING、无review，head仍`8818b1d46e`。需作者原线同步当前前置、解决冲突并验收平仓及限价edit/cancel。在线确认其PositionSeller尚无`tokenInfo={isSolana ? receiveToken : undefined}`，而playground已有；应回原线吸收，后续集成保留接缝。它是完整退出闭环的组合依赖，不是所有开仓开发的前置；本轮不代改。
- **跟进Divhead的[TRD-107](https://linear.app/gmx-io/issue/TRD-107)**：仍In Progress。API365已merged，merge `90df09fd2b`的Solana production deploy及其余checks仍success；正文末段“等待365 review/rollout”落后实际GitHub事实，可更新为部署后验收。仍需50ms普通读/3秒交易后目标、支持容量、扩缩、持续新鲜度及cold/restart恢复证据；部署workflow成功不证明这些AC。未运行服务探测或负载。
- **跟进Divhead的[TRD-108](https://linear.app/gmx-io/issue/TRD-108)与[TRD-109](https://linear.app/gmx-io/issue/TRD-109)**：分别In Progress/Todo，没有新正文或评论。108已有12组四输出对照，剩余consumer合同确认、GMTrade参考钱包比较、真实open-with-TP/SL→edit→close每步单次minContextSlot刷新。109冻结LUT已交付，余项是指定开发者自己钱包的小额SOL/USDC与参考TP/SL仓位/限价单、当前solanaTrading=true和banner key存在且off的证据；不共享seed，不将历史flags或旧Alchemy403当当前结论。
- **次要review收口**：Rainer的85/#3223仍In Test、OPEN/Ready、head `c8f9c4a85d`、REVIEW_REQUIRED，checks成功；图表AC与Depth范围仍需明确收口，不自动阻塞简单交易。#3273仍OPEN/Ready、head `6995d3a0d5`，实际diff是TRD-49的SDK/frontend TickersResponse类型、timestamp及oracleDecimals弃用修正，**不是静态token/market/LUT列表**；此前清单分类在此更正。无需重复集成其未变代码。

可更新事项：77的SDK构建交付状态与72尚未完成的运行AC分开表述；107正文更新365已合并且部署check成功；109按已完成LUT与剩余运行条件拆分进展。状态调整由需求负责人结合AC确认，本轮未修改Linear。70此前暂缓的payment conversion、最大杠杆、完整simulate_order与GT Rewards不自动恢复。当前建议先协调84原线与109运行条件，再组织108真实刷新闭环，并行跟进107性能/恢复验收及72review。

## 前置接续与 playground 更新（2026-11-22，已部署）

用户授权创建目标接续可执行前置并最终更新 playground。本轮在原需求开发线实施，保留既有提交拓扑；新 merge、修复及 cherry-pick 均显式 GPG 签名并验证。开发线推送 my-gmx，交付线与 playground 推送 origin；更新原 #3315/#3316/#3317/#3318 说明，保留 Ready/Draft，不改他人 PR、Linear 或发送协作消息。

- TRD-72 接入 Divhead `0891747ffc` 原生 SOL/WSOL 原子 TP/SL 资金修复及 `fac83d15bd` 的 release/master 同步；正式 release 为 `d1e9e1fc4c`。开发 `c92c296f59`，交付保持上游 `fac83d15bd`。原生 SOL 优先使用现有 WSOL、只 wrap 差额，必要时把钱包自身 wrapping 放到准备交易；orders/escrow/collateral 保持原子性，签名前/广播前检查余额快照，保留 Lighthouse 和明确 preflight 拒绝/不确定发送恢复保护。
- TRD-78 开发 `92fef895c4`、交付 `aa6660fcb0`；TRD-70 开发 `059e18bb4b`、交付 `3213ee6e0c`。70 import 冲突同时保留 SolanaTradeboxState 与 useShowGmxAccountPayTokens；实际类型检查发现自动合并重复声明 networkId，已在原70线修复、验收，再签名精确转移交付。该正确行为此前已存在组合线，后续签名 merge 记录归属且 tree 不变。
- TRD-136 开发 `41c6bd5c51`、playground `f54ba995d5`。保留 Receive tokenInfo/候选币种、生命周期/slot floors/刷新错误/手动 Retry 等接缝。最新 `.env.playground.local` 与原 playground `3c507ad2a6` 完全一致；只做无输出内容比较，未查看或输出真实 key。
- #3195 最终 squash `1858f6c992` 与原接入 `bb85bab5e9` 完整 tree diff 为空，撤销此前“可能仍有代码差异”的待核验项，不重复转移。TRD-77/#3314 已合入 release；WASM 固定 `0.11.0-beta.1-gmx.1` 及已核实哈希保持不变，不升级参考协议 main。
- 官方 RPC 已从 Alchemy assignment 迁移 GMX proxy，原 playground transform 会明确失配。原136线适配共享 provider 入口，保持各链、HTTP/WS、dev/生产 purpose 选择，并覆盖主 app 与独立 multicall Worker；普通 app 继续使用官方 proxy。临时假配置回归覆盖用途矩阵、Worker 插件保留及源码漂移失败；实际部署仍使用原样保留的用户配置。

| 实际目录 | 本轮验证 |
| --- | --- |
| TRD-72 development | SDK build、app/landing types、完整前端 3509 passed / 1 skipped |
| TRD-72 delivery | SDK build、app/landing types、17 Solana files / 101 tests passed |
| TRD-78 development 与 delivery（分别执行） | SDK build、app/landing types、21 Solana files / 121 tests passed |
| TRD-70 development 与 delivery（分别执行） | SDK build、app/landing types、35 Solana/TradeBox files / 217 tests、变更组件零 warning ESLint passed |
| TRD-136 development 与 playground（分别执行） | SDK build、app/landing types、完整前端 3571 passed / 1 skipped；专用 RPC Node 回归 passed |
| playground 实际生产构建 | 8 GiB Node heap 的 build-playground 成功；上传前验证源码版本、固定 WASM 哈希和干净 checkout |

各 development/delivery 的 src/sdk/landing/yarn.lock（136另含专用工具）一致；个人 package scripts 等不整体带入交付。使用 cloudflare-deploy skill 验证认证与既有 Pages 项目后上传最终完整产物。固定部署 https://cdd4e7ac.solana-playground.pages.dev/trade ，稳定入口 https://solana-playground.solana-playground.pages.dev/trade ，source `f54ba995d571f37850671d3db82d209765e3457e`。两个地址共16项资源（HTML/config/入口/bootstrap/multicall Worker/TradeBox/SDK entry/WASM）与本地完成构建的字节哈希全部一致。

收尾时 #3315/#3316/#3317/#3318 均为 MERGEABLE，72保留Ready，其余Draft；Audit/SDK独立构建及两个Pages已有成功结果，部分主CI/组件/WASM复现仍运行，不声称全部远端CI通过。

本轮未重测浏览器 RPC 可用性、钱包/真实交易或 API 负载；旧403不继续作为本部署已复现阻碍。未签名或广播交易。后续仍跟进 TRD-84/#3293 作者原线同步与 Receive 接缝吸收、TRD-107 性能/容量、TRD-108 consumer 与完整金融/交易刷新矩阵、TRD-109 参考钱包/当前 flags，以及图表 review/AC。70 用户暂缓范围继续暂缓。部署和单测通过不等于这些产品验收完成。

## 五需求前置跟进清单（2026-11-22）

本轮复用同阶段五条PR/release核验，补查16条直接前置Linear状态，其中109/108/107/84重读正文和空评论；核对3195最终版本差异、3273、3201/3286及API365合并提交的checks。未修改业务、服务、Linear或外部消息，未读取key、运行负载/交易测试。

1. **自有开发/交付链已实施接续（验证/部署结果见上节）**：从原72开发线接入 `0891747ffc` 原生SOL/WSOL原子资金修复及 `fac83d15bd` 的release/master接续，传播78/70/136与playground，保留原提交拓扑并对新merge/修复提交GPG签名。70的import冲突同时保留SolanaTradeboxState与useShowGmxAccountPayTokens；实际目录类型检查另发现自动合并引入重复networkId声明，已在原70线删除冗余声明并通过开发/交付复验；136保留playground最新用户配置，不读取key。3195最终合并head `1858f6c992` 与原接入 `bb85bab5e9` 的 **完整tree diff为空**，历史虽diverged但无新增代码，不重复搬运。官方RPC proxy迁移使原playground key替换器失配，已在原136线适配共享provider入口，同时覆盖app/Worker及HTTP/WS、开发/生产用途，普通app使用官方proxy。
2. **跟进Sulliven的TRD-84/#3293**：Linear In Review，PR OPEN/Ready、无review、当前CONFLICTING；代码head仍 `8818b1d46e`，没有新业务提交可重复集成。重点是作者原线同步前置/解决冲突、保留Receive tokenInfo接缝，以及限价edit/cancel和刷新验收。它是136退出闭环的组合依赖，又消费70/72/78，不将其误作所有开发的前置，也不代改他人PR。
3. **跟进Divhead的TRD-107/108运行验收**：107当前In Progress（不再沿用旧In Review），108 In Progress。API365已合并，merge `90df09fd` 的 `api-solana-deploy (gmx-api-production)` 为completed/success，另有三网络deploy与两test成功；这证明部署工作流成功，不证明流量比例、持续健康或负载AC。本轮未访问运行实例。107仍需50ms普通读/3秒交易后目标、容量、扩缩及冷启动/重启/新鲜度验收；108已有12组四输出对照，但consumer合同确认、GMTrade参考钱包和真实open-with-TP/SL→edit→close每步单次minContextSlot刷新仍未完成。旧API正文“365待合并部署”已落后GitHub事实，不据此重复等待。
4. **跟进Divhead的TRD-109**：仍Todo，正文明确每个开发者使用自己的钱包、小额SOL/USDC，不使用共享种子的钱包。冻结LUT已由3325交付并接入，不能再称缺少可信表。余项是指定开发者的GMTrade参考TP/SL仓位与限价单，以及实测时solanaTrading=true、banner key存在且off；本轮未新读keeper flags/链上状态，不据历史值声明当前通过。最新playground配置由用户手动验收，旧403不继续作为最新部署已复现阻碍；Privy新登录域名/四钱包证据仍需补齐。
5. **图表与外围收口**：Rainer的TRD85/#3223仍OPEN/Ready、head `c8f9c4a85d`，前轮已接入，无新head，不重复搬运，跟进review及实际图表AC；3273静态列表相关PR仍OPEN/Ready、head `6995d3a0d5`，9 checks成功，跟进review。不能将Depth/完整图表验收自动作为简单交易链的阻塞。

已具源码交付而不需重复等待的前置：71/97/86/98/127 Linear Done；63/#3201、80/#3286、100/#3287、75/#3205以及77/#3314已merged（63/80/100/75/77的Linear部分仍In Review/In Progress），65/#3193也已有release交付但Linear In Test。区分剩余验收和状态收口，不重建已有能力，不升级当前固定WASM到参考协议main来掩盖问题。此前用户暂缓70的payment conversion、最大杠杆、完整simulate_order与GT Rewards仍不自动恢复。

## 五需求最新现状复核（2026-11-22）

本轮只读刷新五条 Linear 正文、关系和评论（均空），核对五个 GitHub PR 当前 head、reviews、checks、mergeability，及直接前置和 API 362/364/365。未改业务、部署、读取环境 key 或操作钱包。本轮仅覆盖指定五条，不评估完整迁移百分比。

| 需求 | Linear | PR / head | 本轮实时结果 |
| --- | --- | --- | --- |
| TRD-77 | In Progress | [#3314](https://github.com/gmx-io/gmx-interface/pull/3314) / `161e89e4a4` | Divhead APPROVED，11月21日06:19北京时间已合入 release；merge `d1e9e1fc4c`，checks成功。Linear未同步完成，不据合并扩大全部链上AC |
| TRD-72 | In Progress | [#3315](https://github.com/gmx-io/gmx-interface/pull/3315) / `fac83d15bd` | OPEN/Ready，REVIEW_REQUIRED，无reviews，MERGEABLE；当前返回6项checks均SUCCESS |
| TRD-78 | In Progress | [#3316](https://github.com/gmx-io/gmx-interface/pull/3316) / `699b6d8e08` | OPEN/Draft，REVIEW_REQUIRED，无reviews，MERGEABLE；当前返回checks均SUCCESS |
| TRD-70 | In Progress | [#3317](https://github.com/gmx-io/gmx-interface/pull/3317) / `b7b2f695d1` | OPEN/Draft，REVIEW_REQUIRED，无reviews，CONFLICTING；当前返回checks均SUCCESS，旧head成功不证明当前合并结果可用 |
| TRD-136 | Done | [#3318](https://github.com/gmx-io/gmx-interface/pull/3318) / `3c507ad2a6` | 持续实验OPEN/Draft，CONFLICTING；当前head只返回两项Pages成功，不能称完整CI全绿 |

实时 release 为 `d1e9e1fc4c`。与上次相比，3195（余额/RPC）、3205（SDK字段/金融计算）、3287（单位换算）、3294（Pay选择器）均已MERGED；3223图表、3293平仓/改单撤单仍OPEN，3293当前CONFLICTING。API362、364、365均已MERGED，main `90df09fd` 已包括slot等待/catch-up快照及增量市场发现修复；本地主目录源码已在前一独立切片同步，但不证明运行服务/线上已升级或负载目标通过。

**新增下游接续缺口**：Divhead 在72提交 `0891747ffc`（fix native SOL funding for atomic TP and SL），随后 `fac83d15bd` 合并release/master。原生SOL原子开仓先使用现有WSOL，只wrap差额；体积不足时仅把钱包自有WSOL包装移到准备交易，订单/escrow/抵押转移仍原子；签名前/广播前校验WSOL快照，费用预留覆盖后续交易。实时读取四个head的builder，只有72含 `wrappedSolBalance`，78/70/playground三者builder blob均为 `e6b32c4c9d252a2130865476e5022362ab01269e`，尚无本修复。下一步应在原72开发线接续上游成果后按72→78→70→136/playground传播，连同最新release冲突处理和组合验证；本轮未实施，不将其他共享路径差异一并宣称审查通过。

最新独立部署沿用11月21日用户自填配置切片：[551b2064](https://551b2064.solana-playground.pages.dev/trade)，source `3c507ad2a6`，此前10项资源hash一致。用户当时要求不查看key并自行手动验收；本轮延续边界，未读取环境文件或验证RPC/页面。旧Alchemy403是更早配置的历史证据，最新配置是否恢复未知，不继续将其写成当前已复现阻碍。Privy新登录、四钱包、限价/改单/撤单/触发、真实原子TP/SL落链及独立金融对照仍缺完整验收。70既定暂缓的payment转换、最大杠杆一致性、完整simulate_order对照、GT Rewards仍保留。136 Done仅对应提前联调切片。

## 五需求前置接续与部署（2026-11-20 深夜）

已按用户授权完成下节建议的代码接续：72 preflight pending修复、3195 `bb85bab5e9` mainnet guard、release `fb69d6dc0c` Express失败通知保护，沿72→78→70既有开发/交付线进入136 `92e34971aa`及playground `1c7acb77f1`；新commit签名G，普通推送，保留PR状态和提交拓扑。3195仍未合并，3293只是前置重建，没有重复覆盖Receive tokenInfo。77及已核实未变来源不重复搬运。

各开发/交付与136/playground运行源码一致；72开发全量3501passed/1skip，136全量3563passed/1skip，72/78/70交付及playground各48tests、types、定向lint通过。136 SDK与playground生产构建通过。已部署[07140b09](https://07140b09.solana-playground.pages.dev/trade)，[稳定页面](https://solana-playground.solana-playground.pages.dev/trade)已更新，24项线上资源hash匹配。

**最终页面验收仍被外部RPC阻断**：Kenny Chrome真实行情/既有限价订单/TP-SL预估正常，余额缺失、表单Unable to load trading data；配置Alchemy应用在三个Origin下均403，服务明确SOLANA_MAINNET未启用。已请求用户启用后复验，不改用其他RPC绕过。另有既存Privy域名CSP限制。部署成功不等于页面全通过、钱包签名或真实订单验收。详细版本、检查与排障边界见[136接续记录](issues/TRD-136.md#前置更新与-playground-接续2026-11-20-深夜)。API362仍未合并/部署，负载目标与完整订单/钱包/金融矩阵继续保留。远端主CI仍运行，playground组件报告发布遇gh-pages并发push冲突，不称全绿。

## 五需求前置增量核查（2026-11-20 22:46 CST）

本轮只读刷新10条直接相关前端PR、release、API main及近期PR，并重读TRD98/84/109/100/129/108/158/107及关键评论。比较基线为今日已集成的3195 `58e343bb14`、3293业务 `0722cc8701`、release `1cd20c1a5a`；未fetch/pull、修改业务、部署、发送交易或外部消息。

- **优先接续3195新提交**：head `bb85bab5e9`，比已集成版本仅新增一笔Preserve Solana network validation and consolidate wallet tests。7文件，runtime主要为rpc.ts记录probe返回的genesisHash，getRpc与账户批量响应返回前assertMainnet；未知genesis仍允许读取，不恢复“必须等健康探测”的依赖。附测试整理及walletTokens注释。当前checks全成功，PR仍OPEN/CHANGES_REQUESTED，无本轮新review；TRD98已Done，Reflectiv于11月20日04:26北京时间评论“Verified on feature branch - looks good”。仅阅读评论文字，未查看三张附件，不将其扩大为精确最新版全矩阵验收。现有playground rpc无该guard；需原72线接续，保护owner/network/slot/余额缓存隔离并传播78/70/136。今日72 `b280eadf75` pending修复也仍需沿同链路接续。
- **3293更新主要为前置重建**：新head `8818b1d46e` 父节点就是70当前 `a54508119b`，TRD84现In Review，PR OPEN/Ready、无reviews、当前checks全成功。新旧业务提交的GmsolOrderActionsProvider.tsx、buildOrderActions.ts逐字一致；PositionSeller与playground相比除空行外仍缺Receive `tokenInfo={isSolana ? receiveToken : undefined}`。不要把diverged compare中的314个历史提交称新增业务，也不整文件覆盖136已有接缝。跟进Sulliven review/原线吸收Receive修复及limit edit/cancel实测，不自行修改他人PR。
- **release新增3302**：最新 `fb69d6dc0c`，20:38北京时间合并；比旧基线4commits/6files，TRD139抽离usePendingExpressTxnNotifications、按relay task去重失败处理，仅回滚该交易自己的debit/pending position。影响SyntheticsEventsProvider、types/utils和order callbacks等共享路径。下轮同步release需验证EVM Express失败通知及Solana共享通知组合；不是新增Solana订单能力。
- **其余已接入前端来源无新head**：3205 `31bb690ebe`、3223 `c8f9c4a85d`、3294 `5e30dbc18f`、3273 `6995d3a0d5`、3287 `24e983c4c4`均OPEN/Ready，当前checks成功；无代码更新可重复集成，重点跟进review/合并。3207仍仅合入3205分支，非release。3271、3325已merged且此前已接入，不再重复列为缺失资源。
- **API/金融边界有新可用结论**：main仍 `678fc2e8d7`，无新main代码。TRD108正文已于19日更新：12组captured positions、精确账户/virtual inventories/clock/prices，与记录Rust `8af1e70c`输出比较，PnL/close impact/closing fee完全一致，liquidation差小于一原生unit-price quantum；不是本轮独立复跑，样本零referral、不含index-token collateral，Rust参考当日未重生成。此前“尚无四项对照”应收窄为已具上述范围证据；GMTrade参考钱包及真实open-with-TP/SL→edit→close单次minContextSlot刷新仍待验收。
- **API362值得跟进交付**：`7bf23fc23d` OPEN，当前两项test checks成功、无reviews，修复共享slot polling独立deadline及catch-up原子发布，10秒freshness/slot floor不放宽。TRD107现In Review，正文仍保留旧CI待完成措辞；本轮GitHub显示CI已通过，但未合并/部署。受控本地模拟负载post-trade p95仍3.030s/4.228s，4 readers重载4.583s且position429为1.45%，不称3秒目标或生产容量通过。API363仅Jest UTC测试配置、CI成功，非前端运行依赖，不为此更新业务SDK/服务。

建议优先级：72最新pending修复与3195网络保护接续 → 同步release共享通知变化并组合验证 → 跟进3195/3293等review与API362部署/负载目标 → 按原授权范围补真实订单矩阵。TRD109仍Todo但冻结LUT已交付，完整reference-wallet/flags/banner验收未据此完成；TRD158仍Backlog，跨Pools/GLV gas检查不是本次交易线顺带扩展范围。

## 五需求最新现状复核（2026-11-20 17:44 CST）

本轮角色为只读状态调查。实时重读五条 Linear 正文、关系及评论（均空），读取五个 GitHub PR 当前 head/checks/review，并对照本地对应交付源码；未开发、部署、签名广播或修改外部协作状态。本轮仅覆盖指定五条，不是全量迁移进度评估，不更新整体百分比。

| 需求 | Linear | PR / head | 送审与当前检查 |
| --- | --- | --- | --- |
| TRD-72（原56） | In Progress | #3315 / `b280eadf75` | Ready，已请求 GMX Interface Devs；无 review；当前全部返回 checks 成功 |
| TRD-70（原19） | In Progress | #3317 / `a54508119b` | Draft，无 review requests/reviews；当前全部返回 checks 成功 |
| TRD-78（原20） | In Progress | #3316 / `390eba5a6c` | Draft，无 review requests/reviews；当前全部返回 checks 成功 |
| TRD-77（原72） | In Progress | #3314 / `161e89e4a4` | Ready，已请求 GMX Interface Devs；无 review；当前全部返回 checks 成功 |
| TRD-136 | Done | playground #3318 / `d930bf0641` | 持续实验 Draft，无 review requests/reviews；当前全部返回 checks 成功 |

全部 PR 仍 OPEN、目标 release，尚未合并。远端 release 为 `1cd20c1a5a`。本次当前 checks 包括主 lint/type/tests、组件、SDK standalone、WASM reproduction、Audit 和两项 Pages，均 SUCCESS；取代上一轮“仍运行”状态，旧 head 的报告发布失败不继续作为当前阻碍。

**新确认的下游缺口**：TRD-72 今日 preflight rejection 修复 `b280eadf75` 已通过全部远端检查；但 78/70 delivery、136 development、playground 均不含该 commit，且实际 `sendOrderTransactions.ts` 均没有新增 `SOLANA_ERROR__JSON_RPC__SERVER_ERROR_SEND_TRANSACTION_PREFLIGHT_FAILURE` guard，不能将旧部署描述为已有修复。下一步应先从原需求线接续，再更新交付/组合验证；本次仅核查，未实施。超时/断连仍需保留未知回执恢复，不能泛化清除 pending。

正式冻结 LUT 与 Divhead 原子准备拆分已于前次实施接入下游并部署，不能继续沿用“可信 LUT 未提供”的旧阻碍。已有四组 unsigned atomic 模拟（1172/1204 bytes）不证明钱包扩展后体积、真实原子落链或 keeper。TRD-136 的 Done 对应提前真实交易测试切片，历史 Phantom 市价开仓、平仓闭环不替代四条正式需求全部 AC；当前独立部署仍为 `19b0c9a4` / `d930bf0641`，本轮没有重新请求页面或链上资源，部署/UI/链上证据沿用前次注明日期的记录。

剩余重点：接续最新72修复；完成两条 Ready 的正式 review，并推进78/70自审送审；按用户授权恢复真实限价/edit/cancel/trigger、原子TP/SL与四钱包矩阵。70既定暂缓的payment-to-collateral swap、最大杠杆一致性、完整simulate_order对照、GT Rewards仍未完成，不因136 Done或CI全绿豁免。

## 独立 playground 已更新（2026-11-20）

用户后续明确授权部署，已将d930bf0641发布至既有个人Pages环境：[稳定地址](https://solana-playground.solana-playground.pages.dev/trade)、[固定部署19b0c9a4](https://19b0c9a4.solana-playground.pages.dev/trade)。两地址各11项关键资源哈希匹配本地构建，Kenny Chrome真实BTC行情/图表/余额/空仓位和原生刷新通过；无签名广播。已更新#3318部署证据，详见[TRD-136记录](issues/TRD-136.md#独立-playground-更新部署2026-11-20)。本节取代下方本轮实施时“尚未部署/需部署授权”的时点状态。

## 五需求上游接续实施（2026-11-20）

用户授权执行 Kenny 可推进的事项。本轮已在原开发线合并核验过的上游，再更新对应现有交付线；保留 commit 拆分、原拓扑与已有 Ready/Draft 状态，不代改其他负责人 PR，不修改 Linear 或发群消息。

- 72 接续 Divhead 的 c59c5fc672 原子准备逻辑和 release 1cd20c1a5a，合并 #3195 58e343bb14、#3205 31bb690ebe。消费者改用迁移后的 useGmsolWalletBalances；交付历史合并残留的8个旧 hook/test路径删除，canonical实现保留。
- 78 合并72并保留 trackingRequests、receipt、未知回执恢复、真正刷新错误与最低slot保护。70继续接续78，保留release permit规则和Solana gate，更新canonical余额hook；TPSLInputRow旧fixture改用release新的collateralAmountInIndexTokens契约，原价格/PnL断言保留。
- 136/playground 合入上述交付，以及 #3294 5e30dbc18f 正式Pay tokenInfo和 #3223 c8f9c4a85d 图表revision/refetch；保留balance injection、isSyncing、手动Retry。平仓合并的重复isTwap声明在原136修复后精确转入playground。
- 删除playground空LUT运行时override及插件，使用release冻结LUT；增加unsigned atomic诊断选项。其余正式候选head未变，不重复集成。77无新head/代码动作需求。
- 四组真实RPC unsigned atomic模拟全部通过：市价多/空1172bytes，限价多/空1204bytes，均低于1232。另按用户此前具体BTC市价多意图（5USD、2.498094USDC、TP70000、SL60000）复现，1172bytes、slot471575759模拟成功。相对价格四组slots471575138/152/166/173；全部signed=false、broadcast=false，仅模拟，不证明Phantom Lighthouse扩展后体积、落链与keeper。

当前各开发/交付src/sdk/landing/yarn.lock一致。72前端3510passed/1skip，SDK1025passed；78前端3530passed/1skip；playground关联34文件309tests通过。交付72/78/70分别178/215/236关联tests通过，实际交付与136/playground app+landing类型检查通过，变更TS零warning lint通过。136实际SDK重建通过，playground生产构建8GiB成功，产物包含两张正式冻结LUT。Kenny原生Chrome在127.0.0.1:3016读取真实DOGE/BTC图表、USDC余额45.08和暂无仓位，BTC TP70000/SL60000输入及PnL显示正常，刷新后空仓位/余额恢复、金额输入清空；没有点击提交/签名。UI固定9.5x设置会随保证金联动仓位，因此不将该页面样本写成5USD精确交易；精确5USD样本仅为前述unsigned模拟。

70最终全量3538passed/1skip，语言初始化和WASM编码两项5秒超时；单worker、命令级30秒timeout补跑两文件59tests通过。136最终全量3551passed/1skip、语言初始化5秒超时、两个worker启动超时；单worker正常timeout补跑语言、useSizeConversion、usePositions三文件60tests通过。因本机资源竞争及调度，保留全量异常记录，不称一次全绿，也未修改断言或产品校验来消除超时。

新head：72开发2e5db35310/交付15f50b87d2，78开发334e53fbc1/交付390eba5a6c，70开发cc6cf57b5c/交付a54508119b，136开发5f5ffd79c9/playground d930bf0641。开发已推my-gmx，四条交付已推origin并更新原#3315/#3316/#3317/#3318正文；本轮新增Kenny commits均GPG G，上游已有签名/历史原样保留。77仍161e89e4a4，无新增补丁。3314/3315保留Ready，其余保留Draft，未请求reviewer/合并/修改Linear。本次收尾CI观察：3314全成功；3315组件/WASM/SDK/审计/两个Pages成功、主测试仍运行；3316/3317/3318仍有主测试/组件/WASM或重复事件任务运行，已返回项未见失败，不能称全部全绿。未因旧head gh-pages报告冲突重跑无关历史任务，新head自行生成检查；后续在交付/收到失败信号时刷新，不承诺常驻监控。部署和钱包签名/广播仍需独立授权；四钱包、limit/edit/cancel/trigger、真正原子落链与keeper及独立金融对照不因本轮模拟而完成。

## 五需求可跟进的上游增量（2026-11-20）

用户要求列可更新依赖及跟进事项。本轮补查12条直接相关PR状态/checks，比较136已记录集成head到最新head的增量，未实施业务。除前节冻结LUT/72新builder外，新增如下：

- #3294 `2ad1f8971a`→`5e30dbc18f`，唯一新commit fix Solana pay token selectors，实际diff在TradeBox.tsx/MarginField.tsx各加tokenInfo={infoTokens[fromTokenAddress]}。正式PR已提供136对应Pay临时接线，可比较等效后纳入正式来源并移除重复归属；不能声称已同步或已完成手测。OPEN/Ready，6项返回checks成功。
- #3195 `372e7ff471`→`58e343bb14`新增4commits：wallet recovery/price freshness、cancelled RPC probes、wallet loading简化、reads independent of health probes；涉及provider/hook、shared RPC/fallback tracker及测试20文件。OPEN/Ready，reviewDecision仍CHANGES_REQUESTED；最新主CI失败日志为SDK markets.spec.ts:31测试15秒超时（994passed/1failed），不是组件报告问题，也不能凭此认定业务逻辑缺陷或CI全绿。可跟进原作者修复/验证及群里Reflectiv桌面移动手测，集成需核对session/owner/network/freshness保护。
- #3223 `beaa4d28dd`→`c8f9c4a85d`新增fix Solana chart revisions and position retries（7文件，含provider/token/raw market/chart fetcher），OPEN/Ready，6项返回checks成功；与136保留retry/slot保护有交集，应精确组合验证，不整文件覆盖。
- #3207 `6bb15c691f`已11月19日22:03北京时间MERGED，但目标是#3205的fesol-113-fee-discount-fields分支，非release。#3205 `baed302cb0`→`31bb690ebe`已合并order fields并consolidate Solana SDK updates、包含nested order parsing及release/LUT更新；OPEN/Ready、6项checks成功。不能把3207 merged称所有order字段已进入release。其增量包含大量release提交，应分开基线同步和业务parser差异，避免复制无关变化。
- #3271已合入release，136原已集成同head cb6f535c9b，仅更新来源状态，无新业务补丁；#3287仍24e983c4c4、#3293仍0722cc8701、#3273仍6995d3a0d5，均OPEN/Ready且当前返回checks成功，没有新head可重复集成。#3293未新增136 close Receive selector接缝的正式替代。

后续可先在原需求线接续72新冻结表/atomic准备，精确同步78/70，再汇入136，比较3294等效补丁并逐项吸收3195/3205/3223增量；按来源处理冲突并复验目标。未发布评论、请求review、重跑CI、变更Linear或部署。原有完整金融/四钱包/原子链上矩阵仍待验收，不把接入候选代码等同前置已合入或已验收。


## 群聊补充后的 LUT 状态更正（2026-11-20）

用户提供11月19日群聊截图，包含Divhead提交#3325、Quinn批准，以及3294/3195交Reflectiv手测。由此定向刷新，取代下节仍把可信LUT列为未提供资源的过期判断。GitHub确认[#3325](https://github.com/gmx-io/gmx-interface/pull/3325)由qwinndev APPROVED，于11月19日21:32:51北京时间MERGED，merge commit `1cd20c1a5a`；所有返回checks成功。只改lookupTables.ts地址。

Solana CLI显式mainnet-beta/finalized只读重验：新表`GtCrmXDriRQTtzeFqrJkiVxrjeUoRGkhLVH3rcEySb4o`、`TackgvLbopMf7HwUdDEvJZvMCJufJo1nHTaYP6TGJdM`均authority=null、deactivationSlot=u64 max，分别73/155地址，与原CoML/CVHq表逐项同序相等。旧表仍原authority。本输出无context slot，不把lastExtendedSlot当读取slot。冻结与完整复制已有当前链上证据，不再要求Divhead提供尚不存在的新资源。

读取远端各固定head配置：release及72 `c59c5fc672`已用新表；78 `164102b83c`、70 `2bc3392a65`、136/playground `2b53b1933e`仍旧表，playground另有无LUT构建覆盖。72保留空expected-authority map，冻结表无需由该map证明可变authority归属，不能把空map本身继续报为冻结表阻碍。当前剩余是下游接入新配置、评估撤除实验覆盖，并核对真实交易体积/模拟及约定主网矩阵；未开始实施、部署或签名。

TRD109 Linear仍Todo，但已不能据此判断LUT未交付；reference wallet、flags/banner等完整AC本轮未验收。#3294当前OPEN/Ready head`5e30dbc18f`，无reviews；#3195 OPEN/Ready head`58e343bb14`，保留历史changes-requested reviews。两者均比136记录的已集成旧head前进；群里交手测/Reflectiv答应稍后检查不证明手测完成，本轮未实质审查两条新diff、未判定已解决临时选择器接缝，也未联系他人。


## 五需求当前状态复核（2026-11-20）

角色：只读状态调查。官方 Linear MCP 重读五条正文、关系、评论（全部无评论）；GitHub 实时读取 head、checks、review requests/reviews、全部 inline threads（均空）及最新提交。70/72/77/78 均 In Progress，136 Done，负责人均 Kenny；五 PR 均 OPEN、base release、未合并。只更新个人知识，无业务、Linear、PR、CI、部署或钱包写入。

| 需求 | PR / head | 送审状态 | 当前返回 checks |
| --- | --- | --- | --- |
| TRD-72 | #3315 / `c59c5fc672` | Ready，已请求 GMX Interface Devs，无 review | 全部成功 |
| TRD-70 | #3317 / `2bc3392a65` | Draft，无 review requests/reviews | 全部成功 |
| TRD-78 | #3316 / `164102b83c` | Draft，无 review requests/reviews | 保留两个失败记录；同 head 后续主检查成功，组件报告发布仍红 |
| TRD-77 | #3314 / `161e89e4a4` | Ready，已请求 GMX Interface Devs，无 review | 全部成功 |
| TRD-136 | #3318 / `2b53b1933e` | 持续实验 Draft，无 review requests/reviews | 全部成功 |

重要新增：Divhead 在 2026-11-19 22:42:58 北京时间提交 #3315 `c59c5fc672`（merge release and keep LUT-backed orders atomic），合入 release `1cd20c1a5a`（本轮最新远端）。定向 diff 显示：组合超过1232bytes时，可把 prepare_user/prepare_position/钱包 ATA 准备移到前一交易，所有 create orders、escrow setup 与 collateral transfers 仍留最终同一交易；validator 限定前置准备交易，新增回归覆盖结构、keeper费用分配、越界指令及准备失败不签订单。当前 CI 全成功，但本轮没有独立重跑测试/完整 review 或真实钱包/LUT验收，不承诺用户1260bytes具体样本已解决。与3316/3317/3318的GitHub compare均diverged，新72 head不是这三条head的祖先；不能把72新实现当作已部署到playground。其余四PR观察baseRefOid仍0bc6c2ba2d；本轮未fetch/同步任何分支。

3316主检查44456991427失败在SDK公网fetchMarkets AbortError（49passed/1failed/2skipped），同head后续44458778436成功；组件44456991459的286测试通过，失败仅报告push gh-pages被fetch-first拒绝。本轮直接重读失败日志，未重跑CI。3314/3315的mergeable=MERGEABLE、mergeStateStatus=BLOCKED且REVIEW_REQUIRED；其余三条mergeable返回UNKNOWN，不据此断言冲突。

仍沿用固定版本历史证据：Phantom市价开/平、keeper执行、余额/slot刷新，以及playground TP/SL输入修复和84fd2a81部署。正式可信LUT、四钱包、limit/edit/cancel/trigger、原子TP/SL及完整金融矩阵没有新的完成证据；本轮未刷新链上authority或线上服务。70支付转换/最大杠杆一致性/完整simulate_order数值对照/GT Rewards继续暂缓。136 Done表示提前联调环境切片，不表示全部原需求验收完成。3315正文仍写旧release/旧3259及Draft固定措辞，与实时状态不一致；3316/3317仍有旧依赖PR链接，本轮未改外部正文。


## 下一条正式 review 推荐（2026-11-19 15:13 CST）

本轮角色为只读就绪分析；范围限定用户五条 PR，实时读五条 Linear 正文/关系/评论、GitHub PR/checks/review 和 release，并定向核对订单生命周期及通知代码；未做全量迁移需求调查、完整代码 review、构建、UI 或链上验收。五条 Linear 无评论，70/72/77/78 仍 In Progress、136 Done。

推荐下一条为 [TRD-78 / #3316](https://github.com/gmx-io/gmx-interface/pull/3316)，head `164102b83c`。#3314（TRD-77，`161e89e4a4`）与 #3315（TRD-72，`b5c1bc3f78`）已非 Draft，均已请求 GMX Interface Devs、尚无 review，当前返回 checks 全成功；这取代先前把77作为下一条送审的判断。#3316/#3317/#3318仍Draft、无review requests或reviews；3316无review threads。未修改任何 PR/Linear 状态或发送消息。

78提供创建回执身份识别、订单全生命周期RPC证据、提交/成交分离、取消reason、通知和slot-aware刷新。与当前72的直接tree差异为30文件（含10份翻译及较大固定fixtures/layout），范围较70集中；两条分支有独立重建历史，不能将这份tree差异称作GitHub三点比较或声称72 head是78祖先。读到的reader/reducer要求creation anchor、完整history与匹配trade/removal，证据不足保持unresolved；通知消费者保留owner/network/unmount guards和trackingRequests路径。原有Phantom市价开/平仓及Order filled是历史组合消费证据，不证明当前head全部AC，尤其真实取消reason、延迟/未知回执及完整钱包/LUT矩阵。

3316主检查 [44456991427](https://github.com/gmx-io/gmx-interface/actions/runs/44456991427)失败在SDK公网data.spec.ts fetchMarkets的AbortError（49 passed/1 failed/2 skipped）；同一head后续 [44458778436](https://github.com/gmx-io/gmx-interface/actions/runs/44458778436)成功。组件 [44456991459](https://github.com/gmx-io/gmx-interface/actions/runs/44456991459)日志明确286 passed，失败在gh-pages报告push被fetch-first拒绝；不能称当前全部checks绿，也不能说组件用例失败。送审前宜收口报告检查或清楚披露，并刷新正文中的旧#3258/#3259/#3261引用及Draft固定措辞；本轮未重跑CI或改正文。

70/#3317 head `2bc3392a65` 当前checks全成功，但依赖72/78，且支付转换、最大杠杆一致性、完整simulate_order数值对照、GT Rewards仍属既定暂缓；本日TP/SL输入修复不等于原子落链验收，因此排78之后。136/#3318 head `2b53b1933e` 当前checks全成功，仍为持续集成实验Draft，包含多条正式候选与临时无LUT等支持，不作为下一条正式生产送审对象。

远端release已到 `2c107c63a13f3a61e7e556edb7bbc5861cc1c3e9`（#3241 gas-token permit），比五条PR所观察base `0bc6c2ba2d`多3 commits。19文件变化含TradeBox/useTradeButtonState，与70改动相交；78生命周期核心路径无直接同路径变化，但这不是合并后验收或无冲突保证。准备正式收口时按受影响范围同步/复验，当前仅线上读取，无fetch/pull或分支修改。结论是优先申请78的代码review，仍需前置PR合入和运行验收后才能决定合并/完成。

## 五需求实时状态复核（2026-11-19 10:27 CST）

角色：只读状态与 CI 排障核验。通过官方 Linear MCP 重读五条需求正文、关系及全部评论（均为空），通过 GitHub 读取当前 PR head、checks、reviews、全部 review threads 和 #3314 状态事件。远端 release 为 `0bc6c2ba2d57ff9b1c1c3135e6da6433ef6e438d`。五条负责人均为 Kenny；72/70/78/77 仍 In Progress，136 仍 Done。当前五个 PR 均为上游仓库内分支、base release、OPEN/未合并、MERGEABLE；reviewDecision 均 REVIEW_REQUIRED，mergeStateStatus 均 BLOCKED，无 reviews 或 inline threads，现有评论仅部署/测试机器人。

| 需求 | 当前 PR / head | PR 状态 | 当前 head checks |
| --- | --- | --- | --- |
| TRD-72 | [#3315](https://github.com/gmx-io/gmx-interface/pull/3315) / `c1473bbee4` | Draft | 全部成功 |
| TRD-70 | [#3317](https://github.com/gmx-io/gmx-interface/pull/3317) / `c4347d2577` | Draft | 组件 job 失败，其余成功；测试本身 286 passed |
| TRD-78 | [#3316](https://github.com/gmx-io/gmx-interface/pull/3316) / `5da468c4a3` | Draft | 组件 job 失败，其余成功；测试本身 286 passed |
| TRD-77 | [#3314](https://github.com/gmx-io/gmx-interface/pull/3314) / `161e89e4a4` | Ready | 全部成功 |
| TRD-136 playground | [#3318](https://github.com/gmx-io/gmx-interface/pull/3318) / `ca6fa8f824` | Draft | 全部成功 |

#3314 timeline 显示 kenny-7100 于 2026-11-19 10:16:44 CST 转 Ready；这是本轮观察到的外部变化，本轮没有更改 PR 状态。各 head 与迁移记录一致。五个 PR 的 app/home Cloudflare 检查均成功。

#3316 [run 44436927125](https://github.com/gmx-io/gmx-interface/actions/runs/44436927125)、#3317 [run 44436962408](https://github.com/gmx-io/gmx-interface/actions/runs/44436962408) 的实际日志均确认 Run component tests 成功（各286 passed），artifact 上传成功；失败仅在 Deploy report to GitHub Pages：push gh-pages 被拒绝 `(fetch first)`，远端分支已前进，符合并发报告发布竞争。不是旧 fork 权限错误，也未发现测试断言失败；但整体 job 仍红，不能称全部 CI 通过。本轮仅诊断，未重跑 CI 或修改 workflow。

验收边界沿用各 issue：Phantom BTC 市价开/平仓、keeper 成交、余额及 slot-floor 刷新已有固定版本历史证据，本轮未重新执行。完整四钱包、可信生产 LUT、限价创建/编辑/撤单/触发、原子 TP/SL 及金融矩阵仍未完成；用户已要求暂不创建新订单。TRD-70 原暂缓 swaps/max leverage/full simulate_order/GT Rewards 范围不恢复。TRD-77 Linear 正文 v0.10.0 与已确认 0.11.0-beta.1 选择的差异沿用既有决定。Linear blockedBy 关系不等于每项前置当前未完成，本轮未扩展调查全部前置。不改 Linear、业务、部署或钱包，不发布外部评论。


## 保留多提交的上游 PR 迁移完成（2026-11-19）

用户明确要求所有仍开放的 fork PR 改为上游仓库内分支，并保留多个 commit，仅补 GPG 签名；追加要求 TRD-77 恢复原多提交。未 squash、未改业务、未批量同步 release。冻结旧 head 并保存备份后，用逐提交原 tree/message/author/日期及映射后有序父节点重建签名历史；有效签名且父节点未变的提交原样复用。全部旧到新映射逐一核对 tree 和 parent order，最终 tree 一致；远端逐 PR commits API 核对数量及 GPG verified，head/base 均为 gmx-io/gmx-interface，保持 Draft、无 reviewer 请求。4 条旧 PR 均无 reviews/comments/review threads，迁移后关闭旧 PR，未删 fork 分支。

| 需求 | 原 PR | 当前上游 PR | commit 数量 | 当前 head |
| --- | --- | --- | --- | --- |
| TRD-72 | #3258（已关闭） | [#3315](https://github.com/gmx-io/gmx-interface/pull/3315) | 25 → 25 | `c1473bbee4` |
| TRD-78 | #3261（已关闭） | [#3316](https://github.com/gmx-io/gmx-interface/pull/3316) | 31 → 31 | `5da468c4a3` |
| TRD-70 | #3262（已关闭） | [#3317](https://github.com/gmx-io/gmx-interface/pull/3317) | 46 → 46 | `c4347d2577` |
| TRD-136 playground | #3288（已关闭） | [#3318](https://github.com/gmx-io/gmx-interface/pull/3318) | 26 → 26 | `ca6fa8f824` |
| TRD-77 | #3314（沿用） | [#3314](https://github.com/gmx-io/gmx-interface/pull/3314) | 原 5 个恢复 + 1 个 release merge，共 6 个 | `161e89e4a4` |

Playground 原 26 个 commit 均已签名，整支 SHA 不变，仅迁移来源仓库。TRD-77 最终 tree 与单提交版本2733850a2f一致，保留其最新 release；另三条最终 tree 各与原 head 一致，不把此次历史变更说成同步了最新 release。迁移不影响原开发线或线上部署；交付 registry 已 rebind 至 origin/当前 PR。无源码/依赖/配置变化，不重跑业务测试，依据逐提交和最终树一致性复用已有同内容验证；新 PR CI 单独观察。当前 PR 之间的历史来源 SHA/旧 PR 链接作为来源证据保留，不能用合并签名历史替代独立 review/验收。个人基础记录不带入业务 PR。

## Kenny 当前开放 PR 来源核对（2026-11-19）

按用户要求查询 `gmx-io/gmx-interface` 中 author=`kenny-7100`、state=open 的全部 PR（limit 100，实际 5 条），逐条核对 headRepository 与 isCrossRepository。仍有 4 条来自 `kenny-7100/gmx-interface` fork：TRD-72 #3258（05a48d0a97）、TRD-78 #3261（00f93d0687）、TRD-70 #3262（bd8e81e020）、TRD-136 playground #3288（ca6fa8f824）；全部 Draft、base=release。TRD-77 已为上游仓库内 #3314（2733850a2f），旧 fork #3259 已关闭。本轮只检查来源，未迁移或关闭这 4 条，不扩大为历史 closed/merged PR 或其他仓库的全量调查。后续交付统一使用上游 origin 仓库内分支，迁移时核对各自签名、head、现有讨论和唯一交付记录。

## 五需求正式 review 就绪判断（2026-11-19 00:41 CST）

用户要求列新旧issue、PR、状态和上游依赖，并判断最适合正式送审的一条。本轮仅查询，不转Ready、不请求reviewer、不修改Linear，也不继续未授权限价交易。实时Linear正文/关系/评论与GitHub原PR复核：72/70/78/77均In Progress，136为Done；五份PR均OPEN/Draft、base release、无reviews与review requests。新旧对应仍72←FESOL56、70←FESOL19、78←FESOL20、77←FESOL72，136无旧编号。各PR head与本轮交付一致。正文更新触发的同源码CI仍有运行项，不能称此刻所有checks已结束；上批同head验证和组件报告403证据仍按前节限定复用。

关键上游：TRD100 In Review/#3287 OPEN非Draft；TRD98 In Test/#3195 OPEN非Draft且CHANGES_REQUESTED，旧#3190 CLOSED未合并，其reader/hook已由3195承接；TRD109 Todo/Divhead，无新地址或评论，正式LUT/参考钱包/flags完整验收未完成。71/97/86/127均Done；97#3110、86#3138已merged。75/63/80仍In Review，但#3242/#3201/#3286实际已merged入release；129 Done，API#340已merged/deployed，前端字段扩展#3205 OPEN非Draft、#3207 OPEN/Draft且base仍为3205分支。108 In Progress，剩同快照金融参考和完整交易后验收。136额外集成来源84 In Progress/#3293 OPEN非Draft、142 In Progress/#3294 OPEN非Draft、85 In Test/#3223 OPEN非Draft、49 In Review/#3273 OPEN非Draft，均未合并。已接入源码不等于上游已review/merged。

首选TRD77/#3259进入正式review：GitHub精确changedFiles=18、无review threads，实际diff只包含固定产物、构建/复现/完整性配置及加载回归；不携带72/78/70交易实现。已核对manifest/toolchain/CI/构建时逐文件hash保护与真实部署WASM，Phantom开仓和平仓消费样本现已具备。Linear blockedBy72仍成立于完整主网验收，不能把可先评审产物切片说成完整Done或立即可合并。issue旧标题v0.10.0不覆盖用户已确认的0.11.0-beta.1实际版本。

最新远端release为`0bc6c2ba2d57ff9b1c1c3135e6da6433ef6e438d`，较当前交付已同步的38b1503444新增4提交/#3278、32文件Tooltip设计系统修改；与77的18文件无交集，对70/84共享TradeBox/PositionSeller/OrderEditor等路径有交集。查询本轮未fetch/merge或重新验证该新组合。正式送审前可同步最新基线并核对新head适用检查，不能用旧head结果冒充同步后通过。136为持续集成playground，保持Draft承接实验，不作为最先转Ready的正式产品PR。后续主线候选为72（先收敛单位/余额与LUT/矩阵），再78和70。

正文更新触发的同head重跑已全部收尾：77的Run Tests `44349393595`（含SDK standalone）和Audit `44349393512`已success；playground的Run Tests `44349255949`与Audit `44349256171`也已success。随后直接读取72/70/78的Run Tests `44349295584` / `44349263920` / `44349241902`，均已completed/success，主检查与SDK standalone两个job均成功；78曾较慢，已观察其从前端测试推进至SDK、public e2e和Post收尾后成功，没有重启任务。四条正式需求仍保留此前组件报告发布403失败，不称全部checks全绿。五份PR仍Draft，head未改变。这些结果绑定既有head，不证明最新release `0bc6c2ba2d`组合已验证。

后续只读链上复核已取得新证据：正式配置两张LUT在mainnet-beta/finalized读取时均仍有authority、active且非frozen，expected-authority map仍空；不是继续沿用旧mutable观察。具体公开authority及slot边界归[TRD-109原记录](issues/FESOL-71.md#正式配置-lut-链上复核2026-11-19)。因此完整正式LUT验收仍受外部条件阻碍，实验无LUT开/平成功不解除该条件。用户随后明确“先只保留平仓验收，暂不创建新订单”；限价59000→58500→撤单方案暂缓，尚未创建订单，不继续请求该组钱包确认。

## 五需求跟进实施（2026-11-18 深夜）

接续用户创建的持续目标，本轮从只读核查进入原线修复和交付。该节优先于下方23:12“尚未实施”快照；真实交易矩阵仍未完成，目标保持active。

- **TRD-72**：接入#3195新增`372e7ff471` token-address/chain React key；原开发`871140c086`、原交付`ed4209dac7`。不新增reader，不改变抵押资格。
- **TRD-78**：从72原修复接入Lighthouse，合并import时同时保留`TrackedOrderAction`与新增validator；开发`7f457d56a1`、交付`3d785b4886`。sender/validator/transaction-spec与136逐blob一致，保留跟踪和恢复。另接地址key。
- **TRD-70**：接入同一Lighthouse修复及78失败原因展示，开发`0783f618bf`/`da2e88130b`，交付`31f0eea678`/`462ee1f834`；另接地址key。不恢复swap/max leverage/完整simulate_order/GT Rewards暂缓范围。
- **TRD-77**：本轮仅同步release；独立交付仍18文件，产物source/pin/hash/recipe不变，不重复Rust重建。实际consumer已通过的样本不能替代72完整主网矩阵。
- **TRD-136/playground**：精确接入地址key，README移除旧公网缺失与正式平仓路径未接入的描述；已具备84/142/85/49来源head未变，不重复搬运。当前代码未重新部署，线上已验证版本仍`41092fae55`/`cd9dad15`。

交付时发现release已前进至`38b1503444`（multicall/GLV、treasury、Receive文案、GT图标），已用签名merge同步个人基础及五条原development/交付。没有整支业务回流基础。72/78/70开发与对应交付、136与playground的src/sdk/landing/lock逐项一致；77独立交付刻意不包含开发集成中的其他业务。所有本轮新增提交GPG验证G，各现场clean。

**公网契约新增证据**：正式HTTP账户positions/orders分别200，最小slot样本返回不低于请求floor；实际当前`GmxApiSdk`消费公网得到1仓位/0订单，position/order slot同为470991501，position/fee bigint解析成功。fee-discount成功但无slot头，不据此认定其违约。忽略目录仅保存本机原始账户样本，公共文档不复制金融明细。这个单账户只读样本不证明独立同快照四项金融输出或新交易后刷新；尚未停用本地API/DB/indexer/reader。

**真实操作边界与下一步**：在用户已有Kenny原生Chrome、旧部署仅打开现有BTC多仓100% Close弹窗，未点Close Long、未进入新钱包签名/广播。下一步先部署本轮已验证构建（另授权），再真实平仓，核对请求/keeper、到账余额、仓位移除及刷新；再补限价编辑/撤单/触发和TP/SL。用户亲自最终签名。TRD-109无新可信LUT地址，未新读authority；正式LUT、四钱包及原子矩阵继续保留。无Linear写入、他人PR修改、上游合并、Ready/reviewer或外部消息。

验证与推送收尾（11月19日00:04 CST）：24项串行检查全部通过，另有70/78原development全量与release受影响检查。72原development完整3457/1skip（release前），78完整3478/1skip（release前）及release后9项，70 release后完整3487/1skip，136完整3516/1skip；实际72/78/70 delivery分别32/38/38项，77 development28项/独立delivery9项，playground38项。相关目标app/landing types与定向零warning lint全部通过。136/playground检查过程中的最后差异仅README，runtime不变；playground最终`ca6fa8f824`的8GiB build-playground通过（既有annotation/bundle警告）。

| 需求 | development | delivery / Draft |
| --- | --- | --- |
| TRD-72 | `00907a04d1` | `05a48d0a97` / #3258 |
| TRD-78 | `f5b2ed7ecf` | `00f93d0687` / #3261 |
| TRD-70 | `ed312d0e27` | `bd8e81e020` / #3262 |
| TRD-77 | `c70a3d77d1` | `6e2dd5f81c` / #3259 |
| TRD-136 | `87cc9d5ce4` | playground `ca6fa8f824` / #3288 |

十个远端head已用ls-remote与本地核对一致，development推my-gmx、delivery/playground推my-gmx-pr；全部clean，原任务登记/当前context已重绑，不创建新TRD重复记录。五份原Draft正文已按当前最终行为与证据重写，删除旧公网缺失/等待签名信息差，保留真实历史部署及完整AC边界。当前head远端CI仍在运行，不能复用旧head绿灯或旧403归因；具体快照/log保存在忽略目录`.local/five-followup-20261118/`，尚未记录本轮全绿。

### 本轮交付与发布收尾（2026-11-19 凌晨）

正式平仓后续已闭环：用户确认过期后明确重试，新请求471002026与keeper471002042均finalized/err=null，8条Lighthouse断言成功，owner实际到账9.515259USDC；页面Order filled、0仓位，余额31.46302USDC。刷新时首次API stale503/页面加载错误随后自动恢复，当前SDK以keeper slot作floor读得positions0/orders0、两slot均471002755，fee bigint正常。真实部署WASM下载hash与77固定产物相符。证据和公开签名归[136闭环记录](issues/TRD-136.md#正式平仓到账与刷新闭环2026-11-19)，72/78/70/77各自记录已接续。该结果只覆盖单Phantom市价平仓/数据恢复，不完成完整金融或四钱包/原子矩阵。

五个current head的本轮远端检查均已结束：72/78/70/77各7项success、1项组件报告job失败。逐份读取本次run44341583738/44341631730/44341650779/44342579681日志：72/78/77为286passed，70为285passed+1flaky（重试通过，测试步骤success），失败在Pages报告push/评论403；不称整体全绿。136/playground `ca6fa8f824`全部8项success，main44342868735前端3516/1skip、SDK1011、multicall14/1skip、public50/2skip。

用户已明确授权部署及发起现有约20USD/2x BTC多仓100%平仓Phantom确认，最终用户签名。CI成功后部署[4f3109d8](https://4f3109d8.solana-playground.pages.dev/trade)，稳定别名已更新，HTML/entry/bootstrap/交易chunk的SHA256与本地一致。#3288同步发布证据；正文修改可能触发同源码重跑，既有current-head检查仍适用。原生Chrome切窗控制恢复及最终金融交接详见[136](issues/TRD-136.md#本轮部署与平仓授权2026-11-19-凌晨)。不重复询问已有授权，不扩大到新限价或TP/SL交易；持续目标active。

本地配置简化结论：常规playground真实交易已走正式公网API/RPC，不需要先启动本地Docker、DB、indexer/reader或RPC代理；`build-playground`保持这条现有路径，无需再造启动器或改公共host。`web.mjs`明确只接受loopback HTTP，是隔离诊断入口，不改成公网通用启动器；本地API保留用于固定版本复现、受控stale/minContextSlot故障与排障，不是日常交易前置。单账户只读契约成功及一笔开仓还不足以删除这些诊断工具或把既有本地服务直接停掉；本轮没有接管/停止原服务。无LUT仍是单独实验条件，不能随API已部署一并视作可退役。

## 四需求与 TRD-136 最新跟进核查（2026-11-18 23:12 CST）

本轮仅调研：实时读取四条需求与136、直接资源/数据依赖的Linear正文与关系及相关评论；核对原PR、关键前置PR和当前head检查，搜索当日更新PR；按真实worktree源码比较缺口，并探测公网config/values。原始GitHub快照位于忽略目录 `.local/five-upstream-20261118/`。未改业务、更新需求分支、重跑测试、操作钱包、部署或修改线上记录；fetch仅取回#3195新head供比较。

release远端仍 `28ddd42ce6ff50aa92a30eb00122b25970e3bf99`，无新release基线要同步。四条原Draft仍OPEN/MERGEABLE/REVIEW_REQUIRED，无review或评论；Linear为70 In Progress、72 In Review、78/77 In Progress，四条均无评论。PR heads：72/#3258 `b0fae7d1f2`，78/#3261 `0c50b8d579`，70/#3262 `532c8c050d`，77/#3259 `e164801e28`。各自常规/SDK/WASM/Audit成功，组件workflow失败；沿用此前已核实的相同head/run报告发布403边界，本次未重读相同日志，不称全绿。playground/#3288 `41092fae55` 所有返回检查成功，仍Draft，无新review。

当前可精确接续的三项：

1. **72修复尚未传到78/70**：78原dev/delivery与70原dev/delivery的sender blob均 `2444fc81ad`，仍逐字节比较签名前后message；72原dev `2155ca121f` / delivery `b0fae7d1f2` 已实现受限Lighthouse校验，136/playground也已接入（sender `6456abbf1c`，保留tracking）。应先在78原开发线语义接续72修复，保留trackingRequests/receipts，再精确传入70原线及原交付，不整文件覆盖。136/playground无需重复接入。
2. **78失败原因展示尚未传到70**：78原dev `25affe5753` / delivery `0c50b8d579` 通知blob `cbb9c5dc43`，70仍 `cde61bdab1`、无reason接线。接续现有修复即可；136/playground已有新版本。
3. **TRD-98/#3195新提交**：已集成 `666fa1669a` 到当前 `372e7ff471` 只有一笔提交、一个文件：给DisplayToken补address，并将资产行key从symbol+chainId改为address+chainId，同时覆盖GMX Account与Solana映射。72/78/70/136/playground均仍旧key。可复用上游小补丁并检查共享消费者，不另写reader或整支引入wallet历史。#3195全检查成功但仍CHANGES_REQUESTED；#3190于11月18日17:49关闭且未合并，不等于进入release；#3195仍包含已集成reader/hook成果。未resolved旧ATA线程不证明缺陷仍在，已有Divhead修复确认；rpc-debug/测试清理等review由原作者与reviewer收口。

其他上游推进与136后续：

- **公网API已推进**：TRD-108已In Progress并明确#340已部署、SDK2.9.3和gmsol字段已实现；API#352数据库切流、#354/#355/#356修复也已merged。本轮公网config HTTP200、67/67 `tradeMath=gmsol`；values HTTP200、67条。两次响应未返回X-Solana-Slot，本次未查账户接口，不能从市场路由推定账户slot契约通过或失败。旧“67市场/0gmsol”不再是当前阻碍。本地API可保留隔离诊断用途；停用前先核对最终host账户/费用/最小slot与组合刷新，不因config成功自动拆环境。
- **金融与交易后验收**：TRD-108仍保留独立同快照PnL/close impact/closing fee/liquidation对照、GMTrade参考钱包、open-with-TP/SL→edit→close每步minContextSlot刷新验收。不能以parser/index或SDK单测替代；136既有新旧页/同输入比较仅覆盖其记录范围。
- **正式资源**：TRD-109仍Todo/Divhead，无评论或新表地址，release/config未变；本次未重读链上authority，不把旧mutable观察当最新状态。无LUT实验不能替代72原AC的可信LUT、四钱包与原子TP/SL落链矩阵。
- **136已有成果不重复搬运**：#3293/TRD-84 `0722cc8701`、#3294/TRD-142 `2ad1f8971a`、#3223/TRD-85 `beaa4d28dd`、#3273/TRD-49 `6995d3a0d5` 均与已接入来源一致；#3287 units、#3205 fee、#3207 orders候选head也未变，继续原PR评审/合并收口。77产物pin/hash未变，无新证据要求重建或升级WASM。

建议先补齐72→78/70、78→70，再接余额地址key小补丁。136下一项优先通过已接入84正式路径完成真实平仓/到账/刷新，再补限价编辑、撤单、触发和TP/SL矩阵，金融操作另按授权执行。#3288正文仍写签名pending，落后本地晚间成交记录；72/70等正文亦含旧API观测，后续交付应同步准确证据。上述均为建议，不是本轮实施；TRD-70此前暂缓swap、max leverage、完整simulate_order与GT Rewards未自动恢复。

## TRD-136 正式替代实施（2026-11-17）

用户确认按正式替代审计建议创建目标并实施。以下为实施记录，优先于后文只读快照；本轮不将候选接入等同上游合并或完整真实交易验收。

1. 在 TRD-136 原开发线删除 `api-wallet-scope.patch`、API 启动器的 `--wallet`/`TRD136_INDEX_WALLET`/walletScope 分支及过时 README，改为已合并 c82a14e990 的全局索引说明。签名提交 `83aa07d64c`，精确同步持续实验分支 `c6375ffa6c`；诊断模拟的 `--wallet` 是交易账户公钥输入，保留。API 源码未改、未推送，未启动新服务。
2. 原 TRD-72 development 依次接入 #3190 `9896a85fbc`、#3195 `666fa1669a`、#3205 `baed302cb0`、#3207 `6bb15c691f`，用签名 merge 保存来源，四个提交 `3d826dbea9` / `47659f59ad` / `526bbd1562` / `8275ade2e0`。上游仍未合并，wallet 原 PR 的 CHANGES_REQUESTED 与 orders 的 stacked base 不因本地集成消失。
3. 所有目标的 19 个受影响文件起点逐个 Git blob 核对一致后，以 merge 的第一父差异精确 cherry-pick 到 78/70 原 development/delivery、72 delivery、136 和 playground。没有整条开发分支合入交付，未改 77 独立产物。全部新增提交 GPG 签名已核验。

冲突取舍：采用上游中央 RPC registry 的 Solana networkChange 生命周期，删除重复 `useSolanaRpcTracking` 与其专属测试；EVM 启停仍由既有 RpcTrackersRegistry 负责，保留跨 Solana 切换回归。余额和钱包列表遵循最新配置 mint 契约，抵押/pay 资格独立，现有 WSOL/WGMX 图标已具备。字段统一到共享 string/unsigned bigint/unsigned integer readers，保留 safe number 或十进制 string 的 bigint 契约、严格 callback/escrow 和原始 base58；`orderInfo.solana` 交易消费者扩展保留。slot/freshness、sender/tracker、WASM pin 和开关隔离没有改动。

| 逻辑开发线 | development head | delivery / 实验 head |
| --- | --- | --- |
| TRD-72 | `8275ade2e0` | `ce2d726b79` / Draft #3258 |
| TRD-78 | `dc3e30c646` | `68ec526e70` / Draft #3261 |
| TRD-70 | `9e88e5d639` | `532c8c050d` / Draft #3262 |
| TRD-136 | `627ed6f9d1` | 无独立 release PR |
| 持续实验 | `0255e54315` | Draft #3288 |

本轮本地验证完成：TRD-72 原开发完整前端 345 文件/3454 测试通过，保留 1 个既有跳过；SDK 全量 66 文件/1011 测试通过，app/SDK 全量零 warning lint、3 项 ESLint 规则通过。七个接续目标实际目录的 SDK 重建、app/landing 类型与相关回归共 28 项检查全部通过；三条 delivery 分别为 10 文件113/114/114测试，78/70 development 与136也为114测试。所有目标的17个变化文件实际零 warning lint通过。playground 实际完整前端352文件3483测试通过，保留1个既有跳过，生产 build 通过，只有既有 bundle/annotation 警告。

受影响19路径起点/终点逐个 blob 一致；同逻辑线 src/sdk/landing/lock 一致，SDK 源码/依赖/测试配置一致后复用1011项结果。额外核实实际 Vitest 使用的 vite.config.ts：development/playground 显式限定 project/test 路径，delivery 保留release发现配置，因此不声称所有构建/测试配置一致，各 delivery 均执行自己的类型与相关 suite。机器记录 `target-checks.json`、`source-verification.json`、`changed-lint.json`、`propagation-blobs.json`、`reuse-tree-check.json` 及日志在 `.local/replacement-audit-20261117/`。

四条相关 development 已推 my-gmx，三条 delivery 和 playground 已推 my-gmx-pr，原 Draft #3258/#3261/#3262/#3288 正文按最新来源、验证及边界重写，任务登记已重绑实际 head。没有改77独立产物/PR，没有更新他人原前置PR、Linear或review状态。新head远端CI另见本节收尾快照；未完成检查不记通过。

### 本轮远端 CI 快照

本轮新head最终所有检查均已结束，无pending：#3258 `ce2d726b79` 与 #3261 `68ec526e70` 各7项success/1项报告发布failure；#3262 `532c8c050d` 10项success/1项报告发布failure（含正文更新触发的同head重跑）；#3288 `0255e54315` 8项全部success。三条原交付的组件测试均通过，失败均在Pages报告/评论写入403，已逐条核对本次run44110647833/44110655685/44111384008日志；没有把权限失败归为业务回归，也没有将报告工作流修改混入业务PR。

实验线综合run44112790313与SDK standalone全部通过，日志明确前端3483passed/1skip、SDK1011passed、multicall14passed/1skip、public50passed/2skip；保留既有skip。原70最后正文重跑run44112849728完整通过。最终快照在 `final-pr-*.json` / `final-ci-summary.json`，完整日志 `playground-final-ci.log`，失败日志 `ci-*-failed.log`。四条PR保持Draft且MERGEABLE，无Ready/reviewer/merge操作。本轮实施目标完成，后续正式前置合并、部署资源和完整交易验收按各自条件继续。

仍保留本地真实 API/DB/indexer/reader、简单无 LUT 配置及显式 RPC 入口：最新只读审计没有证明正式部署/可信 LUT/统一代理可替代。TRD-84 未发现可直接接入的公开退出 UI，最小本地接线继续暂缓。未操作钱包、签名广播或部署；现有预览仍是旧部署源码，不能视为本轮代码验收。

## TRD-136 临时方案正式替代核查（2026-11-17 晚间）

用户要求核查上游推进后，哪些提前跑通的特殊安排仍有必要。本轮为只读审计，不修改业务、切换服务或交易；实时核对关键Linear正文/评论、GitHub PR及源码、远端release、公网市场API、原实验工具与当前集成。release远端仍28ddd42ce6，与本地origin/release一致。原始PR/files与逐文件差异保存在忽略目录 `.local/replacement-audit-20261117/`。

| 特殊安排 | 正式替代证据 | 结论 |
| --- | --- | --- |
| 单钱包范围API补丁 | API#340已merged，最终head c82a14e990；未修改全局实现及SDK2.9.3已完成先前独立验证 | 已替换运行依赖，不再需要patch或--wallet；旧api-wallet-scope.patch、可选wallet代码及README旧命令仍留在工具，属于可退役残留，不误称已物理删除 |
| 提前集成provider/selector/header/list与旧数学 | release已包含TRD65/63/80及SDK2.9.3，实验线已接续 | 已由正式release提供，不再维护独立临时版本；正式需求剩余验收不因代码入release自动完成 |
| 本地API host覆盖及独立DB/indexer/reader | 公网config/values均200、67市场、0gmsol标记；TRD108仍Todo、正文2.2.1已落后实际代码，不能单据Linear否定已merged2.9.3 | 正式源码可用，本地实例仍有用途，尚不能删host覆盖切公网；正式部署的账户/slot/数学契约需另证，不将市场探测扩大成全API错误 |
| 空LUT本地配置 | release仍为两张provisional表；实验生产authority map空；TRD109 Todo、无评论或新地址 | 尚无已核实可切换可信资源。原只读alt-preflight本次在getGenesisHash网络错误，未读到最新链上authority，不称表此刻仍mutable；简单无LUT单笔既有892/925bytes证据继续适用其范围，不替代带LUT AC |
| 平仓/撤单最小本地接线计划 | TRD84 In Progress、无评论；按TRD84/FESOL59及Solana close检索未发现专门可用公开成果，release PositionSeller/OrderList仍走EVM signer/sendBatchOrderTxn | 暂无可直接接入的正式退出UI；计划未实施且用户暂缓，不能称已存在一套临时实现可删，亦不自动接管84 |
| 本地RPC只读代理/Origin适配 | TRD29 In Review；已合2892为历史Solana RPC配置支持，当前release仍用既有provider入口 | 本轮未核实已可替换的正式统一代理，不凭状态认定部署就绪，不扩大到采购/换key/启服务 |
| Node unsigned诊断 | 原脚本直接初始化真实WASM，调用产品prepare/validator但不含浏览器loader/tracker/sender | 是辅助工具，不是应由正式业务实现替换的运行分支；保留用途边界，不能继续用它代替浏览器验收 |

### 新的正式候选与不能盲目覆盖的差异

此前“上游head未变/CONFLICTING”的观察已过时。当前单位#3287 head24e983c4c4、余额reader/hook#3190 head9896a85fbc、wallet#3195 head666fa1669a、fee#3205 headbaed302cb0、orders#3207 head6bb15c691f均OPEN/MERGEABLE，但未merged；wallet仍CHANGES_REQUESTED，其余按各原PR review收口。orders仍以fee分支为base，不能误称独立release交付。

单位units.ts与当前实验集成Git blob完全相同，index只改变units导出位置，无需新增换算实现。余额hook/useSolanaWalletAssets亦与当前集成逐字一致；reader改为GMSOL_TOKENS，替代集成的非synthetic余额集合，RPC生命周期改到registry网络事件；必须按最新TRD98配置mint契约及EVM/延迟初始化行为一起审查，不把新head等同可整支无损覆盖。

字段正式候选去掉集成的getApiFieldReaders，改用原readApiString/readApiUnsignedBigInt与新增readApiUnsignedInteger；接续可减少本地自维护helper，但有数值输入接受范围差异且需要orders/referrals同步。#3207的composeGmsolOrdersInfo删除集成的orderInfo.solana赋值；当前transactions/orderContext.ts会消费该metadata或原始API字段，替换时必须保留真实交易消费链路。未运行新head测试、未称发现已确认上游bug或直接应用替换。

结论：最大专用补丁已退出当前运行依赖，一批能力已由release吸收；本地API/LUT/退出并无足够正式运行资源证据可整体撤掉。最有价值的新接续是按原需求线审查余额/字段新head、单位继续复用，并清理工具中旧钱包补丁入口/过时当前命令。用户本次仅要求核查结论，尚未实施这些业务/工具清理，未改Linear或发消息。

## 五需求前置接续实施完成（2026-11-17 晚间）

用户已创建目标并授权实施。原5条development与4条delivery均已接续最新release `28ddd42ce6`；所有新增merge/commit显式GPG签名并核验。除77独立delivery无冲突外，其余唯一冲突均为gmsol/index.ts导出；先在72原development解决，保留release2.9.3原生数学和既有units全部导出，再按同一已核实解析接入其他原线。没有整支development合入delivery、恢复用户暂缓范围或修改他人上游PR。个人基础也已签名同步同release。

最终API#340的2.9.3版本 `c82a14e990ece30103defda0ed764fea3cf65aa0` 在独立干净checkout `/Volumes/kenny/gmx/gmx-api-trd-136-sdk293` 使用自身锁定依赖安装（原生corepack yarn4.12）、生成tsoa并TypeScript检查通过。独立owned实例3066/3067，bootstrap105536账户、约32秒ready，67/67gmsol市场。原5套indexStore/marketAccount/positionAccount/userAccount/orderRecords测试72passed；indexStore在本次owned DB随机partition运行并自行清理，不以offline harness冒充DB验证。SDK原生数学nativeMath与单位转换两套74passed；不是完整金融/真实交易AC。

最终API账户HTTP200；minContextSlot470550701实际返回470550709。暂停本次owned writer进程组超过10秒，config与positions均503，恢复后config200。新前端 `7455203605` +最终API +同hash真实WASM执行原prepare/builder/validator/pre-signature检查：市价long/short892bytes、限价long/short925bytes，slots470550183/191/200/208均unsigned模拟通过；每次重读真实交易flag，未签名广播，不是完整浏览器/keeper验收。测试脚本首次误用account查询参数返回400，按原API契约修正address后上述运行断言通过，没有修改业务绕过验证。

API新实例按report owner `trd136-6ae905315d0e` 清理，report已确认为stopped/containerCleanup passed；原996cf05实例3056/3057及旧Vite3016保留。旧API固定checkout不移动、不改源码、不推送API或建PR。API/SOL金融原始数据保留忽略目录，不作为共享附件。

TRD136原development文档提交 `b600fc9189` 已说明最终API复现入口/证据边界；精确转入已有持续实验分支时保留其英文公开README，冲突收口后head `0718470deb`。产品src、SDK、锁文件和vite配置与原development一致（仅package脚本存在个人基础差异），本次实验线仅改文档，已推my-gmx-pr并更新同一Draft #3288；未重复部署，预览仍绑定b1c1f0a2bb，旧CI不得冒充新head结果。原4条Draft已在实际交付目录验证后普通推送并更新正文，保持Draft；没有Ready/reviewer/merge操作。

原线及交付当前merge：72devac2db2ca36/delivery08d527a393；78dev5ff7dfc690/delivery10322b0e08；70dev00d50c8af3/delivery1f4825c8bf；77dev3166115941/deliverye164801e28；136dev7455203605后加文档b600fc9189。registry已重绑，并以本轮实际head验证替换旧verification。五条development及四条delivery的SDK重建、app/landing types、完整前端测试27项检查均通过；四条实际delivery的app/SDK零warning lint及ESLint规则12项检查均通过。72dev/delivery346files3456tests，78dev/delivery350files3477tests，70dev/delivery及136均353files3485tests；77dev346files3455tests、独立delivery334files3374tests，各保留1existing skipped file/test。70与77实际delivery生产build均通过；共享SDK全套66files/1011tests通过（sdk-full.log）。版本绑定结果在个人基础 `.local/acceptance/five-followup-20261117/verification.json`、lint.json及final-extra.json。TRD100新PR单位文件未变，无需重复实现；余额/113前置消费无新已发布head，不擅自更新他人原PR、请求review或合并。

### 交付与远端状态

- #3258 head `08d527a393`，保持Draft，MERGEABLE；CI快照：{'FAILURE': 1, 'SUCCESS': 7}。
- #3261 head `10322b0e08`，保持Draft，MERGEABLE；CI快照：{'FAILURE': 1, 'SUCCESS': 7}。
- #3262 head `1f4825c8bf`，保持Draft，MERGEABLE；CI快照：{'IN_PROGRESS': 3, 'SUCCESS': 5}。
- #3259 head `e164801e28`，保持Draft，MERGEABLE；CI快照：{'FAILURE': 1, 'IN_PROGRESS': 2, 'SUCCESS': 5}。
- #3288 head `0718470deb`，保持Draft，MERGEABLE；CI快照：{'SUCCESS': 8}。

上述为本次查询快照，不是持续订阅。#3258 run44097198937、#3261 run44097906867、#3259 run44099319179的新head组件日志均明确“All tests passed”，失败在Pages/评论发布403。#3262 run44098627827首次在依赖安装ECONNRESET未执行测试，重跑一次后依赖与组件测试步骤均success，最终日志明确“All tests passed”，workflow仍因报告发布403而failure；报告发布权限单独处理，不以旧head归因套用新网络错误，也不为发布报告改业务PR或升级token。

本轮实施目标收尾，不代表五需求全部AC完成。后续外部项：TRD100/#3287冲突与review；TRD98/#3190→#3195；字段#3205/#3207；TRD109可信LUT authority；正式API部署/金融reference；完整钱包/atomic/keeper矩阵。TRD84退出最小接线及70 swaps/max leverage/full simulate_order/GT Rewards继续按用户决定暂缓。API仍仅本地，无新增签名广播或部署。

## 五需求晚间前置核验（2026-11-17）

用户要求核对固定五需求 TRD-72/70/78/77/136 可跟进的前置。本轮只读刷新五条正文/关系/评论、14条关键前置及7条关键前置评论，GitHub原/替代PR、当前release源码和公开API。未全量扫描项目，未fetch/pull、修改业务、启动服务、测试或交易；不自动恢复此前暂缓范围。以下优先于本日早间及四条状态复核中的旧release/review观察。

当前release为 `28ddd42ce6ff50aa92a30eb00122b25970e3bf99`；TRD-63/#3201于20:14 CST合并，TRD-80新PR#3286于20:13 CST合并，源码已包含Solana Trade provider、selector/header及fundingClaims/pendingPriceImpact/positionFeeHistory功能开关。两条Linear仍In Review，不能继续据Linear或旧PR称等待合并。TRD-80旧#3238已关闭，作者明确由#3286替代；新PR实际15文件，不把旧100文件重复整体集成。TRD-63新head `7c9968cc03` APPROVED、checks成功，既有“Changes requested待review”已过时。

SDK原生数学#3285已于17:00 CST合入release（`22e1eda78e`，source `46a034218b`），版本2.9.3，新增共享市场/仓位/折扣原生计算。五线最后统一同步仍为 `7868f48f3e`，下一步应按原线接续最新release，保护units与原生数学导出、slot/freshness、余额接线及sender/tracker扩展，按实际冲突取舍；本轮未执行合并或冲突分析，不承诺自动无冲突。TRD-77独立产物的source/pin/hash本身未变，只验受影响基线，不因数学升级重建Rust/WASM。

TRD-100旧#3243已关闭，作者明确替代为#3287，head `411459b87f`，当前CONFLICTING、REVIEW_REQUIRED、返回checks全成功且无review/thread。新旧units.ts和gmsolUnits.spec.ts Git blob逐字一致，消费者已接入同实现，不需重做单位转换；应跟进新PR对最新release冲突与review，并保留gmsol/index.ts新旧全部导出。

API#340已于18:04 CST合入main（merge `322b06ad0a`，head `c82a14e990`，main当前 `fb17db32a2`）。相对TRD-136已实测的 `996cf05db9` 多1个提交：升级sdk-next 2.9.2→2.9.3，市场、pending fees、fee discount等复用SDK原生实现，删除API重复实现，共22文件。优先在保留旧固定现场的前提下核验该最终版本的实际依赖、全局启动/slot/freshness、金融reference与前端组合；不能把旧72项及4种unsigned模拟冒充新版本通过。API源码仍以getPositionInfo组合，但不能因此判断仍按旧EVM数学：需结合gmsol字段和新SDK实现。TRD-108正文“SDK2.2.1”已过时。仅合并未证明部署：本轮公开 `https://solana.gmxapi.io/v1/markets/config` HTTP200、67市场、0个tradeMath=gmsol；values也200、67市场，未返回X-Solana-Slot。未探测账户/钱包接口或金融值，不能泛化为全部线上错误。gmx-infra#96本账号仍不可读，正式DB/部署验收有证据缺口。

TRD-98仍需按需求明确的#3190 reader/hook→#3195 wallet顺序跟进。#3195同head `2495be234e` CONFLICTING/CHANGES_REQUESTED，当前评论明确确认empty System-owned ATA修复已有效、个人key已移除；不要把未resolved旧P2线程再派为未修复bug。剩余/rpc-debug不可达、格式/冗余测试及配置mint资格回退需收口并复核；当前需求明确读取配置mint，保留已核实历史保护。#3190 head `83eb9d629e`尚OPEN/REVIEW_REQUIRED，常规检查成功而组件workflow失败，本轮未读取该失败日志，不沿用其他PR403归因。

原113字段#3205/#3207仍原head、均CONFLICTING；fee base release，orders仍stacked。既有11月15日候选基于旧52，不能直接称最新release交付；需原PR收敛字段栈，保留fee/referral/order metadata消费契约。TRD-109仍Todo/Divhead、无评论或新表地址；72实际delivery expected-authority map仍空，本轮未重读链上表或keeper flag，不把历史链上/flag值当新证据。TRD-84仍In Progress/Sulliven、无评论；按TRD-84及Solana close搜索未找到独立新PR，不证明无未公开工作；它是136退出/撤单的运行依赖，同时在Linear上又依赖70/80，不称五条全部开发的前置，按用户此前决定继续暂缓本地接线。

推荐首项：接续已合入release的63/80/SDK2.9.3，处理原开发线与交付冲突，再精确更新原Draft（需实施/交付指令）；其次TRD-136核验最终API2.9.3组合。可协调100新PR与98/113原PR收口；可信LUT、正式部署与金融验收仍独立跟进。没有发送消息、评论、改Linear或请求review。只读原始PR/API差异留在 `.local/dependency-audit-20261117-evening/`。

## 四条批次状态复核（2026-11-17）

用户所指近期四条为 TRD-72/70/78/77（原 FESOL-56/19/20/72），均由 Kenny 负责。本轮只读刷新官方 Linear 正文/关系/评论及 GitHub 原 PR，四条评论均为空；未改业务、同步分支或执行交易。Linear 分别为 In Review / In Progress / In Progress / In Progress。

release 已到 `22e1eda78ec0d51eae8104548744fb846f40d542`。原 PR head 与本日实施表一致，但 #3258/#3262/#3261 当前均 CONFLICTING，#3259 MERGEABLE；全部 OPEN/Draft、REVIEW_REQUIRED。不能沿用此前基线同步结果声称当前无冲突，本轮未分析具体冲突文件。

四条当前 head 的 Audit、常规 lint/types/tests、SDK standalone、WASM reproduction 均已 SUCCESS，无待运行项；组件 workflow 仍 FAILURE。除 #3262 外的三条已有本日同 head 组件通过及发布403证据；本轮新增读取 #3262 最终 head `00d5d7b138` 的 run `44033459503` 失败日志，确认“All tests passed”，失败在 Pages push 和评论 `Resource not accessible by integration` 403。四条均不能称 CI 全绿。原主网验收及暂缓范围继续保留，TRD-136 本地实验不能替代全部正式需求验收。

## TRD-63 AC2 阻塞判断收敛（2026-11-17）

独立调查需求/review、GMX已合入公式PR2407、旧TradeHeader/Go后端及当前API映射后，确认255x与294x来自不同UI定义；reviewer已知采用GMX公式，只要求补字段表，现已存在。撤销此前“需另行选择金融口径”的独立外部阻塞；保留正常AC2验收/review批准，不将作者调查当成approve。当前公式与最新ETH参数吻合，无证据要求业务改为294x。详细来源及线上版本边界见[AC2调查](issues/FESOL-15.md#ac2-口径调查结论2026-11-17)。

## TRD-63 自动验收补齐（2026-11-17）

后续实时查询确认：同head的描述编辑触发任务也已结束，当前18个checks全部SUCCESS，无pending/failure；CI收尾项完成，review仍CHANGES_REQUESTED。下段“新任务仍运行中”为此前阶段状态，已由本次结果替代。

原 #3201 当前 `786dcaadc7` 已在用户原生 Chrome 完成桌面与440px视口、搜索/分类/默认和价格排序、kBONK/kSHIB/kPEPE、header详情、跨网TradFi回退、刷新及开关关闭行为。真实API响应经生产组合函数验证，ETH255x及PEPE/SHIB OI/流动性/费率与页面格式化一致；本地SDK public重跑50passed/2existing skipped。最初两个CI workflow在不同公共接口30秒超时，已各重跑一次且均全部通过，已完成的对应checks通过；后续PR描述编辑又触发同head自动CI，新任务仍运行中。未发现本需求新增业务缺陷；AC2语义认可、TRD-69日期能力与review批准仍不能代确认。[验收证据与边界](issues/FESOL-15.md#自动验收补齐2026-11-17)。

## TRD-63 历史清理交付（2026-11-17）

用户明确授权历史替换后，原 #3201 已以精确 SHA 的 force-with-lease 更新为 `786dcaadc7`：基于最新 release `22e1eda78e`，仅1个需求提交/11文件，原 gitlink 提交不在祖先历史，需求文件与此前验证版完全一致。delivery SDK/types/lint/3374项完整测试/生产构建及新增原生数学46项测试通过；远端新CI运行中、MERGEABLE、review仍CHANGES_REQUESTED。公开历史清理项已处理，不代表AC2及完整页面验收通过；[详细证据](issues/FESOL-15.md#历史-gitlinks-清理完成2026-11-17)。

## TRD-63 原 PR 发布结果（2026-11-17）

用户明确要求更新原 PR 后，#3201 源分支已普通 fast-forward 到 `f6e2282703`，标题/正文接续 TRD-63，GitHub 确认 **MERGEABLE**，本次代码冲突已解除。此前 origin 只读发布阻碍已由本次明确授权解除；review 仍 CHANGES_REQUESTED，新 head 的 CI 正在运行，页面完整矩阵及公开 gitlink 历史边界仍保留。没有合并、转状态或请求 reviewer。

## Kenny 的 TRD-63 冲突跟进（2026-11-17）

此前“待原作者处理 #3201”的表述已由本轮接续：Kenny 就是该需求负责人，Agent 已复用原开发线处理最新 release 的 35 处冲突，交付候选 `f6e2282703` 收敛为 11 文件；自身 SDK、类型、lint、3374 项完整测试及生产构建通过。候选保存到正式个人 fork，原 PR 因源分支在 gmx-io 且 origin 只读，仍待本次写入例外，不能称公开冲突已解除。页面完成真实 Solana 数据/header 局部 smoke，搜索分类与全量 AC 未完成；原公开 gitlink 历史未重写。具体版本、取舍与验证边界见 [FESOL-15 / TRD-63](issues/FESOL-15.md#上游冲突处理2026-11-17)。

## 五需求跟进实施（2026-11-17）

用户授权实际跟进后，已将 release `7868f48f3e5cf1423a33a4e3f8cbbc9d5cd90d18` 同步到四条原 development/delivery、TRD-136 和个人基础；均干净自动合并，未覆盖他人工作。个人基础 merge 因 GPG agent 不可用失败，已按长期授权使用命令级不签名提交完成，未改变长期配置。TRD-65 / #3193 已合成果不重复集成；交付差异文件数由 223/240/253 收敛为 TRD-72 **95**、TRD-78 **112**、TRD-70 **135**，TRD-77 保持 **18** 文件。

TRD-100 / #3243 新 head `50118fee998` 的真实差异已在 TRD-72 原 development 精确接续：`units.ts` 复用 `GMSOL_PRECISION_SCALE` 与 `GMSOL_MAX_UNSIGNED`，数值、舍入及范围保护均不变；原提交 `7fda907550`。选择性转入其余 development、136 和三条消费者 delivery，保留 `gmsol/index.ts` 数学函数与 units 导出；TRD-77 独立产物 PR 不带此交易源码。两套 SDK 测试共 **41 passed**。TRD-70 的真实余额接线修复仍源于原 development `9a3342837b`，delivery 已含其精确提交 `d0726f09d9`。

**API #340 的新索引已实测解决当前本地全局启动阻碍。** 独立干净 detached checkout `/Volumes/kenny/gmx/gmx-api-trd-136-incremental` 固定 `996cf05db9603d9af1689fdbac05f5a0ecf8e0e1`，沿用其未变化的 package/lock 依赖；未改 API 源码、未推送或创建 API PR。Docker DataFolder 与实际 Docker.raw 均确认位于 `/Volumes/kenny/docker/DockerDesktop`。启动器创建独立 owned PostgreSQL/reader/writer，**不传钱包限制**；105,529 个账户完成 bootstrap，约 32 秒 ready，67/67 gmsol 市场，测试钱包 orders/positions/fee-discount 为200，其他真实钱包能返回非空仓位。slot 等待 470430200 → 470430204；暂停 owned writer 超过10秒后 config/positions 均503 `BACKEND_UNAVAILABLE`，恢复后200（470430275）。原钱包当前空仓位且 RPC 470429549 确认原仓位账户不存在，本轮未平仓，不据此证明退出入口。

新 API 的原有5 suites（真实隔离DB索引、market/position math、fee-discount、order records）**72 passed**；indexStore 必须用真实DB，首次误选 offline harness 缺DB未通过，不将64条纯函数结果当索引通过。随后通过本次 owned DB 的随机 partition 跑原suite并自行清理，未改变全局索引数据。API自身tsoa routes生成后TypeScript检查通过。前端3016已使用3056全局API，配置模块、无LUT配置与真实WASM entry HTTP验证通过；旧钱包范围孤儿进程及其独立数据库已按report/PID/owner核对后清理，保留checkout与日志。新版本上重新执行现有 unsigned builder/validator/simulation：市价多/空892bytes、限价多/空925bytes，slots470432112/118/125/131全通过，每种模拟均由现有helper重新读取真实keeper flag并确认enabled；初次独立查询403不再代表本轮后续无法取得flag。未签名广播；仍非完整浏览器交易验收。历史钱包补丁不再是当前推荐环境的必要前置，保留旧checkout供追溯。

本机证据集中在 TRD-136 `.local/trd-136/incremental-*` 与 `api-oZP7rM/`，不将钱包金融数据/凭据作为共享附件；可复现入口已更新需求工具 README。各原 Draft PR 已更新并保持Draft；最终目录均实际完成SDK rebuild、app/landing typecheck和完整前端suite。原有1个skip file/test均保留，未称全量零skip。没有为本轮常量/基线变化重跑未变化的Rust reproduction或完整应用build，旧证据保持其原版本边界。

| 需求 / 原 PR | 最终development | 已推送delivery | 本轮实际delivery完整suite | 相对release文件数 |
| --- | --- | --- | --- | --- |
| TRD-72 / [#3258](https://github.com/gmx-io/gmx-interface/pull/3258) | 7fda907550 | 153536c592 | 345 files / 3448 passed，1 skipped | 95 |
| TRD-78 / [#3261](https://github.com/gmx-io/gmx-interface/pull/3261) | fb9e853562 | b7e3b09766 | 349 files / 3469 passed，1 skipped | 112 |
| TRD-70 / [#3262](https://github.com/gmx-io/gmx-interface/pull/3262) | 5c5acd03fb | 00d5d7b138 | 352 files / 3483 passed，1 skipped | 135 |
| TRD-77 / [#3259](https://github.com/gmx-io/gmx-interface/pull/3259) | 3524b09f15 | 17cd0bb460 | 333 files / 3366 passed，1 skipped | 18 |

TRD-136 原集成目录 SDK rebuild、app/landing typecheck、完整前端suite **353 files / 3485 passed，1 skipped** 通过（`d7320b4821`）。

四条development已推送my-gmx，四delivery推送my-gmx-pr，保留原PR和旧分支名，PR标题及需求链接接续TRD。原56 development也实际tscheck/full suite通过3448项；共有SDK units/math两套41项及变更units文件ESLint零warning/Prettier通过。19/20原线与delivery关键运行源码一致，19已登记的selector/list额外范围仍未整支带入；实验工具与个人基础未混进业务PR。

远端新head跟进：3258组件suite全部通过，workflow失败在Pages报告发布及评论权限403（run44031144297）。3262原head `aed7c77c76` 的Run Tests因余额Hook import顺序与测试JSX对象4条warning失败，已在原development以 `5c5acd03fb` 修正，精确转入delivery `00d5d7b138` 与136 `0a6277ec90`；只调整import/测试fixture引用，无业务值或断言变化。上述3483/3485完整suite来自清理前同业务源码，最终delta另验实际目录lint/types/两套6项余额/组合回归；不将旧CI归因套到这次真实lint失败。收尾时进一步核实：3261组件run44031497193、3259组件run44032212432也均“All tests passed”，失败同在Pages/评论403；三条旧于70最后lint提交的最终head均已有Rust reproduction、SDK standalone及至少一项常规Run Tests成功，其余重复触发项仍运行。3262最终head `00d5d7b138` 全套CI重新运行中。新head远端CI仍需按实际运行结果区分pending/成功/权限失败，不能称全绿。

外部范围仍保留：TRD-100/80 原PR review、TRD-98/63 与字段stack的原作者冲突/review、可信LUT、API正式部署及金融reference验收；未向他人发消息/评论、改Linear、请求reviewer、转Ready或合并。TRD-84 本地最小撤单/平仓接线仍按用户暂缓，不因本轮上游跟进恢复。五需求不能统一标记Done；完整真实交易矩阵仍未完成。

## 五需求前置增量核验（2026-11-17）

范围：TRD-70/72/77/78/136 的直接及关键传递前置，非全项目进度扫描；只读调研，不自动实施、同步开发基线、合并或部署。官方Linear实时读取五条正文/关系及关键依赖，五条与关键前置评论单独核对；GitHub读取最新PR/head/reviews/checks、API源码和公开HTTP。release在线为 `7868f48f3e5cf1423a33a4e3f8cbbc9d5cd90d18`（11月16日16:42 CST）。本轮没有fetch/pull、业务修改、构建或交易。

| 前置 | 最新证据 | 下游影响与可跟进事项 |
| --- | --- | --- |
| TRD-65 / 原52，#3193 | Linear In Test；11月16日16:41 CST APPROVED并MERGED，merge18e78fefba、原heade712a1d342不变；当前release实际存在GmsolSyntheticsStateProvider | 四线/136早已含同head，非新功能待集成；可按最新release整理交付diff、移除已吸收的前置范围，保留后续slot/owner/余额扩展。不要重复cherry-pick或整支覆盖 |
| TRD-100 / 原92，#3243 | In Review；新head50118fee998，MERGEABLE、Review required、各返回checks成功、无review；相对release仅3文件 | 原5e081e5ab1冲突候选已过时，无需再提修冲突。units与136的差异仅改用既有GMSOL_PRECISION_SCALE/GMSOL_MAX_UNSIGNED常量，值相同；待原PR review/合并，不重复实现转换，也不把整支新head带入旧工作区 |
| TRD-80 / 原25，#3238 | In Review；head07117e1691未变，当前MERGEABLE（此前CONFLICTING），Review required、返回checks成功、无review | 位置/订单列表前置具备推进review条件；其数学/API/规范依赖仍需分别验收，不因mergeable判完成 |
| TRD-98 / 原51，#3195 | In Review；head2495be234e未变，CONFLICTING、Changes requested；未resolved线程仍含空System-owned ATA导致整次余额读取失败的P2及不可达rpc-debug/测试意见 | 跟进Rainer原PR冲突与审查收口；下游已集成旧head、136余额接线另在TRD70修复，不用旧CI绿证明当前可合或忽略资格过滤历史保护 |
| TRD-63 / 原15，#3201 | In Review；head056f8d689c未变，CONFLICTING、Changes requested | 多条review已有作者修复回复（ETH分类、空TradFi、swap保留、EVM collateral fallback），不重复派旧缺陷；需原线处理release冲突并请reviewer复核 |
| 原113字段 #3205/#3207 | 分别head087a98fa37/c711f6ebe7；3205现base release，3207仍stack在fee分支；两者CONFLICTING | 共享状态已合后，需在原PR收敛字段stack并核对fee/order metadata仍可供交易消费；四线已含其旧成果，不等于正式交付已完成 |
| TRD-108 / 原112，API#340 | Todo；#340新head996cf05db9，Open/MERGEABLE/Review required，test及Plan成功、Apply skipped；相对本地固定59e49新增787217/4e99bf/704d4c/996cf0四提交 | 已改启动全量bootstrap+按程序交易signature/writable账户增量追赶，cursor/coverage/lease及追赶未完不报fresh；bootstrap192MiB/60秒、总200k容量，不是单纯重跑旧扫描。优先隔离核验是否可替换本地wallet补丁；本轮未启动新版本，不能宣称大扫描问题已解决 |
| API运行与金融就绪 | #340仍使用sdk-next alias2.9.2，positionRecords真实调用其getPositionInfo；公开config HTTP200、67市场、0gmsol标记 | TRD108正文“仍2.2.1”不能当新候选源码事实；但代码已用新alias不证明金融reference、正式部署和post-trade验收通过。gmx-infra#96本账号不可读取，无法确认CloudSQL前置；不推送API、不建PR |
| TRD-109 / 原71，可信LUT | Todo、Divhead、无评论/附件新地址；本轮链上slot470423402，两表active且authorityPresent=true，73/155地址；现配置expected authorities仍空 | 正式LUT/四钱包/atomic验收继续受阻；不能因无LUT小额交易已成交就豁免正式范围。keeper flags本轮HTTP403，不能沿用昨日true冒充今日验证 |
| TRD-84 | In Progress、Sulliven、无评论；本轮按Solana close搜索未发现新主仓PR（不证明没有未公开/其他命名工作） | 136退出/撤单仍需负责人已有成果或已授权本地最小接线；用户先授权后明确可以之后做，当前不恢复实施 |

五条自身：70 In Progress、72 In Review、77/78 In Progress、136 Backlog；四Draft PR3258/3259/3261/3262远端head仍a07d84427d/2f2ac84771/c88e50533d/996a167e5c，返回代码/WASM检查成功，组件workflow仍Failure，不能称CI全绿，本轮未重读同head历史403日志。TRD70真实余额修复原delivery本地d0726f09d9仍未推送（远端仍996a），应在交付授权下更新同一PR。136的SDK启动修复9d7e57bde5仅实验工具；11月16日40USD真实long已成交证据仍限定对应版本/账户/市场，不代替其他四需求全部验收。

建议跟进顺序：优先**本地隔离验证新API#340，判断能否去掉wallet范围实验补丁**，保留现有现场及只本地权限；并行协调100/#3243与80/#3238的review，利用65已合清理交付依赖；随后收口98/63/113原PR冲突与review。可信LUT/金融部署/退出继续分别跟进负责人。此排序是分析建议，不是本轮自动实施指令。

原始只读快照保留忽略目录 `.local/dependency-audit-20261117/`。公开响应不含tradeMath仅证明不能用该host运行当前严格gmsol入口，不证明所有线上值错误。未新建Linear、评论、PR或联系他人。

## 不等待71/112正式交付的本地交易可行性（2026-11-16）

用户要求评估mock、固定值、本地计算与RPC等方案，尚未授权实施或链上写入。只读核对19 development `14d67c82d0`的市场/provider/TradeBox/sender/LUT/lifecycle与API#340固定`59e49c649d`源码，复用同阶段上游及既有HTTP契约证据。结论：可以先建设使用真实数据与链上交易的本地集成版，不必等待两项正式合并/部署；不是当前版本已经可真实交易。最省重复实现的候选是19 development＋本地运行现有API#340索引/读取服务＋自建冻结LUT；若严格限定浏览器代码，需新增RPC读取/解码/映射适配，改动更大。未启动服务、验证实时索引、测量新交易组合或签名广播，不能承诺开箱运行或工期。

- `buildTradeboxOrderAction`明确要求`tradeMath === "gmsol"`；该标记选择已有本地数学路径，不是服务端计算结果。缺字段不能单独证明所有线上数值均错误，但不能只加标记就证明旧config/values与新数学兼容。API#340已有账户解码、20→30位转换、funding/borrowing/virtual inventory映射及真实账户/折扣端点；本地方案需真实RPC、鲜活keeper价格、PostgreSQL、indexer/read进程与独立host。旧HTTP fixture验证不代替live ingestion、部署布局检查或金融参考对照。价格仍依赖当前keeper ticker来源，不能声称全部由Solana RPC得到。
- 当前市场hook明确无RPC fallback；账户/折扣与确认slot刷新也走API。浏览器直连方案必须覆盖这些输入与错误、新鲜度、owner/网络隔离及确认slot下限，不能只补市场价格。复用SDK/shared状态及计算，避免另写UI或平行状态。现有sender已走RPC模拟/发送，20已走RPC读取订单事件，不需要重写发送器或用RPC代替keeper执行。
- LUT不能mock用于真实发送。可创建仅覆盖选定市场的个人测试链上表，核验内容并冻结后使用现有frozen校验；表地址须同时进入builder/validator/sender一致的本地配置，不能冒称GMX-owned。创建/扩展/冻结是花费SOL的链上写入，需具体授权。先测单笔无TP/SL交易是否可不使用LUT；未测，不以“市价/限价单简单”推断必能装入1232 bytes。现有prepare仍固定读取配置表，无表模式不是配置清空即可保证成功。
- 建议首版限定一个实时可用的BTC/USD[USDC-USDC]或ETH同类市场、一个钱包、USDC直接支付、保守杠杆、无兑换/附带TP-SL；覆盖市价多空、限价多空、取消未成交限价单，并验证安全退出路径。市价需keeper执行后真实仓位/余额刷新；限价创建与触发成交分开验收，取消或安全退出入口若19当前未接通须纳入最小范围。交易网络、程序/store与实际支持范围须实时确认，不将静态市场表当作当前可交易证明。
- mock/历史fixture适合UI与确定性回归，写死市场地址/精度须有版本及链上核验；不可伪造动态价格、费率、余额/仓位、折扣或订单成功状态来发送真交易。首版可不支持完整历史、四钱包、全市场及原19暂缓项，不据此豁免正式需求。阶段顺序为实时只读数据与数值核对→最终LUT/无LUT真实构造与unsigned simulation→在具体钱包/金额/操作授权后真实交易与keeper/刷新闭环。

## 上游前置增量核对（2026-11-16）

用户要求检查可新跟进合并的前置。实时核对前端#3193/#3195/#3201/#3205/#3207/#3238/#3242/#3243、API#340及11月15日起Solana相关PR搜索：相关head与11月15日记录一致，release仍`84ab9293a8`；搜索仅前端四条自身Draft有更新、API无命中，不声称覆盖所有未标记Solana的PR或远端分支。原生Git ancestry确认四条development均已含当前release及52 `e712a1d342`、51 `2495be234e`、92 `5e081e5ab1`、113 fee `087a98fa37`/orders `c711f6ebe7`，无需重复集成。15/25原PR head不是四线祖先，不能仅据此判定能力缺失；19既有选择性集成及delivery边界沿下文记录，本轮未重审其文件等价性。

合并协调优先52/#3193：MERGEABLE、Review required，返回checks成功；API#340 `59e49c649d`同为MERGEABLE、Review required，test/plan成功、Apply skipped，不证明部署。51/#3195仍MERGEABLE但Changes requested。15/#3201、25/#3238、92/#3243对release及113/#3205/#3207对各自stacked base仍CONFLICTING；应先处理原PR冲突与review，不把历史CI绿等同当前可合并。57/#3242已于11月14日合并，无需新集成。按FESOL-71搜索仅返回正文关联的旧#3120，未发现专属可信LUT交付PR；未重查链上资源。无新的业务合并、测试、评论或上游写入；当前Linear访问失败沿用同阶段证据。

## 四条跟踪需求状态复核（2026-11-16）

北京时间09:22，按用户要求简查56/72/20/19，复用下文11月15日实施与复审证据，实时刷新GitHub、Linear详情与公开市场API。四PR仍为Open/Draft、Review required，head依次为56/#3258 `a07d84427d`、72/#3259 `2f2ac84771`、20/#3261 `c88e50533d`、19/#3262 `996a167e5c`，与昨晚一致；release仍为`84ab9293a8`。四PR的Audit、常规lint/types/tests、SDK standalone、WASM reproduction成功，组件workflow仍Failure；本轮未重读日志，报告发布权限归因沿用同head既有证据，不称CI全绿。

公开`/v1/markets/config`仍返回67个市场，tradeMath非空数为0。四条Linear实时详情均报access/query compatibility错误，无法确认当前线上状态、关系或评论，不能照搬历史Review/Execution。未新查LUT链上状态、浏览器、钱包、keeper或部署；可信LUT与真实交易待验收结论沿用既有记录。1204-byte修复、19 base58预览修复及72版本确认均已完成，不重新列作阻碍；19此前暂缓范围仍保留。本轮没有业务改动、构建测试或线上写入。

## 基于 review 经验的四 PR 复审（2026-11-15）

用户要求先确认四个 PR 包含最新本需求成果，再应用新建 review 经验基础设施重新审查。已读取个人基础 `d6965cf36b` 引入的七组 [review 经验](review-lessons.md)、当前 gmx-prompts frontend review/dev/Solana/testing 规范，按 72→56→20→19 核查共享契约；相同依赖只分析一次。本轮为代码及交付审查，不是整需求完成或批准上线。没有发布 review/comment、修改 Linear、转 Ready 或合并。

### PR 最新性与成果归属

实时 fetch 的 `origin/release` 为 `84ab9293a8e25e1312f35a20893752df480e0e0b`，已是四条 delivery 的祖先，当前 delivery 即与该 base 的合并结果。开始时八个开发/交付目录干净；远端 PR head 与登记的 delivery 一致。初始 GitHub inline comments/reviews 各为零，不将这点当作已获 review。

| 需求 / Draft PR | 审查起始远端 head | 本轮收尾 development | 本轮收尾远端 PR head | 差异结论 |
| --- | --- | --- | --- | --- |
| 56 / [#3258](https://github.com/gmx-io/gmx-interface/pull/3258) | `7a47de7b90` | `9638be377d` | `a07d84427d` | development/delivery 产品源码一致；本轮只补产品 README |
| 20 / [#3261](https://github.com/gmx-io/gmx-interface/pull/3261) | `a6f155737a` | `32f0b70428` | `c88e50533d` | development/delivery 产品源码一致；保留20 receipt/watcher扩展，补 README |
| 19 / [#3262](https://github.com/gmx-io/gmx-interface/pull/3262) | `50f45cfd57` | `14d67c82d0` | `996a167e5c` | 本需求修复均已交付；development额外15/25 selector/list/settings等前置不整支带入PR |
| 72 / [#3259](https://github.com/gmx-io/gmx-interface/pull/3259) | `2f2ac84771` | `7b26f6feec` | `2f2ac84771` | 独立artifact交付代码一致；development中的56等业务不属于72交付 |

完整 release diff 分别为56 223、20 240、19 253、72 18个文件，含重叠的未合并前置，不能将 GitHub files API 的100项上限当作完整范围。优先复核自有实现与关键继承接缝；没有把全部继承业务重新逐行审完或认领为本人的修改。三个 README 修复已按原development→精确cherry-pick→原delivery推送，72无需改动。六处 README 内容最终一致，格式与 diff 检查通过。

### 确认发现与处理

**P3，交付文档与当前行为不一致，已修复。** 56/20/19 的 `src/domain/gmsol/transactions/README.md` 仍将有限价格三单1255-byte限制列为当前待办，并将“合并LUT解决体积”作为当前建议；20/19另有旧artifact“尚未复验”的过期概述。这会让 reviewer 误判已完成的修复、继续等待不必要的体积前置。已保留历史版本/slot，明确1255→1204、紧凑零输出编码语义和slot469599277的无签名模拟，移除旧体积TODO；可信LUT、四钱包签名及落链仍保留。原始修复 `9638be377d`，20原线provenance补充 `32f0b70428`，精确转入上表原PR。未更改交易源码、WASM、信任配置或价格保护。

**非阻塞质量建议，保留给后续收敛，不计作执行缺陷。** 20 `sendOrderTransactions.ts` 中 `GmsolSendResult.orders`、`trackingErrors` 初始化为空且始终未填充；恢复分支也返回空值。实际生产跟踪走 `trackingRequests`→receipt→watcher；notification仍兼容预解析 `orders` 输入。这属于旧同步解码接口的残留维护面，不能据空数组断言“未跟踪订单”。后续若收敛返回契约，应同步移除没有真实生产者的分支，并让notification测试通过真实receipt请求路径证明行为；本轮不为低优先级删接口改动扩大资金链路修复范围。

在下述已审范围内未确认新的P0/P1/P2代码缺陷；不据此宣称无缺陷或整需求可上线。

### 审查导航与已核查重点

| 优先级 / 范围 | 代码接缝与对应经验 | 本轮核查结果与边界 |
| --- | --- | --- |
| T3，56构建/签名/广播 | `orderInputs`→`buildOrderTransactions`→`validateTransaction`→`sendOrderTransactions`；RL-05/06/07 | create/update/cancel、双方价格舍入、token/USD minOutput、真实WASM、账户/指令白名单、SOL wrapping、单owner签名、模拟/费用检查、fresh flag与每次广播前eligibility；未用mock WASM代替真实编码 |
| T3，56恢复与异步会话 | `pendingSubmission` / `useGmsolOrderTransactions` / account slot floor；RL-02/04 | 模糊广播保留signature，未知receipt不重签；storage失败阻止发送；超时/拒签/过期/owner变化/卸载均有保护。owner+network checkpoint不是跨tab原子锁，不扩大保证 |
| T2/T3，20执行证据 | decoder→creation identity→bounded history→reducer→watcher→notification；RL-02/04/05 | confirmation与keeper execution分离；失败keeper交易不等于创建失败；同slot用block顺序，缺anchor/有歧义保持unknown；事件位置/owner/store/market/actionId隔离。固定Rust update_order_v2确实分配新actionId，故ID变更结束旧生命周期并非误报 |
| T3，19共享入口 | shared selectors→headless adapter→mapper→56 sender→20通知；RL-01/04/06/07 | 不复制交易页；sessionId隔离旧按钮，原owner卸载禁发；不支持的swap/Token-2022/math缺失明确拒绝；reconcile优先于新表单。base58 TP/SL预览避免EVM hash，同时保留EVM默认identity路径 |
| T2，72独立产物 | source/lock/toolchain→8文件hash→build gate→lazy loader；RL-01/05/07 | 固定Rust revision/lock/Linux arm64/toolchain；Vite核对全部manifest文件及WASM pin；加载失败可重试，绑定/start失败不重复初始化；无新artifact/pin变化，复用同SHA CI复现，不为本轮重新拉Docker镜像 |
| 继承依赖风险 | 余额资格与资产展示；RL-03 | `!isSynthetic`余额过滤来自3195，与钱包可持有性review存在历史冲突。当前四项未引入此策略；不自行改他人PR或把抵押资格等同持币资格，后续资产视图验收需明确契约 |

另按独立注意力扫描除法/数值转换、交易与授权步骤、create/update/cancel守卫和值语义。重点是USD30→GMSOL20/原生token单位、有限/无限价格边界、零/缺失区别、base58大小写与SOL/WSOL。新适配层未新增金额浮点除法；相关转换沿用固定92 helpers，TPSL percentage转换有零分母检查。Solana无ERC20 approve流程，资金支出受解码后账户/金额白名单及owner签名约束，EVM approval路径仍保留。不能将有限样例推广为所有金融数学等价；19完整simulate_order对照仍暂缓。

### 实际验证与证据复用

| 实际目标 | 本轮执行 | 结果 |
| --- | --- | --- |
| 56 delivery | 交易real-WASM/发送安全和卸载保护2 suites | 16 passed |
| 20 delivery | 交易、3个lifecycle suites及notification，共6 suites | 37 passed |
| 19 delivery | 交易/卸载、3个lifecycle、mapper、network reads、trade state、account freshness，9 suites；另TPSLInputRow及真实sidecar builder 2 suites | 47 + 29 passed |
| 72 delivery | lazy loader及SDK entry初始化恢复2 suites | 6 passed |

部分56/19 suite执行于本轮文档提交之前，同目标后续只有README差异；代码、依赖和工具链未变，结果仍适用。没有为文档补测全量业务或重跑构建。既有1204-byte无签名主网模拟和72构建复现沿用原slot/SHA；本轮未新做链上模拟、签名或广播。SDK-only改动未新增，使用既有同代码验证和GitHub checks，不把本轮frontend suites称作完整SDK数学对照。

**本轮新增最终delivery的真实浏览器检查。** 以owned Vite `127.0.0.1:3031`运行19 delivery `996a167e5c`，启动报告绑定projectDir、HEAD、clean和源码/配置指纹；只选vite服务，没有启API或替换成样例响应。使用用户预开Chrome原生窗口，验证flag off的Arbitrum页、启用Solana后DOGE市场/图表/共享TradeBox、限价保证金输入、空头切换、TP/SL展开、Solana刷新和切回Arbitrum恢复；钱包未连接。原生Network在Solana刷新后的记录中实际输入筛选，`domain:solana.gmxapi.io`为38/3227 requests，随后`domain:arbitrum.gmxapi.io`为0/3254；`rpc`字面筛选另为0/3043。上述是不同采样时刻的指定域名/文本计数，不能证明所有EVM端点零请求、无重复请求或全面网络隔离。已有device toolbar状态未修改，Network原筛选`keep`恢复。未通过DevTools connector/自动化新profile启动浏览器。

浏览器渲染与输入无异常不证明真实账户预览或金融数值正确。前一阶段在19 development（额外含15/25）的页面结果不再冒充本轮最终delivery证据；真实仓位/恢复/执行通知组合仍需适用资源和操作授权。

### 仍需人工/外部条件的核查

- **56**：可信生产LUT、四钱包签名、分别落链create/edit/cancel及atomic；不能把当前仍有authority的诊断表加入信任map。
- **20**：真实市场单keeper成交/取消、长延迟/索引追赶、实际toast和刷新；目前receipt fixtures与异步回归不代表真实交易闭环。
- **19**：真实连接账户和最终前置组合的预览/校验/恢复/UI；最大杠杆、兑换、完整simulate_order和GT Rewards仍按用户决定暂缓。
- **72**：使用固定最终artifact完成56真实流程复验。源码/manifest/CI复现成立不代表钱包/部署兼容全部验收。
- **PR体积**：56/20/19包含大段同一未合并前置，review注意力优先按上表接缝分配；前置进入release后再精确收口原PR，不为缩diff整支合并development或强推。

Linear本轮实时只读查询56失败（GraphQL access/query compatibility），未把历史正文当作本轮需求刷新，也未修改状态。初始四PR的Audit/general/SDK standalone/WASM复现均SUCCESS；组件workflow仍FAILURE，沿用同head历史日志中的286断言通过、Pages/comment 403归因。三个文档更新后的head重新触发CI，最终状态以本轮收尾快照为准；旧head成功不冒充新head全绿。72 head未变。

原始材料位于个人基础忽略目录 `.local/acceptance/review-learning-four-pr-20261115/`：初始/收尾GitHub快照、完整git diff、dev/delivery差异、各实际目标原生测试日志、runtime启动/停止报告。源码定位优先上表对应原delivery，机密/临时材料不进入PR。

## 四需求剩余事项与恢复条件（2026-11-15）

本次仅整理上一阶段已经核验的剩余工作，未重新查询远端、Linear或链上；易变状态以[目标执行记录](#四-pr-目标执行结果2026-11-15)的版本和证据为准。各需求的具体待办维护在 [56](issues/FESOL-56.md#剩余事项与恢复条件2026-11-15)、[19](issues/FESOL-19.md#剩余事项与恢复条件2026-11-15)、[20](issues/FESOL-20.md#剩余事项与恢复条件2026-11-15)、[72](issues/FESOL-72.md#剩余事项与恢复条件2026-11-15)，恢复时先读对应入口，不把“当前独立切片完成”当作整需求Done。

| 共同剩余条件 | 当前依据与恢复触发 | 恢复后要完成的工作 |
| --- | --- | --- |
| 71可信LUT | 最近实时读取slot469599276，两表仍有authority，production decoder拒绝；出现新地址、冻结证据或可独立核验的GMX authority归属后恢复 | 56核对网络、active/owner/authority及地址内容，按真实信任依据接配置；用最终表重验账户解析、体积、模拟，再进入已授权的钱包验收。不得直接把诊断表列为可信 |
| API数学与索引部署 | API#340 `59e49c649d`已有实现、真实HTTP契约消费通过；最近公开配置仍无tradeMath；出现部署证据或线上响应变化后恢复 | 核对实际部署SHA、SDK/schema、tradeMath与账户/折扣/订单字段，验证minContextSlot追赶、确认刷新和实际预览/校验；先读代码及响应，不默认向后端发询问 |
| 真实钱包与keeper验收 | 只有历史/本轮unsigned simulation和无钱包浏览器证据；需要可用钱包、资金、可信LUT及相应操作授权 | 用户现有浏览器完成真实操作；分别记录签名确认、链上订单、keeper结果及UI刷新/反馈，不以提交成功代替成交。签名、广播各遵循授权边界 |
| 前置评审与release交付 | 四PR仍Draft，集成包含未合并前置；发生上游合并、代码/review变化或正式交付指令时恢复 | 按实际release消除已吸收依赖差异，保持单一需求开发线，精确转入原delivery并验证更新同一PR；不认领他人PR修复，不自行转Ready/请求reviewer/合并 |
| CI报告权限 | 新56/19/20组件各286 passed，失败在Pages/评论403；同SHA重复general有运行项，未冒充终态 | 交付节点读取最终head检查；新增代码失败在原开发线修复，报告403归工作流维护权限处理，不为绿色状态自行扩大token权限；不重跑已有效的相同源码验证 |
| 实时需求状态 | 本阶段Linear目标访问不可用 | 恢复访问或收到需求变更时核验正文/关系/评论；未恢复前不以历史状态或本地goal完成修改Linear状态 |

恢复顺序：先核对影响当前动作的新代码/部署与可信资源，再完成56实际交易入口验收，随后验证19下单与20执行反馈组合，最后补齐72使用最终产物的56流程复验。独立的review材料/交付差异收口可随上游合并推进；19用户暂缓项须明确恢复范围后再实施。本记录不新增外部沟通、部署、钱包操作或PR合并授权。

已完成且应从待办移除：56有限价格原子1255-byte问题已修为1204并通过主网无签名模拟；72版本与产物位置已由用户确认；19无钱包页面/网络设置检查、19/20离线恢复与会话组合已完成。新表、版本或源码变化后只重验受影响项。

## 四 PR 目标执行结果（2026-11-15）

用户明确创建目标：仅聚焦56/#3258、19/#3262、20/#3261、72/#3259，把当前可独立开发、验证和推进的事项完成。本节优先于下方历史候选、旧体积限制和旧浏览器条件。继续使用交付skill；他人PR仅核验依赖，不实施上游业务。Linear仍不可访问，沿用同阶段失败证据，不将历史关系当实时状态。

**56有限价格原子体积已修复并通过当前主网无签名模拟。** 原development提交 `1b236e12da88c2144fb5331e823050d390b510c0`：在多交易合成单笔的路径中，仅将直接position订单的 `min_output Some(0)` 压为 `None`；复用ABI parser定位字段，不硬编码字节偏移。固定Rust `7fe4008292ffc09061f3a733ad9b5cd2e6235fa8` 的init_increase/init_decrease均将None归零，swap kind排除；正数minOutput仍须严格匹配。保留finite trigger/acceptable价格、全部账户和准备指令、原子性、计算量与1232-byte上限，未改72产物或pin。真实WASM与slot468884236的真实历史LUT快照对比为1255→1204 bytes，节省51（48字节payload及3字节短向量长度）。新增回归覆盖三类触发订单×多空×零/正下限、其他字段不变和正数意图拒绝缺省编码，原子实际构建测试也检查已使用紧凑编码。

进一步使用既有用户指定公开验收账户与配置RPC做 `sigVerify=false`、无签名无广播模拟：Mainnet genesis匹配，实时LUT快照slot469599276；实际产品builder和validator生成1204-byte finite-bound BTC/USDC LimitIncrease+TP+SL，模拟slot469599277、err=null、220099 CU，三个返回order账户均2472 bytes。仅诊断使用当前表内容，两个表仍带authority，实际production decoder仍明确拒绝；没有改信任map、提供替代服务或开放生产签名。成功说明该组合编码被当前部署接受，不代表四钱包、真实落链或keeper执行通过。

**19整合页面与19/20恢复组合已核验。** 原生现有kenny Chrome、自有Vite3029对应19 development `2b52d15ec34f43979e394a9754242f22ff7d50f3`。本地临时启用solanaNetwork，Solana真实市场加载；选择BTC后selector/TradeBox/chart一致，10USDC、限价60000、TP70000/SL50000及多空切换正常渲染；这些输入不作为金融数值或方向有效性验收。Solana设置只保留显示/调试；仓位排序可选择、订单空态安全；刷新仍为Solana/BTC及订单页。切回Arbitrum后BTC-USDC及更多/经典/Express/滑点/TWAP设置恢复。钱包未连接，不能验收真实仓位行、恢复入口或交易toast；不假造pending交易。静态复核adapter使用pendingTrackExecution并复用提交owner/session与既有通知hook，定向真实组件/交易测试覆盖unknown receipt、明确失败、确认、关闭及wallet/network/unmount隔离，未发现额外缺口，不重复实现已有恢复功能。任务标签已关闭，本地flag恢复false、网络Arbitrum，自有服务stop返回stopped/cleanup passed；未接管其他服务。

**72独立构建切片无新缺陷。** 固定0.11.0-beta.1与8文件产物未变，复用同版本既有GMX CI可复现构建/loader/hash证据；本轮不重复Rust构建、不往独立18文件PR带入56业务。上述最新组合模拟使用72同一WASM，可作为消费侧新增兼容证据，不替代72整体落链验收。

交付：同一56业务补丁精确转入20 development `5198fe5df7`、19 `43a3466b40`，保留20 sender扩展；三条既有delivery分别为56 `7a47de7b90`、20 `a6f155737a`、19 `50f45cfd57`。20 development另去除一次历史集成带入的重复package脚本键（`beeb108e49`），正式delivery本无重复，未将个人工具配置带入PR。72 delivery仍 `2f2ac8477192cdf07313db292bc11cbcd3bf9238`。

验证：56 development与实际delivery各2 suites/16 tests passed；20 development/delivery各6 suites/37 tests passed；19 development/delivery各8 suites/40 tests passed。六目标app/landing types与变更交易文件零warning lint通过；56历史LUT生产构建诊断1项、当前主网无签名模拟1项通过。SDK源码、依赖、vendor未改，复用先前SDK/构建/复现证据，未称本轮全量重跑。

当前独立候选逐项收口：19输入/列表/设置无钱包验收完成；19/20恢复组合检查完成；56安全编码实现、参数等价回归和主网unsigned模拟完成；72没有需重复修复/构建项。API#340真实HTTP契约消费沿用本日已通过结果（head59e49c649d），源码未变不重跑；它仍是待review/部署分支，线上tradeMath未启用不能由代码验收代替。剩余为71可信LUT、API rollout、实际钱包/keeper与评审合并；19最大杠杆、支付币兑换、完整simulate_order数学对照、GT Rewards仍按用户暂缓，不自动恢复。没有联系后端、改Linear、部署、签名、广播、转Ready、请求reviewer或合并上游。

六条development/delivery均已推送对应个人远端，三条delivery更新原Draft PR，四条PR说明已修正旧体积限制并注明本轮证据，registry实际SHA和note已更新。收尾在线确认三个新head与72未变head均保持Draft；最新release仍84ab9293a8。最终核对：三个新head均已有至少一轮general全量lint/types/frontend/SDK检查SUCCESS，Audit、SDK standalone及WASM reproduction均SUCCESS；三个component新run各286 passed，无flaky，workflow失败仅Pages发布403与报告评论Resource not accessible by integration（完整日志已保存）。同SHA由PR说明更新触发的重复general检查仍有运行项，未将它们称为成功，也不重复等待已通过的同源码验证。72代码/head未变，既有成功产物证据及历史组件报告403保持适用，其说明更新触发的general仍在运行。

本机证据：主目录 `.local/acceptance/four-pr-goal-20261115/`（浏览器启动/stop、PR快照）；56同目录（encoding-prototype/production、mainnet-compact、定向测试/类型/lint），19/20及三delivery同目录各自保存实际目标验证日志。scratch保留在忽略目录，不进入业务PR。

## 代码优先的可推进事项（2026-11-15）

用户本轮明确暂不向后端确认，先从可访问PR代码核验实际进度。本轮进一步定位19的base58预览仍进入EVM hash并完成函数级复现；merge-tree确认92仅一处导出冲突、25可与最新52干净组合；API#340已有真实fixtures/index/HTTP路径，可先验证当前前端扩展消费层。优先顺序、最小切片及证据边界见[可推进切片](solana-next-task-2026-11-15.md)。这取代下节“先向后端确认”的执行建议，也修正仅看到19改走新helper就认为旧hash问题已被覆盖的不足判断。未自动实施、恢复暂缓范围或修改PR/Linear。

## 上游跟进核对（2026-11-15）

角色：只读依赖调研；不修改上游或四需求业务，不恢复19暂缓范围。复用同阶段已核实的release `84ab9293a8`、线上67市场无tradeMath及Linear关键issue不可访问的证据，新增读取九个依赖PR与ADR的实时review、最近评论、mergeability及关键源码。全部reviewThreads连接无后页；最近评论/reviews为有限窗口，不称全历史覆盖。原始结果在 `.local/acceptance/upstream-followup-20261115/`。

本轮需要跟进的事项：

1. **112的实现已在API索引PR，不宜再笼统说数学后端尚未开发。** [API#340](https://github.com/gmx-io/gmx-api/pull/340) 当前head `59e49c649d`，Open、Review required、Mergeable。包含 `0c5aaf5016`（integrate published Solana SDK 2.9.2），package将sdk-next固定2.9.2，`marketRecords.ts`明确生成 `tradeMath: "gmsol"`，indexed reader拒绝不兼容市场快照，readiness也检查兼容性；parser suite中已有字段与slot相关断言。未复跑这些测试或独立审计数值正确性。API main仍sdk-next 2.9.0、公开响应仍无tradeMath，故应向后端确认#340评审/部署、实际发布SHA、schema/worker准备、同输入参考值与minContextSlot验收安排；不能只问何时升级SDK，也不能把分支源码视作上线。hot standby仍按INF-4拆分，不额外设为#340合并门槛。
2. **71仍缺可交付的信任配置证据。** release lookupTables文件历史仍只有10月20日初始配置；按FESOL-71搜索全状态前端PR无命中，56当前production authority map为空。这只说明未发现新交付证据，不能断言没有线下准备。本轮未新查链上表。需要提供方给出地址、冻结或独立可核验GMX authority归属、active状态与覆盖；56随后核验有限价格组合体积。历史1255/1232与假设单表1221的边界沿用11月14日诊断，不承诺复制/冻结自然解决。
3. **五个前端前置PR有GitHub报告的合并冲突。** 市场[UI#3201](https://github.com/gmx-io/gmx-interface/pull/3201)、列表[UI#3238](https://github.com/gmx-io/gmx-interface/pull/3238)、单位转换[UI#3243](https://github.com/gmx-io/gmx-interface/pull/3243)对release均CONFLICTING/DIRTY；字段[UI#3205](https://github.com/gmx-io/gmx-interface/pull/3205)对FESOL-52、[UI#3207](https://github.com/gmx-io/gmx-interface/pull/3207)对fee-discount分支也如此。HEAD与既有集成版本相同，不是发现了新业务提交；本轮未生成merge result或判定具体语义冲突。应安排原负责人的冲突处理与复验，再收口review。3201已有用户此前“待3193合并后从release重建、去gitlinks并复验announcement”的回复，不提前自动重建。3243与已合并3242均新增gmsol入口，既有92记录已提示保留math/units双方导出；本轮仅确认DIRTY，不把所有冲突归因于该文件。3205/3207还需明确stacked PR合并/重定向顺序，保持feeDiscountFactor、GT/referral及order metadata契约。
4. **52应跟review收口，不能按未resolved条数重复派修。** [UI#3193](https://github.com/gmx-io/gmx-interface/pull/3193) `e712a1d342`，Mergeable、Review required、当前checks成功。旧threads多数已有作者修复回复；gas三字段在当前源码存在。钱包输入hash与不支持auto-cancel两项历史归19范围；19当前selector已走buildTpSlPositionInfo，相关修复/验收边界沿既有19记录，不向52重复派修。需要reviewer核对回复与实际代码并关闭已处理线程，确认其独立范围可合并；四需求已消费该head，无新provider迁移需要再同步。
5. **51应明确RpcDebug取舍并收口余下review。** [UI#3195](https://github.com/gmx-io/gmx-interface/pull/3195) `2495be234e`，Mergeable、Changes requested。reviewer于11月8日明确确认空System-owned ATA修复有效、个人key已从branch history移除；当前reader也将空System-owned账户计零，不能继续列为未修bug。当前MainRoutes仍把/rpc-debug列为EVM-only；作者11月9日询问应移哪些路由，最近评论窗口未见后续答复。应只确认该页要开放还是移除不可达Solana分支，不泛化删除全部EVM-only路由。PR正文现已补充，旧“描述为空”也不再成立，但Validation中旧key不可用说法与reviewer确认冲突，需整理；格式/冗余测试意见需作者确认处理及reviewer复核，本轮不冒充运行Prettier。

优先协调71与API#340/112，同时推进52/51评审收口和其余前置的冲突处理。四需求当前已集成已知heads，故没有证据要求立即对四个业务现场再做一轮同步或重跑。API#336也为CONFLICTING，但其新钱包读取问题是否已被#340索引路径吸收本轮未核实，只作后端顺带确认项，不新增独立发布门槛。ADR#27仍Open/Proposed；与实际索引部署的决策收口一并确认。Linear当前不可访问，负责人以历史记录/PR作者身份区分，未声称核实当前assignee、承诺或排期。

## 独立推进三项收尾（2026-11-14）

本节补充并更新下方同日上游刷新记录的 CI 与浏览器状态；八个开发/交付 HEAD 均未改变。本轮应用交付 skill，未新增业务修改、未改权限或他人前置分支。

1. **最终 HEAD 的 CI 已收齐。** 四个 PR 的 Audit、general（lint/types/tests）、SDK standalone、GMX WASM reproduction 均 SUCCESS。Component workflow 均 FAILURE，日志确认 Pages deploy 403、报告评论 `Resource not accessible by integration`。19/20/72 各286 passed；56为285 passed/1 flaky，StandardTooltip 按钮内 trigger 的 Tab focus 断言首次失败、重试通过。该组件及用例相对release未改，不作为本次交易代码缺陷处理，也未扩大token权限。组件run依次为56 `43606703406`、19 `43606717930`、20 `43606711408`、72 `43606802412`。
2. **本轮已完成未连接钱包的页面回归。** 使用已有kenny原生Chrome及其钱包扩展，19实际delivery `e4e9067a0fef8d02a84478c8344ea4a131b9c1e8` 的既有生产构建，任务自有preview `http://127.0.0.1:3019`。Solana DOGE/USDC保证金10、TP 0.08/SL 0.05输入、市价/限价0.06、多空切换及执行详情正常渲染；切Arbitrum显示BTC、兑换和更多模式。仅本地origin临时关闭solanaNetwork并reload，EVM页面仍显示，resource列表未见gmsol-sdk请求；恢复flag=true并切回Solana后市场/交易输入正常，未签名前仍未见WASM加载。未发现需业务修复的新异常；不据此证明金融数值、已连接账户、通知或钱包流程通过。Privy iframe的localhost CSP、第三方连接失败及EVM RPC/metrics 429是本轮可观察环境限制；没有绕过CSP。flag与网络选择已恢复，浏览器回到原空白页，自有preview已停止。
3. **原子体积归因完成，生产限制未解除。** 用固定`0.11.0-beta.1`真实WASM、当前56开发源码和历史真实LUT快照（slot `468884236`）离线构造BTC/USDC long LimitIncrease + LimitDecrease TP + StopLossDecrease，保留有限trigger/acceptable价格边界。scratch suite 1 passed；没有新RPC模拟/签名/广播。两表1255 bytes、反序1255、只第一表1252、只第二表1376；第二表仅加载1个writable地址。将两表全部地址并入**假设**单表后1221 bytes，此表不存在且不构成可信资源/落链证据。仅省prepare_user仍1240；省prepare_position为1149，但缺仓位时不安全，未实施。静态13账户以wallet、order/escrow、user/position PDA、wallet ATA及program为主，不能假设再补通用地址即可解决。

编码候选的证据边界：固定Rust source `7fe4008292ffc09061f3a733ad9b5cd2e6235fa8` 的 `programs/store/src/states/order.rs` 中position increase/decrease将min_output None与Some(0)均归零；但SDK `crates/sdk/src/builders/order/create.rs` 固定写Some(min_output)。前端简单省JS参数不能省字节；直接改指令会涉及ABI重编码与现有严格参数校验，改WASM则改变已确认的产物。此次只记录候选，不声称已测得其收益或已证明与主网部署兼容。安全下一步是由可信LUT提供方评估单表覆盖，或单独完成SDK编码方案的实现、完整等价校验及部署兼容证明；当前拒绝超限的保护保留。

四个既有Draft正文已同步最终CI、页面范围及体积诊断，保持未到正式review、上游可能继续变化的声明。71信任门槛、112 API math、真实钱包/keeper与19已暂缓范围仍按下节，不因本轮回归解除。本机证据：个人基础 `.local/acceptance/independent-followup-20261114/`（PR快照、完整组件日志、CI摘要、UI记录）；56开发同目录（scratch spec/config、atomic-size.json/log），诊断文件不进入产品PR。

## 四需求上游刷新（2026-11-14）

本节优先于下方历史状态。角色：FESOL-56/19/20/72 原开发线的依赖集成与既有 Draft 交付更新。本轮 GitHub、远端源码和真实部署已重新核验；Linear viewer/team 查询正常，但目标 issue（标识及既有 UUID）返回 Entity not found，完整只读同步仅见40项、缺少本轮目标及关键依赖。因此无法核实当前 Linear 正文、关系和新评论，不把历史状态当作本轮事实。未修改 Linear、发布协作评论或合并上游。

- FESOL-57 #3242 已 MERGED，head `1e4d3350bc79f15f53fdc1d3ac8d9544c6e20a86`。最新 release `84ab9293a8e25e1312f35a20893752df480e0e0b` 已含 SDK 2.9.2；消费官方新版数学、结算/触发舍入及数值工具，不保留旧集成实现覆盖新版。个人基础仅同步 release，不混入未合并业务。
- FESOL-52 #3193 仍 OPEN，head `e712a1d342e994d85f77e52a748e081e48f559f3`，已含已合入release的57源码。56 先合入并保留确认 slot tracker、统一订单 metadata/parser、新鲜度和缺价拒绝；适配 walletTokens 到纯 `gmsolOracleUtils`。20 再消费56并保留通知/回执/恢复扩展，19消费20，72仅更新开发组合，独立PR仍为18文件。
- 19 从旧 `proDiscountFactor` 读取交易折扣的兼容映射改为新版 `selectFeeDiscountFactor`；共享 selectors、价格影响及费用展示采用上游独立字段与净价格影响语义，保留19的 EVM 审批/提交隔离。19已延后的支付币兑换、max leverage一致性、完整raw-account数学对照及GT Rewards不扩大实施。
- 51 #3195 `2495be234e`、92 #3243 `5e081e5ab1`、15 #3201 `056f8d689c`、25 #3238 `07117e1691`、fee #3205 `087a98fa37`、orders #3207 `c711f6ebe7` 本次未见新head；不重复集成等价提交。未合并前置仍须各自评审，56→20→19的交付依赖保留。19 development已集成15/25；delivery沿用既有边界，仅含15的trade-state/storage guards，不补带15 selector/token metadata和25 list UI；完整入口验收仍需这两项单独交付。
- gmx-api origin/main 更新至 `5532701`，源码主SDK已2.8.0、sdk-next别名2.9.0（不再将历史2.2.1描述当当前源码）；固定子仓库checkout/gitlink保留。真实 `/v1/markets/config` 67市场均无tradeMath，FESOL-112上线条件仍未满足；SDK源码升级不能代替API启用。
- 主网只读ALT于slot `469359341` 核验：两表active，73/155地址，均仍由 `FQNU5wn6fVdnPnSZyHL3PmCJsNLTi4Cf8dKU7f3MQjXj` 持有authority，当前预期authority map为空。ALT工具passed只证明active/layout；生产信任门槛仍未满足。`solanaTrading=true`、service disruption banner=false。未创建表、修改flag、签名或广播；1255/1232 byte有限边界组合仍是历史未解除风险，本轮未重跑模拟。
- WASM仍固定 `0.11.0-beta.1`、source `7fe4008292ffc09061f3a733ad9b5cd2e6235fa8`，不因TypeScript SDK变化自动升级。用户于本轮收尾后明确确认最终使用此版本，版本选择已解除待确认状态；不推断为维护者本人回复。下方历史版本待确认表述不再代表当前阻塞。


| 需求 | Development HEAD | Delivery HEAD | 既有 Draft PR |
| --- | --- | --- | --- |
| FESOL-56 | `d6e1b7ba05d8c75edf20a9f4b183c086300962e0` | `2ecfebba845108c068ff8364638909ff9375539e` | [#3258](https://github.com/gmx-io/gmx-interface/pull/3258) |
| FESOL-19 | `1155c46f87d68a38806c2b9f2350bd83a16c8441` | `e4e9067a0fef8d02a84478c8344ea4a131b9c1e8` | [#3262](https://github.com/gmx-io/gmx-interface/pull/3262) |
| FESOL-20 | `7c45d1e20dbf75cb77294591837f6f3c1b7045d6` | `613d33cf39b27675d96ac0f71ef6c6afff4b043b` | [#3261](https://github.com/gmx-io/gmx-interface/pull/3261) |
| FESOL-72 | `7b26f6feec92e17166627731e79834c799165225` | `2f2ac8477192cdf07313db292bc11cbcd3bf9238` | [#3259](https://github.com/gmx-io/gmx-interface/pull/3259) |

验证（仅本轮实际执行）：56 development 的app/landing types、19 files/105 tests与SDK 65 files/965 tests、SDK零warning lint通过；56 delivery immutable install、SDK build、零warning app lint、types、完整frontend **3446 passed/1既有skip**、最终Lingui和8GiB production/WASM build通过。20 development/delivery均在重新构建SDK后通过types及18 files/89定向tests，包含真实通知组件；delivery零warning lint、最终Lingui及8GiB production/WASM build通过。19 development types与完整frontend **3479 passed/1既有skip**，delivery完整frontend **3477 passed/1既有skip**；19 delivery的零warning lint、types、最终8GiB production/WASM build及当前配置bundle hash/glue隔离均通过。72 development完成fresh SDK build、types及3 files/17 tests；72独立delivery完成fresh SDK build、types、零warning app lint和loader 1 file/2 tests，仍为18文件。72 delivery最终8GiB production/WASM build及配置bundle hash/glue隔离通过。SDK/WASM source、锁定toolchain、Docker recipe与vendor字节未变，复用既有GMX CI/source reproduction，不称本轮重跑Rust。

过程中修复19自动合并遗留的重复TP/SL feeDiscountFactor并移除其旧pro折扣映射；生成声明缓存旧内容导致的缺导出错误，在各目录重建实际SDK后复验，不改业务API掩盖。19/72 development重复的同名build script经Yarn规范化去重，保留现有有效命令。56/19原开发线提取新增费用、价格影响、funding payout和quote错误文案后精确转入对应交付。构建hash核验只使用当前配置指向的`0.11.0-beta.1-gmx.1`，旧版本public/build残留不作为当前hash失败或加载证据。原始本机证据在各目标 `.local/acceptance/upstream-20261114/`；只读快照保存于个人基础同目录。本轮CUA inventory未发现可用浏览器/native Chrome窗口，不能将本轮构建或旧浏览器记录称为新UI验收。


正式release merge commit `84ab9293a8`与57 head `1e4d3350bc` 的完整tree同为 `4a6a6d5c2afd86cc3d31717dec8b3b749a906359`。52携带57 head而非release的merge记录；收尾为七个现场补合正式release记录，各现场合并前后完整tree均相同，72独立delivery此前已合入。此历史补齐不触发重复测试；source树身份及前后SHA在本机`release-history-sync.json`。

四条development均已推送my-gmx，四条delivery均推送my-gmx-pr并核对远端完整HEAD与上表一致，全部OPEN/Draft、base release。PR正文已重写为当前实现/依赖/验证/验收边界，并明确还在自审与测试、未到正式review、上游仍可能变更。收尾快照的新HEAD远端Audit、general、SDK standalone、WASM reproduction和Component检查仍IN_PROGRESS，未宣称新run全绿，也未将历史403套用于当前run。各任务registry已重绑最新development/delivery与release基线、刷新notes；本轮只读RPC代理已停止，未接管或关闭其他既有服务。

## gmx-prompts review 与修复（2026-11-13）

用户目标：让 FESOL-19/20/72 当前 Draft 经 gmx-prompts review，修复已核实的重要且能独立解决的问题。本轮为单 Agent 人工审查；使用最新 gmx-prompts 的 `gmx-interface-review`、`gmx-solana`、开发/测试/项目规范。没有可调用的 `/code-review` 或 `/security-review` 命令，不能声称运行了原生命令；通用正确性与安全检查人工执行。没有发布 review 评论、请求 reviewer、转 Ready、合并、修改 Linear 或签名广播。

审查范围以 GitHub 当前 head 和 release merge result 为准：19/20 已包含 release `83474e0e94`，另对 72 创建 detached 实际合并结果 `0ea2e9395b`（tree `92c615eeed87f7350f593f9cc226048d3ab37d8a`），不将该临时合并提交带进独立 PR。复用同阶段已核验来源，不以 development 相对 release 的全部个人差异冒充 PR 范围。PR 既有评论/review/inline 查询为空。除整体上下文阅读外，分别执行除法/分母、交易步骤、分支保护、单位语义四遍定向检查，以及 success/error/timeout/reject/unmount 的状态收尾检查；针对 SDK/IDL 与 API 接缝核对固定源码及可观测部署边界。

| 需求 | 已核实问题与处理 | 当前交付 head | 本轮结论 |
| --- | --- | --- | --- |
| [19 / #3262](https://github.com/gmx-io/gmx-interface/pull/3262) | 中等：共享 TradeBox 在 Solana 可触发 EVM `eth_getCode` 账户类型读取及 `/incentives` 请求。禁用对应 SWR key，并隔离缓存 EVM 返回值；切回 EVM 恢复正常读取。新增跨网络回归在修复前实际失败、修复后通过。另修复零 warning CI 的 sender import 和 TP/SL fixture | `69ba4dab7a` | 本轮已核实、可独立修复的问题均处理；完整需求验收仍 BLOCKED/部分范围暂缓 |
| [20 / #3261](https://github.com/gmx-io/gmx-interface/pull/3261) | 通用 CI 因 sender spec import/order warning 失败；原 development 修复 `8a7ac5a454`，精确转入 delivery `6087908e19` 并被 19 消费。不是新增业务缺陷，不向他人重复发布 lint finding | `6087908e19` | 未核实到其他需独立修改的重要问题；新订单/keeper/toast 整体验收仍 BLOCKED |
| [72 / #3259](https://github.com/gmx-io/gmx-interface/pull/3259) | 手写构建/loader/CI/hash 链未核实到新缺陷；保持业务 head，无无依据修改 | `0f36780317` | 构建/hash 部分有证据；签名落链和版本确认仍 BLOCKED |

所有修复先在原 development 验证，再 cherry-pick 到既有 delivery，同一 Draft PR 已推送更新；PR 正文补充审查方法、修复、证据、未验收项及仍未到正式 review 阶段、上游变化可能导致继续修改。19 development `e4cf921834`，20 development `8a7ac5a454`。未改 57 作者代码，未扩大 72 独立 WASM PR 范围。

### 本轮机械与运行证据

- 19 development：修复前回归确证 Solana 初始化仍调用 EVM account code reader；修复后跨网络读取隔离 + TP/SL 2 files/18 tests passed，变更文件严格 ESLint、app/landing types passed。delivery：`lint:ci` 零 warning、`tscheck:ci`、完整 frontend **347 files/3469 tests passed，1 file/test skipped**、production `build-app` passed。所有 Node/Vite 构建使用 `NODE_OPTIONS=--max-old-space-size=8192`。SDK 输入未变，沿用上一轮相同 SDK/锁/配置/vendor 的 954 passed 证据，不冒充新跑。
- 20 delivery：`lint:ci` 零 warning；transactions/orderTracking/真实 notification component 回归 **6 files/36 tests passed**。本次只有 import 顺序变更，沿用原同目标完整 frontend 3459 passed/1 skipped、SDK 954 passed、types 与 production build 证据，未机械重跑所有未受影响检查。
- 72 最新 release 合并目录：immutable install、app/landing types、gmsol **5 files/19 tests passed**、应用 WASM bundle/hash gate build passed。固定 Rust 输入与 8 vendor 文件未变，沿用已通过的独立 byte reproduction 与真实 GMX WASM CI `43385852331`，本次未再跑 Rust。独立交付目录和临时 merge result 证据分别标明。
- 原生现有 Chrome 打开 19 实际 production merge result `127.0.0.1:3019/trade`，已检查 flag-off 的 EVM 基线、flag-on Solana、重载、EVM 切换、返回 Solana/重载，TradeBox 显示市场/限价及 TP/SL，Solana 不提供 swap。修复前主文档资源缓冲看到 17 条 `/incentives`；修复后 Solana 重载采样 90 条资源中 0 条 incentives。后者是有界主文档样本，不能证明所有 worker/EVM RPC 为零；账户读取隔离由可复现边界回归证明。Console 的 Privy localhost `frame-ancestors` CSP 拒绝、广告连接失败、TradingView unload policy 及 metrics 429 单独保留，不归因为本轮新增代码问题。没有绕过 CSP 或操作钱包签名。用户随后正在使用浏览器，停止争用原生窗口；测试 origin 的 Solana 本地 flag 保留开启，不误称恢复初态。
- 19/20 远端 general 旧 head 的失败已读日志确认为上述 lint warning；旧组件 workflow 用例通过，失败在报告 Pages 发布/评论 HTTP 403（fork 权限），没有扩大权限。新 head 的远端 CI 是新的运行，不能用旧结果冒充新 run 全绿。
- 收尾远端快照：19/20 新 head 及 72 既有 head 均确认 OPEN Draft、base release；19/20 的新 general 与部分 checks 仍运行中，72 因正文更新另起 general，既有同 head 成功不等于新 run 已结束。72/WASM 既有成功保留，20 新组件 run `43416516116` 已读完整日志：286 passed（4.1m），仅 Pages 部署和报告评论 403。临时 preview 3019 已停止；其他服务未接管/停止。
- 部署定向复查：`https://solana.gmxapi.io/v1/markets/config` 返回 67 市场，`tradeMath` 存在 0/gmsol 0。新鲜 gmx-api origin/main `marketRecords.ts` 仍缺该标志；源码不替代部署。无版本确认、受信 LUT、真实 keeper 或签名落链的新证据。

### 验收逐项边界与后续人工检查重点

| 需求验收项 | 本轮状态及证据边界 |
| --- | --- |
| 19：共享 market/limit increase + 附加 TP/SL；已有仓位 TP/SL tab；不支持模式隐藏 | 代码/mapper/共享组件回归、未连接钱包页面已验证；成功开仓/加仓及 TP/SL 真实落链不可验，BLOCKED 于 71/112/钱包授权 |
| 19：支付币转换、签名、pending/success/failure | 直接抵押币/native SOL 路径、确认不冒充 fill、异常恢复有测试；支付转换为用户暂缓项，真实签名未验 |
| 19：输入/池/抵押币与杠杆交互、最大杠杆、k-token 价格 | 共享逻辑、杠杆改变保留支付量、visualMultiplier/ABI 单位代码与回归覆盖；最大杠杆标签和含费 buffer 一致性暂缓，完整界面数值验收未完成 |
| 19：执行预览/acceptable price、Collateral Spread、GT VIP、GT Rewards | 共享布局与来源/禁用条件已审查；线上缺 gmsol math，simulate_order 同输入数值对照未建立；GT Rewards 暂缓；不把历史 spread 设计确认扩大为本轮验收 |
| 19：TP/SL 目标价抵押品 %/$ 双向换算 | long/short、TP/SL、单位切换 17 组件测试通过；真实订单与协议数值一致性仍待联调 |
| 19：发送 toast 不误报 fill，EVM 保留 | 与 20 集成的代码/真实组件回归已验证；19 旧正文的 sending-only 由关联 20 执行阶段覆盖，不能把组合行为描述成 19 单独 sending-only |
| 20：两阶段、失败/取消、相关性、缺失/延迟、布局/链接/关闭 | parser/reducer/reader/真实组件的可复现测试通过；program/store/order/action、failed tx、复用生命周期、分离 execution/closure、same-slot 顺序均审查；新订单实时 keeper、取消 reason 和浏览器组合 toast 仍未验 |
| 20：GMX RPC 跟踪与执行后 gmx-api refresh，无 Corvus | 源码/回归已验证；刷新 slot/freshness 不保证实际部署 keeper 业务验收；缺证据保持 unresolved；用户关闭、切钱包/网络、unmount 中断各自通知，不全局清空其他任务 |
| 72：GMX CI 构建、app 加载 GMX build、hash 进入 PR | 构建、加载/隔离测试、固定 hash、实际 GMX CI 及此前原生浏览器证据成立；本轮最新 release 合并结果额外通过安装/types/tests/WASM bundle |
| 72：新版 mainnet flows land；版本相对原始 0.10.0 | 未验：此前仅 unsigned simulation，不是签名落链；0.11.0-beta.1 为用户选择，maintainer 认可仍待确认；可信 LUT/原子交易大小边界保留 |

人工接续优先：71 提供 LUT 后验证可信/冻结状态与有限 acceptable-price 三单 1232-byte 边界；112 上线后对照 raw-account simulate_order 并跑受授权真实链路；复核 20 部署事件 ABI 与新 lifecycle receipts；解决用户暂缓的 19 范围前不转 Ready。代码审查完成不等于这三个需求整体验收完成。

## 四条 release Draft（2026-11-13）

用户已明确授权19/20交付，新增20 [#3261](https://github.com/gmx-io/gmx-interface/pull/3261)、19 [#3262](https://github.com/gmx-io/gmx-interface/pull/3262)；既有56 [#3258](https://github.com/gmx-io/gmx-interface/pull/3258)、72 [#3259](https://github.com/gmx-io/gmx-interface/pull/3259)本轮核实仍OPEN/Draft、base release。56 head `11da18dfb7`、72 `0f36780317`无需为本次交付改动。

19/20从最新release `83474e0e94c88c2b4a18cd436a564b97062f807f`重建纯产品delivery；依赖关系56→20→19，72保持独立WASM范围。PR公开披露未合并前置、19的15/25市场/仓位入口依赖和暂缓范围。实际delivery验证、heads及后续原development修复入口见[20交付记录](issues/FESOL-20.md#release-draft-已交付2026-11-13)和[19交付记录](issues/FESOL-19.md#release-draft-已交付2026-11-13)。此节替代下方“19/20没有PR”的历史观察；Draft不等于Ready、可独立合并或真实落链验收完成。未改Linear、请求reviewer、合并或签名广播。


## 当前推进决定（2026-11-13）

用户在独立开发切片完成后明确：**FESOL-19剩余问题暂缓，之后再处理**。当前不再自动推进最大杠杆一致性、兑换、WASM数值对照、GT Rewards及完整下单验收；保留缺口与外部条件，不计作已完成或需求豁免。恢复清单和原开发现场见[FESOL-19当前决定](issues/FESOL-19.md#当前决定剩余问题暂缓2026-11-13)。此决定优先于下方早期“优先继续19”的建议，不扩展成其他需求的暂停，也未修改Linear。

## Draft交付就绪核对（2026-11-13）

用户询问56/19/20/72能否先向release提交Draft。本轮为交付就绪分析，未新建19/20 PR、修改业务或恢复19暂缓事项。结论：可以先整理为明确披露未完范围和依赖的Draft，可信LUT/真实验收未完成不阻碍提前评审，但不能宣称Ready或可合并。

- 56已有Draft #3258，远端head `11da18dfb7`，最新恢复补丁及atomic说明已发布，无遗漏业务提交。当前WASM/Audit/standalone及一轮general成功，另一轮general仍运行；Component workflow `43408278858`失败日志本轮实查为Pages/评论403，正文All tests passed，不据此新增业务修复。reviews为空。
- 72已有Draft #3259，head `0f36780317`，保持独立WASM范围；仍需版本确认与新版主网落链验收，不重复创建PR。其Component报告权限失败边界沿用已核实记录。
- 19/20目前没有独立PR。当前19运行源码消费20的sender/通知契约，20消费56；交付整理顺序宜56→20→19。需从最新release重建各自delivery、精确转入已核验业务成果，列明必要未合并前置，不能直接将个人开发分支作为release交付。只读tree diff确认个人基础与56 delivery之间仍含无关stats/indexer差异，19还集成15/25相关能力，不以整支对比差异作为本需求完整范围。19 Draft需明确列出已暂缓的最大杠杆/兑换/数学对照/Rewards等未完项。
- 上游release线上ref已前进至 `83474e0e94c88c2b4a18cd436a564b97062f807f`，相对既有交付基线`e471428074`新增13 commits（2.2.1合约/智能钱包等）；涉及SDK及本地化。此次没有fetch/合并/重建或声称新基线组合已通过。下一次实际交付应使用实时release并在真实delivery目录核验；56已有PR当前GitHub报告MERGEABLE，不因release前进就盲目重写其历史。

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
