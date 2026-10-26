# Solana gmx-api 进度与联调协调

整理日期：2026-10-26。以下为待发送给 Divhead 的沟通草稿，尚未发送；进度描述基于本次核验，预计日期及待确认事项需由负责人回复。

---

Divhead，想和你对齐一下 Solana gmx-api 的当前进度及联调时间，方便我们安排后续前端开发。

目前看到 FESOL-62 的服务骨架和 stub endpoints 已完成，FESOL-63 有 [PR #295](https://github.com/gmx-io/gmx-api/pull/295)，但公开 main 中 markets、positions、orders 和 fee-discount 仍返回样例。`solana.gmxapi.io` 的 `/v1/pairs` 可用，markets 接口仍是 404。如果已有其他分支或部署提供真实数据，请帮忙更新一下。

我们希望先选一个 crypto 市场和测试钱包，走通完整流程：**读取真实市场及钱包状态 → 计算订单预览 → 构建、模拟、签名并发送订单 → keeper 执行 → 刷新持仓和订单 → 平仓，以及限价单创建、修改和取消。**

关于这条链路，想请你确认：

1. **联调入口：** 当前可用的 api-solana URL、部署版本，以及各接口分别是 stub 还是真实数据；如果有正在开发的分支或 PR，也请提供一下。
2. **接口契约：** [FESOL-61](https://linear.app/gmx-io/issue/FESOL-61) 的契约和样例什么时候可以确认供前端接入？包括金额/价格精度、市场最小值、清算参数、费用折扣，以及改撤单所需字段。
3. **真实数据：** [FESOL-63](https://linear.app/gmx-io/issue/FESOL-63)/[64](https://linear.app/gmx-io/issue/FESOL-64) 的真实市场配置和值，以及 [FESOL-65](https://linear.app/gmx-io/issue/FESOL-65) 的真实持仓、订单和钱包折扣数据，分别什么时候可以联调、完成必要的链上数值对照？
4. **剩余依赖：** 是否仍在等待 [FESOL-57](https://linear.app/gmx-io/issue/FESOL-57) 的计算基准或 [FESOL-71](https://linear.app/gmx-io/issue/FESOL-71) 的测试资源？另外，execution fee 的依据、ALT、真实 `solanaTrading` 开关和执行 keeper 等条件，还有哪些需要协调，分别由谁负责？

最好能分别给出 **“契约和样例可接入”“首个市场可做真实下单联调”“完整交易闭环所需数据就绪”** 三个节点的预计日期。如果暂时无法确定，也请说明具体阻塞和需要我们配合的事项。第一轮可以先集中验证一个市场和钱包，不要求覆盖全部市场。

另外，为了在后端数据尚未全部就绪时继续推进前端，我们整理了 [FESOL-87](https://linear.app/gmx-io/issue/FESOL-87)，目前保留五个独立切片：

- [FESOL-89](https://linear.app/gmx-io/issue/FESOL-89)：通过 RPC 读取显式 owner 的原生 SOL 和已配置 token ATA 原始余额。
- [FESOL-90](https://linear.app/gmx-io/issue/FESOL-90)：按网络隔离交易缓存和持久化偏好，避免 EVM/Solana 状态串用。
- [FESOL-91](https://linear.app/gmx-io/issue/FESOL-91)：基于已有静态配置提供网络感知 token 查询，正确保留 mint 大小写、精度及显示倍率。
- [FESOL-92](https://linear.app/gmx-io/issue/FESOL-92)：实现应用与 gmsol SDK 订单输入之间的纯单位转换，明确精度、舍入和测试向量。
- [FESOL-96](https://linear.app/gmx-io/issue/FESOL-96)：在 89 之上提供懒加载余额 hook，处理网络/钱包缓存隔离、刷新和错误状态。

我们的判断是前四项不依赖未完成的后端能力，96 只依赖同组的 89，目前倾向先做 91。也想请你结合后端规划看一下：**这些拆分是否与目标契约一致、现在推进是否有实际意义，是否遗漏依赖、与已有工作重复或存在明显返工风险，以及你建议优先推进哪项。**

所有切片都会复用 GMX 现有架构和统一数据流，原始需求中的页面集成及真实交易验收仍会保留。
