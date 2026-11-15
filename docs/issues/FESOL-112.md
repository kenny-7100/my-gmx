# FESOL-112 — 金融集成验收依赖

## 部署契约定向复核（2026-11-15）

角色：只读项目现状调研。本轮公开 markets/config 返回67市场，tradeMath字段存在数仍为0；API main `55327018c0` 的SDK为2.8.0、sdk-next为2.9.0，前端release已含数学#3242/SDK 2.9.2。不能将数学合并视为API启用或金融参考值通过。旧编号及历史稳定UUID查询均失败，未核实当前正文、关系、评论或状态；不推断需求已取消或迁移。证据、覆盖及后续入口见[现状核对](../solana-progress-2026-11-15.md)。

## 上游刷新与证据边界（2026-11-14）

本轮新增事实、契约适配、交付及验收结果见[四需求统一记录](../solana-trading-dependencies.md#四需求上游刷新2026-11-14)，优先于下方历史状态。Linear目标访问返回Entity not found，不能据历史正文或评论判定本轮实时状态；GitHub、源码及部署按统一记录分别核验。


## 交易链路依赖统一核验（2026-11-13 16:16）

本轮参与跨需求依赖分析，核对实际集成版本、PR堆叠和merge-tree预检。新增结论、责任边界与跟进顺序统一见[交易链路依赖审计](../solana-trading-dependencies.md)，不将预检当作实际合并或组合测试通过。

2026-11-13（Asia/Shanghai），角色：为 FESOL-56 区分开发前置与整体验收依赖。[Linear](https://linear.app/gmx-io/issue/FESOL-112) 实时为 Todo，正文/评论已核对，评论为空；GitHub gmx-api 按 FESOL-112 查询未发现专门 PR。

需求要求消费已评审发布的 FESOL-57 SDK、更新 API pin 并启用对应 market fields，在索引部署上验证金融参考值与 minContextSlot 交易后读。正文仍记 API pin 为 2.2.1；本轮未独立读取 API 最新源码/部署，不将此描述扩展为本轮实际部署证明。

这影响金融与前后端整合验收，不阻碍 56 先做纯 builder/validator。顺序和边界见 [FESOL-56](FESOL-56.md)。
