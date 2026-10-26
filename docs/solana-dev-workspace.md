# Agent Solana 本地全栈联调工具

更新日期：2026-10-26。本文只建设个人开发配置、工具及测试辅助，不实现迁移业务。现有 API 持续服务见 [Solana API 说明](solana-api-local.md)。

## 已完成的范围与当前边界

| 项目 | 本轮交付 | 保留的业务缺口 |
| --- | --- | --- |
| 本地 API 入口 | 独立 Vite 开发配置，固定 `/__agent/solana-api` 转发到所选本地 API | 当前分支没有 Solana API client/parser/状态接入；入口可访问不等于 GMX 页面已消费数据 |
| 工作区管理 | 所选 API/Vite/RPC 的 up/status/logs/stop、归属判断、失败清理与报告 | 不启用数据库、EVM master 或新增业务后台任务；RPC 本地健康不证明上游可用 |
| 请求诊断 | 代理请求日志、浏览器采集 helper、trace 查询及已有后端日志行号 | 不修改 API 日志中间件；当前正常和多数 4xx 请求不产生逐条后端日志，允许没有匹配行 |
| 接口回归 | 固定来源的样例形状基线、离线与 HTTP 检查、变化失败报告 | 无前端 Solana parser 可执行；字段语义、精度、空状态和契约评审未完成，结构通过仍是 partial |

本轮没有修改 `src/`、`sdk/`、`gmx-api/` 或原有 `vite.config.ts`。所有新行为仅通过显式工具命令启用，常规 Vite/构建不加载这套配置；不存在 URL 替换 EVM host、响应替代或新建平行业务数据流。

## 使用顺序

工作目录为主仓库根目录。依赖 Node 22、已有锁定依赖、API checkout、POSIX 本地进程与 Unix socket；本机 macOS 已验证。Chrome 探测沿用已安装且锁定的 Playwright/Chrome，先按[环境顺序](coding-and-self-review.md#执行前的环境检查与顺序)处理已知前置条件。

```bash
# Start API and Vite (defaults: API 3004, Vite 3010)
yarn solana:dev up
# Include the existing read-only Mainnet RPC proxy explicitly
yarn solana:dev up --services api,vite,rpc
# Inspect current health / log paths / stop owned services
yarn solana:dev status
yarn solana:dev logs
yarn solana:dev stop
```

第二条是另一种启动方式，不要在工作区已运行时重复 up。重复工作区、未知端口占用明确失败，不自动接管。可在 up 时指定 `--web-port 3012 --api-port 3014 --rpc-port 3034`，或仅选 `--services api` / `vite` / `rpc`。控制命令始终定位本工作区唯一管理实例，不需要重复端口参数。

- API：优先借用已有 `solana:api-dev` 管理的健康服务，核对实际 apiDir；找不到才调用原有 up。stop 保留 borrowed 服务，仅关闭本工作区 owned 的 API；停止前再次核对 supervisor PID。
- Vite：工作区自己启动，绑定 `127.0.0.1`、strictPort；未知已有 Vite 不借用。原 API 自身的监听范围沿用[已记录的 OS 默认行为](solana-api-local.md#持续运行的-solana-联调环境)。
- RPC：只启动已有代理，绑定 loopback；不借用未知代理、不读取钱包助记词。选中 RPC 时，仅在本次 Vite 配置中将既有 `VITE_APP_SOLANA_RPC_URL` 指向所选端口，不修改配置源码或 `.env.local`。healthz 仅代表本地代理存活，报告 `upstream: unchecked`。
- 服务异常：status 实时检查所选服务。RPC 子进程意外退出会使工作区失败并清理所属资源；API 已有自己的 watcher 管理，故障由 status 暴露，不擅自重启借用服务。

控制 socket 位于 `/tmp/gmx-solana-stack-<uid>-<workspace-hash>.sock`，权限 0600。SIGTERM 正常清理；SIGKILL/系统崩溃不保证清理，须先核对资源归属后处理残留，不盲目 kill 或接管。服务生命周期快照不代表当前健康，必须运行 status。

## 1. 本地 API 路径

独立配置为 `tools/solana-dev/vite.mjs`，通过 Vite Node API 复用原配置并添加开发代理。例如：

```bash
curl http://127.0.0.1:3010/__agent/solana-api/ping
curl http://127.0.0.1:3010/__agent/solana-api/v1/markets/config
```

前缀被去掉后转发给本地 API。仅允许 GET/OPTIONS；其他方法返回 405。上游不可用返回 502，并保留可追踪 ID，不切换生产 host。HTTP 状态及 body 来自原 API；代理仅补充诊断 header，不注入样例或更改响应字段。

`/__agent/probe` 是仅供工具使用的空白页面，用于从 Vite origin 发起真实请求，不是 GMX 页面或业务 UI。API 自带 CSP/sandbox，因此直接打开 API 的 pong 页面无法作为浏览器 fetch 探测页面；不为此移除 API 安全响应头。

未来业务分支实现正式 API client 和配置时，可显式使用此本地路径进行联调；必须沿用已有统一数据流，不能把本工具当成业务消费已实现的证据。

## 2. 日志、身份和失败定位

每次工作区报告位于 `.local/acceptance/solana-dev/run-*/report.json`，提供所选服务、归属、URL、sample 模式、API 启动源码证据及日志位置。管理进程/Vite 日志为 `launcher-*/workspace.log`，RPC 日志为该 run 下的 `rpc.log`；借用 API 的日志保留在原服务目录。

`frontendSourceAtStart` 记录前端 HEAD/dirty 与原 Vite、前端/SDK API 配置及工具配置摘要；它是启动配置证据，不是整个 dirty 工作树或热更新后模块身份的完整摘要。浏览器探测另记录执行时的前端/API commit 和相关文件摘要。

所有工具报告和日志都在忽略目录，不随 Git 交付。磁盘日志不自动轮转；长期开发按需停服后整理。失败先查看对应 report、workspaceLog、API log，不通过改业务或放宽断言使环境变绿。

## 3. 浏览器与请求关联

```bash
# Real Chrome requests through the selected Vite origin
yarn solana:dev:browser
# Custom Vite port
yarn solana:dev:browser --web-port 3012
# Use the failureTraceId printed by the browser report
yarn solana:dev trace --id TRACE_ID
```

探测读取市场、持仓并发起一项预期 400 请求，验证原 API 的真实响应。报告明确 `requestSource: explicit-tool-probe`、`businessPageAcceptance: not-run`；它不验证 GMX 页面展示。失败保留阶段及已采集记录。

代理生成/校验 `X-Trace-Id` 并转发；`requests.jsonl` 记录方法、已知路由、状态、响应头耗时或传输失败耗时、trace ID。query、body、鉴权 header 不写入请求报告；未知路径统一为 `<unmatched>`，避免记录路径中的账户或任意输入。后端自己的原始日志仍遵循原有日志行为。

`trace` 输出对应代理记录和已有 API 日志的匹配行号，不复制原始日志内容；无匹配行如实返回空数组，不能推断请求未处理。502 也有 trace ID，可关联代理传输失败；如果工作区未选择 API，则没有对应后端日志资源。

可复用浏览器 helper 为 `scripts/lib/agent-browser-diagnostics.mjs`：

```js
import { attachApiDiagnostics } from "./scripts/lib/agent-browser-diagnostics.mjs";

const capture = attachApiDiagnostics(page, "http://127.0.0.1:3010/__agent/solana-api");
// Run the authorized scenario using the existing page and request flow.
await capture.save(".local/acceptance/requests.json", { requestSource: "business-scenario" });
capture.detach();
```

helper 仅采集指定 origin/前缀，不拦截、替代或修改请求；保存时等待异步响应元数据，采集失败明确报告，不静默当作无错误。后续页面真实接入本地 API 后，测试辅助代码可直接复用。

## 4. 样例结构回归与契约缺口

```bash
# Uses the running workspace API, through Vite when selected
yarn solana:dev contracts
# No service needed
yarn solana:dev contracts --offline
# Repeatable tool regressions
yarn test:solana-dev
```

固定基线为 `tools/solana-dev/sample-shapes.json`，记录原 API commit、五份样例原始摘要及字段形状。检查新增/缺失字段、字段类型、整数字符串的词法类型、数组元素结构；HTTP 模式同时检查真实响应状态及结构。源码样例摘要变化也失败，不能把自动重新生成基线作为修复步骤。

这不是评审后的业务 schema：不验证金额实际单位、符号语义、枚举取值或字段之间的关系，不根据当前非空样例规定空状态是否合法。现有样例中的占位地址和拼写也不擅自修改。基线变化须先说明来源及变化原因，业务契约待确认时保留缺口，不改 API/parser 来凑齐预期。

退出码：0 为一般工具操作成功；contracts 的结构检查通过仍返回 **2 / partial**，列出未有 Solana 前端 parser、语义/精度/空状态契约未评审；结构或 HTTP 检查失败返回 **1 / failed**。不将本项 partial 汇总为完整契约验收 passed，也不将其当作环境启动失败。

## 验收与交付隔离

2026-10-26 本机完成 12 项集成演练：借用 API 保留、三服务启动与归属、代理只读/trace/脱敏、真实 Chrome 关联、HTTP/离线 partial、真实 Mainnet genesis 读取、重复工作区拒绝、所属 Vite/RPC 停服、未知端口保护、新建 API 停服、RPC 异常退出、无 API 时可追踪 502。报告为 `.local/acceptance/solana-dev/acceptance.json`；浏览器、trace、contract 报告位于同目录对应 run 下。本机证据只描述执行时观察，不代表未来运行或线上部署状态。

工程检查通过：4 组工具回归（路径脱敏、形状变化、基线/缺口和异步浏览器采集失败）、脚本语法、ESLint、代码格式、`yarn tscheck`、`yarn test:ci`（3014 项通过、1 项原有跳过）、本地文档链接及 `git diff --check`。API checkout 保持无跟踪改动。

这些文件属于 `solana-integration` 的个人开发基础：`scripts/solana-dev*`、本主题的 `scripts/lib/` 辅助、`tools/solana-dev/`、package 工具命令和相关 docs。后续功能分支可在此环境开发，但交付上游必须按[分支隔离流程](linear-development-workflow.md#分支基础与隔离)从最新 origin/release 整理，只转入当前业务需求的必要改动；不得携带个人工具、测试基线或本地配置。若业务本身需要正式 host/client/契约改动，应在对应需求中独立审查和验收，不从本工具隐式获得。
