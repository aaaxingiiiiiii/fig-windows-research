figwin 终端补全：使用说明
==========================

这是什么
--------
在 Windows Terminal 的 PowerShell 7 中输入命令时，在光标旁边列出可以接着输入的子命令、参数和文件名，
用法类似 Fig。它基于微软开源的 inshellisense（MIT 许可），加上了针对 Windows 和 PowerShell 的修改。

怎么用
------
新开一个 PowerShell 7 标签，输入命令（例如 git ch），候选会自动出现：

    ↑ ↓   选择
    Tab   接受选中的候选
    Esc   关闭候选列表

其他按键照常输入，PowerShell 本身的用法不变。

配置
----
配置文件是用户目录下的 .inshellisenserc。打开方法：开始菜单 → figwin 终端补全 → 编辑补全配置。
文件中每项设置都有中文说明。改完保存，新开一个标签就生效。
如果写错了格式，新开的标签会显示出错的行号，并且不启用补全，但 PowerShell 照常可用。改正后再开一个标签即可。

卸载
----
设置 → 应用 → 已安装的应用 → figwin 终端补全 → 卸载。
卸载前请关闭所有 PowerShell 标签。卸载会把 PowerShell 配置文件恢复成安装前的样子；
安装时创建的补全配置，如果你没有改过，也会一并删除。

升级
----
直接运行新版本的安装程序。运行前请关闭所有 PowerShell 标签。原来的选项保持不变。

遇到问题
--------
* 新开的标签里没有补全：确认打开的是 PowerShell 7（标签上写着 PowerShell），不是 Windows PowerShell。
* 安装和配置的记录：%LOCALAPPDATA%\Programs\figwin\install.log
* 补全的详细日志：按 Win+R，输入 pwsh -NoProfile -NoExit -Command is -s pwsh -V，回车，
  在打开的窗口中复现问题。日志写到 %USERPROFILE%\.inshellisense\log\inshellisense.log
* 与 Fig 的差异和已知问题：
  https://github.com/xingdouiii-maker/fig-windows-research/blob/develop/docs/usage.md
