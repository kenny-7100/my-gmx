# FESOL-55 验收映射实例

核验日期：2026-10-25（北京时间）。A07 首个实例已完成；**本轮 FESOL-55 业务验收结论为 partial**，不是重新确认 Done，也未修改 Linear。本例用于证明后续 Agent 能逐项关联条件和证据，包含尚未执行的浏览器/构建层次。

- 业务需求验收结论：partial；R1～R8 中仍有未执行或部分覆盖条件。

## 来源与版本

需求：[FESOL-55 — Add the gmsol SDK as WebAssembly, loaded lazily, and the solanaTrading check](https://linear.app/gmx-io/issue/FESOL-55)。实时抓取 `2026-10-24T17:55:27.334Z`，线上 updatedAt `2026-10-23T06:16:23.301Z`，状态 Done；项目 GMX and GMTrade Frontend Unification，无标签、无评论，父项 FESOL-19。FESOL-70 blocks 本项，本项 blocks FESOL-56；相关 FESOL-40 为 Review、FESOL-71 为 Todo、FESOL-72 为 Backlog。关系是此次观察，不代表关联交付或环境已通过。

本轮仅复用现有单元测试和本地产物检查；不实施该需求，不打开浏览器、不构建/部署、不启动服务、不读取钱包或发送交易。根 `.env.development.local` 的本地开关覆盖不作为真实开关证据。

| 项目 | 本次记录 |
| --- | --- |
| 源码 | 主仓库 `solana-integration`，`c738c5d75cd61d791b7c964f41e1b6f682e48918`；执行中 dirty=true，仅验收文档变化；manifest 所列业务源码、测试、配置和锁文件与该 HEAD 无差异 |
| 环境 | Node v22.17.0；Vitest 4.1.11；测试使用项目配置，mock 数据源/SDK 初始化；非浏览器真实网络 |
| 数据模式 | unit-mock 与 local-artifacts；无本轮 API、keeper、RPC 或链上观察 |
| SDK/WASM | 安装版本 `0.9.0-test.2`；npm 与独立产物均匹配固定 SHA-256 `775a7ddb532d6d49a1800a3d8eccca523960d685db8e1800fbd5eb519ed8dd68` |
| 产物 | `public/gmsol-sdk/0.9.0-test.2-v2/entry.js` SHA-256 `9bab5b40e849cca509d59f53ea81623d1a6b8731abbb0e5f49c767020608fa0e`；仅 fingerprint-only，不证明当前源码可复现构建 |
| 原始证据 | 本机 `.local/acceptance/requirements/FESOL-55/` 的 requirement.json、unit.log、runtime.json、manifest.json；被 Git 忽略，不保证其他机器可用。此文共享关键结果，非共享原始附件 |

## 条件映射

以下 R1～R8 覆盖实时正文四条 Scope 及全部 Acceptance；partial 的子项分别注明。Scope 中的后续替换需求不视作本轮必须实现。

| ID | 原要求与来源 | 环境/数据与预期 | 执行方法/命令 | 状态 | 证据及证明边界 | 剩余操作 |
| --- | --- | --- | --- | --- | --- | --- |
| R1 | Scope 1：SDK 精确锁定 0.9.0-test.2；WASM 与 gmtrade.xyz 文件匹配，hash 写入 PR | unit-mock / local-artifacts；仅验证本行注明层次 | E2 比较安装版本、npm WASM 和独立产物与项目固定摘要；另需线上文件和 PR 原文对照 | partial | E2 passed 仅证明本地完整性；本轮未请求 gmtrade.xyz，也未核对原 PR 的 hash | 取得明确线上 WASM URL 与目标 PR，复核文件摘要和 PR 记录；不把固定摘要来源假定为本轮已核验 |
| R2 | Scope 2：仅 domain/gmsol 导入，首次使用才动态加载；先读 FESOL-40 内存问题 | unit-mock / local-artifacts；仅验证本行注明层次 | E1 验证加载控制流；包导入范围需静态规则检查/产物证明；需结合 FESOL-40 确认适用风险与真实运行 | partial | E1 loader 与 entry 共 6 tests passed；SDK/WASM 被 mock，未实例化真实 WASM，未执行跨仓库包导入全量检查或 FESOL-40 专项复核 | 实时读取 FESOL-40，按风险补真实运行与边界检查；不得以 mock 证明内存安全 |
| R3 | Scope 3 / Acceptance：WASM 与 top-level-await Vite 支持；构建前后 EVM chunks 不变 | 指定 before/after 构建及 bundle 对比；本轮未执行 | 对指定 before/after 源码、相同依赖与构建条件执行构建，检查独立产物加载和 bundle report | not-run | E2 读取现有产物不证明构建管线；本轮未构建，未对比 EVM chunks | 先确定可比较的 before/after SHA、产物和构建授权，保存两份报告与差异 |
| R4 | Scope 4：保留 optionalSolanaSystemStub，所有 importer 使用 stub；Solana 使用配置中的 System id，不导入该包 | 静态导入、构建及 Privy 页面；本轮未执行 | 对 vite resolver、所有包导入及实际生成结果检查，覆盖 Privy funding 路径 | not-run | 本轮未对 stub 做独立运行/构建验收，不能因本地文件存在就算通过 | 针对指定交付版本检查 import/resolver，再在获授权的构建/页面验证 Privy 路径 |
| R5 | Scope 5：domain/gmsol 提供 UI hook，仅显式 true 开启 | unit-mock / local-artifacts；仅验证本行注明层次 | E1 hook、fresh-read tests：false/缺失/错误/加载中关闭；显式 true 开启 | passed | E1 hook 7 tests + fetch 3 tests passed；包括开发覆盖矩阵，非开发忽略覆盖；不证明真实 UI 或当前远端值 | 页面/真实远端观察见 R8；若目标要求页面端到端，此单元结果不能替代 |
| R6 | Scope 5：fresh read 用 Arbitrum 主 keeper /ui-flags/v2、超时，不用 fetchUiFlags 缓存；供 FESOL-56 每次发送前调用 | unit-mock / local-artifacts；仅验证本行注明层次 | E1 fresh-read tests：每次调用 fetch 主 URL、no-store、异常传播；另核验超时机制和发送调用集成 | partial | E1 单元测试主 URL/显式 true/错误传播 passed；timeout 测试注入 TimeoutError，未实测 10 秒计时；每次发送前调用属于关联 FESOL-56，本轮未执行 | 校验实际超时触发；按 FESOL-56 范围验证每条发送路径的调用顺序，不发送未授权交易 |
| R7 | Acceptance：solanaNetwork off 无 gmsol/WASM 请求；on 首次使用只加载一次 | unit-mock / local-artifacts；仅验证本行注明层次 | E1 loader/entry tests；另需真实浏览器从空缓存分别录制 off、on 首次使用与重复调用的网络 | partial | E1 控制流 passed；entryFactory、WASM 初始化均为 mock，无法证明真实浏览器请求数量/构建懒加载 | 在已获授权的精确版本预览中记录 off/on、首次与重复调用网络；不能只靠模块调用次数 |
| R8 | Acceptance：Divhead 加 key 前检查返回 off | unit-mock / local-artifacts；仅验证本行注明层次 | E1 缺失/非 true 返回 false；另需同一环境真实 keeper 值与应用检查结果 | partial | E1 缺失值单元 passed；A02 历史缺 key 仅背景，不是本轮远端观察；本地 dev override=true 不满足真实 off 验收 | 需要该环境验收时运行真实预检，确保应用无本地覆盖，再对照检查结果；key 已变化则以实时条件重判 |

Scope 中 FESOL-72 是上线前替换 SDK 的后续工作，After FESOL-70 是独立构建检查切片；本例不执行这些业务任务。需求要求在 PR 写 hash，R1 保留了该交付物检查，不能用本报告替代 PR。

## 执行记录

工作目录均为主仓库根目录。执行窗口为北京时间 2026-10-25 01:55:27～01:57:12；两个检查退出码均为 0。

| 证据 ID | 时间 | 命令/操作 | 退出码/结果 | 原始产物及摘要 |
| --- | --- | --- | --- | --- |
| E0 | 2026-10-25 01:55:27～01:57:12 Asia/Shanghai | `node scripts/linear-requirements.mjs show FESOL-55 --live --json`；退出 0，实时正文、关系、评论 | 0 | requirement.json：`b6ef8650e9d2b410ef5e8ca589ed029e28f183956056531480125bb60f1f1f69` |
| E1 | 2026-10-25 01:55:27～01:57:12 Asia/Shanghai | `yarn vitest run src/domain/gmsol/loadGmsolSdk.spec.ts src/domain/gmsol/sdk-entry.spec.ts src/domain/gmsol/fetchSolanaTradingEnabled.spec.ts src/domain/gmsol/useSolanaTradingEnabled.spec.ts`；4 files / 16 tests passed，无跳过 | 0 | unit.log：`0a8179a68d112a43108611da23c8ccc813da3f72417822b96d750c5a93c46bbd` |
| E2 | 2026-10-25 01:55:27～01:57:12 Asia/Shanghai | `yarn solana:runtime-preflight --local-only`；passed，checkedAt `2026-10-24T17:55:44.572Z`，chain 明确 not-run | 0 | runtime.json：`776d7f5c78827c8b330e0a10332a662eb0eb309ecbaea1fd42d1c18f2c2fb7bb` |

manifest.json 记录相关源码和测试文件逐项 SHA-256；其 sourceSetSha256 为 `92a6fe03052133a063303a19fc5d970702e2653d16aa1259000f80be48990930`（对排序后的路径→摘要 JSON，以紧凑 separators 序列化后再 SHA-256）。该 manifest 是本轮一次性证据整理，不增加通用 runner；业务文件可从上面的完整 HEAD 还原。

## 接手与失效条件

本轮无 failed、无需新资源协调的 blocked；有未执行层次，按[汇总规则](../agent-acceptance-workflow.md)整体 partial。这里的 partial 是本轮有限验收的覆盖结果，不推断此前交付失败，也不修改线上 Done。

下次真正验收 FESOL-55 时，先重新查询并比较 updatedAt 与正文，再确定目标交付 SHA/预览及本轮授权。依 R1～R8 逐项补齐，不必重复跑无关 RPC、ALT 或钱包检查。浏览器/构建先核对授权，线上文件 URL、before/after 基准若仍不明确则澄清；不得选一个猜测地址或构建基准来“补齐”验收。代码、锁文件、开关或产物变化后重跑受影响项；不将本例历史 passed 直接复制为新版本结果。
