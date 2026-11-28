# GMX 前端安全案例还原（2026-11-28）

本次角色：只读研究与筛选方法沉淀，没有扫描新漏洞、重放利用、修改业务/Linear 或发送报告。执行标准见[筛选入口](gmx-frontend-security-triage.md)。本页只留安全分享的根因、公开已合并修复和证据索引，不复制内部报告的利用路径、私密 PoC、密钥或账户细节。

## 已还原范围与结论强度

从 Immunefi 的 GMX Scope / Information / Resources、博客 sitemap，转查 `gmx-interface` 2026-10 起的 hotfix、wallet、key、security、Immunefi/SEC 关联 PR，并读取高相关 diff、回归断言与人工 review；再沿已引用的 Linear 工程 issue、SEC 标签和 Immunefi/follow-up 查询及评论核实。GitHub 搜索使用已认证账号，后续限定 public，避免将可访问的私库当成公开披露。

已识别 **11 个互异 Immunefi 数字编号**的前端案例：95379、97076、97239、97307、97496、97500、98113、98126、98128、98386、98241。另核实 SEC-22、SEC-45 等辅助修复，不计入这 11 个编号。

证据层次必须分别记录：

- 正式规则：Scope 的资产/影响及 Information 条款。
- 工程认可：关联报告的工程任务、明确确认、实际复现与修复验收。
- 合并：GitHub `merged_at` 与目标分支，不把 closed 当 merged。
- 上线：团队明确回复或独立部署证据；合入 release 不等于已上线。
- 赏金结论：报告正式接纳、等级与支付分别需要直接证据。工程 Done / SEC 标签不代替该证据。

SEC-22、SEC-28 按编号查询，SEC-23、SEC-26、SEC-45 按工程引用的 UUID 查询，均返回不可找到；其余 SEC 原始记录未逐一尝试；不因此推断 issue 不存在。本次可用的是工程转述、讨论、修复和测试，未拿到完整原始 SEC 报告。产品经理“11 月 17 个有效提交”的完整名单及统计口径仍未核实。

## 核心前端案例

下表为根因摘要；报告编号来自可访问的工程描述，具体利用细节不在此扩散。日期统一按来源原始 UTC 日期记录，非本次线上复测。

| 报告关联 | 工程与修复 | 已核实状态 | 对筛选的启发 |
| --- | --- | --- | --- |
| SEC-23 / Immunefi 95379 | [TRD-28](https://linear.app/gmx-io/issue/TRD-28)，[#3136](https://github.com/gmx-io/gmx-interface/pull/3136)、SDK [#3209](https://github.com/gmx-io/gmx-interface/pull/3209)、清理 [#3363](https://github.com/gmx-io/gmx-interface/pull/3363) | 分别 11-25、11-26、11-26 合入 release；QA 11-25 认可功能分支。赏金等级/支付未知 | 密钥生成与签名公开性、账户绑定、旧会话迁移、轮换/撤销要沿 UI→SDK→合约核实；新增随机密钥不自动解决旧状态 |
| SEC-26 / Immunefi 97076 | [PRO-4531](https://linear.app/gmx-io/issue/PRO-4531)，[#3161](https://github.com/gmx-io/gmx-interface/pull/3161) | 工程 Done；10-29 合入 release；赏金等级/支付未知 | 两阶段转换后自动提交必须保留已确认的规模、价格保护和 TP/SL；重挂载和内部切币不能悄悄改变意图 |
| SEC-27 / Immunefi 97239 | [PRO-4537](https://linear.app/gmx-io/issue/PRO-4537)，[#3177](https://github.com/gmx-io/gmx-interface/pull/3177) | QA 11-02 确认为已修复；11-03 合入 master；赏金等级/支付未知 | 支付币种、转账币种、deposit market、fee estimate 必须一致；共享 Buy/Sell 状态不能混进另一条路径。需要追到合约记账及实际结果 |
| SEC-28 / Immunefi 97307 | [PRO-4541](https://linear.app/gmx-io/issue/PRO-4541)，[#3170](https://github.com/gmx-io/gmx-interface/pull/3170) | #3170 于 11-02 合入 master；#3176 closed 且未合并，被 #3170 替代。QA 在三种模式验证 Enter/按钮，注明未测触发价存入和 GMX Account margin；赏金等级/支付未知 | Hook 旧闭包可造成显示与发送金额不同；必须对比 Enter/click 实际 payload，不能只看按钮或补 dependency list |
| SEC-29 / Immunefi 97496 | [TRD-39](https://linear.app/gmx-io/issue/TRD-39)，[#3281](https://github.com/gmx-io/gmx-interface/pull/3281) | 团队 11-17 明确确认，QA 11-18 通过；11-18 合入 master；团队 11-23 回复 hotfix 已上线。赏金等级/支付未知 | 异步失败后残留 estimate 不能与新 batch 拼接；需验证外部调用、转账和费用共同属于当前订单，不能只以缓存存在当 ready |
| SEC-30 / Immunefi 97500 | [TRD-40](https://linear.app/gmx-io/issue/TRD-40)，[#3284](https://github.com/gmx-io/gmx-interface/pull/3284) | 团队 11-17 明确确认和 QA 通过；11-18 合入 master；11-23 回复已上线。赏金等级/支付未知 | 去抖双状态竞争会使快速编辑后发送旧规模；字段、滑块、Receive、按钮和编码结果要一致 |
| SEC-36 / Immunefi 98128 | [TRD-41](https://linear.app/gmx-io/issue/TRD-41)，[#3283](https://github.com/gmx-io/gmx-interface/pull/3283) | 团队 11-16 明确确认，QA 11-17 通过；11-18 合入 master；11-23 回复已上线。赏金等级/支付未知 | 清算估计与 SL 的计算需以合约为参照；“价格相关”不等于“可 1:1 互换”，不能为估值修复扩大 swap equivalence |
| SEC-37 / Immunefi 98126 | [TRD-42](https://linear.app/gmx-io/issue/TRD-42)，前端 [#3282](https://github.com/gmx-io/gmx-interface/pull/3282)、API [#349](https://github.com/gmx-io/gmx-api/pull/349) | 团队 11-16 明确确认，QA 11-17 通过；两 PR 11-17 合入 master/main；11-23 回复已上线。赏金等级/支付未知 | 一个总额计算不能机械平均分片；按合约费用结算顺序推导每片与剩余仓位。额外返还钱包的本金不直接等于丢失，风险损失条件要分开证明 |
| SEC-38 / Immunefi 98113 | [TRD-43](https://linear.app/gmx-io/issue/TRD-43)，[#3279](https://github.com/gmx-io/gmx-interface/pull/3279) | 团队 11-16 明确确认，QA 11-17 通过；11-18 合入 master；11-23 回复已上线。赏金等级/支付未知 | 编辑订单必须保留原价格方向和精度，单改 slippage 不应重写经济限价；读回含糊历史订单的限制不能被忽略 |
| SEC-39 / Immunefi 98386 | [TRD-17](https://linear.app/gmx-io/issue/TRD-17)，[#3301](https://github.com/gmx-io/gmx-interface/pull/3301) | 工程记录明确 assessed as Medium；11-25 合入 release，QA 修复回归通过。11-26 评论仍询问自动提交 0.1% 容差的语义，不能说所有边界已定；支付未知 | USD/Token 输入的意图 owner 与模式转换、价格 tick、布局重挂载必须一致。普通价格波动与用户金额意图被改变分别判断 |
| SEC-41 / Immunefi 98241 | [TRD-19](https://linear.app/gmx-io/issue/TRD-19)，[#3296](https://github.com/gmx-io/gmx-interface/pull/3296) | 工程记录明确 assessed as Medium；11-25 合入 release；11-24 review 当时“未合并”已被新事实取代。旧默认值无法区分显式选择，修复保留该限制；支付未知 | 合法外部入账不等于用户同意更改平仓去向/费用来源；初始化及缓存效果可能形成安全边界，不能只查交易 builder |

上表 **11 个带 Immunefi 数字编号的案例**中， SEC-29/30/36/37/38 五条有明确确认及上线回复，SEC-39/41 两条有 Medium 工程评定。另有 SEC-22 无数字编号、SEC-45 原始编号未取得，不混入 11。

工程记录的 Medium 是其历史评定表述，未取得原始裁定理由；当前 Scope 对无攻击者财务损失列 Low、对资金不可追回列 High，不能用某个历史工程 Medium 倒推同类新问题必为 Medium。规则变化、具体影响差异或转述边界本次未能进一步确定，提交时需重新逐项匹配。

## 辅助案例与反例

| 证据 | 可复用结论 | 不可扩大解释 |
| --- | --- | --- |
| [PRO-4428](https://linear.app/gmx-io/issue/PRO-4428) / SEC-22，前端 [#3034](https://github.com/gmx-io/gmx-interface/pull/3034) | 10-06 合入 master 且 QA 通过；预期交易链需要沿 adapter/approve/contract send 传递，最终读取 live wallet chain；请求保留 chainId、calldata 和 native value | 没有原始 Immunefi 数字编号、最终等级或支付证据 |
| [PRO-4596](https://linear.app/gmx-io/issue/PRO-4596) / SEC-45，前端 [#3292](https://github.com/gmx-io/gmx-interface/pull/3292) | 11-18 合入 master 且 QA 通过；快速编辑、签名排队、切链重试后重新验证当前表单；兼容 quote 刷新不应误取消 | 工程原文明确声称的交易与手续费损失未独立复现，等级与重复状态未定；修复真实 bug 不证明报告全部成立。原描述仍提 #3291 未发布，已被 #3292 状态取代 |
| [TRD-24](https://linear.app/gmx-io/issue/TRD-24)（原 PRO-4568），[#3213](https://github.com/gmx-io/gmx-interface/pull/3213) | 已合入 release；提交成功后清输入，拒签保留；回归曾出现重复动作，属于真实资金流程缺陷 | 没有找到 Immunefi 关联或赏金接纳证据；不能把每个二次点击都称无权限盗款，TradeBox 的有意重复下单是明确范围外 |
| [TRD-209](https://linear.app/gmx-io/issue/TRD-209)，[#3343](https://github.com/gmx-io/gmx-interface/pull/3343) | 11-26 合入 master 且 QA 通过；仓位生命周期、自动取消和 TP/SL 是否实际保留需要组合验证 | 有 SEC 关联模式/测试标签，但本次未找到 Immunefi 数字编号；不计作正式接纳样本 |
| [TRD-29](https://linear.app/gmx-io/issue/TRD-29)，[#3334](https://github.com/gmx-io/gmx-interface/pull/3334) | 11-20 合入 master，团队确认 RPC proxy 已使用，QA 11-23 记录 92 项通过；凭据不应随 bundle 分发 | 没有正式赏金决定；发现一个公开 key 不等于可获奖，需证明生产使用、权限、限制与条款要求的影响 |
| [BEDEV-2](https://linear.app/gmx-io/issue/BEDEV-2)，附件历史 Immunefi 64279 | 本次读取了附带报告文本，已有资产/影响/PoC 分层；11-27 评论明确旧 Gelato 路径已被自有 relay 替代，任务因过时而取消 | 没有接纳/支付证明。报告的 fork 覆盖合约执行，不等于验证当前第三方 API 配额/计费。不能照抄历史余额、费用估算与旧钥匙当当前风险；不保存原附件/密钥到版本库 |
| [gmx-synthetics #318](https://github.com/gmx-io/gmx-synthetics/pull/318) | 截至本次仍未合并；作者自称发现并要求赏金 | 没有维护者确认与正式接纳记录；作者要求某等级/金额不能当 GMX 的决定，不复制未确认利用细节 |
| 前端 [#2666](https://github.com/gmx-io/gmx-interface/pull/2666)、[#2576](https://github.com/gmx-io/gmx-interface/pull/2576) | 存在已合并依赖审计升级 | 不证明 CVE 在生产可达或造成范围内影响；不能用依赖升级数当有效赏金报告数 |

## 其他项目的正式披露作对照

只选有直接确认/奖励叙述的官方披露；其他计划条款和等级不能搬成 GMX 的先例。

- [Sky RCE Bugfix Review](https://immunefi.com/blog/bug-fix-reviews/sky-remote-code-execution-bugfix-review/)（2025-02-25）：官方称 2023-09-25 报告、两天内确认、09-28 修复，支付 50,000 美元。有效证据连接了用户可控输入、实际被调用的 Markdown 解析功能、服务端执行及可见输出；不是看到依赖含 eval 就报告 RCE。
- [Zapper Arbitrary Call Data Bugfix Review](https://immunefi.com/blog/bug-fix-reviews/zapper-arbitrary-call-data-bugfix-review/)（2021-06-17）：官方称披露后暂停、24 小时内修复，奖励 25,000 美元；公开 fork PoC 证明真实授权关系与资金结果。关键是参数能控制什么、合约以谁的权限执行，以及结果是否越权；任意 calldata 本身不自动有害。它是合约案例，仅用于跨边界方法对照。
- [Two Novel Crypto Wallet Exploits, Explained](https://immunefi.com/blog/bug-fix-reviews/two-novel-crypto-wallet-exploits-explained/)（2022-07-11）：虽然位于 Bug Fix Reviews 分类，正文同时记载厂商对可行性/前提的异议。不能把博客栏目名当作已接纳并支付的证据。前提是否真实、是否需要设备访问/特定内网或弱密码必须单独核实。

## 从案例得到的报告标准

高价值候选应当回答：在什么真实版本和正常/可行前提下，哪个输入或状态进入哪个消费者，使实际发送/执行偏离用户授权或违反明确安全边界；因此造成哪项具体影响；什么最小实验已经证明，什么尚未证明。重点是结果和可复核原因链，非漏洞名。

- **强证据**：真实组件/编码器产生错误请求；正常对照不会；独立合约/SDK/价格计算证明后果；可定位正式范围；团队历史样本有对应确认。
- **继续验证**：可疑状态或函数，但尚未证明生产可达、完整 payload、用户损失或第三方约束。保留缺口，不提前标 Critical。
- **内部修复另行判断**：真实缺陷可以修复，但缺乏赏金范围、首报或影响证据。不能把已修复就称获奖，也不能把未获奖就称毫无价值。

本次未运行上述 PR 的测试或重放报告。测试结果来自已读代码断言与原 QA 记录；diff 阅读证明实现意图，不代表本机/当前生产通过。没有取得全部原始报告、最终支付及拒绝样本，不能估计命中率或保证未来零误报。
