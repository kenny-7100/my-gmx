# FESOL-56 — 交易构建、校验与发送的前置梳理

更新：2026-11-13（Asia/Shanghai）。角色：只读需求、PR 与契约调研，未开始业务实施。
需求：[FESOL-56](https://linear.app/gmx-io/issue/FESOL-56)。Linear 实时抓取自 2026-11-13 00:03 起；GitHub 同轮核验。个人基础 `solana-integration`，保留既有 FESOL-109 待提交记录。

## 判断与执行边界

可以开始不依赖线上环境的 ABI 核验、构建器与确定性指令校验工作；不能据此宣称前置全部完成或进行完整主网验收。FESOL-92 是明确要求先合并的 SDK 单位转换成果；FESOL-57 提供 keeper fee 等语义，影响费用校验与金融集成，但不是所有构建/校验开发的统一开工门槛。不要重写这两项已有实现。

FESOL-56 范围含 market/limit increase、market decrease、TP/SL、原子 increase+TP/SL、update/cancel、缺失 position account 的准备，以及每次签名前模拟/指令账户校验、Privy Solana 签名、发送前 fresh flag、RPC 发送确认。FESOL-19/20/59 是下游或消费方，不是应全部等完的前置。

## 当前依赖与 PR

远端 release 本轮观察 SHA：`24cd9b16d65b1ed4daae4c90c81c253588e8938d`。通过 GitHub API 读取远端树与 PR diff，未移动本地或子仓库 checkout。

| 依赖 | 观察结果 | 对 56 的影响 |
| --- | --- | --- |
| FESOL-92 | Review，Sulliven；[UI#3243](https://github.com/gmx-io/gmx-interface/pull/3243)，OPEN、非 Draft、head `5e081e5ab140ba41d8f816c317b8361bf5a8787c`；当前检查全成功，REVIEW_REQUIRED，无已提交 review | 复用单位/精度/舍入/range helpers；需求要求 SDK-only PR 先合并 |
| FESOL-57 | Review，Rainer；[UI#3242](https://github.com/gmx-io/gmx-interface/pull/3242)，OPEN、非 Draft、head `6d3ed92ca64129cb4d5ab8d26a9c1baff6563802`；REVIEW_REQUIRED，无已提交 review；常规 lint/type/tests、SDK standalone build、预览成功，组件 job 失败 | `getGmsolExecutionFee` 区分至少 300,000 lamports 的 keeper max、可退 rent；网络费另计。金融数学在共享 SDK，以数据字段启用；不应私自复制到 56 |
| FESOL-51 / 89 / 96 | 51 Review，89/96 Execution；[UI#3195](https://github.com/gmx-io/gmx-interface/pull/3195) 同时包含余额 reader/hook，head `2495be2`，checks 成功但 CHANGES_REQUESTED；[UI#3190](https://github.com/gmx-io/gmx-interface/pull/3190) 为重叠 Draft、组件 job 失败 | RPC、原始 SOL/ATA 余额及确认后 mutate 的集成依赖；沿用 109 中收敛到 3195 的方向，不维护两套 reader |
| FESOL-71 | Todo，Divhead；本轮正文无评论，无已核实交付证据 | 开发者自有小额钱包、参考 TP/SL position/limit order、ALT frozen 或 GMX-owned 替代、solanaTrading true；主网验收仍需核实这些条件 |
| FESOL-42 | Done；[UI#3110](https://github.com/gmx-io/gmx-interface/pull/3110) 已合并；远端 release 有 Solana session 模块 | 连接基础已有；四钱包实际带 ALT 交易签名/落链仍由 56 验收 |
| FESOL-50 | Release；[UI#3138](https://github.com/gmx-io/gmx-interface/pull/3138) 2026-11-05 合并至 release；远端有 oracle fetcher | 复用价格与 mint 映射，不等另一个同功能 PR |
| FESOL-55 | Done；[UI#3082](https://github.com/gmx-io/gmx-interface/pull/3082) 已合并；远端有 loader/fresh trading flag | WASM 基础已有，实际每条签名/发送路径的接入仍由 56 完成；历史验收材料为 partial，不冒充本轮运行验证 |
| FESOL-60 | Done；评论明确复用 src/config/rpc.ts 中已有 Alchemy keys | 不申请新 key/替代 RPC；本轮未实测当前目标环境 CORS、模拟或发送能力。3195 后续 review 已确认开发 key 可用，不能沿用其早期描述断言 key 仍坏 |
| FESOL-49 | Done；配置有 provisional lookup tables | 源码注释说 2026-10-20 两张表仍有 authority，仅历史观察，当前 authority 需重新链上核验 |
| FESOL-72 | Execution，kenny；按编号搜索未发现专门 PR | 图上是 56 blocks 72，不能反解为必须先完成 72 才能写 56；但最终 GMX artifact/版本/hash 和替换后流程复验属于公开发布条件。正文 v0.10.0 与 57 的 deployed 8af1e70c/0.11.0 参考目标需协调 |

## 新发现与可接续核验

- 3242 和 3243 都从无文件状态新增 `sdk/src/utils/gmsol/index.ts`，分别放数学 helper 和 units re-export。两项成果整合存在 add/add 冲突，必须保留双方导出；本轮没有执行实际合并或组合测试。
- 3242 的组件 job [日志](https://github.com/gmx-io/gmx-interface/actions/runs/43032469754/job/130562748858) 显示 Ubuntu 软件源 DNS 失败，Playwright 浏览器依赖安装退出 100，随后没有报告目录且 gh-pages 发布失败。不能把自动评论的 “Some tests failed” 当作数学/组件断言失败证据；该 job 仍未通过，需重跑。
- 3242 变更文件不含 Rust generator、reference JSON 或完整 harness；Rainer 通过 [PR 评论附件](https://github.com/gmx-io/gmx-interface/pull/3242#issuecomment-6798273490) 提供 `fesol57_harness.zip`。57 正文要求 generator/JSON 进入 PR；可复现测试如何纳入版本控制仍需 review 确认。本轮未下载该附件与本地 zip 作同一性比较。
- `@gmsol-labs/gmsol-sdk` 当前固定 `0.9.0-test.2`，本地声明含 create/update/close 及 TransactionGroup，但接口存在不证明支持所有 ABI/原子组合。`TransactionGroup.serialize()` 是嵌套数组，必须验证实际交易数、账户顺序和 size，不能把一个 group 当一笔原子交易。需要钉住 blockhash、nonce、metadata/hints、callback/referrer、账户存在性与 LUT 内容后做 builder 正例和恶意变体。
- [FESOL-112](https://linear.app/gmx-io/issue/FESOL-112) 本轮为 Todo；按编号未发现专门 API PR。它消费已发布 57 SDK，并在索引部署上做金融和 minContextSlot 核验；属于整合金融验收依赖，不是纯 builder/validator 开工前置。[UI#3193](https://github.com/gmx-io/gmx-interface/pull/3193) 数据基础仍 OPEN、REVIEW_REQUIRED、checks 成功，影响后续真实 UI 数据/刷新集成。未对 API indexed rollout 作本轮工程验收。

## 用户提供的测试包

已静态读取 `/Users/kenny/Downloads/gmsol_test.zip` 的 README、入口、测试引用、Cargo pin 与 JSON 元数据；未执行 Rust、SDK 测试、构建、抓链或交易。

- 固定 Rust commit `8af1e70c0c0b6ff9d6b41ba4997910588fbcec28`；12 个真实 position（10 市场，capture 2026-11-11T09:50:13Z）加 21 人工场景。真实 inputs SHA-256 `6c901b5b5fabb7e864b55015d4987088d3d08ef222428d85e90290b92d42266c` 与 expected.inputSha256 一致。
- 比较指定 checkout 的 SDK TS 源码，不要求单独 SDK build。默认用已保存 inputs 重跑 Rust 并核对 expected 后再比 SDK；不必先重新抓取链上快照。`--skip-rust` 仅比保存结果，不能称作本次 Rust 重算。
- 包含非零折扣及 increase/decrease 人工场景，超出 Divhead 最早仅 open-position/zero-discount harness 的范围。README 声称合计 38 tests；本轮未运行，不能报告通过。
- 不覆盖指令/账户 allowlist、模拟、四钱包签名、广播、keeper 实际执行；不能作为 56 主网验收。默认不进入常规 SDK/frontend 测试命令。没有核验当前链上部署仍为该 Rust commit。

## 建议顺序

优先推动 3243 review/合并，核验 3242 的费用契约与独立参考证据、重跑 CI 并 review；同步收敛余额到 3195，并让 71 准备运行条件。56 可先做当前 pinned ABI 与原子性验证、构建及确定性指令/账户校验，依赖成果稳定后接上真实费用/余额/RPC/签名/flag。主网验收最后核实版本、ALT、钱包与开关，并按授权执行；最终产物替换后的必要复验不可省略。
