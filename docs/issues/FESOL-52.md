# FESOL-52 — 统一数据层与 FESOL-56 集成审查

2026-11-13，角色：依赖组合及源码审查。已将 [UI#3193](https://github.com/gmx-io/gmx-interface/pull/3193) head `732b4a1322edc324f26ea404a296d3b65050b7ec` 合入 56 开发分支，保留 Solana tracker registry 与当前 EVM syncTracking 生命周期。

订单 composition 有意删除 Solana account metadata；既有 review 表示当时没有消费方，故不能归类为显示范围回归。FESOL-56 的 update/cancel 将成为新消费方，需扩展统一订单上下文。TokensData 尚未消费已完成 reader 的余额；fee discount 仍经 proDiscountFactor 写入，与新 gmsol 计算参数不一致。触发、定位、建议和组合验证统一见 [FESOL-56](FESOL-56.md#审查发现组合契约缺口区别于原-pr-独立范围内的回归)。未修改上游 PR、未发布评论。

## 共享 SDK Provider 更新消费（2026-11-13）

角色：下游集成实现。用户授权优先处理52及56/19/20/72关联消费者。已刷新52实时状态Test、Sulliven An及 #3193 head `258e4da6ab`；相对原集成仅一笔provider迁移。56先解决账户slot/freshness冲突并改交易确认调用，20再适配lazy执行通知，19消费同一补丁，72只更新development组合。未修改52作者的原PR，也未把其GitHub reported conflict自动视为已解除；消费方兼容完成不代表上游可独立合并。具体版本、验证与边界统一见[依赖审计](../solana-trading-dependencies.md#fesol-52-最新依赖接入2026-11-13)。
