Divhead，想和你对齐一下 Solana gmx-api 的当前进度及联调时间，方便我们安排后续前端开发。

目前看到 FESOL-62 的服务骨架和 stub endpoints 已完成，FESOL-63 有 [PR #295](https://github.com/gmx-io/gmx-api/pull/295)，但公开 main 中 markets、positions、orders 和 fee-discount 仍返回样例。`solana.gmxapi.io` 的 `/v1/pairs` 可用，markets 接口仍是 404。如果已有其他分支或部署提供真实数据，请帮忙更新一下。

我们希望先选一个 crypto 市场和测试钱包，走通完整流程：**读取真实市场及钱包状态 → 计算订单预览 → 构建、模拟、签名并发送订单 → keeper 执行 → 刷新持仓和订单 → 平仓，以及限价单创建、修改和取消。**

关于这条链路，想请你确认：

1. **联调入口：** 当前可用的 api-solana URL、部署版本，以及各接口分别是 stub 还是真实数据；如果有正在开发的分支或 PR，也请提供一下。
2. **接口契约：** [FESOL-61](https://linear.app/gmx-io/issue/FESOL-61) 的契约和样例什么时候可以确认供前端接入？包括金额/价格精度、市场最小值、清算参数、费用折扣，以及改撤单所需字段。
3. **真实数据：** [FESOL-63](https://linear.app/gmx-io/issue/FESOL-63)/[64](https://linear.app/gmx-io/issue/FESOL-64) 的真实市场配置和值，以及 [FESOL-65](https://linear.app/gmx-io/issue/FESOL-65) 的真实持仓、订单和钱包折扣数据，分别什么时候可以联调、完成必要的链上数值对照？

另外，为了在后端数据尚未全部就绪时继续推进前端，我们整理了 [FESOL-87](https://linear.app/gmx-io/issue/FESOL-87)，目前保留五个独立切片：

- [FESOL-89](https://linear.app/gmx-io/issue/FESOL-89)：通过 RPC 读取显式 owner 的原生 SOL 和已配置 token ATA 原始余额。
- [FESOL-90](https://linear.app/gmx-io/issue/FESOL-90)：按网络隔离交易缓存和持久化偏好，避免 EVM/Solana 状态串用。
- [FESOL-91](https://linear.app/gmx-io/issue/FESOL-91)：基于已有静态配置提供网络感知 token 查询，正确保留 mint 大小写、精度及显示倍率。
- [FESOL-92](https://linear.app/gmx-io/issue/FESOL-92)：实现应用与 gmsol SDK 订单输入之间的纯单位转换，明确精度、舍入和测试向量。
- [FESOL-96](https://linear.app/gmx-io/issue/FESOL-96)：在 89 之上提供懒加载余额 hook，处理网络/钱包缓存隔离、刷新和错误状态。

我们的判断是前四项不依赖未完成的后端能力，96 只依赖同组的 89，目前倾向先做 91。也想请你结合后端规划看一下：**这些拆分是否与目标契约一致、现在推进是否有实际意义。**
