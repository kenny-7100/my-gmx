# 前端源码离线测试

核验日期：2026-10-27。用于 Agent 对前端局部模块运行已有单元测试：在隔离环境中复用原 Vite 配置和测试初始化，阻止意外联网，记录精确执行范围及结果。只属于个人开发基础，不修改业务源码、原测试、原 Vite 配置或依赖版本。

## 命令与范围

工作目录为主仓库根目录，使用 Node 22 和现有锁定依赖，无需启动服务、浏览器或构建：

```sh
# Three existing date, PWA decision and Solana flag suites
yarn frontend:test-offline
# Repeat --suite to select exact existing source tests
yarn frontend:test-offline --suite src/lib/dates.spec.ts
yarn frontend:test-offline --suite src/lib/dates.spec.ts --suite src/domain/gmsol/fetchSolanaTradingEnabled.spec.ts
```

默认三份测试为 `src/lib/dates.spec.ts`、`src/lib/pwa/appUpdateDecision.spec.ts`、`src/domain/gmsol/fetchSolanaTradingEnabled.spec.ts`，本轮共 17 项。Solana 开关测试沿用原有 mock 数据源，不访问真实 keeper。

支持 `src/` 或 `landing/` 下真实存在的 `.spec` / `.test` 文件（JS/JSX/TS/TSX）。拒绝重复、缺失、glob、绝对路径、目录及越界符号链接；原 Vite exclude 继续有效，被排除或空文件不能通过。只运行明确选定的文件，不递归发现参考仓库。需要真实浏览器、外部服务或业务集成时使用相应验收环境。

## 隔离方式与已确认的启动条件

实现位于 `scripts/frontend-offline-tests.mjs`、`tools/frontend-offline/`，复用既有 Node 网络保护器和 SDK 的 Vitest 结果检查器。

- Vitest 在临时工作目录运行，Vite `envDir` 和缓存也指向该目录；环境仅传必要 PATH、测试标识、工具参数和下述明确配置，不继承调用方的钱包、数据库、`NODE_OPTIONS` 或 `VITE_*` 变量，不加载主仓库 `.env` 文件。
- 复用原 `vite.config.ts` 的别名、插件、happy-dom、`src/lib/polyfills.ts`、`@vitest/web-worker` 和 `vitest.global-setup.js`。后者的 `Asia/Dubai` 测试时区保持原状；不擅自改为 UTC。
- 从隔离 CWD 启动时，除配置中的 root 外，必须显式传 Vitest CLI `--root`，否则现有初始化模块可能解析为无法加载的 `/src/...`。初始化文件转为明确绝对路径；保留原执行内容与顺序，最后安装联网保护。
- 原 PWA 标识会在 CWD 调用 Git，Lingui/Babel 也依赖配置和包定位。入口从当前仓库 HEAD 时间戳计算与原逻辑相同的 PWA generation，显式指向原 `.linguirc`，在临时目录链接已安装的 `node_modules`；不安装依赖、不复制配置、不修改构建流程。临时目录清理只删除链接，不删除真实依赖。
- 网络保护在测试 setup 后阻止常见 Node fetch、HTTP/HTTPS、socket、TLS、HTTP/2、UDP 和 DNS；文件结束时核对尝试次数，即使测试捕获异常也失败。测试可以继续使用原有 mock 数据源，不能为了通过而关闭保护。

该机制用于防止意外读取默认环境和意外外连，不是恶意代码沙箱：可信插件与原配置在 setup 前加载，测试仍能主动读文件、另起进程或改写保护。不得把真实凭据或依赖外部服务的测试放入默认范围。

## 结果、版本与清理

串行执行所选文件、单 worker、无重试；整次限时 180 秒。SIGINT/SIGTERM 及超时清理本次所属进程组，结束后删除临时目录和缓存，保留本次日志。SIGKILL/系统崩溃不保证清理，需核实报告的 processGroup 和资源归属，不接管其他任务。

stdout 输出 JSON，退出 0 要求：正常退出、原生 success、精确的所选结果文件、实际断言全部通过、无 skipped/todo，且运行前后源码摘要一致。零测试、失败或中断均退出 1；前置错误明确失败，不自动构建或启动服务。

每次证据位于忽略的 `.local/acceptance/frontend-offline/run-*/`：`vitest.log`、`vitest-results.json`、`report.json`。报告记录源码 commit/dirty、选择范围、计数、进程组、工具摘要和清理状态。源码指纹覆盖主 `src/`、`landing/`、`sdk/src/` 中 TS/TSX/JS/JSX/JSON，及 package、锁文件、Vite/TS/Lingui 和测试 global setup 配置；不读取 `.env`，不覆盖所有静态资源、安装包内容或部署身份。

根 `yarn test:ci` 保持原状，仍是完整前端回归入口。本入口通过只代表所选离线范围，不代表 Chrome、真实 keeper/RPC/API 或整项业务需求通过。测试导入依赖 SDK 构建声明时，仍按[环境执行顺序](coding-and-self-review.md#执行前的环境检查与顺序)核对产物，不自动构建。

## 实际验收

2026-10-27：原有三文件 17 项通过，无跳过，源码摘要未变；隔离探针确认调用方普通和 Vite 哨兵未进入测试、钱包配置键未继承，原 `Asia/Dubai`、polyfill 与 Worker 初始化保留。实际捕获联网异常后仍失败；断言失败、skip、零测试以及 SIGTERM 中断全部正确失败并清理临时目录，探针随后删除。

工具选择器回归已纳入 `yarn test:agent-tools`，88 项通过；与既有精确结果和网络保护回归一起验证。负面场景结束后另用进程表核实所属进程组消失，并检查临时目录实际不存在。根类型检查、ESLint、Prettier、111 个文档本地目标和差异检查通过；完整前端单元测试 3,014 项通过、1 项既有跳过。原始结果为本机 `.local/acceptance/frontend-offline/default-acceptance.json`，负面路径为 `negative-acceptance.json`，不随 Git 共享。
