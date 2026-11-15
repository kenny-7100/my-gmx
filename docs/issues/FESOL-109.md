# FESOL-109 — Solana 交易范围与时间节点

## 已执行 Trading cycle 关联（2026-11-15）

用户明确授权根据 Divhead 的 TRD-101 规划更新 PM 关注的 Trading Cycles，要求避免误导。本轮通过已有 Chrome 登录态执行，参与角色为排期整理与协调，不代表接管整体集成/验收，也未发送消息或评论。

- [Cycle 1](https://linear.app/gmx-io/team/TRD/cycle/1)（11 月 16–29 日）新增关联 19 条；页面总数从 29 增至 48 issues。
- [Cycle 2](https://linear.app/gmx-io/team/TRD/cycle/2)（11 月 30 日至 12 月 13 日）新增关联 4 条；页面总数从 4 增至 8 issues。总数包含其他工作，不等于 Solana 范围。
- 两个周期的 planning 均附上原始 [TRD-101](https://linear.app/gmx-io/issue/TRD-101/solana-trading-plan) 链接；分别新建 [Cycle 1 scope and handoff](https://linear.app/gmx-io/document/solana-cycle-1-scope-and-handoff-7282d8675025) 与 [Cycle 2 completion and acceptance](https://linear.app/gmx-io/document/solana-cycle-2-completion-and-acceptance-ea490bd24c0a)，并互相链接。重新打开确认正文、状态解释及跨周期边界已保存。

| 周期 | 原编号 → Trading 编号 |
| --- | --- |
| Cycle 1：原定 11 月 16 日前的剩余交付/联调/验收 | FESOL-15 → TRD-63；29 → 85；51 → 98；25 → 80；57 → 75；92 → 100；56 → 72；61 → 102；113 → 99；52 → 65 |
| Cycle 1：余额、隔离、交易状态与部署验证 | FESOL-89 → TRD-104；96 → 103；90 → 106；91 → 105；20 → 78；71 → 109；112 → 108；67 → 107；72 → 77 |
| Cycle 2：完整范围收口 | FESOL-19 → TRD-70；59 → 84；28 → 83；18 → 119 |

每条最终 cycle 属性在操作阶段均核验；最终另核验两周期总数和 planning 附件。TRD-70、84、83 按完整 issue 的收口周期放入 Cycle 2，文档明确其 Cycle 1 开始开发/联调及市场单 TP/SL、平仓、开仓→执行→刷新→平仓阶段目标仍有效；单个 issue 只能属于一个 cycle，不表示 11 月 30 日才开始。TRD-70 既有延期子范围仍需明确恢复决定，排期不自动恢复开发。没有重置已开发成果或把排期解释为完成验收。

已观察的 Linear 自动行为及处理：给父 issue 分配 cycle 会带入部分尚无 cycle 的活动子项，已逐一核对；TRD-77 曾随 TRD-70 自动进 Cycle 2，已明确改回 Cycle 1 并核验。抽样已完成子项 TRD-64、86 保持 Done、无 cycle。Backlog issue 排入 cycle 自动转 Todo，改回 Backlog 会移出 cycle；TRD-83、119 因此保留系统生成的 Todo（原为 Backlog），文档明确这是排期而非已开工。没有将任务改成 In Progress/Done，未改负责人、估点、issue 到期日、周期日期或原计划正文。

仍需人工决定的缺口已直接写在周期说明中：

- TRD-104、103 无负责人；TRD-83、119 无负责人及估点，不能认为容量与责任已经确认。
- [FESOL-114](https://linear.app/gmx-io/issue/FESOL-114) 仍在 Solana Frontend/Triage，负责人 Kenny，未迁移或强行排入 Trading。交易相关 SOL 检查属于计划 Cycle 2 范围，团队/triage 处理待确认；GM/GLV/pool 扩展范围不提前纳入。TRD-72 的部分 SOL 检查不证明整条需求完成。
- FESOL-110 仍在旧团队、Release、无 project，未重开/迁移；Cycle 1 说明保留组合前端导航/support 验收核对。DES-65 保留 Design team，仅作验收参考。
- 11 月 30 日交易闭环是两周期交接检查点；12 月 14 日观察边界保留在 Cycle 2 文档，未悄悄改成 13 日结束。12 月 10 日公开目标以验收和重估为条件。TradFi、history、Claims、Net rate、Swap/转账、Pools/Stats、Earn/Referrals/GT 等仍属后续范围。

本轮验证限于 Linear 关系、页面和文档保存；未据此认证 PR、部署、真实钱包/keeper 测试、实际容量或发布日期。

## Trading 迁移后的当前入口（2026-11-15）

用户提供 PM 对话确认 11 月 14 日已将 unification issues 移至 Trading team，并要求 Kenny 重新规划 Trading cycles。本轮通过用户现有 Chrome 原生窗口只读核验：旧 FESOL-109 URL 自动跳转至 [TRD-101 · Solana trading plan](https://linear.app/gmx-io/issue/TRD-101/solana-trading-plan)，不是已删除需求。Activity 显示 chloeee 于 11 月 14 日 10:33:42 将团队从 Solana Frontend 改为 Trading、状态由 Review 改为 In Progress，并移出旧 Cycle 3；当前属性为 Add to cycle，尚未分配新 cycle，assignee 为 Divhead。

- 旧周期列表：[Solana Frontend Cycles](https://linear.app/gmx-io/team/FESOL/cycles)。Cycle 1/2/3/4 起始日分别为 10 月 12 日、10 月 26 日、11 月 9 日、11 月 23 日；旧 Cycle 3 页面仍可访问，不作为新的 Trading 分配。
- 新周期列表：[Trading Cycles](https://linear.app/gmx-io/team/TRD/cycles)。[Cycle 1](https://linear.app/gmx-io/team/TRD/cycle/1) UI 显示 11 月 16–29 日；[Cycle 2](https://linear.app/gmx-io/team/TRD/cycle/2) UI 显示 11 月 30 日至 12 月 13 日。计划正文写 11 月 16–30 日、11 月 30 日至 12 月 14 日，需区分正文周期边界与 UI 显示的末日，不擅自改期。
- 当前 TRD-101 正文已简化为 Trading Cycle 1/2 计划：11 月 20 日 API/数学/负载验证、11 月 30 日交易闭环与目标重估、12 月 4 日实现收口、7–8 日验收、9 日修复与复验、10 日验收后公开、11–14 日观察。日期是计划目标，不是当前完成或上线承诺。
- 项目入口仍为 [GMX and GMTrade Frontend Unification](https://linear.app/gmx-io/project/gmx-and-gmtrade-frontend-unification-0774804d1299)。本轮所见两个新 cycle 的 planning 区域只有 Add document or link，未见已附时间线文档；已确认的总计划入口是 TRD-101。

现有 CLI API key 的 teams 查询只返回 FESOL，无法据此判断 TRD 不存在；浏览器登录态可访问 Trading 与迁移后的需求。后续查迁移需求应优先识别 TRD 新编号，不再将旧 FESOL 团队快照当完整范围。本轮未改 Linear、周期或正文；以下 11 月 13 日记录保留为迁移前历史。

更新：2026-11-13。参与角色：需求查询与计划口径记录，未认领业务实现。
来源：[FESOL-109](https://linear.app/gmx-io/issue/FESOL-109)；本次实时抓取时间为 2026-11-13 00:00（Asia/Shanghai），正文 updatedAt 为 2026-11-12T06:42:35.152Z，评论为空。

## 当前执行口径

- 用户于 2026-11-13 明确：该 issue 是最新制定的时间节点；Cycle 2 已开发完成，部分 issue 仍在 review 或测试，目前处于 Cycle 3。后续讨论沿用这一实际阶段描述；开发完成、review 完成和测试验收完成分别判断，不将 review/test 状态直接解释为尚未开发。
- 正文同时保留两套周期编号：Solana Frontend Cycle 2 为 10 月 26 日至 11 月 9 日，Cycle 3 为 11 月 9 日至 23 日；11 月 11 日新增的 Trading Cycle 1 为 11 月 16 日至 30 日，Trading Cycle 2 为 11 月 30 日至 12 月 14 日。正文明确后者控制排期，较早章节作为历史上下文。用户所述当前 Cycle 3 与前一套编号对应；交流时写明周期体系，避免把它误认为未来的 Trading Cycle 2。

## 最新正文中的交付目标

- 11 月 20 日：钱包/数据基础、交易构建器及已评审 SDK 数学发布与 API 接入目标；11 月 23 日：受控主网交易试点；11 月 27 日：索引部署上的交易、数据一致性与故障/恢复核验；11 月 30 日：重估公开发布目标。
- 12 月 4 日前完成必需实现；12 月 7–8 日完成验收；12 月 9 日修复、复验并作发布决定；12 月 10 日为通过验收后的公开启用目标；12 月 11–14 日观察及修复回归。12 月 24 日仅为应急日期，未获替代发布日期批准。
- 首发要求包括限价、订单编辑/取消、抵押品增减；Depth 默认保留，延期须明确决定。金融正确性与索引后端验收属于必需条件。TradFi、历史、Claims、Swap、转账、Pools、Stats、Earn、Referrals、GT/staking 不进入 12 月 10 日交易关键路径。
- API 交接分别核验索引实现、已发布 SDK 数学接入和实际部署；单个 PR 合并、本地测试或直读 RPC 的内部试点不能替代整体验收。正文历史 PR/分配快照不作为本次最新工程状态。

## 核验边界

本次读取正文、关系与评论，并记录用户补充的开发阶段；未全量核验子 issue、GitHub PR、代码、SDK 发布或部署，因此不提供实际完成率，也不确认正文中各项依赖当前仍然阻塞。未修改 Linear 或发布外部消息。
