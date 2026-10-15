# 任务板

规则见 `docs/workflow.md`。状态：`todo`、`doing`、`blocked`、`done`。`env` 取值：`any`、`mac-kiro`、`windows`、`human`；`decision:user` 表示需要用户先做决定。

## 进行中与待办

路线见 D-007，实现步骤和测试步骤见 `docs/mvp-plan.md`。开发在 `develop` 分支上进行（D-008）。

### 阶段 A：终端内版本（基于 inshellisense）

| 编号 | 任务 | 状态 | env | 依赖 | 负责人 | 完成标准 |
| --- | --- | --- | --- | --- | --- | --- |
| T-035 | 实测原版 inshellisense（关卡） | doing | windows, human | — | Codex/GPT-6（Windows）2026-10-14；环境/受控 PTY 检查通过；2026-10-15 同步并完成修改版 L1 预检（失败见 T-052），WT 人工验收待完成 | 见 `docs/mvp-plan.md` 中该任务所在的行；按“T-035 人工清单”执行 |
| T-048 | 在 Windows 上验证我们的修改（T-037 直接执行命令，T-039 引号和中文删除，T-049 POSIX 命令模拟） | todo | windows, human | — | | 见 `docs/mvp-plan.md` 中的“T-048 人工清单” |
| T-040 | 打包 win-x64 单文件程序，编写安装和卸载脚本 | todo | windows | T-035, T-048 | | 见 `docs/mvp-plan.md` 中该任务所在的行 |
| T-041 | 用户试用终端内版本一到两天 | todo | human | T-040 | 用户 | 见 `docs/mvp-plan.md` 中该任务所在的行 |
| T-052 | 修复 Windows 本机 L1 测试的平台与环境假设 | done | any | — | Codex/GPT-6（Windows）2026-10-15；265 通过、10 跳过、0 失败，见 E-009 | 复现 `research/spike-inshellisense.md` E-008 的 11 个失败；路径断言同时验证分隔符和 PowerShell 引号，隔离 HOME/Git Bash 条件，明确非管理员符号链接夹具策略；保留行为覆盖，Windows 复验并记录结果 |

### 阶段 B：悬浮窗（复用阶段 A）

| 编号 | 任务 | 状态 | env | 依赖 | 负责人 | 完成标准 |
| --- | --- | --- | --- | --- | --- | --- |
| T-042 | 编写悬浮窗协议 `docs/protocol.md`（inshellisense → 宿主） | done | any | — | Codex/GPT-6 2026-10-14（Mac，分支 `ai/codex/T-042`） | `docs/protocol.md` v1、D-009：双向 JSON 行、会话/序号、显示快照、定位/回退、debugState、P-01 至 P-12；JSON 示例与引用检查通过，T-043/T-044 尚待实现 |
| T-043 | 在 inshellisense 中抽象渲染器，新增悬浮窗渲染器和回退逻辑 | done | any | T-042 | Claude Code/Opus 5.5 2026-10-15（Mac，分支 `ai/claude/T-043`；用户改派，原预留给 Codex/GPT） | `src/inshellisense/src/overlay/`；81 个 L1 测试；`spikes/T-043-fake-host/`；在 Mac 上用 node-pty 驱动真实 inshellisense 检查了 4 种宿主状态；`docs/dev.md` 第 4 节。Windows 命名管道和 C# 宿主由 T-044 验证 |
| T-029 | 自动测试工具 `tools/wt-driver` | todo | windows | — | | 见 `docs/mvp-plan.md` 中该任务所在的行 |
| T-019 | 光标定位（`ICaretLocator`：UIA 优先，单元格换算作为后备） | todo | windows, human | T-029 | | 见 `docs/mvp-plan.md` 中该任务所在的行；并达到 `docs/overlay-design.md` 中的通过标准 |
| T-021 | 原生悬浮列表窗口：置顶、不激活、跟随 WT | todo | windows, human | — | | 同上 |
| T-053 | 宿主协议核心（C# 类库，`src/overlay-host/`）：分帧、严格校验、会话和序号、状态机、租期、背压、debugState；窗口和 UIA 用接口隔开 | doing | any | T-042 | Claude Code/Opus 5.5 2026-10-15（Mac，分支 `ai/claude/T-053`；用户同意在 Mac 上安装 .NET SDK） | 宿主一侧的 P-01 至 P-04、P-08、P-11、P-12 单元测试通过（`dotnet test`）；见 `docs/roadmap.md` 第 8.2 节 |
| T-054 | 独立审查 T-043：对照 `docs/protocol.md` 检查 inshellisense 一侧的悬浮窗实现 | doing | any | T-043 | Codex/GPT-6 2026-10-15（Mac，分支 `ai/codex/T-054`） | 每个问题都有一个会失败的测试，并已修复或登记为任务；结论写入 log |
| T-044 | 宿主集成：管道服务端、定位并显示、报告失败、`debugState` | todo | windows | T-042, T-019, T-021；有 T-053 时直接引用 | | 见 `docs/mvp-plan.md` 中该任务所在的行 |
| T-045 | 端到端测试（L2 自动测试，加上 L3 人工清单） | todo | windows, human | T-043, T-044, T-029 | | 见 `docs/mvp-plan.md` 中该任务所在的行 |
| T-046 | 把宿主加入安装脚本，用户试用 | todo | windows, human | T-045, T-040 | | 见 `docs/mvp-plan.md` 中该任务所在的行 |

### 低优先级

| 编号 | 任务 | 状态 | env | 依赖 | 负责人 | 完成标准 |
| --- | --- | --- | --- | --- | --- | --- |
| T-015 | 评估 `wf` spec 在 Windows 上的可用性（对 T-037 有参考价值） | done | any | — | Codex/GPT-6 2026-10-14（Mac，分支 `ai/codex/T-015`） | `research/spec-compat.md`：30 项源码评估（11 可直接使用、17 需改写、2 不适用），外部命令/共享 helper 清单、T-037 改写建议和 Windows 验证清单；非使用率排名，尚无 Windows 实测 |
| T-055 | 补齐 `research/spec-compat.md` 中“仍未处理的项”：gh 的 GraphQL 参数引号、scp 的 `host:path` 与盘符、dotnet 的 `launchSettings.json` 相对路径 | todo | any | — | 预留：Codex/GPT（Mac） | 模拟 win32 的测试通过；改动记入 `CHANGES.md` |
| T-012 | 在 Kiro 上执行规格用例 C-001 至 C-013 | doing | mac-kiro, human | — | 用户 2026-10-15 完成 13 项（Kiro 2.31.1），Claude 记录 | 已记录 10 项（E-010、F-033）。**剩下 3 项需要用户重测**：C-008（先 `cd` 进 `local/t012`）、C-003（末尾有没有空格）、C-012（空命令行按 Enter 是否出现新的提示符） |

## 已完成

| 编号 | 任务 | 负责人 | 产出 |
| --- | --- | --- | --- |
| T-013 | 弄清 F-006：`init zsh post` 为什么只输出 4 行 | Claude Code/Opus 5.5 2026-10-15 | 由 `Q_TERM`（figterm 设置）决定是否输出完整集成脚本；F-006 改为观察；E-007；target.md 注明 Kiro 已自动更新为 2.31.0 |
| T-051 | custom generator 默认在 generator 的目录中执行命令，输出按 Fig 的规则清理（F-032） | Claude Code/Opus 5.5 2026-10-15 | `src/inshellisense/src/runtime/generator.ts`；`customGenerator.test.ts`（4 个）；T-048 清单第 8 项 |
| T-049 | Windows 上用 Node 模拟 spec 中常用的 POSIX 命令（`ls -1ApL`、`cat`、`grep` 和 9 条 `bash -c` 脚本），generator 上下文补上 HOME | Claude Code/Opus 5.5 2026-10-14 | `src/inshellisense/src/runtime/posixEmulation.ts`、`utils.ts`、`generator.ts`；`posixEmulation.test.ts`（31 个）；T-048 清单第 4 至 6 项；F-032、T-051 |
| T-037 | Windows 上的 generator 改为直接执行（cross-spawn），找不到命令时才退回 Git Bash | Claude Code/Opus 5.5 2026-10-14 | `src/inshellisense/src/runtime/utils.ts`、`package.json`；`executeCommand.test.ts`；Windows 验证见 T-048 |
| T-039 | 修复 pwsh 路径引号（W-002 至 W-004、W-008、W-009）和中文删除数（W-005） | Claude Code/Opus 5.5 2026-10-14 | `src/inshellisense/src/runtime/replacement.ts`、`utils.ts`；对应用例转为回归测试；`CHANGES.md` 中标注可提交上游 |
| T-038 | 规格用例自动化：C-001 至 C-013 和新增的 W-001 至 W-009，整理与 Fig 的差异 | Claude Code/Opus 5.5 2026-10-14 | `src/inshellisense/src/tests/figspec/figspec.test.ts`；`specs/completion.md` 第 9、10 节；F-029 至 F-031 |
| T-036 | 引入 inshellisense 源码到 `src/inshellisense/`，在 Mac 上跑通构建和测试，编写 `docs/dev.md` | Claude Code/Opus 5.5 2026-10-14 | `src/inshellisense/`（含 `UPSTREAM`、`CHANGES.md`）、`docs/dev.md`；F-028 |
| T-047 | 路线修订为“先 inshellisense，后悬浮窗”；建立 `develop` 分支；重写实现计划 | Claude Code/Opus 5.5 2026-10-14 | `docs/mvp-plan.md`（新版）；D-007、D-008；旧计划存档 |
| T-050 | （取消）向 microsoft/inshellisense 提交修复：PR #486–#488 创建后由用户取消，已关闭（D-011） | — | — |
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
