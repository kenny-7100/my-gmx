# 自动化工具沉淀约定

更新日期：2026-10-25。用户已授权 Agent 在实际协作中主动发现、实现并积累有复用价值的自动化能力，减少重复推理、人工操作、执行时间和成本。

## 何时沉淀

优先关注实际任务中反复执行、步骤固定、结果可验证的工作，例如资料定位、跨仓库信息汇总、格式转换、接口与数据契约核对、精度对照、静态检查和测试验证辅助。

发现机会后，先检查 `scripts/`、`package.json`、现有测试工具、SDK 工具及参考仓库是否已有可复用能力。只有在能减少重复劳动或明显降低错误时才增加工具；一次性简单命令不必封装，判断标准不明确的任务先澄清，不将猜测写进自动化逻辑。

## 如何实现

1. 在当前任务范围内实现最小可用能力，优先采用现有运行环境和依赖；避免引入通用框架、大量新依赖或无关重构。
2. 项目辅助脚本优先放在 `scripts/`，测试辅助能力沿用现有测试目录及组织方式。需要复用到运行时代码的逻辑仍按项目分层放置，不为脚本打破架构边界。
3. 路径、网络、输入和输出等可变项用明确参数表达，避免硬编码个人机器路径和凭据。脚本、注释、日志、错误信息和帮助文本使用英文，配套说明使用中文。
4. 失败时返回非零退出码并提供可定位的信息，不把缺失依赖、网络错误或未知结果当成验证通过。不在工具中隐藏提交、推送、部署、删除等操作。
5. 用当前任务的真实输入验证结果，必要时与人工核对结果对照；检查有意义的失败路径和边界。测试遵守 gmx-prompts 的准入标准，不为简单脚本堆砌测试或测试框架。

工具创建与执行分别遵守授权：沉淀自动化能力不代表获准自动运行 UI 测试、构建、部署、打开浏览器或启动服务器，也不扩大 Git 操作和外部写入权限。收到 `push` 时直接执行原定流程，不插入工具建设。

## 如何交接

每个正式沉淀的工具都应在对应主题文档中记录，并通过 `docs/README.md` 或相关文档提供可发现的入口：

- 用途与适用条件，明确替代哪部分重复工作。
- 脚本路径、工作目录、调用示例、依赖及必要配置。
- 输入输出、退出码含义，以及是否修改文件或访问网络。
- 已验证的样例、核验日期、已知限制和未验证事项。

优先更新已有工具和文档，避免同一任务出现多套近似脚本。遇到接口或项目结构变化时，同步修正当前任务涉及的工具及说明，不让旧检查产生错误信心。

已沉淀 [Linear 需求工具](linear-requirements.md)：复用同一入口完成 FESOL 实时查询、全量快照、筛选和差异比较，避免每次由 Agent 手工翻页、统计及比对。脚本为 `scripts/linear-requirements.mjs`，验证入口为 `yarn test:linear-tools`。

已实现[本地 Agent 验收钱包](agent-wallet.md)的入口：`yarn agent:wallet addresses` 从根 `.env.local` 的 `AGENT_TEST_WALLET_MNEMONIC` 派生固定路径 EVM/Solana 公开地址，不访问网络、不签名或发送交易。公开向量与失败路径测试入口为 `yarn test:agent-wallet`；2026-10-24 用户配置并授权后，三组测试及实际地址派生、重复性检查通过。Mainnet 原生 SOL 余额预检命令为 `yarn agent:wallet balances --network solana-mainnet`，先启动既有 RPC 代理；先校验完整网络 genesis，再输出精确余额、slot 和时间。另有 `yarn agent:wallet tokens --network solana-mainnet` 查询 SPL Token/Token-2022 全账户与精确金额/状态，不能将其当作可花费额度。当前共九组钱包测试及真实 Mainnet 对照验收通过；Devnet 暂缓，尚无签名或发送功能。资金相关验收先重新运行预检，不依赖历史余额。

已沉淀 [keeper 只读预检](keeper-preflight.md)：`yarn keeper:preflight` 复用现有 Arbitrum keeper/代币配置，显式设置已验证的 User-Agent，检查五种基础资产价格（最大年龄 30 秒）、三种非稳定币的 24h/1m K 线与 `solanaTrading`。验证入口为 `yarn test:keeper-preflight`；真实请求发现主端点和两个备用端点均缺少交易开关，正确返回 `blocked` / 退出 2，不伪装成整体通过。工具不启动服务、不发送交易，不自动切换上游。

已沉淀[本地 Solana RPC 代理](../tools/solana-rpc-proxy/README.md)：通过现有 fallback key 和固定上游 Origin 为 Agent/本地前端提供统一 HTTP 入口，拒绝交易发送；手动启动 `yarn solana:rpc-proxy`，不自动启动前端。单元验证入口为 `yarn test:solana-rpc-proxy`，真实只读验收为 `yarn solana:rpc-proxy:verify`（需先启动代理）；2026-10-24 经用户授权已通过 handler、真实读取、100 账户、订单扫描及本地浏览器 CORS 验收。前端统一 URL 配置已加入，当前分支尚无 Solana RPC client 消费它；跟踪状态见 [A01 实施清单](agent-acceptance-infrastructure.md)。

已沉淀[本地 Solana API 样例验收服务](solana-api-local.md)：`yarn solana:api-local start` 在隔离环境中运行已有 gmx-api Solana 入口，`yarn solana:api-local verify` 检查 14 项健康、样例、动态时间戳、地址错误、404 和 CORS 行为，输出 sample 模式、预期源码 SHA/dirty 和文件摘要。无需钱包或后端凭据；不自动安装依赖、启动前端或切换业务 host。实际使用前按文档准备锁定依赖，完成后关闭自启服务。

已沉淀[Agent 统一只读预检](agent-preflight.md)：`yarn agent:preflight` 复用已有 RPC、keeper 和样例 API 检查；`--checks` 可显式选择钱包余额。输出统一 JSON、退出码、本地源码与配置摘要；单项失败不阻止其余检查，不启动服务或发送交易。状态/隔离测试入口为 `yarn test:agent-preflight`，真实数据模式、授权和前置仍遵循原工具。

已沉淀[Solana SDK 与程序版本证据预检](solana-runtime-preflight.md)：`yarn solana:runtime-preflight --local-only` 核对已安装 SDK 和现有独立 WASM；默认模式经已启动的代理读取 Mainnet 程序部署证据，分段计算完整程序区摘要并核对前后元数据。测试入口为 `yarn test:solana-runtime-preflight`。不读取钱包、不构建/部署，不将文件指纹当作业务兼容证明。

已沉淀[Solana ALT 资源预检](solana-alt-preflight.md)：`yarn solana:alt-preflight` 复用现有两张 Mainnet 表配置和 RPC 代理，批量读取后校验账户布局、生命周期与生效地址数，记录 authority、完整地址和摘要。测试入口 `yarn test:solana-alt-preflight`；不创建/修改表，不把表可读当作任意交易地址覆盖。

已沉淀[Solana Mainnet 交易回执证据](solana-transaction-evidence.md)：`yarn solana:transaction-evidence --network solana-mainnet --signature <signature>` 复用既有代理读取 finalized 回执与历史签名状态，交叉核对身份/结果，保存精确整数、完整回执、内容摘要和工具源码身份。测试入口 `yarn test:solana-transaction-evidence`；未知/未 finalized/缺回执为 blocked，链上失败为 failed，不读取钱包或推断 keeper 执行。

已沉淀[Agent 验收证据包](agent-evidence.md)：`yarn agent:evidence pack` 显式收集已有工具 JSON，保留原字节/状态/观察时间、生成文件清单及摘要；`verify` 在接收目录离线检查完整性，不依赖原路径或链上服务。测试入口 `yarn test:agent-evidence`；不重新执行验收、不脱敏或上传，包完整不代表业务通过。
