# 开发、知识回流与 PR 交付

更新日期：2026-11-12。本页是当前协作流程；替代旧的“仅用户同步个人基础、默认冻结工作表和打证据包”的规则。个人基础持续积累，最终 PR 只交付本需求。工具入口：[agent-workflow.mjs](../scripts/agent-workflow.mjs)，只依赖 Node/Git，不安装依赖、不推送或创建 PR。

## 分支基础与隔离

`origin/release → solana-integration → 需求开发分支`；需求成果分两路：基础设施提交选择性回流 `solana-integration`，业务提交从最新 release 重建交付分支。禁止整支业务分支合入个人基础，也禁止个人基础整支进入 PR。

- 成果按交付用途归属：产品所需代码、测试、公开文档与迁移脚本属于需求成果；只服务个人 Agent 协作的知识/工具属于个人基础。目录是工具过滤依据，不是归属定义；不能因 docs/scripts 路径剥离必要交付物。
- 上游业务随 release 正常同步；个人新增差异尽量放在 docs、项目 skill、scripts、tools 和本地配置，不新增产品逻辑。共享配置改动按内容审查，避免本地代理、开关覆盖写入业务源码。
- Agent 在新需求前和明确的上游变化时主动 fetch/sync。已有任务进行中，先判断上游变化是否影响它；不每轮合并、不自动把个人基础新历史并入已有功能分支。
- 个人基础写入按[协调归属](agent-collaboration.md#个人基础写入归属)集中处理，不能用自动提交所有 dirty 内容来解除阻塞。
- 基础设施主工作区需干净；有未提交工作、未完成 Git 操作或被其他任务占用时不 stash/reset。先完成当前相关沉淀，或保留现场继续独立工作。冲突先分析两侧；可明确判断的环境冲突可处理，产品语义不明再集中询问。
- 同步命令先 merge-tree 预检冲突，失败时原 checkout 不进入 merge；钩子失败时保留现场诊断，不跳过检查。所有实际开发与沉淀 commit 必须使用 GPG 签名，包括个人仓库、业务 PR、本地及 merge/cherry-pick 新提交；显式使用 `git commit -S`、`git merge -S`、`git cherry-pick -S` 等并核验新提交。签名失败保留现场，排查或由用户本机解锁，不得免签兜底（2026-11-17 用户明确，替代此前免签授权）。配置及验证见[GPG 签名排障](agent-failure-diagnosis.md#gpg-签名与密码缓存)。

```sh
# Run from the infrastructure checkout; these commands mutate local Git state.
node scripts/agent-workflow.mjs start --issue TRD-123 \
  --branch feature-name-trd-123 --worktree /path/to/feature
node scripts/agent-workflow.mjs status --issue TRD-123
```

新需求使用当前 `TRD-*` 编号；历史 `FESOL-*` 任务、分支和记录保持原入口，按核实的对应关系恢复，不按数字替换前缀或重复登记。

start 会先同步个人基础再创建独立 worktree，不切换调用方分支；新建任务无需先单独 sync。仅维护个人基础时才独立运行 `node scripts/agent-workflow.mjs sync`。按根规则已获开发授权时直接执行。Git 共享目录 `agent-workflow/TRD-123.json` 保存开发目录/基线、回流提交及交付目录，不进入源码或 PR；新会话先读 status，并读取其 issueKnowledge 指向的[长期 issue 记录](issues/README.md)，不依赖旧聊天。已有任务使用下面的 register/rebind 登记，不为使用工具重建分支；没有 Linear 编号的本地任务用 `--task kebab-case-name`，与 `--issue` 二选一，本地文件名为 `local-NAME.json`，不编造需求编号。

## 接入已有分支或 PR

register/rebind 只写本地任务记录，不 fetch、切分支、改源码或改历史。Agent 先核对实际 Git 根、任务基线、分支和完整 HEAD，再用显式参数登记；HEAD 确认由 Agent 完成，无需让用户抄 SHA。dirty 工作区可登记以保留未完工作；未完成 Git 操作需先处理。

```sh
# Register an existing development workspace, preserving its uncommitted changes.
node /path/to/base/scripts/agent-workflow.mjs register --task agent-maintenance \
  --project-dir /path/to/task --worktree /path/to/task \
  --base REVIEWED_TASK_BASE --head ACTUAL_HEAD
# After inspecting a moved or replaced workspace, rebind the recorded role.
node /path/to/base/scripts/agent-workflow.mjs rebind --task agent-maintenance \
  --project-dir /path/to/task --worktree /path/to/new-location --head ACTUAL_HEAD
# For an existing business PR, first capture its current remote facts.
gh pr view PR_URL --json url,headRefName,headRefOid,baseRefName > /path/to/local-pr.json
node /path/to/base/scripts/agent-workflow.mjs register --issue TRD-123 \
  --project-dir /path/to/base --worktree /path/to/existing-delivery --role delivery \
  --base REVIEWED_RELEASE_BASE --head ACTUAL_HEAD --pr-file /path/to/local-pr.json
```

初次 register 必须提供基线，rebind 默认保留该角色原基线；基线必须是目标 HEAD 的祖先，delivery 基线还须属于本地已获取的 origin/release 历史。已有 PR 时先 fetch 对应引用、核对远端事实；不是默认分支/当前 release SHA 就一定是该任务的正确起点。

PR 快照仅用于 delivery，核对目标仓库 URL、release base、分支与 HEAD；脚本不在线查询，也不把快照记录时间当远端核验时间。登记前后仍要按任务节点实时查 PR。导入的 delivery 是 PR 发布版本的权威入口；有原 development 时，修复仍按下文的开发验证→交付流程。登记不证明其 diff 已剥离个人基础或测试通过，仍需完整审查。仅有 delivery 的旧任务可直接登记该角色，无需重建不存在的旧开发现场。

rebind 不覆盖已有未解决 pending，也不会放弃另一个仍有未提交工作/未完操作的旧工作区；旧路径失效时允许按同仓库新现场恢复。每次绑定核对命名分支、实际 HEAD 和 Git 共享根，记录 lastBinding；变更 delivery 绑定会清除旧 PR 观察，未提供新快照时留空，旧验证声明也会清除。角色可用 `--role development|delivery` 明确选择；新的角色必须显式提供基线。旧版任务记录可继续使用，不批量迁移或接管其他任务现场。

需要分工时按[Agent 协作约定](agent-collaboration.md)指定协调入口、修改范围和成果接收；默认不启用多 Agent。

## 任务上下文与恢复

跨会话恢复、实现方案/阻碍变化、验证完成或交付位置改变时，Agent 主动更新少量当前上下文；没有变化不重复写。使用个人基础 worktree 的最新版工具，显式指定实际目标，旧分支不必合入个人基础来获得新知识：

```sh
node /path/to/base/scripts/agent-workflow.mjs status \
  --project-dir /path/to/task --issue TRD-123
node /path/to/base/scripts/agent-workflow.mjs note \
  --project-dir /path/to/task --issue TRD-123 --context-file /path/to/local-context.json
```

共享摘要由协调 Agent 维护；多个子任务不各自替换同一份列表。note 接受 JSON 部分更新：`objective` / `next` 为字符串，`acceptance` / `decisions` / `blockers` / `links` / `observations` 为字符串列表；未给字段保留原值，列表整体替换，空列表清除旧阻碍。只记录下一位 Agent 继续需要的当前信息，不保存聊天全文、秘密或推测性权限。需要时用 `coordinator` 和 `assignments` 保存[当前分工](agent-collaboration.md#最小子任务约定)，单 Agent 任务不必填写。来源观察注明实际 URL/ref、revision/updatedAt 和核验时间；工具不会代查 Linear 或保证观察仍新鲜。与历史 review 经验有关的重要取舍在 `decisions` 简记条件、在 `links` 指向[当前条目](review-lessons.md#按改动检索)及 issue；恢复时从个人基础读取相关最新条目，不为读取知识整支合并基础。note 只保留当前执行摘要与 issue/专题链接，不复制长期经历；同一观察按[执行与复用](agent-task-start.md#执行与复用)供多个阶段入口共用。

```json
{
  "objective": "Refresh affected Solana orders",
  "decisions": ["Reuse the shared order data flow"],
  "blockers": ["The required API change has not reached release"],
  "next": "Check the cancellation path after the API dependency lands"
}
```

可选 `verification` 对象必须包含 `worktree`、完整 `head`、实际 `command` 和 `result`（passed/failed/blocked/not-run）；设置为 null 清除。它是 Agent 对已运行验证的简记，工具不执行该命令、不生成验收证据。记录时核对实际权威工作区、HEAD 和干净状态；status 的 `verificationCurrent` 仅表示记录对应当前干净 checkout。提交变化、工作区变脏或切换交付目录后为 false；即使为 true，也不能据此断言外部服务、忽略产物或验证结果有效，应按具体输入和范围判断复用。

status 即使没有本地任务记录，也会在 issueKnowledge 中定位个人基础的 `docs/issues/ISSUE-ID.md`，区分记录存在/缺失、基础不可用和路径受阻；不会创建文档、登记任务或阻断交付。

status 返回实际开发/交付分支与 HEAD、dirty、未完成 Git 操作、分支是否匹配、权威工作位置、pending 目标现场与上下文是否需复核，以及个人基础位置/HEAD/知识变化路径。路径列表只是相关检索入口，不要求全部阅读；个人基础 dirty 会显式提示。远端 PR head、Linear 和部署仍按相关节点实时核验，不以本地记录替代。

## 开发与主动沉淀

1. 新需求先实时读取[Linear 正文、关系和评论](linear-requirements.md)，核对关键依赖 PR 是否进入 release；只查本任务相关项。记录最少的验收条件、业务范围和依赖到任务说明或 PR，不默认创建工作表。选方案前按[相关 review 经验](review-lessons.md#按改动检索)核对已有接缝、真实消费者及反例；编码中出现新判断按[日常维护](review-lessons.md#日常增量维护)更新，不等到最终 PR。
2. 业务与个人基础设施改动分开提交。已安装 Husky 时，纯 AGENTS/docs/.agents/scripts/tools（含本入口 pre-commit）提交只检查暂存差异，不触发 SDK/本地化生成；涉及工具源码时执行适用回归；纯文档只检查链接与差异。业务、共享配置、gitlink 或混合提交走原上游钩子。共享文件混改时按 hunk 拆分；不能靠后缀或文件名单替代语义审查。commit 英文，有关联需求时附真实编号；具体见[提交与 PR 规范](#commit分支与-pr-表达规范)。
3. 每个经手 issue 的工作/问题/处理/结果在自然节点合并更新[issue 文档](issues/README.md)，包含调研他人任务的结论；暂停、交接和交付前检查遗漏与回流位置。通用经验、长期偏好、工具改进沉淀到已有主题/skill，并从 issue 链接过去；回流时明确选择已审查的基础设施提交，保留业务开发现场。
4. 本阶段个人沉淀在最终回复前完成提交、必要回流和 `my-gmx` 推送，无需等待用户提醒。按[沉淀收尾与自动推送](documentation-maintenance.md#沉淀收尾与自动推送)核对归属、暂存区及待推送历史；受阻则保留现场并说明实际完成状态与原因。

```sh
# Transfer only reviewed, separate infrastructure commits, in dependency order.
node scripts/agent-workflow.mjs backflow --issue TRD-123 \
  --commit INFRA_SHA_1 --commit INFRA_SHA_2
```

工具只接受 docs、.agents、scripts、tools 或 AGENTS.md 的独立普通提交，拒绝 merge、gitlink、混合业务路径，跳过目标已有/等价补丁；路径通过不证明语义正确。package.json、Vite、.gitignore 等混合配置必须人工逐项拆分并用原生 Git 回流，不能扩大允许范围直接带入。回流工具只更新本地个人基础，不代做 push；Agent 仍须按上述收尾步骤主动推送。已提交记录可用于恢复上下文。

## 需求与上游的更新时机

- 开始、跨会话恢复且即将继续实现、进入验收/交付、收到新 review 或依赖变更提示时，静默重读目标 Linear 与相关 PR，比较 updatedAt、正文、验收条件、关系和最新评论。当前工作轮次没有相关变化时复用本次观察，不全量 sync。启动、skill、自审命中同一核验节点只执行一次，具体复用边界见[启动卡](agent-task-start.md#执行与复用)。
- 无变化不新增流水账；已执行且影响当前工作的 release/子仓库同步、需求/契约变化与知识回流，在阶段结果中简述实际动作和影响。没有订阅或轮询时只在查询/收到信号时发现变化，不承诺实时感知，不新增常驻监听。
- 普通状态变化简短记录；验收、范围或契约改变时分析实际影响，更新方案与测试，存在产品歧义才询问。不自动改 Linear。
- 使用配套仓库前按[子仓库更新规则](solana-reference-repositories.md#子仓库按需核验与更新)核验相关官方远端；干净未占用的非固定参考分支可主动快进，开发现场和 gitlink 固定版本以只读比较/独立 worktree 核对。
- 新需求前同步个人基础；交付前 fetch release 固定 SHA。交付中上游再次前进时评估影响；确需重建或冲突修复时保留现有成果，不无限追赶变化或机械重跑所有测试。

## 最短交付路径

开发中针对性验证；收到交付指令后集中执行以下路径，不在每个工作切片重建交付现场。

1. **准备**：完成当前基础设施回流，确认业务提交及未合并依赖。依赖不在 release 时明确等待，或按已确认的依赖 PR 顺序处理，不伪称可独立交付。
2. **重建**：从 fetch 后的最新 release 创建交付 worktree，只选择本需求业务提交，逐个保留原 commit 拆分并 GPG 签名，不聚合为单提交。工具按提交复制，不能自动理解混合补丁或丢弃前置实现。
3. **复核与验证**：检查最终完整 diff 和提交历史，确认无个人基础、参考仓库和无关功能；对照相关[经验条目](review-lessons.md)确认组合未撤销历史修复、关键反例覆盖实际消费者与共享/EVM 路径；在实际交付目录执行相关测试及上游要求的检查。记录命令、结果、目标 SHA 和未覆盖项，避免无变化重复执行。依赖安装按目标锁文件，SDK/WASM 或生成路由按对应环境入口准备。
4. **PR**：推送上游 `origin` 的需求交付分支，向 `gmx-io/gmx-interface:release` 建 Draft PR，标题、Summary、Linear、真实 Validation 和发布事项遵循[提交与 PR 规范](#commit分支与-pr-表达规范)。普通 PR 无需额外证据包。适用时按 gmx-prompts 自审最终 diff；发现问题按下文“PR 后的修复与交付现场”先回原开发分支验证，再转入交付目录复验。

```sh
node scripts/agent-workflow.mjs deliver --issue TRD-123 \
  --branch feature-name-release-trd-123 --worktree /path/to/delivery \
  --commit BUSINESS_SHA_1 --commit BUSINESS_SHA_2
# Inspect and validate the resulting checkout before publishing.
git -C /path/to/delivery diff origin/release...HEAD
git -C /path/to/delivery log --oneline origin/release..HEAD
# Only with an instruction to publish the PR:
git -C /path/to/delivery push origin HEAD
```

分支重建（含 release 交付重建、PR 来源迁移和补签）保留原有 commit 拆分、顺序、提交信息及适用的 merge 拓扑，未经用户当次明确要求不得聚合为单提交；原已签名且父节点未变的提交可原样复用，父节点变化的后续提交须重新签名。以逐提交 tree、message、映射后父节点和最终 tree 核对内容不变，保留旧引用；改写/强推仅在用户明确授权范围内执行。

`my-gmx` 是个人镜像，开发备份与个人基础仍使用它。业务 PR 在上游 `gmx-io/gmx-interface` 仓库内建立交付分支，通过 `origin` 推送并向 `release` 提交 Draft PR，不使用 fork PR（用户于 2026-11-19 纠正）。`my-gmx-pr` 仅保留为历史 fork remote，不再作为默认交付目标。创建 PR 前用 gh 核实 head/base 仓库均为上游及远端 head，并逐条核对 PR commit 为有效 GPG 签名；正文用临时文件及 `--body-file` 传递。 跟进当前交付的 CI 时，绑定仓库、PR head SHA 和实际 run/job；已有 watch/session 优先读取其最新结果，发状态回复前处理已返回的查询，用户指出已结束时立即复核。PR正文编辑也可能触发新run，重新确认当前有效检查，不能沿用旧pending或旧成功。任务结束后停止已完成任务的watch；不为报告权限403反复重跑测试或扩大权限。

deliver 默认拒绝个人目录和 gitlinks，选中提交必须属于登记的任务分支；真实业务文档/脚本被路径规则拒绝时按原生 Git 精确转移并审查，不伪装路径。原生命令同样可用：`git worktree add -b DELIVERY PATH origin/release` 后选择性 cherry-pick；不为使用工具强行改提交结构。

## Commit、分支与 PR 表达规范

依据：[上游发布流程第 3 节](../gmx-prompts/docs/onboarding/release-process.md#3-pull-requests-and-ci)（2026-11-12 核对）。使用前按子仓库规则核验相关规范的新变化；下面明确区分上游要求和本地写作约定。

2026-11-20 发布分支说明核验：上游 `docs/onboarding/release-process.md` 本地 blob 与 GitHub 当前版本一致（`2a92eacc16a200e625ed7c2ff93627550fb8b6d7`）。普通任务进入 `release`，通常周四从其切出 `release-N`，候选分支经测试及必要修复后以 `Release N` PR 合入生产 `master`；这不是要求整个 `release` 停止开发，也不要求等测试结束才创建发布 PR。未计划开放的已合代码须由默认关闭的 flag 隔离；不能概括成其他功能一律无 flag，另有 keeper 运行时开关。Hotfix 经协调从 `master` 派生并直接 PR 回 `master`，随后同步到 `release`。Release 136/#3322（`release-136`→`master`）已于11月20日00:17上海时间合并，近期周四节奏按UTC/团队时区理解；北京时间可能已跨至周五。GMTrade main/beta/stable仅可按用户描述作角色类比，不据此声称已核验旧仓库发布规则。

2026-11-20 发布合并一致性核验：Release 136 在 [#3327](https://github.com/gmx-io/gmx-interface/pull/3327) 先将 `master` 同步到 `release-136`；候选最终 HEAD `ee4f5d56494ac4489f5e91dc507230152de8d422` 与 [#3322](https://github.com/gmx-io/gmx-interface/pull/3322) 合入 master 的 merge commit `3e2bc5fefd19d54f05f41db86214c9e10087c29f`，Git tree 均为 `458c067874da034290d1179fa48f76536c6056f8`，故本次最终合并没有改变候选文件内容。不同 commit SHA 不代表代码内容不同；此实例不证明所有发布都自动保持一致，也不证明最终 HEAD 已完成全部人工回归。仓库 `pr-tests.yml` 使用 pull_request 默认 checkout，常规 CI 检查模拟合并结果；`release-regression.yml` 将 Cloudflare 预览绑定 PR head SHA，但不是每次 head 更新自动重跑的完整回归。发布主控规范另要求集成环境人工回归、生产 smoke、flag 和回滚计划。候选/合并 tree 一致不等于生产构建产物、环境及运行时配置完全一致。实时 master protection 接口返回404、rules接口返回空数组，未能确认当前强制门禁与分支必须最新策略；不能仅按文档声称它们已实际启用。

### Commit 与分支

- 本地约定：commit 英文，以动作说明实际结果，例如 `Fix stale Solana order status TRD-123`；有明确关联需求时带真实编号，没有编号的基础设施维护不编造编号。当前已核对的上游规则未要求 Conventional Commits，不强制添加 `feat:` / `fix:`。
- 一个提交表达一个可审查目的。业务与个人基础设施分开；避免 `update`、`fix stuff` 或把聊天过程当标题。只有改动动机/兼容性不明显时再补正文，不要求普通提交套模板。
- 上游要求分支名使用 kebab-case；本地示例 `fix-solana-order-status-trd-123`，交付分支可用 `fix-solana-order-status-release-trd-123`。需求编号取实际 Linear，不硬编码本例。

### PR 标题

- 按根约定使用英文描述；**上游要求末尾是 Linear issue id**，例如 `Fix stale Solana order status TRD-123`。编号之后不再追加标点、`Draft`、状态或其他标签；Draft 由 GitHub 状态表达。
- 标题描述最终交付行为，范围变化时同步重写标题和正文；不写个人环境、整理分支或回流过程。普通需求目标为 release；`Release ...` / `Hotfix ...` 是发布/热修复流程的标题，不套用到一般需求。

### PR 正文与 Summary

- **上游要求包含**：Linear issue id；部署后事项（没有则 `None`）；breaking-change 分类（见上游发布流程第 5 节，没有则 `None`）；未完成工作所用 flag 及默认值。上游目前没有统一 PR 模板；下面是本地推荐的简短结构，不是新增的强制表单。
- **Summary 写法**：先说具体问题或触发条件，再说改动后的行为和必要原因；按最终 diff 写给没看过聊天的 reviewer。简单 PR 一两句话即可，复杂变更才分项。范围、依赖或发布顺序影响理解时再补，不复述排障时间线、废弃方案或文件清单。
- **Validation 写法**：只列实际执行的命令与结果，说明关键行为、未覆盖项或阻碍。在实际交付 checkout 验证；未执行不写 passed，工具演练不写成业务端到端验收。本机日志路径不能当作 reviewer 可访问的附件。
- Linear 放真实完整 URL；跨仓库兼容性、未合并前置和 SDK/API 发布顺序有影响时明确说明。源码、范围或验证状态变化后更新正文，不能继续沿用旧结论。

```markdown
## Summary

Fix stale Solana order status after an order update by refreshing the affected order data.

Linear: <actual Linear issue URL containing TRD-123>

## Validation

- <command actually run>: <observed result>
- <material coverage gap, if any>

## Release notes

- Post-deploy chores: None.
- Breaking changes: None.
- Feature flag: <actual flag and default for unfinished work; otherwise omit>
```

示例只演示结构，不能复制为未实现/未验证的声明。有 breaking change 时替换 `None` 为实际分类、消费者影响和发布顺序；有部署后事项则写明具体操作。PR 正文通过临时文件与 `gh ... --body-file` 提交，保留真实换行。保持 Draft，发 PR、邀请 reviewer、转 Ready 和合并按根授权处理。

## PR 后的修复与交付现场

收到 review 后先读原评论、后续回复、相关直接提交与最终要求，理解原问题全链；按[修复闭合](review-lessons.md#rl-07-最终取舍与修复闭合)核对相邻入口与共享调用方。修复切片收尾更新原 issue，并主动提炼或修正已有经验、适用条件与反例；作者声明、reviewer 确认和实际验证分开记录，不能只按 thread resolved 判断完成。

用户于 2026-11-13 明确：已有基于 `solana-integration` 的需求开发分支时，review 或后续发现的问题继续在原 development 分支修复、测试和验收，通过后再纳入现有 PR。这仍是同一 issue 的一条逻辑开发线，不创建另一条需求分支或 PR。

1. 核对 development、delivery 的实际目录、分支、HEAD 与 dirty 状态，以及远端 PR head；检查两处相关源码/依赖差异，保护未提交现场。
2. 在原 development 实施和验证修复，提交只包含该修复的业务代码及必要测试。个人知识在基础单独沉淀，不夹入业务提交。
3. 通过后精确 cherry-pick 修复提交到登记 delivery；不整支合入个人基础或 delivery。冲突按语义解决，尤其不能将开发侧个人基础差异带入 PR。
4. 在实际 delivery 按源码、依赖和配置差异复验适用检查；开发侧通过不代替交付侧通过。通过后推送 `origin`，更新同一 Draft PR；开发分支备份用 `my-gmx`，保持两角色 HEAD/验证证据登记。

不在 development 与 delivery 独立实现两份修复；delivery 保留 PR 发布版本的权威身份，development 是默认修复现场。工具 status 的 authority 和 note 的 verification 在已有 delivery 时指 PR 发布版本；开发验证单独记录 issue 与 context acceptance，不把开发 HEAD 填作交付 verification。仅有 delivery 的旧任务沿用已核实现场，不为套流程重建不存在的分支；有歧义再确认。新会话发现远端 head 与登记不同，先以远端事实核对差异再更新记录。普通修复不重新创建一套交付分支。

此阶段发现的知识也可从 delivery 的独立基础设施提交选择性回流；回流后必须从 PR 历史剥离该个人提交，未经明确授权不 rebase/强推。更轻便的方法是在个人基础 worktree 直接记录并提交经验，业务 worktree 只保留业务改动。

## 失败恢复与工具边界

工具不执行 reset、stash、强推、依赖安装或自动冲突解决。提交选择或归属错误在转移前拒绝；cherry-pick/签名/钩子失败时保留工作区和 pending，status 提供位置。Agent 核实后用原生 Git continue/abort，再核验实际 diff、选中提交完整性和当前 HEAD：

```sh
node /path/to/base/scripts/agent-workflow.mjs recover --project-dir /path/to/task \
  --issue TRD-123 --outcome completed --head REVIEWED_CURRENT_SHA
# Or after native Git recovery restored the original pending base:
node /path/to/base/scripts/agent-workflow.mjs recover --project-dir /path/to/task \
  --issue TRD-123 --outcome aborted --head ORIGINAL_PENDING_BASE_SHA
```

recover 不代做 Git 恢复。completed 需要干净且分支匹配、历史由原基线延伸、普通提交数与计划一致、每个提交路径符合回流/交付边界；显式 head 表示 Agent 已审查当前结果，工具不能证明人工冲突解决的业务语义正确。aborted 必须恢复原 pending 基线，部分已落地提交不能只删记录冒充撤销。旧版 pending 也可按原提交清单核验。恢复成功记录 lastRecovery，并登记交付或回流结果；无关 worktree 不自动删除。工作区创建失败而未形成可用 checkout 时，先按原生 Git 核实/修复创建现场，再登记，不能伪造记录跳过检查。

任务记录在共享 Git 目录用临时文件加原子 rename 替换；所有本工具写操作（包括 sync、不同任务的回流）共用 `agent-workflow/write.lock`，遇到占用立即报告，不轮询。status 可只读查看最后一份完整记录和当前 writer 锁信息；锁持有期间操作可能尚未完成，不将中间状态当最终结论。正常退出或异常返回会释放锁；进程被强杀/机器断电后可能留锁，先核对 lock 中 host/PID/operation、实际进程及 Git 现场，Agent 核实确认无维护者后移除，属于现场恢复，无需例行询问；脚本不凭锁年龄或本机 PID 自动抢占。互斥只覆盖本工具，原生 Git 和其他编辑操作仍需协作串行。

## 按需交付证据归档

普通需求只需在 PR 中记录实际验证、目标提交和必要日志位置；本机路径标明仅本机可用。复杂资金/交易、多仓库移交或用户明确要求时，再使用[严格交付检查](agent-delivery-evidence.md)和[证据包](agent-evidence.md#交付默认步骤)。源码、目录或 commit 变化后旧报告不能冒充新版本验证，但不因此机械重做与改动无关的检查。

## 本次改造验收

2026-11-12 已完成本轮改造：

- 实际 fetch 并合入 `origin/release` 的 `24cd9b16d6`，维护 merge 为 `7b704a98fa`。采用上游交易开关实现，代理配置移到 tools；`src`、`sdk`、`landing` 相对该 release 无个人差异。Vite 的嵌套目录扫描限制继续作为环境配置保留。
- 隔离真实 Git 仓库演练覆盖创建任务、基础设施回流、等价补丁跳过、上游前进后纯业务交付；同时验证混合/外来提交、脏基础、gitlink 拒绝，以及预合并冲突不污染现场、回流冲突保留 pending 和恢复位置。
- 新增纯基础设施 pre-commit 快路，业务/共享配置/混合提交仍走原路径。当前机器没有安装 Husky hook（没有 core.hooksPath 或 hook 文件），因此原构建钩子并非已证实的本机耗时来源；修改用于安装/恢复 hook 后的工作流，不为本轮验收全局安装钩子。
- `yarn test:agent-tools` 共 142 项全部通过，其中双路径、上下文恢复、已有任务绑定、协作整合、issue 知识定位和并发/原子写入 13 项；相关脚本通过 Node 环境 ESLint 与 Prettier。ESLint 显式采用 Node 运行环境，允许 CLI 输出和 Node 已支持的 async iteration/top-level await；未改前端 lint 配置。四个更新的项目 skill 通过 quick_validate，11 份改动 Markdown 的 137 个本地链接检查通过。
- issue 定位演练覆盖未登记任务、旧开发 worktree 读取个人基础、未跟踪/已提交/待更新记录、符号链接受阻与个人基础不可用；真实 `FESOL-55` 入口只索引已有历史验收，不宣称重新完成业务验收。
- 本轮未运行完整前端类型检查、业务测试或构建，未做真实业务 PR 发布；工具演练不代表业务验收。最新原始工具回归日志保留在本机 `/tmp/gmx-issue-knowledge-agent-tools.tap`，可被系统清理。
