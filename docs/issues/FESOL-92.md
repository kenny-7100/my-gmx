# FESOL-92 — SDK 单位转换依赖核验

## 正式替代核查（2026-11-17 晚间）

已只读核对最新上游head与TRD136集成的实际差异。钱包API补丁运行依赖已退役；release已吸收部分能力；余额/字段新PR已无冲突但有语义差异，不整文件覆盖。具体head、替换条件、残留入口及RPC核验缺口见[正式替代审计](../solana-trading-dependencies.md#trd-136-临时方案正式替代核查2026-11-17-晚间)。

## 五需求晚间前置核验（2026-11-17）

TRD-100旧#3243已关闭并由#3287替代，新PR有冲突待review；units与测试两文件新旧blob一致，无需重新实现。 角色为只读依赖调研，来源与验证边界见[统一核验](../solana-trading-dependencies.md#五需求晚间前置核验2026-11-17)。

## 上游跟进实施（2026-11-17）

TRD-100 / #3243 `50118fee998` 已不再冲突；与既有units相比仅复用等值 `GMSOL_PRECISION_SCALE`/`GMSOL_MAX_UNSIGNED`。在TRD-72原development以 `7fda907550` 精确接续，并选择性转入三条交易消费者delivery、其余development及136；保留release数学与units双方导出。原units/math两suite41项通过；未修改Sulliven原分支或请求review。旧resolution候选不再是当前必需步骤。 统一来源、交付版本、验证和外部剩余项见[五需求跟进实施](../solana-trading-dependencies.md#五需求跟进实施2026-11-17)。

## 前置增量核验（2026-11-17）

当前TRD-100；#3243更新为50118fee998，现MERGEABLE、Review required、checks成功。历史原PR冲突已不再是当前阻碍；与136已有units差异仅复用等值常量，不能重复实现转换。 统一证据、版本及跟进建议见[五需求依赖核验](../solana-trading-dependencies.md#五需求前置增量核验2026-11-17)。

## release 冲突解决候选已验证（2026-11-15）

用户授权按顺序实施。原 #3243 位于上游 `gmx-io/gmx-interface:FESOL-92`，遵守 origin 只读，没有直接推送原作者分支或新建重复 PR。在隔离目录 `/Volumes/kenny/gmx/gmx-interface-fesol-92-resolution` 从原 head `5e081e5ab1` 合入当前 release `84ab9293a8`，只在 `sdk/src/utils/gmsol/index.ts` 出现预期 add/add。保留 release 全部数学函数及原 PR units 导出，解决文件与 56 已使用的组合逐字一致，未改 conversion 或舍入/范围校验语义。

解决候选 commit `c35a5f04da`，分支 `fesol-92-release-resolution-20261115` 已推送个人 [my-gmx](https://github.com/kenny-7100/my-gmx/tree/fesol-92-release-resolution-20261115)。相对 release 仅原 units、原 28 项转换测试与 index 的 units 导出（3 文件）；merge-tree 验证对 release 干净，tree `4985552fbc4ff672418a515349b37f8133e13f22`。原作者可在自己的开发线应用该组合；本轮没有改变上游 PR head，因此不能宣称 GitHub 原 PR 已解除冲突。

实际候选目录完成 immutable install/SDK 构建、app/landing types、改动 SDK 文件 ESLint（零 warning）/Prettier；原 gmsolUnits 与 release gmsolTradeMath 两套定向测试合计 41 项全通过。证据位于个人基础 `.local/acceptance/upstream-followup-20261115/fesol92-{install.log,types.log,sdk-report.json}`；未进行真实 API/钱包/链上验收。该切片不需要 RPC/API/LUT，也不改变原作者 PR 的 Review/Ready 状态。

## 冲突已精确定位（2026-11-15）

本轮对release `84ab9293a8`与#3243 `5e081e5ab1`执行merge-tree，仅sdk/src/utils/gmsol/index.ts一处add/add：一侧为57数学实现，一侧为units导出。56当前文件已有双方保留的组合，可复用解决方式；不需RPC/API/LUT，也不重复写conversion。尚未修改92开发线、运行其最终检查或推送，不能称PR冲突已解除。与其他候选比较见[可推进切片](../solana-next-task-2026-11-15.md)。

## 上游合并状态（2026-11-15）

只读核对#3243仍为原head `5e081e5ab1`、Open/Review required，GitHub现报告对release CONFLICTING/DIRTY。此前集成在56等组合中的math/units双导出不证明原PR可合并；应由原开发线处理与最新release的冲突并复验，保留转换语义和两套导出。本轮读取diff，未创建merge result或定位全部冲突，未重跑测试。依赖顺序见[上游跟进](../solana-trading-dependencies.md#上游跟进核对2026-11-15)。

2026-11-13（Asia/Shanghai），角色：FESOL-56 前置调研。
[Linear](https://linear.app/gmx-io/issue/FESOL-92) 为 Review，Sulliven；[UI#3243](https://github.com/gmx-io/gmx-interface/pull/3243) OPEN、非 Draft，head `5e081e5ab140ba41d8f816c317b8361bf5a8787c`，当前 checks 全成功，REVIEW_REQUIRED，无已提交 review。

已核对实时正文/关系/评论、PR diff 与检查。纯 bigint conversion 在 sdk/src/utils/gmsol/units.ts，区分 USD 1e30/1e20、whole-token/unit price 和 native u64 数量，PR 声明 28 个 targeted tests 通过；本轮组合 SDK 全量 948 项通过，包含 units 测试。该任务明确不依赖完整 FESOL-57、钱包、RPC 或 API 部署，而是 56 要先合并的独立 SDK slice，不应重复实现。

与 3242 同时新增 gmsol/index.ts，实际整合需保留两套导出并验证；详见 [FESOL-56](FESOL-56.md)。

已合入 56 开发分支并保留 math/units 双方导出。maxUint256 无限价哨兵转换会按预期超过 u128（已复现）；这是 56 builder 需适配的语义边界，非应移除 92 范围检查的理由。详见 [FESOL-56](FESOL-56.md)。
