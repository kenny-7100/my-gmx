# 本地 Agent 验收钱包

更新日期：2026-10-25。A05 的本地工具：从根目录 `.env.local` 读取一份专用验收助记词，派生首个 EVM、Solana 地址。用户已配置助记词并批准实际只读验收。

**当前状态：地址工具、Mainnet 原生 SOL 余额预检与代币账户盘点均已完成验收。** 用户已批准暂时只覆盖 Mainnet，Devnet 暂缓；本轮仅扩展本地验收脚本，不修改业务代码，不实现签名或发送。

## 配置与入口

CLI 与以下 Node 钱包工具使用不同的配置入口，不应假定两者的钱包地址相同。

## 本地 Solana CLI 排障约定

2026-10-27 用户确认：不依赖 UI 定位问题时，尤其是链上问题，在合适场合优先使用本地 Solana CLI。账户、余额、程序部署、交易确认及回执优先独立核对，再结合 SDK、API 或 UI 分析；CLI 不覆盖前端交互或业务数据转换的验收。

本机已安装 Agave Solana CLI 4.3.2，PATH 入口在 `~/.zprofile`，默认密钥文件为 `~/.config/solana/dev-wallet.json`。已验证 CLI 可读取该文件且本地密钥验证成功，权限为 `600`；未发送交易。上述为本机观察，换机器或配置变化后重新核实。

执行前使用 `solana config get` 和 `solana address` 核对网络及账户；必要时通过 `--url` 单次指定目标，不擅自更改默认配置。用户倾向 Devnet，但并非只使用 Devnet；钱包文件名不决定网络。CLI 与项目 Node 钱包工具应分别核对公开地址，不读取或输出助记词、私钥。

当前公共 Mainnet 默认 RPC 可作为低频查询入口，按实际响应判断可用性。用户提供的 `https://rpc-1.gmtrade.xyz/` 已通过带 `Origin: https://gmtrade.xyz` 的只读请求确认是 Mainnet；无 Origin 返回 403。CLI 无自定义 Header 参数时，可按需复用旧前端 `rpc-proxy/scripts/local-proxy.ts` 的 `dev:local:prod` 配置补充 Origin，启动服务仍遵循现有授权。该代理未限制写方法且未显式绑定 loopback，不应视为只读隔离。其 `dev:local:devnet` 配置的真实可用性尚未核验；旧文档关于 Alchemy Devnet 未启用的结论只适用于对应供应商配置。

优先执行只读命令；CLI 使用偏好不授予交易签名、广播、转账、空投或链上状态修改权限。必要时使用现有 RPC/SDK 工具补充 CLI 无法直接表达的查询，不为使用 CLI 强行增加代理或替代业务验收。

## Node 钱包工具配置

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

## Mainnet 代币账户盘点

已获钱包只读验收授权且任务依赖代币账户时，先启动现有 RPC 代理，再执行：

```sh
yarn agent:wallet tokens --network solana-mainnet
```

工具仍从根 `.env.local` 的同一配置派生公开地址，复用网络校验、脱敏错误和 RPC 设置。先校验完整 Mainnet genesis，再依次用 `getTokenAccountsByOwner`、`jsonParsed`、`confirmed` 读取 SPL Token 和 Token-2022 程序下的账户；不只查询 ATA，不按项目代币清单过滤。命令不创建账户、不请求空投、不签名或发送交易。

输出为完整 JSON：网络、公开地址、派生路径、检查时间、账户总数，以及各程序的 programId、slot 和账户列表。每个账户包含地址、mint、原始金额字符串 `rawAmount`、小数位 `decimals`、精确十进制字符串 `amount`、`state`、`isNative`；按账户地址稳定排序，保留零余额及 frozen 账户，不合并同 mint 的多个账户。金额只使用原始整数与小数位计算，忽略有浮点误差风险的 `uiAmount`。

这是一份账户余额盘点，不是可交易资产或可花费额度清单：

- 以 mint 精确匹配项目配置识别资产，不根据余额存在就信任代币名称、价格或用途。任意钱包可能收到无关代币。
- `frozen` 明确显示；委托、Token-2022 扩展、转账费、不可转移或 confidential balance 等限制未在本轮评估，基础 amount 不代表最终可转移数量。
- `isNative` 是 SPL 包装原生代币账户属性；WSOL 与钱包原生 SOL 分开，不能把账户租金或原生 SOL 重复计入。原生 SOL 继续使用 `balances` 命令。
- 两个程序分别返回自己的 slot，不承诺原子快照；后续资金相关任务重新读取，不能依赖历史报告。

两个程序都成功返回空列表时才是有效“未发现账户”。任一程序 HTTP/JSON-RPC 失败、缺少可解析数据、金额/归属非法或账户重复时，整项非零退出，不输出部分成功结果或空列表。无法解析的 Token-2022 账户也明确失败，不静默跳过。未知网络、缺少 network 参数、停服和秘密脱敏边界与已有命令一致。

统一预检的 `wallet` 项继续只检查原生 SOL；需要代币资金的任务单独运行 `tokens`，不把原生 SOL 通过当作抵押代币已具备。本机报告可按需保存到已忽略提交的 `.local/acceptance/agent-wallet/`，保存时仍检查退出码，失败时 stdout 可能为空。

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
| 公开向量及失败路径 | 已通过（当前共 9 组测试） | `yarn test:agent-wallet`；EVM 对照公开 Hardhat 地址，Ed25519 对照独立 SLIP-0010 公钥向量；检查配置缺失/无效值、CLI 参数和错误输出不泄露输入 |
| 用户实际配置 | 已确认并校验通过 | 用户填写 `.env.local` 的 `AGENT_TEST_WALLET_MNEMONIC` 后授权测试，实际 BIP-39 校验通过；未展示配置内容 |
| 实际地址派生 | 已通过 | `yarn agent:wallet addresses` 成功；重复派生结果一致，并与 CLI 输出逐项比对一致；仅输出公开地址和路径 |
| 资金来源说明 | Mainnet 已链上核验，Devnet 为用户确认 | Mainnet 原生 SOL 已实际读取；Devnet 资金仍仅为用户确认，EVM 不要求有资金 |
| Mainnet 网络与 SOL 余额 | 已实现并通过真实只读验收 | 先校验 Mainnet genesis，再读取 confirmed SOL 余额；报告精确 lamports/SOL 和 slot；失败不得伪装零余额，零余额不自动判为不通过 |
| Devnet 网络与余额 | 按用户决定暂缓 | 四个现有 Alchemy key 均未启用 Devnet；不阻挡本轮 Mainnet 工具建设，不自动改用公共 RPC |
| Mainnet 代币账户盘点 | 已实现并通过真实验收 | 两种程序读取、精确金额、归属/状态与错误边界；真实 RPC 对照和停服验证 |
| 本地签名、发送与确认 | 待实施，未获实际交易授权 | 复用项目交易构建与校验；明确网络、允许操作及预算后逐项实施和验收；现有代理禁止广播 |
| 业务账户样本与恢复 | 待准备 | ALT 已有[独立只读预检](solana-alt-preflight.md)，持仓、挂单及准备/清理方式仍按 A05/A12/A13 逐项完善 |

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

## Mainnet 代币账户盘点验收记录（2026-10-25）

| 检查 | 结果 |
| --- | --- |
| 实际钱包 | `tokens --network solana-mainnet` 退出 0；26 个账户：SPL Token 23 个、Token-2022 3 个；包含零金额账户及 WSOL 账户 |
| 独立 RPC 对照 | 两种程序另行 getTokenAccountsByOwner，逐账户地址、mint、原始金额、小数位、状态、isNative 全部一致；USDC 另用 getTokenAccountBalance 对照，`11007505` 原始单位 / `11.007505` USDC 一致 |
| 精度及失败自动测试 | 当前 `yarn test:agent-wallet` 9 组通过；新增 3 组覆盖两种程序、零金额、超过安全整数范围、u64 边界、冻结状态、归属/解析错误、重复账户及第二个程序失败不得部分成功 |
| 原有工具回归 | 原有地址/SOL 测试仍通过；统一预检 4 组测试通过，实际 `--checks wallet` 仍为 passed |
| 实际 CLI 失败 | 缺少网络与 Devnet 均退出 1 / configuration-error；关闭本次代理后 Mainnet 命令退出 1 / network-error，无成功输出 |
| 工程检查 | Node 语法、钱包相关脚本及统一预检 ESLint 零警告、Prettier、类型检查、文档路径及 git diff 检查通过；前端回归 299 文件通过 / 1 原有跳过，3014 测试通过 / 1 原有跳过 |

本机报告位于 `.local/acceptance/agent-wallet/tokens.json`、`tokens-comparison.json` 和 `sol-regression.json`，该目录已被 Git 忽略。盘点时间 `2026-10-24T16:51:42.915Z`（北京时间 2026-10-25），独立对照时间 `2026-10-24T16:56:09.948Z`；余额可能随后改变，后续任务重新读取。未据此判定资金足够或协议状态可用。

验收中一次上游 HTTP 502 被明确报告为失败，显式重跑后成功，未添加自动重试或替代 RPC。保存报告后先核对退出码和 JSON 有效性，再用它执行后续对照；失败时 stdout 为空，不能把空文件当作有效空账户报告。验收只涉及本地脚本，没有业务改动、签名、账户创建或交易发送；本次启动的代理已关闭，未运行 UI、构建或部署。A05 整体仍部分完成，持仓/订单/ALT 和恢复资源待后续推进。
