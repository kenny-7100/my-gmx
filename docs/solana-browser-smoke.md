# Solana 本地只读浏览器冒烟

更新日期：2026-10-25。A09 首个页面入口已实现，静态准备检查通过；真实页面运行尚未执行，须取得启动本地开发服务和 UI 测试的明确授权。不能将测试发现或类型检查通过写成页面验收通过。

## 用途与验收条件

后续涉及网络选择、开关隔离或选中状态持久化的需求，可先运行此入口，快速检查共享页面的基础行为，再追加该需求自身的验收。它复用现有 Playwright fixture、JS 错误诊断、失败请求记录、截图、trace 和 HTML/JSON 报告，不提供钱包注入或业务数据 mock。

| 用例 | 明确预期 | 当前状态 |
| --- | --- | --- |
| `solanaNetwork=false` | 点击 Solana 显示现有 GMTrade 提示；保持 Arbitrum；不选中 Solana；EVM 网络及结算 ID 保持 42161；本次观察期间无 gmsol SDK/WASM 请求 | 待真实页面验收 |
| `solanaNetwork=true` | 可选中 Solana，刷新后仍选中；底层 EVM 网络及结算 ID 保持 42161；切回 Arbitrum 后清除 Solana 选中状态 | 待真实页面验收 |
| 共用诊断 | 页面无未处理 JS 错误；报告包含本地 checkout commit/dirty、目标地址、状态附件；失败保留截图及 trace | 待真实页面验收 |

不覆盖真实钱包连接、余额、交易组件、签名、广播、keeper 执行、远端预览或完整 EVM 回归。无 SDK 请求断言只覆盖当前用例观察窗口，不替代构建产物分析。此入口不修改业务代码、前端默认开关或线上状态。

## 先准备，再执行

工作目录：主仓库根目录。先核对当前授权；下列准备检查不启动浏览器或本地服务。

1. 确认 `@playwright/test` 能从当前工作区解析，再做测试发现及类型检查。2026-10-25 本机 package.json 与锁文件已有 1.58.2，但 node_modules 缺失该包，导致全套 regression 类型报错。使用 `yarn install --immutable --mode=skip-build` 恢复既有锁定依赖；不要升级版本、删锁文件或普通安装。根 `postinstall` 会进入 SDK 安装/构建，普通安装不适合未经构建授权的准备阶段。本轮普通安装已被中止，随后 skip-build 安装成功，锁文件未变。
2. 执行 `yarn test:solana-readonly --list`，应发现本文件列出的 2 项；执行 `yarn test:regression:types`。`--list` 仅发现，不等于执行。需要对指定文件格式检查时用 `yarn exec prettier ...`，根 `yarn prettier` 是范围较广的仓库脚本。
3. 当前入口使用 `channel: "chrome"`，先核实机器已安装 Google Chrome；没有则先协调安装，不自动下载浏览器。2026-10-25 本机 Chrome 已存在，但 Playwright 配套 Chromium 不存在；本轮未启动两者。
4. 核对本地已有 SDK/WASM 产物；需要时执行 `yarn solana:runtime-preflight --local-only`，缺产物先处理构建授权，不自动构建。本机本轮检查 passed，只证明本地产物指纹，不证明页面可用。
5. 取得明确的本地服务及 UI 执行授权后，再启动服务、执行用例，失败先保留报告并区分基础设施问题与业务问题。业务修复仍须核对任务范围。

已获启动与 UI 授权后才执行（两个终端，均在主仓库根目录）：

```sh
yarn exec vite --host 127.0.0.1 --port 3010 --strictPort
```

```sh
yarn test:solana-readonly
```

配置文件为 [playwright-solana-readonly.config.ts](../playwright-solana-readonly.config.ts)，默认 `http://127.0.0.1:3010`。可通过 `REGRESSION_BASE_URL` 显式指定其他 loopback HTTP 根地址；非本地、HTTPS、带路径/查询/片段/凭据的地址拒绝。配置没有 `webServer`，不会自动启动服务、构建或部署；前端仍会使用当前配置访问真实外部读取服务，并非离线测试。

## 开关与状态隔离

当前 [isDevelopment](../src/config/env.ts) 根据 host 和 `production-preview` localStorage 判断，不只是 Vite build mode。现有 regression fixture 默认写入 `production-preview=true`；[AB 加载逻辑](../src/config/ab.ts) 在非 development 环境会清除投放比例为 0 的手动开关，包括当前 `solanaNetwork`。因此直接复用原 fixture 并写 `ab-flags` 会使开启用例失效，不能靠重试解决。

本轮在共用 fixture 增加 worker 选项 `productionPreview`，默认仍为 true；仅新配置显式设为 false，使用本地 development 语义。测试检查实际存储的开关值，错误环境会失败，不静默降级。每个用例使用独立 context，仅首次初始化状态；刷新不重置选中状态。EVM `chainId` 始终为 42161，Solana 使用独立选中状态，不能把 Solana ID 填入 EVM runner。

## 证据与进度

报告位于本机已忽略的 `playwright-report/solana-read-only/`、`test-results/solana-read-only-results.json`，失败产物在 `test-results/solana-read-only/`。这些原始产物不随仓库共享；按需求工作表记录实际运行版本、时间、结果和证据，不把本工具准备状态当作需求通过。

本轮进度：实现完成 → 静态准备通过 → **等待本地服务/UI 执行授权** → 真实验收待执行。完成实际运行后再更新本节及总表，不预填 passed。

已完成的准备验证：新入口发现 2 项；原 EVM regression 入口发现 486 项 / 96 文件，未包含新目录；regression fixture 单元测试 23 passed；根及 regression 类型检查、指定 TypeScript 文件 ESLint/Prettier、6 类非法目标拒绝、本地 SDK/WASM 指纹和文档链接检查通过。仅测试发现未运行任何页面。

完整前端单元测试 299 文件 / 3014 tests passed、1 原有 skipped，退出 0，121.72 秒；日志有已知 happy-dom teardown AbortError。真实 UI 仍未执行。
