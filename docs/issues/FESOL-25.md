# FESOL-25 — 持仓与订单列表依赖调研

2026-11-15，角色：只读组合依赖分析，不认领实现或修改PR。[UI#3238](https://github.com/gmx-io/gmx-interface/pull/3238)当前head `07117e1691`、Open/Review required，对release被GitHub报告CONFLICTING。

本轮merge-tree确认：release `84ab9293a8`直接组合有7个源码文件冲突，但最新52 `e712a1d342`与该head可干净组合，tree `7dae1f8a48add674f22b3ec0fbd49b00d66125c6`。相对52仅5个业务源码文件与10个locale，主要是OrderTypeFilter、PositionItem、DisplaySettings、features与SettingsContext。可沿52基线定向核验这一小片，避免把重复52契约冲突当作25独立业务缺口。

这仅证明Git层干净组合，未运行types/tests/UI，不等于已验收或可立即合并；未改变PR base或维护作者分支。Linear关键需求不可访问，本轮不声称核实当前正文/assignee。详细比较与证据见[可推进切片](../solana-next-task-2026-11-15.md)。
