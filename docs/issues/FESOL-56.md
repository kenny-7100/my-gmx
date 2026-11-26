# FESOL-56 — 交易构建、校验与发送的前置梳理

## Divhead 后续改动归因（2026-11-26）

角色：只读增量分析。统一 #3337 从 `be9ca46ecb` 至 `32dde58aa7` 新增 Divhead 14条非 merge 和4条 merge，涉及限价 TP/SL 限制、发送恢复、共享通知/提交器、输入/改单撤单及索引追赶；对应行为、证据和验证边界见[统一归因记录](../solana-trading-dependencies.md#divhead-后续改动归因2026-11-26)。未运行新测试/钱包验收，不能沿用旧 head 的全绿结论。

## 状态与增量核验（2026-11-25）

实时 Linear 仍 In Review；统一 #3337 已 Ready，head `be9ca46ecb`，六项 CI 全绿、尚无正式 review。相对上轮审查仅 RPC 配置变量重命名，历史方法 403 与终态关闭缺口仍未消除；本轮未重跑业务测试或交易验收。版本、责任与范围见[统一现状复核](../solana-trading-dependencies.md#pr-与关联需求现状复核2026-11-25)。

## 统一PR审查（2026-11-24）

参与角色：review。按gmx-prompts审查#3337 `aa9d17d129`，确认Solana平仓/改单被无关EVM多扩展链冲突阻断的P2；未改业务。79项定向测试通过，固定IDL/线上API局部核验与未验收边界见[审查记录](../solana-trading-dependencies.md#gmx-prompts审查33372026-11-24)。未发布外部review，不表示本issue全部AC完成。

## 统一交易交付（2026-11-23）

参与角色：统一整合实施。现已纳入[Draft #3337](https://github.com/gmx-io/gmx-interface/pull/3337)，共享分支`solana-trading-integration-trd-72`，后续Kenny/Sulliven整合修改在该分支继续；原PR由用户手动关闭，TRD-83独立。来源、保留的历史/保护行为、实际验证与钱包验收边界统一维护在[整合交付记录](../solana-trading-dependencies.md#四交易pr统一交付2026-11-23)。本记录不表示原需求全部AC已通过。


## 四PR整合条件评估（2026-11-23）

本轮只读评估Kenny承担整合的条件：现有PR及开发现场可接续，最终PR归属/旧PR收口需对齐，钱包与运行条件待实测。78与84的17个生命周期/通知/sender文件blob一致，不能以缺少merge节点认定漏代码。依据及边界见[整合评估](../solana-trading-dependencies.md#四交易pr整合实施条件评估2026-11-23)。未实施业务或修改外部状态。

## 五需求晚间核查（2026-11-23）

参与角色：只读依赖调研。TRD-72现In Review，#3315仍fac83d15bd、Ready/无review；release新增3321共享SDK费用修正可同步。完整主网AC仍独立待验收。 版本、证据与验证边界见[统一增量核查](../solana-trading-dependencies.md#五需求晚间增量核查2026-11-23-2130-cst)。本轮未修改业务或外部状态。

## 五需求前置复核（2026-11-23）

本轮以依赖调研角色核对实时Linear/PR/checks与关键源码：自有修复传播和冲突处理已完成，当前checks全成功，无需重复接入未变前置。后续重点是84作者原线同步及Receive接缝、107部署后性能/恢复、108真实刷新闭环与109剩余参考钱包/flags；同时更正3273为ticker类型修正。具体版本、跟进归属、可更新状态与未验证边界见[统一复核](../solana-trading-dependencies.md#五需求前置跟进复核2026-11-23-0934-cst)。未修改业务或外部状态。

## 五需求现状核查（2026-11-22）

本轮刷新Linear、当前PR/checks/review及直接前置，确认77已合并但Linear仍In Progress、72新增原生SOL/WSOL原子资金修复尚未进入78/70/playground，以及70/playground当前与release冲突。最新用户自填配置部署未复验RPC，不沿用旧403为当前结论。各需求版本、剩余事项和证据边界见[统一核查](../solana-trading-dependencies.md#五需求最新现状复核2026-11-22)。未修改业务或外部状态。

## 前置接续部署（2026-11-20 深夜）

本需求相关交易线已接续3195网络保护、72 preflight pending修复及release通知变更，并集成136/playground部署。实际版本、各目录检查及Alchemy应用未启用主网造成的页面验收阻碍见[136接续记录](TRD-136.md#前置更新与-playground-接续2026-11-20-深夜)。没有修改他人PR或Linear，未把构建/部署通过扩大为钱包与金融验收。

## 最新状态核查（2026-11-20 17:44 CST）

本轮只读重查五条Linear及当前PR/checks/review：五PR当前检查均成功、77/72 Ready而其余Draft，均未合并。72最新preflight拒绝清理修复已过CI，但尚未进入78/70/136/playground实际sender源码；正式冻结LUT及此前unsigned atomic模拟已接续，完整链上/金融/四钱包验收仍未完成。版本与边界见[统一核查](../solana-trading-dependencies.md#五需求最新现状复核2026-11-20-1744-cst)。本次未改业务或外部状态。

## PR #3315 P2 修复（2026-11-20）

用户授权修复后，沿原 development 实施并精确 cherry-pick 到原 delivery；开发提交 `a2622449a3`、交付提交 `b280eadf75`，两者 GPG 验证均为 G，三份交易模块文件内容一致。仅捕获 `sendTransaction().send()` 返回的实际 Solana `-32002` preflight failure，清理匹配本次签名的持久化记录并移除本次 `pendingSignature`；并发替换记录不清理，超时/断连继续 reconcile，前序已确认 preparation 签名保留。未改变依赖、WASM、LUT、订单构建或钱包校验。

回归使用既有真实 WASM/Ed25519 fixture 和安装版 SDK 的错误转换；修复前失败、修复后验证 pending 清理、reconcile 恢复和下一次提交成功，以及被另一笔签名替换时保留记录。新增一个表驱动测试；另以临时用例验证先前 preparation 成功而后续发送被拒绝时仍保留成功签名，临时源不进入产品提交。开发目录全量前端 **3511 passed / 1 skipped**、交易与 hook **21 passed**、app/landing types、修改文件 ESLint/Prettier 与 diff 检查通过。

交付目录全量前端 **3511 passed / 1 skipped**、app/landing types、修改文件 ESLint/Prettier 与 diff 检查也通过。开发分支已备份推送 `my-gmx`，交付分支已推送 `origin` 并更新原 [#3315](https://github.com/gmx-io/gmx-interface/pull/3315) 的 Summary/Validation；保留用户设置的 Ready 状态。GitHub 确认新交付提交签名 `verified=true / valid`；新 head 的远端 CI 仍在进行，本地通过不替代 CI 完成。

本次仅修复发送失败的状态生命周期；下方 review 是修复前版本的历史证据。未新增部署、钱包签名或主网交易验收，完整钱包/订单 AC 继续按既有边界处理。

## PR #3315 当前 head 独立 review（2026-11-20）

角色：只读审查，未修改业务、提交 GitHub review、Linear 或发送交易。按 gmx-prompts 的 interface review/Solana 规范和 RL-04/05/07 检查 `15f50b87d2`；实时 release `1cd20c1a5a` 的无提交合并结果 tree 与 head 完全一致。上游规范 main 为 `7c5a4aff`，本地 `6e001536` 的本次 review/Solana/编码规则与其无差异；gmx-solana main 为 `d81a3e69`，按产物固定 revision `7fe40082` 逐项核对五种允许指令的 discriminator 和 account order，全部一致。API main `678fc2e8` 仅通过远端 ref 阅读，保留固定 checkout。

**NEEDS CHANGES：P2，明确的 RPC preflight rejection 留下永久 pending 锁。** [sendOrderTransactions.ts:225](https://github.com/gmx-io/gmx-interface/blob/15f50b87d2ac4cc38b3e2bc9bf315a35d86d71af/src/domain/gmsol/transactions/sendOrderTransactions.ts#L225) 在发送前保存签名，但 `sendTransaction(skipPreflight:false)` 返回明确 `-32002` 时不撤销本次记录；`reconcileGmsolSubmission` 对从未广播的签名持续读到 null 并抛错，sender 与 hook 都在下一次签名前阻断，localStorage 令刷新也无法恢复。真实 WASM/Ed25519 签名及安装版 `@solana/errors` 的 `getSolanaErrorFromJsonRpcError` 构造真实错误，受控 RPC 复现记录仍在、reconcile 拒绝、再次 submit 不再签名。首次期望清理的反例失败，再以实际错误类确认行为通过。建议仅对确定未广播的错误清理匹配的本次签名；超时、断连等不确定结果继续保留并 reconcile，不能在通用 catch 清空所有 pending。

新增本轮验证：前端受影响 12 suites/125 tests、SDK 3 suites/36 tests、app/landing `tscheck:ci`、SDK `build:types`、固定 WASM 构建校验均通过。临时复现不进入产品测试；日志保存在本机 `/tmp/pr3315-*`，反例源为 `/tmp/pr3315-review3315.scratch.spec.ts`。当前 PR 全部返回 checks 成功且 inline comments/reviews 为空；CI 成功不覆盖新增失败分支。

使用 Kenny Chrome 原生窗口访问当前不可变 production preview `72c1d7d2.gmx-interface.pages.dev`：flag off EVM 交易页可加载，flag on 可站内切入 Solana 并刷新；Solana `/rpc-debug` 显示 Alchemy、有效 slot 和正常 tracker。未采集完整跨 worker 请求计数、console/storage telemetry 矩阵，未重跑全量前端/SDK或应用生产构建，不把页面 smoke 当交易验收。公开 API `/v1/markets/config` 返回 67 条，测试地址 `/v1/orders` 返回空数组，仅证明基础路由可达，未以空结果证明新订单字段部署。

Linear TRD-72 当前 mainnet AC 仍待：远价 limit→edit→cancel、带冻结 LUT 的原子 increase+TP/SL 落链，及 Phantom/Solflare/OKX/TokenPocket 各自签名落链。真实 WASM 恶意指令/receiver 拦截已在本轮单测验证；真实钱包和落链没有本轮新增证据，历史 unsigned 模拟及旧部署 Phantom 开平仓不替代当前 head 验收。

## 冻结 LUT 前置已到位（2026-11-20）

根据用户群聊补充实时核实：#3325已合入release，当前72 `c59c5fc672`已使用两张新冻结表；CLI确认authority=null、active、73/155地址与旧表同序。此前“109未提供可信资源”判断已过期；下游78/70/playground仍旧配置，真实交易矩阵仍未完成。见[统一更正](../solana-trading-dependencies.md#群聊补充后的-lut-状态更正2026-11-20)。

## 五需求现状复核（2026-11-20）

本轮只读核对五条 Linear 正文/关系/空评论与对应上游 PR/head/checks/review。当前状态、Divhead 新增72原子订单准备拆分提交及尚未进入下游历史、78报告发布失败边界，见[统一核查](../solana-trading-dependencies.md#五需求当前状态复核2026-11-20)。未改业务、外部状态、部署或交易；既定暂缓及未完成验收范围继续有效。

## 当前 PR 剩余依赖评估（2026-11-19 15:21 北京时间）

用户明确 #3315 Ready 为本人主动调整；Ready 不证明依赖满足。角色为只读依赖分析，实时读取72及100/71/109/98/127/97/86正文/关系，109/98/100评论均空；刷新5条直接前置PR及代码，不修改PR/Linear或业务。72 head仍 `b5c1bc3f78`，release为 `2c107c63a1`。此前五条比较中的Ready仅为观察，不是本需求就绪凭据。

代码已集成但上游尚未合入的前置：TRD-100 [#3287](https://github.com/gmx-io/gmx-interface/pull/3287) `24e983c4c4`（Ready；Linear In Review）、TRD-98 [#3195](https://github.com/gmx-io/gmx-interface/pull/3195) `372e7ff471`（Ready；In Test）、GMX WASM TRD-77 [#3314](https://github.com/gmx-io/gmx-interface/pull/3314) `161e89e4a4`（Ready）、费用解析 [#3205](https://github.com/gmx-io/gmx-interface/pull/3205) `baed302cb0`（Ready）、订单字段 [#3207](https://github.com/gmx-io/gmx-interface/pull/3207) `6bb15c691f`（Draft）。当前返回checks均成功，3207仅有两项Pages检查，不能说已通过完整测试。#3207自身stack在#3205。72正文仍写旧#3259，应指向替代#3314。

逐文件blob核对：3287转换实现/测试相同，index仅export位置不同；3195的27份非翻译文件全部相同；3314的18文件全部相同；3205生产parser/types三文件相同，suite有整合差异；3207三文件相同，72另加共享Order.solana和compose透传。这些是已集成证据，不是已审查合入。orderInputs直接import单位转换，transaction hook直接import余额key与RPC，builder依赖固定WASM；orderContext直接要求orderAccount/rentReceiver/escrowTokens/actionState，故编辑/取消消费3207。3205是共享Provider费用读取依赖，不能等同所有低层builder必须等待GT VIP UI。

最明确的正式运行阻碍为TRD-109（Divhead，Todo，无评论）：72仍配置两张provisional表且expected-authority map为空；prepare通过fetchGmsolLookupTables装载并执行trust gate。当天既有CLI已确认两表active但有第三方authority（见[FESOL-71](FESOL-71.md#正式配置-lut-链上复核2026-11-19)），本轮未再次读取链上，不声称最新slot状态。需提供冻结证明或可独立核实GMX归属的替代表、authority与覆盖，72再接配置并测实际组合/模拟。playground无LUT市价成功不等于正式配置可发送；最新无LUT1260bytes原子TP+SL仍被1232上限拦截，不能承诺仅冻结/复制表自然解决所有组合。

已具备的基础：71懒加载/交易开关、97钱包、86价格与127 RPC资源的Linear均Done；钱包#3110与价格#3138在线确认为MERGED。72当前代码确实消费wallet session、GMX RPC及每次send前fresh trading flag，未发现需要等待70/78才能实现低层sender。70/78是下游消费者；完整共享UI及execution toast验收会组合使用它们，非倒置为72代码前置。Linear77 blockedBy72指新产物需重跑72主网流程，而72实现已使用77产物，构建与消费验收须分别判断。

仍需真实主网验收：带可信LUT的limit/edit/cancel、increase+TP/SL单交易落链，以及Phantom/Solflare/OKX/TokenPocket各自真实签名落链；历史unsigned模拟和Phantom无LUT开平样本不替代它们。共享API的market/account/fee数据、confirmed-slot freshness、GMX RPC、keeper与solanaTrading开关须在目标preview重新确认，本轮未测在线服务或flag，不称当前连续健康。官方API已部署属于既有证据，不再笼统说等待API开发；稳定性与同快照金融数值核验仍另算。优先推进109资源和100/98/77前置review，3205/3207协调合入；实现review可并行进行，正式合并需先收敛来源/基线并完成约定验收。未执行构建、浏览器、签名或广播。

## 下一条 Draft review 建议（2026-11-19 14:24 北京时间）

角色：只读就绪比较，用户询问本人 Draft 下一条适合提交 review 的需求。限定现有五条与直接前置，复用本阶段15项协调表调查，补读72/78/70/77/109/100/98实时正文、关系和全部评论；查询五PR当前head、diff文件、review/checks及72/78/70全部review threads（均空），核对线上release `0bc6c2ba2d` 与本地对应commit。未转换Ready、请求review、改Linear或实施业务。

首选TRD-72 [#3315](https://github.com/gmx-io/gmx-interface/pull/3315) `b5c1bc3f78`：Draft、MERGEABLE、最新7项检查全成功，无现有review/threads；是78与70共享交易基础。实际核对builder/validator/sender/README：固定真实WASM、atomic重编译/1232-byte拒绝、签名前校验、LUT信任及会话/新鲜开关边界已有实现。当前diff97文件含未合前置，并非纯独立transaction diff；#3287、#3195、#3205/#3207、#3314应明确来源和审查边界。PR正文仍引用旧#3259，应在正式送审准备时更正为#3314。

这是优先进入实现review的建议，不是可合并/AC完成判断。TRD109仍Todo且无新评论；未刷新链上LUT authority。最新无LUT playground原子TP+SL1260bytes反馈、可信生产LUT、四钱包/limit/edit/cancel/atomic完整落链矩阵仍未收口；历史Phantom开平仓仅固定组合证据。若团队只接受全部AC完成后转Ready，则目前无下一条满足该标准，应先收口72验收。

备选：78/#3316 `164102b83c`依赖72，组件job报告发布失败（非测试断言失败），其余最新检查成功；70/#3317 `2bc3392a65`最新检查已全成功，但支付币转换、最大杠杆一致性、完整独立金融对照及GT Rewards仍暂缓，且原子TP/SL依赖72/LUT，故排后。136/#3318 `2b53b1933e`最新检查全成功，但持续实验/联调载体按约定保持Draft；77/#3314已非Draft，不再列下一条候选。本轮仅状态与关键路径核验，不代表完整代码review或新增链上/浏览器验收。

## Playground 原子 TP/SL 超限反馈（2026-11-19）

用户实测BTC市价开仓附TP+SL在当前无LUT playground构建为1260bytes，比1232上限多28bytes，builder在签名前拦截，未提交订单。是资源/环境能力限制，与TRD-70输入崩溃修复不同；根因链路、历史样本边界及下一步unsigned测量见[TRD-136记录](TRD-136.md#用户实测附带-tpsl-交易超限2026-11-19)。本轮仅源码与截图定位，未查新链上表状态、修改代码或发交易。


## 开仓后同步警告修复（2026-11-19）

TRD-72 原线分离正常账户同步与真实刷新错误，TRD-70 保持同步期间下单禁用；同一修复已接续本需求原development/delivery并推送既有上游PR。具体提交、各目录验证及playground部署结果见[统一修复记录](TRD-136.md#开仓后同步警告修复交付2026-11-19)。本轮未执行新交易，不扩大原需求金融或钱包验收。

## 五需求最新状态复核（2026-11-19 10:27 CST）

本轮只读复核 Linear 正文/关系/评论与当前上游 PR/checks/review。状态、#3314 已转 Ready 事件、#3316/#3317 组件测试286 passed但报告发布 gh-pages 非快进失败，以及验收边界见[统一核查](../solana-trading-dependencies.md#五需求实时状态复核2026-11-19-1027-cst)。未改业务、PR/Linear 状态、CI、部署或钱包。

## 保留多提交的上游 PR 迁移（2026-11-19）

原 fork #3258 已迁移为上游仓库内 Draft [#3315](https://github.com/gmx-io/gmx-interface/pull/3315)，原 PR 已关闭。原 25 个 commit 的拆分、顺序、message、逐提交 tree 与 merge 父节点映射均保留；所有 PR commit 经 GitHub 验证为有效 GPG 签名。新 head `c1473bbee4`，最终 tree 与原 `05a48d0a97` 一致，未新增业务修改或同步 release。旧历史备份于本地 refs/backup/pr-3258-before-gpg-migration，commit 映射与远端验证快照留忽略目录 .local/pr-upstream-migration。交付 registry 已绑定上游 origin/新 PR；普通需求 development 未改，playground 因原 26 个提交全签名，保持 SHA 不变。已有同源码测试证据可复用，本轮只验证历史/内容/签名，不声称新 PR CI 已结束，也不重新执行钱包或交易。完整批次见[迁移结果](../solana-trading-dependencies.md#保留多提交的上游-pr-迁移完成2026-11-19)。

## TRD-72 正式平仓消费证据（2026-11-19）

原修复集成后的playground ca6fa8f824/4f3109d8完成用户签名的BTC多仓100%平仓：请求与keeper均finalized成功，8条Lighthouse断言成功，到账9.515259USDC，Order filled、空仓及刷新后余额得到核验。公网API首次stale503后恢复，minContextSlot以keeper471002042为floor返回471002755、0仓位/0订单。实际部署WASM下载hash仍为固定e82184ca…b46c840。具体回执与边界归[TRD-136](TRD-136.md#正式平仓到账与刷新闭环2026-11-19)。这是一种钱包/一个市价平仓样本，不扩大为完整AC；原暂缓范围不变。

## 五需求目标实施接续（2026-11-18 深夜）

TRD-72接入地址key，既有Lighthouse保护保留。 已同步release `38b1503444`。具体提交、验证、推送与剩余金融/LUT验收见[统一实施记录](../solana-trading-dependencies.md#五需求跟进实施2026-11-18-深夜)。目标持续active，修复交付不等于完整主网矩阵完成。

## 上游与后续核查（2026-11-18 23:12 CST）

当前TRD-72；原Draft #3258 `b0fae7d1f2` 无新review，Lighthouse修复已在136/playground，但78/70原开发与交付sender仍旧逐字节比较，需要按原线精确接续并保留tracking。余额#3195地址key小补丁也未接入；正式API已出gmsol标记，可信LUT与完整矩阵仍独立验收。只读证据及边界见[统一核查](../solana-trading-dependencies.md#四需求与-trd-136-最新跟进核查2026-11-18-2312-cst)。

## TRD-72 Lighthouse 兼容修复交付（2026-11-18 晚间）

原 development `2155ca121f`、原 delivery `b0fae7d1f2` 已签名、验证并推送，更新同一 Draft #3258。受限接受 Phantom 追加的两类 Lighthouse 断言，保留原交易语义、权限/费用/LUT保护和签名，并在发送前对最终交易验证签名及模拟。development完整前端3457 passed/1既有skip；delivery自身types/lint及18交易测试通过。TRD-136/playground集成及线上验收进度见[本轮实施](TRD-136.md#lighthouse-兼容修复实施2026-11-18-晚间)，本次Phantom带8条Lighthouse断言的真实市价开仓、keeper成交及刷新已通过，见[最终链上与页面证据](TRD-136.md#lighthouse-真实开仓与刷新验收通过2026-11-18-晚间)；不扩大为全部钱包/交易动作验收。下方“未改业务”为先前定位阶段的历史状态。

## TRD-72 Phantom 签名兼容缺口（2026-11-18）

在 TRD-136 playground 实测 Phantom 返回时附加8条 Lighthouse 断言，原业务指令/账户权限、blockhash与费用未变；message827→1109bytes触发本人#3258的严格一致性检查，广播前失败。属原交易需求兼容缺口，未改业务。受限兼容方案、现场恢复与证据边界见[实测定位](TRD-136.md#phantom-返回消息差异已实测定位2026-11-18)；后续修复沿原开发/交付线，不在playground单独绕过保护。

## 正式替代实施（2026-11-17）

TRD-72 原开发线作为实现源，依次接入最新 #3190/#3195/#3205/#3207；保留 orderInfo.solana、账户/slot/交易保护，删除已被正式 registry 替代的重复 RPC hook。 验证和推送收尾状态以[统一实施记录](../solana-trading-dependencies.md#trd-136-正式替代实施2026-11-17)为准。

## 五需求前置接续实施完成（2026-11-17 晚间）

已授权并接续原开发/交付线最新release、保留SDK双侧导出；最终API2.9.3隔离验证已通过，原4条交付实际目录验证、普通推送及Draft正文更新已完成。真实交易/退出等暂缓边界不变。版本、证据及当前未完成项见[统一实施记录](../solana-trading-dependencies.md#五需求前置接续实施完成2026-11-17-晚间)。

## 五需求晚间前置核验（2026-11-17）

当前release新增63/80和SDK2.9.3，TRD100单位实现无需重做，新PR3287冲突待review；建议原线接续并保留交易保护。 角色为只读依赖调研，来源与验证边界见[统一核验](../solana-trading-dependencies.md#五需求晚间前置核验2026-11-17)。

## 四条批次状态复核（2026-11-17）

只读核对当前 Linear、原 Draft PR 和最终 head CI；最新 release 冲突与 CI 收尾结果见[统一复核](../solana-trading-dependencies.md#四条批次状态复核2026-11-17)。本轮未改业务或执行交易，既有验收边界保留。

## 上游跟进实施（2026-11-17）

TRD-72 原线已同步 release `7868f48f3e`，精确对齐 TRD-100/#3243 的两个等值常量（原提交 `7fda907550`），保留全部数学导出及转换保护。原 development 类型与完整前端回归3448 passed/1 skipped、SDK定向41 passed；原 delivery `153536c592` 已完成自身SDK rebuild/types/full suite（3448 passed/1 skipped），已推送同一 Draft #3258，标题/正文接续TRD编号。Provider合并后PR范围收敛为95文件。 统一来源、交付版本、验证和外部剩余项见[五需求跟进实施](../solana-trading-dependencies.md#五需求跟进实施2026-11-17)。

## 前置增量核验（2026-11-17）

当前TRD-72为In Review；65合入、100新head已无冲突；98/63/113冲突及可信LUT仍待跟进。新API值得隔离核验，未把候选代码/CI等同运行或主网验收。 统一证据、版本及跟进建议见[五需求依赖核验](../solana-trading-dependencies.md#五需求前置增量核验2026-11-17)。

## Review 经验复审（2026-11-15）

已先核对原development与远端Draft的成果同步，再按新review经验审查。最新版本、发现/修复、定向验证与运行边界统一见[四PR复审](../solana-trading-dependencies.md#基于-review-经验的四-pr-复审2026-11-15)。本轮未确认新的P0/P1/P2代码问题；56/20/19已补齐过期交易README并推送原PR，72产物无需改动。以下剩余验收/暂缓项继续有效，不据复审通过修改需求状态。

## 剩余事项与恢复条件（2026-11-15）

基于本日目标收尾的已核验证据整理，未新增远端调查。本节作为下一次接续入口，优先于下方历史候选与旧阻碍。

| 待完成事项 | 恢复条件与下一步 | 完成证据 |
| --- | --- | --- |
| 可信LUT接入与最终交易资源复验 | 71提供可核验资源后，按[共同条件](../solana-trading-dependencies.md#四需求剩余事项与恢复条件2026-11-15)核实信任来源、内容及账户解析；生产gate不得绕过 | 最终可信表上的builder/validator、1232-byte与compute检查及模拟结果 |
| 真实钱包交易流程 | 资源、交易开关、余额/费用/数据就绪且获操作授权后，按既有56验收范围覆盖四钱包、直接增减仓、市价/限价、TP/SL、修改/取消、缺账户准备与native SOL | 逐项签名/链上receipt、状态刷新、拒签/失败/未知状态恢复记录；unsigned simulation不能替代 |
| 真实数据与最终交付 | API rollout及前置合并后，仅复验受影响的费用/余额/账户freshness与参数链；精确整理原#3258差异 | 实际交付目录检查、最终head CI和review收口；保持Draft直至另行授权 |

有限价格BTC/USDC三订单1255→1204 bytes及slot469599277模拟已经完成，不再列为未修复阻碍；最终可信表或订单组合变化后仍检查体积。开发 `1b236e12da`，交付 `7a47de7b90`。


## 四 PR 目标执行（2026-11-15）

实现零minOutput紧凑编码、严格等价验证，有限价格三订单1255→1204 bytes；当前主网无签名模拟err=null，三个订单账户均返回。 完整版本、验证与外部条件见[统一执行结果](../solana-trading-dependencies.md#四-pr-目标执行结果2026-11-15)。本节优先于下方历史1255-byte限制及候选。


## 上游刷新与证据边界（2026-11-14）

本轮新增事实、契约适配、交付及验收结果见[四需求统一记录](../solana-trading-dependencies.md#四需求上游刷新2026-11-14)，优先于下方历史状态。Linear目标访问返回Entity not found，不能据历史正文或评论判定本轮实时状态；GitHub、源码及部署按统一记录分别核验。


## 五条内部依赖同步收尾（2026-11-13）

已在原development消费72正式18文件补丁并独立验证，再精确转入原delivery；Draft #3258现head `0091a24556`。两目录各3435 passed/1 skip、types和production build通过。 完整版本矩阵、验证边界和已保留的依赖顺序见[统一记录](../solana-trading-dependencies.md#五条内部同步结果2026-11-13用户限定不处理外部依赖)。用户本轮明确暂不处理五条之外的依赖；不将本次内部同步视为完整需求验收。

## 交易链路依赖统一核验（2026-11-13 16:16）

本轮参与跨需求依赖分析，核对实际集成版本、PR堆叠和merge-tree预检。新增结论、责任边界与跟进顺序统一见[交易链路依赖审计](../solana-trading-dependencies.md)，不将预检当作实际合并或组合测试通过。

## 当前状态复核（2026-11-13 16:08，Asia/Shanghai）

角色：只读状态与依赖调研。实时查询正文、双向关系、评论、关联 PR checks，并对照既有实施记录；本节优先于下方历史状态。

实时 Linear 为 Review、kenny，无评论；GitHub #3258 仍 OPEN/Draft，head `b2fdb4c745`，无已提交 review。Audit、常规 lint/types/tests、SDK standalone 均 SUCCESS；组件 job FAILURE 沿用已核实的报告发布/评论 403 边界，不是新增用例失败。本轮没有重跑测试、查询 LUT 链上状态或签名广播。核心交易构建/校验/发送与 slot floor 修复已交付 PR，四钱包与主网落链仍未验收。71 实时仍 Todo、Divhead、无评论或新地址。19/20 已接入后续安全修复和 72 新 WASM，不能再沿用旧段落称下游未同步；56 原 PR 自身仍不因此视为升级新版 WASM。

更新：2026-11-13（Asia/Shanghai）。角色：依赖调研、实现与验收。核心交易能力已实施，完整主网验收未完成；下方初始调研及各阶段结果按时间保留，不将旧观察视为当前状态。

## 最新依赖同步：FESOL-57

2026-11-13 已在 `solana-order-transactions-fesol-56` 合并 #3242 最新 head `f16deff8a71516bd987a17334f218ed08c1fa9bd`，merge commit `b7ee2e27f1e98737db99d70e302eba79264bcfb3`；无冲突，保留 FESOL-92 units 导出。SDK 全量 64 文件/952 tests passed，原始 BTC dust 输入独立复验通过（不再除零），FESOL-56 交易/钱包/LUT 定向 4 文件/12 tests passed；变更文件 lint/format、SDK types/CJS/ESM 产物重建、主应用与 landing 类型检查通过。日志 `/tmp/fesol56-sync57-{sdk-tests,dust,transactions,sdk-build,lint,format,types}.log`。未重新进行 UI、主网模拟、真实钱包签名/广播或 Rust reference 对比；受信任 LUT 与四钱包/keeper 验收仍待完成。完整同步证据见 [FESOL-57](FESOL-57.md)。

## 初始需求与依赖调查
需求：[FESOL-56](https://linear.app/gmx-io/issue/FESOL-56)。Linear 实时抓取自 2026-11-13 00:03 起；GitHub 同轮核验。个人基础 `solana-integration`；本轮已提交依赖知识并创建独立开发 worktree。

## 判断与执行边界

可以开始不依赖线上环境的 ABI 核验、构建器与确定性指令校验工作；不能据此宣称前置全部完成或进行完整主网验收。FESOL-92 是明确要求先合并的 SDK 单位转换成果；FESOL-57 提供 keeper fee 等语义，影响费用校验与金融集成，但不是所有构建/校验开发的统一开工门槛。不要重写这两项已有实现。

FESOL-56 范围含 market/limit increase、market decrease、TP/SL、原子 increase+TP/SL、update/cancel、缺失 position account 的准备，以及每次签名前模拟/指令账户校验、Privy Solana 签名、发送前 fresh flag、RPC 发送确认。FESOL-19/20/59 是下游或消费方，不是应全部等完的前置。

## 当前依赖与 PR

远端 release 本轮观察 SHA：`24cd9b16d65b1ed4daae4c90c81c253588e8938d`。通过 GitHub API 读取远端树与 PR diff，该 release 已是个人基础与开发分支的祖先，无需额外 release merge。

| 依赖 | 观察结果 | 对 56 的影响 |
| --- | --- | --- |
| FESOL-92 | Review，Sulliven；[UI#3243](https://github.com/gmx-io/gmx-interface/pull/3243)，OPEN、非 Draft、head `5e081e5ab140ba41d8f816c317b8361bf5a8787c`；当前检查全成功，REVIEW_REQUIRED，无已提交 review | 复用单位/精度/舍入/range helpers；需求要求 SDK-only PR 先合并 |
| FESOL-57 | Review，Rainer；[UI#3242](https://github.com/gmx-io/gmx-interface/pull/3242)，OPEN、非 Draft、head `6d3ed92ca64129cb4d5ab8d26a9c1baff6563802`；REVIEW_REQUIRED，无已提交 review；常规 lint/type/tests、SDK standalone build、预览成功，组件 job 失败 | `getGmsolExecutionFee` 区分至少 300,000 lamports 的 keeper max、可退 rent；网络费另计。金融数学在共享 SDK，以数据字段启用；不应私自复制到 56 |
| FESOL-51 / 89 / 96 | 51 Review，89/96 Execution；[UI#3195](https://github.com/gmx-io/gmx-interface/pull/3195) 同时包含余额 reader/hook，head `2495be2`，checks 成功但 CHANGES_REQUESTED；[UI#3190](https://github.com/gmx-io/gmx-interface/pull/3190) 为重叠 Draft、组件 job 失败 | RPC、原始 SOL/ATA 余额及确认后 mutate 的集成依赖；沿用 109 中收敛到 3195 的方向，不维护两套 reader |
| FESOL-71 | Todo，Divhead；本轮正文无评论，无已核实交付证据 | 开发者自有小额钱包、参考 TP/SL position/limit order、ALT frozen 或 GMX-owned 替代、solanaTrading true；主网验收仍需核实这些条件 |
| FESOL-42 | Done；[UI#3110](https://github.com/gmx-io/gmx-interface/pull/3110) 已合并；远端 release 有 Solana session 模块 | 连接基础已有；四钱包实际带 ALT 交易签名/落链仍由 56 验收 |
| FESOL-50 | Release；[UI#3138](https://github.com/gmx-io/gmx-interface/pull/3138) 2026-11-05 合并至 release；远端有 oracle fetcher | 复用价格与 mint 映射，不等另一个同功能 PR |
| FESOL-55 | Done；[UI#3082](https://github.com/gmx-io/gmx-interface/pull/3082) 已合并；远端有 loader/fresh trading flag | WASM 基础已有，实际每条签名/发送路径的接入仍由 56 完成；历史验收材料为 partial，不冒充本轮运行验证 |
| FESOL-60 | Done；评论明确复用 src/config/rpc.ts 中已有 Alchemy keys | 不申请新 key/替代 RPC；本轮未实测当前目标环境 CORS、模拟或发送能力。3195 后续 review 已确认开发 key 可用，不能沿用其早期描述断言 key 仍坏 |
| FESOL-49 | Done；配置有 provisional lookup tables | 源码注释说 2026-10-20 两张表仍有 authority，仅历史观察，当前 authority 需重新链上核验 |
| FESOL-72 | Execution，kenny；按编号搜索未发现专门 PR | 图上是 56 blocks 72，不能反解为必须先完成 72 才能写 56；但最终 GMX artifact/版本/hash 和替换后流程复验属于公开发布条件。正文 v0.10.0 与 57 的 deployed 8af1e70c/0.11.0 参考目标需协调 |

## 新发现与可接续核验

- 3242 和 3243 都从无文件状态新增 `sdk/src/utils/gmsol/index.ts`，分别放数学 helper 和 units re-export。两项成果整合存在 add/add 冲突，必须保留双方导出；本轮已解决实际冲突并保留双方导出，组合 SDK 测试通过。
- 3242 的组件 job [日志](https://github.com/gmx-io/gmx-interface/actions/runs/43032469754/job/130562748858) 显示 Ubuntu 软件源 DNS 失败，Playwright 浏览器依赖安装退出 100，随后没有报告目录且 gh-pages 发布失败。不能把自动评论的 “Some tests failed” 当作数学/组件断言失败证据；该 job 仍未通过，需重跑。
- 3242 变更文件不含 Rust generator、reference JSON 或完整 harness；Rainer 通过 [PR 评论附件](https://github.com/gmx-io/gmx-interface/pull/3242#issuecomment-6798273490) 提供 `fesol57_harness.zip`。57 正文要求 generator/JSON 进入 PR；可复现测试如何纳入版本控制仍需 review 确认。本轮未下载该附件与本地 zip 作同一性比较。
- `@gmsol-labs/gmsol-sdk` 当前固定 `0.9.0-test.2`，本地声明含 create/update/close 及 TransactionGroup，但接口存在不证明支持所有 ABI/原子组合。`TransactionGroup.serialize()` 是嵌套数组，必须验证实际交易数、账户顺序和 size，不能把一个 group 当一笔原子交易。需要钉住 blockhash、nonce、metadata/hints、callback/referrer、账户存在性与 LUT 内容后做 builder 正例和恶意变体。
- [FESOL-112](https://linear.app/gmx-io/issue/FESOL-112) 本轮为 Todo；按编号未发现专门 API PR。它消费已发布 57 SDK，并在索引部署上做金融和 minContextSlot 核验；属于整合金融验收依赖，不是纯 builder/validator 开工前置。[UI#3193](https://github.com/gmx-io/gmx-interface/pull/3193) 数据基础仍 OPEN、REVIEW_REQUIRED、checks 成功，影响后续真实 UI 数据/刷新集成。未对 API indexed rollout 作本轮工程验收。

## 用户提供的测试包

已静态读取 `/Users/kenny/Downloads/gmsol_test.zip` 的 README、入口、测试引用、Cargo pin 与 JSON 元数据；已执行 SDK 对比测试和组合构建；未重算 Rust、抓取链上快照或交易。

- 固定 Rust commit `8af1e70c0c0b6ff9d6b41ba4997910588fbcec28`；12 个真实 position（10 市场，capture 2026-11-11T09:50:13Z）加 21 人工场景。真实 inputs SHA-256 `6c901b5b5fabb7e864b55015d4987088d3d08ef222428d85e90290b92d42266c` 与 expected.inputSha256 一致。
- 比较指定 checkout 的 SDK TS 源码，不要求单独 SDK build。默认用已保存 inputs 重跑 Rust 并核对 expected 后再比 SDK；不必先重新抓取链上快照。`--skip-rust` 仅比保存结果，不能称作本次 Rust 重算。
- 包含非零折扣及 increase/decrease 人工场景，超出 Divhead 最早仅 open-position/zero-discount harness 的范围。在 3242 原 head 和组合分支分别以 `--skip-rust` 运行，均 38 项通过；这是保存的 Rust expected 对比，不是本轮重算 Rust。
- 不覆盖指令/账户 allowlist、模拟、四钱包签名、广播、keeper 实际执行；不能作为 56 主网验收。默认不进入常规 SDK/frontend 测试命令。没有核验当前链上部署仍为该 Rust commit。

## 建议顺序

优先推动 3243 review/合并，核验 3242 的费用契约与独立参考证据、重跑 CI 并 review；同步收敛余额到 3195，并让 71 准备运行条件。56 可先做当前 pinned ABI 与原子性验证、构建及确定性指令/账户校验，依赖成果稳定后接上真实费用/余额/RPC/签名/flag。主网验收最后核实版本、ALT、钱包与开关，并按授权执行；最终产物替换后的必要复验不可省略。

## 2026-11-13 开发分支准备结果

- worktree：`/Volumes/kenny/gmx/gmx-interface-fesol-56`；分支 `solana-order-transactions-fesol-56`；HEAD `bac31f3a06`。基线 `8a3a2ad6d66479e009e4ddafabe07c212b50ab92`；release `24cd9b16d65b1ed4daae4c90c81c253588e8938d` 已包含。
- 按顺序 merge UI#3243（92）、#3242（57）、#3195（51/89/96）、#3193（52）、#3205（113 fee fields）、#3207（113 order fields）。后两项是 stacked API 字段补齐，避免 56 重复定义订单/折扣契约。没有 merge 重叠 #3190 或下游 positions/charts/selector UI PR。
- 冲突解决保留 gmsol 数学与 units 导出、Solana RPC tracker 注册与新 EVM syncTracking 生命周期、最新 API 严格字段 reader 和 Solana order composition。两个旧 stacked 测试的 SDK 构造参数 `networkId` 改回当前 `chainId`（上下文仍支持 networkId），初次 2 项失败随后全通过。
- 用户授权本次分支准备的提交命令临时不签名，不修改长期签名配置。用户另明确长期授权本仓库开发验证构建（含 SDK/WASM），已更新 AGENTS.md。
- 没有推送、创建 PR、发布 review 或修改 Linear；没有修复下面的业务缺陷，以便依赖作者和 56 实施阶段清楚区分归属。

### 审查发现：已复现缺陷

**P2 / UI#3242：正数 dust increase 可导致价格预览除零。** `sdk/src/utils/prices/utils.ts:201–217` 的 gmsol 分支把 USD 换成原始 token amount 后直接用 `size` 作除数。使用仓库 BTC 的 8 位精度、价格 $100,000、size $0.0001、零 impact、long increase 时，baseSize/size 均为 0，抛出 Division by zero；同输入非 gmsol 路径不抛。调用路径为 `sdk/src/utils/trade/increase.ts` 的共享 increase 计算调用 getAcceptablePriceInfo。应处理正数金额舍入为 0 的无效预览，沿用统一校验反馈，不通过随意调整单位/伪造价格兜底。临时复现 2 项通过（含下述 sentinel）；scratch 已移出源码，没有作为产品修复提交。当前线上 tradeMath 尚未启用，因此不能声称现有生产页已发生该崩溃。

### 审查发现：组合契约缺口（区别于原 PR 独立范围内的回归）

1. **余额没有接入统一 TokensData。** #3195 提供 reader/hook，当前只接钱包资产展示；#3193 的 `src/domain/gmsol/tokens/buildGmsolTokensData.ts:17` 只组合 token/prices，provider 未消费 useSolanaBalances。共享 `trade/utils/validation.ts:400` 把 undefined balance 当 0，因此有余额的钱包仍可能被交易校验拒绝。56/消费 UI 需让统一状态消费已有 hook，并复用该缓存做确认后 mutate，不能再平行维护一套余额。
2. **update/cancel 所需的订单账户上下文被丢弃。** #3207 已解析字段，但 `composeGmsolOrdersInfo.ts:14–20` 删除 actionState/orderAccount/positionAccount/rentReceiver，后续 EVM mapper 也没有保留 Solana typed metadata 的契约。既有 review 中作者明确表示当时没有 reader；这是显示范围的有意裁剪，56 成为新消费者后需扩展统一 OrderInfo 或关联 typed metadata，不能假定解析成功即 UI 可用，也不建议交易时临时另建平行状态。
3. **数学启用与 fee discount 参数未接通。** 只读查询 `https://solana.gmxapi.io/v1/markets/config` 的 67 项均无 tradeMath；FESOL-112 仍 Todo。provider:322 把 orderFeeDiscountFactor 写入 proDiscountFactor，而 57 的 gmsol fee 分支读取单独的 feeDiscountFactor（`sdk/src/utils/fees/index.ts:54–56`），src 的消费链未传该新参数。需联动 API rollout 与统一计算参数；不要在 UI 单独强开 tradeMath 来掩盖 API 未部署，也不要把“今天未启用新数学”当成新数学可用。
4. **无限 acceptable price 哨兵需要 builder 语义适配。** `sdk/src/utils/trade/increase.ts:896–897` 的 long limit/stop 分支可能返回 maxUint256；92 的 `appTokenPriceToGmsolUnitPrice` 严格 u128 检查拒绝它（复现通过）。92 的范围检查本身正确；56 应按固定协议 ABI 表达 unlimited/optional bound，不能机械转换 EVM 哨兵或删除检查。具体表达需对 pinned SDK/链上版本核实。
5. **参考测试尚未版本化进 #3242。** 用户 zip 的保存基准对比 38 项通过，但 PR 没有完整 generator/reference JSON，附件不能替代持续回归。建议作者将可重算工具和固定版本样本纳入 PR/CI。组件 job 的失败是 apt DNS/Playwright 安装问题，不能报告为数学断言失败；仍需重跑。

### 验证与边界

目标 worktree 独立 immutable install（root、SDK，skip-build）完成，未复用其他 checkout 的 node_modules。SDK 全量 63 文件、948 tests 通过；Rainer zip 对组合分支 38 tests 通过（skip-rust）；BTC dust/sentinel 2 项复现通过。SDK 受管理 prebuild/types/CJS/ESM 构建通过，WASM hash 保护的 Vite bundle 构建通过。根主应用与 landing 类型检查通过；完整前端 335 文件通过、1 文件跳过，3,414 tests 通过、1 既有跳过。页面首轮 1 通过、1 失败：flag-off 用例 15 秒内未出现网络选择器，snapshot 仅 loading；独立复验两项全部通过（0 skipped/flaky/unexpected），未修改测试，两个运行的 owned Vite 端口均释放。首轮超时原因未证实，不能归因特定 PR。

原始日志保留本机 `/tmp/fesol56-{sdk-tests-final,harness-combined,repro-final,sdk-build,wasm-build,frontend-tests,root-types,browser,browser-final}.log`；SDK 构建收据在目标 `.local/acceptance/sdk-artifacts/build-WjPJEi/`。这些是本机证据，非已提交可移植测试材料。未执行真实钱包/ALT 签名、模拟发送、广播、keeper 验收；FESOL-71/72 的条件与部署版本仍须单独核实。

页面复验报告：目标 `.local/acceptance/solana-browser/managed-lzlRi8/report.json`；首轮失败：`managed-gn64M8/report.json`，均保留截图/trace 与日志。后续若复发，优先定位加载阶段，不能用这两项基础冒烟替代交易 UI 验收。

## 2026-11-13 实施进行中

业务现场仍为 `/Volumes/kenny/gmx/gmx-interface-fesol-56` 的 `solana-order-transactions-fesol-56`；基础目录维持 `solana-integration`，没有把业务改动写入基础。已实现但尚未提交：固定 WASM ABI 的 create/update/cancel、prepare position、原子增仓加 TP/SL 单笔重编译、完整指令/账户校验、模拟/签名/发送边界、Privy Solana 签名桥接及确认后刷新统一缓存。Order.solana 保留原 API 订单账户上下文，解决显示 mapper 丢失问题。

固定外部 SDK 为 `@gmsol-labs/gmsol-sdk@0.9.0-test.2`，ABI 对照协议仓库 v0.9.0（c6778dc9）。该版本高级 create API 内部生成 nonce，默认 keeper fee 300000 lamports，不暴露显式 nonce/自定义 execution fee；禁止误称支持。回调、swap remaining accounts、Token-2022 尚未扩展 allowlist，明确拒绝并留 TODO。WASM TransactionGroup 不等于 atomic；原子组合只有在单笔 v0、1232 bytes/1.4M CU 限制内才接受。

真实 WASM 正例已覆盖五种订单双向及 update/cancel、native wrapping、LUT 原子组合；恶意指令/接收人/金额/截断/LUT、实际 Ed25519 本地签名和发送边界的定向测试在补充中，尚不作为最终全量通过记录。SDK 新 Order 字段生成构建通过；root 类型检查曾通过，后续安全修正仍需最终复验。

用户已解锁现有 kenny Chrome 的 Phantom；只操作该窗口，禁止 Chrome DevTools/Playwright 或新 automation profile。当前本任务 Vite 为目标目录 127.0.0.1:3016。主网四钱包/交易/keeper 验收尚未完成，不能用本地签名测试冒充。FESOL-19/20 负责完整下单 UI/回执，本需求提供可消费适配器，不新增平行产品页面。

### 实施与实际验收结果（2026-11-13）

- 固定 WASM 构建覆盖 market/limit increase、market decrease、TP/SL、update/cancel，prepare user/position/ATA、精确 SOL wrapping，最多一笔增仓加一 TP/一 SL。原子组合重编译为单笔 v0，去除完全相同的幂等准备指令，严格保持用户价格/金额意图。最多 1232 bytes、1.4M CU；超限明确拒绝，不降级成多笔伪原子。
- 全部交易/指令/参数/账户/nonce-PDA/LUT 解析、payer/owner/receiver/rentReceiver、回调拒绝和具体 ABI 均做确定性校验；签名前真实 RPC 模拟、费用和余额检查；Privy Solana 只签字节，验证消息不变及真实 Ed25519 签名，签名前及每次广播前实时 flag/session/blockheight 再检。确认刷新统一余额、订单、仓位缓存，并传 minContextSlot；已确认链上成功与 API 刷新失败分开返回。
- 多笔动作只检查当前交易的 keeper/wrap 预留，避免之前准备步骤花费后仍要求整计划预算。`GmsolTransactionError` 保存已接收的 signatures 和可能已广播的 pendingSignature；send RPC 超时也必须先查签名，不自动重试下单。
- 订单 metadata 以可选 `Order.solana` 保留，update 校验原 order kind/side 与已知 market decimals；修正 update minOutput：增仓为 token 原始单位，减仓为 app USD。已有 57 dust 预览、统一余额与 discount/math rollout 缺口仍按上文归属，不能因 builder 完成而视为解决。
- 现有 kenny Chrome/Phantom 连接成功，Solana 共享页行情/钱包头部正常；钱包选择弹窗列出 Phantom/Solflare/OKX/TokenPocket。联调发现 Privy useSignTransaction 每 render 返回新函数，已用 ref 避免会话发布 effect 循环，并有回归测试。共享 trade 按钮仍显示“连接钱包”是下游 FESOL-19 的消费/统一状态接入缺口，本次没有伪造完整下单 UI 已验收。
- 真实 GMX RPC mainnet genesis 正确，实时 solanaTrading=true。两个配置 LUT 分别 73/155 个地址，authorityOption 均 1、active，**仍可变**；生产 prepare 明确拒绝“Trading requires frozen lookup tables”。FESOL-71 须提供冻结表/GMX 审查后的冻结副本，且核验内容对所需市场和原子组合的覆盖。
- 为覆盖实际协议执行，仅在忽略的本地只读验收工具中用现有可变 LUT 的快照做诊断模拟；没有签名或广播，也未放宽生产入口。连接 Phantom 的公开 account 上，BTC/USDC limit increase 成功（807 bytes，网络费估算 45000 lamports）；increase+TP 成功（1044 bytes/55000）；increase+TP+SL 成功（1221 bytes/65000），最后确认模拟 slot=468611155。后两例 TP/SL 使用明确 unlimited acceptable price（协议 None），不是自动修改有限边界。
- 相同 3 单均指定有限 acceptable price 时为 1255 bytes，超过 1232，安全拒绝。不能为追求塞进单笔而静默删用户边界；FESOL-71 还需更完善的 LUT 覆盖。冻结现有内容本身不证明所有输入能原子发送。
- 全量 frontend 337 文件通过、1 既有文件跳过；3423 tests passed、1 既有 skipped。最后安全/会话修正后定向 4 文件/12 tests passed；root+landing typecheck、变更 ESLint、Prettier 与 git diff --check 均通过（退出码已核对）。首次 production app build 在 render chunks 达默认 Node heap 上限；以命令级 8 GiB heap 重试成功，含 hash 保护的 WASM bundle 与 Solana 生产模块隔离检查。

当前业务说明及 TODO 在需求分支 `src/domain/gmsol/transactions/README.md`。未完成主网广播/keeper 和四钱包真实 LUT 签名验收；固定 SDK 高层 create 不暴露显式 nonce/自定义 execution fee；callback/swap/Token-2022 均拒绝而非推测性兜底；FESOL-19/20 消费 UI/回执与 FESOL-112 数学部署仍需继续。这些是明确范围/条件限制，不声称 FESOL-56 所有验收项已通过。

本轮可复用日志：`/tmp/fesol56-implementation-full-tests.log`、`/tmp/fesol56-final-targeted.log`、`/tmp/fesol56-final-{root-types,landing-types,lint,format}.log`；首次 OOM `/tmp/fesol56-final-app-build.log`，8 GiB 重试 `/tmp/fesol56-final-app-build-8gb.log`。忽略的本地浏览器验收工具在目标 `.local/fesol56/`，使用 native CUA 操作原窗口；不可把诊断绕过冻结检查误当作生产准备通过。


收尾：业务提交 `a8733143f47230d996303d174b2ca9dcaf0b1c87`（Build and validate Solana order transactions FESOL-56），需求 worktree clean；本地目标绑定更新至此 HEAD。基础 issue 记录独立提交，业务没有整支回流个人基础。原 kenny Chrome 标签页留回 `http://127.0.0.1:3016/trade`；本任务 Vite 保留供用户检查，未创建新的浏览器/profile。没有 push、PR、Linear 修改或外部 review。主网生产验收未全部通过，TODO 条件如上；本轮完成可独立实施与验证的最大范围。


### 继续验收与收尾修正（2026-11-13）

- 增补真实无签名 compound simulation：create+update 897 bytes/slot 468614384，返回协议 Order 2472 bytes，按 pinned ABI offset 2184 读取 size_delta_value=2000000000000000000000（20 USD）；create+cancel 869 bytes/slot 468614384、create+update+cancel 959 bytes/slot 468614385 均成功，返回 System Program owner、lamports=0、dataLength=0。诊断组合由各自 builder+validator 通过的动作拼接，不是产品新增动作；不等价于分别落链及索引已确认。
- 缺失 user/position 真实模拟成功（slot 468617037）：随机临时 owner/user/position 预先查询均不存在；诊断交易用已有钱包在模拟中提供资金，并接生产 builder 的 native SOL limit order。1004 bytes、120254 CU，返回协议拥有的 user 520 bytes/position 680 bytes。未持久保存临时私钥、未签名、未广播；生产 allowlist 未加入任意资金转移。
- 修正异步生命周期：组件卸载后禁止开始 submit、prepare 完成后的签名及广播；发送过程的 live wallet getter 同时要求 owning flow mounted，已广播交易仍继续查询并刷新缓存。新回归测试覆盖 preparation 尚未完成时卸载，不触发 sign/send。
- 重新实时读取 FESOL-71：Todo，updatedAt 2026-11-03T15:43:51.287Z，无评论/替代地址。正文要求各开发者自有钱包、第三方表未冻结则用 GMX-owned copies，并没有要求 GMX-owned copies 必须冻结。前一阶段规则只允许 frozen 过严，已改为 frozen 或配置中逐表登记的已核实 GMX authority；`GMSOL_LOOKUP_TABLE_AUTHORITIES` 当前为空，不把现有第三方 authority 当作 GMX。再次在现有 Chrome 真实读取，仍拒绝当前表，错误为 Trading requires frozen or reviewed GMX-owned lookup tables。
- 最后修正的 5 文件/14 tests 通过，root typecheck、变更 lint、format/diff 检查通过，生产 build（命令级 8 GiB heap）通过。复用上一阶段全量 3423 passed/1既有skip及 landing 类型检查，未宣称全量在新增修正后重跑。日志 `/tmp/fesol56-trust-{tests,types,lint,build}.log`、`/tmp/fesol56-continuation-format.log`。
- 完整验收仍有未完成项：受信任 LUT provisioning、四钱包真实 LUT 签名与落链、keeper 执行；不绕过生产 trust gate，不擅自创建链上 LUT/消耗钱包余额。继续条件及产品限制仍在业务 README。基础目录同时出现其他 progress/AGENTS 文档改动，未纳入本任务提交。


### 最后一轮独立完善（2026-11-13）

本轮目标是在用户协调 FESOL-71 前，完成不依赖真实签名/广播的最后一轮实现、审查与验收。沿用既有 FESOL-56 目标；目标工具拒绝为未完成旧目标新建另一目标，原目标仍 blocked，不能把本轮完成冒充整个 issue 正式验收完成。

- 实际修复：`prepareGmsolOrderTransactions` 在等待 LUT/blockhash RPC 前 `structuredClone` 原始 action，防止调用方在等待期间修改金额等输入，改变用户原本要求准备的订单。新增回归通过真实 WASM 构建和 validator 验证保持原金额。
- 增补真实 SDK 数学→92 单位→WASM 指令解码测试：五种订单×双向、价格向更严格方向舍入、trigger 方向、token/USD minOutput、limit 无限哨兵；签名拒绝、签名后切钱包、签名前后过期、无效 Ed25519、无法估费均不广播；确认超时保留 accepted/pending signature；前置准备已确认但后续订单拒签时保留已确认结果。
- 原子包大小独立诊断：现有表快照 slot 468760972，有限保护 increase+TP+SL 仍 1255 bytes，13 static accounts、仅一条 prepare_position、三条 create_order_v2。检查 store/marketToken/indexToken/longToken/shortToken/market PDA/eventAuthority/storeWallet 都已在表中；“缺少这些固定地址”与“重复 prepare_position”假设均不成立，实验去重修改及诊断错误输出已撤掉。复制/冻结相同表不会自动解决该例；这是 56 仍需优化或明确支持范围的限制，不能全部归给 71，也不能去掉价格保护或拆单掩盖。
- 原生操作现有 kenny Chrome：生产 trust gate 在 2026-11-13T02:36:33Z 再次拒绝当前表；Phantom 连接可用，OKX 扩展在 onboarding、未配置钱包，Solflare/TokenPocket 未安装。未创建/导入钱包、接受条款、签名、广播或创建 LUT。本轮自行启动的 Vite 来自需求 worktree，127.0.0.1:3016；并未重启未知 API 服务。
- 需求边界复核：最新 56 正文要求四钱包真实 LUT 签名落链、limit/edit/cancel/atomic，以及签名前校验；caller nonce/custom keeper fee/callback/routed swap/Token-2022 不是正文硬性未完成项，作为固定接口限制说明。19 页面、20 索引状态、59 操作 UI、112 数学部署属于各自需求；keeper 执行是另行集成验证，不混入 56 自身未实现项。业务 README 已改成验收矩阵、明确 TODO 与真实验收步骤。

协调 FESOL-71 时需要：主网表地址、逐表 authority 及 GMX 归属核验依据、active/frozen 状态、市场覆盖；owned copy 不强制冻结。交付后 56 更新配置并验证，不以只拷贝表代替包大小检查。真实验收还需要各钱包已配置、选定账户及小额预算/交易授权，按 README 分别记录签名、slot、钱包版本、表身份与落链结果。


最终稳定源码提交 `722d1cdbaa`（`Harden order intent preparation and verify transaction boundaries FESOL-56`），需求 worktree clean。实验 builder 修改全部撤回后重新跑完整前端：339 文件通过、1 文件跳过，3431 tests 通过、1 既有跳过；`yarn tscheck`（主应用+landing）、变更 ESLint/Prettier/diff 均通过；8 GiB 命令级 heap 的 `yarn build-app`（含 pinned WASM）通过。日志 `/tmp/fesol56-final-stable-{tests,types,lint,format,build}.log`。SDK 本轮未改，复用上一轮最新 57 集成后全量 952 passed，不声称本轮重跑 SDK/Rust。5 个新增行为测试纳入现有实际 WASM suite，属于原需求交易安全/数学组合验收切片，不是只给两行修复添加的分支镜像测试。

将账户准备移到独立前置交易、仅让三个订单原子落链是后续可评估的包大小优化方向；当前 validator 要求 atomic plan 只有一笔交易，改变该策略还需重新证明账户准备、每次签名前校验、部分成功和费用/有效期边界。本轮不未经验证自动启用该策略。56 最新正文明确允许在支持限度外显式失败，因此保留明确限制与 TODO，仍尽量实现并验证支持范围。

本轮没有真实钱包签名、广播、链上 LUT 写入、Linear 更新、外部评论或创建 PR。业务提交仅本地保存；个人知识按自动沉淀规则提交并推送 my-gmx。原 FESOL-56 全量目标保持未完成：等待受信任 LUT、四钱包实际签名落链和原子包限制收敛，不能将已通过的无签名模拟当作这些正式验收。


### Draft PR 交付准备（2026-11-13）

用户明确要求向 release 创建 Draft PR，并进一步授权本次 Draft 带必要的未合并前置代码、剥离个人基础设施、在正文列清依赖。交付目录 `gmx-interface-fesol-56-release`，分支 `solana-order-transactions-release-fesol-56`，从实时 release `e471428074` 重建。转入此前依赖 merge 的 first-parent 产品差异（92/57/51/52/113）、SDK constructor 测试修正、57 最新 f16deff8，以及 56 三个业务提交；未带 AGENTS/docs 知识、个人 scripts/tools、package 管理脚本或 Vite 个人测试配置。172 文件，包含前置范围，不能称为纯 56 独立可合并 PR。

实时上游 #3242/#3243/#3195/#3193/#3205/#3207 均 OPEN。#3193 当前 head `258e4da6abafc75c683983993544f4eb9c1a8abc` 比集成的 `732b4a1322` 新，本次保留已测试集成版本，PR 明列这一边界。56 Execution、71 Todo，正文及评论无新替代 LUT 地址。重建唯一冲突在 indexers/utils：保留最新 release 的 IndexerKey（不恢复已移除的 stats），同时保留依赖的 getConfiguredIndexerUrl；一处依赖格式修正。新目录 SDK 安装/构建完成，SDK 952 passed、前端 3431 passed/1既有skip、app+landing types、变更 ESLint/Prettier/diff 通过。生产 app/WASM build（8 GiB heap）也通过；最终发布结果待补。

最终交付 GPG 签名实际失败（口令输入界面不可用），未禁用长期签名配置、未绕过最终 PR 签名规则。已向用户请求本次 Draft 命令级不签名例外或自行解锁；答复到达前不创建无签名交付提交、不推送。


Draft 发布完成：用户明确允许本次最终 Draft PR 提交命令级不签名，提交 `76e9486b96cbfe9d6316996f786701181241f4de` 已推送 my-gmx-pr。[UI#3258](https://github.com/gmx-io/gmx-interface/pull/3258) 实际核验 OPEN、isDraft=true、base=release、head=solana-order-transactions-release-fesol-56，无 reviewRequests；创建后 GitHub CI 已启动、当时仍运行中，不宣称已通过。PR 正文包含所有依赖版本、交付目录实际测试、LUT/1255-byte/四钱包/preview 未完成边界。后续业务修复唯一现场为登记 delivery `gmx-interface-fesol-56-release`，旧开发分支保留作历史，不再双线修改。原整体实施/正式验收目标仍未完成。


### gmx-prompts 标准 PR Review（2026-11-13）

review 角色；目标 [UI#3258](https://github.com/gmx-io/gmx-interface/pull/3258)，head `76e9486b96cbfe9d6316996f786701181241f4de`、最新 release/base `e4714280749c00a90468abdde3060aae619717e7`。采用 gmx-prompts `72041619ae` 的 gmx-interface-review、review-rules、runtime-checks 与 reviewer-map，按 T3 处理资金/签名改动。当前 HEAD 已包含最新 base，直接审查登记 delivery 即当前合并结果。手工执行通用正确性、安全、数值除法、交易步骤、guard、值语义及状态生命周期检查；没有可调用的 `/code-review`、`/security-review` 命令，不宣称调用过。未修改业务代码、未发布 GitHub review/comment、未修改 Linear。

**结论 NEEDS CHANGES；确认一项 P2 缺陷：** `src/domain/gmsol/useGmsolAccountData.ts:90-102` 在确认交易后以全局 SWR mutate 写入普通 positions/orders 数组，但相同 key 的消费者 `useSWRWithFreshness` 实际缓存协议是 `{ value, fetchedAt }`，读出 `data?.value`。因此成功的 slot-aware 请求会令已挂载 hook 的数据变为 undefined，同时 isLoading=false、error=undefined；订单/仓位不能立即正确反映已确认结果，通常等下一次成功定时请求（orders 5s、positions 15s）恢复。不是 FESOL-71 的前置缺失，也不是 FESOL-57 数学问题。

用真实 SWR、真实 useGmsolOrders 与实际 refresh 方法复现，仅 mock SDK 网络响应：slot1 的 before 列表正常，slot2 的 after 列表刷新后 data undefined/isLoading false/error undefined。scratch 1 test passed；日志 `/tmp/fesol56-review-repro.log`，测试源码已移至 `/tmp/fesol56-review-repro.spec.tsx`，delivery 恢复 clean。建议使主动 mutation 遵守 freshness envelope 或统一 freshness-aware 的刷新入口，保留 minContextSlot/旧 slot 拒绝机制，并补实际 hook 的确认后数据回归（不能只断言 mutate 被调用）。本次 review 未修复。

核对 pinned Solana protocol v0.9.0/c6778dc9 的 order 指令及状态语义、当前 gmx-api main `cf9fe279ac1dd5a852783a1e7404e16f92378820` 的 order/snapshot 处理。原子 1255-byte 限制、LUT trust、四钱包实际落链是 PR 已披露边界，未包装成新发现。`toGmsolUpdateParams` 不支持恢复无限价的限制已明列；其“ABI 不能清空”解释需谨慎，协议 Some(0/u128MAX) 是数值，不因 Option 就证明协议本身无能力；本次不把已声明支持范围当新缺陷。#3193 最新 head 的差异为共享 SDK provider 迁移，PR 已披露集成旧版本，未确认新的阻断缺陷。

验证复用相同 delivery 源码、依赖和配置的完整结果：SDK 952 passed，frontend 3431 passed/1 既有 skip，app+landing 类型检查、变更 lint/format、生产 build 通过；本次新增运行上述实际 SWR 复现。现有 kenny Chrome 原生操作本次 3017 生产构建预览：Solana DOGE 行情/图表加载，切 Arbitrum 后返回 Solana，再 reload 能恢复行情。未新增浏览器/profile，未签名广播；结束已关闭自己创建的预览 tab、停止自己启动的 preview，原3016现场未动。未完成 flag off/on 完整组合、逐 host 请求计数、console/storage 审计，不将页面可见正常等同于这些检查通过。

实时公开 `https://solana.gmxapi.io/v1/markets/config` 返回数组，未含 tradeMath；这是已知数学 rollout 边界，不能以本地数学测试证明线上已启用。正式验收：五种订单/方向/单位与价格舍入有自动化证据；create/update/cancel 与支持范围内 atomic 有既有无签名 mainnet 模拟证据；确认后共享缓存要求本次失败；受信任 LUT、四钱包真实 LUT 签名及落链仍不可完成验收，keeper 属后续集成检查。不能 APPROVE 或声称 issue 全部完成。

GitHub CI 本轮读取：Audit、SDK standalone build SUCCESS；Linting/Type Checking/Tests 仍 IN_PROGRESS；Component Tests job FAILURE，但失败日志是 Deploy report to GitHub Pages 与 Post report link 的403权限错误，报告正文明确 All tests passed。这是报告发布权限问题，不冒充组件用例失败，也不宣称总 CI 全绿。日志 `/tmp/fesol56-review-component-ci.log`。人工复核优先接缝：实际钱包→签名字节校验→广播/超时对账→slot快照→共享页面；同时复核 FESOL-57 math 字段部署与 feeDiscountFactor 下游接线、FESOL-71 表归属/覆盖与原子包大小。这些风险导航不等同于新增已证实缺陷。


### PR 后缓存修复与开发验证流程调整（2026-11-13）

用户明确修正长期流程：已有基于 solana-integration 的需求开发分支时，后续 review 修复先在原 development 实施并验收，再精确转入现有 delivery、复验并更新同一 PR。此前“delivery 是唯一业务修复现场”的约定被本次新指令替代，保留历史记录但不再据此阻止回原开发分支；AGENTS、日常流程、交付 skill 和索引均已同步。development 是实现验证现场，delivery 是 PR 发布版本，不在两处独立维护同一修复。

本次先在原 `gmx-interface-fesol-56` / `solana-order-transactions-fesol-56` 修复确认后缓存 envelope：positions/orders 均写入 `{ value: 已校验 slot 的数据, fetchedAt: Date.now() }`，保留 minContextSlot、旧 slot 拒绝和请求失败抛出行为。新增真实 SWR/hook 回归覆盖成功、旧 slot、失败保留数据；修复前 2 failed/1 passed，修复后相关 3 suites/10 tests passed；完整 frontend 3434 passed/1 既有 skip，app+landing tscheck、变更 ESLint/Prettier/diff 通过。开发提交 `ccbde8e995ea6ca32972a626f4cc1b896d8edbef`。仅两个业务文件转入原 delivery，正在实际交付目录复验，尚不宣称 PR 已更新。日志 `/tmp/fesol56-cache-{before,dev-targeted,dev-tests,dev-types,dev-lint,dev-format}.log`。本次不涉及 UI 布局、交易编码或 SDK 改动，以真实 hook 的状态验收为直接证据，不以钱包操作或页面可加载冒充此缺陷验证。


交付目录同样 frontend 3434 passed/1 既有 skip（340 files passed/1 skipped）、app+landing tscheck、变更 ESLint/Prettier/diff 通过；工具过时提示已改成 development 验证后转入既有 delivery，适用 agent-workflow 单项 13 tests passed。交付提交尝试 GPG 签名失败（pinentry curses 无可用 tty/界面，No such file or directory），未关闭长期配置。已准备 PR 英文正文增量与验证结果，等待本次签名例外或用户解锁后完成 commit/push；不将已验证/暂存冒充已更新 PR。日志 `/tmp/fesol56-cache-delivery-{tests,types,lint,format}.log`、`/tmp/fesol56-cache-workflow-tests.log`。


最终发布：用户明确允许本次修复交付提交命令级不签名，`89c9fc73a5df1d3717fcb49fa8a4dddabfc42f4b` 已推送 my-gmx-pr，原开发提交 `ccbde8e995` 已备份 my-gmx；PR #3258 正文已更新缓存修复与本轮真实验证结果，保持 Draft/release，无新增 reviewer 请求。开发→交付转入仅两个业务文件，无冲突，无个人基础设施。两处实际目录检查通过且已 clean；后续业务修复继续遵循本节新流程，旧“唯一 delivery 修复现场”不再适用。本轮缓存缺陷已关闭，不将其等同于 FESOL-56 全部真实钱包验收完成；FESOL-71、四钱包签名落链与已披露原子包边界仍保留。新 head 的 GitHub CI 刚启动，不宣称全部通过；生产构建复用缓存修复前结果，未重跑 SDK 或交易编码构建。

### 当前 head 再审（2026-11-13）

用户再次要求按 gmx-prompts 审查 #3258。核实 head `89c9fc73a5`、实时 release `e471428074`，后者已是 head 祖先，delivery 就是当前合并结果；173 文件、8892 additions/804 deletions。规范 `gmx-prompts@72041619ae` 已 fetch 确认最新。按 T3 执行交易/签名安全、除法、交易步骤、guard/值语义及异步生命周期检查；通用 `/code-review`、`/security-review` 命令不可调用，使用手工等价检查，不宣称运行过这些命令。GitHub inline comments/reviews 均为空。原 freshness envelope 缺陷已修复，本次不重复报告。

**NEEDS CHANGES：新增 P2，确认 slot 下限在刷新失败后丢失。** `src/domain/gmsol/useGmsolAccountData.ts:86` 仅把确认 slot 传给一次强制请求；`acceptedGmsolSlots` 只在请求成功后更新，普通 `fetchOrders/fetchPositions` 不带下限。真实 SWR/hook scratch 复现：先接受 slot 1，slot 3 确认后强制刷新抛错，随后普通 revalidation 接受 slot 2 的订单/仓位并显示 `isLoading=false/error=undefined`。这是已知交易之后的过时快照被重新标成 fresh，可能遗漏刚建订单或显示刚取消订单。应在收到确认时独立保存 host/owner/request 的最高 required slot；所有后续读取携带并校验该下限，失败保留旧数据与过期/错误状态，直到至少追上确认 slot。新增用例应覆盖“确认后首次刷新失败→普通轮询较旧→追上后恢复”，不能只测试已经成功接受高 slot 后拒绝低 slot。

当前 API main `cf9fe279ac` 源码确认该场景可达：`orderSnapshot.ts` 的带下限请求追不上时返回 503/SLOT_NOT_REACHED，不带下限则可返回当前较旧但未过期快照；不是假定后端违反 minContextSlot。本次安全快进干净的 gmx-api main 到该版本，主仓库 gitlink 差异未暂存/提交。gmx-solana 已 fetch，固定 v0.9.0/c6778dc9 的五个允许指令 discriminator/account order 与 PR ABI 逐项比较一致；未将本地源码等同于部署验收。公开 markets/config 实测 67 个市场、均有两个 minimum 字段，但没有 `tradeMath: gmsol`；数学 rollout 仍需单独核验。

新增验证：相关现有测试 19 passed，scratch 新行为断言 1 failed（预期揭示上述缺陷）；仅 mock SDK 网络响应，使用实际 SWR、freshness hook、账户 hook。scratch 已移到 `/tmp/pr3258-review.spec.tsx`，日志 `/tmp/pr3258-review-tests.log`，业务 checkout 恢复 clean，未修改实现。相同 head 原全量 frontend 3434 passed/1 skip、SDK 952 passed、types/lint 结果复用，不宣称本次重跑全量。本次当前 head 的 production app/WASM build 实际重跑通过，日志 `/tmp/pr3258-review-build.log`。

使用现有 kenny Chrome 原生窗口，在本轮自行启动的 3017 production preview 验证 Solana DOGE 行情/图表、flag off 回 Arbitrum及 reload 后 BTC 行情、flag on 恢复 Solana及 reload。结束恢复原 flag-on/Solana 状态、关闭本轮新 tab、停止本轮 preview，没有连接新浏览器/profile、签名或广播。未执行逐 host 请求计数、console/storage/第三方调用审计，不称完整 runtime 全部通过。FESOL-56 实时正文/评论已核对：unexpected-instruction/receiver 有自动化证据，四钱包实际 LUT 签名与主网 limit/edit/cancel/atomic landing 仍未验收；LUT trust 和有限价 atomic 1255-byte 限制已披露，不包装成新增发现。CI 本次最后读取 Audit/SDK build SUCCESS，root tests/type/lint 与 component checks 仍运行中。未发布 GitHub review/comment，未改 Linear。

### 确认 slot 下限修复（2026-11-13）

用户核实缺陷及前端独立实施条件后明确要求修复。沿用原 development → 既有 delivery 流程；Linear 56 正文/状态及 PR head/base 已刷新，无影响本修复的变化。新增 `GmsolAccountSlotTracker` 将 accepted snapshot slot 与 required confirmation slot 分开维护，按 API host、owner 和 positions/orders 隔离。在发起确认后刷新前即保存最高 required slot；强制刷新、普通轮询与重试统一带 `max(accepted, required)`，响应落地时再按最新 required slot 检查，防止飞行中的旧请求跨越更新后的确认下限。通过 `useSyncExternalStore` 在 required 尚未满足时经现有 error 通道保留旧数据和待追赶状态，追上后恢复；不改 SDK、交易编码、钱包签名或广播逻辑。

原开发目录提交 `5ba8eaf32775df9378cd01b609a161c47a6d038c`（Retain confirmation slot floors across failed account refreshes FESOL-56）已备份 my-gmx，且现场 clean。只新增一条实际 SWR/hook 回归，覆盖首次刷新失败、较早确认不降低下限、普通轮询拒绝旧快照和最终追上恢复；修复前失败、修复后相关 3 suites/11 tests 通过。两个临时 tracker 检查验证跨 host/owner/request 隔离及更高确认到达时拒绝在途旧响应，已通过并移到 `/tmp/fesol56-slot-tracker.scratch.spec.ts`，不随 PR 交付。

4 个文件精确转入 delivery，无冲突，与开发提交逐字节一致。两个实际目录各自全量 frontend 3435 passed/1 既有 skip（340 files passed/1 skipped）、app+landing tscheck、变更 ESLint/Prettier/diff 检查通过；delivery 生产 app/WASM build（命令级 8 GiB heap）也通过。SDK 未改，复用此前 SDK 952 passed，不声称本轮重跑。日志 `/tmp/fesol56-slot-{dev,delivery}-{tests,types,lint,format}.log`、`/tmp/fesol56-slot-dev-targeted.log`、`/tmp/fesol56-slot-delivery-build.log`。误用 package 的 `yarn prettier` 写入 5 个无关格式变化后已精确撤回，最终仅上述 4 文件；后续检查直接调用 Prettier 二进制。本轮无浏览器/钱包操作，不把 hook 和生产构建验证冒充四钱包主网验收。

最终 delivery 的 `git commit -S` 失败：pinentry curses 显示 `not a tty`，GPG 报 `signing failed: No such file or directory`。本次没有复用前一次单次不签名例外、未关闭长期签名配置；4 文件已验证并保持暂存，delivery HEAD/远端 PR 仍为 `89c9fc73a5`，尚未更新 PR。英文 PR 正文已准备在 `/tmp/fesol56-slot-pr-body.md`，补充本修复、两目录实际全量验证和新生产构建结果。待本次命令级不签名例外或用户恢复签名后完成交付 commit/push、更新同一 Draft PR 并登记；知识沉淀独立保存到个人基础。LUT、四钱包主网落链及有限价 atomic 大小边界仍未解除。


最终发布：用户本轮明确临时允许不使用 GPG 签名提交 PR，并要求后续重新规划更好的签名流程；本次仅使用命令级 `git -c commit.gpgsign=false`，未修改长期配置，也不将其解释为后续免签授权。交付提交 `b2fdb4c74543c31523a845eae7ee1cd27356822a` 已推送 `my-gmx-pr`，同一 PR #3258 英文正文已更新修复和真实验证结果；远端 head 已核对，仍为 Draft/release。delivery 工作区 clean，提交内容就是此前已通过全部检查的四文件暂存内容，未因提交重跑相同测试。新 head 的 GitHub CI 已启动（Audit/component/root tests 运行中，SDK build 排队），尚不宣称通过。本轮确认 slot 缺陷已修复并发布到 PR，既有前置依赖、LUT、四钱包真实签名落链及有限价 atomic 包大小边界不变。后续签名流程重新规划待单独展开，本次不自行更改安全或审批规则。


参考仓库现场收尾：用户要求妥善处理 review 遗留的 `gmx-api` gitlink 差异。按参考仓库文档的固定 checkout 规则，核对其无本地文件改动、无其他 worktree，且未发现 cwd 位于该目录下的进程后，将该目录 detached 到父仓库已记录的 `b86956df00902e44e0295827d651b206a6153942`。已核验的 `cf9fe279ac1dd5a852783a1e7404e16f92378820` 继续保存在子仓库本地 `main` 分支，可用 `git show main:PATH` 查阅；没有 reset 分支、删除提交或提交父仓库指针升级。此前建议长期保留该未提交差异不符合已有固定 checkout 规则，以本次收尾为准。主仓库与子仓库均已恢复干净状态；本次只是参考源码现场整理，不变更已发布的前端 PR，也不涉及运行服务或消费者升级。


### FESOL-72 新版 WASM 的跨任务兼容验证（2026-11-13）

72 开发分支已集成 56 delivery `b2fdb4c745`，将 SDK 接入目标更新为用户确认的 GMX 自建 `0.11.0-beta.1`。在 72 现场使用用户指定 Phantom 的公开账户，最终 WASM 的创建/修改/取消、显式 unlimited decrease bounds 的 BTC TP/SL 原子组合，以及缺失 user/position 准备，共八项真实 Mainnet 无签名模拟成功；详见 [FESOL-72](FESOL-72.md) 的源码 hash、slot、结果和边界。finite-bound 三单组合仍需 1255 bytes 被拒，两张表仍可变且未受信。此证据属于 72 的开发组合，不代表 56 原分支/PR 已升级 pin、已签名落链或已完成四钱包验收；未修改 56 业务现场。

## FESOL-52 共享 Provider 关联接入（2026-11-13）

用户授权的52依赖整合覆盖本需求。原始52 head `258e4da6ab`的消费、共享SDK传递、确认slot/freshness保护及通知组合统一记录于[依赖审计](../solana-trading-dependencies.md#fesol-52-最新依赖接入2026-11-13)。沿用原development现场，未另起并行实现或覆盖下游扩展。本次不补签名/广播证据，不解除已有外部验收条件。

## 2026-11-13 独立开发切片实施

角色：实现：签名持久化恢复及atomic编码归因。实施、版本、行为证据与剩余边界见[统一记录](../solana-trading-dependencies.md#独立开发切片实施结果2026-11-13)。未进行真实钱包签名/广播，既有外部验收条件未解除。

## 2026-11-13 Draft最新状态核对

角色：交付就绪分析。已有Draft #3258仍为head `11da18dfb7`，恢复补丁已包含，无遗漏业务提交。最新Component workflow `43408278858`失败日志已核实为报告发布/评论403，报告All tests passed；其余检查及新release基线影响见[Draft核对](../solana-trading-dependencies.md#draft交付就绪核对2026-11-13)。未修改业务/PR，未将主网验收等待当作Draft提交前置。


## 2026-11-14 独立推进收尾

最终CI、19交付组合的原生Chrome未连接钱包回归与56固定WASM原子体积归因已完成，详见[三项收尾](../solana-trading-dependencies.md#独立推进三项收尾2026-11-14)。四PR关键代码检查通过；组件报告403，56另有1 flaky重试通过。未确认需新增业务修复的问题，HEAD未变。原子组合仍1255/1232 bytes，假设单表1221不代表真实LUT可用。71/112及真实钱包验收未解除；72版本已由用户确认。既有Draft正文已更新，未转正式review。

## 上游接续实施（2026-11-20）

本轮参与角色：Kenny 自有需求上游接续、冲突修复与组合验证。详见[本轮实施证据](../solana-trading-dependencies.md#五需求上游接续实施2026-11-20)。先在原开发线实现，精确接续现有交付PR；未修改Linear状态或代发协作消息。


## 五需求前置接续与最新 playground（2026-11-22）

原TRD-72开发线签名merge `fac83d15bd`（包含 `0891747ffc` 原生SOL/WSOL原子TP/SL修复及正式release），开发 `c92c296f59`；交付从999b安全fast-forward到现有上游fac。开发完整前端3509 passed/1 skipped、SDK与app/landing types通过；实际交付101项Solana测试、SDK和types通过。源码匹配，原Lighthouse与pending保护保留。已推送个人开发线、更新原3315正文，不改变Ready状态。

余额3195最终tree与原接入版完全相同，不重复搬运；77固定WASM不变。详细共同证据与外部验收边界见[本轮依赖审计](../solana-trading-dependencies.md#前置接续与-playground-更新2026-11-22已部署)。本轮未修改他人PR/Linear，未签名广播交易；部署成功不扩大真实钱包/原子TP-SL/金融参考/负载验收。
