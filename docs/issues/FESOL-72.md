# FESOL-72 — 最终 WASM 产物与 56 的顺序

2026-11-13（Asia/Shanghai），角色：依赖与版本目标调研。[Linear](https://linear.app/gmx-io/issue/FESOL-72) 为 Execution，kenny；本轮 GitHub 按 FESOL-72 搜索没有专门 PR，不能据此断言没有任何相关开发。

已读实时正文/关系：56 blocks 72，72 在替换 GMX CI 构建的 WASM 后复验 56 主网流程。72 是最终发布产物与流程复验条件，不能反解为 56 开工前必须先完成全部 72。正文仍称 deployed v0.10.0，而 57 当前参考为 8af1e70c/0.11.0；109 已要求协调目标与 artifact 位置。实际构建/指令 ABI 支持与当前部署兼容未在本轮验证。

本轮未构建 SDK、发布产物或替换 pin；细节见 [FESOL-56](FESOL-56.md)。

## 单条需求复查（2026-11-13 13:37，Asia/Shanghai）

实时查询正文、双向关系与评论（抓取 `2026-11-13T05:37:29.824Z`）：仍为 Execution、kenny，updatedAt 为 `2026-11-11T06:50:10.438Z`，无评论。范围为 GMX CI 使用 wasm-pack bundler target 构建，记录 `.wasm` SHA-256；PR 前与 Divhead 商定 `@gmx-io` npm 包或仓库内文件的产物位置，替换 FESOL-55 的 pin，再复验 FESOL-56 主网流程。验收同时要求应用加载 GMX 构建、主网流程落链、PR 包含 hash；构建成功本身不能代表验收完成。

当前个人基础源码 `package.json` 仍固定 `@gmsol-labs/gmsol-sdk` 为 `0.9.0-test.2`；`src/config/gmsol/sdk.ts` 的路径为 `gmsol-sdk/0.9.0-test.2-v2`，WASM SHA-256 为 `775a7ddb532d6d49a1800a3d8eccca523960d685db8e1800fbd5eb519ed8dd68`。仅核对本 checkout，不代表 release 或线上版本。

关联 FESOL-57 本轮实时正文仍要求 deployed reference `8af1e70c (0.11.0)`，与 72 的 `v0.10.0` 不一致；这是需要确认的构建目标问题，不能直接以数学 reference 替换 WASM 目标，也未重新核验当前链上程序版本。建议先确认目标 tag/commit 与产物位置，再推进固定源码、CI 构建及接入；最终复验依赖 56。此次只读调研及知识更新，未查新 PR、构建、改业务代码或执行链上操作。

## 用户指定 stable 为版本依据后的核验（2026-11-13）

用户明确本需求接入版本以 `gmx-solana-interface` 最新 `stable` 分支实际使用的 SDK 为准，替代上文待询问目标版本的建议。GitHub API 与官方 origin 定向 fetch 一致确认 stable HEAD 为 `27a2612228a2f8cba0a0c9d450eff7b696898fbb`（2026-11-12 19:40:56 +0800，合并 #1094，前端版本 2.18.0）。未切换或移动参考仓库当前 main checkout，仅刷新 stable 远端引用。

- [app/package.json:54](https://github.com/gmsol-labs/gmx-solana-interface/blob/27a2612228a2f8cba0a0c9d450eff7b696898fbb/app/package.json#L54) 精确固定 `@gmsol-labs/gmsol-sdk` 为 **`0.11.0-beta.1`**；[pnpm-lock.yaml:78](https://github.com/gmsol-labs/gmx-solana-interface/blob/27a2612228a2f8cba0a0c9d450eff7b696898fbb/pnpm-lock.yaml#L78) 的 specifier/resolved version 一致，非版本范围。
- `app/vite.config.ts` 使用 `vite-plugin-wasm` 与 `vite-plugin-top-level-await` 接入 npm 包；所查 workflow 未发现自行 wasm-pack 构建此 SDK 的配置。
- npm 官方 registry 的该版本元数据返回 repository 为 `gmsol-labs/gmx-solana`、`gitHead` 为 `7fe4008292ffc09061f3a733ad9b5cd2e6235fa8`，tarball 为 `https://registry.npmjs.org/@gmsol-labs/gmsol-sdk/-/gmsol-sdk-0.11.0-beta.1.tgz`。gitHead 是包发布元数据，尚未独立复现构建或核实其与链上部署的对应关系。

结论：按用户指定依据，FESOL-72 当前接入目标为 `0.11.0-beta.1`；stable 是前端分支名，不能将 npm 版本省略为 `0.11.0` 正式版。GMX 自建产物仍需固定实际源码和构建配置、记录 WASM SHA-256 并复验 56；产物存放方式尚未决定。未修改 Linear 或业务依赖，未构建、发布、签名或发送交易。
