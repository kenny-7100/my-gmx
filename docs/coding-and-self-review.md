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

## 自审方法

1. 确定真实 diff、比较基线及风险等级（T0–T3），阅读调用方和上下文，不只看修改片段；不把配置改动自动视为无风险。
2. 优先检查正确性、安全、资金及真实行为，再检查符合项目规范的代码质量。涉及资金、签名或认证时补充安全检查。
3. 对 T2 及以上的 React 状态、Hook、Effect 改动单独检查生命周期：成功、失败、超时、拒绝、卸载；确保状态复位，失败处理只影响对应项。
4. 对 T3、大型或高风险 diff 分别扫描全部除法、交易及授权步骤、守卫及分支覆盖、值的语义（单位、精度、地址大小写、新鲜度、原生与包装资产等）。可以逐项顺序审查，不假定存在通用审查工具。
5. 涉及集成边界时，核对对应 API、SDK、程序、IDL 和索引 schema，并区分仓库源码与真实部署。适用时只读核对所有受影响网络的端点；无法验证则明确保留验证缺口，不把源码存在当成已部署。
6. 对每个疑似问题尝试反证，追踪实际可达路径和用户影响；去除误报、重复问题、纯偏好和格式噪音。报告提供位置、触发条件、后果和具体修复建议，避免宣称审查覆盖完整。

审查结论在对用户的回复中用中文；提交到 PR 的标题、正文和审查评论用英文。自审不等于获准向外部 PR 发布评论。

## 测试与本地流程边界

- 测试按行为筛选：组合或边界足够多，且涉及风险或共享契约时才随代码交付；已发生的生产问题保留针对性回归测试。避免只验证 mock 调用、实现镜像、快照和不必要测试框架。
- 优先真实配置与编解码器，mock 数据源和必要副作用；使用真实业务输入、表驱动和结果断言，清理临时测试。具体预算、例外与 mock 规则以测试规范原文为准。
- 上游开发规范要求类型检查和单元测试；按改动执行适用检查并如实说明未运行项。本地 Vite/Chrome 与当前已授权任务所需的页面验收已有长期授权；构建、部署及其他服务仍按根 `AGENTS.md` 的独立授权执行。
- 上游提到的自动 pull、分支切换、向官方仓库推送等流程不能覆盖本地授权范围；使用当前工作区实际路径，遵守个人 `my-` remote 和直接 push 约定，不在 push 时插入自审或检查。
- 上游通用的回退建议不能覆盖 Solana 特定的数据来源约束，也不能成为添加推测性兜底的理由。

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
| 完整构建、报错或清理失败 | 按[失败诊断](agent-failure-diagnosis.md)与本次日志处理；大型构建/测试避免资源争用，只清理所属资源 |
| 最终交付或原始证据移交 | 普通任务按[最短交付路径](linear-development-workflow.md#最短交付路径)；复杂任务或明确要求时使用[严格检查](agent-delivery-evidence.md)、[工作表](agent-acceptance-workflow.md)、[证据包](agent-evidence.md) |

运行器的目标身份、源码/工具一致性、网络审计、退出与清理要求按所选专题执行；不能为提速跳过其有效性检查。构建、服务与外部操作沿用根授权。专项细节只维护在上述专题，新增经验按触发条件加入对应入口。
