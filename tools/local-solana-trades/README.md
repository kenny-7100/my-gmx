# TRD-136 本地真实交易环境

用于把现有 Solana PR 放在同一开发集成版中验证。所有命令从本需求 frontend checkout 根目录执行，Node 22，锁定依赖已安装；Node/Vite 命令使用 8 GiB 堆。这里只改变本地运行配置，不修改生产 API 主机、LUT 信任规则或交易开关。不要把本地构建/模拟结果当作订单执行证据。

## 当前推荐环境与增量跟进（2026-11-17）

上游 [gmx-api #340](https://github.com/gmx-io/gmx-api/pull/340) `996cf05db9603d9af1689fdbac05f5a0ecf8e0e1` 已在独立、干净 checkout 完成本地全局索引验证，**无需应用钱包范围补丁**。该版本首次全量 bootstrap 后按程序交易签名与 writable accounts 增量追赶，保留 coverage、cursor、lease、slot 和 freshness 检查。本机约 105,529 个账户完成 bootstrap，约 32 秒后真实 HTTP ready，67/67 市场包含 `tradeMath: "gmsol"`；其他真实钱包也能返回非空仓位。没有修改 API 源码、推送 API 或创建 API PR；正式 review/部署仍待上游完成。

优先在安装了该 API 自身锁定依赖的干净 checkout 启动，不传 `--wallet`：

```sh
NODE_OPTIONS=--max-old-space-size=8192 node tools/local-solana-trades/api.mjs \
  --api-dir /path/to/gmx-api-at-996cf05 \
  --port 3056 --index-port 3057 \
  --rpc-config /path/to/infrastructure/tools/solana-rpc-proxy/config.json

NODE_OPTIONS=--max-old-space-size=8192 node tools/local-solana-trades/web.mjs \
  --api-url http://127.0.0.1:3056 --port 3016
```

本次全局验证：测试钱包 positions/orders/fee-discount 均返回 200；slot 等待请求 470430200 返回 470430204。暂停本次 owned writer 超过 10 秒后，市场和仓位均返回 503 `BACKEND_UNAVAILABLE`，恢复 writer 后重新出数（slot 470430275）。本机原始材料位于 `.local/trd-136/incremental-api-validation.json`、`incremental-sample-wallets.json` 与启动报告；钱包及金融原始数据不纳入共享附件。旧钱包范围运行实例仅作为历史/回退现场保留，不作为新版本的必要依赖；不要停止或清理归属未知的服务。

前端已同步 release `7868f48f3e5cf1423a33a4e3f8cbbc9d5cd90d18`；已合并的 TRD-65 Provider 不重复集成。单位转换精确对齐 TRD-100 / UI #3243 `50118fee998b3d6834b1c4088860c2c5ee460d26` 的等值常量复用，保留现有数学导出和交易保护。余额接线修复已进入 TRD-70 原 delivery，PR 更新及本次检查以需求记录为准。

2026-11-16 用户执行的一笔 40 USD 市价多单已取得创建、keeper 执行及仓位刷新证据。2026-11-17 测试钱包当前为空仓位，RPC 确认原仓位账户已不存在；本轮没有执行平仓，不能据此证明退出入口已验收。此前只读/unsigned 阶段的“没有交易”表述仅是历史阶段记录。市价空、限价多空/撤单/触发成交和退出仍未完成；TRD-84 最小本地接线按用户后续要求暂缓，正式 LUT 与四钱包验收也未解除。

## 历史固定版本与阶段结果（2026-11-16）

- frontend：TRD-136 从个人基础建立，集成 TRD-70 development `14d67c82d09166213e067c86b2ee1f374f7764e4`，集成提交 `8e0d8e21d6bef04c3b53143a1bd62a0c12fc0005`；继承 TRD-72/77/78 成果。业务修复仍回对应原需求线。余额接线修复在 TRD-70 原 development `9a3342837b`，本任务 cherry-pick `3cee91eb7e`；原 release delivery 本地 `d0726f09d9`，尚未推送更新 PR。
- API：gmx-api #340，`59e49c649d6dd5a331af5ef793f0292f47898907`，published SDK alias 2.9.2；本机 checkout `/Volumes/kenny/gmx/gmx-api-pr340`。更换机器时按实际路径传参，不把本机目录作为共享依赖。
- WASM：0.11.0-beta.1-gmx.1，SHA256 `e82184caacc60828f024743f88a0a92d97b9d3d55db6839e0d3fab8a9b46c840`。
- 网络：mainnet genesis `5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d`；program `Gmso1uvJnLbawvw7yezdfCDcPydwW2s2iqG3w6MDucLo`，store `CTDLvGGXnoxvqLyTpGzdGLg9pD6JexKxKXSV8tqqo8bN`。2026-11-16 11:52 CST 链上 ProgramData 部署 slot `459556802` 与候选 decoder 基线相同，program executable/UpgradeableLoader owner 已核对；不证明 keeper 执行。
- 初选市场：BTC/USD [USDC-USDC]，GM mint `Dqq58gS1TgRMDouUbdvhhzc51XXTNHG921WLxH9X2eB8`。最初使用 Phantom `positions-test` 观察账户；用户已切换到 `bb1`，本地页面确认账户一致且不再显示观察标记。仅完成连接、只读与 unsigned 验证，实际签名能力未测试；没有签名、广播或创建 LUT。
- 原始候选：数据库隔离迁移、reader/writer 角色创建通过；实时 indexer 未就绪。精确 discriminator/store 扫描观测约 60,710 Position、44,424 User，候选索引总容量 20,000、单扫描响应限制 32 MiB，实际启动出现扫描超时与响应超限。没有抬高限制、丢弃账户、绕过新鲜度检查或回退到 samples。
- 离线、固定输入、生成身份下的四种单笔无 LUT 交易均通过真实 builder/validator：市价多/空 892 bytes，限价多/空 925 bytes。该结果只证明编码和体积，不证明实时参数正确、资金充足、模拟通过或 keeper 执行。

## 仅本地的钱包范围补丁

用户明确 API 只允许本地修改、测试，不推送、不创建 PR。独立 checkout `/Volumes/kenny/gmx/gmx-api-trd-136-local`，分支 `local/trd-136-wallet-index`，本地提交 `f889ac1` 基于上述 #340。可移植补丁见 [api-wallet-scope.patch](api-wallet-scope.patch)。在另一个干净 API checkout 固定到 `59e49c649d6dd5a331af5ef793f0292f47898907` 后执行：

```sh
git apply --check /path/to/frontend/tools/local-solana-trades/api-wallet-scope.patch
git am /path/to/frontend/tools/local-solana-trades/api-wallet-scope.patch
```

仍使用 API 自带依赖锁文件和迁移；新 checkout 先安装其锁定依赖并生成 tsoa routes，再按该仓库命令检查 TypeScript。补丁仅在显式 `TRD136_INDEX_WALLET` 且 `NODE_ENV=development` 生效。每种账户 RPC 查询同时限定 discriminator、store、owner，完整解码返回数据并校验 owner/store；未知布局仍阻断。钱包范围使用独立数据库 partition，其他钱包账户接口返回400 `WALLET_OUT_OF_SCOPE`，不会误报空数据。默认全局模式不变。保留2万容量、32MiB响应、5秒扫描、10秒新鲜度、slot、分页完整性、lease和原子发布校验。

这满足单钱包轻量本地验证，**不是全局索引容量修复**，也不作为上游产品提交。11:47 CST 真实API返回67/67 gmsol市场，所选钱包订单/仓位/折扣200，其他钱包400。slot等待请求469986541返回469986545；暂停writer超过10秒后reader返回503 `BACKEND_UNAVAILABLE`，恢复后重新出数。原始证据只存本机 `.local/trd-136/live-api.json` 与 `freshness-check.json`，没有附带用户金融信息到共享文档。

## 只读 RPC 容量核验

```sh
NODE_OPTIONS=--max-old-space-size=8192 node tools/local-solana-trades/probe.mjs
```

复用仓库既有只读 RPC 代理及其 Origin 配置，默认 key 来源不变；可通过进程环境 `SOLANA_RPC_PROXY_KEY` 使用已有独立 key，或通过 `TRD136_RPC_URL` 明确选择 RPC。不在命令行粘贴秘密，不自动切公共节点。保存 `.local/trd-136/rpc-capacity.json`：genesis、扫描 slot、条数、响应 bytes、耗时与分页标志，不落全部账户内容。

## 真实 API 启动与清理

先确认 Docker daemon 可用，`postgres:15` 已存在。本机必须核对 Docker Desktop 的 DataFolder 和实际 Docker.raw 在外置卷；容器挂载在外置卷不足以证明镜像已迁移。

```sh
NODE_OPTIONS=--max-old-space-size=8192 node tools/local-solana-trades/api.mjs \
  --api-dir /path/to/patched/gmx-api \
  --wallet YOUR_PUBLIC_SOLANA_ADDRESS \
  --rpc-config /path/to/infrastructure/tools/solana-rpc-proxy/config.json
```

已有适用 RPC 时，可设置 `TRD136_RPC_URL` 并省略 `--rpc-config`。配置文件模式复用同目录既有 `proxy.mjs`，只允许其现有只读/模拟方法；不能使用它广播交易。

启动器核对 mainnet genesis、端口与现有 PostgreSQL 镜像；创建带唯一 owner label 的隔离数据库容器和随机凭据，运行 API 自带迁移及 reader/writer 最小权限配置。随后启动真实 `solana-indexer`（3047）和 `solana-read`（3046），保留原 keeper ticker 来源与 freshness/slot 约束。进程在独立 CWD 启动，不读取 API checkout 的 `.env`，不继承钱包或 keeper 写入凭据，不运行 EVM workers。

前台命令持续运行；只有真实 `/v1/markets/config` 返回成功才记录 ready。原始候选仍因容量问题无法ready；使用本地钱包补丁和 `--wallet` 已实际ready。启动器要求API checkout干净且补丁已本地提交，并在声明ready前验证gmsol市场和范围外拒绝。不要反复启动原始候选作为重试策略。日志/report 位于输出的 `.local/trd-136/api-*/`，保留失败证据；日志是本机材料，不作为共享附件。

用原终端 Ctrl-C 停止；启动失败也会清理所属进程组、带本次 owner label 的容器及匿名卷。数据库随容器删除，日志保留。不要 prune 或停止其他容器。异常退出/SIGKILL 后依据 report 中的 owner/container/PID 核对归属，再清理；不要仅凭端口杀进程。API 候选服务器本身使用默认 listen 行为，本机运行时不要将该端口通过公网代理或端口转发公开。

## 前端隔离配置

```sh
NODE_OPTIONS=--max-old-space-size=8192 node tools/local-solana-trades/web.mjs \
  --api-url http://127.0.0.1:3046 --port 3016
```

启动器先使用项目既有 vite.gmsol.config.ts 校验固定SDK文件哈希并构建浏览器entry/WASM，再启动页面，避免只有Node诊断可用而浏览器SDK产物缺失。

本地 Vite 的限定配置转换将 Solana SDK API host 指向明确的 loopback API，并给 builder/validator/sender 同一份空 LUT 配置；其余 EVM API、生产源码、AB flag 和 solanaTrading 检查不变。API 不可用就显示原有错误，不回退公网或 mock。HTTP 已核验首页和两个配置模块；现有原生 Chrome 已连接用户切换后的 Phantom 账户，核对 BTC/USDC 市场、共享余额、多空输入和最低保证金校验。实测发现余额未进入共享 TokensData，已在 TRD-70 原开发线修复并集成，未知余额仍保留 undefined，真实零余额仍为0。浏览器3 USDC/6 USD多空输入通过校验，1 USDC输入因扣费后最低保证金不足被阻止。没有点击订单提交按钮，浏览器 SDK loader/签名前完整流程未验；诊断输入已清空。Ctrl-C 停止该服务。不要在真实数据尚未 ready、退出路径未验证时尝试开仓。

## 重现离线无 LUT 体积测量

```sh
NODE_OPTIONS=--max-old-space-size=8192 node tools/local-solana-trades/measure.mjs
```

只加载锁定 WASM、现有 builder 和 validator。独立诊断进程将网络功能标志设为启用以运行纯构建；不启动页面，不替代或关闭交易校验。生成临时身份和固定的离线价格/金额/区块哈希，保存 `.local/trd-136/no-lut-size.json`。这些固定输入只用于编码测量，绝不可进入真实交易配置。没有密钥导出、签名或 RPC 发送。

## 实时未签名模拟

```sh
NODE_OPTIONS=--max-old-space-size=8192 node tools/local-solana-trades/simulate.mjs \
  --wallet YOUR_PUBLIC_SOLANA_ADDRESS --api-url http://127.0.0.1:3046
```

先启动真实API。脚本每种订单重读真实市场配置、keeper交易开关和ticker，通过现有价格mapper后，调用原 `prepareGmsolOrderTransactions` 与 `checkGmsolTransactionBeforeSignature`；包含实时blockhash、validator、RPC simulation、余额、费用及blockheight检查。仅诊断：3 USDC保证金、6 USD规模、1%可接受价界限与5%限价距离，**不代表用户授权用这些参数交易**。

Node适配器直接初始化hash核对的真实WASM，使用同一 `@solana/kit` createSolanaRpc和既有只读代理，省略浏览器环境的health tracker；AB helper在该进程启用、LUT配置为空，builder/validator/签名前检查不变。不是浏览器loader、RPC tracker或完整TradeBox验收。脚本不调用sender，不连接私钥，不签名、不广播；代理本身拒绝广播。

2026-11-16 本轮使用切换后的账户及3/6诊断参数：市价多/空892bytes，限价多/空925bytes，四种均通过实时simulation及费用检查（slots469990739/469990745/469990751/469990758），网络费各45000lamports。该模拟不证明订单满足 keeper 的最终成交条件；此前1/2参数也模拟成功，但实际页面因最低保证金阻止，不能据此声称可成交。报告保存 `.local/trd-136/unsigned-simulation.json`；没有keeper执行或落链订单证据。

## 剩余阶段

1. 本地单钱包API已ready、slot和freshness已验；全局索引容量问题保留为上游限制，本任务不推送API修改。
2. unsigned simulation已通过；继续浏览器loader/连接钱包/TradeBox的实际验收与真实交易参数确认。
3. 核实 Sulliven 的 TRD-84 成果并验证实际撤单与退出路径；现有 OrderList/PositionSeller 仍要求 EVM signer，不能据低层 builder 宣称已接通。
4. 获得具体钱包、网络、资金/费用上限及操作授权后，执行真实市价多空、限价多空创建/撤单、至少一次触发成交，记录签名、订单/仓位、keeper 结果和刷新。未知 receipt 先 reconcile，禁止盲目重新签名。
5. 完成退出和清理，按实际支持矩阵报告；本地成功不代表原 PR 全范围完成或生产就绪。
