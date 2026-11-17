# FESOL-52 — 统一数据层与 FESOL-56 集成审查

## 前置增量核验（2026-11-17）

当前TRD-65；#3193已于11月16日16:41 CST合入，head仍e712a1d342，当前release实际保留Provider。四线已提前消费同head，转为交付diff收敛事项，不重复集成。 统一证据、版本及跟进建议见[五需求依赖核验](../solana-trading-dependencies.md#五需求前置增量核验2026-11-17)。

## Review经验深挖（2026-11-15）

角色：只读调查。复核#3193 `e712a1d342`的review完整线程、当前provider、account snapshot和mapper：availability与owner缓存隔离已有实现；order metadata仍在mapper前裁剪，应按交易消费者重新核对，不能把原显示阶段取舍永久化。未运行组合/页面，原编号Linear不可读，参考11月12日快照；87和110实时正文支持切片不豁免整体与遗留入口单独承接。历史建议演变、具体源码及待审方案见[深挖调查](../review-learning-investigation-2026-11-15.md)。

## Review收口核对（2026-11-15）

只读复核#3193 `e712a1d342`，GitHub为MERGEABLE、Review required，当前checks成功。读取全部reviewThreads（无后页），多数未resolved线程已有修复回复；源码确认gas三字段存在。历史钱包输入hash/auto-cancel意见归19处理，不因线程未关闭再次派给52。四需求已消费当前provider版本，无新代码需要重复同步；应确认独立范围review结论并关闭已处理线程。具体源码核验、下游边界与字段stack顺序见[上游跟进](../solana-trading-dependencies.md#上游跟进核对2026-11-15)。未发布评论或修改上游。

## 上游刷新与证据边界（2026-11-14）

本轮新增事实、契约适配、交付及验收结果见[四需求统一记录](../solana-trading-dependencies.md#四需求上游刷新2026-11-14)，优先于下方历史状态。Linear目标访问返回Entity not found，不能据历史正文或评论判定本轮实时状态；GitHub、源码及部署按统一记录分别核验。


2026-11-13，角色：依赖组合及源码审查。已将 [UI#3193](https://github.com/gmx-io/gmx-interface/pull/3193) head `732b4a1322edc324f26ea404a296d3b65050b7ec` 合入 56 开发分支，保留 Solana tracker registry 与当前 EVM syncTracking 生命周期。

订单 composition 有意删除 Solana account metadata；既有 review 表示当时没有消费方，故不能归类为显示范围回归。FESOL-56 的 update/cancel 将成为新消费方，需扩展统一订单上下文。TokensData 尚未消费已完成 reader 的余额；fee discount 仍经 proDiscountFactor 写入，与新 gmsol 计算参数不一致。触发、定位、建议和组合验证统一见 [FESOL-56](FESOL-56.md#审查发现组合契约缺口区别于原-pr-独立范围内的回归)。未修改上游 PR、未发布评论。

## 共享 SDK Provider 更新消费（2026-11-13）

角色：下游集成实现。用户授权优先处理52及56/19/20/72关联消费者。已刷新52实时状态Test、Sulliven An及 #3193 head `258e4da6ab`；相对原集成仅一笔provider迁移。56先解决账户slot/freshness冲突并改交易确认调用，20再适配lazy执行通知，19消费同一补丁，72只更新development组合。未修改52作者的原PR，也未把其GitHub reported conflict自动视为已解除；消费方兼容完成不代表上游可独立合并。具体版本、验证与边界统一见[依赖审计](../solana-trading-dependencies.md#fesol-52-最新依赖接入2026-11-13)。
