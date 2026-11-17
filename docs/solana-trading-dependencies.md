# Solana 交易链路依赖审计

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
