# TRD-91 — Solana Net Rate

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

2026-11-24，参与角色：只读 refining 调研，未认领实现。[Linear](https://linear.app/gmx-io/issue/TRD-91)。

与 Rainer 协作的 refining 首选。API #341 已 merged，生产 rates 三个 period 查询均 200；SOL/USDC 30d 样本仅 126 个小时点，UTC 11/19 09:00–11/24 14:00。release useRateSnapshots 读 globals.chainId，而 Solana provider 保留 EVM chainId；需按实际 network 选 SDK/cache。地址比较已支持 base58 精确比较，无需重复修。先确认历史不足验收、符号/精度/投影；未做 UI 验收。

完整固定版本、代码/PR/生产查询证据及排序理由见 [11 月 24 日 refining 调研](../solana-refining-priorities-2026-11-24.md)。本文未完成业务实现或验收；恢复时刷新受影响依赖。
