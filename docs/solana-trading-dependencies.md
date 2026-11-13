# Solana 交易链路依赖审计

核验：2026-11-13 16:16（Asia/Shanghai）。角色：只读依赖分析。范围为 FESOL-56/57/19/20/72 及直接影响它们的 PR、API rollout 和验收条件；不是全量迁移进度评估。五条实时 Linear/评论与 CI 沿用本轮 16:08 已核实结果，19 assignee 已于 16:12 改为 kenny；本次新增核对远端 release、十个 PR head/base/mergeability、112/113 实时正文及实际分支代码。未改业务、合并分支、创建/更新 PR、发评论或执行交易。

## 结论与依赖方向

release 仍为 `e4714280749c00a90468abdde3060aae619717e7`。五项已经有组合开发，但组合成功不等于其前置已进入 release。

- 57 是共享 TypeScript 金融数学，72 是链上交易 WASM；两种 SDK 不互相替代。57 评审/发布后由 112 更新 API SDK pin 并启用市场字段，19 才能使用线上 gmsol 预览/校验；19 的 buildTradeboxOrderAction 对 `tradeMath !== "gmsol"` 明确拒绝，映射提示为 Solana market calculations are unavailable。16:08 实测 67 市场均无该字段。112 实时 Todo、Divhead，无评论；gmx-api 按编号未发现专属 PR，不等于没有任何相关改动。
- 56 提供交易 builder、签名前检查、发送确认；92 提供 units，51/89/96 提供余额与 RPC，52/113 提供统一账户/市场/折扣数据及字段契约。19 是共享下单消费者；20 是订单结果跟踪消费者，签名确认不能当作成交。
- 72 的构建替换代码可以独立交付（#3259 仅 18 文件），其“新版真实落链复验”仍依赖 56 和 71。不能把 Linear 的 56 blocks 72 解释为 72 代码不能先合，也不能把 72 构建成功解释为 56 已完成钱包验收。原文要求完整验收后才算完成；若要提前合并构建切片，需要任务负责人/评审明确接受验收安排。
- 71 可信 LUT 阻碍生产签名落链；有限价格边界 increase+TP+SL 的 1255 bytes 超 1232 是独立限制，复制/冻结相同 LUT 内容不能自动解决。19 支付币兑换抵押品与 GT Rewards 是产品/适配范围缺口，不由合并前置自动补齐。

## 当前开发集成矩阵

| 依赖 | 当前上游 | 实际集成与判断 |
| --- | --- | --- |
| 92 / #3243 | OPEN，`5e081e5ab1`，REVIEW_REQUIRED | 56/20/19 包含；仍未进 release |
| 57 / #3242 | OPEN，`f16deff8a7`，REVIEW_REQUIRED | 56 merge；20/19 cherry-pick 最新数学；仍待 Rainer/评审完成材料与发布 |
| 51/89/96 / #3195 | OPEN，`2495be234e`，CHANGES_REQUESTED | 三分支均包含最新 head，但 review 未解决；不能凭已集成当作可合并 |
| 52 / #3193 | OPEN，`258e4da6ab`，CONFLICTING | 三分支仍集成 `732b4a1322`，缺共享 SDK provider 迁移；需要补同步 |
| 113 fee/order / #3205、#3207 | OPEN，`087a98fa37` / `c711f6ebe7`，均 CONFLICTING | 三分支包含最新 head；#3205 base=FESOL-52，#3207 base=fesol-113-fee-discount-fields（Draft），属于堆叠链，不能当独立 release PR 任意合并 |
| 15 / #3201 | OPEN，`056f8d689c`，CHANGES_REQUESTED、CONFLICTING | 19 已有相关功能修复的等价 cherry-pick，`git cherry` 标记对应修复为 `-`；不因 head 非祖先而重复集成。PR 整体仍有上游/交付冲突，需负责人处理 |
| 25 / #3238 | OPEN，`07117e1691`，REVIEW_REQUIRED、CONFLICTING | 19 的 `096c0cd353` 与当前功能提交在 src/sdk 的 stable patch-id 均为 `6ed6b787c7696da51a21cc46f16a5b5399ec9a18`，所查五个功能源文件树一致；不是该功能提交漏同步。整个 PR 携带的依赖不因此判为相同 |
| 72 / #3259 | OPEN/Draft，`0f36780317` | 19/20 已精确接入业务产物；56 原 PR 仍旧 pin；72 dev 已组合 56 测过新版，但不替代 56 目标版本自身验收 |

当前 19=`0d7b4b49a7`、20=`d677e174c1`；两者 transactions、solanaOrderTracking、useGmsolAccountData、sdk 和 vendor/gmsol-sdk 的 tree diff 为空。它们的 SHA 因 cherry-pick 不同，但这些关键源码相同。56 与 20 的 sender 等文件差异包含20新增的身份、即时提交回调和 tracking 契约，不能用整文件覆盖来“同步”。

## 已定位的集成风险

1. **52 更新与 56 安全修复重叠。** `732b4a1322..258e4da6ab` 只有一笔 use shared SDK provider for Solana，12 文件、120 additions/93 deletions，改 useGmxSdk(SOLANA_NETWORK_ID)、host cache key 与账户 hook，删除旧 gmsolApiSdk/getGmsolApiUrl。`git merge-tree --write-tree --name-only` 对 56 development 与该 head 的预检只报 useGmsolAccountData.ts 内容冲突。合并应保留新共享 provider、host/owner/request 隔离、required/accepted slot floor、freshness envelope、确认刷新失败后拒绝旧轮询和恢复行为；再转入20、19，保留其 sender 扩展。merge-tree 只创建对象，不更新任何分支/checkout，不能称为实际合并或测试通过。
2. **19→20 的代码依赖超出产品顺序。** 19 adapter 直接 import/use useSolanaOrderNotifications，`begin({ trackExecution: isMarket })` 会为 market 启动20成交跟踪。19正文明确先交付提交阶段、20后续增加成交阶段。因此当前19无法按“仅19改动”独立交付。建议保持19提交阶段可独立交付，把即时提交回调/订单身份作为最小共享契约；20提供成交tracking。若决定保留当前耦合，则明确20成为19的代码合并前置，review/PR正文说明，仍不把“提交成功”当“成交”。本轮仅提出交付建议，没有擅自修改行为或范围。
3. **56 Draft 混有前置。** #3258 正文明确包含92/57/51/52/113六个未合并PR；允许整体review，不代表可绕过其独立review直接合。对应前置落release后，按实际文件差异精确收敛同一PR，不整支需求合个人基础，不重写他人历史。当前 #3193/#3205/#3207 和 UI #3201/#3238 GitHub 均报冲突，不能只安排日期而不处理基线。
4. **92和57的真实交叉冲突。** 对两当前head的 merge-tree 预检在 sdk/src/utils/gmsol/index.ts 出现 add/add；需同时保留units与math exports，不能任取一边。现有56组合已解决，但两个原PR合release时仍需由合并负责人处理。
5. **72与56无文本冲突不等于组合通过。** 对当前两个delivery head的 merge-tree 预检成功生成树，无冲突路径。可规划统一新版WASM作为最终验收基线；56 development先消费72已发布成果、验证，再按72是否已落release精确更新56 delivery。不要把72开发分支携带的56全部前置整支合回56，也不以无文本冲突代替build/ABI/wallet验收。

## 跟进次序与责任

1. 我们的前端整合优先处理52最新provider迁移，唯一实现落56原development，再精确更新其delivery和20/19；对实际变化运行账户刷新/SWR、sender/notification组合及类型检查。不要在三个分支独立解同一冲突。
2. 与Rainer/SDK评审协调57参考generator/JSON版本化、review和SDK发布；与92负责人协调index导出冲突。我们无直接修改57实现/分支/PR的权限，本轮未发送外部消息。
3. 与Divhead协调71可信LUT（地址、authority/归属、内容覆盖证据）和112的发布pin、market fields、金融reference/minContextSlot验收。两项可以并行跟进，不能只等71而忽略112。113的stacked PR按52→3205→3207由负责人同步基线/解除冲突。3195需负责人处理CHANGES_REQUESTED，当前评论仍含empty System-owned ATA、RpcDebug与历史清理事项；完整解决状态需原作者/reviewer确认，不由我们改其分支。
4. 我们确定19/20提交阶段与成交阶段的交付边界，避免下游反向阻塞入口。15/25相关功能已有等价接入，主要跟进其review/冲突与release落地，无需重复搬功能提交。
5. 代码合并顺序以92/57与数据基础前置优先、52→113堆叠随后、56适配器、19入口、20成交增强为建议拓扑；15/25在19前收敛。72构建PR可以并行review，具体落release时机须按其未完成验收明确协调，不机械排到所有UI之后。
6. 获得可信LUT、API数学可用并统一新版WASM后，在最终19整合目标做一轮贯穿验收：预览/余额→签名前校验→提交确认→20按真实事件判结果→slot-aware账户刷新；覆盖limit/edit/cancel、atomic及四钱包，明确记录每项由哪个版本证明。只在实际依赖变化时重验受影响项，不重复已稳定的SDK重建/历史测试。

## 证据入口

[56 PR](https://github.com/gmx-io/gmx-interface/pull/3258)、[57 PR](https://github.com/gmx-io/gmx-interface/pull/3242)、[72 PR](https://github.com/gmx-io/gmx-interface/pull/3259)；[52 PR](https://github.com/gmx-io/gmx-interface/pull/3193)、[51 PR](https://github.com/gmx-io/gmx-interface/pull/3195)、[92 PR](https://github.com/gmx-io/gmx-interface/pull/3243)、[fee fields](https://github.com/gmx-io/gmx-interface/pull/3205)、[order fields](https://github.com/gmx-io/gmx-interface/pull/3207)、[15 PR](https://github.com/gmx-io/gmx-interface/pull/3201)、[25 PR](https://github.com/gmx-io/gmx-interface/pull/3238)。历史验证范围见各[issue记录](issues/README.md)，本审计不重跑业务测试、不重新证明部署或签名落链。
