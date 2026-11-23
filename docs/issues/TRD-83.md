# TRD-83 — Solana 仓位操作与保证金存取

## 发布范围与远端实现核查（2026-11-23）

参与角色：依赖与交付风险调研，非实现负责人。实时[Linear](https://linear.app/gmx-io/issue/TRD-83)为Sulliven / In Progress（11月19日起）；正文“implementation assignee still needs to be confirmed”已落后字段，不能继续说无人负责。保证金存取是12月10日首次公开交易必需范围，平仓/edit/cancel另由TRD-84承接。

枚举主仓库全部远端分支发现[TRD-83分支](https://github.com/gmx-io/gmx-interface/tree/TRD-83) head `140cc7295829d0e2a5e4186e657393f6175c8505`，11月20日12:58北京时间提交，比TRD-84 `8818b1d46e`多一笔业务commit。实际delta包含PositionEditor调用depositCollateral/withdrawCollateral、两类零size market订单builder、provider/types、native SOL/WSOL处理、collateralDeposit/Withdrawal开关及定向测试，并把不支持的At price存款单独关闭；不是只建了空分支。当前查询无对应PR，该commit只有两项Pages checks成功，未返回主lint/types/tests检查；本轮未运行测试，不将新增测试源码当作通过。

当前playground `f54ba995d5`的feature配置仍关闭collateralDeposit/Withdrawal，未集成本分支；该分支基于84旧交易前置，仍需作者原线同步当前契约、验证、建立交付PR并验收真实存取/刷新及限制。无PR不证明本地完全未开工，代码存在不证明可公开发布。原线协调时保留Receive tokenInfo、pending与slot刷新接缝，不代改Sulliven分支。

范围历史、全部风险与证据边界见[12月10日审计](FESOL-109.md#12-月-10-日目标范围与交付风险复核2026-11-23-1002-北京时间)。本轮未修改业务、Linear、他人PR或钱包。
