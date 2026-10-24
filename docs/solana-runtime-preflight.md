# Solana SDK 与程序版本证据预检

更新日期：2026-10-25。对应 A14；状态：**本轮 SDK/WASM 完整性与 Mainnet 程序指纹范围已完成并验收通过**。

## 用途与完成边界

后续 Agent 验证 gmsol SDK 计算、交易构建、程序升级影响时，先记录本地 SDK/WASM 与链上程序部署指纹，避免把不同版本的结果混在一起。工具是测试验收基础设施，不修改前端业务代码、配置或链上状态。

入口：[scripts/solana-runtime-preflight.mjs](../scripts/solana-runtime-preflight.mjs)。复用现有 Node 22、tsx、ethers 和只读 RPC 代理，没有添加依赖。直接动态读取 `src/config/gmsol/sdk.ts` 与 `program.ts`，不另建程序或 SDK 版本配置。

该工具只验证已配置 WASM 的完整性、记录 JS 入口和程序指纹；不证明 SDK 与程序的业务兼容、程序审计版本、可复现构建或业务计算正确。链上摘要没有预设“正确版本”，记录的是本次观察值，不能把 passed 理解成已批准当前链上程序。

## 执行顺序

只需本地 SDK 环境检查时，在主仓库根目录执行：

```sh
yarn solana:runtime-preflight --local-only
```

需要固定链上证据且已获只读请求授权时，先启动既有代理：

```sh
yarn solana:rpc-proxy
```

再在另一终端运行：

```sh
yarn solana:runtime-preflight
```

工具不启动服务、不构建、不安装依赖、不读钱包或助记词、不签名或发送交易。既有 RPC 地址继续来自同一配置，支持进程级 `SOLANA_RPC_PROXY_URL`；不打印完整密钥 URL。

先检查本地，再读链。缺少独立产物时报告 `missing-artifact`，不能跳过或自动构建。按现有开发流程取得构建授权并准备产物后再重跑；该命令本身不扩大构建授权。任务只涉及钱包或样例 HTTP 时，无需额外运行本检查。

本地检查比较项目声明与安装 SDK 的精确版本；核对 npm WASM 和本机独立产物中的 WASM 都匹配 `GMSOL_SDK_WASM_SHA256`。从 `entry.js` 中定位唯一的相对 WASM 引用，拒绝远程、越界、多文件或缺失引用。记录入口、安装包 wrapper、相关配置和源码 SHA-256。JS 入口标为 `fingerprint-only`：现有项目没有已批准 JS 入口摘要，因此只记录其身份，不能据此证明入口由当前源码构建。

## 链上指纹与大账户读取

先复用完整 Mainnet genesis 校验，再对配置中的 gmsol 程序进行 finalized 读取，验证账户属于 Upgradeable Loader、为 executable 的 Program 类型，取得实际 ProgramData 地址。ProgramData 头按官方 loader 状态布局解码：4 字节枚举（ProgramData=3）、8 字节小端 deployment slot、Option tag 和 32 字节 authority；固定程序区偏移为 45。布局依据：[Solana loader-v3 state.rs，固定提交 6437e43](https://github.com/anza-xyz/solana-sdk/blob/6437e43e15e405acaecadb4b806a6593dfce729c/loader-v3-interface/src/state.rs)，其测试验证 bincode/wincode 字节兼容。

本次真实 ProgramData 账户为 4,376,045 字节，整份 jsonParsed 响应多次超时；小范围读取成功。工具因此在同一供应商、同一代理上显式使用 base64 dataSlice，每段最多 256 KiB，顺序覆盖全部程序区，增量计算 SHA-256，不是取前几个字节代替整份摘要。每段继续使用既有 25 秒客户端/20 秒代理超时，不增加自动重试或备用 RPC，不修改代理超时。

读取前后各取一次完整 45 字节元数据；必须部署 slot 早于观察 slot、元数据与账户大小前后一致、读取 slot 不倒退。程序区必须以 ELF 标记开头；若读取期间发生升级、截断、归属变化或任一请求失败，整项失败，不接受混合摘要。使用 finalized 降低分叉影响，但多请求不等于单一原子快照。账户预留的尾部字节也包含在程序区摘要中；该摘要不是去掉 padding 后的 ELF 构建产物 hash。

正常当前账户会执行 21 次 RPC：genesis、Program、初始头、17 个程序分段、结束头。仅在需要部署证据时运行，不加入每次轻量默认预检，也不做负载测试。

## 报告、失败与归档

成功 stdout 为单份 JSON，退出 0；失败 stderr 为脱敏错误、阶段和错误码，退出 1，无成功报告。`--local-only` 的 scope 为 local-artifacts，chain 明确 not-run，不代表链上已验收。

报告记录检查时间、本地仓库 SHA/dirty、Node 版本、SDK 版本、WASM 已批准/实测摘要、入口与源码摘要，以及 Mainnet genesis、程序地址、ProgramData 地址、loader、部署 slot、upgradeAuthority、读取 slot 范围、字节数、分段数、程序区摘要。upgradeAuthority 为 null 表示当时读取的元数据没有升级权限地址，不是对整个协议权限的审计。

常见错误：missing-artifact（文件/依赖缺失）、sdk-version-mismatch、wasm-hash-mismatch、invalid-artifact、invalid-program-account、invalid-program-data、unstable-program-data，以及既有 RPC 的 wrong-network / http-error / timeout / network-error。按报错阶段诊断；上游错误不得转换为“没有程序”或成功。

```sh
mkdir -p .local/acceptance/solana-runtime
yarn solana:runtime-preflight > .local/acceptance/solana-runtime/report.json
```

该目录已忽略提交；失败时 stdout 可能为空，先核对退出码与 JSON 再消费文件。默认不保存大块链上字节或包内容，只保存摘要和公开元数据。报告是时间快照，程序升级或 SDK/配置变化后重新读取；dirty=true 的 commit 不能完整还原本地修改。自行启动的代理在完成后关闭。

## 验收进度

| 检查 | 状态与结果 |
| --- | --- |
| 本地 SDK | 已通过；声明/安装为 0.9.0-test.2，npm 和独立 WASM 均匹配固定 SHA-256 |
| 链上程序 | 已通过；loader/程序类型正确，17 段完整读取，前后元数据一致 |
| 自动测试 | 4 组通过：实际固定配置的版本/摘要、非法入口引用、ProgramData 布局与权限、超安全整数 slot、跨段摘要、截断/升级/错误网络/RPC 错误 |
| 独立对照 | 已通过；另用 512 KiB 分段（9 段）与文件摘要计算核对，得到相同摘要 |
| 工程、停服与交接 | 已通过；停服时退出 1 / network-error、无成功报告，local-only 仍 passed 且 chain 为 not-run；ESLint 零警告、格式、Node 语法、类型检查和文档检查通过 |

测试入口 `yarn test:solana-runtime-preflight`；测试使用当前真实 SDK 包和配置、本地生成 loader 账户字节及 mocked fetch，不访问实际 RPC，不读取钱包秘密。链上解析仅用于证据工具，不复用为业务 SDK 或程序解码器。

2026-10-25 最终验收：主仓库基线 `3b697f780d62a15c0aff1d2dc9ad7b25c77bef56`，实施中 dirty=true；报告时间 `2026-10-24T17:43:16.290Z`（北京时间 2026-10-25）。程序 `Gmso1uvJnLbawvw7yezdfCDcPydwW2s2iqG3w6MDucLo` 的 ProgramData 为 `CSp2sB68THdrJP6N7Au4Y5u89VJ1E1ebaqZ2soHhQvav`，部署 slot `459556802`，升级权限 `6qp7veALWas5rxXJRQXUEbffRtDyhB8koxenBpS51SrA`；完整程序区 4,376,000 字节，SHA-256 为 `e7b0fd8234f26cafcf128df044b337b9acaa844da678428c07638726f7d0e0a1`。这些是观察值，不是长期允许列表。

本机 `report.json` 与独立 `comparison.json` 保存于 `.local/acceptance/solana-runtime/`，目录被 Git 忽略。已核对报告中的检查器摘要与最终文件一致。完整前端单元测试 299 文件通过 / 1 原有跳过，3014 测试通过 / 1 原有跳过，退出 0；日志仍有 Browserslist 过期提示与 happy-dom teardown AbortError，未修改无关依赖或测试。本次启动的代理已关闭，未运行构建、UI、浏览器或部署；未读取钱包或发送交易。
