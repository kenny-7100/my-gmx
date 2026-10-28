# Solana 签名前指令契约

T21.a / T24.a1–a3、b1，2026-10-28：固定离线支持子集的可审查规则；unsigned v0容器/LUT、单订单update及cancel已离线实施，create/prepare_position严格参数解码已离线通过，完整create/组合校验及生产接线未完成，也不代表 FESOL-93 已重新准入或完成。CPI 事件版本归 T21.b；不从顶层指令推断执行成功。实现来源及完整样本边界见 [builder ABI](solana-builder-abi.md)。

本轮实时只读核对 FESOL-93/56 的正文、评论和关系：93 仍 Backlog，先固定 program/IDL/WASM、精确指令及账户规则再实现离线校验；95 的正向 builder 样本是输入，不反向依赖 93。上游 release 为 `d4b8c32147dd604d8d062d76c00a75ec4f0bbb7a`，相关查询仅见 EVM 能力隔离 PR #3120，没有重复的 validator 交付。原始快照在 `.local/acceptance/requirements/solana-implementation-t21a/`。

## 可复现资产与身份

共享 [instruction-contract.json](../tools/solana-builder-probe/instruction-contract.json) 固定 program/store、IDL commit/hash、npm WASM/wrapper 身份、四份样本的摘要、十种指令、完整 IDL 参数类型与有序账户最低权限。类型中的全部 enum 只描述编码，**不授予所有枚举业务许可**。IDL 的 PDA metadata 不直接作为账户派生权威，生成物只保留账户名、最低 signer/writable 和 optional。

```sh
node --import tsx scripts/solana-instruction-inventory.mjs
node --import tsx scripts/solana-instruction-inventory.mjs --contract
```

默认输出逐指令 dataHex、完整账户、全局权限及样本定位；`--contract` 输出紧凑且确定的共享契约。命令离线读取固定 IDL 与历史 bytes，不请求 RPC，不运行 WASM builder，不模拟、签名或广播。旧样本继续保留各自捕获时的 probe 摘要，不伪装为本轮重新捕获。

固定 IDL 为 `gmx-solana@c6778dc9bf6444f9037c3b0d2dc219c857e1b45d:crates/programs/idls/gmsol_store.json`，SHA256 `9bc76f2081a1f45334208618aa1b5c1a944e6f1c885c5afb696978210ba81a94`；WASM `775a7ddb532d6d49a1800a3d8eccca523960d685db8e1800fbd5eb519ed8dd68`，wrapper `0d42e12dae1bdfbbe8a95b8042828956b0f150f055fe9689a366a39e2223c80d`，npm `0.9.0-test.2`。仅证明固定产物/IDL样本兼容，不证明 npm 可重现构建来源或当前主网部署一致。

## 顶层指令范围

四份样本合计21 case、27笔交易，下表为真实观察。tag 为 hex；长度包含 tag/discriminator；变长指令的观察长度不作为允许长度全集。

| 指令 | tag | 次数 | 观察长度（bytes） | 账户数量与严格布局 |
| --- | --- | --- | --- | --- |
| ComputeBudget SetComputeUnitLimit | 02 | 27 | 5 | 0；u8 tag + u32 LE |
| ComputeBudget SetComputeUnitPrice | 03 | 27 | 9 | 0；u8 tag + u64 LE |
| gmsol prepare_user | bead8fc18b50e785 | 16 | 8 | 4；无参数 |
| ATA CreateIdempotent | 01 | 92 | 1 | 6；payer、ATA、owner、mint、System、Token |
| gmsol prepare_position | b2d7375a890f6c0f | 11 | 82 | 5；CreateOrderParams |
| gmsol create_order_v2 | c89d03b603a4a2f0 | 22 | 115/116/124/131/132/140 | 25 + params.swap_path_length；nonce[32]、CreateOrderParams、Option u8 callback_version |
| gmsol update_order_v2 | c3afcf21abf629b0 | 3 | 29/45/85 | 10；UpdateOrderParams |
| gmsol close_order_v2 | d5d96264e1cd4cb8 | 2 | 18 | 30；Borsh string reason |
| System Transfer | 02000000 | 3 | 12 | 2；u32 tag + u64 LE lamports |
| SPL Token SyncNative | 11 | 3 | 1 | 1；WSOL ATA |

具体 gmsol 账户顺序/最低权限以共享 JSON 为准，不在文档再维护一份手工顺序。System/Token/ATA 地址和 gmsol/store 固定于 JSON/对应样本，不接受交易自报的新程序。Token2022、多跳及其他顶层 System/Token 指令未进入已核实支持子集；不得因为内部 CPI 使用某指令，就允许同名顶层指令。Approve、任意 Transfer、CloseAccount、额外 signer 或未知程序均拒绝。完整父需求不因此缩减。

## 后续 validator 的确定性规则

以下是完整validator约束，不是inventory已通过的安全检查。T24.a1实现容器/索引/LUT解析，a2/a3实现单订单update/cancel的动作allowlist、角色权限和独立预期语义；create/组合及生产接线仍待实施，具体证据和边界见文末。

1. **独立预期上下文。** 输入绑定 network、选中 wallet、store、market、action id、动作种类、token、金额/价格/时间/方向、接收地址、callback/referrer、setup 策略、blockhash、LUT 快照及费用策略。它来自共享业务状态和可信账户快照，不能从待签交易反推后自证。异步构建/校验后若网络、账户或动作 revision 变更，丢弃结果并重新构建校验。任何失败不得触达 wallet。
2. **容器与数量。** 仅接受明确支持的 versioned message 格式、完整消费的 transaction/message bytes，拒绝未知版本、截断、尾随、越界或非规范长度。检查每笔<=1232 bytes、交易/指令精确数量、全部签名为空、唯一预期 signer=payer、payer 为静态首地址且可写、blockhash 与显式输入一致；不把离线假 blockhash 当可发送凭据。额外签名、重复/多余动作或交易拒绝。实际解码器是否严格拒绝非规范容器仍需攻击测试证明。
3. **LUT。** 仅解析显式可信快照中的表和索引；核对网络、表地址/内容身份及有效性。还原顺序为 static + 所有表 writable + 所有表 readonly。拒绝缺表、越界、错误顺序、替换内容或未经预期的 lookup。LUT 不引入 signer；重复 key/索引、静态与 loaded 重复、程序与业务账户别名均需显式验证。历史 LUT 不证明当前资源有效。
4. **权限。** IDL 标记是最低权限。消息全局权限是同地址多角色/跨指令所需权限的并集，不能要求每个 readonly 角色在消息中都 readonly，也不能仅检查最低权限。先匹配每条指令的预期角色及合法别名，再求并集，拒绝无关 signer/writable 提升。缺省 optional 使用当前 gmsol program ID sentinel，不要求 sentinel 获得 optional 的写权限；sentinel 本身必须保持非 signer/readonly。owner=receiver=payer 等别名只按动作明确允许，不能概括允许任意别名。
5. **参数。** 完整按固定 IDL/Borsh 解码并消费所有字节，拒绝未知 discriminator/enum、不合法 option/bool、非法 UTF-8、截断和尾随。prepare_user 必须仅8 bytes；prepare_position 必须完整解码 CreateOrderParams，不能按观察到82 bytes放行。create/update/close 已有诊断 decoder；prepare_position 严格 decoder 尚未实现。操作许可必须匹配显式动作，不能允许 IDL 中 Liquidation/AutoDeleveraging 等协议动作。金额/u64/u128、优先费使用 BigInt；价格与共享状态按已确认单位转换；None、显式零和 unavailable 分开，不能省略值后静默补默认。
6. **角色与 PDA。** 核对固定 store、可信 market/user/position/order、mints/escrows/source/ATA、event authority/program 及所有可选账户。使用固定协议 Rust seed 与独立 kit 派生，拒绝错 owner、错 store、错 mint、错地址或非法别名。只依赖 IDL PDA metadata 不足。随机 nonce 可从完整解码结果独立重算 order PDA，并关联预期动作/唯一性；这不满足 FESOL-95 的显式可控 nonce 要求，该能力仍需 SDK 解锁。
7. **接收与回租。** receiver 与 rent_receiver 必须匹配独立预期及账户记录；close 的 owner/receiver/rent_receiver 角色不能互换。非钱包 recorded rent receiver 尚无完整业务验收，不擅自启用。callback authority/program/shared/partitioned/version 和 referrer user PDA 必须来自可信 action/账户上下文，核对是否启用、初始化和同 store 关系；不得因为 builder 输出了这些地址就视为可信。
8. **setup 与资金。** prepare_user/prepare_position/ATA 必须是预期策略所需且先于引用；position 参数/派生必须匹配对应订单。ATA 仅允许指定 payer/owner/mint/token program 的独立推导地址。native wrap 仅允许 payer→预期 WSOL ATA 的精确 lamports Transfer，随后该 ATA SyncNative，再 create；skip_wrap 应无两指令并满足真实余额前置。unwrap 是订单参数，不能添加未授权顶层关闭或资金指令。非 native 动作不能夹带 wrap。setup 的链上 init_if_needed 不证明真实账户状态已验。
9. **预算与原子性。** ComputeBudget 每笔精确各一条、处于预期前缀，数值匹配显式费用/compute策略及批准上限；本轮不猜测上限数字，策略缺失则阻止生产发送。增仓+TP/SL 必须三条预期 create 在同一交易，金额/方向/position、顺序及触发关联一致；先行 setup 可单独准备，但不能拆分订单创建。native 组合目前即使历史 LUT 也跨交易，必须显式拒绝，不能自动分批或独立发送 TP/SL。Group、多笔均<=1232 或账户消失均不证明原子/成交。

## 待实现的恶意变体与验收

T24 需对每个支持动作验证正向真实 bytes，并逐项变异：program/tag、所有角色地址、payer/owner/receiver/rent receiver、token/mint、nonce/order PDA、callback/referrer、金额/单位/方向/enum/option、signer/writable、静态/loaded 索引、LUT 内容/表身份、缺/多/重复/重排指令、截断/尾随/非法编码、别名、交易数/大小、跨笔 TP/SL、切网/换账户/动作迟到。每种失败必须有“拒绝且未调用 wallet”的断言。prepare_position 及容器 strict decoder 也需覆盖，不能以 inventory 对可信样本的一致性检查替代恶意验证。

本轮 inventory 只审计 bytes/hash/size、空签名/payer/blockhash、账户索引/LUT还原与保存内容一致，及三种 order 参数重解码一致。尚无生产 validator、恶意fixture或事件 parser；未改共享业务状态、生产 EVM/SDK、存储、lazy/flag/bundle路径，未进行本轮 EVM 业务回归或主网验收。事件固定源码规则已在T21.b1完成，见[订单事件契约](solana-order-events.md)；真实事件回执及版本兼容仍待b2，T24在契约/接线依赖满足后实施，T21整体未完成。



## T24.a1 unsigned v0 容器与LUT严格解析（2026-10-28）

新增 `src/domain/gmsol/parseUnsignedOrderTransaction.ts`。显式输入network=solana-mainnet、独立预期wallet/recentBlockhash、单笔bytes及可信LUT地址内容；同步纯函数，不读RPC、账户、SDK/WASM、缓存、钱包或业务状态。返回status=parsed、原scope、完整账户表及逐指令program/accounts/dataBase64，账户保留全局isSigner/isWritable和static/lookup来源、表地址/index。异常直接抛出，不返回部分结果；**parsed不是valid、不是签名许可**。

复用kit transaction/message decoder与encoder，对完整容器重新编码并逐字节比较，拒绝非规范shortvec、截断/尾随及不支持版本；长度限定1–1232，实际要求规范的一签名v0前缀、唯一预期wallet签名为空、payer静态首地址可写、blockhash一致，header必须合法。LUT按static + 所有表writable + 所有表readonly还原；仅使用显式快照，拒绝缺表、空lookup、重复表/索引、越界、静态/loaded地址重复、总账户超过256。指令所有索引均检查，program必须为静态非signer地址；账户权限按消息header/lookup分类恢复，不误将loaded账户当signer。

合法v0可以没有lookup条目，固定callback fixture存在此情况；解析层接受它，输入显式空Map仅在无lookup时合法，不是缺失数据兜底。有lookup却无对应表立即拒绝。T23 builder的“输出必须实际使用LUT”规则保持不变，后续动作策略可以更严格；不能将容器层对合法消息的支持扩大成产品能力。

这层无法证明调用方LUT内容与当前链上表一致、表有效/权限、genesis/finality或blockhash时效；这些仍需可信读取及T25/T26。替换成其他互不重复的有效地址不会仅凭容器解析被识别为业务错误，须由下一层独立预期账户/PDA/角色校验拒绝。当前还不拒绝合法编码的未知业务程序或未知指令，不检查参数、精确动作/指令数、费用、callback/referrer关系或IDL权限并集，也未接入任何wallet调用。

离线验证复用固定WASM产出的四组update/close、callback/referrer fixture，逐条对照完整program/账户顺序/data，保留payer和loaded权限来源；畸形变体覆盖截断/尾随/超长、非规范signature/static account shortvec、已签名/未知版本/额外signer/readonly payer/非法header、错wallet/blockhash、重复静态key、program指向payer/loaded/越界、account索引越界、缺/重复LUT、越界/重复lookup索引及loaded与static别名。mutated message先成功序列化再断言parser拒绝，避免把生成器报错误当拒绝证据。结构变体不冒充真实链上攻击或钱包验收。

实际命令和证据：最终parser/builder/loader/entry四suite14项、0skip，0联网拦截、进程/临时目录cleanup passed；局部strict类型、两文件零warning lint、3项导入边界、格式/文档/diff检查通过。原生 `.local/acceptance/frontend-offline/run-KEwHPU/vitest-results.json`；当前详细命令及边界见[第四十六轮记录](solana-implementation-research.md#第四十六轮实施记录t24a1-unsigned-v0容器与lut解析2026-10-28)。无EVM/SDK/共享状态或存储改动，无生产消费者、服务启动、模拟、签名、广播或构建；EVM业务/根类型/bundle本轮未跑。

T24仍实施中。下一轮T24.a2先实现update动作allowlist、独立预期账户/参数及全局权限并集校验，之后cancel；create仍待T23。费用策略必须显式，不猜测生产compute或优先费上限。


## T24.a2 单订单update确定性校验（2026-10-28）

独立预期还必须提供可信订单kind，仅允许T23已支持的LimitIncrease、LimitDecrease、StopLossDecrease；kind绑定返回scope。update字节不包含kind，不能由bytes证明记录类型，调用方仍须从共享可信订单记录提供，真实链上状态另行验收。

新增 `src/domain/gmsol/validateOrderUpdate.ts`，复用a1容器/LUT解析并仅接受三条指令：SetComputeUnitLimit、SetComputeUnitPrice、update_order_v2，顺序及数量固定，前两条不得携带账户。compute limit/price必须来自调用方明确批准的动作策略、与字节精确相等，检查u32/u64编码范围；不提供隐式默认值，也不把编码范围当成生产预算上限。

输入包含独立预期wallet/blockhash、可信LUT快照、order、marketToken、callback三账户或显式undefined、五个明确的bigint或undefined参数、compute limit/price。参数为已转换的协议单位：size为USD20，价格为协议contract unit price，minOutput增仓为raw token、减仓为USD20，validFromTs为i64秒。调用方后续必须从共享业务状态通过既有T08转换得到预期值，不能读取待校验交易反推预期；本函数不维护另一份订单状态或金额计算。order必须由可信共享订单记录提供；本指令无nonce，不从待签bytes推断其所有权，链上pending/owner/store关系仍需真实数据和模拟验收。

严格读取固定8字节discriminator和四个`Option<u128>`、一个`Option<i64>`，完整消费输入，拒绝非0/1 option、截断、尾随、字段不等、空变更和越界预期；None与显式0不同。update没有callback_version参数，不添加该字段。market PDA独立使用kit及Rust种子 `market` / `store` / `marketToken`，event authority使用 `__event_authority`，callback authority使用 `callback`，全部派生于固定gmsol program；固定源码为同一IDL commit的 `programs/store/src/instructions/exchange/order.rs:972`、`programs/store/src/states/order.rs:35`、`crates/sdk/src/pda.rs:195` 和 `programs/callback/src/lib.rs:26`。

精确比对十个有序账户；未启用callback的四角色必须全部是program sentinel。支持子集仅允许这四个缺省角色与program别名；其他业务角色、callback program/shared/partitioned要求互不相同，不擅自扩大未验别名。全局权限是owner角色与fee payer的并集：wallet signer/writable，market/order及启用callback的两个data账户writable，其余readonly非signer；全局账户集合也须精确一致，拒绝多余账户和任意权限提升。update不存在user/receiver角色，不套用create/cancel的账户表。

await前复制bytes、params、callback并完成容器解析；`new Uint8Array(input.bytes)`也独立复制Node Buffer，避免Buffer.slice共享内存。结果绑定原network/wallet/blockhash/order/marketToken及独立bytes副本，status为validated-update；它只代表该离线子集通过，不代表可签名。T26仍需检查当前动作revision/钱包/网络、真实LUT与blockhash时效、费用策略上限、fresh trading flag、模拟及余额，不能直接把结果当发送授权。没有生产消费者、RPC/WASM加载、钱包访问或外部写入。

测试覆盖三组固定WASM正向样本（普通LUT、callback无LUT、五参数显式选项）、u128最大值/i64两端/零、逐角色替换、合法编码未知program、错program/account数量、缺/多/重排指令、预算错误/额外账户、每个前缀截断/尾随/非法option、五字段独立预期不匹配、每个非payer静态账户跨权限边界后保持索引语义、额外signer与await期间输入变更。测试使用真实kit序列化；先成功编码再断言拒绝，不mock codec/config，不使用嵌套协议checkout。codec组合与签名前风险通过测试准入门槛，纯codec边界测试适用测试行数例外。

实际验收及原始结果见[第四十七轮记录](solana-implementation-research.md#第四十七轮实施记录t24a2-单订单update动作校验2026-10-28)。T24父项仍实施中；下一轮a3取消动作精确账户/PDA/参数/权限校验，create/组合仍依赖T23及nonce能力。真实钱包、部署身份、LUT时效和发送均未验，EVM业务/根类型/最终bundle本轮未跑。


## T24.a3 单订单cancel确定性校验（2026-10-28）

新增 `src/domain/gmsol/validateOrderCancel.ts`，输入复用T23的显式cancel业务输入，owner绑定独立wallet，另加单笔bytes、可信LUT和独立批准的compute limit/price。receiver及rentReceiver仍严格等于wallet；referrer是可信记录中的钱包，不能从IDL猜user PDA，不能把未知字段当undefined。callback、四个token hint及unwrap必须来自共享订单/动作记录，四token的undefined只表示已确认不存在。无生产消费者，不读RPC、账户或钱包；输出原scope和独立bytes，status=validated-cancel，不构成签名许可。

固定源码 `gmx-solana@c6778dc9bf6444f9037c3b0d2dc219c857e1b45d`：`programs/store/src/instructions/exchange/order.rs:517`的30账户约束、`crates/sdk/src/builders/order/close.rs`、`crates/sdk/src/js/instructions/close_order.rs`、`crates/sdk/src/builders/token.rs`和`utils.rs`。独立kit派生store_wallet（store_wallet/store）、user及referrer_user（user/store/对应钱包）、event/callback authority，以及SPL Token程序下的order escrow和钱包ATA。ATA seeds按owner、Token program、mint，派生程序固定Associated Token program；不依赖存在错误metadata的IDL PDA字段。

仅接受两条ComputeBudget前缀、每个独立mint恰好一条ATA CreateIdempotent、最后一条close_order_v2。准备段可按任意顺序，因为固定SDK使用HashSet，但不得缺失、重复、插入其他程序/动作或放到close之后。四token全缺省时无ATA准备；即使unwrap=true，固定SDK仍先准备WSOL ATA，close的WSOL接收角色才改为wallet。只允许SPL Token，不扩大到Token2022；不新增顶层Transfer、SyncNative或CloseAccount。

close参数只允许固定discriminator和精确Borsh字符串cancel：8字节tag、u32 LE长度6、六个ASCII字节；不按观察长度直接放行，任何不同reason、非法UTF-8、长度/截断/尾随均拒绝，未添加callback_version。完整30账户顺序匹配；相同mint可在四个token角色复用，并复用对应escrow/ATA；wallet仅可在executor/owner/receiver/rentReceiver及WSOL unwrap输出角色复用；缺省optional仅可指向gmsol sentinel。其他角色家族和callback数据要求互异，不自动认可额外别名。

全局权限由close及ATA准备共同计算：wallet唯一signer/writable；store、store_wallet、user、order、启用的referrer_user、escrows、准备的ATAs及callback两个data账户writable；其余非signer/readonly。WSOL unwrap准备的ATA虽未被close引用，仍按准备指令保留writable；相同token跨角色只形成一个地址。全局账户集合与权限都精确匹配，拒绝额外账户和权限提升。

提取现有update预算检查到小型 `orderValidation.ts`，update/cancel共用相同显式预算前缀规则，无生产费用默认值或批准上限猜测。a1解析器统一new Uint8Array复制输入，解决本轮直接Node Buffer输入的codec重编码差异，并避免slice共享缓冲区；不改变canonical、签名或LUT规则。所有输入和派生种子在await前快照，迟到结果保持原scope。

验收覆盖普通LUT及callback/referrer历史WASM样本、真实固定WASM的32种四token缺省/native组合、双mint准备顺序交换、重复准备拒绝、逐30角色/6个ATA账户替换、非法program/数据/数量/顺序、预算与独立预期不匹配、每个非payer静态账户跨权限边界、每个实际使用LUT条目替换及await输入变更。LUT替换先断言容器仍可parsed，再由动作层拒绝，避免用容器失败冒充业务校验。无mock codec/config，测试不依赖嵌套协议checkout。

本轮6文件20项/0skip、0联网/cleanup passed，局部strict类型、零warning lint、3项导入规则通过；完整命令/结果见[第四十八轮记录](solana-implementation-research.md#第四十八轮实施记录t24a3-单订单cancel动作校验2026-10-28)。EVM业务、根类型/最终bundle及真实钱包/部署/链上执行未验；T24父项仍实施中。下一轮T24.b1先补create_order_v2/prepare_position的严格参数解码和恶意编码测试，这是不依赖可控nonce builder的独立子步骤；完整create/组合账户校验和生产接线仍保留T23/nonce、T25资源和其他前置，不绕过阻碍。

## T24.b1 create与position严格参数解码（2026-10-28）

新增纯函数 `src/domain/gmsol/decodeOrderCreateData.ts`，仅识别固定IDL/Rust的 `create_order_v2` 与 `prepare_position` discriminator。create读取32字节nonce、完整13字段params及callback版本；prepare读取同一个完整params，拒绝未知tag、截断及尾随字节，不按样本长度放行。u64/u128/i64保留BigInt和协议单位，所有option输出显式undefined并与零分开，nonce独立复制。固定来源为协议commit `c6778dc9bf6444f9037c3b0d2dc219c857e1b45d` 的 `programs/store/src/ops/order.rs`、`instructions/exchange/order.rs`、`crates/utils/src/order.rs` 和T21的IDL摘要。

输出状态仅为 `decoded`；覆盖IDL全部9个OrderKind与3个DecreasePositionSwapType只证明编码可解释，Liquidation/AutoDeleveraging等不因此进入业务allowlist。无账户/PDA/权限、独立动作预期、nonce来源或原子性证明，不能作为签名许可。没有RPC/WASM/钱包或状态消费者，也没有新业务真源。

四组既有固定WASM fixture共33条create/prepare完整字段对照通过；另有独立边界字节向量覆盖整数上下界、全部枚举、bool、各option None/零、callback None/0/255、nonce字节和复制、每个前缀截断、尾随及每个非法tag值。prepare样本没有既存decodedArgs时以对应create的固定期望加已核实的prepare差异作独立对照：三组组合prepare的executionLamports=0、unwrap=false，不能盲目要求prepare与create的全部参数相等。

本轮7文件23项/0skip、零联网尝试及cleanup passed；完整命令和类型/lint/边界检查见[第四十九轮记录](solana-implementation-research.md#第四十九轮实施记录t24b1-create与position严格参数解码2026-10-28)。T24仍实施中，下一轮T24.b2先做独立预期参数比对及prepare_position五账户/PDA约束，保留完整create/组合对T23可控nonce等前置；EVM业务、根类型、最终bundle及真实业务均未验。
