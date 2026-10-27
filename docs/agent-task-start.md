# 全栈 Agent 任务启动卡

更新日期：2026-10-27。适用于前端、SDK、gmx-api 的全栈开发、测试与验收，以及 Solana 专项和配套基础设施维护。先读根 [AGENTS.md](../AGENTS.md)，再按本卡选择当前任务需要的路径；无需逐项执行整张表。

## 开始前

1. **明确任务与授权。** 业务需求实时核对 Linear 正文、评论、关系及项目归属，按[需求工具说明](linear-requirements.md)使用 `yarn linear show FESOL-123 --live --json`；纯基础设施任务按用户范围实施，不顺带开发业务。仅要求 push 时直接按根规则执行，不插入以下检查。
2. **明确目标身份。** 下表命令均从含个人工具的基础设施 checkout 根目录执行。将 `/path/to/feature`、`/path/to/api`、`/path/to/report.json` 等占位路径换为实际路径；目标各自具备锁定依赖。当前离线工具要求 Node 22，完整环境前置见[执行顺序](coding-and-self-review.md#执行前的环境检查与顺序)，版本选择、Node 20/22 差异及独立目录要求见[运行版本矩阵](agent-runtime-matrix.md)。
3. **先定义验收再选工具。** 按[验收映射](agent-acceptance-workflow.md)记录条件、预期、数据模式、目标版本和未覆盖项。涉及已有线上行为或真实数据时，先查[GMX 服务表](gmx-live-services.md)、[GMTrade 服务表](gmtrade-live-services.md)和页面实际请求，再验证本地或 PR 版本。Solana 开发还需按[参考仓库说明](solana-reference-repositories.md)核对 ADR、SDK 和协议版本。

跨仓库任务先按[实际目标环境检查](agent-environment.md#实际目标目录检查)显式传 --project-dir/--api-dir，按[全栈目标配置](agent-test-plan.md#全栈目标配置)记录各侧基线和 API profile，复用原运行器执行；结果用[运行材料收集](agent-evidence.md#从全栈执行结果收集材料)整理。基础设施建设不修改业务代码、业务测试预期、迁移或业务依赖。

不清楚本机前置条件时，可先用[环境清单](agent-environment.md) `yarn agent:environment --checks node,yarn,frontend` 盘点所需项；它只检查基础设施 checkout，不替代目标目录自己的测试前置或真实服务预检，也不要求每个任务运行全部检查。

## 按任务选择入口

| 当前任务 | 首选命令与前置 | 读取结果与下一步 |
| --- | --- | --- |
| 纯文档修改 | `yarn agent:docs-check --file docs/PATH.md` 检查本次相关文件的本地链接与锚点；另核对命令和 `git diff --check` | 按[文档维护约定](documentation-maintenance.md)更新索引；无需类型、UI 或构建检查 |
| 前端/SDK/API 跨仓库测试 | 先 `yarn agent:environment --project-dir /path/to/frontend --api-dir /path/to/api --checks node,yarn,frontend,sdk,api`；`yarn agent:test-plan --targets /path/to/targets.json` 后显式 `agent:test-run --plan /path/to/report.json --scope all` | [全栈配置](agent-test-plan.md#全栈目标配置)分别固定基线、API profile 和未覆盖项；数据库需单独检查前置。执行结果按[材料收集](agent-evidence.md#从全栈执行结果收集材料)归档，不升级业务结论 |
| 前端局部测试，已知 suite | `yarn frontend:test-offline --project-dir /path/to/feature --suite src/lib/dates.spec.ts`；替换为当前任务的真实 suite | [前端入口](frontend-offline-tests.md)输出精确 suite、原生 Vitest 结果、网络审计和源码身份；默认范围只覆盖少量固定测试 |
| SDK 局部测试或影响发现 | `yarn sdk:test-offline --sdk-dir /path/to/feature/sdk --discover-only --related src/utils/stats/api.ts`；路径相对目标 SDK | [SDK 入口](sdk-offline-tests.md)发现后检查真实依赖，再用 `--suite` 执行；SDK 变化同时考虑前端消费者 |
| 前端/SDK 源码变化，需要规划两侧范围 | `yarn agent:test-plan --project-dir /path/to/feature --changed-since origin/release`；基线必须属于目标仓库 | [联合规划](agent-test-plan.md)读取两侧清单，适合离线时显式 `yarn agent:test-run --plan /path/to/plan/report.json --scope both`；源码、范围或工具变化后重新规划 |
| 配置、资源、删除或混合文件变化 | 按真实影响人工选测试、页面或构建范围，参考[执行顺序](coding-and-self-review.md#执行前的环境检查与顺序) | 源码规划器的 blocked 不能当成无需测试；共享 SDK 的依赖组可能很大，不能只挑通过的 suite 宣称整组通过 |
| API 影响发现与离线计算测试 | `yarn gmx-api:discover-tests --api-dir /path/to/api --changed-since origin/release`；使用 API 自己的基线；审查清单后 `yarn gmx-api:test-offline --api-dir /path/to/api --suite src/path/to/module.test.ts` | [API 入口](solana-api-local.md)保留 Jest 原始结果、网络及身份；离线测试不允许数据库或真实 RPC |
| API 数据库、生成路由或类型检查 | 先按 [API 任务导航](solana-api-local.md#按任务定位)选择所需环境，依赖路由时按[准备流程](solana-api-local.md#gmx-api-路由生成准备与过期检查)处理；数据库场景用 `yarn gmx-api:test-integration --api-dir /path/to/api --suite src/path/to/module.test.ts`，依赖路由时加 `--require-routes`；类型检查用 `yarn gmx-api:tscheck --api-dir /path/to/api` | 临时数据库要求本地 Docker 和已有 `postgres:15` 镜像；工具不拉镜像、不使用现有数据库。路由生成及服务启动先核对授权 |
| 本地 Solana 网络选择页面冒烟 | `yarn solana:browser-check --project-dir /path/to/feature --port 3015`；目标依赖及固定 SDK/WASM 资源齐备，端口空闲 | [浏览器入口](solana-browser-smoke.md)内置预检、独立 Vite、两项真实 Chrome 用例和停服，保留报告及源码身份；只证明这两项网络选择行为 |
| API/Vite 组合联调和断点 | 先 `yarn solana:dev doctor --project-dir /path/to/feature --api-dir /path/to/api`；按[工作区说明](solana-dev-workspace.md)选择服务、空闲端口和授权，再 up 或一次性 check | 核对目标目录、owned/borrowed、trace 和 cleanup；sample 代理探测不证明业务页面消费 API，不关闭借用服务 |
| 真实只读依赖检查 | 按[预检文档](agent-preflight.md)选择 `yarn agent:preflight --checks rpc,keeper`；RPC 先有已授权代理；只有任务确需钱包时才显式选择 wallet | 读取逐项状态、时间和退出码；`api` 项仅检查默认本机 3004 sample，不是远端 API 部署验收；自定义 API 路径/端口走独立入口 |
| PR 预览页面验收 | `yarn agent:preview --pr 123 --expected-sha FULL_PR_HEAD_SHA` | [预览入口](agent-preview.md)只定位不可变 URL；另按需求执行页面验收，生产基线不能替代当前 PR 版本 |
| 工作表与证据移交 | `yarn agent:acceptance --file /path/to/worksheet.md`；按[证据包说明](agent-evidence.md)使用 `yarn agent:evidence pack` 显式选择报告和工作表，再用 `yarn agent:evidence verify` 核对独立保存的 manifest 摘要 | 工作表一致不等于覆盖完整；需求交付默认按[交接步骤](agent-evidence.md#交付默认步骤)准备包和包外原始产物清单；未实际移交写仅本机可用。证据完整不等于业务通过，包外保存摘要，不修改冻结工作表；多入口结果按[联合交接说明](agent-evidence.md#前端sdkapi-离线证据联合交接)附加原生结果、日志和网络事件并复核 |
| 业务交付隔离 | 按[交付流程](linear-development-workflow.md#交付隔离自动检查)在干净交付版本使用 `yarn agent:delivery-check --require-clean`，显式传目标目录、head、base、开发基础、允许文件和原始测试报告 | 基于最新上游 release，只交付当前需求；个人工具留在基础设施目录。规划报告及联合执行汇总不能代替单侧原始测试报告；Git 写操作遵循根授权 |

离线测试、规划、浏览器和工作区报告保存在基础设施目录的 `.local/acceptance/` 对应主题子目录；以本次 stdout 给出的实际路径为准，保留报告引用的日志、原生结果和网络事件文件。`agent:preflight` 默认只输出 JSON，需自行重定向保存；工作表检查同样只输出检查结果，不修改输入。不要把其他 checkout 的历史结果当作当前目标的证据。

## 结束与受阻处理

出现非预期退出或结果矛盾时，按[失败诊断手册](agent-failure-diagnosis.md)选择排查顺序和停止条件，保留本次失败证据后再重跑受影响项。

- **接受结果前：** 等待最终退出码，核对实际 suite/计数、目标目录与 commit、前后源码/工具身份、网络审计及进程/临时目录清理。退出码含义按各工具文档读取；`agent:acceptance` 的退出 2 可以表示合法但未完成的验收，不能套用单一退出码规则。
- **区分证明范围：** discovery/plan passed 只证明发现成功；原生测试 passed 只证明所选测试；预检 passed 只证明选定依赖；业务验收必须回到逐项条件。保留 failed、blocked、not-run、partial 及下一步，不改写旧报告取得 passed。
- **遇到资源缺口：** 远端 API 缺地址/版本、契约未评审、样本/权限/凭据缺失时，暂停依赖工作并说明需要协调的资源；可以继续独立项。现有[阶段结论](agent-acceptance-infrastructure.md#当前阶段与接手结论2026-10-27)区分当前接手结论与历史证据，使用前核对；A03 资源与验收门槛见该入口，不猜测、不换源或用 sample 冒充真实数据。
- **操作边界：** 本地 Vite/Chrome 已有长期授权；构建、其他服务、部署按根规则核对。钱包读取不授予签名或广播，当前 RPC 代理禁止发送；不为验收补业务实现或真实资金流程。
- **收尾：** 在对应工作表/主题文档记录日期、命令、版本、退出码、证据与未覆盖项；基础设施推进更新[路线表](solana-agent-friendliness-roadmap.md)。服务只清理本任务所属资源，失败先查日志和归属，不盲目结束其他任务。
