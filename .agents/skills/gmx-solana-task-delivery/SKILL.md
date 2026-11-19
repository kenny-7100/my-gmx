---
name: gmx-solana-task-delivery
description: 实施明确的 GMX Solana 需求、回流个人基础设施经验或整理需求的 release Draft PR 时使用；管理任务现场和两条交付路径。仅查询需求或只要求 push 时不启用。
---

# 需求开发、沉淀回流与交付

遵守根 [AGENTS.md](../../../AGENTS.md)，具体操作只读[日常流程](../../../docs/linear-development-workflow.md)的当前阶段；已有分支用 register/rebind 接续，无需求编号用本地 task；已授权且需要多人分工时按[协作约定](../../../docs/agent-collaboration.md)统一接收成果；不把整套测试和证据工具作为每次任务前置。

- 新任务先实时核对目标 Linear、关键依赖 PR 和当前代码。按任务节点更新，不轮询、不每轮全量复盘；语义变化影响当前实现时才调整或澄清。
- 已授权开发包含适时同步 `origin/release` 到 `solana-integration`、创建需求 worktree 和普通提交。从个人基础调用最新版工具管理现场，status 恢复当前目标/决策/阻碍和权威目录、按需读取新知识；阶段变化时 note 简记，冲突经原生 Git 恢复后 recover 登记，见[上下文与恢复](../../../docs/linear-development-workflow.md#任务上下文与恢复)；保护未提交工作，冲突按语义处理，不自动 stash/reset/强推。
- 编码按 [gmx-interface-dev](../../../gmx-prompts/skills/gmx-interface-dev/SKILL.md)、[gmx-solana](../../../gmx-prompts/skills/gmx-solana/SKILL.md)，测试及自审按相关规范。个人基础不新增业务能力，保持统一数据流及 EVM 行为。
- 开始/恢复、选方案和最终自审按组件与契约读取个人基础的[相关 review 经验](../../../docs/review-lessons.md#按改动检索)，核对真实消费者、有效反例及历史修复保护的行为；review 修复、用户纠正、自审或排障确认新判断时，按[日常维护](../../../docs/review-lessons.md#日常增量维护)主动更新原经验与 issue，不等用户提醒、不全量扫描历史 PR。
- 每个经手 issue 先检索既有知识，阶段性记录工作/问题/处理与结论，包含关联及他人 issue 的重要调研，按[固定 issue 入口](../../../docs/issues/README.md)更新并在暂停/交付/结束前检查遗漏与回流，不能只留在本机 note。业务与基础设施独立提交，通用知识更新已有 docs/skill，选择性 backflow 到个人基础；混合配置按内容拆分。禁止整支业务分支合入个人基础。
- 所有新 commit（包括本地、个人基础及 merge/cherry-pick）显式使用 GPG 签名并核验；签名失败保留现场排查，不免签、不关闭签名。交付前核对 PR 全部提交的 GPG 验证状态。
- 获交付指令后，fetch 最新 release，只转入本需求业务提交；在实际目标验证最终 diff/历史及相关行为。缺未合并业务依赖时如实说明，不捎带其他需求。复杂证据绑定和归档见[可选严格检查](../../../docs/agent-delivery-evidence.md)，普通需求默认不打包。
- 分支重建（包括 release 交付、PR 来源迁移和补签）保留原有 commit 拆分、message 与适用的 merge 拓扑，不聚合提交，除非用户当次明确要求；只有父节点未变且有效签名的提交可原样保留，需重建的提交逐个 GPG 签名，核对 tree/message/parent 映射与最终内容。用户授权的历史重建先备份旧 head，已有上游分支仅用绑定旧 SHA 的 force-with-lease 更新。
- 个人基础用 my-gmx，业务交付分支推送上游 origin，在上游仓库内向 release 创建 Draft PR，不使用 fork PR。PR 英文 Summary、Linear URL、真实 Validation，保持 Draft；未经同意不转 Ready 或请求 reviewer。PR 后修复先在已有、基于 solana-integration 的需求 development 分支实施并验收，再将明确的业务修复提交选择性转入现有 delivery，按交付目录实际差异复验并推送同一 Draft PR；不将整个开发分支合入 delivery，不在两处独立修改同一修复。仅有 delivery 而无原开发现场时先核实现有任务结构，不为套流程重建分支。经验优先在个人基础记录。
- 个人知识/工具切片收尾时，按[沉淀收尾与自动推送](../../../docs/documentation-maintenance.md#沉淀收尾与自动推送)完成提交、必要回流和 my-gmx 推送，不等用户提醒；backflow 成功不代表远端已保存，不因此扩大业务分支或 PR 发布授权。
- 简短交接任务/分支/工作区、回流及推送状态、验证与 PR；受阻说明停在哪一步，不把本机历史状态当实时事实。只要求 push 时直接遵循根规则，不插入本流程。
