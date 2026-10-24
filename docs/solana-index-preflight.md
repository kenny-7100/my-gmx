# Solana 统计索引只读预检

更新日期：2026-10-25。对应 A16 的只读端点与契约/事件年龄阶段，工具已实现。当前核实的是 gmx-api 已使用的 Core volume 索引，不部署本地索引器、不需要 Portal key、不修改业务实现。

## 何时先运行

后续 Agent 验收依赖 Solana volumeRecords 的统计/成交量功能，或调查历史与统计结果为空/陈旧时，先检查实际索引依赖，再排查展示或计算；其他价格、钱包、SDK 或本地样例验收无需运行。

工作目录为主仓库根目录，依赖现有 Node 22 与 curl：

```sh
yarn solana:index-preflight
```

不需要启动 RPC/API、读取钱包或登录 SQD。端点和阈值从 [gmx-api 配置](../gmx-api/src/config/protocolStats.ts) 的 `PROTOCOL_STATS_GMTRADE_SQUID_URL` 与 `PROTOCOL_STATS_FRESH_MAX_AGE_SECONDS` 的源码默认值读取，不加载该模块或环境变量。当前分别是 `https://gmx-solana-sqd.squids.live/gmx-solana-base:prod/api/graphql` 与 900 秒；这沿用现有 API 默认口径，不改变业务配置，也不代表部署环境没有覆盖默认值。

工具不解析根 `.env.local`、不使用 API secrets、不自动切换端点。嵌套 gmx-api 源码需存在；没有源码、默认声明格式变化或无法唯一提取时明确失败。目标部署若使用其他地址/阈值，先确认对应配置和资源，不把本工具的默认端点结果当那个部署的证据。

实现：[scripts/solana-index-preflight.mjs](../scripts/solana-index-preflight.mjs)。针对性测试：`yarn test:solana-index-preflight`。

## 查询与判定

固定只读 GraphQL 查询，仅获取 squidStatus.height 和按 timestamp_DESC 排序的最新一条 volumeRecords，字段为 id、timestamp、marketToken、volume；不扫描全历史，不执行 mutation。使用 curl 避免已有 SQD 环境的 Node fetch 停滞经验；单请求 25 秒、进程 30 秒、响应上限 1 MiB，不轮询或自动重试。

核对响应 data、GraphQL errors、非负安全整数高度、单条列表、非空事件 ID、32 字节 base58 地址、UTC ISO 时间和非负整数字符串 volume。HTTP 200 仍有 GraphQL 错误时失败，不接受部分数据。volume 不转 Number，不将原始单位自行转为前端 USD；此预检不判断金额模型正确性。

| 状态 / 退出码 | 含义 |
| --- | --- |
| passed / 0，recent-volume-record | 查询契约满足且最新事件年龄在 0～900 秒（含边界） |
| blocked / 2，no-volume-record | 查询可读但无记录，缺少该范围的验收样本；不能推断历史应为空 |
| blocked / 2，stale-volume-record | 最新事件超过既有阈值，暂不能据此作为新鲜数据验收样本 |
| blocked / 2，future-volume-record | 事件晚于本机观察时间，先核实本机时钟或时间数据；不能用负年龄通过 |
| failed / 1 | 配置/依赖、请求/HTTP、JSON、GraphQL 或字段契约错误；stderr 脱敏分类，无成功报告 |

最新事件年龄不是索引处理延迟：市场无新事件也可能使其增大。blocked 不等于索引器已故障；继续结合该需求的活动范围、处理进度和负责人信息判断。本轮不把事件时间与高度换算成链上延迟，不假定 SQD 高度与 RPC slot 可直接比较。

报告固定 `processingLag: not-evaluated`、`historyCompleteness: not-evaluated`。高度只是观察值，没有已批准最低高度；单次查询不证明索引持续推进、finalized-only 配置、无历史缺口、Core/GT 覆盖一致、API 已消费该数据或业务功能正确。当前接口使用可变 prod 标签，也不能凭 endpoint 推断部署源码 SHA。

## 证据与失败处理

报告包含观察时间、端点、配置路径/摘要、阈值、索引高度、最新事件与年龄、查询摘要和检查器源码摘要。检查前先核实目标需求的数据来源，不能把旧 GMTrade 前端或旧后端设为长期依赖。此端点来自当前 gmx-api 配置；它不是本地 API 样例模式的前置。

```sh
mkdir -p .local/acceptance/solana-index
yarn solana:index-preflight > .local/acceptance/solana-index/report.json
```

先检查退出码与 JSON；blocked 报告仍完整输出，失败 stdout 可能为空。可按[证据包说明](agent-evidence.md)用 `--report index=...` 归档。产物目录被 Git 忽略，其他机器不保证存在，工作表保留观察值和包摘要。历史报告不自动作为当前数据新鲜度证据。

失败按顺序核实嵌套源码与默认配置、curl/网络和 HTTP、GraphQL 字段、数据与时钟；工具不输出原始错误正文。端点缺权限时停止依赖工作并协调资源，不自行换索引器、生成假记录或删除鉴权。该预检没有 Portal processor 凭据，因此不能替代部署日志、replay 或数据库检查。

## 本轮验收

| 条件 | 结果 |
| --- | --- |
| 来源 | passed；复用现有 API 默认端点及 900 秒，不新增业务配置 |
| 自动测试 | passed；3 组覆盖精确金额、32 字节地址、日期、空记录、阈值边界/未来事件、GraphQL 部分错误、非法字段与 CLI 状态；证据包原有 3 组测试通过 |
| 真实预检 | passed；观察高度 461007142，事件年龄 6.557 秒，金额保持原始字符串 |
| 独立对照 | passed；Python 标准 JSON 解析，另按事件 ID 查询得到相同记录；后一次高度 461007284。仍为同一端点，不宣称独立数据真值 |
| 请求失败 | passed；实际不可达本地连接返回 request-failed，不输出底层请求细节 |
| 证据包 | passed；报告可打包并离线 verify；包完整不代表业务通过 |
| 工程与交接 | passed；类型检查、ESLint 零警告、格式/语法、121 个文档本地链接与摘要检查通过；完整前端单元测试 3014 passed / 1 原有 skipped，退出 0 |

观察时间 UTC `2026-10-24T21:42:58.557Z`（北京时间 2026-10-25），最新事件 `000461007129-7B4At-000196-000003-000008`，timestamp `2026-10-24T21:42:52.000000Z`，volume `89041375517363012632576`，marketToken `CH7pboF6PnCTAuWZbhC1eLKsX6rjd2UAPG87oqsizxR2`。

本机 `.local/acceptance/solana-index/` 保存 report.json、comparison.json、pack.json、verify.json、evidence-package/ 与工程日志。证据包需求标签仅演练归档关联，不宣称该需求验收完成。A16 本轮只读阶段完成后，replay 范围、实际处理延迟、历史缺口和 GT/其他领域覆盖仍需按对应需求落实。

最终代码补充了 HTTP/curl 超时/进程超时及非法 JSON 的自动测试，均失败分类正确；实现更新后重新读取了真实数据并逐条对照。最终报告为 final-report.json，独立对照为 final-comparison.json，证据包为 final-evidence-package/，摘要输出为 final-pack.json / final-verify.json；此前 report.json 为初轮观察，不用于最终检查器摘要核对。

最终观察时间 `2026-10-24T21:45:47.184Z`，高度 `461007933`，最新事件年龄 `22.184` 秒，独立对照高度 `461007945`；最终包 manifestSha256 `5c303b6149ce92ff6c4c32d520fce55931f7cca089322b2f159806fc09e2f3c9`。最终报告的检查器及配置摘要已与当前文件核对一致。

本轮源码基线 `890949d826`，实施中 dirty=true；最终针对性测试 3 组及证据包回归 3 组通过。完整前端单元测试 299 文件通过、1 原有跳过，3014 tests 通过、1 原有跳过，进程退出 0；日志仍含既有 happy-dom teardown AbortError，未修改无关依赖。没有启动服务、运行 UI/浏览器/构建/部署或读取钱包/发送交易。
