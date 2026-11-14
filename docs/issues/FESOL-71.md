# FESOL-71 — FESOL-56 主网运行条件

## 上游刷新与证据边界（2026-11-14）

本轮新增事实、契约适配、交付及验收结果见[四需求统一记录](../solana-trading-dependencies.md#四需求上游刷新2026-11-14)，优先于下方历史状态。Linear目标访问返回Entity not found，不能据历史正文或评论判定本轮实时状态；GitHub、源码及部署按统一记录分别核验。


2026-11-13（Asia/Shanghai），角色：依赖调研。[Linear](https://linear.app/gmx-io/issue/FESOL-71) 实时状态 Todo，Divhead，无评论。

已读取最新正文：使用开发者自有钱包及小额 SOL/USDC，不再使用共享 GMX seed；参考钱包持有 TP/SL position 和 limit order；检查 ALT authority，未 frozen 则创建 GMX-owned 替代；keeper solanaTrading true，banner key 存在并关闭。FESOL-56 中共享测试钱包的旧说法需按本项更新执行。

本轮没有核验当前链上 ALT authority、钱包余额或线上 flags，没有创建 ALT、改 flags 或发送交易。它阻碍完整主网验收，但不阻碍离线构建/指令校验开发。上下文见 [FESOL-56](FESOL-56.md)。


2026-11-13 补充（角色：FESOL-56 联调）：已从 GMX 主网 RPC 核验两个配置表均 active、有 authority（地址数 73/155），因此当前第三方可变表不符合生产 trust gate；真实 solanaTrading=true。重新实时读取 71 正文仍 Todo、无评论/替代地址。56 已支持 frozen 表，或配置中独立核实并登记预期 authority 的 GMX-owned copies（不要求 copy 必须冻结）；当前 authority map 为空。未创建/修改链上 LUT 或 keeper flags。真实无签名模拟可执行 create/edit/cancel、atomic 和缺失 user/position 准备，但不替代受信任表及四钱包落链验收。详见 [FESOL-56](FESOL-56.md)。

2026-11-13 再核验（UTC 18:05，角色：地址通讯录专项调查）：实时 Linear 71 仍 Todo、Divhead，无评论；补查 attachments/documents 均空，没有提供替代表地址。实时 49 为 Done，其 [UI#3111](https://github.com/gmx-io/gmx-interface/pull/3111) 于 2026-10-21T22:34:09Z 合并，PR 明确两张表为 provisional，保留 authority，需在交易验收前替换。GitHub release 当前 `src/config/gmsol/lookupTables.ts` 仍为原两张表，文件提交历史只有 2026-10-20 的初始配置提交，未见替换记录。对 interface 全状态 PR 搜索 FESOL-71、lookup table、lookup-table、LUT，以及 gmx-api 的 lookup，未发现提供 GMX-owned LUT 的专用 PR；搜索命中 3120/3163 等不等于 LUT 已交付。链上资源准备也可能不需要独立 PR，因此只能判断未找到已交付证据，不能断言负责人没有线下工作。本次 ALT 工具因既有本地 RPC proxy 不可连接，未取得新的链上快照；以上 active/authority 结论沿用同日先前真实 RPC 证据，不冒充本次重验。后续需 Divhead 提供冻结核验或 GMX-owned copies 的地址和 authority 归属证据，再由 56 更新配置、核对覆盖并重跑交易组合；有限价格 TP/SL 组合曾有 1255-byte 超限，复制/冻结本身不保证解决覆盖问题。


2026-11-13 最后一轮 56 诊断补充：真实表 slot 468760972 的有限价格 increase+TP+SL 为 1255 bytes；检查的固定共享地址均已在现有表，且只有一条 position preparation。不能把包超限简单归因于 71 尚未冻结/复制表，也不能向负责人承诺复制后自然可用。71 负责提供可核实的受信任地址/authority/active 状态与覆盖，56 负责进一步验证实际交易组合及其编码大小；详见 [FESOL-56](FESOL-56.md)。本轮未创建或修改链上表。

## 2026-11-13 独立开发切片实施

角色：调研者：新增atomic合并表可行性证据，没有认领或修改71实现。实施、版本、行为证据与剩余边界见[统一记录](../solana-trading-dependencies.md#独立开发切片实施结果2026-11-13)。未进行真实钱包签名/广播，既有外部验收条件未解除。
