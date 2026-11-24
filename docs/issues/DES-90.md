# DES-90 — Solana Referrals 设计代码交接

2026-11-24，角色：只读调研，读取 Linear 正文/全部评论、GitHub PR 和源码。

- [需求](https://linear.app/gmx-io/issue/DES-90)：Pasha / In Progress。正式 [PR #3226](https://github.com/gmx-io/gmx-interface/pull/3226)：`des-90` → `release`，head `02715736ea12dccb5892843e247d462113c2f1dd`，Open、非 Draft、REVIEW_REQUIRED，无正式 GitHub review，未合入。[Tester #3227](https://github.com/gmx-io/gmx-interface/pull/3227) 明确不合并。
- 已有绑定/创建向导、已绑定优惠页、Affiliate Dashboard、GT holders 弹窗、推荐码格式校验、复制分享、图表/时间筛选/排序、移动端布局。Chloe 11-17 确认内容，Tano 11-20 表示其余 good to go，最后句号调整 11-23 完成。
- `src/components/Referrals/Solana/useSolanaReferralsData.ts` 返回钱包会话和空业务值；applyCode/createCode 均抛出 Solana referrals are not connected yet。`solanaReferralsTypes.ts` 明确尚无错误状态，接入时必须区分请求失败与没有推荐码；列表/图表的完整历史量要求也要核对数据源。
- 新链接保留 `chainId=solana`，并隔离保存 Solana 推荐码；PR 说明该缓存尚无消费者。旧 GMTrade 链接的迁移归属仍需业务实现验证。Share on X 仅带链接，图片分享服务尚未保持 Solana 网络；Read more 仍指向 EVM 文档。
- [TRD-114](TRD-114.md) 接续真实推荐关系、历史优惠/奖励/用户/排行榜、码存在或占用检查、创建/绑定交易、操作后刷新、失败与钱包/网络隔离，以及新旧推荐链接归属。历史优惠用交易当时 VIP 与推荐优惠，不能直接相加百分比或套当前 VIP。
- 11-24 Chloe/Pasha 已决定推广 banner 从 Read more 改跳交易优惠/创建码页面的建议另建 EVM+Solana 共用 issue，DES-90 本轮保持现状；不把它当成这条交付的未完成设计项。

边界：源码与评论核对，未跑页面/测试/真实交易；共同交付约定及身份依据见 [DES-88](DES-88.md)。
