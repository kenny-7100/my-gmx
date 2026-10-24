---
name: gmx-linear-requirements
description: 查询 FESOL 单条需求、同步需求快照或复盘 GMX Solana 迁移进度时使用，复用本仓库只读 Linear 工具并区分 GMTrade 旧项目需求。不用于修改 Linear 或执行开发交付。
---

# FESOL 需求查询与复盘

先遵守仓库根目录 [AGENTS.md](../../../AGENTS.md)，按当前请求选择下面的模式。脚本和命令均相对于仓库根目录；不受当前 shell 工作目录影响的调用方式见[工具说明](../../../docs/linear-requirements.md)。不要复制脚本实现或另建同步工具。

## 单条需求

- 查当前需求或为实施核对需求时，运行 `node scripts/linear-requirements.mjs show FESOL-编号 --live --json`，读取正文、父任务、双向关系及评论。用户明确查历史时，使用 `--snapshot PATH` 离线读取并标明时间。
- 区分需求原文、当前状态、验收条件和待澄清事项；需要精确项目或标签判断时使用 JSON 字段，不仅看文本摘要。
- 解释阻塞方向：`relations` 的 `blocks` 是当前任务阻塞 `relatedIssue`；`inverseRelations` 的 `blocks` 是 `issue` 阻塞当前任务。
- 输出需求编号及线上链接、抓取时间、范围、关键验收条件与阻碍。查询请求不授权修改代码或 Linear。

## 全量复盘与历史比较

- 当前整体进度先运行 `node scripts/linear-requirements.mjs sync`；用户要求历史分析时不必刷新，以指定快照为准。
- 从 `.local/linear/FESOL/latest.json` 找到最新快照及同目录中文摘要。用 `list --project migration --json` 获取迁移项目范围，必要时添加 `--status` 或 `--search`。筛选参数含义和输出结构见工具说明。
- 同时检查 `labels.nodes` 和项目归属。`GMTrade` 标签属于仍在迭代的旧 `gmx-solana-interface`，只供参考，不计入迁移需求与进度。项目与标签冲突时先澄清；不能直接照抄按项目统计的摘要作为最终迁移统计。工具目前没有标签筛选参数，不编造 `--label` 参数。
- 比较两次快照用 `node scripts/linear-requirements.mjs diff BEFORE.json AFTER.json --project migration --json`，解释新增、离开范围及字段变化；若存在标签导致的范围变化，结合两份快照核对后再报告。
- 报告抓取时间、范围及排除依据、状态分布和关键变化，给出快照/摘要路径。团队总数不是迁移完成率分母，Done 也不是代码已合入或已部署的证明；评估实际完成情况另核对提交、PR 和部署证据。

## 失败与覆盖边界

在线工具从环境变量或根 `.env.local` 读取 `LINEAR_API_KEY`；不要输出密钥或执行配置文件。缺少凭据、权限或需用户开通的资源时，暂停依赖工作，只说明配置位置和所需操作。同步失败明确报告，不把旧快照当作本次成功结果。

快照含正文和元数据，关系与评论需实时查询；附件内容、关联文档未下载，标签子连接未单独分页。按需阅读工具说明中的覆盖边界；不能声称已完整备份 Linear。只读 GraphQL 和本地快照写入不授权任何线上修改。
