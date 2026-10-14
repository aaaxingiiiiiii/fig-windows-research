# Windows 开发与验证环境

适用于 `env: windows` 的任务（T-019 至 T-022，以及后续开发）。安装软件前先向用户说明，并取得同意。

## 1. 软件

| 软件 | 版本要求 | 用途 | 检查命令 |
| --- | --- | --- | --- |
| Windows | Windows 11（22H2 或更新） | Windows 11 自带 WebView2 运行时和 Windows Terminal | `winver` |
| Windows Terminal | 当前稳定版，记录版本号 | 目标终端 | 设置 → 关于 |
| PowerShell | 7.4 或更新（自带 PSReadLine 2.3.x） | 目标 shell | `$PSVersionTable`、`Get-Module PSReadLine` |
| .NET SDK | 8.0 或更新 | 宿主进程和验证程序 | `dotnet --info` |
| Node.js | 22 LTS，加 pnpm | 构建 Fig 补全前端（T-022） | `node --version`、`pnpm --version` |
| Git | 任意较新版本 | 拉取仓库和参考源码 | `git --version` |
| Accessibility Insights for Windows 或 `inspect.exe`（Windows SDK） | — | 查看 Windows Terminal 暴露的 UIA 树（T-019） | — |

推荐用 winget 安装，例如 `winget install Microsoft.PowerShell Microsoft.DotNet.SDK.8 OpenJS.NodeJS.LTS Git.Git`。具体包名以 `winget search` 的结果为准。

## 2. 开始之前

```powershell
git clone <本仓库地址>
cd fig-windows-research
sh scripts/fetch-sources.sh      # 需要 Git Bash；也可以按脚本内容手动执行 git 命令
```

把 Windows、Windows Terminal、PowerShell、PSReadLine 和 .NET 的版本写入验证报告的开头。

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
