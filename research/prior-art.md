# Windows 现状与可复用方案

更新：2026-10-14（T-005）。源码引用的别名见 `sources.md`。标注“推断”的条目没有经过运行验证，其余均为读源码得到的观察。

## 1. Fig 自己的 Windows 移植：未完成的原型

Fig 官方从未发布 Windows 版。`aq` 的 README 让 Windows 用户去参与讨论区或改用 WSL（`aq:README.md#L54-L57`）。源码中的 Windows 部分完成度如下：

| 模块 | 完成度 | 内容 |
| --- | --- | --- |
| figterm 的 ConPTY 层 `aq:crates/figterm/src/pty/win/` | 可用 | 调用 `CreatePseudoConsole`，优先加载随附的 `conpty.dll`；开启 `WIN32_INPUT_MODE \| PASSTHROUGH_MODE`（`pseudocon.rs#L55-L117`）。不带参数时启动 `cmd.exe` |
| figterm 外层控制台 `aq:crates/figterm/src/term/windows.rs` | 可用 | 使用 `ReadConsoleInputW`、`GetConsoleScreenBufferInfo`，设置 UTF-8 代码页和 VT 模式；光标所在单元格来自屏幕缓冲区信息 |
| 桌面端 `aq:crates/fig_desktop/src/platform/windows.rs` | 部分实现 | 用 UI Automation 和 MSAA 定位光标：控制台使用 `TextPattern.GetSelection → GetBoundingRectangles`（L176-L223），其他窗口使用 `OBJID_CARET` 的 `accLocation`（L449-L470）。终端程序按可执行文件名白名单识别（L385-L405）。`get_cursor_position` 返回 `None`，`shell()` 固定返回 `"bash"`（L261-L280）。高度计算可能取了负值（L206，推断为缺陷） |
| IPC `aq:crates/fig_ipc/src/unix_socket.rs` | 缺失 | 无条件使用 `tokio::net::UnixStream`，没有命名管道（named pipe）实现。推断在 Windows 上无法编译 |
| Shell 集成 | 缺失 | 只支持 bash、zsh、fish、nu（`aq:crates/fig_util/src/shell.rs#L28-L36`）。`doctor` 会提示 “CMD isn't supported yet” 和 “Powershell isn't supported yet”（`aq:crates/q_cli/src/cli/doctor/mod.rs#L613-L622`）。引导流程启动的是 Git Bash |
| 安装 `aq:crates/fig_install/src/windows.rs` | 只有骨架 | 下载安装包后静默运行 |

结论（推断）：可以参考 ConPTY 封装和光标定位思路，但没有可以直接运行的 Windows 版本。PowerShell 和 cmd 的支持需要从头设计。

## 2. Microsoft inshellisense：已在 Windows 上运行的同类实现

MIT 许可，TypeScript 编写，仍在维护（固定 commit `8dcc9ca`，2026-10-03）。

| 环节 | 做法 | 引用 |
| --- | --- | --- |
| 接入 shell | 通过 node-pty（ConPTY）启动 shell，同时把输出写入一个无界面的 xterm.js 作为影子终端 | `is:src/isterm/pty.ts#L75-L92` |
| pwsh 和 powershell | 使用 `-noexit -command . shellIntegration.ps1` 启动；脚本包装 `Prompt` 函数，输出 OSC 6973 序列 `PS`、`PE`、`CWD;<路径>` | `is:shell/shellIntegration.ps1#L18-L25`、`is:src/isterm/pty.ts#L441-L444` |
| cmd | 在 `PROMPT` 环境变量前后插入 PS/PE 标记，没有 CWD 标记（推断：cmd 中的当前目录不会更新） | `is:src/isterm/pty.ts#L495-L501` |
| 读取命令行 | 在 PS/PE 处放置 xterm 标记，从提示符结束位置读取到光标，并处理自动换行；按暗色或斜体识别并排除 PSReadLine 的预测灰字 | `is:src/isterm/commandManager.ts#L62-L264` |
| 显示 | 在终端内用 ANSI 绘制：40 列候选框加 30 列说明框，按剩余行数决定画在光标上方还是下方。不使用系统悬浮窗 | `is:src/ui/suggestionManager.ts#L18-L24`、`is:src/isterm/pty.ts#L334-L415` |
| 按键 | stdin 使用原始模式；只在候选可见时拦截 Tab、上下方向键和 Esc，可以配置。会从 pty 输出中去掉 win32-input-mode 序列（`?9001h`） | `is:src/ui/ui-root.ts#L81-L99`、`is:src/ui/stdioProxy.ts#L15-L20` |
| 插入 | 先写入 N 个 DEL（`0x7f`）删除当前词，再写入候选文本；默认插入 `name + " "` | `is:src/runtime/replacement.ts#L18-L47` |
| Spec | 固定使用 `@withfig/autocomplete` 2.675.0，打包在程序中；不加载 gcloud、az、aws 的 spec | `is:package.json#L47`、`is:src/runtime/runtime.ts#L26-L28` |
| Generator | 支持 script、postProcess、splitOn、custom、template 和缓存；**在 Windows 上通过 Git Bash 执行**；history 和 help 模板返回空列表 | `is:src/runtime/utils.ts#L17-L24`、`is:src/runtime/template.ts#L26-L34` |
| 运行时 | Node `>=18 <23`；发布物是 Node SEA 单文件，提供 win-x64 和 win-arm64 包 | `is:package.json#L7`、`is:scripts/pkg.ts` |

已知限制：cmd 支持是实验性的；Windows 端到端测试只覆盖 cmd、pwsh、powershell 和 xonsh；`insertValue` 中的 `{cursor}` 没有实现（推断，源码中无引用）；没有 Git for Windows 时 script generator 可能失败（推断）。

## 3. 其他 Windows 方案（未克隆，需要验证）

| 方案 | 特点 | 与 Fig 的差距 |
| --- | --- | --- |
| PSReadLine 预测插件（`ICommandPredictor`，PowerShell 7.2+） | 官方扩展点，每次按键都会收到当前输入，结果显示在 PSReadLine 的 ListView 中 | 推断：建议以整行为单位，不是按词元补全；说明文字的显示能力未知 |
| `Register-ArgumentCompleter -Native` 配合 `MenuComplete` | 按词元补全，`CompletionResult` 可以带 ToolTip | 需要按 Tab 或 Ctrl+Space 触发，不会自动弹出 |
| VS Code 终端建议（terminal suggest） | 也使用 Fig spec | 只能在 VS Code 内使用 |

以上三项的事实都来自记忆，尚未在本仓库中核实（未知），由 T-016 负责核实。

## 4. 各环节对照与 Windows 实现要点

| 环节 | Fig（macOS） | inshellisense | Windows 实现需要（推断） |
| --- | --- | --- | --- |
| 接入 shell | figterm 用 PTY 包装 shell，rc 脚本输出 OSC 697 | node-pty（ConPTY），OSC 6973 | 方案 A：ConPTY 包装加 pwsh `Prompt` 标记；方案 B：PSReadLine 键处理器直接读取缓冲区，不需要 PTY |
| 读取命令行 | figterm 内的 alacritty 网格 | 影子 xterm 的单元格 | 方案 A 与左侧相同；方案 B 使用 `PSConsoleReadLine.GetBufferState`，结果精确 |
| 光标的屏幕坐标 | macOS 辅助功能 API 加输入法 | 只需要单元格坐标 | 使用悬浮窗时，需要 UIA/MSAA 或用字体度量把单元格换算成像素 |
| 显示 | 透明、置顶的 webview 窗口 | 终端内 ANSI | 终端内绘制更简单；置顶、不抢焦点的悬浮窗最接近 Fig 的体验 |
| 按键拦截 | figterm 的 `KeyInterceptor` | 原始模式 stdin | 方案 A 在包装层拦截；方案 B 使用 `Set-PSReadLineKeyHandler` |
| 插入 | figterm 往 PTY 写入删除和插入序列 | 写入 DEL×n 和文本 | 方案 A 同左；方案 B 调用 `PSConsoleReadLine.Replace`/`Insert` |
| Spec | CDN 远程加载 | 打包 npm 包 | 打包 `wf` spec；需要一个嵌入的 JS 运行时，以及不依赖 Git Bash、能识别 pwsh 和 cmd 的 generator 执行器 |

最重要的约束：`wf` 的 spec 本身是 JavaScript 程序，含 generator、postProcess、custom 等函数。无论 Windows 端用什么语言实现，都需要嵌入一个 JS 运行时（Node、Jint、ClearScript、QuickJS 等），或者只支持 spec 中的静态部分。这一点会影响 D-003 的技术选型。
