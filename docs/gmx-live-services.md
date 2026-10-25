# GMX 当前线上服务地址

核验日期：2026-10-25，北京时间约 23:01～23:04。入口为 https://app.gmx.io/，实际转到 /trade；另访问 /pools、/stats、/referrals（转到 /referrals/traders）、/earn（转到 /earn/discover），并通过线上网络菜单选择 Avalanche 和 MegaETH。使用独立未连接钱包的 Chrome；不读取助记词、不签名或广播，不改线上开关。

本页以浏览器 fetch/XHR、响应状态和当前已发布脚本为证据，不用本地配置推断当前部署。实际请求不等于对应业务验收通过：HTTP 200 未检查 GraphQL errors、数据新鲜度或完整响应契约；未观察到请求不能证明服务不存在。多链请求可来自统计聚合及后台预检，不能一律解释为当前选中的交易链。

GMTrade 的独立服务见[GMTrade 当前线上服务地址](gmtrade-live-services.md)；后续核验顺序见[线上行为与数据核验](agent-acceptance-workflow.md#线上行为与数据核验)。两项目的服务不可混作新 GMX Solana API 的已部署证明。

## 核心业务服务：浏览器已实际请求

下列三条链的市场配置/数值 API、价格 ticker 和 SQD 均观察到 HTTP 200；Avalanche/MegaETH 部分请求在 Stats 聚合页也已出现。

| 网络 | 市场/业务 API | 公开价格 keeper/API | SQD GraphQL |
| --- | --- | --- | --- |
| arbitrum | https://arbitrum.gmxapi.io | https://arbitrum-api.gmxinfra.io | https://gmx.squids.live/gmx-synthetics-arbitrum:prod/api/graphql |
| avalanche | https://avalanche.gmxapi.io | https://avalanche-api.gmxinfra.io | https://gmx.squids.live/gmx-synthetics-avalanche:prod/api/graphql |
| megaeth | https://megaeth.gmxapi.io | https://megaeth-api.gmxinfra.io | https://gmx.squids.live/gmx-synthetics-megaeth:prod/api/graphql |

实际观察的业务 API 路径包括 `/v1/markets/config`、`/v1/markets/values`、`/v2/jit/liquidity_info`；Arbitrum 另有 `/v1/whitelists`、`/v1/incentives/usdg/boost-apr`、`/v1/stats/summary`、`/v1/stats/timeseries`、`/v1/buyback/weekly-stats`，均观察到 HTTP 200。未连接钱包，本轮不能列出用户持仓、订单或交易提交接口的实际调用。

公开价格接口实际包括 `/prices/tickers`、`/prices/24h`、`/prices/candles`、`/ui-flags/v2`、`/incentives`。Arbitrum Pools 另请求 `/markets`、`/apy`、`/performance/annualized`、`/performance/snapshots`。页面自动向 `/report/ui/batch_report` 发送诊断上报，本轮观察到 HTTP 200；未手动调用写接口。

价格 fallback 不是只有静态配置：本轮实际观察以下地址的 `/prices/tickers` 请求均收到 HTTP 200。不能据此确定全部请求的主备选择原因或其他路径都可用。

| 网络 | 实际请求的 fallback 基址 |
| --- | --- |
| Arbitrum | https://arbitrum-api-fallback.gmxinfra.io；https://arbitrum-api-fallback.gmxinfra2.io |
| Avalanche | https://avalanche-api-fallback.gmxinfra.io；https://avalanche-api-fallback.gmxinfra2.io |
| MegaETH | https://megaeth-api-fallback.gmxinfra.io |

这里的 keeper 指浏览器调用的公开价格/API 通道；没有从网络观察确认浏览器直接调用内部 keeper 的 Cloud Run `run.app` 地址，也不能由价格接口可用推断订单 keeper 执行可用。与 GMTrade 的 keeper GraphQL 不是同一个服务。

## Goldsky 与旧版统计：实际请求

当前仍有 SQD 与 Goldsky 并存，不应推断 GMX 已全部切到 SQD。以下是本轮观察到 HTTP 200 的完整 Goldsky 公共子图地址：

- https://api.goldsky.com/api/public/project_cmgptuc4qhclc01rh9s4q554a/subgraphs/synthetics-arbitrum-stats/master-260605170830-1049f5c/gn
- https://api.goldsky.com/api/public/project_cmgptuc4qhclc01rh9s4q554a/subgraphs/synthetics-avalanche-stats/master-260605222642-1049f5c/gn
- https://api.goldsky.com/api/public/project_cmgptuc4qhclc01rh9s4q554a/subgraphs/synthetics-megaeth-stats/master-260120151613-540f334/gn
- https://api.goldsky.com/api/public/project_cmgptuc4qhclc01rh9s4q554a/subgraphs/gmx-arbitrum-stats/synts-stats-230627214534-0265e1f/gn
- https://api.goldsky.com/api/public/project_cmgptuc4qhclc01rh9s4q554a/subgraphs/gmx-avalanche-stats/master-240711235903-da2d1a1/gn

旧版统计还实际使用以下地址，HTTP 200：

- https://gmx-server-mainnet.uw.r.appspot.com/position_stats
- https://gmx-server-mainnet.uw.r.appspot.com/total_volume
- https://gmx-server-mainnet.uw.r.appspot.com/gmx_supply
- https://gmx-avax-server.uc.r.appspot.com/position_stats
- https://gmx-avax-server.uc.r.appspot.com/total_volume

## RPC：浏览器实际使用

| 网络/用途 | 实际观察到的公开 RPC |
| --- | --- |
| Arbitrum | https://arb1.arbitrum.io/rpc；https://arbitrum-one-rpc.publicnode.com/；arbitrum-one.public.blastapi.io |
| Avalanche | https://api.avax.network/ext/bc/C/rpc |
| MegaETH | https://mainnet.megaeth.com/rpc |
| Base（后台块高读取等） | https://mainnet.base.org/；https://base-rpc.publicnode.com/；base.drpc.org |
| BNB（后台块高读取等） | https://bsc-dataseed.bnbchain.org/；https://1rpc.io/bnb；https://bsc-rpc.publicnode.com/；bsc.drpc.org |
| Ethereum（后台块高读取等） | https://ethereum.publicnode.com/；eth.drpc.org；rpc.ankr.com |

这些域名均观察到请求；多数收到 HTTP 200，bsc.drpc.org 的一次窗口收到 429，另一次窗口收到 200。不能把瞬时 429 定性为永久不可用。方法包括 eth_call、eth_chainId、eth_gasPrice、eth_blockNumber 等读取，未观察或主动执行发送交易。本轮未观察到 WebSocket，不证明连接钱包或其他流程不使用 WS。

RPC 提供商路径可能携带凭据，采集时对 Alchemy/Infura/QuickNode/Ankr/dRPC/BlastAPI 等提供商路径统一脱敏，所有 URL 查询参数均移除；文档中的 provider 域名不代表可直接作为完整 RPC URL 使用。

## 其他页面依赖：实际请求

| 用途 | 地址 | 观察 |
| --- | --- | --- |
| Privy 应用配置/认证组件 | https://auth.privy.io | 应用配置与自动 analytics 请求 HTTP 200；未登录 |
| 钱包目录 | https://explorer-api.walletconnect.com/v3/wallets | HTTP 200 |
| 验证码组件 | api.hcaptcha.com、api2.hcaptcha.com、*.w.hcaptcha.com | 自动加载；未人工完成验证码 |
| Lido APR | https://eth-api.lido.fi/v1/protocol/steth/apr/sma | Pools 请求，HTTP 200 |
| Pendle 统计 | https://api-v2.pendle.finance/core/v1/dashboard/positions/database/0xe1f7c5209938780625e354dc546e28397f6ce174 | Stats 请求，HTTP 200 |
| 第三方追踪 | https://secure.adnxs.com/getuidp | 自动请求，HTTP 200 |
| 前端自身配置 | https://app.gmx.io/config.json | HTTP 200 |

## Solana 菜单的实际行为

额外通过线上菜单核对：Avalanche 选中后 `SELECTED_NETWORK=43114`、图标为 Avalanche；MegaETH 为 `4326`、图标为 MegaETH。随后点击 Solana，实际显示 `GMX on Solana` 提示，底层仍为 MegaETH、`SELECTED_SOLANA_NETWORK` 为空；没有点击外部链接或更改 AB flags。说明本次默认未登录环境的 Solana 入口仍是引导提示，不能据此认为 GMX 线上已启用迁移后的 Solana 业务/API。该补充记录见 network-selection.json；不推断其他用户或开关条件下的行为。

## 当前发布脚本与未实测配置

实际 HTML 加载入口 index-D6oqQcS3.js；其动态导入 bootstrap-BQ8F3au6.js。bootstrap 当前地址为 https://app.gmx.io/assets/bootstrap-BQ8F3au6.js，HTTP 200，SHA-256 为 1816cec5179858f85f0d7efbf7a5c1e0e6bd0d958ea0ac800065f5882ab45447。入口脚本本身不包含核心服务 URL，不能只扫描 HTML 的第一份 JS 就判断没有配置。

bootstrap 中包含三条主网的上述 API、SQD、fallback 与 Goldsky 配置；也包含测试环境地址，如 `https://arbitrum-sepolia-test.gmxapi.ai`、`https://arbitrum-test.gmxapi.ai` 和 Fuji/Arbitrum Sepolia 索引。本轮没有访问测试网或验证这些配置，不应把“打包存在”当成默认页面实际使用。完整匹配列表与摘要见本机 bootstrap-script.json。

本机证据位于被 Git 忽略的 `.local/acceptance/solana-browser/gmx-live-20261025/`：network.json、pages-chains-network.json、deployed-scripts.json、bootstrap-script.json 及截图。原始数据只含去 query/提供商路径后的地址、HTTP 状态、操作/方法名和计数，不保存请求正文、响应正文、cookies 或凭据。页面观察不证明完整服务拓扑或后端内部依赖，未连接钱包的观察也不覆盖资金、订单及执行链路。

后续核验先查看目标线上功能实际请求，再检查对应发布脚本；历史仓库配置只作交叉参考。数据契约与业务有效性需独立检查，不以 HTTP 200 或部署状态代替。
