# Agent 验收基础设施调研与实施清单

调研日期：2026-10-24。最近实施更新：2026-10-25。

本文为后续逐项建设 Agent 验收基础设施提供入口。用户已确认希望 Agent 参与大量后续需求的验收，并要求先广泛调研、形成清单，再逐项实施。本文中的建设方案与优先级尚未整体批准实施；用户随后已批准 A01 本地 Solana RPC 代理及前端 URL 入口、A02 keeper 只读预检，以及 A05 本地钱包的助记词校验、地址派生与 Mainnet SOL/代币账户只读检查；2026-10-25 又授权按就绪条件推进下一项，已选择 A08 本地样例服务与 CLI 验收，实施状态见下文。保存文档不代表授权启动服务、浏览器、测试、构建、部署、发送交易或修改外部系统，具体执行继续遵循根目录 [AGENTS.md](../AGENTS.md)。

## 目标与结论

让 Agent 获得可访问的依赖、可重复的测试状态和可复核的业务结果，在需求实施后判断验收条件是否满足，并准确报告阻碍和未覆盖范围。

项目已有 Playwright、预览版本定位、报告、失败截图、trace，以及 EVM funded runner。建议复用这些基础，采用“本地验证逻辑与状态 → 预览环境验证真实数据 → 少量真实交易验证完整流程”的组合，逐步扩展 Solana 能力，不另建并行应用或业务数据流。

A01 已完成本地开发与 Agent 读取、模拟验证通道的建设及验收。A02 访问与诊断工具已完成验收；三个端点均缺少 `solanaTrading`，真实交易前置单独跟踪。用户已批准并实施本地开发开关覆盖，不再因此阻挡本地功能开发。随后建议核实 A03（api-solana 地址与版本），确认 API 契约并落实 FESOL-71 测试资源。本地完整协议环境可后续验证，不宜成为所有前端需求的共同前置。旧前端和可能废弃的旧后端仅用于理解行为，不作为目标验收环境的长期依赖。

## 调研范围与证据边界

- 本轮查阅主前端、gmx-api、Solana 协议与 SDK、旧前端/后端参考、流程文档、SQD 索引，以及 GitHub、实时 Linear 和工具官方资料。不是全仓库代码审计或完整迁移进度评估。
- Linear 全量同步完成于北京时间 **2026-10-24 19:49:43**：FESOL 共 100 条，迁移项目 74 条；项目内未发现 `GMTrade` 标签。数量包含 Canceled、Duplicate 等状态，不是有效工作量或完成率。补查了跨团队 Solana 相关需求和 PRO-4448；关键条目补读评论与关系。
- 本地需求摘要为 `.local/linear/FESOL/snapshots/2026-10-24T11-49-43-222Z-34ba4d35/summary.md`，同目录 `snapshot.json` 保存正文。该目录被 Git 忽略，不随仓库共享；后续按[需求工具说明](linear-requirements.md)实时核对，不能假定其他机器有此快照。
- 调研时本地主前端分支为 `solana-integration`，HEAD 为 `d70c0ac0bc802dbd10db9eb21d7d5364d5cabe34`；线上 `release` 为 `8ef82eb8a465b2045f73805a66941bf7f836630d`。本地及线上 gmx-api `main` 核验 SHA 为 `b86956df00902e44e0295827d651b206a6153942`。本地代码不等于上游已交付或已部署。
- [ADR-0015 PR #27](https://github.com/gmx-io/gmx-adrs/pull/27) 本轮核验仍为 Open、未合并，正文状态为 Proposed；查阅的是 `adr-0015-solana-gmx-api` 分支。使用前需重新核实，不能把提案直接当作已部署事实。
- 本轮仅静态调研、线上只读查询与少量接口请求；未启动服务、安装工具、运行测试、构建、部署或发送交易。文档整理没有重新核验线上状态。

## 建设清单

稳定编号用于后续指代。P0 表示优先明确或打通的条件；P1 为随后建设的高价值能力；P2 按需求逐步补充。状态“待推进”表示本清单对应的基础设施尚未完成验收，不表示相关业务代码完全不存在。执行顺序还需结合依赖核验。

| 编号 | 优先级 | 能力 | 核验现状（后续实施更新见记录） | 建议建设与完成标准 | 对应需求 / 行为 | 前置与边界 | 实施状态 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A01 | P0 | Agent 可访问的 Solana RPC | 本地代理复用 fallback key 并设置生产 Origin，Agent 与本地前端共用入口；已有真实连通性验证命令。当前上游固定 Mainnet，尚无已验收的 Devnet 入口。 | 已完成批准的 Mainnet 本地读取与模拟范围；启动代理后执行 `yarn solana:rpc-proxy:verify` 复核。 | FESOL-89/96/51、95/56、64/65。 | 使用前需启动代理，依赖 fallback key 权限及配额；Devnet、业务 client、交易广播、WebSocket、持续负载和 CI 不属于已验收范围。 | 已完成（Mainnet 本地开发与 Agent 读取/模拟通道） |
| A02 | P0 | GMX keeper 价格与 UI flags 访问 | 已实现 `yarn keeper:preflight`，复用现有配置；用户确认基础资产 SOL/BTC/ETH/USDC/USDT，ticker 最大年龄 30 秒。三端点的真实价格、24h、K 线和 flags 读取通过。 | 预检、错误分类和失败退出已验收；本地开发覆盖已实施。真实交易就绪独立判定。详见[工具与证据](keeper-preflight.md)。 | FESOL-88/50/99；交易发送前检查；故障 banner。 | 三端点均缺少 `solanaTrading`，真实预检仍返回 `blocked` / 退出 2；本地可显式覆盖，预览/生产仍用真实开关。未验收 CI 或浏览器 CORS。 | 已完成（访问与诊断工具；真实交易前置未就绪） |
| A03 | P0 | api-solana 地址与版本 | FESOL-62 评论确认 Cloud Run stub 已部署；上游 `solanaApp.ts` 仍返回样例。本轮 `solana.gmxapi.io/ping`、`/v1/markets/config` 为 404，`/v1/pairs` 为 200，符合 ADR 的域名切换前描述。 | 获取实际 `run.app` 地址、访问条件、部署版本及数据模式；前端预览可指向明确版本的 API。 | FESOL-52/97/98/100；后续 FESOL-64/65。 | 本轮未取得并实测 `run.app` 地址；pairs 正常不代表市场/持仓/订单可用。 | 待推进 |
| A04 | P0 | 评审后的 API 契约与样例 | 已有市场、持仓、订单、费用折扣样例；FESOL-61 仍 Todo，FESOL-97/100 要求 reviewed samples。 | 固定契约版本、字段含义、精度、错误/缺失语义；parser、共享状态与 API 使用同一组契约检查，样例记录来源及预期结果。 | FESOL-61/97/98/100；共享状态与组件集成。 | 当前样例不自动等于已评审契约；样例验收不替代真实数据验收。 | 待推进 |
| A05 | P0 | 验收钱包与账户状态 | 已批准并实现[本地钱包工具](agent-wallet.md)：从 `.env.local` 的专用助记词派生固定路径 EVM/Solana 地址，Mainnet 原生 SOL 余额及 SPL/Token-2022 账户盘点均已通过真实只读验收；Devnet 按用户决定暂缓，持仓、挂单、ALT 等资源尚未落实。 | 地址、Mainnet SOL 与代币账户阶段已验收；后续资金相关验收按所需资产运行余额/账户命令，再判断预算，逐项准备账户样本及恢复方式。 | FESOL-61/65、56/19/59；余额刷新。 | 用户已配置助记词；不展示秘密。当前无签名或发送功能，EVM 不要求有资金。 | 部分完成（地址、Mainnet SOL 与代币账户已验收；协议账户状态与交易资源待完善） |
| A06 | P0 | Agent 操作授权与入口 | 已批准本地地址、Mainnet 余额工具及实际只读验收；可通过 `.env.local` 配置获取专用钱包公开地址。UI 测试、构建、部署和服务启动仍遵循根约定。 | 后续签名与发送使用独立命令，明确网络、允许操作、预算和停止条件；不把助记词配置当作交易授权。 | 所有需求，尤其浏览器和交易验收。 | 当前批准范围不包含实际钱包签名或广播交易；后续任务按已有会话授权核对，不自动扩大权限。 | 部分完成（地址与 Mainnet 余额入口已授权并验收；签名/发送边界待确认） |
| A07 | P1 | 需求与验收结果映射 | Linear 有验收条件及 FESOL-88～100 等切片，本轮未发现完整 Solana 自动验收映射。 | 每项记录验收条件、环境/数据、执行方式、证据和人工项；区分 passed、failed、blocked、not-run、partial。 | 所有需求；避免切片完成就误关父需求。 | 从选定需求渐进建立，不一次性给所有条目造测试。 | 待推进 |
| A08 | P1 | 本地 gmx-api 样例服务 | 已提供[本地服务与验收命令](solana-api-local.md)，复用现有 Solana 入口，无需数据库、RPC、subgraph 或钱包；14 项真实 HTTP 检查通过，输出 sample 模式和本地预期源码摘要。 | 本地服务启动、样例对照和诊断已具备；前端 host 接入、reviewed samples 和真实数据验收随对应需求推进。 | FESOL-97/98/100；背景 FESOL-62。 | 当前前端无 Solana API host 入口，本轮不修改业务代码；样例一致不等于 A04 契约评审或真实数据正确。 | 本地服务与 CLI 已验收；前端接入待业务需求（整体部分完成） |
| A09 | P1 | Solana 浏览器验收 | 已有 Playwright、fixture、只读账户、报告、截图、trace。regression 配置当前只接受 Arbitrum/Avalanche；funded runner 面向 Arbitrum。 | 在现有框架扩展网络选择、状态隔离、地址、余额及共享交易组件场景，复用诊断与报告。 | FESOL-42/48/90/96/97～100；flags 开/关；EVM 回归。 | 保留 EVM `chainId` 与独立 `networkId` 模型，不能只改 chainId。 | 待推进 |
| A10 | P1 | 真实钱包连接环境 | FESOL-42 为 Test，PR #3110 开放；要求 Phantom、Solflare、OKX、TokenPocket。现有回归未证明真实扩展与 Privy 完整兼容。 | 准备专用浏览器 profile、扩展和账户；检查连接、恢复、主动断开及 EVM/Solana 会话隔离，保留真实钱包兼容性验收。 | FESOL-42/6。 | 本地 CLI 地址工具不替代页面钱包连接、恢复、拒签及断开验收；注入钱包也不能单独证明四种钱包兼容。 | 待推进 |
| A11 | P1 | 数值正确性基准 | FESOL-57/64/65 要求与 gmsol 模型或链上 view 对比；ADR 指出已发布 SDK 的清算参数参考限制。 | 建立带源码/程序版本、账户、价格、时间和容差的参考向量；API 与前端 SDK 对同一输入核验。 | FESOL-92/57/64/65；精度、funding、borrowing、PnL、清算价。 | 两端相互比较不足以证明正确，需独立且已核实的基准。 | 待推进 |
| A12 | P1 | 交易生命周期证据 | 交易确认不等于 keeper 已执行；ADR 要求从关闭交易 CPI inner-instruction 数据读取 `OrderRemoved`，FESOL-94 跟踪解析。 | 关联模拟、发送签名、订单账户、执行/取消交易、原因、最终持仓和 API 刷新；明确各阶段超时。 | FESOL-20/56/59/94。 | simulation 只检查创建阶段；账户消失不能单独证明成交成功。 | 待推进 |
| A13 | P1 | 少量真实交易自动验收 | EVM funded runner 已有预算、锁、日志、恢复、清理。A05 地址与 Mainnet SOL 余额工具已验收，尚无本地签名、发送命令或 Solana 自动交易 runner。 | 复用既有交易构建与校验，逐步提供模拟、签名、发送和确认入口；再验证开平仓、限价创建/修改/取消，记录恢复及链上结果。 | FESOL-56/19/59。 | Mainnet 原生 SOL 已核验，Devnet 按用户决定暂缓；需明确网络、可广播 RPC、其他协议依赖与交易授权。A01 代理仍禁止发送。 | 待推进（钱包地址前置已具备，签名/发送尚未实施） |
| A14 | P1 | 预览版本与证据归档 | CI 已能定位精确 PR head 的 Cloudflare 预览并保存报告、截图、trace；统一预检现可记录本地源码 SHA/dirty、检查器/配置与预期 API 样例摘要。 | 补充前端 SHA、API 版本、SDK/WASM hash、程序版本/部署 slot、网络、flags、数据模式和交易签名。 | 所有需求。 | 记录具体版本；变化的预览别名和共享站点不足以绑定交付版本。 | 部分完成（本地预检版本证据已具备；预览/部署与业务证据待完善） |
| A15 | P2 | 可重置本地协议环境 | 已有 Anchor、`start-localnet`、`setup-localnet`。依赖 Geyser 插件、程序 `.so`、Redis 连接及 keeper 角色；本机未发现所需插件/产物，Solana、Anchor、Rust CLI 未在 PATH 中发现。 | 先验证单个有限场景：启动、准备账户/市场、执行一种订单、读取结果、重置；成功后再决定日常使用范围。 | 边界条件、失败状态、精度及订单流程。 | 有脚本不等于开箱可用；需配套 keeper 执行、oracle、流动性与前端配置。CLI 检查不证明整台机器绝对未安装工具。 | 待推进 |
| A16 | P2 | 历史与统计索引 | gmtrade-sqd 支持本地 Postgres、processor、GraphQL；Core Store 需 `SQD_PORTAL_API_KEY`，Core 与 GT 部署覆盖不同。 | 初期核实只读端点；相关需求实施时准备 replay 范围、索引进度检查和必要快照。 | Trades、Pools、Claims、Stats、GT 等后续范围。 | 不是首批市场/余额/下单验收的共同前置；Portal key/云权限由资源所有者配置。 | 待推进 |
| A17 | P2 | 可观察性、升级与容量 | FESOL-66/67 为 Backlog，要求域名、5xx、陈旧数据、RPC 指标、程序升级及负载成本核验。 | 提供只读日志/指标入口，区分服务存活、数据新鲜度和业务可用性；记录升级引起的不兼容。 | 数据陈旧、程序升级、限流和性能验收。 | ping 成功不等于业务可用；负载测试另行授权，不混入轻量预检。 | 待推进 |

## RPC 与 keeper 范围复核（2026-10-24）

用户要求确认是否仅 Solana 返回 403，执行了同环境只读对照。key 从当前 `src/config/rpc.ts` 读取，不输出其值。EVM 使用 `eth_chainId`；Solana 使用 `getSlot`，并在可用 key 下读取 gmsol 程序账户。未发送交易、运行浏览器或修改服务配置。

| 网络 | development（不带 Origin） | fallback（生产 Origin） | largeAccount（生产 Origin） | express（生产 Origin） |
| --- | --- | --- | --- | --- |
| Solana Mainnet | 403，网络未启用 | 200 | 200 | 403，网络未启用 |
| Arbitrum Mainnet | 200（首轮网络错误后复测成功） | 200 | 200 | 200 |
| Avalanche Mainnet | 200 | 200 | 200 | 200 |
| MegaETH Mainnet | 200 | 200 | 200 | 200 |
| Arbitrum Sepolia | 200 | 200 | 200 | 200 |
| Base Mainnet | 200 | 200 | 200 | 200 |
| Optimism Sepolia | 200 | 200 | 200 | 200 |
| Ethereum Sepolia | 200 | 403，网络未启用 | 403，网络未启用 | 403，网络未启用 |
| BNB Mainnet | 200 | 200 | 200 | 200 |
| Ethereum Mainnet | 200 | 200 | 200 | 200 |

生产 Origin 指 `https://app.gmx.io`，属于当前项目自己的来源。CLI 显式提供 Origin 的成功不能证明已完成浏览器 CORS 验收或取得独立服务端 key。development 的 Solana 请求不带 Origin、带 localhost 或生产 Origin 均为同一网络未启用错误。fallback、largeAccount、express 不带 Origin 的请求大多返回 `Unspecified origin not on whitelist.`；Ethereum Sepolia 等未开通网络则返回网络未启用。不能把全部 HTTP 403 归为同一故障。

关键证据：

- development / express 的 Solana 错误：`SOLANA_MAINNET is not enabled for this app.`，JSON-RPC code `-32600`。需要相应 Alchemy App 的资源所有者在 Dashboard 的 Networks 配置核实/启用；不是 Origin 改动可以解决的错误。
- fallback / largeAccount 的 Solana `getSlot` 成功；`getMultipleAccounts` 读取程序 `Gmso1uvJnLbawvw7yezdfCDcPydwW2s2iqG3w6MDucLo` 成功且 `executable: true`。说明现有供应商至少已有可读取 Solana 的入口，不需据此更换供应商。
- 公共 Solana `getSlot`、Arbitrum 和 Ethereum 公共 RPC 的 `eth_chainId` 均为 200，仅作网络对照；未配置为应用入口，不改变项目不使用公共 Solana RPC 的约定。
- keeper 以 `Mozilla/5.0` 请求时：Arbitrum、Avalanche、MegaETH 主机，以及两个 Arbitrum fallback 主机的 `/prices/tickers`、`/ui-flags/v2` 共 10 个请求均为 200。Arbitrum 主价格返回 116 条 ticker。
- Arbitrum 主 keeper 的两个路径以 Python 默认 User-Agent 请求均为 403，响应 `error code: 1010`；同轮改为 `Mozilla/5.0` 均为 200，明确复现请求头相关差异。该结果不等于全面确定服务端防护规则。
- Arbitrum 主 `/ui-flags/v2` 本轮返回的 JSON 未包含名称含 Solana 的键；接口可访问不等于 `solanaTrading` 已启用。

范围限制：这是最小 HTTP 读取与链标识检查，未验收 `getProgramAccounts`、100 账户批量读取、simulation、历史查询、WebSocket、速率/费用、浏览器或 CI。两个首轮 EVM 请求发生网络错误，已对相应条件复测并如表记录，不将瞬时错误当作权限结论。A01/A02 的原始 403 记录保留在调研范围描述中，当前判断以本节和更新后的清单为准。

## A01 已批准的本地代理方案与实施状态

2026-10-24 用户确认不要求 Alchemy 负责人新增网络权限，并批准让本地前端与 Agent 共用本地 Solana RPC 代理。该决定替代“优先给 development key 开通 Solana”的实施建议；不修改其他 key 的权限和 EVM RPC 路径。

**完成判定：A01 已完成，范围为本地开发与 Agent 的读取、模拟验证通道。** 不再将原 development key 的 Solana 403 作为这一范围的未解决阻碍。验收后服务已关闭；使用前从仓库根目录运行 `yarn solana:rpc-proxy`，随后执行 `yarn solana:rpc-proxy:verify` 确认当时的真实连通性。该方案继续依赖现有 fallback key 的权限与配额，供应商配置变化时需要重新核验；本次文档更新未重新请求线上接口。

- 实现入口：[代理说明](../tools/solana-rpc-proxy/README.md)、`yarn solana:rpc-proxy`。默认 `http://127.0.0.1:3030`，上游为 Alchemy Solana Mainnet，使用已有 fallback key 和已验证的生产 Origin。
- 前端入口：`src/config/rpc.ts#getSolanaRpcUrl()` 在 Vite 开发模式返回本地代理，可用 `.env.development.local` 的 `VITE_APP_SOLANA_RPC_URL` 指定其他开发地址；构建后的预览/生产使用 fallback Alchemy 地址，忽略开发覆盖，不依赖本地代理。
- 当前分支前端业务没有实际 Solana RPC client/余额读取模块；本次完成 URL 入口而未扩展业务范围。后续实现必须使用该入口，并遵循 Solana flag/动态加载规范；不能表述为钱包或交易流程已连通。
- 无依赖 Node 子项目，默认只监听 loopback，浏览器只允许本地 Origin；方法白名单仅含读取和模拟，拒绝交易发送及含写操作的混合批次。不静默回退或自动重试。
- 用户随后明确授权真实验收与修复后 push。已启动代理和本地前端，用浏览器导入统一入口并成功读取 slot 和批量查询；CLI getSlot、Mainnet genesis、100 账户批量读取、Order discriminator 扫描（209 个账户）通过。模拟方法返回预期的 `InvalidAccountForFee`；无交易发送，不能当作业务订单模拟成功。
- 可复用验收：代理启动后执行 `yarn solana:rpc-proxy:verify`；该命令已通过，覆盖实际读取、批次、CORS 预检、来源/写方法拦截和上游错误。代理单元测试 3 项通过，完整前端测试 3013 项通过、1 项原有概率测试跳过（`src/lib/userAnalytics/getIsAddressInGroup.spec.ts`）。
- `yarn build-sdk` 更新忽略的本地产物后，`yarn tscheck` 通过；无需修补业务类型。`yarn lint:ci` 通过。修复 `vite.config.ts` 的主项目测试发现和 tsconfig 扫描范围，避免嵌套参考仓库混入验收；没有通过安装旧项目依赖来掩盖问题。
- 本次本地代理与前端 URL 入口范围已完成真实验收；实际业务 client、业务订单、WebSocket、持续负载和 CI 环境留在对应后续需求中，不扩大本次完成范围。生产构建以 `NODE_OPTIONS=--max-old-space-size=8192 yarn build` 成功；默认约 4 GiB 堆首次构建耗尽内存，重跑仅调整该进程内存，没有修改产物规则。

## 工具与服务选项

以下仅完成资料调研，不代表已注册、配置、运行或验证兼容性。未核实付费计划、当前报价或配额，不据此承诺成本。

| 选项 | 适用性 | 建议 | 官方资料 |
| --- | --- | --- | --- |
| Alchemy | 项目已有选型、keys、规范和 RPC 成本调查。 | 优先核实现有入口与 403 原因；FESOL-60 已明确复用现有 keys。 | [Solana API](https://www.alchemy.com/docs/reference/solana-api-quickstart) |
| Helius / QuickNode | 可作为现有服务不满足条件时的 RPC 比较对象。 | 按 `getProgramAccounts` 过滤、100 账户批量读取、模拟/交易历史、限流与费用核验，不能只比 slot 延迟；暂不新增服务。 | [Helius](https://www.helius.dev/docs/rpc/overview)、[QuickNode](https://www.quicknode.com/docs/solana) |
| solana-test-validator | 与协议仓库现有 Anchor 和脚本最接近，支持加载程序、克隆账户和重置状态。 | 本地链优先评估路线，先核验固定版本与完整场景。 | [Agave](https://docs.anza.xyz/cli/examples/test-validator) |
| Surfpool | 可按需获取 Mainnet 账户并本地模拟。 | 后续验证候选，需核验版本、RPC 行为和 gmsol 兼容性，不直接替换现有环境。 | [Surfpool](https://docs.surfpool.run/) |
| LiteSVM | 进程内 VM，适合快速、确定的程序/指令测试。 | 适用于部分底层验证，不能单独覆盖浏览器、Privy、API 与 keeper 链路。 | [LiteSVM](https://www.litesvm.com/) |
| Playwright 扩展测试 | 支持 Chromium 持久化上下文中的扩展，真实钱包仍需准备。 | 在既有框架渐进扩展，先做应用状态验收，再补真实钱包。 | [Chrome extensions](https://playwright.dev/docs/chrome-extensions) |

协议仓库固定 Anchor `0.31.1`、Solana `2.1.21`，公开最新文档不代表该版本行为。主前端固定 `@gmsol-labs/gmsol-sdk` `0.9.0-test.2`，WASM hash 配置在 `src/config/gmsol/sdk.ts`；FESOL-72 跟踪 GMX CI 构建替换。SDK、WASM、IDL、程序源码和链上部署版本需分别记录，不能自动等同。

## 建议第一批推进顺序

### A02 工具已完成；本地开发可覆盖开关

用户已批准实施并要求持续推进至验收通过，资源需用户协调时可暂停依赖部分。这是基础设施建设，不是业务迁移需求实施。A01 已打通读链入口，但链上数据不足以证明价格源可用、数据新鲜或 Solana 交易开关就绪。既有复核已确认 keeper 的 403 与 User-Agent 有关，本项将该结论落实为可复用的真实访问检查，避免后续 Agent 重新排查同一问题。

用户已确认本项价格验收口径：SOL、BTC、ETH、USDC、USDT 的 ticker 最大年龄为 30 秒；仅用于验收，不修改前端缓存或交易参数。K 线与 24h 数据检查 SOL、BTC、ETH 的现有接口契约。`solanaTrading` 仅显式 `enabled: true` 为交易前置就绪；缺失、关闭、错误分别报告，不能冒充通过。

实施结果、阶段状态、命令、退出码与真实证据统一维护在[keeper 只读预检](keeper-preflight.md)。A02 访问与诊断工具已验收完成，不再将真实交易环境就绪混入工具完成口径。用户随后明确批准本地开发覆盖 `solanaTrading`：在 `.env.development.local` 设置 `VITE_APP_SOLANA_TRADING_OVERRIDE=true`，也可设为 `false` 验证关闭路径；未设置时读取真实接口。仅 Vite 开发模式生效，预览/生产忽略覆盖；本机已设置为 `true`。真实预检保持不变，不能将本地 mock 作为真实开关验收证据。三个 keeper 的真实交易开关缺失继续单独跟踪，需要真实开关联调或交易验收时再协调资源所有者。

建议最小范围与完成标准：

- 核对当前项目实际使用的 keeper 地址、价格/K 线接口、flags 请求及客户端行为；优先复用现有访问方式，按实际结果判断是否需要适配，不预设另建代理。
- 提供轻量只读检查，显式区分网络或 Cloudflare 拒绝、HTTP/业务错误、价格缺失或陈旧、Solana flags 缺失或关闭。价格新鲜度与必需资产的判定应使用项目既有契约；未明确时先确认，不自行猜测。
- 将已验证的访问条件写入执行前入口，说明如何复核、哪些检查通过、哪些仍受阻。HTTP 200 不单独视为价格和交易能力验收通过。
- 若实际环境缺少 Solana flags、价格数据或权限，明确记录所需资源并暂停依赖工作，等待资源所有者处理；不通过 fixture、替代服务或自行开启交易绕过。

A02 之后建议推进 A03，确认实际 api-solana 部署地址、版本与数据模式，再结合 A04/A08 建立可重复的本地 API 验收环境。A08 的本地服务与 CLI 已先行完成（2026-10-25），尚未接入前端业务。以下为整体推进分组，A01/A02 和 A05 地址、Mainnet 余额阶段已完成部分无需重复建设。

| 顺序 | 交付物 | 对应清单 | 完成标准 | 当前进度与下一步 |
| --- | --- | --- | --- | --- |
| 1 | 环境与访问清单 | A01/A02/A03/A06 | 明确入口、访问条件、配置位置、负责人、版本和数据模式，解决或清楚标记访问阻碍。 | A01/A02 已完成；A03 待核实，A06 已明确地址与 Mainnet 余额阶段授权，其他范围按任务确认。 |
| 2 | 统一只读预检 | A01/A02/A03 | 一次执行即可识别缺配置、403、错误网络、接口错误及陈旧数据；失败不得静默通过。 | 已有[统一预检入口](agent-preflight.md)，组合 RPC、keeper、样例 API 和显式钱包检查；真实部署 API 验收待 A03。 |
| 3 | 评审样例与本地 API 模式 | A04/A08 | 共享状态/组件验收可重复运行，报告明确为样例模式；不冒充真实数据验收。 | A08 本地服务与 CLI 已验收；A04 reviewed samples 和前端 host 接入待推进。 |
| 4 | Solana 验收报告 | A07/A09/A14 | 从一条需求开始，绑定版本并列出通过、失败、未执行及证据。 | 已有工具级验证记录；业务需求映射与统一版本证据仍待推进。 |
| 5 | FESOL-71 测试资源 | A05，配合 A10/A12/A13 | 钱包、样本持仓/订单、ALT 和 flags 可用，为真实数据及交易闭环提供基础。 | 地址与 Mainnet 原生 SOL 余额工具已验收；Devnet 暂缓。下一步准备业务账户样本，签名、发送及恢复仍待完善。 |

以上为建议顺序，不是新的 Linear 需求，也不授权修改现有需求。可先并行准备不依赖交易资金的资料，但服务开通、权限、凭据、资金等前置缺失时，暂停其依赖工作，等待资源所有者处理并确认可用；不擅自降级、替换服务或用模拟结果冒充真实验收。

钱包侧 Devnet 前置更新（2026-10-24）：四个现有 Alchemy key 在无 Origin / 生产 Origin 下的 Devnet 链标识、slot、账户读取均返回“网络未启用”403。A01 Mainnet 已完成状态不变；用户已决定 Devnet 暂缓，不阻挡 Mainnet 余额工具；该工具已实现并验收。Devnet 后续需资源所有者启用后复核。详细证据与协调步骤见[本地钱包 Devnet 复核](agent-wallet.md#devnet-rpc-前置复核2026-10-24)。

## 后续逐项实施与维护

1. 用户选定编号或交付物后，先核对最新代码、线上需求、相关 PR 和实际资源，不把本次快照当作永久现状。
2. 明确本项最小范围、完成标准和操作授权，复用现有能力；仅实施用户选定范围，不自动推进整张表。
3. 原地更新对应行的实施状态，并在下表记录完成内容、验证证据、遗留项及下一步。相关业务任务沿用一需求一分支的既有交付流程，不能混入个人基础设施改动。
4. 区分工具已编写、服务已启动、依赖已连通、样例验收通过、真实读取通过、真实交易通过；未执行和受阻不记作通过。mock/fixture 仅用于明确授权的测试范围，不作为资源缺失时的替代验收。
5. 测试文件按 gmx-prompts 的测试准入规则选择，不给每条清单机械新增测试。纯文档维护只检查内容、路径和链接，不运行 UI 测试或构建。
6. 本文与主题入口一起维护；不记录密钥、钱包秘密、完整带密钥 URL 或其他凭据。只记录秘密配置位置。

| 日期 | 编号 | 实施结果与证据 | 遗留项 / 下一步 |
| --- | --- | --- | --- |
| 2026-10-24 | 全部 | 完成首轮调研及文档整理；尚未实施基础设施。接口结果与限制见上文。 | 等待用户逐项选择推进；执行时重新核验易变状态。 |
| 2026-10-24 | A01/A02 | 完成 RPC/keeper 只读范围复核，确认网络启用、Origin 白名单及 User-Agent 三类差异；详见复核记录。 | 用户随后选择不新增权限，批准使用本地代理；后续仍需按完整验收标准核验，未修改 Alchemy 配置。 |
| 2026-10-24 | A01 | 本地代理与 URL 入口真实验收通过：CLI、浏览器、100 账户、订单扫描、模拟可达、拦截及错误透传；已提供复用验收命令。完整前端测试、类型检查、lint 及 8 GiB 堆生产构建通过。 | 业务 client/订单、WebSocket、持续负载与 CI 不在本次代理范围内；后续按需求验证。 |
| 2026-10-24 | A01 完成判定 / 下一项 | 按已完成验收，将 A01 标记为已完成（本地开发与 Agent 读取/模拟通道）；补充服务启动、连通性复核及 key 权限/配额前置。此次仅更新文档，未重新执行线上验收。 | 建议下一项为 A02：keeper 价格与 UI flags 的可复用访问检查；尚未实施。 |
| 2026-10-24 | A02 | 经用户批准实施，已确认阈值、完成预检命令与针对性测试；主端点和两个备用端点真实价格、24h、K 线及 flags 读取通过。Python 默认 User-Agent 的 Cloudflare 403 对照及失败退出验证通过。分阶段进度与工程验收见[工具说明](keeper-preflight.md)。 | 部分通过 / 受阻：三端点缺少 `solanaTrading`，需用户协调资源所有者确认目标验收环境与预期状态；资源就绪后重新验收，未标记整体完成。 |
| 2026-10-24 | A02 完成口径 / 本地开发覆盖 | 用户确认采用显式本地开关覆盖；已在统一读取入口实施，当前机器配置为 `true`，开发/非开发环境与远端值组合测试通过。A02 访问与诊断工具标记完成，修正此前将真实交易就绪混入工具完成口径的判定。 | 真实预检继续报告缺失，交易前置独立跟踪；后续机器按工具文档配置，不要求为本地 mock 开发先发布真实开关。 |
| 2026-10-24 | A05 地址阶段 / A06 地址授权 | 用户配置助记词并授权后，公开向量与失败路径三组测试、实际 EVM/Solana 地址派生及重复性检查通过；配置变量与固定路径见[钱包说明](agent-wallet.md)。 | 地址阶段已完成；资金仅 Solana Devnet/Mainnet 为用户确认信息，余额未做链上核验，EVM 不要求资金。网络入口、余额、账户状态、签名及发送后续推进；A05 整体未完成。 |
| 2026-10-24 | A05 Mainnet 余额 / A06 只读授权 | 已实现并验收通过：完整 Mainnet genesis 校验后读取 confirmed 原生 SOL，实际 `98404876` lamports（`0.098404876 SOL`）与独立 RPC 一致；六组钱包测试、静态检查及实际停服/Devnet 失败路径通过，见[验收记录](agent-wallet.md#mainnet-余额预检验收记录2026-10-24)。本次代理已关闭。 | Devnet 按用户决定暂缓；A05 整体仍部分完成，业务账户样本、签名、发送及恢复待推进；本轮只改验收脚本和文档。 |
| 2026-10-25 | A08 本地样例服务与 CLI | 已实现启动与 14 项 HTTP 检查；3004/3005 实际验收、样例与错误响应注入、环境隔离、信号清理、停服失败路径通过。脚本检查、类型检查及 3014 项前端测试通过（1 项原有跳过），详见[工具与验收记录](solana-api-local.md)。 | 本轮范围完成，API 源码未修改，服务已关闭；前端 host 仍待对应业务需求，A03/A04 和真实交易不因样例通过而完成。 |
| 2026-10-25 | A05 Mainnet 代币账户 | 已完成 SPL Token / Token-2022 账户盘点：实际 23+3 个账户，逐项 RPC 对照和 USDC 单账户余额对照一致；9 组钱包测试、4 组统一预检测试及工程检查通过。详见[钱包验收记录](agent-wallet.md#mainnet-代币账户盘点验收记录2026-10-25)。 | 本轮工具范围完成，代理已关闭；Devnet 暂缓，协议账户资源、签名/发送和恢复仍待推进，不将盘点余额视作交易就绪。 |

## 统一预检验收记录（2026-10-25）

统一只读预检与 A14 本地证据范围已完成：[工具说明](agent-preflight.md)。四项真实检查正确汇总 blocked，API-only 为 passed，停服场景为 failed；报告摘要校验、4 组针对性测试、类型与 3014 项前端测试通过（1 项原有跳过）。服务已关闭。A07 的业务需求映射、A14 的预览/部署和交易证据仍待推进，真实交易开关缺失仍明确报告。


## 证据与查阅入口

| 主题 | 入口 |
| --- | --- |
| 需求及架构规则 | [参考仓库说明](solana-reference-repositories.md)、[需求工具说明](linear-requirements.md)、[ADR-0015](https://github.com/gmx-io/gmx-adrs/blob/adr-0015-solana-gmx-api/adr/0015-serve-solana-data-through-gmx-api.md) |
| RPC 决策与代理 | [FESOL-60](https://linear.app/gmx-io/issue/FESOL-60)、[PRO-4448](https://linear.app/gmx-io/issue/PRO-4448)、[RPC 配置](../src/config/rpc.ts)；FESOL-60 的 2026-10-21 评论明确复用已有 Alchemy keys，覆盖正文原有的单独 browser key 计划。 |
| 测试资源与契约 | [FESOL-71](https://linear.app/gmx-io/issue/FESOL-71)、[FESOL-61](https://linear.app/gmx-io/issue/FESOL-61)、[FESOL-97](https://linear.app/gmx-io/issue/FESOL-97)、[FESOL-100](https://linear.app/gmx-io/issue/FESOL-100) |
| API 服务与实现 | [FESOL-62](https://linear.app/gmx-io/issue/FESOL-62)、[API PR #292](https://github.com/gmx-io/gmx-api/pull/292)、[README](../gmx-api/README.md)、[Solana 路由](../gmx-api/src/solanaApp.ts)、[Cloud Run 配置](../gmx-api/opentofu/envs/gcp_production/solana.tf) |
| 真实市场、持仓、订单及运维 | [FESOL-64](https://linear.app/gmx-io/issue/FESOL-64)、[FESOL-65](https://linear.app/gmx-io/issue/FESOL-65)、[FESOL-66](https://linear.app/gmx-io/issue/FESOL-66)、[FESOL-67](https://linear.app/gmx-io/issue/FESOL-67) |
| 已有自动验收 | [Regression README](../autotests/regression/README.md)、[funded runner](../autotests/regression/funded/README.md)、[配置](../playwright-regression.config.ts)、[PR workflow](../.github/workflows/pr-e2e.yml) |
| 钱包和价格工作 | [FESOL-42](https://linear.app/gmx-io/issue/FESOL-42)、[前端 PR #3110](https://github.com/gmx-io/gmx-interface/pull/3110)、[前端 PR #3138](https://github.com/gmx-io/gmx-interface/pull/3138)、[API PR #295](https://github.com/gmx-io/gmx-api/pull/295)；本轮均仍开放，PR/检查状态不等于完整需求已验收。 |
| 本地链 | [Anchor.toml](../gmx-solana/Anchor.toml)、[justfile](../gmx-solana/justfile)、[启动脚本](../gmx-solana/scripts/start_localnet.sh)、[初始化脚本](../gmx-solana/scripts/setup_localnet.sh) |
| 历史索引 | [gmtrade-sqd README](../gmtrade-sqd/README.md)、[Core README](../gmtrade-sqd/squids/core/README.md) |
| 旧后端限制 | [旧 Solana 后端参考说明](gmtrade-web-backend-reference.md)：缺 workspace manifest/锁文件及相邻 client crate，不能独立还原运行环境。 |

嵌套参考仓库不保证随主项目 clone 自动获取。路径不可用时按[参考仓库说明](solana-reference-repositories.md)定位，不将本机资源存在视为所有 Agent 环境的共同条件。

## A08 本轮实施进度（2026-10-25）

本轮范围是本地测试验收基础设施，复用 `gmx-api` 已有 Solana 样例服务，不实现业务需求或修改业务代码。A03 实际部署地址、A04 reviewed samples 与真实协议交易就绪不作为本轮完成条件，也不能因本地服务通过就标记它们完成。

| 阶段 | 状态 | 验收条件 |
| --- | --- | --- |
| 入口与依赖核实 | 已通过 | 已核对 FESOL-62 实时正文/评论和当前源码；安装现有锁定依赖，不修改锁文件 |
| 启动与预检工具 | 已实现并验收 | 主仓库单命令启动已有 API；隔离本地秘密配置，不启用 EVM workers；端口冲突明确失败 |
| HTTP 真实验收 | 已通过（14 项） | ping、五类样例、动态时间戳、地址错误、404 与 CORS 检查通过；报告源码和样例版本，标明 sample 模式 |
| 失败路径与工程检查 | 已通过 | 服务停止、响应不符和依赖缺失明确失败；脚本检查及文档路径通过 |
| 文档与交接 | 已完成 | 命令、配置、已知前端边界与证据可复核；验收服务关闭，更新 A08 状态 |

## 统一只读预检本轮进度（2026-10-25）

范围：复用 A01/A02/A05/A08 的既有检查器，补齐统一入口和 A14 的本地版本证据；不实施业务需求、不变更真实 flags，也不宣称完成 A07 的业务验收映射或 A14 的预览/部署证据。

| 阶段 | 状态 | 验收条件 |
| --- | --- | --- |
| 范围与条件 | 已确认 | 既有四类检查器可用；缺部署/评审/交易授权的工作跳过 |
| 统一入口 | 已实现 | 明确选择检查项，钱包显式启用；复用工具、逐项隔离、输出统一状态 |
| 状态与失败测试 | 已通过（4 组） | 结果组合、超时/异常/非法输出不误报通过，未选择项为 not-run |
| 真实验收 | 已通过（含正确识别 blocked/failed） | 服务运行及停止场景、真实 keeper blocked、可选钱包检查、JSON 归档通过 |
| 工程与交接 | 已完成并验收 | 必要检查、版本摘要、文档入口和状态更新；关闭本次服务 |

## A05 Mainnet 代币账户盘点进度（2026-10-25）

范围：在现有本地钱包工具新增 SPL Token / Token-2022 账户只读盘点，复用 Mainnet 代理；不实现前端业务余额、不创建账户或交易，不将冻结/扩展账户余额视作可花费额度。

| 阶段 | 状态 | 验收条件 |
| --- | --- | --- |
| 前置核实 | 已通过 | 既有代理允许 getTokenAccountsByOwner，已配置专用钱包；无需新权限 |
| CLI 与解析 | 已实现 | 显式 Mainnet、先校验 genesis；两种程序全账户，精确金额与状态，错误不伪装空列表 |
| 自动测试 | 已通过（钱包共 9 组） | 精度、归属、重复/非法响应、失败传播与原有钱包回归通过 |
| 实际只读验收 | 已通过 | 钱包结果与独立 RPC 一致；停服明确失败，关闭本次服务 |
| 工程与文档 | 已完成并验收 | 必要检查、命令/边界与实施表更新 |
