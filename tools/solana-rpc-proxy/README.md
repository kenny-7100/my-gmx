# 本地 Solana RPC 代理

用于本地前端开发与 Agent 只读验收。无需安装子项目依赖，使用仓库的 Node 22。上游固定为 Alchemy Solana Mainnet，默认复用现有 `largeAccount` key，转发时设置已验证的 `Origin: https://app.gmx.io`。不修改 Alchemy 权限。

## 启动与调用

从仓库根目录手动启动（不会同时启动前端）：

```sh
yarn solana:rpc-proxy
```

默认监听 `http://127.0.0.1:3030`。另一个终端或 Agent 使用：

```sh
curl --fail-with-body http://127.0.0.1:3030 \
  -H 'Content-Type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"getSlot","params":[{"commitment":"confirmed"}]}'
```

`GET /healthz` 仅确认代理进程存活，不检查上游权限或数据。使用上面的 RPC 请求核验真实连通性；HTTP 200 也可能携带 JSON-RPC error，调用方必须检查响应正文。

## 前端入口

`src/config/rpc.ts` 的 `getSolanaRpcUrl()` 在 Vite 开发模式默认返回代理地址。需要其他端口时，在根 `.env.development.local` 中配置：

```dotenv
VITE_APP_SOLANA_RPC_URL=http://127.0.0.1:3031
```

随后以相同端口手动启动代理，修改 Vite 环境变量后需重启前端：

```sh
SOLANA_RPC_PROXY_PORT=3031 yarn solana:rpc-proxy
```

构建后的预览/生产环境忽略该开发覆盖，由中央 RPC 配置选择 Alchemy 上游。本次只切换本地代理；EVM RPC 的 key 选择与地址不变。不要用现有 `isDevelopment()` 判断是否访问本地代理，该函数也会将部分远程预览识别为开发环境。

当前分支的 `src/lib/solana/rpc.ts` 通过统一 URL 创建 Kit client，`balances.ts` 读取配置资产余额；共享 hook 为 `src/domain/solana/useSolanaBalances.ts`。钱包会话与 UI 接入仍属 FESOL-51。入口本身不执行网络请求，不会在 Solana flag 关闭时自动读链。本地 Agent 的只读余额脚本另见[钱包说明](../../docs/agent-wallet.md)。

## 配置与边界

- 默认 URL、上游与 keys 共用 `src/config/solanaRpc.json`。代理读取 `largeAccountKey`，EVM largeAccount 也引用同一字段；原 `fallbackKey` 保留给现有 fallback 路径，避免切换代理时影响 EVM。keys 原已存在于公开前端配置，本工具不将其变成秘密。
- 如需独立 key，仅给代理进程设置 `SOLANA_RPC_PROXY_KEY`，不使用 `VITE_` 前缀，也不写入版本控制。命令不会自动加载 `.env.local`。
- 只监听 IPv4 loopback，允许无 Origin 的 CLI 请求，以及来自 localhost、127.0.0.1、IPv6 loopback 的 HTTP/HTTPS 页面；外部网页来源拒绝。浏览器预检允许 `Content-Type`，不转发浏览器的 Cookie、Authorization 或 Origin。
- 只开放 `proxy.mjs` 中列出的读取方法与 `simulateTransaction`。拒绝 `sendTransaction`、空批次、超过 100 项的批次及大于 1 MiB 的请求。批次包含不允许的方法时整批拒绝，不部分执行。
- 20 秒上游超时；上游 HTTP 状态及正文透传，正文不重新解析以保留大整数。仅对 key 的原文作脱敏。网络失败为 502，超时为 504；不输出带 key 的错误堆栈，不自动重试、换 key 或切公共 RPC。
- 仅支持 HTTP，不支持 WebSocket、交易发送或完整交易验收。代理不可用时应暴露失败，不静默回退。不要将服务暴露至公网或作为生产部署。

## 真实只读验收命令

代理启动后，从仓库根目录执行：

```sh
yarn solana:rpc-proxy:verify
```

该命令不启动服务或浏览器，不发送交易。验证 Mainnet genesis、slot、批次、100 账户读取、本地来源预检、外部来源/写方法拦截和上游 JSON-RPC 错误；任一断言失败或请求失败均以非零状态退出。100 账户检查重复读取同一个程序地址，验证批量容量，不代表不同业务账户布局全部正确。其他地址使用 `SOLANA_RPC_PROXY_URL` 指定，不使用前端 `VITE_` 配置。

## 验证记录

2026-10-24：执行 handler 单元测试（不监听端口、不访问上游），覆盖来源、写操作/混合批次拦截、转发、上游错误、精度和脱敏；前端环境路由另有 Vitest 检查。实际运行结果见任务交付及[实施清单](../../docs/agent-acceptance-infrastructure.md)。

```sh
yarn test:solana-rpc-proxy
yarn test:ci src/config/__tests__/solanaRpc.spec.ts
```

用户随后明确授权真实验收，2026-10-24 已启动代理和本地前端并验证：

| 验收项 | 结果 |
| --- | --- |
| Agent 无 Origin 访问、slot、Mainnet genesis、批量 JSON-RPC | 通过 |
| `getMultipleAccounts` 100 账户容量 | 通过；重复读取同一个 gmsol 程序账户 |
| `getProgramAccounts` 按 Order discriminator 扫描 | 通过；本轮返回 209 个账户 |
| `simulateTransaction` | HTTP 200 并返回模拟结果；无资金测试消息为 `InvalidAccountForFee`，证明模拟方法可达，不代表业务订单模拟成功 |
| 上游无效地址错误 | HTTP 200、JSON-RPC `-32602`，未被代理掩盖 |
| localhost 浏览器真实跨域请求 | 通过；页面导入 `getSolanaRpcUrl()` 并通过返回地址读取 slot 和批量查询 |
| 本地 OPTIONS / 外部来源 / 交易发送 / 非法 JSON | 分别为 204 / 403 / 403 / 400 |
| `yarn solana:rpc-proxy:verify` | 通过 |

浏览器验收针对已实现的 URL 入口与代理链路；当前没有业务 RPC client，不能将其描述为余额/订单页面端到端验收。未进行交易发送、WebSocket、持续负载或 CI 环境验收。完整工程检查：`yarn build-sdk`、`yarn tscheck`、`yarn lint:ci` 通过，前端单元测试 3013 passed / 1 原有 skipped，代理单元测试 3 passed。生产构建默认堆首次 OOM，以 `NODE_OPTIONS=--max-old-space-size=8192 yarn build` 重跑成功。验收还修复了主 Vite 配置的 tsconfig 扫描和单元测试发现范围，避免误扫嵌套参考仓库。验收服务在验证后关闭，后续使用前重新启动。

## largeAccount 切换与真实余额验收（2026-11-03）

用户确认本地代理默认改用现有 `largeAccount` key，继续向上游发送项目生产 Origin；线上 Origin 和 key 选择不在本次范围。key 从 `src/config/rpc.ts` 移至共享 JSON，EVM largeAccount 引用同一值，fallback key 未改变。无需新增服务订阅或凭据。

已在当前开发分支实际启动 `vite,rpc` 工作区（Vite 3016、RPC 3030），验证如下：

- 代理单元测试 4 项通过；默认 key/Origin、来源限制、写方法阻断、错误及大整数透传通过。
- `yarn solana:rpc-proxy:verify` 通过，包含 Mainnet genesis、JSON-RPC 批次、100 账户容量及本地 CORS 预检。CLI 经代理确认 Mainnet，并读取本机 CLI 公开地址的余额为 0 lamports。
- Chrome 中真实 hook → reader → Kit → 代理 → Alchemy 链路通过。验收 harness 仅控制所选网络输入和显式 owner，使用真实功能开关、SWR 及 RPC，不连接钱包。
- 公开账户 `8DfHuYFv7VQ6wgcGtVDN2vtFn5ezF52hHNtPWYcqm8hU` 的 47 个配置资产结果读取成功，原生 SOL、非零 Token USDC 与 Token-2022 PUMP 分别与独立 RPC 查询一致。仅验证配置 ATA，不覆盖其他代币账户的全量持仓或可花费额度。
- 功能未启用时不加载 reader、不发 RPC；统一 key 可触发真实重读；五秒轮询、切换空账户后成功返回零、切换 EVM 后清除数据并停止轮询通过。隐藏标签页、延迟响应及失败状态由现有 hook 定向测试覆盖。
- 前端相关定向测试 20 项、全量单元测试 3033 项通过（1 项原有跳过）、SDK 产物校验及完整类型检查通过。Node 代理 lint 使用 Node 环境及允许 Node 22 已支持的 async iteration；前端仍使用原 lint 规则。

浏览器报告与验收 harness 仅保存在本机忽略目录 `.local/acceptance/frontend-offline/solana-balances/`，未作为共享附件或产品代码交付。首次动态加载 Kit 触发了 Vite dependency optimization 和页面重载；依赖稳定后完整验收通过。后续重启服务或配置变化应重新验证，不将本文当作持续健康证明。

工作区管理命令：

```sh
yarn solana:dev status
yarn solana:dev stop
# Start the same local services again after stopping them.
yarn solana:dev up --services vite,rpc --web-port 3016 --rpc-port 3030
```

该工作区不启动 API；浏览器余额验收不依赖 API、keeper、钱包签名或交易发送。
