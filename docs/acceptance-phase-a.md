# 第一次验收：终端内补全的安装包（阶段 A）

读者：在自己的 Windows 电脑上验收的用户。约 30 分钟。每一项只需要回答“是”或“否”；回答“否”时截一张图。可以自己按本页做，也可以让 Windows 端的 AI 一项一项带着做（它会替你看日志）。

这次验收的是：安装包、自动启用补全、中文和特殊字符路径、PowerShell 自带命令的补全、配置文件、升级和卸载。悬浮窗（阶段 B）还没有做完，下一次再验收。

## 准备（5 分钟）

1. 下载安装包：打开 GitHub 上本仓库的 **Actions** 页面 → 左侧选 **Windows** → 点最近一次成功的运行（绿色的勾）→ 页面底部 **Artifacts** 中的 **figwin-setup**。下载的是 zip 文件，解压后得到 `figwin-setup-<版本>.exe`。
2. 记下 PowerShell 配置文件现在的状态，卸载后用来对比。在 PowerShell 7 中运行：

   ```powershell
   if (Test-Path $PROFILE) { (Get-FileHash $PROFILE).Hash } else { '没有配置文件' }
   ```

   把输出复制下来。
3. 准备测试用的文件夹。在 PowerShell 7 中运行下面这一行，它只在临时目录中新建几个文件夹：

   ```powershell
   $t = "$env:TEMP\figwin-test"; New-Item -ItemType Directory -Force -Path "$t\中文目录", "$t\it's", "$t\a`$b", "$t\My Docs" | Out-Null
   ```

4. 关闭所有 PowerShell 标签和窗口。

## 安装（5 分钟）

| 编号 | 操作 | 期望 |
| --- | --- | --- |
| 1 | 双击 `figwin-setup-<版本>.exe`。如果 Windows 提示“已保护你的电脑”，点“更多信息”，再点“仍要运行”。两个选项都保持勾选，一路“下一步” | 顺利装完，没有要求管理员权限 |
| 2 | 在 Windows Terminal 中新开一个标签 | 标签上写着 PowerShell（不是 Windows PowerShell）；运行 `$PSVersionTable.PSVersion`，显示 7.x |

## 补全（10 分钟）

在第 2 项打开的标签中进行。

| 编号 | 操作 | 期望 |
| --- | --- | --- |
| 3 | 进入任意一个 git 仓库，输入 `git ch` | 光标下方出现候选，有 `checkout`、`cherry-pick`；按 ↓ 选择，按 Tab 插入 |
| 4 | 输入 `git checkout `（末尾有空格） | 候选中列出这个仓库的分支 |
| 5 | 输入 `Get-ChildItem -Pa` | 候选中有 `-Path`（PowerShell 自带的命令） |
| 6 | 运行 `cd $env:TEMP\figwin-test`，然后输入 `cd 中`，按 Tab，再按 Enter | 命令行补全为这个文件夹（例如 `cd .\中文目录`），并且进入了它 |
| 7 | 回到上一级（`cd ..`），分别输入 `cd it`、`cd a`、`cd My`，各自按 Tab、Enter | 三次都能进入对应的文件夹（`it's`、`a$b`、`My Docs`）；需要引号的名称会自动加上引号 |
| 8 | 按 Esc | 候选列表消失，输入的内容不变 |

## 配置（5 分钟）

| 编号 | 操作 | 期望 |
| --- | --- | --- |
| 9 | 开始菜单 → figwin 终端补全 → 编辑补全配置 | 记事本打开配置文件，每项设置都有中文说明 |
| 10 | 把 `# maxSuggestions = 5` 改成 `maxSuggestions = 8`（去掉行首的 `# `），保存；新开一个标签，输入 `git ` | 候选列表一次显示 8 项 |
| 11 | 把这一行改成 `maxSuggestions = `（故意写错），保存；新开一个标签 | 标签中显示配置出错的提示，但 PowerShell 照常可用（能运行 `dir`）。改回 `# maxSuggestions = 5` 并保存 |

## 升级和卸载（5 分钟）

| 编号 | 操作 | 期望 |
| --- | --- | --- |
| 12 | 关闭所有 PowerShell 标签，再运行一次安装包 | 顺利完成，提示“已经安装过”；新开的标签照常有补全 |
| 13 | 不关闭这个标签，打开 设置 → 应用 → 已安装的应用 → figwin 终端补全 → 卸载 | 提示有终端正在使用补全，请先关闭。关闭标签后再卸载，顺利完成 |
| 14 | 新开一个标签，再运行准备第 2 步的那行命令 | 没有补全；输出与准备时记下的完全相同 |

最后可以删除测试文件夹：`Remove-Item -Recurse -Force "$env:TEMP\figwin-test"`。

## 已知问题（不用报告）

- 拖动窗口大小后，候选和输入可能错开几行（T-056）。运行 `Clear-Host` 可以恢复。
- PowerShell 自带命令的补全是最小版本：看不到你在 `$PROFILE` 中定义的函数和别名。
- 与 Fig 的几处做法差异，见 `docs/usage.md` 第 3 节。

## 结果怎样记录

把每一项的“是 / 否”发给 Windows 端的 AI 或整合者即可，“否”附上截图。由 AI 写入 `research/spike-fork-windows.md`，在任务板中更新 T-040、T-048、T-057。14 项都是“是”，就算通过第一次验收；之后正常使用一两天（T-041），遇到问题随时记下来。
