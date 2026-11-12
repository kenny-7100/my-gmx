# FESOL-71 — FESOL-56 主网运行条件

2026-11-13（Asia/Shanghai），角色：依赖调研。[Linear](https://linear.app/gmx-io/issue/FESOL-71) 实时状态 Todo，Divhead，无评论。

已读取最新正文：使用开发者自有钱包及小额 SOL/USDC，不再使用共享 GMX seed；参考钱包持有 TP/SL position 和 limit order；检查 ALT authority，未 frozen 则创建 GMX-owned 替代；keeper solanaTrading true，banner key 存在并关闭。FESOL-56 中共享测试钱包的旧说法需按本项更新执行。

本轮没有核验当前链上 ALT authority、钱包余额或线上 flags，没有创建 ALT、改 flags 或发送交易。它阻碍完整主网验收，但不阻碍离线构建/指令校验开发。上下文见 [FESOL-56](FESOL-56.md)。


2026-11-13 补充（角色：FESOL-56 联调）：已从 GMX 主网 RPC 核验两个配置表均 active、有 authority（地址数 73/155），因此当前第三方可变表不符合生产 trust gate；真实 solanaTrading=true。重新实时读取 71 正文仍 Todo、无评论/替代地址。56 已支持 frozen 表，或配置中独立核实并登记预期 authority 的 GMX-owned copies（不要求 copy 必须冻结）；当前 authority map 为空。未创建/修改链上 LUT 或 keeper flags。真实无签名模拟可执行 create/edit/cancel、atomic 和缺失 user/position 准备，但不替代受信任表及四钱包落链验收。详见 [FESOL-56](FESOL-56.md)。
