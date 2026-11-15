# FESOL-50 — Oracle 与 UI flags review 经验调查

2026-11-15，角色：只读调研，非实施负责人。[PR #3138](https://github.com/gmx-io/gmx-interface/pull/3138)已合并批准，head `4f3e53e839`。读取review、普通讨论及thread：NEAR样本区分mint和oracle精度；读取flags与真正挂载banner是同一问题的两段；Divhead修正共享keeper hook建议并撤回过早批准，原因涉及跨网络tracker及kill switch的新鲜度、host和timeout。

不能把早期建议固化成长期规则，不能因作者修了fetch就认定入口到展示闭合。原Linear不可读，使用11月12日快照；未重新运行keeper/browser。本轮来源和方案见[深挖调查](../review-learning-investigation-2026-11-15.md)。
