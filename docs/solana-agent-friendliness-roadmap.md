# Solana 集成 Agent 友好度推进路线

更新日期：2026-10-27。

本文是 **Solana 集成专项** 的 Agent 基础设施推进表，不是整个 GMX Interface 项目的通用 Agent 平台规划，也不代表 Solana 业务迁移进度。后续实施应以真实需求暴露的问题为依据，优先完成高优先级事项，再根据实际阻塞更新本表。

用户已确认本阶段不考虑 CI 建设；实施聚焦让 Agent 后续开发、测试和验收更简单、快捷、正确。表中涉及 API 消费、parser 等业务接入的行随对应明确业务需求推进，不在基础设施任务中顺带实施。缺少资源或需用户确认的项可先跳过，优先完成具备条件的独立项。

当前判断：本项目已经具备较好的本地开发、局部测试、调试、测试范围发现、证据绑定和交付隔离能力；真实 Solana 业务验收仍受 API 部署身份、reviewed contract、真实数据样本、钱包连接和交易闭环限制。现有能力和边界见[Agent 验收基础设施调研与实施清单](agent-acceptance-infrastructure.md)及[Agent 需求验收映射](agent-acceptance-workflow.md)。

## 状态定义

| 状态 | 含义 |
| --- | --- |
| 待开始 | 尚未实施，或尚未形成可复用入口 |
| 实施中 | 已开始实施，尚未完成验收 |
| 已具备基础 | 已有部分工具或文档，但仍需补齐本表目标 |
| 待真实需求验证 | 工具和流程已有，尚未通过一条真实需求证明有效 |
| 受阻 | 缺少外部服务、权限、契约、账户或用户决策，不能继续依赖该条件的工作 |
| 部分完成 | 已完成部分范围，仍有明确未覆盖项 |
| 已完成 | 已达到本表定义的完成标准，并有可复核证据 |

## 推进表

| 优先级 | 工作项 | 要解决的问题 | 具体内容 | 完成标准 | 实施状态 | 实施备注 |
| --- | --- | --- | --- | --- | --- | --- |
| P0 | 一页式 Agent 任务启动卡 | 资料很多，新 Agent 需要在多个文档之间跳转，容易选错入口 | 按前端、SDK、API、页面验收、真实数据验收和交付分类，列出必读文档、命令、前置条件、报告和常见阻塞 | 新 Agent 只读启动卡即可知道下一步运行什么；复杂细节再跳转专题文档 | 已完成 | 2026-10-27：[启动卡](agent-task-start.md)已接入索引；16 个 CLI 帮助入口核对、10 个场景静态走查、链接/锚点和差异检查通过，见下方验收记录；未执行真实业务需求或远端环境验收 |
| P0 | 当前环境与依赖状态清单 | Agent 不容易区分代码已具备、环境已具备和线上资源已具备 | 建立机器可读且可人工阅读的状态文件，记录 Node/Yarn、Docker、Chrome、RPC、keeper、API、钱包、SDK/WASM、程序版本、样本和最后核验时间 | Agent 能区分 `ready`、`blocked`、`stale`、`not-checked`，减少重复排查和误判 | 已完成 | 2026-10-27：[环境清单](agent-environment.md)提供 `yarn agent:environment`；9 个本地项 ready、8 类外部资源 not-checked；6 个 CLI 场景、116 项工具回归、类型检查和前端单测通过，见下方记录；不代表真实环境或业务就绪 |
| P0 | 取得并固定真实 Solana API 部署身份 | 当前 A03 缺少实际 API 地址、版本和访问条件，无法做可靠远端验收 | 记录实际 API 地址、鉴权方式、部署 commit/image、数据模式、可用路由和核验时间 | Agent 能定位正确服务，并把请求结果绑定到明确部署版本 | 受阻 | 依赖 API 负责人提供实际部署入口和访问条件；不使用 sample 或猜测域名替代 |
| P0 | 固化 reviewed API contract | 当前 sample 只能验证结构，不能证明单位、精度、枚举和空状态语义 | 为市场、持仓、订单、费用和错误响应建立 reviewed schema/契约，注明金额单位、精度、地址、时间、缺失字段、空数组和错误语义 | Agent 能据此实现 parser、状态映射和验收条件；结构检查能升级为契约检查 | 受阻 | 依赖 FESOL-61、FESOL-97、FESOL-100 等契约评审结果 |
| P0 | 用一条真实需求完成全流程试运行 | 工具很多，但尚未证明新 Agent 能独立完成一次真实需求 | 走完 Linear → 代码 → 测试规划 → 本地/页面验收 → 工作表 → 证据包 → 独立交付检查 | 能记录 Agent 仍需用户补充的知识，并只修复真实暴露的问题 | 待真实需求验证 | 不预先为所有需求生成工作表；应选择依赖适中、范围明确的需求 |
| P0 | 需求条件到测试入口的结构化映射 | Agent 需要手工判断每个验收条件应该用哪种验证方式 | 为每项需求记录 `requirement → condition → test layer → command → evidence → uncovered reason` | 给定需求后能明确选择单元、SDK、API、浏览器、真实只读或人工检查 | 已具备基础 | 已有[验收映射流程](agent-acceptance-workflow.md)和 FESOL-55 实例，需在真实需求中复用和修正 |
| P1 | 证据包作为交付默认步骤 | `.local/acceptance` 中的原始结果默认不随仓库共享，交接时容易丢上下文 | 统一需求证据包目录和命令，包含工作表、原始报告、源码身份、命令、退出码、工具指纹、未覆盖项和包摘要 | 需求交付时有可移交证据包，其他 Agent 不依赖原执行机器的临时目录 | 部分完成 | 2026-10-27：[默认交付归档](linear-development-workflow.md#默认交付证据归档)与[交接步骤](agent-evidence.md#交付默认步骤)已接入；8 个 CLI 场景通过，复制包脱离临时输入可校验，partial 保留；日志等需包外单独移交，真实需求完整交付仍待验证，见下方记录 |
| P1 | 统一的本地任务预检入口 | RPC、keeper、wallet、browser、API 和 workspace 检查分散 | 按需求类型提供任务级检查，例如 `frontend-only`、`api-readonly`、`browser`、`transaction` | 开始任务前得到清晰的 `ready / blocked / stale` 结论，并定位阻塞资源 | 已具备基础 | `agent:preflight` 和 workspace doctor 已有基础；是否继续封装应由真实需求决定 |
| P1 | 统一本地运行版本矩阵 | README、`.nvmrc`、子项目和不同执行入口可能使用不同 Node 版本 | 明确 Node/Yarn、SDK/API checkout、Playwright/Chrome 和 Docker 的支持版本 | 不同 checkout 或机器不会因版本差异得到难以解释的结果 | 部分完成 | 2026-10-27：[运行版本矩阵](agent-runtime-matrix.md)已核对根/SDK/API 声明、工具前置和本机观察并接入执行入口；本轮文档范围已验收。根 Node 20/工具 Node 22、API README/配置 patch 差异未收敛；跨版本、跨系统和全新安装兼容性待验证；见下方记录 |
| P1 | 建立真实数据最小样本集 | 没有固定市场、账户、持仓、订单和空状态样本时，验收难以重复 | 准备脱敏且可重复的市场、账户、持仓、挂单、成交、错误和空结果样本，记录来源、时间、网络和版本 | Agent 能稳定验证金额、精度、枚举、排序、分页和空状态 | 部分完成 | 已有 sample 和钱包/只读预检；协议持仓、挂单等样本仍待准备，见 A05/A08 |
| P1 | 前端与本地 API 正式联调入口 | 当前 API sample 服务可运行，但前端尚未正式消费 Solana API | 沿用主项目统一数据流接入 API host、配置、parser、状态和组件 | Agent 能从本地 API 请求一路追到前端状态和组件 | 部分完成 | 当前工具明确不代表业务消费已实现；应随对应业务需求实施 |
| P1 | 失败诊断手册和错误分类 | 工具能报告失败，但新 Agent 仍可能需要从长日志判断下一步 | 按 configuration、dependency、network、contract、source identity、test failure、external resource 分类，给出检查顺序 | Agent 能快速决定修代码、重跑、补资源或标记 blocked | 已完成 | 2026-10-27：[失败诊断](agent-failure-diagnosis.md)覆盖 12 类特征、顺序、入口及停止条件；5 个真实前置拒绝场景及 SDK 产物只读核验符合预期，已接入启动卡、执行入口和索引；见下方记录。未执行真实业务或远端失败演练 |
| P2 | 真实钱包连接验收环境 | CLI 钱包工具不能证明页面钱包连接、拒签和断开行为 | 准备专用浏览器 profile、钱包扩展、连接/断开/拒签/网络切换场景 | 能验收真实钱包连接、恢复、拒签和会话隔离 | 待开始 | 依赖明确的钱包、账户和浏览器环境；不能用 CLI 地址检查替代 |
| P2 | 小规模 Solana 交易验收 runner | 当前有交易回执证据，但没有签名、发送、确认、恢复和清理闭环 | 在明确网络、钱包、预算、停止条件和恢复策略后，逐步支持模拟、签名、广播、确认、取消和清理 | 有完整交易证据；不确定状态可恢复或阻断，不重复广播 | 待开始 | 当前钱包工具和 RPC 代理不提供签名或写操作；依赖单独授权和真实资源 |
| P2 | 复杂协议数学独立基准 | 基础 WASM 向量不能证明 funding、borrowing、PnL 和清算价 | 使用独立模型、链上 view 或核实的程序版本生成基准，绑定输入、精度、版本和容差 | SDK、API、前端可分别与独立基准核对 | 部分完成 | 基础 WASM/定点向量已存在；复杂业务数学仍未完成，不能用两端互相比对替代 |
| P2 | 收敛长期文档和历史记录 | 当前信息完整，但历史实施记录和当前状态混在一起，首次接手成本较高 | 将资料区分为当前入口、历史证据、已知限制和待协调资源，对过期内容标注日期和状态 | Agent 默认只读当前状态，需要证据时再进入历史记录 | 已具备基础 | 先完成启动卡，再根据真实接手反馈收敛文档，不做无目标重写 |

## 使用规则

后续实施按优先级推进，但不要求机械完成所有 P0/P1 项。每次真实需求开始前，应先读取本表和[Agent 验收基础设施当前阶段与接手结论](agent-acceptance-infrastructure.md#当前阶段与接手结论2026-10-27)，再根据需求更新相关行的实施状态和实施备注。

实施备注至少记录：本次完成的范围、使用的入口、验证日期、证据位置、未覆盖项和下一步依赖。没有重新核验的历史事实不能因为编辑本表而标记为已完成。

不建议在没有真实需求阻塞的情况下继续增加通用包装工具。优先用一条真实需求验证现有流程，再将实际出现且可复用的问题沉淀为工具、检查器或文档入口。

## 启动卡实施与验收记录（2026-10-27）

本轮选择 P0 启动卡：无外部资源依赖，直接复用现有文档和工具；A03、契约评审及钱包交易资源相关项暂不实施。实施按“待开始 → 实施中 → 已完成”更新，仅修改文档和索引。未实施业务需求、修改业务代码、安装依赖、构建、启动服务、读取钱包或访问远端服务。

验收条件：覆盖前端、SDK、API、页面、真实只读、证据与交付入口；命令参数和目标目录与当前实现一致；明确发现、执行、预检及业务验收的证明边界；索引可发现、链接/锚点有效；差异仅包含本轮文档。

| 验收场景 | 从启动卡得到的路径与结论 | 结果 |
| --- | --- | --- |
| 纯文档任务 | 文档维护及链接/差异检查，不运行业务测试或构建 | passed |
| 已知前端 suite | 显式 project-dir/suite，读取原生结果和目标身份 | passed |
| SDK 变化 | SDK 自身发现加前端消费者规划，不用前端通过替代 SDK 验收 | passed |
| 前端/SDK 混合源码变化 | test-plan 后审阅依赖，再 test-run 显式 scope；原始单侧报告用于交付 | passed |
| 配置、资源或删除变化 | 人工评估范围，不将规划 blocked 或零测试解释为无需测试 | passed |
| API 计算与数据库测试 | API 自己的目录和基线；明确 offline/integration 区别、路由及 Docker 前置 | passed |
| 页面冒烟与联调 | 两项网络选择用例和 sample 代理分开，不能冒充完整业务页面验收 | passed |
| 真实 API/契约缺失 | 本地 api 预检是 sample；暂停依赖工作，协调真实资源 | passed |
| 证据整理 | 工作表检查加证据包；一致性/完整性不等于业务通过，忽略目录不自动共享 | passed |
| 干净业务交付 | 独立 checkout、显式身份/文件/报告，禁止混入个人基础；遵守 Git 授权 | passed |

以上为逐行对照当前脚本、CLI 帮助及专题文档的静态导航走查，不代表执行了这些业务测试，也不是新 Agent 完成真实需求的实战证明。“真实需求全流程试运行”继续保持待真实需求验证。

命令核验：从基础设施根目录执行下列 16 个入口的 `--help`，全部退出 0；未执行其业务动作：`frontend:test-offline`、`sdk:test-offline`、`agent:test-plan`、`agent:test-run`、`gmx-api:discover-tests`、`gmx-api:test-offline`、`gmx-api:test-integration`、`gmx-api:tscheck`、`solana:browser-check`、`agent:preflight`、`agent:acceptance`、`agent:evidence`、`agent:delivery-check`、`agent:preview`、`linear`、`solana:dev`。启动卡参数与帮助及实现一致。最终检查通过：3 份文档中的 73 处本地文件/章节链接、启动卡引用的 16 个 package scripts 均有效；`git diff --check` 及新文件空白检查通过。修改范围仅为启动卡、本文和文档索引。

## 失败诊断实施与验收记录（2026-10-27）

本轮选择已具备基础且不依赖外部资源的 P1 诊断手册：复用现有工具，把分散的错误解释归并为诊断顺序和专题跳转。状态按“已具备基础 → 实施中 → 已完成”更新。P0 环境状态清单仍为待开始，真实 API/契约和真实需求试运行状态未改变。

完成[失败诊断](agent-failure-diagnosis.md)，涵盖参数/路径、范围/覆盖、运行时依赖、SDK/路由产物、目标身份、离线网络、真实服务、契约语义、原生断言、中断/清理、证据和外部资源共 12 类；每类包含检查顺序、后续入口及停止条件。已接入启动卡、文档索引和编码执行入口；操作细节继续维护在原专题，未增加新诊断运行器。

| 本轮实际执行的命令（主仓库根目录） | 观察结果与诊断路径 | 验收结果 |
| --- | --- | --- |
| `yarn frontend:test-offline --suite ../outside.spec.ts` | 退出 1，`frontend-offline-prerequisite`，纠正前端相对路径 | passed（预期拒绝） |
| `yarn sdk:test-offline --suite ../outside.spec.ts` | 退出 1，`sdk-offline-prerequisite`，纠正 SDK 相对路径 | passed（预期拒绝） |
| `yarn gmx-api:test-offline --suite ../outside.test.ts` | 退出 1，`offline-test-prerequisite`，纠正 API src 测试路径 | passed（预期拒绝） |
| `yarn agent:test-run` | 退出 2，blocked，要求显式 scope；不能据此认为测试已执行 | passed（预期拒绝） |
| `yarn agent:preflight --checks unknown` | 退出 3，`configuration-or-evidence-error`，纠正检查项；未访问 RPC/keeper/API/wallet | passed（预期拒绝） |
| `yarn sdk:artifacts verify` | 退出 0，passed，550 个来源输入、1090 个产物；可复用当前产物，无需构建 | passed |

原始 stdout/stderr、摘要、时间、命令和退出码保存于本机忽略目录 `.local/acceptance/agent-tools/failure-diagnosis/`，汇总为 `report.json`；其他机器不保证有这些文件。前置拒绝演练前后核对前端、SDK、API 的验收目录，没有创建新的测试 run 目录。验收脚本只用于本轮收集结果，未沉淀为额外工具或测试框架。

其余错误分类通过当前脚本字段、错误码及专题文档静态核对，没有实际制造网络故障、进程残留、业务断言失败或契约漂移；对应历史验收不刷新为本轮实测。此处 passed 表示诊断手册及本轮预期拒绝行为符合验收条件，不表示业务需求通过。

本轮仅修改基础设施文档，未修改业务源码、测试、配置、依赖或 CI，未启动服务、浏览器、容器、构建、部署或读取钱包。最终文档检查通过：5 份改动文档中的 172 处本地链接/章节锚点有效，手册使用的 package script 存在，`git diff --check` 和新文件空白检查通过，完整修改范围仅为上述 5 份文档。检查结果保存在同目录 `document-check.json`；纯文档变更未运行类型检查或全量业务测试。


## 环境清单实施与验收记录（2026-10-27）

本轮选择 P0 当前环境与依赖状态清单：本地工具和依赖已有，不需要新增服务、凭据或业务接入。真实 API 部署、reviewed contract、钱包连接及交易闭环继续按原状态推进。状态按“待开始 → 实施中 → 已完成”更新；这里的完成指清单能力完成，不表示清单内所有资源已经 ready。

验收条件：提供机器可读且可人工阅读的 JSON；保留范围、时间、目标身份、状态和下一步；区分 ready/blocked/stale/not-checked；选定本地项的通过不能代表未核验资源或业务通过；参数错误和检查失败明确退出；不启动服务、安装、联网或读取秘密；具备可复用测试和文档入口。

完成 `yarn agent:environment`，默认盘点 Node/Yarn、前端/SDK/API 关键测试依赖、Chrome 可执行文件与 Playwright、Docker CLI、SDK 产物及本地 WASM。支持 `--checks` 按需选择，不强制每次任务执行全部检查。已接入文档索引、任务启动卡、编码执行入口和工具维护入口。具体检查边界和状态语义见[环境清单](agent-environment.md)。

| 验收项 | 本轮实际结果 |
| --- | --- |
| 默认盘点 | 退出 0，9 个本地项 ready，8 类外部资源 not-checked；前后输入身份一致 |
| 单项盘点 `--checks node` | 退出 0，仅 Node ready；其余本地及外部资源 not-checked |
| 非法选择 | unknown、重复 node、空值、wallet 各退出 1，固定配置错误，无原始异常泄露；共 6 个 CLI 场景均符合预期 |
| 状态和失败回归 | 新增 3 项表驱动测试，覆盖版本匹配/偏离、缺失/异常、blocked/stale、检查异常脱敏、输入变化、参数和退出码 |
| 统一工具回归 | `yarn test:agent-tools`：116/116 通过，无跳过 |
| SDK 产物前置 | `yarn sdk:artifacts verify`：通过，1090 个产物；未重新构建 |
| 工程检查 | `yarn tscheck` 退出 0；`yarn test:ci` 退出 0，299 个测试文件通过、1 个跳过，3014 项测试通过、1 项跳过；该命令是本地既有测试入口，未建设 CI |
| 格式和静态检查 | 新增脚本的 Prettier、ESLint 通过；6 份文档中 199 处本地链接/锚点、package 入口、空白及 `git diff --check` 通过，摘要见 `document-check.json` |
| 只读边界 | CLI 演练前后主仓库和嵌套 API Git 索引摘要一致；未安装、启动服务/浏览器/容器、连接 daemon、读取钱包或访问远端服务 |

本机实际观察：Node 22.17.0、Yarn 4.12.0、Playwright 1.58.2、Docker CLI 29.8.2、WASM 0.9.0-test.2。本地包与当前精确声明一致；这些是本次机器观察，不是支持版本矩阵，也没有调整 `.nvmrc` 或解决版本统一事项。

原始结果保存在本机忽略目录 `.local/acceptance/agent-tools/environment/`：`acceptance.json` 为 6 个 CLI 场景和索引不变摘要，`current.json`/`node-only.json` 为环境观察，`tools.tap`、`artifacts.json`、`types.log`、`frontend-tests.log` 为回归结果。其他机器不保证存在这些文件；历史 ready 不证明当前 ready，清单不能作为 `agent:delivery-check` 的测试执行报告。

本轮只改基础设施脚本、回归测试、package 命令和文档，没有修改业务源码、依赖版本、锁文件或 CI。真实 RPC/keeper/API、Docker daemon/镜像、钱包、程序版本和评审契约/样本仍需按需求单独核验；`environmentReadiness` 和 `requirementAcceptance` 固定为 not-evaluated。


## 运行版本矩阵实施与验收记录（2026-10-27）

本轮选择 P1 运行版本矩阵，跳过依赖外部部署、契约评审、真实账户或业务需求的事项。已完成的环境清单提供本机观察，本轮补齐这些版本的适用范围、来源和冲突处理顺序，不增加包装工具或修改业务代码。

实施状态按“待开始 → 实施中 → 部分完成”更新。本轮明确范围是文档矩阵、声明核实和导航接入，现已完成验收；路线表整体仍为部分完成，因为配置统一与跨环境兼容性尚未证明。没有将一台机器的检查通过解释为所有 Node patch、Chrome 或 Docker 版本均受支持。

验收条件：覆盖前端、SDK、API、Agent 工具、Yarn、Playwright/Chrome 和 Docker；逐项区分仓库声明、工具要求与本机观察并给出依据；明确 Node 20/22 及 API patch 差异、独立 checkout 前置和未验证范围；从启动卡、环境清单、执行入口和索引可发现；本地链接、命令及差异检查通过。

完成[运行版本矩阵](agent-runtime-matrix.md)。核实根 `.nvmrc`/README 声明 Node 20，前端/SDK/API 个人入口明确要求 major=22；SDK engines 为 >=18.0.0，不据此推断其开发工具链支持范围；嵌套 API engines 为 22.x、`.nvmrc` 为 v22.23.4、README 为 22.17.0。本轮保留原配置，仅明确不同来源和后续处理顺序。前端/SDK 的独立目标版本匹配检查与 API 自身依赖也分别说明。

| 验收项 | 本轮核验与结果 |
| --- | --- |
| 声明及实现依据 | 读取根/SDK/API package、锁文件存在性、各 `.nvmrc`/`.yarnrc.yml`，核对前端/SDK/API Node 检查、独立目录版本检查、Chrome channel/路径和 postgres:15 固定配置；passed |
| 本机状态 | `node scripts/agent-environment.mjs` 退出 0，9 个本地项 ready、8 类外部资源 not-checked，前后输入身份一致；passed |
| 版本观察 | Node 22.17.0、Yarn 4.12.0、Playwright 1.58.2、Docker CLI 29.8.2、WASM 0.9.0-test.2；关键包与声明一致，SDK 1090 个产物 verify 通过 |
| 范围与导航 | 启动卡、环境清单、编码执行入口和索引均链接矩阵；矩阵保留独立 checkout、服务前置、历史证据及配置未统一边界；passed |
| 文档与差异检查 | 6 份文档的 190 处本地链接/锚点、命令入口、空白和 `git diff --check` 通过；7 个入口 Node major 检查与矩阵描述一致 |

本机证据在忽略目录 `.local/acceptance/agent-tools/runtime-matrix/`：`environment.json` 为本轮环境观察，`validation.json` 为声明/实现与文档检查摘要。报告不是可移交的业务测试证据，也不代表新安装、Node 20、API 指定 patch 或跨系统验收。

本轮仅修改 6 份文档；未修改运行配置、package、锁文件、依赖、业务代码或 CI，未安装、构建、启动服务/浏览器/容器或访问真实资源。按纯文档规则未重复类型检查和业务测试。后续配置收敛应先明确候选运行时及受影响入口，再按实际需求验证，不在本轮扩展范围。


## 默认交付证据归档实施与验收记录（2026-10-27）

本轮选择 P1 证据包作为交付默认步骤，复用已有工具，补齐正式交付入口与接收要求，不新增归档器或实施业务需求。真实 API/契约、钱包/交易以及真实需求全流程事项继续保持原状态。路线状态按“已具备基础 → 实施中 → 部分完成”更新：本轮流程范围已完成验收，但尚未用真实需求证明完整材料移交有效，且当前打包器不收集任意原生测试/交付报告、日志和截图。

验收条件：交付流程默认包含冻结工作表、一致性检查、显式打包、包外摘要和接收验证；明确白名单、未入包产物及可用性；复制包在删除临时输入后仍能验证并保留 partial；错误摘要、篡改、额外文件均拒绝；导航、链接、命令及差异检查通过。

完成[证据包交付步骤](agent-evidence.md#交付默认步骤)，含命令模板、包外交接记录字段、原始产物清单及停止误判的边界。已接入交付流程、验收映射、任务启动卡和索引。只要求在获授权交付中准备材料，不自动上传、发消息、创建 PR 或改变仅 push 流程。

| 本轮实际 CLI 场景 | 预期与观察 | 结果 |
| --- | --- | --- |
| 历史 FESOL-55 工作表副本检查 | 退出 2；一致性 passed、需求结论 partial；未重查 Linear 或执行业务验收 | passed |
| 本地 runtime 指纹 | `--local-only` 退出 0；scope=local-artifacts，未访问链上程序 | passed |
| 显式打包工作表/检查报告/runtime | 退出 0；包内工作表 partial，包顶层 requirementAcceptance=not-evaluated；摘要独立计算一致 | passed |
| 删除临时输入，复制包至系统临时目录，从该目录 verify | 使用包外预先记录的摘要，退出 0、manifestIdentity=matched；报告原字节/时间与 partial 保留 | passed |
| 错误预期摘要 | 退出 1，无成功报告 | passed（预期拒绝） |
| 包内 runtime 文件增加字节 | 退出 1，无成功报告 | passed（预期拒绝） |
| 包内增加 extra.log | 退出 1，无成功报告 | passed（预期拒绝） |
| 恢复完整复制包 | 退出 0，matched | passed |

最终文档检查通过：6 份改动文档中 124 处本地链接/章节锚点有效，命令入口、交付导航、空白和 `git diff --check` 通过，结果保存于本轮 run 目录 `document-check.json`。

演练前后原始历史工作表和主仓库 Git 索引字节不变；只删除本轮创建的输入副本和临时接收目录，没有删除原产物。历史工作表引用的业务日志未移交，本轮只证明包内材料的可移植性，不声称接收者已取得所有历史证据。runtime 本地产物观察是本次执行，工作表中的业务观察仍是原日期。

本机证据位于忽略目录 `.local/acceptance/agent-tools/evidence-default/`；`latest.json` 定位本轮 run 目录。该目录中的 `acceptance.json` 保存 8 个场景的命令/退出码及只读边界，`handoff.json` 在包外记录摘要与“仅本地复制”状态，`package/` 保存完整包，各场景 stdout/stderr 单独保留。没有外部上传或实际跨机器移交，包外清单仍需在真实交付中实际携带对应产物。

本轮只修改 6 份文档，没有修改业务代码、工具实现、依赖、配置、锁文件或 CI；未启动服务、浏览器、容器、构建或访问钱包。按纯文档规则不重复类型检查或全量业务测试，没有新增永久测试框架。
