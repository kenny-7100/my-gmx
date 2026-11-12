# Cycle 3 — kenny 与未分配任务的可推进性评估

核验日期：2026-11-13（Asia/Shanghai）。角色：只读调研与任务推荐，未认领 Linear、创建开发分支或修改业务代码。

## 结论与范围

首选 **FESOL-20**，以现有 FESOL-56 交易能力为基础，推进订单身份关联、事件解析、生命周期跟踪和共享 toast；先交付有证据的解析/状态与跟踪切片，再完成真实订单验收。未分配任务中首选 **FESOL-19**，把共享 TradeBox 接入现有交易发送能力。它对用户路径价值最高，但数学启用、余额、折扣、LUT 和真实数据依赖更多；不能声称现在已能独立完成整个需求并主网验收。

当前交流沿用用户明确的 Solana Frontend **Cycle 3**。本次扫过该迁移项目全部需求与 kenny 全部任务，候选池不限定只有 Cycle 3 字段的条目；跨到后续周期的能力在下表注明，不暗示可以绕过排期或接管他人任务。周期编号背景见 [FESOL-109](issues/FESOL-109.md)。

Linear 全量快照 fetchedAt 为 `2026-11-12T17:47:06.125Z`；候选与关键前置另实时补读正文、评论、双向关系。项目共 82 条，kenny 名下迁移任务 12 条，其中未终结 5 条、Done 6 条、Duplicate 1 条；未分配 30 条，其中未终结且未归档 **18 条**、已归档历史拆分 8 条、Done/Canceled 4 条。不能把历史拆分重复计算成新开发机会。kenny 全工作区另有 6 条旧 GMTrade 任务，其中 FESOL-111 为 Test，其余 Done。

## kenny 名下全部迁移任务

| 任务 | Linear 状态 | 当前处理判断 |
| --- | --- | --- |
| [20](https://linear.app/gmx-io/issue/FESOL-20) 发送/成交状态 | Todo | 首选；56 已有本地提交，解析/生命周期有实验参考。补齐身份关联后做 GMX RPC tracker 与共享 toast |
| [56](https://linear.app/gmx-io/issue/FESOL-56) 交易构建/校验/发送 | Execution | 本地开发已大幅推进，应整理交付及处理实际验收阻碍，不再新写另一套 builder |
| [15](https://linear.app/gmx-io/issue/FESOL-15) 市场选择器/header | Review | #3201 已实现；收敛 review、集成回归和 release 交付是价值，不重建同功能 |
| [72](https://linear.app/gmx-io/issue/FESOL-72) GMX 自建 WASM | Execution | 先由 Divhead 确认目标版本和 artifact 位置，之后可推进构建；正文 v0.10.0 与 57 所述 0.11.0 不一致，不能擅选 |
| [114](https://linear.app/gmx-io/issue/FESOL-114) SOL 不足前置阻断 | Triage | 订单侧可随 19 完成错误分类/用户文案；全量 GM/GLV 验收依赖尚未接入的 3，不建议独立造无调用方 helper |
| 13、14、16、49、55、70 | Done | 已完成记录；不当作当前新候选，历史完成不替代最终集成验证 |
| 58 | Duplicate | 范围归 19/20，不另开开发线 |

旧项目另列：34、39、44、83、101 为 Done，111 为 Test（nightly GMTrade fee 差异）。111 可以按原任务做验收收尾，但不是 GMX Solana 迁移主线的新任务。

## 未分配任务完整分组

表内编号均为 FESOL，状态来自本次快照。正文的产品 Owner 不等同于 Linear 实施 assignee。

| 任务 | 状态 | 现在介入的判断 |
| --- | --- | --- |
| 19 下单入口 | Todo | 未分配首选。接共享 TradeBox、钱包、预览、发送及提交反馈；不等待 20 完成成交 toast |
| 89、96 余额 reader/hook | Execution | 已在 #3195 / #3190 有实现。可协调处理 #3195 的空 System-owned ATA 余额读取失败等真实审查问题，收敛重复 PR；不能再按“无人分配”新写整套 |
| 28 仓位/订单操作 | Backlog | 首发所需；加减保证金仍列 Cycle 4，具体实施分工未定。与 Sulliven 的 59、19/56 重叠，先明确 collateral 切片归属和指令契约再接 |
| 32 Net rate 图 | Backlog | API #341 已有持久化实现，stack 在 #340，但部署/采集/历史覆盖未证明；可继续对接，当前证据不足以优先于 19/20 |
| 116 上币日期来源 | Backlog | 可以由 lead 推动产品/后端确认定义、API 字段与负责人；不是已有明确契约的编码任务，不能伪造日期 |
| 18 多语言对齐 | Backlog | 当前正文仅评估性描述；应落到实际功能新增文案和已有本地化流程，单独开泛化改造价值不明确 |
| 3 Pools | Backlog | 真实池数据、存取/shift 等交易与 shared UI 集成跨度大，不因旧项目已有就判定完整新接口就绪 |
| 5 Trade 聚合 | Backlog | 父任务，优先推进 19/20 等子能力，不另造聚合实现 |
| 30 Trades 历史 | Backlog | 需真实历史事件覆盖、分页与字段语义；API #340 的索引器代码不等于历史接口/部署全部就绪 |
| 31 Claims | Backlog | 明确依赖后端/keeper 的五日返还可领取状态；不能靠时间推算替代真实可领取证据 |
| 33 Swap | Backlog | 独立产品能力，含原生 wrap/unwrap 入口。56 的订单内 wrapping 不等于该需求已实现；缺完整 quote/交易入口契约核验，暂不作为首选 |
| 79 Stats | Triage | 有可做的 Solana 展示差异，但完整 GM 池数据仍需契约；相对交易主线价值低，未证明整体就绪 |
| 86 TradFi | Backlog | 首发仅 crypto；与市场时段/数据能力相关，当前不优先 |
| 102 Earn | Backlog | DES-88 / #3211 有设计实现，数据 hook 和真实 staking 资产/收益契约未齐；不要重复做页面壳 |
| 104 Referrals | Backlog | DES-90 / #3226 有设计实现；归因迁移、历史实际优惠和奖励接口/交易仍需确认 |
| 105 GT Points | Backlog | DES-89 / #3220 有设计实现；GT 历史/额度/buyback 与实际交易的数据契约尚需核验，不照搬旧 UI |
| 106 Staking | Backlog | 设计共享 105；GM/GLV staking、收益、批量交易与历史未证明可完整接入，暂缓 |
| 88、93、94、95、97、98、99、100 | Backlog，已归档 | 历史拆分；88 对应 50/#3138，93/95 已被 56 本地实现覆盖，94 归 20，97/98/99/100 分别由数据/15/29/25 主线承接。不可重复开单开发 |
| 1、2、4 | Canceled | 不作为新候选；对应新产品需求需按当前源任务判断 |
| 17 | Done | Playground 已完成，不作为新候选 |

项目外未分配项也检查过：87 是历史切片聚合；110 为 Release，正文指定 Sulliven 的页面/TradeBox/chat 跟进，不能据 assignee 为空接管。85 无迁移项目归属，正文为旧 GT Buyback rent receiver，应先澄清归属；117 带 GMTrade 标签，为旧项目 i18n。本次不将其计为新迁移机会。

## 首选 20 的最小有效实施范围

1. 从 56 的已验证交易计划/创建回执提取并暴露 typed order identity：program、store、order、action id、creation signature，关联 owner/market/position/kind。当前 `GmsolSendResult` 只有 signatures、slot、refreshErrors；仅靠签名不够准确追踪订单。
2. 选择性复用个人实验分支的 decoder / reducer / 固定布局与 fixtures，先核对版本和 provenance。保留失败交易过滤、program/store/order/action 关联、地址复用、乱序/重复/缺失证据与执行/关闭分交易边界。
3. 实现单条已发送订单的 GMX RPC 历史跟踪/重试；不做钱包订单枚举，不引入 Corvus，不额外建立独立业务数据流。提交确认不等于成交，关闭账户不等于成交；缺证据保持 unresolved。
4. 消费到 GMX 共享 toast 和既有账户数据刷新。先离线 parser/reducer/tracker 测试及共享 UI 状态契约，再真实钱包验证执行、取消与延迟场景。

可立即进行 1–3 的开发与有价值的离线验证；整条 20 的 live toast 验收还需要发送入口、可用 LUT、真实订单与钱包授权。FESOL-94 已归档，只作历史范围参考，不再另外申请一条平行 PR。

实验参考 `solana-independent-implementation@f3842a7d501d8506980a2df4c6dde81659cb2211`：`src/domain/gmsol/decodeOrderEvents.ts`、`reduceOrderLifecycle.ts`、`orderEventLayout.json` 及对应 spec。IDL 固定 `c6778dc9bf6444f9037c3b0d2dc219c857e1b45d`，fixtures 位于 `tools/solana-builder-probe/order-event-fixtures.json`，自述 historical mainnet receipts / offline-audited，但 `businessAcceptance:not-evaluated`、历史 binary/source identity 未证明，contract 的 source-derived 状态尚未更新。故这是可复用参考与待重验材料，不能直接宣布已完成当前部署版本验证。

协议 [gmx-solana#492](https://github.com/gmsol-labs/gmx-solana/pull/492) 已 merged，合并提交 `fd7cedbddf6e0d98087d83400c204ff19ffcda25`。Rust SDK 的生命周期语义是参考，不是 TS tracker 的实现；其 failed transaction 过滤明确不在该 PR 范围，前端必须补齐。

## 备选 19 与前置 PR 集成

19 最有价值的第一段是共享 TradeBox 的 market increase：正确识别 Solana 钱包、复用 SDK 预览、余额与风控、调用 56、提交确认反馈及账户刷新。随后覆盖 limit 和 attached TP/SL，保持单 issue/单逻辑 PR，不把内部阶段误报为整需求完成。源码检查尚未发现共享 TradeBox 调用 `useGmsolOrderTransactions`；56 的已有验收记录也发现 header 已连接而 TradeBox 仍显示 Connect Wallet。这是具体缺口，不是凭标题推测新任务。

| 基础 | 已核验代码/PR | 可开发与交付边界 |
| --- | --- | --- |
| 56 sender | 本地 `solana-order-transactions-fesol-56@a8733143f47230d996303d174b2ca9dcaf0b1c87` | builders/validator/send/cache refresh 已提交。该 worktree 随后出现 hook 与 spec 的继续修改；本报告基于已提交版本，不接管未提交现场 |
| 52/数据 | [#3193](https://github.com/gmx-io/gmx-interface/pull/3193) `732b4a1` | Open / review required；3197 只 merged 到该分支，非 release |
| 51/89/96 余额 | [#3195](https://github.com/gmx-io/gmx-interface/pull/3195) `2495be2` | Open / changes requested；空 System-owned ATA 和调试路由问题仍需处理；#3190 Draft 存在重叠 |
| 57 math | [#3242](https://github.com/gmx-io/gmx-interface/pull/3242) `6d3ed92` | Open / review required；component job 有安装/DNS 失败证据，不能称全绿。112 的激活/版本验收仍要完成 |
| 92 SDK 输入适配 | [#3243](https://github.com/gmx-io/gmx-interface/pull/3243) `5e081e5` | Open / review required |
| 113 字段 | [#3205](https://github.com/gmx-io/gmx-interface/pull/3205) `087a98f` → [#3207](https://github.com/gmx-io/gmx-interface/pull/3207) `c711f6e` | stacked，3207 Draft；必要字段随实际调用范围集成 |
| 15 市场入口 | [#3201](https://github.com/gmx-io/gmx-interface/pull/3201) `056f8d6` | Open / changes requested；19 接真实市场入口需要收敛这些改动 |
| 25 仓位/订单 | [#3238](https://github.com/gmx-io/gmx-interface/pull/3238) `07117e1` | Open / review required；已有仓位/订单选择需要这些共享状态适配 |
| 71 LUT/开关 | [任务](https://linear.app/gmx-io/issue/FESOL-71)，Divhead | 56 的实测两个 LUT 均可变，生产 prepare 的 frozen 要求会拒绝。附带 TP/SL 的部分价格组合还有 1255-byte 超限，freeze 本身不保证解决覆盖不足 |

56 已在任务分支集成 3243/3242/3195/3193/3205/3207；不需要每次重搭同一底座。开发 19/20 时可从登记流程建立任务分支，精确集成需要的已固定提交并审查差异，保留上游待审风险。实际开工时刷新受影响 heads，不将本表永久视作最新。

19 的完整验收还需要：可用数据/钱包费率折扣、SDK 数学与 simulate_order 对齐（112）、LUT 覆盖与冻结（71）、真实签名广播与 keeper 结果、existing position/limit 和 TP/SL 交互。允许叠前置不消除这些验收条件。20 不必成为 19 提交成功 toast 的前置，19 明确暂不等待 execution stage。

## 证据与本轮边界

在线 release 为 `24cd9b16d65b1ed4daae4c90c81c253588e8938d`。本轮复用同阶段全仓库 PR/分支调查并核对相关 open PR heads，未见关键 head 变化；原调查见 [迁移进度报告](solana-progress-2026-11-13.md)。本机原始证据在 `.local/solana-progress/2026-11-12T17-31-00Z/`、`.local/solana-next-task/2026-11-13-kenny/` 与 `.local/linear/FESOL/`，不可当作共享附件。

FESOL-56 已记录的测试/构建/只读主网 simulation 是原任务执行证据，本轮没有重跑，也未签名广播。对其他远期候选完成正文/PR 范围筛选，对 19/20 做了调用接口与版本证据核验；本报告不代表全部未分配需求都通过完整技术设计审查。

kenny 的 frontend lead 身份与允许需求分支集成未合并依赖的偏好，已写入 [AGENTS.md](../AGENTS.md) 及[推荐流程](solana-next-task.md)。本轮仅沉淀本地文档，保持待提交；未修改 Linear、评论 PR、合并上游或创建开发分支。
