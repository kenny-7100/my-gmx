# Agent 本地运行版本矩阵

核验日期：2026-10-27。适用于本仓库个人基础设施及其指向的前端、SDK、API checkout。用于执行测试和验收前选择运行时与依赖；不是整个项目的跨版本兼容性承诺，也不代表 Solana 业务就绪。已核对声明、检查器和本机状态，并补充本机 Node 22.17.0/22.22.0 的指定离线入口及真实 Chrome 页面冒烟比较；不修改版本配置、不安装或升级依赖。

## 先选择执行环境

**运行现有 Agent 前端/SDK/API 离线入口时使用 Node 22。** 根 [README](../README.md) 与 [.nvmrc](../.nvmrc) 声明 Node 20；这不能替代个人工具自己的 Node 22 前置。SDK 的发布包 engines 也不等于其测试工具链要求。进入其他 checkout 后重新确认实际 Node，不能假定目录切换已经切换运行时。

在含个人工具的主仓库根目录执行以下只读命令，按任务选择检查项：

```sh
node --version
# Use the checked-in Yarn release without a Corepack download.
node .yarn/releases/yarn-4.12.0.cjs --version
node scripts/agent-environment.mjs --checks node,yarn,frontend
node scripts/agent-environment.mjs --checks node,sdk,sdk-artifacts,wasm
node scripts/agent-environment.mjs --checks node,api
```

若当前不是 Node 22，先使用本机已准备的版本管理器切换到已有 Node 22，再重新检查；若缺少该运行时或锁定依赖，先按[环境准备](coding-and-self-review.md#执行前的环境检查与顺序)处理，不自动下载、不改 `.nvmrc` 或依赖版本绕过检查。没有明确所需资源时暂停依赖工作并协调。以上清单仅盘点工具自身 checkout；其他目标按下表指定入口核对。

## 声明、入口要求与本机观察

下表保留首次只读 `agent:environment` 和 package 元数据盘点的观察；ready 的含义限于[环境清单](agent-environment.md)定义的检查范围。Node patch 的离线测试与后续真实页面冒烟分别列在下方；首次盘点不刷新，Chrome 版本与页面运行仅以下方新增实测为准，Docker daemon、真实服务或业务状态不因此刷新。历史结果仍按原观察日期理解。

| 范围 | 仓库声明 / 固定配置 | 现有入口的实际要求 | 本轮本机观察与限制 |
| --- | --- | --- | --- |
| 主前端 Node | [README](../README.md) 与 [.nvmrc](../.nvmrc)：20；[package.json](../package.json) 没有 engines.node | [前端离线工具](../scripts/frontend-offline-tests.mjs) 明确检查 major=22；根原生 `test:ci` 与该个人入口不同 | 当前 22.17.0；未运行 Node 20 测试或宣称其不兼容；Node 20/22 配置差异仍存在 |
| SDK Node | [sdk/package.json](../sdk/package.json)：engines.node `>=18.0.0`，SDK 目录无独立 `.nvmrc` | [SDK 离线工具](../scripts/sdk-offline-tests.mjs) 明确检查 major=22；包 engines 不证明所有开发依赖可在 Node 18 运行 | 由当前 Node 22.17.0 调用；未验证 SDK 发布包的完整 Node 支持范围 |
| API Node | [gmx-api/package.json](../gmx-api/package.json)：`22.x`；[gmx-api/.nvmrc](../gmx-api/.nvmrc)：`v22.23.4`；[API README](../gmx-api/README.md) 仍写 22.17.0 | [离线](../scripts/gmx-api-offline-tests.mjs)、[集成](../scripts/gmx-api-integration-tests.mjs)、[类型](../scripts/gmx-api-tscheck.mjs)、[路由准备](../scripts/gmx-api-prepare.mjs)及[测试发现](../scripts/gmx-api-discover-tests.mjs)入口明确检查 major=22 | 当前调用工具的是 22.17.0，符合 major 条件，但不等于已使用 `.nvmrc` 指定 patch；README 与配置的差异未修改 |
| Yarn | 根、SDK、API packageManager 均为 `yarn@4.12.0`；根 [.yarnrc.yml](../.yarnrc.yml) 固定仓库内 release，SDK [.yarnrc.yml](../sdk/.yarnrc.yml) 相对引用父目录 release；API [.yarnrc.yml](../gmx-api/.yarnrc.yml) 仅指定 node-modules | 根可直接用提交的 [Yarn 文件](../.yarn/releases/yarn-4.12.0.cjs)；不同目录各用自己的 package/锁文件，不把可调用 Yarn 当成依赖已安装 | 根本地 release 为 4.12.0；环境清单不执行 API 的 Corepack，也不证明全新安装成功 |
| 前端测试依赖 | 根 package 精确声明 Vite 6.4.3、Vitest 4.1.11、tsx 4.19.0、TypeScript 5.4.2 | 前端独立目标必须有自身依赖，目标 Vite/Vitest 与基础设施安装版本相同；其余实际加载前置见[前端离线说明](frontend-offline-tests.md) | 四项安装版本与声明一致；这不是完整依赖树审计 |
| SDK 测试依赖 | SDK package 精确声明 Vitest 4.1.11、tsx 4.19.0、TypeScript 5.4.2 | SDK 独立目标使用自身 Vitest 可执行文件，Vitest 版本须与基础设施一致；见[SDK 独立目录说明](sdk-offline-tests.md) | 三项安装版本与声明一致；SDK Vitest 与根一致 |
| API 测试依赖 | API package 精确声明 Jest 30.2.0、ts-jest 29.4.6、tsx 4.20.5、TypeScript 5.4.2 | 使用目标 API 自己的 Jest/转换器/TypeScript，沿用目标配置和路由前置；不要求 tsx 与前端相同，见[API 说明](solana-api-local.md) | 四项安装版本与声明一致；版本号不同不能单独判定 Jest/ts-jest 不兼容，也不能因此升级依赖 |
| Playwright | 根 package 精确声明 `@playwright/test` 1.58.2；[浏览器预检](../scripts/solana-browser-preflight.mjs) 比较安装与声明 | 使用基础设施锁定的 runner；[页面配置](../playwright-solana-readonly.config.ts) 指定 channel=chrome；独立目标仍准备自己的依赖/资源，见[页面验收](solana-browser-smoke.md) | 首次盘点 Playwright 1.58.2 匹配；后续两项真实页面运行结果见下方浏览器实测 |
| Chrome / 系统 | 浏览器预检固定 macOS `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` 和 Linux `/opt/google/chrome/chrome`；未固定 Chrome 版本 | 环境清单只检查文件及执行权限；预检不支持的平台明确 blocked。进程组清理等工具使用 POSIX 能力；不承诺 Windows 兼容 | 首次盘点仅确认本机 macOS Chrome 文件可访问；后续已补充下方两个 Node patch 的真实页面实测及可执行文件版本。Linux/Windows 未验证。需要版本证据时另行记录该次实际浏览器版本，不能从 channel 或 Playwright 版本推断 |
| Docker / PostgreSQL | [API 集成工具](../scripts/gmx-api-integration-tests.mjs) 固定本地 `postgres:15`，无 Docker CLI 支持版本区间声明 | 集成测试还需 daemon 可达、镜像已准备；入口只 inspect、不自动 pull，使用独立临时容器；见[API 集成说明](solana-api-local.md) | Docker CLI 29.8.2 可调用；本轮未连接 daemon、检查镜像或启动容器，不能据此认为数据库就绪 |
| SDK 构建 / WASM | 构建产物按[来源收据](sdk-artifacts.md)核验；WASM 按[运行时指纹](solana-runtime-preflight.md)核验 | 源码测试无需构建；根类型检查先 verify SDK 产物。Node/工具链变化可能使收据失效，需按原入口重新核验；构建仍遵守独立授权 | 1090 个 SDK 产物 verify 通过，本地 WASM 0.9.0-test.2；不证明链上程序兼容或协议数学正确 |

具体 package 版本以目标 checkout 的 package/锁文件与本次报告为准。依赖包自己的 engines 仅是包声明，不把它们的并集当成整个项目已测试范围。例如 SDK engines `>=18.0.0` 与 SDK 测试入口 major=22 可以同时成立，分别描述发布消费和个人开发工具两个范围。

## Node 22 patch 实测范围

2026-10-27 使用本机已有 Node 22.17.0 和 22.22.0，沿用当前 checkout 及各自已安装的锁定依赖，不做新安装或版本配置修改。每个子进程显式使用所选 Node 绝对路径，并仅在该进程的 PATH 前置其 bin；离线测试子进程由现有运行器通过 process.execPath 启动，没有切换当前终端默认 Node。

| 入口 | Node 22.17.0 | Node 22.22.0 | 证明边界 |
| --- | --- | --- | --- |
| `test:agent-tools` | 118 项通过 | 118 项通过 | 个人工具离线回归，不是业务/服务就绪 |
| `frontend:test-offline` 默认范围 | 3 文件 / 17 项通过 | 3 文件 / 17 项通过 | 原默认局部前端测试，非完整需求覆盖 |
| `sdk:test-offline` 默认范围 | 3 文件 / 153 项通过 | 3 文件 / 153 项通过 | BigMath、numbers、fees 源码测试，不需 SDK 构建 |
| `gmx-api:test-offline` 默认范围 | 2 suite / 12 项通过 | 2 suite / 12 项通过 | API 纯计算，不启动服务或数据库 |
| 根 `test:ci` 完整前端 | 本轮未重复；上一轮 22.17.0 的结果保留原记录 | 299 文件 / 3014 项通过，1 文件 / 1 项既有跳过 | 本轮只对候选 patch 扩大到完整前端；不是 SDK/API 全量或页面验收 |
| `solana:runtime-preflight --local-only` | passed | passed | 固定本地 SDK/WASM 指纹，未读链上部署 |
| `sdk:artifacts verify` | passed / 退出 0 | blocked / 退出 2 | 现有产物来源收据绑定 22.17.0；切换 patch 后须重新准备才能供该版本的类型检查使用 |

上述报告核对了所选范围、原生结果、源码/工具前后一致及进程清理。本次检查的本机 NVM 已安装列表不含 Node 20 或 API `.nvmrc` 指定的 22.23.4，本轮未安装它们，也不推断这些版本的结果。其他系统、浏览器、数据库、完整构建、全新安装和 SDK 发布包消费仍未验证。

**实际可复用结论：** 两个已测 patch 的上述源码测试入口可在当前依赖环境运行；这不是把 22.x 全部标为 ready。22.22.0 下旧 SDK 产物 verify 正确拒绝，故没有跳过前置运行该版本的根类型检查，也没有构建或替换产物。需要切换开发/类型检查 Node 时，先核实已有产物的 Node 来源；完整版本变化也会失效，不能只比较 major。

从基础设施仓库根目录重复某一入口时，使用本机实际已准备的 Node 路径；下面为命令模板，不安装运行时或改变终端默认版本：

```sh
MATRIX_NODE=/path/to/node-22/bin/node
"$MATRIX_NODE" --version
env PATH="$(dirname "$MATRIX_NODE"):$PATH" "$MATRIX_NODE" .yarn/releases/yarn-4.12.0.cjs test:agent-tools
env PATH="$(dirname "$MATRIX_NODE"):$PATH" "$MATRIX_NODE" scripts/frontend-offline-tests.mjs
env PATH="$(dirname "$MATRIX_NODE"):$PATH" "$MATRIX_NODE" scripts/sdk-offline-tests.mjs
env PATH="$(dirname "$MATRIX_NODE"):$PATH" "$MATRIX_NODE" scripts/gmx-api-offline-tests.mjs
env PATH="$(dirname "$MATRIX_NODE"):$PATH" "$MATRIX_NODE" scripts/sdk-artifacts.mjs verify
```

保留每次实际 Node 版本/路径、命令、退出码、原始报告和锁文件/工具身份。切换 Node 后旧报告不能自动代表新运行时；某一检查受阻时按其前置处理，不将预期拒绝改成通过。工程测试及本机证据详见[patch 实测记录](solana-agent-friendliness-history.md#node-patch-兼容性实施与验收记录2026-10-27)。

## Node 22 patch 真实浏览器实测

2026-10-27 在同一 macOS checkout 顺序使用本机已有 Node 22.17.0、22.22.0，通过现有 `solana:browser-check` 执行两项本地网络选择用例。使用锁定 Playwright 1.58.2 和 stable Chrome channel；执行前后调用其实际可执行文件 `--version`，均为 Google Chrome `156.0.8078.48`。该版本来自可执行文件输出，不从 Playwright 版本推断，也未新增浏览器版本支持承诺。

| 实际 Node | 真实页面结果 | 原生测试耗时 | 身份与清理 |
| --- | --- | --- | --- |
| 22.17.0 | 2 passed，0 skipped / flaky / unexpected，无重试，退出 0 | 48.5 秒 | 相关源码/工具前后一致，Vite 停止、3015 端口释放 |
| 22.22.0 | 2 passed，0 skipped / flaky / unexpected，无重试，退出 0 | 47.0 秒 | 与首轮目标及相关源码/工具摘要一致，Vite 停止、3015 端口释放 |

两轮目标均为 `e9465deb00dbe3acd7bf00001882c0e71f908aa7`、dirty=true（路线表实施中状态），不是干净业务交付证据。每轮独立保存原生 JSON/HTML、日志及状态/诊断附件，首轮报告未覆盖。复核实际断言：关闭开关保持 Arbitrum 且没有 SDK/WASM 请求；开启可选择 Solana、刷新保持、切回退出；EVM 网络及结算 ID 保持 42161。每轮关闭/开启用例均无未处理 JS 错误，分别保留 2/29 条外部请求失败或刷新中断记录，不据此认为所有 RPC/keeper/Privy 等服务正常。

重跑时复用上方 `MATRIX_NODE` 模板，将命令改为 `"$MATRIX_NODE" scripts/solana-browser-check.mjs --port 3015`，同时仅在该进程 PATH 前置对应 bin；不切换终端默认 Node。管理入口已包含预检，不额外先跑相同预检。端口占用时选其他未用端口，不接管服务；运行身份、报告和停止条件见[浏览器说明](solana-browser-smoke.md#一条命令执行并保存独立报告)。本次不安装、不构建、不修改版本配置或用例，不连接钱包、签名或广播。

本轮只补齐既有两项页面冒烟的 patch 比较；SDK 产物收据在 22.22.0 下的既有受阻结论不变，未绕过 verify 做类型检查。其他页面、完整构建、数据库、跨系统、新安装、真实钱包及交易仍未验证。原始报告、Node 绝对路径/版本/命令/退出码、Chrome 版本输出和联合复核保存于本机忽略目录 `.local/acceptance/agent-tools/node-browser-matrix/`；完整目录与摘要见[本轮历史记录](solana-agent-friendliness-history.md#node-patch-浏览器兼容性验收记录2026-10-27)。它是本机测试观察，不使历史环境状态自动续期。

## 独立 checkout 与版本变化的处理顺序

1. **记录目标。** 前端用 `--project-dir PATH`，SDK 用 `--sdk-dir PATH/sdk`，API 用 `--api-dir PATH`；从基础设施根目录调用入口，检查报告实际路径、commit、dirty 和 runtime。嵌套 API 有自己的 Git 身份及锁文件，不能把主仓库的 SHA 当作 API 版本。
2. **核对当前 Node 与目标依赖。** 个人入口使用 Node 22，但 major 通过不证明所有 patch 兼容。SDK 若单独拷出，其 yarnPath 所需父目录文件可能不存在；查实际 checkout 配置，不假设根 Yarn 配置自动适用于独立仓库。依赖准备遵循各专题，不临时链接开发目录 node_modules 来掩盖缺失。
3. **版本不符时处理环境。** 前端目标 Vite/Vitest 或 SDK Vitest 与基础设施不匹配时先停止该项验收；确认目标锁文件与工具兼容方案，不修改业务依赖或关闭检查只求通过。API 使用其自身依赖，不强行与前端版本对齐。
4. **核对受影响证据。** Node、package、锁文件、构建器或测试工具变化后，重新验证 SDK/路由收据及受影响测试报告；清单 ready 不使历史报告自动有效。按[执行顺序](coding-and-self-review.md#执行前的环境检查与顺序)处理适用前置，不无条件重建或重跑全部检查。
5. **补齐实际服务条件。** 页面测试再检查浏览器，数据库测试再检查 daemon/镜像；RPC、keeper、API 部署、钱包和真实样本仍需各自核验。版本一致不等于服务或需求验收通过。

## 尚未统一及后续验证

本轮已完成版本矩阵、当前差异和操作顺序的沉淀。路线表“统一本地运行版本矩阵”保持**部分完成**：当前入口选择已清楚，已有本机两个 Node 22 patch 的指定离线测试和两项真实页面冒烟实测，但其他页面、完整构建/数据库、跨系统和全新安装兼容性尚未验证；根 Node 20 与个人工具 Node 22、API README 与 `.nvmrc` 差异也未收敛。

后续需要统一配置时，先明确验证范围：根原生前端开发/类型/测试/构建、SDK 发布消费与源码测试、API 测试/路由生成，以及页面和进程清理；再在候选 Node 与目标锁定依赖上验证受影响入口。不得仅因本机 Node 22.17.0 曾通过测试，就改写所有仓库的支持范围。安装、构建和其他服务启动仍按原授权执行；本矩阵不新增权限，也不要求当前任务为补矩阵执行这些动作。

文档维护时同步核对根/SDK/API package、各 `.nvmrc`/`.yarnrc.yml`、工具的 Node/依赖检查及实际报告。版本升级后保留历史核验日期，更新当前观察，避免把旧机器状态改写成新的验证事实。本轮验收证据见[版本矩阵历史验收](solana-agent-friendliness-history.md#运行版本矩阵实施与验收记录2026-10-27)。

## Rust数学生成器运行时（2026-10-28）

用户已授权安装Rust 1.90.0（Cargo/rustfmt）、下载固定依赖，并仅编译运行 `tools/solana-trade-math-vectors/` 生成器。官方rustup minimal安装已成功，host为aarch64-apple-darwin，rustc为 `1.90.0 (1159e78c4 2025-09-14)`；未修改shell启动文件，因此新命令不应仅凭 `command -v cargo` 失败判定尚未安装。先检查本机Cargo bin（当前为 `/Users/kenny/.cargo/bin`），在该进程PATH前置后显式使用 `cargo +1.90.0`；不要改HOME或重装工具链。

该生成器的Cargo.lock和依赖缓存已就绪，复跑用 `--locked --offline`；生成两份临时JSON，经已有 `verify.mjs` 核对来源/输入/锁摘要、两次一致性及独立数值后再发布。执行步骤和授权边界见[工具说明](../tools/solana-trade-math-vectors/README.md)。这项已获授权的生成器构建不需重复确认，不扩展到SDK/程序构建、部署、其他依赖安装或钱包交易；完整Solana数学仍未验收。
