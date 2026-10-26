# Linear 需求开发与 PR 交付流程

确认日期：2026-10-24。适用于本仓库的 Solana 迁移需求。每条 Linear 需求对应一个独立需求分支；PR 在用户明确同意前保持 Draft。

## 分支基础与隔离

- 开发从 `solana-integration` 创建需求分支。该分支是用户自定义的开发基础，包含方便个人开发的配置、文档和工具，不是可整体交付上游的集成分支。
- 用户自行定期将 `origin/release` 合入 `solana-integration`；Agent 不自行承担该同步工作。
- 最终交付分支必须基于交付时重新获取的最新 `origin/release`，只包含当前需求的必要改动。不能合入 `solana-integration`，不能将其自定义改动、历史或无关文件带入上游。
- 推荐在交付阶段从最新 `origin/release` 创建临时干净分支或独立 worktree，逐项转入已确认属于当前需求的提交或补丁，再整理为该需求的最终分支。保留开发现场直到交付内容核验完成；具体 Git 写操作遵循用户授权。
- 不对开发分支直接执行普通 rebase 并假定它会自动剔除基础改动，也不能仅将 PR base 改成 `release` 就认为完成隔离。
- 核对最终 `origin/release...HEAD` 的完整文件差异和提交列表，确保不含个人开发基础改动。相同文件同时含需求修改和个人修改时按内容拆分，不能整体复制文件。
- 如果需求依赖尚未进入 `origin/release` 的其他迁移改动，先向用户说明阻碍并澄清交付顺序，不擅自捎带其他需求或以兜底逻辑绕过依赖。在干净交付基础上重新完成相关验证。

独立交付 checkout 需要前端局部测试时，可从个人基础设施目录运行 `yarn frontend:test-offline --project-dir /path/to/delivery-checkout --suite src/...spec.ts`，无需向交付分支复制工具或 package 脚本。先准备目标依赖并核对报告的目标身份；完整步骤及边界见[前端离线测试](frontend-offline-tests.md#验证独立-checkout)。它不创建交付分支，也不替代下方 Git 隔离检查。

## 交付隔离自动检查

在干净交付分支整理完成后、创建或更新 Draft PR 前，运行只读隔离检查。从基础设施仓库调用，使用目标 Git 仓库中已按交付流程更新的 `origin/release`；工具自身不 fetch，不证明远端最新状态。

```sh
yarn agent:delivery-check --project-dir /path/to/delivery-checkout --require-clean \
  --head FEATURE_DELIVERY_BRANCH \
  --expected-base FULL_RELEASE_SHA \
  --allow-path src/path/to/feature.ts \
  --allow-path src/path/to/feature.spec.ts
```

把示例路径替换为人工确认的本需求完整文件清单，逐个重复 `--allow-path`，只接受精确仓库相对路径，不支持目录或 glob。`--base` 默认 `origin/release`，`--development-base` 默认 `solana-integration`；`--head` 必须明确。`--expected-base` 可选，但正式交付建议传入本次确认的完整 release SHA，防止检查用了另一版本。

`--project-dir` 默认是工具所在仓库；指定时必须是目标 Git checkout 根目录，报告 `projectDir` 保存规范化路径。三个 ref 或 SHA 必须能在目标仓库解析；工具不 fetch、复制引用或切换分支。独立交付目录中无需存在工具脚本或 package 命令。

正式交付建议显式使用 `--require-clean`：要求目标当前 HEAD 等于指定 `--head` 的实际 SHA，且暂存、未暂存、未跟踪文件均为空；Git 忽略的构建产物不会被计入。报告 `worktree` 提供实际 head、`stagedPaths`、`unstagedPaths`、`untrackedPaths` 和状态。错误 HEAD 返回 `worktree-head-mismatch`，脏状态返回 `worktree-dirty`，整次 blocked / 退出 2。文件列表使用 NUL 分隔读取，保留空格、换行及 Unicode 文件名。不传该选项时，继续只分析已提交历史，`worktree.status=not-checked`，不能将其解释为目录干净。

核对[独立前端测试报告](frontend-offline-tests.md#验证独立-checkout)的 `projectDir`、`sourceBefore.commit` / `sourceAfter.commit` 与交付报告 `projectDir`、`refs.head.sha` 一致，确认测试时源码未变、目标无未提交业务修改，再交接证据。该检查不锁定目录或生成原子快照，检查后有修改或提交变化时须重跑相关验收。

退出 0 / `passed` 表示以下自动条件全部满足：指定 release 是 head 的祖先；head 未带入开发基础相对 release 独有的提交，且没有被 Git 判断为等价的开发基础补丁；完整提交差异非空且只涉及允许清单中的文件。其他情况退出 2 / `blocked`，JSON 的 `findings` 给出具体提交、文件或基线问题；无效引用和参数也明确失败。报告固定三个引用的实际 SHA，比较过程使用这些 SHA，避免后续引用移动改变本次检查对象。

**能力边界：** 默认只检查已提交历史和文件差异；显式 `--require-clean` 才附加上述当前工作区检查，不检查 Git 忽略文件的内容，也不证明这些产物或依赖正确。工具不创建分支、不转移补丁、不改工作区、不调用远端。`baseFreshness=not-checked` 始终保留：即使预期 SHA 匹配，也不能证明已经获取最新上游。通过不代表需求完整、自测通过或人工审查完成。清单内混合个人与业务修改、修改后重新提交的个人内容、多提交 squash 等不能靠 Git 的单提交补丁等价判定完整识别，仍需核对最终完整 diff；不能仅凭文件清单或本工具通过就批准 PR。开发基础中已有的其他业务需求也不能捎带，应协调依赖交付顺序。

实现：`scripts/agent-delivery-check.mjs`；回归：`yarn test:agent-delivery-check`。真实临时 Git 仓库覆盖干净分支、开发基础直接继承/误合、不同 SHA 的等价 cherry-pick、release 前进后基线过期、越界/空差异、无效引用/路径及只读保持。当前 `solana-integration` 被正确拒绝属于预期，不能为了得到 passed 放宽检查条件。

### 基础设施验收记录（2026-10-26）

本轮未创建主仓库分支或改写历史。临时仓库真实历史回归通过；主仓库 `HEAD` 与个人开发基础重合，实际只读检查正确返回 `development-base-history` 并退出 2，清单外文件也明确列出。检查前后主仓库 HEAD、索引和 4,511 个文件内容摘要一致。根类型检查、ESLint、Prettier、71 个文档本地目标及差异检查通过；完整前端单元测试 3,014 项通过、1 项既有跳过。证据保留在忽略目录 `.local/acceptance/delivery-check/`；工具本身仅向 stdout 输出 JSON，归档由调用者显式重定向完成。

### 独立目录与干净状态验收（2026-10-27）

真实临时 Git 仓库已验证干净交付通过、错误 HEAD、暂存/未暂存/未跟踪单独存在和组合状态均拒绝；忽略构建产物不误报，含空格、换行、Unicode 的文件名完整返回。检查前后 HEAD、索引字节及目标文件内容保持不变，原有开发基础历史与等价补丁拒绝路径仍通过。已从其他 CWD 用 CLI 显式选择临时交付目录验证通过，不要求目标包含工具。实际主开发目录带有当前未提交工具改动，严格检查正确 blocked，HEAD 和索引摘要前后相同；这是预期拒绝，不是交付通过。

本轮没有创建或切换主仓库分支，没有修改业务源码。证据在本机忽略目录 `.local/acceptance/delivery-check/worktree/`：`lifecycle.tap`、`tools.tap` 与 `main-readonly.json`。正式交付仍须按流程更新上游、检查完整 diff 和完成需求验收。

## 分支、commit 和 PR 命名

来源为 [上游交付规范](../gmx-prompts/docs/onboarding/release-process.md#3-pull-requests-and-ci)，并参考真实 PR 与本地 `origin/release` 提交记录。上游仅要求任务分支使用 kebab-case，没有固定前缀；以下是本协作采用的统一写法，不宣称为上游强制格式。

| 对象 | 本协作约定 | 示例 |
| --- | --- | --- |
| 需求分支 | 英文描述，使用 kebab-case，末尾附小写 Linear 编号 | `solana-wallet-balances-fesol-89` |
| commit | 简明英文动作描述，末尾附大写 Linear 编号；不强制 Conventional Commits 前缀 | `Add network-scoped Solana wallet balances FESOL-89` |
| PR 标题 | 简明英文行为描述，以大写 Linear 编号结尾 | `Add network-scoped Solana wallet balances FESOL-89` |

参考：[PR #3133](https://github.com/gmx-io/gmx-interface/pull/3133) 的分支、标题和 Summary；[Draft PR #3136](https://github.com/gmx-io/gmx-interface/pull/3136) 的英文说明及 Linear 链接。实际仓库中存在其他写法，不将个别例外当成规范。上述规范已当下查阅整理，无需等到新建分支时才首次研究。

## PR 内容和目标

推送到个人 `my-gmx`，以个人仓库需求分支向 `gmx-io/gmx-interface` 的 `release` 发起跨仓库 Draft PR。不得推送上游 `origin`。创建 PR 是明确授权的交付任务的一部分；仅收到 `push` 时仍按根 AGENTS 的直接提交流程执行，不自动整理分支或创建 PR。

PR 标题、正文、审查评论均使用英文。按最终实现重写说明，提供：具体问题与结果、完整 Linear URL、英文自测结果表格，以及适用的 breaking changes、部署后事项、未完成功能开关及默认值。上游没有固定 PR 模板，以下为本协作正文示例：

```markdown
## Summary

- Add network-scoped Solana wallet balance reads using the existing balance flow.

Linear: https://linear.app/gmx-io/issue/FESOL-89

## Validation

| Check | Result | Evidence / Notes |
| --- | --- | --- |
| Targeted unit tests | Passed | `<command>`; `<result>` |
| Manual UI verification | Pending | Awaiting user verification |

## Compatibility and Rollout

- Breaking changes: None.
- Post-deploy actions: None.
- Feature flag: `<flag>`; default: `<value>`.
```

示例不是已执行结果。表格只记录实际执行的验证及证据；未执行、失败和待用户验证必须如实说明。只有确实不适用时才写 None 或 Not applicable。UI 测试、构建、部署、视觉验证及浏览器操作仍遵循根 AGENTS 的用户授权要求，PR 表格不扩大执行权限。个人 fork 没有上游自动分支预览，不能承诺存在预览地址。

## PR 审查和人工确认

1. 提出 Draft PR 后，使用 [gmx-interface-review](../gmx-prompts/skills/gmx-interface-review/SKILL.md) 及其引用规则审查最终 PR diff；Solana 同时结合 [gmx-solana](../gmx-prompts/skills/gmx-solana/SKILL.md)，鉴权、签名和资金相关改动按规范补充安全审查。该入口是审查工作流，不能假定存在同名可执行脚本；要求的工具若缺失，应明确报告，不声称已运行。
2. 审查以 PR 最终状态和 `release` 为比较基础，不使用默认 `master` 或开发分支差异替代。用户介入判断审查结果及修复方向，Agent 配合修复并补充受影响的验证；保持 PR 说明与自测表格准确。
3. 用户明确同意前持续保持 Draft，不转为 Ready for review，不主动请求 reviewer，不将 Agent 审查等同于 reviewer 审批。Draft 表示暂不请求正式人工 review，不表示跳过 CI 或 Agent 自审。
4. 用户同意后，才按明确授权转为 Ready for review 或请求 reviewer；转为 Ready 不构成合并授权。

查阅需求及 GMTrade 标签边界见 [Linear 需求查阅与复盘](linear-requirements.md)。
