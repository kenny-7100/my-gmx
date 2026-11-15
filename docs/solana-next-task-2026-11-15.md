# 四需求可推进切片 · 2026-11-15

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
