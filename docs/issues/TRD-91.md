# TRD-91 — Solana Net Rate

## 协调表历史覆盖刷新（2026-11-26）

实时仍Rainer/In Progress/Cycle1，评论无新增；API #341仍merged/main。正式接口SOL/USDC的30d查询HTTP200、166小时点，UTC11/19 09:00–11/26 06:00，跨度165小时，内部相邻点均1小时；不足完整7/30天，不扩大为全市场结论。协调表已更新；按编号/历史编号及当前open列表未找到专属前端PR，未重新查release接线或执行UI验收。见[三表核验](FESOL-109.md#三表完整刷新2026-11-26-1411北京时间)。

## 四条需求跟踪（2026-11-25 14:05，北京时间）

角色：只读跟踪。仍为 In Progress / Rainer / Low，正文与评论无新增变化。生产 SOL/USDC 30d rates 返回142个小时点，覆盖 UTC 11/19 09:00–11/25 06:00，仍不足完整7/30天。

本轮刷新四条Linear正文、关系和全部评论，并检查公开PR及release差异。按编号和开放PR关键词未确认这四条专属实现PR；不据此判断没有本地工作。release已到`a20f68913d`，较昨日基线新增价格REST/SDK类型改动，未改这四条核心接线；#3337仍OPEN、head `be9ca46ecb`。未运行UI/交易验收或修改Linear。

## 排除旧 SQD/后端后的复核（2026-11-24）

用户明确不引入 GMTrade SQD/后端。本轮只复核数据路径，不刷新已查过的状态或重测 API。正式 gmx-api 的 `indexWorker → readSharedMarketSnapshot` 由 Solana RPC 读取市场/库存等账户，`tokens/tickers.ts` 经 `gmsolConfig.tickerUrls` 读取 GMX Arbitrum oracle keeper 价格；`indexStore → saveRateSample` 写入自身 `solanaRates`，`getRateHistory` 从该表查询。此 rates 链路未使用旧 SQD 或旧 keeper GraphQL，不能把 gmx-api 中独立 protocolStats 模块引用旧服务扩大成 rates 也依赖它。原前端实施判断成立，约 5 天历史不足、network SDK/cache 接线等边界不变；不建议新增旧 SQD 查询或用旧 SQD 回填规避正式来源要求。

2026-11-24 22:56（北京时间），按用户明确指令，将本轮后端调研结论以英文发布到本单评论，作者显示Kenny，comment ID `6ea3cc50-6761-44da-94f3-b36b648b7d45`；已回读核对正文。评论包含#341合并/生产接口可用、SOL/USDC历史样本及不足7/30天的边界、release前端network SDK/cache接线方向，建议先核对既有接口的具体缺口再新增SQD入口。仅新增评论，未更改需求正文、状态、负责人或验收结论。评论链接：[后端现状调研](https://linear.app/gmx-io/issue/TRD-91#comment-6ea3cc50)。

## 当前现状复核（2026-11-24 22:45，北京时间）

参与角色：单项只读调查，未认领、未修改业务或 Linear。已刷新需求正文、评论、关系、公开 PR/branch、release/API 基线及生产 rates。本次仅更新这一项，不代表全候选重新排名。

**重要变化：Linear 已为 In Progress / Rainer / Low，进入当前 cycle。** 状态于 UTC `2026-11-24T14:27:11.746Z`（北京时间22:27）从 Backlog 改变，正文和产品范围未变。没有 Linear blocks/blockedBy，关联 TRD-65/TRD-101；这不消除代码或历史覆盖缺口。评论仍为 Divhead 的11月11日接口说明，无新增实现进度评论。

| 层面 | 本次观察 | 含义 |
| --- | --- | --- |
| 产品范围 | 复用共享图表的 funding/borrowing/net，多空、符号、单位、默认交互及同等历史范围/粒度；仍注明交易发布后阶段 | Low 是产品优先级，不与上轮“refining 就绪度首选”混淆；当前 cycle/started 不证明产品发布阶段已重新决定 |
| API | #341 仍 MERGED（11/19），生产按市场查询的 1d/7d/30d 均 HTTP200 | 后端接口前置已经实际可请求，不能再以“等待接口部署”笼统阻塞 |
| 历史覆盖 | SOL/USDC：1d 25点；7d/30d各126点，UTC11/19 09:00–11/24 14:00，样本间隔均1小时 | 当前仅约5天历史，尚非完整7天/30天。无回填是原接口设计；需确认验收策略，不能伪造缺失数据 |
| release 前端 | release SHA仍为 `993474e4377b75f919e587bc4f30e6adc24cecd1`；useRateSnapshots仍用selectChainId选SDK/cache，Solana provider保留EVM chainId | 需要按实际 network 选 Solana SDK；不能只因共享 NetRateChart 存在就称 Solana历史已接通 |
| 共享图表 | 已有1d/7d/30d、1h/8h/24h/1y投影、费用类型、多空、空/错误状态；历史按per-second factor换算，live按hourly换算；borrowing显示为负成本 | 不从零重写图表，重点验证数据接线、转换一致性及切网/错误/缺口表现；本轮未运行UI |
| 公开实现 | 按TRD-91、旧FESOL-32、Solana Net关键词及Rainer开放PR/相关branch检索，未找到此需求公开实现PR | 无法证明Rainer未写代码或没有未推送工作；先确认其进度与开发线，避免另开重复实现 |
| 相邻图表PR | #3223仍OPEN，head `db43a011192fa9cbe40d813407f7617cdbfa6b7a`，范围是Price/Depth与trade markers | 不能以此证明Net Rate完成，不把全部相邻图表工作合算为本需求进度 |

API main本轮已到 `f067594d40724a6116531d16d352f09c070cde2e`；相对上轮 `f1a271e102b554200945ed4b1a88064b216c2c08` 的远端compare只涉及addresses、order model/utils、orders puller及其测试，未改rates调用路径，沿用已核对的rates源码分析。

当前判断：**接口就绪、共享图表基础具备、前端接入正在推进但公开成果尚未确认，完整历史验收仍有缺口。** 下一步先与Rainer确认实际分支/实现范围、network SDK/cache处理、费率样本与历史不足验收；不是重新分派或直接替其实现。公开信息不足以给出完成百分比或交付时间。

证据：[Linear](https://linear.app/gmx-io/issue/TRD-91)、[API #341](https://github.com/gmx-io/gmx-api/pull/341)、[release Hook](https://github.com/gmx-io/gmx-interface/blob/993474e4377b75f919e587bc4f30e6adc24cecd1/src/domain/synthetics/markets/useRateSnapshots.ts)、[共享图表](https://github.com/gmx-io/gmx-interface/blob/993474e4377b75f919e587bc4f30e6adc24cecd1/src/components/NetRateChart/NetRateChart.tsx)、[生产30d市场查询](https://solana.gmxapi.io/v1/rates?period=30d&address=6UU9sF5fryafHDYPcmVcV7ucfnYs6iMVcvb8p7SBQgTc)。未修改线上状态、运行测试/构建、浏览器验收或联系成员。

## 首轮 refining 记录（2026-11-24，较早观察）

### 后端依赖说法核对（2026-11-24）

用户转述 Rainer：“这个需求依赖于后端，但我们的后端 gmx-api 是 divhead 在管理，如果我单独写个 SQD 的接口，是能满足需求，但可能不满足 divhead。”这反映了历史数据需要后端及正式数据入口的协作顾虑；不能当作已证明 Divhead 反对某方案或当前接口缺失。未获知该话原始发送时间及其针对的具体字段缺口。

本次再次读取 Linear 评论、#341 状态和生产7d指定市场查询：#341仍已于11/19合并，接口HTTP200、126点且有funding/borrowing/net双向字段。Divhead自己在11/11评论明确由Solana host的`/v1/rates`供应共享SDK格式，前端剩余为请求路由及启用图表。故若这句话意味着“现在需要先等Divhead新增接口，或另写SQD才能推进”，与已观察现状不符；更合适先接入现有正式接口并核实具体缺口。

不宣称现有接口满足全部验收：仍只有约5天历史；若Rainer指更早历史、特定市场缺数据、粒度或另有未说明需求，需逐项核实。SQD另建查询不自动产生采集前的历史，也没有本轮证据证明其已有等价完整数据。正式入口/计算口径/长期维护是架构契约问题，不宜归因为某人主观“满意”。本轮没有联系Rainer或Divhead、没有代写接口。

2026-11-24，参与角色：只读 refining 调研，未认领实现。[Linear](https://linear.app/gmx-io/issue/TRD-91)。

与 Rainer 协作的 refining 首选。API #341 已 merged，生产 rates 三个 period 查询均 200；SOL/USDC 30d 样本仅 126 个小时点，UTC 11/19 09:00–11/24 14:00。release useRateSnapshots 读 globals.chainId，而 Solana provider 保留 EVM chainId；需按实际 network 选 SDK/cache。地址比较已支持 base58 精确比较，无需重复修。先确认历史不足验收、符号/精度/投影；未做 UI 验收。

完整固定版本、代码/PR/生产查询证据及排序理由见 [11 月 24 日 refining 调研](../solana-refining-priorities-2026-11-24.md)。本文未完成业务实现或验收；恢复时刷新受影响依赖。

## 全局实施候选复核（2026-11-27）

角色：只读就绪调查。发现正式前端 PR #3362，head d278ca5d51d5170c683f7dc8e726ad2e408477b2，OPEN/release/REVIEW_REQUIRED，当前CI成功、无review/未解决线程；实际diff有network/cache与缺口处理。生产指定市场30d为190小时点、跨度189小时，不足30天。接续现有PR，不重开实现。 完整证据、优先顺序和验证边界见 [本轮报告](../solana-readiness-2026-11-27.md)。未开发、运行页面/交易或修改 Linear。
