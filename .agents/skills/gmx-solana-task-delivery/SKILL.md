---
name: gmx-solana-task-delivery
description: 实施明确的 GMX Solana 需求、回流个人基础设施经验或整理需求的 release Draft PR 时使用；管理任务现场和两条交付路径。仅查询需求或只要求 push 时不启用。
---

# 需求开发、沉淀回流与交付

遵守根 [AGENTS.md](../../../AGENTS.md)，具体操作只读[日常流程](../../../docs/linear-development-workflow.md)的当前阶段；已有分支用 register/rebind 接续，无需求编号用本地 task；已授权且需要多人分工时按[协作约定](../../../docs/agent-collaboration.md)统一接收成果；不把整套测试和证据工具作为每次任务前置。

- 新任务先实时核对目标 Linear、关键依赖 PR 和当前代码。按任务节点更新，不轮询、不每轮全量复盘；语义变化影响当前实现时才调整或澄清。
- 已授权开发包含适时同步 `origin/release` 到 `solana-integration`、创建需求 worktree 和普通提交。从个人基础调用最新版工具管理现场，status 恢复当前目标/决策/阻碍和权威目录、按需读取新知识；阶段变化时 note 简记，冲突经原生 Git 恢复后 recover 登记，见[上下文与恢复](../../../docs/linear-development-workflow.md#任务上下文与恢复)；保护未提交工作，冲突按语义处理，不自动 stash/reset/强推。
- 编码按 [gmx-interface-dev](../../../gmx-prompts/skills/gmx-interface-dev/SKILL.md)、[gmx-solana](../../../gmx-prompts/skills/gmx-solana/SKILL.md)，测试及自审按相关规范。个人基础不新增业务能力，保持统一数据流及 EVM 行为。
- 业务与基础设施独立提交，确认的知识主动更新已有 docs/skill，选择性 backflow 到个人基础；混合配置按内容拆分。禁止整支业务分支合入个人基础。
- 获交付指令后，fetch 最新 release，只转入本需求业务提交；在实际目标验证最终 diff/历史及相关行为。缺未合并业务依赖时如实说明，不捎带其他需求。复杂证据绑定和归档见[可选严格检查](../../../docs/agent-delivery-evidence.md)，普通需求默认不打包。
- 个人基础用 my-gmx，业务 PR 用正式 fork my-gmx-pr。PR 英文 Summary、Linear URL、真实 Validation，保持 Draft；未经同意不转 Ready 或请求 reviewer。PR 后只在登记的 delivery 工作区继续业务修复，经验优先在个人基础记录。
- 简短交接任务/分支/工作区、回流状态、验证与 PR；不把本机历史状态当实时事实。只要求 push 时直接遵循根规则，不插入本流程。
