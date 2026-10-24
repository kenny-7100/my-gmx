# Agent 验收证据包

更新日期：2026-10-25。对应 A14 的本地证据移交阶段。工具将显式选择的现有 JSON 报告及可选的绑定 Markdown 工作表复制为独立目录，生成清单并离线检查完整性与工作表一致性，不重新执行验收、不启动服务、不上传、不修改业务代码。

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

## 接受的输入与清单

当前接受已有工具产生且带 status、scope 和 checkedAt（或 finishedAt）的 JSON：

| scope | 来源 |
| --- | --- |
| local-artifacts / local-artifacts-and-mainnet-program | SDK/WASM 与程序指纹 |
| configured-mainnet-lookup-tables | ALT 预检 |
| transaction-receipt | 交易回执证据 |
| local-read-only-infrastructure | 统一只读预检 |
| local-source-comparison | 对统一预检基线的本地源码指纹比较；不证明实时环境仍有效 |
| github-pr-preview | PR 精确预览部署元数据（不证明页面功能） |
| solana-statistics-index | Solana volume 索引契约、高度与最新事件年龄 |
| real-wasm-reference-vectors | 真实 WASM 离线基础数值参考向量 |
| acceptance-worksheet-consistency | 工作表一致性报告；必须显式提供唯一对应的 Markdown 工作表 |

每包 1～20 个 JSON 报告，每报告最大 16 MiB；可选附加一份最大 1 MiB 的 Markdown 工作表。名称为小写字母开头、最多 40 字符的小写字母/数字/连字符，不可重复或为 manifest。报告输入必须是普通 `.json` 文件，工作表必须是普通 `.md` 文件；最终输入文件、包目录本身以及包内文件不能是符号链接，包内不允许额外文件或子目录。工具不执行输入内容、不遍历目录、不自动收集日志或 `.env`，不读取助记词。祖先目录的符号链接和并发修改不是本工具的隔离边界，使用任务内受控目录。

清单记录 schemaVersion、需求标签、打包时间、打包器源码 SHA-256，以及每个文件的名称、字节数、SHA-256、scope、原状态、原观察时间。原报告的源码 commit/dirty、文件指纹、网络、API/SDK/程序版本等完整留在原文件中，不把多个历史报告假定为同一次观察或同一部署。打包时间不是重新检查时间，不增加数据新鲜度。

verify 比较每个报告与清单的原始字节摘要、字节数及提取元数据，拒绝缺失、额外、修改、不一致、重复条目、路径越界及不支持的格式。普通报告只检查最低外形和完整性；工作表额外检查下文绑定规则。不再次验证交易语义、RPC 真实性、文件来源或报告内容中的嵌套源码摘要；这些仍由原工具和任务验收负责。

## 完整性与失败处理

SHA-256 不是签名。若文件和清单被一起改写，重新计算的清单也可能通过内部一致性校验；必须与工作表或其他可信渠道单独保留的 manifestSha256 对照，才能发现整个包被替换。即便摘要一致，也不证明原报告真实或业务正确。工具不提供来源认证、自动上传、保密存储或长期托管服务。

接收侧的 `verify --expected-manifest-sha256 SHA256` 要求严格的 64 位小写十六进制字符串；空值、空白、大写、长度错误或不匹配均退出 1，无成功报告。比较的是 manifest.json 原始字节的摘要，先匹配预期值，再继续验证包内所有文件；匹配不会绕过内部完整性或工作表一致性检查。参数仅用于 verify，误传给 pack 会在创建输出前失败。

成功输出的 `manifestIdentity` 为 `matched`，表示本包与调用者提供的摘要匹配；未提供预期摘要时为 `not-checked`，只完成内部校验。原用法继续可用于本地结构诊断；接收交付物时应传入包外可信记录中的值。pack 也返回 not-checked，不能把刚从收到的包计算出的摘要反填参数，冒充独立身份验证。两种包格式均支持，无需重新打包；包的 schemaVersion 不变。匹配不是签名或来源认证，仍需核对预期值的来源。

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
- 原样保存工作表为 `worksheet.md`，核对其字节数、SHA-256、报告中的 worksheetSha256。复用当前版本 checkWorksheet，逐项比较报告的 scope/status、汇总结论、五种状态统计、证据记录数及 not-evaluated 边界；report.checkerSha256 作为历史身份记录，只校验格式，不伪称验证了其源码来源。
- 新包 schemaVersion=2；manifest.worksheet 绑定文件、摘要、报告名与 requirementAcceptance。普通包继续为版本 1。当前工具支持两种版本；旧工具会拒绝版本 2，接收侧应使用本次或更新的兼容工具。
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
