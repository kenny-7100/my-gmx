# 协作资料索引

后续 Agent 先阅读根目录 [AGENTS.md](../AGENTS.md)，再根据当前任务查阅以下资料。文档是查阅入口，易变状态仍需对照实际代码、配置及上游确认。

| 文档 | 适用场景 |
| --- | --- |
| [Linear 需求开发与 PR 交付流程](linear-development-workflow.md) | 一需求一分支、开发与交付基础隔离、命名规范、Draft PR、自测表格及人工确认 |
| [Linear 需求查阅与复盘](linear-requirements.md) | FESOL 实时查询、全量快照、项目筛选和进度差异工具的配置、命令与验收记录 |
| [需求推荐与就绪核验](solana-next-task.md) | 综合 Linear、GitHub PR、最新上游代码和实际前置，推荐下一条迁移需求 |
| [Solana 迁移实际进度评估](solana-progress.md) | 跨仓库取证、去重与工作量估算，输出两个进度口径及中英文简述 |
| [Agent 验收基础设施调研与实施清单](agent-acceptance-infrastructure.md) | RPC、keeper、API、钱包、样例、本地链和自动验收的现状、优先级、资源前置及逐项实施记录 |
| [本地 Solana RPC 代理](../tools/solana-rpc-proxy/README.md) | 手动启动、前端与 Agent 调用、fallback key/Origin 转发、方法限制及验证边界 |
| [Solana 迁移参考仓库](solana-reference-repositories.md) | 查找仓库用途、协议与 SDK 资料、ADR-0015 分支、版本注意事项和 remote 规则 |
| [旧 Solana 后端参考说明](gmtrade-web-backend-reference.md) | 查阅源码快照的结构、数据流、接口、精度及缺失依赖，理解其与 GMX 目标架构的区别 |
| [文档维护约定](documentation-maintenance.md) | 主动沉淀协作知识，维护索引，编写便于后续 Agent 接手的资料 |
| [编码与自审规范](coding-and-self-review.md) | 按任务查阅 gmx-prompts，执行编码、自审、测试筛选和跨仓库核验 |
| [自动化工具沉淀约定](automation-tools.md) | 识别重复任务，复用和实现脚本、检查器等工具，记录验证结果和使用入口 |

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
