# FESOL-92 — SDK 单位转换依赖核验

2026-11-13（Asia/Shanghai），角色：FESOL-56 前置调研。
[Linear](https://linear.app/gmx-io/issue/FESOL-92) 为 Review，Sulliven；[UI#3243](https://github.com/gmx-io/gmx-interface/pull/3243) OPEN、非 Draft，head `5e081e5ab140ba41d8f816c317b8361bf5a8787c`，当前 checks 全成功，REVIEW_REQUIRED，无已提交 review。

已核对实时正文/关系/评论、PR diff 与检查。纯 bigint conversion 在 sdk/src/utils/gmsol/units.ts，区分 USD 1e30/1e20、whole-token/unit price 和 native u64 数量，PR 声明 28 个 targeted tests 通过；本轮未重跑测试。该任务明确不依赖完整 FESOL-57、钱包、RPC 或 API 部署，而是 56 要先合并的独立 SDK slice，不应重复实现。

与 3242 同时新增 gmsol/index.ts，实际整合需保留两套导出并验证；详见 [FESOL-56](FESOL-56.md)。
