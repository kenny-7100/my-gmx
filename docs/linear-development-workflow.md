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

### 前端测试证据绑定

2026-10-27 新增显式 `--frontend-report PATH`，用于把已有前端离线测试报告与本次交付目录、head 和源码绑定，避免只人工比较 commit。必须同时使用 `--require-clean`，不改变未选择证据检查的默认行为：

```sh
yarn agent:delivery-check --project-dir /path/to/delivery-checkout --require-clean \
  --head FEATURE_DELIVERY_BRANCH --expected-base FULL_RELEASE_SHA \
  --allow-path src/path/to/feature.ts --allow-path src/path/to/feature.spec.ts \
  --frontend-report /path/to/frontend-offline/run-id/report.json
```

先在目标干净 checkout 运行[前端离线测试](frontend-offline-tests.md#验证独立-checkout)，再传入本次报告。检查只读取文件并计算指纹，不重新执行测试、不修改原报告。`frontendEvidence.status=passed` 要求：报告 schema/mode 和结果成功；目标绝对路径一致；测试前后源码身份与当前目标完全一致，commit 等于交付 head 且 dirty 为 false；当前工具指纹一致；测试进程及临时目录清理通过；原生 Vitest JSON 中精确选定文件及断言全部通过、无跳过/待办，计数与报告一致。工作区和原有提交历史检查仍必须独立通过，才会整次 passed。

未指定时 `frontendEvidence.status=not-checked`。证据缺失、失败、旧提交、源码或工具变化等返回 blocked / 退出 2，finding 为 `frontend-evidence-invalid`，包含失败阶段及适用的断言说明。无效/缺失原生结果不会被报告中的 passed 字段覆盖；不带 `--require-clean` 或空报告路径也会拒绝。报告输出绑定的路径、testedCommit、源码摘要、suite 与计数。使用绝对报告路径便于跨 CWD 调用，原生 `resultsFile` 必须仍可读取；本入口不自动重定位已搬迁产物，归档包仍按证据包流程独立核验。

这是本机源码与已有结果的一致性检查，不是签名或对抗篡改的证明；覆盖范围沿用前端指纹计划，不覆盖所有安装依赖、静态资源或部署身份。只接受报告所选测试，不判断它们是否充分覆盖需求，也不替代其他验收。工具变化后需重新运行相关测试，不能手改历史指纹。检查后目录或提交变化时仍需重跑；它不锁定工作区。

真实独立 release clone 已验收：目标不含个人工具，原日期 5 项通过后成功绑定；错误目录、旧提交、失败报告、缺失/失败原生结果和旧工具指纹均拒绝。还在临时副本加入 Git 忽略的源码 JSON，HEAD 和 clean 状态不变，但源码摘要变化使旧证据被拒绝；移除后重新通过。只修改文件 mtime 时匹配仍通过，检查前后索引字节不变。实际排查确认 `git diff` 默认自动刷新索引，即使设置 `GIT_OPTIONAL_LOCKS=0` 仍可能写入；工具现显式禁用 `diff.autoRefreshIndex`，工作区文件列表改用禁用可选写入的 NUL porcelain status，避免只禁用 diff 刷新后把纯 mtime 变化误报为内容修改；mtime 场景已加入只读回归。目标 HEAD、索引、原报告与原生结果内容均保持不变；临时 clone 已删除。证据位于本机忽略目录 `.local/acceptance/delivery-check/frontend-evidence/`，`acceptance.json` 汇总、`matched.json` / `restored.json` 为通过报告，其余命名报告保存预期拒绝结果。

### SDK 测试证据绑定

2026-10-27 新增 `--sdk-report PATH`，将[SDK 离线测试](sdk-offline-tests.md#独立交付目录验收)报告与交付 checkout 的 `sdk/`、交付 head 和当前源码绑定。先在目标干净目录完成测试，再从基础设施目录运行：

```sh
yarn sdk:test-offline --sdk-dir /path/to/delivery-checkout/sdk \
  --suite src/utils/__tests__/bigmath.spec.ts
yarn agent:delivery-check --project-dir /path/to/delivery-checkout --require-clean \
  --head FEATURE_DELIVERY_BRANCH --expected-base FULL_RELEASE_SHA \
  --allow-path sdk/src/path/to/feature.ts --allow-path sdk/src/path/to/feature.spec.ts \
  --sdk-report /path/to/sdk-offline/run-id/report.json
```

必须同时使用 `--require-clean`。SDK 与前端报告可同时传入，分别检查；任一证据无效或原有交付隔离检查不通过，整次返回 blocked / 退出 2。不指定时 `sdkEvidence.status=not-checked`，不能理解为 SDK 已验收。

SDK 复用前端的原生结果与源码一致性校验：目标路径为本次 checkout 的真实 `sdk/`，拒绝 SDK 目录符号链接逃逸；报告前后源码证据须与当前 SDK 完全一致，包括 commit、dirty、全部既定源码输入及目标锁文件摘要。还比较当前 SDK 工具指纹、Vitest 版本与真实运行器路径。结果必须包含精确所选文件的全部通过断言，无 skipped/todo，统计一致，执行及临时目录清理成功。检查不重新运行测试、不安装依赖、不修改报告或 Git 索引。

成功结果输出 `sdkEvidence` 的报告路径、目标 SDK 路径、testedCommit、源码摘要、锁文件摘要、runtime、suite 与计数。失败 finding 为 `sdk-evidence-invalid`，包含阶段及适用的断言说明。缺少结果文件或只有汇总 passed 均不能通过。原生结果路径必须可读取；源码/工具变化后重跑相应测试，不手改历史指纹。

边界与前端证据相同：不证明测试充分覆盖需求，不验证所有已安装依赖，也不是签名或原子快照；检查后目录或提交变化需重新验收。只读 Git 调用禁用可选索引写入，SDK 指纹能力由运行器与交付检查共享，避免两份计划漂移。

真实 `origin/release` 临时 clone 已验收：目标没有个人工具，SDK 原 BigMath 6 项通过后成功绑定；同时传入真实前端日期 5 项报告也通过。错误目录、旧工具、失败报告、缺失/失败原生结果均拒绝；Git 忽略的源码变化即使 HEAD 和 clean 状态不变也拒绝，恢复后通过。实际新增 SDK 源码提交后，旧报告在工作区 clean 的情况下被拒绝。通过及负面检查前后 HEAD、索引字节、原报告与原生结果内容保持一致；临时 clone 已删除。隔离验收显式链接现有依赖，没有执行全新安装。证据在忽略目录 `.local/acceptance/delivery-check/sdk-evidence/acceptance.json`，`combined.json` 保存双报告通过结果。 统一工具回归 95 项、SDK 默认 153 项、类型检查、前端 3,014 项（另 1 项既有跳过）、脚本静态检查及 128 个文档本地目标检查均通过。

### 浏览器测试证据绑定

2026-10-27 新增 `--browser-report PATH`，将[独立 checkout 浏览器冒烟](solana-browser-smoke.md#验证独立功能-checkout)的实际结果与当前交付版本绑定。先在干净目标目录完成页面测试，再从基础设施目录执行：

```sh
yarn solana:browser-check --project-dir /path/to/delivery-checkout --port 3016
yarn agent:delivery-check --project-dir /path/to/delivery-checkout --require-clean \
  --head FEATURE_DELIVERY_BRANCH --expected-base FULL_RELEASE_SHA \
  --allow-path src/path/to/feature.ts \
  --browser-report /path/to/solana-browser/managed-id/report.json
```

必须同时使用 `--require-clean`；可与 `--frontend-report`、`--sdk-report` 同时传入，逐项独立检查，任一无效即整次 blocked / 退出 2。未选择时 `browserEvidence.status=not-checked`。工具只读取文件并计算当前指纹，不启动浏览器、服务、网络探测或测试发现，不重跑页面用例，不安装或构建。

检查要求浏览器报告 schema/scope 正确且 passed；目标绝对路径一致；`targetBefore/targetAfter` 与当前目录、源码、commit/dirty、Vite/SDK 运行时和资产证据完全一致，commit 为交付 head，工作区 clean。工具指纹由浏览器入口和交付检查共用，前后摘要必须与当前工具一致。读取报告引用的预检文件以取得本次本地运行时计划，并重新核对目标与基础设施的真实配置和 JS/WASM 字节；缺文件、损坏或不兼容明确拒绝。

原生 Playwright JSON 必须仍可读取：只接受 loopback 目标下原有两项 `network.spec.ts` 的实际通过执行，无跳过、重试、runner error 或异常退出；统计及 checkout 元数据与汇总一致，原生元数据路径/commit/dirty 也须匹配当前交付目录。服务清理必须为 `port-released`。只有汇总 passed、只有测试发现结果或失败后残留的成功原生结果都不能通过。

成功输出 `browserEvidence` 的 reportFile、testedCommit、sourceSha256、runtime 和 stats；无效证据 finding 为 `browser-evidence-invalid`，包含失败阶段及适用的断言说明。报告、预检和原生结果路径均须可读取；归档搬迁不在此入口自动重定位。旧工具报告需重跑浏览器测试，不手改摘要。

本项只核对两项既有页面冒烟证据与当前交付身份，不证明需求充分覆盖、全部外部服务可用或完整环境一致；也不是签名或原子快照。沿用浏览器入口的源码和资产范围，CSS、其他静态资源及完整依赖树不在该指纹计划内。检查后目录变化须重新验收，不能以交付检查 passed 替代业务验收。

真实本地 `origin/release` 临时 clone 已验收：目标不含个人工具，原有两项网络选择用例在真实 Chrome 中通过后成功绑定；同时传入前端日期 5 项、SDK BigMath 6 项报告也通过。错误目录、旧工具、失败报告、缺失/失败原生结果和清理失败均拒绝；Git 忽略的源码变化在 HEAD/clean 不变时被拒绝，恢复后通过；实际新增源码提交后，旧报告在 clean 状态下仍拒绝。检查前后 HEAD、索引字节、原报告及原生结果保持一致，临时 clone 已删除。本轮隔离验收显式复用已安装依赖和准备资源，没有执行全新安装或构建。证据在忽略的 `.local/acceptance/delivery-check/browser-evidence/acceptance.json`，`combined.json` 保存三类报告共同通过结果。 本轮统一工具测试 96 项、根类型检查、相关脚本静态检查及 134 个文档本地目标检查通过；全量前端回归 3,014 项通过、1 项既有跳过。

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
