# FESOL-85 — GT Buyback 独立 rent receiver

2026-11-16，参与角色：只读需求解释，未认领实现。通过 Linear MCP 读取正文、关系及完整评论（0 条），当前仍为 FESOL-85、Solana Frontend/Triage；正文 Owner 为 Orion，实际 assignee 字段未设置，不能将建议分配解释为已分配。

来源：[FESOL-85](https://linear.app/gmx-io/issue/FESOL-85)。GtExchange 的 owner 与记录的 rent receiver 可以不同：GT Bank payout 归 owner，账户租金归 rent receiver。现有 completion 对独立 receiver 的 exchange 会失败。

前端验收：独立 receiver 场景不把该租金及账户数计入 owner 的可领取租金统计，不提供会提交现有失败 completion instruction 的操作；receiver=owner 的 exchange 保留既有 Claim Rent 行为。正文没有要求实现新的可成功完成的 instruction 或独立 receiver 的完整领取入口，不能自行扩大范围。

实际关联需求：[SCSOL-29](https://linear.app/gmx-io/issue/SCSOL-29)，标题为 Anyone can complete a confirmed GT exchange, with rent returned to the rent receiver；本轮未深入核验该需求实现。FESOL-38、GMTrade 标签、项目和 Orion assignee 仅见于 triage 建议，不是已应用关系。该需求属于 GT Buyback 行为，不是 TRD-85 的 Solana 价格/深度图任务，不能按相同数字映射。未查询代码、PR、部署或实际验证，未修改 Linear。
