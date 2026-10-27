# 全栈测试范围规划与执行

更新日期：2026-10-27。支持前端、SDK 和独立 gmx-api checkout 的显式全栈计划；保留原前端/SDK 源码模式。属于个人开发基础，不复制到业务交付分支。用户确认的建设目标是让 Agent 承担全栈需求开发与验收；基础设施任务不修改业务源码、业务测试预期、数据库迁移或业务依赖。


## 全栈目标配置

从基础设施 checkout 调用已有入口：

```sh
yarn agent:test-plan --targets /path/to/targets.json
yarn agent:test-run --plan /path/to/plan/report.json --scope all
# Execute only explicitly selected scopes; other planned scopes remain not-run.
yarn agent:test-run --plan /path/to/plan/report.json --scope api-offline,frontend
```

配置文件仅描述目标与选择，不包含可执行命令。相对目录以配置文件所在目录解析。每个仓库必须独立选择 `base` 或 `related`，两者互斥。示例中的目录、基线和测试须换成实际目标：

```json
{
  "frontend": {
    "directory": "/path/to/frontend",
    "base": "origin/release"
  },
  "api": {
    "directory": "/path/to/api",
    "base": "origin/release",
    "profiles": {
      "offline": ["src/domain/pairs/solanaPairsRows.test.ts"],
      "database": ["src/domain/pairs/solanaPairsService.test.ts"]
    },
    "requireRoutes": false
  }
}
```

也可将某个仓库的 `base` 替换为 `"related": ["src/path/to/source.ts"]`，明确发现这些源码的相关测试；这只覆盖显式源码，不声明覆盖该仓库全部 Git 变化。可以只提供 frontend 或 api；不提供的仓库不参与计划。

API 必须根据测试真实依赖显式分配 profile，不能按文件名猜测。`profiles.offline` 调用原 API 离线运行器；`profiles.database` 调用原隔离 PostgreSQL 运行器。每个 suite 只能属于一个 profile，而且必须出现在本次 API 原生发现清单中。未分配的 suite 保留为 `uncovered / not-run`；需配置后重新规划。`requireRoutes=true` 对数据库 scope 启用原有路由来源检查；导入生成路由的 HTTP suite 应选择此模式。工具不自动生成路由、安装依赖、下载镜像或替换 SDK。

### 变化与结果边界

schemaVersion 2 的计划独立保存各仓库 Git 基线 SHA、HEAD、索引/工作区/未跟踪路径及变化内容摘要。可发现的前端/SDK 源码复用原 Vitest，API 源码复用原 Jest。配置、资源、迁移、删除、gitlink、非普通文件等不能自动发现的变化原样保留为 `uncovered`，不能因自动项通过而消失。配置/迁移等需另外明确验证方法，当前工具不执行任意补充命令。

- 全部发现成功、所有 API suite 已分配且没有未处理路径：计划 passed / 退出 0。
- 发现成功但有未处理路径或未分配 API suite：计划 partial / 退出 2。可显式执行已有自动 scope；运行结果仍保留缺口。
- 发现失败、零匹配或执行中身份变化：failed / 退出 1；参数或准备错误为 blocked / 退出 2。
- 没有变化且未显式选择源码，不能解释为验收通过。

执行 scope 为 `sdk`、`frontend`、`api-offline`、`api-database`，逗号组合或 `all`；必须显式指定，旧 schema 1 仍使用 `sdk|frontend|both`。顺序执行既有运行器，数据库仅创建所属临时容器，不启动常驻 API、worker、RPC 或浏览器。普通测试失败仍收集后续独立 scope；源码、配置、Git 范围、原始发现清单或工具变化则停止后续执行。API setup/迁移指纹也参与过期检查。

结果状态按 failed 优先、blocked 次之、未覆盖为 partial、全部所选通过且无缺口为 passed 汇总；未选 scope 明确记为 not-run。原生失败摘要保留 suite、测试名、有限错误文本、阶段及日志位置；它不是根因推断，敏感程度与原测试日志相同，归档前核对可分享性。不自动重试、裁剪 suite 或改写断言。

结果保存在基础设施 `.local/acceptance/fullstack/`。汇总绑定计划及原始单侧报告、日志/原生结果/网络事件摘要；交付检查仍使用原始单侧报告，不能将计划或汇总当成业务通过证据。多仓库分别通过不证明页面/API/worker 业务链路或 SDK 发布消费兼容。

### 本轮全栈验收

当前实施结果及本机证据见本文末尾的“全栈基础设施验收记录”；历史 schema 1 结果保留原日期，不自动升级为 schema 2 实测。

## 使用方式

从基础设施 checkout 根目录执行，目标需已有 Node 22 和两侧锁定依赖，无需构建、服务或浏览器：

```sh
yarn agent:test-plan --project-dir /path/to/feature-checkout --changed-since origin/release
# Include index, working tree and untracked sources relative to HEAD.
yarn agent:test-plan --project-dir /path/to/feature-checkout --changed-since HEAD
```

必须显式提供目标仓库中已有的 Git 基线；不 fetch、不创建或切换分支、不修改索引。沿用[前端 Git 范围规则](frontend-offline-tests.md#按-git-变更范围运行局部回归)，合并提交、索引、工作区和未忽略的未跟踪路径。只接受目标 `src/`、`landing/`、`sdk/src/` 内存在的源码文件；空范围、配置/文档/资源混入、删除或缺失路径均退出 2 / blocked，要求人工评估，不静默丢弃文件。

## 发现与结果

先收集一次完整范围，再顺序调用已有 SDK 和前端 `--discover-only`：

- SDK 范围只使用变化中的 `sdk/src/`，转换为 SDK 相对路径，发现 SDK 自身 suite；没有 SDK 源码变化时明确为 `not-applicable`。
- 前端范围保留全部前端及 SDK 输入，发现前端消费者，包含 SDK 经前端模块的传递依赖。不会把 SDK 变化从前端范围中删除。
- 两侧复用各自原 Vitest 配置、依赖图、网络保护、精确 suite 校验和所属进程清理，不执行测试、setup 或 global setup。不自动判断所选测试是否适合离线运行。

报告为 `mode=agent-test-plan`、`testsExecuted=false`。`scopes.sdk/frontend` 分别保留输入、精确 suite 和子报告路径；成功 scope 附 `executionCommand` 参数数组，调用方需按数组执行，不拼接成未经转义的 shell 文本。命令仅供人工/Agent 判断后执行，本入口不会自动调用它；大量 SDK 消费者可能更适合完整回归或特定服务环境。

任一必要 scope 发现失败，整体退出 1 / failed，仍保留另一侧已完成的发现结果；零匹配按既有发现器规则失败，不能自动解释为无需测试。报告通过还要求整个规划前后源码身份、Git 范围及工具摘要一致；检查不是原子快照，期间不要并发编辑或执行 Git 写操作。范围变化、源码变化或工具变化必须重跑。发现过程的网络/退出/清理证据在各自子报告中，父报告不制造测试计数或执行结果。

报告和子报告始终保存在基础设施 checkout 的忽略目录 `.local/acceptance/frontend-offline/`、`.local/acceptance/sdk-offline/`，目标不写入工具或结果。父报告使用 `test-plan-*` 独立目录。

**规划 passed 不表示任何测试通过，也不证明需求覆盖完整。** 它不能作为交付 `--frontend-report` 或 `--sdk-report`；交付仍需实际执行后生成的测试报告。依赖图对运行时拼接导入、非源码资源和外部数据的局限沿用两个原入口。选择局部命令前审查完整清单，不能只挑通过的 suite 来声称全组通过。

相关入口：[前端只发现](frontend-offline-tests.md#只发现关联测试)、[SDK 只发现](sdk-offline-tests.md#只发现关联测试)、[交付隔离与证据绑定](linear-development-workflow.md#交付隔离自动检查)。

## 按规划执行明确范围

读取规划清单并确认所选测试适合离线运行后，从基础设施目录显式选择 scope：

```sh
yarn agent:test-run --plan /path/to/test-plan/report.json --scope sdk
yarn agent:test-run --plan /path/to/test-plan/report.json --scope frontend
yarn agent:test-run --plan /path/to/test-plan/report.json --scope both
```

没有默认 scope。`both` 执行所有适用范围，SDK 为 `not-applicable` 时只执行前端；单独选择不适用的 SDK 范围会 blocked。执行器从已校验的 suite 路径调用原离线运行器，不执行规划中的 `executionCommand` 文本或参数数组，也不通过 shell 解释报告内容。保留规划及原始发现报告；清单必须与所选 scope 的原始发现报告一致，文件缺失、目标不一致或清单变化在执行前拒绝。

执行前、两侧执行之间和结束时，重新核对目标源码、Git 范围及规划工具摘要。规划失败、源码/暂存状态/HEAD/路径范围或工具变化时，先重新生成规划，不能手改旧报告的摘要或通过标记。执行期间还核对规划文件及执行器本身是否变化。不自动安装、构建、启动服务、跳过失败测试或修改业务代码；原有关联组需要 RPC 等外部依赖时，应先选择正确环境，不关闭离线保护器。

汇总报告为 `mode=agent-test-run`，保存在基础设施目录 `.local/acceptance/frontend-offline/test-run-*/report.json`，记录明确 scope、规划路径/摘要、每侧精确 suite、实际计数及原始执行报告路径。`testsExecuted` 表示至少一个原生测试进程已启动，不等于断言通过。任一所选范围失败则整体 failed / 退出 1；普通断言失败后仍收集另一侧结果，但源码或范围变化会阻止继续执行。执行前前置无效为 blocked / 退出 2，不启动测试。

汇总报告不作为 `--frontend-report` 或 `--sdk-report`。需要交付证据时，在干净交付版本上实际执行，并使用汇总中对应的原始单侧报告按既有规则绑定；未选择的 scope 没有执行证据。报告是本地可复核记录，不是安全签名；不允许以手工修改报告替代重新发现或执行。

执行器加入前的历史规划可能因规划工具源码变化而被拒绝；使用当前版本重新规划，不手改旧 `toolSha256`。scope 只支持完整 SDK、完整前端或两侧，不在执行阶段悄悄裁剪已发现的测试；确需不同范围时按原离线入口显式选 suite，并记录覆盖边界。

## 本轮验收

2026-10-27 在独立 `origin/release` 副本验收，目标不含个人工具，显式复用锁文件匹配的已安装依赖，没有执行全新安装：

- 真实 Stats 源码变化同时发现 SDK 原 Stats suite 1 个、前端消费者 178 个，未执行测试。两个原生子报告的网络、身份和清理均通过。
- SDK fixture 单独变化准确发现 SDK 1 个、前端 1 个 suite；混入前端日期测试源码后，SDK 仍为 1 个，前端并集为 2 个。只有前端变化时 SDK 为 `not-applicable`，前端 1 个。fixture 测试含顶层报错，发现通过证明未执行测试模块。
- 无覆盖源码使两侧发现失败、整体 failed；配置混入、删除和空范围均 blocked，不回退默认范围。配置在发现期间新增源码后，结束 Git 范围复核正确失败，未接受前端单侧的发现成功。
- 真实父报告被前端和 SDK 交付证据模式校验拒绝；没有生成正式测试执行日志或结果。目标 HEAD/索引/源码恢复状态已核对，临时副本清理完成，真实业务文件未改。

本机原始证据在忽略目录 `.local/acceptance/frontend-offline/test-plan-acceptance.json` 及其所列父/子报告；工具不把这些发现结果当成测试通过或需求覆盖证明。

工程检查：工具回归 113 项、SDK 产物只读 verify、根类型检查、相关 ESLint/Prettier、155 个文档本地链接及差异检查通过。完整前端回归 299 文件 / 3,014 项通过，既有跳过 1 文件 / 1 项；日志为同一忽略目录 `test-plan-{tools.tap,artifacts.log,types.log,tests.log}`。本轮只修改基础设施命令及文档，没有修改业务源码、原业务测试、生产配置或依赖版本，没有构建或启动服务。

按规划执行验收（2026-10-27）：独立 release 副本内，原 SDK Stats 7 项与原前端日期 5 项通过同一规划的 `both` 实际执行；传递依赖 fixture 两侧各 1 项，SDK/前端单选各 1 项均通过。规划中的命令数组替换为写文件载荷后，执行器仍只调用所选原生测试，载荷文件未创建。源码变化、暂存范围变化、旧工具摘要、失败规划、清单与原始发现不符、发现报告缺失均在执行前 blocked；SDK 断言失败而前端通过时整体 failed，未隐藏 SDK 失败。只有前端变化时 both 执行原日期 5 项，单选不适用的 SDK 被拒绝。真实汇总报告被两侧交付证据模式校验拒绝。

成功单侧报告的源码、工具、网络与两类清理均通过；目标 HEAD/索引/源码恢复及副本清理已核对。验收脚本为测试暂存范围自行执行过 add/reset，最终索引比较基准在其操作结束后重新读取，不将这些主动 Git 操作误归因于执行器。证据为本机忽略目录 `.local/acceptance/frontend-offline/test-run-acceptance.json` 及所列原始报告。本轮工具回归 113 项、SDK 产物 verify、根类型检查、相关 ESLint/Prettier、157 个文档本地链接及差异检查通过；完整前端回归 299 文件 / 3,014 项通过，既有跳过 1 文件 / 1 项。工程日志为同目录 `test-run-{tools.tap,artifacts.log,types.log,tests.log}`。仅修改个人基础设施及文档，未改业务源码、原业务测试、生产配置或依赖版本，未构建或启动服务。


## 全栈基础设施验收记录

2026-10-27，本轮只修改个人基础设施工具、基础设施测试、忽略规则和协作文档。根 src、SDK 业务源码/原测试、gmx-api checkout、数据库迁移和业务依赖均未修改；无提交、推送、部署、钱包操作或真实服务数据验收。

| 验收项 | 实际结果 |
| --- | --- |
| 最终四层执行 | SDK Stats 原测试 7 项、前端日期原测试 5 项、API pairs rows 离线原测试 5 项、API pairs service 数据库原测试 4 项通过，0 跳过；由同一 schema 2 计划显式 all 执行 |
| 数据库生命周期 | 原 migrations/setup/teardown 实际运行；报告进程与容器清理均 passed，另行 inspect 确认本次容器不存在 |
| 实际目标预检 | 当前目录与独立前端/API 目录的对应所选前置 ready；独立目录不含个人工具，显式核对 package/锁文件一致后复用本机已安装依赖。不是全新安装或跨机器环境证明 |
| 独立 Git 选择与兼容性 | 两个临时仓库各自 HEAD 基线及未跟踪基础设施 fixture 正确发现；schema 1 前端规划/执行和 schema 2 公共执行入口均实际通过 |
| 部分执行与未覆盖 | 单选前端保留 API 未执行；混合配置变化保留 uncovered，自动 scope 仍可执行但整体 partial；API 未分配 profile 为 partial，重复 profile 在执行前拒绝 |
| 变化拒绝 | 新路径、同一路径内容变化、原始发现报告变化均在执行前拒绝；没有通过编辑摘要制造 passed |
| 原生失败与继续执行 | 临时 API fixture 注入实际断言失败，API failed、整体 failed，后续独立前端仍 passed；摘要保留真实失败测试与日志。真实业务源码/原预期不改动 |
| 证据交接 | 四 scope 的 18 个执行附件收集和归档通过；复制后的接收目录以包外摘要核对 matched。另对真实失败运行归档/独立目录复核，executionStatus 保持 failed；缺文件、篡改、符号链接和缺摘要拒绝由工具回归覆盖 |
| 工程检查 | 最终 Agent 工具回归 129 项通过；SDK 产物只读 verify、根类型检查通过；完整前端 299 文件/3014 项通过，既有跳过 1 文件/1 项；改动脚本 ESLint/Prettier 及文档链接、差异检查通过 |

本机原始记录在忽略目录 `.local/acceptance/fullstack/acceptance/`：`environment-final.json`、`run-final.json`、`pack-final.json`、`receive-final.json`、`isolated-observations-final.json`、`isolated-final.log`、`tools-final.tap`、`types.log`、`frontend-tests.log` 及各汇总引用的原生报告。临时目标已删除；原始路径用于追溯，不宣称其他机器可读取。最终四层包的 manifestSha256 为 `ca372a9c7678094758a03af0a3cafde24296eff4b28ff3e86eb9b5c9b166f324`；仅同机复制接收，尚未向外部渠道移交。前端全量日志仍有既有 happy-dom teardown AbortError，原生汇总通过且最终退出 0，未修改业务测试压制日志。

本轮证明前端/SDK/API 测试可以统一规划、分层执行和交接；未覆盖真实页面消费 API、worker/索引全链路、评审业务契约、全新安装、跨机器重建、构建与部署、钱包或交易。工具通过不代表任意需求已完整验收。
