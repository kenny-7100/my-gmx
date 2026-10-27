# 本地 Solana API 基础设施历史验收记录

归档日期：2026-10-27。本文保存从[当前操作说明](solana-api-local.md)搬移的历史执行记录；原文中的“本轮”“当前”“已通过”均指各次原执行窗口，不代表归档时重新验证。命令和执行顺序以当前说明为准；本机 `.local/` 产物不保证其他机器可取得，旧 API commit、依赖及服务 PID 也不是当前身份。

以下原文保留历史日期、测试数量、退出结果、证明边界与证据位置。原文未单列日期的记录按相邻阶段理解，不根据本次归档补造执行时间。需要核实当前源码或服务时，按当前入口重新选择必要检查；不机械重跑所有历史测试。

原文中的相对证据位置沿用原操作主题：API 运行、测试与 prepare 报告主要位于基础设施 checkout 的 `.local/acceptance/solana-api-local/`；明确写出的 `solana-dev/`、`gmx-api-tscheck/` 等路径保持各自含义。需要解释“上述目录”等上下文时，返回[当前操作主题](solana-api-local.md#按任务定位)查对应工具的报告目录；这些路径不是已共享附件。

## 记录导航

- [持续服务验收记录](#持续服务验收记录)
- [源码断点自动验收记录](#源码断点自动验收记录)
- [离线执行与进程清理验收记录](#离线执行与进程清理验收记录)
- [关联测试发现验收记录](#关联测试发现验收记录)
- [Git 范围发现验收记录](#git-范围发现验收记录)
- [独立 checkout 执行验收记录](#独立-checkout-执行验收记录)
- [离线源码调试验收记录](#离线源码调试验收记录)
- [路由生成来源验收记录](#路由生成来源验收记录)
- [路由生成恢复验收记录](#路由生成恢复验收记录)
- [路由生成初次验收记录](#路由生成初次验收记录)
- [API 类型检查验收记录](#api-类型检查验收记录)
- [强制路由来源验收记录](#强制路由来源验收记录)
- [离线网络审计验收记录](#离线网络审计验收记录)
- [集成网络限制验收记录](#集成网络限制验收记录)
- [集成源码指纹验收记录](#集成源码指纹验收记录)
- [集成派生进程清理验收记录](#集成派生进程清理验收记录)
- [数据库源码调试验收记录](#数据库源码调试验收记录)
- [数据库范围扩展验收记录](#数据库范围扩展验收记录)
- [数据库初次验收记录](#数据库初次验收记录)
- [样例服务初次与生命周期验收记录](#样例服务初次与生命周期验收记录)

## 持续服务验收记录

### 本轮验收结果

| 验收条件 | 状态与证据 |
| --- | --- |
| 跨命令持续运行、日志和状态 | 已通过；detached 启动、14 项 HTTP/CORS 检查及至少 60 秒持续可用 |
| 自动重启及失败恢复 | 已通过；隔离副本实际修改响应、恢复、语法错误及修复均验证 |
| 本地断点调试 | 已通过；真实 inspector 连接和 HTTP 断点暂停/继续 |
| 进程归属与停服 | 已通过；重复 up、外部 API/调试端口冲突、watcher SIGKILL、supervisor SIGTERM、启动错误及清理 |
| 环境隔离 | 已通过；checkout `.env` 与调用方钱包/数据库哨兵未进入 API，TLS 校验未被关闭 |
| 本地浏览器联调访问 | 已通过；实际 Chrome 从另一 localhost origin 请求市场、持仓、错误响应及触发预检的自定义 header，无请求拦截或替代响应 |

工程检查通过：脚本语法、ESLint、代码格式、`yarn tscheck`、`yarn test:ci`（3014 项通过、1 项原有跳过）、文档本地链接及 `git diff --check`。原有 `doctor` / `check` 兼容性复验通过，一次性 check 的 14 项检查及 cleanup 均 passed。

生命周期演练共 16 项，本机报告为 `.local/acceptance/solana-api-local/dev-acceptance.json`；浏览器证据为 `dev-browser.json`，实际 checkout 启动报告为 `dev-current.json`。临时源码副本已清理，真实 API checkout 未修改。当前数据模式的持续服务范围完成，不代表真实链上数据、前端完整接入或下单链路完成。

## 源码断点自动验收记录

2026-10-26 本机真实验收：

| 验收条件 | 结果 |
| --- | --- |
| 独立启动、源码映射、断点、变量、请求恢复及停服 | 通过；正常/非法地址两次命中 `solanaApp.ts:48`，恢复后分别为 200 样例和 400 错误 |
| 借用管理服务 | 通过；报告 `preserved-borrowed`，检查后 status 仍 ready；最终由本轮启动者另行 stop |
| 未启用 inspector | 正确失败，报告失败阶段；原 3004 服务和 supervisor 身份保持不变 |
| 未知端口占用 | 正确失败，原监听进程继续存活；不接管、不误停 |
| 执行中 SIGTERM | 正确失败并记录中断；启动中的所属服务完成后被清理 |
| 源码变化与调试协议失败 | 两组工具回归通过；覆盖不同 checkout、旧源码、缺失映射、handler 变化，以及真实 Node inspector 的暂停事件先于命令回复、恢复、协议错误、事件超时及断开 |
| 资源与业务源码 | API checkout 保持干净；本轮临时 API/inspector 端口全部释放，原 3004 服务继续运行 |

汇总在本机 `.local/acceptance/solana-api-local/debug-acceptance.json`，逐次报告位于该目录下 `debug-*/report.json`，不随 Git 共享。证据只代表本次执行；换机器或 API 源码变化后按需重跑。

工程验证通过：新增脚本语法、ESLint、Prettier、文档相对链接和 `git diff --check`；`yarn tscheck` 退出 0；完整前端回归 299 个文件通过 / 1 个原有跳过，3014 项通过 / 1 项原有跳过，退出 0。回归仍输出已有 Browserslist 过期提示及 happy-dom teardown AbortError，本轮未修改这些无关内容。仅新增工具、命令和协作文档，无业务源码或依赖版本改动。

## 离线执行与进程清理验收记录

2026-10-27 进程清理验收：隔离 API 源码副本复现“Jest passed 后所属子进程仍存活”，修复后同一用例确认子进程已结束。真实 Node 回归覆盖成功、失败、超时、SIGINT / SIGTERM、忽略 SIGTERM 的主进程及无关哨兵进程保留；统一工具回归 90 项通过，API 默认 12 项与指定 number / 收益计算 59 项通过，报告均为 `exit.cleanup=passed`。没有修改 API 源码、测试或依赖。复现、修复及实际 API 报告分别在本机忽略目录 `.local/acceptance/solana-api-local/offline-process-{repro,fixed-acceptance,default,selected}.json`，工具回归在 `offline-process-tools.tap`。

2026-10-27 可选 suite 扩展已验收：默认 12 项保持通过；显式选择原有 number 与 gmUserEarnings/math 两个文件共 59 项通过，报告仅含所选文件。隔离源码副本实际验证调用方/文件环境哨兵未加载，捕获联网异常后仍失败，断言失败、skip、零测试及运行中新增源码均失败；最后一种报告 `sourceUnchanged=false`。没有修改真实 API 源码或原有预期，副本已清理。工具回归覆盖精确范围、重复结果、空断言、skip/todo、信号退出和非选中依赖变化；统一 `yarn test:agent-tools` 87 项通过。 根类型检查、ESLint、Prettier、111 个文档本地目标和差异检查通过；完整前端单元测试 3,014 项通过、1 项既有跳过。证据在本机忽略目录 `.local/acceptance/solana-api-local/offline-{selected-acceptance,default-compatibility,selection-negative}.json` 和 `offline-tools.tap`。

实施与验收状态：

| 阶段 | 状态 |
| --- | --- |
| 现有测试与数据库耦合核验 | 已完成；默认 Jest 即使指定纯计算测试也会创建模板数据库，因此使用明确独立的离线 profile |
| 实际 API 测试 | 已通过；2 个 suite、12 项测试，无失败/跳过；API commit `b86956df00902e44e0295827d651b206a6153942`，dirty false |
| 隔离与失败退出 | 已通过；临时副本中注入计算断言失败，返回退出 1 并保留报告；被捕获的 HTTP 外连仍令 suite 失败；公开环境哨兵及副本 `.env` 不进入测试 |
| 网络 guard 回归 | 已通过；9 个网络入口均阻断，累计尝试不能静默通过 |
| 静态检查与最终复验 | 已通过；实际 API 2 个 suite / 12 项最终复验、网络 guard 回归、Node 语法、ESLint、定向 Prettier、yarn tscheck、文档链接及 git diff --check。未重新运行完整前端或 API 数据库测试，业务文件和默认配置未改动 |

本机验收摘要为同目录 `offline-latest.json`，失败/隔离验证为 `offline-acceptance.json`；临时注入仅发生在已清理的源码副本，真实 API 文件未改动。该阶段为 A08/A11 的回归执行能力补充，未新增独立数学基准，不能将旧 fixture 当成未来全部 SDK / 部署版本的正确性证明。

## 关联测试发现验收记录

2026-10-27 已在独立 `origin/release` API checkout 验证原生直接/间接发现；额外临时 fixture 验证路径别名的传递依赖，测试正文与三个 setup/teardown 文件均未执行，零匹配失败，配置捕获联网异常后仍审计失败。发现清单中的原市场与 pairs 纯计算两份 suite 共 12 项通过已有离线入口实际执行。真实 API 业务源码未改；临时 fixture 已清理。路径组合回归自动纳入 `yarn test:agent-tools`，本机证据为忽略的 `.local/acceptance/solana-api-local/discovery-acceptance.json`，其他机器需重新运行。

本轮工程检查：统一工具回归 110 项通过，SDK 产物只读核验、根 `yarn tscheck`、相关 ESLint/Prettier、146 个文档本地目标及差异检查通过；完整前端回归 299 个文件 / 3,014 项通过，另有 1 个文件 / 1 项既有跳过，退出 0。未运行完整 API 数据库测试或构建；本轮发现入口不涉及数据库执行器改动。

## Git 范围发现验收记录

2026-10-27 已在独立 API `origin/release` checkout 的临时提交中验证完整范围组合和原生依赖发现。临时测试正文及 setup/teardown 放入失败哨兵，确认未执行；清单中的原市场套件经既有离线执行器实际运行，7 项通过。空范围、配置/迁移混合变化及删除明确阻塞；配置中模拟另一个编辑者暂存新源码，在内容指纹不变时仍得到 `changesUnchanged=false`、退出 1。正常发现保持目标 HEAD/索引不变，真实 API 仓库无修改，副本已删除。真实 Git 回归也覆盖恢复字节、非法 ref 和模式冲突；本机证据为忽略的 `.local/acceptance/solana-api-local/changed-discovery-acceptance.json`。

本轮工程检查通过：统一工具回归 112 项、原 `--related` 独立 checkout 验收及离线默认 12 项、SDK 产物只读核验、根类型检查、相关 ESLint/Prettier、150 个文档本地目标及差异检查。完整前端回归 299 个文件 / 3,014 项通过，另有 1 个文件 / 1 项既有跳过，退出 0。没有执行构建、完整 API 数据库测试或启动服务；新增入口仅扩展发现范围。

## 独立 checkout 执行验收记录

实际验收：以本地 `gmx-api origin/release` 的 `6e128bb7c96d1f9b3e25bbcd60dc14148580f7a8` 创建隔离 clone，移除上述无关样例及默认测试文件并提交为验收版本；锁文件和 package 与已安装依赖的 API 相同后，仅为本次验收显式链接依赖。旧离线入口因缺少 `solanaApp.ts` 失败，新入口运行原收益计算 6 项和市场数据库 4 项均通过，commit/clean 身份准确；分别注入错误断言后，两个入口均失败并记录 dirty。源码前后指纹相同，测试进程、所属数据库容器和临时目录清理通过；验收 clone 随后删除。摘要为 `checkout-acceptance.json`，四次原始结果为 `checkout-{offline,integration}-{passed,failed}.json`，均位于本机上述忽略目录。真实 API 源码未改动。

最终兼容性与工程检查：原默认离线 12 项、数据库 5 项、统一工具 97 项通过；SDK 产物 verify、根 `yarn tscheck`、相关 ESLint/Prettier、126 个文档本地目标及差异检查通过。完整前端回归 3,014 项通过、1 项既有跳过，退出 0。证据为同目录 `checkout-default-{offline,integration}.json`、`checkout-tools.tap`、`checkout-sdk-verify.json`、`checkout-tscheck.log`、`checkout-test-ci.log`。

## 离线源码调试验收记录

本机真实验收：source map 源码匹配，目标断点读取预期 BigInt 参数并确认环境哨兵未加载、fetch 保护器仍为 `deny`；恢复后原有收益计算 6 项通过，源码未变、端口关闭。初始暂停时 SIGTERM 返回 failed 且清理通过；非法端口、多 suite 和端口占用均拒绝，占用服务保留。普通默认 12 项、指定计算 59 项及统一工具 91 项通过。证据位于忽略目录 `.local/acceptance/solana-api-local/offline-debug-{acceptance,negative,default,selected}.json` 和 `offline-debug-tools.tap`。没有修改 API 业务源码、原测试、配置或依赖。

## 路由生成来源验收记录

2026-10-27 真实验收：从本地 API `origin/release` 创建独立 clone，核对锁文件及依赖声明；其余依赖仅为验收链接现有安装，单独复制生成器及其嵌套依赖，避免修改共享依赖。使用原两份配置真实生成 v1/v2 路由与 OpenAPI，schemaVersion 2 verify 通过。只在临时生成器副本或收据中分别改变生成器字节、模板、实际嵌套 TypeScript 元数据、工具身份、旧 schema 和产物内容，均正确拒绝；恢复后通过，重复生成的四个摘要一致。嵌套目录在生成前拒绝。原 API 与目标业务源码、配置、锁文件保持 clean，临时 clone 已删除，既有默认工作区/API PID 不变且健康。本机证据为 `.local/acceptance/solana-dev/route-provenance-acceptance.json`、同名 `.log` 及摘要引用的 prepare 报告。未启动数据库或额外应用服务，本轮没有重跑 HTTP 业务测试。

本轮工程检查通过：统一工具回归 102 项（新增生成目标边界回归）、SDK 产物 verify、`yarn tscheck`、`yarn test:ci`（299 个文件、3014 项通过，1 个文件及其 1 项原有跳过）、两份改动脚本/测试的 Prettier/ESLint、138 个本地文档链接及 `git diff --check`。主项目测试仍有既有 happy-dom teardown AbortError 日志，退出码为 0；工程日志在 `.local/acceptance/solana-dev/route-provenance-{tools.tap,sdk-verify.json,tscheck.log,test-ci.log}`。

## 路由生成恢复验收记录

真实验收在本地 API `origin/release` 独立 clone 中进行，原业务源码/配置/锁文件不变，故障仅注入临时生成器依赖副本：原两套真实生成和 verify 通过；v2 写入部分内容后失败，四个旧产物及收据逐字节恢复；原先全缺失时，新产物删除且收据仍缺失。暂停在 v2 时，第二次生成及 verify 明确拒绝；发送 SIGTERM 后进程组清理通过、旧产物/收据恢复、锁释放，恢复原工具后 verify 通过。原 API 与目标 checkout 保持 clean，临时 clone 已删除，默认工作区/API PID 不变且 healthy。证据在 `.local/acceptance/solana-dev/route-recovery-acceptance.json`、同名 `.log` 及其中引用的失败/中断报告。未启动数据库或额外服务，未重复 HTTP 业务验收。

本轮恢复能力工程检查通过：统一工具回归 103 项、SDK 产物 verify、`yarn tscheck`、`yarn test:ci`（299 个文件、3014 项通过，1 个文件及其 1 项原有跳过）、脚本/测试的 Prettier 与 ESLint、138 个本地文档链接及 `git diff --check`。主项目测试仍输出既有 happy-dom teardown AbortError 日志，退出码为 0；日志保存在 `.local/acceptance/solana-dev/route-recovery-{tools.tap,sdk-verify.json,tscheck.log,test-ci.log}`。

## 路由生成初次验收记录

| 验收条件 | 状态与证据 |
| --- | --- |
| 复用原有两套生成配置 | 已通过；生成 v1/v2 路由及 OpenAPI，真实 checkout 生成与 verify 通过 |
| 过期及损坏不能误通过 | 已通过；独立源码副本真实生成后验证正常、源码变更、产物变更、损坏/缺失 spec、恢复、清单缺失；另验证生成器缺失时退出 1 且保留日志，共 9 项检查，副本已清理 |
| 生成产物可用于原有测试 | 已通过；routeMap 5 项及 relayLaunchMode 1 项，共 6 项；隔离数据库 cleanup passed |
| 环境修复及接手顺序 | 已完成；运行器临时目录链接真实 `src/abi`，修复导入 `src/app.ts` 的 ABI 查找失败；未改业务和断言，通用执行入口已更新 |

工程检查已通过：两份脚本的语法、ESLint、代码格式、`yarn tscheck`、现有测试选择回归，以及 `yarn test:ci`（3014 项通过，1 项原有跳过，退出 0）；文档本地链接和 `git diff --check` 通过，API checkout 无跟踪改动，测试容器已清理。

本机证据：`prepare-latest.json`、`prepare-acceptance.json`、`integration-routes.json`，均位于上述忽略目录。首次 HTTP 测试失败日志保留在 `integration-HWdri2/jest.log`。ABI 加载使用 `process.cwd()/src/abi`，仅设 `APP_ROOT` 不足；后续遇到 `ABI directory not found` 先核对测试 CWD 的资源链接，不调整业务查找逻辑或移除隔离目录。HTTP 用例沿用原测试的本地 keeper stub，不访问真实 keeper、不发送链上交易。

## API 类型检查验收记录

类型检查真实验收（2026-10-27）：从本地 API `origin/release` 建立独立 checkout，显式复用 package/lock 相同的已安装依赖。缺路由收据时 blocked；显式准备后，全项目使用目标 TypeScript 5.4.2 通过。临时副本注入 TS2322 类型错误时，工具退出 1，保留原生诊断和 tsc 退出码 2；恢复后通过。编译阶段 SIGTERM 被标记 failed，所属进程组清理 passed。检查前后目标源码产物清单、Git HEAD 和索引字节一致，未启动容器或改动既有服务；副本及注入文件已删除，真实 API 源码未改。另一次工具修改发生在编译期间，原生 tsc 退出 0 而 `toolingUnchanged=false`，整体正确失败。本机证据为忽略目录 `.local/acceptance/solana-dev/api-tscheck-acceptance.json` 与其列出的原始报告；工具变更拒绝证据为 `.local/acceptance/gmx-api-tscheck/run-F7Gmm6/report.json`。该次验收未执行全新依赖安装或业务构建。 工程检查：统一工具回归 106 项、SDK 产物 verify、根前端类型检查、相关 ESLint/Prettier、141 个文档本地链接及差异检查通过；全量前端回归 299 个文件、3,014 项通过，1 个文件及其 1 项既有跳过，退出 0。工程日志保存在同一忽略目录的 `api-tscheck-{tools.tap,sdk.json,frontend-types.log,frontend-tests.log}`。

## 强制路由来源验收记录

2026-10-27 独立 checkout 真实验收：缺失收据与有效文件但过期摘要均在建库前拒绝，前后测试容器集合一致；显式准备后，原 routeMap 5 项及 relayLaunchMode HTTP 1 项通过，generatedRoutes、网络审计、进程/容器清理均 passed。仅在临时 checkout 新增验收夹具，让 Jest 断言通过同时改变忽略的 routes.ts；结果为原生 1 项通过但整体 failed / generated-routes-changed，所属资源清理通过。删除夹具后默认两个集成 suite / 5 项通过，generatedRoutes 为 not-checked。原业务源码/配置/锁文件与 API 工作区保持 clean，临时 clone 已删除，原默认服务 PID 不变且 ready。证据为 `.local/acceptance/solana-dev/routes-required-acceptance.json`、同名 `.log` 和摘要引用的三次集成报告；未修改原测试或业务实现。


本轮工程验收通过：统一工具回归 104 项、SDK 产物 verify、`yarn tscheck`、`yarn test:ci`（299 个文件、3014 项通过，1 个文件及其 1 项原有跳过）、三个改动脚本/测试的 Prettier/ESLint、138 个本地文档链接及 `git diff --check`。主项目测试仍有既有 happy-dom teardown AbortError 日志，退出码为 0；工程日志在 `.local/acceptance/solana-dev/routes-required-{tools.tap,sdk-verify.json,tscheck.log,test-ci.log}`。

## 离线网络审计验收记录

2026-10-27 已用隔离 API 副本真实复现旧入口误报 passed，修复后同一末尾 hook 用例原生仍 success、运行器正确 failed。前端/SDK 的隔离 release checkout 分别保留通过断言并捕获联网异常，均由运行器审计拒绝；临时目录和所属进程清理。实际项目源码未修改，依赖仅在验收副本中显式链接，没有安装或构建。证据在 `.local/acceptance/solana-api-local/offline-network-repro.json` / `offline-network-fixed.json` 及 `.local/acceptance/frontend-offline/network-audit-acceptance.json`。

## 集成网络限制验收记录

2026-10-27 实测：默认 Solana 两 suite / 5 项、数据库与市场模型两 suite / 11 项全部通过，安装次数均为 2、拒绝次数为 0，原 Supertest 和数据库清理保留。隔离 API 副本分别在 test 和末尾 afterAll 中捕获对无关本地服务、外部域名的连接异常：均记录两次拒绝并返回失败；后者原生 Jest 显示 success，仍被运行器正确拒绝。无关服务收到 0 个连接并继续监听，所属测试子进程、临时容器及副本均已清理，实际 API checkout 未修改。

网络传输回归使用真实 Node 子进程及本地监听，覆盖数据库、即时启动的 HTTP 服务、跨 suite 重复安装、外部/无关本地 socket、Unix socket、TLS、UDP、DNS/Resolver 和 fetch；自动纳入 `yarn test:agent-tools`。本机证据在忽略的 `.local/acceptance/solana-api-local/network-acceptance.json`、`network-default.json`、`network-selected.json`，原生结果及 `network-events.log` 留在对应 integration 运行目录。 本轮统一工具回归 97 项、根类型检查、相关静态检查及 121 个文档本地目标检查通过；全量前端回归 3,014 项通过、1 项既有跳过。

## 集成源码指纹验收记录

实际验收在隔离 API 副本复现了漏报：原测试导入 JSON 依赖，执行中修改该依赖，原断言通过而旧入口报告 passed / `sourceUnchanged=true`。修复后相同场景及新增源码文件场景均为 failed、`sourceUnchanged=false`，原断言仍通过，两类资源清理均 passed；副本已删除，实际 API 未改。共享摘要的现有回归覆盖非选中依赖修改和新增文件，不复制扫描实现或另建测试框架。原数据库默认 5 项、指定数据库/市场模型 11 项及离线默认 12 项均通过，源码保持一致；统一工具回归 95 项通过。证据在本机忽略目录 `.local/acceptance/solana-api-local/integration-source-{repro,changed,added}.json`。

## 集成派生进程清理验收记录

### 测试派生进程清理验收（2026-10-27）

隔离 API 源码副本真实复现：原运行器返回 passed、所属 PostgreSQL 容器已删除，但测试创建的 Node 子进程仍存活；核对本次进程归属后清理。修复复用已有进程组工具，不修改实际 API 源码、原测试、配置或依赖。相同副本的成功、断言失败和运行中 SIGTERM 中断均确认子进程消失、所属容器已删除，报告分别保存进程与资源清理结果。

共享真实 Node 回归已覆盖成功、失败、超时、SIGINT / SIGTERM、忽略 SIGTERM 及无关哨兵进程保留，通过 `yarn test:agent-tools` 执行；本轮没有让数据库 fixture 等待完整 180 秒来重复共享超时测试。API 运行器仍显式使用 180 秒时限，不降低原测试范围。真实默认 2 个 suite / 5 项、指定数据库与市场模型 2 个 suite / 11 项均通过，两类清理结果均为 passed；统一工具回归 93 项通过。证据在本机忽略目录 `.local/acceptance/solana-api-local/integration-process-{repro,success,failure,interrupt}.json`。

## 数据库源码调试验收记录

真实验收：source map 源码匹配，在模型函数读取 `2026-06-03T12:00:00.000Z` 参数，异步调用栈追溯到原测试；UTC 和环境哨兵隔离保留，恢复后原市场模型 4 项通过，源码未变，端口、所属容器与临时目录均消失。初始等待时 SIGTERM 正确失败并清理；非法端口、多 suite 及占用端口明确拒绝。普通默认 5 项、指定数据库/市场模型 11 项和统一工具 94 项通过。未修改 API 源码、原测试、配置或依赖。证据在本机忽略目录 `.local/acceptance/solana-api-local/integration-debug-{acceptance,negative,default,selected}.json` 和 `integration-debug-tools.tap`。

## 数据库范围扩展验收记录

| 2026-10-26 按需范围扩展 | 状态 |
| --- | --- |
| 自定义真实测试 | 已通过；迁移与市场模型 2 个 suite / 11 项，无跳过 |
| 默认范围回归 | 已通过最终复验；2 个 suite / 5 项，无跳过 |
| 路径约束 | 已通过；8 类无效选择与有效顺序/归一化的自动回归，非法 CLI 在创建容器前失败 |
| 自定义失败与清理 | 已通过；临时副本只执行指定测试，断言失败退出 1，仍清理容器；父进程 Asia/Shanghai 不影响子进程 UTC |
| 静态检查与交接 | 已通过；路径回归、Node 语法、ESLint、Prettier、yarn tscheck、文档链接及 git diff --check；未重跑完整 API/前端测试 |

自定义失败演练摘要为同目录 `integration-selection-acceptance.json`；临时副本已清理。该扩展复用原运行器，不增加新数据库服务或修改 API 文件。

## 数据库初次验收记录

| 阶段 | 实施与验收状态 |
| --- | --- |
| 本地前置 | 已核实；Docker daemon 与 postgres:15 本地镜像可用，无新增资源需求 |
| 真实数据库测试 | 已通过；原有迁移/setup/teardown，2 个 suite / 5 项测试全部通过，无跳过；API commit `b86956df00902e44e0295827d651b206a6153942`，dirty false |
| 数据库隔离与清理 | 已通过；随机 loopback 端口，成功结束后删除容器；临时副本失败断言退出 1，仍清理容器，其他容器列表未变化 |
| 环境隔离 | 已通过；公开父进程凭据哨兵和副本 `.env` 没有进入测试，测试使用工具生成的 localhost 连接 |
| 静态检查与相关回归 | 已通过；Node 语法、ESLint、定向 Prettier、yarn tscheck、文档链接、git diff --check；离线计算 12 项与网络 guard 回归仍通过。未重跑完整 API/前端测试 |

本轮只新增测试运行基础设施。未修改业务代码、依赖、迁移或原有 Jest 配置；不代表完整 API、实时 RPC/keeper/SQD、前端集成或交易通过。失败注入在已删除的临时副本执行，不污染 API checkout。

## 样例服务初次与生命周期验收记录

## 实施进度与验收

### 2026-10-26 Agent 生命周期闭环

| 阶段 | 状态与范围 |
| --- | --- |
| 复用现有能力 | 已完成；沿用原 Solana 启动入口和 14 项检查，gmx-api 业务代码及依赖不变 |
| doctor / check | 已实施；Node、源码、运行器、端口逐项诊断；一次性启动、验收、源码核对和清理 |
| 真实服务 | 已通过；默认 3004 及从 gmx-api 目录调用的自定义 3005 端口均完成 14 项检查，cleanup passed；本机报告 `check-latest.json` / `check-custom-port.json` 位于上述忽略目录 |
| 主要失败路径 | 已通过；端口占用不终止其所有者，缺源码/运行器汇总报告，子服务提前退出保留日志，检查抛错关闭所属子进程并释放端口 |
| 静态检查与相关回归 | 已通过；Node 语法、ESLint、定向 Prettier、文档链接、git diff --check、yarn tscheck；统一预检 6 项测试通过；完整前端 299 文件 / 3014 项通过，1 文件 / 1 项原有跳过 |

失败路径报告为同目录 `lifecycle-acceptance.json`，类型检查和完整测试日志为 `typecheck.log` / `frontend-tests.log`。完整测试退出 0，仍有已知 Browserslist 过期提示和 happy-dom teardown AbortError 输出，无失败测试。服务均已关闭，API checkout 为 `b86956df00902e44e0295827d651b206a6153942`，dirty false。

本轮仅验证样例服务，不要求数据库、钱包、RPC 或 keeper；未接入真实 Solana 数据、前端 host 或部署流程。下表为 2026-10-25 原有工具的历史验收记录，不代表本轮重新运行了全部前端测试。

| 阶段 | 状态 |
| --- | --- |
| 现有入口、FESOL-62 和依赖核实 | 已通过；immutable 安装成功，API checkout 无改动 |
| 启动器和 14 项检查 | 已通过最终复验；3004 与自定义 3005 端口均通过 |
| 失败路径 | 端口占用、源码缺失、非法端口、响应变更、陈旧时间戳、CORS 缺失、HTTP 错误和非法 JSON 已验证 |
| 运行隔离与清理 | 父进程注入 master/test/CHAIN_ID 和公开钱包哨兵后，子服务仍为 solana 样例模式；仅向启动器发 SIGTERM 后服务关闭、临时目录清理通过 |
| 停服失败路径 | 已通过；verify 退出 1，`request-failed`，失败路由 `/ping`，无成功报告 |
| 静态检查与回归 | Node 语法、ESLint（`--env node --max-warnings=0`）、Prettier、`yarn tscheck`、文档路径和 `git diff --check` 通过；`yarn test:ci` 为 299 文件通过 / 1 原有跳过，3014 测试通过 / 1 原有跳过 |

本轮只改测试验收脚本、package 命令和协作资料；未实现页面或协议需求，未配置真实 API 部署、签名或发送交易。

最终真实报告时间为 `2026-10-24T16:12:49.107Z`（北京时间 2026-10-25），预期 API commit 为 `b86956df00902e44e0295827d651b206a6153942`，dirty 为 false；报告保存于本机 `.local/acceptance/solana-api-local/report.json`（被 Git 忽略，其他机器需重新运行），各样例摘要由命令输出。完整前端测试退出 0，日志仍有 Browserslist 数据过期提示与 happy-dom teardown 的 AbortError 输出，未产生失败用例；未为本轮修改无关依赖或业务测试。未运行浏览器、UI、前端构建或部署。

本次验收自行启动的 3004/3005 服务均已关闭，`gmx-api` checkout 和锁文件保持无改动。A08 的本地服务与 CLI 范围完成，整体表仍保留前端 host 尚未接入的边界。
