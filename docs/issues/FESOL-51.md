# FESOL-51 — 余额与 RPC 前置调研

## 正式替代核查（2026-11-17 晚间）

已只读核对最新上游head与TRD136集成的实际差异。钱包API补丁运行依赖已退役；release已吸收部分能力；余额/字段新PR已无冲突但有语义差异，不整文件覆盖。具体head、替换条件、残留入口及RPC核验缺口见[正式替代审计](../solana-trading-dependencies.md#trd-136-临时方案正式替代核查2026-11-17-晚间)。

## 五需求晚间前置核验（2026-11-17）

需求明确#3190→#3195交付顺序；空System-owned ATA修复已有reviewer确认，未resolved旧P2不再等于待修；仍需原PR冲突、/rpc-debug等review及配置mint范围收口。 角色为只读依赖调研，来源与验证边界见[统一核验](../solana-trading-dependencies.md#五需求晚间前置核验2026-11-17)。

## 前置增量核验（2026-11-17）

当前TRD-98；#3195原head未变，现CONFLICTING且Changes requested。读取未resolved线程仍有空System-owned ATA整次余额读取失败的P2；需原线审查收口，未在本轮修改。 统一证据、版本及跟进建议见[五需求依赖核验](../solana-trading-dependencies.md#五需求前置增量核验2026-11-17)。

## Review经验深挖（2026-11-15）

角色：只读调查。当前#3195 `2495be234e`虽保留empty System-owned ATA修复，但`2ad57a5c3b`重新引入`!isSynthetic`过滤，同时影响reader与wallet list；这与Divhead要求读取全部配置mint及11月6日真实余额确认不一致。已读线程未见新范围决定，本轮未跑页面，不直接改作者分支。具体提交、规范语境冲突与方案见[深挖证据链九](../review-learning-investigation-2026-11-15.md#证据链九已经验证的修复被重新引入是本轮最具体的学习缺口)。本轮原编号Linear不可读，需求使用11月12日历史快照，不能当实时验收。

## Review跟进修正（2026-11-15）

只读复核#3195当前head `2495be234e`源码、review与最近评论：reviewer已于11月8日确认空System-owned ATA修复和branch history中个人key移除；reader源码也将该空账户计零，不再把它列为待修bug。PR正文已经补充，不再为空。仍为Changes requested，/rpc-debug在当前EVM-only路由中，作者11月9日询问取舍，最近窗口未见回复；应明确只针对该页开放或移除不可达Solana分支。正文Validation仍保留旧key不可用描述，与reviewer确认冲突；格式及冗余测试意见还需作者收口、reviewer复核，本轮未运行格式检查或浏览器。证据与边界见[上游跟进](../solana-trading-dependencies.md#上游跟进核对2026-11-15)。

2026-11-13（Asia/Shanghai），角色：FESOL-56 依赖调研。[Linear](https://linear.app/gmx-io/issue/FESOL-51) 为 Review，Rainer。

已读实时需求及 [UI#3195](https://github.com/gmx-io/gmx-interface/pull/3195) diff 文件列表、PR 描述、reviews 与 inline comments。PR OPEN，head `2495be234e5deb6d39171ef24e9499461b6cfd68`，当前 checks 成功但 CHANGES_REQUESTED。该 PR 承载 FESOL-89/96 reader/hook；与 Draft UI#3190 重叠，按 109 收敛已有成果。

早期描述中 development Alchemy key 不可用已被后续 review 更新：Divhead 11 月 5 日确认现有 key 启用且 preview balances 可用；11 月 6 日确认 47-address batched read、Token-2022 等余额。仍有 review 提出的 reader 边界、历史提交及范围整理问题；未逐条判定当前是否已修复，当前审查结论仍要求修改。不能把旧 key 故障当作当前事实，也不能以 CI 绿代替 review。

56 需复用该 raw balance/RPC 与 hook key 做发送确认后的刷新；本轮未运行页面/RPC。详见 [FESOL-56](FESOL-56.md)。

本轮已 merge #3195 至 56 开发分支并与最新 #3193 RPC 生命周期组合。新增发现：余额 hook 尚未被 Solana 统一 TokensData provider 消费，交易校验会把 undefined 当 0；这是跨 PR 集成缺口，不代表余额 decoder 本身错误。后续接入与 mutate 复用见 [FESOL-56](FESOL-56.md)。
