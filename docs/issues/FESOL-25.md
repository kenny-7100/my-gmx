# FESOL-25 — 持仓与订单列表依赖调研

## 前置增量核验（2026-11-17）

当前TRD-80；#3238原head07117e1691未变但现MERGEABLE、Review required、checks成功，值得推进review，不能把依赖或完整验收一并视为完成。 统一证据、版本及跟进建议见[五需求依赖核验](../solana-trading-dependencies.md#五需求前置增量核验2026-11-17)。

## 固定 52 基线的独立切片已验证（2026-11-15）

用户授权按推荐顺序实施。本轮在 `/Volumes/kenny/gmx/gmx-interface-fesol-25-verification` 从 52/#3193 `e712a1d342e994d85f77e52a748e081e48f559f3` 实际合入 25/#3238 `07117e1691a034af91720664ed595e4a152b4283`，无冲突。组合 commit `909a09d47064a830d53bfc1046ff031b34ac6998`，tree 与前轮 merge-tree 的 `7dae1f8a48add674f22b3ec0fbd49b00d66125c6` 完全一致，相对 52 仅 5 个业务源码与 10 个 locale，没有改写原作者实现。组合保存到个人分支 `fesol-25-on-52-verification-20261115`，未修改上游 PR head/base 或创建重复 PR。

实际组合目录完成 immutable install、SDK 构建、app/landing types、5 个源码文件 ESLint（零 warning）/Prettier、locale compile 和自身 diff 检查。原 ordersFilters suite 5 项通过；调用真实 OrderTypeFilter/TableOptionsFilter、SettingsContextProvider 与 DisplaySettings 的两项临时 React 回归通过，仅 mock 网络选择和钱包来源：EVM→Solana→EVM 正确隐藏/恢复 Stop Market 与 TWAP，保留限价兑换筛选且点击可选择；Solana 屏蔽净价格影响拆分的生效值及设置入口，同时保留 EVM localStorage 的 true 偏好，切回 EVM 恢复。PositionItem 的 funding/price-impact/lifetime-fee 展示分支完成源码审查，未冒充该组件的完整动态或浏览器视觉验收。

未发现需另改独立业务切片的问题。52 仍是该组合的前置，不能把本轮结果说成 25 可直接对 release 合并；上游 PR 对 release 的冲突和后续正式交付整理仍需在依赖更新时处理。没有钱包签名、交易广播、真实链上账户或已连接钱包 UI 验收。

证据位于个人基础 `.local/acceptance/upstream-followup-20261115/fesol25-{install.log,locales.log,types.log,frontend-report.json}`；两项临时 React 验证最终报告 `.local/acceptance/frontend-offline/run-rXLXP0/report.json`，原 ordersFilters 的 5 项通过见 `run-aKhFrc`（该次组合早期 scratch 文本匹配失败，不能称整个 run 通过）。临时 scratch 已归档到同一忽略目录并从 src 清理；当前组合工作区干净。


2026-11-15，角色：只读组合依赖分析，不认领实现或修改PR。[UI#3238](https://github.com/gmx-io/gmx-interface/pull/3238)当前head `07117e1691`、Open/Review required，对release被GitHub报告CONFLICTING。

本轮merge-tree确认：release `84ab9293a8`直接组合有7个源码文件冲突，但最新52 `e712a1d342`与该head可干净组合，tree `7dae1f8a48add674f22b3ec0fbd49b00d66125c6`。相对52仅5个业务源码文件与10个locale，主要是OrderTypeFilter、PositionItem、DisplaySettings、features与SettingsContext。可沿52基线定向核验这一小片，避免把重复52契约冲突当作25独立业务缺口。

这仅证明Git层干净组合，未运行types/tests/UI，不等于已验收或可立即合并；未改变PR base或维护作者分支。Linear关键需求不可访问，本轮不声称核实当前正文/assignee。详细比较与证据见[可推进切片](../solana-next-task-2026-11-15.md)。
