# Agent 验收基础设施调研与实施清单

调研日期：2026-10-24。文档整理日期：2026-10-24。

本文为后续逐项建设 Agent 验收基础设施提供入口。用户已确认希望 Agent 参与大量后续需求的验收，并要求先广泛调研、形成清单，再逐项实施。本文中的建设方案与优先级是建议，尚未整体批准实施；保存文档不代表授权启动服务、浏览器、测试、构建、部署、发送交易或修改外部系统，具体执行继续遵循根目录 [AGENTS.md](../AGENTS.md)。

## 目标与结论

让 Agent 获得可访问的依赖、可重复的测试状态和可复核的业务结果，在需求实施后判断验收条件是否满足，并准确报告阻碍和未覆盖范围。

项目已有 Playwright、预览版本定位、报告、失败截图、trace，以及 EVM funded runner。建议复用这些基础，采用“本地验证逻辑与状态 → 预览环境验证真实数据 → 少量真实交易验证完整流程”的组合，逐步扩展 Solana 能力，不另建并行应用或业务数据流。

优先核实现有 RPC、keeper 和 api-solana 的访问条件，确认 API 契约并落实 FESOL-71 测试资源。本地完整协议环境可后续验证，不宜成为所有前端需求的共同前置。旧前端和可能废弃的旧后端仅用于理解行为，不作为目标验收环境的长期依赖。

## 调研范围与证据边界

- 本轮查阅主前端、gmx-api、Solana 协议与 SDK、旧前端/后端参考、流程文档、SQD 索引，以及 GitHub、实时 Linear 和工具官方资料。不是全仓库代码审计或完整迁移进度评估。
- Linear 全量同步完成于北京时间 **2026-10-24 19:49:43**：FESOL 共 100 条，迁移项目 74 条；项目内未发现 `GMTrade` 标签。数量包含 Canceled、Duplicate 等状态，不是有效工作量或完成率。补查了跨团队 Solana 相关需求和 PRO-4448；关键条目补读评论与关系。
- 本地需求摘要为 `.local/linear/FESOL/snapshots/2026-10-24T11-49-43-222Z-34ba4d35/summary.md`，同目录 `snapshot.json` 保存正文。该目录被 Git 忽略，不随仓库共享；后续按[需求工具说明](linear-requirements.md)实时核对，不能假定其他机器有此快照。
- 调研时本地主前端分支为 `solana-integration`，HEAD 为 `d70c0ac0bc802dbd10db9eb21d7d5364d5cabe34`；线上 `release` 为 `8ef82eb8a465b2045f73805a66941bf7f836630d`。本地及线上 gmx-api `main` 核验 SHA 为 `b86956df00902e44e0295827d651b206a6153942`。本地代码不等于上游已交付或已部署。
- [ADR-0015 PR #27](https://github.com/gmx-io/gmx-adrs/pull/27) 本轮核验仍为 Open、未合并，正文状态为 Proposed；查阅的是 `adr-0015-solana-gmx-api` 分支。使用前需重新核实，不能把提案直接当作已部署事实。
- 本轮仅静态调研、线上只读查询与少量接口请求；未启动服务、安装工具、运行测试、构建、部署或发送交易。文档整理没有重新核验线上状态。

## 建设清单

稳定编号用于后续指代。P0 表示优先明确或打通的条件；P1 为随后建设的高价值能力；P2 按需求逐步补充。状态“待推进”表示本清单对应的基础设施尚未完成验收，不表示相关业务代码完全不存在。执行顺序还需结合依赖核验。

| 编号 | 优先级 | 能力 | 2026-10-24 核验现状 | 建议建设与完成标准 | 对应需求 / 行为 | 前置与边界 | 实施状态 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A01 | P0 | Agent 可访问的 Solana RPC | FESOL-60 已 Done，最新评论确认现有 Alchemy keys 已启用 Solana。本轮开发 key 的 `getSlot` 和单账户 `getMultipleAccounts` 均返回 403，带 localhost/生产 Origin 的 slot 请求也返回 403。 | 核实现有 Alchemy 配置与当前环境访问条件，明确浏览器、CLI、CI 的入口；轻量预检检查网络、slot、账户读取及所需方法权限。 | FESOL-89/96/51、95/56、64/65。 | 尚不能报告 Agent 已可用；403 原因未确定。涉及账号权限由资源所有者处理，不直接推断需更换供应商。 | 待推进 |
| A02 | P0 | GMX keeper 价格与 UI flags 访问 | 配置中的 Arbitrum keeper 价格及 `/ui-flags/v2` 请求均返回 403。Solana 价格、K 线及交易开关依赖它。 | 明确开发机/CI 的访问条件；预检价格时间、资产覆盖、K 线和 `solanaTrading`，区分访问拒绝与数据缺失。 | FESOL-88/50/99；交易发送前检查；故障 banner。 | 未确认是来源、鉴权、网络还是其他限制。不能用 fixture 证明真实 keeper 可用。 | 待推进 |
| A03 | P0 | api-solana 地址与版本 | FESOL-62 评论确认 Cloud Run stub 已部署；上游 `solanaApp.ts` 仍返回样例。本轮 `solana.gmxapi.io/ping`、`/v1/markets/config` 为 404，`/v1/pairs` 为 200，符合 ADR 的域名切换前描述。 | 获取实际 `run.app` 地址、访问条件、部署版本及数据模式；前端预览可指向明确版本的 API。 | FESOL-52/97/98/100；后续 FESOL-64/65。 | 本轮未取得并实测 `run.app` 地址；pairs 正常不代表市场/持仓/订单可用。 | 待推进 |
| A04 | P0 | 评审后的 API 契约与样例 | 已有市场、持仓、订单、费用折扣样例；FESOL-61 仍 Todo，FESOL-97/100 要求 reviewed samples。 | 固定契约版本、字段含义、精度、错误/缺失语义；parser、共享状态与 API 使用同一组契约检查，样例记录来源及预期结果。 | FESOL-61/97/98/100；共享状态与组件集成。 | 当前样例不自动等于已评审契约；样例验收不替代真实数据验收。 | 待推进 |
| A05 | P0 | 验收钱包与账户状态 | FESOL-71 为 Todo，包含 SOL/USDC、签名访问、TP/SL 持仓、限价单、ALT 和 flags，阻塞多项验收。 | 准备只读账户样本及专用交易钱包；记录各场景余额、持仓、订单、准备和恢复方式，区分展示样本和可变交易状态。 | FESOL-61/65、56/19/59；余额刷新。 | 钱包所有者准备资金与签名访问；密钥仅放秘密配置，不写入对话、文档和报告。 | 待推进 |
| A06 | P0 | Agent 操作授权与入口 | 当前约定默认由用户手动完成 UI 测试、构建、部署、视觉验证和服务启动。 | 后续确认可自动执行的只读检查、测试、服务启动、浏览器操作；真实交易使用独立入口、预算与停止条件。 | 所有需求，尤其浏览器和交易验收。 | 需要用户确认长期约定；本文不改变任何已有授权。 | 待确认 |
| A07 | P1 | 需求与验收结果映射 | Linear 有验收条件及 FESOL-88～100 等切片，本轮未发现完整 Solana 自动验收映射。 | 每项记录验收条件、环境/数据、执行方式、证据和人工项；区分 passed、failed、blocked、not-run、partial。 | 所有需求；避免切片完成就误关父需求。 | 从选定需求渐进建立，不一次性给所有条目造测试。 | 待推进 |
| A08 | P1 | 本地 gmx-api 样例服务 | `LAUNCH_MODE=solana` 可提供样例路由，当前不需 EVM chain、数据库、RPC 或 subgraph。 | 复用现有入口，整理最小配置、健康检查和前端 host 指向；与 A04 的 reviewed samples 一致。 | FESOL-97/98/100。 | 是优先准备的本地服务；不需要启动完整 EVM API 栈。 | 待推进 |
| A09 | P1 | Solana 浏览器验收 | 已有 Playwright、fixture、只读账户、报告、截图、trace。regression 配置当前只接受 Arbitrum/Avalanche；funded runner 面向 Arbitrum。 | 在现有框架扩展网络选择、状态隔离、地址、余额及共享交易组件场景，复用诊断与报告。 | FESOL-42/48/90/96/97～100；flags 开/关；EVM 回归。 | 保留 EVM `chainId` 与独立 `networkId` 模型，不能只改 chainId。 | 待推进 |
| A10 | P1 | 真实钱包连接环境 | FESOL-42 为 Test，PR #3110 开放；要求 Phantom、Solflare、OKX、TokenPocket。现有回归未证明真实扩展与 Privy 完整兼容。 | 准备专用浏览器 profile、扩展和账户；检查连接、恢复、主动断开及 EVM/Solana 会话隔离，保留真实钱包兼容性验收。 | FESOL-42/6。 | 注入钱包不能单独证明四种真实钱包兼容；扩展测试需要适配持久化 Chromium 上下文。 | 待推进 |
| A11 | P1 | 数值正确性基准 | FESOL-57/64/65 要求与 gmsol 模型或链上 view 对比；ADR 指出已发布 SDK 的清算参数参考限制。 | 建立带源码/程序版本、账户、价格、时间和容差的参考向量；API 与前端 SDK 对同一输入核验。 | FESOL-92/57/64/65；精度、funding、borrowing、PnL、清算价。 | 两端相互比较不足以证明正确，需独立且已核实的基准。 | 待推进 |
| A12 | P1 | 交易生命周期证据 | 交易确认不等于 keeper 已执行；ADR 要求从关闭交易 CPI inner-instruction 数据读取 `OrderRemoved`，FESOL-94 跟踪解析。 | 关联模拟、发送签名、订单账户、执行/取消交易、原因、最终持仓和 API 刷新；明确各阶段超时。 | FESOL-20/56/59/94。 | simulation 只检查创建阶段；账户消失不能单独证明成交成功。 | 待推进 |
| A13 | P1 | 少量真实交易自动验收 | EVM funded runner 已有预算、锁、日志、恢复、清理，但不能直接覆盖 Solana。 | 复用机制增加 Solana 适配，先验证开仓→读取→平仓、限价创建→修改→取消；保存恢复记录并核验链上结果。 | FESOL-56/19/59。 | 依赖 RPC、keeper、API、钱包、flags、ALT 和明确授权；预算不能照搬 EVM。 | 待推进 |
| A14 | P1 | 预览版本与证据归档 | CI 已能定位精确 PR head 的 Cloudflare 预览并保存报告、截图、trace。 | 补充前端 SHA、API 版本、SDK/WASM hash、程序版本/部署 slot、网络、flags、数据模式和交易签名。 | 所有需求。 | 记录具体版本；变化的预览别名和共享站点不足以绑定交付版本。 | 待推进 |
| A15 | P2 | 可重置本地协议环境 | 已有 Anchor、`start-localnet`、`setup-localnet`。依赖 Geyser 插件、程序 `.so`、Redis 连接及 keeper 角色；本机未发现所需插件/产物，Solana、Anchor、Rust CLI 未在 PATH 中发现。 | 先验证单个有限场景：启动、准备账户/市场、执行一种订单、读取结果、重置；成功后再决定日常使用范围。 | 边界条件、失败状态、精度及订单流程。 | 有脚本不等于开箱可用；需配套 keeper 执行、oracle、流动性与前端配置。CLI 检查不证明整台机器绝对未安装工具。 | 待推进 |
| A16 | P2 | 历史与统计索引 | gmtrade-sqd 支持本地 Postgres、processor、GraphQL；Core Store 需 `SQD_PORTAL_API_KEY`，Core 与 GT 部署覆盖不同。 | 初期核实只读端点；相关需求实施时准备 replay 范围、索引进度检查和必要快照。 | Trades、Pools、Claims、Stats、GT 等后续范围。 | 不是首批市场/余额/下单验收的共同前置；Portal key/云权限由资源所有者配置。 | 待推进 |
| A17 | P2 | 可观察性、升级与容量 | FESOL-66/67 为 Backlog，要求域名、5xx、陈旧数据、RPC 指标、程序升级及负载成本核验。 | 提供只读日志/指标入口，区分服务存活、数据新鲜度和业务可用性；记录升级引起的不兼容。 | 数据陈旧、程序升级、限流和性能验收。 | ping 成功不等于业务可用；负载测试另行授权，不混入轻量预检。 | 待推进 |

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

| 顺序 | 交付物 | 对应清单 | 验收结果 |
| --- | --- | --- | --- |
| 1 | 环境与访问清单 | A01/A02/A03/A06 | 明确入口、访问条件、配置位置、负责人、版本和数据模式，解决或清楚标记访问阻碍。 |
| 2 | 统一只读预检 | A01/A02/A03 | 一次执行即可识别缺配置、403、错误网络、接口错误及陈旧数据；失败不得静默通过。 |
| 3 | 评审样例与本地 API 模式 | A04/A08 | 共享状态/组件验收可重复运行，报告明确为样例模式；不冒充真实数据验收。 |
| 4 | Solana 验收报告 | A07/A09/A14 | 从一条需求开始，绑定版本并列出通过、失败、未执行及证据。 |
| 5 | FESOL-71 测试资源 | A05，配合 A10/A12/A13 | 钱包、样本持仓/订单、ALT 和 flags 可用，为真实数据及交易闭环提供基础。 |

以上为建议顺序，不是新的 Linear 需求，也不授权修改现有需求。可先并行准备不依赖交易资金的资料，但服务开通、权限、凭据、资金等前置缺失时，暂停其依赖工作，等待资源所有者处理并确认可用；不擅自降级、替换服务或用模拟结果冒充真实验收。

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
