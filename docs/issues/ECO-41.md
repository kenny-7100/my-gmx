# ECO-41 — GT Buyback 独立 rent receiver

2026-11-25，角色：只读需求解释。实时读取[ECO-41](https://linear.app/gmx-io/issue/ECO-41)、SCSOL-29、ECO-32正文/关系及全部评论。本单仍Triage、未分配实际assignee、无评论/显式blockedBy；正文Owner Orion，triage建议Sulliven不等于分配。标签GMTrade/Frontend，属于旧站GT Buyback，不能混入GMX Solana迁移表。

核心：GtExchange的owner拥有GT Bank payout，记录的rent receiver拥有账户关闭退还的SOL租金，两者可以不同。前端必须按receiver归属统计，不能把他人的租金/账户数算进owner可领取汇总；独立receiver场景不提供会提交旧completion而失败的操作。receiver=owner保留Claim Rent。举例A为owner、B为receiver，则GT Bank payout归A，rent归B。

当前AC是正确归属+防止错误操作，没有要求在本单实现新V2 completion、为B新建完整领取入口或选择自动执行者。SCSOL-29为Done，其正文明确新permissionless completion向owner canonical ATA付GT Bank share、向receiver退rent，旧instruction对不同receiver仍失败；Done不证明线上部署或当前前端SDK已接通。ECO-32为In Review，当前AC仅要求CHANGELOG写明Store/Treasury协调升级及出现独立receiver后不回滚Store；不将这条关联直接当作本单显式硬阻塞。

本轮未查代码/PR合入/合约部署或钱包验收，未修改Linear、认领或实施。历史映射与记录见[FESOL-85](FESOL-85.md)：FESOL-85 → TRD-157 → ECO-41。
