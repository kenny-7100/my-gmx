# DES-88 — Solana Earn 设计代码交接

2026-11-24，角色：只读调研，未认领实现。结合用户提供的 Chloe 聊天截图、Linear 正文/全部评论、GitHub PR 和源码核对。

- [需求](https://linear.app/gmx-io/issue/DES-88)：Pasha / In Progress。Pasha 在 Linear 发布的 PR/预览与 GitHub `user-web3` 作者相互对应，支持其为设计交付账户；GitHub 个人资料未填写姓名。
- 正式 [PR #3211](https://github.com/gmx-io/gmx-interface/pull/3211)：`des-88` → `release`，head `b2467ec7b17da959ec0f35f5e6bfcab2a5e6c677`，Open、非 Draft、REVIEW_REQUIRED，未合入。独立 [Tester #3216](https://github.com/gmx-io/gmx-interface/pull/3216) 明确不合并。
- 已有 Portfolio/Discover、资产与收益汇总、GT 面板、GM/GLV 卡片、FAQ、Tooltip 和移动端布局代码。Chloe 确认内容；Tano 11-20 确认调整并表示 good to go；Pasha 11-23 表示 ready for dev review。设计/体验确认不等于真实功能验收，GitHub 当前无正式 review 记录。
- `src/components/Earn/Solana/useSolanaEarnData.ts` 只读取钱包会话，`gt/lp` 为 undefined，`assets` 为空；`solanaEarnTypes.ts` 是页面需要的数据形状，不能当作已确认服务端契约。`SolanaAssetsList.tsx` 复用 `GmGlvAssetCard`，并未证明其 EVM 依赖和操作已适配 Solana。
- [TRD-115](TRD-115.md) 接续真实资产/LP 收益/GT/回购数据、已质押与未质押合并和收益连续性、池详情与 GT 导航、加载/失败/刷新及钱包隔离。GT 文档链接仍为占位。
- 三个 UI PR 均修改 MainRoutes/SideNav，合并需同时保留 Earn、GT Points、Referrals 的路由和菜单；不能以 Tester 分支的完整 diff 认定全为 Pasha 实现，其中含同步 release 的他人成果。

边界：核对源码和远端状态，未运行页面、构建、测试或真实交易；未核实所有目标数据源的当前就绪情况。按用户与 Chloe 对话，可先做前端 refining，正式实现承接 UI 交付；本记录不授权修改他人分支或合入 PR。
