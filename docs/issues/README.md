# Issue 知识入口

更新日期：2026-11-12。每个经手 issue 在 `docs/issues/ISSUE-ID.md` 保留一份版本化记录：开发、调研、review、排障及依赖核验都使用同一入口，不因分支重建或换 Agent 再开一份。当前要求来自[知识维护约定](../documentation-maintenance.md#按-issue-沉淀)。

## 开始时先找

从个人基础 worktree 的最新版工具定位，无需创建分支或登记本地任务：

```sh
node /path/to/base/scripts/agent-workflow.mjs status \
  --project-dir /path/to/current-checkout --issue FESOL-123
# Search related references before writing a new note.
rg -n -F 'FESOL-123' /path/to/base/docs
```

status 的 issueKnowledge 返回固定路径以及 available/missing/base-unavailable/blocked；即使本地 record 为 null 也能定位。available 的 tracked/changed 区分已纳入版本控制的记录和待提交修改，不证明内容完整或事实仍有效。无法定位个人基础或路径不可读时，不把它当作“没有记录”。旧分支只读取相关知识，不为获取文档整支合并个人基础。

先读已有记录和关联 issue 的关键结论，再实时核对需要更新的 Linear、PR、接口及版本。没有固定入口时，先检索已有专题/验收材料；创建该编号的简短入口并链接原文，不复制历史报告。仅核对到历史材料时明确日期和边界，不把旧状态改写成当前事实。

## 工作过程中持续更新

Agent 主动维护，用户不需填表。实际做过的工作、遇到的问题、解决办法和结果都记录在对应 issue；没有代码变化或新通用经验时，也记下查了什么、确认范围和未确认项。重要阻碍、易丢失决策及时保存；普通工作、问题解决、调研与 review 结论可在切片收尾合并更新和提交，不要求每个动作单独写盘或 commit；同一检查反复执行可以归并，保留关键版本、结果和有意义的经过，不复制全部命令输出。

每个经手 issue 都保留记录，但重复核验且结论未变时归并到已有活动与观察时间，不追加流水账。issue 保存经历和结果，note 只保存当前执行状态与链接，专题/skill 只维护通用方法；最终回复简述结果与入口即可，不复制全文。

篇幅随任务而定，无强制字段或固定长表。通常几段即可说明：

- issue 链接、记录时间与参与角色；自己的开发任务关联实际业务分支和唯一 PR，调研他人任务注明调研/review 身份，不据此认领实现。
- 做过什么、问题如何处理、结果与关键决策；附能复核的代码路径、PR/commit、接口或来源及其观察时间。
- 已验证与未验证的边界、未完成项和下一步；没有依据就写未知，不编造分支、PR、结论或通过结果。
- 通用经验的专题/skill 链接，以及影响当前任务的关联 issue；同一事实只维护一个通用落点。

结构可参考下面的短例，按实际内容删改；不要创建只含占位符的空记录：

```markdown
# FESOL-123 — Actual issue title

Updated: <date>. Role: research / implementation / review.
Issue: <actual URL>. Branch / PR: <actual references, if known>.

## Work and findings

- <Work performed, problem, resolution or conclusion; evidence and observed version/date>.

## Remaining and reusable knowledge

- <Unverified scope / remaining action / links to the relevant topic or skill>.
```

实际协作文档正文用中文；上面的英文仅演示结构。稳定结论原地更新，关键历史取舍保留时间与依据，完整变更历史由 Git 保存。源码、需求或部署变化后修正受影响结论，不能把旧 passed 复制为新验收。

## 确保知识进入个人基础

默认直接在 `solana-integration` worktree 更新本目录及相关专题，普通开发或只读调研均已有本地知识沉淀授权；检查并保留其他任务的未提交工作，不顺带暂存或提交。若知识最初写在功能分支，拆成独立基础设施提交，按[选择性回流](../linear-development-workflow.md#开发与主动沉淀)带回个人基础；业务提交仍从最新 release 整理，不携带这些个人知识文档。

暂停、交接、PR 整理或本轮结束前，Agent 核对是否遗漏实际工作、问题/处理/结果、证据边界、未完成项和通用经验链接，并确认知识已进入个人基础（已提交或明确说明待提交现场）。这是内容检查，无新增自动交付阻断、评分或必填表。用户仅要求 push 时不插入整理，按根规则处理。

本机 `.git/agent-workflow` 只保存目录、pending 和当前执行上下文；原始日志/快照留在忽略目录，issue 文档保存足以继续工作的结论和来源，不能把本机路径当共享附件。不修改 Linear、不自动发布外部评论；不记录凭据。无 issue 的工作更新已有主题或本地 task，不编造编号。旧 issue 在再次使用时依据现存材料补齐，不批量伪造历史。
