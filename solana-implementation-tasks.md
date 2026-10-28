# Solana 独立集成实施任务表

更新时间：2026-10-28（Asia/Shanghai）。初始调研基线：`new-gmx` / `solana-integration` 的 `e8015302585f74d632d5fea34c65533d20ab4d2b`；初始调研时线上上游 release 为 `8ef82eb8a465b2045f73805a66941bf7f836630d`。**独立实施分支：`solana-independent-implementation`，从 `new-gmx` 的 `5637a48912114f86df57bb409c1121d60a086070` 开始，后续沿用。前五十五轮累积改动已提交并推送至个人my-gmx：`f6c06b23aaca575df229b17f85ed4e5a58d9fee8`；第五十六轮新增改动尚未提交。** 实时取证范围、PR SHA、架构依据和验收记录见[调研与实施说明](docs/solana-implementation-research.md)。

## 不可违反的实施约束

1. **降低维护成本，统一 GMX 数据流。** gmx-api/keeper/RPC 的链差异在边界适配，进入现有共享模型、StateCtx、业务状态、计算与组件。禁止复制 GMTrade store/hooks/订阅编排或只共享 UI、底下另建业务体系。
2. **保护 EVM。** 保持已有 EVM 默认路径、chainId 含义、SDK 消费兼容及存储格式。Solana 使用 networkId；不得将 -501 注入 EVM 合约配置。只做当前任务必要的抽象，不顺带全局重构。
3. **Linear 全程只读。** 本地任务状态独立维护，不修改线上状态、正文、关系、负责人或评论；完成一个切片不自动完成父需求。
4. **独立尝试与正式交付分开。** 后续可从上述当前状态建立独立集成分支；不自动更新个人开发基础或把整套工具交付上游。正式 PR、push、发布及部署遵守根 AGENTS 和届时授权。
5. 常规技术选择可自主决定；产品/契约歧义、必须新增前端组件或模块、缺失服务资源按根 AGENTS 确认。不得以猜测字段、假数据降级或旧服务兜底绕过门槛。真实签名/广播另需明确授权。
6. 参考旧项目了解资源与可观察行为；旧 nightly 不合并、不 cherry-pick、不照搬。目标前端不直接调用旧 GMTrade Web/keeper，不从浏览器列举钱包的持仓订单。追踪本应用发送的单个订单结果是允许的 RPC 适配职责。

## 读表及状态维护

- **优先级：** P0 为统一架构、EVM 保护及主线前置；P1 为完整 crypto 交易能力与验收；P2 为已要求的扩展功能；P3 为后续市场或发布工作。优先级不覆盖依赖，也不是工期承诺。
- **本地状态：** `待实施`＝本轮证据未发现未完成业务前置（仍需先完成 T00 的启动记录）；`待依赖`＝先完成列出的任务；`待核实`＝当前只能执行该行明确的调查/协调产出，不能直接编码其后续功能；`待资源`＝必须取得实际资源/授权；`已有基础`＝当前基线已含代码，不代表本轮复验；`实施中`＝只完成部分子步骤；`已实施待验收` / `已验收` 按实际证据填写。状态不是 Linear 的映射。
- “依赖”列是本地任务 ID；线上需求逐条对应见文末映射。父子/重复需求归并后只实施一次。任务开始仍实时读取关联需求、评论和 PR；新变化可能撤销当前就绪判断。
- 每行的验收是最低完成条件，并叠加下方通用门槛。任务完成后更新本地状态、实际 commit、证据链接和未覆盖项；未取得真实数据或授权的项目保持受阻，不把“准备好了”记成业务完成。

## 已有基础：保留并复验，不重做

| ID | 优先级 | 本地状态 | 当前可复用内容 | 实施时的边界 / 验收 |
| --- | --- | --- | --- | --- |
| B01 | P0 | 已有基础 | FESOL-46/47/74：AB flag、networkId、网络选择、持久化与占位路由 | 复用 `src/config/chains.ts`、ChainContext、网络菜单；flag 关闭行为及 EVM chainId 不变 |
| B02 | P0 | 已有基础 | FESOL-49：`src/config/gmsol/` token/market/program/LUT 数据 | 不写入 SDK TOKENS/MARKETS；保持 base58 大小写、native SOL 与 WSOL 区别；LUT 静态存在不等于安全可用 |
| B03 | P0 | 已有基础 | FESOL-55/70：lazy WASM、fresh trading flag、import/bundle isolation | 复用现有加载与失败重试；真实 System 包仍被 stub，后续任务显式处理 |
| B04 | P0 | 已有基础 | 个人开发工具：测试发现、执行、浏览器、只读预检、证据与交付范围检查 | 从 `docs/agent-task-start.md` 选最小路径；工具通过不代替功能验收，不继续无目标扩建工具 |
| B05 | P0 | 待核实 | FESOL-62/63/64：API #295 已合并在线 main，真实市场配置/数值已有实现 | 本地 gmx-api 尚未更新；先执行 T04/T10，不能重做真实市场服务或据此宣布线上可用 |

## 第一阶段：保护共享架构，补齐独立基础

| ID | 优先级 | 本地状态 | 明确任务与交付物 | 依赖 / 输入 | 实现入口与范围 | 自动验收及完成条件 | 备注 / 主要风险 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T00 | P0 | 已验收 | 固定独立实施基线、任务记录及 EVM 对照范围 | 本表、当前 HEAD | 后续创建独立分支；记录来源与上游 SHA、目标前端/API 目录；复用现有验收工作表，不建新管理系统 | 列出当前基线与实际测试环境；已有用例、flag-off/on 与 EVM 回归范围可执行；失败如实记录 | 已创建独立分支，基线及可执行验收范围见调研与实施说明；未同步上游 |
| T01 | P0 | 已实施待验收 | 接入既有外部钱包会话实现，保留 EVM 会话 | T00；PR #3110 当前 head | 复用其 lazy bootstrap、Privy solana-only 连接、选中会话、恢复与断开；不从钱包列表任取 owner | V1/V2：flag off 不加载 Solana；连接失败/取消/恢复/切换账户/明确断开；Solana connect 不切 EVM 网络或覆盖 EVM 钱包 | T01.a/b已接会话、lazy启动、solana-only入口、EVM快照/recentConnectorId恢复与现有header/modal断开；定向5文件19项及Chrome开关/网络2项通过。四个真实扩展、MegaETH组合与最终bundle/根类型未验；余额属T12，EVM后台hooks隔离属T02；不修改原PR |
| T02 | P0 | 实施中 | 接入 EVM 隔离与通用地址处理，解决钱包组合冲突 | T01；PR #3120、FESOL-48 最新评论 | 复用 capability/address helpers；Solana modal 在 EVM effects 外挂载；保留钱包 header；关闭余额/TokenPermit eth_getCode；warm switch 恢复 support-chat 属性；保留共享 telemetry | V1/V2：Solana reload 无 EVM RPC；EVM→Solana→EVM 请求与 UI 正确；Settings/支持入口可用；base58 精确、EVM 地址行为不变 | T02.a已接#3120 capability表并隔离钱包按钮/modal的EVM余额hooks及TokenPermit eth_getCode；定向3文件15项、完整前端306文件3048项/1既有跳过、Chrome网络冒烟2项及局部类型/lint/格式通过。T02.b1已拆分共享聊天生命周期与EVM属性、修复重启重发；定向11项/完整3050项/Chrome2项通过。T02.b2已隔离全局EVM providers/effects/receipt poller、Settings与账户统计，支持入口使用选中Solana会话；定向23项、完整3055项/1既有跳过、Chrome含Settings恢复2项通过；应用入口类型仍有22条与上一轮相同诊断。T02.c1已复用SDK地址helper并接最近上架key/筛选/计数，SDK2项、前端24项、完整3056项/1既有跳过、Chrome2项及局部类型通过。c2订单/历史地址已接：SDK8项、完整前端3056项/1既有跳过、Chrome2项及局部类型通过；c3图表/导出/市场/返佣地址消费及datafeed卸载清理已接，定向27项、完整3057项/1既有跳过、Chrome2项及局部类型通过；c4剩余六文件地址及保证金补救入口gate已接，定向50项/完整3058项/Chrome2项通过，局部类型仍有既有诊断；d1交易能力/共享状态门槛已接，定向23项/完整3061项/Chrome2项通过，局部类型仍有既有诊断；d2路由/导航/EVM公告hooks隔离已接，完整3061项/扩展Chrome2项通过，局部类型22条既有诊断；e1 GMX Account状态/空账户查询隔离及迟到回调清理已接，定向11项/完整3065项/Chrome2项及局部类型通过；e2a EVM uiFlags查询/fallback/旧数据隔离已接，定向9项/完整3067项/Chrome2项及局部类型通过；e2b价格隔离/oracle tracker暂停恢复与取消边界已接，定向53项/完整3070项/Chrome2项及局部类型通过；T02.f1已完成无钱包真实请求审计：Solana刷新阶段0捕获EVM RPC，暖切换118项eth_call中确认9项tracker/54项viem主线程调用，另55项无页面CDP栈；65秒窗口末5秒无新增，切回EVM恢复81项RPC；HTML仍预取两链ui-flags。审计模式Chrome2项及regression类型/lint/格式通过；f2a已接共享multicall生命周期，切网取消队列/worker/主线程并阻止旧任务fallback；定向7项、完整3072项/1既有跳过、局部类型/lint/格式及强化审计Chrome2项通过；暖切换仅15项可归因tracker、冷启动0 RPC、切回83项RPC。f2b1启动预取隔离已接并与链选择共用AB判断；定向18项、完整3073项/1既有跳过、局部类型及Chrome2项通过，冷启动/导航0 flags/0 RPC，暖切换15项tracker、切回83项RPC。f2b2已接EVM oracle按代次取消，定向17项/完整3074项/局部类型/Chrome2项通过：warm无ticker/flags GET，仅15项tracker；cold0 RPC/flags，切回104项RPC。f2b3已定位本地缺版本配置，显式真实版本后12次上报200；f3真实账户未完，不宣称零EVM请求 |
| T03 | P0 | 已验收 | 确认共享数据与执行接缝，产出字段/调用方清单 | T00、当前 StateCtx/provider/selectors、已有三 PR diff | 逐项列出 data acquisition、tradebox/settings、计算、sender 的所有权；明确 Solana provider 仅填同一 StateCtx；必要类型增量保持 EVM 默认 | 清单覆盖 TokenData/MarketInfo/PositionInfo/OrderInfo、networkId/account、loading/error/freshness；能指出每个共享消费者及 EVM 专属依赖 | 接缝字段/调用方清单已在调研与实施说明中交付；完成的是调查，尚未改造StateCtx/provider |
| T04 | P0 | a限定核验完成；b待owner评审/真实样本 | 审计最新 API 契约并取得已评审的市场/账户字段表与样本 | FESOL-61/65、API main `bf82ca1`、#295/307、共享 parser | 第二十七轮完成字段表：单位、optional、minima、liquidation、八项OI、inventory、positionValueInUsd、callback/referrer及500/503/freshness；公共市场67项可解析 | 真实市场键配对/28字段类型/OI汇总通过；SDK61项、共享市场请求18项回归通过；不代表链上parity或owner评审 | FESOL-61仍Todo/无评审完成证据；账户main为samples、公共路径404；Divhead需提供评审及真实向量；T13/T18仍受前置约束 |
| T05 | P0 | 已实施待验收 | 实现显式 owner 的原始 SOL/配置 ATA 余额 reader | B02；FESOL-89 | `src/lib/solana/` 单例 RPC 使用中央 URL；exact kit 5.5.1；按 Token/Token-2022 派生 ATA，批量最多 100；返回 bigint | V1：SOL、两种 token program、null、0、超安全整数、错误 owner/mint/program、批量边界；任何 RPC/解码错误拒绝整份快照 | 不依赖 T01 或价格/API；不是非 ATA 资产盘点或 spendability 保证；不得添加公共 RPC fallback；本轮源码/定向16项/完整前端回归通过，产物与真实RPC未验，见第二轮记录 |
| T06 | P0 | 已实施待验收 | 接通 networkId 隔离的存储、缓存与同步路径 | B01；FESOL-90 | 审计 `src/config/localStorage.ts`、`useTradeboxState`、leverage 和相关 SWR key；改实际读写/初始化/同步调用方，保持 EVM 序列化格式 | V1：相同 EVM chainId 下 Solana/Arbitrum 不互相恢复或覆盖；切走切回及延迟结果安全；旧 EVM 偏好可读 | a/b/c代码与存储/SWR清单已实施；本轮共享Settings及tradebox滑点/TWAP实际消费按network隔离，定向42项、完整前端3036项通过/1既有跳过；真实页面/最终产物待验，不宣称父需求完成 |
| T07 | P0 | 已实施待验收 | 实现共享消费者可用的 network-aware token lookup | B02；FESOL-91 | 使用现有静态列表、lazy 载入；显式 network 上下文；native/wrapped/index-collateral 关系和 visual 元数据；未知 mint 明确 unavailable | V1：base58 改大小写不能命中原 mint；SOL/WSOL、collateral twins、scaled metadata、未知 mint 与 EVM 兼容；V0 import boundaries | 共享异步loader返回绑定networkId的同步lookup，动态加载原配置、未知mint为undefined，EVM直接委托原getter；定向17项/导入规则3项/完整前端3037项通过，最终bundle与组件接线待验；不新增registry或T02通用helper |
| T08 | P0 | 已实施待验收 | 实现 SDK 纯单位转换及输入/输出单位表 | 固定 WASM `.d.ts`；FESOL-92 | `sdk/src/utils/gmsol/` 纯 bigint；USD30→20、contract price、原始 token amount、显示倍率分离；规定舍入、符号及范围 | V1：6/8/9/18/24 decimals、0/极值/舍入边界；无 Number 精度损失；EVM 数值不变；无 React/browser/Solana 包 | 源码与157项SDK测试通过；单位表见sdk/src/utils/gmsol/README.md；待SDK构建授权、包子路径及最终根类型检查，不阻塞其他独立切片 |
| T09 | P0 | 已实施待验收 | 将余额 reader 接入现有 SWR 体系 | T05；FESOL-96 | `src/domain/` 中 explicit-owner hook，动态 import reader；统一 networkId+owner key/invalidation；继承 5s/hidden-tab 策略 | V1：无 owner、flag off、EVM 均不读；切账户/网络与迟到响应隔离；loading/error/成功零值区分；mutate 同一 key | 不建立余额平行 store；本轮hook及统一key已实施，定向35项通过；钱包/UI/sender调用未接，bundle/最终根类型待验 |

## 第二阶段：统一数据接入与共享只读页面

| ID | 优先级 | 本地状态 | 明确任务与交付物 | 依赖 / 输入 | 实现入口与范围 | 自动验收及完成条件 | 备注 / 主要风险 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T10 | P0 | 市场HTTP限定通过；版本绑定/浏览器待验 | 确认真实 api-solana 部署身份与访问方式，完成只读探测 | 公共URL已由#305确认：`https://solana.gmxapi.io`；T04 | config/values各67项200且时间/slot推进；Origin头返回ACAO=*；账户三路径被边缘屏蔽404，不解释为empty | main `bf82ca1` 的api-solana-deploy成功，但响应未暴露revision；尚未浏览器CORS/链上parity验收 | 无需再索取URL；需要owner提供服务revision绑定证据；#308仍Open，解除屏蔽不等于真实账户可用；不自行部署 |
| T11 | P0 | 已实施待验收：a/b/c源码已接，真实页面及c正向公告待前置 | 接入已有 keeper adapter，修复隔离后的 banner 消费 | T02已具备本切片隔离；PR #3138 `093d419`、B02、FESOL-50/88及29 | a价格/c flags及b1共享24h沿用；b2原DataFeed可选source、容器lazy接线、symbol/history/订阅生命周期和布局存储隔离，复用同一adapter，无新store/DataFeed | b2定向4文件12项、完整318文件3080项/1既有skip、Chrome2项、局部类型/lint/格式/导入规则通过；三根真实SOL K线HTTP捕获经原parser/adapter/DataFeed消费通过，不等于页面展示 | T13共享市场状态/真实图表、T34个人markers、Depth/overlays/动作仍未完成；两个真实Solana flags待owner配置后补正向banner/交易开关验收；最终bundle/真实交易未验。T12已接共享钱包余额面板，真实验收另列 |
| T12 | P0 | 已实施待验收 | 复用钱包面板显示真实资产及 USD 状态 | T01/T02/T07/T09/T11；FESOL-51/6 | 原Wallet摘要/Available Assets与搜索列表接已有余额SWR、网络lookup、共享价格及USD helper；只读选中会话owner，无新store/UI副本；当前8项原生SOL/非synthetic配置ATA | 定向4文件17项、完整319文件3082项/1既有skip、Chrome2项及原列表scratch/真实Mainnet捕获消费各1项通过；slot462232126的8项余额逐一相符；局部类型/lint/格式/导入规则通过 | 真实扩展钱包连接、桌面/移动面板与preview验收未完；根类型/最终bundle待SDK前置。HTTP捕获消费不等于实时页面验收；EVM原分支保持，父需求未关闭 |
| T13 | P0 | 待依赖 | 将 Solana 市场数据适配到共享 StateCtx | T02/T03/T04/T06/T07/T11 | 按 FESOL-52/97 lazy 数据入口，复用 tradebox/settings/selectors；GmxApiSdk 指定 apiUrl；API_URLS 仍 EVM-only；共享模型保持 30 位精度 | V1/V2：已评审契约可驱动同一 StateCtx；config/values 合并完整性、冻结/过期及 503 明确 unavailable；不挂 EVM trade provider、不触发 RPC fallback；切网偏好保持 | reviewed fixtures 仅显式 dev/test；真实路径不得改 updatedAt；T10 解锁真实验收，不用 fixtures 绕过缺部署 |
| T14 | P1 | 待依赖 | 共享市场选择器、header 和 scaled 显示接线 | T13；FESOL-15/98 | 迁移实际 token 查询；复用 ChartTokenSelector/ChartHeader；搜索分类图标、OI/rates、listing provenance、kBONK/kPEPE/kSHIB | V1/V2；T10 后 V3：切市场、搜索、无数据；无日期不标 New；价格倍率只显示一次；OI/funding/borrowing 对应 API | 最大杠杆最终由 T22 确认计算口径；不因旧 nightly checkbox 已勾选跳过 |
| T15 | P1 | 待依赖 | 共享 Price 图表历史、实时与切市场接线 | T13/T14/T11；FESOL-29/99 | 复用 DataFeed/TVChartContainer、mapped symbol 与现有 interval；统一 whole-token/显示单位 | V1/V2/V3：历史/实时同单位；scaled token、切市场/周期、取消旧订阅与 error；EVM 图表原行为 | 不是新 chart 或旧 Web candle adapter；overlays/actions 在 T29 |
| T16 | P0 | 待依赖 | 补齐真实账户接口的契约/数据前置 | T04；FESOL-65，API owner 外部交付 | 核实 Positions/Orders/User/Store 解码、discount、callback/referrer、kind/filter/key，及共享参考向量；取得实现 PR/部署证据 | V3：明确 owner 的真实记录匹配链上；unlisted/执行未关闭订单语义正确；无账户与服务失败分开；费用/PnL/清算有独立向量 | 当前 main 仍 sample；本表不擅自接管 API owner 的实现。缺交付则阻塞消费者，不能浏览器 RPC 替代 |
| T17 | P0 | 实施中（a/b1/b2a至b2d3限定子集已验收） | 建立 trade-math 差异清单与独立 v0.10.0 参考向量 | FESOL-57、Rust model/program、现有 EVM math | 逐条映射 impact/PnL cap/fee discount/minima/liquidation/funding/execution lamports；记录 generator/tag、单位与容差，供 API/前端共用 | 可重复生成向量；清算按程序规则而非已知错误 WASM status；long/short、抵押组合、极值/舍入覆盖；注明 build 所需授权 | b2d3增24组动态funding/42次update，验证阈值、衰减±1、active min和延迟反转；总199组独立核算/重复一致、70类拒绝和55项EVM回归通过，旧175组不变；见[数学参考](docs/solana-trade-math-reference.md#t17b2d3-动态funding与方向反转子集2026-10-28)。混合抵押OI/单边OI、反转结算/真实付款、减仓/其余矩阵及T19仍待 |
| T18 | P1 | 待依赖 | 共享 PositionList/OrderList 接真实账户数据与设置 | T13/T16/T19；FESOL-25/100 | 复用现有列表；owner:market:collateral:isLong 保留 case；Margin、Size toggle、PnL/leverage 设置、limit/TP/SL 筛选 | V1/V2/V3：字段和 tooltip 可追溯；loading/empty/error 区分；两项显示设置开/关；切钱包迟到响应不污染；fill/cancel 更新 | 不只交付列表壳；隐藏未支持 swap/TWAP；动作在 T26–T28 |
| T19 | P0 | 待依赖 | 实现并接通 opt-in gmsol 交易数学 | T17；T04 确认 per-market 字段 | 共享 SDK math 的最小分支或纯 gmsol helpers：即时 impact、pool-capped acceptable price、side PnL cap、combined discount/UI fee0、minima、清算、lamports 与可退 rent | V1：全部分支对独立向量及原 EVM suite；关键消费者实际接线；同输入 EVM 结果不变；与 API 使用同一参考口径 | 不通过永久调用 WASM math 绕过共享逻辑；不把 gmsol 原始20位值传进共享状态 |

## 第三阶段：交易构建、安全边界与完整闭环

| ID | 优先级 | 本地状态 | 明确任务与交付物 | 依赖 / 输入 | 实现入口与范围 | 自动验收及完成条件 | 备注 / 主要风险 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T20 | P0 | 核实中（离线子集已验；nonce受阻） | 验证固定 WASM ABI、unsigned builder 与组合原子性 | B03、T08；FESOL-56/95 | 对实际 0.9.0-test.2 产物写明显式 blockhash、nonce 能力、market hints、position 存在性、LUT、callback/referrer；运行 builder 并解码最终 bytes | V1：可复现样本固定 hash/来源；列每种动作的交易数量、大小、指令顺序；增加仓位+TP/SL 是否单笔有证据；不支持组合明确失败 | T20.a真实16种case/无及历史LUT已捕获解码，见[ABI核实](docs/solana-builder-abi.md)；组合仅历史LUT+force时三个create同笔，setup另笔；nonce额外字段无效。b1覆盖输入的完整金额/枚举/选项解码及19-case已验，undefined与省略差异已固定；b2 setup/callback/referrer结构已验；显式nonce缺公开SDK能力，b3 native开关/单跳路径/三错误及native组合非原子已验；Token2022/多跳等未覆盖；父任务未完成，必要升级先协调 |
| T21 | P0 | 核实中（源码规则与b2主网样本子集已核实） | 固定 instruction allowlist 与 CPI event 版本契约 | T20 的正向样本、目标 program/IDL；FESOL-93/94、协议 #492 | 产出每种指令 discriminator/accounts/owner/receiver/rentReceiver/LUT 规则，以及 TradeEvent/OrderRemoved envelope/生命周期匹配表 | 正向 fixture 来源可复现；恶意变体清单完整；program/store/order/action id 与 failed meta 规则明确；未知/截断输入拒绝 | 规则任务先于 validator/parser 编码；#492 未合并且不覆盖失败回执，不直接照搬 |
| T22 | P1 | 待依赖 | 接通共享 TradeBox 的预览、校验与能力约束 | T14/T18/T19；歧义部分须 T32；FESOL-19 | 市价/限价增仓、TP/SL、抵押/池选择；调杠杆固定 pay amount；display scaled→native；费用/GT、rent、最大杠杆；Collateral Spread 歧义先确认 | V1/V2：long/short、已有持仓/限价、TP/SL 双向输入；collateral 与 index 同资产按触发价估值；下拉与滑杆最大杠杆一致；Stop Market/TWAP/未支持模式隐藏 | 只接共享 TradeBox，不复制表单；不把预览可用视为可发送 |
| T23 | P1 | 实施中（a1 update/a2 cancel离线通过；create等待续） | 实现支持范围内的 unsigned builders | T08/T20；FESOL-56/95 | `src/domain/gmsol/` lazy WASM；market/limit increase、decrease/TP/SL、update/cancel；position setup 先于引用；统一 app 订单输入 | V1：实际固定 WASM 输出解码验证金额/账户/顺序/LUT；组合单笔与大小限制；异常显式拒绝；无签名和广播 | 不依赖 validator，避免 T23↔T24 循环；cancel referrer 不用错误 IDL PDA 推导 |
| T24 | P0 | 实施中（a1容器/LUT、a2 update、a3 cancel及b1 create参数解码离线通过；完整create待续） | 实现签名前的确定性交易校验 | T21/T23；FESOL-93 | versioned message/LUT 全量解析；准确 allowlist；payer/owner/receiver/rentReceiver、数量、金额及预期动作匹配 | V1：builder 正向样本通过；修改每个关键账户/程序/指令/索引/数量、未知与截断数据均拒绝；任何失败不触达 wallet | 不仅校验 program id；如需真实 System 包，先解决 throwing stub 并验证 EVM/Privy bundle |
| T25 | P0 | 待资源 | 核实主网钱包、LUT、程序版本、费用与交易开关 | FESOL-71/60、现有 CLI/preflight、负责人资源 | 只读确认 network/account、SOL/USDC、可控/frozen LUT、部署指纹；取得真实四钱包访问与后续签名授权；开关由负责人配置 | V3：逐表 authority/地址/有效期有证据；版本固定；钱包满足具体费用；真实 fresh flag 明确 true；资源/授权逐项区分 | 不自行充值、建表、改 keeper flag、签名；本地 override 不能通过主网门槛 |
| T26 | P1 | 待依赖 | 共享动作分发到 Solana sender 并完成提交反馈 | T01/T09/T19/T23/T24；真实执行依赖 T25 | 复用现有提交/通知边界：模拟、SOL费用/rent、fresh flag、选中钱包签名、GMX RPC send/confirm；签前和发送前重查上下文；确认后精确 invalidate | V1/V2：拒签、simulate error、flag false/超时、切网/钱包、过期 blockhash、部分失败恢复与重复提交；原 EVM sender 不变；真实签名走 V4 | 待确认不等于失败，不自动重复付款；提交 toast 不伪报 fill；原子组合遵守 T20 证据 |
| T27 | P1 | 待依赖 | 接通共享平仓/改撤单与 TP/SL 管理的首发范围 | T18/T22/T26/T16；FESOL-59/28 | PositionSeller、OrderEditor、共享确认/通知；部分/全平、trigger close、edit/cancel；保留订单 callback/referrer | V1/V2/V4：金额/滑点/discount 正确；失败可恢复；订单及持仓刷新；不调用 EVM allowance/express；取消权限按协议 | collateral 存取/批量撤单扩展另见 T36，不因本切片完成关闭 FESOL-28 |
| T28 | P1 | 已实施待验收（a/b纯函数离线通过） | 实现事件纯解析与订单结果归约 | T21；FESOL-20/94 | 从显式 metadata/inner instructions/loaded addresses 解析，统一 sending/submitted/executed/cancelled/unresolved；关联 program/store/order/action 生命周期 | V1：failed meta、重复/乱序/缺事件、execute/close 分笔、地址复用、无关订单/动作；不足证据永不变成功 | 纯解析不做另一套 RPC scanner；不依赖 sender，可用可复现 fixture 先做 |
| T29 | P1 | 待依赖 | 接通单订单 RPC 跟踪、两阶段 toast、图表 overlays/actions | T15/T18/T26/T27/T28；历史 marker 还依赖 T34 | 复用现有通知和图表动作；跟踪本应用已发订单，超时保持 pending/unresolved；结果后刷新同一 API/余额 key；overlay 读取共享状态 | V1/V2/V4：sending→sent 与 fulfilling→filled 分开；cancel reason、断线恢复、去重、账户切换；图表平改撤与列表同一流程 | 不列举钱包订单、不接 Corvus；无历史服务时 personal marker 部分保留受阻，不省略原需求 |
| T30 | P1 | 待依赖 | 共享 Depth 图表使用经验证的 Solana 仿真结果 | T13/T19/T22；FESOL-29 | 复用 Depth 组件与控制，按交易量计算 impact/execution price；确认 token/size/price 单位和边界 | V1/V2/V3：long/short、多数量、池流动性/限额、scaled asset；点值与同输入预览一致；EVM 原图不变 | Depth 在需求中明确为上线必需；不能以基础 Price 图完成替代 |
| T31 | P1 | 待依赖 | 完成 crypto 真实集成验收与 EVM 对照 | T10/T12/T14/T15/T18/T22/T27/T29/T30；T25 | 最小真实市场/钱包：读状态→预览→开仓/增仓+TP/SL→keeper→刷新→平仓；限价创建/编辑/撤销；四个外部钱包 | V4：记录每笔签名/回执及 keeper 结果，数值对程序参考；V2 EVM flag off/on 与切网；未支持市场过滤；移动/桌面 | 自动化尽量完成，真实扩展/签名不足时明确待验收；不自行放开生产 flag |

## 第四阶段：完整目标的扩展功能与明确前置

本阶段保留全量有效需求，优先级不等于可以直接编码。`待核实`行的可执行产出是契约/来源/设计确认清单；其后功能必须按解锁条件推进。旧四页的 72 个分组见[依赖审计](gmtrade-pages-dependency-audit.md)，不能把其中“旧前端能直接 RPC”自动变成目标架构决策。

| ID | 优先级 | 本地状态 | 明确任务与交付物 | 依赖 / 输入 | 实现入口与范围 | 自动验收及完成条件 | 备注 / 主要风险 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T32 | P1 | 待核实 | 固定 Trade 产品交接与阶段范围差异 | DES-65、FESOL-5/19/28/31/32、调研冲突表 | 核实已接受 VOB/market Trades、GT rewards、Collateral Spread、manual funding、margin 能力与首发/完整范围；记录决策出处 | 每个歧义有接受结果/负责人或明确阻塞；个人活动不能被市场 Trades 裁剪决策删除 | 不让设计 Backlog 阻止明确的纯基础任务；不自行删除已要求能力 |
| T33 | P2 | 待核实 | 确认历史/统计/收益/GT/推荐/池子进入 GMX 的数据契约 | FESOL-3/30/31/32/79/102/104/105/106；Core/GT SQD schema；四页审计 | 为每类字段列来源、单位、分页/时间范围、完整性、延迟、错误、后端 owner、统一查询接口；记录旧 keeper 编排替代职责 | 所有 72 分组有保留/替代/不适用的可追溯归属；明确缺服务，不把旧 Web WS 或 keeper 新增为目标长期依赖 | 这是契约核实任务；需要新服务、凭据或后端工作则协调，不自行接管或降级 |
| T34 | P2 | 待依赖 | 共享 Trades/个人生命周期历史与图表 marker | T33/T13/T07/T19；FESOL-30 | 沿用现有 trade history 查询、模型、分页筛选导出/position history；增加索引适配；RPNL/费用/impact按 GMX 定义 | V1/V2/V3：创建改撤/成交/保证金/清算，生命周期不串单；分页导出一致；历史折扣正确；无 GT rewards 混入 Trades | 旧 impact-inclusive PnL 不当 RPNL；索引缺事件先明确契约缺口 |
| T35 | P2 | 待依赖 | 共享 Net rate 图表历史接线 | T33/T19；FESOL-32 | 复用现有 rate chart；funding/borrowing/net、方向/符号/年化、时间范围粒度 | V1/V2/V3：同时间样本重算一致；不同市场/窗口及缺历史；EVM 默认不变 | 不是 ticker 当前值伪装历史；DES-65 总体验收保留此项 |
| T36 | P2 | 待依赖 | 扩展共享保证金与批量订单操作 | T27/T32、已确认协议 capability；FESOL-28 | 共用 PositionEditor/批量撤单；margin deposit/withdraw、TP/SL 自动取消刷新；取消 market order 限制 | V1/V2/V4：部分/全量、批次失败、市场关闭、不可取消期；全平/清算后 TP/SL及时更新；无 EVM 等待期套用 | 首发隐藏不等于永久不支持；不提供 TWAP close/At-price margin |
| T37 | P2 | 待依赖 | 接入共享 Claims 的 funding settlement 与 rebate | T32/T33/T19/T26；FESOL-31 | 明确 Settle/Claim 同额同动作、自动结算历史；decrease 超 cap rebate、五天 availability 与 claim | V1/V2/V3/V4：不重复计额、历史时间/状态正确；实际可领取才启用；自动结算与手动操作互不伪报 | 必须取得协议/API/keeper支持，时间经过不自动等于 claimable |
| T38 | P2 | 待核实 | 确认 expanded wallet/transfer/swap 的产品与依赖边界 | FESOL-6/8/33、现有 Privy 项目、System stub | 核实 embedded 是否已有权限/配置、支持资产与 token program、转账费/rent、swap路径/报价、wrap/unwrap规则；产出已确认能力表 | 明确现有订阅能否支持、是否需新资源、需要新增 UI 模块的确认；不自行注册/购买第二项目 | 最新 FESOL-8 提议独立 transfer store 不自动接受，应复用现有生命周期和通知 |
| T39 | P2 | 待依赖 | 接入 Solana embedded 钱包与网络独立恢复 | T01/T02/T38；FESOL-6 | 现有 Privy entry/session 扩展，保留 EVM 与外部会话；仅已确认 login methods | V1/V2/V4：创建/访问/恢复/断开/账户切换；不自动激活另一地址；EVM login不变 | 资源未开通保持 blocked，不采用第二订阅替代 |
| T40 | P2 | 待依赖 | 共享 Receive/Send 原生 SOL 与 SPL | T12/T26/T38；FESOL-8 | 复用 QR/copy/收款视图、共享发送表单及交易反馈；SOL Max 扣 fee/rent；正确 recipient/selected owner | V1/V2/V4：Token/Token2022、无效地址、余额不足、拒签、确认超时、关窗跟踪、重复提交保护与余额刷新 | 新 SolanaWalletSendView 仅在确认无可复用模块且获同意后新增；不另建独立 transfer store |
| T41 | P2 | 待依赖 | 共享 Swap 与 SOL/WSOL wrap/unwrap | T19/T26/T38；FESOL-33 | 现有 Swap 输入/报价/滑点/确认；WSOL→SOL唯一输出、默认 Max；wrap/unwrap 隐藏 swap simulation | V1/V2/V4：报价/fee/impact、限额、成功刷新与失败重试；TWAP不可选；英文按钮按需求本地化 | 不复活取消的测试 UnwrapCard，不接旧 keeper 报价兜底 |
| T42 | P2 | 待依赖 | 共享 Pools 浏览、详情与流动性动作 | T33/T12/T19/T26；FESOL-3 | 现有 Pools/GmList/详情、deposit/withdraw与交易反馈，适配 GM/GLV及合约规则；直链/买入入口 | V1/V2/V3/V4：池估值/fee/preview、持有量、限制/失败、切账户与交易刷新；EVM 原流程 | 缺等价能力或数据字段先确认，不把现有 perps market API当完整LP契约 |
| T43 | P2 | 待依赖 | 共享 Stats 页面按 Solana 模块接线 | T33/T13；FESOL-79 | 现有 Dashboard：Overview/Stats保留统一行为；GMX隐藏badge/Buy，GM与GM Pools用Solana；隐藏Buyback Dashboard | V1/V2/V3：全局与网络级口径分开；网络切换、可用/错误状态、EVM模块不变 | 不迁移旧Stats R2数据流；API #303 只覆盖部分统计，不等于整页完成 |
| T44 | P2 | 待核实 | 固定 Earn/GT/Stake/Referrals 的设计与新模块边界 | DES-88/89/90、FESOL-102/104/105/106；T33 | 取得接受的桌面/移动交接；列可复用组件、新增GT/Stake模块及需用户确认项；区分必需字段和可选历史图 | 设计/模块批准有来源；GT不是GMX资产、staked/unstaked不漏不重计；旧FESOL-1/2/DES-66不再当实现规范 | 没有最终 Figma/接受记录时只交付确认清单，不自行画一套新产品 |
| T45 | P2 | 待依赖 | 将 GT/VIP 与 mint cycle 当前状态接入共享模型 | T33/T44/T07/T09；FESOL-105/104 | 经确认的数据适配器提供Store/User/GT、VIP及combined discount、cycle/current price；复用统一请求/缓存，不搬旧 store | V1/V3：无user/zero/error区分，GT精度、VIP边界/combined折扣、owner切换；与T16折扣一致 | 原始读取可按确认契约分离，但不建立第二个账户真源或多个Store轮询器 |
| T46 | P2 | 待依赖 | GT My/Global 的历史、排行榜及共享展示 | T44/T45/T33；FESOL-105 | 复用现有表格/筛选/分页/弹窗；GT history四类型/聚合、Top1000/code链接、Global当前与可选历史图 | V1/V2/V3：历史分类/聚合、分页本人/邀请码、跨源边界、加载错误；不得猜缺失历史图；仅Solana导航 | GT无等价产品模块，必须先通过T44新增确认 |
| T47 | P2 | 待依赖 | Buyback 状态、提交、结算与可领取 rent | T44/T45/T33/T26；FESOL-105，相关85/SCSOL-29 | 当前season/额度/available/估价/倒计时/个人参与；经确认构建方式提交；按 recorded rent receiver 计算并批量关闭可领取账户 | V1/V2/V3/V4：额度和估计/实际区分；异owner rent receiver不算入claim；refSlot用已确认索引水位；多账户/部分失败与刷新 | 不能迁移旧keeper prepare/submit成长期依赖；新协议未可用则对应动作blocked |
| T48 | P2 | 待依赖 | Stake 只读仓位、APR、奖励与历史 | T44/T45/T33/T42；FESOL-106 | 共享GM/GLV身份与估值；初始值、时长、当前/平均APR、unclaimed；stake/unstake history | V1/V2/V3：claimEnabled/停用/关闭市场、APR阶梯与时间边界；历史两类事件；错误不作空；staked-only资产可见 | 原旧页面依赖WS的gate不迁移；Store/controller与钱包数据统一复用 |
| T49 | P2 | 待依赖 | Stake/Claim/Unstake 单个与批量动作 | T48/T26、T33确认构建契约；FESOL-106 | 共享输入/确认/签名反馈；市场开放限制，领取对后续收益影响，claimDisabled全部解押；成功同步GT/LP/历史 | V1/V2/V4：单多资产/仓位、部分失败、余额及奖励核对、不可操作资产解释；保持不漏不重计 | 旧质押keeper WS编排需确认替代；旧前端每笔3/4仓位限制仅作参考，目标按实际ABI/大小验证 |
| T50 | P2 | 待依赖 | 共享 Earn 的LP与GT组合视图 | T42/T45/T46/T47/T48/T44；FESOL-102 | Portfolio/Discover沿用现有Earn；staked+unstaked GM/GLV、GT+unclaimed、LP lifetime+实际buyback，Manage GT/Stake导航 | V1/V2/V3：staked-only与stake/unstake资产价值连续；跨池不重计；潜在GT值不当实际收益；不显示GMX/GT资产卡 | 先完成统一资产/收益模型再接UI，不新建Earn专用重复数据源 |
| T51 | P2 | 待依赖 | 共享 Referrals 当前关系、创建/绑定及链接 | T44/T45/T26/T33；FESOL-104 | 复用现有入口/表单/通知；create与bind独立，network+owner attribution、GMX新链接与旧链接解析、top holders弹窗 | V1/V2/V3/V4：valid/invalid/self/绑定限制、拒签/成功、跨网不串码；打开链接不自动链上绑定；leaderboard同T46 | 不拷贝旧推荐store或新建独立排行请求体系 |
| T52 | P2 | 待依赖 | Referrals 历史优惠、收益及受邀人视图 | T51/T34/T33；FESOL-104 | 复用Overview时间范围/图表、Affiliate记录/分页；每笔历史VIP+referral真实优惠；GT/quota收益与join/last trade | V1/V2/V3：Core/GT跨时间边界、历史折扣非当前VIP套用、时间筛选与分页、joined与收益窗口语义、无数据/错误 | 两折扣按协议组合，不能相加；后端字段缺失保留受阻 |
| T53 | P3 | 待核实 | 固定 TradFi 价格、会话风险及产品前置 | FESOL-86、ADR-0004、keeper/API负责人 | 逐项确认27个feed V8/V11、订阅/鉴权、marketState/closed参数、法律/地区条件；列实际可用证据和owner | 同名Arbitrum V3不能当等价源；明确需要用户资源与确认项；不访问/采购未授权服务 | 不因当前crypto主线完成自动开启TradFi |
| T54 | P3 | 待依赖 | 在共享市场/计算/交易链路中扩展 TradFi | T53/T31、相应已确认API/keeper能力 | 更新既有列表/两端mint映射、Forex分类、会话指示、off-hours杠杆/清算/限制/警告 | V1/V2/V3/V4：开闭/节假日/时区、只允许的margin操作、pending orders、匹配执行源价格，原crypto/EVM不变 | 不创建另一套TradFi数据流；非crypto及TON/MELANIA/BOME按已确认支持范围逐项准入 |

## 持续验收与发布前工作

| ID | 优先级 | 本地状态 | 明确任务与交付物 | 依赖 / 输入 | 实现入口与范围 | 自动验收及完成条件 | 备注 / 主要风险 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T55 | P0 | 待依赖 | 每个切片执行 EVM、网络隔离与架构自审 | 每个实际变更、T00/T03 | 复用测试发现/规划；检查唯一业务真源、无重复store、shared接口默认EVM兼容、lazy boundary、配置读取；留changed-path清单 | V0/V1，涉及共享UI叠加V2；EVM余额/钱包/交易/图表/存储受影响范围覆盖；未测项清楚，不拿旧CI作新证据 | 贯穿式任务，不等最后才回归；不要求每个纯函数变更都跑全浏览器 |
| T56 | P2 | 待资源 | GMX CI 自建并替换固定SDK产物 | FESOL-72、T20/T31；源码tag/CI/分发方式确认 | 先与负责人确认仓库资产或包分发；可复现构建、hash/provenance、替换固定产物 | V0/V1/V4：新build ABI/数值/安全样本与真实主网流程复验；hash记录，flag off bundle不回归 | 构建/发布/CI写入均按授权；不直接升级到空npm latest |
| T57 | P3 | 待资源 | 正式域名路由、服务监控与升级告警 | FESOL-66/26、真实API/部署owner | 核实catch-all→api-solana，pairs仍原栈；5xx/stale/RPC latency/error、program deploy slot；确认通知渠道 | V3/V5：路由与版本证明，监控真实演练记录；通知协议有出处 | 只能先读/协调，不自行改Cloudflare/Cloud Run/keeper或发送外部消息 |
| T58 | P3 | 待资源 | API 负载、RPC成本与轮询预算验收 | FESOL-67，T16/T57；launch负载与预算负责人 | 记录market/position/order轮询、cache、RPC方法调用；按批准目标和负载测p95及成本 | V5：每项基于实际部署，预算门槛有owner；超过门槛再优化最小范围 | 不擅自对线上压测；不把RPC可连通视为可扩展 |
| T59 | P1 | 待依赖 | 逐模块完成本地交接表与完整范围复核 | 实际完成的任务；FESOL-18/5及全部映射 | 更新本表状态/commit/证据；国际化、desktop/mobile、deep link、flag-off、无旧服务依赖；按模块复核所有AC | V0–V4按范围；原始报告与工作表对应；索引/服务/签名未验明确保留；全量需求不因父子去重而漏项 | 后续正式PR/上线另获授权；不修改Linear，不能用“任务表完成”替代真实验收 |

## 验收配置与执行顺序

| 配置 | 何时使用 | 执行入口与证明范围 |
| --- | --- | --- |
| V0 静态与产物边界 | 每个代码切片按影响范围 | 先按[环境顺序](docs/coding-and-self-review.md#执行前的环境检查与顺序)；SDK产物只读verify后类型检查、定向lint、import规则；已获构建授权时检查实际startup chunks，flag off不加载Solana/WASM；文案走现有Lingui流程 |
| V1 离线行为与数值 | 基础函数、共享状态、协议分支、builder/validator/parser | [前端](docs/frontend-offline-tests.md)、[SDK](docs/sdk-offline-tests.md)、[全栈计划](docs/agent-test-plan.md)复用真实suite；mock数据源而非codec/config；独立参考向量；失败/超时保留原生结果，不关闭网络保护求通过 |
| V2 真实浏览器状态与 EVM 对照 | 路由、共享UI、钱包状态、缓存、订阅、通知 | [浏览器入口](docs/solana-browser-smoke.md)现有两项用例仅验证网络选择；按新增行为增加必要场景。flag off/on、EVM/Solana切换、刷新/直链、迟到请求、desktop/mobile；wallet替身不证明真实扩展签名 |
| V3 真实只读服务/链上核验 | API、价格、余额、历史与显示 | 用已确认部署/版本，选[统一预检](docs/agent-preflight.md)、CLI/keeper/index/runtime/LUT入口；实际消费数据与来源核对。CLI优先用于适合的链上事实。不能用本地sample或HTTP200当正确性证明 |
| V4 真实钱包与业务交易 | 签名、广播、执行、资金/租金/状态 | 先T25与明确交易授权；小额场景逐笔签名、finalized回执、keeper结果、API/余额刷新，四钱包及拒签/失败恢复；复用[交易证据](docs/solana-transaction-evidence.md)。当前本地只读代理禁止send，不绕过其限制 |
| V5 发布/压测/监控 | T57/T58 | 先负责人资源与明确外部操作授权；实际部署版本、负载/成本、告警演练及回滚依据。开发自动验收不能自动授权上线 |


当前接手点：第五十六轮完成 **T17.b2d3 动态funding与方向反转限定子集**。沿用 `solana-independent-implementation`，初始实施基线不变；当前HEAD为已推送的 `f6c06b23aaca575df229b17f85ed4e5a58d9fee8`。本轮开头push前轮9文件，新增仍为未提交工作区改动。新增24组、42次真实update，通过真实增仓改变双边OI，覆盖增长/稳定/阈值相等/衰减保留±1、max/min、零时间、平衡OI保留费率及延迟方向反转；独立核对OI、action、signed rate/active rate及四维delta。总199组两次一致、70类拒绝通过，旧175组不变；本轮EVM55项/0skip/0联网尝试通过。仅工具和文档，无生产SDK/StateCtx/UI接线，页面仍占位。详见[数学主题](docs/solana-trade-math-reference.md#t17b2d3-动态funding与方向反转子集2026-10-28)及[第五十六轮记录](docs/solana-implementation-research.md#第五十六轮实施记录t17b2d3-动态funding与方向反转2026-10-28)。

下一轮优先 **T17.b2d4 不对称混合抵押OI及单边OI funding参考**，复用固定tag真实update/action与同一生成器，先核对单边OI的零delta及rate状态语义；b2d父范围仍未完成，反转后pending/settlement、borrowing kink/skip-smaller-side与累计费用清算边界仍待。随后补减仓/min-position/限额及程序费用退款，不从WASM status生成真值。T17/FESOL-57仍实施中，T19仍待完整矩阵与T04.b reviewed字段。T24.b2接手点保留；T23 nonce、T25资源/交易授权、T04.b评审、T10 revision绑定和T28真实变体/部署身份阻碍不变。Rust及该生成器必要编译已有授权。本轮未重跑真实页面/钱包、根类型/最终bundle，现有服务/用户Chrome未操作，不打开新浏览器。

上一轮T02.f2b3的版本前置及无钱包隔离证据见[第二十六轮记录](docs/solana-implementation-research.md#第二十六轮实施记录t02f2b3-共享上报400与本地版本前置2026-10-28)。T02/f与整个集成仍未完成，f3真实钱包前置及最终SDK产物/根类型/bundle边界不变。

| T02.f子步骤 | 准确状态 | 下一步 / 验收边界 |
| --- | --- | --- |
| f1 无钱包真实请求审计 | 已验收（限定场景） | 新增可选命令`SOLANA_REQUEST_AUDIT=1 yarn solana:browser-check --port 3015`，保留原两项用例；记录脱敏目标/方法/JSON-RPC方法、起止时间、阶段及主线程CDP调用栈；两轮实际采集，不代表真实账户或全业务验收 |
| f2a multicall取消边界 | 已实施并完成本轮限定验收 | 队列/worker/主线程取消、迟到结果与旧信号隔离、正常EVM fallback恢复已离线通过；无钱包真实Chrome两轮确认暖切换仅tracker。真实账户组合仍属f3 |
| f2b1 启动预取隔离 | 已实施并完成限定验收 | 两链预取移至应用早期入口，共用AB/选中网络helper；离线18项及真实Chrome确认冷启动/导航0 flags，EVM启动保留预取、切回读取恢复；不代表通用oracle生命周期完成 |
| f2b2 EVM oracle取消与迟到fallback | 已实施并完成限定验收 | EVM缓存reader与预取捕获切网代次；旧结果/失败/不完整响应拒绝、无额外fallback和endpoint故障；flags续接不借新代，切回EVM正常fallback恢复。定向17项/完整3074项及真实Chrome2项通过；独立reader/共享上报未关闭，不代表真实账户验收 |
| f2b3 共享上报400核对 | 已定位并完成限定复验 | 本地缺VITE_APP_VERSION导致指标省略必需version；显式真实源码版本后12次上报全200，冷Solana event保留-501。诊断只存白名单摘要，不存原始body/错误文本/账户。后续遥测验收先配置目标真实版本，不添加生产兜底；不代表入库/下游分析通过 |
| f3 已连接账户请求审计 | 待真实钱包前置 | 真实EVM钱包重连后Solana reload及暖切换；核对eth_getCode、账户/余额/订阅、四钱包及MegaETH组合，不用无钱包结果替代；不授予签名/广播 |

其余未验范围保持：图表/订单/历史/奖励依赖T13/T16/T18；T11.c已接线并完成真实读取/归因，远端key缺失的正向公告仍待验；移动菜单、真实价格/公告、实际Solana交易页/快捷键、图表marks/订阅计数、聊天和账户数据、四钱包/MegaETH及最终SDK产物/根类型/bundle未验。精确/stats被本地stats.html截获，不删除用户产物。沿用原分支和未提交工作区，无需用户重新选择下一步。

## Linear 覆盖映射

以下保留本轮线上状态，供定位和去重；不参与本地状态自动同步。全部78条迁移项目FESOL需求及5条设计需求均有归属。项目外相关项单列。`历史参考`不进入目标实施清单；`范围核实`意味着先完成指定任务再判断后续编码。

### 迁移项目：78 条 FESOL

| 需求 / 原始标题 | 本轮线上状态 | 本地任务归属 | 范围处理 |
| --- | --- | --- | --- |
| [FESOL-1](https://linear.app/gmx-io/issue/FESOL-1/integrate-gt-points-and-solana-rewards-into-unified-earn) Integrate GT Points and Solana rewards into unified Earn | Canceled | T44/T50 | Canceled；以102/105/106替代，不实现旧规范 |
| [FESOL-2](https://linear.app/gmx-io/issue/FESOL-2/unify-referral-presentation-with-network-specific-attribution) Unify referral presentation with network-specific attribution | Canceled | T44/T51/T52 | Canceled；以104替代 |
| [FESOL-3](https://linear.app/gmx-io/issue/FESOL-3/integrate-solana-pools-and-liquidity-actions-into-gmx) Integrate Solana Pools and liquidity actions into GMX | Backlog | T33/T42 | 完整Pools范围；先确认统一服务契约 |
| [FESOL-4](https://linear.app/gmx-io/issue/FESOL-4/adapt-funding-and-bridging-entry-flows-for-solana-in-gmx) Adapt funding and bridging entry flows for Solana in GMX | Canceled | T38 | Canceled；仅核实有效资金入口，不擅自恢复桥接 |
| [FESOL-5](https://linear.app/gmx-io/issue/FESOL-5/unify-the-solana-trade-page-with-the-gmx-standard) Unify the Solana Trade page with the GMX standard | Backlog | T22/T29/T30/T31/T32/T35/T59 | 整页父需求，不能以切片完成替代 |
| [FESOL-6](https://linear.app/gmx-io/issue/FESOL-6/support-solana-wallet-connections-and-asset-visibility) Support Solana wallet connections and asset visibility | Backlog | T01/T12/T38/T39 | 外部钱包先，embedded阶段单独确认 |
| [FESOL-7](https://linear.app/gmx-io/issue/FESOL-7/integrate-solana-network-selection-and-app-navigation-inside-gmx) Integrate Solana network selection and app navigation inside GMX | Execution | B01/T00/T55/T59 | 保留网络基础，补组合与整体导航验收 |
| [FESOL-8](https://linear.app/gmx-io/issue/FESOL-8/support-receiving-and-sending-assets-on-solana) Support receiving and sending assets on Solana | Backlog | T38/T40 | 按已确认能力接现有钱包面板 |
| [FESOL-9](https://linear.app/gmx-io/issue/FESOL-9/validate-wsol-unwrapping-in-the-internal-test-environment) Validate WSOL unwrapping in the internal test environment | Canceled | T41 | Canceled；不重建旧UnwrapCard |
| [FESOL-11](https://linear.app/gmx-io/issue/FESOL-11/solana-rpc-integration) solana rpc integration | Done | B04/T05 | 旧RPC实验仅参考，不迁移旧env/Helius架构 |
| [FESOL-12](https://linear.app/gmx-io/issue/FESOL-12/gmtrade-backend-integration) gmtrade backend integration | Done | T04/T13/T33 | 历史参考；不实现旧GMTrade服务客户端 |
| [FESOL-13](https://linear.app/gmx-io/issue/FESOL-13/gmsol-sdk-integration) gmsol sdk integration | Done | B03/T20 | 复用固定SDK，旧Done不证明交易ABI可用 |
| [FESOL-14](https://linear.app/gmx-io/issue/FESOL-14/token-metadata-integration) token metadata integration | Done | B02/T07 | 正文不足，核对当前metadata及消费者 |
| [FESOL-15](https://linear.app/gmx-io/issue/FESOL-15/display-solana-markets-in-the-gmx-market-dropdown-and-primary-header) Display Solana markets in the GMX market dropdown and primary header | Todo | T14/T22 | 市场/header显示及最大杠杆口径 |
| [FESOL-16](https://linear.app/gmx-io/issue/FESOL-16/technical-side-candles-technical-solution-alignment) [Technical side] Candles technical solution alignment | Done | T11/T15 | 历史技术结论；不迁移旧Web candle路径 |
| [FESOL-17](https://linear.app/gmx-io/issue/FESOL-17/technical-side-front-end-solana-playground-framework-page) [Technical side] Front-end Solana Playground framework page | Done | 历史参考 | 不重建旧Playground页面 |
| [FESOL-18](https://linear.app/gmx-io/issue/FESOL-18/technical-side-multilingual-alignment) [Technical side] Multilingual alignment | Backlog | T59 | 每个切片同步Lingui；最终全模块复核 |
| [FESOL-19](https://linear.app/gmx-io/issue/FESOL-19/adapt-perp-order-entry) Adapt Perp Order Entry | Todo | T22/T26/T31/T32 | 预览、发送、产品歧义分别落实 |
| [FESOL-20](https://linear.app/gmx-io/issue/FESOL-20/show-solana-market-order-sending-and-filling-status) Show Solana Market Order Sending and Filling Status | Todo | T21/T28/T29 | 提交与keeper执行分两阶段 |
| [FESOL-22](https://linear.app/gmx-io/issue/FESOL-22/technical-side-positions-and-orders-data-presentation) [Technical side] Positions and orders data presentation | Duplicate | T18 | Duplicate；归25，不重复实施 |
| [FESOL-23](https://linear.app/gmx-io/issue/FESOL-23/technical-side-establish-interaction-between-candlestick-charts-and) [Technical side] Establish interaction between candlestick charts and market selectors | Duplicate | T15 | Duplicate；归29/50，不重复实施 |
| [FESOL-24](https://linear.app/gmx-io/issue/FESOL-24/technical-side-following-the-style-of-the-gmtrade-page-add-the-build) [Technical side] Following the style of the gmtrade page, add the `build` class to the `body` element in the gmx project. | Done | T00/T59 | 复用现有build元数据，不重做 |
| [FESOL-25](https://linear.app/gmx-io/issue/FESOL-25/display-solana-positions-and-open-orders) Display Solana Positions and Open Orders | Todo | T18/T19 | 真实列表、设置及数值口径 |
| [FESOL-26](https://linear.app/gmx-io/issue/FESOL-26/ask-gmtrade-for-notice-before-program-upgrades) Ask GMTrade for notice before program upgrades | Backlog | T57 | 依赖负责人及通知渠道授权 |
| [FESOL-27](https://linear.app/gmx-io/issue/FESOL-27/market) Market | Todo | T32 | 空正文；核实后归具体市场任务，不猜新实现 |
| [FESOL-28](https://linear.app/gmx-io/issue/FESOL-28/adapt-solana-position-and-order-actions-to-gmx) Adapt Solana Position and Order Actions to GMX | Backlog | T27/T36 | 首发与完整margin/批量动作分开 |
| [FESOL-29](https://linear.app/gmx-io/issue/FESOL-29/support-solana-price-and-depth-charts-in-gmx) Support Solana Price and Depth Charts in GMX | Todo | T15/T29/T30/T34 | Price/Depth/overlays/个人marker均保留 |
| [FESOL-30](https://linear.app/gmx-io/issue/FESOL-30/support-solana-trades-in-gmx) Support Solana Trades in GMX | Backlog | T33/T34 | 个人完整生命周期与历史服务契约 |
| [FESOL-31](https://linear.app/gmx-io/issue/FESOL-31/support-solana-claims-in-gmx) Support Solana Claims in GMX | Backlog | T32/T33/T37 | 手动settle/claim与旧方案冲突须核实 |
| [FESOL-32](https://linear.app/gmx-io/issue/FESOL-32/support-the-solana-net-rate-chart-in-gmx) Support the Solana Net Rate Chart in GMX | Triage | T33/T35 | 独立历史契约与符号口径 |
| [FESOL-33](https://linear.app/gmx-io/issue/FESOL-33/support-solana-swap-in-gmx) Support Solana Swap in GMX | Backlog | T38/T41 | swap资源与SOL包装范围先确认 |
| [FESOL-41](https://linear.app/gmx-io/issue/FESOL-41/decide-what-the-gmx-app-shows-for-solana-positions-in-markets-it-does) Decide what the GMX app shows for Solana positions in markets it does not list | Done | T04/T13/T16 | 评论已确定未列市场不展示，不重开选择 |
| [FESOL-42](https://linear.app/gmx-io/issue/FESOL-42/connect-external-solana-wallets-through-privy) Connect external Solana wallets through Privy | Test | T01 | 复用PR #3110；四钱包最终实测见T31 |
| [FESOL-46](https://linear.app/gmx-io/issue/FESOL-46/add-the-solana-network-base-ab-flag-network-id-import-rule) Add the Solana network base: AB flag, network id, import rule | Done | B01/T55 | 已有基础，保留flag-off及bundle边界 |
| [FESOL-47](https://linear.app/gmx-io/issue/FESOL-47/select-solana-inside-the-app-behind-solananetwork) Select Solana inside the app behind solanaNetwork | Done | B01/T55 | 已有基础，复验网络选择与恢复 |
| [FESOL-48](https://linear.app/gmx-io/issue/FESOL-48/hide-evm-only-features-on-solana) Hide EVM-only features on Solana | Test | T02 | 复用PR #3120，处理钱包组合问题 |
| [FESOL-49](https://linear.app/gmx-io/issue/FESOL-49/add-the-static-solana-token-market-and-lookup-table-lists) Add the static Solana token, market and lookup-table lists | Done | B02 | 已有静态列表，LUT链上可用性另验 |
| [FESOL-50](https://linear.app/gmx-io/issue/FESOL-50/add-solana-prices-candles-and-the-24h-change-from-gmxs-oracle-keeper) Add Solana prices, candles and the 24h change from GMX's oracle keeper | Review | T11 | 复用PR #3138并补组合缺口 |
| [FESOL-51](https://linear.app/gmx-io/issue/FESOL-51/show-solana-balances-from-the-gmx-rpc) Show Solana balances from the GMX RPC | Execution | T05/T09/T12 | 原始余额→统一缓存→共享面板 |
| [FESOL-52](https://linear.app/gmx-io/issue/FESOL-52/feed-the-solana-trade-state-from-gmx-api) Feed the Solana trade state from gmx-api | Todo | T03/T04/T06/T07/T13 | 同一StateCtx，分清采集与业务状态 |
| [FESOL-53](https://linear.app/gmx-io/issue/FESOL-53/show-solana-markets-header-and-chart-on-the-shared-trade-page) Show Solana markets, header and chart on the shared trade page | Duplicate | T14/T15 | Duplicate；归15/29 |
| [FESOL-54](https://linear.app/gmx-io/issue/FESOL-54/show-solana-positions-and-orders-read-only) Show Solana positions and orders, read-only | Duplicate | T18 | Duplicate；归25 |
| [FESOL-55](https://linear.app/gmx-io/issue/FESOL-55/add-the-gmsol-sdk-as-webassembly-loaded-lazily-and-the-solanatrading) Add the gmsol SDK as WebAssembly, loaded lazily, and the solanaTrading check | Done | B03/T20/T26 | 加载已有，构建/发送另验 |
| [FESOL-56](https://linear.app/gmx-io/issue/FESOL-56/build-check-and-send-solana-order-transactions-with-the-gmsol-sdk) Build, check and send Solana order transactions with the gmsol SDK | Execution | T08/T20/T21/T23/T24/T25/T26 | 单位、ABI、构建、检查、资源及发送 |
| [FESOL-57](https://linear.app/gmx-io/issue/FESOL-57/add-gmsol-branches-to-the-sdk-trade-math) Add gmsol branches to the SDK trade math | Execution | T17/T19 | 独立Rust向量先于math接线 |
| [FESOL-58](https://linear.app/gmx-io/issue/FESOL-58/enter-market-and-limit-orders-with-tpsl-on-the-shared-trade-box) Enter market and limit orders with TP/SL on the shared trade box | Duplicate | T22/T29 | Duplicate；归19与图表交互 |
| [FESOL-59](https://linear.app/gmx-io/issue/FESOL-59/close-positions-edit-and-cancel-orders-on-solana) Close positions, edit and cancel orders on Solana | Todo | T27 | 首发平改撤，不替代28完整范围 |
| [FESOL-60](https://linear.app/gmx-io/issue/FESOL-60/get-the-solana-rpc-keys-and-pick-the-provider) Get the Solana RPC keys and pick the provider | Done | T05/T25/T58 | 资源已取得不证明当前配置/费用/负载可用 |
| [FESOL-61](https://linear.app/gmx-io/issue/FESOL-61/write-the-solana-api-spec-and-sample-responses) Write the Solana API spec and sample responses | Todo | T04/T16 | 市场与账户契约分开核实 |
| [FESOL-62](https://linear.app/gmx-io/issue/FESOL-62/add-the-solana-launch-mode-and-the-api-solana-service) Add the solana launch mode and the api-solana service | Done | B05/T10 | 模式已有，部署身份仍待确认 |
| [FESOL-63](https://linear.app/gmx-io/issue/FESOL-63/map-solana-mints-to-the-arbitrum-oracle-keeper-prices) Map Solana mints to the Arbitrum oracle keeper prices | Todo | B05/T04/T10 | 线上Todo但API #295已合并，先复核不重做 |
| [FESOL-64](https://linear.app/gmx-io/issue/FESOL-64/serve-solana-market-config-and-values-from-the-chain) Serve Solana market config and values from the chain | Todo | B05/T04/T10 | 线上Todo但API #295已合并，部署/parity另验 |
| [FESOL-65](https://linear.app/gmx-io/issue/FESOL-65/serve-solana-positions-and-orders-from-the-chain) Serve Solana positions and orders from the chain | Backlog | T16 | API owner外部前置，main仍sample |
| [FESOL-66](https://linear.app/gmx-io/issue/FESOL-66/route-solanagmxapiio-to-api-solana-and-add-monitors) Route solana.gmxapi.io to api-solana and add monitors | Backlog | T57 | 路由、监控资源与操作授权门槛 |
| [FESOL-67](https://linear.app/gmx-io/issue/FESOL-67/load-check-the-solana-service) Load-check the Solana service | Backlog | T58 | 按批准负载及预算验收 |
| [FESOL-70](https://linear.app/gmx-io/issue/FESOL-70/add-the-build-check-and-import-rules-that-keep-solana-code-out-of-the) Add the build check and import rules that keep Solana code out of the EVM bundle | Done | B03/T55 | 已有bundle/import保护，持续复验 |
| [FESOL-71](https://linear.app/gmx-io/issue/FESOL-71/prepare-mainnet-testing-test-wallet-lookup-tables-ui-flags) Prepare mainnet testing: test wallet, lookup tables, UI flags | Todo | T25 | 钱包/LUT/开关/签名授权分别核实 |
| [FESOL-72](https://linear.app/gmx-io/issue/FESOL-72/build-the-gmsol-sdk-from-v0100-in-gmx-ci-and-replace-the-pinned-build) Build the gmsol SDK from v0.10.0 in GMX CI and replace the pinned build | Backlog | T56 | 未来自建产物不能当当前ABI |
| [FESOL-74](https://linear.app/gmx-io/issue/FESOL-74/add-networkid-next-to-chainid-and-the-stored-solana-selection) Add networkId next to chainId and the stored Solana selection | Done | B01/T06 | networkId已有，实际存储/cache待接 |
| [FESOL-79](https://linear.app/gmx-io/issue/FESOL-79/adapt-the-stats-page-for-solana) Adapt the Stats Page for Solana | Triage | T33/T43 | 完整Stats口径及跨源完整性 |
| [FESOL-86](https://linear.app/gmx-io/issue/FESOL-86/support-solana-tradfi-markets-stocks-fx-and-commodities) Support Solana TradFi markets: stocks, FX and commodities | Backlog | T53/T54 | 后续TradFi；feed/会话/资源先确认 |
| [FESOL-88](https://linear.app/gmx-io/issue/FESOL-88/add-solana-keeper-price-candle-and-24h-data-adapters) Add Solana keeper price, candle and 24h data adapters | Backlog | T11 | PR #3138已有覆盖，不另做adapter |
| [FESOL-89](https://linear.app/gmx-io/issue/FESOL-89/read-raw-solana-wallet-balances-through-the-gmx-rpc) Read raw Solana wallet balances through the GMX RPC | Todo | T05 | 明确独立切片，显式owner原始reader |
| [FESOL-90](https://linear.app/gmx-io/issue/FESOL-90/isolate-solana-trade-cache-and-storage-keys-by-network) Isolate Solana trade cache and storage keys by network | Todo | T06 | 明确独立切片，修改实际读写/同步 |
| [FESOL-91](https://linear.app/gmx-io/issue/FESOL-91/add-network-aware-token-lookup-for-solana-mints) Add network-aware token lookup for Solana mints | Todo | T07 | 明确独立切片，复用现有静态数据 |
| [FESOL-92](https://linear.app/gmx-io/issue/FESOL-92/add-sdk-unit-conversions-for-solana-order-inputs) Add SDK unit conversions for Solana order inputs | Todo | T08 | 明确独立切片，纯bigint转换 |
| [FESOL-93](https://linear.app/gmx-io/issue/FESOL-93/validate-solana-transaction-instructions-and-wallet-accounts) Validate Solana transaction instructions and wallet accounts | Backlog | T21/T24 | 先有实际builder样本与allowlist规则 |
| [FESOL-94](https://linear.app/gmx-io/issue/FESOL-94/parse-solana-order-removal-events-and-execution-states) Parse Solana order removal events and execution states | Backlog | T21/T28 | 先固定事件版本及生命周期规则 |
| [FESOL-95](https://linear.app/gmx-io/issue/FESOL-95/build-unsigned-solana-order-transactions-from-explicit-inputs) Build unsigned Solana order transactions from explicit inputs | Backlog | T20/T23 | 先验证固定产物ABI与组合原子性 |
| [FESOL-96](https://linear.app/gmx-io/issue/FESOL-96/add-a-lazy-solana-balance-hook-with-network-scoped-caching) Add a lazy Solana balance hook with network-scoped caching | Todo | T09 | 仅依赖89，不等USD或连接 |
| [FESOL-97](https://linear.app/gmx-io/issue/FESOL-97/feed-shared-solana-trade-state-from-reviewed-api-fixtures) Feed shared Solana trade state from reviewed API fixtures | Backlog | T04/T13 | 评审fixture仅dev/test，不替代真实验收 |
| [FESOL-98](https://linear.app/gmx-io/issue/FESOL-98/render-solana-market-selector-and-header-from-shared-sample-state) Render Solana market selector and header from shared sample state | Backlog | T14 | 依赖共享契约及token lookup |
| [FESOL-99](https://linear.app/gmx-io/issue/FESOL-99/connect-solana-price-candles-to-the-shared-chart) Connect Solana price candles to the shared chart | Backlog | T15 | 复用keeper与共享chart接线 |
| [FESOL-100](https://linear.app/gmx-io/issue/FESOL-100/render-solana-positions-and-orders-from-reviewed-samples) Render Solana positions and orders from reviewed samples | Backlog | T18 | 依赖共享状态、账户契约及math |
| [FESOL-102](https://linear.app/gmx-io/issue/FESOL-102/support-the-solana-earn-page-in-gmx) Support the Solana Earn Page in GMX | Triage | T44/T50 | 有效新Earn，staked资产不漏不重计 |
| [FESOL-104](https://linear.app/gmx-io/issue/FESOL-104/support-the-solana-referrals-page-in-gmx) Support the Solana Referrals Page in GMX | Triage | T44/T51/T52 | 有效新Referrals，历史优惠按当时实际值 |
| [FESOL-105](https://linear.app/gmx-io/issue/FESOL-105/support-the-solana-gt-points-page-in-gmx) Support the Solana GT Points Page in GMX | Triage | T44/T45/T46/T47 | 有效新GT，确认新模块及服务契约 |
| [FESOL-106](https://linear.app/gmx-io/issue/FESOL-106/support-staking-in-gmx-solana-gt-points) Support Staking in GMX Solana GT Points | Triage | T44/T48/T49 | 有效新Stake，读取与动作分开 |

### 迁移项目：5 条设计需求

| 需求 / 原始标题 | 本轮线上状态 | 本地任务归属 | 范围处理 |
| --- | --- | --- | --- |
| [DES-65](https://linear.app/gmx-io/issue/DES-65/design-the-unified-gmx-trade-interface-and-network-specific-flows) Design the unified GMX Trade interface and network-specific flows | Backlog | T32 | Trade接受交接及争议范围核实 |
| [DES-66](https://linear.app/gmx-io/issue/DES-66/design-gmx-earn-with-gt-points) Design GMX Earn with GT Points | Canceled | T44 | Canceled；由DES-88/89替代 |
| [DES-88](https://linear.app/gmx-io/issue/DES-88/design-the-solana-earn-page-in-gmx) Design the Solana Earn Page in GMX | Backlog | T44/T50 | Earn设计与共享组件边界 |
| [DES-89](https://linear.app/gmx-io/issue/DES-89/design-the-solana-gt-points-page) Design the Solana GT Points Page | Backlog | T44/T46/T47/T48/T49 | GT/Stake交接与新增模块确认 |
| [DES-90](https://linear.app/gmx-io/issue/DES-90/design-the-solana-referrals-page-in-gmx) Design the Solana Referrals Page in GMX | Backlog | T44/T51/T52 | Referrals交接及历史字段口径 |

### 项目外相关项：4 条 FESOL 与 1 条协议前置

| 需求 / 原始标题 | 本轮线上状态 | 本地任务归属 | 范围处理 |
| --- | --- | --- | --- |
| [FESOL-10](https://linear.app/gmx-io/issue/FESOL-10/support-real-time-synchronization-for-the-overflow-and-stats-modules) Support Real-Time Synchronization for the Overflow and Stats Modules on the GMX Stats Page | Execution | T43（仅目标功能） | 项目外旧GMTrade同步任务，不搬旧同步体系 |
| [FESOL-43](https://linear.app/gmx-io/issue/FESOL-43/technical-side-add-solana-gate) [Technical side] Add Solana gate | Canceled | B01 | Canceled；旧domain gate被网络基础替代，不复活 |
| [FESOL-85](https://linear.app/gmx-io/issue/FESOL-85/gt-buyback-handle-a-rent-receiver-different-from-the-exchange-owner) GT Buyback: Handle a rent receiver different from the exchange owner | Triage | T47 | 项目外兼容约束；rent归recorded receiver，旧completion会失败 |
| [FESOL-87](https://linear.app/gmx-io/issue/FESOL-87/independently-deliverable-solana-frontend-slices) Independently deliverable Solana frontend slices | Backlog | T05/T06/T07/T08/T09 | 项目外父队列；5个切片归并，保留原始验收 |
| [SCSOL-29](https://linear.app/gmx-io/issue/SCSOL-29/anyone-can-complete-a-confirmed-gt-exchange-with-rent-returned-to-the) Anyone can complete a confirmed GT exchange, with rent returned to the rent receiver | In Review | T47 | 跨团队前置；协议PR #495仍Open，不视为部署可用 |

### 排除台账：24 条 GMTrade 旧项目需求

以下条目本轮均带 `GMTrade` 标签，且均不属于迁移项目，只用于理解旧项目资源与行为，不计入目标任务，也不因后续旧项目交付而自动判定迁移完成：FESOL-34、35、36、37、38、39、40、44、45、68、69、73、75、76、77、78、80、81、82、83、84、101、103、107。

FESOL-85 当前没有该标签、也没有项目归属，但其 rent receiver 安全语义会影响目标 Buyback，因此仅作为 T47 的兼容性约束收录；不据此把旧 Claim Rent 页面移植进来。标签建议不等于已应用标签。

## 后续 Agent 的更新规则

每次只认领本地明确切片，先重新读取相关实时需求与PR，确认输入/依赖、目标目录和授权。状态按“待实施/依赖解除 → 实施中 → 已实施待验收 → 已验收”更新；发生新外部阻碍则改成待资源/待核实并写出具体解锁条件。不要把现有PR作者或线上负责人改成自己。

在此处追加精简交接记录：日期、任务ID、commit、实际验收证据路径或可共享链接、结果、EVM影响及下一步。原始本机日志放忽略目录；交接必须同时保留可共享摘要，不能只链接本机 `.local`。未获授权不提交、push、创建PR或改变Linear。

| 日期 | 任务 | Commit / 证据 | 结果与下一步 |
| --- | --- | --- | --- |
| 2026-10-27 | 调研与任务分解 | [调研依据](docs/solana-implementation-research.md) | 已完成信息收集与文档；本地链接、任务/列结构、全量需求覆盖与状态、依赖无环检查通过。未实施业务，未执行交易或修改Linear。后续按T00开始 |
| 2026-10-27 | T00 / T03 / T08 | 未提交工作区；基线 `5637a48912`；详见[首轮实施记录](docs/solana-implementation-research.md#首轮实施记录t00--t03--t082026-10-27) | T00/T03记录已验收；T08新增纯单位转换和opt-in包子路径，SDK源码类型/157项离线测试、定向lint通过，前端3014项通过/1既有跳过。T08最终包产物/根类型检查待SDK构建授权；未改EVM业务代码或Linear。下一轮若无构建授权，从T05开始；不重新创建分支 |
| 2026-10-27 | T05 / FESOL-89 | 未提交工作区；沿用 `solana-independent-implementation`，基线不变；详见[第二轮实施记录](docs/solana-implementation-research.md#第二轮实施记录t05原始余额reader2026-10-27) | 新增中央单例RPC及原始SOL/配置ATA reader，无应用caller/store/UI；两种Token程序、精度、缺失/零值、身份校验、100账户分批与失败整次拒绝。最终定向2文件16项通过，完整前端300文件3029项通过/1既有跳过（之后仅合并测试组织，定向复验通过）；局部类型/lint/格式通过。仍待SDK构建后最终根类型/bundle及真实RPC验收；EVM业务代码未改，Linear只读。下一轮T09接入现有SWR。 |
| 2026-10-27 | T09 / FESOL-96 | 未提交工作区；分支/基线不变；详见[第三轮实施记录](docs/solana-implementation-research.md#第三轮实施记录t09共享余额swr2026-10-27) | 新增共享tokens目录的lazy余额hook，复用SWR和TokenBalancesData；统一networkId+owner key，无owner/flag-off/EVM不读，禁用跨key保留旧data。定向4文件35项通过，导入规则3项、局部类型/lint/格式通过；完整前端301文件3031项通过/1既有跳过。未改EVM/SWR配置/存储/Linear，真实钱包/UI/sender和bundle/根类型未验；下一轮T06。 |
| 2026-10-28 | T06.a / FESOL-90 | 未提交工作区；分支/基线不变；见[第四轮记录](docs/solana-implementation-research.md#第四轮实施记录t06a杠杆偏好隔离2026-10-28) | 实际tradebox/seller/Settings调用方按networkId读写杠杆、keep-leverage与slider，复用安全存储hook的opt-in同步读写；EVM key与旧默认模式保持。定向3文件20项、完整前端302文件3033项通过/1既有跳过；局部类型/lint/格式通过。T06父任务实施中，交易选项/advanced/排序缓存及其余共享偏好未完成，下一轮先T06.b；Linear只读。 |
| 2026-10-28 | T06.b / FESOL-90 | 未提交工作区；分支/基线不变；见[第五轮记录](docs/solana-implementation-research.md#第五轮实施记录t06b交易选项与排序缓存隔离2026-10-28) | trade options初始化/恢复/写入/同步按networkId隔离；advanced直接复用同一storedOptions，移除独立state自动写回；排序缓存/ref首帧按network区分。原EVM key、默认chainId调用与深链search保持。定向4文件36项、完整前端302文件3035项通过/1既有跳过，局部类型、零warning lint、格式通过。T06父任务实施中，下一轮T06.c；真实页面、根类型/bundle未验，Linear只读。 |
| 2026-10-28 | T06.c / FESOL-90 | 未提交工作区；分支/基线不变；见[第六轮记录](docs/solana-implementation-research.md#第六轮实施记录t06c共享settings与缓存清单2026-10-28) | 10类共享Settings偏好按networkId实际读写；tradebox滑点/TWAP临时输入同scope重置，迟到回调不改当前网络。保留EVM原key/默认值/旧图标boolean语义，完成相关SWR与EVM专属/全局存储边界清单。定向5文件42项、完整前端302文件3036项通过/1既有跳过，局部类型/零warning lint/格式通过。T06改为已实施待验收，真实页面及根类型/bundle未验；Linear只读。下一轮T07。 |
| 2026-10-28 | T07 / FESOL-91 | 未提交工作区；分支/基线不变；见[第七轮记录](docs/solana-implementation-research.md#第七轮实施记录t07网络感知token-lookup2026-10-28) | 新增networkId绑定的共享lookup入口，Solana配置动态载入、精确匹配与undefined未知值；保留原metadata/native/twin关系，EVM直接委托SDK且不改原调用方。无新registry/store/包依赖。定向3文件17项、导入规则3项、完整前端303文件3037项通过/1既有跳过；局部类型/零warning lint/格式通过。T07已实施待验收，真实selectors/页面/最终bundle未验，Linear只读。下一轮T01。 |

| 2026-10-28 | T01.a / FESOL-42 | 未提交工作区；分支/基线不变；见[第八轮记录](docs/solana-implementation-research.md#第八轮实施记录t01a-会话与启动接线2026-10-28) | 将上游#3110的lazy钱包启动、显式选中会话/恢复/断开和关联EVM保护基础接入WalletProvider；仅新增memo0.10.0 peer，保留EVM默认配置与流程。定向3文件10项（含既有5项EVM连接）通过，完整前端305文件3042项通过/1既有跳过，局部类型/零warning lint/格式/导入规则3项通过。T01父任务实施中：下一轮先T01.b接ConnectModalContext、EVM快照/recentConnectorId恢复、关联connector调用及header/断开；真实扩展/MegaETH组合、页面/bundle与最终根类型未验。Linear只读，无签名、广播或Git写操作。 |

| 2026-10-28 | T01.b / FESOL-42 | 未提交工作区；分支/基线不变；见[第九轮记录](docs/solana-implementation-research.md#第九轮实施记录t01b-连接入口与现有钱包菜单2026-10-28) | 复用#3110接solana-only入口、显式选中会话、EVM快照/recentConnectorId恢复及关联connector记录、现有header/钱包modal复制/explorer/断开；补超时/过期请求和modal scope隔离，保留EVM默认流程。定向5文件19项、完整前端305文件3046项/1既有跳过、真实Chrome开关/网络2项、局部类型、16文件零warning lint/格式、导入规则3项和文档链接通过。T01已实施待验收；四真实扩展、MegaETH组合、preview、最终bundle/根类型未验；下一轮T02隔离EVM后台hooks及RPC。Linear只读，无签名/广播/提交/push。 |
| 2026-10-28 | T02.a / FESOL-48 | 未提交工作区；分支/基线不变；见[第十轮记录](docs/solana-implementation-research.md#第十轮实施记录t02a-钱包余额与-tokenpermits-隔离2026-10-28) | 复用#3120 capability表，隔离钱包按钮/modal的EVM余额hooks与TokenPermits账户分类；切出后迟到签名拒绝且不改原存储，EVM恢复原路径。定向3文件15项、完整前端306文件3048项/1既有跳过、真实Chrome网络冒烟2项、局部类型/零warning lint/格式、导入规则3项及文档链接通过。T02父任务实施中；下一轮T02.b全局providers/effects、Settings、support chat与telemetry，保留T01钱包header/modal；c再接剩余capability/address。真实钱包请求、零EVM RPC、最终根类型/bundle仍未验。Linear只读，无签名/广播/提交/push。 |

| 2026-10-28 | T02.b1 / FESOL-48 | 未提交工作区；分支/基线不变；见[第十一轮记录](docs/solana-implementation-research.md#第十一轮实施记录t02b1-共享支持聊天与-evm-属性隔离2026-10-28) | 复用#3120拆分共享messenger生命周期和EVM属性，AppRoutes仅EVM挂载账户/余额采集；保留原格式/tier/theme/unread逻辑，启动序号跨shutdown单调递增，阻止旧boot快照抢先发送，卸载清理错误上下文。定向2文件11项、完整307文件3050项/1既有跳过、Chrome最终2项、聊天局部类型/lint/格式/导入规则3项通过；首次Chrome初始加载超时不计通过。T02实施中，下一轮b2全局provider/effect、Settings、telemetry与支持可见性；真实聊天/钱包及最终应用类型/bundle未验。Linear只读，无签名/广播/提交/push。 |

| 2026-10-28 | T02.b2 / FESOL-48 | 未提交工作区；分支/基线不变；见[第十二轮记录](docs/solana-implementation-research.md#第十二轮实施记录t02b2-全局-evm-隔离与共享设置2026-10-28) | 隔离全局EVM providers/effects与receipt poller，保留pending列表和共享telemetry/modal；余额context按networkId重挂，Settings能力/迁移写入受控，支持入口使用选中Solana会话且不改EVM历史。定向4文件23项、完整308文件3055项/1既有跳过、Chrome含Settings恢复2项通过；16源码文件lint、17文件格式及导入规则3项通过。App入口类型退出2，22条诊断与上一轮逐字一致，未宣称类型通过。T02仍实施中，下一轮c：capability/address与剩余实际请求审计；真实钱包/聊天、零EVM RPC及最终类型/bundle未验。Linear只读，无签名/广播/提交/push。 |

| 2026-10-28 | T02.c1 / FESOL-48 | 未提交工作区；分支/基线不变；见[第十三轮记录](docs/solana-implementation-research.md#第十三轮实施记录t02c1-共享地址-helper-与最近上架筛选2026-10-28) | 复用#3120的纯SDK地址helper及opt-in包子路径，base58保留大小写，hex key兼容；共享市场最近上架key/筛选/计数接入，保留EVM原地址set兼容。SDK2项、前端定向24项、完整308文件3056项/1既有跳过、Chrome2项，SDK源码/前端局部类型、6源码文件lint、7文件格式及导入规则3项通过。T02仍实施中；下一轮c2收敛订单/历史/图表地址消费、剩余能力与实际请求审计。SDK最终包/根类型/bundle、真实市场/钱包未验；Linear只读，无签名/广播/提交/push。 |

| 2026-10-28 | T02.c2 / FESOL-48 | 未提交工作区；分支/基线不变；见[第十四轮记录](docs/solana-implementation-research.md#第十四轮实施记录t02c2-订单与历史地址消费2026-10-28) | SDK/前端订单过滤、API订单地址转换与历史转换复用同一helper，保留base58、兼容EVM。SDK3文件8项、完整前端308文件3056项/1既有跳过、Chrome2项、SDK/前端实际入口局部类型、7文件lint/格式、导入规则3项通过。T02仍实施中；c3处理图表/其他地址，再收敛capability/banner与实际请求隔离。EVM wrapped-token依赖及真实账户数据待后续接线，不把离线fixture当真实验收。无Linear写入/提交/push/签名/广播。 |

| 2026-10-28 | T02.c3 / FESOL-48 | 未提交工作区；分支/基线不变；见[第十五轮记录](docs/solana-implementation-research.md#第十五轮实施记录t02c3-图表与共享地址消费2026-10-28) | 图表位置key/账户/市场及导出、APY、rate、off-hours、rebates复用同一地址helper；datafeed effect卸载destroy。新增claims导出metadata身份用例，EVM大小写兼容、base58改case不匹配且缺失值不补零。定向5文件27项、完整308文件3057项/1既有跳过、Chrome2项、8文件局部类型/lint/格式及导入规则3项通过。T02仍实施中，c4继续剩余地址消费，再做capability/banner/实际请求隔离；真实图表及零RPC未验，SDK最终产物/根类型/bundle前置不变。无Linear写入/提交/push/签名/广播。 |

| 2026-10-28 | T02.c4 / FESOL-48 | 未提交工作区；分支/基线不变；见[第十六轮记录](docs/solana-implementation-research.md#第十六轮实施记录t02c4-剩余地址消费与保证金入口2026-10-28) | 六文件地址消费复用同一helper，保留池筛选原EVM地址set兼容；两个保证金补救入口接collateralDeposit gate。新增真实池筛选身份用例；定向5文件50项、完整308文件3058项/1既有跳过、Chrome2项、7文件lint/格式及导入规则3项通过。局部类型退出2，仅b2已有useFilterSortPools隐式any诊断，未压制。T02仍实施中，d1继续交易capability与深链门槛，再做页面/banner和后台请求。价格请求未改；真实保证金/数据、零RPC、最终产物/根类型/bundle未验。无Linear写入/提交/push/签名/广播。 |

| 2026-10-28 | T02.d1 / FESOL-48 | 未提交工作区；分支/基线不变；见[第十七轮记录](docs/solana-implementation-research.md#第十七轮实施记录t02d1-交易能力与共享状态门槛2026-10-28) | 交易模式、Swap、持仓桌面/移动、图表StopMarket、保证金编辑/快捷键与深链接入能力表；共享tradebox读取/更新器统一限制恢复出的不支持模式，保持EVM存储及默认行为。定向3文件23项、完整309文件3061项/1既有跳过、Chrome2项、10文件lint/格式及导入规则3项通过；局部类型退出2，仅b2已有两条AddTPSLModal诊断。较早全量运行中止退出130，不计通过。T02仍实施中，d2继续路由/导航/banner，再做后台请求审计；实际Solana表单/菜单/快捷键与零RPC未验，最终产物/根类型/bundle前置不变。无Linear写入/提交/push/签名/广播。 |
| 2026-10-28 | T02.d2 / FESOL-48 | 未提交工作区；沿用原分支/基线；见[第十八轮记录](docs/solana-implementation-research.md#第十八轮实施记录t02d2-路由导航与公告隔离2026-10-28) | 已知EVM页面/未知路径、侧栏导航及EVM公告hooks隔离；共享应用更新和钱包提示保留，EVM路由与公告顺序不变。完整309文件3061项/1既有跳过、源码lint/格式、导入规则3项及扩展Chrome2项通过；类型退出2，22条诊断与b2忽略行号后一致。Chrome首轮被本地stats.html截获失败，最终以/stats/及其他直达/404/旧路由query/切回导航恢复通过；精确/stats与移动操作、真实公告、零RPC未验。T02仍实施中，下一轮T02.e后台请求隔离；SDK产物/根类型/bundle前置不变。无Linear写入、提交、push、签名或广播。 |
| 2026-10-28 | T02.e1 / FESOL-48 | 未提交工作区；分支/基线不变；见[第十九轮记录](docs/solana-implementation-research.md#第十九轮实施记录t02e1-gmx-account-状态与查询隔离2026-10-28) | GMX Account能力限制与空账户订阅隔离；保留EVM选择/存储/key/轮询间隔；停止timer及忽略取消后成功/失败，多链失败保留error而非零。定向2文件11项、完整310文件3065项/1既有跳过、最终Chrome2项、四文件局部类型/lint/格式及导入规则3项通过。完整回归后仅补显式Promise状态收窄，再跑定向/类型/Chrome。真实连接账户及零RPC未验；T02/e仍实施中，下一轮e2 uiFlags/recent prices/oracle tracker，再做实际请求审计。SDK产物/根类型/bundle前置不变；无Linear写入、提交、push、签名或广播。 |
| 2026-10-28 | T02.e2a / FESOL-48 | 未提交工作区；原分支/基线不变；见[第二十轮记录](docs/solana-implementation-research.md#第二十轮实施记录t02e2a-evm-uiflags-查询隔离2026-10-28) | EVM uiFlags的key、持久fallback及输出按选中网络隔离，惰性创建fetcher；EVM原key/存储/relay逻辑保留，迟到成功/失败不向Solana输出。定向2文件9项、完整311文件3067项/1既有跳过、局部类型/lint/格式、导入规则3项、Chrome2项通过。首轮测试未推进SWR动画帧导致7通过/2失败，已修正测试时序并保留证据。真实flags内容、价格/tracker及零EVM请求未验，T02/e/e2仍实施中；下一轮e2b再做实际请求审计。无Linear写入、提交、push、构建、签名或广播。 |
| 2026-10-28 | T02.e2b / FESOL-48 | 未提交工作区；原分支/基线不变；见[第二十一轮记录](docs/solana-implementation-research.md#第二十一轮实施记录t02e2b-价格与-oracle-tracker-生命周期隔离2026-10-28) | EVM价格查询/输出隔离、缓存oracle实例暂停/恢复及metrics订阅去重；共享取消守卫阻止旧probe统计/选择，stop丢弃待执行endpoint变更，原metrics HTTP保留。定向4文件53项、完整313文件3070项/1既有跳过、九文件局部类型/lint/格式、导入规则3项及Chrome2项通过。首轮原oracle测试未隔离fetch，6次网络尝试被保护阻止，保留断言补齐数据源/cleanup后通过。T02/e/e2仍实施中，下一轮T02.f实际reload/暖切换请求审计；真实账户/价格/零RPC、根类型及最终产物待验，无Linear写入、提交、push、构建、签名或广播。 |
| 2026-10-28 | T11.b2 / FESOL-29、88 | 未提交工作区；原分支/基线不变；见[第三十一轮记录](docs/solana-implementation-research.md#第三十一轮实施记录t11b2-原datafeed的solana数据源与生命周期2026-10-28) | 原DataFeed可选source和容器lazy接线，复用原adapter；迟到回调/订阅清理和布局隔离，EVM默认路径/旧key保持。定向12项、完整318文件3080项/1既有skip、Chrome2项、局部类型/lint/格式/导入规则通过，三根真实SOL K线捕获消费通过。真实图表待T13、markers待T34、公告待远端flags；根类型/bundle及真实钱包交易未验。下一轮T12共享钱包面板，无Linear或Git写入。 |
| 2026-10-28 | T12 / FESOL-51、6 | 未提交工作区；原分支/基线不变；见[第三十二轮记录](docs/solana-implementation-research.md#第三十二轮实施记录t12-共享钱包资产与usd接线2026-10-28) | 原Wallet摘要/Available Assets与搜索接既有余额SWR、lookup、价格及USD helper，缺价不汇总部分估值，错误/零/迟到结果隔离，EVM默认路径保持。定向17项、完整319文件3082项/1既有skip、Chrome2项、局部类型/lint/格式/导入规则通过；原列表scratch和真实Mainnet八资产捕获消费各1项通过。真实扩展钱包/移动桌面面板/preview及根类型/bundle待验；下一轮T17.a独立数学差异/向量来源，无Linear写入、提交、push、签名或广播。 |

| 2026-10-28 | T17.a / FESOL-57 | 未提交工作区；原分支/基线不变；见[第三十三轮记录](docs/solana-implementation-research.md#第三十三轮实施记录t17a-交易数学差异与rust向量入口2026-10-28) | 固定v0.10.0提交、本地HEAD/WASM区别，建立九项差异与共享SDK映射、独立向量边界和单位/舍入规则；确认零PnL cap与正impact配置上限差异，复用model/test builders而非新业务体系。源码引用/入口核验与文档检查见轮次证据；未改产品代码，未执行数值/EVM回归、编译或真实交易。T17父任务实施中，下一轮T17.b专用Rust generator/JSON；构建需明确授权，T04.b reviewed字段仍为T19前置。无Linear写入、提交、push或服务启动。 |

| 2026-10-28 | T17.b1 / FESOL-57 | 未提交工作区；原分支/基线不变；见[第三十四轮记录](docs/solana-implementation-research.md#第三十四轮实施记录t17b1-rust生成器首个子集2026-10-28) | 新增固定协议commit专用Rust generator源码及43组显式输入；费用/positive impact cap/position PnL直接调用model，输出设计含来源指纹，未引入生产依赖。TOML/输入/14个源码入口静态核验通过，原SDK fees/positions两文件55项/0skip通过、0联网、清理通过。缺Rust工具链及构建授权，尚无lock/编译/生成JSON/独立数值验收；T17父任务实施中。下一轮先解锁b1验收，再补动作与清算等子集；无Linear/参考仓库写入、提交、push、签名或广播。 |

| 2026-10-28 | T20.a / FESOL-56、95 | 未提交工作区；原分支/基线不变；见[第三十五轮记录](docs/solana-implementation-research.md#第三十五轮实施记录t20a-固定wasm-builder与分包核实2026-10-28) | 新增固定WASM离线probe、共享六组unsigned bytes和来源；无/历史LUT各16case真实输出，v2 IDL匹配、setup/分包/nonce限制已核实。Node原生4项/0skip通过、0联网；三个脚本lint/四文件格式/文档链接及diff检查通过。未改生产EVM/SDK，未重跑EVM业务/前端全量；不借前轮55项作本轮回归。T20父任务核实中，下一轮b金额/枚举解码与nonce/setup/选项边界；历史LUT不解锁T25，真实主网/交易未验；T17.b1工具链/构建授权仍待。无Linear写入、提交、push、构建、签名或广播。 |

| 2026-10-28 | T20.b1 / FESOL-56、95 | 未提交工作区；原分支/基线不变；见[第三十六轮记录](docs/solana-implementation-research.md#第三十六轮实施记录t20b1-order-v2参数解码2026-10-28) | 三种order v2参数完整解码，无/历史LUT各19case，新增short/大整数/零与缺省/update全选项共享bytes；amount/min_output显式undefined拒绝已验证。原生5项/0skip、0联网、lint/格式/fixture摘要重解码和文档链接通过。未改生产EVM/SDK，未重跑EVM业务/前端全量；父任务仍核实中，下一轮b2 nonce公开入口/setup及非空选项边界。T17工具链/构建授权仍待；无Linear写入、提交、push、构建、签名或广播。 |

| 2026-10-28 | T20.b2 / FESOL-56、95 | 未提交工作区；原分支/基线不变；见[第三十七轮记录](docs/solana-implementation-research.md#第三十七轮实施记录t20b2-noncesetup与callbackreferrer2026-10-28) | 固定SDK无公开可控nonce入口，需SDK能力解锁；23case无/历史LUT真实bytes，setup顺序/position地址、非空callback三动作及close referrer PDA已验，新增四组共享样本。原生5项/0skip、0联网、lint/格式/fixture及文档检查通过；未改生产EVM/SDK，未重跑EVM业务/前端全量。T20仍核实中，下一轮b3 WSOL/路径/失败与大小；真实账户/主网等未验。无Linear写入、提交、push、构建、模拟、签名或广播。 |

| 2026-10-28 | T20.b3 / FESOL-56、95 | 未提交工作区；分支/基线不变；见[第三十八轮记录](docs/solana-implementation-research.md#第三十八轮实施记录t20b3-nativeswap路径与失败边界2026-10-28) | 31case无/历史LUT真实运行，native Transfer/Sync/开关、单跳路径PDA、第三swap枚举及三错误拒绝；native组合有无callback均非原子，新增八组bytes。原生5项/0skip、0联网、lint/格式/fixture/文档检查通过；无生产EVM/SDK改动，未重跑EVM业务/前端全量。nonce仍受SDK能力阻碍，主网待验；下一轮T21.a现有正向样本的allowlist契约。无Linear写入、提交、push、构建、模拟、签名或广播。 |

| 2026-10-28 | T21.a / FESOL-93、56 | 未提交工作区；分支/基线不变；见[第三十九轮记录](docs/solana-implementation-research.md#第三十九轮实施记录t21a-指令与账户契约2026-10-28) | 21case/27笔/10种指令库存与固定IDL账户/参数契约；权限并集/optional sentinel、金额/收款/LUT/setup/原子性和恶意变体规则已固定。原生5项/0skip、0联网、库存/契约再生成、lint/格式/文档检查通过。无生产EVM/SDK改动，未重跑EVM业务；validator、恶意fixture、prepare_position严格decoder及真实业务待验。T21仍核实中，下一轮b事件版本；无Linear写入、提交、push、构建、模拟、签名或广播。 |

| 2026-10-28 | T21.b1 / FESOL-94、20 | 未提交工作区；分支/基线不变；见[第四十轮记录](docs/solana-implementation-research.md#第四十轮实施记录t21b1-事件布局与生命周期源码契约2026-10-28) | 四事件/15类型的固定IDL生成物、CPI前缀/authority与生命周期匹配规则完成；PR#492精确head源码只读核对，未采用scanner。再生成、独立布局/前缀/摘要核对、0联网、lint/格式/文档通过，无生产EVM/SDK改动、未重跑EVM业务。T21仍核实中，下一轮b2捕获真实Mainnet回执/版本，parser/reducer/真实业务仍待；无Linear写入、提交、push、构建、模拟、签名或广播。 |

| 2026-10-28 | T21.b2 / FESOL-94、20 | 未提交工作区；分支/基线不变；见[第四十一轮记录](docs/solana-implementation-research.md#第四十一轮实施记录t21b2-历史mainnet事件回执子集2026-10-28) | 两单四份真实finalized v0回执共享落盘，五事件完整固定IDL解码；action/store/owner/market及LUT/index/hash核对。取消state Cancelled/reason executed反例已保留；reader3项、离线独立Python/Node复核、格式/文档/diff通过。无产品代码改动，未跑EVM业务。T21父项及真实变体/部署源码身份仍待；下一轮T28.a纯decoder，归约后续。无Linear/Git写入、服务启动、模拟、签名或广播。 |

| 2026-10-28 | T28.a / FESOL-94、20 | 未提交工作区；分支/基线不变；见[第四十二轮记录](docs/solana-implementation-research.md#第四十二轮实施记录t28a-纯ts严格事件解码器2026-10-28) | 纯TS decoder/最小固定布局，meta/索引/CPI/完整Borsh检查，BigInt/None及作用域保留；四真实回执五事件完整对照。最终6项/0skip、局部strict类型/零warning lint、3项导入边界、格式/文档通过，0联网且清理正常。无生产消费者或EVM源码改动，未跑EVM业务/根类型/bundle；T28仍实施中，下一轮b离线生命周期归约，真实变体/部署身份/钱包业务仍待。无Linear/Git写入、服务启动、构建、模拟、签名或广播。 |

| 2026-10-28 | T28.b / FESOL-94、20 | 未提交工作区；分支/基线不变；见[第四十三轮记录](docs/solana-implementation-research.md#第四十三轮实施记录t28b-纯离线生命周期归约2026-10-28) | 纯离线归约器消费固定decoder，显式创建/完整区间/链顺序和action scope，分别保留submission/execution/closure；重复、冲突、分笔、复用地址、缺事件、same-slot及swap结构变体验证。最终2文件11项/0skip、局部strict类型/零warning lint、3项导入规则通过，0联网/cleanup passed。无EVM/SDK或生产接线，未跑EVM业务/根类型/bundle；T28已实施待真实验收，T21真实变体/部署身份仍待。下一轮T23.a unsigned builder适配就绪核验，nonce等阻碍不绕过；无Linear/Git写入、构建、模拟、签名/广播。 |

| 2026-10-28 | T23.a1 / FESOL-56、95 | 未提交工作区；原分支/基线不变；见[第四十四轮记录](docs/solana-implementation-research.md#第四十四轮实施记录t23a1-单订单unsigned-update2026-10-28) | 单订单unsigned update接原lazy固定WASM与T08转换，快照显式输入，单笔/LUT/unsigned/payer/blockhash后置检查并释放group；真实fixture完整指令语义、三kind单位/0/None与异步输入隔离通过。最终3文件9项/0skip、局部strict类型/零warning lint、3项导入规则通过，0联网/cleanup passed。无EVM/SDK或生产接线，未跑EVM业务/根类型/bundle。T23父项实施中，下一轮a2 cancel；create/组合及nonce缺能力、当前LUT/钱包业务验收仍待，无Linear/Git写入、构建、模拟、签名/广播。 |

| 2026-10-28 | T23.a2 / FESOL-56、95 | 未提交工作区；原分支/基线不变；见[第四十五轮记录](docs/solana-implementation-research.md#第四十五轮实施记录t23a2-单订单unsigned-cancel2026-10-28) | 单订单unsigned cancel，显式receivers/referrer钱包/callback/token/unwrap输入；与update共用结构检查，await前快照、finally释放group。真实WASM完整fixture指令语义、独立referrer PDA、native输出与接收方/异步隔离通过；最终3文件11项/0skip、局部strict类型/零warning lint、3项导入规则通过，0联网/cleanup passed。无EVM/SDK/生产接线；未跑EVM业务/根类型/bundle。T23仍实施中，nonce等既有阻碍不变；下一轮T24.a update/cancel限定validator，不完成create校验或父需求。无Linear/Git写入、构建、模拟、签名/广播。 |

| 2026-10-28 | T24.a1 / FESOL-93、56 | 未提交工作区；原分支/基线不变；见[第四十六轮记录](docs/solana-implementation-research.md#第四十六轮实施记录t24a1-unsigned-v0容器与lut解析2026-10-28) | unsigned v0严格容器/LUT解析：canonical、空签名与预期payer/blockhash/header、账户权限来源、缺/重复/越界/别名拒绝。最终4文件14项/0skip、局部strict类型/零warning lint、3项导入边界通过，0联网/cleanup passed。仅parsed，不授权签名；无EVM/SDK/生产接线，未跑EVM业务/根类型/bundle。T24仍实施中，下一轮a2 update动作语义/权限并集，之后cancel；create/nonce及真实业务前置仍待，无Linear/Git写入、构建、模拟、签名/广播。 |

| 2026-10-28 | T24.a2 / FESOL-93、56 | 未提交工作区；原分支/基线不变；见[第四十七轮记录](docs/solana-implementation-research.md#第四十七轮实施记录t24a2-单订单update动作校验2026-10-28) | 单订单update精确allowlist/顺序/十账户、独立PDA、完整五参数/None/0、显式compute与全局权限；输入快照避免Buffer别名与await污染。最终五suite17项/0skip、0联网/cleanup passed、局部strict类型/零warning lint/3项导入规则通过。无EVM/SDK/共享状态或生产接线，EVM业务/根类型/bundle及真实链上未验；T24仍实施中，下一轮a3 cancel，create/组合仍待T23/nonce。无Linear/Git写入、构建、模拟、签名或广播。 |

| 2026-10-28 | T24.a3 / FESOL-93、56 | 未提交工作区；原分支/基线不变；见[第四十八轮记录](docs/solana-implementation-research.md#第四十八轮实施记录t24a3-单订单cancel动作校验2026-10-28) | 单订单cancel精确预算/ATA准备/close、30账户与独立PDA、cancel参数及权限并集；同mint/native合法别名与输入快照，预算helper与update共用，parser独立Uint8Array。最终6文件20项/0skip、0联网/cleanup passed、局部strict类型/零warning lint/3项导入规则通过。无EVM/SDK/共享状态或生产接线，EVM业务/根类型/bundle及真实链上未验；T24仍实施中。下一轮b1 create/prepare_position严格参数解码，不绕过T23/nonce及完整账户校验前置。无Linear/Git写入、构建、模拟、签名或广播。 |

| 2026-10-28 | T24.b1 / FESOL-93 | 未提交工作区；原分支/基线不变；见[第四十九轮记录](docs/solana-implementation-research.md#第四十九轮实施记录t24b1-create与position严格参数解码2026-10-28) | create/prepare_position完整严格Borsh解码，BigInt/None/0与nonce复制；四组33条固定指令、独立边界与恶意编码通过。最终7文件23项/0skip、零联网尝试/cleanup passed、局部strict类型/零warning lint/3项导入规则通过。仅decoded，无EVM/SDK/共享状态或生产接线，EVM业务/根类型/bundle及真实业务未验；T24仍实施中。下一轮b2独立预期参数比对及prepare五账户/PDA，不绕过T23/nonce等前置。无Linear/Git写入、构建、模拟、签名或广播。 |

| 2026-10-28 | T17.b1验收 / FESOL-57 | 未提交工作区；原分支/基线不变；见[第五十轮记录](docs/solana-implementation-research.md#第五十轮实施记录t17b1-rust安装与首个向量子集验收2026-10-28) | 用户授权安装Rust1.90.0/Cargo/rustfmt及限定生成器构建，固定model编译成功；Cargo.lock/43组JSON落盘，两次一致、独立BigInt核算/18类非法输入/model error区分通过。EVM两文件55项/0skip、0联网尝试/cleanup passed，rustfmt/lint/格式通过。工具链阻碍解除；T17仍实施中，下一轮b2动作/清算等向量，T19及T04.b契约前置不变。无产品SDK/前端/参考仓库改动，无Linear/Git写入、部署或钱包交易。 |

| 2026-10-28 | T17.b2b / FESOL-57 | 本轮新增为未提交工作区；前轮已push至 `bd11081020`，分支/初始基线不变；见[第五十二轮记录](docs/solana-implementation-research.md#第五十二轮实施记录t17b2b-即时impact增仓与限价边界2026-10-28) | 新增32组即时impact增仓/96限价点，总103组两次字节一致、独立核算及36类拒绝通过；原71组输入输出不变。EVM两文件55项/0skip/0联网尝试通过，Rust fmt/check及脚本lint/格式通过。显式pool快照仅为数学边界，无生产SDK/UI接线。T17仍实施中，下一轮b2c非零impact清算/保证金predicate；T19及其余外部前置不变，无Linear写入、钱包/交易或部署。 |

| 2026-10-28 | T17.b2c / FESOL-57 | 本轮新增为未提交工作区；前轮已push至 `7408a0caad`，分支/初始基线不变；见[第五十三轮记录](docs/solana-implementation-research.md#第五十三轮实施记录t17b2c-非零impact清算与保证金边界2026-10-28) | 新增28组非零impact清算/margin、84相邻价格点，总131组两次字节一致、独立核算及43类拒绝通过，原103组不变。EVM两文件55项/0skip/0联网尝试、Rust check/fmt、脚本lint/格式通过。真实动作初始化，正关闭冲击忽略、负值用专用清算cap，普通margin使用同cap但不同抵押因子。无生产SDK/UI接线，T17仍实施中，下一轮b2d累计费用及claimable参考；其余外部前置不变，无Linear写入、钱包/交易或部署。 |

| 2026-10-28 | T17.b2d1 / FESOL-57 | 本轮新增未提交；前轮已push至 `ac35dea699`，分支/初始基线不变；见[第五十四轮记录](docs/solana-implementation-research.md#第五十四轮实施记录t17b2d1-累计借款费与增仓结算2026-10-28) | 28组累计borrowing、32次update与56次真实增仓结算，总159组两次一致/独立核算/51类拒绝通过，旧131组不变；USD非零而raw0、receiver/pool分配、position factor更新及不重复收费已验。EVM55项/0skip/0联网尝试、Rust check/fmt、lint/格式通过。b2d父范围/T17仍实施中，下一轮b2d2 funding/claimable；无生产SDK/UI接线或Linear写入、钱包/交易/部署。 |
