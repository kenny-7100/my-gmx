# GMTrade EUR 仓位长期 pending 调查

核验日期：2026-11-16。范围为 GMTrade 旧项目线上 v2.18.0；只读浏览器、公开部署脚本、Mainnet RPC、Keeper GraphQL 与源码，没有签名、取消、平仓、改业务代码或修改 Linear。

## 后续状态：已取消并退款

同日用户反馈页面不再转圈，重新核验确认：北京时间 **2026-11-16 14:43:38**，该钱包作为签名者成功执行 `CloseOrderV2`，[交易 2AABXarSw3Ds33Eshm3GKHSULSEBAnAVkZVgR4FMTttm79y2yT8st194nBng12JPpw5Us8DDdMQrmUMWNU4Crh55](https://solscan.io/tx/2AABXarSw3Ds33Eshm3GKHSULSEBAnAVkZVgR4FMTttm79y2yT8st194nBng12JPpw5Us8DDdMQrmUMWNU4Crh55)。交易前钱包 USDC 为 `7.817478`，交易后为 `1007.817478`，订单托管的 **1,000 USDC 已退回**。订单账户最新 `getAccountInfo` 返回 null（context slot 470077728）。只能确认钱包地址签名，不能由此识别实际操作人。

原生浏览器当前桌面 EUR 仓位不再显示 spinner，金额仍为 `$105,072.77`，Orders 从 5 降为 4，Phantom 显示 `1007.81748 USDC`。因此变化原因是关联加仓单已被取消、订单账户关闭，前端不再满足原先的 pending 禁用条件；不是该单成交，也不是原持仓已平仓。以下章节保留取消前的调查快照，均按当时观察理解。此次 Agent 仍只读，未代签或取消。

## 后续修复：PR #1095

用户指出 [Sulliven 的 PR #1095](https://github.com/gmsol-labs/gmx-solana-interface/pull/1095) 专门处理本问题。实时读取 diff、评论与检查信息：head `d50788e3ab4f4f78d7dcfcdbc0ee69276d73fc30`，北京时间 2026-11-16 14:09:59 合入 main，merge SHA `6e4661fa24c265c646267ee0f7ca9e671a3ab252`。PR 无正文、review 或评论，GitHub 未报告该分支 checks；不能据此声称经过运行验收或已部署正式站。

该 PR 明确将 `shouldDisablePosition` 保留为价格不可用的禁用条件，将关联 pending 市价单拆为 `hasPendingMarketOrder`；RPC 和 Marin 两条 buildEntry 均更新。PositionItem 的表格/卡片统一显示 spinner、锁定其他操作，但 Close 仅由价格不可用条件禁用，pending 本身不再阻断 Close。移除遍历中回写 `shouldDisablePosition=priceUnavailable` 的 else 分支，也避免另一笔关联限价单清除此前市价单造成的锁定。价格不可用保护被保留。

这提供了“pending 时仍允许对已有仓位发起 Close”的明确前端设计依据；它修复的是退出入口与响应式布局一致性，不处理 Keeper 调度、过期收尾，也不自动取消旧加仓单或保证平仓成交。应验证正常/pending/价格不可用/pending+价格不可用在两种布局的行为，及 pending 加仓与平仓先后执行的实际结果。本轮只读评估代码，未运行这些用例。

后续 CR（同一 head）：发现一项 P2 交互缺口。`PositionItem.tsx` 仅以 `pointer-events-none` 禁用 H5 TP/SL、Edit Collateral 和价格不可用时的 Close，没有传 `disabled` 或在 handler 校验状态；桌面 Close 也仅在父单元格应用 CSS。该 head 的 Common/Button 是原生 button，只有传入 `disabled` 才阻断 handler。Tab 聚焦后 Enter/Space 仍可触发这些灰色按钮打开对应弹窗，因此 CSS 不能实现宣称的统一禁用语义。H5 新增禁用逻辑引入此缺口，桌面部分已有类似写法；修复应给按钮传真实 disabled，保留 pending-only 时 Close 可用，其他非按钮入口按需要加 guard。此为代码与标准浏览器事件语义判断，未在用户页面执行键盘复现，也不声称已绕过交易最终校验。重复平仓单及旧加仓单与平仓的执行先后仍是验证项，不凭本次 diff 认定额外 P1 缺陷。

用户随后要求暂停页面修改：此前为查看旧效果，Agent 仅向一个现有 GMTrade 标签注入临时 CSS（`codex-eur-pending-preview`），模拟旧桌面置灰和 spinner；控制台确认目标行与 style 存在，但屏幕截图出现空白，未完成视觉验收。该模拟不修改业务状态，刷新即移除；用户要求停止后未再操作页面。不能用这段旧样式验收 #1095，因为它会额外禁用 Close，与 PR 目标相反。

## 已确认结论

钱包 `25atW95AGV61h7oDwfW5HtFjUB4q2ctAP6s5z4NcUjbU` 的 EUR/USD $105,072.77 持仓本身已存在。导致桌面转圈与整行禁用的是另一笔关联此仓位、仍处于 Created 的市价加仓订单。不是按仓位金额设置的禁用门槛，也不是仅浏览器缓存：RPC 与 Keeper 均返回相同订单。

| 项目 | 核验事实 |
| --- | --- |
| 持仓 | [HKvbd78eyYa2L9o87R4odVHoeWp7nwTWHE367iTAtNXL](https://solscan.io/account/HKvbd78eyYa2L9o87R4odVHoeWp7nwTWHE367iTAtNXL) |
| 市价加仓订单 | [2wWZrK2JZhDCSAkHt5w89XHTUDgZrnm53Z3LDmea9sm5](https://solscan.io/account/2wWZrK2JZhDCSAkHt5w89XHTUDgZrnm53Z3LDmea9sm5)，ID 387082 |
| 状态与类型 | `header.action_state=0`；Keeper `status=pending`；`params.kind=3 / market_increase`，long |
| 金额 | 加仓 $49,986.2404762405；初始抵押 1,000 USDC；不是 $105k 平仓单 |
| 创建/最近更新 | 北京时间 2026-11-14 05:59:59，slot 469085592 |
| 创建交易 | [397GoXZJPHPua8SSL6FfiStVCL2Sc99YVuZs1dpRii8PHEYWWnzqTYQWKcsmsDfYZdQj78c37piPU9H7ebhtqtd8](https://solscan.io/tx/397GoXZJPHPua8SSL6FfiStVCL2Sc99YVuZs1dpRii8PHEYWWnzqTYQWKcsmsDfYZdQj78c37piPU9H7ebhtqtd8)，成功执行 `CreateOrderV2` |
| 后续交易观察 | `getSignaturesForAddress(order, limit=30)` 仅返回创建交易；没有查到后续链上执行或取消。不能排除 Keeper 未广播的模拟/调度失败 |
| 托管账户 | `9qtFcEjS6ywB8TkABNCDPyAsC4aXWxRfbNTxfk1CGCHL`，RPC token balance 确认仍为 1,000 USDC |
| Store | `CTDLvGGXnoxvqLyTpGzdGLg9pD6JexKxKXSV8tqqo8bN`；实时解码 `amount.request_expiration=1800` 秒；当前配置不能证明创建时的历史配置 |

RPC Mainnet genesis 已核实为 `5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d`，持仓首次查询 context slot 469973307。解码使用旧前端 IDL，关键字段与 Keeper 返回、浏览器 Orders 列表交叉一致；没有把本地旧 IDL 当作完整最新布局保证。

## 前端因果链与大小屏差异

实际浏览器保留用户已有 Phantom 监视钱包，通过原生 Chrome 窗口读取。桌面 EUR 行置灰且转圈；Orders 标签第一行确实显示 `Market Increase +$49,986.24`，提供 `Close order`。不是订单列表隐藏该单。

下载当前线上 `/assets/index-BnHj6_AS.js`，SHA-256 `a3caab4f901845b3ec59d9dd7b38a5d280684a1be1e5a47c52eed0f74001667f`，直接核实以下逻辑；同时对照官方发布分支 `origin/chore/v2.18.0`，SHA `6c075ce3`。不能仅凭版本号声称发布脚本与该 Git commit 逐字一致。

1. `getPendingOrdersForPosition` 只接收 `actionState===0` 且 `positionAddress` 精确匹配的订单。
2. `useOnChainPositions.buildEntry` 遍历关联订单。市价单不属于 `isMarketOrderShowType` 的限价/TP/SL 集合，因此设置 `shouldDisablePosition=true`。这里无 pending 时长上限或自动解除逻辑。价格不可用也是同一标志的另一来源，但本例已有独立、确定的市价单触发路径。
3. `PositionItem.renderLarge` 为整行添加 `pointer-events-none opacity-50`，并在标题旁显示 `ImSpinner2`。因此 Close、编辑抵押品等操作随整行一起禁用。
4. `renderCard` 未应用相同的 `shouldDisablePosition` 整卡禁用和 spinner；断点为 `max-width:1024px`。所以截图中的“大尺寸/小尺寸”对应桌面表格与小屏卡片差异，不表示另一笔小金额持仓正常。
5. 两种布局的仓位内 `positionOrders` 都用 `isMarketOrderShowType` 过滤，只显示限价/TP/SL；这笔市价单可让仓位 pending，却不显示在仓位内 Orders 明细。独立 Orders 标签会展示它，当前页面观察总计五单。

源文件（均为旧前端）：

- [getPendingOrdersForPosition.ts](https://github.com/gmsol-labs/gmx-solana-interface/blob/6c075ce3/app/src/utils/order/getPendingOrdersForPosition.ts)
- [useOnChainPositions.ts](https://github.com/gmsol-labs/gmx-solana-interface/blob/6c075ce3/app/src/hooks/fetchHooks/useOnChainPositions.ts)
- [PositionItem.tsx](https://github.com/gmsol-labs/gmx-solana-interface/blob/6c075ce3/app/src/components/ExchangeNew/ExchangeList/PositionList/PositionItem.tsx)
- [isOrderType.ts](https://github.com/gmsol-labs/gmx-solana-interface/blob/6c075ce3/app/src/utils/order/isOrderType.ts)
- [useTriggerCancelOrder.ts](https://github.com/gmsol-labs/gmx-solana-interface/blob/6c075ce3/app/src/hooks/triggerHooks/useTriggerCancelOrder.ts)

## 生命周期边界与尚缺的证据

公开 Keeper `user(owner,store){orders{...}}` 也认识这笔 pending 单，因此不能归因于“Keeper 查询层完全没索引到”。这不证明执行 worker 已调度或模拟过它。公开 query schema 未提供该订单的执行错误、模拟日志或重试原因。

协议参考核实官方 main SHA `d81a3e69e404c2eb6f7aca2cd05134c5f2570b2c` 的 [ops/order.rs](https://github.com/gmsol-labs/gmx-solana/blob/d81a3e69e404c2eb6f7aca2cd05134c5f2570b2c/programs/store/src/ops/order.rs)：市价单 oracle 时间上界取 `updated_at + store.request_expiration`；执行路径对超时有处理。但墙钟过去不会自动改变链上账户，仍须交易推进生命周期。本次未核实链上程序二进制与该源 SHA 对应，不能以参考源码宣布当前订单可成功执行、取消或平仓。

当前配置若用于该单，上界为北京时间 11 月 14 日 06:29:59；本次 Keeper EUR 报价时间为 11 月 16 日 11:04:48，超出该窗口。不能建议等待价格回到 acceptable price 就一定成交。订单 acceptablePrice 按 EUR 9 位精度为 $1.10233522250；是否最初因滑点、oracle、市场时段、费用或执行队列失败，均尚无日志证明。当前市场 `isEnabled=true`、返回价格 `isOpen=true`，不能反推创建时开市状态或持续健康。

## 处理入口

- 用户持有实际签名钱包时，可先在 **Orders → EUR/USD / Market Increase +$49,986.24 → Close order** 处理这笔未完成加仓单。此按钮走 `invokeCancelOrder`，并非平掉现有 $105k 仓位；当前监视钱包不能代签。实际取消需用户自行签名，成功与抵押退款须交易回执及余额复核。本次未点击或尝试取消。
- 若取消成功、订单刷新后消失，按已核实逻辑将移除本例的禁用触发条件；仍须重新核对价格状态和仓位 Close 是否恢复，再决定是否平仓，不能承诺平仓一定成交。
- Keeper 负责人按订单地址、ID 387082、创建 slot 469085592 和时间窗口查 discovery/enqueue、simulation、send、expiry cleanup 日志，回答为何没有终态交易。浏览器端无法替代该证据。
- 前端修复建议为统一表格/卡片的状态展示，明确“待处理加仓单”及订单入口；超时提示与可执行操作应结合协议规则设计，不能仅删 spinner、按时间假装完成或放开全部并发交易。当前仅调查，未实施修复。

原始只读响应和线上脚本留在本机忽略目录 `.local/acceptance/gmtrade-eur-pending-20261116/`；它们是本次快照，不代表后续状态。公共服务定位见 [GMTrade 服务表](gmtrade-live-services.md)。
