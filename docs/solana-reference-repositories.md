# Solana 迁移参考仓库

本页供后续 Agent 定位资料、核对协议行为和接口使用。仓库用途记录于 2026-10-24；按需更新规则于 2026-11-12 补充。
分支、部署版本、SDK 版本和 remote 配置会变化，开始任务时应重新检查相关仓库。

## 核心集成原则

用户于 2026-10-24 明确确认：目标是在现有 GMX 架构和统一数据流中增加 Solana 支持，降低后续维护成本。

- 复用 GMX 现有页面、组件、状态管理、业务模型及交互流程；将 Solana 所需数据和行为适配到这些既有契约。
- RPC、钱包、账户解码、交易构建等链特有能力可以有专属适配实现，但不能因此引入一套并行的 Solana 页面、状态或业务数据流。
- `gmx-solana-interface` 用于理解原有资源和行为，用户已明确该旧前端后续会废弃，不能将其持续运行作为新集成的前提。
- 旧 Solana 后端已收录到 `gmtrade-web-backend/`，是用户提供的源码快照，无 Git 历史；该后端可能废弃，与工作区已有的 `gmx-api` 不是同一项目。应分析所需数据和行为如何进入现有 GMX 数据链路，而非直接迁移其服务或让新前端长期依赖它。查阅[后端参考说明](gmtrade-web-backend-reference.md)。
- 不因参考项目已有某种实现就照搬；先查 GMX 是否已有等价能力。没有等价模块、需要新增前端组件或模块时，按根 `AGENTS.md` 先确认。

实现及自审都应检查：Solana 是否接入了现有共享数据模型和业务流程，以及移除旧前端和可能废弃的旧后端后，目标方案是否仍可独立工作。具体接口、适配位置和替代能力需在对应任务中核实，不能根据废弃计划自行推断。

## 工作区与仓库用途

以下路径均相对于主项目根目录。当前工作区包含主项目、10 个配套仓库，以及 1 个后端源码快照。
实现落在 `gmx-interface`；参考仓库的存在不表示应迁移其架构或复制其组件。

| 本地路径 | 上游仓库 | 用途与查阅入口 |
| --- | --- | --- |
| `./` | [gmx-io/gmx-interface](https://github.com/gmx-io/gmx-interface) | 集成目标。复用 `src/components/`、`src/domain/`、`src/context/` 和现有页面；共享计算与类型位于 `sdk/`。 |
| `gmx-api/` | [gmx-io/gmx-api](https://github.com/gmx-io/gmx-api) | 数据服务，当前以 gitlink 记录但没有 `.gitmodules`，不能假定可用 submodule update 初始化。查阅 `README.md`、`src/solanaApp.ts`、`src/domain/solana/`；区分样例响应与真实链上读取，不把样例路由当成已完成的数据服务。 |
| `gmx-prompts/` | [gmx-io/gmx-prompts](https://github.com/gmx-io/gmx-prompts) | 工程规范。先看 `skills/gmx-interface-dev/SKILL.md` 和 `skills/gmx-solana/SKILL.md`，再按其指引查阅相关文档。 |
| `gmx-solana-interface/` | [gmsol-labs/gmx-solana-interface](https://github.com/gmsol-labs/gmx-solana-interface) | 原 Solana 前端参考。了解资源、接口调用、钱包及订单交互；仅提取所需行为，不能直接搬运页面、业务逻辑或 UI 组件。 |
| `gmtrade-web-backend/` | 用户提供的压缩包，无上游 remote 信息 | 旧 Solana Web 后端源码快照。查阅 `src/lib.rs`、`src/http/mod.rs`、`src/refresh.rs`、`src/aggregate/` 和 `src/sources/`；详见[参考说明](gmtrade-web-backend-reference.md)。 |
| `gmx-adrs/` | [gmx-io/gmx-adrs](https://github.com/gmx-io/gmx-adrs) | 跨项目架构决策。重点查看 ADR-0015 的专门分支，以及 API launch modes 等相关 ADR。详见下节。 |
| `gmx-synthetics/` | [gmx-io/gmx-synthetics](https://github.com/gmx-io/gmx-synthetics) | GMX V2 EVM 协议及测试。查阅 `contracts/order/`、`contracts/position/`、`contracts/reader/` 和 `test/`，核对共享前端原有的协议假设；Solana 实际行为仍以 gmsol 为准。 |
| `gmx-solana/` | [gmsol-labs/gmx-solana](https://github.com/gmsol-labs/gmx-solana) | Solana 协议与 SDK 源码。`programs/store/` 为核心程序，`crates/model/` 为计算模型，`crates/sdk/` 为 SDK；另有 `crates/decode/`、`tests/`、`examples/`。用于核对账户布局、精度、PDA、指令和协议计算。 |
| `gmx-solana-frontend-docs/` | [gmsol-labs/gmx-solana-frontend-docs](https://github.com/gmsol-labs/gmx-solana-frontend-docs) | 原前端流程说明。查阅 `docs/architecture/overview.md` 和 `docs/flows/` 中的市场、持仓、订单、历史、订单准备与提交、CPI 事件订阅文档。其 Zustand、Backend/Keeper API 架构只作参考。 |
| `gmtrade-sqd/` | [gmsol-labs/gmtrade-sqd](https://github.com/gmsol-labs/gmtrade-sqd) | 历史与统计索引。先看根 README，再看 `squids/core/README.md`、对应 GraphQL schema 和 `squids/gt/`。不是首发实时市场、持仓、订单数据服务的替代品。 |
| `gmx-solana-programs/` | [gmsol-labs/gmx-solana-programs](https://github.com/gmsol-labs/gmx-solana-programs) | 基于 IDL 自动生成的 Rust SDK。查阅 `idls/gmsol_store.json`、`idls/gmsol_treasury.json` 和 `src/`，辅助核对账户与指令定义。 |
| `gmx-solana-audits/` | [gmsol-labs/gmx-solana-audits](https://github.com/gmsol-labs/gmx-solana-audits) | 审计 PDF 和 `known_issues/`。涉及交易校验、清算或协议边界时，结合报告对应提交和实际部署版本查阅。审计结论只覆盖其审计范围。 |

## 子仓库按需核验与更新

此规则覆盖配套 Git 仓库，以及今后新增的相关仓库；`gmtrade-web-backend` 是无 remote 的源码快照，不能自动拉取。`sdk/`、`landing/` 等若与主项目共享 Git 根，则随主仓库同步，不当作独立仓库。先用 `git -C PATH rev-parse --show-toplevel` 确认边界。

### 何时核验

- 即将首次读取工程规范、参考协议/IDL、使用 API/SDK 契约、启动子项目联调或依赖它验收时，只核对相关仓库。跨会话恢复、收到相关 PR/契约变化提示、交付前需要确认跨仓库兼容时再核对。
- 同一任务轮次已成功核验、没有相关变化时复用观察；不定时轮询、不每轮 fetch 所有仓库，不把本地 `origin/*` 未刷新状态称为最新。
- 分析/推荐/进度查询优先 GitHub CLI/API 读取相关远端 SHA、PR 和文件，不移动本地 checkout；实施任务可自主 fetch，并按下表处理。仅要求 push 时不插入更新流程。

### 如何选择更新方式

先核对真实 Git 根、工作区/暂存区、当前分支、目标上游、领先/落后、未完成操作及关联 worktree/正在使用的服务。目标以当前需求为准：release、默认分支、特定 PR 或固定版本可能各不相同；个人推送 remote 不等于需要跟随的官方上游。目标不清楚先查远端默认分支和任务依赖，不能一律 pull main。

| 当前用途与现场 | Agent 的默认处理 |
| --- | --- |
| 纯参考、无固定版本、干净且未被其他任务/服务占用的普通跟踪分支 | fetch 对应官方远端；确认仅落后后用 `merge --ff-only` 主动快进，更新后再读相关文件。已最新则直接继续。 |
| 有本地改动、领先提交、分叉、未完成操作，或正在开发/运行服务 | fetch 只刷新远端引用；通过 `git show` / diff 核对相关变化，保持原现场。需要新版本运行/修改时另建独立 worktree，不自动切分支、stash、rebase、reset 或合并功能分支。 |
| 父仓库记录为 gitlink、子模块、detached HEAD，或任务固定了 SHA/tag/依赖版本 | 核验最新变化与固定版本的差异，默认使用 `git show REMOTE_REF:PATH` 或独立 worktree 阅读最新版；不直接移动固定 checkout 或暂存父仓库指针。确需升级版本时按任务范围单独审查、更新引用并验证消费者。 |
| 只读快照、无 remote、网络/权限失败或目标分支已删除 | 说明来源与新鲜度缺口，继续可独立完成的部分；不自行添加 remote、换来源，失败不标为已最新。 |

```sh
# Example for an unused, clean, unpinned reference checkout on main tracking origin/main.
git -C gmx-prompts status --porcelain
git -C gmx-prompts branch -vv
git -C gmx-prompts fetch --no-recurse-submodules origin
git -C gmx-prompts rev-list --left-right --count HEAD...origin/main
# Only after confirming the safety conditions above and a pure fast-forward:
git -C gmx-prompts merge --ff-only origin/main
# Read a newer reference without moving a pinned or active checkout:
git -C gmx-adrs show origin/adr-0015-solana-gmx-api:adr/0015-serve-solana-data-through-gmx-api.md
```

更新源码不代表已更新运行服务、生成路由、安装依赖或 SDK/WASM 产物。按实际差异与任务需要验证这些消费者，相关构建/启动沿用根授权；参考仓库最新版也不证明与当前 npm SDK、IDL 或链上部署兼容。发现有意义的变化，简短记录仓库、目标 ref/SHA、兼容影响与处理；未变化不新增流水账，本地观察留在任务记录，长期规则更新已有主题。

2026-11-12 本地盘点发现 10 个独立配套 Git 仓库，当前均在 main、跟踪 origin/main 且工作区干净；这只是本地现场，不代表远端最新。其中 8 个在父仓库中记录为 gitlink，没有 `.gitmodules`；`gmx-prompts` 和旧前端为忽略目录。更新前仍需现场复核，不对所有目录递归 pull 或执行 `submodule update --remote`。本次实际 fetch 后确认 `gmx-prompts` 仅落后 3 个提交，已安全快进至 `7204161`，包含 review 的 merge-result/runtime/acceptance 更新及颜色迁移 skill；其余仓库未执行远端更新，不能视为已核验最新。

## 必看：ADR-0015 的专门分支

clone `gmx-adrs` 后，**必须额外查看 `origin/adr-0015-solana-gmx-api`**。
核验时该文档尚未进入默认分支，状态为 **Proposed**，对应 [PR #27](https://github.com/gmx-io/gmx-adrs/pull/27)。

- 分支：`adr-0015-solana-gmx-api`
- 文件：`adr/0015-serve-solana-data-through-gmx-api.md`
- [在线文档](https://github.com/gmx-io/gmx-adrs/blob/adr-0015-solana-gmx-api/adr/0015-serve-solana-data-through-gmx-api.md)

无需切换分支即可只读查看：

```sh
git -C gmx-adrs show origin/adr-0015-solana-gmx-api:adr/0015-serve-solana-data-through-gmx-api.md
```

该文档记录了数据来源、API 契约、精度、SDK 适配、交易检查及发布范围：

- 市场、持仓、订单通过 Solana 部署的 gmx-api 提供，适配共享页面类型，美元金额使用 `10^30` 精度。
- 价格、K 线和 24 小时变化来自 GMX 的 Arbitrum oracle keeper；按 mint 映射价格，解析时使用对应 Arbitrum 代币精度。
- 钱包通过 Privy 接入；余额、交易和已发送订单结果通过 Solana RPC 处理。
- 主项目保留 EVM `chainId`，使用独立的所选网络标识表达 Solana。
- `solanaNetwork` 控制功能开放，`solanaTrading` 控制交易发送。
- 原前端直接读取 GMTrade Backend/Keeper 的路径不应照搬到主项目。

这是提案与设计参考，不代表所有能力已经实现。后续 Agent 应复核 PR 状态、最新规范、实际代码及接口响应；出现冲突或契约不清时，按根目录 `AGENTS.md` 向用户澄清。

## 按任务查阅

| 任务 | 优先查阅 |
| --- | --- |
| 确认迁移范围、数据来源与架构 | 根 `AGENTS.md` → `gmx-prompts` → ADR-0015 |
| 接入市场、持仓、订单 | ADR-0015 → `gmx-api` 接口和样例 → 主项目现有状态及类型 |
| 钱包、余额、订单交互 | 主项目现有模块 → 原前端流程文档及参考前端 → `gmx-solana` |
| 构建、校验或追踪交易 | `gmx-solana/crates/sdk/`、程序指令、IDL → 原前端订单流程 → 审计及已知问题 |
| 精度、费用、价格影响或清算差异 | `gmx-solana/crates/model/` 和程序测试 → `gmx-synthetics` → 主项目 `sdk/` |
| 历史与统计 | `gmtrade-sqd` schema、处理器和 README → 主项目相关数据模块 |

源码 `main`、程序部署版本、IDL、审计版本和 npm SDK 版本可能不同。核验时主项目固定 `@gmsol-labs/gmsol-sdk` 为 `0.9.0-test.2`；开发时重新检查 `package.json` 和 WASM 完整性配置，不能直接以参考仓库最新代码推断当前运行行为。

## Git remote 与仓库管理

用户在个人镜像中自由开发和提交测试代码，原始仓库通常没有直接 push 权限：

| 仓库 | 上游 remote | 个人推送 remote |
| --- | --- | --- |
| 主项目 | `origin` → `gmx-io/gmx-interface` | 个人基础 `my-gmx` → `kenny-7100/my-gmx`；业务 PR `my-gmx-pr` → `kenny-7100/gmx-interface` |
| `gmx-api` | `origin` → `gmx-io/gmx-api` | `my-gmx-api` → `kenny-7100/my-gmx-api` |
| `gmx-solana-interface` | `origin` → `gmsol-labs/gmx-solana-interface` | `my-gmt` → `kenny-7100/my-gmt` |
| `gmx-prompts` | `origin` → `gmx-io/gmx-prompts` | 例外，不套用个人镜像推送规则 |
| `gmtrade-web-backend` | 无 Git 元数据，来源为用户提供的源码快照 | 无独立 remote，暂作为主项目下的参考文件管理 |
| 本轮新增的 7 个仓库 | 各自上游的 `origin` | 尚未配置个人镜像 remote |

执行用户授权的 push 时，除 `gmx-prompts` 外，必须明确选择对应的 `my-` remote，不能依据 upstream 自动推送到 `origin`。个人 remote 尚未配置时，先向用户确认目标；本次 clone 不包含创建 GitHub 镜像的授权。

新增 7 个目录都是独立嵌套 Git 仓库，已在提交 `567331a4d4` 中以 gitlink（模式 `160000`）记录，但未配置对应的 `.gitmodules` 条目。因此重新 clone 主项目不会自动得到这些参考仓库的源码；需要时按上表地址分别 clone。用户明确要求 `push` 时，按根 `AGENTS.md` 直接暂存、提交和推送，不再为这些目录请求确认。

提交签名以各仓库当前 Git 配置为准，不依赖历史记录推断。本轮主项目的长期签名配置仍为启用；此前维护提交仅通过命令级配置关闭签名，没有永久修改。签名失败时按现场诊断，不自动更改长期配置。
