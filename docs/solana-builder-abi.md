# 固定 WASM unsigned builder ABI 核实

更新日期：2026-10-28。对应 T20.a/b1/b2/b3、FESOL-56/95；当前状态为**离线结构及已覆盖参数样本已验，完整 T20 尚未完成**。工具不接入生产订单路径，不执行 simulate、签名、广播或服务启动。

## 版本、输入与复现

复用[真实 SDK 初始化](solana-sdk-vectors.md)的 `loadPinnedSdk()`，先执行既有产物摘要检查，再实例化 npm `0.9.0-test.2` 的真实 WASM。WASM SHA-256 为 `775a7ddb532d6d49a1800a3d8eccca523960d685db8e1800fbd5eb519ed8dd68`，wrapper 为 `0d42e12dae1bdfbbe8a95b8042828956b0f150f055fe9689a366a39e2223c80d`。没有构建或升级 SDK。

实际 bytes 使用 `create_order_v2`、`update_order_v2`、`close_order_v2`。解码账户名和 discriminator 使用 [gmx-solana v0.9.0 的 IDL](https://github.com/gmsol-labs/gmx-solana/blob/c6778dc9bf6444f9037c3b0d2dc219c857e1b45d/crates/programs/idls/gmsol_store.json)，固定提交 `c6778dc9bf6444f9037c3b0d2dc219c857e1b45d`，IDL SHA-256 为 `9bc76f2081a1f45334208618aa1b5c1a944e6f1c885c5afb696978210ba81a94`。本地只读 `git show` 获取该文件，不读取可变工作区 IDL。独立 `gmx-solana-programs` 当前 HEAD 的旧 IDL 没有这些 v2，不能拿它接受或拒绝本产物。匹配实际 bytes **不证明此 tag 是 npm test.2 的可重现构建来源，也不证明当前链上程序兼容**。

[probe 源码](../scripts/solana-builder-probe.mjs)固定公开 payer（32 字节 0x07）和离线 blockhash（32 字节 0x09），没有私钥或真实 blockhash；复用现有 SOL/USD [USDC-USDC] market/program/store 配置，long、size=100×10^20、amount=10,000,000 原生 token units、acceptable price=200×10^11，单动作 trigger=150×10^11，组合 TP/SL trigger=250/100×10^11。数值只是明确结构输入，不表示可成交报价或有效账户状态。hints 显式传 long/short token；callback 为空，高层 create ABI 无 referrer 入参。

```sh
node --import tsx scripts/solana-builder-probe.mjs
node --import tsx scripts/solana-builder-probe.mjs --lut-report .local/acceptance/solana-alt/report.json
node --import tsx --test scripts/solana-builder-probe.test.mjs scripts/solana-sdk-vectors.test.mjs
```

第一条无 LUT，第二条可读取现有只读 LUT 捕获，不发 RPC。其他机器缺捕获时不要伪造当前报告；测试已复用[共享 unsigned 样本](../tools/solana-builder-probe/unsigned-fixtures.json)中的完整历史 LUT 内容，能离线复现结构行为。共享文件保留实际六组 bytes、每笔 hash/大小、指令数据、解析后账户、nonce 和输入/工具/IDL/产物来源；随机 nonce 使每次 bytes 不同，不能要求新输出逐字匹配旧交易。

## 实际分包矩阵

下面均为2026-10-27 UTC 22:33 的实际运行；每个单动作各测 force_create_positions=false/true，共16种 case（含组合、两次额外nonce、update/close）。单位为序列化交易字节，逗号表示多笔交易。

| 动作 | 无 LUT：force=false / true | 历史 LUT：force=false / true |
| --- | --- | --- |
| MarketIncrease | 892 / 892 | 774 / 774 |
| LimitIncrease | 925 / 925 | 807 / 807 |
| MarketDecrease | 802 / 892 | 684 / 774 |
| LimitDecrease（TP） | 819 / 925 | 701 / 807 |
| StopLossDecrease | 819 / 925 | 701 / 807 |
| increase + TP + SL | 469,1121,762 / 623,1031,762 | 379,1003,644 / 536,1167 |
| update_order_v2 | 406 | 381 |
| close_order_v2 | 633 | 481 |

无 LUT 的两种组合都将三个 create 分到两笔。历史 LUT + force=false 仍分到两笔；历史 LUT + force=true 的 `prepare_user`、`prepare_position` 在第一笔536字节，三个 `create_order_v2` 同在第二笔1167字节（低于1232上限）。因此只能认定**这个输入和 LUT 内容下，三个订单创建可同笔**；整个 TransactionGroup 仍为两笔，有准备依赖。不能从 merge 或 builder 成功推断所有组合原子，也不能将这个结果直接用于生产启用。

以上使用的历史 LUT 捕获时间为 `2026-10-24T17:49:06.750Z`、confirmed slot `460940960`，表地址为 `CoMLGFDWf5soeQ6vtzL6yXeARtwNhTV41cVsrTos31wg`、`CVHqcEnqZv2dr9PFRiJHJtWW3BPXr6WFZbixzsxmx9eG`。表有 authority；内容只作为离线结构输入，**没有重新验证当前内容、authority/frozen、安全性或可发送性**。真实 LUT 前置仍归 T25，不因 fixture 通过解锁。

## 已确认限制与验收边界

- 高层 CreateOrderParams 类型不暴露 nonce。额外传入同一个32字节0x2a字段，两次得到各自随机 nonce，均不等于请求值；禁止靠额外 JS 属性声称 deterministic nonce。低层类型存在 nonce，不等于已有可用公开构建入口；T20.b 继续核实，必要时协调 SDK 能力。
- 每笔解码检查签名全为 null、payer/blockhash 精确一致、LUT 索引全部可解析、gmsol discriminator 已知且账户数足够、owner/receiver 匹配。测试检查单动作 setup 在 create 之前、组合订单分包、nonce 行为、update/close v2、rent_receiver=payer，以及退出后的全局环境恢复。网络保护安装一次、0次 blocked；没有网络请求。
- 这里只按 IDL 识别 gmsol 指令和账户并保存原始数据；T20.a时未完整解码金额/枚举/可选字段（本页b1已补覆盖输入）；仍未验证全部 System/ATA/Token/ComputeBudget 指令。这不是 T21/T24 的 allowlist validator，任意外部 lut-report 也没有被认证为安全来源。
- 未覆盖 short、现存/缺失真实 position、callback/referrer 非空、不同 rent receiver、SOL/WSOL、Token2022、极值/组合大小边界及非法输入。不能将未测试项当作支持；关闭交易检查、自动拆单或旧 keeper 不作为补救。
- 未运行链上 simulate/执行、真实钱包、keeper 完成或订单刷新。T23 生产 builder 接线和 FESOL-56 父需求仍未完成。

## 工程自审与接手

本轮只修改独立验收脚本、共享样本及文档，未改 app/SDK 业务、状态、存储或依赖配置。复用既有初始化，未引入 GMTrade 数据流、EVM RPC 或生产加载依赖；app lazy/flag-off/bundle 边界未改。ESLint 仅在离线 probe 文件豁免面向客户端的 Solana 导入限制，生产边界规则保持启用。

首次 Node ESM 调用触发 getrandom 的 `module is not defined`；工具临时提供真实 Node `createRequire`，使用真实 crypto，不 mock RNG，finally 恢复全局 descriptor。第二次实例化同一 wrapper 触发缓存 memory view 的 UTF-8 错误；改为进程内单例实例，失败 Promise 保留而不静默重试。经验同步到[SDK 向量说明](solana-sdk-vectors.md#node-离线初始化的复用约束)。首次失败日志保留，最终连续运行无 LUT/历史 LUT 均通过。

最终原生 Node 测试4项通过、0失败/0跳过（probe 1项与原向量3项）；ESLint三个脚本零 warning、Prettier四文件及 `git diff --check` 通过。不借用前轮 EVM55项作为本轮回归：本轮没有生产 EVM 修改，没有重跑前端全量、EVM业务测试、根类型或bundle，也没有用Chrome替代bytes验收。本机原始报告在 `.local/acceptance/requirements/solana-implementation-t20/`，共享结论和bytes在本页及fixture，不仅依赖本机日志。

T20.b1已补齐覆盖输入的参数解码，后续T20.b2核实受支持的 nonce 入口、setup/existing position、callback/referrer、WSOL及大小/失败边界。若必须升级 SDK 或契约仍缺失，暂停该项并记录协调条件；T17.b1 的 Rust 工具链/限定构建授权仍待解锁，不重复安装尝试。

## T20.b1 参数解码与显式输入核对（2026-10-28）

已在同一probe内增加三种order v2的诊断解码器，按上述固定IDL遍历实际参数布局：u8/u64/u128/i64、严格bool/option、32字节nonce、无载荷enum和UTF-8 string，完整消费data，截断/尾随字节/非法tag/未知enum明确拒绝。不解析其他指令，不作为签名前validator。金额及时间保持bigint，只有u8及受限字符串长度使用Number；输出JSON为精确十进制字符串。

当前探针扩展为无LUT/历史LUT各19种case；原16种分包矩阵不变，新增三种参数样本见[parameter-fixtures.json](../tools/solana-builder-probe/parameter-fixtures.json)，保留最终probe摘要、IDL/产物来源、原始bytes及decodedArgs。原unsigned-fixtures保留上一轮实际捕获与历史摘要，不用新随机nonce覆盖旧证据。

| 核实项 | 实际结果及边界 |
| --- | --- |
| 五种创建动作与组合 | kind、size、amount、long、min_output、trigger/acceptable、swap enum、valid_from、callback_version、execution_lamports、swap_path_length、collateral/unwrap布尔和nonce逐项核对；组合为MarketIncrease/LimitDecrease/StopLossDecrease，后两者amount=0，trigger=250/100×10^11 |
| short显式选项 | size=2^100+17、amount=2^53+19、min_output=23、trigger=29、acceptable=31、valid_from=-37、CollateralToPnlToken及short均精确保留；无LUT828字节。这些是编码边界输入，不表示报价、资金条件或程序接受 |
| 真实零与缺省 | 完全省略amount/min_output时均编码为零，min_output是Some(0)，不是None；size/acceptable/timestamp显式0保持0，NoSwap保留，skip_unwrap=true编码should_unwrap=false；无LUT811字节 |
| undefined限制 | amount/min_output显式传undefined均拒绝，错误为invalid type: unit value, expected u128；与完全省略不同。后续mapper必须显式规范化调用边界，不能因d.ts可选就直接传undefined；没有修改SDK或加入兜底 |
| 更新 | 原样本只提供size/acceptable，其余option均None；新增样本五个字段均提供，size=2^100+17、acceptable/min_output=0、trigger=29、valid_from=-37精确保留；无LUT446字节 |
| 关闭 | reason完整解码为cancel；未误解为订单已取消或执行完成 |
| SDK默认值 | 当前样本execution_lamports=300000、swap_path_length=0、is_collateral_long=true、默认should_unwrap_native_token=true、callback_version=None；仅固定产物/输入下观察，不能当实时费用策略 |

固定tag源码交叉参考：[JS create入口](https://github.com/gmsol-labs/gmx-solana/blob/c6778dc9bf6444f9037c3b0d2dc219c857e1b45d/crates/sdk/src/js/instructions/create_order.rs)、[create参数映射](https://github.com/gmsol-labs/gmx-solana/blob/c6778dc9bf6444f9037c3b0d2dc219c857e1b45d/crates/sdk/src/builders/order/create.rs)。后者amount/min_output为serde default的u128，前者使用skip_unwrap选项反向传给unwrap标志，与实际bytes一致；仍不声称tag为npm可重现来源。

实际验收命令沿用上文；原生测试现为5项/0失败/0skip，覆盖两次真实19-case probe及原基础向量；额外对三种指令的全部截断长度、尾随字节、错误discriminator/enum/option/bool和非法UTF-8进行拒绝验证。网络保护installed一次、blocked零次。新fixture三笔交易的来源摘要、bytes大小/hash、decodedArgs重解码一致。两脚本lint、三文件格式与文档链接/diff检查通过。原始报告在 `.local/acceptance/requirements/solana-implementation-t20b/`；未改生产EVM/SDK代码，未跑EVM业务/前端全量、根类型或bundle，无签名/广播/模拟。

b1只完成**已覆盖输入的完整参数解码**。T20后续b2仍需核实可控nonce公开入口、实际position setup/存在性规则、callback/referrer非空、PnlTokenToCollateralToken、不同抵押/路径、WSOL/Token2022、边界错误及原子大小条件。新的离线样本不解锁T25真实LUT/程序/钱包，不完成T23生产builder或父需求。负时间戳可序列化不等于程序允许，不增加产品行为。

## T20.b2 nonce、position setup与callback/referrer（2026-10-28）

固定产物已完成这一子集的**离线能力核实**，仍非生产接线或主网业务验收。沿用同一probe，当前无/历史LUT各23种case；新增四组真实bytes及完整来源见[capability-fixtures.json](../tools/solana-builder-probe/capability-fixtures.json)，前两轮fixture保持历史身份不覆盖。

| 核实项 | 真实结果与后续约束 |
| --- | --- |
| 公开nonce能力 | 读取固定wrapper真实exports、d.ts及JS入口，order相关函数/类只有CreateOrdersBuilder、OrderSimulationOutput、close_orders、create_orders、create_orders_builder、update_orders。低层CreateOrder仅为interface；Instruction无公开构造器，没有create_order或低层交易构建导出。结合额外nonce字段被忽略的实测，当前高层接口不支持显式可控nonce。此子项受SDK能力阻碍，需要SDK负责人提供公开入口和批准固定产物后再复验；不能改bytes或mock随机数绕过 |
| 默认setup | 五种单动作的false/true样本逐一检查：默认增仓有prepare_position，默认减仓/TP/SL没有；force=true均准备。新增force_create_positions_in_parallel=true的减仓样本也在create前准备position，准备与引用地址一致。命名parallel不等于可忽略准备依赖 |
| 存在性语义 | 高层输入没有账户存在性状态，也不发RPC；默认减仓依赖已有position，不能靠builder成功断言存在。固定程序源码PreparePosition为init_if_needed，且随后验证/初始化position；这是源码契约，未验证当前部署或已有/缺失真实账户执行 |
| 非空callback | create/update/close均将program/shared_data/partitioned_data原样放入对应账户，authority与program PDA seed callback独立计算一致；create参数callback_version=7。update/close的v2 data没有callback_version字段，不能强行添加。地址为公开离线fixture，不代表已部署回调程序或授权能力 |
| 关闭referrer | CloseOrderHint.referrer输入为referrer钱包地址，输出referrer_user为seed user + store + referrer钱包的PDA；与独立kit推导一致，不是钱包本身。固定程序约束还要求它与user中记录的referrer一致、已初始化、同store且非本人；不能由随意输入或IDL错误owner种子推断真实关系。create高层无referrer入参，不新增猜测字段 |

新增case大小（无LUT / 历史LUT）：create-with-callback 1021/903字节；decrease-force-position-parallel 892/774；update-with-callback 518/493；close-with-callback-referrer 793/641。均一笔unsigned交易，只证明本输入的结构；不证明更大callback组合原子性。callback authority为 `EvVTs5Ts2xdPx2PK8pU2PYssYaGtUo6mQ4k9aMnZFwRK`，本样本referrer_user为 `8GT5HdthxDk5M3rrEFH76QwTcXDbPUN5rtv4BschKNk5`，均在共享fixture保存，不作生产常量。

固定源码依据（提交仍为c6778dc9bf6444f9037c3b0d2dc219c857e1b45d）：[JS create入口](https://github.com/gmsol-labs/gmx-solana/blob/c6778dc9bf6444f9037c3b0d2dc219c857e1b45d/crates/sdk/src/js/instructions/create_order.rs)、[callback映射](https://github.com/gmsol-labs/gmx-solana/blob/c6778dc9bf6444f9037c3b0d2dc219c857e1b45d/crates/sdk/src/builders/store_program.rs)、[PDA种子](https://github.com/gmsol-labs/gmx-solana/blob/c6778dc9bf6444f9037c3b0d2dc219c857e1b45d/crates/sdk/src/pda.rs)、[close builder](https://github.com/gmsol-labs/gmx-solana/blob/c6778dc9bf6444f9037c3b0d2dc219c857e1b45d/crates/sdk/src/builders/order/close.rs)、[程序setup/referrer约束](https://github.com/gmsol-labs/gmx-solana/blob/c6778dc9bf6444f9037c3b0d2dc219c857e1b45d/programs/store/src/instructions/exchange/order.rs)。仍不证明tag是npm构建来源或当前部署兼容。

验收复用原CLI、原生测试和runtime前置；最终5项通过、0失败/0skip，连续无/历史LUT23-case含账户映射/setup顺序及之前参数/畸形data回归，网络installed一次、blocked零次。新增四组/四笔fixture来源摘要、bytes长度/hash与重解码一致；两脚本lint、三文件格式及文档链接/diff检查通过。报告在 `.local/acceptance/requirements/solana-implementation-t20b2/`。本轮只修改工具/样本/协作文档，无生产EVM/SDK、存储、状态或lazy/bundle改动；未跑EVM业务/前端全量、根类型、bundle或simulate/签名/广播。

T20父任务仍核实中。下一轮b3继续WSOL/native处理、swap路径与第三种swap枚举、缺hint/错误输入及组合大小边界；可控nonce子项等待SDK公开能力，真实position/callback/referrer及当前LUT/程序仍待T25和业务验收，不通过额外JS字段、旧服务、静默拆单或新模拟数据绕过。

## T20.b3 native、swap路径、错误及组合大小（2026-10-28）

本子集已完成**固定产物、已覆盖输入的离线验收**。沿用真实WASM及既有probe，无/历史LUT各31种case；新增八组完整bytes、输入、失败消息及来源见[native-fixtures.json](../tools/solana-builder-probe/native-fixtures.json)，旧fixture不覆盖。使用现有配置的SOL/USD[WSOL-USDC]（market token `BwN2FWixP5JyKjJNyD1YcRKN1XhgvFtnzrPrkfyb4DkW`），amount=123456789个原生token units；native输入保持WSOL mint作为SDK边界身份，不将共享NATIVE_TOKEN_ADDRESS或System program当WSOL mint。

| 核实项 | 实际bytes与验收边界 |
| --- | --- |
| SOL支付包装 | skip_wrap_native_on_pay=false时先System Transfer（tag2、u64精确123456789 lamports）从payer到钱包WSOL ATA，再Token SyncNative（tag17），然后create；订单initial_collateral_token_source同ATA。ATA用kit按payer/token program/mint独立推导一致。true时没有Transfer/SyncNative，需已有WSOL余额；不能把开关当余额或授权证明 |
| WSOL收款 | MarketDecrease的skip_unwrap_native_on_receive=false/true分别编码should_unwrap_native_token=true/false；创建交易中均无包装Transfer/SyncNative，不把订单标志当作此刻已收到SOL或已完成unwrap |
| 显式swap路径 | USDC支付、WSOL抵押，传入一个已配置market token；swap_path_length=1，create追加account为seed market/store/market-token派生的market PDA，initial_collateral_token为USDC。只证明路径编码及PDA映射，不证明路径连接、池状态、流动性、报价或执行成功；不得用于无报价的生产fallback |
| 第三种swap枚举 | PnlTokenToCollateralToken精确编码；结合前两轮NoSwap/CollateralToPnlToken，三种公开枚举已有样本，不表示各市场全部支持 |
| 错误输入 | 缺hint明确报hint not provided；不属于long/short的抵押币报invalid hint: collateral；amount=2^64报out of range integral type conversion。显式拒绝并保存消息，未替换资产/补hint/截断金额/联网兜底 |
| native组合大小 | force准备position的增仓+TP/SL，无callback为无LUT3笔/历史LUT3笔，三个create分为2+1；非空callback为无LUT4笔/历史LUT3笔，create分为1+1+1 / 2+1。这些组合即使每笔<=1232字节仍非原子，不能沿用USDC样本的同笔结论 |

本次大小矩阵（字节，逗号表示多笔）：

| case | 无LUT | 历史LUT |
| --- | --- | --- |
| native-pay-skip-wrap-false | 1020 | 933 |
| native-pay-skip-wrap-true | 998 | 849 |
| native-receive-skip-unwrap-false / true | 908 / 908 | 759 / 759 |
| explicit-swap-path | 999 | 850 |
| pnl-token-to-collateral | 909 | 760 |
| native-combo-callback-false | 697,1149,826 | 579,1062,677 |
| native-combo-callback-true | 697,992,955,955 | 579,1192,806 |

固定源码交叉核对：[WrapNative的Transfer/SyncNative](https://github.com/gmsol-labs/gmx-solana/blob/c6778dc9bf6444f9037c3b0d2dc219c857e1b45d/crates/sdk/src/builders/token.rs)、[JS包装及开关](https://github.com/gmsol-labs/gmx-solana/blob/c6778dc9bf6444f9037c3b0d2dc219c857e1b45d/crates/sdk/src/js/instructions/create_order.rs)、[swap剩余账户及u64转换](https://github.com/gmsol-labs/gmx-solana/blob/c6778dc9bf6444f9037c3b0d2dc219c857e1b45d/crates/sdk/src/builders/order/create.rs)。该入口使用SPL Token程序，未证明Token2022可用；不添加主项目没有的资产/程序选项或宣称完整token-program支持。多跳/长路径/全量极值和非法输入空间未穷举，后续allowlist/validator须按支持范围显式限制，不能靠WASM接受输入证明安全。

本轮最终原生测试5项通过、0失败/0skip，覆盖连续两次31-case真实运行、Transfer金额/账户/Sync顺序、skip开关、路径长度/剩余PDA、三种拒绝及native组合非原子；原基础向量、参数与畸形数据回归保持。网络installed一次、blocked零次。新增八组/十三笔unsigned交易（无LUT）的来源摘要、bytes长度/hash及12个order参数重解码一致。两脚本lint/三文件格式、文档链接及diff检查通过；原始报告 `.local/acceptance/requirements/solana-implementation-t20b3/`。无生产EVM/SDK/状态/缓存/存储/lazy/bundle变更，未跑EVM业务/前端全量、根类型或bundle，无simulate/签名/广播。

T20仍保留显式nonce的SDK公开能力阻碍、当前LUT/程序与真实position/callback/账户执行待验，不能标父任务完成。正向fixture已满足T21规则核实的输入条件；下一轮转T21.a，固定本支持子集的指令/账户/金额/顺序/LUT及原子性拒绝规则，再接validator，暂不将未覆盖Token2022/多跳输入扩入支持范围，也不删除父需求。T17 Rust前置仍待，不重复无效尝试。


## T23.a1 单订单 unsigned update 适配（2026-10-28）

当前实施入口为 `src/domain/gmsol/buildOrderUpdate.ts`，尚无生产消费者。它使用既有 `loadGmsolSdk()`，在调用时动态加载loader并保留其Solana flag检查；初始化不新增单例或应用状态。测试注入的是既有 `loadPinnedSdk()` 加载的真实固定WASM，而不是mock SDK或codec。静态import仅包含类型、kit codec及已有SDK单位转换，不把WASM wrapper接入启动图。

本子步骤支持显式 `LimitIncrease`、`LimitDecrease`、`StopLossDecrease` 的单订单更新。输入包含solana-mainnet、owner/order/market/kind/recentBlockhash、完整LUT地址内容、已确认callback或显式undefined，以及changes：sizeDeltaUsd为USD30；acceptablePrice/triggerPrice为共享contract price（USD30 per smallest native token unit，未含显示倍率）；minOutput为增仓原始token amount或减仓USD30 output value；validFromTs为可精确表示的整数秒。价格直接复用 `toGmsolUsd()` 除以10^10，不能再次按mint decimals缩放；正值转换为零时拒绝。真实零与省略不同，undefined字段不写入ABI params；空changes、非法地址/范围/时间拒绝。callback地址按确认值传递，update ABI没有callback_version字段，未新增猜测字段。

所有输入在SDK加载前完成转换及快照，加载期间账户、changes、callback和LUT原对象变化不会改写原请求。输出保留原network/owner/order/market/kind/blockhash及unsigned bytes；调用方仍需按共享当前会话隔离消费。group在serialize/后置检查失败或成功时均free；只接受一组一笔、1–1232字节、实际使用显式LUT的v0 unsigned交易，payer/blockhash须与原scope一致，不自动拆单、替换blockhash或重试。

这只是构建适配与结构检查，**不是T24签名前allowlist validator**，没有证明order实际owner/kind/market、callback链上可用性或LUT当前authority/frozen/deactivation状态。输入数据真实性由后续已有API/账户边界提供；无RPC账户列举、旧服务或并行业务store。当前compute budget采用已固定SDK默认值，尚未接共享费用设置；不连接wallet/sender，也不能凭此宣称T23或FESOL-56/95完成。create/nonce/position setup/组合与cancel仍分别待后续子步骤。

验收使用共享unsigned/capability fixture的完整指令（program、解析LUT后的账户顺序、全部data）对照真实WASM输出，覆盖有/无callback、三种kind的minOutput单位、0/None、时间及加载期间输入变更。测试只需要固定fixture和已安装SDK/已批准产物，不依赖嵌套协议checkout；测试中用kit真实u64/u128/i64/nullable/struct decoder核对参数。未把历史LUT或离线blockhash当作当前可发送资源。

同样输入实际观察到LUT条目序列化顺序可变，因此整笔bytes/hash不保证跨构建唯一。回归按显式LUT还原账户后对照每条指令的program/accounts/data，同时检查payer/blockhash/unsigned/size；不能为了固定bytes修改Rust随机性、手改序列化或将语义不同的指令归一。既有fixture原bytes/hash及来源继续保留。

最终前端离线builder/loader/entry三文件9项、0skip通过，network blockedAttempts=0，进程/临时目录cleanup passed；局部strict类型、两文件零warning lint、3项导入边界、格式/文档/diff检查通过。命令及原生结果路径见[第四十四轮记录](solana-implementation-research.md#第四十四轮实施记录t23a1-单订单unsigned-update2026-10-28)。未跑EVM业务/根类型/bundle，也未使用当前钱包或执行任何交易；真实验收仍待T25/T26，nonce等既有阻碍不变。


## T23.a2 单订单 unsigned cancel 适配（2026-10-28）

`src/domain/gmsol/buildOrderCancel.ts` 新增纯构建入口，复用原lazy loader和固定 `0.9.0-test.2` WASM `close_orders()`。输入显式携带solana-mainnet、owner/order、receiver/rentReceiver、recentBlockhash、完整LUT内容、callback/referrerWallet、四个token hint及shouldUnwrapNativeToken。undefined表示已确认无对应可选项，不表示未知；尚未取得真实订单字段时，后续调用方不能用undefined代替缺失数据。receiver及rentReceiver均必须等于owner，owner同时是payer/executor；referrer不得等于owner，必须为已确认的referrer钱包，不传猜测的user PDA。SDK按固定源码 `find_user_address(referrerWallet)` 处理，未使用已知错误的IDL referrer PDA seed。

callback、token hints、referrer、unwrap和LUT在await前完成快照。返回原network/owner/order/receiver/rentReceiver/blockhash及unsigned bytes；没有账户读取、全钱包扫描、业务store或缓存。缺/非法输入显式拒绝；没有将构建成功当作账户owner/订单状态真实可取消。当前高层close API固定reason为cancel，本入口不提供不存在的reason入参，也不改变最终keeper事件reason。

update与cancel共用 `orderBuilder.ts`：地址校验、LUT/callback快照，以及一组一笔、1–1232字节、实际使用显式LUT的v0/unsigned/payer/blockhash结构检查。成功及serialize/后置检查异常都在finally释放group。不新增RPC scanner或第二个SDK生命周期；默认加载继续经过原flag边界。完整allowlist/账户权限/指令金额语义检查仍属T24，当前helper不能作为签名授权依据。

在原builder spec内复用现成fixture比较器和真实WASM loader，新增两项取消测试，未新建测试框架：普通close及callback/referrer case的全部program/accounts/data对照；kit独立用user+store+referrer钱包推导PDA并核对实际referrer_user；拒绝外部receiver/rentReceiver和自referrer；wrapped SOL unwrap时四个接收ATA位置均为owner；await期间修改owner/接收方、callback、referrer、token hints、unwrap及LUT后仍保留原scope/账户。fixture的LUT及blockhash仅为历史/离线结构输入，不证明当前主网权限或可发送性。

实际验收：本地runtime-only预检passed，Node v22.17.0，批准/安装/既有public WASM均为 `775a7ddb532d6d49a1800a3d8eccca523960d685db8e1800fbd5eb519ed8dd68`，未构建。builder/update回归/loader/entry三文件11项、0skip通过；0联网拦截，进程和临时目录清理通过。四源码/spec局部strict类型、零warning lint、导入规则3项、格式与文档/diff检查通过。详细命令与最终原生结果见[第四十五轮记录](solana-implementation-research.md#第四十五轮实施记录t23a2-单订单unsigned-cancel2026-10-28)。无EVM/SDK源码、存储或生产接线改动，未跑EVM业务、根类型或bundle；未simulate、签名、广播或触发钱包。

T23仍实施中：a1/a2离线通过，create/position setup/组合与nonce前置未完成，默认compute budget尚未映射共享发送设置；真实订单/referrer/callback/LUT/四钱包/交易仍待T25/T26。下一轮先推进T24.a已具备builder及T21证据的update/cancel确定性校验子集，实施前实时核对FESOL-93；create校验不借此宣称完成，不重复尝试已确认无效的nonce额外字段。
