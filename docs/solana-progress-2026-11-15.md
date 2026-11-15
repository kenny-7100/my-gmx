# 项目现状核对 · 2026-11-15

北京时间 10:38 起，只读核对本地现场、实时 GitHub、Linear 与公开 API；本轮是有限覆盖的现状核对，不是完整进度重估、代码审计或上线验收。结论：Solana 基础与数学已有上游成果，交易链路已有组合实现和四条 Draft，当前主要剩余是前置交付、数据契约上线及真实钱包/keeper 验收。

## 晚间增量核对（北京时间 22:15–22:18）

本次用户再次询问项目现状，复用当日全量枚举与交易链路记录，仅刷新影响结论的来源；不是完整进度重估。主目录 `solana-integration` HEAD 为 `5c81943e30`，开始时干净，个人远端同 SHA。实时 release 仍为 `84ab9293a8`，在线读取 MainRoutes 确认 Solana 交易路由仍为占位页。四条交易 Draft 仍开放，当前远端 head：56/#3258 `a07d84427d`、20/#3261 `c88e50533d`、19/#3262 `996a167e5c`、72/#3259 `2f2ac84771`。上述版本优先于下方早间快照。

**早间体积阻塞已失效。** 当日后续开发已将有限价格三单组合从 1255 压到 1204 bytes，并留下 slot469599277 主网无签名模拟成功记录；详见[四 PR 执行结果](solana-trading-dependencies.md#四-pr-目标执行结果2026-11-15)。本次阅读与核对已有证据，没有重新模拟。可信 LUT、四钱包签名落链及 keeper/UI 闭环仍未验收；体积修复不解除这些条件。19 的 base58 TP/SL 预览修复也已进入原 Draft，不能继续列为待实现。

本次公开 API 再次返回 67 个市场，`tradeMath` 存在数仍为 0。Linear 全量可见分页同步为 40 条、迁移项目 8 条，FESOL-56 实时详情报 access/query compatibility 错误，未确认原因，不重算百分比。快照：`.local/linear/FESOL/snapshots/2026-11-15T14-15-56-012Z-99d58931/snapshot.json`。56/20 当前 head 的 Audit、general、SDK standalone、WASM reproduction 均成功，组件 workflow 仍失败；本次未重读失败日志，沿用同日记录的报告发布权限归因，不称 CI 全绿。

本轮无业务修改、测试/构建、浏览器、签名、广播、部署或外部消息；只更新现状入口以撤销已失效阻塞。完整范围、跨仓库部署及需求覆盖仍不足，不更新完整评估 latest 指针。

## 当前现场与上游

- 主目录为个人基础 `solana-integration`，开始时 HEAD `01a16877f3`、工作区干净，个人远端同 SHA。近期提交为 my-mac 环境迁移与认证、编辑器、Docker/PostgreSQL 验证记录；不代表交易能力新交付。
- 上游 `release` 实时为 `84ab9293a8e25e1312f35a20893752df480e0e0b`，SDK 2.9.2。[数学 PR #3242](https://github.com/gmx-io/gmx-interface/pull/3242) 已于 11 月 14 日合并。
- 在线读取该 SHA 的 `src/App/MainRoutes.tsx`：Solana `/trade/:tradeType?` 仍渲染 `SolanaTradePlaceholder`，显示 “Trading on Solana is coming soon.”。未将开放 PR 的组合页面算作 release 已交付交易页；未核对实际前端生产部署。
- 四个 delivery 工作区均干净，线上 PR HEAD 与[11 月 14 日矩阵](solana-trading-dependencies.md#四需求上游刷新2026-11-14)一致：56/#3258 `2ecfebba84`、20/#3261 `613d33cf39`、19/#3262 `e4e9067a0f`、72/#3259 `2f2ac84771`。均为 Open/Draft、base release、Review required，仍处自审与测试阶段。
- 四个当前 HEAD 的 Audit、general lint/types/tests、SDK standalone 和 WASM reproduction 均成功；组件 workflow 均 Failure。同 HEAD 的既有完整日志已定位为 Pages/评论发布权限错误，56 另有一个重试后通过的 flaky；详见[三项收尾](solana-trading-dependencies.md#独立推进三项收尾2026-11-14)。本轮复查远端 checks，没有重新运行测试或重读完整日志，不能称 CI 全绿。

## 能力与主要剩余

| 范围 | 本轮确认的交付状态 | 实际含义 |
| --- | --- | --- |
| 网络、钱包、静态配置、隔离、oracle 与数学 | 已有 release 成果，数学 #3242 新近合并 | 基础可复用；交易页仍为占位 |
| 共享 API 状态 #3193 | Open，head `e712a1d342` | 已被四需求相关开发组合消费，仍待上游交付 |
| 余额 #3195、市场 #3201 | Open，Changes requested | 不把旧意见全部当现存 bug，但复审/交付仍未收口 |
| 列表 #3238、转换 #3243 | Open，Review required | 已有实现，尚未合并 |
| 构建/校验/发送 #3258、生命周期 #3261、共享入口 #3262 | Open/Draft | 56→20→19 组合已有代码与既有验证；尚未真实交易验收 |
| 自建 WASM #3259 | Open/Draft | 固定 `0.11.0-beta.1`，用户版本选择已解决；独立交付不混入交易业务 |
| PostgreSQL 索引 API #340 | Open，head `59e49c649d`，Review required | tests/plan 成功、Apply skipped，不能据此确认部署 |
| 费率历史 API #341、ADR #27 | 分别 Open/Draft、Open | 仍不能据此确认历史采集部署或架构提案完成采用 |

本轮实时 GET `https://solana.gmxapi.io/v1/markets/config` 成功，67 条市场记录中 `tradeMath` 字段存在数为 **0**。API main 为 `55327018c05e43928c6a24bd5a178d55a3befcac`，声明 SDK 2.8.0、sdk-next 2.9.0；前端数学合并与 API 源码升级均不等于线上数学契约启用。FESOL-112 对应的上线/参考值验收仍缺证据。

FESOL-71 可信 LUT、四钱包签名/广播、keeper 成交和通知闭环仍缺新验收证据。本轮未重查链上表，沿用 11 月 14 日“仍有 authority、生产信任配置为空”的待解除条件，不冒充本轮链上观察。固定 WASM 的有限价格边界 increase+TP+SL 历史离线结果仍为 1255 bytes，超过 1232-byte 上限；假设单表可降到 1221 不代表已有真实可信表，不能仅等待地址就假定解决。FESOL-19 支付币兑换、最大杠杆一致性、完整 simulate_order 数值对照与 GT Rewards 仍按用户此前暂缓决定保留。

## 需求覆盖与进度数字

本轮 FESOL sync 成功遍历当前可见团队，返回 40 条、迁移项目 8 条；11 月 14 日快照同为 40 条，11 月 13 日记录曾为 115 条。直接查询 FESOL-109 失败；用 11 月 4 日快照中的稳定 UUID 查询 19/71/109/112 也失败。尚不能确定是可见性、删除、迁移还是其他原因，不能据此认定范围取消、迁移完成或负责人/状态改变。没有新增同步器，也未改 Linear。

| 进度口径 | 本轮数字结论 |
| --- | --- |
| 当前有效 Linear 迁移需求工作量 | 暂不重估：有效分母与关键正文/关系/评论无法核实 |
| 已确认完整迁移工作量 | 暂不重估：跨仓库实现/部署与完整范围覆盖不足 |

[11 月 13 日粗估](solana-progress-2026-11-13.md)中的交易首发约 55%、完整迁移约 40% 仅保留为历史工程估计。本轮确认数学合并和四 Draft 交付状态，但没有足够证据量化新增百分点，也不判断首发日期或上线就绪。

## 证据与后续入口

分页枚举六个仓库全部可见分支及各状态 PR：gmx-io/gmx-interface（273/3245）、kenny-7100/gmx-interface（207/0）、kenny-7100/my-gmx（12/0）、gmx-io/gmx-api（251/347）、gmx-io/gmx-adrs（18/31）、gmsol-labs/gmx-solana（54/469）。计数为分支数/PR 数，不作进度指标。只对上述关键 PR 与调用入口做定向核验，未逐分支读取全部代码；未覆盖全部配套仓库、其他 Linear 团队或部署/infra 权限，故不构成完整评估。

本机原始分页证据、API 响应和不完整评估在 `.local/solana-progress/2026-11-15T02-38-24Z/`；Linear 快照为 `.local/linear/FESOL/snapshots/2026-11-15T02-38-24-015Z-38d14f09/snapshot.json`。不更新完整评估的 latest 指针。没有运行构建、测试、浏览器、签名、广播、部署或业务修改。

建议后续协调优先确认 Linear 需求可见性、71 可信 LUT 与体积方案、112 API math rollout，再按依赖顺序收口前置与交易组合验收；本轮不自动恢复19暂缓范围，也不新增任务/PR/外部消息。

中文现状：Solana 基础与数学已有上游成果，交易链路已有实现和四个 Draft，但 release 交易页仍为占位。当前关键剩余是前置 PR 交付、可信 LUT 与交易体积、API 数学上线及真实钱包/keeper 验收。需求可见性与跨仓库验收证据不足，本轮不重估百分比。

English: Solana foundations and math have landed upstream, and the transaction lifecycle has implementations across four Draft PRs, while the release trading page remains a placeholder. The key remaining work is prerequisite PR delivery, trusted LUTs and transaction size, API math rollout, and real wallet/keeper acceptance. Requirement visibility and cross-repository acceptance evidence are insufficient to update the completion percentages.
