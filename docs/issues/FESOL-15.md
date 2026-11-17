# FESOL-15 — Solana 市场选择器与 header

## 前置增量核验（2026-11-17）

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
