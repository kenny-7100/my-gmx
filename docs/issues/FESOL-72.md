# FESOL-72 — 最终 WASM 产物与 56 的顺序

## 版本决定已确认（2026-11-14，用户明确）

FESOL-72 最终使用 `0.11.0-beta.1`，源码固定 `7fe4008292ffc09061f3a733ad9b5cd2e6235fa8`，沿用当前 GMX 自建产物和 hash。版本选择不再列为待确认或阻塞项；此用户决定优先于下方历史的0.10.0差异/维护者待确认记录，不推断为Divhead本人回复。当前代码已使用该版本，无需换包、改产物或重跑构建。可信LUT、真实钱包/主网流程与交易大小边界仍按统一记录保留。


## 上游刷新与证据边界（2026-11-14）

本轮新增事实、契约适配、交付及验收结果见[四需求统一记录](../solana-trading-dependencies.md#四需求上游刷新2026-11-14)，优先于下方历史状态。Linear目标访问返回Entity not found，不能据历史正文或评论判定本轮实时状态；GitHub、源码及部署按统一记录分别核验。


## 五条内部依赖同步收尾（2026-11-13）

正式产物已被56 development/delivery精确消费，各目标8文件hash一致；72原development和独立Draft #3259未修改，不重跑已通过Rust/CI，也不扩大旧模拟为落链验收。 完整版本矩阵、验证边界和已保留的依赖顺序见[统一记录](../solana-trading-dependencies.md#五条内部同步结果2026-11-13用户限定不处理外部依赖)。用户本轮明确暂不处理五条之外的依赖；不将本次内部同步视为完整需求验收。

## 交易链路依赖统一核验（2026-11-13 16:16）

本轮参与跨需求依赖分析，核对实际集成版本、PR堆叠和merge-tree预检。新增结论、责任边界与跟进顺序统一见[交易链路依赖审计](../solana-trading-dependencies.md)，不将预检当作实际合并或组合测试通过。

## 当前状态复核（2026-11-13 16:08，Asia/Shanghai）

角色：只读状态与依赖调研。实时查询正文、双向关系、评论、关联 PR checks，并对照既有实施记录；本节优先于下方历史状态。

实时 Linear 仍 Execution、kenny，无评论，标题/正文仍写 v0.10.0；实际用户确认目标与交付为 `0.11.0-beta.1`，以用户明确决策和 PR 为准，本轮未改 Linear。#3259 OPEN/Draft，head `0f36780317`，reviews 为空；Audit、常规 lint/types/tests、SDK standalone、GMX WASM reproduction 均 SUCCESS。组件 job FAILURE 的已有日志为 286 passed 后报告发布/评论 403，保留非全绿边界。正式交付 worktree 成果与独立 CI 8 文件一致证据见下文；八项新版主网记录仅为无签名模拟。71 仍 Todo、无新地址，用户此前已确认等待可信 LUT，真实签名落链/四钱包与 finite-bound 1255-byte 限制未解除；不能标记整需求 Done。本轮未重新构建、模拟或链上查询。

2026-11-13（Asia/Shanghai），角色：依赖与版本目标调研。[Linear](https://linear.app/gmx-io/issue/FESOL-72) 为 Execution，kenny；本轮 GitHub 按 FESOL-72 搜索没有专门 PR，不能据此断言没有任何相关开发。

已读实时正文/关系：56 blocks 72，72 在替换 GMX CI 构建的 WASM 后复验 56 主网流程。72 是最终发布产物与流程复验条件，不能反解为 56 开工前必须先完成全部 72。正文仍称 deployed v0.10.0，而 57 当前参考为 8af1e70c/0.11.0；109 已要求协调目标与 artifact 位置。实际构建/指令 ABI 支持与当前部署兼容未在本轮验证。

本轮未构建 SDK、发布产物或替换 pin；细节见 [FESOL-56](FESOL-56.md)。

## 单条需求复查（2026-11-13 13:37，Asia/Shanghai）

实时查询正文、双向关系与评论（抓取 `2026-11-13T05:37:29.824Z`）：仍为 Execution、kenny，updatedAt 为 `2026-11-11T06:50:10.438Z`，无评论。范围为 GMX CI 使用 wasm-pack bundler target 构建，记录 `.wasm` SHA-256；PR 前与 Divhead 商定 `@gmx-io` npm 包或仓库内文件的产物位置，替换 FESOL-55 的 pin，再复验 FESOL-56 主网流程。验收同时要求应用加载 GMX 构建、主网流程落链、PR 包含 hash；构建成功本身不能代表验收完成。

当前个人基础源码 `package.json` 仍固定 `@gmsol-labs/gmsol-sdk` 为 `0.9.0-test.2`；`src/config/gmsol/sdk.ts` 的路径为 `gmsol-sdk/0.9.0-test.2-v2`，WASM SHA-256 为 `775a7ddb532d6d49a1800a3d8eccca523960d685db8e1800fbd5eb519ed8dd68`。仅核对本 checkout，不代表 release 或线上版本。

关联 FESOL-57 本轮实时正文仍要求 deployed reference `8af1e70c (0.11.0)`，与 72 的 `v0.10.0` 不一致；这是需要确认的构建目标问题，不能直接以数学 reference 替换 WASM 目标，也未重新核验当前链上程序版本。建议先确认目标 tag/commit 与产物位置，再推进固定源码、CI 构建及接入；最终复验依赖 56。此次只读调研及知识更新，未查新 PR、构建、改业务代码或执行链上操作。

## 用户指定 stable 为版本依据后的核验（2026-11-13）

用户明确本需求接入版本以 `gmx-solana-interface` 最新 `stable` 分支实际使用的 SDK 为准，替代上文待询问目标版本的建议。GitHub API 与官方 origin 定向 fetch 一致确认 stable HEAD 为 `27a2612228a2f8cba0a0c9d450eff7b696898fbb`（2026-11-12 19:40:56 +0800，合并 #1094，前端版本 2.18.0）。未切换或移动参考仓库当前 main checkout，仅刷新 stable 远端引用。

- [app/package.json:54](https://github.com/gmsol-labs/gmx-solana-interface/blob/27a2612228a2f8cba0a0c9d450eff7b696898fbb/app/package.json#L54) 精确固定 `@gmsol-labs/gmsol-sdk` 为 **`0.11.0-beta.1`**；[pnpm-lock.yaml:78](https://github.com/gmsol-labs/gmx-solana-interface/blob/27a2612228a2f8cba0a0c9d450eff7b696898fbb/pnpm-lock.yaml#L78) 的 specifier/resolved version 一致，非版本范围。
- `app/vite.config.ts` 使用 `vite-plugin-wasm` 与 `vite-plugin-top-level-await` 接入 npm 包；所查 workflow 未发现自行 wasm-pack 构建此 SDK 的配置。
- npm 官方 registry 的该版本元数据返回 repository 为 `gmsol-labs/gmx-solana`、`gitHead` 为 `7fe4008292ffc09061f3a733ad9b5cd2e6235fa8`，tarball 为 `https://registry.npmjs.org/@gmsol-labs/gmsol-sdk/-/gmsol-sdk-0.11.0-beta.1.tgz`。gitHead 是包发布元数据，尚未独立复现构建或核实其与链上部署的对应关系。

结论：按用户指定依据，FESOL-72 当前接入目标为 `0.11.0-beta.1`；stable 是前端分支名，不能将 npm 版本省略为 `0.11.0` 正式版。GMX 自建产物仍需固定实际源码和构建配置、记录 WASM SHA-256 并复验 56；产物存放方式尚未决定。未修改 Linear 或业务依赖，未构建、发布、签名或发送交易。

## 实施现场（2026-11-13，进行中）

用户已授权创建目标并实施，明确版本为 `0.11.0-beta.1`，产物先采用仓库内文件。开发分支 `build-gmx-gmsol-sdk-fesol-72`，目录 `/Volumes/kenny/gmx/worktrees/FESOL-72`；start 已同步个人基础到 release `e4714280`，合并提交因 GPG 非交互失败后按既有授权用命令级不签名完成，无业务冲突。

源码在官方 `7fe4008292ffc09061f3a733ad9b5cd2e6235fa8` 独立 detached worktree 构建，workspace 与 SDK package 版本一致；Cargo.lock SHA-256 为 `112ddc6a6dabc3c932da7b072917b44efc5b99432d8b7fcc5ce179819085abed`。已实现 `vendor/gmsol-sdk` 文件依赖、源码重建/逐文件比对脚本及独立 CI workflow；默认 app 构建不需要 Rust。保留现有懒加载入口和 Solana flag，Vite 构建核验安装产物各文件 hash。首次 standalone app/landing 类型检查与前端单测通过（3341 passed，1 原有 skipped），加载器 6 项与真实 WASM BigInt 冒烟通过。最终 hash 和验证结果待下面收尾更新。

Linux 实验发现 wasm-pack 0.15.1 的锁定 cargo-platform 依赖要求 Rust 1.91，因此工具安装使用 1.91.0，SDK 编译仍固定 1.90.0。首次 WASM 含本机 Cargo registry 路径；为跨环境重建一致，源码脚本增加 source/Cargo/Rustup 路径 remap，正在重新生成并在 Linux 容器验证。

为核验新 WASM 与交易调用方，已实时确认 FESOL-56 的 Draft PR #3258 仍 OPEN、head `b2fdb4c74543c31523a845eae7ee1cd27356822a`，并将该已核验交付提交合入 72 开发分支，未改 56 原现场、未合上游，也不回流其业务到个人基础。该依赖包含 56 已登记的未合并前置，最终 72 独立交付仍须基于届时 release 精确整理；组合验收不代表这些依赖已合并。主网签名/广播尚未执行，未创建 72 PR。

### 中断恢复与统一构建环境（2026-11-13）

设备意外关闭后恢复时，分支与未提交改动均保留；Docker daemon 已恢复可用，未清理 Docker 数据、镜像或其他任务。固定镜像的 amd64 安装命令在普通容器成功、BuildKit 构建阶段报 `unsupported metadata version in existing installation`，属于本机跨架构构建路径问题，未认定 SDK 业务缺陷。为本地与 CI 使用相同原生平台，统一为 digest-pinned Rust 镜像的 Linux arm64（CI `ubuntu-24.04-arm`），不是继续接受 macOS 产物。脚本 remap source/Cargo/Rustup 路径，固定 Rust 1.90.0、wasm-pack 0.15.1 与 Cargo.lock；Rust 1.91.0 仅安装 wasm-pack 工具。

已生成 Linux arm64 WASM SHA-256 `e82184caacc60828f024743f88a0a92d97b9d3d55db6839e0d3fab8a9b46c840`，与此前 Linux arm64 实验结果一致；全新临时源码目录的独立重建已通过，全部 8 个文件 hash 与字节一致（两轮分别为 1m24s、1m22s）。应用 hash、manifest、BUILD.md 和 Yarn file dependency checksum 均已更新。CI workflow 已改用同一 Docker 构建器，并对安装产物全部 8 个文件核验。

合入 56 后、使用中间产物时的 app/landing 类型检查通过；前端全量测试为 340 files passed、1 file skipped，3435 tests passed、1 test skipped。逐项检查目标源码 IDL 的 5 条交易指令，其 discriminator 与账户顺序全部匹配现有 orderAbi；更新交易文档的版本来源，并明确旧 0.9.0-test.2 的主网模拟记录不能充当新产物主网验收。此前浏览器本地页面可显示 Arbitrum/BTC，Solana flag 关闭时 SDK 请求为空；最终 Linux 产物的浏览器/交易组合验证仍待执行。


### 本地实施切片完成与验收边界（2026-11-13）

业务提交 `6b3b5ec259`（首次构建接入）及 `ae7c2ad21a`（Linux 可复现构建、最终产物与交易来源更新），56 依赖合并为 `c5eca53105`。开发分支工作区干净；尚未整理 release 交付分支、推送业务分支或创建 PR。保留现有任务目录与本地 Vite 3072，恢复时使用任务管理器核对进程，不能把其他服务视为本任务资源。

最终 Linux WASM 的真实交易/生命周期/加载器 4 suites、20 tests 全部通过；`NODE_OPTIONS=--max-old-space-size=8192 yarn build` 成功（1m03s），SDK 独立产物构建及 hash gate 通过。构建目录的 WASM 与 vendor hash 一致；主 app `build/assets` 中搜索未发现 `__wbg_set_wasm` 或 `__wbindgen_start`。源码文件 ESLint 无 error（Vite config 按既有 ignore 未参与 ESLint），手写改动的 Prettier 和 diff whitespace 检查通过。类型声明主体不变，WASM 导出声明只有排序变化；app/landing 类型检查和前述全量 3435 项结果可按受影响范围复用。首次格式命令误调用仓库的 write script，产生 4 个无关格式改动，已仅恢复本任务刚产生的改动，未纳入提交。

用户既有 Chrome 的独立本地标签页显示 Arbitrum/BTC；关闭 Solana flag 时无 SDK 请求。通过原生 DevTools 控制台临时开启 flag，调用实际 `loadGmsolSdk()` 并执行 `apply_factor(100n, 10n ** 20n)` 返回 `100`；finally 已恢复原 flag 和 localStorage，输出确认 disabled。首次浏览器性能计时未返回资源条目，随后对 undefined URL 的 hash 不构成 WASM 证据，已排除；通过明确实际 URL `/gmsol-sdk/0.11.0-beta.1-gmx.1/assets/index_bg-LFWuFgSD.wasm` 的 HTTP 响应逐字节比对 vendor，确认最终 SHA-256 为 `e82184caacc60828f024743f88a0a92d97b9d3d55db6839e0d3fab8a9b46c840`。没有使用独立浏览器/CDP，也未签名或广播交易。

剩余验收：workflow 已实现且相同 Docker 命令在本机通过，但尚无 GMX 远端 CI 成功运行记录；需要用户明确交付指令后基于最新 release 精确整理 72 成果，不能整支带入 56 的未合并前置，并须在实际交付目录复验。需求原文要求 PR 前与 Divhead 对齐产物位置，用户已决定先仓库内文件，尚无与 Divhead 对齐的外部证据。FESOL-56 的受信 LUT/FESOL-71、四钱包签名落链和 finite-bound atomic 1232-byte 限制仍按 56 记录处理；旧版本主网模拟不能替代新产物复验。72 的主网流程尚未验收，因此目标仍 active；本地构建与测试通过不能标记整个需求完成。

### 实时 Mainnet 前置诊断（2026-11-13 14:41，Asia/Shanghai）

继续验收时复用 56 无签名诊断思路，为最终 hash 的 WASM 准备独立本地 scratch，读取实际配置的 Alchemy Mainnet RPC（genesis 已核验）。slot `468829814` 两张配置 LUT 的地址数仍为 73/155、authorityOption 均为 1；调用实际 production decoder 均报 `Trading requires frozen or reviewed GMX-owned lookup tables`。没有放宽生产信任策略。

当前 CLI 账户与既有 Node 专用验收钱包为两个不同公开地址，实际 Mainnet 原生 SOL 均为 0。诊断在余额检查后停止，**没有调用 simulateTransaction**；scratch 的绿色结果仅代表源码/WASM hash、genesis、表元数据及实际 production decoder、账户余额等前置读取通过，不代表新版指令已在主网执行。已向用户询问可用的有 SOL 公开验收地址（可选择当前 Phantom 已连接账户），无需私钥/签名/转账；随后用户已选择当前 Phantom 账户，结果见下一节。

忽略目录 `/Volumes/kenny/gmx/worktrees/FESOL-72/.local/fesol72/` 保存 `mainnet.json`、`mainnet.scratch.spec.ts` 与运行说明，业务分支仍 clean。第一轮测试 harness 在发送请求前遇到 happy-dom AbortSignal 与 Node fetch 不兼容；已改为 Node environment，保留原生 fetch/AbortSignal，仅为导入的 app 模块补充 DOM globals。最终诊断运行约 9.36s。此工具只允许读取与 sigVerify=false simulation，不包含签名或广播入口；仍不能替代 CI 实际运行或主网落链验收。


### 用户选择 Phantom 后的最终 WASM 主网模拟（2026-11-13 15:06，Asia/Shanghai）

用户明确选择“使用当前 Phantom 已连接账户的公开地址”。通过用户既有 Chrome 原生窗口、Phantom 当前 `bb1` 的 Solana 接收地址面板读取公开地址，未切换账户、请求签名或读取私钥；查看后恢复钱包原页面。配置 RPC Mainnet genesis 与最终 WASM SHA-256 `e82184caacc60828f024743f88a0a92d97b9d3d55db6839e0d3fab8a9b46c840` 均核验一致，该账户满足只读模拟余额条件，之前“无可用验收账户”的阻碍已解除。

本轮调用实际 RPC `simulateTransaction`，全部为 sigVerify=false、replaceRecentBlockhash=false、confirmed。使用真实 WASM、产品 builder 与 validator 生成并校验交易，诊断只使用实际可变 LUT 快照；没有修改生产 LUT 信任策略。最终八项模拟均 err=null：

| 无签名模拟 | 字节 | slot | 返回状态 |
| --- | --- | --- | --- |
| Native SOL limit increase | 891 | 468836637 | 2472-byte Order，size=10 USD × 10^20 |
| Create + update | 981 | 468836637 | 2472-byte Order，size=20 USD × 10^20 |
| Create + cancel | 953 | 468836638 | System Program、0 lamports、空数据 |
| Create + update + cancel | 1043 | 468836639 | System Program、0 lamports、空数据 |
| BTC/USDC limit increase | 807 | 468836640 | 2472-byte Order，size=10 USD × 10^20 |
| BTC increase + TP | 1044 | 468836640 | 成功；decrease acceptable price 明确 unlimited |
| BTC increase + TP + SL | 1221 | 468836641 | 成功；两个 decrease acceptable price 明确 unlimited |
| 缺失 owner/user/position 准备 | 1004 | 468836643 | 预读均不存在；模拟返回协议拥有的 user 520 bytes、position 680 bytes |

修改值与取消状态由脚本实际断言；Order size 按 pinned ABI offset 2184 读取。缺失账户诊断使用随机临时 owner（仅取公钥后释放 Keypair，不保存私钥），仅在被模拟的指令序列中由选定账户提供资金；没有真实转账，也未扩大生产 transfer allowlist。TP/SL 的 finite acceptable-price 三单组合重新构建仍需 1255 bytes，产品 builder 明确按 1232-byte 上限拒绝；未削弱价格保护或拆单。

最终日志 `/tmp/fesol-72-phantom-mainnet.log`（scratch 1 passed、10.32s），细项报告与公开账户来源保存在任务忽略目录 `.local/fesol72/`，之前零余额报告另存 `mainnet-before-phantom.json`。scratch 已移回忽略目录，未加入常规测试套件；业务仅更新 transaction README 的新版实际部署兼容证据，未改代码。此后无需因纯文档提交重复全量测试。

当前边界：这证明所测指令组合可以在实际部署上无签名执行，不证明钱包签名、交易已落链、API 索引或 keeper 执行。在 slot 468836635，两张 LUT 仍保留 authority，实际 production decoder 均拒绝；受信 LUT/FESOL-71、四钱包签名落链、finite-bound atomic 限制及真实 GMX CI 运行/PR 前产物位置对齐仍待处理，FESOL-72 不标记完成。未创建 PR、修改 Linear 或发外部消息。

### 独立 release 补丁准备（2026-11-13）

继续审计时定向 fetch 确认 release 仍为 `e4714280749c00a90468abdde3060aae619717e7`，GitHub #3258 仍 OPEN Draft、head `b2fdb4c74543c31523a845eae7ee1cd27356822a`。release 已包含旧 SDK 的懒加载/构建入口，因此 72 的 SDK 构建与 pin 替换可以独立提取，不必将 56 未合并业务捎带进入交付。

已在任务忽略目录 `.local/fesol72/delivery/` 生成 `fesol-72-release.patch` 与英文 `pr-body.md`。用独立 `GIT_INDEX_FILE` 从实际 release 构建索引，`git apply --cached --check` 及实际 apply 通过；18 文件，仅含 72 构建/产物/config/loader test、package 的 source-build 命令和文件依赖、对应 Yarn 锁。未带个人基础或 56 transactions 源码/文档，也未新建交付分支、推送业务或创建 PR。package 与 lock 的最终 diff 已逐项审阅；generated index_bg.js 的 upstream 末尾空行触发 whitespace 提示，保留生成字节以维持重建一致，不格式化生成绑定。

该补丁只证明可应用到所查 release，尚未证明实际交付 checkout 的 install/build/tests 通过，正式交付仍需在目标目录完成适用验证。英文 PR 正文已明确这些边界和待补远端 CI/签名落链证据，未发布。剩余条件与上节相同；已有无签名主网成功记录不扩大为真实落链。

### 正式 release 交付验证与签名回退（2026-11-13）

用户已明确“已对齐，验证后创建 Draft PR”，确认产物位置对齐并授权交付。交付目录 `/Volumes/kenny/gmx/worktrees/FESOL-72-release`，分支 `build-gmx-gmsol-sdk-release-fesol-72`，基于实际 release `e471428074`，仅 18 个 72 文件，不带 56 未合并前置或个人工具。实际交付目录 immutable install 通过且锁未变；独立 Docker 重建全部 8 文件一致（2m52s）；app/landing tscheck 通过；production build 通过（2m45s），输出 WASM hash 一致，主 app JS 搜索无 WASM binding/start；Prettier/applicable ESLint 通过。完整 frontend 325 files passed/1 skipped，3341 tests passed/1 skipped，exit 0（375.65s）；测试 stderr 存在 happy-dom teardown AbortError，不影响终态结果，也不声称零 warning。日志 `/tmp/fesol-72-release-{install,reproduce,types,build,tests,format,lint}.log`。

最终 `git commit -S` 因 pinentry curses 无 TTY 失败，未产生提交。随后用户明确长期规则：**任何时候 GPG 签名失败，都允许改为不签名，包括最终 PR 提交，无需再问**。已同步 AGENTS 与流程入口，用命令级 `git -c commit.gpgsign=false` 完成提交 `0f36780317`，未修改长期签名配置。正式 fork `my-gmx-pr` 分支 push 成功；Draft PR 创建/CI 实际结果待下文补充。用户这次明确规则替代历史最终提交需单次例外的约束，旧 issue 的历史等待记录不再构成当前阻碍。

Draft PR 已实际创建为 [#3259](https://github.com/gmx-io/gmx-interface/pull/3259)，实时核对 OPEN、isDraft=true、base release `e471428074`、head `0f36780317e02bb51e62a7e225867594f99ee7c3`。任务 registry 已 rebind 登记该 delivery 与 PR；没有请求 reviewer、转 Ready 或合并。GMX `Build gmsol WASM SDK` workflow 实际 run [43385852331](https://github.com/gmx-io/gmx-interface/actions/runs/43385852331) 已启动，runner 初始化/checkout/Node/Corepack 成功，当前构建 Linux arm64 builder；等待真实结果，不把本机复现算作 CI 已通过。

### GMX 远端 WASM CI 已验证（2026-11-13）

真实 GMX run `43385852331` 成功（7m11s），日志明确 `GMX gmsol SDK 0.11.0-beta.1: verified` 及固定 WASM SHA-256 `e82184caacc60828f024743f88a0a92d97b9d3d55db6839e0d3fab8a9b46c840`；固定镜像构建、源码重建/全部文件比对、immutable install、app SDK/hash gate、上传均成功。CI artifact [14018473385](https://github.com/gmx-io/gmx-interface/actions/runs/43385852331/artifacts/14018473385)，名称 `gmx-gmsol-sdk-0.11.0-beta.1`，1265433 bytes，archive digest `sha256:e6a7d02d3d57a55845846c2cde2f563dfd721d357211a93bb66c2ffb15b552c1`（这是归档 digest，不是 WASM hash）。已实际下载到 `/tmp/fesol-72-gmx-ci-artifact`，全部 8 vendor 文件逐字节匹配 delivery，CI public app WASM hash 也匹配；不是只相信绿色 job 名称。CI 日志 `/tmp/fesol-72-gmx-ci.log`。

PR 正文已补充实际交付目录验证、GMX CI 链接/结果与已对齐的产物位置。当前 PR 仍 OPEN Draft、head `0f36780317`；Audit 与 SDK standalone build 已通过，general lint/types/tests 和 Component Tests 在最后观察时仍运行，尚不声称全部 checks 全绿。钱包签名/落链、受信 LUT 与 finite-bound 原子大小边界未解除。

组件 workflow `43385852288` 的实际用例 `286 passed (5.6m)`，job 失败仅在随后部署 GitHub Pages 报告和发报告链接（403、Resource not accessible by integration），与此前 56 的 fork 权限问题一致。保留该失败事实，不扩大 token 权限、不修改与本需求无关的共享 workflow。源码 head 未变；更新 PR 正文触发已有通用 workflow 重新运行，最新 general run `43386834825`，尚待终态；Audit/SDK standalone 已通过。完整组件日志 `/tmp/fesol-72-component-full.log`，失败步骤 `/tmp/fesol-72-component-failed.log`。

### 通用 CI 首轮成功（2026-11-13 15:44，Asia/Shanghai）

GitHub 确认同一交付 head `0f36780317` 的 [Run Tests 43385852251](https://github.com/gmx-io/gmx-interface/actions/runs/43385852251) 已 completed/success。已读取完整日志：frontend 325 files/3341 tests passed、1 skipped；SDK 59 files/912 tests passed；multicall 6 files/14 tests passed、1 skipped；public e2e 4 files/50 tests passed、2 skipped。构建、lint、rule tests、app 与 SDK typecheck 及 SDK standalone 均成功。日志 `/tmp/fesol-72-general-ci-full.log`。同 head 因 PR 正文更新触发的第二轮 `43386834825` 在本次观察时仍在 Run tests，不把首轮成功冒充第二轮终态；组件报告发布权限失败仍保留。

交付审计确认 `vendor/gmsol-sdk/build.json`、构建说明、CI workflow 与应用 pin 一致，产物位置已由用户确认对齐，Draft PR 已交付。原始需求的最终主网落链复验仍无证据：已有八项成功记录仅为无签名模拟；受信 LUT/FESOL-71、钱包签名落链及有限价格边界原子组合限制仍按既有验收边界处理，不标记整个需求完成。

第二轮 [43386834825](https://github.com/gmx-io/gmx-interface/actions/runs/43386834825) 随后也已 completed/success，general job 12m27s、SDK standalone 1m51s；最新 PR checks 的 Audit、general、WASM reproduction 与 SDK standalone 均通过，仅组件 workflow 的报告发布/评论权限失败保留。当前无仍运行的必要 CI，不再重跑或修改 PR 正文触发重复任务。

用户随后明确确认：Divhead 尚未提供可信 LUT 地址及核实依据，等待 FESOL-71。目标保留 blocked，Draft PR #3259 保持现状；待获得该前置后再核验表状态、可信归属与覆盖，并按独立授权继续签名/广播验收。不重复运行已通过的 SDK/CI 检查，不将现有模拟结果视为落链验收。

## FESOL-52 共享 Provider 关联接入（2026-11-13）

用户授权的52依赖整合覆盖本需求。原始52 head `258e4da6ab`的消费、共享SDK传递、确认slot/freshness保护及通知组合统一记录于[依赖审计](../solana-trading-dependencies.md#fesol-52-最新依赖接入2026-11-13)。本需求仅更新development组合，独立delivery/#3259保持WASM构建18文件范围，不引入52或56业务。本次不补签名/广播证据，不解除已有外部验收条件。

## 2026-11-13 独立开发切片实施

角色：关联消费：只在development同步56恢复能力，独立WASM交付保持原范围。实施、版本、行为证据与剩余边界见[统一记录](../solana-trading-dependencies.md#独立开发切片实施结果2026-11-13)。未进行真实钱包签名/广播，既有外部验收条件未解除。

## gmx-prompts review 与修复（2026-11-13）

角色：审查。按 gmx-prompts 审查独立 Draft #3259 全部手写构建、pin/hash/loader 与 CI 复现路径，未核实到新需修复问题，业务 head 保持 `0f36780317`。另在最新 release `83474e0e94` 创建 detached 实际合并 `0ea2e9395b`，immutable install、app/landing types、gmsol 5 files/19 tests、8GB WASM bundle build passed。固定 Rust/8 文件输入未变，复用既有真实 GMX CI/独立重建证据，不再重复 Rust 构建。PR 正文已补充审查覆盖与限制，仍 Draft；真实签名落链、71 可信 LUT、finite-bound atomic 大小及 0.11.0-beta.1 的 maintainer 确认仍待处理。方法和逐项矩阵见[统一记录](../solana-trading-dependencies.md#gmx-prompts-review-与修复2026-11-13)。


## 2026-11-14 独立推进收尾

最终CI、19交付组合的原生Chrome未连接钱包回归与56固定WASM原子体积归因已完成，详见[三项收尾](../solana-trading-dependencies.md#独立推进三项收尾2026-11-14)。四PR关键代码检查通过；组件报告403，56另有1 flaky重试通过。未确认需新增业务修复的问题，HEAD未变。原子组合仍1255/1232 bytes，假设单表1221不代表真实LUT可用。71/112及真实钱包验收未解除；72版本已由用户确认。既有Draft正文已更新，未转正式review。
