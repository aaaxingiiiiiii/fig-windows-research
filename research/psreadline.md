# PSReadLine 与预测插件接口（T-016）

更新：2026-10-14。依据为 PSReadLine 源码 commit `2984546`（2.4.5 系列）、PowerShell 源码 commit `cf57653`，以及 Microsoft Learn 文档，链接列在文末。没有标注的条目为观察（读文档或源码所得）；运行时表现还需要在 T-020 中实测。

## 1. 适配模块可以使用的公共接口

| 能力 | 是否支持 | 接口 | 来源 |
| --- | --- | --- | --- |
| 读取缓冲区和光标 | 支持 | `GetBufferState(out string, out int)`；另一个重载额外返回 AST、Token 和解析错误 | [API] |
| 读取选区 | 支持 | `GetSelectionState(out start, out length)`，没有选区时返回 -1 | [API] |
| 按词元替换 | 支持，计为一步撤销，并立即重绘 | `Replace(start, length, text)` | [API] |
| 移动光标 | 支持 | `SetCursorPosition(int)` | [API] |
| 调用按键原有的功能 | 支持 | 所有可绑定的函数都是 `public static void X(ConsoleKeyInfo? key, object arg)`，例如 `TabCompleteNext`、`AcceptLine`、`PreviousHistory`、`RevertLine`、`SelfInsert` | [CMP] [SAMPLE] |
| 绑定可打印字符 | 支持；处理器需要自己调用 `SelfInsert` 写入字符 | `Set-PSReadLineKeyHandler` | [SAMPLE] [POK] |
| 编译后的处理器 | 支持；接口公开，但文档称其为 cmdlet 的辅助方法，日后可能变化（推断） | `SetKeyHandler(string[], Action<ConsoleKeyInfo?,object>, …)` | [SKH] |
| “缓冲区已变化”事件 | **不支持** | 公共接口中没有；`OnIdle` 只在缓冲区为空且空闲 300 ms 后触发 | [API] [RK] |
| 当前目录、环境变量 | 支持；处理器运行在 ReadLine 线程上 | `$PWD`、`$env:` | [RK] |
| 光标所在单元格 | 支持（缓冲区坐标） | `[Console]::CursorLeft/Top`，PSReadLine 自己也用它 | [CON] [CL] |
| 使用 PowerShell 自带的补全 | 支持 | 在进程内调用 `TabExpansion2 -inputScript -cursorColumn` | [TE2] |

处理器的执行细节：

- 脚本处理器在 ReadLine 线程上同步执行。在 Windows 上，每次调用前后还会切换控制台输入模式和输出编码。每次按键的实际开销尚未测量（未知）。
- 处理器抛出异常时，PSReadLine 会打印错误并重新初始化当前行。适配模块必须自己捕获所有异常。

## 2. 预测插件 `ICommandPredictor`

- 要求 PowerShell 7.2 或更新、PSReadLine 2.2.2 或更新，并设置 `PredictionSource` 为 `Plugin` 或 `HistoryAndPlugin`（[PRED] [OPT]）。默认值有矛盾：文档写 `None`，源码在 PowerShell 7 的非旧版控制台中默认 `HistoryAndPlugin`（[DEF]），需要实测。
- `GetSuggestion` 由渲染流程调用（[GR]）。每个插件在线程池上运行，**限时 20 ms**，超时即取消（[CP]）。
- `PredictionContext` 的 `CursorPosition` 实际是**输入的末尾，不是真实光标**（[CTX]）。
- 以下情况不会调用插件（[QFS] [LV] [IV] [CI] [HIS2] [SR]）：
  - 输入为空、只有空白或有多行；
  - 列表视图下输入没有变化；
  - 内联视图下，现有建议仍是输入的前缀；
  - 正在 Tab 补全、调出历史或搜索历史；
  - 屏幕阅读器模式。
- 用作“缓冲区变化钩子”（只记录输入、返回空结果）的可行性（推断）：能覆盖大多数编辑操作，包括输入法提交的中文；但清空、Esc、历史调出、光标移动和补全都不会触发，拿不到真实光标，并且必须编译成 DLL。另外，与 PSReadLine 的历史预测同时开启时，内联灰字匹配前缀会导致插件不被调用，所以可能需要改成只用 `Plugin`，或者把历史建议也移到悬浮窗里显示。

## 3. 列表视图与原生补全（用于对照）

- 列表视图中的预测是整行建议，选中后替换整个缓冲区；最多显示 10 行、50 项；只显示选中项的提示（[RS] [LVC] [TT]）。不适合做按词元的 Fig 式补全。
- `Register-ArgumentCompleter -Native` 是按词元补全，`CompletionResult` 可以带提示文字，在 Ctrl+Space 菜单中显示（[RAC] [MT]）。

## 4. 按键冲突

| 按键 | PSReadLine 默认（Windows 模式） | Windows Terminal 默认 | 适配模块的处理 |
| --- | --- | --- | --- |
| Tab / Shift+Tab | `TabCompleteNext` / `TabCompletePrevious` | 未绑定 | 悬浮窗可见时接管，否则调用原函数 |
| Enter | `AcceptLine` | 只在有选区时用于复制 | 同上 |
| Esc | `RevertLine` | 未绑定 | 同上 |
| ↑ / ↓ | 历史；列表视图有项时用于在列表中移动 | 未绑定 | 同上；需要处理与列表视图的冲突 |
| Ctrl+Space | `MenuComplete` | 未绑定 | 微软拼音可能把它用作中英文切换（社区报告，推断） |
| → | 行尾时接受内联灰字 | 未绑定 | Fig 默认不绑定 |

来源：[F] [WTD] [WTA] [BE] [HIS]。

- **粘贴**：Windows Terminal 默认用 Ctrl+Shift+V 和 Shift+Insert 粘贴（生成的用户设置中还有 Ctrl+V），文本作为输入逐字符送入；PSReadLine 不支持括号粘贴模式（issue #1471）。因此，如果绑定了可打印字符，粘贴时每个字符都会调用一次处理器（[WTD] [WTU] [BP] [RD]）。
- **输入法**：WT 自己通过 TSF 处理输入法组字（[TSF]）。推断：组字期间 PSReadLine 看不到内容，回车、方向键和 Esc 由输入法消费；提交后的中文会直接进入缓冲区，不经过按键处理器。

## 5. 对适配模块设计的影响

感知输入变化有三种候选做法，T-020 需要实测比较：

| 做法 | 优点 | 缺点 |
| --- | --- | --- |
| A. 预测插件钩子，加上特殊按键（Tab、Enter、↑、↓、Esc、Backspace、←、→、Home、End）的处理器 | 覆盖输入法提交的文字；不必为每个字符绑定处理器 | 有多种跳过的情况；需要编译 DLL；可能与历史预测冲突 |
| B. 为所有可打印字符绑定编译后的处理器 | 每次按键都能拿到准确的缓冲区和光标 | 输入法提交的文字感知不到；粘贴时逐字符调用；依赖一个非正式的接口 |
| C. 在进程内用后台线程轮询 `GetBufferState` | 实现最简单 | 从其他线程读取时没有加锁，可能读到不一致的数据（推断）；会持续占用 CPU |

建议先试 A，用 B 中的特殊按键处理器弥补 A 遗漏的事件。三种做法都无法直接得到光标的**像素**位置，像素定位由 T-019 解决。

## 6. 需要在 Windows 上实测的项目（T-020）

1. 每次按键的额外延迟：脚本处理器与 C# 委托对比，分别测试正常输入和粘贴约 10 KB 文本。
2. 在 WT 中用 `WhatIsKey`（Alt+?）检查 Tab、Shift+Tab、Esc、↑、↓、Ctrl+Space 能否到达 PSReadLine，分别测试开启和关闭微软拼音的情况。
3. 输入法组字期间和提交后，处理器和预测插件各自会被调用几次。
4. 预测插件钩子的调用频率、遗漏的情况，以及在其他线程调用 `GetBufferState` 是否安全。
5. 三种粘贴方式（Ctrl+V、右键、Shift+Insert）各触发多少次处理器调用和重绘。
6. 输入宽字符（中文）、自动换行和多行输入时，`CursorLeft/Top` 是否等于光标所在的单元格。
7. 命名管道的往返耗时；宿主进程没有运行时，超时的表现。
8. 内联视图开启时，执行 `Replace` 和 `SetCursorPosition` 后的撤销与重绘是否正常。
9. 目标机器上 `PredictionSource` 的实际默认值。

## 来源

- [F] https://learn.microsoft.com/en-us/powershell/module/psreadline/about/about_psreadline_functions
- [OPT] https://learn.microsoft.com/en-us/powershell/module/psreadline/set-psreadlineoption
- [PRED] https://learn.microsoft.com/en-us/powershell/scripting/dev-cross-plat/create-cmdline-predictor
- [RAC] https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/register-argumentcompleter
- [TE2] https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/tabexpansion2
- [CON] https://learn.microsoft.com/en-us/dotnet/api/system.console.cursorleft
- [WTA] https://learn.microsoft.com/en-us/windows/terminal/customize-settings/actions
- [API] https://github.com/PowerShell/PSReadLine/blob/2984546f62da9f63c31aba965ec3008fcb107024/PSReadLine/PublicAPI.cs#L72-L230
- [SKH] https://github.com/PowerShell/PSReadLine/blob/2984546f62da9f63c31aba965ec3008fcb107024/PSReadLine/Options.cs#L270-L303
- [POK] https://github.com/PowerShell/PSReadLine/blob/2984546f62da9f63c31aba965ec3008fcb107024/PSReadLine/ReadLine.cs#L668-L705
- [RK] https://github.com/PowerShell/PSReadLine/blob/2984546f62da9f63c31aba965ec3008fcb107024/PSReadLine/ReadLine.cs#L168-L310
- [RD] https://github.com/PowerShell/PSReadLine/blob/2984546f62da9f63c31aba965ec3008fcb107024/PSReadLine/Render.cs#L222-L236
- [SR] https://github.com/PowerShell/PSReadLine/blob/2984546f62da9f63c31aba965ec3008fcb107024/PSReadLine/Render.cs#L288-L292
- [GR] https://github.com/PowerShell/PSReadLine/blob/2984546f62da9f63c31aba965ec3008fcb107024/PSReadLine/Render.cs#L446-L448
- [QFS] https://github.com/PowerShell/PSReadLine/blob/2984546f62da9f63c31aba965ec3008fcb107024/PSReadLine/Prediction.cs#L456-L470
- [RS] https://github.com/PowerShell/PSReadLine/blob/2984546f62da9f63c31aba965ec3008fcb107024/PSReadLine/Prediction.cs#L261-L290
- [LVC] https://github.com/PowerShell/PSReadLine/blob/2984546f62da9f63c31aba965ec3008fcb107024/PSReadLine/Prediction.Views.cs#L209-L224
- [LV] https://github.com/PowerShell/PSReadLine/blob/2984546f62da9f63c31aba965ec3008fcb107024/PSReadLine/Prediction.Views.cs#L350-L420
- [TT] https://github.com/PowerShell/PSReadLine/blob/2984546f62da9f63c31aba965ec3008fcb107024/PSReadLine/Prediction.Views.cs#L701
- [IV] https://github.com/PowerShell/PSReadLine/blob/2984546f62da9f63c31aba965ec3008fcb107024/PSReadLine/Prediction.Views.cs#L1275-L1310
- [CMP] https://github.com/PowerShell/PSReadLine/blob/2984546f62da9f63c31aba965ec3008fcb107024/PSReadLine/Completion.cs#L58-L134
- [CI] https://github.com/PowerShell/PSReadLine/blob/2984546f62da9f63c31aba965ec3008fcb107024/PSReadLine/Completion.cs#L204-L213
- [MT] https://github.com/PowerShell/PSReadLine/blob/2984546f62da9f63c31aba965ec3008fcb107024/PSReadLine/Completion.cs#L553-L567
- [BE] https://github.com/PowerShell/PSReadLine/blob/2984546f62da9f63c31aba965ec3008fcb107024/PSReadLine/BasicEditing.cs#L19-L60
- [HIS] https://github.com/PowerShell/PSReadLine/blob/2984546f62da9f63c31aba965ec3008fcb107024/PSReadLine/History.cs#L947-L975
- [HIS2] https://github.com/PowerShell/PSReadLine/blob/2984546f62da9f63c31aba965ec3008fcb107024/PSReadLine/History.cs#L860-L868
- [DEF] https://github.com/PowerShell/PSReadLine/blob/2984546f62da9f63c31aba965ec3008fcb107024/PSReadLine/Cmdlets.cs#L217-L221
- [CL] https://github.com/PowerShell/PSReadLine/blob/2984546f62da9f63c31aba965ec3008fcb107024/PSReadLine/ConsoleLib.cs#L22-L31
- [SAMPLE] https://github.com/PowerShell/PSReadLine/blob/2984546f62da9f63c31aba965ec3008fcb107024/PSReadLine/SamplePSReadLineProfile.ps1#L125-L140
- [BP] https://github.com/PowerShell/PSReadLine/issues/1471
- [CP] https://github.com/PowerShell/PowerShell/blob/cf5765391c7c78914d5316f0b8105fa652456cc4/src/System.Management.Automation/engine/Subsystem/PredictionSubsystem/CommandPrediction.cs#L61-L135
- [CTX] https://github.com/PowerShell/PowerShell/blob/cf5765391c7c78914d5316f0b8105fa652456cc4/src/System.Management.Automation/engine/Subsystem/PredictionSubsystem/ICommandPredictor.cs#L155-L200
- [WTD] https://github.com/microsoft/terminal/blob/44b440bf043522ec06014b2cff30d0f52ca30b68/src/cascadia/TerminalSettingsModel/defaults.json#L720-L800
- [WTU] https://github.com/microsoft/terminal/blob/44b440bf043522ec06014b2cff30d0f52ca30b68/src/cascadia/TerminalSettingsModel/userDefaults.json#L26-L27
- [TSF] https://github.com/microsoft/terminal/tree/44b440bf043522ec06014b2cff30d0f52ca30b68/src/tsf
