# FESOL-113 — fee discount / order 字段组合核验

2026-11-13，角色：FESOL-56 前置 API 契约组合审查。已将 [UI#3205](https://github.com/gmx-io/gmx-interface/pull/3205) `087a98fa375b5b82997ff9767b6e329511a31097` 和其 stacked [UI#3207](https://github.com/gmx-io/gmx-interface/pull/3207) `c711f6ebe735d10da7a98627209f445ad052d131` 合入 56 分支；两项仍 OPEN，不能将本地 merge 当作 release 已交付。

合并保留最新 API 严格 reader；两个旧 SDK 构造测试的 networkId 已适配当前 chainId，组合 948 项 SDK 测试通过。解析器保留字段不代表统一 UI 对象保留字段或计算已消费：orderAccount 等被 52 composition 裁剪，discount 映射尚未接通。具体证据与后续归属见 [FESOL-56](FESOL-56.md)。未修改 Linear 或发布 review。
