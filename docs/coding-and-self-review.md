# 编码与自审规范

核验日期：2026-10-24。编码与自我代码审查以本地 `gmx-prompts` 的相关规范为依据。本页提供入口和重点，不替代原文；后续工作应阅读当前版本及其引用资料。

## 执行前的环境检查与顺序

本节用于安排当前任务已获授权的检查，不要求每次任务运行所有命令。构建（含 SDK 构建）、UI 测试、浏览器、开发服务器和部署仍须遵循根 `AGENTS.md` 的授权边界；用户仅要求 `push` 时直接执行推送流程，不插入本节检查。纯文档修改只检查文档路径、链接及差异。

1. **先确定目标与范围。** 确认命令的工作目录、目标仓库和检查范围，再启动批量检查。主仓库含嵌套参考仓库，不能把它们当作前端测试或 TypeScript 配置的自动发现目标。
2. **根目录类型检查前，先确认 SDK 产物状态。** 若 SDK 源码或分支已变更、`sdk/build` 缺失，或无法确认上次成功构建对应当前源码，先处理 SDK 构建前置条件。已获构建授权时，在根目录执行一次 `yarn build-sdk`，成功后再执行 `yarn tscheck`；未获授权时说明该前置条件，不自行构建。当前源码已有有效产物时直接检查，不反复重建。
3. **完整前端构建前，先安排内存与执行顺序。** 已获完整构建授权且机器内存允许时，使用下方已验证的进程级内存配置；大型测试、类型检查和构建顺序执行，避免并发争用资源后再重跑。不修改全局 Node 配置，也不把提高内存当作处理所有构建失败的方法。
4. **失败后按已知特征诊断，再判断代码问题。** 对照下表核实原因，保留原始错误。处理前置条件后仍失败，应继续追踪真实代码或环境原因，不添加断言、虚假导出或兜底来压过错误。
5. **keeper 相关验收先检查真实依赖。** 开展已授权的价格展示、价格计算或 Solana 交易验收前，先按[keeper 只读预检](keeper-preflight.md)运行 `yarn keeper:preflight`。默认请求头已处理确认过的 User-Agent 访问差异；查看逐项价格与 flags 结果。用户已批准本地开发用 `VITE_APP_SOLANA_TRADING_OVERRIDE=true/false` 模拟开关，使用时在报告中注明；预检仍检查真实接口，`blocked` 不作为真实交易前置通过，不能因真实开关缺失阻挡已授权 mock 范围的开发。

完整前端构建命令（工作目录：主仓库根目录；仅在已获构建授权、机器资源允许时执行）：

```sh
NODE_OPTIONS=--max-old-space-size=8192 yarn build
```

| 触发条件或错误特征 | 优先检查与处理 | 已确认的边界 |
| --- | --- | --- |
| 根测试日志出现嵌套参考仓库路径，或 Vite 扫描旧前端并提示缺少 `@docusaurus/tsconfig` | 先核对 `vite.config.ts` 的测试发现范围和 `tsconfigPaths.projects`，确认当前分支包含范围修复；不要先安装旧仓库依赖 | 当前主仓库测试已限定到 `src`、`landing`，TypeScript 配置发现已显式限定主项目、landing、SDK；正常使用会直接受益，无需每次另做扫描 |
| 根类型检查出现 SDK 相关 `TS6305`、源代码中已有的导出却报 `TS2305`，或 SDK 类型字段与源码不一致 | 核对源码与 `sdk/build` 声明产物是否匹配；符合上述前置条件时先构建 SDK，再重跑类型检查 | 2026-10-24 验收中，更新忽略提交的 SDK 产物后完整类型检查通过；这些错误特征本身不等于已证明产物过期 |
| 完整前端构建在 chunk rendering 阶段出现 `Reached heap limit` / `JavaScript heap out of memory` | 核实 Node 进程堆限制及主机可用资源；资源允许时采用上述 8 GiB 配置，并避免与其他大型检查并发 | 本机默认约 4 GiB 堆构建失败，8 GiB 配置成功；这是本项目已验证配置，不保证其他机器或未来构建同样适用。其他报错按原始错误排查，不持续盲目加内存 |

同一任务中已完成且仍有效的准备工作应复用；源码、依赖、工具链或相关配置发生变化时，再判断哪些前置条件和检查失效。不要在每次小改动后重复整套准备。

以上经验来自 2026-10-24 的[本地 RPC 代理验收记录](agent-acceptance-infrastructure.md)；具体事实与验证边界保留在主题文档，本节维护影响后续执行顺序的通用步骤。

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
- 上游开发规范要求类型检查和单元测试；按改动执行适用检查并如实说明未运行项。UI 测试、构建、部署、浏览器及开发服务器仍按根 `AGENTS.md`，未经用户明确要求不自动执行。
- 上游提到的自动 pull、分支切换、向官方仓库推送等流程不能覆盖本地授权范围；使用当前工作区实际路径，遵守个人 `my-` remote 和直接 push 约定，不在 push 时插入自审或检查。
- 上游通用的回退建议不能覆盖 Solana 特定的数据来源约束，也不能成为添加推测性兜底的理由。
