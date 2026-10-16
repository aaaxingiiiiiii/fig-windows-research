# 使用说明（终端内版本）

这是阶段 A 的试用版：补全候选显示在终端里、光标下方。Fig 那样的悬浮窗是阶段 B 的内容，目前还没有。

> **状态（2026-10-16）：** 安装包已经写好（T-059），在 GitHub 提供的 Windows 虚拟机中自动构建，并在虚拟机里实际安装、升级、卸载一遍（T-061）。还没有在用户自己的电脑上实测（按 D-014 放到功能完成之后）。

## 1. 安装

### 用安装包（推荐）

需要先装好 PowerShell 7（`winget install --id Microsoft.PowerShell --source winget`）。

1. 下载安装包 `figwin-setup-<版本>.exe`。目前从 GitHub Actions 的运行结果中下载（需要登录 GitHub）：
   1. 打开仓库的 Actions 页面，选左侧的 **Windows**；
   2. 点最近一次成功的运行；
   3. 在页面底部的 Artifacts 中下载 **figwin-setup**（zip 文件，解压后就是安装包）。

   附件保留 14 天。正式的发布方式以后再定。
2. 先关闭所有 PowerShell 标签，再双击运行安装包。
   - Windows 可能提示“Windows 已保护你的电脑”，这是因为安装包没有数字签名。点“更多信息”，再点“仍要运行”。
   - 不需要管理员权限，只影响当前用户。
3. 安装界面有两个选项，默认都勾选：
   - **打开 PowerShell 7 时自动启用补全**：在 PowerShell 的配置文件 `$PROFILE` 末尾加两行。不勾选时，需要补全时手动运行 `is`。
   - **创建默认的补全配置文件**：在用户目录中创建 `.inshellisenserc`，已有时不覆盖。
4. 装好后，新开一个 PowerShell 7 标签即可使用。

安装包会修改的内容，以及卸载时如何恢复：

| 修改的内容 | 安装时 | 卸载时 |
| --- | --- | --- |
| 程序 | 放在 `%LOCALAPPDATA%\Programs\figwin` | 删除 |
| 用户的 PATH | 把上面的目录加到最前面 | 安装后没有再改过时，恢复为安装前的原值；改过时只删除这一项 |
| PowerShell 配置文件 `$PROFILE` | 先备份，再在末尾加两行 | 安装后没有再改过时，逐字节恢复；改过时只删除这两行，并提示 |
| 补全配置 `%USERPROFILE%\.inshellisenserc` | 不存在时创建 | 没有改过时删除，改过的保留 |
| 补全资源 `%USERPROFILE%\.inshellisense` | 重新生成（会删除其中的日志） | 安装前不存在时删除 |

- **卸载**：设置 → 应用 → 已安装的应用 → figwin 终端补全 → 卸载。卸载前请关闭所有 PowerShell 标签；有标签还在使用补全时，卸载程序会提示先关闭。
- **升级**：关闭所有 PowerShell 标签，直接运行新版本的安装包。原来的选项保持不变；要改变选项，先卸载再安装。
- **安装记录**：`%LOCALAPPDATA%\Programs\figwin\install.log`。

### 从源码运行（开发用）

需要 Node.js 18–22，以及 git。从源码构建的步骤见 [docs/dev.md](dev.md)。构建完成后，在 `src/inshellisense/` 目录下执行：

```powershell
node build/index.js -s pwsh
```

这会在当前窗口中启动一个带补全功能的 PowerShell。输入 `exit` 即可退出，回到原来的 shell。

## 2. 按键

候选列表出现时，下面这些按键由补全功能处理；列表没有出现时，所有按键照常交给 shell。

| 按键 | 作用 |
| --- | --- |
| Tab | 接受当前选中的候选 |
| ↓ / ↑ | 选择下一个或上一个候选 |
| Esc | 隐藏候选列表 |
| Enter | **不会**接受候选，而是直接执行当前命令 |

按键、每页显示的候选数（默认 5）、选中项的颜色、边框样式，都可以在配置文件 `%USERPROFILE%\.inshellisenserc`（TOML 格式）中修改。安装包创建的默认配置中，每项设置都有中文说明，内容见 [installer/inshellisenserc.toml](../installer/inshellisenserc.toml)。打开方法：开始菜单 → figwin 终端补全 → 编辑补全配置。改完保存，新开一个标签就生效。配置写错时，新开的标签会显示出错的行号，并且不启用补全，但 PowerShell 照常可用（T-062）。

## 3. 和 Fig 的不同之处（请在试用时留意）

这个版本基于 [microsoft/inshellisense](https://github.com/microsoft/inshellisense)。有几处操作习惯和 Fig 不一样。“Fig 的做法”一栏已经用 Fig 的后继产品 Kiro CLI 2.31 实测核对过（T-012）。**目前保留 inshellisense 的做法**，试用之后再决定是否改成 Fig 的方式（D-010）。

| 场景 | Fig 的做法 | 这个版本的做法 |
| --- | --- | --- |
| 按 Tab | 只补全所有候选共有的开头部分 | 直接插入选中的候选 |
| 按 Enter | 插入选中的候选，不执行命令 | 直接执行命令，不插入候选；接受候选请用 Tab |
| 按 Esc 隐藏后再继续输入 | 列表保持隐藏 | 列表重新出现 |
| 光标停在一行的中间 | 仍然显示候选，光标在单词中间也显示（Kiro 2.31 实测） | 光标后面还有任何文字，就不显示候选 |
| 在第一个候选上按 ↑ | 关闭列表 | 停在第一个候选上，列表不关闭 |
| 补全 `--chmod=` 这类必须带 `=` 的选项 | 插入 `--chmod=`，光标停在 `=` 后面 | 插入 `--chmod` 加一个空格；需要手动删掉空格，再输入 `=` |
| 刚开始输入命令名，例如 `gi` | 默认不显示候选 | 显示 `git` 等命令名 |

试用时如果觉得哪一处不顺手，记下编号或场景，写进 T-041 的试用记录。技术细节见 `specs/completion.md` 第 9 节。

## 4. 路径中的特殊字符

在 PowerShell 中，名称含空格或特殊字符（例如 `$`、`&`、`'`、反引号）的文件夹，补全后会自动加上单引号；名称中的单引号会写成两个单引号，例如 `'it''s/'`。这是 PowerShell 的标准写法，可以直接执行。

## 5. 已知限制

- 补全规则来自 Fig 的 spec 库，其中一部分动态候选要执行 Linux 风格的命令行工具（`ls`、`cat`、`grep`、`sed` 等）。最常见的用法已经改由 Node 模拟，不需要 Git for Windows，包括文件补全，git、npm、yarn、pnpm、npx、cargo、make 的动态候选（T-049）。其余用法在没有安装 Git for Windows 时没有动态候选，但不会报错，静态的子命令和选项照常显示。
- 只支持 Windows Terminal 中的 PowerShell 7；Windows PowerShell 5.1、cmd 和其他终端没有测试。
- 全屏程序（vim、less 等）运行期间不显示候选。
- 在 Windows 10 上，拖动窗口大小后候选和输入可能错开几行（T-056），运行 `Clear-Host` 可以恢复。Windows 11 上已经修复：改用系统自带的 ConPTY。需要手动切换时，在启动补全之前设置环境变量 `FIGWIN_CONPTY`，取值 `system` 或 `bundled`（node-pty 附带的版本）。

## 6. 遇到问题时

1. 带上 `-V` 参数重新启动，记录日志：
   - 用安装包安装的：按 Win+R，输入 `pwsh -NoProfile -NoExit -Command is -s pwsh -V`，回车。已经启用补全的标签中不能直接运行 `is`，它会提示已经在补全会话中。
   - 从源码运行的：运行 `node build/index.js -s pwsh -V`。
2. 复现问题后，查看日志 `%USERPROFILE%\.inshellisense\log\inshellisense.log`。日志会记录每条补全命令是怎么执行的：直接执行（`ran natively`）、由 Node 模拟（`emulated in node`），还是经 Git Bash 执行（`git bash`）。
3. 把操作步骤和日志中相关的几行记入任务记录。日志中可能包含路径和命令，贴到公开的地方之前，先删掉个人信息。
