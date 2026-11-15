# FESOL-92 — SDK 单位转换依赖核验

## 冲突已精确定位（2026-11-15）

本轮对release `84ab9293a8`与#3243 `5e081e5ab1`执行merge-tree，仅sdk/src/utils/gmsol/index.ts一处add/add：一侧为57数学实现，一侧为units导出。56当前文件已有双方保留的组合，可复用解决方式；不需RPC/API/LUT，也不重复写conversion。尚未修改92开发线、运行其最终检查或推送，不能称PR冲突已解除。与其他候选比较见[可推进切片](../solana-next-task-2026-11-15.md)。

## 上游合并状态（2026-11-15）

只读核对#3243仍为原head `5e081e5ab1`、Open/Review required，GitHub现报告对release CONFLICTING/DIRTY。此前集成在56等组合中的math/units双导出不证明原PR可合并；应由原开发线处理与最新release的冲突并复验，保留转换语义和两套导出。本轮读取diff，未创建merge result或定位全部冲突，未重跑测试。依赖顺序见[上游跟进](../solana-trading-dependencies.md#上游跟进核对2026-11-15)。

2026-11-13（Asia/Shanghai），角色：FESOL-56 前置调研。
[Linear](https://linear.app/gmx-io/issue/FESOL-92) 为 Review，Sulliven；[UI#3243](https://github.com/gmx-io/gmx-interface/pull/3243) OPEN、非 Draft，head `5e081e5ab140ba41d8f816c317b8361bf5a8787c`，当前 checks 全成功，REVIEW_REQUIRED，无已提交 review。

已核对实时正文/关系/评论、PR diff 与检查。纯 bigint conversion 在 sdk/src/utils/gmsol/units.ts，区分 USD 1e30/1e20、whole-token/unit price 和 native u64 数量，PR 声明 28 个 targeted tests 通过；本轮组合 SDK 全量 948 项通过，包含 units 测试。该任务明确不依赖完整 FESOL-57、钱包、RPC 或 API 部署，而是 56 要先合并的独立 SDK slice，不应重复实现。

与 3242 同时新增 gmsol/index.ts，实际整合需保留两套导出并验证；详见 [FESOL-56](FESOL-56.md)。

已合入 56 开发分支并保留 math/units 双方导出。maxUint256 无限价哨兵转换会按预期超过 u128（已复现）；这是 56 builder 需适配的语义边界，非应移除 92 范围检查的理由。详见 [FESOL-56](FESOL-56.md)。
