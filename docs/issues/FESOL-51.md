# FESOL-51 — 余额与 RPC 前置调研

2026-11-13（Asia/Shanghai），角色：FESOL-56 依赖调研。[Linear](https://linear.app/gmx-io/issue/FESOL-51) 为 Review，Rainer。

已读实时需求及 [UI#3195](https://github.com/gmx-io/gmx-interface/pull/3195) diff 文件列表、PR 描述、reviews 与 inline comments。PR OPEN，head `2495be234e5deb6d39171ef24e9499461b6cfd68`，当前 checks 成功但 CHANGES_REQUESTED。该 PR 承载 FESOL-89/96 reader/hook；与 Draft UI#3190 重叠，按 109 收敛已有成果。

早期描述中 development Alchemy key 不可用已被后续 review 更新：Divhead 11 月 5 日确认现有 key 启用且 preview balances 可用；11 月 6 日确认 47-address batched read、Token-2022 等余额。仍有 review 提出的 reader 边界、历史提交及范围整理问题；未逐条判定当前是否已修复，当前审查结论仍要求修改。不能把旧 key 故障当作当前事实，也不能以 CI 绿代替 review。

56 需复用该 raw balance/RPC 与 hook key 做发送确认后的刷新；本轮未运行页面/RPC。详见 [FESOL-56](FESOL-56.md)。

本轮已 merge #3195 至 56 开发分支并与最新 #3193 RPC 生命周期组合。新增发现：余额 hook 尚未被 Solana 统一 TokensData provider 消费，交易校验会把 undefined 当 0；这是跨 PR 集成缺口，不代表余额 decoder 本身错误。后续接入与 mutate 复用见 [FESOL-56](FESOL-56.md)。
