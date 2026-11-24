# 编码与自审规范

规则整理：2026-11-12；历史环境核验日期见对应专题。编码与自我代码审查以本地 `gmx-prompts` 的相关规范为依据。本页提供入口和重点，不替代原文；后续工作应阅读当前版本及其引用资料。

日常执行与复用见[任务启动卡](agent-task-start.md#执行与复用)；按当前开发、自审或测试场景读取下方相关规范。

## 查阅入口

| 工作 | 必读资料 |
| --- | --- |
| 前端及 SDK 开发 | [gmx-interface-dev](../gmx-prompts/skills/gmx-interface-dev/SKILL.md)、[项目概览](../gmx-prompts/docs/gmx-interface/main.md)、[编码规范](../gmx-prompts/docs/gmx-interface/code-guidelines.md)、[UI 风格](../gmx-prompts/docs/gmx-interface/style-guidlines.md) |
| 前端及 SDK 自审 | [gmx-interface-review](../gmx-prompts/skills/gmx-interface-review/SKILL.md)、[审查标准与实例](../gmx-prompts/skills/gmx-interface-review/references/review-rules.md) |
| Solana 集成 | [gmx-solana](../gmx-prompts/skills/gmx-solana/SKILL.md)，结合开发、自审规范及 ADR-0015 |
| 测试编写及审查 | [测试准入标准](../gmx-prompts/docs/testing.md)、[gmx-tests](../gmx-prompts/skills/gmx-tests/SKILL.md) |
| API 审查 | [gmx-api-review](../gmx-prompts/skills/gmx-api-review/SKILL.md) 及其引用细则 |
| 大型或高风险改动交接 | [审查导航](../gmx-prompts/skills/gmx-interface-review/references/reviewer-map.md) |
| SDK/API 兼容性及发布顺序 | [交付流程](../gmx-prompts/docs/onboarding/release-process.md) |

## 编码重点

- 遵守 `sdk → config → lib → domain → components → pages` 单向依赖及绝对导入。SDK 不依赖 React 或浏览器 API；业务计算和交易逻辑放在 domain/SDK，组件负责展示和交互。
- 复用既有组件、工具和状态模式。遵循类型、显式 `undefined`、对象参数、Storage、错误处理和定时器等原文约定，避免重复实现、无效断言、魔法值、无用注释及无关格式改动。
- 金额运算保留 BigInt 和正确精度，核对舍入方向及分母为零的情况；不要先转 Number 再计算。错误使用现有 `lib/errors` 体系，用户可见文案使用 Lingui。
- Solana 网络代码放在 `lib/solana`，协议代码放在 `domain/gmsol`，静态配置放在 `config/gmsol`；遵守动态加载和导入边界。不得复制 UI、把 Solana 代币注册进 SDK 的 EVM 列表，或将 20 位精度直接传入共享逻辑。
- `solanaNetwork` 关闭时不加载或执行 Solana 功能；发送交易前重新检查 `solanaTrading`。地址保留 base58 大小写，区分原生 SOL 与 WSOL。数据、价格、钱包所有者和 RPC 的来源按 Solana 原文约定。

选方案和编码前按组件、契约及状态 owner 检索[当前 review 经验](review-lessons.md#按改动检索)，只读取相关条目。调整 filter、guard、mapper、cache、fallback 或 Hook 时使用条目的反例核对真实消费者与全链行为；重要取舍记在原 issue，不要求逐条阅读打卡。

## 自审方法

1. 确定真实 diff、比较基线及风险等级（T0–T3），阅读调用方和上下文，不只看修改片段；不把配置改动自动视为无风险。
2. 优先检查正确性、安全、资金及真实行为，再检查符合项目规范的代码质量。涉及资金、签名或认证时补充安全检查。
3. 对 T2 及以上的 React 状态、Hook、Effect 改动单独检查生命周期：成功、失败、超时、拒绝、卸载；确保状态复位，失败处理只影响对应项。
4. 对 T3、大型或高风险 diff 分别扫描全部除法、交易及授权步骤、守卫及分支覆盖、值的语义（单位、精度、地址大小写、新鲜度、原生与包装资产等）。可以逐项顺序审查，不假定存在通用审查工具。
5. 涉及集成边界时，核对对应 API、SDK、程序、IDL 和索引 schema，并区分仓库源码与真实部署。适用时只读核对所有受影响网络的端点；无法验证则明确保留验证缺口，不把源码存在当成已部署。
6. 对照本任务适用的[历史经验](review-lessons.md)，核查最终组合是否撤销已有修复、是否保留 EVM/共享调用方行为，以及验证输入是否真能区分错误。发现可复用判断时按[日常维护](review-lessons.md#日常增量维护)主动更新，避免只修当前代码。
7. 对每个疑似问题尝试反证，追踪实际可达路径和用户影响；去除误报、重复问题、纯偏好和格式噪音。报告提供位置、触发条件、后果和具体修复建议，避免宣称审查覆盖完整。

审查结论在对用户的回复中用中文；提交到 PR 的标题、正文和审查评论用英文。自审不等于获准向外部 PR 发布评论。

## Review 经验的学习范围

用户于 2026-11-15 明确：Kenny（用户本人）、Sulliven、Rainer 是负责 Solana 迁移前端的小组。经验学习优先关注 Kenny、Sulliven、Rainer、Divhead 四人提交的 PR，阅读这些 PR 的相关 review、作者回复、修复及最终取舍；不只看 Kenny 的 PR，也不只收集 Divhead 发出的评论。查询时先核实显示名对应的 GitHub 账号，不猜测账号拼写。

目标是将小组共享经历中可复用的架构、实现、测试及交付判断用于 Kenny 后续开发和提 PR，使成果逐步更符合项目及 Divhead 的要求。其他成员的 PR 在涉及相同组件、契约、规范或迁移依赖时也可参考，按关联性选择，不默认全仓库等权扫描。持续学习指在相关任务和 review 节点主动吸收并应用，不意味着后台监听或自动发布评论。

当前执行入口为[Review 经验与开发判断](review-lessons.md)：已接入开发、恢复、自审、review 修复和日常知识维护。四人关键 PR、threads、源码与 Linear 可见性边界见[历史深挖调查](review-learning-investigation-2026-11-15.md)。下方首次调查仅覆盖 Kenny，是改造前的局部历史证据。

## Review 反馈吸收现状核验（2026-11-15）

本次是流程调查，不是重新审查业务代码或实施改造。核对当前个人基础、开发/交付/知识入口，以及本人 9 个 PR（#3068、#3082、#3111、#3190、#3201、#3258、#3259、#3261、#3262）的实时 inline comments 和 reviews；未读取全部 issue comments、resolved thread 状态或历史 Agent 会话，不据此判断每次自审实际覆盖程度。

- `gmx-prompts@72041619ae` 经 fetch 确认与当时 origin/main 一致。上游已有团队 review 实例、测试准入、合并结果、runtime 和跨仓库检查；不是没有规范。skill 引用的 `notes/work/review-scorecard.md` 在本地 checkout 不存在，其召回率只能作为上游自述，不能当作本项目实测指标。
- 个人基础已有按 issue 记录和跨 issue 经验回流要求，但本次检索未找到面向本人 review 反馈的统一检索入口，也没有明确将已确认评论按适用条件送回下一次开发/自审的具体步骤。不能仅凭文档增长认定形成了反馈闭环。
- FESOL-15/#3201 有明确修复回复和后续回归修复，但本次调查前没有 `docs/issues/FESOL-15.md`；FESOL-49/#3111、FESOL-70/#3068 也没有对应固定入口。其他专题已有部分架构经验和交付经验，不能说完全未吸收；旧任务也不能因后来新增的记录规则被追认为当时违规。
- [#3068 worker 检查](https://github.com/gmx-io/gmx-interface/pull/3068#discussion_r4259921377)及 [bootstrap 缺失时静默缩小检查范围](https://github.com/gmx-io/gmx-interface/pull/3068#discussion_r4259921402)：审核保护机制要验证反例能失败，并覆盖实际构建入口。
- [#3111 市场遗漏](https://github.com/gmx-io/gmx-interface/pull/3111#discussion_r4330399528)：参考项目列表不证明当前链上范围完整；[该次 review](https://github.com/gmx-io/gmx-interface/pull/3111#pullrequestreview-5591831439)同时明确区分四项修改要求与三项待 reviewer 决策，后续 twin-link 方案也发生修正。不能把全部评论计作作者缺陷或把最早方案固化成长期要求。
- [#3201 图标](https://github.com/gmx-io/gmx-interface/pull/3201#discussion_r4483355252)：沿用现有资源命名扩展机制；[无效测试](https://github.com/gmx-io/gmx-interface/pull/3201#discussion_r4483355273)：没有目标 guard 也通过的测试不证明防护有效；[修复引入 EVM 回归](https://github.com/gmx-io/gmx-interface/pull/3201#discussion_r4519631690)：共享 setter 的 Solana 限制必须保留 identity normalization 的其他用途。详见 [FESOL-15](issues/FESOL-15.md)。

结论：存在“反馈已修复或留档，但跨任务检索、提炼和再次应用不足”的流程缺口；现有样本不足以证明同类问题发生率没有下降，也不能证明每个 PR 都收到很多意见。#3190 和四个较新 Draft 在本轮读取的两个 review 接口中均无记录，#3082 仅有空正文 review。没有重放初始 PR 或历史自审，不能断言某条具体评论本可被当时 Agent 发现。

调查时提出的改造建议（现已按[当前经验流程](review-lessons.md)实施文档与入口接入，实际效果待后续任务检验）：复用 issue 与本页入口，保存评论依据、最终处理和适用条件；把可复用判断接入开发及最终 diff 自审，区分已在上游覆盖的规则、待明确决策和新增经验；用后续同类改动是否再次漏掉来检验效果，不按评论条数评分。本次只保存调查结论，不新增强制门禁、监听服务或修改上游 skill。

## 测试与本地流程边界

- 测试按行为筛选：组合或边界足够多，且涉及风险或共享契约时才随代码交付；已发生的生产问题保留针对性回归测试。避免只验证 mock 调用、实现镜像、快照和不必要测试框架。
- 优先真实配置与编解码器，mock 数据源和必要副作用；使用真实业务输入、表驱动和结果断言，清理临时测试。具体预算、例外与 mock 规则以测试规范原文为准。
- 上游开发规范的类型与测试要求按下方[测试范围与执行确认](#测试范围与执行确认)落实；通用的“完成前跑tscheck/test:ci”不等于每次执行全量。本地页面验收与本仓库开发验证所需构建（含 SDK/WASM）沿用根 `AGENTS.md` 的长期授权；UI 使用用户已打开的浏览器。其他服务、部署、签名和广播按各自授权执行。
- 上游提到的自动 pull、分支切换、向官方仓库推送等流程不能覆盖本地授权范围；使用当前工作区实际路径，遵守个人 `my-` remote 和直接 push 约定，不在 push 时插入自审或检查。
- 上游通用的回退建议不能覆盖 Solana 特定的数据来源约束，也不能成为添加推测性兜底的理由。

## 测试范围与执行确认

用户于2026-11-24明确：保持正确性，按影响智能选择最小但足够的验证范围；全量执行前先确认。此约定适用于业务、SDK、API及Agent工具，也适用于修复、合并冲突、同步下游和最终交付；不新建测试计划文档或增加固定审批步骤。

| 改动与风险 | 默认选择 |
| --- | --- |
| 纯文档、注释或无运行行为变化 | 本次链接、diff或适用静态检查，不跑业务测试 |
| 单个行为、局部修复、纯测试冲突 | 能暴露原错误的既有单个用例或文件；需要时覆盖相邻反例 |
| 共享函数、状态、交易契约或多个消费者 | 沿调用关系选择相关文件/用例集合，覆盖受影响入口与关键边界；资金风险提高反例质量，不自动等于全量 |
| 测试运行器、全局配置、广泛依赖变化，或无法可靠收窄的影响 | 先做低成本检查定位影响；有具体证据需要全量时，提出范围并等待确认 |

- 选择依据是实际diff、调用方、契约、失败模式和已有有效结果，不只按文件数量或“更保险”。已知测试直接运行；不确定才用既有发现/规划工具，避免为选测试引入比测试本身更重的流程。运行前简述范围及理由即可，局部测试自主执行，不要求逐项确认。类型检查、lint、构建也按影响和有效结果选择，不每次固定组合执行。
- **全量确认**：Agent主动执行整个前端/SDK/API/工具套件，或通过拆批累计运行整个套件前，说明为何局部不足、涉及哪些目录/套件、预计耗时/资源（未知则明说），给出可行的局部替代方案并等待用户确认。普通“修复/验收/交付”授权和历史全量成功不算本轮全量授权；用户已明确要求全量或已批准相同范围时直接执行，不重复询问。扩大范围或改为逐个下游全量需另说明并确认。
- **先发现再扩大**：配置/runner修改先核对解析后的配置、测试收集、项目归属及重复项，再跑代表性用例。失败先区分业务、测试隔离、环境和报告发布问题；修复后优先重跑失败及受影响集合。仍在已批准范围内、且新失败/改动证明必要的全量重跑可继续，说明原因；不因提交、改SHA或报告发布失败重复全量。
- **多目标复用**：同步development/delivery/TRD-136/playground前比较实际源码、依赖、配置、工具链及环境，复用有效共同结果，在实际目标做差异与关键组合检查。不因目录或HEAD不同就各跑完整套件，也不将源目录结果写成下游实际执行；记录“复用哪些、目标执行哪些、未验哪些”。
- **门禁与CI**：保留真实必需的上游/发布门禁。局部不足以满足门禁时，完成可独立工作后说明剩余项，按上述规则确认全量，不擅自降级为已验收。正常授权push/PR触发的既有自动CI可以运行并复用，不为此增加一次确认；Agent主动手工触发、重跑全量CI仍遵守确认规则。不关闭或修改CI绕过检查。
- 所选有效检查通过且无新改动、失败或未解风险时推进；报告准确列出实际范围、复用依据和未运行项，不把零匹配、跳过、局部通过当作完整通过。

## 执行前的环境检查与顺序

先按[任务启动卡](agent-task-start.md#执行与复用)确定目标、范围和最短验证路径；已有有效准备直接复用，失败时按[诊断入口](agent-failure-diagnosis.md)定位。下表只在当前任务触发对应场景时查阅具体操作，不逐项执行。

| 当前场景 | 操作与详细入口 |
| --- | --- |
| 目标运行时或依赖未知 | [版本矩阵](agent-runtime-matrix.md)、[目标环境](agent-environment.md#实际目标目录检查)；只检查需要的环境，独立 checkout 核对自身锁定依赖 |
| 根类型检查或 SDK 产物消费者 | 先 `yarn sdk:artifacts verify`；缺失/过期且获授权才构建，再运行相关检查，见[SDK 产物](sdk-artifacts.md) |
| 前端/SDK/API 局部测试 | 已知 suite 直接运行；未知范围才发现/规划，见[前端](frontend-offline-tests.md)、[SDK](sdk-offline-tests.md)、[API](solana-api-local.md)、[联合规划](agent-test-plan.md)；源码纯计算不先构建或启动无关服务 |
| Agent 工具修改 | 独立工具选择单项回归；跨工具共享能力或整体验收用[统一回归](automation-tools.md#统一离线工具回归)；纯文档只检查链接与差异 |
| 页面或前后端联调 | [浏览器](solana-browser-smoke.md)、[工作区](solana-dev-workspace.md)、[API](solana-api-local.md)；选择一次性验收或持续服务，管理入口已包含的预检不再单独执行；断点按需启用 |
| 真实服务、价格或链上资源 | 按需求选择[线上核验](agent-acceptance-workflow.md#线上行为与数据核验)、[keeper](keeper-preflight.md)、[钱包](agent-wallet.md)、[ALT](solana-alt-preflight.md)、[回执](solana-transaction-evidence.md)、[索引](solana-index-preflight.md)；多通道可用[统一预检](agent-preflight.md)，不重复检查同一依赖 |
| SDK/程序兼容或数学验收 | [版本指纹](solana-runtime-preflight.md)、[真实 WASM 向量](solana-sdk-vectors.md)；基础通过不等于复杂计算、链上兼容或业务通过 |
| 远端 API 或 PR 页面验收 | 先核对[实际部署资源](agent-acceptance-infrastructure.md#待协调资源与-a03-验收门槛)或[不可变预览身份](agent-preview.md)，不以 sample、旧成功部署替代 |
| 构建、报错或清理失败 | Node/Vite 构建默认命令级 `NODE_OPTIONS=--max-old-space-size=8192`（用户于2026-11-13明确），大型构建串行；其他故障按[失败诊断](agent-failure-diagnosis.md)与本次日志处理，只清理所属资源 |
| 最终交付或原始证据移交 | 普通任务按[最短交付路径](linear-development-workflow.md#最短交付路径)；复杂任务或明确要求时使用[严格检查](agent-delivery-evidence.md)、[工作表](agent-acceptance-workflow.md)、[证据包](agent-evidence.md) |

运行器的目标身份、源码/工具一致性、网络审计、退出与清理要求按所选专题执行；不能为提速跳过其有效性检查。构建、服务与外部操作沿用根授权。专项细节只维护在上述专题，新增经验按触发条件加入对应入口。
