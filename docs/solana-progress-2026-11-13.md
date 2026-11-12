# Solana 迁移进度盘点 · 2026-11-13

北京时间 01:31 起读取 Linear、GitHub 和代码，约 01:40 整理。角色：只读进度调研。此轮是有显式工作包权重的粗估，不是完整代码审计或上线验收。

| 口径 | 粗估 | 估计区间 | 置信度 |
| --- | --- | --- | --- |
| 12 月 10 日交易首发所需工作量 | 55% | 45–65% | 中低 |
| 当前有效 Linear 迁移需求工作量 | 40% | 30–50% | 中低 |
| 已确认完整迁移所需工作量 | 40% | 30–50% | 低 |

当前需求已覆盖确认的完整产品范围，因此后两个分母在本轮工作包粒度相同；没有人为追加猜测范围。完整迁移包含 TradFi、Pools、转账、历史、Claims、Swap、费率图、Stats、Earn、Referrals、GT 与 staking，以及摆脱旧服务依赖所需的数据与交易接入。首发另含抵押品编辑、默认 Depth、索引后端、金融正确性和必要验收。百分比不代表发布日期、已合并比例或上线就绪度。

## 证据与判断

- Linear：115 条 FESOL 全量同步，迁移项目 82 条 FESOL、5 条 DES；排除 28 条 GMTrade 旧项目需求，没有标签/项目冲突。82 条中 24 Done、25 Backlog、8 Review、7 Execution、6 Todo、5 Duplicate、4 Canceled、2 Triage、1 Test。排除取消/重复后 73 条仍含父子、历史与聚合项，不能直接算完成率。补读 20 条关键 FESOL 的实时关系/评论，以及 INF-4、TRD-29、DES-65/88/89/90。
- 上游前端 `release` 为 `24cd9b16d65b1ed4daae4c90c81c253588e8938d`，`master` 为 `d975cfaccd5f5dc027319aeb49e32f20c9c0f5a1`。release 的 Solana Trade 路由仍为 `SolanaTradePlaceholder`，不能把开放 PR 的预览能力当作已交付功能。
- [UI#3138](https://github.com/gmx-io/gmx-interface/pull/3138) 已合并。网络、钱包、静态配置、隔离和惰性 WASM 基础已有上游代码。
- [UI#3193](https://github.com/gmx-io/gmx-interface/pull/3193)（共享状态）head `732b4a1`，Open、Review required，当前检查成功；[UI#3197](https://github.com/gmx-io/gmx-interface/pull/3197) 只合入该需求分支。[UI#3205](https://github.com/gmx-io/gmx-interface/pull/3205)/[3207](https://github.com/gmx-io/gmx-interface/pull/3207) 仍为 typed contract 的 stacked 子变更。
- [UI#3195](https://github.com/gmx-io/gmx-interface/pull/3195)（余额）head `2495be2`，Open、Changes requested、检查成功。未解决意见包含空 System-owned ATA 导致整次余额读取失败，以及不可达的 RPC Debug 路由；[UI#3190](https://github.com/gmx-io/gmx-interface/pull/3190) 是重叠 Draft，只计一份成果。
- [UI#3201](https://github.com/gmx-io/gmx-interface/pull/3201)（市场）head `056f8d6`，Open、Changes requested、检查成功；已有 live preview 与 reviewer 对字段的核对证据，多条意见已有修复回复，不能把旧 review 全部当作现存 bug。最终复审及依赖收口仍未完成。
- [UI#3223](https://github.com/gmx-io/gmx-interface/pull/3223)（图表）head `437fcf5`、[UI#3238](https://github.com/gmx-io/gmx-interface/pull/3238)（列表）head `07117e1` 均已有实现且当前检查成功，仍 Open、Review required。最终图表预览、数学值和交易动作组合验收未完成。
- [UI#3242](https://github.com/gmx-io/gmx-interface/pull/3242)（数学）head `6d3ed92`、[UI#3243](https://github.com/gmx-io/gmx-interface/pull/3243)（单位转换）head `5e081e5` 均 Open、Review required。3243 检查成功；3242 组件 job 失败，其余所列检查成功。已有知识记录指出该 job 是安装/DNS 问题，不能说数学断言失败；Rust reference 比较与 dust 问题的边界见 [FESOL-56](issues/FESOL-56.md)、[FESOL-57](issues/FESOL-57.md)。本轮不复跑测试。
- FESOL-56 本地开发 worktree 已有未提交 builder、validator、sender、Privy 签名桥和确认后刷新代码，予以有限开发成果计量；尚无完整四钱包、LUT、主网与 keeper 验收，不能计成已交付。共享下单 UI、成交跟踪、平仓/改单/撤单/抵押品仍是主要剩余。
- API `main` 为 `cf9fe279ac1dd5a852783a1e7404e16f92378820`，已有真实链上市场、订单、持仓、折扣和监控/压测工具，但 SDK 仍固定 `2.2.1`；[FESOL-112](https://linear.app/gmx-io/issue/FESOL-112) 的数学发布、API pin 和参考值/交易后刷新验收仍待完成。
- [API#340](https://github.com/gmx-io/gmx-api/pull/340) head `bc4eaa6`，已有 PostgreSQL schema、受 fencing 约束的 worker、indexed HTTP 读取和 CI，Open、Review required，不能当成未开始。部署及真实数据库、完整发现覆盖、恢复与消费者验收未知。[API#341](https://github.com/gmx-io/gmx-api/pull/341) 为其上的 Draft，已实现费率历史收集/读取，无历史回填，未建立部署收集证据。
- [ADR#27](https://github.com/gmx-io/gmx-adrs/pull/27) 已改为 PostgreSQL 索引方案，仍 Proposed/Open。[INF-4](https://linear.app/gmx-io/issue/INF-4) 明确把 hot standby 和消除重启 503 窗口从 API#340 拆出，不能擅自作为其合并或首发的额外门槛；已要求的重启正确性、陈旧数据拒绝及回滚验收仍保留。
- [UI#3211](https://github.com/gmx-io/gmx-interface/pull/3211)、[3220](https://github.com/gmx-io/gmx-interface/pull/3220)、[3226](https://github.com/gmx-io/gmx-interface/pull/3226) 是 Earn、GT/staking、Referrals 的设计实现草案，数据 hook 未接，动作未连交易；tester PR 不再计量。Stats 新设计 #3255 使用 mock，不证明 FESOL-79 的数据与路由完成。

## 估算方法与覆盖限制

27 个非重叠工作包：交易首发 15 包、权重 190，中心 54.54%；全范围 27 包、权重 317，中心 38.18%。权重来自实现、安全、跨仓库集成及验收复杂度，不是 issue 数、行数、状态系数或工期。逐包低/高值加权得到约 45–65% 和 29–49%，对外取整为上表区间。权重和各包完成量仍属工程判断，不能解释为统计置信区间。

在线分页枚举 15 个可访问仓库的全部分支和各状态 PR；对识别出的当前相关 PR 读取正文、diff、head、review 和 checks，对核心 11 个 PR 补读 review threads（均无后页）。在线读取当前基线 tree、路由、API pin、索引 worker/readers 与 ADR。历史/无 PR 分支未逐行审计，旧 nightly 与已被替换架构不按历史投入计完成量。

`gmx-infra#96` 返回不可访问，Cloud SQL 权限及 rollout 不能确认。RPC proxy 的私有 PR 可读，为 Approved/Open、check 成功、deploy skipped，但未枚举其整个私有仓库。未下载所有设计附件或重新验证数学 zip，没有执行测试、构建、UI、部署、钱包签名或交易。其他任务正在修改的 FESOL-56 仅是读取时的快照。本轮保留完整评估/验收覆盖缺口，不更新 `solana-progress/latest.json`。

本机证据保存于 `.local/solana-progress/2026-11-12T17-31-00Z/`：`assessment.md`、`evidence.json`、`pull-requests.md` 及原始 PR/Linear/代码读取。它们被忽略，不作为唯一共享结论；本文件保存可接续摘要。

## 排期与前次变化

[FESOL-109](https://linear.app/gmx-io/issue/FESOL-109) 的 11 月 11 日 Trading 计划已覆盖旧 Cycle 2/3/4 日期：新 Trading Cycle 1 为 11 月 16–30 日，Cycle 2 为 11 月 30 日至 12 月 14 日；目标为 12 月 4 日完成实现、8 日验收、9 日发布决策、10 日公开。不能将旧 Cycle 2 开发完成误解为已全部验收，也不能继续按旧 Cycle 4 等待数学 API 前置。12 月 10 日是条件性目标，本轮证据不支持承诺按时上线。

相对 11 月 4 日：3138 已合并；3193 当前 checks 全绿；市场、图表、列表、数学与转换都有新增/推进中的 PR；API332/334 已合并；56 本地开始形成交易实现。同时索引后端成为公开验收条件，增加了跨仓库与部署工作。上轮没有有效百分比，不能报告百分点增长。

中文现状：交易首发约完成 55% 工作量，确认的完整迁移约 40%；基础和多数只读能力已有实现，交易闭环、发布后的 SDK/API 数学一致性和索引部署验收仍是关键剩余。开放 PR 与本地未提交成果已计开发量，未当作上线。

English: The initial trading release is roughly 55% complete by estimated workload, while the confirmed full migration is roughly 40% complete. Foundations and much of the read-only experience are implemented. The remaining critical work is the integrated transaction lifecycle, published SDK/API financial parity, and indexed-backend rollout and acceptance. Open PRs and local uncommitted work receive implementation credit but are not treated as shipped functionality.
