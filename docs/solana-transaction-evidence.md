# Solana Mainnet 交易回执证据

更新日期：2026-10-25。对应 A12 的基础回执证据阶段，已实现并验收；**A12 完整订单生命周期仍未完成**。工具是只读验收基础设施，不调用钱包、不签名或发送交易，不修改业务代码。

## 何时使用与执行顺序

后续 Agent 已有交易签名，需要核实链上结果、保留完整回执或调查失败时，使用本工具。它不依赖助记词，也不要求该签名来自本地专用钱包。签名应来自当前验收流程的实际产物；文档中的历史签名只用于演练，不替代新需求的交易。

在主仓库根目录，先启动既有代理：

```sh
yarn solana:rpc-proxy
```

另一终端执行：

```sh
yarn solana:transaction-evidence --network solana-mainnet --signature <signature>
```

需要归档时：

```sh
mkdir -p .local/acceptance/solana-transaction
yarn solana:transaction-evidence --network solana-mainnet --signature <signature> > .local/acceptance/solana-transaction/report.json
```

必须检查命令退出码和报告状态再消费文件；失败时 stdout 可能为空。工具不启动服务、不重试或轮询；遇到未 finalized 或回执不可用，保留结果并按该需求的等待预算稍后显式重查，不自动换公共 RPC。关闭本次自行启动的代理。

执行入口：[scripts/solana-transaction-evidence.mjs](../scripts/solana-transaction-evidence.mjs)。复用钱包余额模块的 Mainnet 连接器、项目 RPC 配置及超时；不读取钱包配置。可沿用进程级 `SOLANA_RPC_PROXY_URL`，输出仅记录 origin，错误不包含请求 URL、RPC 错误正文或参数。

## 检查与证明边界

1. 要求显式 Mainnet 与合法的 64 字节 base58 签名；先校验完整 genesis，错误网络不查询签名或交易。
2. `getSignatureStatuses` 使用 `searchTransactionHistory: true`。状态必须有合法 slot、观察 context 和明确 confirmationStatus。只有 finalized 且 confirmations=null 才继续读取回执。
3. `getTransaction` 使用 finalized、json、maxSupportedTransactionVersion=0。交叉核对第一签名、slot 和 meta.err；缺 meta、字段不合法、回执身份冲突明确失败。支持 legacy/v0，更新版本不静默解析。
4. 校验精确手续费、原生 pre/post balances、解析后的账户总数及基本消息结构；v0 必须包含 loadedAddresses。完整回执原样保留并将所有整数转为十进制字符串，避免 JSON/Number 舍入。报告不是完整交易语义验证器，不校验每条指令的业务权限、代币可花费额度或价格正确性。

| 报告状态 / 退出码 | 含义 |
| --- | --- |
| passed / 0 | finalized 回执身份一致且 meta.err=null；仅表示该交易链上成功 |
| failed / 1，transaction-failed | 已取得完整回执，但 meta.err 非 null；报告仍包含失败证据 |
| blocked / 2 | signature-not-found、not-finalized 或 receipt-unavailable；不能推断成功或失败，不等于已证明交易从未存在 |
| failed / 1，其他错误 | 配置、错误网络、超时/网络、HTTP、JSON-RPC、无效响应或证据冲突；stderr 提供脱敏分类，无成功报告 |

`status` 在本工具中包含交易链上结果，不只是“RPC 可用”。因此链上失败退出 1 是正确诊断结果，不能为了工具验收绿灯修改为 passed。未知签名与缺回执不能当作 canceled、expired 或订单未创建。

所有报告固定 `scope: transaction-receipt`、`orderExecution: not-evaluated`。创建订单交易成功不证明 keeper 执行、成交/取消原因、最终持仓或 API 刷新。完整 A12 后续还需关联订单账户、执行/取消交易和协议事件；不能仅靠账户消失或本工具的 passed 宣称订单成交。

## 版本、摘要与复核

报告包含观察时间、网络/genesis、RPC origin、签名、状态 context、finalized 回执、交易结果与精确手续费。`source` 记录主仓库 commit/dirty 和检查器、共享连接器、RPC 配置 SHA-256，dirty=true 时不能仅凭 commit 还原工具，需核对文件摘要。

`receiptSha256` 对 receipt 进行 JavaScript `JSON.stringify`（整数已转为十进制字符串，无空格）后的 UTF-8 字节计算 SHA-256；不排序字段，复核时保留报告字段顺序。它绑定此次 RPC 回执内容，不能证明供应商响应的密码学真实性，也不是区块/交易签名摘要。多个请求不构成原子快照，使用 finalized 并交叉核对减少状态不一致，不能替代独立节点共识验证。

`.local/acceptance/solana-transaction/` 被 Git 忽略，不保证其他机器存在；共享验收工作表保留时间、源码与公开摘要，原始证据按批准渠道移交。回执可能包含公开钱包活动和程序日志，归档时按任务需要选择范围，不复制环境或凭据。

## 本轮验收记录

源码基线 `4765914c89`，执行中 dirty=true；未变更业务实现。真实演练选择专用钱包已存在的历史签名：

`3NcH2BMjTonrGaX8HRz2tJcR7fv345dLW2DEPvDA3QsLEmpE4jHedg5m7VbLDospZRRQqt2M4F9TrVhtMsSUMiwY`

| 检查 | 结果 |
| --- | --- |
| 真实回执 | passed，finalized legacy，slot 460034160，fee 25000 lamports，共 15 个账户；完整 meta 与消息归档 |
| 独立解析对照 | Python 标准 JSON 解析另一请求的 jsonParsed 响应；签名、slot、fee、err、全部 pre/post 原生余额及账户数一致。同一供应商，不宣称独立共识验证 |
| 关键自动测试 | 3 组：legacy/v0 × 成功/指令失败/交易失败、u64 精度、缺失/未 finalized、身份与结果冲突、元数据/账户字段错误、错误网络；测试源不超过实现行数 |
| CLI 失败路径 | 实际缺 network、非法签名、未知签名、不可达代理，以及注入 HTTP/JSON/JSON-RPC 错误均返回预期非零；输出不泄露输入标记或错误正文 |
| 工程与交接 | passed；ESLint 零警告、格式/语法、类型检查与完整前端单元测试通过（299 文件 / 3014 tests，1 原有跳过），进程退出 0；停服返回 network-error / 退出 1、无成功报告；文档链接与摘要核对通过 |

原始文件：history.json、report.json、comparison.json、failures.json、unit.log 以及工程检查日志。history 仅用于本轮选择已有签名，不作为长期账户样本依赖。工具没有新增 RPC 方法权限，没有执行新交易；Devnet 继续暂缓。

本轮回执观察时间 `2026-10-24T18:03:04.816Z`，receiptSha256 为 `39b5722447c106cd7066dc3c9c3ff2b063ab729b9421dfaeb070917304029877`。检查器 SHA-256 为 `19fb6b5d602e6bda67b8ecd6934524871c13d7c65b47c52b22f5055ded71ba7d`；实际报告的源码摘要与最终实现一致。前端测试日志仍有既有 Browserslist 提示与 happy-dom teardown AbortError，无失败测试且进程退出 0，不修改无关依赖。自行启动的代理已关闭。
