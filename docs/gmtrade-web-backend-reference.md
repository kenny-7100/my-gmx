# 旧 Solana 后端参考说明

源码快照核验日期：2026-10-24；线上入口核验日期：2026-10-25。位置：`gmtrade-web-backend/`。这是用户提供的旧 Solana Web 后端，可能在后续废弃；与 GMX 的 `gmx-api` 不同。

## 当前线上地址与源码快照的区别

当前 GMTrade 的 Web 后端、keeper、SQD、RPC 和发布脚本配置见[GMTrade 当前线上服务地址](gmtrade-live-services.md)，GMX 见[GMX 当前线上服务地址](gmx-live-services.md)。线上事实以目标页面当前实际请求为准；本页源码快照不能证明线上部署版本、配置或依赖。此前旧配置中的 `api.gmtrade.xyz` 不能用作当前正式后端，详见线上核验记录。

## 来源与完整性

- 从用户提供的 `gmtrade-web-backend.zip` 解压，保留原目录结构和源码内容，没有修改 Rust 代码。
- 压缩包 SHA-256：`f9c78663a113110dbf258f84e6233512e76e37b569ddeb2855c6e40b6fe19bf5`。
- 压缩包包含 77 个条目；解压后逐文件核对内容，原压缩包按用户要求删除。
- 无 `.git`、remote、提交号或发布版本信息，因此作为源码快照收录，不能推断与线上部署相同，也不自动初始化独立 Git 仓库。
- 本次仅静态探索，没有安装依赖、启动服务、运行测试或构建。

## 项目结构与依赖限制

这是 Rust crate，服务层使用 Axum/Tokio。代码中多处注明兼容旧 Go Web 后端的 HTTP/WS 契约，不能因此把本快照识别为 Go 项目。

`Cargo.toml` 继承 workspace 的版本、edition 和大量依赖，但快照没有提供 workspace 根 manifest 或锁文件，并依赖以下未收录的相邻 crate：

- `../gmsol-keeper-client`
- `../gmsol-sqd-client`
- `../gmsol-price-candle-client`

还需要运行时配置与对应上游服务。当前资料不足以独立还原构建或部署环境，不应猜测依赖版本或擅自补造 workspace。需要运行时再向用户获取配套资料。

| 路径 | 查阅目的 |
| --- | --- |
| `src/main.rs`、`src/lib.rs` | CLI、配置加载、状态初始化、后台任务、路由装配 |
| `src/config.rs` | `config.toml` 入口、`GMSOL_WEB_` 环境变量前缀及各数据源、缓存、限制配置 |
| `src/sources/rpc_markets.rs`、`token_map.rs` | 链上市场/GLV 发现、TokenMap、mint 信息、分批账户读取 |
| `src/sources/arbitrum_tickers.rs`、`keeper_price.rs`、`chainlink_*` | 不同价格源、订阅及 K 线来源 |
| `src/refresh.rs`、`src/aggregate/` | 市场快照组装、原始字段提取、SDK 市场估值和按指数代币聚合 |
| `src/aggregate/scale.rs`、`price_source.rs`、`src/tokens.rs` | 价格精度转换、来源选择、代币精度与符号映射 |
| `src/dto.rs`、`src/http/mod.rs` | 原 HTTP 响应类型与路由的准确契约 |
| `src/state.rs`、`src/ws_protocol.rs`、`src/ws/mod.rs` | 内存快照、WebSocket 订阅和推送契约 |
| `src/sources/sqd.rs`、`src/daily_refresh.rs`、`src/redis_store.rs` | 历史、日统计、缓存及持久化行为 |
| `src/health.rs`、`src/metrics/`、`tests/` | 健康度、监控、测试入口；源码内还有单元测试 |

## 观察到的数据流

`src/lib.rs` 创建共享状态并启动市场、价格、K 线和日统计等后台任务。主要读取链路为：

1. Solana RPC 发现市场和 GLV，再分批读取账户及 mint 信息，`getMultipleAccounts` 每批最多 100 个地址。
2. TokenMap 和配置 overlay 形成代币表；价格按代币来源组合 Arbitrum tickers、Chainlink 和 keeper 数据。
3. `refresh::build_snapshot` 将账户和价格交给 `gmsol-sdk` 模型，生成市场估值、指数聚合、ticker 和 swap list，写入共享内存快照。
4. HTTP 和 WebSocket 消费这些快照；SQD、K 线任务和可选 Redis 为历史及日统计提供数据。上传、分享功能另使用 S3 等能力。

已注册的主要 HTTP 路径包括 `/cache/prices/tickers`、`/v2/cache/prices/tickers`、`/v2/cache/prices/indexData`、`/v2/cache/prices/candles`、`/v2/cache/daily/*`、`/v2/cache/store/balances`、`/v2/cache/store/tokenMints`、`/v2/cache/glvs`、`/v2/cache/keeper/metrics`、`/v2/upload` 和 `/api/s`。另有 `/healthz`、`/healthz/active` 及 `/ws`。完整列表以路由源码为准。

WS 主题包括 `indexTokens`、`tickers`、`swapList`、`candles`、`storeBalances`、`tokenMints`、`glvs` 和心跳。当前路由表没有提供按用户读取持仓/订单或发送交易的入口，不能将此快照视为完整的 keeper 或交易后端。

## 与 GMX 集成时的使用边界

本项目只用于理解资源、字段、计算和原前端行为；实现仍须遵守根 `AGENTS.md`、`gmx-prompts` 和当前集成契约。

- 原后端的 DTO、WS 协议、缓存和服务结构不是主项目要直接迁移的目标。所需字段应适配到 GMX 现有模型和数据流。
- `aggregate/scale.rs` 明确区分内部整币价格 `P × 10^20`、最小代币单位价格 `P × 10^(20-decimals)` 和旧 ticker 价格 `P × 10^(30-decimals_gmx)`。这些不是 GMX 共享美元金额 `10^30` 的同一语义，必须逐字段核对单位和转换。
- 该快照调用 Rust SDK 做服务端市场估值；ADR-0015 对目标 gmx-api 的服务端实现另有约定。应核对协议行为，不直接移植服务端 SDK 依赖。
- 多价格源、keeper 回退、统计失败返回旧值或默认值等属于参考项目现有行为，不自动成为新实现要求。主项目不能因此新增对旧后端/keeper 的长期依赖或推测性兜底。
- GLV、GT、分享等源码存在不代表进入首发范围；以用户确认范围及相关 ADR 为准。

尚未确认：源码版本、实际部署配置、未包含的 client 实现，以及与现有参考前端线上版本的对应关系。需要这些信息时先澄清，不能依据本次静态探索声称服务已运行或已完成迁移。
