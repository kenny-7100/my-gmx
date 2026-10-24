# <ISSUE> 验收工作表

状态：not-run。本文件是待复制填写的模板，不是执行结果。先阅读[验收流程](../agent-acceptance-workflow.md)，所有占位符替换后再形成有效报告。

## 来源与范围

- 需求：<identifier / title / URL>。
- 线上来源：<fetchedAt / updatedAt / project / labels / relevant comments and relations>。
- 本轮目的与授权：<scope / allowed operations / excluded operations>。
- 基础设施交付状态：<status and scope, or not applicable>。
- 业务需求验收结论：<passed / failed / blocked / not-run / partial>；依据 <row IDs and unresolved conditions>。

## 环境与证据版本

| 项目 | 本次记录 |
| --- | --- |
| 执行时间 | <start / end / timezone> |
| 源码 | <repository / branch / commit / dirty / relevant file hashes or patch> |
| 执行环境 | <Node / test tool versions / OS where relevant> |
| 数据模式 | <unit-mock / sample / local-artifact / live-read / browser / live-transaction> |
| 依赖身份 | <API source vs deployment / SDK and WASM hash / program deployment / network, only as needed> |
| 开关与覆盖 | <real flags / local overrides / test mocks; no secrets> |
| 原始证据 | <location / available locally or shared / retention limitations> |

## 条件映射

逐项覆盖 Scope、Acceptance 和有效补充要求；每行写清可观察的通过标准。复合条件按需拆分，保留未执行的层次。

| ID | 原要求与来源 | 环境/数据与预期 | 执行方法/命令 | 状态 | 证据及证明边界 | 剩余操作 |
| --- | --- | --- | --- | --- | --- | --- |
| R1 | <requirement and source section> | <setup and expected result> | <command or manual steps> | not-run | <evidence ID / no evidence yet> | <next action> |

## 执行记录

| 证据 ID | 时间 | 命令/操作 | 退出码/结果 | 原始产物及摘要 |
| --- | --- | --- | --- | --- |
| E1 | <time> | <exact command from repository root> | <exit code / result> | <path / relevant public hash> |

## 剩余项与接手顺序

| 条件 ID | 原因/缺少资源 | 谁需处理及具体操作 | 何时复验 |
| --- | --- | --- | --- |
| R1 | <not-run / failed / blocked reason> | <next action and owner, if confirmed> | <trigger / invalidated evidence> |

按流程汇总：failed 优先于 blocked；仅全部 required 条件 passed 才能整体 passed，其余明确 partial 或 not-run。工具完成不自动改变业务结论或 Linear 状态。需要新增资源、签名、广播、UI 或构建时先核对已有授权；不因工作表列有该步骤就视为已获授权。
