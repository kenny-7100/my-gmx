# Solana 订单事件版本与生命周期契约

2026-10-28，T21.b1/b2：已固定源码可复现的事件布局、CPI envelope 和离线归约规则，并捕获两笔历史Mainnet订单的四份真实回执。新增共享 [event-contract.json](../tools/solana-builder-probe/event-contract.json) 及 [生成器](../scripts/solana-event-contract.mjs)。新增[历史事件fixture](../tools/solana-builder-probe/order-event-fixtures.json)，保留完整回执与独立解码期望；T28.a已有未接线的纯TS decoder，尚无生命周期reducer及完整主网版本兼容验收。T21仍核实中，历史样本仅证明限定布局兼容。

## 版本及需求核对

实时读取 [FESOL-94](https://linear.app/gmx-io/issue/FESOL-94/parse-solana-order-removal-events-and-execution-states) 的正文、评论、双向关系，抓取 `2026-10-27T23:01:56.347Z`，仍Backlog/归属迁移项目、无GMTrade标签。准入门槛要求固定布局/discriminator/CPI与样本来源，仅做显式metadata/inner instructions/loaded addresses的纯解码和离线归约，不带RPC扫描、重试、钱包或toast。

本轮只读核对 [协议PR #492](https://github.com/gmsol-labs/gmx-solana/pull/492)：仍OPEN、未合并，head `15ab63420a531a2921d7e7a95217b55ac5e8d432`。本地没有该对象，通过GitHub contents按精确head读取 `crates/sdk/src/client/order_completion.rs` 和 `client/mod.rs`，未fetch或修改参考仓库。该PR重建Rust订单生命周期，不提供前端TS decoder，且明确不排除失败交易。不能直接采用其scanner、32笔上限或1/2/4秒重试作为前端产品约定。

前端release仍 `d4b8c32147dd604d8d062d76c00a75ec4f0bbb7a`；相关查询未见事件parser重复交付，仅返回既有#3120能力隔离PR。FESOL-94及父FESOL-20不因此完成或重新准入。

## 固定布局与生成方式

在主仓库根目录运行，离线、不写链、不执行WASM或Rust构建：

```sh
node --import tsx scripts/solana-event-contract.mjs
```

使用与[指令契约](solana-instruction-contract.md)相同的固定IDL commit `c6778dc9bf6444f9037c3b0d2dc219c857e1b45d`、SHA256 `9bc76f2081a1f45334208618aa1b5c1a944e6f1c885c5afb696978210ba81a94`；不拿本地HEAD的后续decoder或旧自动生成仓库IDL代替。JSON保留四种事件、15个递归依赖类型、字段次序、Borsh payload偏移/长度范围、固定源码摘要和生成器身份。范围仅用于描述布局，不能用“长度落在min/max之间”代替完整解码。

| 事件 | discriminator hex | payload bytes，不含16字节envelope | 关联字段与局限 |
| --- | --- | --- | --- |
| OrderCreated | e001e53ffe3cbe9f | 73或105 | ts/store/order/Option position；没有action id，只能作生命周期边界 |
| OrderUpdated | ac8cd2f16c757a91 | 270/302/334 | is_create/id/ts/slot/store/order/market_token/owner/params；id是action id；两处Option pubkey影响长度 |
| OrderRemoved | 549b798ef0eb9017 | 158 + UTF-8 reason字节数 | id/ts/slot/store/order/kind/market_token/owner/state/reason；state枚举Pending=0、Completed=1、Cancelled=2 |
| TradeEvent | bddb7fd34ee661ee | 固定1232 | trade_id/store/order/market/position等；**没有action id，trade_id不等于action id** |

TradeEvent完整CPI data长1248 bytes，这不是用户签名交易的1232字节大小限制；不能把顶层交易大小上限套到运行时生成的CPI data。TradeEventRef沿用TradeEvent discriminator和相同序列化布局，固定Rust源码有二者字节相等测试，本轮未运行该Rust测试。payload中的padding按IDL作为字节保留，不擅自要求其全零。

OrderRemoved.reason是u32 LE字节长度加UTF-8，固定Rust源码的 `#[max_len(32)]` 是空间估计，构造器只调用to_string；本轮不把它误判为已证实的运行时32字节截断/拒绝。后续decoder按实际输入长度及明确资源上限读取，拒绝截断/非法UTF-8/尾随。布局采用Borsh紧凑编码，不按Rust内存对齐插入额外padding。

## CPI envelope 与元数据接纳规则

固定协议 `events/mod.rs` 发出 self-CPI，program=`Gmso1uvJnLbawvw7yezdfCDcPydwW2s2iqG3w6MDucLo`，只有一个账户：由seed `__event_authority` 对program派生的authority `8a4wJ2bMiH6XWDZ7biTnejkss8VG7GMwd9Mg6F5fDfHF`、bump255；该账户在CPI中readonly signer。不能要求其成为外层交易钱包signer，compiled inner instruction也不直接携带这个权限标志。

固定Anchor 0.31.1的 `EVENT_IX_TAG` 数值是 `0x1d9acb512ea545e4`，**发出的little-endian bytes是 `e445a52e51cb9a1d`**。不能把hash前八字节直接当最终data前缀。envelope顺序为8字节tag、8字节事件discriminator、完整Borsh payload；本轮已按Anchor源码独立对照字节序。

后续parser必须：

- 先检查显式 `meta.err === null`，再接纳任何事件；meta缺失、err字段缺失或inner instructions缺失均为证据不足。失败交易即使有完整事件字节也不得贡献成交、取消或关闭事实；本应用创建交易失败可标记submission failed，keeper失败不等于订单永久失败。
- 仅消费inner instructions，核对program索引、唯一authority账户及tag；logs、顶层伪事件、错误program/authority均不能作为证据。按显式static accounts + 全部loaded writable + 全部loaded readonly解析v0索引，越界、缺LUT解析数据或未知版本明确拒绝/保留unresolved。
- 完整解码固定版本，检查enum/bool/option/长度/UTF-8、完整消费。未知或旧版布局不得静默套用当前布局、补零或忽略缺少output_amounts；若影响被跟踪生命周期，归约保留unresolved。
- 保存network/program/store、签名、交易slot及明确交易顺序、outer/inner instruction位置；事件自报slot/ts不是独立顺序证据。同slot跨交易缺顺序且结果受影响时不能自行按signature排序。

T28.a已实现下述纯解码子集及定向恶意输入测试，生命周期归约与真实变体仍待验；固定源码/IDL一致不证明当前部署版本一致。

## 生命周期匹配与结果规则

目标是消费显式输入，进入已有GMX通知/刷新流程；不另建订单业务store、RPC历史扫描器或全钱包订阅。跟踪标识包含network/program/store/order/expected action id，并保留owner/market/position的可信上下文。OrderUpdated/Removed的id用于action匹配；TradeEvent必须通过已证明的生命周期区间关联，不能凭trade_id或仅凭order地址接纳。

保留PR#492确认的边界：执行和关闭可分笔；关闭后的新生命周期事件不属于本次动作；同一关闭重复出现不是新生命周期；另一个action id的更新、create或更早的另一关闭构成边界。旧create/update不一定发OrderUpdated，因此缺少它不证明没有订单。不能把RPC历史被裁剪或输入列表末尾视为已到生命周期起点。

| 输入证据 | 离线结果规则 |
| --- | --- |
| 用户提交中 / 创建交易确认 | 分别保留sending / submitted；确认不变executed |
| 创建交易meta.err非null | submission failed；不贡献其inner事件 |
| 同一生命周期唯一可信TradeEvent、完整关联成立 | 可记录executed事实，close尚未见时保留closure pending，不虚构OrderRemoved |
| 同一生命周期TradeEvent + 匹配action id的OrderRemoved | 保留executed及独立关闭状态，支持同笔或执行/关闭分笔 |
| Completed的持仓订单关闭、缺TradeEvent | unresolved/trade missing；不视为NoTrade或成交成功 |
| Cancelled关闭，action/owner/market等匹配且无冲突 | cancelled，保留真实reason；不把reason字符串单独当状态 |
| Completed的swap关闭且无TradeEvent | 可记录closed without position trade；不能据此宣称持仓成交，也不扩大首发swap支持范围 |
| Pending状态的OrderRemoved、cancel与trade冲突、多条不同trade或证据矛盾 | unresolved/冲突；不按到达先后覆盖 |
| 账户消失、无事件、无meta、未知版本或生命周期边界不足 | unresolved；无订单和已关闭也不能仅由“账户不存在”区分 |
| 不同program/store/order/action、复用地址的旧生命周期 | 不更新当前动作；冲突或边界不明保留unresolved |

去重优先使用签名+outer/inner位置；重复摄入不增加trade数量。不同位置/交易中的事件不能仅因order相同就去重；trade_id相同但内容不一致也不是重复。乱序输入先按可信链顺序建立区间，无顺序证明则等待补充证据；不能仅取“最后到达事件”。切网/换账户后的结果只匹配原scope，后续实际UI/刷新仍由共享流程隔离。

## 样本来源及剩余验收

PR#492的精确head包含以下历史真实订单测试线索；**Devnet仍仅为上游声明；下方Mainnet两单已在b2捕获，详见实际证据**：

| 网络 | 历史order | 上游场景 |
| --- | --- | --- |
| devnet | HNatsufQwy7xHc7CQsvMvGcVuHCUAwuEUr5tpEmJLHXh | trade slot513387144/trade_id151817，close slot513387156 |
| devnet | 8uSkNC8Qc793AqGUq5A2UmvF6C18crEYaqE2PvQxAyoQ | cancelled |
| mainnet | 7D5BgckJ8ZwRomaXyjMF14kJMDJTip4dJ5kpfcq4GoAt | 同笔trade/close，slot459743651/trade_id596988 |
| mainnet | Dz7adr2ATTh5bmBztcENT3bPhXN6T4moWzF5oPYZCwc7 | cancelled |

T21.b2已通过本机既有Mainnet CLI配置核对两条主网线索，保留genesis、signature/slot、meta.err、inner instructions、loaded addresses及原始回执摘要；当前program元数据亦已读取，但尚不能证明部署二进制与源码commit一致。没有启动代理、修改RPC配置、切换失败后的服务或购买历史数据。Devnet当前未纳入既有Mainnet验收工具，不为取得样本擅自开启或改配置。历史兼容样本不能替代本项目新交易的真实业务验收。

之后T28按固定布局实现strict TS decoder及纯离线归约：正向执行/取消、分笔执行关闭、无关闭trade、缺trade、未知/截断/尾随、失败meta、无关program/store/order/action、复用地址、重复/乱序/缺事件及同slot缺顺序均需覆盖。“没有真实样本”不能用模拟样本冒充真实验收，但不阻止在已固定契约下开发明确标识的攻击/结构测试。

本轮核验原始需求、PR、按head源码及Anchor常量保存在 `.local/acceptance/requirements/solana-implementation-t21b/`；共享JSON和本文保留足够复核身份。未更改产品UI、共享状态/存储、EVM/SDK、lazy/flag/bundle或服务配置；未执行Rust编译、模拟、钱包签名、交易广播或Linear写入。

## T21.b2 历史Mainnet回执实际核验（2026-10-28）

本机CLI4.3.2默认RPC为 `https://api.mainnet-beta.solana.com`，genesis已确认为 `5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d`。先用CLI读取两单各最多10条历史签名，再通过既有 `readTransactionEvidence` 显式指定同一URL读取四份finalized回执；不是代理失败后的静默回退，不新增生产RPC依赖。过程只读，没有读取私钥或请求钱包操作。

```sh
solana config get
solana address
solana genesis-hash
solana transaction-history 7D5BgckJ8ZwRomaXyjMF14kJMDJTip4dJ5kpfcq4GoAt --limit 10 --output json
solana transaction-history Dz7adr2ATTh5bmBztcENT3bPhXN6T4moWzF5oPYZCwc7 --limit 10 --commitment finalized --output json
solana program show Gmso1uvJnLbawvw7yezdfCDcPydwW2s2iqG3w6MDucLo --commitment finalized --output json
```

共享fixture保留每份完整原始receipt、signature/status/genesis/provider/观察时间/receiptSha256、读取工具摘要、固定IDL身份及expectedEvents；所有RPC整数保留十进制字符串，避免JSON浮点舍入。以下签名与完整loaded地址/inner指令可在共享fixture复核：

| 场景 | signature | slot | 已核对事件 |
| --- | --- | --- | --- |
| 成交单创建 | 2mELxgpT2XgxiZH1xGs2MLnF48jP8CrLruffBPCEUWUarrySQFE8R8fpoyK3Rm5xR2H5fgMJdmMsm1fsCWYVHRZ | 459743617 | OrderUpdated，is_create=true，action id766719 |
| 成交单执行及关闭 | BrKHiP77G6uy2gu4VaDNy62Qk7pJxdA2JBS2Qnip44J6SMUtfwUmjPKLj7rxqGANiM7bReBYXGvksvBC3kdRQDw | 459743651 | TradeEvent trade_id596988；OrderRemoved id766719/Completed/reason executed |
| 取消单创建 | 58NeCrcVMXxPQrGJt1vC4VhJYFT7PQJHe7M9USSA1wtNKxkyZxsNqTh7FMSYC1DQjH7eBbi35rvpaQGXNppWgiSH | 459741564 | OrderUpdated，is_create=true，action id6273 |
| 取消单关闭 | 2jMyxaNXQbZXr2zUoeJzyFn1V6bCWtbrYXczZHpMZjAbTxG41sZsXyGdXjsxpbvNNnYEevPgbJxd3dB73pZEiny6 | 459741602 | OrderRemoved id6273/Cancelled/reason executed，无TradeEvent |

四笔meta.err均null，version均v0。成交执行回执loaded writable/readonly为4/8，取消关闭为3/8，两个创建均0/0。两单均匹配配置store `CTDLvGGXnoxvqLyTpGzdGLg9pD6JexKxKXSV8tqqo8bN`，各单创建/关闭的owner与market亦一致。五个目标事件全部完整Borsh解码，消费到payload末尾；OrderUpdated350字节、TradeEvent1248、OrderRemoved182（含16字节envelope）。其他协议事件原样保留，不能将它们一概视为未知恶意事件或从fixture删除以制造纯净样本。

取消单reason同样为 **executed**，因此“字符串包含executed就是成交”的逻辑会产生真实误报。以枚举state与生命周期为准，不能将reason作为状态或改写它。trade_id596988与action id766719也直接证明二者不同。

当前programdata=`CSp2sB68THdrJP6N7Au4Y5u89VJ1E1ebaqZ2soHhQvav`，lastDeploySlot459556802，dataLen4376000，仍有升级authority。此部署slot早于四份历史回执；只作为当前RPC元数据观察，不是历史二进制hash/源码构建证明，也不解锁T25。完整元数据及观察时间在fixture内。

验收：既有回执reader三项测试通过；独立Python按固定IDL完整解码五事件并核对payload/hash/action/store/owner/market，Node/kit另从原始base58、静态+loaded索引还原核对program/authority/tag、order、u64 id/trade_id及state/reason，全部通过。离线复核network guard安装、blocked=0；实时RPC查询不计入离线检查。原始日志和只读响应在 `.local/acceptance/requirements/solana-implementation-t21b2/`。

当前没有OrderCreated、分笔execute/close、链上失败、复用地址等真实变体，也没有当前应用新交易/四钱包验收；这些仍待验。T28.a已使用固定契约及真实v0/LUT输入完成strict TS纯decoder子集，见下节；生命周期归约另行实施，不把缺失真实变体用结构测试冒充，也不引入RPC scanner。

## T28.a 纯TS严格解码器（2026-10-28）

工作区实现位于 [decodeOrderEvents.ts](../src/domain/gmsol/decodeOrderEvents.ts)，固定的最小事件布局位于 [orderEventLayout.json](../src/domain/gmsol/orderEventLayout.json)。布局从已审查event-contract提取，只保留IDL身份、envelope、四事件及15个类型、固定IDL中其他事件的discriminator；产品模块不导入tools、完整IDL、WASM或参考仓库。测试将布局逐项与共享契约比较，另核对非目标discriminator与固定IDL一致，防止资产漂移。

入口 `decodeOrderEvents({ network: "solana-mainnet", signature, slot, receipt })` 同步消费显式RPC compiled JSON metadata；slot为bigint，receipt的version接受legacy或0/0n，整数只接受bigint或安全integer number，**不自动解析字符串整数**。历史fixture因精确序列化使用十进制字符串，测试显式转换slot/version/index结构，未来RPC调用方应直接传kit解码出的精确整数，不能先经过有损JSON.parse。不会请求RPC或从日志/账户状态补造证据。network是调用方已核验的scope；本纯函数不联网核对genesis、交易finality或部署身份，这些仍由只读证据/追踪入口负责。

返回携带network/signature/slot和四类互斥状态：

- `decoded`：已完成支持事件的语法解码；events保留name、outer/inner位置及全部字段，u64/u128/i64/i128为bigint、Option None为null、显式零保留0n。空events不代表成交、取消或闭单。此状态**不证明**tracked order/store/action匹配或业务执行。
- `transaction-failed`：身份核对后meta.err非null，events为空，不读取事件字节；keeper失败不等于订单永久失败。
- `unavailable`：缺meta/err/inner，或v0缺loaded addresses，events为空。
- `invalid`：错误network/signature/slot/version、非法索引/重复inner group、伪authority/envelope、未知event discriminator、截断/尾随/非法enum/bool/option/UTF-8等；整笔events清空，不暴露错误前已解码的部分结果。

静态账户后按全部loaded writable、全部loaded readonly还原索引。仅接受固定program的self-CPI、唯一event authority和精确tag；顶层指令和log中的伪事件不读取。固定IDL已知的非目标事件只记录discriminator，不消费为订单事件；真正未知discriminator拒绝。枚举/padding/字符串严格沿用布局，不把reason executed解释为成交，也不把trade_id改名为action id。base58 instruction上限90000字符仅限制本地解码工作量，不是协议reason字段的长度规则。

该模块目前仅被定向测试导入，没有生产sender/toast/共享启动入口消费者。没有RPC、store、hook、缓存、持久化或生命周期归约；未来从既有Solana动态入口消费，保持共享GMX流程和flag边界。TS字段树只承载原始链单位，不能将20位金额直接写入共享30位USD状态。

验收：`yarn frontend:test-offline --suite src/domain/gmsol/decodeOrderEvents.spec.ts` 最终6项通过/0skip，完整对照四份真实回执的五事件全部字段，并验证失败/缺失metadata、截断/尾随、非法enum/bool/option/UTF-8/string长度、签名/slot/version/index、未知discriminator、假authority、日志/顶层伪事件、最大u128/负i128和legacy账户结构。legacy与恶意变体是明确构造的结构测试，**不是**新捕获真实交易。局部strict类型、ESLint零warning和3项导入规则测试通过；离线network安装1次、blocked=0、进程/临时目录清理通过。

T28父任务仍实施中。下一步T28.b纯离线生命周期归约必须匹配可信network/program/store/order/action，利用事件位置和可靠交易顺序，处理重复/乱序/复用地址、分笔执行关闭、缺证据、冲突及failed meta，不能由decoded直接发成交toast。OrderCreated真实样本、分笔/失败等真实变体、部署源码身份及新应用交易验收继续保留；本轮未跑EVM业务、全前端、根类型或bundle。


## T28.b 纯离线生命周期归约（2026-10-28）

`src/domain/gmsol/reduceOrderLifecycle.ts` 接收固定decoder的 `OrderEventsResult`、可信 `TrackedOrderAction`（network/program/store/order/actionId/owner/market/position/kind/creationSignature）、显式submission及 `historyComplete`。它不读取RPC、账户存在性、日志、缓存或应用状态，不负责历史完整性证明；调用方必须证明从指定创建交易到本次观察终点的区间完整，不能根据数组耗尽将该标记设为true。只接受已按固定program严格解码的输入；不将任意手工对象当作另一条可信数据源。

输出保留原action scope、独立submission/execution/closure及事件证据（signature + outer/inner位置、完整字段）。创建交易失败metadata将submission置为failed，keeper失败不贡献事件；缺创建或historyComplete=false保持unresolved。当前需要指定创建签名中的 `OrderUpdated(is_create=true, id=actionId)` 确立起点；只有旧OrderCreated而缺action id的历史保守地保持unresolved，不猜测关联。

跨交易按slot排序，同slot相关交易须有唯一、非负安全整数transactionIndex；它必须是区块内可信位置，不能用到达顺序或signature字典序生成。单交易按outer/inner位置排序。相同签名/位置重放去重，内容矛盾拒绝；不同位置的多trade、Pending removal、cancel+trade、owner/market/position/kind不符、同slot歧义、缺/非法回执均unresolved。未关闭前遇到另一create/action边界不接纳之后的trade；已关闭后新生命周期不改变旧结果。仅相同locator是重复，不能凭trade_id合并不同事件。

唯一可信trade可得executed/closure pending；匹配Completed removal后才closed；Completed持仓关闭缺trade仍unresolved。Cancelled且无trade得cancelled，reason原样保留；两个swap kind无trade的Completed仅为closed-without-position-trade，不代表支持swap产品。submission输入不因trade结果被混成成交状态；创建成功证据与failed submission矛盾时不输出执行成功。

本轮复用四份真实回执，成交/取消（reason同为executed）实际解码后归约；其余重复、乱序、缺事件、分笔execute/close、同slot、地址复用、失败及swap均为明确标识的结构变体，不能充当新增真实链上样本。最终 `yarn frontend:test-offline --suite src/domain/gmsol/reduceOrderLifecycle.spec.ts --suite src/domain/gmsol/decodeOrderEvents.spec.ts` 两文件11项/0skip通过；network blockedAttempts=0、cleanup passed。局部strict类型、两文件零warning lint、导入规则3项通过。原生结果 `.local/acceptance/frontend-offline/run-QyTZSf/vitest-results.json`；本轮实时需求及PR核验、类型配置/日志在 `.local/acceptance/requirements/solana-implementation-t28b/`。

当前无生产消费者、RPC scanner、GMTrade依赖、store/缓存/存储或EVM/SDK改动，不改变lazy/flag入口。未执行根类型、构建/bundle、EVM业务、真实钱包或本应用交易；T28为已实施待真实验收，T21真实变体/部署源码身份及T29 sender/通知接线仍待，不完成FESOL-20父需求。
