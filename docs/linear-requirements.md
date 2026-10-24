# Linear 需求查阅与复盘

核验日期：2026-10-24。需求入口为 [FESOL 团队](https://linear.app/gmx-io/team/FESOL/all)，线上 Linear 是需求及状态的权威来源。已实现只读工具：单条需求实时查询，全量复盘按需保存本地快照；不做双向同步，也不自动定时执行。

## 后续 Agent 的使用顺序

1. 开始实施某条需求前，用 `show FESOL-编号 --live` 读取最新正文、父任务、双向关系和评论。验收条件保留在原始正文中，不自动解释为已完成。
2. 复盘整体进度时先运行 `sync`，阅读生成的中文摘要，再按项目、状态或关键词筛选；比较历史进度使用 `diff`。
3. 实施是否完成还需核对代码、PR 和部署证据。Linear 的 Done 不代表当前本地分支或线上部署已包含实现。

团队为 Solana Frontend（`FESOL`），UUID 为 `64f06d97-6f54-4d0a-a064-fe7e5f342719`；迁移项目为 GMX and GMTrade Frontend Unification，UUID 为 `7de89d39-ee4e-46d4-9d70-48ef42c87886`，命令中用 `--project migration` 选择。FESOL 同时包含旧项目维护、取消和重复条目，不能将团队总数直接作为迁移完成率分母。

## GMTrade 标签与迁移范围

用户已确认：带 `GMTrade` 标签的需求属于旧 `gmx-solana-interface` 项目。迁移尚未完成，旧项目仍有持续迭代，因此这些需求会与迁移需求共存于 FESOL 团队中。

- 这类需求可用于理解旧项目行为和历史问题，但不是本次 GMX Solana 迁移项目的需求，不计入迁移任务清单或进度统计。
- 查阅、实施或复盘时同时核对标签和项目归属，不能仅凭团队、标题或 Solana 相关内容判断属于迁移范围。旧项目需求不构成向 GMX 自动移植对应功能的授权。
- 若需求同时带 `GMTrade` 标签又归属迁移项目，应先澄清归属，不自动纳入迁移范围。

2026-10-24 最新本地快照中，100 条团队需求有 21 条带 `GMTrade` 标签，均不属于前端统一迁移项目；74 条迁移项目需求均未带此标签。这是核验时状态，不保证之后仍无交集。工具已保存标签，但当前没有标签筛选参数，自动摘要按项目归属统计，复盘时仍需核对标签。

## 配置和命令

工具入口为 [scripts/linear-requirements.mjs](../scripts/linear-requirements.mjs)，只依赖 Node.js 20+ 内置模块，无需安装新依赖。以下命令在仓库根目录执行；也可通过 `yarn linear` 替代 `node scripts/linear-requirements.mjs`。

在线读取需要有 FESOL 读取权限的个人 API key。优先读取环境变量 `LINEAR_API_KEY`，其次读取仓库根目录 `.env.local` 中的同名配置；可用 `--env-file PATH` 指定其他配置文件。只解析该键，不执行文件中的 shell 内容。不在对话、日志或文档中粘贴密钥；新机器需单独配置。缺少凭据或权限时暂停在线工作，请用户处理。

```sh
# Fetch all team issues and publish a dated local snapshot.
node scripts/linear-requirements.mjs sync

# List migration issues from the latest local snapshot.
node scripts/linear-requirements.mjs list --project migration
node scripts/linear-requirements.mjs list --project migration --status Todo
node scripts/linear-requirements.mjs list --search "FESOL-97" --json

# Read cached details or fetch current details with relations and comments.
node scripts/linear-requirements.mjs show FESOL-97
node scripts/linear-requirements.mjs show FESOL-97 --live --json

# Compare two saved snapshots, scoped to the migration project.
node scripts/linear-requirements.mjs diff BEFORE.json AFTER.json --project migration

# Inspect a selected snapshot without network access.
node scripts/linear-requirements.mjs list --snapshot PATH --project migration --json
node scripts/linear-requirements.mjs --help
```

`--status` 精确匹配状态名称或 Linear 状态类型，如 `Todo`、`unstarted`、`completed`；`--search` 对编号、标题和正文做不区分大小写的子串匹配。`--project` 也接受项目原名或 UUID。`--json` 输出结构化结果。离线 `list`、`show` 和 `diff` 不需要凭据。

默认输出目录固定为仓库下的 `.local/linear/FESOL/`，不受调用工作目录影响；`sync/list/show` 可用 `--directory PATH` 改变目录。显式提供的相对路径按调用时的工作目录解析。自定义输出位置需自行确保不会误提交敏感需求内容。

```text
.local/linear/FESOL/
  latest.json
  snapshots/
    <UTC timestamp>-<unique suffix>/
      snapshot.json
      summary.md
```

`latest.json` 指向最后一次完整成功发布的快照，历史快照继续保留；工具不自动清理。默认快照目录及 `.env.local` 已被 Git 忽略，需求正文不会随代码提交。`summary.md` 使用 [中文模板](linear-summary.template.md) 生成，原始标题、正文和状态保留原文。

## 字段、完整性和边界

| 操作 | 覆盖范围 | 不覆盖 |
| --- | --- | --- |
| `sync` | 包含归档项的全部团队需求分页；编号、标题、正文、链接、创建/更新时间、归档/完成时间、优先级、截止日、状态、负责人、项目、父任务、标签返回值 | 阻塞与关联关系、评论、附件内容、关联文档、子任务独立列表；标签子连接未单独分页 |
| `show --live` | 当前需求上述字段；全部出向关系、入向关系和评论分页，包括评论父级 ID | 附件内容、关联文档、子任务独立列表 |
| `diff` | 新增、离开所选范围、字段变化及变化前后值 | 未同步字段变化、代码实现与部署状态判断 |

`relations` 中 `type: blocks` 表示当前任务阻塞 `relatedIssue`；`inverseRelations` 中同类型表示 `issue` 阻塞当前任务。评论保留原文；本次真实样例返回零条评论，尚未用非空线上评论验证。附件链接可能存在于正文或评论中，但不会下载其内容，不能将快照视为完整备份。

快照记录 `startedAt`、`fetchedAt` 和 `coverage`；分页读取不是服务端事务，抓取期间发生的编辑可能跨页反映。全量统计含归档项。摘要和差异均应结合抓取时间解读，不自动推导完成率。限定项目比较时，`removed` 可能表示移出项目；团队全量中缺失也可能源于可见权限变化，不能直接断言已删除。

工具只发 GraphQL 查询，不修改 Linear。`sync` 写入本地快照，其他命令输出到终端。认证失败、限流、网络超时、GraphQL 部分错误、分页重复或游标异常均以非零退出码退出，不发布部分结果，不静默回退旧数据。完整 JSON 和摘要写完后才原子替换最新指针；写入中断可能留下未被指针引用的目录，但不会将其标为最新。失败后处理具体原因并重跑，不把旧快照当成刷新成功。

## 已完成的验收

2026-10-24 使用本机配置的 API key 直接读取 Linear GraphQL，未进行任何线上写入：

- 两次全量读取均真实遍历多个分页，生成 JSON、中文摘要和最新指针。首次为 101 条团队需求，最新一次（北京时间 18:09）为 100 条；迁移项目均为 74 条。
- 查询 FESOL-97：状态 Todo，父任务 FESOL-87；读取 5 条阻塞它的关系、3 条它阻塞的关系及 3 条关联关系，与先前在线核验一致。
- 验证项目、状态、正文关键词筛选、从其他工作目录离线读取及两次真实快照差异比较：FESOL-21 离开当前可见范围，其余条目无字段变化；未据此判定其已被删除。
- 使用内置 Node 测试覆盖分页异常、失败保留旧指针、项目移入移出/归档/状态差异、API 错误与凭据解析；入口为 `yarn test:linear-tools`，5 项测试全部通过。
- 确认默认快照目录和凭据文件被 Git 忽略。未运行 UI 测试、构建或部署。

本机凭据可用不代表其他 Agent 环境已配置。需求数量和状态仅代表核验时刻，后续复盘先重新同步。
