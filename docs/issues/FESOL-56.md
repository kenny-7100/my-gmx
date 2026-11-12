# FESOL-56 — 交易构建、校验与发送的前置梳理

更新：2026-11-13（Asia/Shanghai）。角色：依赖调研、组合分支准备与源码审查；尚未实施 FESOL-56 交易功能。
需求：[FESOL-56](https://linear.app/gmx-io/issue/FESOL-56)。Linear 实时抓取自 2026-11-13 00:03 起；GitHub 同轮核验。个人基础 `solana-integration`；本轮已提交依赖知识并创建独立开发 worktree。

## 判断与执行边界

可以开始不依赖线上环境的 ABI 核验、构建器与确定性指令校验工作；不能据此宣称前置全部完成或进行完整主网验收。FESOL-92 是明确要求先合并的 SDK 单位转换成果；FESOL-57 提供 keeper fee 等语义，影响费用校验与金融集成，但不是所有构建/校验开发的统一开工门槛。不要重写这两项已有实现。

FESOL-56 范围含 market/limit increase、market decrease、TP/SL、原子 increase+TP/SL、update/cancel、缺失 position account 的准备，以及每次签名前模拟/指令账户校验、Privy Solana 签名、发送前 fresh flag、RPC 发送确认。FESOL-19/20/59 是下游或消费方，不是应全部等完的前置。

## 当前依赖与 PR

远端 release 本轮观察 SHA：`24cd9b16d65b1ed4daae4c90c81c253588e8938d`。通过 GitHub API 读取远端树与 PR diff，该 release 已是个人基础与开发分支的祖先，无需额外 release merge。

| 依赖 | 观察结果 | 对 56 的影响 |
| --- | --- | --- |
| FESOL-92 | Review，Sulliven；[UI#3243](https://github.com/gmx-io/gmx-interface/pull/3243)，OPEN、非 Draft、head `5e081e5ab140ba41d8f816c317b8361bf5a8787c`；当前检查全成功，REVIEW_REQUIRED，无已提交 review | 复用单位/精度/舍入/range helpers；需求要求 SDK-only PR 先合并 |
| FESOL-57 | Review，Rainer；[UI#3242](https://github.com/gmx-io/gmx-interface/pull/3242)，OPEN、非 Draft、head `6d3ed92ca64129cb4d5ab8d26a9c1baff6563802`；REVIEW_REQUIRED，无已提交 review；常规 lint/type/tests、SDK standalone build、预览成功，组件 job 失败 | `getGmsolExecutionFee` 区分至少 300,000 lamports 的 keeper max、可退 rent；网络费另计。金融数学在共享 SDK，以数据字段启用；不应私自复制到 56 |
| FESOL-51 / 89 / 96 | 51 Review，89/96 Execution；[UI#3195](https://github.com/gmx-io/gmx-interface/pull/3195) 同时包含余额 reader/hook，head `2495be2`，checks 成功但 CHANGES_REQUESTED；[UI#3190](https://github.com/gmx-io/gmx-interface/pull/3190) 为重叠 Draft、组件 job 失败 | RPC、原始 SOL/ATA 余额及确认后 mutate 的集成依赖；沿用 109 中收敛到 3195 的方向，不维护两套 reader |
| FESOL-71 | Todo，Divhead；本轮正文无评论，无已核实交付证据 | 开发者自有小额钱包、参考 TP/SL position/limit order、ALT frozen 或 GMX-owned 替代、solanaTrading true；主网验收仍需核实这些条件 |
| FESOL-42 | Done；[UI#3110](https://github.com/gmx-io/gmx-interface/pull/3110) 已合并；远端 release 有 Solana session 模块 | 连接基础已有；四钱包实际带 ALT 交易签名/落链仍由 56 验收 |
| FESOL-50 | Release；[UI#3138](https://github.com/gmx-io/gmx-interface/pull/3138) 2026-11-05 合并至 release；远端有 oracle fetcher | 复用价格与 mint 映射，不等另一个同功能 PR |
| FESOL-55 | Done；[UI#3082](https://github.com/gmx-io/gmx-interface/pull/3082) 已合并；远端有 loader/fresh trading flag | WASM 基础已有，实际每条签名/发送路径的接入仍由 56 完成；历史验收材料为 partial，不冒充本轮运行验证 |
| FESOL-60 | Done；评论明确复用 src/config/rpc.ts 中已有 Alchemy keys | 不申请新 key/替代 RPC；本轮未实测当前目标环境 CORS、模拟或发送能力。3195 后续 review 已确认开发 key 可用，不能沿用其早期描述断言 key 仍坏 |
| FESOL-49 | Done；配置有 provisional lookup tables | 源码注释说 2026-10-20 两张表仍有 authority，仅历史观察，当前 authority 需重新链上核验 |
| FESOL-72 | Execution，kenny；按编号搜索未发现专门 PR | 图上是 56 blocks 72，不能反解为必须先完成 72 才能写 56；但最终 GMX artifact/版本/hash 和替换后流程复验属于公开发布条件。正文 v0.10.0 与 57 的 deployed 8af1e70c/0.11.0 参考目标需协调 |

## 新发现与可接续核验

- 3242 和 3243 都从无文件状态新增 `sdk/src/utils/gmsol/index.ts`，分别放数学 helper 和 units re-export。两项成果整合存在 add/add 冲突，必须保留双方导出；本轮已解决实际冲突并保留双方导出，组合 SDK 测试通过。
- 3242 的组件 job [日志](https://github.com/gmx-io/gmx-interface/actions/runs/43032469754/job/130562748858) 显示 Ubuntu 软件源 DNS 失败，Playwright 浏览器依赖安装退出 100，随后没有报告目录且 gh-pages 发布失败。不能把自动评论的 “Some tests failed” 当作数学/组件断言失败证据；该 job 仍未通过，需重跑。
- 3242 变更文件不含 Rust generator、reference JSON 或完整 harness；Rainer 通过 [PR 评论附件](https://github.com/gmx-io/gmx-interface/pull/3242#issuecomment-6798273490) 提供 `fesol57_harness.zip`。57 正文要求 generator/JSON 进入 PR；可复现测试如何纳入版本控制仍需 review 确认。本轮未下载该附件与本地 zip 作同一性比较。
- `@gmsol-labs/gmsol-sdk` 当前固定 `0.9.0-test.2`，本地声明含 create/update/close 及 TransactionGroup，但接口存在不证明支持所有 ABI/原子组合。`TransactionGroup.serialize()` 是嵌套数组，必须验证实际交易数、账户顺序和 size，不能把一个 group 当一笔原子交易。需要钉住 blockhash、nonce、metadata/hints、callback/referrer、账户存在性与 LUT 内容后做 builder 正例和恶意变体。
- [FESOL-112](https://linear.app/gmx-io/issue/FESOL-112) 本轮为 Todo；按编号未发现专门 API PR。它消费已发布 57 SDK，并在索引部署上做金融和 minContextSlot 核验；属于整合金融验收依赖，不是纯 builder/validator 开工前置。[UI#3193](https://github.com/gmx-io/gmx-interface/pull/3193) 数据基础仍 OPEN、REVIEW_REQUIRED、checks 成功，影响后续真实 UI 数据/刷新集成。未对 API indexed rollout 作本轮工程验收。

## 用户提供的测试包

已静态读取 `/Users/kenny/Downloads/gmsol_test.zip` 的 README、入口、测试引用、Cargo pin 与 JSON 元数据；已执行 SDK 对比测试和组合构建；未重算 Rust、抓取链上快照或交易。

- 固定 Rust commit `8af1e70c0c0b6ff9d6b41ba4997910588fbcec28`；12 个真实 position（10 市场，capture 2026-11-11T09:50:13Z）加 21 人工场景。真实 inputs SHA-256 `6c901b5b5fabb7e864b55015d4987088d3d08ef222428d85e90290b92d42266c` 与 expected.inputSha256 一致。
- 比较指定 checkout 的 SDK TS 源码，不要求单独 SDK build。默认用已保存 inputs 重跑 Rust 并核对 expected 后再比 SDK；不必先重新抓取链上快照。`--skip-rust` 仅比保存结果，不能称作本次 Rust 重算。
- 包含非零折扣及 increase/decrease 人工场景，超出 Divhead 最早仅 open-position/zero-discount harness 的范围。在 3242 原 head 和组合分支分别以 `--skip-rust` 运行，均 38 项通过；这是保存的 Rust expected 对比，不是本轮重算 Rust。
- 不覆盖指令/账户 allowlist、模拟、四钱包签名、广播、keeper 实际执行；不能作为 56 主网验收。默认不进入常规 SDK/frontend 测试命令。没有核验当前链上部署仍为该 Rust commit。

## 建议顺序

优先推动 3243 review/合并，核验 3242 的费用契约与独立参考证据、重跑 CI 并 review；同步收敛余额到 3195，并让 71 准备运行条件。56 可先做当前 pinned ABI 与原子性验证、构建及确定性指令/账户校验，依赖成果稳定后接上真实费用/余额/RPC/签名/flag。主网验收最后核实版本、ALT、钱包与开关，并按授权执行；最终产物替换后的必要复验不可省略。

## 2026-11-13 开发分支准备结果

- worktree：`/Volumes/kenny/gmx/gmx-interface-fesol-56`；分支 `solana-order-transactions-fesol-56`；HEAD `bac31f3a06`。基线 `8a3a2ad6d66479e009e4ddafabe07c212b50ab92`；release `24cd9b16d65b1ed4daae4c90c81c253588e8938d` 已包含。
- 按顺序 merge UI#3243（92）、#3242（57）、#3195（51/89/96）、#3193（52）、#3205（113 fee fields）、#3207（113 order fields）。后两项是 stacked API 字段补齐，避免 56 重复定义订单/折扣契约。没有 merge 重叠 #3190 或下游 positions/charts/selector UI PR。
- 冲突解决保留 gmsol 数学与 units 导出、Solana RPC tracker 注册与新 EVM syncTracking 生命周期、最新 API 严格字段 reader 和 Solana order composition。两个旧 stacked 测试的 SDK 构造参数 `networkId` 改回当前 `chainId`（上下文仍支持 networkId），初次 2 项失败随后全通过。
- 用户授权本次分支准备的提交命令临时不签名，不修改长期签名配置。用户另明确长期授权本仓库开发验证构建（含 SDK/WASM），已更新 AGENTS.md。
- 没有推送、创建 PR、发布 review 或修改 Linear；没有修复下面的业务缺陷，以便依赖作者和 56 实施阶段清楚区分归属。

### 审查发现：已复现缺陷

**P2 / UI#3242：正数 dust increase 可导致价格预览除零。** `sdk/src/utils/prices/utils.ts:201–217` 的 gmsol 分支把 USD 换成原始 token amount 后直接用 `size` 作除数。使用仓库 BTC 的 8 位精度、价格 $100,000、size $0.0001、零 impact、long increase 时，baseSize/size 均为 0，抛出 Division by zero；同输入非 gmsol 路径不抛。调用路径为 `sdk/src/utils/trade/increase.ts` 的共享 increase 计算调用 getAcceptablePriceInfo。应处理正数金额舍入为 0 的无效预览，沿用统一校验反馈，不通过随意调整单位/伪造价格兜底。临时复现 2 项通过（含下述 sentinel）；scratch 已移出源码，没有作为产品修复提交。当前线上 tradeMath 尚未启用，因此不能声称现有生产页已发生该崩溃。

### 审查发现：组合契约缺口（区别于原 PR 独立范围内的回归）

1. **余额没有接入统一 TokensData。** #3195 提供 reader/hook，当前只接钱包资产展示；#3193 的 `src/domain/gmsol/tokens/buildGmsolTokensData.ts:17` 只组合 token/prices，provider 未消费 useSolanaBalances。共享 `trade/utils/validation.ts:400` 把 undefined balance 当 0，因此有余额的钱包仍可能被交易校验拒绝。56/消费 UI 需让统一状态消费已有 hook，并复用该缓存做确认后 mutate，不能再平行维护一套余额。
2. **update/cancel 所需的订单账户上下文被丢弃。** #3207 已解析字段，但 `composeGmsolOrdersInfo.ts:14–20` 删除 actionState/orderAccount/positionAccount/rentReceiver，后续 EVM mapper 也没有保留 Solana typed metadata 的契约。既有 review 中作者明确表示当时没有 reader；这是显示范围的有意裁剪，56 成为新消费者后需扩展统一 OrderInfo 或关联 typed metadata，不能假定解析成功即 UI 可用，也不建议交易时临时另建平行状态。
3. **数学启用与 fee discount 参数未接通。** 只读查询 `https://solana.gmxapi.io/v1/markets/config` 的 67 项均无 tradeMath；FESOL-112 仍 Todo。provider:322 把 orderFeeDiscountFactor 写入 proDiscountFactor，而 57 的 gmsol fee 分支读取单独的 feeDiscountFactor（`sdk/src/utils/fees/index.ts:54–56`），src 的消费链未传该新参数。需联动 API rollout 与统一计算参数；不要在 UI 单独强开 tradeMath 来掩盖 API 未部署，也不要把“今天未启用新数学”当成新数学可用。
4. **无限 acceptable price 哨兵需要 builder 语义适配。** `sdk/src/utils/trade/increase.ts:896–897` 的 long limit/stop 分支可能返回 maxUint256；92 的 `appTokenPriceToGmsolUnitPrice` 严格 u128 检查拒绝它（复现通过）。92 的范围检查本身正确；56 应按固定协议 ABI 表达 unlimited/optional bound，不能机械转换 EVM 哨兵或删除检查。具体表达需对 pinned SDK/链上版本核实。
5. **参考测试尚未版本化进 #3242。** 用户 zip 的保存基准对比 38 项通过，但 PR 没有完整 generator/reference JSON，附件不能替代持续回归。建议作者将可重算工具和固定版本样本纳入 PR/CI。组件 job 的失败是 apt DNS/Playwright 安装问题，不能报告为数学断言失败；仍需重跑。

### 验证与边界

目标 worktree 独立 immutable install（root、SDK，skip-build）完成，未复用其他 checkout 的 node_modules。SDK 全量 63 文件、948 tests 通过；Rainer zip 对组合分支 38 tests 通过（skip-rust）；BTC dust/sentinel 2 项复现通过。SDK 受管理 prebuild/types/CJS/ESM 构建通过，WASM hash 保护的 Vite bundle 构建通过。根主应用与 landing 类型检查通过；完整前端 335 文件通过、1 文件跳过，3,414 tests 通过、1 既有跳过。页面首轮 1 通过、1 失败：flag-off 用例 15 秒内未出现网络选择器，snapshot 仅 loading；独立复验两项全部通过（0 skipped/flaky/unexpected），未修改测试，两个运行的 owned Vite 端口均释放。首轮超时原因未证实，不能归因特定 PR。

原始日志保留本机 `/tmp/fesol56-{sdk-tests-final,harness-combined,repro-final,sdk-build,wasm-build,frontend-tests,root-types,browser,browser-final}.log`；SDK 构建收据在目标 `.local/acceptance/sdk-artifacts/build-WjPJEi/`。这些是本机证据，非已提交可移植测试材料。未执行真实钱包/ALT 签名、模拟发送、广播、keeper 验收；FESOL-71/72 的条件与部署版本仍须单独核实。

页面复验报告：目标 `.local/acceptance/solana-browser/managed-lzlRi8/report.json`；首轮失败：`managed-gn64M8/report.json`，均保留截图/trace 与日志。后续若复发，优先定位加载阶段，不能用这两项基础冒烟替代交易 UI 验收。

## 2026-11-13 实施进行中

业务现场仍为 `/Volumes/kenny/gmx/gmx-interface-fesol-56` 的 `solana-order-transactions-fesol-56`；基础目录维持 `solana-integration`，没有把业务改动写入基础。已实现但尚未提交：固定 WASM ABI 的 create/update/cancel、prepare position、原子增仓加 TP/SL 单笔重编译、完整指令/账户校验、模拟/签名/发送边界、Privy Solana 签名桥接及确认后刷新统一缓存。Order.solana 保留原 API 订单账户上下文，解决显示 mapper 丢失问题。

固定外部 SDK 为 `@gmsol-labs/gmsol-sdk@0.9.0-test.2`，ABI 对照协议仓库 v0.9.0（c6778dc9）。该版本高级 create API 内部生成 nonce，默认 keeper fee 300000 lamports，不暴露显式 nonce/自定义 execution fee；禁止误称支持。回调、swap remaining accounts、Token-2022 尚未扩展 allowlist，明确拒绝并留 TODO。WASM TransactionGroup 不等于 atomic；原子组合只有在单笔 v0、1232 bytes/1.4M CU 限制内才接受。

真实 WASM 正例已覆盖五种订单双向及 update/cancel、native wrapping、LUT 原子组合；恶意指令/接收人/金额/截断/LUT、实际 Ed25519 本地签名和发送边界的定向测试在补充中，尚不作为最终全量通过记录。SDK 新 Order 字段生成构建通过；root 类型检查曾通过，后续安全修正仍需最终复验。

用户已解锁现有 kenny Chrome 的 Phantom；只操作该窗口，禁止 Chrome DevTools/Playwright 或新 automation profile。当前本任务 Vite 为目标目录 127.0.0.1:3016。主网四钱包/交易/keeper 验收尚未完成，不能用本地签名测试冒充。FESOL-19/20 负责完整下单 UI/回执，本需求提供可消费适配器，不新增平行产品页面。

### 实施与实际验收结果（2026-11-13）

- 固定 WASM 构建覆盖 market/limit increase、market decrease、TP/SL、update/cancel，prepare user/position/ATA、精确 SOL wrapping，最多一笔增仓加一 TP/一 SL。原子组合重编译为单笔 v0，去除完全相同的幂等准备指令，严格保持用户价格/金额意图。最多 1232 bytes、1.4M CU；超限明确拒绝，不降级成多笔伪原子。
- 全部交易/指令/参数/账户/nonce-PDA/LUT 解析、payer/owner/receiver/rentReceiver、回调拒绝和具体 ABI 均做确定性校验；签名前真实 RPC 模拟、费用和余额检查；Privy Solana 只签字节，验证消息不变及真实 Ed25519 签名，签名前及每次广播前实时 flag/session/blockheight 再检。确认刷新统一余额、订单、仓位缓存，并传 minContextSlot；已确认链上成功与 API 刷新失败分开返回。
- 多笔动作只检查当前交易的 keeper/wrap 预留，避免之前准备步骤花费后仍要求整计划预算。`GmsolTransactionError` 保存已接收的 signatures 和可能已广播的 pendingSignature；send RPC 超时也必须先查签名，不自动重试下单。
- 订单 metadata 以可选 `Order.solana` 保留，update 校验原 order kind/side 与已知 market decimals；修正 update minOutput：增仓为 token 原始单位，减仓为 app USD。已有 57 dust 预览、统一余额与 discount/math rollout 缺口仍按上文归属，不能因 builder 完成而视为解决。
- 现有 kenny Chrome/Phantom 连接成功，Solana 共享页行情/钱包头部正常；钱包选择弹窗列出 Phantom/Solflare/OKX/TokenPocket。联调发现 Privy useSignTransaction 每 render 返回新函数，已用 ref 避免会话发布 effect 循环，并有回归测试。共享 trade 按钮仍显示“连接钱包”是下游 FESOL-19 的消费/统一状态接入缺口，本次没有伪造完整下单 UI 已验收。
- 真实 GMX RPC mainnet genesis 正确，实时 solanaTrading=true。两个配置 LUT 分别 73/155 个地址，authorityOption 均 1、active，**仍可变**；生产 prepare 明确拒绝“Trading requires frozen lookup tables”。FESOL-71 须提供冻结表/GMX 审查后的冻结副本，且核验内容对所需市场和原子组合的覆盖。
- 为覆盖实际协议执行，仅在忽略的本地只读验收工具中用现有可变 LUT 的快照做诊断模拟；没有签名或广播，也未放宽生产入口。连接 Phantom 的公开 account 上，BTC/USDC limit increase 成功（807 bytes，网络费估算 45000 lamports）；increase+TP 成功（1044 bytes/55000）；increase+TP+SL 成功（1221 bytes/65000），最后确认模拟 slot=468611155。后两例 TP/SL 使用明确 unlimited acceptable price（协议 None），不是自动修改有限边界。
- 相同 3 单均指定有限 acceptable price 时为 1255 bytes，超过 1232，安全拒绝。不能为追求塞进单笔而静默删用户边界；FESOL-71 还需更完善的 LUT 覆盖。冻结现有内容本身不证明所有输入能原子发送。
- 全量 frontend 337 文件通过、1 既有文件跳过；3423 tests passed、1 既有 skipped。最后安全/会话修正后定向 4 文件/12 tests passed；root+landing typecheck、变更 ESLint 与 Prettier 通过（收尾仍核对进程退出码）。首次 production app build 在 render chunks 达默认 Node heap 上限，正在以命令级 8 GiB heap 复验；不是业务断言失败。

当前业务说明及 TODO 在需求分支 `src/domain/gmsol/transactions/README.md`。未完成主网广播/keeper 和四钱包真实 LUT 签名验收；固定 SDK 高层 create 不暴露显式 nonce/自定义 execution fee；callback/swap/Token-2022 均拒绝而非推测性兜底；FESOL-19/20 消费 UI/回执与 FESOL-112 数学部署仍需继续。这些是明确范围/条件限制，不声称 FESOL-56 所有验收项已通过。

本轮可复用日志：`/tmp/fesol56-implementation-full-tests.log`、`/tmp/fesol56-final-targeted.log`、`/tmp/fesol56-final-{root-types,landing-types,lint,format}.log`；首次 OOM `/tmp/fesol56-final-app-build.log`，8 GiB 重试 `/tmp/fesol56-final-app-build-8gb.log`。忽略的本地浏览器验收工具在目标 `.local/fesol56/`，使用 native CUA 操作原窗口；不可把诊断绕过冻结检查误当作生产准备通过。
