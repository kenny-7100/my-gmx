# Solana 交易链路依赖审计

## 独立推进三项收尾（2026-11-14）

本节补充并更新下方同日上游刷新记录的 CI 与浏览器状态；八个开发/交付 HEAD 均未改变。本轮应用交付 skill，未新增业务修改、未改权限或他人前置分支。

1. **最终 HEAD 的 CI 已收齐。** 四个 PR 的 Audit、general（lint/types/tests）、SDK standalone、GMX WASM reproduction 均 SUCCESS。Component workflow 均 FAILURE，日志确认 Pages deploy 403、报告评论 `Resource not accessible by integration`。19/20/72 各286 passed；56为285 passed/1 flaky，StandardTooltip 按钮内 trigger 的 Tab focus 断言首次失败、重试通过。该组件及用例相对release未改，不作为本次交易代码缺陷处理，也未扩大token权限。组件run依次为56 `43606703406`、19 `43606717930`、20 `43606711408`、72 `43606802412`。
2. **本轮已完成未连接钱包的页面回归。** 使用已有kenny原生Chrome及其钱包扩展，19实际delivery `e4e9067a0fef8d02a84478c8344ea4a131b9c1e8` 的既有生产构建，任务自有preview `http://127.0.0.1:3019`。Solana DOGE/USDC保证金10、TP 0.08/SL 0.05输入、市价/限价0.06、多空切换及执行详情正常渲染；切Arbitrum显示BTC、兑换和更多模式。仅本地origin临时关闭solanaNetwork并reload，EVM页面仍显示，resource列表未见gmsol-sdk请求；恢复flag=true并切回Solana后市场/交易输入正常，未签名前仍未见WASM加载。未发现需业务修复的新异常；不据此证明金融数值、已连接账户、通知或钱包流程通过。Privy iframe的localhost CSP、第三方连接失败及EVM RPC/metrics 429是本轮可观察环境限制；没有绕过CSP。flag与网络选择已恢复，浏览器回到原空白页，自有preview已停止。
3. **原子体积归因完成，生产限制未解除。** 用固定`0.11.0-beta.1`真实WASM、当前56开发源码和历史真实LUT快照（slot `468884236`）离线构造BTC/USDC long LimitIncrease + LimitDecrease TP + StopLossDecrease，保留有限trigger/acceptable价格边界。scratch suite 1 passed；没有新RPC模拟/签名/广播。两表1255 bytes、反序1255、只第一表1252、只第二表1376；第二表仅加载1个writable地址。将两表全部地址并入**假设**单表后1221 bytes，此表不存在且不构成可信资源/落链证据。仅省prepare_user仍1240；省prepare_position为1149，但缺仓位时不安全，未实施。静态13账户以wallet、order/escrow、user/position PDA、wallet ATA及program为主，不能假设再补通用地址即可解决。

编码候选的证据边界：固定Rust source `7fe4008292ffc09061f3a733ad9b5cd2e6235fa8` 的 `programs/store/src/states/order.rs` 中position increase/decrease将min_output None与Some(0)均归零；但SDK `crates/sdk/src/builders/order/create.rs` 固定写Some(min_output)。前端简单省JS参数不能省字节；直接改指令会涉及ABI重编码与现有严格参数校验，改WASM则改变已确认的产物。此次只记录候选，不声称已测得其收益或已证明与主网部署兼容。安全下一步是由可信LUT提供方评估单表覆盖，或单独完成SDK编码方案的实现、完整等价校验及部署兼容证明；当前拒绝超限的保护保留。

四个既有Draft正文已同步最终CI、页面范围及体积诊断，保持未到正式review、上游可能继续变化的声明。71信任门槛、112 API math、真实钱包/keeper与19已暂缓范围仍按下节，不因本轮回归解除。本机证据：个人基础 `.local/acceptance/independent-followup-20261114/`（PR快照、完整组件日志、CI摘要、UI记录）；56开发同目录（scratch spec/config、atomic-size.json/log），诊断文件不进入产品PR。

## 四需求上游刷新（2026-11-14）

本节优先于下方历史状态。角色：FESOL-56/19/20/72 原开发线的依赖集成与既有 Draft 交付更新。本轮 GitHub、远端源码和真实部署已重新核验；Linear viewer/team 查询正常，但目标 issue（标识及既有 UUID）返回 Entity not found，完整只读同步仅见40项、缺少本轮目标及关键依赖。因此无法核实当前 Linear 正文、关系和新评论，不把历史状态当作本轮事实。未修改 Linear、发布协作评论或合并上游。

- FESOL-57 #3242 已 MERGED，head `1e4d3350bc79f15f53fdc1d3ac8d9544c6e20a86`。最新 release `84ab9293a8e25e1312f35a20893752df480e0e0b` 已含 SDK 2.9.2；消费官方新版数学、结算/触发舍入及数值工具，不保留旧集成实现覆盖新版。个人基础仅同步 release，不混入未合并业务。
- FESOL-52 #3193 仍 OPEN，head `e712a1d342e994d85f77e52a748e081e48f559f3`，已含已合入release的57源码。56 先合入并保留确认 slot tracker、统一订单 metadata/parser、新鲜度和缺价拒绝；适配 walletTokens 到纯 `gmsolOracleUtils`。20 再消费56并保留通知/回执/恢复扩展，19消费20，72仅更新开发组合，独立PR仍为18文件。
- 19 从旧 `proDiscountFactor` 读取交易折扣的兼容映射改为新版 `selectFeeDiscountFactor`；共享 selectors、价格影响及费用展示采用上游独立字段与净价格影响语义，保留19的 EVM 审批/提交隔离。19已延后的支付币兑换、max leverage一致性、完整raw-account数学对照及GT Rewards不扩大实施。
- 51 #3195 `2495be234e`、92 #3243 `5e081e5ab1`、15 #3201 `056f8d689c`、25 #3238 `07117e1691`、fee #3205 `087a98fa37`、orders #3207 `c711f6ebe7` 本次未见新head；不重复集成等价提交。未合并前置仍须各自评审，56→20→19的交付依赖保留。19 development已集成15/25；delivery沿用既有边界，仅含15的trade-state/storage guards，不补带15 selector/token metadata和25 list UI；完整入口验收仍需这两项单独交付。
- gmx-api origin/main 更新至 `5532701`，源码主SDK已2.8.0、sdk-next别名2.9.0（不再将历史2.2.1描述当当前源码）；固定子仓库checkout/gitlink保留。真实 `/v1/markets/config` 67市场均无tradeMath，FESOL-112上线条件仍未满足；SDK源码升级不能代替API启用。
- 主网只读ALT于slot `469359341` 核验：两表active，73/155地址，均仍由 `FQNU5wn6fVdnPnSZyHL3PmCJsNLTi4Cf8dKU7f3MQjXj` 持有authority，当前预期authority map为空。ALT工具passed只证明active/layout；生产信任门槛仍未满足。`solanaTrading=true`、service disruption banner=false。未创建表、修改flag、签名或广播；1255/1232 byte有限边界组合仍是历史未解除风险，本轮未重跑模拟。
- WASM仍固定 `0.11.0-beta.1`、source `7fe4008292ffc09061f3a733ad9b5cd2e6235fa8`，不因TypeScript SDK变化自动升级。用户于本轮收尾后明确确认最终使用此版本，版本选择已解除待确认状态；不推断为维护者本人回复。下方历史版本待确认表述不再代表当前阻塞。


| 需求 | Development HEAD | Delivery HEAD | 既有 Draft PR |
| --- | --- | --- | --- |
| FESOL-56 | `d6e1b7ba05d8c75edf20a9f4b183c086300962e0` | `2ecfebba845108c068ff8364638909ff9375539e` | [#3258](https://github.com/gmx-io/gmx-interface/pull/3258) |
| FESOL-19 | `1155c46f87d68a38806c2b9f2350bd83a16c8441` | `e4e9067a0fef8d02a84478c8344ea4a131b9c1e8` | [#3262](https://github.com/gmx-io/gmx-interface/pull/3262) |
| FESOL-20 | `7c45d1e20dbf75cb77294591837f6f3c1b7045d6` | `613d33cf39b27675d96ac0f71ef6c6afff4b043b` | [#3261](https://github.com/gmx-io/gmx-interface/pull/3261) |
| FESOL-72 | `7b26f6feec92e17166627731e79834c799165225` | `2f2ac8477192cdf07313db292bc11cbcd3bf9238` | [#3259](https://github.com/gmx-io/gmx-interface/pull/3259) |

验证（仅本轮实际执行）：56 development 的app/landing types、19 files/105 tests与SDK 65 files/965 tests、SDK零warning lint通过；56 delivery immutable install、SDK build、零warning app lint、types、完整frontend **3446 passed/1既有skip**、最终Lingui和8GiB production/WASM build通过。20 development/delivery均在重新构建SDK后通过types及18 files/89定向tests，包含真实通知组件；delivery零warning lint、最终Lingui及8GiB production/WASM build通过。19 development types与完整frontend **3479 passed/1既有skip**，delivery完整frontend **3477 passed/1既有skip**；19 delivery的零warning lint、types、最终8GiB production/WASM build及当前配置bundle hash/glue隔离均通过。72 development完成fresh SDK build、types及3 files/17 tests；72独立delivery完成fresh SDK build、types、零warning app lint和loader 1 file/2 tests，仍为18文件。72 delivery最终8GiB production/WASM build及配置bundle hash/glue隔离通过。SDK/WASM source、锁定toolchain、Docker recipe与vendor字节未变，复用既有GMX CI/source reproduction，不称本轮重跑Rust。

过程中修复19自动合并遗留的重复TP/SL feeDiscountFactor并移除其旧pro折扣映射；生成声明缓存旧内容导致的缺导出错误，在各目录重建实际SDK后复验，不改业务API掩盖。19/72 development重复的同名build script经Yarn规范化去重，保留现有有效命令。56/19原开发线提取新增费用、价格影响、funding payout和quote错误文案后精确转入对应交付。构建hash核验只使用当前配置指向的`0.11.0-beta.1-gmx.1`，旧版本public/build残留不作为当前hash失败或加载证据。原始本机证据在各目标 `.local/acceptance/upstream-20261114/`；只读快照保存于个人基础同目录。本轮CUA inventory未发现可用浏览器/native Chrome窗口，不能将本轮构建或旧浏览器记录称为新UI验收。


正式release merge commit `84ab9293a8`与57 head `1e4d3350bc` 的完整tree同为 `4a6a6d5c2afd86cc3d31717dec8b3b749a906359`。52携带57 head而非release的merge记录；收尾为七个现场补合正式release记录，各现场合并前后完整tree均相同，72独立delivery此前已合入。此历史补齐不触发重复测试；source树身份及前后SHA在本机`release-history-sync.json`。

四条development均已推送my-gmx，四条delivery均推送my-gmx-pr并核对远端完整HEAD与上表一致，全部OPEN/Draft、base release。PR正文已重写为当前实现/依赖/验证/验收边界，并明确还在自审与测试、未到正式review、上游仍可能变更。收尾快照的新HEAD远端Audit、general、SDK standalone、WASM reproduction和Component检查仍IN_PROGRESS，未宣称新run全绿，也未将历史403套用于当前run。各任务registry已重绑最新development/delivery与release基线、刷新notes；本轮只读RPC代理已停止，未接管或关闭其他既有服务。

## gmx-prompts review 与修复（2026-11-13）

用户目标：让 FESOL-19/20/72 当前 Draft 经 gmx-prompts review，修复已核实的重要且能独立解决的问题。本轮为单 Agent 人工审查；使用最新 gmx-prompts 的 `gmx-interface-review`、`gmx-solana`、开发/测试/项目规范。没有可调用的 `/code-review` 或 `/security-review` 命令，不能声称运行了原生命令；通用正确性与安全检查人工执行。没有发布 review 评论、请求 reviewer、转 Ready、合并、修改 Linear 或签名广播。

审查范围以 GitHub 当前 head 和 release merge result 为准：19/20 已包含 release `83474e0e94`，另对 72 创建 detached 实际合并结果 `0ea2e9395b`（tree `92c615eeed87f7350f593f9cc226048d3ab37d8a`），不将该临时合并提交带进独立 PR。复用同阶段已核验来源，不以 development 相对 release 的全部个人差异冒充 PR 范围。PR 既有评论/review/inline 查询为空。除整体上下文阅读外，分别执行除法/分母、交易步骤、分支保护、单位语义四遍定向检查，以及 success/error/timeout/reject/unmount 的状态收尾检查；针对 SDK/IDL 与 API 接缝核对固定源码及可观测部署边界。

| 需求 | 已核实问题与处理 | 当前交付 head | 本轮结论 |
| --- | --- | --- | --- |
| [19 / #3262](https://github.com/gmx-io/gmx-interface/pull/3262) | 中等：共享 TradeBox 在 Solana 可触发 EVM `eth_getCode` 账户类型读取及 `/incentives` 请求。禁用对应 SWR key，并隔离缓存 EVM 返回值；切回 EVM 恢复正常读取。新增跨网络回归在修复前实际失败、修复后通过。另修复零 warning CI 的 sender import 和 TP/SL fixture | `69ba4dab7a` | 本轮已核实、可独立修复的问题均处理；完整需求验收仍 BLOCKED/部分范围暂缓 |
| [20 / #3261](https://github.com/gmx-io/gmx-interface/pull/3261) | 通用 CI 因 sender spec import/order warning 失败；原 development 修复 `8a7ac5a454`，精确转入 delivery `6087908e19` 并被 19 消费。不是新增业务缺陷，不向他人重复发布 lint finding | `6087908e19` | 未核实到其他需独立修改的重要问题；新订单/keeper/toast 整体验收仍 BLOCKED |
| [72 / #3259](https://github.com/gmx-io/gmx-interface/pull/3259) | 手写构建/loader/CI/hash 链未核实到新缺陷；保持业务 head，无无依据修改 | `0f36780317` | 构建/hash 部分有证据；签名落链和版本确认仍 BLOCKED |

所有修复先在原 development 验证，再 cherry-pick 到既有 delivery，同一 Draft PR 已推送更新；PR 正文补充审查方法、修复、证据、未验收项及仍未到正式 review 阶段、上游变化可能导致继续修改。19 development `e4cf921834`，20 development `8a7ac5a454`。未改 57 作者代码，未扩大 72 独立 WASM PR 范围。

### 本轮机械与运行证据

- 19 development：修复前回归确证 Solana 初始化仍调用 EVM account code reader；修复后跨网络读取隔离 + TP/SL 2 files/18 tests passed，变更文件严格 ESLint、app/landing types passed。delivery：`lint:ci` 零 warning、`tscheck:ci`、完整 frontend **347 files/3469 tests passed，1 file/test skipped**、production `build-app` passed。所有 Node/Vite 构建使用 `NODE_OPTIONS=--max-old-space-size=8192`。SDK 输入未变，沿用上一轮相同 SDK/锁/配置/vendor 的 954 passed 证据，不冒充新跑。
- 20 delivery：`lint:ci` 零 warning；transactions/orderTracking/真实 notification component 回归 **6 files/36 tests passed**。本次只有 import 顺序变更，沿用原同目标完整 frontend 3459 passed/1 skipped、SDK 954 passed、types 与 production build 证据，未机械重跑所有未受影响检查。
- 72 最新 release 合并目录：immutable install、app/landing types、gmsol **5 files/19 tests passed**、应用 WASM bundle/hash gate build passed。固定 Rust 输入与 8 vendor 文件未变，沿用已通过的独立 byte reproduction 与真实 GMX WASM CI `43385852331`，本次未再跑 Rust。独立交付目录和临时 merge result 证据分别标明。
- 原生现有 Chrome 打开 19 实际 production merge result `127.0.0.1:3019/trade`，已检查 flag-off 的 EVM 基线、flag-on Solana、重载、EVM 切换、返回 Solana/重载，TradeBox 显示市场/限价及 TP/SL，Solana 不提供 swap。修复前主文档资源缓冲看到 17 条 `/incentives`；修复后 Solana 重载采样 90 条资源中 0 条 incentives。后者是有界主文档样本，不能证明所有 worker/EVM RPC 为零；账户读取隔离由可复现边界回归证明。Console 的 Privy localhost `frame-ancestors` CSP 拒绝、广告连接失败、TradingView unload policy 及 metrics 429 单独保留，不归因为本轮新增代码问题。没有绕过 CSP 或操作钱包签名。用户随后正在使用浏览器，停止争用原生窗口；测试 origin 的 Solana 本地 flag 保留开启，不误称恢复初态。
- 19/20 远端 general 旧 head 的失败已读日志确认为上述 lint warning；旧组件 workflow 用例通过，失败在报告 Pages 发布/评论 HTTP 403（fork 权限），没有扩大权限。新 head 的远端 CI 是新的运行，不能用旧结果冒充新 run 全绿。
- 收尾远端快照：19/20 新 head 及 72 既有 head 均确认 OPEN Draft、base release；19/20 的新 general 与部分 checks 仍运行中，72 因正文更新另起 general，既有同 head 成功不等于新 run 已结束。72/WASM 既有成功保留，20 新组件 run `43416516116` 已读完整日志：286 passed（4.1m），仅 Pages 部署和报告评论 403。临时 preview 3019 已停止；其他服务未接管/停止。
- 部署定向复查：`https://solana.gmxapi.io/v1/markets/config` 返回 67 市场，`tradeMath` 存在 0/gmsol 0。新鲜 gmx-api origin/main `marketRecords.ts` 仍缺该标志；源码不替代部署。无版本确认、受信 LUT、真实 keeper 或签名落链的新证据。

### 验收逐项边界与后续人工检查重点

| 需求验收项 | 本轮状态及证据边界 |
| --- | --- |
| 19：共享 market/limit increase + 附加 TP/SL；已有仓位 TP/SL tab；不支持模式隐藏 | 代码/mapper/共享组件回归、未连接钱包页面已验证；成功开仓/加仓及 TP/SL 真实落链不可验，BLOCKED 于 71/112/钱包授权 |
| 19：支付币转换、签名、pending/success/failure | 直接抵押币/native SOL 路径、确认不冒充 fill、异常恢复有测试；支付转换为用户暂缓项，真实签名未验 |
| 19：输入/池/抵押币与杠杆交互、最大杠杆、k-token 价格 | 共享逻辑、杠杆改变保留支付量、visualMultiplier/ABI 单位代码与回归覆盖；最大杠杆标签和含费 buffer 一致性暂缓，完整界面数值验收未完成 |
| 19：执行预览/acceptable price、Collateral Spread、GT VIP、GT Rewards | 共享布局与来源/禁用条件已审查；线上缺 gmsol math，simulate_order 同输入数值对照未建立；GT Rewards 暂缓；不把历史 spread 设计确认扩大为本轮验收 |
| 19：TP/SL 目标价抵押品 %/$ 双向换算 | long/short、TP/SL、单位切换 17 组件测试通过；真实订单与协议数值一致性仍待联调 |
| 19：发送 toast 不误报 fill，EVM 保留 | 与 20 集成的代码/真实组件回归已验证；19 旧正文的 sending-only 由关联 20 执行阶段覆盖，不能把组合行为描述成 19 单独 sending-only |
| 20：两阶段、失败/取消、相关性、缺失/延迟、布局/链接/关闭 | parser/reducer/reader/真实组件的可复现测试通过；program/store/order/action、failed tx、复用生命周期、分离 execution/closure、same-slot 顺序均审查；新订单实时 keeper、取消 reason 和浏览器组合 toast 仍未验 |
| 20：GMX RPC 跟踪与执行后 gmx-api refresh，无 Corvus | 源码/回归已验证；刷新 slot/freshness 不保证实际部署 keeper 业务验收；缺证据保持 unresolved；用户关闭、切钱包/网络、unmount 中断各自通知，不全局清空其他任务 |
| 72：GMX CI 构建、app 加载 GMX build、hash 进入 PR | 构建、加载/隔离测试、固定 hash、实际 GMX CI 及此前原生浏览器证据成立；本轮最新 release 合并结果额外通过安装/types/tests/WASM bundle |
| 72：新版 mainnet flows land；版本相对原始 0.10.0 | 未验：此前仅 unsigned simulation，不是签名落链；0.11.0-beta.1 为用户选择，maintainer 认可仍待确认；可信 LUT/原子交易大小边界保留 |

人工接续优先：71 提供 LUT 后验证可信/冻结状态与有限 acceptable-price 三单 1232-byte 边界；112 上线后对照 raw-account simulate_order 并跑受授权真实链路；复核 20 部署事件 ABI 与新 lifecycle receipts；解决用户暂缓的 19 范围前不转 Ready。代码审查完成不等于这三个需求整体验收完成。

## 四条 release Draft（2026-11-13）

用户已明确授权19/20交付，新增20 [#3261](https://github.com/gmx-io/gmx-interface/pull/3261)、19 [#3262](https://github.com/gmx-io/gmx-interface/pull/3262)；既有56 [#3258](https://github.com/gmx-io/gmx-interface/pull/3258)、72 [#3259](https://github.com/gmx-io/gmx-interface/pull/3259)本轮核实仍OPEN/Draft、base release。56 head `11da18dfb7`、72 `0f36780317`无需为本次交付改动。

19/20从最新release `83474e0e94c88c2b4a18cd436a564b97062f807f`重建纯产品delivery；依赖关系56→20→19，72保持独立WASM范围。PR公开披露未合并前置、19的15/25市场/仓位入口依赖和暂缓范围。实际delivery验证、heads及后续原development修复入口见[20交付记录](issues/FESOL-20.md#release-draft-已交付2026-11-13)和[19交付记录](issues/FESOL-19.md#release-draft-已交付2026-11-13)。此节替代下方“19/20没有PR”的历史观察；Draft不等于Ready、可独立合并或真实落链验收完成。未改Linear、请求reviewer、合并或签名广播。


## 当前推进决定（2026-11-13）

用户在独立开发切片完成后明确：**FESOL-19剩余问题暂缓，之后再处理**。当前不再自动推进最大杠杆一致性、兑换、WASM数值对照、GT Rewards及完整下单验收；保留缺口与外部条件，不计作已完成或需求豁免。恢复清单和原开发现场见[FESOL-19当前决定](issues/FESOL-19.md#当前决定剩余问题暂缓2026-11-13)。此决定优先于下方早期“优先继续19”的建议，不扩展成其他需求的暂停，也未修改Linear。

## Draft交付就绪核对（2026-11-13）

用户询问56/19/20/72能否先向release提交Draft。本轮为交付就绪分析，未新建19/20 PR、修改业务或恢复19暂缓事项。结论：可以先整理为明确披露未完范围和依赖的Draft，可信LUT/真实验收未完成不阻碍提前评审，但不能宣称Ready或可合并。

- 56已有Draft #3258，远端head `11da18dfb7`，最新恢复补丁及atomic说明已发布，无遗漏业务提交。当前WASM/Audit/standalone及一轮general成功，另一轮general仍运行；Component workflow `43408278858`失败日志本轮实查为Pages/评论403，正文All tests passed，不据此新增业务修复。reviews为空。
- 72已有Draft #3259，head `0f36780317`，保持独立WASM范围；仍需版本确认与新版主网落链验收，不重复创建PR。其Component报告权限失败边界沿用已核实记录。
- 19/20目前没有独立PR。当前19运行源码消费20的sender/通知契约，20消费56；交付整理顺序宜56→20→19。需从最新release重建各自delivery、精确转入已核验业务成果，列明必要未合并前置，不能直接将个人开发分支作为release交付。只读tree diff确认个人基础与56 delivery之间仍含无关stats/indexer差异，19还集成15/25相关能力，不以整支对比差异作为本需求完整范围。19 Draft需明确列出已暂缓的最大杠杆/兑换/数学对照/Rewards等未完项。
- 上游release线上ref已前进至 `83474e0e94c88c2b4a18cd436a564b97062f807f`，相对既有交付基线`e471428074`新增13 commits（2.2.1合约/智能钱包等）；涉及SDK及本地化。此次没有fetch/合并/重建或声称新基线组合已通过。下一次实际交付应使用实时release并在真实delivery目录核验；56已有PR当前GitHub报告MERGEABLE，不因release前进就盲目重写其历史。

## 独立开发切片实施结果（2026-11-13）

用户明确创建目标并授权实施四个切片。沿用原56/19/20/72现场，没有修改57作者实现、Linear、线上配置或发送协作消息，也未做钱包签名/广播。下方“等待外部条件期间可继续推进”是实施前判断，本节为后续结果。

- **19输入链路**：真实共享selectors→mapper→WASM参数单位核对覆盖全部visualMultiplier=1000的配置市场、多空、market/limit、2/5/100/101倍，支付额固定10、价格展示倍数往返和30→20decimals转换一致。测试专用固定价格/市场元数据没有进入生产。100倍名义上限并不保证费用后可用：样例100倍为min collateral for leverage，101倍为insufficient collateral usd，2/5倍可用，未绕过费用buffer。真实TP/SL组件复现并修复手输100%后切换美元改变触发价的问题：按目标触发价估算抵押品价值换算，四种多空TP/SL组合均保留原价格。没有直接修改57。`MarketGraph.simulate_order`仍需完整原始市场账户/supply/价格/仓位同输入快照；本轮未建立其数值parity，不用selectors测试冒充WASM数学对照或112上线证据。
- **56→20→19安全恢复**：广播前持久化network/owner作用域的原签名、订单地址、操作及market执行跟踪意图；存储读回失败不广播。未知/processed/无历史/RPC失败保留检查点，阻止再次签名；confirmed/finalized后确认失败或prepare成功要求用户另行重试，原订单成功则返回原签名并刷新账户。跨异步钱包/网络/unmount检查保留原检查点。19共享按钮提供查询状态入口，可在新输入/数学数据暂不可用时检查原交易，恢复跟踪使用原订单类型而非当前表单模式。不是跨标签页原子锁，不因blockhash到期或空历史清除未明交易；没有新增取消订单产品UI或自动重发金融动作。
- **20真实通知组件**：prepare确认后拒签被归为失败，保留已有交易链接；发送中/广播未知不会提前显示成交阶段，未知状态不显示持续loading。只在确认提交后进入执行跟踪，真实事件才判成交/取消；现有关闭/会话切换保护保留。已在现有hook harness中渲染真实组件核对文案、阶段和Solana explorer链接，未以mock组件代替实际展示。
- **56 atomic归因**：只读获取现有两表快照slot468884236，重现有限价BTC/USDC三单1255 bytes。完全相同的准备指令已去重，剩一条prepare_user、一条prepare_position、四条不同ATA和三条131byte create_order_v2；wire=65 signatures+4 header/version+417 static keys+32 blockhash+662 instructions+75 lookup=1255。改表顺序仍1255；只用第一张1252，第二张1376，都不满足1232。**将相同地址内容合为一张表的离线诊断为1221 bytes**，节省一条34byte lookup descriptor，全部订单和价格边界保留。此合并表未部署/审批，生产配置和信任门禁未修改；71可考虑一次提供受信且合并覆盖的表来同时解决信任和该示例大小问题。两个独立副本或仅冻结原两表仍不足，其他输入需逐项测量。公开技术说明同步transactions README。

产品提交：56 recovery `72167ff0b6`、意图/atomic说明`dfd20a5083`；20语义接入`46326e5c44`、通知修复`9f8c74d2f0`、意图`307cbeb595`；19共享TP/SL修复`e8914b0941`、消费20 recovery/通知`769043f`/`c942c11`、意图`10540d1d5c`、共享按钮及catalog`9c59791f45`。72 development精确消费56两提交为`a2445492b0`/`e6044ced38`；72 delivery/#3259仍为`0f36780317`，没有夹带56业务。

日志、临时核验源码和只读原始快照保存在各实际目录`.local/acceptance/independent-20261113/`。scratch文件已移出src，不提交测试专用行情或临时诊断代码。最终版本：19 `c708d8a634`、20 `c9c895cdce`（最后仅按lint整理import，无行为变化）；56 dev `dfd20a5083`，56 delivery `11da18dfb7`，72 dev `e6044ced38`。四条development均已推送my-gmx；56实际delivery已推送my-gmx-pr，同一Draft #3258已更新恢复行为、atomic结果与真实验证。发布后核对head为`11da18dfb7`、OPEN/Draft；本轮未等待或宣称新head远端CI全部通过。

验证：56 dev及实际delivery各完整frontend **3437 passed/1既有skip**；19 **3469 passed/1 skip**，20 **3458 passed/1 skip**，72 dev **3437 passed/1 skip**。19/20/72及56 delivery应用与landing类型检查通过；19最终定向5 suites/40 tests、20最终定向3 suites/21 tests、56真实WASM恢复2 suites/15 tests通过；输入链scratch有非空市场断言并覆盖80组合，另做真实TP/SL组件17项检查。变更ESLint无error（19测试fixture一条react-perf warning），56 Prettier和各目标diff check通过。56默认堆production build在chunk rendering报JavaScript heap out of memory，未当作代码失败；用户明确后续构建统一8 GiB，已沉淀根规则/编码入口/排障说明并推送`15dd1d720b`，原失败日志保留。56实际delivery与19整合目标的8 GiB production app/WASM build均通过（分别55.33s、52.03s）；大型构建串行执行。72独立PR/head已再次核对仍为`0f36780317`/Draft。开发/交付工作区均clean。


## FESOL-52 最新依赖接入（2026-11-13）

用户随后明确优先处理52，范围含56、19、20、72；本节取代下方“外部暂不处理52”的旧阶段决定。实时确认 #3193 head 为 `258e4da6abafc75c683983993544f4eb9c1a8abc`，release仍为 `e4714280749c00a90468abdde3060aae619717e7`。只消费已发布成果，未修改52或57作者的分支、PR或Linear。

52从旧 `732b4a1322` 新增共享SDK Provider迁移，删除gmsol专用singleton和本地host override。56原development先接入，账户hook冲突按语义解决：读取使用 `useGmxSdk(SOLANA_NETWORK_ID)` 与统一host缓存key；交易开始时捕获该SDK，确认后显式传给账户刷新。保留required/accepted slot分离、最高确认下限、普通轮询minContextSlot、在途旧响应复核和freshness envelope，未退回上游较早的单纯accepted slot实现。

20精确消费56同一补丁，sender冲突保留自身identity/onSubmitted/trackingRequests等扩展；执行通知捕获共享SDK和提交owner，通过lazy import调用刷新前再次检查当前会话有效性。19精确消费20的相同实现，继续保留20为当前19的代码交付前置。72 development消费56补丁用于组合验收，72 delivery/#3259保持原 `0f36780317`，不反向夹带52/56业务链。

账户回归改为真实共享Provider和真实SWR/hooks，仅模拟SDK网络方法；继续覆盖失败保留最高slot、较旧轮询拒绝与追上恢复、立即展示确认数组、后续旧快照拒绝和失败保留数据。20新增真实Provider实例传递至执行刷新回归。没有新增SDK singleton或替代host。

版本：56 dev `ea591a5533`、56 delivery `e7ac104ba5`；20 `afb96056c3`（52消费 `6632b31d7b`、测试 `4cf75c9572`、通知适配 `afb96056c3`）；19 `6da9f94679`（精确消费前三项）；72 dev `7dd74997e5`。56的实现来自52上游 `258e4da6ab`，本地语义集成提交 `9557351152`、测试提交 `ea591a5533`；其余分支均cherry-pick该实现，不独立重写。

验证：56 dev及实际delivery各自完整frontend **3436 passed/1既有skip**、app/landing types、production app/WASM build通过；20完整frontend **3456 passed/1既有skip**及types通过；19完整frontend **3466 passed/1既有skip**、types和production app/WASM build通过。19/20账户/provider/通知/tracking定向各9 suites/36 tests通过。72真实WASM/transaction/account/provider组合4 suites/19 tests、types通过；初次SDK verify因缺少 `.agent-build.json` 收据blocked，已在该目录实际重建prebuild/types/CJS/ESM并通过1200产物核验，tracked文件未变。19/20既有SDK来源收据也按当前源码核验1200文件通过；SDK源码/依赖未改，952单元测试沿用既有结果，不称本轮重跑。所有6目录（含72独立delivery）vendor全部8文件hash匹配，未重跑Rust。变更手写文件Prettier、ESLint及diff whitespace通过。四条development均已推送my-gmx，56 delivery推送my-gmx-pr，registry重新绑定实际完整SHA并更新后续入口。各实际目标日志位于 `.local/acceptance/fesol52-20261113/`。56同一Draft #3258已更新共享Provider来源与真实delivery验证，远端head `e7ac104ba5`、OPEN/Draft；新head的Audit/WASM reproduction/component/general/standalone checks已启动，观察时均IN_PROGRESS，未冒充远端CI已完成。外部review/release合并、71可信LUT、112线上数学字段及真实钱包落链的既有边界不由本次迁移解除。

## 等待外部条件期间可继续推进的切片（2026-11-13）

角色：限定56/19/20/72的就绪分析，未实施业务。沿用本轮四条实时Linear正文/关系/评论，重新核对实际开发源码、52整合后PR和release；release仍 `e471428074`。用户决定atomic、兑换和Rewards等需求内问题暂不追加问Divhead，留在开发/review内处理，不代表需求豁免。

首选19共享输入到交易参数的行为核验：当前mapper spec仅2个聚合case，覆盖传入已计算amounts的映射/拒绝，没有独立证明完整UI输入计算链。可离线核对k-token visualMultiplier来回转换、TP/SL百分比与美元输入及抵押品目标价分母、杠杆改变保留支付额、最大杠杆与费用buffer，复用真实selectors/math/mapper、独立参考输入；发现差异只修前端消费，不直接改Rainer的57实现。WASM实际导出 `MarketGraph.simulate_order`，可先检查固定市场/仓位/价格输入是否足够，再做可复现同输入对照；本次只查导出，未证明完整离线对照现成可跑，不以伪造生产字段绕过112。

19/20的第二切片为失败恢复和真实组件组合：sender已保留confirmed/pending signatures及trackingRequests，adapter只转发成功/失败通知，尚未证明满足19正文部分成功后的retry/cancel体验。先覆盖prepare已确认后钱包拒绝、发送超时状态未知、receipt/API延迟、跟踪超时及会话切换的组合；未知状态先reconcile，禁止直接重发整个金融动作。20 notification hook有现有测试，但未发现专属SolanaOrderStatusNotification组件story/spec；可验证真实文案/链接/取消原因/关闭行为，不重复堆parser单测，不把离线组件验收当新订单keeper验收。

56可用固定WASM、真实已留存LUT快照/ABI做atomic静态大小归因；现有recompile已经去重ATA/prepare_user/prepare_position并合并Compute Budget，不能假设再去重即可解决1255 bytes。评估安全的布局/编码改进，保留价格边界、原子性与1232上限；是否能修复尚未确认。支付币兑换可先核对现有swap ABI与共享路由契约，但未确认路由输入来源前不列为可完整独立实施；GT Rewards仍缺契约，不猜测新增字段。

72构建切片已完成，无需重复Rust/CI重建或换版本；等待版本确认与主网复验，沿用现有出处/hash/loader证据，仅在发生实际变化时更新。19/20交付边界和review材料可以整理，未授权本轮创建新PR。

新CI事实：56 head `e7ac104ba5`的Audit、WASM reproduction、两轮general和standalone均成功；Component workflow `43399669597`失败日志明确用例All tests passed，失败是Pages发布403及报告评论Resource not accessible by integration。72 head未变，同样保留历史报告发布权限失败。没有为绿色状态扩大token权限或改共享workflow。两个PR均OPEN/Draft、reviews为空。

## 五条内部同步结果（2026-11-13，用户限定不处理外部依赖）

本节优先于下方16:16审计中的旧版本矩阵和建议。用户授权将五条内部需要跟进的依赖同步好；未扩展到52、51、71、112等外部需求，未修改57作者分支/PR、上游release或线上状态。

- **72→56已补齐。** 在56原development精确消费72正式交付 `0f36780317` 的18文件产品补丁，提交 `a86cfdd54a`；package脚本列表的冲突保留本地工具和新增source-build命令。版本来源/历史模拟说明更新为 `bfda3ff947`。精确转入原delivery为 `3db0a203e0`、`0091a24556`；交付package冲突只保留产品命令，未夹带个人工具。已有Draft #3258已更新并核对head `0091a24556b42e49502e3d616d2838fec7d159b7`；#3259仍独立，不把56带回72正式PR。新head的GitHub检查已启动，尚未终态；旧head检查不代替它。
- **57→56/20/19无遗漏。** 上游最新数学提交和20/19的两个cherry-pick，stable patch-id同为 `3a0d9c557d70a00b8011a20f4274b4f105da4362`。三分支SDK源码、WASM配置和transaction ABI一致；没有修改Rainer实现。SDK952项历史通过按未变源码/依赖复用，不称本轮重跑。
- **56→20/19已核对。** 两个下游均保留订单意图快照、freshness envelope、确认slot floor和20 sender的identity/onSubmitted/trackingRequests/失败分类；两者共享transactions、orderTracking、notifications、账户hook、SDK/vendor的tree diff为空。未用56基础sender覆盖20扩展。
- **19/20的现有代码依赖已明确保留。** 本轮没有把已实现两阶段反馈拆回提交阶段；20是当前19的代码交付前置，market trackExecution=true，limit/TP-SL创建false。共用README由20提交 `e2b6b354aa`，精确转到19为 `c6b20fd8d4`；仅文档变更，运行行为未改。若以后要求19脱离20单独交付，再独立处理该拆分，不能声称本次已解除依赖。
- **统一产物。** 56 development/delivery、19、20与72 delivery均使用 `0.11.0-beta.1`、source `7fe4008292ffc09061f3a733ad9b5cd2e6235fa8`；WASM SHA-256 `e82184caacc60828f024743f88a0a92d97b9d3d55db6839e0d3fab8a9b46c840`，各目标全部8文件实际hash匹配。未重新运行Rust可复现构建，复用完全相同产物及72原GMX CI证据。

验证：56 development和实际delivery各自完整frontend **3435 passed/1既有skip**，app/landing types、SDK重建、production app/WASM build、变更手写文件Prettier、app ESLint、Node脚本语法通过；development真实WASM/账户/钱包定向21项通过。19组合9 suites/41 tests、20组合8 suites/39 tests通过，分别核验SDK产物来源收据1200文件通过；两者运行源码未改，既有全量结果按原记录复用。delivery服务产物WASM hash相符，主app JS不含WASM binding/start。首次将Node构建脚本按浏览器ESLint环境检查报process未定义，改用Node环境后无error（2个既有console warning）；没有为此改72源码或共享lint配置。generated vendor字节不格式化。

日志与版本矩阵存各实际目录 `.local/acceptance/internal-dependencies-20261113/`；56 development原构建收据在其SDK产物目录，delivery使用原生build-sdk。业务开发分支已推送my-gmx，56 delivery推送my-gmx-pr，task registry已重绑并更新接续信息。当前五条内部没有已确认遗漏的版本同步项；不等于产品范围完成、外部条件解除或真实钱包验收通过。本轮没有浏览器/钱包签名、广播、新主网模拟或外部评论。

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
