# Windows 开发与验证环境

适用于 `env: windows` 的任务（阶段 A 的 T-035、T-040，阶段 B 的 T-029、T-019、T-021、T-044 等）。安装软件前先向用户说明，并取得同意。

## 1. 软件

| 软件 | 版本要求 | 用途 | 检查命令 |
| --- | --- | --- | --- |
| Windows | Windows 11（22H2 或更新） | Windows 11 自带 WebView2 运行时和 Windows Terminal | `winver` |
| Windows Terminal | 当前稳定版，记录版本号 | 目标终端 | 设置 → 关于 |
| PowerShell | 7.4 或更新（自带 PSReadLine 2.3.x） | 目标 shell | `$PSVersionTable`、`Get-Module PSReadLine` |
| .NET SDK | **10.0**（长期支持版；D-012） | 阶段 B 的悬浮窗宿主和 wt-driver | `dotnet --info` |
| Node.js | 22 LTS（inshellisense 要求 `>=18 <23`） | 运行和构建 inshellisense（阶段 A） | `node --version` |
| Git | 任意较新版本 | 拉取仓库和参考源码 | `git --version` |
| Accessibility Insights for Windows 或 `inspect.exe`（Windows SDK） | — | 查看 Windows Terminal 暴露的 UIA 树（T-019） | — |

推荐用 winget 安装，例如 `winget install Microsoft.PowerShell Microsoft.DotNet.SDK.10 Git.Git`，具体包名以 `winget search` 的结果为准。

**Node 必须是 22.x**：winget 的 `OpenJS.NodeJS.LTS` 可能已经是 24 版，超出 inshellisense 的要求。建议用 fnm 管理版本：`winget install Schniz.fnm`，然后运行 `fnm install 22` 和 `fnm use 22`。

## 2. 开始之前

```powershell
git clone <本仓库地址>
cd fig-windows-research
git switch develop
sh scripts/fetch-sources.sh      # 需要 Git Bash；也可以按脚本内容手动执行 git 命令
```

运行 `pwsh -NoProfile -File scripts/windows/check-env.ps1`，把输出的表格粘贴到验证报告的开头。这个脚本只读取版本信息，不安装任何东西。

**必须在用户自己打开的 Windows Terminal 标签页中运行**，不要用 AI 工具自带的 PowerShell。T-035 时，AI 工具自带的 PowerShell 7.6.5 被当成了本机环境；用户自己的 WT 中其实找不到 `pwsh.exe`，也就是没有安装 PowerShell 7（T-057）。

## 3. 验证程序的存放与报告

- 验证代码放在 `spikes/T-0xx-<简称>/`，属于本项目自写的代码（MIT）。每个目录都要有 `README.md`，写明运行方法。
- 原始的截图、录屏和日志放在 `local/evidence/`，并在 `research/evidence.md` 中登记。
- 报告写入 `research/spike-*.md`，内容包括：环境版本、测试矩阵、测量数据、结论（通过或不通过），以及对 `docs/overlay-design.md` 估算的修正。

### T-019 光标定位的测量方法

1. 在 Windows Terminal 中打开 pwsh，输入固定文本，例如 `git checkout 中文路径`。
2. 测量光标的真实位置：截屏后，读取光标左上角的像素坐标（物理像素）。
3. 用待测方法得到坐标，计算与真实位置在 x、y 方向上的误差，单位为像素，并换算成字符宽度。
4. 测试矩阵：

| 维度 | 取值 |
| --- | --- |
| DPI 缩放 | 100%、150%、200% |
| 显示器 | 单显示器；双显示器，并且两块屏幕的 DPI 不同 |
| 布局 | 单窗格；左右分屏；上下分屏 |
| 缓冲区 | 刚打开；滚动了几屏之后；在最底部 |
| 光标位置 | 行首；行尾；命令跨两行时的第二行 |
| 窗口 | 正常；最大化；全屏 |

5. 记录每次取得坐标的耗时，最好给出 p50 和 p95。

具体可以尝试的方法见 `research/prior-art.md` 和 `docs/overlay-design.md`。
