# FESOL-72 — 最终 WASM 产物与 56 的顺序

2026-11-13（Asia/Shanghai），角色：依赖与版本目标调研。[Linear](https://linear.app/gmx-io/issue/FESOL-72) 为 Execution，kenny；本轮 GitHub 按 FESOL-72 搜索没有专门 PR，不能据此断言没有任何相关开发。

已读实时正文/关系：56 blocks 72，72 在替换 GMX CI 构建的 WASM 后复验 56 主网流程。72 是最终发布产物与流程复验条件，不能反解为 56 开工前必须先完成全部 72。正文仍称 deployed v0.10.0，而 57 当前参考为 8af1e70c/0.11.0；109 已要求协调目标与 artifact 位置。实际构建/指令 ABI 支持与当前部署兼容未在本轮验证。

本轮未构建 SDK、发布产物或替换 pin；细节见 [FESOL-56](FESOL-56.md)。

## 单条需求复查（2026-11-13 13:37，Asia/Shanghai）

实时查询正文、双向关系与评论（抓取 `2026-11-13T05:37:29.824Z`）：仍为 Execution、kenny，updatedAt 为 `2026-11-11T06:50:10.438Z`，无评论。范围为 GMX CI 使用 wasm-pack bundler target 构建，记录 `.wasm` SHA-256；PR 前与 Divhead 商定 `@gmx-io` npm 包或仓库内文件的产物位置，替换 FESOL-55 的 pin，再复验 FESOL-56 主网流程。验收同时要求应用加载 GMX 构建、主网流程落链、PR 包含 hash；构建成功本身不能代表验收完成。

当前个人基础源码 `package.json` 仍固定 `@gmsol-labs/gmsol-sdk` 为 `0.9.0-test.2`；`src/config/gmsol/sdk.ts` 的路径为 `gmsol-sdk/0.9.0-test.2-v2`，WASM SHA-256 为 `775a7ddb532d6d49a1800a3d8eccca523960d685db8e1800fbd5eb519ed8dd68`。仅核对本 checkout，不代表 release 或线上版本。

关联 FESOL-57 本轮实时正文仍要求 deployed reference `8af1e70c (0.11.0)`，与 72 的 `v0.10.0` 不一致；这是需要确认的构建目标问题，不能直接以数学 reference 替换 WASM 目标，也未重新核验当前链上程序版本。建议先确认目标 tag/commit 与产物位置，再推进固定源码、CI 构建及接入；最终复验依赖 56。此次只读调研及知识更新，未查新 PR、构建、改业务代码或执行链上操作。
