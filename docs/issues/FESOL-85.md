# FESOL-85 — GT Buyback 独立 rent receiver

## 当前入口：TRD-157（2026-11-17）

用户明确授权关闭旧项并原样转移到 TRD。已通过 Linear skill 在 Trading 团队创建 [TRD-157](https://linear.app/gmx-io/issue/TRD-157)，随后将 FESOL-85 标为 Duplicate，duplicateOf 指向 TRD-157。回读核验新项标题、完整正文与原项逐字相等，状态 Triage，保留 GMTrade / Needs Response 标签、无优先级、未分配负责人、无 project；SCSOL-29 与 PROT-23 两条实际关联已在新项保留。Linear 的 Duplicate 操作将旧项关联合并至新项。旧项无评论、附件或文档，无需搬运；新项创建者和时间为本次操作信息。未实施或验收业务能力。

以下保留迁移前调研记录，后续从 TRD-157 接续，不与 TRD-85 混淆。

2026-11-16，参与角色：只读需求解释，未认领实现。通过 Linear MCP 读取正文、关系及完整评论（0 条），当前仍为 FESOL-85、Solana Frontend/Triage；正文 Owner 为 Orion，实际 assignee 字段未设置，不能将建议分配解释为已分配。

来源：[FESOL-85](https://linear.app/gmx-io/issue/FESOL-85)。GtExchange 的 owner 与记录的 rent receiver 可以不同：GT Bank payout 归 owner，账户租金归 rent receiver。现有 completion 对独立 receiver 的 exchange 会失败。

前端验收：独立 receiver 场景不把该租金及账户数计入 owner 的可领取租金统计，不提供会提交现有失败 completion instruction 的操作；receiver=owner 的 exchange 保留既有 Claim Rent 行为。正文没有要求实现新的可成功完成的 instruction 或独立 receiver 的完整领取入口，不能自行扩大范围。

实际关联需求：[SCSOL-29](https://linear.app/gmx-io/issue/SCSOL-29)，标题为 Anyone can complete a confirmed GT exchange, with rent returned to the rent receiver；本轮未深入核验该需求实现。FESOL-38、GMTrade 标签、项目和 Orion assignee 仅见于 triage 建议，不是已应用关系。该需求属于 GT Buyback 行为，不是 TRD-85 的 Solana 价格/深度图任务，不能按相同数字映射。未查询代码、PR、部署或实际验证，未修改 Linear。
