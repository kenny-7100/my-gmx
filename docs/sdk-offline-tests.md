# SDK 源码离线回归

更新日期：2026-10-26。个人开发基础设施；运行主项目 `sdk/` 中已有测试，不修改 SDK 业务代码、原 Vitest 配置、测试或依赖版本。根目录 `yarn test:ci` 不覆盖 SDK，本入口补充明确范围的源码回归，不代替 SDK 全量测试。

## 使用方式

工作目录为主仓库根目录，使用 Node 22 和现有锁定依赖，不需要 SDK 构建、API、数据库、RPC、钱包或浏览器：

```bash
# Existing BigInt, numbers and fee suites
yarn sdk:test-offline
# Select exact SDK-relative test files; repeat --suite to combine
yarn sdk:test-offline --suite src/utils/__tests__/bigmath.spec.ts
yarn sdk:test-offline --suite src/utils/__tests__/bigmath.spec.ts --suite src/utils/__tests__/fees.spec.ts
# Another existing SDK checkout
yarn sdk:test-offline --sdk-dir PATH --suite src/utils/__tests__/bigmath.spec.ts
# Tool regressions, including the shared network guard
yarn test:sdk-offline
```

默认三份原有测试是 `bigmath.spec.ts`、`numbers.spec.ts`、`fees.spec.ts`，位于 `sdk/src/utils/__tests__/`。本轮实际执行共 153 项；单选 BigInt 为 6 项。选择器要求真实存在、位于所选 SDK `src/` 内的 `.spec.ts` / `.test.ts`（含 tsx）文件，拒绝重复、越界、逃逸符号链接及 glob。原配置的 exclude 继续生效；被排除的文件、空文件或零测试不能通过。

## 隔离与结果

- [工具配置](../tools/sdk-offline/vitest.config.mjs) 加载原 `sdk/vitest.config.ts`，保留原源码别名和排除规则，精确限制 include 为所选文件；无需 `sdk/build`。不改生产 SDK 配置，不执行构建、安装或 Git 写操作。
- 测试在独立临时工作目录中运行，Vite envDir 与缓存也指向该目录；只传 PATH、NODE_ENV=test、TZ=UTC、CI 和本轮参数文件路径，不继承钱包、数据库等调用方配置，不加载项目 `.env`。原 Vitest 配置及测试仍是可执行代码，本工具不承诺阻止它们主动读取任意文件。
- 复用 [API 离线网络保护器](../tools/gmx-api-offline/network-guard.cjs)，在测试 setup 阶段阻止 Node fetch、HTTP/HTTPS、socket、TLS、HTTP/2、UDP 和 DNS；同步 builtin ESM 导出。文件结束时检查尝试次数，即使测试捕获了网络异常也失败。保护器不替换业务数据，不提供 RPC/服务兜底。
- 网络保护作用于所选 Node 测试进程，不是操作系统沙箱；不防御恶意测试主动撤销保护或另起子进程。原 Vitest 配置加载发生在测试 setup 之前，只使用可信 checkout；需要真实服务的测试应使用对应环境，不能通过关闭保护器获得本离线入口的 passed。
- 文件串行执行、无重试；整次 Vitest 限时 180 秒，超时终止所属进程组。SIGINT/SIGTERM 转发到所属测试进程组，正常退出或失败均清理临时目录及遗留子进程；SIGKILL/系统崩溃不保证清理。
- 退出 0 要求进程正常退出、JSON success、实际执行测试全部通过、每个所选文件都有通过断言且无 skipped/todo、结果文件范围精确一致、SDK 源码摘要未变化。其他情况退出 1。路径等前置错误输出 stderr，不进入测试。

日志和报告在忽略目录 `.local/acceptance/sdk-offline/run-*/`：`vitest.log`、原生 `vitest-results.json`、汇总 `report.json`。记录选定文件、时间、进程退出、测试数、SDK Git commit/dirty、源码文件数和聚合 SHA-256，以及工具和根锁文件摘要。源码摘要覆盖 SDK `src/` 中的 TS/TSX/JS/JSON、SDK package/tsconfig/Vitest 配置；不读取 `.env`，不代表整个依赖树、构建产物或部署身份。dirty 是所处 Git 仓库状态，不能仅凭 commit 复原工作树。

默认测试沿用现有 EVM/共享计算输入，不能据此声明 Solana 数学、链上兼容、SDK 发布包或真实 API 已验收。工具不修改任何业务预期，失败先查看本轮日志和结果。

## 本轮验收

2026-10-26 实际执行：

| 条件 | 结果 |
| --- | --- |
| 原有 SDK 三文件默认范围 | 153 项通过，无跳过，无 SDK 构建 |
| 显式单文件 | BigInt 6 项通过，报告只包含所选文件 |
| 环境隔离 | 临时项目 `.env` / `.env.test` 及调用方哨兵变量未进入测试 |
| 捕获联网异常后继续执行 | fetch / HTTP builtin ESM / DNS / socket 四次尝试被阻止；测试断言虽通过，afterAll 仍使整次失败 |
| 断言失败与零测试 | 均退出失败，保留原生结果及日志 |
| 中断与资源清理 | 实际发送 SIGTERM，工具退出失败，Vitest worker 随所属进程组停止，临时目录清理通过 |
| 路径与结果判定 | 工具回归覆盖缺失、重复、越界、符号链接、glob，以及范围不符、空断言、skipped/todo、失败与信号退出 |
| 共享保护器兼容 | 原 gmx-api 离线测试复验通过，保持原默认行为 |

临时测试样例只写入忽略目录，验收后删除；原 SDK 源码和测试未改动。失败场景记录在本机 `.local/acceptance/sdk-offline/fixture-acceptance.json`，中断记录为同目录 `interrupt-acceptance.json`；其他实际执行结果随对应 run 保存，不随 Git 共享。

工程检查通过：3 组工具回归、脚本语法、ESLint、Prettier、文档链接和 `git diff --check`；`yarn tscheck` 退出 0；根前端回归 299 个文件通过 / 1 个原有跳过，3014 项通过 / 1 项原有跳过，退出 0。仍有既有 Browserslist 过期提示及 happy-dom teardown AbortError 输出，本轮不修改这些无关内容。汇总为本机 `.local/acceptance/sdk-offline/acceptance.json`。

实现入口：[sdk-offline-tests.mjs](../scripts/sdk-offline-tests.mjs)。本基础设施属于 `solana-integration` 个人开发基础，不携带到基于 `origin/release` 的业务 PR。
