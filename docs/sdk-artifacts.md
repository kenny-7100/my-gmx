# SDK 构建产物准备与过期检查

核验日期：2026-10-26。根类型检查消费 `sdk/build` 中的声明文件，但旧产物未记录对应源码，容易把声明过期误认为业务代码错误。本入口只改开发基础设施，复用现有 SDK 预生成脚本、编译器和 TS 配置，不修改 SDK 业务代码或跟踪的生成文件。

## 使用顺序

工作目录为主仓库根目录，依赖已安装的根及 SDK 锁定依赖、Node 22、Git。无需 RPC、数据库、钱包或凭据。

```sh
yarn sdk:artifacts verify
# Run only when SDK compilation is authorized and verification is blocked.
yarn sdk:artifacts build
yarn sdk:artifacts verify
yarn tscheck
```

`verify` 只读检查，不构建或启动服务。退出 0 / `passed` 表示当前输入与本工具成功构建的来源收据匹配，且完整产物逐文件 SHA-256 相符；缺收据、缺文件、未知格式、过期或损坏均退出 2 / `blocked`。仅有文件存在不视为通过。若需要归档只读结果，可将标准输出重定向到 `.local/acceptance/sdk-artifacts/verify.json`。

`build` 需要明确的 SDK 构建授权，退出 0 表示已完成构建、替换及复核；失败退出 2，查看输出错误及本次日志。不自动安装、修复源文件、构建前端或推送。仅运行 SDK 纯计算测试时仍使用[源码离线回归](sdk-offline-tests.md)，无需构建。

## 隔离与来源记录

实现为 `scripts/sdk-artifacts.mjs`，每次构建创建忽略的 `.local/acceptance/sdk-artifacts/build-*`：

1. 对 SDK `src/`、`scripts/`、SDK package/TS 配置、根与 SDK 锁文件、Yarn 配置、根 `viem-override.d.ts`、本工具源码、Node 版本和已安装 TypeScript/路径转换器实现及 tsx 包元数据计算输入摘要。
2. 在该次临时 CWD 执行原 `sdk/scripts/prebuild/index.ts`，用原 SDK tsx 和显式 tsconfig 解析导入。该脚本按 CWD 输出，因此三个 JSON 只写入临时目录；逐字节比较现有源码中的 JSON，差异时停止，不更新源码。
3. 顺序执行原 TS 配置的声明、CJS、ESM 编译，把输出、声明及增量缓存显式定向到临时目录；保留各阶段日志，单阶段上限 180 秒。按原构建脚本补 CJS/ESM package marker。
4. 核对 v1/v2 必需入口、全部输出和编译前后输入一致性，写入 `.agent-build.json` 收据并验证，随后才替换忽略的 `sdk/build`。旧产物保留在本次目录的 `previous-build/`；替换 rename 失败会恢复旧目录。不要在其他任务正使用 SDK 产物时同时重建。
5. 成功保存 `result.json`。失败或正常 SIGINT/SIGTERM 中断在替换前保留旧产物，并清理构建锁。日志、增量缓存和旧产物均留在本次目录供排障。

构建锁为 `.local/acceptance/sdk-artifacts/build.lock`，避免本工具并发构建。若进程遭 SIGKILL 或机器掉电，先读取锁内 PID 并确认该构建已停止，再移除遗留锁；不能为争抢锁杀掉其他任务。收据与产物一起移动，verify 不会把无来源的新目录当成有效产物。

旧 `yarn build-sdk` 保持原状，仍会执行写入 SDK 源码目录的 prebuild。它不生成这里的收据，重新运行后可能使 verify 因产物变化而拒绝复用；Agent 环境准备优先使用本入口。

摘要用于本地来源与完整性检查，不是安全签名；不能防止收据和产物被共同篡改。锁文件约束依赖版本，但未逐字节验证所有已安装第三方依赖，也不证明运行时、链上或发布兼容性。源码和产物变更后应重新 verify，检查通过不允许后续并发修改。

## 实际验收

2026-10-26，Node v22.17.0：

- 首次 verify 正确拒绝原有无收据产物，未修改它们。
- 三个预生成 JSON 与跟踪源码一致；真实声明/CJS/ESM 编译全部成功，verify 核对 1,090 个产物文件通过。
- 实际对忽略目录执行缺收据、产物损坏、产物缺失及旧来源指纹检查，均返回 blocked / 2，恢复后 verify 通过。
- 编译阶段发送 SIGTERM，构建失败并释放锁，现有产物和收据保持原字节，后续 verify 通过。
- 工具回归 `yarn test:sdk-artifacts` 两组通过：覆盖来源/完整性拒绝组合、替换失败恢复旧产物及正常替换。测试使用临时目录，不改业务源码。
- 新产物下根 `yarn tscheck` 通过。根 `yarn test:ci` 通过：3,014 项通过、1 项既有跳过（299 个测试文件通过、1 个跳过）。日志保留既有 Browserslist 提示与 happy-dom teardown AbortError，本轮未修改相关代码。

本机证据位于 `.local/acceptance/sdk-artifacts/`：构建目录内各阶段日志与 `result.json`，`acceptance.json` 为实际拒绝路径和中断检查，`tscheck.log` 为根类型检查输出。忽略目录不提交，后续机器需要自行构建和验证。
