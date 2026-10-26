# 前端与 SDK 联合测试范围规划

更新日期：2026-10-27。用于功能 checkout 中只有前端和 SDK 源码变化时，一次发现 SDK 自身测试及前端消费者，减少手工拆分范围导致的遗漏。属于个人开发基础，不复制到业务交付分支。

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

## 本轮验收

2026-10-27 在独立 `origin/release` 副本验收，目标不含个人工具，显式复用锁文件匹配的已安装依赖，没有执行全新安装：

- 真实 Stats 源码变化同时发现 SDK 原 Stats suite 1 个、前端消费者 178 个，未执行测试。两个原生子报告的网络、身份和清理均通过。
- SDK fixture 单独变化准确发现 SDK 1 个、前端 1 个 suite；混入前端日期测试源码后，SDK 仍为 1 个，前端并集为 2 个。只有前端变化时 SDK 为 `not-applicable`，前端 1 个。fixture 测试含顶层报错，发现通过证明未执行测试模块。
- 无覆盖源码使两侧发现失败、整体 failed；配置混入、删除和空范围均 blocked，不回退默认范围。配置在发现期间新增源码后，结束 Git 范围复核正确失败，未接受前端单侧的发现成功。
- 真实父报告被前端和 SDK 交付证据模式校验拒绝；没有生成正式测试执行日志或结果。目标 HEAD/索引/源码恢复状态已核对，临时副本清理完成，真实业务文件未改。

本机原始证据在忽略目录 `.local/acceptance/frontend-offline/test-plan-acceptance.json` 及其所列父/子报告；工具不把这些发现结果当成测试通过或需求覆盖证明。

工程检查：工具回归 113 项、SDK 产物只读 verify、根类型检查、相关 ESLint/Prettier、155 个文档本地链接及差异检查通过。完整前端回归 299 文件 / 3,014 项通过，既有跳过 1 文件 / 1 项；日志为同一忽略目录 `test-plan-{tools.tap,artifacts.log,types.log,tests.log}`。本轮只修改基础设施命令及文档，没有修改业务源码、原业务测试、生产配置或依赖版本，没有构建或启动服务。
