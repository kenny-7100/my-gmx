---
name: gmx-solana-task-delivery
description: 在本仓库实施明确的 Linear Solana 迁移需求、整理交付分支、创建或审查该需求的 Draft PR 时使用。管理个人开发基础与上游交付的隔离；单纯查询需求或仅要求 push 时不启用交付流程。
---

# Solana 需求开发与交付

先遵守根目录 [AGENTS.md](../../../AGENTS.md)。本 skill 按用户授权的阶段执行，不因加载而自动完成所有阶段。规范、命名、PR 示例及人工确认边界以[交付流程](../../../docs/linear-development-workflow.md)为详细来源；任务不明确时先澄清。

## 需求与开发

1. 实施前实时读取目标 Linear 需求，按 [需求查询 skill](../gmx-linear-requirements/SKILL.md) 核对正文、验收条件、依赖及标签。带 `GMTrade` 标签的旧项目前端需求不能自动转为本次迁移任务。
2. 明确要求开发并获准创建需求分支时，从 `solana-integration` 创建一需求一分支；采用 `english-description-fesol-89` 形式。仅分析请求不创建分支或修改文件。
3. 编码参考本地 [gmx-interface-dev](../../../gmx-prompts/skills/gmx-interface-dev/SKILL.md) 和 [gmx-solana](../../../gmx-prompts/skills/gmx-solana/SKILL.md)，按入口读取当前任务涉及的细则；测试遵循 [gmx-tests](../../../gmx-prompts/skills/gmx-tests/SKILL.md)。坚持现有 GMX 架构和统一数据流，不能直接搬迁旧前端或旧后端体系。
4. 记录真实验证结果及待用户手动验证项。commit 使用英文动作描述并附需求编号，例如 `Add network-scoped Solana wallet balances FESOL-89`。命名已整理在交付流程中，无需每次重新研究历史 PR。

## 整理交付基础

仅在用户授权交付整理时执行相应 Git 写操作。

- `solana-integration` 是用户自定义开发基础，由用户自行同步上游；不得将其整体合并进交付分支，也不得自动更新它。
- 交付前获取最新 `origin/release`。优先从该提交建立干净分支或独立 worktree，只转入目标需求的提交或补丁；保留开发现场，核对混合文件中的每项内容。具体方式按实际提交结构选择，不执行未经授权的历史重写或强推。
- 检查 `git log origin/release..HEAD` 及 `git diff origin/release...HEAD` 的完整内容和文件范围，确认交付分支基于该上游提交且没有个人基础历史或无关改动。仅修改 PR base 或普通 rebase 不构成隔离验证。
- 本地 `.agents/skills/`、协作文档和工具属于个人开发基础，不自动进入业务 PR。不能只靠文件排除名单证明改动干净，还要检查源码内容和依赖。
- 缺少尚未合入 release 的其他需求依赖时暂停交付并向用户确认顺序，不捎带其他需求或推测性兜底。在最终干净基础上重新验证受影响行为；UI、构建、部署及浏览器操作仍需遵守根 AGENTS。

## Draft PR 与审查

- 用户授权提出 PR 时，推送至个人 `my-gmx`，向 `gmx-io/gmx-interface` 的 `release` 创建跨仓库 Draft PR。不要推送 `origin`。
- 英文标题以大写 Linear 编号结尾。英文正文包含具体问题与结果的 Summary、完整 Linear URL、英文自测结果表格，以及适用的兼容性、部署后事项、功能开关和默认值。使用交付流程中的示例结构，表格只能填写真实结果，未执行项明确标明 Pending 或 Not run。
- 提出后按 [gmx-interface-review](../../../gmx-prompts/skills/gmx-interface-review/SKILL.md) 及其引用规则审查最终 PR 状态，以 `release` 为实际基线；Solana 同时参照 Solana 规范。需要的工具若不可用，明确报告缺口，不伪称已执行，也不把 skill 当成同名 shell 命令。
- 用户介入判断审查结果和修复方向；配合修复并更新验证证据、PR 正文。用户明确同意前保持 Draft，不转 Ready、不请求 reviewer；转 Ready 不等于获准合并。

## 输出与验证状态

按阶段报告实际完成的工作：需求链接、开发/交付分支及基线、范围隔离证据、验证结果、PR 链接与 Draft 状态、待用户判断事项。未做的步骤不能写成已完成。

本流程已有用户确认，但干净分支整理到 PR 审查的完整链路尚未通过一次真实需求交付验收；首次执行后将实际经验更新到现有交付文档，不预设通用 Git 自动化。仅收到 `push` 时直接执行 AGENTS 的暂存、提交、个人 remote 推送流程，不插入本 skill 的分支整理或 PR 操作。
