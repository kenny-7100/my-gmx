# Agent 验收证据包

更新日期：2026-10-27。对应 A14 的本地证据移交阶段。工具将显式选择的现有 JSON 报告、可选的绑定 Markdown 工作表和原始产物附件复制为独立目录，生成清单并离线检查完整性与工作表一致性，不重新执行验收、不启动服务、不上传、不修改业务代码。

## 交付默认步骤

更新日期：2026-10-27。用于[需求交付流程](linear-development-workflow.md#默认交付证据归档)中创建或更新 Draft PR 前的材料准备。只准备当前任务已经产生的证据，不为打包运行无关检查；工具能力和输入白名单见下文。

1. **核对版本并冻结工作表。** 在最终交付版本完成实际需要的测试与隔离检查，记录目标目录、commit/dirty、相关输入身份、命令、退出码、时间和未覆盖项。未执行、失败或阻塞条件保留原状态。冻结后检查一致性，确认报告与工作表绑定；退出 2 可表示合法 partial/blocked/not-run，不能据此声称需求通过。
2. **显式选择支持的报告并打包。** 默认归档工作表及其检查报告，再按需要追加白名单中的实际报告；测试/类型/交付报告及日志可按下文用 `--artifact` 原样附加，不伪装成受支持 report scope。使用新的、含需求编号及本次版本或时间的输出目录，旧目录不覆盖。
3. **将摘要记在包外。** 保存 pack 返回的 manifestSha256、打包器版本、包含的报告及观察时间。被打包工作表不要再写回摘要；如内容需要变化，重新检查并创建新包。
4. **整理未入包的原始产物。** JSON 中的路径不会自动归档；所需原生测试结果、日志、网络事件、截图/trace、交付检查报告等逐文件用 `--artifact` 显式选择，记录原路径到包内文件名的对应关系。超过格式/大小限制或需要完整目录结构的材料仍按原目录结构在包外单独准备，记录清单和摘要；不手动向包目录添加文件，否则 verify 会拒绝。核实可分享内容不含秘密，不能只移动汇总而丢失其引用文件。
5. **交接并接收核对。** 本机 pack/verify 成功只写“本地归档已准备”。经已授权渠道实际复制后才记录“已移交”；接收方从包外可信记录取得预期摘要，使用兼容工具离线 verify，确认 manifestIdentity=matched，并核对独立产物可用、版本和覆盖缺口。显式附件的字节摘要由 verify 检查；其内容、业务语义、嵌套引用文件和包外产物仍由原工具/接收者另行核对。

从基础设施仓库根目录执行，替换路径、需求编号和唯一输出目录；这是命令模板，不是已执行结果：

```sh
yarn agent:acceptance --file /path/to/frozen-worksheet.md > /path/to/worksheet-check.json
# Confirm the JSON status and requirementAcceptance, including incomplete results.
yarn agent:evidence pack --issue FESOL-123 \
  --worksheet /path/to/frozen-worksheet.md \
  --report worksheet=/path/to/worksheet-check.json \
  --out .local/acceptance/evidence/fesol-123-DELIVERY_SHA-UTC_TIME
# Verify the received copy using the digest recorded outside the package.
yarn agent:evidence verify --dir /path/to/received-package \
  --expected-manifest-sha256 EXPECTED_SHA256
```

第一条命令的 stdout 是工作表 JSON 报告；显式重定向到所选 `worksheet-check.json` 并保留最终退出码后，才可用于 pack。未填写的模板或不一致报告不能打包；合法但结论不完整的工作表可以归档，结论仍是不完整。更多报告使用重复 `--report name=PATH`，只选本次确实需要的白名单输入。

交接记录放在**包外**的共享说明或获准的 PR 验证说明中，至少填写以下字段；这里的占位内容必须替换，不能作为真实验收结论：

| 字段 | 必填内容 |
| --- | --- |
| 需求与交付版本 | Linear 编号/链接、各目标仓库 commit、相关 dirty/输入摘要、交付 base；打包器 commit 或文件摘要 |
| 业务结论 | passed/failed/blocked/partial/not-run、覆盖范围及剩余条件；与包完整性结论分开 |
| 包定位与身份 | 包目录名、manifestSha256、实际已批准共享位置；只有本机路径时标未移交 |
| 报告清单 | 每份报告的 scope、原始观察时间、目标/数据模式及来源；打包时间不替代观察时间 |
| 原始产物清单 | 原路径到包内附件名的对应、对应执行记录及摘要；包外材料另列相对路径与可用性；没有时写明确原因，不假定引用文件已包含 |
| 接收验证 | 执行时间、工具身份、完整命令、最终退出码、manifestIdentity；尚未接收写 not-run |
| 未覆盖与下一步 | 缺失产物、未验证环境/业务条件、资源或协调人，以及下一步操作 |

接收后只验证包完整、不查阅原生结果和需求映射，仍不能完成业务验收。当前工具只收集显式选择的文件，不扫描或递归打包完整运行目录，不改写报告中的历史路径。

## 用法与顺序

先按[需求验收流程](agent-acceptance-workflow.md)明确条件、目标版本并执行必要检查，检查退出码和报告内容，再打包。仅使用已确认可归档的报告；工具保留完整原始字节，不负责脱敏，不能把环境配置、钱包秘密或不明来源的 JSON 当作报告输入。

主仓库根目录执行：

```sh
yarn agent:evidence pack --issue FESOL-71 \
  --report runtime=.local/acceptance/solana-runtime/report.json \
  --report alt=.local/acceptance/solana-alt/report.json \
  --report receipt=.local/acceptance/solana-transaction/report.json \
  --out .local/acceptance/evidence/mainnet-resources
```

这些历史报告路径仅为本机示例，其他机器不保证存在；新任务应选择本次实际产物。`--issue` 是归档关联标签，不查询 Linear、不证明这些报告覆盖该需求，也不修改需求状态。

输出目录必须不存在。成功后目录包含 `manifest.json` 和三个命名 JSON 文件，可以整体复制到其他目录或机器。在有本仓库工具和 Node 22 的接收环境执行：

```sh
yarn agent:evidence verify --dir /path/to/received-package \
  --expected-manifest-sha256 EXPECTED_SHA256
```

verify 不需要原始文件路径、RPC、钱包、API 或原报告中的源码 checkout。相同完整包得到相同 manifestSha256；将摘要单独保存在可信交接记录中，接收时用 `--expected-manifest-sha256` 自动比对（替换示例的 EXPECTED_SHA256）。工作表自身已被打入包时，不能再把包摘要写回该工作表，否则会改变其字节并使已有报告绑定失效。离线验证不意味着命令可以在没有 Node/工具源码的机器直接运行。

两个命令成功退出 0，输出 JSON 的 `scope: evidence-package-integrity`、`status: passed` 仅表示文件与清单一致；所有包固定 `requirementAcceptance: not-evaluated`。原报告的 failed、blocked、not-run、partial 都原样保留，包完整时也可退出 0，不能将这个退出码当业务需求通过。失败退出 1，stderr 输出脱敏分类，无成功报告。

入口：[scripts/agent-evidence.mjs](../scripts/agent-evidence.mjs)。测试：`yarn test:agent-evidence`。

## 显式原始产物附件

当测试原生结果、日志、截图或 trace 需要一起携带时，pack 重复指定 `--artifact name=PATH`。附件独立于白名单报告，按原字节保存，不解析为 JSON 或检查测试状态；例如失败测试日志也可以完整归档。仍需至少一份受支持的 `--report`，通常是绑定工作表的一致性报告。

```sh
yarn agent:evidence pack --issue FESOL-123 \
  --worksheet /path/to/frozen-worksheet.md \
  --report worksheet=/path/to/worksheet-check.json \
  --artifact native-results=/path/to/vitest-results.json \
  --artifact test-log=/path/to/vitest.log \
  --artifact screenshot=/path/to/failure.png \
  --artifact browser-trace=/path/to/trace.zip \
  --out .local/acceptance/evidence/fesol-123-DELIVERY_SHA-UTC_TIME
```

附件限制：最多 20 个，非空普通文件，单个不超过 16 MiB，合计不超过 64 MiB；扩展名仅接受小写 `.json`、`.log`、`.txt`、`.png`、`.zip`。不接受目录、符号链接、缺失文件、glob 或其他扩展名。ZIP 只作为字节保存，不解压或验证内含文件。名称沿用报告名称规则，并要求报告/附件名称全局唯一；包内实际文件为 `artifact-NAME.EXT`，与任何报告文件冲突也拒绝。所有输入检查完成后才创建输出，不覆盖旧目录；读文件期间的并发更改不是安全隔离边界。

带附件的新包使用 schemaVersion=3，清单 artifacts 保存名称、包内文件、字节数和 SHA-256，不保存原输入绝对路径。接收端使用本版本或后续兼容工具；旧工具会拒绝版本 3。没有附件时仍生成原版本 1（普通报告）或版本 2（含工作表），当前 verify 保持兼容。版本 3 可有或没有工作表，原工作表绑定规则不变。

verify 重新读取每个附件、比较字节数/摘要，并拒绝遗漏、改动、重名、越界文件名、符号链接和额外文件；包外预期 manifest 摘要继续独立核对。输出 `artifactSemantics=not-evaluated`，顶层 `requirementAcceptance=not-evaluated`，附件不会提升 report 或工作表结论。文件扩展名不证明内容格式、安全性或业务正确；归档前确认文件可分享且无秘密，工具不脱敏、不自动上传、不运行附件。

原报告中引用的绝对路径保留原样，移交说明必须写清原路径/执行记录与附件名的对应。verify 只证明选定字节随包完整到达，不证明已收齐全部嵌套依赖，也不替代 `agent:delivery-check` 的目标版本和原生结果验证。需要按原路径复核时，由接收者根据清单在受控目录整理材料，再使用原验收工具；不自动恢复到报告内指定位置。

## 前端、SDK、API 离线证据联合交接

适用于同一任务确实运行过其中多个入口，并需要接收方离开原执行目录复核结果时。只选本任务产生的报告，不为了打包补跑三类默认范围；默认范围也不能代表某条需求的全部回归。三个运行器的汇总不是本工具 report scope 白名单，作为显式附件携带，不改写其 scope 或伪装成预检。

### 选择与记录原始产物

从各次实际 stdout 的 JSON 读取路径，逐文件显式选择：

| 每个执行入口 | 所需材料 | 接收侧作用 |
| --- | --- | --- |
| `frontend:test-offline` | 汇总 JSON、`resultsFile`、`logFile`、`network.eventsFile` | 核对目标前端、所选 suite、原生断言、网络与清理 |
| `sdk:test-offline` | 汇总 JSON、`resultsFile`、`logFile`、`network.eventsFile` | 核对目标 SDK、所选 suite、原生断言、网络与清理 |
| `gmx-api:test-offline` | 汇总 JSON、`resultsFile`、`logFile`、`network.eventsFile` | 核对目标 API、所选 suite、原生 Jest 断言、网络与清理 |

不要把 stdout 汇总与其相同的 `reportFile` 再算成两份独立证据。明确每个附件的执行命令、最终退出码、原路径、包内文件名、字节数与 SHA-256；注明目标目录、commit/dirty、数据模式和原执行时间，不能假定前端、SDK、API 来自同一仓库版本。三类入口各选四文件共 12 个附件，另加一份 JSON 对应清单为 13 个，仍需核对单文件/合计大小及最多 20 个附件的限制；真实任务若需要更多材料，按前述包外清单处理。

下列仅为在已有 pack 命令上追加的参数示例，其他入口同样逐文件明确指定；`/path/to/` 均替换为已核对的实际文件：

```sh
--artifact frontend-report=/path/to/frontend-report.json
--artifact frontend-native=/path/to/vitest-results.json
--artifact frontend-log=/path/to/vitest.log
--artifact frontend-network=/path/to/network-events.log
--artifact handoff=/path/to/handoff.json
```

例如 `frontend-native` 会保存为 `artifact-frontend-native.json`。对应清单可沿用任务自己的 JSON 或交接表，无需新增统一 schema；至少让接收者能从“执行入口 + 报告字段”定位唯一包内文件。对应清单也作为附件时仍在包外独立保存 manifest 摘要，不将摘要写入被打包的清单或工作表。

### 接收检查顺序

1. 先运行 `verify --expected-manifest-sha256` 并确认 matched；再按对应清单读取包内文件。原报告的绝对路径仅作为历史标识，不直接按该路径打开文件，不恢复到原路径，不运行日志或报告中的命令。
2. 分别核对汇总的目标目录、commit/dirty、suite 清单、数据模式、执行时间及退出码。确认 `sourceUnchanged`、`toolingUnchanged`、`exit.cleanup`、`temporaryDirectoryCleanup`，检查未中断/超时；API 同时保留 `sourceInputs/sourceInputsAfter`。这是对原执行证据的复核，不是重新验证当前源码；干净交付仍须原 delivery-check。
3. 原生 Vitest/Jest JSON 要检查 success、通过/失败/跳过/todo、每个文件的 assertionResults，逐项对应所选 suite。**文件数应看 `testResults` 的实际文件清单，不直接用 `numTotalTestSuites`。** Vitest 该字段包含测试分组：本轮前端/SDK 均为 3 个文件，但分别输出 6/36 个 suite。文件路径、逐文件状态、断言数与汇总计数应一致，不能只看总 success。
4. 网络结果与包内 `network-events.log` 一起复核。当前三类离线入口的事件格式为每次安装一行 `installed`，拒绝事件为 `blocked`；安装数应等于所选文件数，拒绝数应为 0。未知或不匹配内容先查运行器版本和原始事件，不忽略异常行。该格式来自[网络审计实现](../scripts/lib/agent-network-audit.mjs)，将来工具变化时重新核对，不视为永久协议。
5. 保留接收复核记录和未覆盖项。包完整、原生测试通过只证明本次所选离线范围，不证明真实 API、真实协议数据、浏览器、钱包、交易或需求覆盖充分；没有实际外部移交时仍写本机演练。

2026-10-27 联合演练已通过：前端 17、SDK 153、API 12 项；13 个附件及三条件基础设施输入工作表独立复制/校验、包内结果复核、缺失/篡改/错误摘要拒绝均符合预期。见[本轮记录](solana-agent-friendliness-history.md#三类离线证据联合交接验收记录2026-10-27)。这是同机目录隔离演练，未执行业务需求或真实跨机器交付。

## 接受的输入与清单

当前接受已有工具产生且带 status、scope 和 checkedAt（或 finishedAt）的 JSON：

| scope | 来源 |
| --- | --- |
| solana-browser-prerequisites | 本地浏览器验收环境预检；仅准备状态，不证明服务或页面通过 |
| local-artifacts / local-artifacts-and-mainnet-program | SDK/WASM 与程序指纹 |
| configured-mainnet-lookup-tables | ALT 预检 |
| transaction-receipt | 交易回执证据 |
| local-read-only-infrastructure | 统一只读预检 |
| local-source-comparison | 对统一预检基线的本地源码指纹比较；不证明实时环境仍有效 |
| github-pr-preview | PR 精确预览部署元数据（不证明页面功能） |
| solana-statistics-index | Solana volume 索引契约、高度与最新事件年龄 |
| real-wasm-reference-vectors | 真实 WASM 离线基础数值参考向量 |
| acceptance-worksheet-consistency | 工作表一致性报告；必须显式提供唯一对应的 Markdown 工作表 |

每包 1～20 个 JSON 报告，每报告最大 16 MiB；可选附加一份最大 1 MiB 的 Markdown 工作表。名称为小写字母开头、最多 40 字符的小写字母/数字/连字符，不可重复或为 manifest。报告输入必须是普通 `.json` 文件，工作表必须是普通 `.md` 文件；最终输入文件、包目录本身以及包内文件不能是符号链接，包内只允许清单声明的报告、工作表、显式附件及 manifest，不允许其他文件或子目录。工具不执行输入内容、不遍历目录、不自动发现日志或 `.env`，不读取助记词。祖先目录的符号链接和并发修改不是本工具的隔离边界，使用任务内受控目录。

清单记录 schemaVersion、需求标签、打包时间、打包器源码 SHA-256，以及每个文件的名称、字节数、SHA-256、scope、原状态、原观察时间。原报告的源码 commit/dirty、文件指纹、网络、API/SDK/程序版本等完整留在原文件中，不把多个历史报告假定为同一次观察或同一部署。打包时间不是重新检查时间，不增加数据新鲜度。

verify 比较每个报告与清单的原始字节摘要、字节数及提取元数据，拒绝缺失、额外、修改、不一致、重复条目、路径越界及不支持的格式。普通报告只检查最低外形和完整性；工作表额外检查下文绑定规则。不再次验证交易语义、RPC 真实性、文件来源或报告内容中的嵌套源码摘要；这些仍由原工具和任务验收负责。

## 完整性与失败处理

SHA-256 不是签名。若文件和清单被一起改写，重新计算的清单也可能通过内部一致性校验；必须与工作表或其他可信渠道单独保留的 manifestSha256 对照，才能发现整个包被替换。即便摘要一致，也不证明原报告真实或业务正确。工具不提供来源认证、自动上传、保密存储或长期托管服务。

接收侧的 `verify --expected-manifest-sha256 SHA256` 要求严格的 64 位小写十六进制字符串；空值、空白、大写、长度错误或不匹配均退出 1，无成功报告。比较的是 manifest.json 原始字节的摘要，先匹配预期值，再继续验证包内所有文件；匹配不会绕过内部完整性或工作表一致性检查。参数仅用于 verify，误传给 pack 会在创建输出前失败。

成功输出的 `manifestIdentity` 为 `matched`，表示本包与调用者提供的摘要匹配；未提供预期摘要时为 `not-checked`，只完成内部校验。原用法继续可用于本地结构诊断；接收交付物时应传入包外可信记录中的值。pack 也返回 not-checked，不能把刚从收到的包计算出的摘要反填参数，冒充独立身份验证。版本 1/2/3 均支持预期摘要比较，旧包无需重打；新增附件需要新建版本 3 包。匹配不是签名或来源认证，仍需核对预期值的来源。

输入先全部读取和检查，再独占创建输出目录，不覆盖已有文件。文件系统写入中途失败可能留下不完整目录；verify 会拒绝缺清单或缺文件的包。不要把失败目录当成功产物，调查原因后选择新输出目录重做；工具不会自动删除用户文件。错误信息不输出输入内容或原始文件系统错误，结合命令参数和本页诊断格式、文件存在性、输出目录冲突与内容差异。

原始包默认放在被 Git 忽略的 `.local/acceptance/evidence/`。共享交接记录保留 manifestSha256、所含报告的观察时间/版本和未覆盖条件；需要交给其他人时，通过已批准渠道复制整个包，不因工具已实现就自动上传或发送消息。Markdown 工作表直接作为显式文件附加，不把文档或日志强行包装成 JSON。

## 首阶段验收与边界（历史记录）

| 条件 | 结果 |
| --- | --- |
| 状态、原字节与精度保留 | passed；五种状态逐一打包，精确整数字符串与原始文件字节不变；不会推断业务结果 |
| 离线复制与篡改 | passed；删除测试输入后复制包仍可校验；内容修改、清单字段冲突、缺/额外文件、重复条目、越界路径与符号链接均失败 |
| 非法输入与不覆盖 | passed；不支持格式/状态、非 JSON、非法名称/需求编号失败；已有输出拒绝覆盖，输入内容不写入错误 |
| 真实报告演练 | passed；既有 runtime、ALT、receipt 报告生成 FESOL-71 资源演练包，复制到临时目录独立校验通过；篡改 ALT 后退出 1，无成功报告 |
| 工程与交接 | passed；类型检查、ESLint 零警告、格式/语法检查、115 个文档本地链接与摘要检查通过；完整前端单元测试 299 文件 / 3014 tests passed、1 原有跳过，退出 0 |

演练包 manifestSha256：`bcaf9a0ad8a39ea3e05927b6374672801f6ca3cc3dcfa405d27c80760fcd82d1`。原始演练文件在本机 `.local/acceptance/evidence/` 的 mainnet-resources/、pack.json、transfer.json、tamper.json，默认不随 Git 共享。真实报告观察时间分别为 UTC `2026-10-24T17:43:16.290Z`、`17:49:06.750Z`、`18:03:04.816Z`（均为北京时间 2026-10-25），是此前已执行报告，本轮未重查链上状态。

本轮完成证据打包与移交校验阶段；不表示 FESOL-71 已验收，不修改 Linear。A14 整体仍部分完成，预览部署绑定、API 实际部署版本及交易业务证据按对应任务推进。

本轮源码基线 `a31180d7e4`，实施中 dirty=true；新增 3 组针对性测试通过。完整前端测试耗时 126.48 秒，日志含既有 happy-dom teardown AbortError，最终无失败测试且退出 0；未因此修改无关业务或依赖。本轮没有启动服务、浏览器、UI 测试、构建或部署，也未读取钱包或发送交易。


## 工作表与检查报告一起移交

先完成[工作表检查](agent-acceptance-workflow.md#工作表自动一致性检查)，冻结本次 Markdown，再保存其 JSON 检查报告。非零退出码可能表示业务条件未全部通过：先核对退出码与 JSON，不使用 `&&` 将合法 partial 报告直接当成无效产物。只有结构一致、带工作表摘要的报告可进入绑定包；结构错误报告不能绑定。

```sh
mkdir -p .local/acceptance/worksheet-consistency
yarn agent:acceptance --file docs/acceptance/FESOL-55.md > .local/acceptance/worksheet-consistency/report.json
```

上例历史工作表预期退出 2、requirementAcceptance=partial。确认这是预期结论后，在主仓库根目录单独执行：

```sh
yarn agent:evidence pack --issue FESOL-55 \
  --report acceptance=.local/acceptance/worksheet-consistency/report.json \
  --worksheet docs/acceptance/FESOL-55.md \
  --out .local/acceptance/evidence/fesol-55-worksheet

yarn agent:evidence verify --dir .local/acceptance/evidence/fesol-55-worksheet
```

输出目录必须新建，示例路径不保证在其他机器存在。扩展沿用原命令：

- 一个包只绑定一份工作表和一份 scope 为 acceptance-worksheet-consistency 的报告，仍可同时包含其他支持的工具报告。该报告与 `--worksheet` 必须成对提供；不自动寻找仓库文件。
- 原样保存工作表为 `worksheet.md`，核对其字节数、SHA-256、报告中的 worksheetSha256。复用当前版本 checkWorksheet，逐项比较报告的 scope/status、汇总结论、五种状态统计、证据记录数及 not-evaluated 边界；使用 `agent:acceptance --include-mapping` 时，同时重新计算并核对报告的完整 mapping；未带该字段的旧报告保持兼容。report.checkerSha256 作为历史身份记录，只校验格式，不伪称验证了其源码来源。
- 无附件的工作表包 schemaVersion=2；manifest.worksheet 绑定文件、摘要、报告名与 requirementAcceptance。普通包继续为版本 1。当前工具支持版本 1/2/3；只支持版本 1 的旧工具会拒绝版本 2，接收侧应使用本次或更新的兼容工具。
- verify 只需包及工具，不需源工作表、原始 JSON 路径或被引用的日志；复制到独立目录后仍可校验。只重新运行无副作用的工作表一致性逻辑，不执行表内命令、不读取表内原始证据路径，也不重查业务或链上数据。
- 包的顶层 requirementAcceptance 始终为 not-evaluated；worksheet.requirementAcceptance 反映所列条件的原结论，partial/blocked/failed 不被提升为 passed。报告的原状态与观察时间保留，verify 不刷新历史 checkedAt。

交接顺序为：**填写并冻结工作表 → 检查并确认结论 → 打包 → 将 manifestSha256 保存到包外的可信交接记录 → 接收侧用 `--expected-manifest-sha256` 校验并比对摘要**。不要在打包后修改被归档的工作表来填写包摘要，避免摘要自引用。确需更改工作表时，重新检查并创建新包，保留旧包和历史记录。

工作表绑定只证明包内字节与计算出的结构一致；不验证需求是否完整覆盖、证据真实/充分/新鲜，或 source/deployment 版本是否仍有效。与报告和清单一起伪造的工作表仍可能内部一致，不能替代包外摘要与来源核对。工具保留原始 Markdown，打包前同样需确认不含秘密。


### 工作表移交验收记录（2026-10-25）

FESOL-55 本轮真实检查报告及工作表成功打包；复制到临时目录、删除演练输入副本后，从临时工作目录独立校验通过。原字节、检查时间和 partial 结论保留；完整包摘要独立计算一致。六项负面演练均拒绝：缺/改工作表、额外文件、错误报告名、篡改统计并重算报告清单摘要、缺绑定输入。旧版本 1 历史包 mainnet-resources 继续可验。产物位置、包外摘要及工程结果见[清单进度](agent-acceptance-infrastructure.md#a07a14-工作表与检查报告移交进度2026-10-25)。

工程验收已通过：5 组证据包测试（新增 2 组）及 3 组工作表回归、类型检查、脚本 ESLint/格式/语法、141 个本地文档链接与差异检查；完整前端单元测试 3014 passed / 1 原有 skipped，退出 0。blocked/failed 的额外合成状态演练也保持原结论，不将其作为真实业务验收结果。


### 接收侧摘要比对验收（2026-10-25）

使用此前已在包外文档记录摘要的版本 1 mainnet-resources 与版本 2 工作表包完成真实 CLI 验收：正确摘要 matched；错误摘要、另一份合法包、内部仍一致的清单替换均拒绝。六种非法摘要和 pack 误用参数均退出 1；未提供参数时明确 not-checked。包文件、原报告时间和 partial 结论不变；产物和工程结果见[清单进度](agent-acceptance-infrastructure.md#a14-接收侧预期摘要校验进度2026-10-25)。

本轮工程检查通过：6 组证据包测试（新增 1 组）、3 组工作表回归、类型及脚本 ESLint/格式/语法；完整前端单元测试 3014 passed / 1 原有 skipped，退出 0；142 个本地文档链接与差异检查通过。
