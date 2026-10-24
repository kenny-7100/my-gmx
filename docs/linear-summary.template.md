# FESOL 需求快照

抓取时间（UTC）：{{fetchedAt}}。

这是只读本地快照，最新需求以 [Linear](https://linear.app/gmx-io/team/FESOL/all) 为准。已遍历包含归档项的团队列表，保存正文和元数据；未同步评论、阻塞关系、附件内容或关联文档。原始需求标题及状态保留原文。

## 团队概览

共 {{total}} 条，含旧项目维护、重复和取消条目，不能直接作为迁移完成率分母。

| 状态 | 数量 |
| --- | --- |
{{allStates}}

## 前端统一项目

GMX and GMTrade Frontend Unification 共 {{migrationTotal}} 条。状态为 Done 不代表当前本地分支或线上部署已包含实现。

| 状态 | 数量 |
| --- | --- |
{{migrationStates}}

| 需求 | 原始标题 | 状态 |
| --- | --- | --- |
{{migrationIssues}}
