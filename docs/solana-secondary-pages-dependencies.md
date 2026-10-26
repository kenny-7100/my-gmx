# GMTrade 次级页面迁移依赖核验

更新日期：2026-10-26。完整核验表已按用户要求放在根目录：[GMTrade 四个页面完整功能与依赖核验](../gmtrade-pages-dependency-audit.md)。本页保留为原有链接入口，不再维护第二份功能表。

根文档沿用六列：页面 / 功能、旧 GMTrade Web 后端、专用 keeper、SQD、其他前置、是否适合提前推进。覆盖 Stake、GT Points（My / Global / Buyback）、Stats、Referrals，以及公共能力，共 72 个功能/依赖分组；包括弹窗、筛选、排序、分页、辅助选择器和链上操作。

核心结论：四页当前前端均未发现新 gmx-api 直接依赖，但完整页面仍依赖不同旧服务。GT/VIP 当前状态、Global 当前周期、Referral 当前关系和邀请码最容易拆成 RPC 切片；完整质押、回购、历史和市场列表不能当作无外部依赖任务。

本次补核修正了旧粗表中的判断：带 Marin 名称的当前 GLV/mint hooks 消费旧 Web WS，并不证明直接访问独立 keeper；Buyback referenceSlot 来自 GT SQD 水位，不是 RPC getSlot；解押/Claim 需看当前弹窗内联实现；Referral 的 Top GT Holders 和 Buyback Claim Rent 必须单列。具体依赖、源码链接、线上只读证据、未验证范围及 Linear 范围差异均以根文档为准。

服务地址索引见 [GMTrade 当前线上服务地址](gmtrade-live-services.md)。后续实施前仍需核对实时需求范围、PR 覆盖和目标架构，不把本次公开查询通过当作真实钱包/资金流程验收通过。
