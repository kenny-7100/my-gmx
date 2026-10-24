# keeper 只读预检（A02）

更新日期：2026-10-24。用于本地 Agent 在价格展示、价格计算或交易验收前确认 GMX Arbitrum keeper 的访问与数据条件。A02 访问与诊断工具已完成验收；真实价格和图表检查通过，`solanaTrading` 在三个现有端点均缺失，真实交易前置未就绪。用户已批准本地开发显式覆盖该开关，缺失不再阻挡该范围内的开发验收。

## 入口与执行顺序

依赖仓库现有 Node 22、Yarn 和已安装的 `tsx`，无需新依赖或服务器。工作目录为主仓库根目录：

```sh
yarn keeper:preflight
```

默认检查主端点。仅发出六个 GET 请求，不提交报告到外部服务、不发送交易、不修改 flags、不启动浏览器。每个请求（含正文读取）超时为 10 秒，无自动重试、自动换端点或数据替代。

开展已授权的 keeper 相关验收时，先执行本工具，查看逐项结果，再进入依赖价格或交易开关的业务检查。失败先按错误码处理；`blocked` 不可作为交易前置通过。独立于受阻资源的工作可继续，涉及缺失数据、权限或开关的工作等待资源所有者确认。

## 本地 Solana 交易开关覆盖

用户已明确批准在本地开发中模拟 `solanaTrading`，避免真实开关尚未发布阻挡 Solana 功能开发。统一读取入口 `src/domain/gmsol/fetchSolanaTradingEnabled.ts` 支持以下配置，供 Hook 与后续发送前检查共同使用。

在主仓库根目录 `.env.development.local` 中设置：

```dotenv
VITE_APP_SOLANA_TRADING_OVERRIDE=true
```

| 运行环境与配置 | 行为 |
| --- | --- |
| Vite 本地开发，值为 `true` | 返回 `true`，不请求真实 keeper |
| Vite 本地开发，值为 `false` | 返回 `false`，不请求真实 keeper，供关闭路径验收 |
| Vite 本地开发，未设置或为空 | 每次读取真实 keeper，不缓存上次许可 |
| Vite 本地开发，其他值 | 抛出配置错误，不静默退回真实开关 |
| 构建后的预览或生产环境 | 忽略覆盖配置，读取真实 keeper |

生效条件使用 `import.meta.env.DEV`，与本地 RPC 入口一致，不使用也会匹配远程预览的 `isDevelopment()`。环境变量修改后需重启前端；按根 `AGENTS.md` 的服务启动授权执行，不由配置步骤自动启动。当前机器已在忽略提交的 `.env.development.local` 配置为 `true`；后续机器需自行按上述步骤配置，不能假定该文件随分支共享。

该覆盖不绕过 `solanaNetwork` AB flag 和 Hook 的网络/消费者启用条件，也不授予签名、真实交易发送权限。本地 RPC 代理仍禁止交易广播。报告必须注明使用本地模拟开关，不能据此宣称真实 keeper 配置或运行时停止交易能力已验收。

`yarn keeper:preflight` 始终检查真实接口，不读取此覆盖；真实字段缺失仍返回 `blocked` / 退出 2。这个结果不阻止使用已授权 mock 进行本地功能验收，但真实开关联调及真实交易验收仍需资源所有者准备对应环境。

针对性验证覆盖开发/非开发环境、开启/关闭/未设置/非法值与远端开启/关闭的组合，并保留真实接口失败传播和 Hook fail-closed 验证：

```sh
yarn test:ci src/domain/gmsol/fetchSolanaTradingEnabled.spec.ts src/domain/gmsol/useSolanaTradingEnabled.spec.ts
```

2026-10-24：上述 2 个文件、10 项测试通过；完整前端回归 299 个文件通过、1 个原有跳过，3014 项测试通过、1 项原有跳过；类型检查及本次前端改动的 ESLint 通过。非开发环境忽略覆盖通过单元验证，未运行构建、预览部署或浏览器验收。

工具通过 SDK 源码中的 `getOracleKeeperUrl(ARBITRUM)`、`getOracleKeeperFallbackUrls(ARBITRUM)` 获取地址。使用 `getTokenBySymbol` 获取五种基础资产的 Arbitrum 价格地址与精度，原生 ETH 对应 WETH 的 ticker；不按 Solana mint 精度解析价格，也不新增完整 mint 映射。入口：[脚本](../scripts/keeper-preflight.ts)。

需要诊断特定备用端点时显式选择，每次仍独立报告其结果：

```sh
yarn keeper:preflight --endpoint fallback-1
yarn keeper:preflight --endpoint fallback-2
```

默认明确设置已验证可访问的 `User-Agent: Mozilla/5.0`。Python 默认 User-Agent 在本次真实对照中触发 Cloudflare 1010 / HTTP 403；不能据此断言服务整体不可用，也不能把更换请求头当作解决所有 403 的办法。仅复现诊断时使用：

```sh
yarn keeper:preflight --user-agent Python-urllib/3.9
```

此入口只为验收命令设置请求头，不修改前端请求。浏览器 CORS 和 CI 运行环境未在本项重新验收，CLI 成功不能替代这些环境的验证。`solanaNetwork` 是前端 AB flag，不是要求 keeper 提供的 UI flag；本工具只检查 keeper 的 `solanaTrading`。

## 明确验收口径

用户于 2026-10-24 确认 SOL、BTC、ETH、USDC、USDT 五种基础资产，ticker 最大年龄为 30 秒。此口径仅用于验收，不改变前端轮询、缓存、交易参数或产品取价行为。

| 检查 | 通过条件 | 范围限制 |
| --- | --- | --- |
| `/prices/tickers` | 五种配置地址各有唯一 ticker；价格为整数字符串，使用 BigInt 判断 `0 < minPrice <= maxPrice`；`updatedAt` 为毫秒时间戳，年龄在 0～30000 ms 内 | 使用检查机时钟；未来时间单独报错。只验证五种基础资产，不代表完整 Solana 市场覆盖或价格换算已验收 |
| `/prices/24h` | SOL、BTC、ETH 各有唯一条目；OHLC 为有限正数，上下界包含开盘与收盘价 | 接口无时间戳，不能据此证明 24h 数据新鲜度 |
| `/prices/candles` | SOL、BTC、ETH 分别请求 `period=1m&limit=3`，返回非空 1m 数据；时间戳为秒、递减且不在未来；OHLC 合法 | 报告实际最新时间与年龄；未约定 K 线陈旧阈值，不声称已验证其新鲜度；不验证稳定币图表 |
| `/ui-flags/v2` | 返回合法 flags 对象；`solanaTrading.enabled` 仅布尔值 `true` 为交易前置就绪 | 缺失与 `false` 为不同的受阻原因；字符串 `"true"` 等非法值为失败。开关就绪也不代表钱包、资金、API 或交易全链路就绪 |

## 报告与退出码

标准输出为 JSON，包含检查时间、所选端点、host、User-Agent、验收阈值、逐项状态和整体状态。可重定向保存到忽略的本地目录；工具本身不写文件：

```sh
mkdir -p .local/acceptance/keeper
yarn keeper:preflight > .local/acceptance/keeper/primary.json
```

| 退出码 | 含义 | 处理方式 |
| --- | --- | --- |
| 0 | 全部检查通过，包括显式开启的交易开关 | 继续当前任务已授权的业务验收 |
| 1 | 网络、HTTP、正文或数据检查失败 | 查看逐项 `code`；即使同时有 `blocked` 也优先退出 1 |
| 2 | 读取与数据检查通过，但开关缺失或关闭 | 协调资源所有者确认目标环境与预期状态，不自行开启 |
| 3 | 参数、配置或未预期的内部错误 | 查看 `--help`、本地配置和脚本，不作为远端依赖故障 |

逐项状态包括 `passed`、`failed`、`blocked`、`not-run`。flags 无法读取时交易开关记为 `not-run`，不能报告为已关闭。常见错误码包括 `timeout`、`network-error`、`cloudflare-denied`、`access-denied`、`rate-limited`、`http-error`、`invalid-json`、`business-error`、`invalid-response`、`missing-price`、`invalid-price`、`stale-price`、`future-price`、`flag-missing`、`flag-disabled`、`invalid-flag`。失败不输出上游原始正文。

## 实施进度与验收证据

| 阶段 | 状态 | 证据 / 下一步 |
| --- | --- | --- |
| 契约与阈值确认 | 已完成 | 复用主前端 `OracleKeeperFetcher` 的 ticker、24h、1m candles 接口及 `fetchSolanaTradingEnabled` 的 flags 路径；用户确认基础资产与 30 秒口径 |
| 工具实现 | 已完成 | `yarn keeper:preflight`；主端点和两个备用端点显式可选，无自动回退 |
| 失败路径验证 | 已通过 | `yarn test:keeper-preflight`：三组表驱动测试，复用 SDK 真实 ticker 样例，仅替换网络数据源；覆盖价格、图表、flags、超时和 HTTP/正文错误 |
| 真实依赖检查 | 价格与读取通过 / 真实交易前置未就绪 | 见下表；交易开关如实报告为 `blocked`，不影响 A02 工具完成判定 |
| 工程检查 | 已通过 | `yarn tscheck`、两份脚本的 ESLint（零警告）、`git diff --check`、文档路径检查通过；`yarn test:ci`：299 个文件通过 / 1 个原有跳过，3013 项通过 / 1 项原有跳过。纯 CLI 工具未运行前端构建、浏览器或 UI 验收 |
| 交易前置就绪 | 需用户协调 | keeper 资源所有者需确认目标验收环境中 `solanaTrading` 的发布与预期状态；仅在获准验收交易的环境显式开启后，才能判定该前置通过 |
| 本地开发开关覆盖 | 已实施并通过针对性测试 | 用户批准显式开发覆盖；本机配置为 `true`，非开发环境忽略覆盖，预检仍检查真实接口 |

2026-10-24 真实请求结果（UTC，机器实际读取时间；未发送交易）：

| 端点 | 报告时间 | 五种 ticker 年龄 | 价格 / 24h / K 线 / flags 读取 | `solanaTrading` | 整体结果 |
| --- | --- | --- | --- | --- | --- |
| primary | 14:10:04 | 885 ms | 全部通过 | 缺失 | `blocked`，退出 2 |
| fallback-1 | 14:10:09 | 275 ms | 全部通过 | 缺失 | `blocked`，退出 2 |
| fallback-2 | 14:10:19 | 481 ms | 全部通过 | 缺失 | `blocked`，退出 2 |

同轮 primary 使用 `Python-urllib/3.9` 时六个路径全部被 Cloudflare 403 拒绝，工具正确输出 `cloudflare-denied`、交易开关 `not-run`，整体退出 1。非法端点参数退出 3，`--help` 退出 0。原始报告保存在本机 `.local/acceptance/keeper/`，目录被忽略、不随仓库共享；其他机器按上述命令重新核验，本文表格保留可共享结果。

真实依赖缺失不能通过修改阈值、伪造真实接口结果或用样例模式抹去。A02 访问与诊断工具已完成，真实交易前置单独跟踪；资源就绪后重新运行预检并更新真实环境就绪状态。本地开发覆盖只用于上述已授权范围。其余基础设施状态见[实施清单](agent-acceptance-infrastructure.md)。
