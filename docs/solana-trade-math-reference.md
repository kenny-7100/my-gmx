# Solana 交易数学差异与独立参考向量

核验日期：2026-10-28。对应 [FESOL-57](https://linear.app/gmx-io/issue/FESOL-57/add-gmsol-branches-to-the-sdk-trade-math)、本地 T17/T19。本页记录 **T17.a/b1、b2a至b2d10限定数学子集验收**。复用已授权Rust1.90.0限定构建；生成器、锁文件和435组独立Rust参考值已落盘并验收，SDK数学未修改，T17父任务仍实施中。

## 固定版本与证据范围

- 首轮权威需求实时抓取于 `2026-10-27T22:08:38.596Z`，updatedAt `2026-10-25T23:43:47.128Z`，已包含正文、关系和 1 条评论，无 GMTrade 标签。评论询问计算与共享结构，没有新增已确认行为。
- 需求指定协议 [v0.10.0](https://github.com/gmsol-labs/gmx-solana/tree/7ce035b41a266cb5ddb0192e5d29deb0c7e67a72)；本地 `v0.10.0^{commit}` 和在线 GitHub tag ref 均为 `7ce035b41a266cb5ddb0192e5d29deb0c7e67a72`。下文 Rust 路径/函数均按此提交读取，不能按本地 HEAD 的行号定位。
- 本地 `gmx-solana` HEAD 为 `f102501f30635062fac156ca05831c0fb63a8590`。其 model 相对 tag 有 4 文件、223 行新增/8 行删除，涉及 fee credit 和 decrease；不能用 HEAD 生成值后标为 v0.10.0。
- 本机 npm WASM `0.9.0-test.2` 是另一版本。现有 [基础向量入口](solana-sdk-vectors.md) 仅验证 `apply_factor`，Python 生成器和 WASM 输出都不能替代本需求的独立 Rust model 业务参考值。
- 首轮核对的在线 release 为 `d4b8c32147dd604d8d062d76c00a75ec4f0bbb7a`；其递归 tree 中没有 `sdk/src/utils/gmsol/`。以 FESOL-57 查询 PR 仅返回已合并的静态配置 #3111；补查 open Solana math 返回价格 #3138，无直接数学实现命中。这是限定搜索结果，不代表所有分支均无工作；实施 T19 前仍须增量核对。
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

## T17.b2c 非零impact清算与保证金边界子集（2026-10-28）

接续b2b，同一生成器增加 `liquidation_impact` 显式操作，复用原清算动作与predicate路径。新增28组：long/short × 两种抵押 × 正impact忽略、负impact封顶、负impact未封顶、负impact零上限、市场最低抵押、非正抵押及普通margin边界。每组保留三个相邻raw index价格，新增84点；累计清算/margin各168点及增仓限价96点，总131组参考case，旧103组输入/输出逐项不变。

配置指数为1、positive factor2%、negative factor3%、普通negative cap0.1%；开仓1000 USD在空OI下真实产生-30 USD冲击，long基础10 token减至9.7，short增至10.3，后续PnL直接使用实际token size。正关闭冲击场景没有反向仓位，raw为+20 USD，但predicate贡献为0。负场景在目标开仓后真实增加独立3000 USD反向仓位，关闭目标使OI进一步失衡，raw为-30 USD；清算上限1%时贡献-10 USD、5%时-30 USD、0时0。反向action的impact/tokens/execution/funding report和实际双边OI也保留并独立核算，没有直接覆写OI或移植旧业务状态。

固定tag的 `PositionExt::check_liquidatable` 调用 `cap_negative_position_price_impact(..., true, ...)`；这个true同时用于清算和普通保证金predicate，两者的区别在抵押因子：清算5%，普通10%。不能把普通保证金检查误改成使用0.1%的普通negative cap。剩余抵押为 `collateral * collateralMin + actualTokensPnL + min(rawCloseImpact, 0)AfterLiquidationCap - closingCost * collateralMin`；判断顺序仍为市场minimum、非正值、size×对应factor。20 USD minimum配合5%因子验证杠杆边界，80 USD minimum验证minimum优先，0 minimum/0清算因子验证非正边界；普通margin专属三点在10%门槛两侧且均不清算。阈值由该固定无spread/无费用场景的仿射式独立推导，保留相邻价格，不代表通用单调曲线或通用清算价求解器。

所有价格/金额/factor由输入显式给出，seed后的OI只通过真实动作形成；开仓可支付的抵押、流动性与其余reserve/OI/PnL/精度参数使用固定tag测试defaults。不推进clock，order/swap/liquidation fee与swap impact为0；不覆盖非线性/virtual inventory、盈利清算、累计borrowing/funding、claimable payout、真实部署配置或程序执行转账。新操作缺字段/非法factor/非规范金额/零反向size带抵押/反向动作初始化失败整次拒绝，未给缺失业务字段添加静默兜底；旧操作的零impact范围保持。

两次Rust输出字节一致，131组独立BigInt核算、43类非法输入/setup拒绝、model/probe错误区分通过；接受JSON SHA-256 `a1034db35147f182d9df57e4bb9e7b7e8125913ee86e2aa26a9497359352e115`。EVM fees/positions两文件55项/0skip/0联网尝试、Rust check/fmt、脚本lint与输入/脚本格式通过。实际命令和原生证据见[第五十三轮记录](solana-implementation-research.md#第五十三轮实施记录t17b2c-非零impact清算与保证金边界2026-10-28)。无生产SDK/共享状态/UI接线，T17/FESOL-57仍实施中；下一轮T17.b2d累计borrowing/funding与下一动作claimable结算参考，先核对固定tag的clock/update及真实动作路径，再确定可独立验收子集。其后补减仓/min-position/限额和程序费用退款；T19仍待完整矩阵与T04.b reviewed字段。

## T17.b2d1 累计借款费与增仓结算子集（2026-10-28）

将b2d拆为b2d1 borrowing、b2d2 funding/claimable，后者未完成。本轮在同一工具增加 `borrowing_accrual`：初始化借款时钟，真实deposit/open，按显式秒数推进并调用model update_borrowing，最后两次真实增仓。新增28组（两side×两抵押×7）：零时间、raw dust、首个raw token单位、37% receiver分配、分段时间、100% receiver和零borrowing factor。累计32次update与56次后续增仓；旧131组输入/输出完全不变，总159组。

指数固定1、kink参数全0禁用、skip-smaller-side=false。long reserved value为实际OI tokens×index max，short为size USD20；pool value使用对应side流动性×该资产min价格。独立整数核算依次为 `usage = reserved * UNIT / poolValue`、`rate = usage * borrowingFactor / UNIT`、`cumulative += rate * seconds`、`pendingUsd = size * (cumulative - positionFactor) / UNIT`。保留更新前position pending、market按elapsed投影的pending与更新后值；仅move clock不会更新position pending。输入含index/long/short spread与size余数，不能把usage和factor合并计算而改变舍入。

费用先按抵押min价格截断为raw token，再按receiver factor截断分配，剩余进入流动性；两份model report和实际collateral/liquidity/claimable fee pool数量均独立核对。short collateral的1秒场景为非零USD但0raw token，11秒场景跨过首个单位；USD paid fee保留完整pending值，即使token扣费为零，position factor也更新，不虚构dust carry。首次后续增仓扣费后pending归零，第二次在同一累计因子下增仓不再收旧费；保留size/tokens、position factor与total_borrowing accounting。后续size必须非零，因为固定model的increase拒绝零size；本轮没有将纯top-up作为替代动作。

固定TestMarket时钟为Instant加显式advanced时间。每次update报告的秒数必须与输入相等，否则整次拒绝且不发布JSON；不修改参考模型、不归一化时间。先格式化输入再生成两份，避免来源摘要变化。每段时间必填、非空且不超过一年；这是该工具的有限数学输入域，非生产协议时间限制。swap/order费用与impact为0，不调用funding update，其他reserve/minima/PnL/精度参数使用固定tag defaults；零claimable输出不证明真实资金费结算。

最终159组两次字节一致、独立BigInt核算和51类非法输入/setup拒绝通过，SHA-256 `704e25b09cc11270b3aae815cf59cce6531e18682e918da07390fe6eb7225306`。EVM两文件55项/0skip/0联网尝试、Rust check/fmt、脚本lint/格式通过，完整命令及原生证据见[第五十四轮记录](solana-implementation-research.md#第五十四轮实施记录t17b2d1-累计借款费与增仓结算2026-10-28)。本轮无生产SDK/共享状态/UI接线，T17/FESOL-57仍实施中。下一轮从b2d2真实funding update及下一动作claimable report继续；kink/skip-smaller-side、累计费用清算边界、盈利状态、减仓/min-position/限额、程序折扣与rent/keeper转账及T19消费仍待，不能以本子集完成累计费用父范围。

## T17.b2d2 线性funding累计与claimable报告子集（2026-10-28）

同一生成器新增 `funding_accrual`，真实deposit后创建四仓位（long/short×两种抵押），初始化时钟、推进输入秒数、执行update_funding，再逐仓位两次真实增仓。16组覆盖两种付款方向×零时间、微量舍入、普通累计、零factor、平衡OI、rate封顶、零cap及分段累计；共18次funding update、128次后续增仓。旧159组输入/业务输出不变，总175组。固定tag来源不变，未使用WASM status或JS生成参考结果。

本子集指数1、increase/decrease rate参数0，使用协议fallback funding factor并显式配置max rate。每side两种抵押的OI相等，side总OI为输入size的两倍。先按 `abs(longOI-shortOI)*UNIT/totalOI` 截断，再乘funding factor并以max cap封顶；funding USD值由payer OI×rate×seconds截断，按payer各抵押OI比例再次截断。两种抵押采用各自max价格，不能换成min；模型adjustment=10^10。payer先将 `value*adjustment*UNIT/该抵押payerOI` 向上取整，再除price向上取整；receiver按整个receiver side OI和price分别向下取整。pending再按仓位size解包，payer向上、claimable向下；独立BigInt核对每一步，避免把两次除法合并。

每个receiver无论自身抵押类型，都能有long/short两种token claimable。首次下一动作report返回这两项并更新funding和两个claimable快照，pending归零；第二次在没有funding update时收费/claimable均0。按token比较总收费≥总claimable，余数不凭空分配。微量场景付款非零而两项领取均0，保留不同舍入；零时间/factor/cap及平衡OI场景实际均0。fallback模式stored next factor为0仍可累计非零funding，不能误把这个字段当实际rate。四仓位的下一动作顺序变化了OI，但没有再次update，因此不应追溯修改既有累计值。

本轮只验证report应付数量与快照重置，**不是vault转账或真实钱包到账验收**。固定模型调用者必须使用report的claimable数量完成外部转账；本工具不广播/签名。borrow update未调用，order/swap费用和impact为0，其余固定tag test defaults保留。时间间隔显式、非空且各不超过一年；沿用秒级clock drift整次拒绝。动态funding rate、方向反转、不对称抵押OI、单边OI、累计费用清算、真实部署参数及付款仍未覆盖。

两次输出字节一致，175组独立核算、60类非法输入/setup拒绝通过；JSON SHA-256 `cc9cc56273f6d4add742f24cecf6d54236c2c2408313c0954f5bc0421204c4f5`。EVM两文件55项、Rust check/fmt及脚本lint/格式通过，详见[第五十五轮记录](solana-implementation-research.md#第五十五轮实施记录t17b2d2-线性funding与claimable报告2026-10-28)。T17与b2d父范围仍实施中，下一轮优先T17.b2d3动态funding rate及方向反转，复用同一生成器补真实update路径；之后累计费用清算/减仓等余下矩阵。T19仍待完整矩阵/T04.b reviewed字段，未接生产SDK/共享状态/UI。

## T17.b2d3 动态funding与方向反转子集（2026-10-28）

同一生成器新增 `dynamic_funding`，24组、42次真实update：两种初始方向分别覆盖增长、稳定、decrease/stable阈值相等、衰减、衰减保留符号最小值、偏斜反转、max封顶、active min、零时间、零stored配min和平衡OI。通过真实increase改变OI并保留所有仓位，未直接注入OI或stored rate。每步记录新仓report、双边OI、previous/next signed factor、active magnitude/payer及四维funding/claimable delta；旧175组输入/业务输出完全不变，总199组。

固定tag的 `FundingFeeParams::change`、`next_funding_factor_per_second` 和 `Unsigned::bound_magnitude` 是语义依据。指数1，先将abs(OI差)/总OI定点截断，再乘increase factor截断、乘秒数；只有stored方向与偏斜相同才按阈值选择增长/稳定/衰减，等于任一阈值时稳定。衰减量达到stored幅度时保留±1，不能归零。next只受max约束，active magnitude另外应用min，零stored在非零min下为正方向。平衡OI在动态模式可保留原rate，不能沿用fallback模式的平衡归零结论。

初始3000/1000 USD、10秒得到±5×10^12 stored；原轻侧真实增仓6000 USD后偏斜反向，下一10秒stored仍为原符号±10^12，仍由原方向支付，再10秒跨零至反向3×10^12后才换payer。独立BigInt核算每步并断言轨迹确实命中增长/稳定/衰减/反转及上下限，不能直接由当前OI较大方决定payer。

该有限子集所有新仓使用short collateral，每仓固定1000000000 raw抵押；真实deposit固定long 100000000000000 raw、short 10000000000000 raw。funding USD按实际payer OI×active rate×seconds截断，short collateral max价packing：payer两次ceil、receiver两次floor，adjustment10^10；long collateral delta为0。prices和动态参数/每步增仓及秒数显式，其余test defaults保留，order/swap费用与impact为0，不执行borrow update。双边OI必须非零；时间沿用一年工具域和clock drift整次拒绝。本轮不结算既有仓位，不证明反转后的pending/settlement或外部token付款。

两次Rust输出字节一致，199组独立核算、70类非法输入/setup拒绝、model/probe错误与零区分通过；JSON SHA-256 `87b613d1174bdddd35cbcf24821b0a9e2c7edb5fef485933f786ee210d64cb45`。本轮Rust check/fmt、脚本lint/格式和EVM费用/仓位55项通过，命令及证据见[第五十六轮记录](solana-implementation-research.md#第五十六轮实施记录t17b2d3-动态funding与方向反转2026-10-28)。无生产接线，T17及b2d仍实施中。下一轮T17.b2d4补不对称混合抵押OI及单边OI funding，随后补反转结算、累计费用清算及剩余矩阵；T19仍待完整矩阵与T04.b reviewed字段。

## T17.b2d4 混合抵押与单边OI funding子集（2026-10-28）

新增 `funding_distribution`，复用原funding累计/结算函数，按四维size分别真实开仓；零size表示无该仓位，opened/pending/settlements为null，市场delta仍完整保留。旧funding入口继续要求双边非零且每side两种抵押等size，原199组输入/输出逐项不变。新增24组、26次update、168次后续increase，总223组：两付款方向×不对称抵押、分段时间、dust、零时间/因子、平衡、rate cap、付款方仅long/short抵押、接收方仅long/short抵押和单边OI。

固定tag `UpdateFundingState::next_funding_amount_per_size/set_deltas` 先计算payer总funding USD，再按payer每种抵押OI占比分别floor，分配后的值之和可能小于总值；不能将一方余数补给另一方。payer packing分母是该抵押的payer OI，两次ceil；receiver packing分母是整个receiver side OI，两次floor；两者使用各自collateral max价。`pack_to_funding_amount_per_size` 在funding value或分母OI为零时返回真零，不能直接除零。receiver只有一种抵押仓位时，仍按其size领取两种token。独立核算全部delta、pending、首次结算report、快照重置及第二次不重复收费/领取，并检查逐token总收费≥总领取。dust场景特意选择非零rate，付款raw token非零而claimable为零。

任一side OI为零时，模型在计算rate之前返回空report，实际update写入next factor0。本子集从stored0开始验证零delta/零pending/零结算，**尚未验证从已有动态rate进入单边OI的状态转换**，不由源码检查冒充该验收。无仓位null与已存在仓位费用真零分开；全四size为0拒绝。其他非法输入包括缺size、数组长度错误、非规范金额、时间空/越域、factor越域、无效价格和未知字段。

固定数学setup：index/long/short decimals=9/9/6，流动性long 100000000000000、short 10000000000000 raw；每个有效仓位抵押long 10000000000或short 1000000000 raw；每次后续增仓1 USD并补long 1000000000或short 100000000 raw。prices、四size、funding factor/cap和时间显式给定；线性fallback、动态参数0、无borrow update、order/swap fee与impact0，其余固定tag defaults不变。沿用clock drift整次拒绝；不是部署参数或外部付款证据。

两次Rust输出字节一致，223组独立核算、79类非法输入/setup拒绝通过；JSON SHA-256 `78b68e32a1018d2eaa6b352394404b66fce713b916f66bfe815d368d0ea20b75`。Rust check/fmt、脚本lint/格式及本轮EVM两文件55项通过，详见[第五十七轮记录](solana-implementation-research.md#第五十七轮实施记录t17b2d4-混合抵押与单边oi-funding2026-10-28)。工具不接入生产SDK/StateCtx/UI，T17/b2d及整个集成仍未完成。下一轮T17.b2d5补动态方向反转后的旧仓pending与结算，之后补动态单边转换、borrow kink/smaller-side及剩余矩阵；T19仍待完整参考与T04.b reviewed字段。

## T17.b2d5 动态反转后旧仓结算子集（2026-10-28）

新增 `dynamic_funding_settlement`，沿用dynamic输入，显式要求 `is_long_collateral`；复用动态轨迹与真实增仓，保留每个仓位并记录每次update后的pending。新增24组：两初始付款方向×两抵押token×普通反转、分段时间、反转后转回、零时间、active min及rate cap，共84次真实funding update、152次后续increase。旧223组输入/业务输出不变，总247组；原dynamic操作仍只有原输出及short抵押，不增加其结算副作用。

每个新仓在真实开仓时取当时market fee和两个claimable因子为初始快照，不能领取开仓前资金费；之后各side的fee/claimable累计分开递增，付款方向改变不会抵消旧的应付与应领。独立BigInt保存每仓出生快照，按每次update的两层ceil/floor结果累计，再用原size解包pending：cost向上取整、两个claims向下取整。两个初始旧仓在最终结算前均有非零应付及应领；首次真实增仓report分别返回两项并更新三份快照，未扣成一个净额；第二次无update增仓返回零，pending也归零。结算顺序改变OI，但没有再次update，不回算已累计funding。逐token总收费≥总领取。

每组只使用一种抵押品：long抵押组long claim非零、short claim为零，short组相反；没有声称同一动态场景同时领取两种非零token。两种抵押token、min/max和两个初始方向都实际验，混合抵押同时参与动态反转仍属剩余矩阵。开仓long 10000000000或short 1000000000 raw；后续每次增仓1 USD并补long 1000000000或short 100000000 raw。其余流动性/价格/模型配置延续dynamic，borrow update不调用、order/swap费与impact0，严格检查时间漂移。本轮是report/快照验收，不是vault或钱包转账。

最终247组两次输出字节一致、独立核算及86类非法输入/setup拒绝通过，SHA-256 `7aeb310ecdceb25ff9967060d45c70658f4685703150094017bb3dbc58bca7af`。Rust check/fmt、脚本lint/格式、本轮EVM费用/仓位55项通过，详见[第五十八轮记录](solana-implementation-research.md#第五十八轮实施记录t17b2d5-动态反转后旧仓结算2026-10-28)。下一轮T17.b2d6从真实全平动作核对非零动态费率转单边OI，验证next清零与既有累计保留，再补混合动态/borrow kink/smaller-side等剩余矩阵。T17及b2d仍实施中，T19依赖完整参考与T04.b reviewed字段，未接生产共享状态或UI。

## T17.b2d6 非零动态费率转单边OI子集（2026-10-28）

新增 `dynamic_funding_single_side`，复用动态暖场、pending及结算路径；显式transition含close_long和非空elapsed_seconds。暖场必须得到非零stored factor，再逐仓真实全平指定side，核对恰好一边OI为零，之后执行资金费更新及幸存仓位的两次增仓。未直接覆写OI、快照或费率。16组覆盖两初始方向×两抵押token×关闭任一side×minimum/reversal暖场：32次暖场update、20次真实全平、48次单边update、40次幸存增仓。旧247组输入/业务输出不变，总263组。

固定tag `UpdateFundingState::next_funding_amount_per_size` 在任一side为零时返回empty report，`execute`将next写为0；这在elapsed=0和配置min rate非零时也成立，不走正常rate/min计算。每组实际连续更新0/10/10000秒，首个previous为暖场非零值，后续为0；四维market funding/claimable累计保持暖场值，delta全0。幸存仓位pending逐项保留，不随rate清零而消失；第一次增仓结算原累计，第二次无update返回0。

关闭side可能包含多个仓位，全部通过 `DecreasePosition::execute` 全平。逐仓比对report应付/两种claimable、should_remove=true与remaining size0；平仓会结算该仓旧pending，但不改变其他仓位的累计或市场funding因子。独立核算器保留每仓出生快照，并同时核对关闭报告和幸存结算。已关闭仓位后续pending/settlement为null，不查询其零size pending或重新开仓。这里不验证完整减仓PnL/output分配、租金或vault付款；全平只是本子集建立真实OI转换的必要动作。

延续dynamic单一抵押token、固定流动性/抵押、零order/swap费与impact、不调用borrow update和严格clock drift拒绝。新transition拒绝缺字段、缺close bool、空/越域时间、未知字段，暖场stored为零或初始单边也拒绝；不把无效前置当清零通过。未覆盖全部OI为零、重新进入双边OI、混合抵押动态反转和真实转账。

最终263组两次字节一致、独立核算及93类非法输入/setup拒绝通过；SHA-256 `cbc8ca03ba7f0a5c141d1a7a65c53b69774ba58f81ebd64c962449ddad705b0a`。Rust check/fmt、脚本lint/格式及本轮EVM费用/仓位55项通过，命令/证据见[第五十九轮记录](solana-implementation-research.md#第五十九轮实施记录t17b2d6-非零动态费率转单边oi2026-10-28)。下一轮T17.b2d7混合抵押动态反转累计与结算，再补borrow kink/smaller-side及其他矩阵；T17/b2d及T19仍未完成，无生产共享状态/UI接线。

## T17.b2d7 混合抵押动态反转与结算子集（2026-10-28）

新增 `dynamic_funding_mixed`，复用既有动态轨迹/真实增仓/时钟及pending结算路径。`long_collateral_factors` 是long/short side新增OI分给long collateral的工具fixture份额，不是协议配置；两项均为规范UNIT（10^20）比例且严格介于0和1。每步用固定model `utils::apply_factor` 向下取整long-collateral size，余数分到short collateral，按四维side/collateral矩阵开真实仓位。每仓保留实际抵押类型；未直接覆写OI、累计或仓位快照，原操作默认行为不变。

24组覆盖两初始付款方向、75%/30%与舍入三分之一/三分之二两组不对称份额，以及standard/split/return/zero-time/minimum/capped六种轨迹；84次funding update、304次后续增仓，总287组，旧263组输入/业务输出不变。每case内每side的份额固定，不代表轨迹内份额变化或混合单边转换已验证。

独立BigInt跟踪四维OI：付款collateral funding USD按OI份额floor，payer packing使用该collateral OI并两层ceil；receiver packing使用接收side总OI并两层floor，各token分别用max price。每仓以真实开仓时的fee/两claimable累计作为出生快照，避免领取开仓前累计。四个初始旧仓反转后均保留非零应付与两种非零claims，不净额抵消；每步pending、首次结算/三快照推进、第二次无更新报告零逐项验证，每token总收费≥总领取。这里只验证model报告，不证明vault付款。

287组两次Rust输出字节一致、独立核算及101类非法输入/setup拒绝通过；SHA-256 `593dbe18ed5e5c83a067acf1658e0cb9e69b56a8bddf957562563a240025a2ec`。Rust check/fmt、脚本lint/格式及本轮EVM费用/仓位两文件55项通过，完整命令与证据见[第六十轮记录](solana-implementation-research.md#第六十轮实施记录t17b2d7-混合抵押动态反转与结算2026-10-28)。新增拒绝包括share零/UNIT/越界/非规范、数组长度、缺share、未知字段和末步非法金额，仍整次拒绝而不发布部分JSON。

下一轮T17.b2d8 borrowing kink与skip-smaller-side，复用已有borrowing路径补分段及跳过边界。累计费用清算、全部OI清空/重新进入、完整减仓/min-position/限额、程序费用退款及真实转账仍待；T17/b2d父项及整个集成未完成。工具不进入生产SDK/共享状态/UI，T19仍待完整参考矩阵与T04.b reviewed字段，页面仍占位。

## T17.b2d8 Borrowing kink与较小侧跳过子集（2026-10-28）

新增 `borrowing_kink`，复用原borrowing真实时钟/update、pending与两次后续增仓。显式params包含optimal/base/above factor、skip bool、opposite size/collateral、OI reserve factor、max OI及ignore OI bool；两侧用真实增仓形成OI，不直接覆写累计或仓位快照。旧操作默认线性/不跳过与输出不变。TestMarketConfig给两侧相同kink参数；本子集不覆盖两侧非对称配置或累计过程中的OI变化。

固定v0.10.0 `market/borrowing.rs` 先按USD OI严格比较较小侧，相等不跳过。optimal为0选择原线性公式；非零时usage为 `max(reserved / floor(pool_value * oi_reserve_factor / UNIT), side_oi / max_oi)` 的UNIT比例，除法各自floor，ignore OI显式为true时只用reserve usage。long reserved由tokens乘index max，short直接size，pool用对应token min。基础rate为 `floor(usage * base / UNIT)`；usage大于optimal且optimal小于UNIT时加 `floor(max(above - base, 0) * (usage - optimal) / (UNIT - optimal))`。optimal=UNIT无除零；above不高于base时附加斜率为零，不做负扣减。

新增60组：两side×两抵押token×15种profile，涵盖阈值相邻一单位/相等、正附加斜率、optimal0/1、above等于/低于base、较小/相等/较大side开启skip及关闭skip对照、OI主导、ignore OI和reserve factor一半。线性factor与kink base刻意不同，避免零optimal分支不可区分；相邻高一单位可能因floor仍无rate增量，不夸大为可观察跳变。每组0/17/10000秒，共180次update和120次后续增仓；独立核对两侧累计、被验仓位pending/首次结算、receiver/pool分配、快照重置及第二次零收费。对侧仓位用于真实OI/两侧累计，保持开仓，未执行其结算或付款。

总347组两次字节一致、独立BigInt核算、111类非法输入/setup拒绝通过；旧287组输入/业务输出不变，JSON SHA-256 `482c2c0a4d55785f38ca390104d527ce2440adf9562076dd89f6554f2f8db41e`。Rust check/fmt无warning，脚本lint/格式及本轮EVM费用/仓位55项通过，命令和原生证据见[第六十一轮记录](solana-implementation-research.md#第六十一轮实施记录t17b2d8-borrowing-kink与较小侧跳过2026-10-28)。

下一轮T17.b2d9累计借款费后清算边界，核对pending与清算predicate，再补相邻价格；累计funding清算、动态OI跳过转换、完整减仓及费用退款等仍待。没有生产SDK/共享状态/UI接线或真实转账验收，T17/b2d父项及整个集成未完成，T19仍待完整矩阵/T04.b reviewed字段。

## T17.b2d9 累计借款费后清算边界子集（2026-10-28）

新增 `liquidation_borrowing`，复用既有清算真实开仓及 `check_liquidatable`，显式borrowing factor/非空elapsed intervals。存入流动性后先初始化clock，再开仓、按entry prices推进时钟/执行线性borrow update；不结算费用或覆写仓位快照。kink禁用，skip-smaller-side=false，开仓order fee与impact均零。原清算操作不推进时钟且输出不变。

40组为两side×两抵押token×零时间/17+10000秒×leverage/minimum/nonpositive/margin/liquidation-fee-excluded五种profile，共60次update、120个相邻原始价格点。每组保持抵押token价格不变，只变index价格；固定tokens下剩余价值对index price为仿射关系，BigInt独立推导阈值及前后各一单位。该fixture不假设真实资产相关性，也不证明通用单调清算函数或一般二分求解器。

核对固定model `position.rs::position_fees/check_liquidatable`：清算使用stored cumulative对应的pending borrowing，按collateral min price转为raw整数后扣价值；不使用尚未update的clock投影，也不将liquidation fee加入触发成本。独立核对累计前同价格的三组reason、每步pending before/after及两side累计、最终closing cost、liquidation与margin reason。20组非零累计各自至少一项reason相较累计前改变；另20组零时间对照保留。25% liquidation fee组与同side/collateral/interval的零liquidation fee leverage组输出完全一致，避免把执行清算成本混进触发判断。

总387组两次字节一致、独立核算、119类非法输入/setup拒绝通过；旧347组输入/业务输出不变，JSON SHA-256 `177c0232b57163e9081d8c29a4143227299599b866d27106f35e51758e5f93b3`。Rust check/fmt无warning、脚本lint/格式及本轮EVM费用/仓位55项通过，详见[第六十二轮记录](solana-implementation-research.md#第六十二轮实施记录t17b2d9-累计借款费后清算边界2026-10-28)。不执行清算或真实付款，尚未覆盖借款费与funding/impact组合、非零opening fee、盈利状态及抵押价格联动。

下一轮T17.b2d10累计funding应付/claimable的清算语义，先核对真实predicate如何计入应付、是否计入可领取部分，再复用参考路径补限定边界。T17/b2d父项及整个集成未完成，T19仍需完整矩阵与T04.b reviewed字段；无生产SDK/共享状态/UI接线。

## T17.b2d10 累计funding应付与claimable清算子集（2026-10-28）

新增 `liquidation_funding`，复用真实deposit/increase与清算predicate；显式funding factor/max、非空interval及两种抵押的opposite size/collateral。先初始化funding clock，开目标仓及两个真实对侧仓，再按entry prices推进时钟/执行fallback funding update，不覆写OI、累计或仓位快照。无borrowing update、opening order fee或impact，也不执行清算/claims结算。

48组为两目标side×两抵押token×payer/receiver×零时间/17+10000秒×leverage/minimum/margin三profile，共72次update和144个相邻index价格点；固定collateral价格，独立BigInt推导仿射阈值。每step核对四维分配/packing delta及目标仓pending before/after，payer按collateral OI先floor、packing两次ceil，receiver两次floor，仓位按累计解包。对应model `PositionFees::total_cost_amount` 加入funding amount，但不扣除claims；`check_liquidatable` 只从抵押价值扣total cost，不加入claims。

12组非零累计付款仓均至少改变一个liquidation/margin reason；12组非零累计接收仓均有两种非零claimable但reason与同价格累计前完全一致，24组零时间对照不变。可领取资金费并不自动改善未结算仓位的清算条件；不将模型应领报告当成实际付款。这里只验证单一付款方向，尚未覆盖同仓同时应付/应领、borrow/funding组合或非零impact。

总435组两次Rust输出字节一致、独立核算、128类非法输入/setup拒绝通过；旧387组输入/业务输出不变，JSON SHA-256 `169d4e3f82b8b59bf327e164bde2969d55bbc8b12c228ac381fbc1c87ee486e4`。Rust check/fmt无warning、脚本lint/格式及本轮EVM费用/仓位55项通过，详见[第六十三轮记录](solana-implementation-research.md#第六十三轮实施记录t17b2d10-累计funding应付与claimable清算2026-10-28)。

下一轮T17.b2d11借款费与funding同时累计的清算成本组合，先核对同一真实market时钟/update顺序及各费用的raw舍入，再补限定边界；非零impact/盈利清算、动态skip、完整减仓/min-position/限额与程序费用退款仍待。T17/b2d父项及整个集成未完成，T19仍需完整矩阵与T04.b reviewed字段；工具无生产SDK/共享状态/UI接线。
