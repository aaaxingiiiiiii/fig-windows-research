# 任务板

规则见 `docs/workflow.md`。状态：`todo`、`doing`、`blocked`、`done`。`env` 取值：`any`、`mac-kiro`、`windows`、`human`；`decision:user` 表示需要用户先做决定。

## 进行中与待办

路线见 D-007，实现步骤和测试步骤见 `docs/mvp-plan.md`。开发在 `develop` 分支上进行（D-008）。

### 阶段 A：终端内版本（基于 inshellisense）

| 编号 | 任务 | 状态 | env | 依赖 | 负责人 | 完成标准 |
| --- | --- | --- | --- | --- | --- | --- |
| T-035 | 实测原版 inshellisense（关卡） | todo | windows, human | — | | 见 `docs/mvp-plan.md` 中该任务所在的行；按“T-035 人工清单”执行 |
| T-036 | 把 inshellisense 源码引入 `src/inshellisense/`，跑通构建和测试，编写 `docs/dev.md` | todo | any | — | | 见 `docs/mvp-plan.md` 中该任务所在的行 |
| T-037 | Windows 上的 generator 不再依赖 Git Bash | todo | any（Windows 上验证） | T-036 | | 见 `docs/mvp-plan.md` 中该任务所在的行 |
| T-038 | 把规格用例改写为针对 inshellisense 引擎的测试，整理与 Fig 的差异 | todo | any | T-036 | | 见 `docs/mvp-plan.md` 中该任务所在的行 |
| T-039 | 补齐 1–3 项高优先级差异 | todo | any | T-038 | | 见 `docs/mvp-plan.md` 中该任务所在的行 |
| T-040 | 打包 win-x64 单文件程序，编写安装和卸载脚本 | todo | windows | T-035, T-037 | | 见 `docs/mvp-plan.md` 中该任务所在的行 |
| T-041 | 用户试用终端内版本一到两天 | todo | human | T-040 | 用户 | 见 `docs/mvp-plan.md` 中该任务所在的行 |

### 阶段 B：悬浮窗（复用阶段 A）

| 编号 | 任务 | 状态 | env | 依赖 | 负责人 | 完成标准 |
| --- | --- | --- | --- | --- | --- | --- |
| T-042 | 编写悬浮窗协议 `docs/protocol.md`（inshellisense → 宿主） | todo | any | T-036 | | 见 `docs/mvp-plan.md` 中该任务所在的行 |
| T-043 | 在 inshellisense 中抽象渲染器，新增悬浮窗渲染器和回退逻辑 | todo | any | T-042 | | 见 `docs/mvp-plan.md` 中该任务所在的行 |
| T-029 | 自动测试工具 `tools/wt-driver` | todo | windows | — | | 见 `docs/mvp-plan.md` 中该任务所在的行 |
| T-019 | 光标定位（`ICaretLocator`：UIA 优先，单元格换算作为后备） | todo | windows, human | T-029 | | 见 `docs/mvp-plan.md` 中该任务所在的行；并达到 `docs/overlay-design.md` 中的通过标准 |
| T-021 | 原生悬浮列表窗口：置顶、不激活、跟随 WT | todo | windows, human | — | | 同上 |
| T-044 | 宿主集成：管道服务端、定位并显示、报告失败、`debugState` | todo | windows | T-042, T-019, T-021 | | 见 `docs/mvp-plan.md` 中该任务所在的行 |
| T-045 | 端到端测试（L2 自动测试，加上 L3 人工清单） | todo | windows, human | T-043, T-044, T-029 | | 见 `docs/mvp-plan.md` 中该任务所在的行 |
| T-046 | 把宿主加入安装脚本，用户试用 | todo | windows, human | T-045, T-040 | | 见 `docs/mvp-plan.md` 中该任务所在的行 |

### 低优先级

| 编号 | 任务 | 状态 | env | 依赖 | 负责人 | 完成标准 |
| --- | --- | --- | --- | --- | --- | --- |
| T-015 | 评估 `wf` spec 在 Windows 上的可用性（对 T-037 有参考价值） | todo | any | — | | 选出最常用的 30 个 CLI，列出它们的 generator 调用了哪些外部命令，分为“可直接使用”“需改写”“不适用”三类，写入 `research/spec-compat.md` |
| T-012 | 在 Kiro 2.30.0 上执行规格用例 C-001 至 C-013 | todo | mac-kiro, human | — | | 每条用例的“Kiro 2.30.0 观察”一栏都有结果和证据编号 |
| T-013 | 弄清 F-006：在 figterm 包装的交互式 zsh 中，`init zsh post` 输出什么 | todo | mac-kiro | — | | 用黑盒方式取得证据，不反编译 |

## 已完成

| 编号 | 任务 | 负责人 | 产出 |
| --- | --- | --- | --- |
| T-047 | 路线修订为“先 inshellisense，后悬浮窗”；建立 `develop` 分支；重写实现计划 | Claude Code/Opus 5.5 2026-10-14 | `docs/mvp-plan.md`（新版）；D-007、D-008；旧计划存档 |
| T-020、T-022 至 T-028、T-030 至 T-033 | （取消）PSReadLine 路线的任务，被 D-007 取代；需要时可以在 `docs/archive/` 中查看原计划 | — | — |
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
