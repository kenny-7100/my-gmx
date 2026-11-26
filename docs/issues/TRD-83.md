# TRD-83 — Solana 仓位操作与保证金存取

## 协调表状态刷新（2026-11-26）

只读核对仍Sulliven/In Review，实时cycle为Cycle1，修正协调表旧Cycle2。#3335当前`4359c0682f`，OPEN/Ready/CONFLICTING/REVIEW_REQUIRED，六项checks成功；作者仍报告preview手测，不作为本轮独立验收。保证金交付与#3337分开，未改他人业务/PR或验证完整父任务AC。见[三表核验](FESOL-109.md#三表完整刷新2026-11-26-1411北京时间)。

## 与统一交易PR的关系核查（2026-11-23）

本轮只读核验：Linear仍Sulliven/In Review；#3335仍OPEN/Ready、44580914b7、MERGEABLE/REVIEW_REQUIRED、checks成功、无reviews。GitHub compare明确TRD-83当前head在TRD-84 5fa8d01ce8上仅多一笔44580914b7（26文件），不是独立于84的平行实现。新增保证金存取、SOL/WSOL和Price impact接线，修改共享GmsolOrderActionsProvider/buildOrderActions/solanaOrderActions及orderInputs等，后续整合基础改变时需要接续。作者PR记录types/lint/format、19+23定向测试、3559全量测试及manual test通过；本轮未复跑，不据此确认需求全部AC或真实落链/刷新/关闭市场限制通过。

用户已决定新建统一交易PR，Sulliven后续交易整合修改也在统一分支进行，由用户通知；原四PR由用户手动关闭。TRD-83仍不在Divhead点名四PR清单内，不能自动将其全部工作迁入统一PR。建议现在通知整合方向；统一分支可用后，83继续独立交付并接续统一交易基础，共享基础修复优先在统一线完成。暂不改写83/84分支或发送消息。

## 五需求晚间核查（2026-11-23）

参与角色：只读依赖调研。Sulliven已提出正式Ready PR #3335，44580914b7，MERGEABLE、checks成功、Linear In Review；取代上午无PR判断。playground尚未集成，作者测试声明不代替本轮真实存取验收。 版本、证据与验证边界见[统一增量核查](../solana-trading-dependencies.md#五需求晚间增量核查2026-11-23-2130-cst)。本轮未修改业务或外部状态。

## 发布范围与远端实现核查（2026-11-23）

参与角色：依赖与交付风险调研，非实现负责人。实时[Linear](https://linear.app/gmx-io/issue/TRD-83)为Sulliven / In Progress（11月19日起）；正文“implementation assignee still needs to be confirmed”已落后字段，不能继续说无人负责。保证金存取是12月10日首次公开交易必需范围，平仓/edit/cancel另由TRD-84承接。

枚举主仓库全部远端分支发现[TRD-83分支](https://github.com/gmx-io/gmx-interface/tree/TRD-83) head `140cc7295829d0e2a5e4186e657393f6175c8505`，11月20日12:58北京时间提交，比TRD-84 `8818b1d46e`多一笔业务commit。实际delta包含PositionEditor调用depositCollateral/withdrawCollateral、两类零size market订单builder、provider/types、native SOL/WSOL处理、collateralDeposit/Withdrawal开关及定向测试，并把不支持的At price存款单独关闭；不是只建了空分支。当前查询无对应PR，该commit只有两项Pages checks成功，未返回主lint/types/tests检查；本轮未运行测试，不将新增测试源码当作通过。

当前playground `f54ba995d5`的feature配置仍关闭collateralDeposit/Withdrawal，未集成本分支；该分支基于84旧交易前置，仍需作者原线同步当前契约、验证、建立交付PR并验收真实存取/刷新及限制。无PR不证明本地完全未开工，代码存在不证明可公开发布。原线协调时保留Receive tokenInfo、pending与slot刷新接缝，不代改Sulliven分支。

范围历史、全部风险与证据边界见[12月10日审计](FESOL-109.md#12-月-10-日目标范围与交付风险复核2026-11-23-1002-北京时间)。本轮未修改业务、Linear、他人PR或钱包。
