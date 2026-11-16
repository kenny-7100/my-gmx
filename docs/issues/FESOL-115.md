# FESOL-115 — GM/GLV 历史费用与 Stake 价格

2026-11-16，参与角色：只读 review。关联 [Linear](https://linear.app/gmx-io/issue/FESOL-115)、[旧前端 PR #1096](https://github.com/gmsol-labs/gmx-solana-interface/pull/1096)。本次 MCP 仍返回 FESOL-115、Solana Frontend、GMTrade 标签；没有推算 TRD 映射。

## 需求与审查版本

验收要求：GM/GLV Buy/Sell 展示费用，Stake 展示操作时价格。Issue 当前 Review，无评论、无阻塞关系。Rainer 的 PR head 为 `5f344e5cca5e6288b6225dcdcade3d95be4f5b18`，父提交 `00f66ca0062c18e3562110c3c03a476b95c1cf70`，2026-11-16 16:59:11 CST 合并，merge `16070dae45653cabe0243be24c2a3ba9d3f1b73b`。

改动只有两个文件：YourHistoryList 恢复桌面/H5 FEES 列；useGmGlvHistoryData 删除提现 PDA 聚合查询，改为钱包 owner_eq 单次 GraphQL 查询。费用和价格字段本来已查询，formatter 本来已存在；本 PR 依赖索引器提供正确数据。

## 结论与证据

- P2 展示问题：新启用的桌面第 293 行/H5 第 443 行调用 formatHistoryFee；第 84 行把 null/undefined 变为 `$0.00`，与真实 `"0"` 混同。实际接口存在 `fee:null` 的 Sell，例如 `gm_glvdeposit_000454554481-2fFPG-001068-000006_sell`，owner `HVbhYzFJYrndyWp5opnGRfEfyPmoiMxQtb5TNXLM1yvj`。这种 GM 直接进入 GLV 的记录没有该腿费用值，不能据 null 声称实际收取非零费用；应明确缺值/不适用的展示规则，null 用 `-`，真实零才显示 `$0.00`。formatter 为历史代码，但之前费用列注释，本次启用使问题呈现给用户。
- 不将 owner_in→owner_eq 报成丢 Sell 的回归：生产接口 withdrawalRemoveds 最新 owner `B2C9JjKGMuYdet62CQgD5DJLvBNCyH7FQtPRK2F1X5xk`、PDA `ExAo37qPygaRrNTXM4LsfMUsjMLpZNpjheEVyjY2JvS`，对应 Sell 的 owner 是钱包；GLV 最新提现同样为钱包 owner。远端 gmtrade-sqd HEAD `4b4f8d8a12ae420ad39051e5c112a2a9615f0827` 的 processor 使用 request.owner 创建 Sell。仅证明当前契约和样本，不宣称全量迁移数据已审计。
- 当前接口确有 GM Buy 非零费用 `90969151000000000000`，按 20 位 USD 精度显示约 `-$0.91`；GM Sell 非零样本 `43581935525405000000`。GLV Buy/Sell 非零费用共 4035 条、真实零值 15746 条、null 0 条。不能把近期样本 fee=0 直接判断为费用缺失。
- 最近 GM Stake price `117362333211`、GLV Stake `122580725640`，按 11 位精度分别约 1.17362、1.22581；已有 PRICE 消费路径能够展示。历史 Stake 共 7854 条，672 条 price=null，最近缺值样本在 2026-02-11。这是存量数据/验收覆盖边界，不是本 PR 新引入；若验收要求覆盖所有历史，仍需索引侧确认回补范围。

## 验证边界与后续

读取精确 PR head、父提交、关联 issue/评论及索引器远端源码，通过前端固定的生产 GraphQL endpoint 发起只读查询。没有修改业务代码、浏览器、Linear 或发布 GitHub 评论；没有运行构建或钱包交易。源码不能证明生产索引器运行的精确 SHA，实际响应作为部署契约证据。未做全量链上费用对账、H5/桌面视觉验收及历史 owner 完整性审计。

可复用经验见 [RL-02](../review-lessons.md#rl-02-数据含义与完整性)：启用此前隐藏的消费者时，需要重新审查已有 formatter 对 null/zero 的含义；删除旧兼容查询需核实当前生产数据契约，不只依赖旧注释。
