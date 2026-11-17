# FESOL-15 — Solana 市场选择器与 header

## 原 PR 已更新（2026-11-17）

用户随后明确要求“也更新 PR”，授权本次写入原上游源分支；已普通 fast-forward 推送 `056f8d689c` → `f6e228270340a7889df62aa96dbb5103a233a63f` 到 `gmx-io/gmx-interface:solana-market-selector-header-release-fesol-15`，未强推或改写历史。#3201 标题改为 TRD-63，正文换成当前 release、11 文件范围、实际测试/构建和局部页面验收边界，删除旧前置未合、旧全量验收及签名描述。远端确认 head 一致、**MERGEABLE**；mergeStateStatus 仍 BLOCKED，reviewDecision 为 CHANGES_REQUESTED。新 Audit、组件测试、常规测试、SDK standalone 与 Pages 检查运行中，未称 CI 全绿。原 PR 保持实际非 Draft 状态，未转换、请求 reviewer、回复 review 或合并。本次明确写入授权仅用于该 PR 更新，不改变 origin 长期只读约定。

## 上游冲突处理（2026-11-17）

用户确认 #3201 归 Kenny 负责并授权跟进上游、正确解决冲突。本轮角色为实现与局部验收负责人。当前需求 [TRD-63](https://linear.app/gmx-io/issue/TRD-63)，沿用原 FESOL-15 开发线及原 [PR #3201](https://github.com/gmx-io/gmx-interface/pull/3201)，不另建重复 PR。

- 实时读取 Linear 正文/关系、PR review 及源分支；直接前置 #3193/#3138、API #295 已合。原 PR head 为 `056f8d689c24889c5ffd32cba372c618ceace9a2`，In Review / Changes requested / CONFLICTING，实际不是 Draft。
- 复用原 development `/Volumes/kenny/gmx/gmx-interface-fesol-15` 与 delivery `/Volumes/kenny/gmx/gmx-interface-fesol-15-release`。先将原公开 review 修复接回 development（`fdcb63cf20`），再合入最新 release `7868f48f3e5cf1423a33a4e3f8cbbc9d5cd90d18`，development `b1a4dac7f20bca7e8e47749f79164fccbf49e274`；共处理与 release 的 35 处实际冲突。
- Provider、oracle、API、routes、公告与 locale 采用当前 release；移除旧前置自动残留的 fixture/sample API/adapter，保留 ETH 分类、networkId 排序、空 TradFi fallback、未知 listing date null key、unsupported Swap 保留表单与 EVM identity/collateral fallback、WSOL/WGMX SVG 等原 review 修复。仅将 11 个需求文件精确转入 delivery，未合入整支个人基础。
- delivery `f6e228270340a7889df62aa96dbb5103a233a63f` 相对 release **11 files / +277 -25**；原 PR head 和 release 都是其祖先，普通 merge，无 rebase/强推。11 文件与 development 完全一致，最终树无 gitlink，diff check 通过。公开祖先 `183aacb863` 的历史 gitlinks 仍存在，不冒充已满足历史清理意见。
- development SDK build、app/landing 类型检查、ESLint 通过，完整 suite **335 files / 3375 passed，1 skipped**；delivery 自身 SDK build、类型、ESLint、完整 suite **334 files / 3374 passed，1 skipped** 及生产 `yarn build` 全通过。构建使用 8 GiB；现有 Sass/包注释/chunk 大小提示保留，不是构建失败。针对性 5 suites / 35 passed 覆盖 lookup、tradebox、公告和 market filters。
- 另用未提交的真实 Hook/SWR 临时检查：networkId=Solana、chainId 保持 Arbitrum 时不请求 EVM listing dates，1 passed；去除 null-key guard 后相同检查产生错误日期并失败，已恢复源文件。测试不是仅对配置对象断言。
- 用户现有原生 Chrome、本 delivery 的 owned Vite 3035：默认 flag off 点击 Solana 仍提示独立 GMTrade；仅在该本地 origin 开启 solanaNetwork 后，真实 Solana DOGE 市场及价格、volume、OI、liquidity、净费率和 header 可加载，Swap 入口隐藏。尚未完整验收搜索/分类/k-token 展示及跨网往返；浏览器随后由用户切换，未继续干扰。未连接钱包/签名/交易。该 origin 实验开关当前保持开启，不能写成已恢复。

**发布边界：** development 推送 `my-gmx`，delivery 候选推送 `my-gmx-pr/solana-market-selector-header-release-trd-63-sync`。个人 fork 的旧同名分支位于另一条历史 `a2a051890a`，普通 push 被拒后已核实是旧交付线，不强推或整支合入；仅使用新远端候选 ref 保存同一需求成果，不建重复 PR。原 #3201 源分支实际位于 `gmx-io/gmx-interface`；AGENTS 规定 origin 只读，因此 fork 候选不会更新原 PR，公开冲突状态尚未解除。需用户为本次普通 fast-forward 更新原源分支明确允许例外；不要求重写历史、转 Ready、请求 reviewer 或合并。AC2 金融数据语义及历史清理仍单独 review，不将本次冲突修复宣称整需求 Done。本机日志在两目录 `.local/acceptance/trd63-20261117/`。

## 前置增量核验（2026-11-17）

本轮直接读取TRD-63/85正文与blockedBy：63直接前置为TRD-65（原52）和TRD-130（原64）；85直接前置为TRD-65和TRD-86（原50）。GitHub确认UI#3193于11月16日08:41:44UTC合入release、UI#3138已合、API#295（63/64市场配置数值）已合；两条的直接前置PR均已合。附带静态配置UI#3111已合，TRD-105网络lookup为Done（未找到独立PR，不将状态代替合并证明）。15/#3201和29/#3223自身仍Open、CONFLICTING；前置合并不代表自身已同步或现场验收通过。原113字段#3205/#3207仍Open/CONFLICTING，是扩展SDK契约后续，不混作两条已列直接前置；完整Depth/图表操作、金融API部署等验收仍需分别核实。本轮只查Linear/GitHub，不改代码或需求、不做部署/页面验收。

当前TRD-63；#3201原head056f8d689c未变，现CONFLICTING且Changes requested；多条review已有作者修复回复，需冲突处理和复核，不机械重新派同一缺陷。 统一证据、版本及跟进建议见[五需求依赖核验](../solana-trading-dependencies.md#五需求前置增量核验2026-11-17)。

更新：2026-11-15。角色：review 反馈吸收流程调查，不是本轮实现或验收负责人。
来源：[PR #3201](https://github.com/gmx-io/gmx-interface/pull/3201)。本轮实时读取 inline comments 和 reviews，未刷新 Linear、执行代码/页面验收或核对所有修复提交；不据此确认整需求完成。

## 本轮核实

- 2026-11-05 Divhead 指出 ETH 分类、空 TradFi、Swap setter 保留已有状态、默认排序应使用 networkId、复用地址映射、图标资源及无效测试等问题；作者于 11-09 逐项回复已修复。这些回复是历史修复证据，不冒充本轮重新验证。
- [图标评论](https://github.com/gmx-io/gmx-interface/pull/3201#discussion_r4483355252)要求新增 WSOL/WGMX SVG，沿用 WETH/WBTC 的已有机制，避免共享图标组件增加 symbol 特判。
- [测试评论](https://github.com/gmx-io/gmx-interface/pull/3201#discussion_r4483355273)指出没有 null key 也会通过，因为 chainId 仍是 Arbitrum；要求去除无效测试和 return masking。作者回复移除 guard 后新检查会失败；本轮未重跑该验证。
- [2026-11-10 后续回归](https://github.com/gmx-io/gmx-interface/pull/3201#discussion_r4519631690)：early return 阻断 identity update 的 collateral fallback，造成新 Arbitrum 页面和未存 collateral 的恢复场景无法初始化抵押品。作者回复在 `056f8d689c` 将 early return 限制到 unsupported Swap 并补回归；不能仅以原 Solana 用例通过证明共享 setter 修复完整。
- [首轮总评](https://github.com/gmx-io/gmx-interface/pull/3201#pullrequestreview-5788682179)还涉及未合并依赖、重建 release 和公开历史中的 gitlinks；这是交付与集成问题，与代码缺陷及待产品决定分别判断。

## 可复用结论与边界

2026-11-15进一步静态核对#3201 `056f8d689c`的setter，early return现限定unsupported Swap，identity update继续fallback；未重跑行为测试。同一历史问题也在29/#3223出现，需要先追源提交，不能据两个PR直接认定两次独立犯错。原Linear不可读，历史要求与跨组经验见[深挖调查](../review-learning-investigation-2026-11-15.md)。

反馈闭环调查结论和后续建议统一保存在[编码与自审规范](../coding-and-self-review.md#review-反馈吸收现状核验2026-11-15)。本记录补齐检索入口，不回填或编造早期 Agent 的执行经历，不宣称上述问题仍存在于当前 head。
