# FESOL-112 — 金融集成验收依赖

## 五需求前置复核（2026-11-23）

本轮以依赖调研角色核对实时Linear/PR/checks与关键源码：自有修复传播和冲突处理已完成，当前checks全成功，无需重复接入未变前置。后续重点是84作者原线同步及Receive接缝、107部署后性能/恢复、108真实刷新闭环与109剩余参考钱包/flags；同时更正3273为ticker类型修正。具体版本、跟进归属、可更新状态与未验证边界见[统一复核](../solana-trading-dependencies.md#五需求前置跟进复核2026-11-23-0934-cst)。未修改业务或外部状态。

## 五需求前置复核（2026-11-22）

本轮只读重查当前需求及相关交付证据。API365合并提交Solana部署check成功，107仍In Progress且负载/恢复目标未完成；108四输出对照已有证据，控制交易序列待验收；109冻结LUT已交付，参考钱包/flags仍需收口；84原PR当前冲突且无新业务head，85无新head。具体归属、跟进动作与本轮验证边界见[统一清单](../solana-trading-dependencies.md#五需求前置跟进清单2026-11-22)。未操作业务、服务或钱包。

## 前置增量核查（2026-11-20）

只读实质核对本需求当前Linear、相关PR及固定版本差异；最新变化、处理建议与验证边界见[统一核查](../solana-trading-dependencies.md#五需求前置增量核查2026-11-20-2246-cst)。本轮未改业务或外部状态。

## 上游与后续核查（2026-11-18 23:12 CST）

当前TRD-108已In Progress，正文确认#340部署、SDK2.9.3切换完成。本轮公开config HTTP200、67/67gmsol，values HTTP200、67条，旧无marker阻碍应移除；未查账户接口，不证明slot/金融/交易后矩阵通过。独立四项金融输出、GMTrade参考与open-with-TP/SL→edit→close刷新仍是需求明确剩余项。证据见[统一核查](../solana-trading-dependencies.md#四需求与-trd-136-最新跟进核查2026-11-18-2312-cst)。

## 五需求前置接续实施完成（2026-11-17 晚间）

已授权并接续原开发/交付线最新release、保留SDK双侧导出；最终API2.9.3隔离验证已通过，原4条交付实际目录验证、普通推送及Draft正文更新已完成。真实交易/退出等暂缓边界不变。版本、证据及当前未完成项见[统一实施记录](../solana-trading-dependencies.md#五需求前置接续实施完成2026-11-17-晚间)。

## 五需求晚间前置核验（2026-11-17）

API#340已合并且最终多出SDK2.9.3原生计算迁移，旧本地实测不覆盖该提交；公开config仍67市场/0gmsol，正式金融与部署验收仍待。 角色为只读依赖调研，来源与验证边界见[统一核验](../solana-trading-dependencies.md#五需求晚间前置核验2026-11-17)。

## 上游跟进实施（2026-11-17）

TRD-108 相关 API #340 `996cf05db9` 已完成本地原版全局索引启动、真实HTTP账户消费、slot等待及stale拒绝/恢复验证，SDK-next alias仍2.9.2。原market/position math、discount/order及真实DB index suites共72 passed。上述证明本地候选可消费，不证明正式部署、全部金融reference或需求Done；无API推送/PR。 统一来源、交付版本、验证和外部剩余项见[五需求跟进实施](../solana-trading-dependencies.md#五需求跟进实施2026-11-17)。

## 前置增量核验（2026-11-17）

当前TRD-108；API#340更新为996cf05db9，增量索引取代每轮全量扫描，源码仍用sdk-next2.9.2，旧正文2.2.1不能描述当前候选。公开67市场仍0gmsol标记；新版本实际运行、reference和部署未验。 统一证据、版本及跟进建议见[五需求依赖核验](../solana-trading-dependencies.md#五需求前置增量核验2026-11-17)。

## API #340 固定源码与当前前端消费链验证（2026-11-15）

用户授权按可推进清单实施。固定 gmx-api #340 `59e49c649d6dd5a331af5ef793f0292f47898907`，在 `/Volumes/kenny/gmx/gmx-api-pr340` 独立 checkout 安装其锁定依赖，不移动父仓库 gitlink 或旧 API checkout。使用现有隔离数据库测试入口，PostgreSQL 镜像在已迁移的外置 Docker 虚拟磁盘中，测试专属容器及临时数据库均已由工具清理，未启动常驻 API 或接管其他服务。

以该 PR 的真实历史账户 fixtures、真实索引库及 Express/supertest 执行现有 SDK parser suite，11 项通过；诊断副本只增加响应捕获，包含市场 config/values、账户、折扣和失败响应，不改变 producer 业务实现。当前前端 FESOL-19 `2b52d15ec3` 使用其自己的 HttpClient/SDK/组合函数消费捕获的 HTTP body 与 headers；仅在传输边界回放响应，价格输入来自相同 fixture 与现有 token registry，包含 native SOL/WSOL 同 ticker 映射，不伪造未提供价格。

3 项定向消费链测试通过：逐一验证 50 份成功账户/折扣响应及 slot 回调、minContextSlot 查询；市场配置/值合并与订单组合保留 orderAccount/escrow 等元数据，pending 无 callback 的仓位订单可建立交易 context；旧在途响应被确认 slot 下限拒绝，真实 503 保留下限，随后较新响应可接收。API nullable 元数据按既有 reader 归一为 undefined。另运行现有 refetchAtSlot 与 composeGmsolTradeData suites，11 项通过。本切片未发现需修改的前端业务不兼容，也未变更 SDK/WASM 版本。

证据：个人基础 `.local/acceptance/upstream-followup-20261115/api340-{integration-report,frontend-report,http-responses}.json`；最终 API 原始报告目录以 integration-report 中 logFile 为准；前端最终报告 `.local/acceptance/frontend-offline/run-2g8Oke/report.json`，现有 11 项回归见 `run-Ocepj6`（该次包含早期尚未完善 fixture 的 scratch 失败，不当作整次通过）。诊断源码已归档到同一忽略目录，临时 src scratch 已清理。后端 fixture mock 的是 RPC/keeper 等输入，不是实时链上账户；固定 PR 与历史响应通过不代表已合并、部署、线上 math/readiness 或完整 simulate_order 验收，不需要据此向后端索要口头进度。

## 无需等待答复的契约切片（2026-11-15）

按用户代码优先要求，继续读API#340固定head的真实fixtures、index/HTTP parser suite及56/19消费者。发布SDK parser测试不包含当前前端额外的严格metadata/referral reader、composition与slot tracker，适合补跨仓库组合核验；已有503/readiness/slot实现不重复开发。本机Docker可用，完整suite需隔离PostgreSQL及候选目录，当前旧样例checkout不能作#340验收。本轮未运行suite、启动服务或验证线上数值；细节见[可推进切片](../solana-next-task-2026-11-15.md)。

## API候选分支已有数学实现（2026-11-15）

角色：上游依赖调研。补读API#340 head `59e49c649d`，确认已含published SDK 2.9.2（sdk-next alias）、marketRecords的tradeMath=gmsol、indexed reader/readiness兼容检查，以及parser/slot相关测试源码。该候选Open/Review required，未合并/部署证据仍缺，公开API依然无该字段；不能把main版本当作候选版本，也不能再笼统将112描述为未开始实现。后续向后端确认评审、部署SHA与参考值/minContextSlot验收，细节见[上游跟进](../solana-trading-dependencies.md#上游跟进核对2026-11-15)。本轮未复跑测试、验证同输入数值或修改线上状态。

## 部署契约定向复核（2026-11-15）

角色：只读项目现状调研。本轮公开 markets/config 返回67市场，tradeMath字段存在数仍为0；API main `55327018c0` 的SDK为2.8.0、sdk-next为2.9.0，前端release已含数学#3242/SDK 2.9.2。不能将数学合并视为API启用或金融参考值通过。旧编号及历史稳定UUID查询均失败，未核实当前正文、关系、评论或状态；不推断需求已取消或迁移。证据、覆盖及后续入口见[现状核对](../solana-progress-2026-11-15.md)。

## 上游刷新与证据边界（2026-11-14）

本轮新增事实、契约适配、交付及验收结果见[四需求统一记录](../solana-trading-dependencies.md#四需求上游刷新2026-11-14)，优先于下方历史状态。Linear目标访问返回Entity not found，不能据历史正文或评论判定本轮实时状态；GitHub、源码及部署按统一记录分别核验。


## 交易链路依赖统一核验（2026-11-13 16:16）

本轮参与跨需求依赖分析，核对实际集成版本、PR堆叠和merge-tree预检。新增结论、责任边界与跟进顺序统一见[交易链路依赖审计](../solana-trading-dependencies.md)，不将预检当作实际合并或组合测试通过。

2026-11-13（Asia/Shanghai），角色：为 FESOL-56 区分开发前置与整体验收依赖。[Linear](https://linear.app/gmx-io/issue/FESOL-112) 实时为 Todo，正文/评论已核对，评论为空；GitHub gmx-api 按 FESOL-112 查询未发现专门 PR。

需求要求消费已评审发布的 FESOL-57 SDK、更新 API pin 并启用对应 market fields，在索引部署上验证金融参考值与 minContextSlot 交易后读。正文仍记 API pin 为 2.2.1；本轮未独立读取 API 最新源码/部署，不将此描述扩展为本轮实际部署证明。

这影响金融与前后端整合验收，不阻碍 56 先做纯 builder/validator。顺序和边界见 [FESOL-56](FESOL-56.md)。
