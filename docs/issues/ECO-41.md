# ECO-41 — GT Buyback 独立 rent receiver

## 旧前端实施就绪深挖（2026-11-25）

结论：官方gmx-solana-interface main `0e863b8dae7e1d9bef2cf28efe168b16c0992d20`尚未实现本单；本地HEAD与GitHub实时main一致、工作区干净。查询rent/独立receiver/FESOL-85 PR及全部open PR未发现对应交付，不据此证明不存在未推送工作。按现有AC可由前端独立实施，不必等新后端或V2领取；真实发布验收仍要核对目标部署/样本。未开发业务、安装依赖、运行全量测试或签名广播。

### 真实调用路径与缺口

- `app/src/components/newGT/Buyback/BuybackSeason2.tsx`已有Claim Rent入口→`ClaimRentModal.tsx`→`useClaimableGtRent`→`api/gtRentRpc.ts`。RPC读取184字节exchange，按owner offset24、store offset56筛选，但映射丢掉receiver；租金来自账户真实lamports。
- `utils/claimableGtRent.ts`的GtRentAccount无rentReceiver，候选只校验program/owner/store/SQD exchange-vault pair，汇总只再校验vault确认位；因而独立receiver仍计入owner租金和账户数。直接用主项目现有TypeScript转译并运行原函数：owner=A/receiver=B、2171520 lamports样本返回accountCount=1、totalLamports=2171520。此为确定性离线诊断，非真实链上领取。
- Modal直接用totalLamports/accountCount展示和启用领取；`useClaimGtRent.ts`虽提交前refresh，却重新走同一缺失筛选，并使用`hooks/gtHooks/utils/completeGtExchange.ts`的旧`.completeGtExchange()`。不会因refresh自动防住本问题；仅依赖模拟报错不满足AC。
- `client/src/program/store.ts`创建真实StoreProgram使用client IDL。其GtExchange仍为reserved[64]，没有独立rentReceiver。app内另一份IDL也不应误认实际decoder来源。全仓receiver命中多为其他账户，不能据此声称GT已适配。
- 共享奖励完成hook及历史`components/GT/Hooks`也存在旧completion路径。当前未发现这些hook的tsx调用点，不宣称它们都属于活跃页面；实施应检查实际可达入口，防止只改租金modal，同时不能全局隐藏owner合法的GT Bank收益。

### 为什么不必等待后端/新SDK

协议按官方origin/main `748d845c1086c787666ac4d6aa014e55e70c4beb`核对（仅fetch刷新引用，固定checkout保持3e0a4115，未动gitlink）。`programs/store/src/states/gt.rs`及其布局测试固定struct176字节，receiver struct偏移112（含8字节discriminator后账户偏移120），原reserved前32字节复用，剩余32字节保留。零pubkey表示effective receiver=owner；显式owner同样走原领取行为。

前端已经拿到RPC完整account bytes，能局部增加经过布局验证的解码/型号字段（复用旧reserved前32字节，或最小同步账户IDL/type），不需要SQD新增receiver字段，也不必升级整个WASM/npm SDK。实现必须校验discriminator/size/program/store，不把解码失败降级成owner。该数据源可支持正确归属与过滤，不能通过只删按钮满足金额/账户数AC。

现有旧站Claim Rent确实依赖GT SQD用于season/request关联。本任务可保留旧站现有链路，只新增RPC receiver判断；“无需新增后端”不等于“现有功能不依赖SQD”，也不把本结论用于GMX迁移接入旧服务。

### 建议最小范围与验收

1. 持久传递effective receiver，区分零/显式owner/第三方；金额和count只汇总owner真正可领取且旧completion兼容的项。对排除项保留真实receiver归属，不声称给B提供了新领取能力。
2. 提交前refresh沿用同一资格判断，在builder/发送边界拒绝第三方receiver项，混合批次只发送兼容项；保留当前pending防重、钱包/网络隔离、分批/模拟和真实lamports统计。
3. 定向验证三种receiver、同/异receiver混合、提交前变化、错误解码、跨钱包/无符合项，保护receiver=owner既有行为。实际UI/RPC与合法同owner领取、独立receiver不触发旧指令的验收，实施后在目标环境进行。

### 扩大范围的外部边界

SCSOL-29/#506已合并不证明主网部署。最新协议Store `instructions/gt.rs`旧close仍检查effective receiver==owner；新closeV2则关闭到receiver对应的system-owned rent collector PDA，Treasury V2也传rent_collector。故“新completion直接把SOL打到B钱包”的说法不能作为当前main精确实现描述。若要新增B的实际领取/permissionless completion，须核对Store/Treasury协调部署、当前IDL/SDK、collector提款及actor/owner ATA等契约；本单现AC并不要求做这部分。ECO-32的文档review不是当前防护修复的硬阻塞。


2026-11-25，角色：只读需求解释。实时读取[ECO-41](https://linear.app/gmx-io/issue/ECO-41)、SCSOL-29、ECO-32正文/关系及全部评论。本单仍Triage、未分配实际assignee、无评论/显式blockedBy；正文Owner Orion，triage建议Sulliven不等于分配。标签GMTrade/Frontend，属于旧站GT Buyback，不能混入GMX Solana迁移表。

核心：GtExchange的owner拥有GT Bank payout，记录的rent receiver拥有账户关闭退还的SOL租金，两者可以不同。前端必须按receiver归属统计，不能把他人的租金/账户数算进owner可领取汇总；独立receiver场景不提供会提交旧completion而失败的操作。receiver=owner保留Claim Rent。举例A为owner、B为receiver，则GT Bank payout归A，rent归B。

当前AC是正确归属+防止错误操作，没有要求在本单实现新V2 completion、为B新建完整领取入口或选择自动执行者。SCSOL-29为Done，其正文明确新permissionless completion向owner canonical ATA付GT Bank share、向receiver退rent，旧instruction对不同receiver仍失败；Done不证明线上部署或当前前端SDK已接通。ECO-32为In Review，当前AC仅要求CHANGELOG写明Store/Treasury协调升级及出现独立receiver后不回滚Store；不将这条关联直接当作本单显式硬阻塞。

本轮未查代码/PR合入/合约部署或钱包验收，未修改Linear、认领或实施。历史映射与记录见[FESOL-85](FESOL-85.md)：FESOL-85 → TRD-157 → ECO-41。
