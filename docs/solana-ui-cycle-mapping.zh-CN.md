# Solana UI 任务新旧 Cycle 对照

整理日期：2026 年 11 月 16 日。

Solana 前端需求迁移到 Trading 团队后，我根据 Divhead 的计划，整理了之前 Solana Frontend Cycle 2、Cycle 3 中由 Kenny、Rainer、Sulliven 负责的剩余 UI 任务，列出对应的新 TRD 编号和当前 Trading 周期，方便大家对齐。

请 Divhead 或其他熟悉这部分工作的人帮忙审阅一下，看看任务编号对应关系或周期分配是否有不准确的地方。

## 任务对照表

仅包含尚未标记 Done 的 12 条任务。“原周期”沿用旧计划文档的 UI 清单分组；状态和新周期为 2026 年 11 月 16 日已核验的信息。

| 原周期 | 负责人 | 旧 issue | 新 issue | 工作内容 | 当前状态 | 当前新周期 | PR |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Solana Frontend Cycle 2 | Kenny | FESOL-15 | [TRD-63](https://linear.app/gmx-io/issue/TRD-63) | 市场下拉列表与顶部市场信息 | In Progress | Trading Cycle 1 | [#3201](https://github.com/gmx-io/gmx-interface/pull/3201) |
| Solana Frontend Cycle 2 | Rainer | FESOL-51 | [TRD-98](https://linear.app/gmx-io/issue/TRD-98) | 展示 Solana 钱包余额 | In Progress | Trading Cycle 1 | [#3195](https://github.com/gmx-io/gmx-interface/pull/3195) |
| Solana Frontend Cycle 2 | Rainer | FESOL-29 | [TRD-85](https://linear.app/gmx-io/issue/TRD-85) | Solana 价格图与深度图 | In Progress | Trading Cycle 1 | [#3223](https://github.com/gmx-io/gmx-interface/pull/3223) |
| Solana Frontend Cycle 2 | Sulliven | FESOL-52 | [TRD-65](https://linear.app/gmx-io/issue/TRD-65) | 从 gmx-api 接入 Solana 交易状态 | In Progress | Trading Cycle 1 | [#3193](https://github.com/gmx-io/gmx-interface/pull/3193) |
| Solana Frontend Cycle 3 | Kenny | FESOL-19 | [TRD-70](https://linear.app/gmx-io/issue/TRD-70) | 市场单与 TP/SL 下单入口 | In Progress | Trading Cycle 2 | [#3262](https://github.com/gmx-io/gmx-interface/pull/3262) |
| Solana Frontend Cycle 3 | Kenny | FESOL-56 | [TRD-72](https://linear.app/gmx-io/issue/TRD-72) | 构建、检查和发送 Solana 订单交易 | In Progress | Trading Cycle 1 | [#3258](https://github.com/gmx-io/gmx-interface/pull/3258) |
| Solana Frontend Cycle 3（补充前端依赖） | Kenny | FESOL-72 | [TRD-77](https://linear.app/gmx-io/issue/TRD-77) | GMX CI 构建 gmsol SDK 并替换固定构建产物 | In Progress | Trading Cycle 1 | [#3259](https://github.com/gmx-io/gmx-interface/pull/3259) |
| Solana Frontend Cycle 3（补充前端依赖） | Sulliven | FESOL-92 | [TRD-100](https://linear.app/gmx-io/issue/TRD-100) | Solana 下单输入的 SDK 单位转换 | In Progress | Trading Cycle 1 | [#3243](https://github.com/gmx-io/gmx-interface/pull/3243) |
| Solana Frontend Cycle 3 | Kenny | FESOL-20 | [TRD-78](https://linear.app/gmx-io/issue/TRD-78) | 市场单发送与成交状态 | In Progress | Trading Cycle 1 | [#3261](https://github.com/gmx-io/gmx-interface/pull/3261) |
| Solana Frontend Cycle 3 | Rainer | FESOL-57 | [TRD-75](https://linear.app/gmx-io/issue/TRD-75) | SDK 交易数学增加 gmsol 实现 | In Progress | Trading Cycle 1 | [#3242](https://github.com/gmx-io/gmx-interface/pull/3242)（已合并） |
| Solana Frontend Cycle 3 | Sulliven | FESOL-25 | [TRD-80](https://linear.app/gmx-io/issue/TRD-80) | 展示 Solana 仓位与未完成订单 | In Progress | Trading Cycle 1 | [#3238](https://github.com/gmx-io/gmx-interface/pull/3238) |
| Solana Frontend Cycle 3 | Sulliven | FESOL-59 | [TRD-84](https://linear.app/gmx-io/issue/TRD-84) | 平仓，以及订单编辑与取消 | In Progress | Trading Cycle 2 |  |

## 新周期与跨周期安排

- [Trading Cycle 1：2026 年 11 月 16–29 日](https://linear.app/gmx-io/team/TRD/cycle/1)
- [Trading Cycle 2：2026 年 11 月 30 日至 12 月 13 日](https://linear.app/gmx-io/team/TRD/cycle/2)

TRD-70 和 TRD-84 按完整 issue 的收口周期放在 Trading Cycle 2；它们在 Cycle 1 的市场单、TP/SL、平仓及联调阶段目标仍然保留，不表示到 Cycle 2 才开始。

排期依据：[Divhead 的 Solana trading plan（TRD-101）](https://linear.app/gmx-io/issue/TRD-101/solana-trading-plan)。本表用于核对任务和排期，不表示任务已通过验收。

原有 10 行沿用此前核验结果，本次补入 TRD-77 时重新查询了该任务，未修改 Linear；原周期分组来自计划正文，不是迁移前实际 cycle 字段的完整备份。

FESOL-72 → TRD-77 原列于旧 Cycle 3 的“补充前端工作与测试依赖”，现补入本表。它与 FESOL-56 → TRD-72 是两条不同任务。2026 年 11 月 16 日再次核验了 TRD-77 的编号、负责人、状态与新周期。

2026 年 11 月 16 日通过 Linear 附件与 GitHub 核实 PR 链接；TRD-84 未确认到独立 PR，留空。#3242 已合并，但 TRD-75 在 Linear 仍为 In Progress。旧 Cycle 3 补充前端依赖中的 FESOL-92 → TRD-100 也已补入。
