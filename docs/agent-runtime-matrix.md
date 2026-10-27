# Agent 本地运行版本矩阵

核验日期：2026-10-27。适用于本仓库个人基础设施及其指向的前端、SDK、API checkout。用于执行测试和验收前选择运行时与依赖；不是整个项目的跨版本兼容性承诺，也不代表 Solana 业务就绪。本轮只核对声明、检查器和本机状态，不修改版本配置、不安装或升级依赖。

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

本机观察来自本轮只读 `agent:environment` 和 package 元数据读取。ready 的含义限于[环境清单](agent-environment.md)定义的检查范围；本轮没有重新运行单元测试、页面、API 服务或数据库。历史测试结果继续以各专题原日期为准。

| 范围 | 仓库声明 / 固定配置 | 现有入口的实际要求 | 本轮本机观察与限制 |
| --- | --- | --- | --- |
| 主前端 Node | [README](../README.md) 与 [.nvmrc](../.nvmrc)：20；[package.json](../package.json) 没有 engines.node | [前端离线工具](../scripts/frontend-offline-tests.mjs) 明确检查 major=22；根原生 `test:ci` 与该个人入口不同 | 当前 22.17.0；未运行 Node 20 测试或宣称其不兼容；Node 20/22 配置差异仍存在 |
| SDK Node | [sdk/package.json](../sdk/package.json)：engines.node `>=18.0.0`，SDK 目录无独立 `.nvmrc` | [SDK 离线工具](../scripts/sdk-offline-tests.mjs) 明确检查 major=22；包 engines 不证明所有开发依赖可在 Node 18 运行 | 由当前 Node 22.17.0 调用；未验证 SDK 发布包的完整 Node 支持范围 |
| API Node | [gmx-api/package.json](../gmx-api/package.json)：`22.x`；[gmx-api/.nvmrc](../gmx-api/.nvmrc)：`v22.23.4`；[API README](../gmx-api/README.md) 仍写 22.17.0 | [离线](../scripts/gmx-api-offline-tests.mjs)、[集成](../scripts/gmx-api-integration-tests.mjs)、[类型](../scripts/gmx-api-tscheck.mjs)、[路由准备](../scripts/gmx-api-prepare.mjs)及[测试发现](../scripts/gmx-api-discover-tests.mjs)入口明确检查 major=22 | 当前调用工具的是 22.17.0，符合 major 条件，但不等于已使用 `.nvmrc` 指定 patch；README 与配置的差异未修改 |
| Yarn | 根、SDK、API packageManager 均为 `yarn@4.12.0`；根 [.yarnrc.yml](../.yarnrc.yml) 固定仓库内 release，SDK [.yarnrc.yml](../sdk/.yarnrc.yml) 相对引用父目录 release；API [.yarnrc.yml](../gmx-api/.yarnrc.yml) 仅指定 node-modules | 根可直接用提交的 [Yarn 文件](../.yarn/releases/yarn-4.12.0.cjs)；不同目录各用自己的 package/锁文件，不把可调用 Yarn 当成依赖已安装 | 根本地 release 为 4.12.0；环境清单不执行 API 的 Corepack，也不证明全新安装成功 |
| 前端测试依赖 | 根 package 精确声明 Vite 6.4.3、Vitest 4.1.11、tsx 4.19.0、TypeScript 5.4.2 | 前端独立目标必须有自身依赖，目标 Vite/Vitest 与基础设施安装版本相同；其余实际加载前置见[前端离线说明](frontend-offline-tests.md) | 四项安装版本与声明一致；这不是完整依赖树审计 |
| SDK 测试依赖 | SDK package 精确声明 Vitest 4.1.11、tsx 4.19.0、TypeScript 5.4.2 | SDK 独立目标使用自身 Vitest 可执行文件，Vitest 版本须与基础设施一致；见[SDK 独立目录说明](sdk-offline-tests.md) | 三项安装版本与声明一致；SDK Vitest 与根一致 |
| API 测试依赖 | API package 精确声明 Jest 30.2.0、ts-jest 29.4.6、tsx 4.20.5、TypeScript 5.4.2 | 使用目标 API 自己的 Jest/转换器/TypeScript，沿用目标配置和路由前置；不要求 tsx 与前端相同，见[API 说明](solana-api-local.md) | 四项安装版本与声明一致；版本号不同不能单独判定 Jest/ts-jest 不兼容，也不能因此升级依赖 |
| Playwright | 根 package 精确声明 `@playwright/test` 1.58.2；[浏览器预检](../scripts/solana-browser-preflight.mjs) 比较安装与声明 | 使用基础设施锁定的 runner；[页面配置](../playwright-solana-readonly.config.ts) 指定 channel=chrome；独立目标仍准备自己的依赖/资源，见[页面验收](solana-browser-smoke.md) | Playwright 1.58.2 匹配；未重新执行页面测试 |
| Chrome / 系统 | 浏览器预检固定 macOS `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` 和 Linux `/opt/google/chrome/chrome`；未固定 Chrome 版本 | 环境清单只检查文件及执行权限；预检不支持的平台明确 blocked。进程组清理等工具使用 POSIX 能力；不承诺 Windows 兼容 | 本机 macOS Chrome 文件可访问；本轮未启动 Chrome 或采集版本，未验证 Linux/Windows。需要版本证据时另行记录该次实际浏览器版本，不能从 channel 或 Playwright 版本推断 |
| Docker / PostgreSQL | [API 集成工具](../scripts/gmx-api-integration-tests.mjs) 固定本地 `postgres:15`，无 Docker CLI 支持版本区间声明 | 集成测试还需 daemon 可达、镜像已准备；入口只 inspect、不自动 pull，使用独立临时容器；见[API 集成说明](solana-api-local.md) | Docker CLI 29.8.2 可调用；本轮未连接 daemon、检查镜像或启动容器，不能据此认为数据库就绪 |
| SDK 构建 / WASM | 构建产物按[来源收据](sdk-artifacts.md)核验；WASM 按[运行时指纹](solana-runtime-preflight.md)核验 | 源码测试无需构建；根类型检查先 verify SDK 产物。Node/工具链变化可能使收据失效，需按原入口重新核验；构建仍遵守独立授权 | 1090 个 SDK 产物 verify 通过，本地 WASM 0.9.0-test.2；不证明链上程序兼容或协议数学正确 |

具体 package 版本以目标 checkout 的 package/锁文件与本次报告为准。依赖包自己的 engines 仅是包声明，不把它们的并集当成整个项目已测试范围。例如 SDK engines `>=18.0.0` 与 SDK 测试入口 major=22 可以同时成立，分别描述发布消费和个人开发工具两个范围。

## 独立 checkout 与版本变化的处理顺序

1. **记录目标。** 前端用 `--project-dir PATH`，SDK 用 `--sdk-dir PATH/sdk`，API 用 `--api-dir PATH`；从基础设施根目录调用入口，检查报告实际路径、commit、dirty 和 runtime。嵌套 API 有自己的 Git 身份及锁文件，不能把主仓库的 SHA 当作 API 版本。
2. **核对当前 Node 与目标依赖。** 个人入口使用 Node 22，但 major 通过不证明所有 patch 兼容。SDK 若单独拷出，其 yarnPath 所需父目录文件可能不存在；查实际 checkout 配置，不假设根 Yarn 配置自动适用于独立仓库。依赖准备遵循各专题，不临时链接开发目录 node_modules 来掩盖缺失。
3. **版本不符时处理环境。** 前端目标 Vite/Vitest 或 SDK Vitest 与基础设施不匹配时先停止该项验收；确认目标锁文件与工具兼容方案，不修改业务依赖或关闭检查只求通过。API 使用其自身依赖，不强行与前端版本对齐。
4. **核对受影响证据。** Node、package、锁文件、构建器或测试工具变化后，重新验证 SDK/路由收据及受影响测试报告；清单 ready 不使历史报告自动有效。按[执行顺序](coding-and-self-review.md#执行前的环境检查与顺序)处理适用前置，不无条件重建或重跑全部检查。
5. **补齐实际服务条件。** 页面测试再检查浏览器，数据库测试再检查 daemon/镜像；RPC、keeper、API 部署、钱包和真实样本仍需各自核验。版本一致不等于服务或需求验收通过。

## 尚未统一及后续验证

本轮已完成版本矩阵、当前差异和操作顺序的沉淀。路线表“统一本地运行版本矩阵”保持**部分完成**：当前入口选择已清楚，但还没有跨 Node patch、操作系统或全新机器安装的兼容性验收，根 Node 20 与个人工具 Node 22、API README 与 `.nvmrc` 差异也未收敛。

后续需要统一配置时，先明确验证范围：根原生前端开发/类型/测试/构建、SDK 发布消费与源码测试、API 测试/路由生成，以及页面和进程清理；再在候选 Node 与目标锁定依赖上验证受影响入口。不得仅因本机 Node 22.17.0 曾通过测试，就改写所有仓库的支持范围。安装、构建和其他服务启动仍按原授权执行；本矩阵不新增权限，也不要求当前任务为补矩阵执行这些动作。

文档维护时同步核对根/SDK/API package、各 `.nvmrc`/`.yarnrc.yml`、工具的 Node/依赖检查及实际报告。版本升级后保留历史核验日期，更新当前观察，避免把旧机器状态改写成新的验证事实。本轮验收证据见[路线表记录](solana-agent-friendliness-roadmap.md)。
