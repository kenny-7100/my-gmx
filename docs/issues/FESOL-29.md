# FESOL-29 — 图表 review 经验调查

2026-11-17，直接前置合并核验：TRD-85 blockedBy为TRD-65（原52，UI#3193）及TRD-86（原50，UI#3138），两PR均已合入release；#3223自身仍Open/CONFLICTING。结论仅指直接前置PR，不代表完整Depth、overlays、图表交易及线上验收都已就绪。共享核验及限制见[FESOL-15](FESOL-15.md#前置增量核验2026-11-17)。

2026-11-15，角色：只读调研，非实施负责人。[PR #3223](https://github.com/gmx-io/gmx-interface/pull/3223)Open，head `437fcf5714`。读取3个review threads及当前chart history源码：历史页应保留并增量轮询，不能每15秒重取全部历史；本地不能默认改金融曲线参数来改善视觉。当前DepthChart中未检出原1.7/development preview分支，history fetcher包含历史Map与range/latestId状态；这是静态结构观察，不是运行验证。

与15相同identity updater意见需追溯继承来源后去重；Done及outdated标记不替代行为验证。原Linear不可读，历史正文来自11月12日快照。详见[深挖调查](../review-learning-investigation-2026-11-15.md)。
