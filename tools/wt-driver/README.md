# T-029 Windows Terminal 冒烟驱动

.NET 10，Windows 桌面会话。此工具是项目测试程序；会新建一个独立的 Windows Terminal 窗口，使用指定的 PowerShell 7（不加载用户 profile），输入 `echo hi`，通过 UIA 的 TextPattern 验证真正输出了独立的一行 hi，保存该测试窗口截图和终端控件边界，最后只关闭自己的唯一标题窗口。测试窗口需要前台且桌面不能锁屏。

```powershell
$dotnet = '.\local\tools\dotnet\dotnet.exe'
& $dotnet build tools/wt-driver/WtDriver.csproj
& $dotnet run --project tools/wt-driver --no-build -- smoke <正式pwsh.exe绝对路径> local/evidence/T-029 3
```

每次运行有独立随机目录，包含 ready.json（shell pid/版本）、screen.txt、terminal.png、result.json。连续三次都完成并且 observed=hi 才能认定 smoke 通过。原始文件含本机路径，全部只放 local/。

窗口标题和 HWND 均核对；SendInput 前检查目标仍是前台，焦点变化立即中止，不继续把字符发送给其他应用。不读现有终端的内容，不更改 WT 设置或用户 profile。截图采用屏幕裁剪，因此仅在自己的窗口位于前台时采集，不能用于遮挡场景。

当前只提供固定 smoke，不接收任意输入脚本。宿主 debugState 的联调留给 T-044；本工具不证明输入法、缩放或真实补全已经通过。

依据：[Windows Terminal 命令行](https://learn.microsoft.com/windows/terminal/command-line-arguments)、[SetForegroundWindow](https://learn.microsoft.com/windows/win32/api/winuser/nf-winuser-setforegroundwindow)、[UIA SetFocus](https://learn.microsoft.com/dotnet/api/system.windows.automation.automationelement.setfocus)。
