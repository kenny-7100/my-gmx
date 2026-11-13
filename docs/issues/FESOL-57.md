# FESOL-57 — 共享 SDK 数学依赖调研

## 2026-11-13 最新复查（优先于下方历史状态）

实时读取 #3242：OPEN、REVIEW_REQUIRED、reviews 空；head 已从本地集成的 `6d3ed92c` 前进到 `f16deff8a71516bd987a17334f218ed08c1fa9bd`，新增一笔 `fix Solana trade calculations`。本次只读审查，未合入 FESOL-56。最新 Audit、常规 lint/type/tests、组件测试、SDK standalone build 和两个预览检查全部通过，旧 apt DNS 失败已不再是当前阻碍。

新增 diff 对 dust 明确增加 size===0 返回、零执行 token 时清零 USD size、margin check 返回 undefined，另有 below-one-atom/impact-consumed 等回归用例。因此历史除零问题应标记为上游已有针对性修复、本地尚未同步和独立复验，不应继续称最新 PR 未处理。还修改限价触发价估算、从 executionPrice 推导 acceptable impact bps、超 cap 的平仓净值、部分平仓/取消提款边界以及 gmsol 零 UI fee，并新增四组 trade math 回归。以上是静态 diff 和上游 CI 证据，不代表本地组合或当前部署程序的 Rust 对齐已通过。

最新文件清单仍未包含完整 Rust generator/reference JSON；保存样本 38 项通过仍仅适用于旧 head，不能转用于 f16deff。数学开关/API rollout 与 feeDiscountFactor 消费链问题的旧观察也不能当作本轮线上新核验。56 的 fixed WASM 高层 create 使用 300000 lamports、不暴露自定义 keeper fee，属于跨 SDK 契约约束，并非已证实的 57 数学 bug。后续同步时需保留 92 的 units 导出，重验 changed math、原 dust 输入、参数消费和固定协议对齐。

## 初次实施与审查记录

2026-11-13 后续实施：用户授权同步后，已将上游 `f16deff8` 合入 FESOL-56，merge commit `b7ee2e27f1e98737db99d70e302eba79264bcfb3`，无冲突，保留 92 的 `export * from "./units"`。目标 SDK 全量 64 文件/952 tests passed；原始 BTC 8 位、价格 $100000、增仓 $0.0001、零 impact 的独立临时用例通过，acceptablePrice=0、不再除零，用例已清理。交易/钱包/LUT 定向 4 文件/12 tests passed；7 个变更文件 lint、format 通过，受管理 SDK types/CJS/ESM 产物重建通过。未重跑 Rust reference，不宣称新数学已完成当前部署程序对齐。收尾结果见 [FESOL-56](FESOL-56.md)。

2026-11-13（Asia/Shanghai），角色：为 FESOL-56 核验依赖，未修改实现。
[Linear](https://linear.app/gmx-io/issue/FESOL-57)：Review，Rainer。[UI#3242](https://github.com/gmx-io/gmx-interface/pull/3242) OPEN，head `6d3ed92ca64129cb4d5ab8d26a9c1baff6563802`，REVIEW_REQUIRED，未提交 review。

已读取实时正文/评论、PR body/diff/checks/评论和失败 job 日志，并静态检查用户下载的 gmsol_test.zip。常规 CI 与 standalone SDK build 成功；组件 job 在浏览器依赖安装阶段因 Ubuntu 源 DNS 失败，未证明组件断言失败，也未通过。本轮在 PR 原 head 及组合分支分别运行 zip 的 skip-rust 对比，均 38 项通过，未重算 Rust。

PR 代码提供 getGmsolExecutionFee；与 FESOL-92 同时新增 gmsol/index.ts，整合需保留双方导出。完整 Rust generator/reference JSON 通过评论附件提供，未见于当前 PR 变更文件，需按需求确认版本化交付。包内有 12 个真实 position 与 21 人工场景，固定 deployed reference 8af1e70c；当前真实部署版本未核验。

依赖分类、包覆盖范围和证据边界统一见 [FESOL-56](FESOL-56.md)。不能以该数学包替代交易签名/发送验收。

本轮发现并复现 gmsol increase 的正数 dust 除零（BTC 8 位、$100,000、size $0.0001）；具体触发、修复方向与当前线上尚无 tradeMath 的边界见 [FESOL-56 审查记录](FESOL-56.md#审查发现已复现缺陷)。组合 SDK 全量 948 项通过并不覆盖该输入，未代替作者修复。
