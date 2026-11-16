# TRD-136 本地真实交易环境

用于把现有 Solana PR 放在同一开发集成版中验证。所有命令从本需求 frontend checkout 根目录执行，Node 22，锁定依赖已安装；Node/Vite 命令使用 8 GiB 堆。这里只改变本地运行配置，不修改生产 API 主机、LUT 信任规则或交易开关。不要把本地构建/模拟结果当作订单执行证据。

## 固定版本与当前结果（2026-11-16）

- frontend：TRD-136 从个人基础建立，集成 TRD-70 development `14d67c82d09166213e067c86b2ee1f374f7764e4`，集成提交 `8e0d8e21d6bef04c3b53143a1bd62a0c12fc0005`；继承 TRD-72/77/78 成果。业务修复仍回对应原需求线。
- API：gmx-api #340，`59e49c649d6dd5a331af5ef793f0292f47898907`，published SDK alias 2.9.2；本机 checkout `/Volumes/kenny/gmx/gmx-api-pr340`。更换机器时按实际路径传参，不把本机目录作为共享依赖。
- WASM：0.11.0-beta.1-gmx.1，SHA256 `e82184caacc60828f024743f88a0a92d97b9d3d55db6839e0d3fab8a9b46c840`。
- 网络：mainnet genesis `5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d`；program `Gmso1uvJnLbawvw7yezdfCDcPydwW2s2iqG3w6MDucLo`，store `CTDLvGGXnoxvqLyTpGzdGLg9pD6JexKxKXSV8tqqo8bN`。程序当前部署版本、选定市场实时可交易性尚未验收。
- 初选市场：BTC/USD [USDC-USDC]，GM mint `Dqq58gS1TgRMDouUbdvhhzc51XXTNHG921WLxH9X2eB8`。没有选择或连接真实钱包，没有签名、广播或创建 LUT。
- 数据库隔离迁移、reader/writer 角色创建通过；实时 indexer 未就绪。精确 discriminator/store 扫描观测约 60,710 Position、44,424 User，候选索引总容量 20,000、单扫描响应限制 32 MiB，实际启动出现扫描超时与响应超限。没有抬高限制、丢弃账户、绕过新鲜度检查或回退到 samples。
- 离线、固定输入、生成身份下的四种单笔无 LUT 交易均通过真实 builder/validator：市价多/空 892 bytes，限价多/空 925 bytes。该结果只证明编码和体积，不证明实时参数正确、资金充足、模拟通过或 keeper 执行。

## 只读 RPC 容量核验

```sh
NODE_OPTIONS=--max-old-space-size=8192 node tools/local-solana-trades/probe.mjs
```

复用仓库既有只读 RPC 代理及其 Origin 配置，默认 key 来源不变；可通过进程环境 `SOLANA_RPC_PROXY_KEY` 使用已有独立 key，或通过 `TRD136_RPC_URL` 明确选择 RPC。不在命令行粘贴秘密，不自动切公共节点。保存 `.local/trd-136/rpc-capacity.json`：genesis、扫描 slot、条数、响应 bytes、耗时与分页标志，不落全部账户内容。

## 真实 API 启动与清理

先确认 Docker daemon 可用，`postgres:15` 已存在。本机必须核对 Docker Desktop 的 DataFolder 和实际 Docker.raw 在外置卷；容器挂载在外置卷不足以证明镜像已迁移。

```sh
NODE_OPTIONS=--max-old-space-size=8192 node tools/local-solana-trades/api.mjs \
  --api-dir /path/to/reviewed/gmx-api \
  --rpc-config /path/to/infrastructure/tools/solana-rpc-proxy/config.json
```

已有适用 RPC 时，可设置 `TRD136_RPC_URL` 并省略 `--rpc-config`。配置文件模式复用同目录既有 `proxy.mjs`，只允许其现有只读/模拟方法；不能使用它广播交易。

启动器核对 mainnet genesis、端口与现有 PostgreSQL 镜像；创建带唯一 owner label 的隔离数据库容器和随机凭据，运行 API 自带迁移及 reader/writer 最小权限配置。随后启动真实 `solana-indexer`（3047）和 `solana-read`（3046），保留原 keeper ticker 来源与 freshness/slot 约束。进程在独立 CWD 启动，不读取 API checkout 的 `.env`，不继承钱包或 keeper 写入凭据，不运行 EVM workers。

前台命令持续运行；只有真实 `/v1/markets/config` 返回成功才记录 ready。**当前固定候选因上述容量问题无法 ready**；不要反复启动作为重试策略。日志/report 位于输出的 `.local/trd-136/api-*/`，保留失败证据；日志是本机材料，不作为共享附件。

用原终端 Ctrl-C 停止；启动失败也会清理所属进程组、带本次 owner label 的容器及匿名卷。数据库随容器删除，日志保留。不要 prune 或停止其他容器。异常退出/SIGKILL 后依据 report 中的 owner/container/PID 核对归属，再清理；不要仅凭端口杀进程。API 候选服务器本身使用默认 listen 行为，本机运行时不要将该端口通过公网代理或端口转发公开。

## 前端隔离配置

```sh
NODE_OPTIONS=--max-old-space-size=8192 node tools/local-solana-trades/web.mjs \
  --api-url http://127.0.0.1:3046 --port 3016
```

本地 Vite 的限定配置转换将 Solana SDK API host 指向明确的 loopback API，并给 builder/validator/sender 同一份空 LUT 配置；其余 EVM API、生产源码、AB flag 和 solanaTrading 检查不变。API 不可用就显示原有错误，不回退公网或 mock。HTTP 已核验首页和两个配置模块；尚未完成真实浏览器/钱包页面验收。Ctrl-C 停止该服务。不要在真实数据尚未 ready、退出路径未验证时尝试开仓。

## 重现离线无 LUT 体积测量

```sh
NODE_OPTIONS=--max-old-space-size=8192 node tools/local-solana-trades/measure.mjs
```

只加载锁定 WASM、现有 builder 和 validator。独立诊断进程将网络功能标志设为启用以运行纯构建；不启动页面，不替代或关闭交易校验。生成临时身份和固定的离线价格/金额/区块哈希，保存 `.local/trd-136/no-lut-size.json`。这些固定输入只用于编码测量，绝不可进入真实交易配置。没有密钥导出、签名或 RPC 发送。

## 剩余阶段

1. 解决真实 API 索引容量/响应/时限与完整性问题，验证真实市场、账户、折扣、freshness 和 minContextSlot；此为 API 产品问题，需独立开发线及回归，不能在本地工具伪造就绪。
2. 使用实时数据和最终配置通过 unsigned simulation；重新确认程序部署及选定市场、费用/杠杆/价格输入。
3. 核实 Sulliven 的 TRD-84 成果并验证实际撤单与退出路径；现有 OrderList/PositionSeller 仍要求 EVM signer，不能据低层 builder 宣称已接通。
4. 获得具体钱包、网络、资金/费用上限及操作授权后，执行真实市价多空、限价多空创建/撤单、至少一次触发成交，记录签名、订单/仓位、keeper 结果和刷新。未知 receipt 先 reconcile，禁止盲目重新签名。
5. 完成退出和清理，按实际支持矩阵报告；本地成功不代表原 PR 全范围完成或生产就绪。
