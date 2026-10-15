# 相对上游的改动记录

上游信息见同目录的 `UPSTREAM`。每次修改本目录下的文件，都在下表追加一行，以便日后与上游对照、同步，或把通用修复提交回上游。不要重新格式化整份文件。

| 日期 | 任务 | 文件 | 改动 | 原因 | 可提交上游 |
| --- | --- | --- | --- | --- | --- |
| 2026-10-14 | T-036 | `UPSTREAM`、`CHANGES.md` | 新增 | 记录上游来源与改动 | 否 |
| 2026-10-14 | T-036 | `.github/workflows/ci.yml` | 换行符由 CRLF 变为 LF（本仓库的 `.gitattributes` 设置了 `text=auto`，提交时自动转换） | 仓库统一换行符；内容不变 | 否 |
| 2026-10-14 | T-038 | `src/tests/figspec/figspec.test.ts` | 新增 | 规格用例（C-xxx、W-xxx）的自动化测试；不修改上游代码 | 部分可以（缺陷用例可以随修复一起提交） |
| 2026-10-14 | T-039 | `src/runtime/replacement.ts` | 删除的字符数按字符计算（由显示宽度换算），不再按显示宽度 | shell 每次退格删除一个字符，按宽度删会多删前面的字符（fig-windows-research F-030，bash、zsh 实测） | 是 |
| 2026-10-14 | T-039 | `src/runtime/utils.ts` | PowerShell 下，路径含空格或特殊字符（`'"` 反引号 `$&|;,(){}<>`，以及开头的 `@#`）时加单引号；单引号写成 `''` | 原来只在含空格时加引号，并且把单引号转义成 `\'`，不符合 PowerShell 的规则（F-029） | 是 |
| 2026-10-14 | T-039 | `src/tests/runtime/replacement.test.ts` | 测试“wide-char divergent uses display width for backspace”改名为“…uses character count…”，期望删除数由 2 改为 1 | 随上一行的修复调整，依据见 F-030 | 是 |
| 2026-10-14 | T-039 | `src/tests/figspec/figspec.test.ts` | W-002 至 W-005、W-008、W-009 由 `test.failing` 改为 `test`；文件开头关闭 `header/header` 规则；用 prettier 格式化 | 修复后转为回归测试；本文件的版权声明与上游不同 | 否 |
| 2026-10-14 | T-037 | `package.json`、`package-lock.json` | 新增依赖 `cross-spawn@^7.0.6`，开发依赖 `@types/cross-spawn@^6.0.6` | Windows 上不经过 shell 直接执行 generator 命令，需要正确处理 PATHEXT 和 `.cmd`/`.bat` | 是 |
| 2026-10-14 | T-037 | `src/runtime/utils.ts` | `buildExecuteShellCommand`：Windows 上先用 cross-spawn 直接执行；命令找不到（ENOENT）时才退回 Git Bash；没有 Git Bash 时返回空结果。macOS 和 Linux 上的行为不变。`-V` 日志会记录每条命令走的是哪条路径 | 去掉对 Git Bash 的硬依赖（D-007，阶段 A） | 是 |
| 2026-10-14 | T-037 | `src/tests/figspec/executeCommand.test.ts` | 新增 | 检查执行和回退的控制流（模拟 win32） | 否 |
| 2026-10-14 | T-037 | `src/runtime/utils.ts`、`src/tests/figspec/executeCommand.test.ts` | Windows 上 `bash`、`sh` 总是经 Git Bash 执行，不按本机路径解析；没有 Git Bash 时返回状态码 127 | 本机路径解析可能找到 System32 中的 WSL 启动器，使命令在 WSL 中运行（风险由 T-015 的报告指出：git 的部分 generator 会执行 `bash -c … \| sed`） | 是 |
| 2026-10-14 | T-049 | `src/runtime/posixEmulation.ts` | 新增。Windows 上用 Node 模拟 spec 中常用的 POSIX 命令：`ls [-1ApL]`、`cat 文件`、`grep [-iEvq] 模式 文件`，以及 9 条固定的 `bash -c` 脚本（git 的 sed 过滤、向上查找 package.json/rush.json/turbo.json、node_modules/.bin、`npm root -g`、cargo、make）。管道中的原生命令照常执行；其他用法返回 undefined，按原路径执行 | 去掉 filepaths helper 和常用 CLI 动态候选对 Git Bash 的依赖（T-015 报告的建议 2、3） | 否（先在 Windows 上验证；模拟的脚本与 spec 包版本绑定） |
| 2026-10-14 | T-049 | `src/runtime/utils.ts` | `buildExecuteShellCommand`：Windows 上先尝试模拟，能模拟时不再启动进程；`-V` 日志记录 `generator command emulated in node`。函数改为先定义 `execute` 再返回，以便模拟层递归执行管道中的原生命令 | 同上 | 否 |
| 2026-10-14 | T-049 | `src/runtime/generator.ts` | generator 上下文的环境变量经 `withPosixHome` 处理：Windows 上没有 HOME 时补上用户目录（只影响 spec 读取的上下文，不影响子进程） | ssh、scp 用 `${HOME}/.ssh/known_hosts` 和 `~/.ssh/config` 列出主机 | 是（与 Windows 有关的小改动） |
| 2026-10-14 | T-049 | `src/tests/figspec/posixEmulation.test.ts` | 新增 31 个测试，包括 9 条脚本在 spec 包中的出处检查，以及模拟 win32 时经真实 spec（node、git diff、npm run）得到候选 | 防止 spec 包升级后模拟悄悄失效 | 否 |
| 2026-10-15 | T-051 | `src/runtime/generator.ts` | 传给 custom generator 的 executeShellCommand 经 `buildCustomExecuteCommand` 包装：没有给出 cwd 时使用 generator 的目录；stdout、stderr 按 Fig 的 cleanOutput 清理（CRLF 换成 LF，去掉 `ESC[?25h` 和首尾的空行） | 原来在 inshellisense 进程的目录中执行，并把带换行的原始输出交给 spec，例如 npm 的 workspaces 候选会读错 package.json（F-032） | 是（与平台无关） |
| 2026-10-15 | T-051 | `src/tests/figspec/customGenerator.test.ts` | 新增 4 个测试：默认目录、显式目录、输出清理、npm workspaces 候选 | 防止回归 | 否 |
| 2026-10-15 | T-052 | `src/tests/figspec/{figspec,posixEmulation,executeCommand}.test.ts` | 路径期望使用本机分隔符并保留完整引号断言；Windows 链接夹具使用 junction；显式模拟 darwin/linux 的 HOME 行为；mock Git Bash 探测以隔离安装状态，并断言原生命令不走回退 | 修复 Windows 本机 11 个测试环境假设失败，保留覆盖 | 否 |
| 2026-10-15 | T-043 | `src/overlay/`（`json.ts`、`protocol.ts`、`snapshot.ts`、`client.ts`、`overlayRenderer.ts`） | 新增。悬浮窗协议 v1 的客户端和悬浮窗渲染器（renderer 角色）；设置 `FIGWIN_OVERLAY_PIPE` 时启用，否则不影响原有行为 | 阶段 B（D-007、`docs/protocol.md`） | 否 |
| 2026-10-15 | T-043 | `src/ui/suggestionManager.ts` | 分页计算提取为 `getPage()`（`render()` 的结果不变）；新增 `getDisplayState()` 和候选列表版本号（`#setSuggestBlob`）；`update()` 新增参数 `allowAccept`，为 false 时吞掉接受键而不插入 | 悬浮窗渲染器需要结构化的当前页；宿主确认之前不能接受新的选中项（协议第 6 节） | 否 |
| 2026-10-15 | T-043 | `src/ui/suggestionRenderer.ts` | 新增 `setSuggestionsEnabled()`：关闭时清掉已画的候选，只透传 PTY 输出；打开时按当前状态重画。新增 `canAcceptSuggestion`（等于 `hasVisibleSuggestions`） | 悬浮窗接管显示和回退 | 否 |
| 2026-10-15 | T-043 | `src/ui/ui-root.ts` | 改用 `createRenderer()` 选择渲染器；按键先交给 `noteKeypress()`，`update()` 传入 `canAcceptSuggestion`；退出时调用 `dispose()` | 同上 | 否 |
| 2026-10-15 | T-043 | `src/tests/overlay/`（4 个文件） | 新增 81 个测试 | 协议第 10 节中客户端一侧的验收用例 | 否 |
| 2026-10-15 | T-054 | `src/overlay/{client,protocol,snapshot,overlayRenderer}.ts`、`src/tests/overlay/` | 审查协议后新增 14 个先失败再修复的回归用例：严格 welcome/state/类型映射、600 ms 租期、背压旧确认、大页选中项、选择绕回旧项、异步备用缓冲清理、过期命令/目录及重复接受；扩展真实 manager/client 集成测试 | 修复协议第 2、4–7 节的偏差；协议字段和版本不变 | 否 |
| 2026-10-15 | T-054 | `src/ui/suggestionManager.ts`、`src/ui/ui-root.ts` | 候选绑定生成时的命令和 cwd；变化后拒绝旧候选显示/接受，异步结果提交时复核；接受后立即撤销快照；按键处理后立即同步渲染，cwd 单独变化也触发重新生成 | 防止宿主确认旧内容后插入过期候选，以及 PTY 回显前重复插入；终端回退同样检查上下文 | 部分可以（候选生命周期修复） |
