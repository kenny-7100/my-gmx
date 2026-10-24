# Solana ALT 资源预检

更新日期：2026-10-25。对应 A05 的 ALT 资源阶段；状态：**本轮现有配置 ALT 资源预检已完成并验收通过**。

## 用途与范围

后续 Agent 验收 Solana 交易构建或依赖地址查找表（Address Lookup Table，ALT）的流程前，先确认项目配置的表存在、可解析、生命周期状态符合本轮预检条件，避免在构建/模拟失败后才发现基础资源失效。

入口：[scripts/solana-alt-preflight.mjs](../scripts/solana-alt-preflight.mjs)。直接动态读取 `src/config/gmsol/lookupTables.ts` 的现有两张 provisional Mainnet 表；不另建表配置，不修改业务代码、创建/扩展/冻结/停用 ALT，不构建、签名或发送交易，也不读钱包秘密。依赖现有 Node 22、tsx、ethers 和 RPC 代理，无新增依赖。

## 执行顺序

在主仓库根目录，已获 RPC 只读验收授权时先启动既有代理：

```sh
yarn solana:rpc-proxy
```

在另一终端执行：

```sh
yarn solana:alt-preflight
```

工具不启动服务或使用替代 RPC；使用现有 `SOLANA_RPC_PROXY_URL` 进程级覆盖和配置入口，不输出密钥 URL。先校验完整 Mainnet genesis，再以一次 `getMultipleAccounts` 请求读取所有配置表（base64、confirmed）。当前两张表共两次 RPC；无自动重试或服务切换。自行启动的代理在本任务结束后关闭，不关闭其他任务的服务。

配置列表需非空、唯一且不超过 100 张；表不存在、错误 owner/executable/type 或响应数量不符都明确失败，不跳过缺表。表 owner 必须为 `AddressLookupTab1e1111111111111111111111111`。

## 解析与生命周期判断

二进制布局对照本机已安装 Solana SDK 的 `node_modules/@solana/web3.js/src/programs/address-lookup-table/state.ts`；本工具不导入 web3.js，不作为业务解码器。固定 metadata 长 56 字节，typeIndex=1，读取 u64 deactivationSlot、u64 lastExtendedSlot、u8 lastExtendedSlotStartIndex、Option authority；其余为连续 32 字节地址，最多 256 项。u64 始终以 BigInt 解码、字符串输出，地址保持 base58 大小写。严格校验 base64、数据长度和索引/slot 元数据，不静默修补非法数据。

输出每张表的 authority、地址列表、总地址数、当前生效地址数、扩展 slot/起始索引、deactivationSlot、账户字节数和完整数据 SHA-256。两张表处于同一批次观察 slot；这是当时的链上读取快照，不代表表未来不可变。

| 状态 | 错误码/原因 | 含义 |
| --- | --- | --- |
| passed | `active-table` | deactivationSlot=u64 max，非空，当前观察 slot 下全部地址已生效 |
| blocked | `extension-warming-up` | 同一个 slot 刚扩展，只有起始索引之前的地址可用于当前 lookup；不能把新增地址当作已生效 |
| blocked | `deactivation-requested` | deactivationSlot 非 u64 max，已发起停用；可能仍处于可用冷却窗口，本工具保守标阻碍，不计算 SlotHashes 冷却期限，不宣称链上已完全不可用 |
| blocked | `empty-table` | 有效但无地址，不能作为本轮非空资源通过 |
| failed | `invalid-alt-account` | 缺表、数据/归属/类型/元数据错误，或批次长度不符 |

authority 为空代表当时表没有管理 authority；非空不会直接判失败，但说明表可由其管理者继续变更，必须记录。检测到未来扩展/停用 slot 或非法 startIndex 时报告失败，不猜测正确值。

通过只说明**配置表的存在性、格式和当前生命周期**符合上述预检条件，不证明两张 provisional 表已经评审通过、包含任意交易需要的地址、属于用户可管理资源、能够降低某笔交易大小或能成功模拟。具体交易仍需核对地址索引与表成员、余额、程序版本及模拟结果。不根据表中出现某个地址就信任该账户或程序。

## 报告与错误

正常检查 stdout 为 JSON：status、exitCode、scope、时间、Mainnet、观察 slot、配置文件 SHA-256、检查器 SHA-256 和 tables。退出码 0 表示所选配置表全通过，2 表示有 blocked；错误退出 1，stderr 输出固定错误码和脱敏提示，stdout 不输出部分通过报告。RPC 超时、错误网络或 HTTP/JSON-RPC 错误继续使用原工具的分类，不能被当作“没有表”。

```sh
mkdir -p .local/acceptance/solana-alt
yarn solana:alt-preflight > .local/acceptance/solana-alt/report.json
```

该目录被 Git 忽略。保存后先看退出码及 JSON，失败时文件可能为空。配置或链上表发生变化、准备新的交易验收时重新运行，不沿用历史 ready。该工具按需独立执行，不加入默认轻量统一预检，避免无 ALT 依赖的任务重复请求。

## 验收计划与进度

| 检查 | 结果 |
| --- | --- |
| 实际批次 | 两张配置表均 passed，73 与 155 个地址全部生效，authority 均为 `FQNU5wn6fVdnPnSZyHL3PmCJsNLTi4Cf8dKU7f3MQjXj` |
| 独立对照 | 分别 getAccountInfo、jsonParsed，由 RPC 服务端独立解码；完整地址列表、authority、lastExtendedSlot 与工具结果一致 |
| 自动测试 | 3 组通过：生命周期/精度/256 边界、缺账户/归属/数据非法、配置批次/错误网络/RPC 错误/阻碍汇总 |
| 停服和工程检查 | 已通过；停服退出 1 / network-error、无成功输出；ESLint 零警告、格式、Node 语法、类型检查、文档路径、git diff 检查通过；前端 299 文件通过 / 1 原有跳过，3014 测试通过 / 1 原有跳过 |

测试入口为 `yarn test:solana-alt-preflight`，使用真实项目配置和本地生成的账户二进制、mocked fetch，不连接实际 RPC。没有 mock 配置或 ethers 编解码器，不使用钱包秘密。

最终真实报告时间 `2026-10-24T17:49:06.750Z`（北京时间 2026-10-25），观察 slot `460940960`。两张表 lastExtendedSlot 分别为 `334632231`、`335402516`，deactivationSlot 均为 `18446744073709551615`，均不是当 slot 扩展。主仓库实施基线为 `bcc0ffdf7b`，实施中工作区有修改；报告记录配置与检查器 SHA-256，已对照最终文件一致。

本机证据位于 `.local/acceptance/solana-alt/report.json`、`comparison.json` 和 `stopped.json`，不会随 Git 共享；其他机器按授权重新运行。前端单元测试退出 0，日志仍有既有 Browserslist 过期提示和 happy-dom teardown AbortError 输出，未修改无关依赖/测试。本次启动的代理已关闭；没有修改业务代码或 ALT，未运行构建、UI、浏览器或部署，未签名或发送交易。A05 的协议账户样本与恢复、A13 真实交易仍待后续推进。
