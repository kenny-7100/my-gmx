# FESOL-15 实施与验收记录

核验日期：2026-11-04。共享市场选择器与 Header 的本地实现、单元测试及真实数据页面核验已完成；不代表正式契约评审通过或已具备独立 release 交付基础。

## 结论与开发基础

当前 `solana-market-selector-header-fesol-15` 已合入 FESOL-52（`4a08ea8ea9`）及 FESOL-50（`7eaf8c23dd`），合并后 HEAD 为 `3b68089314`。用户已授权本轮 SDK 构建；1,102 个产物重建及 verify 通过，根 `yarn tscheck` 通过。当前改动尚未提交、推送或创建 PR。

已有代码与实际接口足以明确核心字段的技术适配方式；上市日期缺失也有需求明确规定的处理方式，不应要求用户自行猜测字段或提供日期才能开始所有前端工作。正式市场契约评审仍未查到完成证据，不能将下表的代码核验写成产品/后端已确认；涉及尚未明确的语义时暂停对应部分，不推测实现。

## 字段来源与消费方式

| 字段 | 已核验的实现 | 实施约束 |
| --- | --- | --- |
| 名称、mint、池构成 | API config 与前端静态白名单；token lookup 保留 base58 大小写 | 复用现有 selector/header；不注册为 Arbitrum token |
| 当前价格 | FESOL-50 按 mint 映射 Arbitrum keeper ticker，以 Arbitrum token 精度解析 | k 系列仅在展示层应用 `visualMultiplier` / `visualPrefix`，不改 oracle 数据 |
| 24h 涨跌及高低价 | FESOL-50 使用对应 Arbitrum 标的的 keeper 数据 | 表达共享标的价格变化，不声称是 Solana 成交价统计 |
| 24h 成交量 | Solana `/v1/pairs` 的 `target_volume` 为 USD，`pool_id` 匹配 GM mint；前端转为 USD ×10^30 | 使用 Solana 数据，不取 Arbitrum 成交量；接口失败不伪造零值 |
| 多空 OI | API `longInterestUsd` / `shortInterestUsd`；后端从 gmsol 20 位转换至 GMX 30 位 | API 设置 `useOpenInterestInTokensForBalance: false`，共享 helper 直接取 USD OI |
| funding / borrowing / 1h net rate | 后端输出下一 funding factor、支付方向及各侧 borrowing factor，均转换为 30 位 | 复用共享 helper：每秒乘 3600；funding 支付侧为负、接收侧按 OI 比例分配，borrowing 扣除 |
| 可用流动性 | config/values/价格组合成共享 `MarketInfo`，现有 `getAvailableUsdLiquidityForPosition` 消费 | 按需求用共享 EVM 展示转换核对，不另搬旧前端计算；本轮已核对真实页面共享 selector 与 API OI、funding、borrowing 及 net rate；流动性复用现有 helper，未重新执行链上程序 parity |

API 实际实现见 [marketRecords.ts](https://github.com/gmx-io/gmx-api/blob/main/src/domain/solana/marketRecords.ts)，由已合并的 [API PR #295](https://github.com/gmx-io/gmx-api/pull/295) 引入，后续实现仍以最新主分支为准。审查讨论解释了 gmsol 的 20 位计算、溢出/舍入约束及后端 Reader 角色；不代表 FESOL-61 整体验收已完成。

本轮线上读取：config 67 条、values 67 条、pairs 95 条。前端静态白名单的全部 63 个 GM mint 都在三个响应中；config 中另 4 个没有 pairs 的市场均为 disabled。覆盖检查只证明这次请求的记录与地址关联，不证明每个金额正确、长期可用或部署与某个 Git SHA 完全一致。

## 上市日期

- [FESOL-15](https://linear.app/gmx-io/issue/FESOL-15) 明确规定：缺日期不标 New，没有符合条件的市场时隐藏 Recently Listed 筛选，迁移不能重置上市日期。
- 当前 config/values 响应未发现上市日期字段。
- 旧前端 [markets.ts](../gmx-solana-interface/app/src/config/markets.ts) 标注 mocked data，仅有 EVM 示例地址及 `01 Jan 1970` 默认日期；[getMarketListingDate.ts](../gmx-solana-interface/app/src/utils/market/getMarketListingDate.ts) 对未知市场同样返回默认值。不能将其当作真实 Solana 上市日期。
- [useMarketsListingDates.ts](../src/domain/synthetics/markets/useMarketsListingDates.ts) 现已在 Solana 下停用 EVM 日期请求并返回未知日期；新增 EVM → Solana → EVM 的真实 SWR 缓存切换回归测试。
- 因此当前 Solana 日期应保持未知，按上述明确需求处理。未来只有取得可信 Solana 日期来源后才填入；不得用部署日、迁移日、API `updatedAt`、首根 K 线或账户创建时间猜测上市日。

## 评审与验收边界

浏览器核验 FESOL-61 页面与实时只读查询一致：状态 Review，无评论、附件或关联规范文档。当前 fixture 自身也注明不是 reviewed contract。未发现其正式评审完成的证据，不能由 Agent 自行标为通过。

FESOL-64 已 Done，线上 config/values 已可读取。本轮完成样例及真实页面核验，具体范围见下表；没有重跑链上程序 parity。浏览器能够读取真实 keeper，但较早的 CLI keeper 预检曾出现 tickers/24h 超时，两者应分别保留，不能将预检改为通过。真实页面存在既有 `Page outdated. Refresh` 提示，本轮没有绕过 freshness 或交易开关，也没有签名或广播交易。

最终独立交付仍需按[交付流程](linear-development-workflow.md)等待依赖进入 release 或重新整理，只交付 FESOL-15 自身改动。调查未修改 Linear、发送评论或变更外部系统。


## 本轮实现与验证

- 复用现有 `ChartTokenSelector`、`ChartHeader` 与 FESOL-52 的共享状态；不新增 Solana UI 或并行数据流。
- Solana 市场按自身 mint 和 token 标记取数、排序及筛选，不再通过 Arbitrum symbol 判断是否可展示；native SOL 价格使用 WSOL 地址，避免映射为 WETH。
- 从已有 Arbitrum 对应资产继承 GMX 分类与搜索别名，保留 Solana mint、精度及 k 系列展示字段；WSOL/WGMX 复用 SOL/GMX 图标。
- 缺少可信上市日期时不标 New、隐藏 Recently Listed；不请求或复用 EVM 日期。
- 修正合并依赖中 `NetworkFeeSurfaces.ct.stories.tsx` 的过期类型导入，使用现有 `tradeboxStorage` 导出。

| 检查 | 实际结果与范围 |
| --- | --- |
| 完整前端 `NODE_OPTIONS=--no-experimental-webstorage yarn test:ci` | 322 文件通过、1 文件跳过；3,283 测试通过、1 跳过；退出 0。之后仅整理测试配置对象，业务代码未变 |
| 最终定向离线回归 | 4 文件、33 测试通过；网络审计 4 installations / 0 blocked；清理通过 |
| SDK / 类型 | 已授权构建 1,102 artifacts；verify 和根 `yarn tscheck` 均通过 |
| 静态检查 | 本轮修改的 7 个源码/测试文件 ESLint、Prettier 通过 |
| 样例页面 | 3 标的；搜索并选择 BTC，Header 更新为样例 BTC 价格；无 Recently Listed、无未捕获页面异常 |
| 真实页面 | 列表 40 标的；Crypto/Meme 筛选，kBONK/kSHIB/kPEPE 搜索选择及主项目图标加载通过，无未捕获页面异常 |
| 网络切换及开关 | 现有 Solana read-only Playwright 2 项通过：flag off 不加载 SDK；flag on 保留选择与 EVM chain identity。真实数据页面 Arbitrum 往返后恢复 kPEPE 选择 |
| 价格刷新 | 真实 kPEPE 价格响应时间由 1793803888814 前进至 1793803893553，raw min/max 均变化；Header 按新 midpoint ×1,000 更新并通过显示精度断言 |
| 实时数值 | 上述 3 标的展示价格约等于 raw midpoint ×1,000（仅容许显示精度舍入）；共享 OI 与浏览器捕获的真实 values 响应一致；独立按每秒 factor、支付方向、OI 比例和 3,600 秒计算 funding/borrowing/net，结果与 selector 及 Header 显示一致 |

本地证据保存在已忽略的 `.local/acceptance/frontend-offline/fesol-15/`：`fesol-15-test-ci.log`、`fesol-15-final-unit.log`、`fesol-15-interactions.log`（样例）、`fesol-15-interactions.json`（真实数据与状态）、`fesol-15-live-parity.log`、`fesol-15-flags.log` 和页面截图。临时验收脚本留在该目录，不随需求提交。

自审覆盖本轮差异的网络隔离、SWR 日期缓存、base58 大小写、native/wrapped 区分、展示倍率与原始价格分离，以及 Solana lazy import 边界。未调用不可用的原生 `/code-review` 或宣称完成正式 PR 审查；未运行前端生产构建或分支预览。


## 2026-11-05 用户已打开页面复验

在用户现有 Chrome 的 `http://localhost:3011/trade` 标签页执行，保留中文界面和真实网络配置；未另开隔离浏览器替代。确认 `solanaNetwork` 开启，`gmsol-api-fixtures` 和 `solana-api-url` 均未设置。通过 DevTools 对实际 fetch 与 SDK 返回值增加临时只读观察，未替换返回数据；验收结束已还原原函数、关闭 DevTools，并恢复 DOGE 市场。没有修改业务源码、连接钱包、签名或广播交易。

- 实际 keeper `/prices/tickers` 和 `/prices/24h` 返回 200，分别提供当前价格和涨跌统计；市场 values 为 67 条，pairs 为 95 条。观察器结束时记录了 56 次成功的 values 返回，滚动保留的数据中有 53 次 ticker 返回；这些是观察窗口内计数，不是服务 SLA。
- 列表 40 标的；Crypto/Meme 分类、`Shiba` 名称搜索、带首尾空格的 `kPEPE` 搜索与 Enter 选择均正常。DeFi 下搜索 BONK 正确显示分类无结果，“搜索所有永续合约市场”恢复结果；不存在的名称显示无匹配提示。
- 全部 40 行显示价格降序断言通过，包括 k 系列以放大后价格参与排序；列表图片均已加载，没有 New 或 Recently Listed。
- kBONK 原始 midpoint ×1,000 为 `0.0030035793`，Header 显示 `$0.0030036`；OI `$1.1k / $5.6k`，净费率 `+0.0526% / -0.0107%`，与共享计算及实际消费的市场响应相符。
- kSHIB 放大后 midpoint 为 `0.0047071305`，显示 `$0.0047071`；pairs 成交量 `0.0999748` USD 显示 `$0.1`；净费率 `-0.0088% / +0.0112%`。
- kPEPE 放大后 midpoint 为 `0.0049262445`，显示 `$0.0049262`；pairs 成交量 `21339.858055002696` USD 显示 `$21.3k`；净费率 `+0.0035% / -0.0044%`。
- 三个 k 系列标的的 OI 与实际 SDK 响应匹配，按 factor、支付方向、OI 比例及 3,600 秒独立核算 funding/borrowing/net 均通过；流动性与共享 `getAvailableUsdLiquidityForPosition` 一致。kPEPE 费率明细提示正确分开展示资金费用与借贷费用。
- kPEPE 后续 raw min/max 发生变化，新的 midpoint ×1,000 为 `0.0049243035`，Header 更新为 `$0.0049243`；采样时价格响应年龄约 2.1 秒。上述数值是不同采样时刻的证据，不应混作同一快照。

界面与环境边界：`Page outdated. Refresh` 对应本地 `UI_VERSION=2`、生产配置要求 `2.1`，由既有 `useHasOutdatedUi` 触发，不代表本次市场价格未刷新。没有通过 localStorage 覆盖或改版本号绕过该门槛。打开 DevTools 时已有 multicall 历史错误，新增观察窗口内没有捕获到新的 console error；其历史根因本轮未复现。另看到 3 次 `Load history candles failed / Oracle candles timeout` 警告，图表随后能够显示对应标的，不能声称整个图表或整页所有外部请求完全无异常；图表行为不属于本次 selector/header 范围。

本次数据证据：`.local/acceptance/frontend-offline/fesol-15/fesol-15-user-browser-2026-11-05.json`，浏览器记录时间 `2026-11-05T08:03:52.701Z`（北京时间 16:03:52）。包含公开市场快照、界面文本、排序结果及错误记录；未采集钱包凭据。结论：本轮未发现 FESOL-15 范围内新增功能问题；未重跑全量测试、网络开关回归或生产构建。
