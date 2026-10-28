# Solana 交易数学差异与独立参考向量

核验日期：2026-10-28。对应 [FESOL-57](https://linear.app/gmx-io/issue/FESOL-57/add-gmsol-branches-to-the-sdk-trade-math)、本地 T17/T19。本页记录 **T17.a 差异核实、b1首个子集、b2a清算及b2b即时impact增仓边界子集验收**。复用已授权Rust1.90.0限定构建；生成器、锁文件和103组独立Rust参考值已落盘并验收，SDK数学未修改，T17父任务仍实施中。

## 固定版本与证据范围

- 权威需求实时抓取于 `2026-10-27T22:08:38.596Z`，updatedAt `2026-10-25T23:43:47.128Z`，已包含正文、关系和 1 条评论，无 GMTrade 标签。评论询问计算与共享结构，没有新增已确认行为。
- 需求指定协议 [v0.10.0](https://github.com/gmsol-labs/gmx-solana/tree/7ce035b41a266cb5ddb0192e5d29deb0c7e67a72)；本地 `v0.10.0^{commit}` 和在线 GitHub tag ref 均为 `7ce035b41a266cb5ddb0192e5d29deb0c7e67a72`。下文 Rust 路径/函数均按此提交读取，不能按本地 HEAD 的行号定位。
- 本地 `gmx-solana` HEAD 为 `f102501f30635062fac156ca05831c0fb63a8590`。其 model 相对 tag 有 4 文件、223 行新增/8 行删除，涉及 fee credit 和 decrease；不能用 HEAD 生成值后标为 v0.10.0。
- 本机 npm WASM `0.9.0-test.2` 是另一版本。现有 [基础向量入口](solana-sdk-vectors.md) 仅验证 `apply_factor`，Python 生成器和 WASM 输出都不能替代本需求的独立 Rust model 业务参考值。
- 本轮在线 release 为 `d4b8c32147dd604d8d062d76c00a75ec4f0bbb7a`；其递归 tree 中没有 `sdk/src/utils/gmsol/`。以 FESOL-57 查询 PR 仅返回已合并的静态配置 #3111；补查 open Solana math 返回价格 #3138，无直接数学实现命中。这是限定搜索结果，不代表所有分支均无工作；实施 T19 前仍须增量核对。
- 本轮只读源码与元数据，不证明链上部署、API、WASM 与 tag 一致。未同步/合并参考仓库或上游。

## 差异、共享入口和验收矩阵

以下 Rust 链接固定到同一提交；目标 SDK 路径指本实施工作区。每项都必须以 opt-in 参数或 `sdk/src/utils/gmsol/` 无外部包的纯 helper 实施，保留 EVM 默认结果；不永久委托 WASM 数学，不增加 store、订阅、UI 或第二数据真源。

| 范围 | v0.10.0 源码事实 | 现有共享消费/改动边界 | 必需独立向量 |
| --- | --- | --- | --- |
| 增仓即时 impact | [increase_position.rs](https://github.com/gmsol-labs/gmx-solana/blob/7ce035b41a266cb5ddb0192e5d29deb0c7e67a72/crates/model/src/action/increase_position.rs) `execute` 相关计算调用 `capped_positive_position_price_impact`；impact 立即增减 `size_delta_in_tokens`。正 impact 按 index max 除并截断；非正 impact 按 index min 做绝对值向上舍入；基础 long size 向下、short size 向上 | `trade/increase.ts`、`increaseMarginCheck.ts`、`positions/utils.ts` 的价格/保证金/清算统一接入；Solana 不产生 EVM pending/lent impact | long/short × 正/负/零 impact × spread；不整除、impact 大于 size 的错误，验证执行后 size 与 margin，而非只验中间 impact |
| pool-capped acceptable price | 同文件 `get_execution_price_for_increase` 在 cap 和 size rounding 后验价；long increase 为 `execution <= acceptable`，short 相反。[decrease utils](https://github.com/gmsol-labs/gmx-solana/blob/7ce035b41a266cb5ddb0192e5d29deb0c7e67a72/crates/model/src/action/decrease_position/utils.rs) long decrease 为 `execution >= acceptable`，short 相反 | `fees/priceImpact.ts`、`trade/increase.ts` 的 `getIncreasePositionPrices`，以及 decrease 价格路径；不可仅按未封顶 impact 算滑点 | 四方向、等于边界通过/差一个最小价格单位失败；pool 空、刚好够、不足，cap 前后两组值 |
| 正 impact 配置上限 | [market/perp.rs](https://github.com/gmsol-labs/gmx-solana/blob/7ce035b41a266cb5ddb0192e5d29deb0c7e67a72/crates/model/src/market/perp.rs) `cap_positive_position_price_impact` 先按 pool amount × index min 封顶，再直接采用 `max_positive_position_impact_factor` | `fees/priceImpact.ts:getMaxPositionImpactFactors` 当前 EVM 会取正负配置较小值；只能 opt-in 改 Solana。pool 分发还需固定时间，不能混同 pending position impact | 正配置大于/等于/小于负配置；factor cap 与 pool cap 分别起作用；pool 为 0；分发前后 |
| side net PnL cap | [position.rs](https://github.com/gmsol-labs/gmx-solana/blob/7ce035b41a266cb5ddb0192e5d29deb0c7e67a72/crates/model/src/position.rs) `pnl_value` 用该侧 market PnL 和 `MaxForTrader` cap 比例缩放盈利，再按 size delta in tokens 分配；cap 为零也生效，亏损不走盈利 cap | `positions/utils.ts:getPositionPnlUsd` 已有共享算法，但 `cappedPnl > 0` 不含零；价格选择与 side net PnL 也须逐项核对，不能只修改零判断就宣称一致 | long/short × 盈亏 × cap 零/有限/未命中；同侧多仓净额；全平/部分减仓与舍入。复用 Rust `tests/max_pnl_factor.rs:test_zero_max_pnl_factor_for_trader` 的场景，不复制其输出作为未运行期望 |
| combined discount / UI fee | [store.rs](https://github.com/gmsol-labs/gmx-solana/blob/7ce035b41a266cb5ddb0192e5d29deb0c7e67a72/programs/store/src/states/store.rs) `order_fee_discount_factor` 合并 rank 和 referred：先算 `rank × (1-referral)` 的定点值再加 referral；[params/fee.rs](https://github.com/gmsol-labs/gmx-solana/blob/7ce035b41a266cb5ddb0192e5d29deb0c7e67a72/crates/model/src/params/fee.rs) `FeeParams::fee` 先算 fee，再减折扣，不能合并乘法改变舍入 | `fees/index.ts:getPositionFee/getSwapFee`、increase/decrease/margin/liquidation 所有适用费用路径使用同一 combined factor，UI fee 为 0；现有 EVM referral rebate 格式不改。不把 order fee 折扣误施加给 funding、borrowing 或 rent | rank/referral 各 0、单独、组合、满折扣；improved/unchanged/worsened；逐阶段不整除。model 输入 combined factor；组合来源另以程序规则验证，不能声称 model 本身覆盖 rank 认证 |
| per-market minima | [params/position.rs](https://github.com/gmsol-labs/gmx-solana/blob/7ce035b41a266cb5ddb0192e5d29deb0c7e67a72/crates/model/src/params/position.rs) 存在 `min_collateral_value`、`min_position_size_usd`；`PositionExt::validate` 分别按调用开关校验 | 现有 `getLiquidationPrice` 已接收 `minCollateralUsd`；`increaseMarginCheck.ts`、`decreaseMarginCheck.ts`、`trade/decrease.ts` 需显式传 market minima，不能继续 Solana 用 EVM global；字段接线待 T04.b reviewed 契约 | 两个市场不同 minima，同输入结果不同；min−1/min/min+1；全平与部分减仓；零配置与缺字段区分 |
| 清算规则 | `PositionExt::check_liquidatable(prices, true, true)` 是 [decrease_position/mod.rs](https://github.com/gmsol-labs/gmx-solana/blob/7ce035b41a266cb5ddb0192e5d29deb0c7e67a72/crates/model/src/action/decrease_position/mod.rs) 清算订单实际调用。用 `min_collateral_factor_for_liquidation`，并校验 market min collateral；负 impact 按 liquidation cap，正 impact 置零，算 closing/funding/borrowing，不含 liquidation fee 来判定是否可清算 | `positions/utils.ts:getLiquidationPrice/getMinCollateralUsdForLiquidationPrice` 等共享函数增 opt-in；保留等价抵押 token 分母语义。不能用 `PositionStatus.liquidation_price`。Rust getter 在 liquidation factor 为 None 时回落普通 factor 是协议行为；不得据此给缺失 API 字段静默默认值 | liquidation factor 与普通 factor 必须不同，覆盖两种 minima 谁主导；long/short × long/short collateral；spread、费用、负impact、等价资产、无有效阈值。记录程序 predicate 在候选价及相邻价格单位的结果/原因，不能仅比一个闭式公式 |
| funding 无 claim 步骤 | increase report `claimable_funding_amounts`、decrease report 同名输出；[ops/order.rs](https://github.com/gmsol-labs/gmx-solana/blob/7ce035b41a266cb5ddb0192e5d29deb0c7e67a72/programs/store/src/ops/order.rs) 调用 `transfer_out_funding_amounts`，随订单执行支付 | 复用现有 funding 计算、状态/费用展示，Solana 不复用 EVM claim 动作；report 数值与真实转账分开验收 | payer/receiver、long/short collateral、两个 token、零 funding、前后累积值；下一单前后 report。真实 payout 仍需后续授权交易 |
| execution lamports 与可退 rent | [states/order.rs](https://github.com/gmsol-labs/gmx-solana/blob/7ce035b41a266cb5ddb0192e5d29deb0c7e67a72/programs/store/src/states/order.rs) `MIN_EXECUTION_LAMPORTS=300_000`；[common/action.rs](https://github.com/gmsol-labs/gmx-solana/blob/7ce035b41a266cb5ddb0192e5d29deb0c7e67a72/programs/store/src/states/common/action.rs) `validate_balance` 扣 execution 后仍须 rent exempt，`execution_lamports` 取请求与 max 较小值，默认 rent_receiver=owner；[internal/action.rs](https://github.com/gmsol-labs/gmx-solana/blob/7ce035b41a266cb5ddb0192e5d29deb0c7e67a72/programs/store/src/utils/internal/action.rs) 关闭 action 到 rent_receiver | EVM `fees/executionFee.ts` 的 gas 逻辑不能套 Solana；执行成本和可退押金分别保留 bigint lamports，不能汇总成不可退 fee | 299999/300000/max、keeper request 小于/等于/大于 max、成功/keeper取消/owner提前取消、关闭与未关闭、escrow rent。此项不是 model 纯数学，须程序层余额守恒或后续真实交易证据，model 向量不能证明退款 |

## 已有可复用入口与缺口

v0.10.0 `crates/model/Cargo.toml` 的 package 是 `gmsol-model`，features `test` 暴露 `src/test.rs`，`u128` 启用大数支持。`TestMarket<u128,20>::with_config(TestMarketConfig)`、`TestPosition::long/short(bool)`、`position.ops(&mut market).increase/decrease(...)` 和 `MarketAction::execute()` 是已有可执行测试入口；`tests/max_pnl_factor.rs` 已有真实零 cap 回归，`tests/borrowing_fee.rs` 有 borrowing 场景。无需从旧前端移植模型或建设另一套测试框架。

本轮核查该 tag 的 model 文件树、`generator/serde_json` 文本及 examples：**未找到本需求可直接复用的业务 JSON 生成器**。已有 Rust 单测不是 JSON 生成器，部分 `println!` 也不是完整输入/期望集。T17.b1现已在主项目测试工具范围增加专用 generator源码，依赖固定tag的model、复用builders；不修改参考仓库、不把测试工具引入生产依赖。现已在Rust 1.90.0下编译运行，首个子集通过下文验收。

首个子集复用model的 `test,u128`，只读调用费用、positive impact cap及 `PositionExt::pnl_value`。通过test builders显式设置本次入口读取的参数和池子，未读取的默认字段不冒充真实市场配置；没有执行时间推进或订单动作。后续动作级向量仍需用初始化deposit/increase建状态，再取执行report和清算predicate。rank组合、lamports/rent属程序层，单列来源和覆盖缺口。

## 向量格式与数值规则

后续 JSON 至少记录：`schemaVersion`、协议 repo/tag/commit、生成器 commit 或源码摘要、Cargo.lock/工具链身份、case id、调用入口、完整 market/position/prices/clock/action 输入、单位、原始输出或明确错误/清算原因、转换后共享输出和转换方向。所有整数使用十进制字符串；不得用 JS Number、WASM/待验 SDK 输出反向填期望，也不得提交空 expected 占位后算通过。

- 原协议 USD/factor 为 20 位；共享 USD/factor 为 30 位。T08 已有 [转换 helper](../sdk/src/utils/gmsol/units.ts)，复用其明确截断方向。Rust 价格是 USD20 per raw token unit，共享 app 的 token 价格是 USD30 per whole token；转换必须记录 mint decimals，不能把共享价格直接作为 Rust unit price，或对已转换的 contract price 再除一次 mint 精度。raw token amount 保留 mint 精度；lamports 为 9 位 SOL 最小单位。
- 整数、错误分支及 keeper/minima/discount 等边界要求精确相等，默认容差为 0。USD20 转 USD30 是精确乘 `10^10`；反向转换和 token 除法的舍入必须随 case 记录。涉及 exponent/价格阈值如需容差，须先说明协议数值方法与可证的离散区间，不能先给通用百分比容差。
- 每个 case 同时保存 cap 前/后、size、fees、collateral 和执行后状态中相关字段，以避免单个输出相等掩盖不同路径；`0`、不可用、拒绝/错误分别编码。
- 清算价不能由粗粒度采样或未证单调性的二分直接当真值。先固定其他 token 价格、spread 和状态，明确 index/collateral 联动规则，再由真实 predicate 验证边界及相邻单位；不存在可表示边界时明确记录。
- 共享 API/FESOL-65 消费相同 JSON；T04.b 未确认前可做纯 model 用例，不能据此自行补 API 字段或绕过 reviewed contract。

## 验证与下一步

T17.a 仅作源码与文档验收：在线 tag ref 与本地 commit 一致，固定 tag 的 12 个源码链接和 11 个关键 symbol 校验通过，差异及版本缺口可复查；本轮四份文档的 140 个本地链接检查和 `git diff --check` 通过。未执行 cargo、SDK 数学测试、根类型、bundle 或钱包/交易验收；本轮未改产品代码，因此没有本轮 EVM 行为回归通过结论。此前测试结果不作为本轮数值验收。

## T17.b1 生成器首个子集（2026-10-28）

源码：[Cargo.toml](../tools/solana-trade-math-vectors/Cargo.toml)、[main.rs](../tools/solana-trade-math-vectors/src/main.rs)、[输入集](../tools/solana-trade-math-vectors/inputs.json)、[执行说明](../tools/solana-trade-math-vectors/README.md)。工具不接入前端/SDK生产依赖，不访问RPC或旧服务。`gmsol-model`固定commit；序列化/摘要依赖精确版本，工具 `publish=false`，仅忽略自身target，锁文件已生成并保留；参考值为 [vectors.json](../tools/solana-trade-math-vectors/vectors.json)，复用验收入口为 [verify.mjs](../tools/solana-trade-math-vectors/verify.mjs)。

| 子集 | 输入数量 | 实际调用及边界 |
| --- | --- | --- |
| 费用 | 15 | `FeeParams::fee::<20>`；improved/unchanged/worsened，零金额、无/半/全折扣及逐阶段舍入。输入是已合并factor，不证明GT rank/referral组合或身份验证 |
| positive impact cap | 8 | `PerpMarketExt::cap_positive_position_price_impact`；正配置高于/低于负配置、pool cap/空pool/刚好pool边界、零/负impact、factor余数。未计算raw impact或执行价 |
| position PnL | 20 | `PositionExt::pnl_value`；long/short及两种collateral标志、side OI跨两抵押合计、零/有限/未命中盈利cap、亏损及部分减仓舍入。仅种入只读数学状态，不代表仓位有效性或执行通过 |

输入数值为明确的离线数学用例，不是真实市场捕获，也不绕过任何在线前置。所有金额使用十进制字符串；非规范数字、未知字段、重复/空id、非法价格/factor/decimals、空仓或delta大于size整次拒绝。model错误和 `None` 与真实零值分别输出。所有case先计算完成再写stdout；调用方仍必须按成功退出和原子替换规则发布向量，不能直接覆盖已验收JSON。

输出设计携带编译时源码/manifest/Cargo.lock摘要、输入摘要、rustc版本与协议commit；原始输入随输出保留。USD20转USD30用整数十进制精确扩展，避免i128乘法溢出；fee保持输入amount原单位，不擅自标为USD。**Cargo.lock、编译、生成输出、两次一致性和独立数值验收已完成；SDK/API消费仍未实施。**

本轮静态核验：Python3.11读取TOML，核对固定commit及在线tag、43个唯一输入/整数范围/价格有序性、14个固定tag源码symbol；全部通过。JSON Prettier、文档链接和差异检查通过。既有SDK fees/positions两文件55项通过、零skip/失败/联网尝试、清理通过；只是当前EVM源码基线，不证明Rust生成器或Solana数值正确。首轮临时审计使用系统Python3.9无 `tomllib` 而退出，改用已有Python3.11通过，未安装包或改业务预期。

### Rust安装与首个子集验收（2026-10-28）

用户已明确授权安装Rust 1.90.0（Cargo/rustfmt）、下载固定依赖并仅编译运行本地生成器。官方rustup minimal安装于本机Cargo目录，未改shell启动文件；rustc为 `1.90.0 (1159e78c4 2025-09-14)`，host为aarch64-apple-darwin。命令显式选 `cargo +1.90.0` 并在进程PATH前置Cargo bin。授权只覆盖本生成器，不扩展到其他构建、部署或交易。锁文件固定协议v0.10.0 commit和registry校验和，后续运行使用 `--locked --offline`，不例行重生成锁文件。

实际编译成功，两次生成43组JSON字节一致，接受文件SHA-256为 `73c85c3b46102bea392f85a7977535f6133563563dd72a09fff4c0d78ae0cd02`。纯BigInt验收器独立核算15费用、8正impact cap、20PnL的全部输出和USD30单位，校验来源/输入/锁摘要；18类非法输入整次失败且stdout为空，另用有效边界输入证明model错误保持error而非零。已有43组均为ok，因合法factor范围使fee None不可达，没有声称该防御分支已运行覆盖。输出来自真实固定Rust model，JS仅验收，不生成或补写参考值。

首次运行揭示long的uncapped输入仍因spread被1000 USD池值轻微cap；将这两组long池量增到2000000000，使pool值2000 USD高于side PnL 1002 USD，按其原用例目标修正输入并重新生成，未改model/公式或手填期望。long部分减仓tokens向上取整、short向下取整均已独立核对。rustfmt、脚本零warning lint/Prettier通过；原EVM SDK fees/positions两文件55项/0skip通过，零联网尝试，source/tooling不变且cleanup passed。完整命令与可追溯结果见[第五十轮记录](solana-implementation-research.md#第五十轮实施记录t17b1-rust安装与首个向量子集验收2026-10-28)。

下一轮从T17.b2动作/清算predicate子集继续，复用已安装工具链和同一生成器，不积累未经编译代码；此安装授权不应再作为阻碍，也不需再次询问同一生成器的必要编译。即时impact/acceptable price、清算/minima、funding、程序层费用退款及SDK/API共用消费仍未覆盖。T19继续等待完整独立向量和T04.b reviewed字段，不将首个子集完成等同T17或FESOL-57完成。T24.b2参数与prepare账户校验仍为其明确接手点，未因本轮授权切片而完成。

## T17.b2a 动作初始化的清算边界子集（2026-10-28）

本轮接续b2，先完成一个可独立验收的限定子步骤，不将整个动作/清算矩阵标为完成。沿用同一生成器/锁文件及Rust1.90.0授权；实时FESOL-57于 `2026-10-28T02:01:31.245Z` 抓取，正文、关系及1条评论不变；线上tag仍指向固定commit。限定搜索open主前端PR的标题/分支中的57、math、liquidat未命中，不代表所有远端分支都无相关工作。

新增28组 `liquidation_check` 输入：long/short × long/short collateral，各覆盖杠杆最低抵押、市场最低抵押、二者相等、剩余抵押非正、显式null的协议factor回落、三种token价格spread；short collateral另覆盖开平仓费用及清算费排除的成对对照。每组通过真实 `market.deposit(...).execute()` 与 `position.increase(...).execute()` 初始化，并保存开仓后size/tokens/collateral/fee/execution/impact；不手填仓位或伪造动作report。随后对三个相邻raw index价格调用 `check_liquidatable(prices,true,true)`，同时保存普通 `for_liquidation=false` 的结果和原因，总84个价格点各执行两类predicate。

本子集显式把swap/position impact及swap fee置零，模型clock不推进，故无累计borrowing/funding。初始价格、存入流动性、抵押数量、size、minima、普通/清算factor及费用均来自JSON；其余reserve/OI/PnL限额、borrowing/funding配置和模型精度调整沿用固定tag的 `TestMarketConfig` 默认值，不冒充真实市场参数。所有probe均为亏损，不覆盖盈利PnL cap。long collateral场景按输入显式联动long/index min，short collateral场景long价格保持输入值；没有隐含价格联动。

边界由该限定场景的独立仿射关系推导，输入保留候选值减一、候选值、候选值加一；不是粗采样或假定通用单调性的二分。不可整除时保留边界两侧的相邻可表示价格，不声称存在精确相等点。例如long/long collateral，1000 USD仓位、10 token size、2 token抵押、清算factor5%、普通factor10%、市场minimum20 USD时：剩余抵押为 `12 * tokenPrice - 1000`，87.5 USD刚好满足50 USD清算门槛，但仍不满足100 USD普通margin门槛。真实predicate确认该点不清算、低一个raw价格单位清算，且三点均普通margin不足。市场minimum与leverage相等时，低于门槛优先报告 `min collateral`；minimum为0时精确0报告 `<= 0`，负值仍按程序报告 `min collateral`，不改写原因。

`liquidation_collateral_factor`必须显式为规范字符串或null，遗漏拒绝。null只验证协议getter回落普通factor的既有行为，绝非允许API缺字段静默回落。订单费为0.1%的对照在开仓和关闭估算时各扣1 USD；将清算费从0变为90%的压力输入不改变predicate及关闭费用，验证程序判断是否清算时不包含清算费。这不是实际清算付款或执行成功证据。

当前 [vectors.json](../tools/solana-trade-math-vectors/vectors.json) 共71组；原43组case的输入/输出逐项与前一接受文件相同，仅来源元数据/scope更新。两次Rust输出字节一致，SHA-256为 `91a2e15a8db60bb7e8399fc393f10d5989d5726ca636757d0b77e677a63c56c7`。独立BigInt验收核对开仓结果、所有84点PnL/抵押/关闭费/布尔及原因、相邻单位和跨边界、factor差异与null回落、清算费排除；27种非法输入/无效setup非零退出且stdout为空。另有model conversion及单probe溢出，确认error与零/不清算分开，其他probe保留正常结果。

复现仍用工具README的两次 `cargo +1.90.0 run --locked --offline` 和 `verify.mjs FIRST SECOND`；rustfmt、脚本lint/Prettier及已有EVM fees/positions两文件55项/0skip通过，network拒绝次数0、source/tooling不变、cleanup passed。完整命令及原生证据见[第五十一轮记录](solana-implementation-research.md#第五十一轮实施记录t17b2a-动作初始化清算边界子集2026-10-28)。只修改工具及文档，无生产SDK/React/StateCtx/API、依赖锁或flag变化；根类型/最终bundle、真实页面/钱包/交易未验。

下一步T17.b2b：先补非零position impact下increase report与acceptable-price相邻边界，再补非零impact清算、累计borrowing/funding、盈利状态、min-position/decrease限制及其余矩阵。当前向量不是一般清算价求解器；T17/FESOL-57仍实施中，T19及生产页面消费未实施。

## T17.b2b 即时impact增仓与限价边界子集（2026-10-28）

接续b2a，新增32组 `increase_impact`，每组先真实deposit及独立seed position increase建立OI，再通过model pool delta明确设置输入的impact pool快照。快照用于构造空池/不足/刚好足够等数学边界，不是链上转入或pool分发验收；seed action自身的impact、tokens及execution price保留。每个目标baseline和限价probe都克隆同一初始market并使用新position，避免失败动作的部分状态污染后续尝试。baseline的acceptable=None仅用于离线获取report，生产市价单仍必须显式限价。

矩阵为long/short × long/short collateral × 8种情况：正impact未封顶、池不足、空池、最小可表示足够池量、配置正cap、负impact、零impact及OI跨边。每组JSON输入提供独立推导的成交价减一、相等、加一，共96个限价probe；long相等/较高通过，较低拒绝，short相等/较低通过，较高拒绝。32个预期拒绝保留为模型error，不计为工具失败，也不当作执行成功。

本子集impact exponent=1；raw impact按初始/下一OI分别定点计算后相减，跨边使用正/负两项，不能把差额先相减再乘而改变舍入。模型raw正factor取positive/negative较小值，与max-positive配置cap是不同参数；后者直接使用，不能再与max-negative取小值。cap仅对正impact生效；负impact增仓在本入口保持raw值。正impact token按index max截断，负impact绝对值按index min向上取整；long基础tokens按max截断，short按min向上取整，随后立即加/减signed impact token，最后执行价为size/tokens整除。配置正cap场景为0.5%、max-negative为0.1%、raw正impact约2%，实际按0.5%封顶。负场景约-3%，未套用该0.1%上限。seed/target的size USD20和index spread有余数，独立核算覆盖这些舍入顺序。

输入显式给价格、流动性、seed/target size与抵押、impact factors、两个cap与pool数量。订单/swap费与swap impact为0，不执行时间推进或funding/borrowing更新；minimum position/collateral为1 USD、普通margin factor10%、liquidation impact cap1%，其余reserve/OI/PnL限额及模型精度调整使用固定tag测试defaults。成功report保留raw/capped impact、token impact、size、collateral、cost、execution、funding输出及pool剩余，确认即时impact进入实际仓位结果。没有pending/lent impact。非线性指数、virtual inventory及非零impact清算尚未验。

参考集累计103组；之前71组case输入/输出完全不变。固定输入格式后两次Rust输出字节一致，SHA-256 `4a3fb1d49ade1bb048a2f18feb70f9114b6bb4e072747a1d95cd1bbe538980d0`。独立BigInt核对全部结果及96个限价点，36种非法输入/无效setup整次拒绝且stdout为空，原有model/probe错误区分通过。Rust fmt/check、脚本lint/格式及EVM fees/positions两文件55项/0skip/0联网通过。完整命令与原生证据见[第五十二轮记录](solana-implementation-research.md#第五十二轮实施记录t17b2b-即时impact增仓与限价边界2026-10-28)。

下一轮T17.b2c：复用动作初始化，补非零impact下的清算/保证金predicate，验证关闭时正impact忽略、负impact按liquidation cap及minima处理；之后补累计borrowing/funding、decrease/限额等余下矩阵。T17/FESOL-57仍实施中，T19仍需完整参考矩阵及T04.b reviewed字段；本轮没有生产数学或页面接线，不代表前端交易可用。
