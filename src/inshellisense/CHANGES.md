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
