# FESOL-113 — fee discount / order 字段组合核验

## 正式替代实施（2026-11-17）

在原交易线接续最新 #3205/#3207，统一共享字段 readers 并删除重复 helper；保留交易消费者 orderInfo.solana、base58/strict callback/escrow 与 unsigned bigint 契约。 验证和推送收尾状态以[统一实施记录](../solana-trading-dependencies.md#trd-136-正式替代实施2026-11-17)为准。

## 正式替代核查（2026-11-17 晚间）

已只读核对最新上游head与TRD136集成的实际差异。钱包API补丁运行依赖已退役；release已吸收部分能力；余额/字段新PR已无冲突但有语义差异，不整文件覆盖。具体head、替换条件、残留入口及RPC核验缺口见[正式替代审计](../solana-trading-dependencies.md#trd-136-临时方案正式替代核查2026-11-17-晚间)。

## 五需求晚间前置核验（2026-11-17）

两条原字段PR均仍冲突；旧候选不能当最新release交付，需原栈收敛且保留消费者metadata与fee/referral契约。 角色为只读依赖调研，来源与验证边界见[统一核验](../solana-trading-dependencies.md#五需求晚间前置核验2026-11-17)。

## 前置增量核验（2026-11-17）

字段#3205已改base release但仍CONFLICTING，#3207仍stacked并冲突；共享Provider已合后可跟进原PR字段范围收口，保留交易消费者metadata与fee契约。 统一证据、版本及跟进建议见[五需求依赖核验](../solana-trading-dependencies.md#五需求前置增量核验2026-11-17)。


## 最新 52 上的两层冲突候选（2026-11-15）

用户选择下一步列表第一项后，实际完成两层隔离候选，角色为前置字段 PR 的冲突解决与契约核验。原 PR/上游分支只读，未创建重复 PR、修改 Linear 或联系后端。

| 层 | 来源与基线 | 保存成果 |
| --- | --- | --- |
| fee/referral #3205 | 原 head `087a98fa375b5b82997ff9767b6e329511a31097`，合入最新 52 `e712a1d342e994d85f77e52a748e081e48f559f3` | `fesol-113-fee-on-52-20261115`，`f270bc0fc1fb2d3449fcff291631cc8babaf6461`；工作区 `/Volumes/kenny/gmx/gmx-interface-fesol-113-fee` |
| order metadata #3207 | 原 head `c711f6ebe735d10da7a98627209f445ad052d131`，合入上述已解决的 fee 层 | `fesol-113-orders-on-52-20261115`，`e87c309b0074e3fc3321e2ff7c7fa9337b3c1aaa`；工作区 `/Volumes/kenny/gmx/gmx-interface-fesol-113-orders` |

保留原 PR 历史，用普通 merge 保存冲突解决，未改写上游历史。第一层相对固定 52 仅 3 个文件（SDK Solana tests、referrals api/types），第二层相对新 fee 层仅 7 个文件；原 #3207 的 referrals/types 已被当前基线吸收，因此无需再次改变该文件。两层均不包含个人基础设施或 56/19 的业务成果。

冲突按语义处理：

- fee 层保留 52 的 `readApiString/readApiUnsignedBigInt` 与 `isRecord`，提取局部 unsigned integer reader 同时校验 tierId/gtRank；四个新增字段保持必需、BigInt 无精度损失、base58 大小写保持、referrer null 转 undefined。
- order 层保留 52 的 `chainId`、`SolanaReadOptions` 新位置与 response-slot 行为；合入原 PR 的严格 metadata reader、callback/escrowTokens 及 position.relatedOrders 解析，EVM 无 metadata 记录保持原解析结果。
- `composeGmsolOrdersInfo` 只移除已由 SDK 类型提供的重复字段声明；最新 52 已移除旧 uiFeeFactor，所以不恢复。它仍不输出交易 UI 的 `order.solana`，这属于 56 消费端的已有改动，不能把字段候选当作完整交易 UI。
- 与 56 `d6e1b7ba05d8c75edf20a9f4b183c086300962e0` 对照：validation、orders parser、positions parser 完全一致；referral parser 只以共享 `isRecord` 代替等价内联判断；订单类型刻意不带 56 新增的 `Order.solana` 消费属性。

验证证据在主工作区 `.local/acceptance/fesol113-stack-20261115/`：

- fee 层 SDK Solana/validation/chainPins 3 suites 共 9 项通过（`sdk-offline/run-9g7YVy/report.json`）；另 1 项实际 API #340 fee 响应回放通过（`sdk-offline/run-eiGgsP/report.json`）。
- order 层上述 SDK suites 加响应回放共 12 项通过（`sdk-offline/run-odf1hf/report.json`）；前端 composeGmsolTradeData/refetchAtSlot 2 suites 共 11 项通过（`frontend-offline/run-sZVZo7/report.json`），均无网络访问尝试。
- 回放复用 API #340 `59e49c649d6dd5a331af5ef793f0292f47898907` 固定源码、真实 PostgreSQL/index/Express 已采集的 HTTP 响应：2 份 fee、16 份 orders、32 份 positions；包含 14 个顶层订单和 1 个嵌套订单，逐项检查 metadata、nullable 值、金额与 slot。未重复启动数据库或把历史 fixture 当作线上现状。
- 两套候选各自的 SDK 完整构建、SDK types、app/landing types、变更文件 ESLint/Prettier 均通过。
- scratch 已归档并从两套 SDK src 清理。第二层首次 install 的 SDK postinstall 被本轮临时回放文件的 JSON 类型断言阻断；清除 scratch 后 immutable install/完整 SDK 构建成功，未修改业务来绕过检查。

交付边界：候选依赖尚未合并的 52；两条候选分支已推送到 `my-gmx`，不代表 #3205/#3207 已更新或 release 可独立合并。原栈应按 52 → fee → orders 的顺序收敛；字段层落入基线后再核对是否需要 retarget orders。最新实时 Linear 查询仍因权限/查询兼容错误失败，不补写未知负责人或状态。未做钱包签名、交易广播、keeper 或线上部署验收。

## Stacked交付跟进（2026-11-15）

只读核对#3205 `087a98fa37`仍以FESOL-52为base，#3207 `c711f6ebe7`仍以fee-discount分支为base且Draft；两项GitHub均报告CONFLICTING/DIRTY。HEAD与既有组合相同，不需要因重复查询再次同步消费者。需明确52后字段PR合并/重定向顺序，原负责人处理冲突并复验；四需求已有的feeDiscountFactor与order metadata消费边界不能因去重丢失。本轮未实施冲突处理，细节见[上游跟进](../solana-trading-dependencies.md#上游跟进核对2026-11-15)。

## 交易链路依赖统一核验（2026-11-13 16:16）

本轮参与跨需求依赖分析，核对实际集成版本、PR堆叠和merge-tree预检。新增结论、责任边界与跟进顺序统一见[交易链路依赖审计](../solana-trading-dependencies.md)，不将预检当作实际合并或组合测试通过。

2026-11-13，角色：FESOL-56 前置 API 契约组合审查。已将 [UI#3205](https://github.com/gmx-io/gmx-interface/pull/3205) `087a98fa375b5b82997ff9767b6e329511a31097` 和其 stacked [UI#3207](https://github.com/gmx-io/gmx-interface/pull/3207) `c711f6ebe735d10da7a98627209f445ad052d131` 合入 56 分支；两项仍 OPEN，不能将本地 merge 当作 release 已交付。

合并保留最新 API 严格 reader；两个旧 SDK 构造测试的 networkId 已适配当前 chainId，组合 948 项 SDK 测试通过。解析器保留字段不代表统一 UI 对象保留字段或计算已消费：orderAccount 等被 52 composition 裁剪，discount 映射尚未接通。具体证据与后续归属见 [FESOL-56](FESOL-56.md)。未修改 Linear 或发布 review。

## Kenny 消费者集成（2026-11-20）

参与角色：候选集成与组合验证，未接管原需求、修改原作者PR或代作验收。fee/order候选31bb690ebe已集成进Kenny五需求链；#3207合入该PR分支，不能称已进release。 证据与边界见[本轮接续](../solana-trading-dependencies.md#五需求上游接续实施2026-11-20)。
