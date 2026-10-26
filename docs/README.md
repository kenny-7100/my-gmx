# 协作资料索引

后续 Agent 先阅读根目录 [AGENTS.md](../AGENTS.md)，再根据当前任务查阅以下资料。文档是查阅入口，易变状态仍需对照实际代码、配置及上游确认。

| 文档 | 适用场景 |
| --- | --- |
| [GMTrade 当前线上服务地址](gmtrade-live-services.md) | 当前正式 Web 后端 HTTP/WS、keeper GraphQL、SQD、RPC 与发布配置；线上行为/真实数据验收优先查阅 |
| [GMTrade 四页完整功能与依赖](../gmtrade-pages-dependency-audit.md) | 根目录完整六列表：Stake、GT My/Global/Buyback、Stats、Referrals 共 72 个功能/依赖分组；含当前启用分支、源码证据、线上只读核验和推进条件 |
| [GMX 当前线上服务地址](gmx-live-services.md) | 从真实线上页面请求核实各链 API、价格 keeper/fallback、SQD、Goldsky、RPC 与其他依赖，区分线上调用和发布脚本配置 |
| [Solana gmx-api 进度与联调协调](../solana-api-coordination.md)（[英文版](../solana-api-coordination.en.md)） | 待发送给负责人的沟通草稿：真实交易数据、联调节点、外部依赖及 FESOL-87 独立切片价值确认 |
| [Linear 需求开发与 PR 交付流程](linear-development-workflow.md) | 一需求一分支、开发与交付基础隔离；只读 delivery-check 核对提交来源与显式文件清单，支持独立目录、显式 HEAD/干净状态及前端、SDK、浏览器和 API 测试证据绑定；命名规范、Draft PR、自测表格及人工确认 |
| [Linear 需求查阅与复盘](linear-requirements.md) | FESOL 实时查询、全量快照、项目筛选和进度差异工具的配置、命令与验收记录 |
| [需求推荐与就绪核验](solana-next-task.md) | 综合 Linear、GitHub PR、最新上游代码和实际前置，推荐下一条迁移需求 |
| [Solana 迁移实际进度评估](solana-progress.md) | 跨仓库取证、去重与工作量估算，输出两个进度口径及中英文简述 |
| [Agent 验收基础设施调研与实施清单](agent-acceptance-infrastructure.md) | RPC、keeper、API、钱包等验收条件与实施记录；A01/A02 访问工具已完成；A09 首个本地网络选择冒烟及环境预检已通过真实验收；A03 仍待实际部署入口 |
| [Agent 需求验收映射](agent-acceptance-workflow.md) | A07：先映射需求条件，涉及现有行为/真实数据时先核对线上基线，再选择预检与验证；工作表模板、状态汇总规则及 FESOL-55 实例；新增 Markdown 工作表一致性检查，拒绝错误汇总与无效证据引用 |
| [真实 SDK/WASM 与基础数值向量](solana-sdk-vectors.md) | A11：离线执行真实固定 WASM，以独立 Python 参考值核对基础定点运算；不证明复杂业务数学或链上兼容 |
| [SDK 构建产物准备与过期检查](sdk-artifacts.md) | 根类型检查前只读 verify；显式隔离 prebuild/编译，成功后替换忽略的产物，保留来源收据与日志 |
| [前端源码离线测试](frontend-offline-tests.md) | 精确运行当前或独立 checkout 的 src/landing 原有单测，复用 Vite/happy-dom 初始化，隔离本机环境并阻止意外联网，运行器独立核对网络事件；单 suite 可进行源码断点调试，不启动应用服务或浏览器 |
| [SDK 源码离线回归](sdk-offline-tests.md) | 复用 SDK 原 Vitest 配置与目标目录测试运行器，支持独立交付 checkout 和锁文件身份，默认运行 BigInt、数值及费用原有测试；支持精确选文件、环境隔离、阻止意外联网及记录结果；单 suite 可启用 loopback 源码断点调试，共享进程组工具核实取消与清理，不需要 SDK 构建 |
| [Solana 统计索引只读预检](solana-index-preflight.md) | A16：核实实际 volume 索引的 GraphQL 契约、高度和最新事件年龄；不推断处理延迟或历史完整性 |
| [Solana 本地只读浏览器冒烟](solana-browser-smoke.md) | A09：`solana:browser-check` 一条命令完成预检、独立 Vite、真实 Chrome、独立报告和停服；支持独立功能 checkout 的目标 Vite 与源码/资源身份，复用网络选择/刷新持久化原有用例，保留手动运行和导航排障入口 |
| [Agent 本地 PR 预览定位](agent-preview.md) | A09/A14：复用 CI 解析器，从实时 PR head 定位成功部署的不可变 URL；不打开页面或执行 UI 测试 |
| [Agent 验收证据包](agent-evidence.md) | A07/A14：显式选取工具报告，可绑定并携带 Markdown 工作表，离线验证完整性、结论/统计及包外预期摘要；不推断业务验收通过或自动上传 |
| [Agent 统一只读预检](agent-preflight.md) | 按任务选择 RPC/keeper/样例 API/可选钱包检查，统一状态、退出码和本地版本证据；不自动启动服务；支持历史报告源码指纹离线比较 |
| [Solana SDK 与程序版本证据预检](solana-runtime-preflight.md) | A14：核对本地 SDK/WASM 完整性，记录 Mainnet 程序部署 slot、权限和完整程序区指纹；不构建或判断业务兼容 |
| [Solana Mainnet 交易回执证据](solana-transaction-evidence.md) | A12：显式签名查询 finalized 状态与完整回执，核对身份/结果并绑定源码与摘要；不推断 keeper 订单执行 |
| [Solana ALT 资源预检](solana-alt-preflight.md) | A05：现有 Mainnet 地址查找表的批量读取、生命周期、authority、完整地址与摘要；不创建或修改表 |
| [本地 Solana RPC 代理](../tools/solana-rpc-proxy/README.md) | 手动启动、前端与 Agent 调用、fallback key/Origin 转发、方法限制及验证边界 |
| [keeper 只读预检](keeper-preflight.md) | A02 真实价格、图表与开关预检；本地 `solanaTrading` 覆盖配置、环境边界及真实交易前置 |
| [本地 Agent 验收钱包](agent-wallet.md) | A05：助记词配置、固定 EVM/Solana 地址、Mainnet 原生 SOL 及 SPL/Token-2022 账户盘点与失败诊断；已通过自动测试和真实只读验收，Devnet 暂缓 |
| [Agent Solana 全栈联调工具](solana-dev-workspace.md) | 个人开发专用 API 代理路径、API/Vite/RPC 工作区管理、独立前端/API checkout 组合联调、显式 API inspector 与源码断点验收、目标身份诊断、浏览器 trace 关联及未评审样例结构回归；不新增业务消费、不随业务 PR 交付 |
| [本地 Solana API 样例验收服务](solana-api-local.md) | A08：持续服务、热更新与断点调试；`solana:api-debug` 自动核对源码映射、真实断点、变量与请求恢复；doctor/check、支持精确选文件、源码断点及所属进程清理的离线回归、TSOA 路由准备及隔离 PostgreSQL 集成测试、独立 API checkout 的通用模块测试、完整源码指纹、数据库源码断点、测试网络范围限制及所属进程/容器清理 |
| [Solana 迁移参考仓库](solana-reference-repositories.md) | 查找仓库用途、协议与 SDK 资料、ADR-0015 分支、版本注意事项和 remote 规则 |
| [旧 Solana 后端参考说明](gmtrade-web-backend-reference.md) | 旧后端源码快照的数据流、接口和缺失依赖；当前线上地址另见独立服务文档 |
| [文档维护约定](documentation-maintenance.md) | 主动沉淀协作知识，把环境排障经验提升为执行前置，维护索引及接手资料 |
| [编码与自审规范](coding-and-self-review.md) | 执行前核对检查范围、SDK 产物及构建内存；按任务查阅 gmx-prompts，执行编码、自审和跨仓库核验 |
| [自动化工具沉淀约定](automation-tools.md) | `yarn test:agent-tools` 统一离线回归；识别重复任务，复用和实现脚本、检查器等工具，记录验证结果和使用入口 |

## 项目 skill

项目 skill 提供按需执行入口，详细规则、证据和限制仍以主题文档为来源。可直接用名称调用，也可由 Agent 按请求匹配；仅说 `push` 不触发交付流程。

| Skill | 适用场景 | 详细资料 |
| --- | --- | --- |
| [gmx-linear-requirements](../.agents/skills/gmx-linear-requirements/SKILL.md) | 查询 FESOL、同步快照、复盘迁移进度，核对 GMTrade 标签 | [工具说明](linear-requirements.md) |
| [gmx-solana-next-task](../.agents/skills/gmx-solana-next-task/SKILL.md) | 核验需求、PR 和代码，比较并推荐下一条迁移需求 | [推荐流程](solana-next-task.md) |
| [gmx-solana-progress](../.agents/skills/gmx-solana-progress/SKILL.md) | 核验跨仓库实际成果，估算需求范围及完整迁移进度，输出中英文简述 | [评估方法](solana-progress.md) |
| [gmx-solana-task-delivery](../.agents/skills/gmx-solana-task-delivery/SKILL.md) | 按授权阶段开发需求、隔离交付改动、创建及审查 Draft PR | [交付流程](linear-development-workflow.md) |

Skill 放在仓库 `.agents/skills/` 中，属于个人开发基础，不进入业务 PR。首次真实交付后补充流程验收经验，不能把 skill 格式校验当成完整交付验收。若当前会话未显示新 skill，可在后续会话检查发现状态，必要时重新启动 Codex；入口文件仍可直接查阅。

新增主题文档时更新本表。优先查找并更新已有主题，避免为同一结论创建多份说明。
