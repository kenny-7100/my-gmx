# Agent 任务启动卡

更新日期：2026-11-12。默认从[开发、回流与交付](linear-development-workflow.md)选择当前阶段；本卡只帮助选择运行和验证入口，不要求逐项执行。

1. 恢复实际任务现场（已有分支用[register/rebind](linear-development-workflow.md#接入已有分支或-pr)登记，无需求编号用本地 task）：分支、工作区、PR head；有登记从个人基础调用最新版 `agent-workflow.mjs status --project-dir PATH --issue FESOL-123`，先读当前目标/决策/阻碍/下一步及实际交付位置，再按知识变化路径查相关新经验；见[上下文恢复](linear-development-workflow.md#任务上下文与恢复)。确认任务相关 Linear/依赖变化；即将用到子仓库时按[按需更新规则](solana-reference-repositories.md#子仓库按需核验与更新)核验相关上游及版本，复用已有上下文，不从头全量调研。
2. 需要多个 Agent 且已获授权时，按[协作约定](agent-collaboration.md)明确协调人、修改范围和成果返回；普通任务单 Agent 完成。先明确本次可观察结果，再选择最小有效检查。已知 suite 直接运行；范围未知再用发现/规划工具。普通需求不默认填工作表、做全栈计划或打证据包。
3. 环境失败先查[诊断](agent-failure-diagnosis.md)，只处理当前缺项。编译前核对 SDK 产物，所需构建/服务按根授权；不要把环境问题改成业务兜底。

| 需要什么 | 入口 |
| --- | --- |
| 前端/SDK 开发规范和执行前置 | [编码与自审](coding-and-self-review.md)，按当前任务阅读；类型检查和回归遵循上游要求 |
| 已知前端测试 | `yarn frontend:test-offline --project-dir PATH --suite src/PATH.spec.ts`，或目标原生测试命令 |
| SDK 源码回归 | [SDK 离线入口](sdk-offline-tests.md)，不必为纯计算测试先构建 |
| 不确定影响范围/确需多仓库测试 | [发现及全栈规划](agent-test-plan.md)，不能把发现成功当测试通过 |
| API 计算、数据库、路由和类型检查 | [API 入口](solana-api-local.md)，选择对应 profile，不使用共享数据库 |
| 页面验收 | [浏览器入口](solana-browser-smoke.md)，既有两项网络选择冒烟不能替代本需求页面验收 |
| 联调、日志和断点 | [工作区](solana-dev-workspace.md)，目标路径及 owned/borrowed 服务明确 |
| 真实服务/链上只读事实 | [服务表](gmx-live-services.md)、[RPC 工具](../tools/solana-rpc-proxy/README.md)、[钱包与 CLI](agent-wallet.md)，按任务核对当前资源 |
| 复杂验收或需要移交原始材料 | [严格交付证据](agent-delivery-evidence.md)、[证据包](agent-evidence.md)，按需使用 |

阶段变化或交接时主动用 note 更新少量当前任务状态，无变化不重复写；结束时简短记录实际结果、未覆盖项和继续入口；可复用知识主动回流个人基础，业务修复集中在当前交付分支。日志和机器报告留在忽略目录，不把路径当共享附件。历史状态按原日期理解，专题资料从[索引](README.md)查阅。
