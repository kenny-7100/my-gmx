# 四需求可推进切片 · 2026-11-15

## 按推荐顺序实施结果（2026-11-15）

用户已明确授权实施以下切片，按顺序完成；下方“只读/未实施”表述保留为此前调研时的状态，不能代替这里的最新结果。

| 切片 | 当前成果 | 验证与边界 |
| --- | --- | --- |
| 19 base58 TP/SL 预览 | development `2b52d15ec3`，delivery `40653d3026`，已更新原 Draft #3262 | 真实 builder 回归先 red 后 green，开发/交付各 25 项及 types 通过；未恢复原暂缓范围，未做已连接钱包/链上验收 |
| API #340 与当前前端消费链 | 固定 `59e49c649d` 的真实 index/PostgreSQL/HTTP 响应与当前前端组合验证通过，未发现需要修改的业务不兼容 | producer 11 项、当前消费者 3 项（含 50 份账户/折扣成功响应），另有现有回归 11 项通过；固定源码/历史 fixture 不等于线上部署 |
| 92 release 导出冲突 | 解决候选 `c35a5f04da` 已保存到个人 fork，保留 release 数学与 units 双方导出 | 41 项 SDK 测试、SDK 构建、app/landing types 与 lint/format 通过；origin 只读，上游原 PR 尚未应用候选 |
| 25 相对最新 52 的独立改动 | 组合 `909a09d470`，仅 5 个源码与 10 个 locale，无需另改业务 | 2 项真实组件/设置网络切换验证、原筛选 5 项、SDK 构建、app/landing types、lint/format 和 locale compile 通过；仍以未合并 52 为前置 |

过程与定位见 [19](issues/FESOL-19.md)、[API/112](issues/FESOL-112.md)、[92](issues/FESOL-92.md)、[25](issues/FESOL-25.md)。验证专属数据库容器已清理，诊断 scratch 已归档并从业务 src 清理；没有修改 Linear、联系后端或发布外部评论，没有转 Ready、请求 reviewer 或合并上游。Docker 按用户追加要求先迁到 `~/kenny/docker/DockerDesktop`，确认系统盘旧位置无虚拟磁盘后才拉取 postgres:15，详见[外置存储](solana-dev-workspace.md#本机-docker-外置存储2026-11-15)。

## 完成后的下一步候选（2026-11-15 11:53）

再次在线核对 release `84ab9293a8`、52/51/15/25/92、字段 #3205/#3207 与 API #340，heads 均与本阶段已核实版本一致，尚未合并；Linear 再同步仍只有 40 条/迁移项目 8 条，不能据此补全关键需求正文或当前负责人。

- **本项已实施**，两层候选及验证见 [FESOL-113](issues/FESOL-113.md#最新-52-上的两层冲突候选2026-11-15)；以下保留选择前依据：准备 #3205 `087a98fa37` → #3207 `c711f6ebe7` 在最新 52 `e712a1d342` 上的精确冲突解决候选，保持 fee/referral 与 order metadata 两个切片及既有 PR 归属；GitHub 两层均 CONFLICTING。当前前端已消费这些扩展且 API #340 消费链通过，适合收敛交付栈，不重复重写 reader。冲突具体语义仍需实施前定位，不能预称简单冲突或独立可合并；原作者上游分支只读。
- 25 已验证的五个源码文件与 19 development `2b52d15ec3` 逐字一致，19 delivery `40653d3026` 仍排除这些改动，符合既有独立交付边界。下一步可做整合状态下列表/设置/仓位展示的定向验收，发现实际缺陷再修；不要再次向 development 合入相同代码，也不自动捎带进 #3262。
- 56 有限价格 increase+TP+SL 的 1255/1232-byte 问题可继续做固定 SDK/ABI 下的离线优化原型及收益验证。保留价格边界、账户准备与单笔原子性；尚无已证明可直接交付的编码解法。可信 LUT 配置仍需真实地址/authority/覆盖证据，假设单表不可当生产资源。
- 15 的自有成果可先做相对最新 52 的精确分离与候选验证，不改变此前等待 52 合并后从 release 重建正式交付的决定；不整支携带旧 52 重复整合。51 的 RpcDebug 产品取舍、19 原暂缓范围、四钱包签名落链均不自动恢复或自行决定。

本轮是候选分析，没有改业务或原 PR，没有启动服务/构建/浏览器，也没有向后端询问或发布消息。

以下为实施前推荐依据：


角色：只读调研与推荐。用户本轮要求优先从最新PR代码判断实际开发进度，暂不向后端确认；本次不自动实施、恢复19暂缓范围、联系他人或修改PR/Linear。复用同阶段已核实的Linear关键需求不可访问证据，不把历史assignee/正文当实时结论；以下是基于固定代码的推荐，不是新需求认领或整体验收结论。

## 首选：19已实现主路径的base58预览修复

当前19 development `1155c46f87`与delivery `e4e9067a0f`的相关四文件无差异。追踪调用链发现：

`SideOrderEntry` → `selectTradeboxMockPosition` → `buildTpSlPositionInfo` → `getPendingMockPosition` → `hashedPositionKey` → viem address ABI encoder。

selector改走buildTpSlPositionInfo并没有切断EVM hash。连接Solana账户、有效数学/市场数据使selector计算出预览时，base58 owner/market/collateral仍会作为EVM address编码并抛错；公开API缺tradeMath可能让此前页面未进入该路径，未连接钱包回归也不能排除此问题。此前仅追到新helper的判断不充分，本轮更新为具体可复现缺陷，不向52重复派修。

定位：`src/domain/tpsl/sidecar.ts:107`、`src/domain/synthetics/positions/useOptimisticPositions.ts:164`、`sdk/src/configs/dataStore.ts:355`。本轮从当前源码AST提取hashData、hashedPositionKey、parsePositionKey和getPendingMockPosition四个原函数声明，仅TypeScript转译，注入已安装viem encoder与Map缓存，不改函数体。EVM对照返回正常hash；API真实fixture中的owner配合实际ETH/USDC市场/抵押币，多空均抛InvalidAddressError。没有执行完整React selector或已连接钱包浏览器，不称新的UI实测。

最小范围：使Solana TP/SL预览不进行EVM合约位置hash，明确预览身份与真实positionAccount的边界，保留EVM行为；补充base58多空及EVM对照回归，在原19 development实施，必要检查后精确转入既有delivery/#3262。修复不依赖API上线、可信LUT、钱包签名或后端答复；它也不包含兑换、最大杠杆、完整simulate_order及GT Rewards暂缓项。当前仅完成诊断，未实施修复。

## 第二项：API候选源码与当前前端消费者的契约核验

[API#340](https://github.com/gmx-io/gmx-api/pull/340)固定head `59e49c649d`，再次在线确认未变且tests成功。已下载该SHA源码阅读，确认SDK-next 2.9.2、tradeMath=gmsol、真实原始账户fixtures、index/HTTP parser集成测试、旧数学快照503与readiness拒绝、X-Solana-Slot响应及CORS暴露、minContextSlot等待/恢复已有实现。

所读 `src/solanaSdkParsers.test.ts` 使用发布SDK-next 2.9.2；当前56/19额外集成的严格order/referral reader、order metadata composition及确认slot tracker不在该组合调用路径。其supertest fetch adapter也没有转发onResponse元数据。不能把这个suite成功当作当前前端组合通过，也不重复编写API侧已有的字段/索引测试。

最小有效切片：复用上游真实fixture和真实index/HTTP实现，接当前前端parser/composition与刷新tracker，验证订单metadata、callback null语义、折扣字段/精度、市场数学字段、response slot、503后追赶及旧响应拒绝。出现失败先定位生产方/消费者，再决定是否修改。该切片只证明固定源码与历史fixture组合兼容，不冒充当前线上金融参考值、完整simulate_order、keeper或钱包验收。

API suite实际依赖PostgreSQL，jest globalSetup创建测试数据库。本机docker daemon可访问、API依赖目录存在，没有psql；资源条件足以准备隔离数据库，不需后端新答复。当前本地gmx-api固定checkout仍为旧样例SHA `b86956df00`、detached且干净，不能用它证明#340；后续用候选SHA隔离目录、锁定依赖及任务自有数据库，不移动gitlink或接管未知服务。本轮未安装依赖、建库、启动API或运行该suite，不能预称开箱即过。

## 第三项：精确收口已有前端依赖

本轮对已在线核验的固定heads运行git merge-tree，未创建branch/worktree或改变index。它生成只读分析用Git对象，不是实际合并、冲突修复或组合测试。

| 组合 | 实际结果 | 可推进范围 |
| --- | --- | --- |
| release `84ab9293a8` + 92/#3243 `5e081e5ab1` | 仅gmsol/index.ts一处add/add冲突 | 保留release数学实现并加units导出；56已有同样整合结果。可在92原开发线同步并定向验证，不依赖RPC/API/LUT，不重写转换函数 |
| release + 25/#3238 `07117e1691` | 7个源码文件冲突，多为52重叠层 | 不将GitHub DIRTY直接解释成25本身尚未开发完 |
| 52 `e712a1d342` + 25/#3238 | 干净组合，tree `7dae1f8a48add674f22b3ec0fbd49b00d66125c6` | 相对52仅5个业务源码文件及10个locale，主要为列表过滤、仓位项、display settings与feature/settings context。可按52基线定向核验小片，不等于tests/UI已通过；不自动改他人PR base |
| release + 15/#3201 `056f8d689c` | TVChartContainer、indexer utils与10个locale冲突 | 按原交付计划处理，不比首选直接 |
| 52 + 15/#3201 | 多处provider/API/shared trade与locale冲突 | 3201携带旧52，不宜整支合入新版52；后续提取15自有成果重建，保留既有待52合并后整理的决定 |

92/25属他人已有开发线，分析不授权接管分支、重写历史或发布review。可准备精确修复/核验方案，实际维护按授权和成果归属执行。

## 未优先选择的工作与证据边界

- 71仍限制可信LUT及真实签名落链；固定WASM编码改造会改变已确认产物/ABI验证范围，不优先于可复现前端缺陷与契约核验。
- 19既有暂缓范围不自动恢复；完整simulate_order数值对照不是本轮建议的契约切片。
- 四需求已消费已知heads，无证据要求再全量同步、重跑旧测试或修改72独立WASM构建。
- 51剩余RpcDebug取舍及review收口仍存在，但不如直接修复19异常、验证跨仓库消费链有价值；已修复ATA和key问题不再派修。

release `84ab9293a8`、52 `e712a1d342`、API340 `59e49c649d`本轮再次在线核验；gmx-prompts main `72041619ae`与本地一致。其余PR身份、评论、review及checks复用同阶段[上游核对](solana-trading-dependencies.md#上游跟进核对2026-11-15)。源码、函数诊断、merge-tree报告保存在 `.local/acceptance/upstream-followup-20261115/`，不把完整tarball或机器报告提交。未做完整代码审计、UI、构建、业务suite、主网模拟/签名/广播或部署。
