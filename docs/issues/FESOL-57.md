# FESOL-57 — 共享 SDK 数学依赖调研

2026-11-13（Asia/Shanghai），角色：为 FESOL-56 核验依赖，未修改实现。
[Linear](https://linear.app/gmx-io/issue/FESOL-57)：Review，Rainer。[UI#3242](https://github.com/gmx-io/gmx-interface/pull/3242) OPEN，head `6d3ed92ca64129cb4d5ab8d26a9c1baff6563802`，REVIEW_REQUIRED，未提交 review。

已读取实时正文/评论、PR body/diff/checks/评论和失败 job 日志，并静态检查用户下载的 gmsol_test.zip。常规 CI 与 standalone SDK build 成功；组件 job 在浏览器依赖安装阶段因 Ubuntu 源 DNS 失败，未证明组件断言失败，也未通过。本轮在 PR 原 head 及组合分支分别运行 zip 的 skip-rust 对比，均 38 项通过，未重算 Rust。

PR 代码提供 getGmsolExecutionFee；与 FESOL-92 同时新增 gmsol/index.ts，整合需保留双方导出。完整 Rust generator/reference JSON 通过评论附件提供，未见于当前 PR 变更文件，需按需求确认版本化交付。包内有 12 个真实 position 与 21 人工场景，固定 deployed reference 8af1e70c；当前真实部署版本未核验。

依赖分类、包覆盖范围和证据边界统一见 [FESOL-56](FESOL-56.md)。不能以该数学包替代交易签名/发送验收。

本轮发现并复现 gmsol increase 的正数 dust 除零（BTC 8 位、$100,000、size $0.0001）；具体触发、修复方向与当前线上尚无 tradeMath 的边界见 [FESOL-56 审查记录](FESOL-56.md#审查发现已复现缺陷)。组合 SDK 全量 948 项通过并不覆盖该输入，未代替作者修复。
