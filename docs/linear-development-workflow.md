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

### FESOL-89 与 FESOL-96 的合并范围（2026-11-03）

用户确认这两条需求作为一个独立切片实施，之后由用户合并 Linear issue；本次允许共用 `solana-wallet-balances-fesol-89` 分支，从当时的 `solana-integration`（`e8015302585f74d632d5fea34c65533d20ab4d2b`）创建。此约定只适用于这两条需求，不改变其他需求的分支规则。

范围为配置资产的 ATA 余额 reader、最小 Solana RPC 适配及统一 SWR hook。Alchemy URL 与 key 选择复用 `src/config/rpc.ts` 的 EVM 公共逻辑；不新增服务、凭据配置或公共 RPC 兜底，也不等待旧需求或尚未交付的代理 PR。当前开发基础已有的本地代理入口继续保留，交付时需按内容隔离，不能直接带入个人配置。

共享调用入口为 `src/domain/solana/useSolanaBalances.ts`，接收显式 owner，以 `networkId + owner` 构造缓存及失效 key，动态加载 reader。钱包会话、账户弹窗与 USD 展示仍属 FESOL-51，真实交易后的失效调用仍属 FESOL-56。实施分支的通过结果不代替最新 release 上的干净交付验收。

#### release 交付分支重建（2026-11-03）

用户要求按最新 release 的原有 RPC 方案重建独立分支，已创建 `solana-wallet-balances-release-fesol-89`，工作区位于 `/Volumes/kenny/gmx/gmx-interface-fesol-89-release`。提交 `c55f42918ac9e07a580442e80e8cfa11f50486db` 的直接父提交为当时远程最新 release `51205a828c313886463a38714f765f4697a49521`。原 `solana-wallet-balances-fesol-89` 开发分支保留；后续针对交付分支的 Git 操作必须使用上述独立目录，不要在基础设施目录误推开发分支。

交付范围只有 6 个文件：中央 `src/config/rpc.ts`、RPC client、余额 reader、共享 hook 和两份余额测试。Solana 直接引用 release 原有的 fallback key，EVM 原有环境/用途选择逻辑不变，不依赖 `solanaRpc.json`、localhost、个人代理、协作文档、脚本或额外 package/lock 改动。release 已具备 Kit 5.5.1 和静态配置，无需捎带其他需求。key 经生产 Origin 的 Mainnet genesis 实际读取通过。

独立目录已按自身根及 SDK 锁文件安装依赖，使用 release 的原生 SDK 构建；完整类型检查及 lint 通过；交付目录全量单元测试 3171 项通过、1 项原有跳过。提交后的 19 项定向测试通过，报告绑定交付目录、干净状态与上述 commit；交付隔离检查通过，无个人开发基础提交和额外路径。原开发分支的浏览器真实联调不冒充交付分支的浏览器/构建验收。证据仅在本机 `.local/acceptance/frontend-offline/solana-balances/delivery-*.json` 与日志。已创建 [Draft PR #3190](https://github.com/gmx-io/gmx-interface/pull/3190)，目标为 `release`，head 为上述 `c55f42918a`；未请求 reviewer。

本次交付发现：个人 `my-gmx`（`kenny-7100/my-gmx`）是独立仓库，不属于上游 fork 网络，GitHub 拒绝直接从其分支创建上游 PR。相同提交已另推送至账号下现有正式 fork `kenny-7100/gmx-interface`，通过个人 remote `my-gmx-pr` 创建 PR；原开发分支及协作文档仍推送 `my-gmx`，未向 `origin` 推送。后续跨仓库 PR 应先核实 GitHub 的 `isFork` / `parent`，不能仅凭 remote 名称判断。

已核对实际 PR head、base、6 个文件及完整 diff，与本地验证版本一致。按 gmx-prompts 做 T2 人工自审，检查 hook 生命周期及钱包切换、原生与包装资产区分、bigint 精度、RPC 批次顺序与错误传播、功能开关和懒加载，未发现需修改的问题。当前会话无 `/code-review` 工具，不声称已运行该工具。创建后的 GitHub CI 正在执行，不作为已通过记录。

本地证据包 `.local/acceptance/evidence/fesol-89-c55f42918a-pr` 已打包并使用包外预期摘要验证，`manifestIdentity=matched`；SHA-256 为 `973fbee69bde3780ccda2a15a9b8a3efa272d8d0dbfb02f68ea4da63e6757264`。包内有冻结工作表、检查报告、源码身份及隔离摘要、定向测试原生结果/日志/网络记录、全量测试日志。工作表结论为 partial，保留交付分支生产前端构建及浏览器联调未执行项；空的 SDK/typecheck stdout 日志未打包，其结果见执行摘要。归档仅本地准备，未上传或移交，不作为 PR 附件。

## 默认交付证据归档

需求完成相关验收与最终交付隔离检查后、创建或更新 Draft PR 前，默认按[证据包交接步骤](agent-evidence.md#交付默认步骤)准备可移交材料。包括：冻结的工作表及其一致性报告、支持打包的实际工具报告、包外保存的 manifestSha256，以及未纳入包的原生测试结果、日志、截图/trace 和交付检查报告清单。按真实目标 commit、观察时间和未覆盖项记录，不能用开发目录历史通过替代最终交付版本。

`agent:evidence --report` 只接受白名单报告；测试 JSON、日志、截图等可用显式 `--artifact name=PATH` 原样附加，不推断业务语义，也不递归收集引用文件。记录原路径到附件名的对应；超出附件限制或需要目录结构的材料仍在包外单独准备，明确范围、摘要及可用性。不得强改 scope 或手工往受校验包中塞额外文件。尚未复制给接收方的材料写“仅本机可用/未移交”，不能把 `.local` 路径写成共享附件。接收方核对包外摘要并验证包，再核对独立产物和需求覆盖。

流程只要求在已授权交付中准备材料，不自动上传、发消息、创建 PR 或扩大 Git 授权；仅要求 push 时仍直接按根规则执行。详细命令与交接记录模板只维护在证据包文档。完整真实需求交付仍待实战验证。

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

前端及 SDK 离线报告还须通过运行器侧网络审计：`network.status=passed`、安装数等于所选文件数、拒绝次数为 0。交付检查重新读取 `network.eventsFile`，将原始事件与报告汇总比较；事件文件缺失或追加拒绝事件均 blocked。保留事件日志和原生结果一起交接，原生 success 不能覆盖网络审计失败。

前端与 SDK 报告还必须记录 `toolingUnchanged=true`，且 `toolSha256` / `toolSha256After` 均等于当前工具指纹。执行中工具变化、缺少复核标识或最终指纹均拒绝；历史报告使用当前工具重跑，不复制字段。实际工具漂移复现与双报告通过、8 种字段异常拒绝验收见[工具指纹说明](frontend-offline-tests.md#结束时核对工具指纹)。该检查沿用原摘要范围，不证明完整依赖安装或对抗篡改。

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

### API 测试证据绑定

2026-10-27 新增可重复的 `--api-report PATH`，用于 API 交付 checkout 的离线和隔离数据库报告。先在干净目标运行所需的[API 测试](solana-api-local.md#在独立-api-checkout-中运行测试)，再从基础设施目录检查该 API 仓库的交付差异与报告：

```sh
yarn agent:delivery-check --project-dir /path/to/api-delivery-checkout --require-clean \
  --base origin/release --development-base API_DEVELOPMENT_BASE \
  --head API_DELIVERY_BRANCH --expected-base FULL_API_RELEASE_SHA \
  --allow-path src/path/to/feature.ts \
  --api-report /path/to/offline-id/report.json \
  --api-report /path/to/integration-id/report.json
```

`--project-dir` 此处是 API 仓库根目录，`--development-base`、`--head` 和 release SHA 必须使用该 API 仓库的实际引用；不能照搬前端仓库的身份。必须显式 `--require-clean`，同一报告不能重复传入。可以只选任务所需的一类报告，工具不替用户决定覆盖范围；未选时 `apiEvidence` 为空。前端/SDK/浏览器参数仍核对当前 `--project-dir` 的同一仓库，不用于将另一个仓库的测试结果混入 API 检查。

API 运行器现在保存 schema、测试前后 Git 身份、源码聚合指纹、工具摘要和 Node/Jest/ts-jest/TypeScript 版本；运行中工具或版本变化也不能通过。交付检查重新读取目标所选测试、必要配置与全部 API TS/JS/JSON 源码；集成模式额外读取原 Jest/DB setup 与迁移。目标路径、clean HEAD、源码前后和当前摘要均须匹配，不能仅以 commit 或汇总 passed 判定有效。

检查还会重新读取报告引用的原生 Jest JSON 与网络事件日志，要求精确且唯一的所选 suite、实际断言全部执行通过、无 skip/todo、正常退出和所属进程清理完成；离线临时目录或集成容器/目录清理必须通过。网络安装数须等于 suite 数，拒绝数为 0，guard 摘要及集成网络策略保持一致。计数须与原生结果相同。保留这些原始文件；旧报告缺字段、文件缺失或指纹变化时重跑相关测试，不手改历史报告。

若集成报告声明 `generatedRoutes.status=passed`，检查还会只读运行路由 verify，并逐项比较测试前、测试后及当前的 schema、API 目录、源码输入、实际生成器与产物摘要。任一证据缺失、失败、收据缺失或当前产物/生成器过期，均在 `generated-routes` 阶段 blocked；不会自动生成或启动数据库。未记录此字段的历史报告和严格的 `{status: "not-checked"}` 保持原行为，结果明确标记 not-checked；它们不能证明路由已验收，依赖路由的任务必须使用 `--require-routes` 重跑。

逐份结果在 `apiEvidence` 中，包含报告路径、模式、testedCommit、sourceSha256、suite 和计数；无效证据产生 `api-evidence-invalid` finding，整次 blocked / 退出 2。检查只读取本地文件并运行只读 Git 命令，不启动数据库、HTTP 服务或测试，不 fetch、安装、构建、切分支或修复文件。

本项核对测试结果与交付版本的对应关系，不证明需求覆盖充分、真实数据正确或完整已安装依赖的字节一致；工具摘要和版本也不是签名或原子快照，检查后变更须重新验收。

真实验收：以本地 API `origin/release` 建立独立 clone，仅为验收显式链接 package/lock 一致的已有依赖，以 README 的临时提交建立非空交付差异。原收益计算 6 项和市场数据库 4 项通过后，两份报告共同绑定成功；事件日志追加拒绝事件、缺日志、原生结果失败、错误目录、旧工具/运行时、dirty 源码均拒绝，恢复后通过。再提交新的 HEAD，旧报告在 clean 状态下仍拒绝。检查未改变 Git 索引字节，验收 clone 已删除，真实业务源码未改动。证据为本机忽略目录 `.local/acceptance/solana-api-local/api-delivery-{acceptance,passed,offline,integration}.json`。

本轮工程检查：API 默认离线 12 项、隔离数据库 5 项及统一工具 99 项通过，SDK 产物 verify、根类型检查、相关 ESLint/Prettier、140 个文档本地目标与差异检查通过；完整前端回归 3,014 项通过、1 项既有跳过，退出 0。默认报告及工具、类型、前端日志分别为同目录 `api-delivery-default-{offline,integration}.json`、`api-delivery-tools.tap`、`api-delivery-tscheck.log`、`api-delivery-test-ci.log`。

生成路由交付复核验收（2026-10-27）：独立 API release clone 的既有 routeMap/HTTP 两个 suite 共 6 项通过，带路由来源的报告绑定成功；生成产物变更、实际生成器变更、收据丢失、测试后证据缺失及失败状态均被拒绝，恢复后通过。默认数据库 5 项报告在移除路由收据后仍可绑定，明确返回 not-checked。交付检查前后目标 Git 索引字节、原报告及容器清单不变，真实 API 源码和既有调试服务不变，临时 clone 已清理。本机证据为忽略目录 `.local/acceptance/solana-dev/delivery-routes-acceptance.json`，该文件记录原始测试报告路径；复用 package/lock 一致的已安装依赖，没有执行全新安装或构建。 工程检查：统一工具回归 105 项、SDK 产物 verify、根类型检查、相关 ESLint/Prettier、149 个文档本地链接及差异检查通过；完整前端回归 3,014 项通过、1 项既有跳过，退出 0。日志位于同目录 `delivery-routes-{tools.tap,tscheck.log,test-ci.log}`。

### API 类型检查证据绑定

在干净的 API 交付 checkout 上先运行 `yarn gmx-api:tscheck --api-dir PATH`，保留原始报告和 `tsc.log`，再从基础设施目录执行：

```sh
yarn agent:delivery-check --project-dir /path/to/api-delivery-checkout --require-clean \
  --base origin/release --development-base API_DEVELOPMENT_BASE \
  --head API_DELIVERY_BRANCH --expected-base FULL_API_RELEASE_SHA \
  --allow-path src/path/to/feature.ts \
  --api-typecheck-report /path/to/typecheck-run/report.json
```

该参数只接收 `api-typescript-no-emit` 报告，必须显式 `--require-clean`。可以与同一 API checkout 的一个或多个 `--api-report` 测试报告共同使用，分别核对类型检查与所选测试；不把类型检查报告传给 `--api-report`。未选择时 `apiTypecheckEvidence.status=not-checked`，工具不替需求决定是否必须做类型检查。

交付检查只读核对报告的 schema、模式和成功状态，要求编译前后及当前的规范化目录、干净 HEAD、源码输入与实际 TypeScript/工具指纹一致，原生编译退出 0、无信号/中断/超时/清理异常，且三份路由来源证据一致；重新读取原始日志并核对 SHA-256。源码扫描范围与依赖指纹边界沿用[API 类型检查说明](solana-api-local.md#独立-api-checkout-的类型检查)，不扩展为所有第三方依赖验证。旧报告缺日志摘要、日志缺失/变更、工具/编译器/产物变更时必须重跑类型检查，不能手改历史字段。

成功结果记录在 `apiTypecheckEvidence`，包含报告路径、testedCommit、sourceSha256、TypeScript 版本及日志摘要。证据无效产生 `api-typecheck-evidence-invalid`，附检查阶段，整次 blocked / 退出 2。不重新执行 tsc、生成、安装、构建、启动服务或写 Git；交付差异仍独立接受原有来源和文件清单检查。报告及摘要是本地来源证据，不是签名或原子快照，不证明业务行为通过。

真实验收（2026-10-27）：独立 API release checkout 的原生类型检查通过后，报告单独绑定及与默认离线测试报告共同绑定均成功。日志篡改/缺失、缺摘要的旧报告、失败/中断、错误目录、缺测试后证据、实际 TypeScript 编译器变化、生成路由变化，以及 Git clean 时被忽略的 scripts 输入变化均被拒绝；恢复后通过。新增干净 HEAD 后旧类型检查和测试报告共同被拒绝。交付检查未改变目标索引、原报告或日志，未新增容器，已有调试服务身份不变；临时 clone 已删除，实际 API 业务源码未修改。只为验收显式复用了 package/lock 一致的已安装依赖，目标 TypeScript 另作隔离副本以验证编译器变化；没有全新安装或构建。证据位于本机忽略目录 `.local/acceptance/solana-dev/typecheck-delivery-acceptance.json`，其中列出本轮原始类型检查报告。

本轮工程检查：统一工具回归 107 项、SDK 产物 verify、根类型检查、相关 ESLint/Prettier、153 个文档本地链接及差异检查通过；完整前端回归 299 个文件、3,014 项通过，1 个文件及其 1 项既有跳过，退出 0。日志位于同一忽略目录的 `typecheck-delivery-{tools.tap,sdk.json,types.log,tests.log}`。

### 基础设施验收记录（2026-10-26）

本轮未创建主仓库分支或改写历史。临时仓库真实历史回归通过；主仓库 `HEAD` 与个人开发基础重合，实际只读检查正确返回 `development-base-history` 并退出 2，清单外文件也明确列出。检查前后主仓库 HEAD、索引和 4,511 个文件内容摘要一致。根类型检查、ESLint、Prettier、71 个文档本地目标及差异检查通过；完整前端单元测试 3,014 项通过、1 项既有跳过。证据保留在忽略目录 `.local/acceptance/delivery-check/`；工具本身仅向 stdout 输出 JSON，归档由调用者显式重定向完成。

### 独立目录与干净状态验收（2026-10-27）

真实临时 Git 仓库已验证干净交付通过、错误 HEAD、暂存/未暂存/未跟踪单独存在和组合状态均拒绝；忽略构建产物不误报，含空格、换行、Unicode 的文件名完整返回。检查前后 HEAD、索引字节及目标文件内容保持不变，原有开发基础历史与等价补丁拒绝路径仍通过。已从其他 CWD 用 CLI 显式选择临时交付目录验证通过，不要求目标包含工具。实际主开发目录带有当前未提交工具改动，严格检查正确 blocked，HEAD 和索引摘要前后相同；这是预期拒绝，不是交付通过。

本轮没有创建或切换主仓库分支，没有修改业务源码。证据在本机忽略目录 `.local/acceptance/delivery-check/worktree/`：`lifecycle.tap`、`tools.tap` 与 `main-readonly.json`。正式交付仍须按流程更新上游、检查完整 diff 和完成需求验收。

#### RPC 架构修订（2026-11-03）

用户明确确认：Solana 沿用公共节点作为 `default`、Alchemy 作为 `fallback`，尊重现有中央配置、健康跟踪和请求故障切换架构；不能以复用 key 常量代替架构复用。本次确认优先于 gmx-prompts Solana 规范中旧的单 Alchemy URL / 禁止公共节点方案，未修改规范仓库。

修订位于交付目录 `gmx-interface-fesol-89-release`，已提交为 `0159fcdb70` 并推送至个人镜像及正式 fork 的交付分支，更新 [Draft PR #3190](https://github.com/gmx-io/gmx-interface/pull/3190)。中央 `RPC_CONFIGS` 增加 Solana，Alchemy 直接复用原 `getAlchemyProvider` 的开发环境、DebugAlchemy 和用途选择，不更换任何现有 key。懒加载的 Solana RPC 适配器组合通用 `FallbackTracker`、`NetworkStatusObserver`、排序工具和 `withFallback`，探测 Mainnet genesis / confirmed slot，按 URL 缓存 client；失败时在备用节点重读整组账户，不拼接两端点的部分结果。余额 reader/hook 的业务接口保持不变，不引入 EVM 的大账户资格判断。PR 正文同步说明修订和实际验证结果，保留开发 Alchemy 的真实验收缺口；继续保持 Draft，不请求 reviewer。

真实 Chrome（生产 Origin）确认 `solana-rpc.publicnode.com` 支持跨域和 Mainnet，但 `getMultipleAccounts` 上限为 10；已在中央节点配置显式记录该限制，Alchemy 仍每批最多 100，读取资产范围不变。5 批并发读取各 10 个账户均成功。官方公共节点返回 403，dRPC 公共节点要求付费，OnFinality 公共节点返回限流错误，均未加入配置。不能只凭 genesis 或单账户读取通过就认定候选支持完整余额批次。

本轮修改版本的定向离线测试 28 项通过，完整类型检查、ESLint、Prettier、diff whitespace 通过；全量前端测试 3180 项通过、1 项原有跳过。独立 Vite + Chrome 实际调用修改后的 reader，通过公共节点返回 47 项资产，全部为 bigint，SOL 与独立 getBalance 一致；这不是钱包会话/UI 集成验收，也未运行生产前端构建。本次 Vite 已正常停止，未停止原开发目录的既有服务。离线报告 `.local/acceptance/frontend-offline/solana-balances/rpc-revision-tests.json` 绑定 dirty 源码指纹 `6c537f438e67c2ac7d8c96ceab0886242d37f403a594514cb59aecd006f9f451`，浏览器原始结果见同目录 `rpc-revision-browser.json`；均仅本机可用。

待用户处理：原有开发 Alchemy app 返回 `403: SOLANA_MAINNET is not enabled for this app`，需要在 Alchemy 控制台该 app 的 Networks 页面启用 Solana Mainnet，无需更换或在对话中提供 key。生产 fallback app 的 genesis 和账户读取正常。开发 fallback 的真实验收暂停，开通后再复验；不以固定生产 key 绕过。离线测试已验证 HTTP/RPC/超时错误及不完整批次的切换、全部失败时抛错、节点探测恢复、slot 异常及封禁排序。

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
