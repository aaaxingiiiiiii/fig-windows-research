# PowerShell 自带命令的补全（调研）

2026-10-16。调研：GPT（Codex，本机只读，由整合者派发）；核对：Claude Code/Opus 5.5（整合者），复查了下文“现状”中的两处源码，结论属实。结论编号 F-038。

## 结论

inshellisense 现在**没有接入 PowerShell 的原生补全**：
- PowerShell 自己的命令（cmdlet、函数、别名，例如 `Get-ChildItem`、`Set-Location`）不会出现在候选中；
- 这些命令的参数（`-Path`）和参数值也没有候选；
- `cd`、`ls` 有候选，用的是 Fig 为 Unix 写的同名规格。`ls` 在 PowerShell 中是 `Get-ChildItem` 的别名，会提示不适用的 Unix 选项（例如 `-1`、`-A`）。

没有候选时，Tab 交还给 shell，PSReadLine 自带的 Tab 补全仍然可用，但不会自动显示 Fig 式的列表。

## 现状（源码，以 `src/inshellisense/` 为基准）

| 问题 | 结论 | 依据 |
| --- | --- | --- |
| 命令名从哪里来 | 只有 spec 名称和已加载的别名，没有扫描 PATH，也没有调用 `Get-Command` | `src/runtime/runtime.ts` 的 `runCommand`（整合者已核对） |
| 别名 | 只加载 bash、zsh 的别名 | `src/runtime/alias.ts` 的 `loadAliases` |
| 命令名之后 | 找不到 spec 就直接返回，参数没有后备 | `src/runtime/runtime.ts` 的 `getSuggestions`（`if (spec == null) return;`，整合者已核对） |
| shell 集成 | PowerShell 的集成脚本只报告提示符边界和当前目录 | `shell/shellIntegration.ps1`、`src/isterm/pty.ts` 的 `_handleIsSequence` |
| spec 库 | `@withfig/autocomplete` 2.675.0 的 1452 个规格中，没有 PowerShell cmdlet 的规格 | 安装包的导出索引 |

## 可选做法

工作量是单人粗估，包括基本的回归验证，不包括 Windows 上的完整验收。延迟中，第一行是 Mac 上的实测，其余是目标。

| 做法 | 原理 | 工作量 | 每次按键的延迟 | 局限 |
| --- | --- | --- | --- | --- |
| 常驻的独立 pwsh | 一个后台 pwsh 进程，用 JSON 行接收命令行、光标和当前目录，调用 `TabExpansion2`（即 `CommandCompletion.CompleteInput`） | 3–5 人日 | 预热后 P95：命令名 7.9 ms，参数 0.39 ms，路径 0.78 ms；第一次约 0.8 s | 看不到用户在自己的会话中新定义的函数、别名、变量和注册的 completer |
| 在用户实际的 pwsh 会话中补全 | 扩展 shell 集成脚本，用一个专用按键让 PSReadLine 在当前会话中调用原生补全，结果通过 OSC 或管道返回 | 5–10 人日 | 目标 10–30 ms，未测 | 最完整；但读行时主 runspace 不能并发，慢的 completer 会阻塞输入 |
| 会话命令表缓存 | 启动时、每条命令之后导出 `Get-Command` 的名称和类型 | 1–2 人日 | < 1 ms | 只能补命令名，不能补参数 |
| 常用 cmdlet 的静态 spec | 从 `Get-Command`、`Get-Help` 生成 10–20 个规格 | 2–4 人日 | < 1 ms | 动态参数、参数集、自定义 completer 难以表达 |

所有原生做法都需要：
- 保留原生补全给出的替换范围（`ReplacementIndex`、`ReplacementLength`），插入时用 `CompletionText`、显示时用 `ListItemText`。现在的替换逻辑按词元退格，并默认加一个空格，不能直接套用。
- 用户注册的 completer 可能很慢：要限流，丢弃过期的结果，失败时回退。

## 推荐

1. 先做常驻 worker，验证集成方式和替换范围；
2. 再做会话命令表，并按实际命令类型路由：cmdlet、函数及其别名交给 PowerShell，外部程序继续用 Fig 的规格，这样 `ls` 不再提示 Unix 选项；
3. 最后做实际会话中的补全；
4. 静态 spec 放在最后。

GPT 已在 Mac 上做了最小实验（pwsh 7.6.7，`-NoProfile`，脚本全在内存中）：
- `Get-ChildItem -Pa` 补出 `-Path`；
- `Get-ChildItem -Path ./docs/us` 补出 `./docs/usage.md`；
- 同一进程中新定义的函数和别名能补出名称，以及 ValidateSet 中的取值。

这些是 Mac 上简单用例的观察，不代表 Windows 上的延迟。

**是否要做、做到哪一步，需要用户决定（T-064）**：这扩大了阶段 A 的范围，但对 PowerShell 用户来说，这是 Fig 式补全最明显的一块缺口。
