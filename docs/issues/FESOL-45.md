# FESOL-45 — 客户端异常采集与上报

2026-11-17，参与角色：按用户授权调整需求范围及状态，未参与本轮代码实现或验收。已通过 Linear skill 更新 [FESOL-45](https://linear.app/gmx-io/issue/FESOL-45)：标题改为 Capture and report client-side errors during intermittent position-closing failures，范围限定为完成客户端异常采集和上报，并标记 Done；负责人仍为 Rainer，保留原标签、优先级和周期。

原需求是解决偶发无法平仓并核验模拟数据、滑块及输入行为。2026-11-02 Kenny 的评论说明当时改动只增加异常采集上报、没有解决根因，原计划继续保持状态等待修复。本次根据用户新的范围决定，在正文明确替代旧评论的完成口径：Done 只表示采集上报范围完成，不证明偶发平仓根因已解决。

后续若客户再次反馈，在 Trading 团队新建 TRD 需求处理具体反馈，并关联 FESOL-45。本轮没有收到新的客户反馈，因此没有提前创建后续需求。只核验 Linear 内容与状态，未核验发布、代码、日志采集效果或根因修复。
