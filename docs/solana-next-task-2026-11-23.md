# Solana 集成下一步候选评估（2026-11-23）

当前排序已由 [2026-11-24 完整需求 refining 调研](solana-refining-priorities-2026-11-24.md)取代。本文客服入口小切片的首选不适用于已扩大后的 TRD-151 完整范围；旧 PR、API 与部署判断保留原日期。

核验时间：北京时间 11:38 左右。参与角色：只读调研与下一步建议。范围从 Kenny 的五条需求扩大到交易后阶段及跨团队依赖；不代表认领、启动开发或调整发布时间。

## 结论与覆盖

新增独立需求首选 [TRD-151 Support Chat](https://linear.app/gmx-io/issue/TRD-151)。如果先做现有交易线收口，则优先 TRD-158 的订单侧余额不足错误反馈，沿 TRD-72 原任务线推进。两个建议分别解决新增工作与已有工作，不把 TRD-158 全范围视为现在可完成。

本轮读取迁移项目 `GMX and GMTrade Frontend Unification` 全团队列表 91 条（含历史、重复、取消及设计项），并用工作区 Solana、gmsol、GMTrade 关键词交叉检索；分别返回 100、94、84 条，均无下一页。结合上一阶段已读取的 Trading 正文、历史映射和代码证据，深入核对候选正文、关系、关键评论、GitHub PR 与实际调用入口。关键词搜索不能保证发现正文中完全不含关键词且未建立关联的工作。

跨项目发现的旧 GMTrade 维护、ECO 的 GT EVM proxy/verifier、ANA 对外报表、LP 内部看板不直接计入新前端实施池；但 TRD-170 的旧 Claims 后端、ECO-54 的 Solana LP 数量诉求可作为后续数据契约线索，不默认接口已适用于统一前端。

在线基线：interface release `d1e9e1fc4cb9e38cc9c486be8aab09af84e4d451`；API main 代码沿本阶段 `90df09fd2b945e0ba26732222b369f9a583c39fe` 核对。GitHub API 读取源码、PR 和检查，不 fetch/pull、不构建、不打开页面、不验证部署或广播交易。

## 现在最值得推进的切片

| 顺序/用途 | 需求与实时状态 | 可推进范围 | 前置、交付与验收边界 |
| --- | --- | --- | --- |
| 新增独立首选 | TRD-151，未分配 / Refining，无评论 | Phantom-only 入口、恢复中显示、SOLANA boot 环境、切网重启、Solana 地址/provider/network 上下文、恢复错误 toast 的 Contact support | release 已有聊天生命周期和 Solana session；不依赖订单构建或 keeper。完整真实收件箱标签和会话归属仍需 UI/后台核验；Refining 不等于已安排实施 |
| 交易侧优先收口 | TRD-158，Kenny / Backlog，无评论 | 复用 TRD-72 真实模拟/余额检查，将不足 SOL 的签名前阻断及余额变化后失败映射到指定文案；错误归因须明确，不把所有模拟失败当余额不足 | #3315 未合入 release；按原开发线修改和交付。GM/GLV/shift 随各自产品链路覆盖，不能以订单切片关闭整条需求 |
| 与现负责人合作的备选 | TRD-91，Rainer / Backlog | Solana host 的 rate-history adapter、大小写敏感市场地址、时间范围/精度/正负号、真实缺口和空历史处理 | API #341 已合并；需先与 Rainer 对齐分工并确认真实部署和历史采集。只读 adapter/契约测试可先做，不能直接认定整个图已可上线 |
| 有价值但先做方案核实 | TRD-110，未分配 / Backlog | 从完整 Swap 中界定独立 SOL/WSOL wrap/unwrap，确认 SDK 导出、签名/指令校验、余额刷新、租金/网络费与 Max/unwrap-all 规则 | release 尚无 Solana 订单 sender；#3315 的订单前置 wrapping 不是独立转换能力。独立转换的构建与验证尚未证明可直接复用；普通 token Swap 还需报价/路径/费用契约 |
| 前端 lead 可立即推进 | TRD-117，未分配 / Backlog | 27 个 TradFi 市场与 mint/feed 映射、闭市字段和状态转换、允许操作矩阵、SPCX 例外、条款域名确认，形成产品/API/keeper/SDK 对照 | 计划明确交易后优先 TradFi；stocks/FX V8、commodities/SPCX V11 feed 不等同现有 Arbitrum V3 feed。不能只加静态 token 就宣称支持 |
| 小型契约收口 | TRD-69，未分配 / Backlog，无评论 | 确认真实原始上市日期来源、pool/index 映射、字段/时区/null/覆盖范围和数据负责人 | 明确非发布阻塞；不能用部署、迁移、第一根 candle 时间充当上市日期。当前可做调查和契约，不假造显示值 |

### TRD-151 的实际实现入口

- release 的 `src/domain/supportChat/useShowSupportChat.ts` 使用 wagmi `useAccount()`，第 31–36 行显式在 Solana 隐藏聊天；只移除隐藏无法让 Phantom-only 场景正常工作。
- `src/domain/supportChat/useSupportChat.ts` 第 81 行固定 `Environment: "EVM"`；已有 shutdown/boot、boot ID 和主题更新生命周期。需要按实际网络切换环境及上下文，复用生命周期。
- `src/lib/helperToast.tsx` 第 33–36 行在 Solana 排除 Contact support。
- `src/lib/wallets/solanaWalletSession.tsx` 已提供 address/isRestoring 等会话信息；provider 身份仍需从正确的钱包状态入口取得，不能伪装 EVM connector。
- EVM 的资产/volume/GMX Account 属性查询保持在 EVM 专用组件；Solana 不应为聊天挂载这些查询。

原需求 TRD-142 的 [#3294](https://github.com/gmx-io/gmx-interface/pull/3294) 已合并、APPROVED、检查成功，head `5e30dbc18f`，它有意隐藏聊天并保留 TRD-151 后续；不是完整 Solana 聊天实现。本轮按编号、标题、相关 PR、开放 PR 和 release 路径检索未发现对应新增实现。远端 `crisp` 对应旧 #2162，closed 且未合并，不作为当前 Solana 在研分支证据。

最小完成范围应覆盖：Phantom-only/恢复中/未连接、EVM→Solana→EVM、Solana 钱包切换、错误 toast 入口、上下文清理与 Environment 标签、EVM 原行为。生命周期/状态分流可以离线验证；真实 Intercom boot、收件箱标签和会话归属须在授权环境验证。本轮未运行这些测试。

### TRD-158 与 Net Rate 的代码证据

[#3315](https://github.com/gmx-io/gmx-interface/pull/3315) head `fac83d15bd`，OPEN、非 Draft、检查成功、REVIEW_REQUIRED、无 review。`sendOrderTransactions.ts` 签名前真实 RPC 模拟检查账户创建 rent，并检查 network/keeper/wrapping 余额；模拟失败仍为通用 `Solana simulation failed`，余额检查文案仍非需求指定文案。故已有工作可收口，不能另造未接入的通用余额框架。

[API #341](https://github.com/gmx-io/gmx-api/pull/341) head `84ae2dbeef`，11 月 19 日合并、test 成功、无 review。main 的 `SolanaRatesController` 已走 indexed reads；`rateHistory.ts` 保存真实历史并计算 net=funding-borrowing。issue 评论明确历史从部署后累积，不回填。interface release 的 `useRateSnapshots.ts` 仍经 `useGmxSdk(chainId)`/`sdk.fetchRates` 和共享地址匹配；Solana 路由、大小写敏感地址和可用性需实装/核验，不能直接打开 tab。[#3223](https://github.com/gmx-io/gmx-interface/pull/3223) 仍是 Rainer 的价格/深度图任务，不能将它等同完整 Net Rate 交付。

## 更大范围的候选及暂不优先直接开发的原因

| 需求 | 建议先推进的具体事项 | 当前限制 |
| --- | --- | --- |
| TRD-89 Trades | 事件覆盖矩阵、position lifecycle ID、RPNL/fees/impact 定义、分页/过滤/导出契约和真实样例 | 当前 API main 的 Solana routes 有 markets/orders/positions/rates/fee-discount，未发现对应完整历史 controller；不代表所有历史能力不存在。不能只搬旧 GMTrade 已显示事件或用含 impact 的 PnL 代替 GMX RPNL；DES-65 的个人历史访问与市场面板争议需区分 |
| TRD-90 Claims | 对接 funding settle、实际可领取 rebate、历史与 claim 指令/签名责任，核实 TRD-170 能复用哪些字段 | TRD-170 / In Review 带 GMTrade 标签，blocks 旧 TRD-61；不能当作统一前端后端已就绪。五天经过不等于链上已可领取；缺少本轮统一接口/部署证据 |
| TRD-116 Pools | 先列共享 pool DTO 的真实来源、GM/GLV 持仓、预览、申赎指令与钱包/费用契约 | 关联 TRD-92、TRD-158；不能将连接钱包已完成等同 transfers 或流动性全链路就绪。完整功能是较大交易交付，暂非已证明可独立开工的首选 |
| TRD-115 Earn | 对齐已设计页面的数据字段，先澄清 staked+unstaked 总值、GT 与 lifetime earnings 口径 | blockedBy DES-88 / In Progress；不要重复搭设计 tester 壳或把未确认数据填成 0 |
| TRD-114 Referrals | 提前确认旧 GMTrade 链接迁移、网络/钱包绑定隔离、实际历史 VIP+referral 折扣和奖励接口 | blockedBy DES-90 / In Progress；不能把两个折扣直接相加，亦不能用当前 VIP 回算历史 |
| TRD-113 GT Points/staking | 提前梳理 GT/VIP/buyback/卖出额度和 staking 多资产操作契约，区分余额与未领取奖励 | blockedBy DES-89 / In Progress；含交易、租金回收、榜单、历史等多个域，暂不整条接手 |
| TRD-92 wallets/transfers | 与 Sulliven 区分已完成连接/恢复/余额及未完成外转/embedded wallet | 有现负责人，不能按 Backlog 重新实现已由 TRD-97/98 覆盖的连接/余额切片 |

Earn [#3216](https://github.com/gmx-io/gmx-interface/pull/3216)、GT [#3221](https://github.com/gmx-io/gmx-interface/pull/3221)、Referrals [#3227](https://github.com/gmx-io/gmx-interface/pull/3227) 实时均 OPEN Draft，标题 Do not merge，base 分别 des-88/89/90；仅 Pages 检查成功，无 review。它们证明设计探索已开展，不证明生产数据和交易就绪。本轮未对所有 tester 完成逐行代码审查，因而不据此作可直接转生产的推荐。

## 避免重复工作与下一步选择

TRD-73/74、TRD-79、TRD-87/88、TRD-68/66/82 等拆分项仍显示 Backlog，需沿 TRD-72/78/85/63/65/80 原逻辑线核实，不能作为一批无人实现的新任务。原始交易工作和 December 10 风险沿[发布审计](issues/FESOL-109.md)接续；TRD-83/84 仍由 Sulliven 推进，不擅自代改。TRD-70 已暂停范围不会因本次扩大推荐自动恢复。

建议用户若要新增一个可独立交付的需求，选择 TRD-151；若要先巩固现有交易链路，选择 TRD-158 订单切片；若要为下一阶段铺路，先推进 TradFi 契约，或与 Rainer 约定 Net Rate 的适配切片。若 Support Chat 已有未公开实施、Refining 范围改变，或真实服务配置不支持 SOLANA 环境，则重新比较首选。

本轮不修改 Linear、业务代码或线上状态。证据快照保存在忽略目录 `.local/solana-progress/2026-11-23-next-task/`，长期结论以本文及 issue 记录为准。
