# 任务板

规则见 `docs/workflow.md`。状态：`todo`、`doing`、`blocked`、`done`。`env` 取值：`any`、`mac-kiro`、`windows`、`human`；`decision:user` 表示需要用户先做决定。

## 进行中与待办

按阶段排列，实现步骤和测试步骤见 `docs/mvp-plan.md`。A 线（`env: any`）和 W 线（`env: windows`）可以并行。

### 阶段 0：骨架与契约

| 编号 | 任务 | 状态 | env | 依赖 | 负责人 | 完成标准 |
| --- | --- | --- | --- | --- | --- | --- |
| T-024 | 建立代码骨架、构建脚本和 `docs/dev.md` | todo | any | — | | 见 `docs/mvp-plan.md` 第 5 节对应的行 |
| T-025 | 定稿 `docs/protocol.md` 为版本 1 | todo | any | — | | 见 `docs/mvp-plan.md` 第 5 节对应的行 |

### 阶段 1：引擎在浏览器中跑通（A 线）

| 编号 | 任务 | 状态 | env | 依赖 | 负责人 | 完成标准 |
| --- | --- | --- | --- | --- | --- | --- |
| T-026 | 引入 Fig 前端源码，用 JSON 桥替换 `api-bindings`，在浏览器开发页跑通 | todo | any | T-024, T-025 | | 见 `docs/mvp-plan.md` 第 5 节对应的行 |
| T-027 | 把规格用例 C-001 至 C-013 写成 vitest 测试 | todo | any | T-026 | | 见 `docs/mvp-plan.md` 第 5 节对应的行 |
| T-028 | PowerShell 化补丁：转义、路径分隔符、键码；补充 Windows 规则和用例（包含原 T-017） | todo | any | T-026 | | 见 `docs/mvp-plan.md` 第 5 节对应的行 |

### 阶段 2：Windows 风险验证（W 线，可与阶段 1 并行）

| 编号 | 任务 | 状态 | env | 依赖 | 负责人 | 完成标准 |
| --- | --- | --- | --- | --- | --- | --- |
| T-029 | 自动测试工具 `tools/wt-driver` | todo | windows | T-024 | | 见 `docs/mvp-plan.md` 第 5 节对应的行 |
| T-019 | 验证关卡 1：光标定位（`ICaretLocator` 的 UIA 实现） | todo | windows, human | T-029 | | 见 `docs/mvp-plan.md` 第 5 节对应的行；并达到 `docs/overlay-design.md` 的通过标准 |
| T-021 | 验证关卡 3：悬浮窗（`IOverlayWindow`，WebView2 显示静态页） | todo | windows, human | T-024 | | 同上 |

### 阶段 3：适配模块与宿主核心

| 编号 | 任务 | 状态 | env | 依赖 | 负责人 | 完成标准 |
| --- | --- | --- | --- | --- | --- | --- |
| T-030 | 宿主核心：管道服务、会话、进程执行（含 `ls` 模拟）、设置、`debugState` | todo | any | T-024, T-025 | | 见 `docs/mvp-plan.md` 第 5 节对应的行 |
| T-020 | 验证关卡 2：适配模块的实现与实测 | todo | windows（部分可在 Mac 的 pwsh 上开发） | T-025, T-030 | | 见 `docs/mvp-plan.md` 第 5 节对应的行；并达到 `docs/overlay-design.md` 的通过标准 |

### 阶段 4：集成

| 编号 | 任务 | 状态 | env | 依赖 | 负责人 | 完成标准 |
| --- | --- | --- | --- | --- | --- | --- |
| T-022 | 验证关卡 4：WebView2 承载前端，接通全链路 | todo | windows | T-026, T-021, T-030 | | 见 `docs/mvp-plan.md` 第 5 节对应的行；并达到 `docs/overlay-design.md` 的通过标准 |
| T-023 | 汇总四项验证结果，定稿 D-004，修正 `docs/mvp-plan.md` 的估算 | todo | any | T-019, T-020, T-021, T-022 | | `docs/decisions.md` 中 D-004 改为“已采用” |
| T-031 | 端到端用例（L2 自动测试，加上 L3 人工清单） | todo | windows, human | T-022, T-027, T-028, T-029 | | 见 `docs/mvp-plan.md` 第 5 节对应的行 |

### 阶段 5：可试用版本

| 编号 | 任务 | 状态 | env | 依赖 | 负责人 | 完成标准 |
| --- | --- | --- | --- | --- | --- | --- |
| T-032 | 安装、卸载脚本，诊断命令，使用说明 | todo | windows | T-031 | | 见 `docs/mvp-plan.md` 第 5 节对应的行 |
| T-033 | 用户试用一到两天，问题登记为新任务 | todo | human | T-032 | 用户 | 见 `docs/mvp-plan.md` 第 5 节对应的行 |

### MVP 之后或低优先级

| 编号 | 任务 | 状态 | env | 依赖 | 负责人 | 完成标准 |
| --- | --- | --- | --- | --- | --- | --- |
| T-015 | 评估 `wf` spec 在 Windows 上的可用性 | todo | any | — | | 选出最常用的 30 个 CLI，列出它们的 generator 调用了哪些外部命令，分为“可直接使用”“需改写”“不适用”三类，写入 `research/spec-compat.md` |
| T-012 | 在 Kiro 2.30.0 上执行规格用例 C-001 至 C-013 | todo | mac-kiro, human | — | | 每条用例的“Kiro 2.30.0 观察”一栏都有结果和证据编号；与源码预期不一致的，新增 F-xxx |
| T-013 | 弄清 F-006：在 figterm 包装的交互式 zsh 中，`init zsh post` 输出什么 | todo | mac-kiro | — | | 用黑盒方式取得证据，不反编译；F-006 的类型改为观察 |

## 已完成

| 编号 | 任务 | 负责人 | 产出 |
| --- | --- | --- | --- |
| T-034 | 制定最小实现方案、分阶段步骤与测试分层、模块间协议草案 | Claude Code/Opus 5.5 2026-10-14 | `docs/mvp-plan.md`、`docs/protocol.md`；D-006；F-025 至 F-027 |
| T-017 | （合并）PowerShell 分词与转义规则并入 T-028 | — | — |
| T-016 | 核实 PSReadLine、预测插件和原生补全接口，并调研 WT 中的光标定位方法 | Claude Code/Opus 5.5 2026-10-14 | `research/psreadline.md`、`research/caret-wt.md`；F-021 至 F-024；修订 `docs/overlay-design.md` |
| T-010/T-011/T-018 | 用户决定 D-002（PowerShell 7 + WT）、D-003（Fig 式悬浮窗）、D-005（MIT） | 用户 2026-10-14 | `docs/decisions.md`、`LICENSE` |
| T-014 | （取消）实测 inshellisense：D-003 已经选定，不再需要；PSReadLine 部分并入 T-020 | — | — |
| T-001 | 识别本机的目标产品、版本和哈希 | Claude Code/Opus 5.5 2026-10-14 | `research/target.md`；E-001、E-002、E-004 |
| T-002 | 核实开源来源和许可证，固定 commit | Claude Code/Opus 5.5 2026-10-14 | `research/sources.md`、`scripts/fetch-sources.sh` |
| T-003 | 追踪补全链路的原生层和 IPC | Claude Code/Opus 5.5 2026-10-14 | `research/architecture.md`；F-008、F-009 |
| T-004 | 提取前端补全行为规则，写出可测试用例 | Claude Code/Opus 5.5 2026-10-14 | `specs/completion.md`；F-010 至 F-013、F-017 |
| T-005 | 调研 Fig 的 Windows 原型和 inshellisense | Claude Code/Opus 5.5 2026-10-14 | `research/prior-art.md`；F-014 至 F-016 |
| T-006 | 重建多 AI 接力流程 | Claude Code/Opus 5.5 2026-10-14 | `AGENTS.md`、`docs/workflow.md`、本任务板、`docs/decisions.md`、`scripts/` 下的三个脚本 |
