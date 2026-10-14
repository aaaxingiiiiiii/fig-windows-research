# 任务板

规则见 `docs/workflow.md`。状态：`todo`、`doing`、`blocked`、`done`。`env` 取值：`any`、`mac-kiro`、`windows`、`human`；`decision:user` 表示需要用户先做决定。

## 进行中与待办

| 编号 | 任务 | 状态 | env | 依赖 | 负责人 | 完成标准 |
| --- | --- | --- | --- | --- | --- | --- |
| T-010 | 决定首个支持的 shell 和终端组合（D-002） | todo | decision:user | — | 用户 | `docs/decisions.md` 中 D-002 状态改为“已采用” |
| T-011 | 决定实现路线（D-003） | todo | decision:user | T-014（建议） | 用户 | D-003 状态改为“已采用” |
| T-016 | 核实 `research/prior-art.md` 第 3 节：PSReadLine 预测插件接口（`ICommandPredictor`）、`Register-ArgumentCompleter -Native` 配合 `MenuComplete`、VS Code 终端建议 | todo | any | — | | 每项附官方文档链接和适用版本；写明是否能拿到缓冲区和光标、是否能显示说明文字、是否按词元补全；修改第 3 节中的“未知”标注 |
| T-015 | 评估 `wf` spec 在 Windows 上的可用性 | todo | any | — | | 选出最常用的 30 个 CLI，列出它们的 generator 调用了哪些外部命令，分为“可直接使用”“需改写”“不适用”三类，写入 `research/spec-compat.md` |
| T-012 | 在 Kiro 2.30.0 上执行规格用例 C-001 至 C-013 | todo | mac-kiro, human | — | | 每条用例的“Kiro 2.30.0 观察”一栏都有结果和证据编号；与源码预期不一致的，新增 F-xxx |
| T-013 | 弄清 F-006：在 figterm 包装的交互式 zsh 中，`init zsh post` 输出什么，OSC 697 是否仍会发出 | todo | mac-kiro | — | | 用黑盒方式（例如 `script` 记录原始终端输出）获得证据，不反编译；F-006 的类型改为观察 |
| T-014 | Windows 验证：实测 inshellisense，并检验 PSReadLine 的能力 | todo | windows | — | | ①安装 PowerShell 7 和 inshellisense，在 pwsh 中执行规格中适用的用例，记录与源码预期的差异；②写一个最小 PSReadLine 脚本，验证能否读取缓冲区和光标、能否替换文本、Tab 处理器能否挂接、ListView 能否显示说明；结果写入 `research/windows-spike.md` |
| T-017 | 写出 PowerShell 的分词与转义规则（规格第 2、6 节的 Windows 版） | todo | any | T-010 | | `specs/completion.md` 新增 Windows 规则一节，并附至少 5 条用例（空格、引号、反引号、`;`、中文路径） |
| T-018 | 决定本项目代码的许可证（D-005） | todo | decision:user | — | 用户 | 在第一次提交实现代码之前完成 |

## 已完成

| 编号 | 任务 | 负责人 | 产出 |
| --- | --- | --- | --- |
| T-001 | 识别本机的目标产品、版本和哈希 | Claude Code/Opus 5.5 2026-10-14 | `research/target.md`；E-001、E-002、E-004 |
| T-002 | 核实开源来源和许可证，固定 commit | Claude Code/Opus 5.5 2026-10-14 | `research/sources.md`、`scripts/fetch-sources.sh` |
| T-003 | 追踪补全链路的原生层和 IPC | Claude Code/Opus 5.5 2026-10-14 | `research/architecture.md`；F-008、F-009 |
| T-004 | 提取前端补全行为规则，写出可测试用例 | Claude Code/Opus 5.5 2026-10-14 | `specs/completion.md`；F-010 至 F-013、F-017 |
| T-005 | 调研 Fig 的 Windows 原型和 inshellisense | Claude Code/Opus 5.5 2026-10-14 | `research/prior-art.md`；F-014 至 F-016 |
| T-006 | 重建多 AI 接力流程 | Claude Code/Opus 5.5 2026-10-14 | `AGENTS.md`、`docs/workflow.md`、本任务板、`docs/decisions.md`、`scripts/` 下的三个脚本 |
