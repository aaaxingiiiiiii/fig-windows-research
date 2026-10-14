# 使用说明（终端内版本）

这是阶段 A 的试用版：补全候选显示在终端里、光标下方。Fig 那样的悬浮窗是阶段 B 的内容，目前还没有。

> **状态（2026-10-14）：** 还没有在 Windows 上完成实测（T-035、T-048），安装包要等 T-040 完成，所以目前只能从源码运行。下面带“Windows”字样的说明都还没有经过验证。

## 1. 启动

需要 Node.js 18–22，以及 git。从源码构建的步骤见 [docs/dev.md](dev.md)。构建完成后，在 `src/inshellisense/` 目录下执行：

```powershell
node build/index.js -s pwsh
```

这会在当前窗口中启动一个带补全功能的 PowerShell。输入 `exit` 即可退出，回到原来的 shell。

安装包和自动启动由 T-040 提供，完成后会更新本节。

## 2. 按键

候选列表出现时，下面这些按键由补全功能处理；列表没有出现时，所有按键照常交给 shell。

| 按键 | 作用 |
| --- | --- |
| Tab | 接受当前选中的候选 |
| ↓ / ↑ | 选择下一个或上一个候选 |
| Esc | 隐藏候选列表 |
| Enter | **不会**接受候选，而是直接执行当前命令 |

按键可以在配置文件 `~/.inshellisenserc`（TOML 格式）中修改，写法见上游 README 的 [Keybindings](https://github.com/microsoft/inshellisense#keybindings) 一节。每页显示的候选数也可以在这个文件中修改（`maxSuggestions`，默认 5）。

## 3. 和 Fig 的不同之处（请在试用时留意）

这个版本基于 [microsoft/inshellisense](https://github.com/microsoft/inshellisense)。有几处操作习惯和 Fig 不一样。**目前保留 inshellisense 的做法**，试用之后再决定是否改成 Fig 的方式（D-010）。

| 场景 | Fig 的做法 | 这个版本的做法 |
| --- | --- | --- |
| 按 Tab | 只补全所有候选共有的开头部分 | 直接插入选中的候选 |
| 按 Enter | 插入选中的候选，不执行命令 | 直接执行命令，不插入候选；接受候选请用 Tab |
| 按 Esc 隐藏后再继续输入 | 列表保持隐藏 | 列表重新出现 |
| 光标停在一行的中间 | 只要光标不在单词中间，就会显示候选 | 光标后面还有任何文字，就不显示候选 |
| 在第一个候选上按 ↑ | 关闭列表 | 停在第一个候选上，列表不关闭 |
| 补全 `--chmod=` 这类必须带 `=` 的选项 | 插入 `--chmod=`，光标停在 `=` 后面 | 插入 `--chmod` 加一个空格；需要手动删掉空格，再输入 `=` |
| 刚开始输入命令名，例如 `gi` | 默认不显示候选 | 显示 `git` 等命令名 |

试用时如果觉得哪一处不顺手，记下编号或场景，写进 T-041 的试用记录。技术细节见 `specs/completion.md` 第 9 节。

## 4. 路径中的特殊字符

在 PowerShell 中，名称含空格或特殊字符（例如 `$`、`&`、`'`、反引号）的文件夹，补全后会自动加上单引号；名称中的单引号会写成两个单引号，例如 `'it''s/'`。这是 PowerShell 的标准写法，可以直接执行。

## 5. 已知限制

- 少数命令的动态候选（例如某些 git、docker 子命令的候选）需要执行 Linux 风格的命令行工具。没有安装 Git for Windows 时，这些候选可能是空的，但不会报错。T-049 正在把它们改写成不依赖这些工具的方式。
- 只支持 Windows Terminal 中的 PowerShell 7；Windows PowerShell 5.1、cmd 和其他终端没有测试。
- 全屏程序（vim、less 等）运行期间不显示候选。

## 6. 遇到问题时

1. 加上 `-V` 参数重新启动：`node build/index.js -s pwsh -V`。
2. 复现问题后，查看日志 `inshellisense.log`。它在用户目录下的 `.inshellisense\log\` 中；如果那里没有，就在 `.local\share\inshellisense\log\` 中。
3. 把操作步骤和日志中相关的几行记入任务记录。日志中可能包含路径和命令，贴到公开的地方之前，先删掉个人信息。
