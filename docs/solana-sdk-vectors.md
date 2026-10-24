# 真实 SDK/WASM 与基础数值参考向量

更新日期：2026-10-25。对应 A11 第一阶段，工具已实现；目前覆盖真实 WASM 初始化和 `apply_factor` 基础运算，不代表 PnL、费用、清算价、市场模型或完整 A11 已完成。

## 用途与执行顺序

后续 Agent 验收 SDK 数值或排查 WASM 运行环境时，先固定 SDK/产物身份，再用真实二进制运行已知参考向量，避免只凭 mock 加载测试或文件摘要判断 SDK 已能计算。无关的钱包/HTTP/页面验收不需要额外运行。

在主仓库根目录执行：

```sh
yarn solana:sdk-vectors
```

依赖现有 Node 22、tsx、固定 npm SDK 和本机独立 SDK 产物。它先复用[版本证据检查](solana-runtime-preflight.md)的 readLocalRuntime，再读取即将实例化的 npm WASM 和 wrapper，核对其摘要与本次前置结果一致；然后通过 Node WebAssembly.instantiate、绑定与 start 初始化，直接执行真实 `sdk.apply_factor`，不 mock WASM。

没有网络、RPC、钱包、签名或交易；不启动服务、不构建、不安装依赖。缺独立产物或摘要不匹配直接失败，按现有产物准备与构建授权流程处理，不能跳过指纹检查或自动重建。实际执行的是 npm WASM，独立构建产物仅由复用前置核对摘要，不运行浏览器 public entry.js。

实现：[scripts/solana-sdk-vectors.mjs](../scripts/solana-sdk-vectors.mjs)。测试：`yarn test:solana-sdk-vectors`；测试额外需要已有 Python 3，用于重新生成独立参考值，正常 CLI 只读取固定 JSON，不调用 Python。

## 参考基准与证明边界

2026-10-25 实时核对 FESOL-57：该需求明确要求 gmx-solana v0.10.0 model 生成器及复杂业务数学基准。本工具的 Python apply_factor 向量仅为基础能力，不满足该生成器要求，也不能作为 FESOL-57 完成证据。

参考契约为 `floor(value * factor / 10^20)`，value/factor 为 u128，结果超出 u128 返回 undefined。JavaScript 运行器只解析固定向量和比较结果，不自行实现这个公式作为期望。

固定数据：[apply-factor.json](../tools/solana-sdk-vectors/apply-factor.json)。独立生成器：[generate.py](../tools/solana-sdk-vectors/generate.py)，仅用 Python 任意精度整数乘法和整除，无 SDK/RPC 依赖。复核而不改写仓库文件：

```sh
python3 tools/solana-sdk-vectors/generate.py > /tmp/gmsol-apply-factor.json
```

对比生成 JSON 与固定 JSON 的数据结构，格式空白不作为数学差异。预期结果不得从正在验收的 WASM 输出反向更新；发现不一致先排查契约/版本，不能为了测试通过改期望。

契约参考为 gmx-solana 提交 `f102501f30635062fac156ca05831c0fb63a8590` 的：

- [SDK JS 导出](https://github.com/gmsol-labs/gmx-solana/blob/f102501f30635062fac156ca05831c0fb63a8590/crates/sdk/src/js/utils.rs)：u128 入参和 Option 返回值。
- [MARKET_DECIMALS=20](https://github.com/gmsol-labs/gmx-solana/blob/f102501f30635062fac156ca05831c0fb63a8590/crates/programs/src/constants/mod.rs)。
- [apply_factor](https://github.com/gmsol-labs/gmx-solana/blob/f102501f30635062fac156ca05831c0fb63a8590/crates/model/src/utils.rs) 与 [u128 checked_mul_div](https://github.com/gmsol-labs/gmx-solana/blob/f102501f30635062fac156ca05831c0fb63a8590/crates/model/src/num.rs)：U256 中间乘积、整除、结果转换回 u128。

该参考源码用于解释并固定数学契约；**没有证明它就是当前 npm 0.9.0-test.2 的构建来源**，也没有重新编译 Rust 或调用链上 view。独立数学期望与真实 WASM 一致只证明这些输入下的基础行为，不证明前端 SDK 业务计算正确或程序版本兼容。

12 条向量覆盖零值/零因子、1%/100%/110%、向下取整至零及余数、超过 JS 安全整数、u128 最大值与因子、两个溢出结果。当前仅支持合法 u128 范围；JS wrapper 对负数或超范围值可能截断，运行器在调用前拒绝，不将这些未定义输入用于证明 SDK 合约。

## 报告、状态与归档

成功退出 0，报告 scope 为 real-wasm-reference-vectors，包含观察时间、Node/SDK 版本、WASM/wrapper/源码摘要、固定向量及生成器摘要、每条输入/期望/actual/状态。金额一律字符串；expected/actual 为 null 表示对应 SDK 的 undefined，不表示零。

某条值不符时输出完整 failed 报告，退出 1；产物/格式/初始化异常为 stderr 脱敏失败，退出 1，无成功报告。运行器不自动重试，不添加算法兜底。

```sh
mkdir -p .local/acceptance/sdk-vectors
yarn solana:sdk-vectors > .local/acceptance/sdk-vectors/report.json
```

先核对退出码与报告。报告可按[证据包说明](agent-evidence.md)用 `--report vectors=...` 归档，本地目录被 Git 忽略。包完整不等于数值通过，数值通过也不表示业务验收全部完成。数据或契约变化后，固定新版本并重新审视向量，而不是直接复制历史 passed。

报告固定 programCompatibility、businessMath 为 not-evaluated，browserLoading 为 not-run。真实 Node 执行不能替代浏览器模块加载/首包/AB flags 验收，也不证明所有 SDK 函数没有内存问题或长期运行无泄漏。不输出密钥或读取助记词。

## 本轮验收

| 条件 | 结果 |
| --- | --- |
| 真实 WASM | passed；固定 0.9.0-test.2，先通过既有版本/摘要检查，再实例化真实二进制运行全部 12 向量 |
| 独立向量 | passed；Python 重生成与固定 JSON 数据一致；u128 最大值保持精确字符串，溢出与预期一致 |
| 自动测试 | passed；3 组覆盖真实运行/生成复核、非法/重复/错误向量和 SDK 输出、篡改期望、CLI failed 与初始化异常；版本检查原有 4 组测试通过 |
| 证据包 | passed；新增 scope，真实报告 pack/verify 一致；原有证据包 3 组测试通过 |
| 工程与交接 | passed；类型检查、ESLint 零警告、格式/语法、128 个文档本地链接及摘要检查通过；完整前端测试 3014 passed / 1 原有 skipped，退出 0 |

本轮报告观察时间 UTC `2026-10-24T21:49:26.604Z`（北京时间 2026-10-25）。npm/独立产物 WASM 均匹配 `775a7ddb532d6d49a1800a3d8eccca523960d685db8e1800fbd5eb519ed8dd68`。本地 `.local/acceptance/sdk-vectors/` 保存 report.json、regenerated.json、unit.log、evidence-tests.log、pack.json、verify.json、evidence-package/ 及工程日志，其他机器不保证存在；证据包需求标签仅用于演练归档，不表示 FESOL-57 已验收或 Linear 状态改变。

本轮只改验收工具、向量、命令和协作文档，不修改 SDK/前端业务算法。A11 复杂数学需要独立市场/账户/价格输入、容差与协议版本基准，待对应需求推进；不能以本阶段通过替代。

本轮证据包 manifestSha256 为 `0b03efa659071318b77809181d3d84ea382aaaf36166f45e5b42cf6dc20b96fa`；报告的检查器、生成器、向量摘要与最终文件一致。参考的四个 Rust 文件也已逐字节对照记录的 Git 提交，未以未提交源码替代参考。该对照仍不证明 npm 二进制的构建来源。

本轮源码基线 `23e756cea0`，实施中 dirty=true。7 项向量/版本针对性测试、3 项证据包测试通过；完整前端单元测试 299 文件通过、1 原有跳过，3014 tests 通过、1 原有跳过，退出 0。日志仍有既有 happy-dom teardown AbortError，未修改无关依赖。本轮无服务/UI/浏览器/构建/部署或交易操作。
