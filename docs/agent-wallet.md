# 本地 Agent 验收钱包

更新日期：2026-10-24。A05 的本地工具：从根目录 `.env.local` 读取一份专用验收助记词，派生首个 EVM、Solana 地址。用户已配置助记词并批准实际只读验收。

**当前状态：地址工具与 Mainnet 原生 SOL 余额预检均已完成验收。** 用户已批准暂时只覆盖 Mainnet，Devnet 暂缓；本轮仅扩展本地验收脚本，不修改业务代码，不实现签名或发送。

## 配置与入口

配置文件为主仓库根目录 `.env.local`，变量名为 `AGENT_TEST_WALLET_MNEMONIC`。本机已由用户填写英文 BIP-39 助记词；其他机器由用户自行配置：

```dotenv
AGENT_TEST_WALLET_MNEMONIC="<your dedicated test wallet mnemonic>"
```

该变量不带 `VITE_` 前缀，仅供本地 Node 工具读取；不通过参数传入助记词，不注入前端。文件已被 Git 忽略，不能将真实助记词放入文档、对话、日志或版本控制。脚本不生成助记词，不修改原配置，也不从进程环境静默选择另一份钱包。

依赖仓库现有 Node 22 和 `ethers`，未添加依赖。在主仓库根目录执行：

```sh
yarn agent:wallet addresses
```

脚本路径：[scripts/agent-wallet.mjs](../scripts/agent-wallet.mjs)。配置文件路径相对于脚本定位到主仓库根目录，不依赖调用时偶然所在的目录。

标准输出为 JSON，仅包含账户索引、无额外 BIP-39 passphrase 的说明，以及各链公开地址、链类型、固定派生路径：

| 钱包 | 固定路径 | 派生约定 |
| --- | --- | --- |
| EVM 首个账户 | `m/44'/60'/0'/0/0` | BIP-39 + BIP-32，使用 ethers；地址适用于多个 EVM 网络，资金仍按具体网络独立 |
| Solana 首个账户 | `m/44'/501'/0'/0'` | BIP-39 seed + SLIP-0010 Ed25519 全硬化派生；Node HMAC/Ed25519 加密能力，公钥编码为 base58 |

支持英文 BIP-39 有效单词数量及校验和；当前不支持额外 BIP-39 passphrase、自定义路径或其他账户索引。不同钱包导入时的默认路径可能不同，充值前必须核对工具显示的地址与上述路径。用户自行准备并充值专用验收钱包；配置助记词不等于授权后续签名或发送真实交易。

## Mainnet 余额预检与执行顺序

需要资金或账户状态的后续验收，在执行已获授权的只读检查时先运行本工具，再依据具体需求判断资金是否足够。主仓库根目录依次执行：

```sh
yarn solana:rpc-proxy
```

在另一终端执行：

```sh
yarn agent:wallet balances --network solana-mainnet
```

工具默认复用 `src/config/solanaRpc.json` 的本地代理 URL。需要更改地址时，通过当前进程的 `SOLANA_RPC_PROXY_URL` 指定 HTTP(S) URL；该覆盖项不会自动从 `.env.local` 加载。钱包助记词仍只从根 `.env.local` 读取。验收后关闭本次自行启动的代理；不关闭其他任务启动的服务。

工具先读取并严格校验完整 Mainnet genesis hash，再请求该公开地址的 `getBalance`，commitment 为 `confirmed`。输出 JSON 包含 `status`、`checkedAt`、网络、genesis、`rpcOrigin`、公开地址、路径、slot、资产、lamports 与 SOL。金额和 slot 为字符串；使用 Node 22 的原始 JSON 数字 token 和 BigInt，避免超过安全整数范围时丢失精度，SOL 固定九位小数。这里只检查原生 SOL，不包含 SPL/WSOL、协议账户、持仓或订单。

成功表示网络和余额读取有效；零余额也是有效读取，不代表满足交易预算。非零余额同样不证明协议可用、交易可执行或已获得交易授权。后续资金相关验收应重新读取，不能依赖本文的历史余额。

遇到失败先查看错误码：代理未启动为 `network-error`；超时、HTTP/JSON-RPC 错误、非法响应或网络不符均以非零退出码明确失败，不转换为零余额，不自动重试或更换供应商。HTTP 502 表示本次请求失败；先核实代理与上游状态，恢复后再显式重跑。完整 RPC genesis hash 不等于截短的 CAIP 链标识，校验时复用完整值，不能截断。

## 行为与错误边界

- `addresses` 不访问网络、不查询余额、不签名、不发送交易，不需要 RPC 或本地 RPC 代理。
- 不输出助记词、seed、私钥或 ethers 原始异常；缺少文件、变量为空、助记词非法或未知命令均明确失败，退出码为 1。成功及 `--help` 退出码为 0。
- 不通过页面钱包连接，不修改前端钱包体系。后续签名和发送能力尚未实现，不能将地址派生视为签名兼容性或交易流程验收。
- 后续 Agent 使用实际钱包前，先确认本阶段是否已获执行授权；不读取或展示 `.env.local` 全文，直接使用会脱敏错误的工具。

## 验收计划与进度

| 阶段 | 当前状态 | 验收条件 |
| --- | --- | --- |
| 工具与配置入口 | 已实现 | 单命令读取固定配置文件、校验助记词并输出两条固定路径的地址 |
| 静态检查 | 已通过 | 钱包相关脚本的 Node 语法、格式与 ESLint（零警告）、文档路径、`git diff --check` 及 `.env.local` Git 忽略检查通过 |
| 公开向量及失败路径 | 已通过（当前共 6 组测试） | `yarn test:agent-wallet`；EVM 对照公开 Hardhat 地址，Ed25519 对照独立 SLIP-0010 公钥向量；检查配置缺失/无效值、CLI 参数和错误输出不泄露输入 |
| 用户实际配置 | 已确认并校验通过 | 用户填写 `.env.local` 的 `AGENT_TEST_WALLET_MNEMONIC` 后授权测试，实际 BIP-39 校验通过；未展示配置内容 |
| 实际地址派生 | 已通过 | `yarn agent:wallet addresses` 成功；重复派生结果一致，并与 CLI 输出逐项比对一致；仅输出公开地址和路径 |
| 资金来源说明 | Mainnet 已链上核验，Devnet 为用户确认 | Mainnet 原生 SOL 已实际读取；Devnet 资金仍仅为用户确认，EVM 不要求有资金 |
| Mainnet 网络与 SOL 余额 | 已实现并通过真实只读验收 | 先校验 Mainnet genesis，再读取 confirmed SOL 余额；报告精确 lamports/SOL 和 slot；失败不得伪装零余额，零余额不自动判为不通过 |
| Devnet 网络与余额 | 按用户决定暂缓 | 四个现有 Alchemy key 均未启用 Devnet；不阻挡本轮 Mainnet 工具建设，不自动改用公共 RPC |
| 本地签名、发送与确认 | 待实施，未获实际交易授权 | 复用项目交易构建与校验；明确网络、允许操作及预算后逐项实施和验收；现有代理禁止广播 |
| 业务账户样本与恢复 | 待准备 | 持仓、挂单、ALT 及准备/清理方式仍按 A05/A12/A13 逐项完善 |

公开测试仅使用公开向量和临时配置文件，不读取用户 `.env.local`。相关规范：[自动化工具沉淀约定](automation-tools.md)、[基础设施清单](agent-acceptance-infrastructure.md)。

2026-10-24 地址阶段验收记录：`yarn test:agent-wallet` 三组测试全部通过；实际配置地址命令退出 0，后续两次独立读取配置并派生得到相同结果，与 CLI 两链地址一致。过程未访问 RPC、未签名或发送交易，未展示助记词、seed 或私钥。Solana devnet 与 mainnet 使用同一条派生路径和地址，余额及交易状态按网络分别核验。

## Devnet RPC 前置复核（2026-10-24）

用户要求先核实 Devnet 可用性。对现有 Alchemy `fallback`、`development`、`largeAccount`、`express` 四个 key，各以不带 Origin 和 `Origin: https://app.gmx.io` 请求 `solana-devnet.g.alchemy.com` 的 `getGenesisHash`、`getSlot`、系统程序 `getAccountInfo`：8 个批量请求、24 个方法调用均返回 HTTP 403，JSON-RPC code `-32600`，错误为 `SOLANA_DEVNET is not enabled for this app.`。

结论是现有四个 Alchemy App 均未启用 Solana Devnet；不是已确认的 Origin 白名单问题，添加 Mainnet 代理相同的 Origin 不能解决。链标识和账户数据均未读到，不能记为网络校验或余额读取通过。未请求钱包余额、未使用助记词、未签名或发送交易，也未修改 RPC 配置。

Devnet 后续工作需资源所有者在 Alchemy Dashboard 的对应 App → Networks 启用 Solana Devnet，或由用户明确提供其他已获批准的 Devnet RPC 配置。若继续复用当前方案，优先协调 `fallback` App；启用后重新核实权限和 Origin 条件，再接入工具。不能自动改用公共 RPC 绕过此前的供应商约定。

## Mainnet 余额预检验收记录（2026-10-24）

| 检查 | 结果与边界 |
| --- | --- |
| 实际命令 | `yarn agent:wallet balances --network solana-mainnet` 退出 0，`status: passed`；完整 Mainnet genesis 校验通过 |
| 实际余额 | 地址 `5YWh3pxkfA1eXaHuGhjB8nD6un2K8BuhhMzLQpFfYhEb`，`98404876` lamports / `0.098404876` SOL；slot `460908942`，`checkedAt: 2026-10-24T15:55:51.191Z` |
| 独立 RPC 对照 | 同一代理另行 `getBalance` 返回 HTTP 200、相同 lamports，slot `460909022`；slot 随链推进而改变 |
| 精度与失败测试 | `yarn test:agent-wallet` 共 6 组通过：保留既有地址测试，新增 Mainnet 校验顺序、零余额、超过安全整数范围及 u64 边界、错误响应与脱敏失败测试 |
| 实际失败路径 | 关闭本次启动的代理后，Mainnet 命令退出 1、`network-error`，无成功输出；Devnet 命令退出 1、`configuration-error` |
| 工程检查 | 钱包脚本格式、ESLint 零警告、Node 语法、根 `yarn tscheck`、`git diff --check` 通过；本轮未运行 UI、前端构建或部署 |

验收中修正了误用截短链标识的问题；一次上游 HTTP 502 被明确报告为失败，后续显式重跑成功，没有增加自动重试或替代 RPC。全部改动属于脚本和说明文档；未修改业务代码，未签名或发送交易。本次启动的代理已关闭。A05 整体仍为部分完成，账户样本、签名、发送及恢复另行推进。
