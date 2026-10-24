# Agent 本地 PR 预览定位

更新日期：2026-10-25。对应 A09 浏览器验收入口前置及 A14 预览版本证据，本轮工具已实现。复用 [CI 解析器](../autotests/regression/ci/resolvePreview.cjs)，不修改其选择逻辑、不打开或请求预览页面、不触发构建、部署或 UI 测试。

## 用途与执行顺序

后续 Agent 获准验收 PR 预览前，先确定目标 PR 与预期交付 SHA，再通过本工具读取 GitHub 部署元数据。不能用当前本地 HEAD、共享站点或分支别名代替 PR 交付版本。

主仓库根目录，使用已有 Node 22 与 GitHub CLI（`gh`）执行：

```sh
yarn agent:preview --pr 3138 --expected-sha 33b96d6991763b2fb63c3d4cf59642da215685d7
```

示例 PR/SHA 是本轮观察，新任务需改为实际目标；PR 更新后旧命令会失败。没有预先确定 SHA 时可省略 `--expected-sha`，工具在开始时固定实时 head 并在结束前再次确认 PR 仍开放且 head 未变；这不代表该版本就是任务要求交付的版本，仍需与验收工作表核对。

默认选择 `gmx-interface`，landing 可显式用 `--project gmx-interface-home`，不接受其他项目或任意仓库。固定仓库 `gmx-io/gmx-interface`，GitHub hostname 固定 `github.com`，不自动选择个人 remote。

GitHub 身份复用已配置的 gh；工具不读取根 `.env.local` 或钱包。若缺 CLI、登录、仓库访问权限或 API 配额，命令明确失败，按现有 gh 设置处理；不要把 token 写到命令、日志或文档。需要资源所有者开权限时暂停依赖工作，不绕过鉴权。

## 解析行为与证明范围

本地入口：[scripts/agent-preview.mjs](../scripts/agent-preview.mjs)。它通过 `gh api` 的只读请求为原 CI 解析器提供 pulls.get 和 checks 分页适配，不复制部署选择规则。

- PR 必须开放；可显式要求完整 40 位小写 SHA。读取 head 前后不一致立即失败。
- 读取指定 head、指定 Cloudflare check 名称的全部页，每页 100 条，filter=all。非完整响应、总数变化、重复记录或请求失败明确失败，不把部分页当全量结果。
- 原解析器核对 app 身份、项目、head SHA，只接受最新 check 成功。最新失败/未完成时不回退到旧成功结果。
- URL 必须来自唯一 Preview URL 行，且为对应项目的 8 位十六进制不可变 pages.dev 地址；拒绝分支别名和其他项目链接。部署检查链接限定到该 GitHub 仓库的 runs/actions runs。
- 当前不轮询等待部署，不自动重试；每次 gh 调用超时 30 秒、输出上限 8 MiB。失败后按具体 PR/check 状态处理，等待部署结束或 head 稳定后再显式重跑。

成功退出 0，输出 JSON 包含 checkedAt、仓库、项目、PR 链接/编号、headSha、url、checkUrl、入口与复用解析器源码 SHA-256。固定 `scope: github-pr-preview`、`evidenceType: github-deployment-metadata`、`pageVerification: not-run`。

passed **只证明本次读取的 GitHub 元数据满足选择条件**，不证明页面可访问、资产与声明一致、无缓存异常、功能正确或 Solana flags/钱包已就绪。不可变 URL 是现有解析器接受的部署地址形式，不是对 Cloudflare 内容不可被删除或外部变更的保证。

任意参数、gh、JSON、分页或解析错误退出 1，stderr 输出 preview-resolution-failed，不输出原始 GitHub/子进程错误或输入详情，无成功报告。诊断时先核对 PR/head、指定 check 的最新状态和 gh 访问，再定位分页/summary 格式问题；不得以猜测 URL、旧部署或本地构建绕过失败。

## 归档与后续验收

```sh
mkdir -p .local/acceptance/preview
yarn agent:preview --pr 3138 > .local/acceptance/preview/report.json
```

核对退出码与报告后，将其纳入[证据包](agent-evidence.md)：`--report preview=.local/acceptance/preview/report.json`。原始产物目录被 Git 忽略，其他机器不保证存在，按证据包说明移交。工作表记录 PR、headSha、URL、checkUrl、观察时间和 manifestSha256；PR 更新或部署状态变化后重新解析，不把旧报告自动当新结果。

只有已有浏览器/UI 验收授权时才进入页面验证，将报告 url 用于相应验收命令。当前普通 regression 的 chainId/fixture 仍面向 EVM；本命令不使它自动支持 Solana，也不替代真实钱包扩展、资金/交易授权。A09 Solana 页面流程和 A14 API/SDK/程序与预览整体绑定仍按业务验收条件补齐。

## 本轮验收

| 条件 | 结果 |
| --- | --- |
| 复用原解析器 | passed；CI 解析器源码无修改；已有 7 项测试继续通过 |
| 适配层与分页 | passed；3 组新增测试覆盖跨页、整 100 条、缺页、重复、总数变化、请求失败、输入/预期 SHA 与身份拒绝；含源码身份和 not-run 页面标记 |
| 证据包兼容 | passed；新增 github-pr-preview scope；真实报告打包并 verify 一致，已有证据包 3 组测试通过 |
| 真实只读对照 | passed；PR #3138 head 与独立 PR/check API 请求一致；错误预期 SHA 返回 1，无成功报告 |
| 工程与交接 | passed；类型检查、ESLint 零警告、格式/语法、123 个本地文档链接与源码摘要检查通过；完整前端单元测试 3014 passed / 1 原有 skipped，退出 0 |

本轮实际 head：`33b96d6991763b2fb63c3d4cf59642da215685d7`；Cloudflare check `120425333022`，success；预览 `https://611f1e15.gmx-interface.pages.dev`。这是本轮快照，不是永久入口。

本机 `.local/acceptance/preview/` 保存 report.json、comparison.json、stale-sha.json、pack.json、verify.json、evidence-package/ 及工程日志。证据包演练需求标签只是归档关联，不表示该 PR 覆盖该需求或需求验收完成。本轮没有请求预览站点、运行 UI 或修改业务实现/CI workflow，不修改 Linear。

最终报告观察时间为 UTC `2026-10-24T21:37:18.684Z`（北京时间 2026-10-25）；示例证据包 manifestSha256 为 `a7658e8b2634b4bf709acfdd71f22ca99bba5b64c17ca60884b639c8c3621e74`。已核对报告中的两项源码摘要与最终文件一致，复用 CI 解析器与 HEAD 无差异。

工程验收源码基线 `969c67cbf3`，实施中 dirty=true。完整前端单元测试 299 文件通过、1 原有跳过；3014 tests 通过、1 原有跳过，退出 0。日志仍含既有 happy-dom teardown AbortError，未修改无关依赖或业务实现。新增工具没有读取钱包、启动本地服务或发送交易。
