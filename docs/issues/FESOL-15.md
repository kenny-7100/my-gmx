# FESOL-15 — Solana 市场选择器与 header

## 五需求晚间前置核验（2026-11-17）

TRD-63原#3201已于20:14 CST合并、APPROVED且checks成功；不再列为冲突或review待办。 角色为只读依赖调研，来源与验证边界见[统一核验](../solana-trading-dependencies.md#五需求晚间前置核验2026-11-17)。

## PR commit 补签（2026-11-17）

用户明确授权为 PR #3201 当前唯一 commit 补 GPG 签名并更新 PR。交付目录 clean、本地与远端 head 均为 `786dcaadc7e2ab3399c5d2f934f18430a6c0e116` 后执行 signed amend；新 head 为 `7c9968cc0335590879c3734595c4772014233778`。逐项核对 tree、parent、author、author date、message 完全一致，仅签名及 committer 时间等提交元数据变化；本地 `git verify-commit` 返回 Good signature。使用绑定旧 SHA 的精确 force-with-lease 更新 PR 原 source branch，GitHub 回读 `verified=true`、`reason=valid`，PR head 与新 SHA 一致。

本次无业务改动，复用原 tree 的既有验收结果，未重跑业务测试；新 SHA 的 CI 状态需单独查询，不将旧 head 的 CI 状态冒充新 head 已通过。PR 描述及 review 状态未修改。下方旧 SHA 均保留为当时调查/验收的历史版本。


## AC2 口径调查结论（2026-11-17）

用户要求独立搜集信息后给出结论。本轮角色为需求/review/跨仓库源码调查；未修改业务、Linear、PR描述或review线程。**结论：撤销此前将“AC2金融口径选择”列为独立外部阻塞的判断。现有需求、review与已合入GMX的规则足以确认本PR沿用GMX计算并说明差异；没有发现要求改回GMTrade294x或另开产品选择的指令。字段说明及此前真实API/UI验证已完成，可据此交正常review。正式AC2验收勾选、review批准与合并仍不能由此冒充完成。** 下方历史记录的“AC2语义确认尚待外部决定”按本结论收敛，不再让Kenny重复组织尚无证据需要的新决策。

### 原始要求和review实际要求

- 实时读取[TRD-63](https://linear.app/gmx-io/issue/TRD-63)正文、关系及完整评论（0条）。AC2要求确认数据源、计算定义和不可用/非等价字段的处理；没有要求复制旧GMTrade数值。现有字段表明确最大杠杆使用GMX双约束、5x向下取整、UI cap，并写明“This is a UI limit, not a copy of GMTrade's displayed maximum”。表末仍写AC2 review未完成，不能将这份作者说明当成最终批准。
- 完整重读原PR的reviews、issue comments及inline replies，未见新产品选择要求。[Divhead首轮总评](https://github.com/gmx-io/gmx-interface/pull/3201#pullrequestreview-5788682179)原文为：“For AC2, could you add a short field table to FESOL-15? Max leverage uses GMX's formula, so it's lower than what GMTrade shows (ETH 255x vs 294x), and that should be written down.” 他已解释公式差异，要求补字段表；不是要求294x一致或等待产品方选公式。同一review说明当时header OI和net rate与gmx-api同一时刻一致。
- [Kenny于11月9日回复](https://github.com/gmx-io/gmx-interface/pull/3201#issuecomment-6734943525)已补AC2字段及杠杆说明。后续review发现的是EVM collateral P1，未提出新的AC2口径异议；“未提出”不等于最终approve。TRD-130（API config/values）负责人亦为Divhead，不能再将数据定义review完全描述为尚未与后端核对。

### 两套杠杆规则的源码证据

- 当前交付源码仍是`786dcaadc7`。共享`getMaxAllowedLeverage`的来源为[已于2026-05-07合入的PR #2407](https://github.com/gmx-io/gmx-interface/pull/2407)，关联FEDEV-3759，commit `1f0b343f970d2ed109318137ac8fd8cc7ccc6aaa`。PR说明开仓项计入open/close两次手续费，清算项保留50% buffer，按5x向下取整；最终有APPROVED。它早于本Solana PR，不是本需求临时新增的风险公式。已存在的SDK测试覆盖equal/split factors、opening bound主导、取整与fallback。
- 只读fetch旧前端origin/main，实时远端SHA为`55639eefb623e28fd89ac858db228629d9f6a3aa`；API origin/main为`322b06ad0aa8466fa0042a47eb22701c52a82157`。保持旧前端本地HEAD `74170b8a`和API detached HEAD `b86956d`不动，未快进固定gitlink或干扰TRD-136服务。
- 旧前端实际TradeHeader将`sortedIndexTokens`交给HeaderPanel；[HeaderPanel](https://github.com/gmsol-labs/gmx-solana-interface/blob/55639eefb623e28fd89ac858db228629d9f6a3aa/app/src/components/TradeHeader/HeaderPanel.tsx#L693)将后端`token.maxLeverage`除以10^20后作为整数展示。旧仓库另有旧ChartTokenSelector的`getTradeMaxLeverage(...)/2`路径，不能看到同名helper就认作这条当前TradeHeader的公式。
- 同仓库[Go后端getMaxLeverage](https://github.com/gmsol-labs/gmx-solana-interface/blob/55639eefb623e28fd89ac858db228629d9f6a3aa/services/gmxsol-golang/task/cron/indextoken/index_list_task.go#L1185)取status中long/short最低抵押率倒数的较大值，`MaxLeverageUsage=1`，index再取各池最大值。这里没有GMX开平手续费项、独立清算buffer项或5x取整。用户提供的Rust后端快照`gmtrade-web-backend/src/aggregate/market_info.rs:max_leverage`同样取两侧抵押率倒数较大值，进一步支持旧数据契约含义；快照无远端版本，不据此认定线上部署。
- [API marketRecords](https://github.com/gmx-io/gmx-api/blob/322b06ad0aa8466fa0042a47eb22701c52a82157/src/domain/gmsol/markets/marketRecords.ts#L89)将Solana `minCollateralFactor`、清算factor（含关闭市场/0值fallback）和`orderFeeFactorForNegativeImpact`映射到共享字段，因子统一由20位乘10^10转30位，未发现此处误用小数或把maxLeverage数值直接搬运的迹象。原链上市场能力来自已合入[API #295](https://github.com/gmx-io/gmx-api/pull/295)；当前native计算经SDK2.9.3接续。

### 最新数据复算与边界

本轮重新GET官方Solana `/v1/markets/config`，ETH [USDC-USDC]仍是MCF=0.0034、liqMCF=0.0017、fee=0.00024。独立Decimal复算：

| 路径 | 计算及结果 |
| --- | --- |
| 旧后端规则在有效最低抵押率为0.0034时 | 1/0.0034=294.117647…，旧header整数展示294x |
| GMX opening bound | 1/(0.0034+2×0.00024)=257.731959… |
| GMX liquidation bound | 1/(2×0.0017)=294.117647… |
| GMX最终UI上限 | 较小值257.731959…按5x向下取整为255x |

修正此前推断：本组参数中旧路径1/MCF与GMX liquidation项数值恰好相同，不能据此说旧版294x是按GMX liquidation公式算出的。已经确认两套源码规则确实不同，且当前参数可重现255/294差异；没有取得11月5日线上旧版实际部署SHA和同slot数据，不声称完全重建当时每个池的快照或旧服务上线版本。

其余price/24h源、index聚合与selected market、hourly rate及不可用日期处理，现有AC2表已定义；此前同head真实API生产路径和原生页面验收继续有效，本轮无新源码/依赖/配置变化，不重复跑全量业务测试，也不扩大为全市场实时链上parity验收。原始review、PR2407、旧源码、最新config及复算输出保存在个人基础`.local/acceptance/trd63-ac2-investigation/`。

## 自动验收补齐（2026-11-17）

**后续 CI 收尾查询：** 用户要求核实最终结果，实时读取原 PR 当前 head `786dcaadc7` 的完整 statusCheckRollup，18个checks均为COMPLETED / SUCCESS，无pending或failure。包含PR描述编辑触发的三批追加运行；最新[Run Tests 44066265730](https://github.com/gmx-io/gmx-interface/actions/runs/44066265730)及[Audit 44066265516](https://github.com/gmx-io/gmx-interface/actions/runs/44066265516)均通过。此前“描述编辑后新任务仍运行中”的阶段状态已结束。PR仍MERGEABLE / CHANGES_REQUESTED，CI通过不替代review批准；本次不再编辑PR描述以免触发重复CI。

用户要求创建目标并完成可独立执行的验收。本轮以原 PR #3201 的公开 head `786dcaadc7e2ab3399c5d2f934f18430a6c0e116`、delivery 实际目录及其 SDK 产物进行验证；没有新增业务修改，上一阶段该 head 的 SDK build、types、lint、3374 项前端测试、生产 build、46 项原生数学结果仍有效。

**原生 Chrome 页面验收通过。** 使用用户现有登录/profile/扩展的同一浏览器，本任务 owned Vite `127.0.0.1:3035`，无测试 API 替换、无 mock、未连接钱包。桌面实际宽度 2560；另通过原生 DevTools UI 的设备工具验证 440×956 CSS px（iPhone 16 Pro Max preset），不是连接 DevTools 自动化或真实手机验收；完成后关闭设备工具及 DevTools。

| 检查 | 实际结果 |
| --- | --- |
| 默认排序与数值排序 | 列表默认 BTC / ETH / SOL；最新价格降序、升序切换成功，升序开头 kBONK / PUMP / kSHIB / kPEPE，恢复默认仍 BTC / ETH / SOL。初始 Tradebox DOGE 不当作列表排序失败。 |
| ETH 分类和别名 | Crypto → Layer1 保留 ETH；搜索 `ethereum` 仅返回 ETH，选择后 header 显示 ETH/USD [USDC-USDC]。 |
| 搜索与空结果 | `bonk` / `shib` / `pepe` 匹配对应 k-token；不存在的名称显示明确无匹配结果，清除后列表恢复。 |
| 千倍价格及选择联动 | kBONK、kSHIB、kPEPE 在行、header、规模估值单位使用 k 前缀与千倍展示；选择后 header 与相应池更新，价格持续变化。图表在异步加载后同步名称，未扩大为 TRD-85 图表全量验收。 |
| 空分类与未知日期 | Solana 仅显示 All / Crypto，无空 TradFi、Recently Listed 或虚构 New 标签。先在 Arbitrum 选 TradFi，再切回 Solana并打开列表，自动回到 All 且有市场。 |
| 跨网与刷新 | Solana kPEPE 刷新保留网络/市场；切回 Arbitrum 显示 BTC [BTC-USDC] 且 USDC 抵押品正常初始化；再回 Solana 保留 kPEPE。Swap 在 Solana 隐藏。 |
| 窄屏 | 440px 选择器显示 BTC / ETH / SOL，搜索 ethereum、选择 ETH、更新 header 正常；header 详情可展开显示 volume / OI / liquidity / net rates，无空 TradFi。只声明该 CSS 视口，不冒充真机或全部设备。 |
| 默认开关行为 | 在当前 head 关闭本地 solanaNetwork 后回到 Arbitrum；点击 Solana 显示“由独立域名提供服务”的 GMTrade 提示及外链，仍保持 Arbitrum。最终该本地 origin 开关为 off，未打开外链。 |

**AC2 可自动核对的技术部分通过，语义批准仍保留。** 18:10–18:12 CST 采集真实 Solana `/v1/markets/config`、`/values`（各67条）、`/pairs`（95条）和当前配置的 Arbitrum keeper `/prices/tickers`、`/prices/24h`。CLI 默认 User-Agent 被 keeper 返回403，使用普通浏览器 User-Agent 后同一官方地址成功，未换服务、绕过安全提示或修改产品 fallback。临时 Vitest 读取这些真实响应，经生产 SDK parser、merge、oracle mint 映射、buildGmsolTokensData、composeGmsolMarkets 和 UI 共用计算函数组合为63个有价格的静态列表市场，1项检查通过；临时检查与数据保留 delivery `.local/acceptance/trd63-ui-final/`，不加入产品测试或 fixture。

- 价格来自 Arbitrum keeper 通过 `arbitrumTokenAddress` 映射到 Solana mint，取 min/max 中价；k-token 显示乘1000，24h high/low同样缩放，百分比不变。采集的 PEPE 原价0.0000038386285 → kPEPE 0.0038386285；SHIB原价0.000003822108 → kSHIB 0.003822108。页面实时价格随后变化，不声称跨分钟数值完全相等。
- volume 使用 Solana pairs 的 `pool_id` / `target_volume`，header按选中 market，selector按 index 聚合；OI用共用 getOpenInterestForBalance，百分比由 long/total 推导；liquidity取 reserve及OI剩余额度的较小值并截零；净费率为每小时 funding 收付减 borrowing。真实 kPEPE [WSOL-USDC] 采集值：volume $7331.8522、OI $2723.6849/$384.0031（88%/12%）、liquidity $9366.5394/$7700.0265、净费率 −0.0115366%/+0.0728720%，与页面 $7.3k、$2.7k/$384.0、$9.4k/$7.7k、−0.0115%/+0.0729% 的格式化一致。SHIB OI $148.0411/$201.0229（42%/58%）、liquidity约$30.1k/$30.1k、净费率−0.0014%/+0.0010%也一致。BONK/ETH在采集与后续页面之间有实际OI变化，不将时序不同误报为计算错误。
- max leverage 使用统一 GMX opening/liquidation 双约束、5x向下取整以及既有UI cap；实际API配置计算 BTC400x / ETH255x / SOL220x，与列表一致。另以独立 Decimal 算式核算 ETH：minCollateralFactor=0.0034、liquidation factor=0.0017、position fee=0.00024；opening 上限 1/(0.0034+2×0.00024)=257.73196x，liquidation 上限 1/(2×0.0017)=294.11765x，取较小值再按5x向下取整得到255x。294x恰好对应此时仅liquidation约束的数值，但没有旧GMTrade同版本代码/数据证据，不能认定其根因。不能由此宣称与旧 GMTrade 294x 的产品语义已获认可，也没有独立链上 reference 数学验收；AC2最终口径由相关负责人/reviewer确认。
- 上市日期仍无可信来源；本轮确认不显示虚构日期。TRD-69是已存在的后续需求，本任务不实现其日期能力。

**CI 的新增事实。** 两个当前 head 的常规 workflow 最初分别在 SDK public API 的 fetchMarkets（GET）和 cross-chain withdraw prepare（POST）30秒超时；本地完整 public suite 首次又在另一项 subaccount order prepare 请求超时（49 passed / 1 failed / 2 skipped）。第二次本地完整重跑为 **4 files / 50 passed / 2 existing skipped**，未改代码、超时、测试选择或端点。各失败点均为 Arbitrum SDK 公共接口，PR相对release无SDK文件差异；这支持外部请求不稳定的判断，但不是已经定位后端根因。已对两个失败 workflow 各重跑一次，最终结果见下段。Audit、组件测试、SDK standalone、两项Pages均已通过。

两个失败 workflow 各重跑一次后，[44053521985](https://github.com/gmx-io/gmx-interface/actions/runs/44053521985)与[44053464492](https://github.com/gmx-io/gmx-interface/actions/runs/44053464492)均为success：前端3374 passed/1既有skipped、SDK982 passed、multicall14 passed/1既有skipped、public50 passed/2既有skipped；lint、types和SDK standalone也通过。连同Audit、组件测试和两项Pages，当前head远端checks全绿。首次失败日志与最终成功日志均保存在本机证据目录。

随后更新PR描述触发了 `.github/workflows/pr-tests.yml` / `audit.yml` 的 `pull_request: edited`：同一head又自动启动重复CI。因此上段“全绿”指描述更新前已完成的两条重跑及相关checks；最终查询还有描述编辑触发的新任务运行中，不将pending写成passed。源码、依赖、配置和工具链未变，已完成的匹配结果仍有效，不为纯PR描述编辑机械追加本地测试或无限等待同输入重跑。

本轮未发现需要新增修复的本需求缺陷。原PR英文Validation同步本head的页面/真实API/CI结果与金融语义、真机、日期边界，业务head及单提交历史保持不变。最终仍须区分技术验收、外部接口可用性、AC2金融语义批准及review批准；不因线程未resolve而重复改代码，也不代 reviewer resolve/approve。未签名用户钱包、未广播交易、未修改Linear或发送review消息。

## 历史 gitlinks 清理完成（2026-11-17）

用户在明确解释历史替换及 force-with-lease 后创建目标并授权实施。基于 fetch 后最新 release `22e1eda78ec0d51eae8104548744fb846f40d542`（新增 #3285 / SDK2.9.3 原生数学），在原 delivery 目录切换到重建交付分支 `solana-market-selector-header-release-trd-63-clean`，生成唯一需求提交 `786dcaadc7e2ab3399c5d2f934f18430a6c0e116`。11 个需求文件与旧 head `f6e2282703` 逐字节一致，相对最新 release 仍 +277/-25；两 head 的其他差异完全来自已合入 release 的 SDK 文件，没有修改业务语义。原 development 保持既有现场；此次仅重建 delivery 历史，没有第二处独立开发。

历史检查：`release..HEAD` 只有一个提交，其父为最新 release；新提交 tree 无 mode160000；引入 gitlinks 的 `183aacb863` 不再是新 head 祖先。旧 head 已本地备份 `backup/pr-3201-before-history-cleanup-20261117`。本次清理保证这些旧提交不会经该 PR 的 merge ancestry 带入 release，不代表 GitHub 已永久抹除既有 SHA、旧 diff、缓存或其他备份引用。

在重建后的实际 delivery 验证 SDK build、app/landing typecheck、ESLint、完整前端 suite（334 files / **3374 passed，1 skipped**）、生产 build 全通过；上游新增原生数学 suite **46 passed**。依赖锁文件未变，沿用该目录自身安装，SDK 产物已重建。没有复用旧 head CI 冒充新 head 检查，也没有新增浏览器验收结论。

已使用精确 expected SHA 的 `--force-with-lease=refs/heads/solana-market-selector-header-release-fesol-15:f6e228270340a7889df62aa96dbb5103a233a63f` 更新同一原 #3201。随后从远端 fetch 回读并核实：公开 head=786dcaadc7、只有1个PR提交、11个文件，旧 gitlink 提交不在祖先链；GitHub 为 MERGEABLE。正式 fork 同步保存新 clean ref，未创建重复 PR。原 PR 描述同步最新 release、历史清理、TRD-69 和实际验证；保留非 Draft 状态，不请求 reviewer、不 resolve 线程、不合并。

发布后新 CI（Audit / 组件 / 常规测试 / SDK standalone / Pages）正在运行，当前 reviewDecision 仍 CHANGES_REQUESTED；不称已获 reviewer 认可。原总评的公开 gitlink 历史交付项现已处理；AC2 语义确认、完整页面回归及上币日期后续仍按各自边界保留。此前下方“未清理”均为本次清理之前的历史记录。owned Vite3035 在切换重建历史时已停止，未触碰 TRD-136 服务。

## 全部 reviewer 反馈复核（2026-11-17）

用户要求查看全部 reviewer 问题。本轮实时完整读取 #3201 的 reviews、issue comments、9 个 reviewThreads 及所有线程回复（无后续分页），逐项对照当前公开 head `f6e228270340a7889df62aa96dbb5103a233a63f`，不是仅按作者“fixed”回复判断。reviewer 为 Divhead；9 线程全部 unresolved，8 条 outdated、TradFi 1 条非 outdated；这些元数据不代表缺陷仍存在或 reviewer 已认可。未发评论、resolve thread、请求 reviewer、改业务代码或重写历史。

| reviewer 问题 / 原评论 | 当前核验结论 |
| --- | --- |
| [ETH 不在 Crypto / Layer1](https://github.com/gmx-io/gmx-interface/pull/3201#discussion_r4483355195) | 已修：toToken 先转 native ETH 再取元数据；现有测试通过真实分类 filter 验证 ETH。 |
| [空 TradFi 与跨网络残留选择](https://github.com/gmx-io/gmx-interface/pull/3201#discussion_r4483355210) | 代码已修：按 options 是否有 tradfi 决定 excludedTabs，并对旧 tab/subcategory 回退 All。本轮静态核验；此前全量 suite 通过，但新 head 尚未重做该桌面/移动端页面用例。 |
| [unsupported Swap 不应把 Short Limit 改为 Long Market](https://github.com/gmx-io/gmx-interface/pull/3201#discussion_r4483355226) | 已修：setter 保留 previousOptions，仅 storage read 无前态时 Long/Market fallback；trade type/config/swap order 三入口回归验证 Short、Limit、输入金额与 storage 保留。 |
| [默认顺序错误从 DOGE 开始](https://github.com/gmx-io/gmx-interface/pull/3201#discussion_r4483355231) | 代码已修：comparator 使用 networkId，Solana promoted 配置为 BTC/ETH/SOL。注意首次 Tradebox 选中 DOGE 不等于 selector 默认列表排序失败；前者 firstMarket 与此 comparator 不同。新 head 列表页面顺序仍待实测。 |
| [重复映射、不可达 native 分支、无效 isChartDisabled](https://github.com/gmx-io/gmx-interface/pull/3201#discussion_r4483355239) | 已修：行数据和 comparator 复用 getWrappedTokenAddress，Solana index mint 原样返回，不再重复 native 特判与无效 filter。未按 nit 字面调用 convertGmsolTokenAddress，但此处无 native perp option，该函数对 index mint 也原样返回，语义一致。 |
| [共享 TokenIcon 特判符号](https://github.com/gmx-io/gmx-interface/pull/3201#discussion_r4483355252) | 已修：共享组件与 release 一致，ic_wsol.svg/ic_wgmx.svg 随需求交付，无 WSOL/WGMX symbol 特判。 |
| [测试仅重述 multiplier/prefix/decimals 配置且漏 ETH](https://github.com/gmx-io/gmx-interface/pull/3201#discussion_r4483355260) | 已修：配置复读用例已移除，保留真实分类、base58 大小写、native/index/collateral twin 行为测试。 |
| [listing 测试无 guard 也能通过、return masking](https://github.com/gmx-io/gmx-interface/pull/3201#discussion_r4483355273) | 已修：无效测试和 Solana return masking 已移除，Hook 仅用 null key 禁止请求；上一阶段真实 Hook/SWR 检查固定 chainId=Arbitrum，移除 guard 确实失败，源码已恢复。 |
| [P1 identity early return 阻断 EVM collateral 初始化](https://github.com/gmx-io/gmx-interface/pull/3201#discussion_r4519631690) | 已修：early return 只用于 unsupported Swap，Long/Short identity 仍执行 token/collateral fallback；fresh、restored Long/Short 回归均在本 head 已通过 suite 中。 |

总评 [5788682179](https://github.com/gmx-io/gmx-interface/pull/3201#pullrequestreview-5788682179) 还含以下独立交付要求，不能只看 9 条行内问题：

- **AC2 字段表与杠杆差异：文档已补，语义尚待确认。** 实时 TRD-63 正文已有 price/24h/OI/volume/rates/liquidity/max leverage/listing date 来源及规则表，注明 GMX 公式与 ETH 255x vs GMTrade 294x 只是当时快照；没有 reviewer 最终认可或后端一致性完整验收证据，不标 AC2 完成。
- **AC6 后续 issue：已创建。** 旧 FESOL-116 经官方 Linear 解析为 [TRD-69](https://linear.app/gmx-io/issue/TRD-69/confirm-solana-market-listing-dates-for-new-and-recently-listed)，当前 Backlog、TRD-63 子任务，确认可信日期语义/来源及后续交付归属。reviewer 要求“开后续”已满足，不等于日期能力实现完成。
- **先合 #3138/#3193 再基于 release 收敛：当前依赖与文件差异已满足，历史形态没有完全照做。** 两 PR 已合，当前 head 包含最新 release，仅 11 文件需求差异；本轮是普通 merge 保留公开历史，不是 reviewer 所述仅保留需求提交的 clean rebuild。公告组件当前与 release 一致；原“保留你的版本”针对当时等价实现及 prettier，不能覆盖后续 outage/app-update 变化。
- **从公开历史移除 `183aacb863` 的 gitlinks：明确未完成。** `git merge-base --is-ancestor` 确认旧提交仍为当前 head 祖先，旧树存在 8 个内部仓库 gitlinks。最终树删除不满足 reviewer 对 merge-commit 公开历史的要求；上一轮解决代码冲突不等于关闭这项 review。真正清理需另行授权历史重建/分支替换方案，不能擅自 force push。

当前 head 远端 checks 已全部 pass：Audit、Lint/Type/Tests、组件测试、SDK standalone、两项 Cloudflare Pages。组件 bot 也明确报告本 head All tests passed；不是沿用旧 CI。PR 仍 CHANGES_REQUESTED / MERGEABLE，没有 reviewer approve。上述“已修”指当前源码和已有匹配验证证据，不冒充 reviewer 线程已闭合或全部页面 AC 验收。

## 原 PR 已更新（2026-11-17）

用户随后明确要求“也更新 PR”，授权本次写入原上游源分支；已普通 fast-forward 推送 `056f8d689c` → `f6e228270340a7889df62aa96dbb5103a233a63f` 到 `gmx-io/gmx-interface:solana-market-selector-header-release-fesol-15`，未强推或改写历史。#3201 标题改为 TRD-63，正文换成当前 release、11 文件范围、实际测试/构建和局部页面验收边界，删除旧前置未合、旧全量验收及签名描述。远端确认 head 一致、**MERGEABLE**；mergeStateStatus 仍 BLOCKED，reviewDecision 为 CHANGES_REQUESTED。新 Audit、组件测试、常规测试、SDK standalone 与 Pages 检查运行中，未称 CI 全绿。原 PR 保持实际非 Draft 状态，未转换、请求 reviewer、回复 review 或合并。本次明确写入授权仅用于该 PR 更新，不改变 origin 长期只读约定。

## 上游冲突处理（2026-11-17）

用户确认 #3201 归 Kenny 负责并授权跟进上游、正确解决冲突。本轮角色为实现与局部验收负责人。当前需求 [TRD-63](https://linear.app/gmx-io/issue/TRD-63)，沿用原 FESOL-15 开发线及原 [PR #3201](https://github.com/gmx-io/gmx-interface/pull/3201)，不另建重复 PR。

- 实时读取 Linear 正文/关系、PR review 及源分支；直接前置 #3193/#3138、API #295 已合。原 PR head 为 `056f8d689c24889c5ffd32cba372c618ceace9a2`，In Review / Changes requested / CONFLICTING，实际不是 Draft。
- 复用原 development `/Volumes/kenny/gmx/gmx-interface-fesol-15` 与 delivery `/Volumes/kenny/gmx/gmx-interface-fesol-15-release`。先将原公开 review 修复接回 development（`fdcb63cf20`），再合入最新 release `7868f48f3e5cf1423a33a4e3f8cbbc9d5cd90d18`，development `b1a4dac7f20bca7e8e47749f79164fccbf49e274`；共处理与 release 的 35 处实际冲突。
- Provider、oracle、API、routes、公告与 locale 采用当前 release；移除旧前置自动残留的 fixture/sample API/adapter，保留 ETH 分类、networkId 排序、空 TradFi fallback、未知 listing date null key、unsupported Swap 保留表单与 EVM identity/collateral fallback、WSOL/WGMX SVG 等原 review 修复。仅将 11 个需求文件精确转入 delivery，未合入整支个人基础。
- delivery `f6e228270340a7889df62aa96dbb5103a233a63f` 相对 release **11 files / +277 -25**；原 PR head 和 release 都是其祖先，普通 merge，无 rebase/强推。11 文件与 development 完全一致，最终树无 gitlink，diff check 通过。公开祖先 `183aacb863` 的历史 gitlinks 仍存在，不冒充已满足历史清理意见。
- development SDK build、app/landing 类型检查、ESLint 通过，完整 suite **335 files / 3375 passed，1 skipped**；delivery 自身 SDK build、类型、ESLint、完整 suite **334 files / 3374 passed，1 skipped** 及生产 `yarn build` 全通过。构建使用 8 GiB；现有 Sass/包注释/chunk 大小提示保留，不是构建失败。针对性 5 suites / 35 passed 覆盖 lookup、tradebox、公告和 market filters。
- 另用未提交的真实 Hook/SWR 临时检查：networkId=Solana、chainId 保持 Arbitrum 时不请求 EVM listing dates，1 passed；去除 null-key guard 后相同检查产生错误日期并失败，已恢复源文件。测试不是仅对配置对象断言。
- 用户现有原生 Chrome、本 delivery 的 owned Vite 3035：默认 flag off 点击 Solana 仍提示独立 GMTrade；仅在该本地 origin 开启 solanaNetwork 后，真实 Solana DOGE 市场及价格、volume、OI、liquidity、净费率和 header 可加载，Swap 入口隐藏。尚未完整验收搜索/分类/k-token 展示及跨网往返；浏览器随后由用户切换，未继续干扰。未连接钱包/签名/交易。该 origin 实验开关当前保持开启，不能写成已恢复。

**发布边界：** development 推送 `my-gmx`，delivery 候选推送 `my-gmx-pr/solana-market-selector-header-release-trd-63-sync`。个人 fork 的旧同名分支位于另一条历史 `a2a051890a`，普通 push 被拒后已核实是旧交付线，不强推或整支合入；仅使用新远端候选 ref 保存同一需求成果，不建重复 PR。原 #3201 源分支实际位于 `gmx-io/gmx-interface`；AGENTS 规定 origin 只读，因此 fork 候选不会更新原 PR，公开冲突状态尚未解除。需用户为本次普通 fast-forward 更新原源分支明确允许例外；不要求重写历史、转 Ready、请求 reviewer 或合并。AC2 金融数据语义及历史清理仍单独 review，不将本次冲突修复宣称整需求 Done。本机日志在两目录 `.local/acceptance/trd63-20261117/`。

## 前置增量核验（2026-11-17）

本轮直接读取TRD-63/85正文与blockedBy：63直接前置为TRD-65（原52）和TRD-130（原64）；85直接前置为TRD-65和TRD-86（原50）。GitHub确认UI#3193于11月16日08:41:44UTC合入release、UI#3138已合、API#295（63/64市场配置数值）已合；两条的直接前置PR均已合。附带静态配置UI#3111已合，TRD-105网络lookup为Done（未找到独立PR，不将状态代替合并证明）。15/#3201和29/#3223自身仍Open、CONFLICTING；前置合并不代表自身已同步或现场验收通过。原113字段#3205/#3207仍Open/CONFLICTING，是扩展SDK契约后续，不混作两条已列直接前置；完整Depth/图表操作、金融API部署等验收仍需分别核实。本轮只查Linear/GitHub，不改代码或需求、不做部署/页面验收。

当前TRD-63；#3201原head056f8d689c未变，现CONFLICTING且Changes requested；多条review已有作者修复回复，需冲突处理和复核，不机械重新派同一缺陷。 统一证据、版本及跟进建议见[五需求依赖核验](../solana-trading-dependencies.md#五需求前置增量核验2026-11-17)。

更新：2026-11-15。角色：review 反馈吸收流程调查，不是本轮实现或验收负责人。
来源：[PR #3201](https://github.com/gmx-io/gmx-interface/pull/3201)。本轮实时读取 inline comments 和 reviews，未刷新 Linear、执行代码/页面验收或核对所有修复提交；不据此确认整需求完成。

## 本轮核实

- 2026-11-05 Divhead 指出 ETH 分类、空 TradFi、Swap setter 保留已有状态、默认排序应使用 networkId、复用地址映射、图标资源及无效测试等问题；作者于 11-09 逐项回复已修复。这些回复是历史修复证据，不冒充本轮重新验证。
- [图标评论](https://github.com/gmx-io/gmx-interface/pull/3201#discussion_r4483355252)要求新增 WSOL/WGMX SVG，沿用 WETH/WBTC 的已有机制，避免共享图标组件增加 symbol 特判。
- [测试评论](https://github.com/gmx-io/gmx-interface/pull/3201#discussion_r4483355273)指出没有 null key 也会通过，因为 chainId 仍是 Arbitrum；要求去除无效测试和 return masking。作者回复移除 guard 后新检查会失败；本轮未重跑该验证。
- [2026-11-10 后续回归](https://github.com/gmx-io/gmx-interface/pull/3201#discussion_r4519631690)：early return 阻断 identity update 的 collateral fallback，造成新 Arbitrum 页面和未存 collateral 的恢复场景无法初始化抵押品。作者回复在 `056f8d689c` 将 early return 限制到 unsupported Swap 并补回归；不能仅以原 Solana 用例通过证明共享 setter 修复完整。
- [首轮总评](https://github.com/gmx-io/gmx-interface/pull/3201#pullrequestreview-5788682179)还涉及未合并依赖、重建 release 和公开历史中的 gitlinks；这是交付与集成问题，与代码缺陷及待产品决定分别判断。

## 可复用结论与边界

2026-11-15进一步静态核对#3201 `056f8d689c`的setter，early return现限定unsupported Swap，identity update继续fallback；未重跑行为测试。同一历史问题也在29/#3223出现，需要先追源提交，不能据两个PR直接认定两次独立犯错。原Linear不可读，历史要求与跨组经验见[深挖调查](../review-learning-investigation-2026-11-15.md)。

反馈闭环调查结论和后续建议统一保存在[编码与自审规范](../coding-and-self-review.md#review-反馈吸收现状核验2026-11-15)。本记录补齐检索入口，不回填或编造早期 Agent 的执行经历，不宣称上述问题仍存在于当前 head。
