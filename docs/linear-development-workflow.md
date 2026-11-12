# 开发、知识回流与 PR 交付

更新日期：2026-11-12。本页是当前协作流程；替代旧的“仅用户同步个人基础、默认冻结工作表和打证据包”的规则。个人基础持续积累，最终 PR 只交付本需求。工具入口：[agent-workflow.mjs](../scripts/agent-workflow.mjs)，只依赖 Node/Git，不安装依赖、不推送或创建 PR。

## 分支基础与隔离

`origin/release → solana-integration → 需求开发分支`；需求成果分两路：基础设施提交选择性回流 `solana-integration`，业务提交从最新 release 重建交付分支。禁止整支业务分支合入个人基础，也禁止个人基础整支进入 PR。

- 上游业务随 release 正常同步；个人新增差异尽量放在 docs、项目 skill、scripts、tools 和本地配置，不新增产品逻辑。共享配置改动按内容审查，避免本地代理、开关覆盖写入业务源码。
- Agent 在新需求前和明确的上游变化时主动 fetch/sync。已有任务进行中，先判断上游变化是否影响它；不每轮合并、不自动把个人基础新历史并入已有功能分支。
- 基础设施主工作区需干净；有未提交工作、未完成 Git 操作或被其他任务占用时不 stash/reset。先完成当前相关沉淀，或保留现场继续独立工作。冲突先分析两侧；可明确判断的环境冲突可处理，产品语义不明再集中询问。
- 同步命令先 merge-tree 预检冲突，失败时原 checkout 不进入 merge；签名/钩子失败时保留现场诊断，不自动禁用签名或跳过检查。

```sh
# Run from the infrastructure checkout; these commands mutate local Git state.
node scripts/agent-workflow.mjs sync
node scripts/agent-workflow.mjs start --issue FESOL-123 \
  --branch feature-name-fesol-123 --worktree /path/to/feature
node scripts/agent-workflow.mjs status --issue FESOL-123
```

start 会先同步个人基础再创建独立 worktree，不切换调用方分支。按根规则已获开发授权时直接执行。Git 共享目录 `agent-workflow/FESOL-123.json` 保存开发目录/基线、回流提交及交付目录，不进入源码或 PR；新会话先读 status，不依赖旧聊天。现有旧任务没有登记时先核对实际 PR head 和工作区，按下面原生命令处理；不要为登记而重建已存在的开发分支。

## 开发与主动沉淀

1. 新需求先实时读取[Linear 正文、关系和评论](linear-requirements.md)，核对关键依赖 PR 是否进入 release；只查本任务相关项。记录最少的验收条件、业务范围和依赖到任务说明或 PR，不默认创建工作表。
2. 业务与个人基础设施改动分开提交。已安装 Husky 时，纯 AGENTS/docs/.agents/scripts/tools（含本入口 pre-commit）提交只检查暂存差异，不触发 SDK/本地化生成；仍在提交前执行相关工具测试。业务、共享配置、gitlink 或混合提交走原上游钩子。共享文件混改时按 hunk 拆分；不能靠后缀或文件名单替代语义审查。commit 英文并附需求编号。
3. 已确认的环境经验、长期偏好、工具改进在可复用节点主动沉淀到已有主题/skill；回流时明确选择已审查的基础设施提交，保留业务开发现场。

```sh
# Transfer only reviewed, separate infrastructure commits, in dependency order.
node scripts/agent-workflow.mjs backflow --issue FESOL-123 \
  --commit INFRA_SHA_1 --commit INFRA_SHA_2
```

工具只接受 docs、.agents、scripts、tools 或 AGENTS.md 的独立普通提交，拒绝 merge、gitlink、混合业务路径，跳过目标已有/等价补丁；路径通过不证明语义正确。package.json、Vite、.gitignore 等混合配置必须人工逐项拆分并用原生 Git 回流，不能扩大允许范围直接带入。回流只更新本地个人基础，不自动 push。已提交记录可用于恢复上下文。

## 需求与上游的更新时机

- 开始、跨会话恢复且即将继续实现、进入验收/交付、收到新 review 或依赖变更提示时，静默重读目标 Linear 与相关 PR，比较 updatedAt、正文、验收条件、关系和最新评论。当前工作轮次没有相关变化时复用本次观察，不全量 sync。
- 普通状态变化简短记录；验收、范围或契约改变时分析实际影响，更新方案与测试，存在产品歧义才询问。不自动改 Linear。
- 新需求前同步个人基础；交付前 fetch release 固定 SHA。交付中上游再次前进时评估影响；确需重建或冲突修复时保留现有成果，不无限追赶变化或机械重跑所有测试。

## 最短交付路径

1. **准备**：完成当前基础设施回流，确认业务提交及未合并依赖。依赖不在 release 时明确等待，或按已确认的依赖 PR 顺序处理，不伪称可独立交付。
2. **重建**：从 fetch 后的最新 release 创建交付 worktree，只选择本需求业务提交。工具按提交复制，不能自动理解混合补丁或丢弃前置实现。
3. **复核与验证**：检查最终完整 diff 和提交历史，确认无个人基础、参考仓库和无关功能；在实际交付目录执行相关测试及上游要求的检查。记录命令、结果、目标 SHA 和未覆盖项，避免无变化重复执行。依赖安装按目标锁文件，SDK/WASM 或生成路由按对应环境入口准备。
4. **PR**：推送正式 fork `my-gmx-pr`，向 `gmx-io/gmx-interface:release` 建 Draft PR，英文 Summary、Linear URL 和简短真实 Validation。普通 PR 无需额外证据包。适用时按 gmx-prompts 自审最终 diff，发现问题直接在交付工作区修复。

```sh
node scripts/agent-workflow.mjs deliver --issue FESOL-123 \
  --branch feature-name-release-fesol-123 --worktree /path/to/delivery \
  --commit BUSINESS_SHA_1 --commit BUSINESS_SHA_2
# Inspect and validate the resulting checkout before publishing.
git -C /path/to/delivery diff origin/release...HEAD
git -C /path/to/delivery log --oneline origin/release..HEAD
# Only with an instruction to publish the PR:
git -C /path/to/delivery push my-gmx-pr HEAD
```

`my-gmx` 是个人镜像；`my-gmx-pr` 是正式 GitHub fork。独立镜像不能作为同一 fork 网络的 PR 来源。创建 PR 前用 gh 核实 fork 关系和远端 head，不向 origin 推送；正文用临时文件及 `--body-file` 传递。个人 fork 的报告发布可能受只读 token 限制，区分原生测试失败和报告发布失败。

deliver 默认拒绝个人目录和 gitlinks，选中提交必须属于登记的任务分支；真实业务文档/脚本被路径规则拒绝时按原生 Git 精确转移并审查，不伪装路径。原生命令同样可用：`git worktree add -b DELIVERY PATH origin/release` 后选择性 cherry-pick；不为使用工具强行改提交结构。

## PR 后的唯一工作现场

交付创建后，登记的 delivery 工作区为业务修复唯一入口；旧开发分支保留但停止继续业务开发，不维护两份业务实现。新会话核对实际 PR head，若与登记不符以远端事实为准并更新本地记录。review 修复按影响复验，不重新创建一套交付分支。

此阶段发现的知识也可从 delivery 的独立基础设施提交选择性回流；回流后必须从 PR 历史剥离该个人提交，未经明确授权不 rebase/强推。更轻便的方法是在个人基础 worktree 直接记录并提交经验，业务 worktree 只保留业务改动。

## 失败恢复与工具边界

工具不执行 reset、stash、强推、依赖安装或自动冲突解决。提交选择或归属错误在转移前拒绝；cherry-pick/签名/钩子失败时保留工作区和 pending 记录，status 提供位置。Agent 核实后用原生 Git continue/abort；确认最终 SHA/剩余提交，再修正 Git 共享目录中的本地记录、移除已解决 pending，不能只删记录冒充操作完成。无关 worktree 不自动删除。普通 Git 操作、记录读写均应串行，避免多个 Agent 同时维护同一任务或个人基础。

## 按需交付证据归档

普通需求只需在 PR 中记录实际验证、目标提交和必要日志位置；本机路径标明仅本机可用。复杂资金/交易、多仓库移交或用户明确要求时，再使用[严格交付检查](agent-delivery-evidence.md)和[证据包](agent-evidence.md#交付默认步骤)。源码、目录或 commit 变化后旧报告不能冒充新版本验证，但不因此机械重做与改动无关的检查。

## 本次改造验收

2026-11-12 已完成本轮改造：

- 实际 fetch 并合入 `origin/release` 的 `24cd9b16d6`，维护 merge 为 `7b704a98fa`。采用上游交易开关实现，代理配置移到 tools；`src`、`sdk`、`landing` 相对该 release 无个人差异。Vite 的嵌套目录扫描限制继续作为环境配置保留。
- 隔离真实 Git 仓库演练覆盖创建任务、基础设施回流、等价补丁跳过、上游前进后纯业务交付；同时验证混合/外来提交、脏基础、gitlink 拒绝，以及预合并冲突不污染现场、回流冲突保留 pending 和恢复位置。
- 新增纯基础设施 pre-commit 快路，业务/共享配置/混合提交仍走原路径。当前机器没有安装 Husky hook（没有 core.hooksPath 或 hook 文件），因此原构建钩子并非已证实的本机耗时来源；修改用于安装/恢复 hook 后的工作流，不为本轮验收全局安装钩子。
- `yarn test:agent-tools` 共 134 项全部通过，其中双路径与提交分流 5 项；相关脚本通过 Node 环境 ESLint 与 Prettier。ESLint 显式采用 Node 运行环境，允许 CLI 输出和 Node 已支持的 async iteration/top-level await；未改前端 lint 配置。两个更新的项目 skill 通过 quick_validate，改动 Markdown 的本地链接检查通过。
- 本轮未运行完整前端类型检查、业务测试或构建，未做真实业务 PR 发布；工具演练不代表业务验收。原始工具回归日志保留在本机 `/tmp/gmx-agent-tools-20261112-final.log`，可被系统清理。
