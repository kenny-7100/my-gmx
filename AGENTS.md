# Agent 协作入口

## 长期约定

- 中文沟通和协作文档；代码、注释、日志、commit、PR 和 review 内容使用英文，产品文案遵循既有本地化规范。
- Solana 接入 GMX 统一数据流，复用现有状态、计算、组件和交互，降低维护成本并保留 EVM 行为。旧前后端只作参考；主项目没有对应的新产品组件或行为不明确时先确认。详见[架构与参考仓库](docs/solana-reference-repositories.md)。
- `solana-integration` 是个人开发基础，主动新增的差异尽量限定于工具、知识和本地环境；业务能力只在需求分支实施。默认操作路径见[开发、回流与交付](docs/linear-development-workflow.md)。
- 已授权开发任务包含必要的建分支、worktree、普通提交、选择性 cherry-pick，以及适时将最新 release 合入个人基础、将已核实的基础设施沉淀回流个人基础。先检查现场；不覆盖未提交工作，不整支合入业务分支，不自动重写历史、强推或清理他人现场。常规维护自主完成，产品语义冲突或范围歧义再询问。
- 新任务、相关依赖变化和交付前，按上述流程主动核对上游、目标 Linear 和 PR；用到子仓库前按[按需更新规则](docs/solana-reference-repositories.md#子仓库按需核验与更新)核实相关远端，安全时主动更新，保留开发现场与版本固定。不轮询，不每轮全量调研，不修改 Linear，除非用户另有明确指令。
- 主动识别并沉淀可复用经验，先更新已有 docs 或项目 skill；按依据和失效条件维护经验，重复纠正/踩坑时修正原入口；本文件只保留稳定规则和索引。功能分支中的沉淀按内容独立提交并主动回流，不能只留在聊天或功能分支。见[知识维护](docs/documentation-maintenance.md)。
- 聚焦当前任务，保持改动渐进、便于验证；不顺带重构，不用推测性兜底、替代服务或模拟数据掩盖缺失条件。缺资源时说明用途与配置位置，暂停依赖项，继续独立工作；不暴露秘密或自行注册采购。

## 按需查阅

| 场景 | 入口 |
| --- | --- |
| 实施需求、回流沉淀、整理 PR | [交付 skill](.agents/skills/gmx-solana-task-delivery/SKILL.md)、[日常流程](docs/linear-development-workflow.md) |
| 开发与自审 | [编码规范](docs/coding-and-self-review.md)：按任务读取 gmx-prompts 开发、Solana、测试及 review 规范 |
| 本地运行、测试和排障 | [任务启动卡](docs/agent-task-start.md)，仅选择本次需要的入口 |
| Linear 单条/快照 | [查询 skill](.agents/skills/gmx-linear-requirements/SKILL.md)；GMTrade 标签属于旧项目，核对项目归属 |
| 推荐下一条需求 | [就绪核验 skill](.agents/skills/gmx-solana-next-task/SKILL.md)：核对 Linear、相关 PR 和实际代码 |
| 实际迁移进度 | [进度 skill](.agents/skills/gmx-solana-progress/SKILL.md)：区分现有需求与完整迁移两种口径，中英文简述 |
| 专题知识、历史记录 | [文档索引](docs/README.md)，历史状态不当作当前结论 |

## 操作边界

- 分析/查询只读；实施按任务授权执行上述常规维护。创建 PR 须有交付指令；保持 Draft，未经明确同意不转 Ready、请求 reviewer 或合并。上游 `origin` 只读；个人基础推送到 `my-gmx`，业务 PR 推送到正式 fork `my-gmx-pr`。
- 用户只说 `push` 时，直接将当前仓库全部改动 `git add .`、英文总结 commit、推送个人 remote HEAD；不插入测试、自审、回流或无关修改，不再次确认范围。当前登记的交付分支用 `my-gmx-pr`，其他主项目分支用 `my-gmx`；gmx-api 用 `my-gmx-api`，旧前端用 `my-gmt`，其他仓库用已有个人 remote，gmx-prompts 按原配置。命令失败时只处理具体阻碍。
- 本地 Vite、Chrome 及已授权任务的页面验收已有长期授权。构建（含 SDK）、其他服务启动仍按明确授权，不把已有产物缺失当作业务缺陷。部署、钱包签名、交易广播及外部写入需各自授权。
- 链上排障适合时优先本地 Solana CLI，先核对网络和账户，见[钱包与 CLI](docs/agent-wallet.md)。
