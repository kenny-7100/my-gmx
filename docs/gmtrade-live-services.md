# GMTrade 当前线上服务地址

入口：https://gmtrade.xyz/。核验日期：2026-10-25；以下为当日观察，不是持续可用性承诺。源码快照及其使用边界见[旧 Solana 后端参考说明](gmtrade-web-backend-reference.md)。

确认当前地址时，优先核对目标页面的实际请求与响应，其次参考当前发布脚本；仓库环境文件只证明历史配置，不能直接认定为当前部署。此前将旧配置 `api.gmtrade.xyz` 称为正式后端不准确；用户已纠正，本次访问线上核实。以下属于 GMTrade 旧项目，不是新 GMX api-solana，也不是 A02 的 GMX Arbitrum oracle keeper。

GMX 本身的线上地址与独立核验结果见 [GMX 当前线上服务地址](gmx-live-services.md)，不要混用两项目的 API、keeper 与索引。

本次使用独立、未连接钱包的 Chrome 访问首页、Pools、交易页（`/trade` 转到 `/trade/SOL-USD`）、Stats 和 GT（`/gt` 转到 `/gt/my`），观察时间约为北京时间 2026-10-25 22:55～22:59。首页 Launch App 弹出条款确认，未代用户接受；后续从公开页面链接发现 `/trade` 并直接访问，没有修改存储绕过条件。只记录去掉 query 的地址、HTTP 状态、GraphQL 操作名及 WS 帧计数，不读取助记词或连接钱包。

| 服务 | 当前地址 | 证据与观察结果 |
| --- | --- | --- |
| Web 后端 HTTP | `https://gmtrade-web-backend.gmtrade.xyz` | 用户确认 + 浏览器实际请求；`/v2/cache/daily/feeApy`、`/v2/cache/daily/annPerformance`、`/cache/prices/tickers`、`/v2/cache/prices/candles` 均观察到 HTTP 200 |
| Web 后端 WS | `wss://gmtrade-web-backend.gmtrade.xyz/ws` | 用户确认 + 多页面实际连接并接收帧；一次首页窗口 37 帧，交易页窗口 27 帧 |
| GMTrade keeper GraphQL | `https://keeper-prod-api.gmtrade.xyz/graphql` | 交易页实际 POST `KeeperTokenPrices`，HTTP 200；不证明 keeper 订单执行 |
| SQD Core 服务 | `https://gmx-solana-sqd.squids.live/gmx-solana-base:prod/` | 用户确认服务入口；实际接口见下一行 |
| SQD Core GraphQL | `https://gmx-solana-sqd.squids.live/gmx-solana-base:prod/api/graphql` | 首页/Pools 实际 POST，包含 totalStats、LandingCoreValueApr、PoolsOverviewSquid，HTTP 200 |
| RPC HTTP | `https://rpc-1.gmtrade.xyz/` | 实际 POST HTTP 200；不证明所有 RPC 方法或广播权限 |
| RPC WS | `wss://rpc-1.gmtrade.xyz/` | 交易页观察到连接尝试和发送帧，但观察窗口未收到帧；不能标记 WS 可用性通过 |
| 配置/静态统计 | `https://r2.gmtrade.xyz/common/` | config.json、notices.json、stats-new.json 实际 GET HTTP 200；stats-new.json 在统计页读取 |
| 页面监控 | `https://browser-intake-datadoghq.com/api/v2/rum` | 浏览器自动请求，HTTP 202 |

HTTP 200 仅确认页面请求与 HTTP 响应，本轮未检查 GraphQL errors、完整响应契约、数据新鲜度或业务正确性。后端 WS 接收帧也不证明所有主题数据正确。前端网络观察不能揭示服务端的全部内部依赖。

本轮还读取了当前线上主脚本 `https://gmtrade.xyz/assets/index-CMX6WD7U.js`，HTTP 200，SHA-256 为 `619757c1da64d01eb046131a63bcc2d3c7d8dce8054ba127abb851bdebae1cda`。以下地址在该发布脚本中存在，但本轮没有观察到对应实际请求或成功连接，不能当作服务已验证：

| 服务配置 | 当前线上脚本中的地址 |
| --- | --- |
| Keeper WS | `wss://keeper-prod-api.gmtrade.xyz/graphql-ws` |
| GT SQD | `https://gmsol-sqd-test.squids.live/gmtrade-gt:prod/api/graphql` |
| Treasury SQD | `https://gmx-solana-sqd.squids.live/gmx-solana-base:treasury-prod/api/graphql` |
| 独立价格 K 线 HTTP | `https://price-candle-mainnet.gmtrade.xyz/graphql` |
| 独立价格 K 线 WS | `wss://price-candle-mainnet.gmtrade.xyz/graphql-ws` |
| 事件服务 | `https://events.gmtrade.xyz/api/events` |

已确认旧配置差异：Web 后端不是 `api.gmtrade.xyz`；线上 GT SQD 是 `gmtrade-gt:prod`，不是旧示例的 `@ih5ra3`；线上独立 K 线配置为 `price-candle-mainnet.gmtrade.xyz`，不能沿用旧 `price-candle-78bde714.gmxsolana.io`。本次交易页实际 K 线请求经 Web 后端 `/v2/cache/prices/candles`，不能把独立服务配置说成该页面直接调用。没有从本轮线上证据确认 Marin 是当前页面依赖。

本机原始摘要与截图保存于被 Git 忽略的 `.local/acceptance/solana-browser/gmtrade-live-20261025/`：network.json、app-network.json、other-pages-network.json、trade-stats-network.json、deployed-script.json 和截图，不随仓库共享。不保存完整 RPC 请求、WS 内容或凭据。后续调查应重新观察目标功能的线上请求，再按需要做有限只读接口验证，不把本次窗口当成长期可用性保证。

后续验收按[线上行为与数据核验](agent-acceptance-workflow.md#线上行为与数据核验)选择目标页面和只读数据；这些旧项目服务不能替代新 GMX Solana API 的部署身份或成为迁移目标的长期依赖。
