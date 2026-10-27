# Agent 验收基础设施调研与实施清单

## 当前阶段与接手结论（2026-10-27）

**开发与局部验收基础设施已经可用，可以进入真实需求使用阶段；Solana 端到端业务验收仍未完整就绪。** 这是根据本分支已完成的工程与隔离副本验收作出的阶段判断，不是 Solana 迁移完成度评估，也不是实时外部服务就绪声明。本次文档整理未重新查询 Linear、GitHub 或远端服务。

用户已确认的长期边界：本分支用于个人开发基础设施，不改各项目业务逻辑；功能分支可基于它开发，但最终业务 PR 必须基于最新 `origin/release`，只包含该需求改动。工具完成不代表对应业务需求完成，不把本地 sample、测试发现或环境预检当作真实业务验收。

### 已完成且可使用的能力

| 环节 | 当前能力与入口 | 已验证范围与边界 |
| --- | --- | --- |
| 理解项目与协作 | [文档索引](README.md)、[编码与自审](coding-and-self-review.md)、[参考仓库用途](solana-reference-repositories.md)及需求查阅流程 | 提供统一架构、开发规则与查阅入口；易变需求及上游状态仍需实时核对 |
| 隔离交付 | [分支与 PR 流程](linear-development-workflow.md)、`agent:delivery-check` | 独立 checkout、提交来源/显式文件范围及干净状态检查；可绑定实际测试证据，不能替代人工内容审查 |
| 本地运行与调试 | [全栈工作区](solana-dev-workspace.md)、[API 本地入口](solana-api-local.md)、[浏览器冒烟](solana-browser-smoke.md) | 已验证独立 checkout、所属/借用服务管理、源码断点、请求 trace 和指定浏览器用例；sample 服务不等于真实业务环境 |
| 测试选择与规划 | [前端离线测试](frontend-offline-tests.md)、[SDK 离线回归](sdk-offline-tests.md)、[联合规划](agent-test-plan.md) | 按源码或 Git 范围发现真实依赖；支持 SDK 自身与前端消费者联合清单、只发现模式；不保证动态依赖或完整业务覆盖 |
| 局部实际执行 | [按规划执行](agent-test-plan.md#按规划执行明确范围)、API 离线/隔离数据库入口 | 显式选择 SDK/前端/两侧，拒绝过期规划，保留原生结果；所选 suite 有外部依赖时仍会失败，不自动跳过或关闭保护 |
| 产物与证据复核 | [SDK 产物来源](sdk-artifacts.md)、API 路由准备、[证据包](agent-evidence.md)及交付绑定 | 核对来源、源码/工具/目标身份、网络事件、退出与清理；发现、规划、执行和业务验收分别判定，不互相替代 |
| Solana 只读前置 | [RPC 代理](../tools/solana-rpc-proxy/README.md)、[keeper 预检](keeper-preflight.md)，以及钱包、SDK/WASM 向量、程序版本、ALT、交易回执等主题入口 | 已有读取和诊断工具；使用前按任务核实当前资源，工具通过不代表可交易或 keeper 流程完成 |

最近几轮已形成“源码/Git 变化 → 两侧测试发现 → 显式选择执行 → 原始结果 → 交付证据复核”的开发验证链路。该链路当轮记录的已推送提交为 `944abffc91`（`Execute selected regression scopes from validated test plans`），位于个人 `my-gmx/solana-integration`；这是历史基线，不是当前最新 HEAD，也不表示已交付上游。后续基础设施状态见[推进路线](solana-agent-friendliness-roadmap.md)，历史验收按需查[实施记录](solana-agent-friendliness-history.md)。

### 已完成验证与实际限制

截至上述提交，最近一轮工程检查为：Agent 工具回归 113 项通过，SDK 产物只读核验和根类型检查通过；完整前端回归 299 个文件 / 3,014 项通过，另有既有跳过 1 个文件 / 1 项。规划执行在独立 release 副本实际运行 SDK Stats 7 项、前端日期 5 项；双侧/单侧执行、断言失败汇总，以及源码、暂存范围、工具过期和原始发现清单不符等拒绝场景均已验证。详细证据及本机忽略目录入口见[联合规划与执行的验收记录](agent-test-plan.md#本轮验收)。这些是历史验证结果，不能自动作为未来业务提交的验收证据；原始本机日志不随仓库共享。

已有两个实战限制，不应再通过增加包装入口掩盖：

- SDK Stats 源码在真实依赖图中关联到 178 个前端测试文件；此前串行离线执行触及 180 秒上限，期间也出现一项原 oracleKeeperFetcher 测试断言失败。只发现模式可列出范围，但没有把该关联组改写为测试通过，详见[前端测试边界](frontend-offline-tests.md)。
- SDK BigMath 源码关联到 35 个 SDK 测试文件，包含尝试真实 RPC 的 Accounts 测试。离线保护器按预期拒绝，不能因为自动选中就认定可离线运行，详见[SDK 测试边界](sdk-offline-tests.md)。

Agent 仍需根据需求判断实际测试范围、外部依赖、页面/真实数据验证和失败原因。准确发现范围与如实拒绝误报已经具备；验收方法选择是否足够有效，仍需真实需求验证。

### 尚未完整解决的条件

| 条件 | 当前判断 | 下一次推进的要求 |
| --- | --- | --- |
| 真实 Solana API 部署身份、版本与访问条件（A03） | 既有协调缺口保留，本次未重新核验 | 先查下方“待协调资源与 A03 验收门槛”及 [API 联调协调](../solana-api-coordination.md)，取得实际入口和版本依据，再做远端验收；不猜 URL 或用 sample 替代 |
| 评审后的业务契约与真实数据消费 | 本地样例结构检查仍不能证明金额单位、枚举、空状态和跨字段语义正确 | 在对应业务需求中确认契约、复用主项目架构实现并验收；不为基础设施补业务接入 |
| 可重复的协议/交易端到端环境 | 只读前置和诊断能力已具备，完整业务闭环尚未因此通过 | 按具体需求落实账户、资金、协议状态、服务及授权；缺资源时明确协调，不签名或广播来绕过条件 |
| 新 Agent 从需求到交付的实际效率 | 文档和工具已具备，尚未以一次完整真实需求证明全流程接手体验 | 在真实任务中观察是否仍需用户补充仓库本应提供的知识，按具体阻碍修复 |

### 下一阶段建议与完成标准

**建议暂停无明确使用缺口的通用工具扩展，优先用一条依赖明确、范围适中的真实需求验证现有体系。** 这是下一阶段建议，不是已选择或授权实施某条业务需求；不在本次文档任务中推荐具体 Linear 条目。需要选需求时按[需求推荐与就绪核验](solana-next-task.md)实时核验。

一次真实需求的验证应满足：

1. 从实时需求及现有代码确认验收条件，Agent 能根据索引找到所需资料，减少用户重复补充操作知识。
2. 保留主项目架构和统一数据流，选择与需求对应的单元、页面或真实服务验收，明确未覆盖项；不以默认测试通过代替需求验收。
3. 缺少服务、权限、凭据或协议资源时准确说明协调项，不降级、换源或模拟来冒充真实验收。
4. 最终交付基于最新 `origin/release`，范围干净、不混入个人基础设施，按既定流程形成含英文自测结果的 Draft PR。
5. 只将真实任务中出现、可复用且影响推进的问题沉淀为工具或执行入口，不为增加工具数量继续包装现有能力。

本节为带观察日期的阶段摘要；后续能力及状态增量见[推进路线](solana-agent-friendliness-roadmap.md)。A01–A17 的原调研与实施证据已移至[历史归档](agent-acceptance-infrastructure-history.md)，下方保留旧章节导航以兼容既有链接，日常接手无需逐条阅读。历史日期、服务状态和当时授权不能代替当前核验，具体操作授权以根 `AGENTS.md` 和当前用户指令为准。

## 当前执行入口与授权边界

用户已于 2026-10-25 长期授权后续任务启动本地 Vite 和 Chrome，以及已授权任务所需的本地页面验收，无需重复确认。构建（含 SDK）、其他服务及部署仍按各自授权；钱包签名、广播与外部写入不在该授权内。以根 [AGENTS.md](../AGENTS.md) 为准，历史待授权记录不覆盖此规则。

- 任务开始先读[启动卡](agent-task-start.md)，按[执行前检查顺序](coding-and-self-review.md#执行前的环境检查与顺序)准备所需环境，不机械执行全部预检。
- A01 读取/模拟通道的运行、连通性与方法白名单见[RPC 代理说明](../tools/solana-rpc-proxy/README.md)；供应商权限、配额和真实连通性仍按本次任务核实，不代表业务 client 或交易已连通。
- A02 工具与真实开关分别判定，见[keeper 只读预检](keeper-preflight.md)；本地 `VITE_APP_SOLANA_TRADING_OVERRIDE` 只用于显式开发覆盖，不证明真实交易开关就绪。
- A09 已有本地网络选择真实冒烟历史结果；本次需要页面验收时用[浏览器入口](solana-browser-smoke.md)，钱包、余额、交易及远端预览仍需对应资源与验收，不沿用旧 passed 作为新提交证据。

## 待协调资源与 A03 验收门槛

既有 A03 缺口仍按受阻跟踪，本次仅整理文档，未重新查询 Linear、部署 PR、API 或负责人。请 API 部署负责人（既有记录为 FESOL-62 的 Divhead，使用前核对）提供实际 api-solana `run.app` URL、访问方式，以及部署提交/镜像/记录；敏感配置只写本地，不在对话或文档中暴露。

| 验收项 | 资源齐备后的通过条件 | 当前协作状态（非实时探测） |
| --- | --- | --- |
| 目标与访问 | 请求确认的实际 HTTPS 入口，记录访问方式与核验时间 | 受阻：仍缺实际入口与访问条件 |
| 接口与错误 | 按确认的部署契约检查目标接口、参数、404 和错误语义；HTTP 200 不单独算通过 | 未执行；先确认目标部署契约 |
| CORS | 对实际前端 Origin 核对响应及预检头；CLI 成功不能替代浏览器验收 | 未执行；Origin 随环境确认 |
| 版本与数据模式 | 用部署记录、镜像或既有机制关联源码并区分 sample/真实数据；不从 pong 推断版本 | 受阻：缺部署依据 |
| 失败与证据 | 记录时间、来源、版本依据和逐项状态；不可达、拒绝、契约不符或版本未知不误报通过 | 未执行 |
| 完成边界 | 样例部署通过只完成对应阶段，不关闭 reviewed contract、真实业务或交易就绪项 | 边界已明确，实际验收待执行 |

依据根 `AGENTS.md` 通用要求 11，缺资源时暂停依赖工作，不猜域名、不换服务、不用本地 sample 或旧服务冒充真实部署验收。reviewed contract、协议账户/订单样本、真实钱包及签名广播边界等其他缺口继续见上方条件表和[路线表](solana-agent-friendliness-roadmap.md)，不在基础设施维护中补业务实现。

## 历史章节导航

以下标题保留原锚点，正文仅按需进入归档。原建设清单的编号、状态、服务结果和候选顺序均属于原日期，当前推进以本页阶段结论与路线表为准。

## 历史调研与实施记录

见[原日期记录](agent-acceptance-infrastructure-history.md#历史调研与实施记录)。

## 目标与结论

见[原日期记录](agent-acceptance-infrastructure-history.md#目标与结论)。

## 调研范围与证据边界

见[原日期记录](agent-acceptance-infrastructure-history.md#调研范围与证据边界)。

## 建设清单

见[原日期记录](agent-acceptance-infrastructure-history.md#建设清单)。

## RPC 与 keeper 范围复核（2026-10-24）

见[原日期记录](agent-acceptance-infrastructure-history.md#rpc-与-keeper-范围复核2026-10-24)。

## A01 已批准的本地代理方案与实施状态

见[原日期记录](agent-acceptance-infrastructure-history.md#a01-已批准的本地代理方案与实施状态)。

## 工具与服务选项

见[原日期记录](agent-acceptance-infrastructure-history.md#工具与服务选项)。

## 建议第一批推进顺序

见[原日期记录](agent-acceptance-infrastructure-history.md#建议第一批推进顺序)。

### A02 工具已完成；本地开发可覆盖开关

见[原日期记录](agent-acceptance-infrastructure-history.md#a02-工具已完成本地开发可覆盖开关)。

## 后续逐项实施与维护

见[原日期记录](agent-acceptance-infrastructure-history.md#后续逐项实施与维护)。

## A05 ALT 资源验收记录（2026-10-25）

见[原日期记录](agent-acceptance-infrastructure-history.md#a05-alt-资源验收记录2026-10-25)。

## A14 SDK 与程序证据验收记录（2026-10-25）

见[原日期记录](agent-acceptance-infrastructure-history.md#a14-sdk-与程序证据验收记录2026-10-25)。

## 统一预检验收记录（2026-10-25）

见[原日期记录](agent-acceptance-infrastructure-history.md#统一预检验收记录2026-10-25)。

## 证据与查阅入口

见[原日期记录](agent-acceptance-infrastructure-history.md#证据与查阅入口)。

## A08 本轮实施进度（2026-10-25）

见[原日期记录](agent-acceptance-infrastructure-history.md#a08-本轮实施进度2026-10-25)。

## 统一只读预检本轮进度（2026-10-25）

见[原日期记录](agent-acceptance-infrastructure-history.md#统一只读预检本轮进度2026-10-25)。

## A05 Mainnet 代币账户盘点进度（2026-10-25）

见[原日期记录](agent-acceptance-infrastructure-history.md#a05-mainnet-代币账户盘点进度2026-10-25)。

## A14 本地 SDK 与链上程序证据进度（2026-10-25）

见[原日期记录](agent-acceptance-infrastructure-history.md#a14-本地-sdk-与链上程序证据进度2026-10-25)。

## A05 ALT 资源预检进度（2026-10-25）

见[原日期记录](agent-acceptance-infrastructure-history.md#a05-alt-资源预检进度2026-10-25)。

## A07 需求验收映射进度（2026-10-25）

见[原日期记录](agent-acceptance-infrastructure-history.md#a07-需求验收映射进度2026-10-25)。

## A12 Mainnet 交易回执证据进度（2026-10-25）

见[原日期记录](agent-acceptance-infrastructure-history.md#a12-mainnet-交易回执证据进度2026-10-25)。

## A14 可移交证据包进度（2026-10-25）

见[原日期记录](agent-acceptance-infrastructure-history.md#a14-可移交证据包进度2026-10-25)。

## A09/A14 本地 PR 预览入口进度（2026-10-25）

见[原日期记录](agent-acceptance-infrastructure-history.md#a09a14-本地-pr-预览入口进度2026-10-25)。

## A16 Solana 统计索引只读预检进度（2026-10-25）

见[原日期记录](agent-acceptance-infrastructure-history.md#a16-solana-统计索引只读预检进度2026-10-25)。

## A11 真实 WASM 与基础数值向量进度（2026-10-25）

见[原日期记录](agent-acceptance-infrastructure-history.md#a11-真实-wasm-与基础数值向量进度2026-10-25)。

## 下一步就绪复核与 A03 协调（2026-10-25）

当前接手先读[资源与验收门槛](#待协调资源与-a03-验收门槛)，以下仅供历史追溯。

见[原日期记录](agent-acceptance-infrastructure-history.md#下一步就绪复核与-a03-协调2026-10-25)。

### A03 最小交付与验收条件

当前接手先读[资源与验收门槛](#待协调资源与-a03-验收门槛)，以下仅供历史追溯。

见[原日期记录](agent-acceptance-infrastructure-history.md#a03-最小交付与验收条件)。

## A07 工作表自动一致性检查进度（2026-10-25）

见[原日期记录](agent-acceptance-infrastructure-history.md#a07-工作表自动一致性检查进度2026-10-25)。

## A07/A14 工作表与检查报告移交进度（2026-10-25）

见[原日期记录](agent-acceptance-infrastructure-history.md#a07a14-工作表与检查报告移交进度2026-10-25)。

## A14 接收侧预期摘要校验进度（2026-10-25）

见[原日期记录](agent-acceptance-infrastructure-history.md#a14-接收侧预期摘要校验进度2026-10-25)。

## A14 历史预检源码复用判定进度（2026-10-25）

见[原日期记录](agent-acceptance-infrastructure-history.md#a14-历史预检源码复用判定进度2026-10-25)。

## A09 首个本地只读浏览器冒烟进度（2026-10-25）

见[原日期记录](agent-acceptance-infrastructure-history.md#a09-首个本地只读浏览器冒烟进度2026-10-25)。

## A09 浏览器验收环境预检进度（2026-10-25）

见[原日期记录](agent-acceptance-infrastructure-history.md#a09-浏览器验收环境预检进度2026-10-25)。

## 下一轮就绪决策（2026-10-25 07:47）

见[原日期记录](agent-acceptance-infrastructure-history.md#下一轮就绪决策2026-10-25-0747)。

### A09 本轮选定的验收条件

见[原日期记录](agent-acceptance-infrastructure-history.md#a09-本轮选定的验收条件)。

## A09 本地只读页面真实验收进度（2026-10-25）

见[原日期记录](agent-acceptance-infrastructure-history.md#a09-本地只读页面真实验收进度2026-10-25)。
