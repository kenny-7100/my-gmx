# DES-89 — GT Points 与 Stake 设计代码交接

2026-11-24，角色：只读调研。读取 Linear 正文/全部评论、GitHub PR 和正式/Tester 源码，与用户提供的 Chloe 聊天核对。

- [需求](https://linear.app/gmx-io/issue/DES-89)：Pasha / In Progress。正式 [PR #3220](https://github.com/gmx-io/gmx-interface/pull/3220)：`des-89` → `release`，head `19e9b8cfeed77497bb3b5472522283a1859c4474`，Open、非 Draft、REVIEW_REQUIRED，无正式 GitHub review，未合入。
- 用户找到的 `gt-points-tester` 是 [PR #3221](https://github.com/gmx-io/gmx-interface/pull/3221)，base 为 `des-89`，head `c82ed39d3bb4acaa3cbc307b181775f3f8ec96b1`，明确 Do not merge。增加可切换示例状态的面板/fixtures，并替换 Hook 返回值用于设计评审；Live 仍无业务数据。不能把示例结果当链上操作成功。
- 已有 My/Global/Buyback/Stake 页面，VIP 展示、历史筛选、图表、排行、额度、回购预估和倒计时、租金账户选择、质押选择/校验、单笔/批量领取或解押确认弹窗、移动端与 Skeleton。Chloe 11-17 确认页面内容，Tano 11-20 确认体验调整，最后 info box 建议于 11-23 落代码。
- `src/components/GtPoints/useGtPointsData.ts` 只接钱包会话，my/global/buyback/stake 全部 undefined。SellGtModal、StakeModal、StakeReviewModal、AccountRentCard 的确认处理只显示 toast/关闭弹窗，无真实交易接入。
- `gtPointsTypes.ts` 已列出字段、排序、单位和加载约定；属于 UI 数据需求，不能当作已可用 API。GT 7 位、GM/GLV 18 位等声明仍需真实来源适配核验；最低质押额和推荐优惠当前是常量，而产品评论明确参考实现从链上读取这两项。0.01 GT 最低卖出额是前端规则。
- [TRD-113](TRD-113.md) 承接真实 GT/VIP/历史/排行/回购/质押数据和交易执行、确认与刷新、失败及钱包切换隔离、链上参数和单位验证；还需覆盖需求保留的交易页 GT 奖励，不能仅完成此页面。
- Earn/Referrals/Pools 的跨页入口要在组合目标核验；三套独立 UI 分支不证明已经组合可用。

边界：未运行页面或测试，未钱包签名/广播；未调查所有真实数据源，不据此认定后端没有能力或全部被阻塞。共同交付约定及身份依据见 [DES-88](DES-88.md)。
