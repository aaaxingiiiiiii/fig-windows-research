# 结论索引

本页是所有结论（F-xxx）的唯一清单，其他文件引用这里的编号。证据编号 E-xxx 见 `evidence.md`，源码别名见 `sources.md`。

“类型”的含义见 `docs/workflow.md`：观察是直接看到的事实；推断由观察推导，尚未直接验证；未知表示已经尝试但还没有答案。

| 编号 | 结论 | 类型 | 依据 | 局限 / 待验证 |
| --- | --- | --- | --- | --- |
| F-001 | Fig 原产品已停止服务，由 Amazon Q Developer CLI 接替，后者在 2025 年 11 月更名为 Kiro CLI | 推断 | AWS 文档和博客、二手资料（`sources.md`） | 停服日期 2024-09-01 只见于二手资料 |
| F-002 | Fig 补全的完整源码（Rust 桌面端、figterm、shell 集成、React 前端）以 MIT 或 Apache-2.0 双许可开源；spec 库 `wf` 采用 MIT | 观察 | `aq:LICENSE.MIT`、`aq:LICENSE.APACHE`；GitHub API | 开源版本为 1.19.7，Kiro 闭源版本为 2.30.0 |
| F-003 | Kiro 2.30.0 的 `init zsh pre` 与开源 `pre.sh` 只在二进制名占位符上不同 | 观察 | E-003；`aq:crates/fig_integrations/src/shell/scripts/pre.sh` | 只比较了 zsh pre |
| F-004 | Kiro 2.30.0 前端使用与开源前端相同的设置键和 spec CDN | 观察 | E-002；`aq:packages/autocomplete-parser/src/loadHelpers.ts#L33` | 只做了字符串统计，没有比较逻辑 |
| F-005 | Kiro 2.30.0 的补全链路沿用开源代码，开源代码可作为行为基线 | 推断 | F-003、F-004 | 用 T-012 的运行时用例验证 |
| F-006 | Kiro 的 `init <shell> post` 只有在环境变量 `Q_TERM` 已设置时，才输出完整的集成脚本（含 OSC 697 钩子）；否则只输出设置 PATH 的几行。`Q_TERM` 由 PTY 包装程序（figterm，即 `kiro-cli-term`）设置。因此只有被 figterm 包装的 shell 才会安装提示符钩子。开源 1.19.7 没有这个判断（`aq:crates/q_cli/src/cli/init.rs#L121-L295`），总是输出完整脚本。有 `Q_TERM` 时，zsh 脚本与开源 `post.zsh` 只有三处不同：开头增加 `Q_SHELL` 赋值；`get-shell` 的错误输出被丢弃；别名改为经标准输入传给 `pre-cmd --alias-stdin`，不再放进命令行参数 | 观察（Kiro 2.31.0） | E-003、E-007 | T-013 已完成。原先“非交互环境”的推测不成立：在伪终端中运行同样只有 4 行；只设置 `QTERM_SESSION_ID` 也不改变输出 |
| F-007 | Kiro 2.30.0 的 `init` 只接受 bash、zsh、fish、nu，不支持 PowerShell 和 cmd | 观察 | E-003 | 只检查了命令行参数 |
| F-008 | 补全链路为：figterm 用 PTY 包装 shell → shell 输出 OSC 697 标记 → figterm 在影子终端中取出缓冲区 → 通过 protobuf 和 Unix socket 发给桌面端 → 推送给 webview 前端 | 观察 | `architecture.md` | 来自开源基线 |
| F-009 | 插入的方式是向 PTY 写入“光标移动 + 退格 × N + 文本 + 可选的回车”；前端用 `ESC[D` 实现 `{cursor}` 占位 | 观察 | `aq:crates/fig_proto/src/figterm.rs#L4-L30`、`aq:packages/autocomplete-app/src/state/insertion.ts#L25-L90` | 退格字节在 Windows 各 shell 上的效果未测 |
| F-010 | 光标位于词中间时不显示补全，光标之后的文本不参与解析 | 观察 | `aq:packages/autocomplete-app/src/state/index.ts#L486-L491` | C-006 |
| F-011 | 默认按键：Enter 插入（不执行），Tab 插入公共前缀，Shift+Tab、↑、Ctrl+P 上移，↓、Ctrl+N 下移，Esc 隐藏；只在窗口可见且有候选时拦截 | 观察 | `aq:packages/autocomplete-app/src/fig.json`、`aq:crates/figterm/src/interceptor.rs#L195-L226` | C-002 至 C-005、C-011、C-012 |
| F-012 | 第一个词（命令名）默认不补全，由 `autocomplete.firstTokenCompletion` 控制，默认值为 false | 观察 | `aq:packages/dashboard-app/src/data/autocomplete.ts#L131-L138` | C-013 |
| F-013 | 按 Esc 隐藏后，后续输入保持隐藏，直到状态重置 | 观察 | `aq:packages/autocomplete-app/src/state/index.ts#L324-L346` | 重置时机是推断；C-005 |
| F-014 | Fig 自己的 Windows 移植是未完成的原型：已有 ConPTY、控制台 I/O、UIA/MSAA 光标定位；缺少 Windows IPC、PowerShell 和 cmd 集成、安装程序 | 观察 | `prior-art.md` 第 1 节 | 无法在 Windows 编译这一点是推断 |
| F-015 | inshellisense 已在 Windows 上支持 pwsh、powershell 和 cmd（实验性），方式是 ConPTY 包装加终端内 ANSI 绘制，使用 `wf` spec 2.675.0；Windows 上的 generator 经 Git Bash 执行 | 观察 | `prior-art.md` 第 2 节 | 没有在 Windows 上实际运行（T-014 已取消，只作参考） |
| F-016 | `wf@aef52ac`（2.692.3）顶层 715 个 spec 文件中，有 201 个含 `postProcess` 或 `custom` 函数。因此 Windows 引擎需要嵌入 JS 运行时，否则只能支持静态部分 | 观察 | 用 `grep -lE 'postProcess\|custom:' src/*.ts` 统计 | 没有统计子目录中的 spec |
| F-017 | 开源前端有两处疑似缺陷：计算删除数时只把查询词中的第一个空白算作 `\ `；`selectSuggestionN` 只有第 1 个有效 | 观察（是否属于缺陷为推断） | `aq:packages/autocomplete-app/src/state/insertion.ts#L56`、`aq:packages/autocomplete-app/src/hooks/keypress.ts#L183-L189` | Windows 实现不照搬 |
| F-018 | Fig 补全前端与宿主之间只有一层很薄的桥：用 `window.ipc.postMessage` 发送 base64 编码的 protobuf，宿主用 DOM 事件 `FigProtoMessageReceived` 回传；spec 文件通过宿主的 `fread` 读取 | 观察 | `aq:packages/api-bindings/src/core.ts#L94-L116`、`aq:packages/autocomplete-parser/src/loadHelpers.ts#L62` | — |
| F-019 | 补全前端、解析器和设置封装实际调用的宿主接口约 15 种：编辑缓冲区订阅、按键通知与拦截设置、插入文本、设置读写、运行进程、读写文件、窗口定位、历史查询、状态和事件订阅、遥测 | 观察 | 在 `aq:packages/autocomplete-app/src`、`autocomplete-parser/src`、`api-bindings-wrappers/src` 中统计 `Shell.`、`Settings.`、`Process.` 等调用 | 统计方法是 grep，可能漏掉间接调用 |
| F-020 | 因此可以把 Fig 的 React 前端（含引擎和 UI）放进 Windows 的 WebView2 中运行：写一层把 `window.ipc.postMessage` 转到 `chrome.webview.postMessage` 的转接代码，宿主实现上述约 15 种接口即可；WebView2 自带的 JS 引擎同时解决了 spec 需要 JS 运行时的问题（F-016） | 推断 | F-018、F-019 | 需要在 Windows 上验证（T-022） |
| F-021 | PSReadLine 公开了读写缓冲区和光标、按词元替换、调用按键原有功能的接口，但**没有“缓冲区已变化”事件**；预测插件在渲染时调用，有多种跳过的情况，并且拿不到真实光标位置 | 观察 | `psreadline.md` 第 1、2 节 | 运行时表现待 T-020 验证 |
| F-022 | 在 Windows Terminal 中粘贴时，文本作为输入逐字符送入；PSReadLine 不支持括号粘贴模式。推断：输入法提交的中文不经过按键处理器 | 观察（输入法部分为推断） | `psreadline.md` 第 4 节 | T-020 |
| F-023 | WT 的 TermControl 通过 UIA TextPattern 提供光标所在字符的矩形（空区间先扩展到一个字符）；`GetGUIThreadInfo` 和 MSAA 在 WT 中拿不到光标，在 conhost 中可用 | 观察（读源码和文档，未运行） | `caret-wt.md` 第 1、2 节 | T-019 |
| F-024 | WT 的 UIA 矩形计算中，padding 可能没有乘 DPI 缩放比例，在 150% 和 200% 缩放下可能分别偏约 4 px 和 8 px | 推断 | `caret-wt.md` 第 1 节 | T-019 |
| F-025 | Fig 的文件补全（`@fig/autocomplete-generators` 2.4.0 的 `filepaths`）通过执行 `ls -1ApL` 列出文件，并假定路径分隔符是 `/`、绝对路径以 `/` 开头 | 观察 | npm 包 `lib/src/filepaths.js` 第 112–129 行 | 在 Windows 上需要宿主模拟 `ls`，并修改路径处理 |
| F-026 | Fig 前端依赖的 npm 包 `@fig/autocomplete-helpers`、`@fig/autocomplete-generators`、`@fig/autocomplete-shared`、`@withfig/autocomplete-types` 都采用 MIT 许可 | 观察 | npm 元数据；helpers 包的 metadata 中没有 license 字段，但包内附有 LICENSE 文件 | — |
| F-027 | Fig 前端的三个衔接点：按键通过 `Keybindings.pressed` 以动作名送入；插入通过 `Shell.insert` 发出“退格 × n + 文本 + ESC[D × k”格式的串；窗口尺寸通过 `WindowPosition.setFrame` 请求。spec 地址是 `loadHelpers.ts` 中的一个常量 | 观察 | `aq:packages/autocomplete-app/src/fig/hooks.ts#L92-L95`、`aq:packages/api-bindings/src/position.ts#L21-L33`、`aq:packages/autocomplete-parser/src/loadHelpers.ts#L32-L33` | 这是 `docs/protocol.md` 的设计依据 |
| F-028 | inshellisense 0.0.4 的源码在 macOS arm64、Node 20 上可以构建；自带 213 个测试中 202 个通过，10 个跳过，1 个因本机 Homebrew 环境失败。`complete` 子命令可以不进入交互界面直接输出补全结果（JSON）；对 `git ch` 返回 `checkout` 和 `cherry-pick`，与 C-001 的源码预期一致 | 观察 | T-036；`docs/dev.md` 第 2 节 | 尚未在 Windows 上构建 |
| F-029 | inshellisense 0.0.4 只在名称含空格时才给路径加引号（`needsQuoted` 只检查空格）；PowerShell 下的单引号转义写成 `\'`，而 PowerShell 的正确写法是 `''`。因此 pwsh 下 `it's`、`a$b`、`a&b`、`` a`b `` 的插入结果都不正确 | 观察 | `src/inshellisense/src/runtime/utils.ts` 第 45–88 行；`figspec.test.ts` 中的 W-002 至 W-004、W-008、W-009 | T-039 已修复（`src/inshellisense/CHANGES.md`）；在 Windows 终端中的实际效果待 T-035 第 16 项确认 |
| F-030 | inshellisense 按显示宽度（`wcswidth`）计算要删除的字符数，而 bash 和 zsh 按字符删除。所以补全中文名称时会多删字符：输入 `echo X中`，接受补全“中文目录”后，结果是 `中文目录`，前面的 X 也被删掉了 | 观察（bash、zsh 实测；PowerShell 为推断） | `src/inshellisense/src/runtime/parser.ts` 第 90–117 行、`replacement.ts`；用 node-pty 驱动 macOS 自带的 bash 和 zsh 实测 | T-039 已改为按字符删除；PSReadLine 也按字符删除这一点仍是推断，待 T-035 第 15 项验证 |
| F-031 | inshellisense 与 Fig 有 7 处做法不同：Tab 行为、Enter 行为、Esc 后的显示、光标在行中时是否显示、路径的引号风格、`--opt=` 的插入、↑ 在第一项时的行为，以及是否补全命令名 | 观察 | `specs/completion.md` 第 9 节 | 是否改成 Fig 风格由用户决定 |
| F-032 | custom generator 执行命令时，inshellisense 与 Fig 有两处不同：① 没有给出 cwd 时，Fig 使用终端的当前目录，inshellisense 使用自身进程的目录；② Fig 会清理输出（CRLF 换成 LF，去掉首尾的空行），inshellisense 只对 script generator 的输出做 `trim()`，custom generator 拿到的是原始输出。因此 npm 的 workspaces 候选把 `npm prefix` 的输出（带换行）直接拼进路径，读取失败 | 观察（源码） | Fig：`aq:crates/figterm/src/message.rs#L61-L93`、`aq:crates/figterm/src/message.rs#L459-L464`、`aq:packages/api-bindings-wrappers/src/executeCommand.ts#L11-L17`；inshellisense：`is:src/runtime/generator.ts#L33`、`is:src/runtime/generator.ts#L42` | T-051 已修复：没有给出目录时使用 generator 的目录（与 script generator 相同，输入路径时是解析后的目录），输出按 Fig 的规则清理 |
| F-033 | Kiro 2.31.1 的运行时行为与开源基线大体一致。13 条规格用例中，9 条一致：Tab 插入公共前缀；Enter 插入选中项、不执行；Esc 后保持隐藏；`ls \| git ch` 只解析最后一段；`--chmod=` 插入后光标停在 `=` 后；没有 spec 的命令不显示；在第一项按 ↑ 关闭窗口；默认不补全命令名。**不一致**的是 C-006：光标在单词中间时 Kiro 仍然显示窗口。C-003、C-008、C-012 需要重测 | 观察 | E-010；`specs/completion.md` 第 8 节 | 支持 F-005（开源代码可以作为行为基线），但 C-006 的规则需要回到源码核对；`docs/usage.md` 第 3 节的“Fig 的做法”一栏已按实测修正 |

## 注意

- 静态调用关系不能单独证明运行时行为；搜不到某个字符串，也不能证明某个功能不存在。
- 从开源基线得出的结论，在 T-012 验证之前不能写成“Kiro 的行为是……”。
